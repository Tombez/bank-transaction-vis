import {Named} from './Named.js';
import {capitalize} from './utils.js';
import memoMixin from './memoMixin.js';
import {makeDroppable} from './dragAndDrop.js';
import {Account} from './Account.js';

const Addable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const addBtn = document.createElement('button');
        addBtn.className = 'icon icon-add';
        addBtn.ariaLabel = addBtn.title = 'Add';
        this.btnWrapper.appendChild(addBtn);
        addBtn.addEventListener('click', event => {
            this.add();
        });
    }
    add() {}
});

export class Bank extends Addable(Named) {
    constructor(name) {
        super(name, {
            settingName: 'bank',
            icon: '🏦',
            titleType: 'h2',
            titleClass: 'bank-title'
        });
        this.accounts = this.children;
        this.isFullyFilled = false;

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
        this.checkFullyFilled();
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('bank-container');
        this.node.addEventListener('change', event => this.checkFullyFilled());
        this.checkFullyFilled();
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
        this.checkFullyFilled();
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
        this.checkFullyFilled();
    }
    checkDuplicateAccountName(accountA) {
        const indexA = this.accounts.indexOf(accountA);
        const accountB = this.accounts.find(
            b => b.name == accountA.name && b !== accountA);
        if (accountB) { // duplicate name found
            accountB.absorb(accountA);
            accountA.delete();
        }
        this.checkFullyFilled();
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