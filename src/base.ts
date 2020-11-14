import Conf from 'conf';
import { IConfig } from '@oclif/config';
import Command from '@oclif/command';

export default abstract class extends Command {
    protected settings: Conf;

    constructor(argv: string[], config: IConfig) {
        super(argv, config);
        this.settings = new Conf({
            cwd: this.config.configDir
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
