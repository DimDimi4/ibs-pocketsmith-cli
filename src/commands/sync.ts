import { format } from 'date-fns';
import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
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

const CARD_TRANSACTIONS = ['כרטיס דביט', 'מקס איט פינ', 'לאומי ויזה'];
const LOAD_TRANSACTIONS = ['פרעון'];

export default class Sync extends Command {
  static description = 'sync financial data to pocketsmith';

  static args = [
    {
      name: 'service',
      description: 'financial service to get data from',
      required: true,
      options: [CompanyTypes.leumi, CompanyTypes.max]
    }
  ];

  public async run(): Promise<void> {
    try {
      const { args } = this.parse<{}, SynArgs>(Sync);

      switch (args.service) {
        case CompanyTypes.leumi:
          await this.syncLeumi(await this.getTxns(CompanyTypes.leumi));
        case CompanyTypes.max:
          await this.syncMax(await this.getTxns(CompanyTypes.max));
        default:
          this.error(`Unknown service: ${args.service}`);
      }
    } catch (error: any) {
      this.error(error);
    }
  }

  private async getTxns(companyType: CompanyType) {
    const txns = await this.db.getObject<DBTransaction[] | undefined>(`${DB}/${companyType}`);
    if (!txns || txns.length === 0) {
      this.error(`No ${companyType} transactions found`);
    }

    const filtered = txns.filter((txn) => !txn.synced);
    if (filtered.length === 0) {
      this.error(`No new ${companyType} transactions found`);
    }

    return filtered;
  }

  private async syncMax(transactions: DBTransaction[]) {
    const maxConfig = await this.settings.get(CompanyTypes.max);
    if (!maxConfig) {
      this.error(`No ${CompanyTypes.max} config found`);
    }

    this.log(`Syncing ${transactions.length} transactions`);

    const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

    bar.start(transactions.length, 0);

    for (const txn of transactions) {
      await this.syncToPocketsmith(maxConfig.accountNumber, {
        payee: txn.description,
        amount: txn.chargedAmount,
        date: this.normalizeDate(new Date(txn.date)).toString(),
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

  private async syncLeumi(transactions: DBTransaction[]) {
    const leumiConfig = await this.settings.get(CompanyTypes.leumi);
    if (!leumiConfig) {
      this.error(`No ${CompanyTypes.leumi} config found`);
    }

    const maxConfig = await this.settings.get(CompanyTypes.max);
    if (!maxConfig) {
      this.error(`No ${CompanyTypes.max} config found`);
    }

    const loanConfig: number = await this.settings.get(LOAN_KEY);
    if (!loanConfig) {
      this.error(`No ${LOAN_KEY} config found`);
    }

    this.log(`Syncing ${transactions.length} transactions`);

    const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

    bar.start(transactions.length, 0);

    for (const txn of transactions) {
      let payload: PocketsmithTransaction = {
        payee: txn.description,
        amount: txn.chargedAmount,
        date: this.normalizeDate(new Date(txn.date)).toString(),
        note: txn.memo,
        labels: `sync-${format(new Date(), 'ddLLyy')}`,
        needs_review: true
      };

      for (const desc of CARD_TRANSACTIONS) {
        if (!txn.description.includes(desc) || txn.description === `דמי ${desc}`) continue;

        payload.is_transfer = true;

        await this.syncToPocketsmith(maxConfig.accountNumber, {
          ...payload,
          amount: txn.chargedAmount * -1
        });
      }

      for (const desc of LOAD_TRANSACTIONS) {
        if (!txn.description.includes(desc)) continue;
        payload.is_transfer = true;

        await this.syncToPocketsmith(loanConfig, {
          ...payload,
          amount: txn.chargedAmount * -1
        });
      }

      await this.syncToPocketsmith(leumiConfig.accountNumber, payload);

      await this.markAsSynced(CompanyTypes.leumi, txn);

      bar.increment();
    }

    bar.stop();

    this.log(`[Success] ${CompanyTypes.leumi} was successfully synced`);
  }

  private async markAsSynced(companyType: CompanyType, txn: DBTransaction) {
    const id = txn.identifier || `${txn.date}|${txn.chargedAmount}|${txn.description}`;
    const index = await this.db.getIndex(`${DB}/${companyType}`, id);

    if (index > 0) {
      await this.db.push(`${DB}/${companyType}[${index}]/synced`, true, true);
    }
  }

  private async syncToPocketsmith(accountNumber: number, transaction: PocketsmithTransaction) {
    const psKey = await this.settings.get(PS_KEY);

    try {
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
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.error(JSON.stringify(error.response?.data));
      } else {
        throw error;
      }
    }
  }
}
