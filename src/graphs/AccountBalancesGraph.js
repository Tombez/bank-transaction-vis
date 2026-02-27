import {ViewLineGraph} from './ViewLineGraph.js';
import ContextMenu from '../ContextMenu.js';
import {dateToYmd} from '../date-utils.js';
import Vec2 from '../Vec2.js';
import {Filter} from '../TransactionFile.js';
import {Settings} from '../Settings.js';

const toCents = x => Math.round(x * 100) / 100;

const createBalLine = (transactions, balancePoints) => {
    if (!transactions.length) return [];
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    const balMap = new Map(balancePoints.map(({timestamp, balance}) =>
        [timestamp, balance]));
    
    let line = [];
    let bal = 0;
    let prevKnownBalStamp = null;
    for (let i = 0; i < transactions.length;) {
        let startIndex = i;
        const stamp = transactions[startIndex].timestamp;
        let prevBal = bal;
        for (; i < transactions.length &&
            transactions[i].timestamp == stamp; ++i)
                bal += transactions[i].amount;

        const knownBal = balMap.get(stamp);
        if (knownBal !== undefined) {
            const diff = toCents(bal - knownBal);
            if (prevKnownBalStamp === null) {
                prevKnownBalStamp = stamp;
                for (const p of line) p.y -= diff;
                prevBal -= diff;
            }
            bal = knownBal;
        }
        
        line.push(new Vec2(stamp, prevBal));
        line.push(new Vec2(stamp, bal));
    }
    return line;
};
const combineBalLines = (lineA, lineB) => {
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
};

export default class AccountBalancesGraph extends ViewLineGraph {
    constructor(accounts, dataRangeX, dataRangeY) {
        const size = {x: 800, y: 640};
        super('', null, null, size, dataRangeX, dataRangeY);

        this.accounts = accounts;
        this.settings = new Settings();

        this.settings.add('checkbox', 'groupByType',
            'Group by account type', {change: () => this.update() });

        this.update();
    }
    generateHtml() {
        super.generateHtml();
        this.node.appendChild(this.settings.node);
    }
    update() {
        if (!this.settings) return;
        const removeSweep = a => a.type == 'Brokerage' ?
            a.transactions.filter(t => !/\bsweep\b/i.test(t.desc)) :
            a.transactions;
        let values = this.accounts.map(a => {
            let transactions = removeSweep(a);
            return a.balLine = createBalLine(transactions, a.balancePoints);
        });
        let labels;
        if (this.settings.get('groupByType')) {
            this.title = 'Balances By Account Type Over Time';
            const typeMap = new Map();
            for (let account of this.accounts) {
                const type = account.type || 'Unset';
                let balLine = typeMap.get(type);
                balLine = balLine ?
                    balLine = combineBalLines(balLine, account.balLine) :
                    account.balLine;
                typeMap.set(type, balLine);
            }
            values = Array.from(typeMap.values());
            labels = Array.from(typeMap.keys());
        } else {
            this.title = 'Account Balances Over Time';
            labels = this.accounts.map(a => `${a.bank.name} ${a.name}`);
        }
        this.values = values;
        this.labels = labels;
        super.update();
        this.hasChanged = true;
    }
    viewTransactions() {
        const detail = [];
        const range = this.getViewRange();
        const startStr = dateToYmd(new Date(range.min));
        const endStr = dateToYmd(new Date(range.max));
        let label = `Period: ${startStr}-${endStr}`;
        let isSubset = !range.isEqual(this.dataRangeX);
        if (isSubset)
            detail.push(new Filter(label, t => range.contains(t.timestamp)));
        isSubset = !this.labels.every((l, i) =>
            l.inRange && this.values[i].active);
        if (isSubset) {
            if (this.settings.get('groupByType')) {
                const activeLines = this.values.map((l, i) => [l, i])
                    .filter(([l, i]) => this.labels[i].active);
                const types = activeLines.filter(([l, i]) => l.inRange)
                    .map(([l, i]) => this.labels[i].name);
                const typesLabel = types.join(', ');
                label = `Account types: ${typesLabel}`;
                detail.push(new Filter(label, t =>
                    types.includes(t.transactionFile.account.type || 'Unset')));
            } else {
                const activeAccounts = this.accounts.filter((a, i) =>
                    this.labels[i].active);
                const accLabel = activeAccounts.filter(a => a.balLine.inRange)
                    .map(a => a.name).join(', ');
                label = `Accounts: ${accLabel}`;
                detail.push(new Filter(label, t =>
                    activeAccounts.includes(t.transactionFile.account)));
            }
        }
        const options = {detail, bubbles: true};
        const event = new CustomEvent('view-transactions', options);
        this.node.dispatchEvent(event);
    }
    contextmenu(event) {
        console.debug('contextmenu');
        event.preventDefault();
        const contextMenu = new ContextMenu();
        contextMenu.entries.push([
            'View Visible Transactions',
            this.viewTransactions.bind(this)
        ]);
        contextMenu.listener(event);
    }
}