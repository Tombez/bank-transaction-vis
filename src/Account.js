import {makeDraggable, makeDroppable} from './dragAndDrop.js';
import {Named, getUnique} from './Named.js';
import {TransactionFile} from './TransactionFile.js';
import {fromDateString, dateToYmd} from './date-utils.js';

const addBalInputs = (account, container, date = '', bal = '') => {
    const dateId = `setting-${getUnique()}`;
    const balId = `setting-${getUnique()}`;
    const deleteId = `delete-${getUnique()}`;
    const htmlString = `
        <div class="balance-point-container">
            <div class="balance-point-row">
                <label for="${dateId}">Date:</label>
                <input type="date" id="${dateId}" />
            </div>
            <div class="balance-point-row">
                <label for="${balId}">Balance:</label>
                <input type="number" id="${balId}" />
                <div id="${deleteId}" class="icon icon-delete"></div>
            </div>
        </div>`;
    const range = document.createRange();
    const frag = range.createContextualFragment(htmlString);
    container.appendChild(frag);
    container.querySelector(`#${dateId}`).value = date;
    container.querySelector(`#${balId}`).value = bal;
    const btnDelete = container.querySelector(`#${deleteId}`);
    btnDelete.addEventListener('click', () => {
        btnDelete.parentNode.parentNode.parentNode
            .removeChild(btnDelete.parentNode.parentNode);
        account.readBalancePoints();
    });
}

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
        let account = this;
        const oldGenerate = this.settings.onGenerate;
        this.settings.onGenerate = function() {
            if (oldGenerate) oldGenerate.apply(this);
            const container = document.createElement('div');
            container.className = 'balance-point-list';
            const addBtn = document.createElement('button');
            addBtn.innerText = 'New Known Balance';
            addBtn.className = 'btn-new-balance';
            addBtn.addEventListener('click',
                () => addBalInputs(account, container));
            container.addEventListener('change',
                () => account.readBalancePoints());

            if (account.manualBalPoints) {
                account.manualBalPoints.sort((a, b) => a.timestamp - b.timestamp);
                for (const {timestamp, balance} of account.manualBalPoints) {
                    const date = dateToYmd(new Date(timestamp), '-');
                    addBalInputs(account, container, date, balance);
                }
            }

            this.node.appendChild(container);
            this.node.appendChild(addBtn);
        };
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
            const header = tranFile.csv.headings.map(h => h.text).join();
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
    compile() {
        super.compile();
        this.autoBalPoints = [];
        for (const tranFile of this.transactionFiles) {
            if (tranFile.balancePoints) this.autoBalPoints = this.autoBalPoints
                .concat(tranFile.balancePoints);
        }
        this.balancePoints = this.autoBalPoints
            .concat(this.manualBalPoints || []);
    }
    readBalancePoints() {
        const containers = Array.from(this.settings.node
            .querySelectorAll('.balance-point-container'));
        const today = dateToYmd(new Date());
        const getStamp = row => +fromDateString(row
            .querySelector('input[type="date"]').value || today);
        containers.sort((a, b) => getStamp(a) - getStamp(b));
        for (let i = 0; i < containers.length; ++i)
            containers[i].style.order = i;

        const inputs = Array.from(this.settings.node
            .querySelectorAll('.balance-point-row>input'));
        const balPoints = [];
        for (let i = 0; i + 1 < inputs.length; i += 2) {
            const dateInp = inputs[i];
            const balInp = inputs[i + 1];
            if (!dateInp.value || balInp.value == '') continue;
            const timestamp = +fromDateString(dateInp.value);
            const balance = +balInp.value;
            balPoints.push({timestamp, balance});
        }
        balPoints.sort((a, b) => a.timestamp - b.timestamp);
        this.manualBalPoints = balPoints;
        this.settings.set('manualBalPoints', balPoints.map(
            ({timestamp, balance}) =>
                [dateToYmd(new Date(timestamp)), balance]));
        this.balancePoints = this.manualBalPoints
            .concat(this.autoBalPoints || []);
        console.debug('read bal points', this.balancePoints);
    }
    encode() {
        return {
            settings: this.settings.encode(),
            transactionFiles: this.transactionFiles.map(t => t.encode())
        };
    }
    static decode(accountObj) {
        let account = new Account(accountObj.settings['account']);
        account.settings.fromEncoded(accountObj.settings);
        if (account.settings.get('manualBalPoints')) {
            account.manualBalPoints = account.settings.get('manualBalPoints')
                .map(([dateStr, balance]) => 
                    ({timestamp: +fromDateString(dateStr), balance}));
            account.balancePoints = account.manualBalPoints
                .concat(account.autoBalPoints || []);
        }
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