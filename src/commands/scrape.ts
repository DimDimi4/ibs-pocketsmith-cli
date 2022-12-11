import { parse, isValid } from 'date-fns';
import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';
import { CliUx } from '@oclif/core';
import { ScraperCredentials } from 'israeli-bank-scrapers/lib/scrapers/base-scraper';

import { DB, DBTransaction, ScrapeArgs, CompanyType } from '../types';
import Command from '../base';

export default class Scrape extends Command {
  static description = 'scrape financial data from source';

  static args = [
    {
      name: 'service',
      description: 'financial service to get data from',
      required: true,
      options: [CompanyTypes.leumi, CompanyTypes.max]
    },
    {
      name: 'startDate',
      description: 'start date to sync transactions from in format d/M (e.g. 21/12)'
    }
  ];

  public async run(): Promise<void> {
    try {
      const { args } = this.parse<{}, ScrapeArgs>(Scrape);

      switch (args.service) {
        case CompanyTypes.leumi:
          return this.scrape(CompanyTypes.leumi, args.startDate);
        case CompanyTypes.max:
          return this.scrape(CompanyTypes.max, args.startDate);
        default:
          this.error(`Unknown service: ${args.service}`);
      }
    } catch (error: any) {
      this.error(error);
    }
  }

  private async scrape(companyType: CompanyType, startDateArg?: string) {
    const config = await this.settings.get(companyType);
    if (!config) {
      this.error(`No ${companyType} config found`);
    }

    const startDate = await this.getStartDate(companyType, startDateArg);

    this.log(`Start date ${startDate}`);

    const scraper = createScraper({
      companyId: companyType,
      startDate: startDate,
      combineInstallments: true,
      showBrowser: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      verbose: true
    });

    CliUx.ux.action.start(`Scraping ${companyType}`);

    const scrapeResult = await scraper.scrape(config.credentials as unknown as ScraperCredentials);

    if (!scrapeResult.success) {
      this.error(`Scraping failed for the following reason: ${JSON.stringify(scrapeResult)}`);
    }

    if (!scrapeResult.accounts || scrapeResult.accounts.length === 0) {
      this.error(`no accounts found`);
    }

    for (const account of scrapeResult.accounts) {
      let count = 0;

      for (const txn of account.txns) {
        if (txn.status !== 'completed') continue;

        const id = txn.identifier || `${txn.date}|${txn.chargedAmount}|${txn.description}`;
        const index = await this.db.getIndex(`${DB}/${companyType}`, id);
        if (index === -1) {
          await this.db.push(`${DB}/${companyType}[]`, { id, ...txn });
          count++;
        }
      }

      this.log(
        `Stored ${count} of ${account.txns.length} transactions for account number ${account.accountNumber}`
      );
    }

    this.log(`[Success] ${companyType} was successfully scraped`);
  }

  private async getStartDate(companyType: CompanyType, startDateArg?: string): Promise<Date> {
    if (startDateArg) {
      const startDate = parse(startDateArg, 'd/M', new Date());
      if (!isValid(startDate)) {
        this.error(`Invalid start date: ${startDateArg}`);
      }
      return this.normalizeDate(startDate);
    }

    const lastTxn = await this.db.getObject<DBTransaction | undefined>(`${DB}/${companyType}[0]`);
    if (!lastTxn) {
      return this.error(
        `No transactions found for ${companyType} so no start date can be inferred`
      );
    }

    return this.normalizeDate(new Date(lastTxn.date));
  }
}
