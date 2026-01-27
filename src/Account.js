import {makeDraggable, makeDroppable} from './dragAndDrop.js';
import {Named} from './Named.js';
import {TransactionFile} from './TransactionFile.js';

export class Account extends Named {
    constructor(name) {
        super(name, {
            settingName: 'account',
            icon: '🧾', 
            titleType: 'h3',
            titleClass: 'acc-title',
        });
        this.transactionFiles = this.children;
        this.headerFormats = [];
        this.isFullyFilled = false;
        this.changed();
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('account-container');

        makeDroppable(this.node, tranFile =>
                tranFile instanceof TransactionFile && tranFile.account != this,
            tranFile => {
                tranFile.account.removeTransactionFile(tranFile);
                this.addTransactionFile(tranFile);
            });
        makeDraggable(this.node, this, this.header);
        this.node.addEventListener('delete', event => {
            if (event.detail instanceof TransactionFile)
                this.removeTransactionFile(event.detail);
        });
        this.node.addEventListener('change', event => this.checkFullyFilled());
        this.changed();
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
        this.changed();
    }
    removeTransactionFile(tranFile) {
        const index = this.transactionFiles.indexOf(tranFile);
        if (index > -1) {
            this.transactionFiles.splice(index, 1);
        }
        tranFile.node.parentNode.removeChild(tranFile.node);
        tranFile.account = null;
        this.changed();
    }
    absorb(account) {
        for (let file; file = account.transactionFiles.pop();)
            this.addTransactionFile(file);
    }
    changed() {
        this.checkFullyFilled();
        const changeEvent = new CustomEvent('change', {
            bubbles: true, detail: this});
        if (this.hasNode) this.node.dispatchEvent(changeEvent);
        else if (this.bank && this.bank.hasNode)
            this.bank.node.dispatchEvent(changeEvent);
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

const waitForEvent = (element, eventName, callback, options = {once:true}) => {
  return new Promise((resolve) => {
    const handler = (event) => resolve(callback(event));
    element.addEventListener(eventName, handler, options);
  });
};