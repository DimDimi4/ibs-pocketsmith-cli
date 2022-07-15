import Conf from 'conf';
import { IConfig } from '@oclif/config';
import Command from '@oclif/command';
import { Configs } from './types';

export default abstract class extends Command {
    protected settings: Conf<Configs>;

    constructor(argv: string[], config: IConfig) {
        super(argv, config);

        this.settings = new Conf<Configs>({
            cwd: this.config.configDir,
            encryptionKey: 'J,Nh-_<jw*3)-k7ydmt$;(QzDta[{h&T),&'
        });
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
}
