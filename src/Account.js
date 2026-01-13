import TransactionViewer from "./TransactionViewer.js";
import {fromDateString, dateToMdy} from "./date-utils.js";
import memoMixin from "./memoMixin.js";
import {CSV} from './CSVTable.js';
import {makeDraggable, makeDroppable} from './dragAndDrop.js';
import {LazyHtmlMixin, LazyHtml} from './LazyHtml.js';

const capitalize = s => s.at(0).toUpperCase() +
    s.slice(1).toLowerCase();
const sanitize$Text = text => text.replaceAll(/[^-\d\.]/g, "");

const Settings = class extends LazyHtmlMixin(Map) {
    #settings = [];
    constructor() {
        super();
        this.inputs = {};
        this.fragments = [];
    }
    settingChanged(event) {}
    add(type, name, settingText, events, options) {
        const unique = `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;
        const id = `setting-${unique}`;
        const obj = {id, type, name, settingText, events, options};
        if (this.hasNode) this.generateSetting(obj);
        else this.#settings.push(obj);
    }
    generateSetting({id, type, name, settingText, events, options}) {
        const frag = document.createElement('div');
        const isSelect = type == 'select';
        const tagName = isSelect ? 'select' : 'input';
        const tagEnd = isSelect ? `>${
            options.map((op, i) => `<option value=${i}>${op}</option>`).join()
        }</select>` : '/>';
        frag.innerHTML = `<label for="${id}">
            ${settingText}
            <${tagName} class="setting" id="${id}" type="${type}"${tagEnd}
        </label>`;
        this.node.appendChild(frag);
        const input = frag.querySelector('#' + id);
        for (const eventName in events) {
            input.addEventListener(eventName, event => {
                if (event.target.type == 'checkbox')
                    event.target.value = event.target.checked;
                events[eventName](event);
                this.settingChanged(event);
            });
        }
        this.inputs[name] = input;
    }
    generateHtml() {
        super.generateHtml();
        for (const setting of this.#settings) this.generateSetting(setting);
        this.#settings.length = 0;
        this.updateInputs();
    }
    updateInputs() {
        if (!this.hasNode) return;
        for (const [key, value] of this.entries()) {
            const input = this.inputs[key];
            if (input) {
                input.value = value;
                if (input.type === 'checkbox') input.checked = value;
            }
        }
    }
    fromEncoded(obj) {
        for (const key in obj)
            this.set(key, obj[key]);
    }
    encode() {
        let obj = {};
        for (const [key, value] of this.entries()) obj[key] = value;
        return obj;
    }
};

const NamedMixin = memoMixin(Base => Collapsable(class extends LazyHtmlMixin(Base) {
    #nameSettingName;
    #icon;
    constructor(name, {settingName, icon, titleType, titleClass}) {
        super();
        this.#nameSettingName = settingName;
        this.#icon = icon;
        this.titleType = titleType;
        this.titleClass = titleClass;

        this.settings = new Settings();
        this.content = new LazyHtml();
        this.content.className = 'content';
        this.content.onGenerate = () => this.generateContentHtml();
        
        this.settings.add('text', settingName, `What is the name of the ${settingName}?`, ({change: event => {
            this.name = event.target.value;
        }}));
        
        this.name = name;
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('named');
        this.header = document.createElement('div');
        this.header.className = 'header flash-highlight';
        setTimeout(() => this.header.classList.remove('flash-highlight'), 1e3);

        this.title = document.createElement(this.titleType);
        this.title.className = this.titleClass;
        this.assignTitle(this.settings.get(this.#nameSettingName));
        this.header.appendChild(this.title);

        this.btnWrapper = document.createElement('div');
        this.btnWrapper.className = 'btn-wrapper';
        this.header.appendChild(this.btnWrapper);

        this.node.appendChild(this.header);
    }
    generateContentHtml() {
        this.content.node.appendChild(this.settings.node);
        this.settings.node.hidden = true;
        this.node.appendChild(this.content.node);
    }
    assignTitle(name) {
        const title = capitalize(this.#nameSettingName);
        if (!this.span) this.span = document.createElement('span');
        this.span.className = 'emoji';
        this.span.title = title;
        this.span.innerText = this.#icon;

        this.title.innerText = name;
        this.title.prepend(this.span);

        const event = new CustomEvent('rename', {detail: this, bubbles: true});
        this.node.dispatchEvent(event);
    }
    get name() {
        return this.settings.get(this.#nameSettingName);
    }
    set name(name) {
        this.settings.set(this.#nameSettingName, name);
        if (this.hasNode) {
            this.settings.inputs[this.#nameSettingName].value = name;
            this.assignTitle(name);
        }
    }
}));

const Collapsable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const collapseBtn = document.createElement('div');
        collapseBtn.className = 'icon icon-expand';
        this.btnWrapper.appendChild(collapseBtn);
        collapseBtn.addEventListener('click', event => {
            if (!this.content.hasNode || this.content.node.hidden) {
                this.content.node.hidden = false;
                collapseBtn.classList.add('icon-collapse');
            } else {
                this.content.node.hidden = true;
                collapseBtn.classList.remove('icon-collapse');
            }
        });
    }
});

const Deletable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'icon icon-delete';
        this.btnWrapper.appendChild(deleteBtn);
        deleteBtn.addEventListener('click', event => {
            this.delete();
        });
    }
    delete() {
        const event = new CustomEvent('delete', {detail: this, bubbles: true});
        this.node.dispatchEvent(event);
        if (this.node.parentNode) {
            this.node.parentNode.removeChild(this.node);
        }
    }
});
const Addable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const addBtn = document.createElement('div');
        addBtn.className = 'icon icon-add';
        this.btnWrapper.appendChild(addBtn);
        addBtn.addEventListener('click', event => {
            this.add();
        });
    }
    add() {}
});
const Editable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const editBtn = document.createElement('div');
        editBtn.className = 'icon icon-edit';
        this.btnWrapper.appendChild(editBtn);
        editBtn.addEventListener('click', event => {
            const deleteBtn = this.node.querySelector('.icon-delete');
            if (!this.settings.hasNode || this.settings.node.hidden) {
                const expandBtn = this.header.querySelector('.icon-expand:not(.icon-collapse)');
                if (expandBtn) expandBtn.click();
                this.settings.node.hidden = false;
                editBtn.classList.add('icon-done');
                if (deleteBtn) deleteBtn.hidden = false;
            } else {
                this.settings.node.hidden = true;
                editBtn.classList.remove('icon-done');
                if (deleteBtn) deleteBtn.hidden = true;
            }
        });
        const deleteBtn = this.node.querySelector('.icon-delete');
        if (deleteBtn) deleteBtn.hidden = true;
    }
});

const Named = Editable(Deletable(NamedMixin()));

export class Account extends Named {
    constructor(name) {
        super(name, {
            settingName: 'account',
            icon: '🧾', 
            titleType: 'h3',
            titleClass: 'acc-title',
        });
        this.transactionFiles = [];
        this.headerFormats = [];
        makeDroppable(this.node, tranFile =>
                tranFile instanceof TransactionFile && tranFile.account != this,
            tranFile => {
                tranFile.account.removeTransactionFile(tranFile);
                this.addTransactionFile(tranFile);
                const event = new CustomEvent('change', {bubbles:true});
                this.node.dispatchEvent(event);
            });
        makeDraggable(this.node, this, this.header);
        this.node.addEventListener('delete', event => {
            if (event.detail instanceof TransactionFile)
                this.removeTransactionFile(event.detail);
        });
    }
    generateContentHtml() {
        super.generateContentHtml();
        for (const tranFile of this.transactionFiles)
            this.content.node.appendChild(tranFile.node);
    }
    addTransactionFile(tranFile) {
        this.transactionFiles.push(tranFile);
        if (this.content.hasNode) this.content.node.appendChild(tranFile.node);
        tranFile.account = this;
        if (tranFile.csv.hasHeader) {
            const header = tranFile.csv.headings.join();
            if (!this.headerFormats.includes(header))
                this.headerFormats.push(header);
        }
    }
    removeTransactionFile(tranFile) {
        const index = this.transactionFiles.indexOf(tranFile);
        if (index > -1) {
            this.transactionFiles.splice(index, 1);
        }
        tranFile.node.parentNode.removeChild(tranFile.node);
        tranFile.account = null;
    }
    absorb(account) {
        for (let file; file = account.transactionFiles.pop();)
            this.addTransactionFile(file);
    }
    encode() {
        return {
            settings: this.settings.encode(),
            transactionFiles: this.transactionFiles.map(t => t.encode())};
    }
    static decode(accountObj) {
        let account = new Account(accountObj.settings['account']);
        account.settings.fromEncoded(accountObj.settings);
        accountObj.transactionFiles.forEach(t =>
            account.addTransactionFile(TransactionFile.decode(t)));
        return account;
    }
    static fromString(str) {
        const obj = JSON.parse(str);
    }
    static searchTranFileForAccountCol(tranFile) {
        if (!tranFile.csv.hasHeader) return -1;
        return tranFile.csv.headings.findIndex(colName =>
        /^(account|goal)( name| number)?$/i.test(colName));
    }
    static searchTranFileForAccountNames(tranFile) {
        const csv = tranFile.csv;
        let accountNames = new Set();
        if (csv.hasHeader) {
            const accColIndex = Account.searchTranFileForAccountCol(tranFile);

            if (accColIndex != -1) {
                for (const row of csv.rows)
                    if (row.length > accColIndex + 1)
                        accountNames.add(row[accColIndex]);
            }
        }
        return Array.from(accountNames.values());
    }
}

export class Bank extends Addable(Named) {
    constructor(name) {
        super(name, {
            settingName: 'bank',
            icon: '🏦',
            titleType: 'h2',
            titleClass: 'bank-title'
        });
        this.accounts = [];

        makeDroppable(this.node, data => {
                return data instanceof Account && !this.accounts.includes(data);
            },
            account => {
                account.bank.removeAccount(account);
                this.addAccount(account);
                const event = new CustomEvent('change', {bubbles:true});
                this.node.dispatchEvent(event);
            });
        this.node.addEventListener('delete', event => {
            if (event.detail instanceof Account)
                this.removeAccount(event.detail);
        });
    }
    generateContentHtml() {
        super.generateContentHtml();
        for (const account of this.accounts)
            this.content.node.appendChild(account.node);

        // combine accounts with the same name
        this.content.node.addEventListener('rename', event => {
            const target = event.detail;
            if (!(target instanceof Account)) return;
            this.checkDuplicateAccountName(target);
        });
    }
    addAccount(account) {
        if (this.checkDuplicateAccountName(account)) return;
        this.accounts.push(account);
        if (this.content.hasNode) this.content.node.appendChild(account.node);
        account.bank = this;
    }
    removeAccount(account) {
        const index = this.accounts.indexOf(account);
        if (index > -1) {
            if (index < this.accounts.length - 1)
                this.accounts[index] = this.accounts.pop();
            else this.accounts.pop();
            account.bank = null;
            account.node.parentNode.removeChild(account.node);
        }
    }
    checkDuplicateAccountName(accountA) {
        const indexA = this.accounts.indexOf(accountA);
        const accountB = this.accounts.find(
            b => b.name == accountA.name && b !== accountA);
        if (accountB) { // duplicate name found
            accountB.absorb(accountA);
            accountA.delete();
        }
        return accountB;
    }
    add() {
        let name = 'Default Account';
        for (let i = 1; this.accounts.find(a => a.name == name); ++i)
            name = 'Default Account ' + i;
        this.addAccount(new Account(name));
    }
    encode() {
        return {
            settings: this.settings.encode(),
            accounts: this.accounts.map(a => a.encode())};
    }
    static decode(bankObj) {
        let bank = new Bank(bankObj.settings['bank']);
        bank.settings.fromEncoded(bankObj.settings);
        bankObj.accounts.forEach(a =>
            bank.addAccount(Account.decode(a)));
        return bank;
    }
    static findFromFile(file, bankList) {
        // Bank Name:
        const fileNameNoExt = file.name.replace(/(\.[a-z]{1,3})+$/i, '');
        let bankName = fileNameNoExt;
        const findBank = () => bankList.find(({name}) => name == bankName);
        let bank = findBank();
        if (bank) return bank;
        
        const delimiterRgx = /[-_/\/\. ]/g;
        const capitalize = s => s.at(0).toUpperCase() +
            s.slice(1).toLowerCase();
        bankName = fileNameNoExt.split(delimiterRgx)
            .filter(s =>
                !/^transactions?$/i.test(s) &&
                !/^\d*$/.test(s) &&
                s
            ).map(capitalize).join(' ') || 'Default Bank';
        bank = findBank();
        return bank || bankName;
    }
}

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
    [/^((transaction|trade|post(ed|ing)|effective|booking) )?date( created)?$/i, 'date'],
    [/^(transaction )?description$/i, 'description'],
    [/^(transaction |net )?amount|withdrawals?|debits?$/i, 'debit'],
    [/^(transaction |net )?amount|deposits?|credits?$/i, 'credit'],
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
        const colOptions = csv.headings || csv.rows[0];
        for (const [regex, name] of colSearches) {
            this.settings.add('select', name, `Which column contains transaction ${name}s?`, {change: event => {
                this.settings.set(name, event.target.value);
            }}, colOptions);
        }


        this.settings.add('checkbox', 'hasCdIndicator', 'Is there a credit/debit indicator column?', {change: event => {
            // cdIndSetting.parentNode.style.display = event.target.checked ? 'block' : 'none';
            this.settings.set('hasCdIndicator', event.target.checked);
        }});
        this.settings.add('select', 'cdIndicator', 'Which is the credit/debit indicator column?', {change: event => {
            this.settings.set('cdIndicator', event.target.value);
        }}, colOptions);
        // cdIndSetting.parentNode.style.display = 'none';

        this.settingChanged();
    }
    generateHtml() {
        super.generateHtml();
        makeDraggable(this.node, this, this.header);
        this.checkFullyFilled();
    }
    generateContentHtml() {
        super.generateContentHtml();
        this.settings.updateInputs();

        // Append Viewer
        const header = this.csv.hasHeader && this.csv.headings;
        let tViewer = new TransactionViewer(header, this.csv.rows);
        this.content.node.appendChild(tViewer.node);
    }
    settingChanged(event) {
        // if (this.settings.get('hasCdIndicator')) {
        //     const cdIndicator = this.settings.inputs['cdIndicator'];
        //     if (cdIndicator) cdIndicator.parentNode.style.display = 'block';
        // }

        if (this.csv.hasHeader) {
            // Column Identification
            for (const [regex, name] of colSearches) {
                if (this.settings.get(name) > -1)
                    continue;
                let colIndex = this.csv.headings.findIndex(colName =>
                    regex.test(colName));
                
                this.settings.set(name, colIndex);
            }

            if (!event || event.target != this.settings.inputs['hasCdIndicator'] &&
                parseInt(this.settings.get('cdIndicator')) == -1
            ) {
                // Check for credit/debit indicator
                const cdIndicator = this.csv.headings.findIndex(colName =>
                    /^(credit debit )?indicator$/i.test(colName));
                if (cdIndicator > -1) {
                    this.settings.set('hasCdIndicator', true);
                    this.settings.set('cdIndicator', cdIndicator);
                }
            }
        }

        this.checkFullyFilled();
    }
    checkFullyFilled() {
        this.isFullyFilled = colSearches.every(
            ([,name]) => this.settings.get(name) > -1);
        if (this.hasNode) {
            if (this.isFullyFilled) {
                this.header.classList.add('fully-filled');
            } else this.header.classList.remove('fully-filled');
        }
    }
    getSimplifiedCsv(accountName) {
        const simpleCsv = this.csv.makeReorder([-1, this.settings.get('date'), -1, this.settings.get('description'), -1]);
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
        const csv = new CSV(tranFileObj.csv);
        let tranFile = new TransactionFile({name}, csv);
        tranFile.settings.fromEncoded(tranFileObj.settings);
        tranFile.checkFullyFilled();
        return tranFile;
    }
}

const waitForEvent = (element, eventName, callback, options = {once:true}) => {
  return new Promise((resolve) => {
    const handler = (event) => resolve(callback(event));
    element.addEventListener(eventName, handler, options);
  });
};