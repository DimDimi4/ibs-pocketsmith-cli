import Conf from 'conf';
import { IConfig } from '@oclif/config';
import Command from '@oclif/command';
import { JsonDB, Config } from 'node-json-db';
import { add } from 'date-fns';

import { Configs, CompanyType, DBTransaction, DB } from './types';
import { join } from 'path';

export default abstract class extends Command {
  protected settings: Conf<Configs>;
  protected db: JsonDB;

  constructor(argv: string[], config: IConfig) {
    super(argv, config);

    this.settings = new Conf<Configs>({
      cwd: this.config.configDir
      // encryptionKey: 'J,Nh-_<jw*3)-k7ydmt$;(QzDta[{h&T),&'
    });

    this.db = new JsonDB(new Config(join(this.config.configDir, 'db'), true, true, '/'));
  }

  async init() {
    super.init();
  }

  async catch(err: Error) {
    return super.catch(err);
  }

  async finally(err: Error) {
    return super.finally(err);
  }

  protected normalizeDate(date: string): string {
    return add(new Date(date), { hours: 12 }).toISOString();
  }

  protected async getTxns(companyType: CompanyType): Promise<DBTransaction[]> {
    const exists = await this.db.exists(`${DB}/${companyType}`);
    if (exists) {
      return this.db.getObject<DBTransaction[]>(`${DB}/${companyType}`);
    }

    return [];
  }
}
