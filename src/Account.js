import TransactionViewer from "./TransactionViewer.js";
import {fromDateString, dateToMdy} from "./date-utils.js";

const capitalize = s => s.at(0).toUpperCase() +
            s.slice(1).toLowerCase();
const sanitize$Text = text => text.replaceAll(/[^-\d\.]/g, "");

class HasSetting {
    constructor() {
        this.settingsNode = document.createElement('div');
        this.settings = {};
        this.inputs = {};
    }
    settingChanged(event) {}
    addSetting(type, name, settingText, events, options) {
        const unique = `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;
        const settingId = `setting-${unique}`;
        const frag = document.createElement('div');
        const isSelect = type == 'select';
        const tagName = isSelect ? 'select' : 'input';
        const tagEnd = isSelect ? `>${
            options.map((op, i) => `<option value=${i}>${op}</option>`).join()
        }</select>` : '/>';
        frag.innerHTML = `<label for="${settingId}">
            <${tagName} class="setting" id="${settingId}" type="${type}"${tagEnd}
            ${settingText}
        </label>`;
        this.settingsNode.appendChild(frag);
        const setting = frag.querySelector('#' + settingId);
        for (const eventName in events) {
            setting.addEventListener(eventName, event => {
                if (event.target.type == 'checkbox')
                    event.target.value = event.target.checked;
                events[eventName](event);
                console.debug('assigned settting', eventName);
                this.settingChanged(event);
            });
        }
        return this.inputs[name] = setting;
    }
}


class Named extends HasSetting {
    #nameSettingName;
    #icon;
    constructor(name, {settingName, icon, titleType, className}) {
        super();
        this.pageNode = document.createElement('div');
        this.title = document.createElement(titleType);
        this.title.className = className;
        this.contentNode = document.createElement('div');
        this.contentNode.className = 'content';
        this.contentNode.appendChild(this.settingsNode)
        this.pageNode.appendChild(this.contentNode);
        this.header = document.createElement('div');
        this.header.className = 'header';
        this.header.appendChild(this.title);
        const collapseBtn = document.createElement('div');
        collapseBtn.className = 'icon icon-collapse';
        this.header.appendChild(collapseBtn);
        collapseBtn.addEventListener('click', event => {
            if (this.contentNode.hidden) {
                this.contentNode.hidden = false;
                collapseBtn.className = 'icon icon-collapse';
            } else {
                this.contentNode.hidden = true;
                collapseBtn.className = 'icon icon-expand';
            }
        });
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'icon icon-delete';
        this.header.appendChild(deleteBtn);
        deleteBtn.addEventListener('click', event => {
            this.delete();
        });
        this.pageNode.insertAdjacentElement('afterbegin', this.header);

        this.#nameSettingName = settingName;
        this.#icon = icon;
        this.addSetting('text', settingName, `What is the name of the ${settingName}?`, ({change: event => {
            this.name = event.target.value;
        }}));
        this.name = name;
    }
    get name() {
        return this.settings[this.#nameSettingName];
    }
    set name(name) {
        this.settings[this.#nameSettingName] = name;
        this.inputs[this.#nameSettingName].value = name;
        const title = capitalize(this.#nameSettingName);
        this.title.innerHTML = `<span class="emoji" title="${title}">${this.#icon}</span>${name}`;
    }
    delete() {
        if (this.pageNode.parentNode) {
            this.pageNode.parentNode.removeChild(this.pageNode);
        }
    }
}

class Collapsable extends Named {
    constructor() {

    }
}

export class Account extends Named {
    constructor(name) {
        super(name, {
            settingName: 'account',
            icon: '🧾', 
            titleType: 'h3',
            className: 'acc-title',
        });
        this.transactionFiles = [];
    }
    addTransctionFile(tranFile) {
        this.transactionFiles.push(tranFile);
        this.contentNode.appendChild(tranFile.pageNode);
    }
    removeTransactionFile(tranFile) {
        const index = this.transactionFiles.indexOf(tranFile);
        if (index > -1) {
            this.transactionFiles.splice(index, 1);
        }
    }
    delete() {
        super.delete();
        if (this.bank) {
            this.bank.removeAccount(this);
        }
    }
    toString() {
        return JSON.stringify({name: this.name,
            settings: this.settings,
            transactionFiles: transactionFiles.map(String)});
    }
    static fromString(str) {
        const obj = JSON.parse(str);
    }
    static fromFile(file, csv, bank) {
        // Look for account name
        let accountName = "";
        if (csv.hasHeader) {
            const accColIndex = csv.headings.findIndex(colName =>
            /^account( name| number)?$/i.test(colName));
            let hasAccountCol = accColIndex != -1;
            if (hasAccountCol && csv.rows.length && csv.rows[0].length) {
                accountName = csv.rows[0][accColIndex];
            }
        }
        let account = bank.accounts.find(a => a.name == accountName);
        if (!account) {
            account = new Account(accountName);
        }
        const tranFile = new TransactionFile(file, csv, account);
        tranFile.settings['hasHeader'] = csv.hasHeader;
        tranFile.settingChanged();
        account.addTransctionFile(tranFile);
        account.bank = bank;
        return account;
    }
}

export class Bank extends Named {
    constructor(name) {
        super(name, {
            settingName: 'bank',
            icon: '🏦',
            titleType: 'h2',
            className: 'bank-title'
        });
        this.accounts = [];
    }
    addAccount(account) {
        this.accounts.push(account);
        this.contentNode.appendChild(account.pageNode);
    }
    removeAccount(account) {
        const index = this.accounts.indexOf(account);
        if (index > -1) {
            this.accounts.splice(index, 1);
        }
    }
    delete() {
        super.delete();
        if (this.bankList) {
            const index = this.bankList.indexOf(this);
            if (index > -1) {
                this.bankList.splice(index, 1);
            }
        }
    }
    toString() {
        return JSON.stringify({name: this.name,
            transactionFiles: transactionFiles.map(String)});
    }
    static fromFile(file, csv, banks) {
        // Bank Name:
        const fileNameNoExt = file.name.replace(/(\.[a-z]{1,3})+$/i, '');
        const delimiterRgx = /[-_/\/\. ]/g;
        let bankName = fileNameNoExt;
        const findBank = () => banks.find(({name}) => name == bankName);
        let bank = findBank();
        if (!bank) {
            bankName = fileNameNoExt.split(delimiterRgx)
                .filter(s =>
                    !/^transactions?$/i.test(s) &&
                    !/^\d*$/.test(s) &&
                    s
                ).map(capitalize).join(' ');
            bank = findBank()
            if (!bank) {
                bank = new Bank(bankName);
                banks.push(bank);
            }
        }
        bank.addAccount(Account.fromFile(file, csv, bank));
        bank.bankList = banks;
        return bank;
    }
}

const colSearches = [
    [/^(transaction |trade )?date$/i, 'date'],
    [/^(transaction )?description$/i, 'description'],
    [/^(net )?amount|debits?$/i, 'debit'],
    [/^(net )?amount|credits?$/i, 'credit'],
];
export class TransactionFile extends Named {
    constructor(file, csv, account) {
        super(file.name, {
            settingName: 'file',
            icon: '📄',
            titleType: 'h4',
            className: 'file-title'
        });
        this.csv = csv;
        this.isFullyFilled = false;
        this.addSetting('checkbox', 'hasHeader', 'Does this file have column names in the first row?', {change: event => {
            const checked = event.target.checked;
            if (checked && !csv.hasHeader) {
                csv.headings = csv.rows.shift();
                csv.hasHeader = true;
            } else if (!checked && csv.hasHeader) {
                csv.rows.unshift(csv.headings);
                csv.hasHeader = false;
            }
            this.settings['hasHeader'] = checked;
        }});

        // Add Column Settings
        const colOptions = csv.headings || csv.rows[0];
        for (const [regex, name] of colSearches) {
            this.addSetting('select', name, `Which column contains transaction ${name}s?`, {change: event => {
                this.settings[name] = event.target.value;
            }}, colOptions);
        }

        let cdIndSetting;
        this.addSetting('checkbox', 'hasCdIndicator', 'Is there a credit/debit indicator column?', {change: event => {
            cdIndSetting.parentNode.style.display = event.target.checked ? 'block' : 'none';
            this.settings['hasCdIndicator'] = event.target.checked;
        }});
        cdIndSetting = this.addSetting('select', 'cdIndicator', 'Which is the credit/debit indicator column?', {change: event => {
            this.settings['cdIndicator'] = event.target.value;
        }}, colOptions);
        cdIndSetting.parentNode.style.display = 'none';

        this.settingChanged(null, true);
    }
    settingChanged(event, isFirstRun) {
        const updateInputs = () => {
            // Update Inputs:
            console.debug('updating inputs');
            for (const settingName in this.inputs) {
                this.inputs[settingName].value = this.settings[settingName];
                if (this.inputs[settingName].type == 'checkbox')
                    this.inputs[settingName].checked = this.settings[settingName];
            }
            if (this.settings['hasCdIndicator']) {
                this.inputs['cdIndicator'].parentNode.style.display = 'block';
            }
        };

        // Append Viewer
        const oldViewer = this.pageNode.querySelector('table');
        if (oldViewer) oldViewer.parentNode.removeChild(oldViewer);
        const header = this.csv.hasHeader && this.csv.headings;
        let tViewer = new TransactionViewer(header, this.csv.rows);
        this.contentNode.appendChild(tViewer.table);


        // Header need to exist here onwards
        updateInputs();
        if (!this.csv.hasHeader) {
            return;
        }

        // Column Identification
        for (const [regex, name] of colSearches) {
            if (this.settings[name] > -1)
                continue;
            console.debug('col ident', name, this.settings[name]);
            let colIndex = this.csv.headings.findIndex(colName =>
                regex.test(colName));
            
            this.settings[name] = colIndex;
        }

        if (!event || event.target != this.inputs['hasCdIndicator'] &&
            parseInt(this.settings['cdIndicator']) == -1
        ) {
            // Check for credit/debit indicator
            const cdIndicator = this.csv.headings.findIndex(colName =>
                /^(credit debit )?indicator$/i.test(colName));
            if (cdIndicator > -1) {
                this.settings['hasCdIndicator'] = true;
                this.settings['cdIndicator'] = cdIndicator;

            }
        }
        updateInputs();

        this.isFullyFilled = colSearches.every(
            ([,name]) => this.settings[name] > -1);
        if (isFirstRun && this.isFullyFilled) {
            this.contentNode.hidden = true;
        }
    }
    getSimplifiedCsv(accountName) {
        const simpleCsv = this.csv.makeReorder([-1, this.settings['date'], -1, this.settings['description'], -1]);
        simpleCsv.headings = `Account,Transaction Date,Posted Date,Description,Amount`.split(',');
        
        const amtCol = simpleCsv.headings.indexOf('Amount');
        const indCol = this.settings['cdIndicator'];
        for (let y = 0; y < simpleCsv.rows.length; ++y) {
            const row = simpleCsv.rows[y];
            const oldRow = this.csv.rows[y];
            let debit = oldRow[this.settings['debit']];
            const credit = oldRow[this.settings['credit']];
            const isDebit = this.settings['hasCdIndicator'] > -1 &&
                /debit/i.test(row[indCol]) || debit.startsWith('-');
            if (isDebit && !debit.startsWith('-'))
                debit = '-' + debit;
            row[amtCol] = sanitize$Text(isDebit ? debit : credit);
        }

        for (const row of simpleCsv.rows) {
            const accCol = simpleCsv.headings.indexOf('Account');
            row[accCol] = accountName;

            const dateCol = simpleCsv.headings.indexOf('Transaction Date');
            row[dateCol] = dateToMdy(fromDateString(row[dateCol]));
        }
        return simpleCsv;
    }
    delete() {
        super.delete();
        if (this.account) {
            this.account.removeTransactionFile(this);
        }
    }
    static toString() {
        const fileName = file.name.replace(/(\.[a-z]{1,3})+$/i, '');
        return JSON.stringify({fil});
    }
}

const waitForEvent = (element, eventName, callback, options = {once:true}) => {
  return new Promise((resolve) => {
    const handler = (event) => resolve(callback(event));
    element.addEventListener(eventName, handler, options);
  });
};