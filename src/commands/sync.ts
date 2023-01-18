import { format } from 'date-fns';
import { Parser } from 'json2csv';
import { promises as fs } from 'fs';
import { ensureDirSync } from 'fs-extra';

import { CompanyTypes } from 'israeli-bank-scrapers';
import * as progress from 'cli-progress';
import axios from 'axios';

import {
  DB,
  DBTransaction,
  SynArgs,
  PS_KEY,
  PocketsmithTransaction,
  LOAN_KEY,
  CompanyType
} from '../types';
import Command from '../base';
import { join } from 'path';

const CARD_TRANSACTIONS = ['כרטיס דביט', 'מקס איט פינ', 'לאומי ויזה'];

export default class Sync extends Command {
  static description = 'sync financial data to pocketsmith';

  static args = [
    {
      name: 'service',
      description: 'financial service to get data from',
      required: true,
      options: [CompanyTypes.leumi, CompanyTypes.max]
    },
    {
      name: 'export',
      description: 'export to CSV file',
      required: false,
      type: 'boolean'
    }
  ];

  private txns: DBTransaction[] = [];
  private companyType: CompanyType = CompanyTypes.leumi;
  private export: boolean = false;
  private dataToExport: Map<string, PocketsmithTransaction[]> = new Map();

  public async run(): Promise<void> {
    try {
      const { args } = this.parse<{}, SynArgs>(Sync);

      this.companyType = args.service;
      this.export = args.export || false;

      await this.fetchTxns();

      switch (this.companyType) {
        case CompanyTypes.leumi:
          await this.syncLeumi();
          break;
        case CompanyTypes.max:
          await this.syncMax();
          break;
        default:
          this.error(`Unknown service: ${this.companyType}`);
      }

      if (this.export) {
        await this.exportToCsv();
      }
    } catch (error: any) {
      this.error(error);
    }
  }

  private async fetchTxns() {
    const txns = await this.getTxns(this.companyType);
    if (!txns || txns.length === 0) {
      this.error(`No ${this.companyType} transactions found`);
    }

    const filtered = txns.filter((txn) => !txn.synced);
    if (filtered.length === 0) {
      this.error(`No new ${this.companyType} transactions found`);
    }

    this.txns = filtered;
  }

  private async syncMax() {
    const maxConfig = await this.settings.get(CompanyTypes.max);
    if (!maxConfig) {
      this.error(`No ${CompanyTypes.max} config found`);
    }

    this.log(`Syncing ${this.txns.length} transactions`);

    const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

    bar.start(this.txns.length, 0);

    for (const txn of this.txns) {
      await this.syncToPocketsmith(maxConfig.accountNumber, CompanyTypes.max, {
        payee: txn.description,
        amount: txn.chargedAmount,
        date: this.normalizeDate(txn.date),
        note: txn.memo,
        labels: `sync-${format(new Date(), 'ddLLyy')}`,
        needs_review: true
      });

      await this.markAsSynced(CompanyTypes.max, txn);

      bar.increment();
    }

    bar.stop();

    this.log(`[Success] ${CompanyTypes.max} was successfully synced`);
  }

  private async syncLeumi() {
    const leumiConfig = await this.settings.get(CompanyTypes.leumi);
    if (!leumiConfig) {
      this.error(`No ${CompanyTypes.leumi} config found`);
    }

    const maxConfig = await this.settings.get(CompanyTypes.max);
    if (!maxConfig) {
      this.error(`No ${CompanyTypes.max} config found`);
    }

    this.log(`Syncing ${this.txns.length} transactions`);

    const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

    bar.start(this.txns.length, 0);

    for (const txn of this.txns) {
      let payload: PocketsmithTransaction = {
        payee: txn.description,
        amount: txn.chargedAmount,
        date: this.normalizeDate(txn.date),
        note: txn.memo,
        labels: `sync-${format(new Date(), 'ddLLyy')}`,
        needs_review: true
      };

      for (const desc of CARD_TRANSACTIONS) {
        if (!txn.description.includes(desc) || txn.description === `דמי ${desc}`) continue;

        payload.is_transfer = true;

        await this.syncToPocketsmith(maxConfig.accountNumber, CompanyTypes.max, {
          ...payload,
          amount: txn.chargedAmount * -1
        });
      }

      await this.syncToPocketsmith(leumiConfig.accountNumber, CompanyTypes.leumi, payload);

      await this.markAsSynced(CompanyTypes.leumi, txn);

      bar.increment();
    }

    bar.stop();

    this.log(`[Success] ${CompanyTypes.leumi} was successfully synced`);
  }

  private async markAsSynced(companyType: CompanyType, txn: DBTransaction) {
    const id = String(
      txn.identifier
        ? `${txn.identifier}|${txn.date}`
        : `${txn.date}|${txn.chargedAmount}|${txn.description}`
    );
    const index = await this.db.getIndex(`${DB}/${companyType}`, id);

    if (index > 0) {
      await this.db.push(`${DB}/${companyType}[${index}]/synced`, true, true);
    }
  }

  private async syncToPocketsmith(
    accountNumber: number,
    accountType: CompanyType | typeof LOAN_KEY,
    transaction: PocketsmithTransaction
  ) {
    if (this.export) {
      const key = `${accountType}-${accountNumber}`;
      const account = this.dataToExport.get(key) || [];
      account.push(transaction);
      this.dataToExport.set(key, account);
      return;
    }

    const psKey = await this.settings.get(PS_KEY);
    await axios.post(
      `https://api.pocketsmith.com/v2/transaction_accounts/${accountNumber}/transactions`,
      transaction,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Developer-Key': psKey
        }
      }
    );
  }

  private async exportToCsv() {
    const json2csvParser = new Parser();

    this.dataToExport.forEach(async (transactions, fileName) => {
      const csv = json2csvParser.parse(transactions);

      const path = join(process.cwd(), 'exports');
      const file = join(path, `${this.companyType}-${fileName}.csv`);

      ensureDirSync(path);

      await fs.writeFile(file, csv);

      this.log(`[Success] ${path} was successfully exported`);
    });
  }
}
