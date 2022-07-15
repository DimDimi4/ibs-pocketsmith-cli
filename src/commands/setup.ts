import * as chalk from 'chalk';
import { CliUx } from '@oclif/core';
import { CompanyTypes } from 'israeli-bank-scrapers';

import { LOAN_KEY, PS_KEY, ServiceConfig } from '../types';
import Command from '../base';

export class Setup extends Command {
    static description = 'setup service configuration';

    static args = [
        {
            name: 'service',
            required: true,
            description: 'service to setup',
            options: [PS_KEY, CompanyTypes.leumi, CompanyTypes.max, LOAN_KEY]
        }
    ];

    async run() {
        const { args } = this.parse(Setup);

        switch (args.service) {
            case PS_KEY:
                this.settings.set(PS_KEY, await this.setupPocketsmith());
                break;
            case LOAN_KEY:
                this.settings.set(LOAN_KEY, await this.setupLoanAccount());
                break;
            case CompanyTypes.leumi:
                this.settings.set(CompanyTypes.leumi, await this.setupService());
                break;
            case CompanyTypes.max:
                this.settings.set(CompanyTypes.max, await this.setupService());
                break;
            default:
                this.error(`Unknown service: ${args.service}`);
        }

        this.log(
            `${chalk.green('[Success]')} Credentials for ${args.service} were successfully saved`
        );
    }

    async setupPocketsmith(): Promise<string> {
        return await CliUx.ux.prompt('Enter development key', {
            type: 'mask',
            required: true
        });
    }

    async setupLoanAccount(): Promise<string> {
        return await CliUx.ux.prompt('Enter pocketsmith account number', {
            type: 'mask',
            required: true
        });
    }

    async setupService(): Promise<ServiceConfig> {
        const accountNumber: number = await CliUx.ux.prompt('Enter pocketsmith account number', {
            type: 'mask',
            required: true
        });

        const username: string = await CliUx.ux.prompt('Enter credentials username', {
            type: 'mask',
            required: true
        });

        const password: string = await CliUx.ux.prompt('Enter credentials password', {
            type: 'mask',
            required: true
        });

        return {
            accountNumber,
            credentials: {
                username,
                password
            }
        };
    }
}
