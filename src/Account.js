import TransactionViewer from "./TransactionViewer.js";

class HasSetting {
    constructor() {
        this.pageNode = document.createElement('div');
        this.settings = {};
        this.inputs = {};
    }
    settingChanged(event) {}
    addSetting(type, name, settingText, events, options) {
        const settingId = `setting-${Date.now()}-${Math.random() * 10e8 | 0}`;
        const frag = document.createElement('div');
        const isSelect = type == 'select';
        const tagName = isSelect ? 'select' : 'input';
        const tagEnd = isSelect ? `>${options.map((op, i) =>
            `<option value=${i}>${op}</option>`).join()
        }</select>` : '/>';
        frag.innerHTML = `<label for="${settingId}">
            <${tagName} class="setting" id="${settingId}" type="${type}"${tagEnd}
            ${settingText}
        </label>`;
        this.pageNode.appendChild(frag);
        const setting = frag.querySelector('#' + settingId);
        for (const eventName in events) {
            setting.addEventListener(eventName, event => {
                events[eventName](event);
                this.settingChanged(event);
            });
        }
        return this.inputs[name] = setting;
    }
}

export class Account extends HasSetting {
    #name;
    constructor(name) {
        super();
        this.title = document.createElement('h3');
        this.title.className = 'acc-title';
        this.pageNode.insertAdjacentElement('afterbegin', this.title);
        this.name = name;
        this.transactionFiles = [];
    }
    get name() {
        return this.#name;
    }
    set name(name) {
        this.#name = name;
        this.title.innerHTML = `<span class="emoji">🧾</span> ${name}`;
    }
    addTransctionFile(tranFile) {
        this.transactionFiles.push(tranFile);
        this.pageNode.appendChild(tranFile.pageNode);
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
        account.addTransctionFile(tranFile);
        tranFile.settings['hasHeader'] = csv.hasHeader;
        tranFile.settings['accountName'] = accountName;
        tranFile.settingChanged();
        return account;
    }
}

export class Bank extends HasSetting {
    #name;
    constructor(name) {
        super();
        this.settingsDiv = document.createElement('div');
        this.title = document.createElement('h2');
        this.title.className = 'bank-title';
        this.pageNode.appendChild(this.title);
        this.name = name;
        this.accounts = [];
    }
    set name(name) {
        this.#name = name;
        this.title.innerHTML = `<span class="emoji">🏦</span> ${name}`;
    }
    get name() {
        return this.#name;
    }
    addAccount(account) {
        this.accounts.push(account);
        this.pageNode.appendChild(account.pageNode);
    }
    toString() {
        return JSON.stringify({name: this.name,
            transactionFiles: transactionFiles.map(String)});
    }
    static fromFile(file, csv, banks) {
        // Bank Name:
        const fileNameNoExt = file.name.replace(/(\.[a-z]{1,3})+$/i, '');
        const delimiterRgx = /[-_/\/\. ]/g;
        const capitalizeFirst = s => s.at(0).toUpperCase() +
            s.slice(1).toLowerCase();
        let bankName = fileNameNoExt;
        const findBank = () => banks.find(({name}) => name == bankName);
        let bank = findBank();
        if (!bank) {
            bankName = fileNameNoExt.split(delimiterRgx)
                .filter(s =>
                    !/^transactions?$/i.test(s) &&
                    !/^\d*$/.test(s) &&
                    s
                ).map(capitalizeFirst).join(' ');
            findBank()
            if (!bank) {
                bank = new Bank(bankName);
            }
        }
        bank.addAccount(Account.fromFile(file, csv, bank));
        return bank;
    }
}

const colSearches = [
    [/^(transaction |trade )?date$/i, 'date'],
    [/^(transaction )?description$/i, 'description'],
    [/^(net )?amount|debits?$/i, 'debit'],
    [/^(net )?amount|credits?$/i, 'credit'],
];
export class TransactionFile extends HasSetting {
    constructor(file, csv, account) {
        super();
        this.name = file.name;
        this.csv = csv;
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
        this.addSetting('text', 'accountName', 'What is the name of the account for these transactions?', ({change: event => {
            this.settings['accountName'] = account.name = event.target.value;
        }}));

        // Add Column Settings
        const colOptions = csv.headings || csv.rows[0];
        for (const [regex, name] of colSearches) {
            this.addSetting('select', name, `Which column contains transaction ${name}s?`, {change: event => {
                this.settings[name] = event.target.value;
            }}, colOptions);
        }

        let cdIndSetting;
        this.addSetting('checkbox', 'hasCdIndicator', 'Is there a credit/debit indicator column?', {change: event => {
            cdIndSetting.style.display = event.target.value ? 'block' : 'none';
            this.settings['hasCdIndicator'] = event.target.value;
        }});
        cdIndSetting = this.addSetting('select', 'cdIndicator', 'Which is the credit/debit indicator column?', {change: event => {
            this.settings['cdIndicator'] = cdIndicatorIndex;
        }}, colOptions);
        cdIndSetting.parentNode.style.display = 'none';

        this.settingChanged();
    }
    settingChanged(event) {
        const updateInputs = () => {
            // Update Inputs:
            for (const settingName in this.inputs) {
                this.inputs[settingName].value = this.settings[settingName];
                if (this.inputs[settingName].type == 'checkbox')
                    this.inputs[settingName].checked = this.settings[settingName];
            }
        };

        // Append Viewer
        const oldViewer = this.pageNode.querySelector('table');
        if (oldViewer) this.pageNode.removeChild(oldViewer);
        const header = this.csv.hasHeader && this.csv.headings;
        let tViewer = new TransactionViewer(header, this.csv.rows);
        this.pageNode.appendChild(tViewer.table);


        // Header need to exist here onwards
        if (!this.csv.hasHeader) {
            updateInputs();
            return;
        }

        // Column Identification
        for (const [regex, name] of colSearches) {
            let colIndex = this.csv.headings.findIndex(colName =>
                regex.test(colName));
            this.settings[name] = colIndex;
        }

        // Check for credit/debit indicator
        if (!event || event.target != this.inputs['hasCdIndicator']) {
            this.settings['cdIndicator'] = this.csv.headings.findIndex(colName =>
                /^(credit debit )?indicator$/i.test(colName));
            if (this.settings['cdIndicator'] > -1) {
                this.settings['hasCdIndicator'] = true;
            }
        }
        
        updateInputs();
    }
    getSimplifiedCsv() {

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