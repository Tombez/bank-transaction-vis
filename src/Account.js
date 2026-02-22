import {makeDraggable, makeDroppable} from './dragAndDrop.js';
import {Named, getUnique} from './Named.js';
import {TransactionFile} from './TransactionFile.js';
import {fromDateString, dateToYmd} from './date-utils.js';
import {Range} from './utils.js';
import {Filter} from './TransactionFile.js';

const toCents = x => Math.round(x * 100) / 100;

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
                <button id="${deleteId}" class="icon icon-delete"></button>
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

    account.orderBalancePointContainers();
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
        this.balanceDiscrepancies = [];
        this.statsDiv = null;
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

        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats';
        this.content.node.appendChild(statsDiv);
        this.statsDiv = statsDiv;
        this.displayDiscrepancies();

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
        this.balancePoints.sort((a, b) => a.timestamp - b.timestamp);
        this.checkBalancePointContinuity();
    }
    orderBalancePointContainers() {
        const containers = Array.from(this.settings.node
            .querySelectorAll('.balance-point-container'));
        const today = dateToYmd(new Date());
        const getStamp = row => +fromDateString(row
            .querySelector('input[type="date"]').value || today);
        containers.sort((a, b) => getStamp(a) - getStamp(b));
        for (let i = 0; i < containers.length; ++i)
            containers[i].style.order = i;
    }
    checkBalancePointContinuity() {
        if (!this.balancePoints.length) return;
        let bal = 0;
        const transactions = this.transactions.slice()
            .sort((a, b) => a.timestamp - b.timestamp);
        let transIndex = 0;
        const sumUntil = timestamp => {
            while (transIndex < transactions.length &&
                transactions[transIndex].timestamp <= timestamp)
                    bal += transactions[transIndex++].amount;
        };
        this.balanceDiscrepancies = [];
        let startingBal;
        for (let i = 0; i < this.balancePoints.length; i++) {
            const balPoint = this.balancePoints[i];
            sumUntil(balPoint.timestamp);
            const diff = toCents(bal - balPoint.balance);
            const bank = this.bank.name;
            const account = this.name;
            if (i == 0) {
                startingBal = -diff;
                console.debug(bank, account, 'intial balance of', startingBal);
            } else if (diff != 0) {
                const str = 'found balance difference of';
                const dateStr = dateToYmd(new Date(balPoint.timestamp));
                console.debug(str, diff, `${bank} ${account}`, dateStr);
                const prevPoint = this.balancePoints[i - 1];
                this.balanceDiscrepancies.push({
                    period: new Range(prevPoint.timestamp, balPoint.timestamp),
                    diff,
                    prevBal: prevPoint.balance,
                    balance: balPoint.balance
                });
            }
            bal = balPoint.balance;
        }
        this.startingBal = startingBal;

        this.displayDiscrepancies();
    }
    displayDiscrepancies() {
        if (!this.statsDiv) return;
        while(this.statsDiv.childNodes.length)
            this.statsDiv.removeChild(this.statsDiv.childNodes[0]);
        for (const discrepancy of this.balanceDiscrepancies) {
            const row = document.createElement('div');
            const startDate = new Date(discrepancy.period.min);
            const startDateStr = dateToYmd(startDate);
            const endDate = new Date(discrepancy.period.max);
            const endDateStr = dateToYmd(endDate);
            const link = document.createElement('a');
            link.textContent = `${startDateStr}-${endDateStr}`;
            link.href = 'javascript:void(0)';
            link.addEventListener('click', () => {
                const filters = [];
                const range = new Range(startDate, endDate);
                let label = `Period: ${startDateStr}-${endDateStr}`;
                filters.push(new Filter(label, t =>
                    range.contains(t.timestamp)));
                label = `Account: ${this.name}`;
                filters.push(new Filter(label, t =>
                    this == t.transactionFile.account));
                const options = {detail: filters, bubbles: true};
                const event = new CustomEvent('view-transactions', options);
                link.dispatchEvent(event);
            });
            row.appendChild(link);
            const span = document.createElement('span');
            span.textContent = ` $${discrepancy.prevBal} -> $${discrepancy.balance}, discrepancy: ${discrepancy.diff}`;
            row.appendChild(span);
            this.statsDiv.appendChild(row);
        }
    }
    readBalancePoints() {
        this.orderBalancePointContainers();

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
        this.balancePoints.sort((a, b) => a.timestamp - b.timestamp);
        
        this.checkBalancePointContinuity();
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
            account.balancePoints.sort((a, b) => a.timestamp - b.timestamp);
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
        return tranFile.csv.headings.findIndex(({text}) =>
        /^(account|goal)( name| number)?$/i.test(text));
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