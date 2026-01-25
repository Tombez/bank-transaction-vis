import {Named} from './Named.js';
import {Csv, CSV_DATA_TYPES} from './Csv.js';
import {CsvViewer} from './CsvViewer.js';
import {fromDateString, dateToMdy} from './date-utils.js';
import {makeDraggable} from './dragAndDrop.js';

const sanitize$Text = text => text.replaceAll(/[^-\d\.]/g, "");

class Transaction {
    constructor(date, desc, amount, row, transactionFile) {
        this.date = fromDateString(date);
        this.desc = desc;
        this.amount = +amount;
        this.row = row;
        this.transactionFile = transactionFile;
    }
}

const colSearches = [
    [CSV_DATA_TYPES.DATE, 'date', /^((transaction|trade|post(ed|ing)|effective|booking) )?date( created)?$/i],
    [CSV_DATA_TYPES.STRING, 'description', /^(transaction )?description$/i],
    [CSV_DATA_TYPES.NUMBER, 'debit', /^(transaction |net )?amount|withdrawals?|debits?$/i],
    [CSV_DATA_TYPES.NUMBER, 'credit', /^(transaction |net )?amount|deposits?|credits?$/i],
];
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
                csv.rows.unshift(csv.headings);
                csv.hasHeader = false;
            }
            this.settings.set('hasHeader', checked);
        }});
        this.settings.set('hasHeader', csv.hasHeader);

        // Add Column Settings
        const colOptions = ['Unset', ...(csv.headings || csv.rows[0])];
        for (const [type, name, regex] of colSearches) {
            this.settings.add('select', name,
                `Which column contains transaction ${name}s?`, {}, colOptions);
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
        const indices = this.csv.headings.map((_,i) => i);
        if (this.csv.hasHeader) {
            // Column Identification By Name
            for (const [type, name, regex] of colSearches) {
                if (this.settings.has(name)) continue;

                let colIndices = indices
                    .filter(i =>
                        regex.test(this.csv.headings[i]) &&
                        this.csv.colTypes[i].size == 1 &&
                        Array.from(this.csv.colTypes[i].values())[0] == type);
                if (!colIndices.length) continue;
                
                this.settings.set(name, colIndices[0]);
            }

            if (!this.settings.has('hasCdIndicator') ||
                !this.settings.has('cdIndicator')
            ) {
                // Check for credit/debit indicator
                const cdIndicator = this.csv.headings.findIndex(colName =>
                    /^(credit debit )?indicator$/i.test(colName));
                if (cdIndicator > -1) {
                    this.settings.set('hasCdIndicator', true);
                    this.settings.set('cdIndicator', cdIndicator);
                }
            }
        } else {
            
        }

        // Column Identification by type
        for (const [type, name] of colSearches) {
            if (this.settings.has(name)) continue;
            let colIndices = indices.filter(i =>
                this.csv.colTypes[i].size == 1 &&
                Array.from(this.csv.colTypes[i].values())[0] == type);
            if (colIndices.length == 1) this.settings.set(name, colIndices[0]);
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
        this.isFullyFilled = colSearches.every(([, name]) =>
            this.settings.has(name) && this.settings.get(name) > -1);
        if (this.hasNode) {
            if (this.isFullyFilled) {
                this.header.classList.add('fully-filled');
            } else this.header.classList.remove('fully-filled');
        }
    }
    getSimplifiedCsv(accountName) {
        const simpleCsv = this.csv.makeReorder([
            -1, this.settings.get('date'), -1,
            this.settings.get('description'), -1]);
        simpleCsv.headings = `Account,Transaction Date,Posted Date,Description,Amount`.split(',');
        if (!simpleCsv.rows.length) return simpleCsv;
        
        const amtCol = simpleCsv.headings.indexOf('Amount');
        const indCol = this.settings.get('cdIndicator');
        for (let y = 0; y < simpleCsv.rows.length; ++y) {
            const row = simpleCsv.rows[y];
            const oldRow = this.csv.rows[y];
            let debit = sanitize$Text(oldRow[this.settings.get('debit')]);
            const credit = sanitize$Text(oldRow[this.settings.get('credit')]);
            const oneCol = this.settings.get('debit') === this.settings.get('credit');
            const isDebit = this.settings.get('hasCdIndicator') && indCol > -1 &&
                /debit/i.test(oldRow[indCol]) || !oneCol && debit;
            if (isDebit && !debit.startsWith('-'))
                debit = '-' + debit;
            row[amtCol] = isDebit ? debit : credit;
        }

        for (const row of simpleCsv.rows) {
            const accCol = simpleCsv.headings.indexOf('Account');
            row[accCol] = accountName;

            const dateCol = simpleCsv.headings.indexOf('Transaction Date');
            row[dateCol] = dateToMdy(fromDateString(row[dateCol]));
        }
        return simpleCsv;
    }
    getTransactions() {
        const transactions = [];
        const indCol = this.settings.get('cdIndicator');
        for (const row of this.csv.rows) {
            const date = row[this.settings.get('date')];
            const desc = row[this.settings.get('description')];
            let debit = sanitize$Text(row[this.settings.get('debit')]);
            const credit = sanitize$Text(row[this.settings.get('credit')]);
            const oneCol = this.settings.get('debit') === this.settings.get('credit');
            const isDebit = this.settings.get('hasCdIndicator') && indCol > -1 &&
                /debit/i.test(row[indCol]) || !oneCol && debit;
            if (isDebit && !debit.startsWith('-'))
                debit = '-' + debit;
            const amount = isDebit ? debit : credit;
            transactions.push(new Transaction(date, desc, amount, row, this));
        }
        return transactions;
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