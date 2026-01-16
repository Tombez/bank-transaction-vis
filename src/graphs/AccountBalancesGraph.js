import {ViewLineGraph} from './ViewLineGraph.js';
import ContextMenu from '../ContextMenu.js';
import {dateToYmd} from '../date-utils.js';
import Vec2 from '../Vec2.js';

class Filter {
    constructor(label, test) {
        this.label = label;
        this.test = test;
    }
}

const createBalLine = (transactions) => {
    if (!transactions.length) return [];
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    let line = [];
    let bal = 0;
    for (let i = 0; i < transactions.length;) {
        let startIndex = i;
        const stamp = transactions[startIndex].timestamp;
        const prevBal = bal;
        for (; i < transactions.length &&
            transactions[i].timestamp == stamp; ++i)
                bal += transactions[i].amount;
        
        line.push(new Vec2(stamp, prevBal));
        line.push(new Vec2(stamp, bal));
    }
    return line;
};

export default class AccountBalancesGraph extends ViewLineGraph {
    constructor(accounts, dataRangeX, dataRangeY) {
        const values = accounts.map(a => a.balLine = createBalLine(a.transactions));
        const title = 'Account Balances Over Time';
        const size = {x: 800, y: 640};
        const labels = accounts.map(a => `${a.bank.name} ${a.name}`);
        super(title, values, labels, size, dataRangeX, dataRangeY);

        this.accounts = accounts;
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
            const activeAccounts = this.accounts.filter(a =>
                a.balLine.label.active);
            const accLabel = activeAccounts.filter(a => a.balLine.inRange)
                .map(a => a.name).join(',');
            label = `Accounts: ${accLabel}`;
            detail.push(new Filter(label, t =>
                activeAccounts.includes(t.transactionFile.account)));
        }
        const event = new CustomEvent('view-transactions', {detail});
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