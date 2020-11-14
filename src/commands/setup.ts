import * as inquirer from 'inquirer';
import * as chalk from 'chalk';

import { validateNonEmpty } from '../utils';
import Command from '../base';

export class Setup extends Command {
    static description = 'setup pocketsmith development key';

    async run() {
        const answers = await inquirer.prompt([
            {
                type: 'password',
                message: 'Enter development key',
                name: 'devKey',
                validate: (input: string) => validateNonEmpty('devKey', input)
            }
        ]);

        this.settings.set('psDevKey', answers.devKey);

        this.log(`${chalk.green('[Success]')} Development key was saved successfully`);
    }
}
