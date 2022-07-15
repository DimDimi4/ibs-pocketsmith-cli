import { CompanyTypes } from 'israeli-bank-scrapers';

export const PS_KEY = 'ps';
export const LOAN_KEY = 'loan';

export interface ServiceConfig {
    accountNumber: number;
    credentials: ServiceCredentials;
}

export interface ServiceCredentials {
    username: string;
    password: string;
}

export interface Configs {
    ps: string;
    leumi: ServiceConfig;
    max: ServiceConfig;
}

export interface SynArgs {
    service: CompanyTypes;
    startDate: string;
}

export interface PocketsmithTransaction {
    payee: string;
    amount: number;
    date: string;
    is_transfer?: boolean;
    labels?: string;
    category_id?: 42;
    note?: string;
    memo?: string;
    cheque_number?: string;
    needs_review?: boolean;
}
