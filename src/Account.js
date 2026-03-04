import {makeDraggable, makeDroppable} from './dragAndDrop.js';
import {Named} from './Named.js';
import {getUnique} from './Settings.js';
import {TransactionFile} from './TransactionFile.js';
import {fromDateString, dateToYmd} from './date-utils.js';
import {Range} from './utils.js';
import {Filter} from './TransactionFile.js';
import {Csv} from './Csv.js';
import {Addable} from './Addable.js';
import Vec2 from './Vec2.js';
import {LazyHtml} from './LazyHtml.js';

const toCents = x => Math.round(x * 100) / 100;

const accountTypes = ['Checking', 'Saving', 'Credit', 'Certificate',
    'Brokerage'];
const iraTypes = ['Traditional', 'Roth'];

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

export class HeaderFormat extends LazyHtml {
    constructor(key, settings = new Map()) {
        super();
        this.key = key;
        this.settings = settings;
        this.files = [];
    }
    generateHtml() {
        super.generateHtml();
        const plural = this.files.length > 1 ? 's' : '';
        const fileCount = this.files.length;
        this.node.textContent = `${fileCount} file${plural}: ` + this.key;
    }
}

export class Account extends Addable(Named) {
    constructor(name) {
        super(name, {
            settingName: 'account',
            icon: '🧾',
            titleType: 'h3',
            titleClass: 'acc-title',
        });
        this.transactionFiles = this.children;
        this.headerFormats = new Map();
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

        this.settings.add('select', 'type', `What type of account is this?`,
            {}, ['Unset', ...accountTypes]);
        this.settings.add('select', 'iraType', `Is this a retirement account?`,
            {}, ['No', ...iraTypes]);
        this.settings.add('checkbox', 'invertAmounts',
            `Invert the transaction amounts?`);
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
        this.displayHeaderFormats();
        this.displayDiscrepancies();

        for (const tranFile of this.transactionFiles)
            this.content.node.appendChild(tranFile.node);
    }
    add() {
        const detail = this;
        const bubbles = true;
        const event = new CustomEvent('upload-to-account', {detail, bubbles});
        this.node.dispatchEvent(event);
    }
    addTransactionFile(tranFile) {
        this.transactionFiles.push(tranFile);
        if (this.content.hasNode) this.content.node.appendChild(tranFile.node);
        tranFile.account = this;
        if (tranFile.csv.hasHeader) {
            const header = tranFile.csv.headings.map(h =>
                Csv.escapeValue(h.text)).join();
            let headerFormat = this.headerFormats.get(header);
            if (!headerFormat) {
                headerFormat = new HeaderFormat(header, tranFile.settings);
                this.headerFormats.set(header, headerFormat);
            }
            headerFormat.files.push(tranFile);
        }
        this.changed();
    }
    removeTransactionFile(tranFile) {
        const removeItem = (array, item) => {
            const index = array.indexOf(item);
            if (index > -1) array.splice(index, 1);
        };
        removeItem(this.transactionFiles, tranFile);
        if (tranFile.csv.hasHeader) {
            const header = tranFile.csv.headings.map(h =>
                Csv.escapeValue(h.text)).join();
            const headerFormat = this.headerFormats.get(header);
            if (headerFormat)
                removeItem(headerFormat.files, tranFile);
            if (!headerFormat.files.length) this.headerFormats.delete(header);
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
        if (this.settings.get('invertAmounts'))
            for (const tran of this.transactions) tran.amount *= -1;
        this.type = accountTypes[this.settings.get('type')];
        this.autoBalPoints = [];
        for (const tranFile of this.transactionFiles) {
            if (tranFile.balancePoints) this.autoBalPoints = this.autoBalPoints
                .concat(tranFile.balancePoints);
        }
        this.balancePoints = this.autoBalPoints
            .concat(this.manualBalPoints || []);
        this.balancePoints.sort((a, b) => a.timestamp - b.timestamp);
        this.displayHeaderFormats();
        this.createBalLine();
        const balances = this.balLine.values().map(p => p.y);
        this.balRange = Range.fromValues(balances);
    }
    orderBalancePointContainers() {
        const containers = Array.from(this.settings.node
            .querySelectorAll('.balance-point-container'));
        const today = dateToYmd(new Date());
        const getStamp = row => fromDateString(row
            .querySelector('input[type="date"]').value || today).getTime();
        containers.sort((a, b) => getStamp(a) - getStamp(b));
        for (let i = 0; i < containers.length; ++i)
            containers[i].style.order = i;
    }
    createBalLine() {
        let bal = 0;
        const transactions = this.transactions
            .sort((a, b) => a.timestamp - b.timestamp);
        let transIndex = 0;
        const sumUntil = timestamp => {
            while (transIndex < transactions.length &&
                transactions[transIndex].timestamp <= timestamp)
            {
                const curStamp = transactions[transIndex].timestamp;
                line.push(new Vec2(curStamp, bal));
                while(transIndex < transactions.length &&
                    transactions[transIndex].timestamp == curStamp)
                        bal = toCents(bal + transactions[transIndex++].amount);
                line.push(new Vec2(curStamp, bal));
            }
        };
        const bank = this.bank.name;
        const account = this.name;
        let line = this.balLine = [];
        this.balanceDiscrepancies = [];
        let startingBal;
        for (let i = 0; i < this.balancePoints.length; i++) {
            const balPoint = this.balancePoints[i];
            sumUntil(balPoint.timestamp);
            const diff = toCents(bal - balPoint.balance);
            if (i == 0) {
                startingBal = -diff;
                for (const p of line) p.y = toCents(p.y - diff);
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
            line.at(-1).y = bal;
        }
        sumUntil(Infinity);
        this.startingBal = startingBal;

        this.displayDiscrepancies();
    }
    displayHeaderFormats() {
        if (!this.statsDiv) return;
        let headersList = this.statsDiv.querySelector('.headersList');
        if (!headersList) {
            headersList = document.createElement('div');
            headersList.className = 'headersList';
            this.statsDiv.appendChild(headersList);
        }
        if (!this.headerFormats.size) {
            headersList.innerHTML = '';
            return;
        }
        headersList.innerHTML = '<h4>Header Formats</h4>';
        for (const headerFormat of this.headerFormats.values()) {
            headersList.appendChild(headerFormat.node);
        }
    }
    displayDiscrepancies() {
        if (!this.statsDiv) return;
        let discrepancyDiv = this.statsDiv.querySelector('.discrepancyList');
        if (discrepancyDiv) {
            while(discrepancyDiv.lastChild)
                discrepancyDiv.removeChild(discrepancyDiv.lastChild);
        } else {
            discrepancyDiv = document.createElement('div');
            discrepancyDiv.className = 'discrepancyList';
            this.statsDiv.appendChild(discrepancyDiv);
        }
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
            discrepancyDiv.appendChild(row);
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
        
        this.createBalLine();
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
    static combineBalLines(lineA, lineB) {
        if (!lineA.length) return lineB;
        if (!lineB.length) return lineA;
        if (lineB[0].x < lineA[0].x) [lineA, lineB] = [lineB, lineA];
        let indexA = 0, indexB = 0, lineC = [];
        const balA = lineA[0].y, balB = lineB[0].y;
        let balC = balA;
        if (lineB[0].x == lineA[0].x) balC += balB;
        const pushPoints = (start, end) => {
            const change = end.y - start.y;
            start.y = balC;
            end.y = (balC += change);
            lineC.push(start, end);
        };
        for (; indexA < lineA.length; indexA += 2) {
            const startA = lineA[indexA].clone();
            const endA = lineA[indexA + 1].clone();
            let startB;
            for (; indexB < lineB.length; indexB += 2) {
                startB = lineB[indexB].clone();
                if (startB.x >= startA.x) break;
                const endB = lineB[indexB + 1].clone();
                pushPoints(startB, endB);
            }
            if (startB && startB.x == startA.x) {
                const changeB = lineB[indexB + 1].y - startB.y;
                endA.y += changeB;
                indexB += 2;
            }
            pushPoints(startA, endA);
        }
        for (; indexB < lineB.length; indexB += 2) {
            const startB = lineB[indexB].clone();
            const endB = lineB[indexB + 1].clone();
            pushPoints(startB, endB);
        }
        return lineC;
    }
}

const waitForEvent = (element, eventName, callback, options = {once:true}) => {
  return new Promise((resolve) => {
    const handler = (event) => resolve(callback(event));
    element.addEventListener(eventName, handler, options);
  });
};