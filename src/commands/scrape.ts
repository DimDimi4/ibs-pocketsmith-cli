import * as inquirer from 'inquirer';
import * as chalk from 'chalk';
import { SCRAPERS, CompanyTypes } from 'israeli-bank-scrapers';

import { validateNonEmpty } from '../utils';

import Command from '../base';

interface ScrapersList {
    [key: string]: {
        name: string;
        loginFields: string[];
    };
}

const Scrapers: ScrapersList = SCRAPERS;

export class Scrape extends Command {
    static description = 'scrape bank results with selected scraper';

    async run() {
        const idAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'id',
                message: 'Which scraper would you like to use?',
                choices: Object.keys(CompanyTypes).map((id) => {
                    return {
                        name: `${Scrapers[id].name}`,
                        value: id
                    };
                })
            }
        ]);

        const questions = Scrapers[idAnswer.id].loginFields.map((field) => {
            return {
                type: field === 'password' ? 'password' : 'input',
                name: field,
                message: `Enter value for ${field}:`,
                validate: (input: string) => validateNonEmpty(field, input)
            };
        });
        const credentialsAnswer = await inquirer.prompt(questions);

        // this.log(
        //     `${chalk.green('[Success]')} credentials for ${
        //         nameAnswer.value
        //     } were saved successfully`
        // );
    }
}
