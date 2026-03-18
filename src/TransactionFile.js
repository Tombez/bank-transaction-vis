import {Named} from './Named.js';
import {Csv, CSV_DATA_TYPES} from './Csv.js';
import {CsvViewer} from './CsvViewer.js';
import {fromDateString, dateToMdy} from './date-utils.js';
import {makeDraggable} from './dragAndDrop.js';
import {Range} from './utils.js';

// Performance critical code, logically equivalent to:
// const sanitizeAmountText = text => text.replace(/[^-\d\.]/g, '');
const code0 = '0'.charCodeAt(0);
const code9 = '9'.charCodeAt(0);
const codeMinus = '-'.charCodeAt(0);
const codeDecimal = '.'.charCodeAt(0);
const sanitizeAmountText = text => {
    const codes = [];
    for (let i = 0; i < text.length; ++i) {
        const code = text.charCodeAt(i);
        if (code >= code0 && code <= code9 || code == codeMinus ||
            code == codeDecimal) codes.push(code);
    }
    return String.fromCharCode(...codes);
};

const toCents = x => Math.round(x * 100) / 100;

class Transaction {
    constructor(date, desc, amount, row, transactionFile) {
        this.date = fromDateString(date);
        this.desc = desc;
        this.amount = +amount;
        this.row = row;
        this.transactionFile = transactionFile;

        this.timestamp = this.date.getTime();
        this.year = this.date.getFullYear();
        this.month = this.date.getMonth() + 1;
        this.quarter = (this.month - 1) / 3 | 0;
        this.day = this.date.getDate();
    }
}

export class Filter {
    constructor(label, test) {
        this.label = label;
        this.test = test;
    }
}

const getEndOfDayBalance = (transactions) => {
    if (!transactions.length) return null;
  
    const changes = new Map();
    for (const transaction of transactions) {
        const away = toCents(transaction.balance - transaction.amount);
        const to = transaction.balance;
        const awayCount = (changes.get(away) || 0) - 1;
        if (awayCount) changes.set(away, awayCount);
        else changes.delete(away);
        const toCount = (changes.get(to) || 0) + 1;
        if (toCount) changes.set(to, toCount);
        else changes.delete(to);
    }
    for (const [key, value] of changes.entries()) if (value == 1) return key;
    return null;
};



