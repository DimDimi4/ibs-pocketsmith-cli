import * as chalk from 'chalk';
import { utcToZonedTime } from 'date-fns-tz';
import { parse, isValid, format, add, startOfDay } from 'date-fns';
import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import { CliUx } from '@oclif/core';
import * as progress from 'cli-progress';
import axios from 'axios';

import { SynArgs, PS_KEY, PocketsmithTransaction, LOAN_KEY } from '../types';
import Command from '../base';
import { ScraperCredentials } from 'israeli-bank-scrapers/lib/scrapers/base-scraper';

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
        },
        {
            name: 'startDate',
            description: 'start date to sync transactions from',
            required: true
        }
    ];

    public async run(): Promise<void> {
        try {
            const { args } = this.parse<{}, SynArgs>(Sync);

            let startDate = parse(args.startDate, 'd/M', new Date());
            if (!isValid(startDate)) {
                this.error(`Invalid start date: ${args.startDate}`);
            }
            startDate = this.normalizeDate(startDate);

            switch (args.service) {
                case CompanyTypes.leumi:
                    return this.syncLeumi(startDate);
                case CompanyTypes.max:
                    return this.syncMax(startDate);
                default:
                    this.error(`Unknown service: ${args.service}`);
            }
        } catch (error: any) {
            this.error(error);
        }
    }

    private async syncMax(startDate: Date) {
        const maxConfig = await this.settings.get(CompanyTypes.max);

        const scraper = createScraper({
            companyId: CompanyTypes.max,
            startDate: startDate,
            combineInstallments: true,
            showBrowser: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            verbose: true
        });

        CliUx.ux.action.start(`Scraping ${chalk.green(CompanyTypes.max)}`);

        const scrapeResult = await scraper.scrape(
            maxConfig.credentials as unknown as ScraperCredentials
        );

        CliUx.ux.action.stop();

        if (!scrapeResult.success) {
            this.error(`Scraping failed for the following reason: ${JSON.stringify(scrapeResult)}`);
        }

        if (!scrapeResult.accounts || scrapeResult.accounts.length === 0) {
            this.error(`no accounts found`);
        }

        const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

        for (const account of scrapeResult.accounts) {
            this.log(
                `Syncing ${account.txns.length} transactions for account number ${account.accountNumber}:`
            );

            bar.start(account.txns.length, 0);

            for (const txn of account.txns) {
                if (txn.status === 'completed') {
                    await this.syncToPocketsmith(maxConfig.accountNumber, {
                        payee: txn.description,
                        amount: txn.chargedAmount,
                        date: this.normalizeDate(new Date(txn.date)).toString(),
                        note: txn.memo,
                        labels: `sync-${format(new Date(), 'ddLLyy')}`,
                        needs_review: true
                    });
                }
                bar.increment();
            }

            bar.stop();
        }

        this.log(`${chalk.green('[Success]')} ${CompanyTypes.max} was successfully synced`);
    }

    private async syncLeumi(startDate: Date) {
        const leumiConfig = await this.settings.get(CompanyTypes.leumi);
        const maxConfig = await this.settings.get(CompanyTypes.max);
        const loanConfig: number = await this.settings.get(LOAN_KEY);

        const scraper = createScraper({
            companyId: CompanyTypes.leumi,
            startDate: startDate,
            combineInstallments: true,
            showBrowser: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            verbose: true
        });

        CliUx.ux.action.start(`Scraping ${chalk.green(CompanyTypes.leumi)}`);

        const scrapeResult = await scraper.scrape(
            leumiConfig.credentials as unknown as ScraperCredentials
        );

        CliUx.ux.action.stop();

        if (!scrapeResult.success) {
            this.error(`Scraping failed for the following reason: ${JSON.stringify(scrapeResult)}`);
        }

        if (!scrapeResult.accounts || scrapeResult.accounts.length === 0) {
            this.error(`no accounts found`);
        }

        const bar = new progress.SingleBar({}, progress.Presets.shades_classic);

        for (const account of scrapeResult.accounts) {
            this.log(
                `Syncing ${account.txns.length} transactions for account number ${account.accountNumber}:`
            );

            bar.start(account.txns.length, 0);

            for (const txn of account.txns) {
                if (txn.status !== 'completed') {
                    bar.increment();
                    continue;
                }

                let payload: PocketsmithTransaction = {
                    payee: txn.description,
                    amount: txn.chargedAmount,
                    date: this.normalizeDate(new Date(txn.date)).toString(),
                    note: txn.memo,
                    labels: `sync-${format(new Date(), 'ddLLyy')}`,
                    needs_review: true
                };

                for (const desc of CARD_TRANSACTIONS) {
                    if (!txn.description.includes(desc) || txn.description === `דמי ${desc}`)
                        continue;

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

                bar.increment();
            }

            bar.stop();
        }

        this.log(`${chalk.green('[Success]')} ${CompanyTypes.leumi} was successfully synced`);
    }

    private normalizeDate(date: Date): Date {
        return utcToZonedTime(startOfDay(date), 'Asia/Jerusalem');
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