const colSearches = [
    ['date', CSV_DATA_TYPES.DATE, true,
        /^((transaction|trade|post(ed|ing)|effective|booking) )?date( created)?$/i
    ],
    ['debit', CSV_DATA_TYPES.NUMBER, true,
        /^(transaction |net )?amount|withdrawals?|debits?$/i],
    ['credit', CSV_DATA_TYPES.NUMBER, true,
        /^(transaction |net )?amount|deposits?|credits?$/i],
    ['description', CSV_DATA_TYPES.STRING, false,
        /^(transaction )?description$/i],
    ['balance', CSV_DATA_TYPES.NUMBER, false,
        /^(account )?balance$/i],
].map(([name, type, required, regex]) => ({ name, type, required, regex }));
export class TransactionFile extends Named {
    constructor(file, csv) {
        super(file.name, {
            settingName: 'file',
            icon: '📄',
            titleType: 'h4',
            titleClass: 'file-title'
        });
        this.csv = csv;
        csv.rows = csv.rows.filter(row => row.length);
        this.isFullyFilled = false;
        this.settings.add('checkbox', 'hasHeader', 'Does this file have column names in the first row?', {change: event => {
            const checked = event.target.checked;
            if (checked && !csv.hasHeader) {
                csv.headings = csv.rows.shift();
                csv.hasHeader = true;
            } else if (!checked && csv.hasHeader) {
                csv.rows.unshift(csv.headings.map(h => h.text));
                csv.hasHeader = false;
            }
            csv.update();
            this.settings.set('hasHeader', checked);
        }});
        this.settings.set('hasHeader', csv.hasHeader);
        this.transactions = [];

        // Add Column Settings
        const colOptions = ['Unset',
            ...(csv.hasHeader ? csv.headings.map(h => h.text) : csv.rows[0])];
        for (const {name, required} of colSearches) {
            this.settings.add('select', name,
                `Which column contains transaction ${name}s?`, {}, colOptions,
            required);
        }

        this.settings.add('checkbox', 'hasCdIndicator',
            'Is there a credit/debit indicator column?', {change: event => {
            // cdIndSetting.parentNode.style.display = event.target.checked ? 'block' : 'none';
            this.settings.set('hasCdIndicator', event.target.checked);
        }});
        this.settings.add('select', 'cdIndicator',
            'Which is the credit/debit indicator column?', {}, colOptions);
        // cdIndSetting.parentNode.style.display = 'none';

        const changeOld = this.settings.settingChanged;
        this.settings.settingChanged = (event) => {
            changeOld.apply(this.settings, event);
            this.settingChanged(event);
        };
        this.identifyCols();
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('transaction-file-container');
        makeDraggable(this.node, this, this.header);
        this.checkFullyFilled();
    }
    generateContentHtml() {
        super.generateContentHtml();
        this.settings.updateInputs();

        // Append Viewer
        const header = this.csv.hasHeader && this.csv.headings;
        let viewer = new CsvViewer(this.csv);
        this.content.node.appendChild(viewer.node);
    }
    identifyCols() {
        if (this.csv.hasHeader) {
            // Column Identification By Name
            const indices = this.csv.headings.map((_,i) => i);
            for (const {type, name, regex} of colSearches) {
                if (this.settings.has(name)) continue;

                let colIndices = indices
                    .filter(i => regex.test(this.csv.headings[i].text) &&
                        this.csv.headings[i].type == type);
                if (!colIndices.length) continue;
                
                this.settings.set(name, colIndices[0]);
            }

            if (!this.settings.has('hasCdIndicator') ||
                !this.settings.has('cdIndicator')
            ) {
                // Check for credit/debit indicator
                const cdIndicator = this.csv.headings.map(h => h.text)
                    .findIndex(colName =>
                        /^(credit debit )?indicator$/i.test(colName));
                if (cdIndicator > -1) {
                    this.settings.set('hasCdIndicator', true);
                    this.settings.set('cdIndicator', cdIndicator);
                }
            }
        }

        if (this.csv.rows.length) {
            // Column Identification by type
            const indices = this.csv.rows[0].map((_, i) => i);
            const required = colSearches.filter(s => s.required);
            for (const {type, name} of required) {
                if (this.settings.has(name)) continue;
                let colIndices = indices.filter(i =>
                    this.csv.headings[i].type == type);
                if (colIndices.length == 1) this.settings.set(name, colIndices[0]);
            }
        }
        this.settings.updateInputs();
        this.settingChanged();
    }
    settingChanged(event) {
        // if (this.settings.get('hasCdIndicator')) {
        //     const cdIndicator = this.settings.inputs['cdIndicator'];
        //     if (cdIndicator) cdIndicator.parentNode.style.display = 'block';
        // }

        if (event) this.identifyCols();
        this.checkFullyFilled();
    }
    checkFullyFilled() {
        const required = colSearches.filter(s => s.required);
        this.isFullyFilled = required.every(({name}) =>
            this.settings.has(name) && this.settings.get(name) > -1);
        super.updateFilledStyle();
    }
    getTransactions() {
        const transactions = [];
        const hasCdIndicator = this.settings.get('hasCdIndicator');
        const indIndex = this.settings.get('cdIndicator');
        const dateIndex = this.settings.get('date');
        const descIndex = this.settings.get('description');
        const debitIndex = this.settings.get('debit');
        const creditIndex = this.settings.get('credit');
        const balIndex = this.settings.get('balance');
        const oneCol = debitIndex === creditIndex;
        for (const row of this.csv.rows) {
            const date = row[dateIndex];
            const desc = row[descIndex] || '';
            let debit = sanitizeAmountText(row[debitIndex]);
            const isDebit = hasCdIndicator && indIndex > -1 &&
                /debit/i.test(row[indIndex]) || !oneCol && debit;
            if (isDebit && !debit.startsWith('-'))
                debit = '-' + debit;
            const amount = isDebit ? debit : sanitizeAmountText(row[creditIndex]);
            const transaction = new Transaction(date, desc, amount, row, this);
            if (balIndex != undefined && balIndex > -1 && row[balIndex])
                transaction.balance = +sanitizeAmountText(row[balIndex]);

            transactions.push(transaction);
        }
        return this.transactions = transactions;
    }
    compile() {
        if (!this.isFullyFilled) return;
        this.getTransactions();
        if (this.transactions.length) {
            const stamps = this.transactions.values().map(t => t.timestamp);
            this.stampRange = Range.fromValues(stamps);
        }
        this.balancePoints = this.getBalancePoints();
    }
    getBalancePoints() {
        let points = [];
        const hasBalTs = this.transactions.filter(t => t.balance != undefined);
        hasBalTs.sort((a, b) => a.timestamp - b.timestamp);
        for (let i = 0; i < hasBalTs.length; ++i) {
            const time = hasBalTs[i].timestamp;
            let end = i;
            while (end < hasBalTs.length && hasBalTs[end].timestamp == time) ++end;
            let sameDay = hasBalTs.slice(i, end);
            const balance = getEndOfDayBalance(sameDay);
            if (balance != null)
                points.push({timestamp: time, balance});
            i = end - 1;
        }
        return points;
    }
    encode() {
        return {
            settings: this.settings.encode(),
            csv: this.csv.toString()
        };
    }
    static decode(tranFileObj) {
        const name = tranFileObj.settings['file'];
        const csv = new Csv(tranFileObj.csv);
        let tranFile = new TransactionFile({name}, csv);
        tranFile.settings.fromEncoded(tranFileObj.settings);
        tranFile.checkFullyFilled();
        return tranFile;
    }
}