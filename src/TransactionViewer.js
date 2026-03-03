import {Csv, CSV_DATA_TYPES} from './Csv.js';
import {CsvViewer} from './CsvViewer.js';
import {dateToYmd} from './date-utils.js';

export default class TransactionViewer extends CsvViewer {
    constructor(transactions) {
        const csv = new Csv('Bank,Account,Date,Description,Amount,Category',
            true);
        super(csv);
        this.transactions = transactions;
        this.filters = [];
        this.sort = {colIndex: 2, ascending: false};
        this.update();
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('transaction-viewer');

        this.filtersNode = document.createElement('div');
        this.node.insertBefore(this.filtersNode, this.node.firstChild);

        // Add column sort buttons
        const ths = this.node.querySelectorAll('th');
        for (let i = 0; i < ths.length; ++i) {
            const th = ths[i];
            const headingWrapper = document.createElement('div');
            headingWrapper.className = 'heading-wrapper';
            const sortBtnWrapper = document.createElement('div');
            sortBtnWrapper.className = 'flex-col';
            const btnUp = document.createElement('button');
            btnUp.className = 'sort-arrow arrow-up';
            btnUp.title = 'Sort Column Ascending';
            btnUp.setAttribute('aria-label', btnUp.title);
            const btnDown = document.createElement('button');
            btnDown.className = 'sort-arrow arrow-down';
            btnDown.title = 'Sort Column Descending';
            btnDown.setAttribute('aria-label', btnDown.title);
            sortBtnWrapper.appendChild(btnUp);
            sortBtnWrapper.appendChild(btnDown);
            const headerTextWrapper = document.createElement('div');
            headerTextWrapper.className = 'flex-col';
            while (th.firstChild) headerTextWrapper.appendChild(th.firstChild);
            headingWrapper.appendChild(headerTextWrapper);
            headingWrapper.appendChild(sortBtnWrapper);
            th.appendChild(headingWrapper);

            btnUp.addEventListener('click', () => this.sortBy(i, true));
            btnDown.addEventListener('click', () => this.sortBy(i, false));
        }

        this.update();
    }
    sortBy(colIndex = this.sort.colIndex, ascending = this.sort.ascending) {
        this.sort.colIndex = colIndex;
        this.sort.ascending = ascending;
        if (this.hasNode) {
            const active = this.node.querySelector('.active');
            if (active) active.classList.remove('active');
            const th = this.node.querySelectorAll('th')[colIndex];
            const btn = th.querySelector(ascending ? '.arrow-up' : '.arrow-down');
            if (btn) btn.classList.add('active');
        }
        const heading = this.csv.headings[colIndex];
        const isNumCol = heading.type == CSV_DATA_TYPES.NUMBER;
        const direction = ascending ? 1 : -1;
        let callback;
        if (isNumCol) {
            const nonDigitRegex = /[^\d\.-]/g;
            const toNumber = x => parseFloat(x.replace(nonDigitRegex, ''));
            callback = (a, b) => (toNumber(a) - toNumber(b)) * direction;
        } else {
            callback = (a, b) => (a < b ? -1 : a == b ? 0 : 1) * direction;
        }
        this.csv.rows.sort((a, b) => callback(a[colIndex], b[colIndex]));
        this.page = 0;
        super.update();
    }
    getRows() {
        let filtered = this.transactions;
        for (const {test} of this.filters)
            filtered = filtered.filter(test);
        const numberFormat = new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD' });
        const rows = filtered.map(t => {
            const account = t.transactionFile.account;
            const bank = account.bank;
            const dateStr = dateToYmd(t.date);
            const amount = numberFormat.format(t.amount);
            const category = t.labels?.join('/') || 'Uncategorized';
            return [bank.name, account.name, dateStr, t.desc, amount,
                category];
        });
        return rows;
    }
    update() {
        this.csv.rows = this.getRows();
        this.csv.update();
        if (this.filtersNode) {
            this.filtersNode.innerHTML = '';
            for (const {label} of this.filters)
                this.filtersNode.innerHTML += `<div class="filter">${label}</div>`;
        }
        this.sortBy();
    }
}
const updateOptions = (transactions, filterTransactions, minDateT, maxDateT) => {
    if (!true) {
        // Make options:
    }
    let options = "";
    const addOption = (value, text) =>
        (options += `<option value="${value}">${text}</option>\n`);
    let year = minDateT.year, quarter = minDateT.quarter;
    while (year * 4 + quarter <= maxDateT.year * 4 + maxDateT.quarter) {
        addOption(`${year},${quarter}`, `${year} Q${quarter + 1}`);
        if (year == maxDateT.year && quarter == maxDateT.quarter)
            addOption(year, `${year} Ending ${maxDateT.month}/${maxDateT.day}`);
        else if (quarter == 3)
            addOption(year, year);
        year += quarter == 3;
        quarter = (quarter + 1) % 4;
    }
    options += `<option value="all">All Time</option>`;
    options = options.split("\n").reverse().join("\n");

    let settingsDiv = document.createElement("div");
    let input = settingsDiv.querySelector('input');
    settingsDiv.innerHTML = `
        <label for="period">Choose a time period:</label>
        <select id="period">${options}</select>
        <label for="duplicates">Filter repeat descriptions:</label>
        <input type="checkbox" id="duplicates" name="duplicates" checked />`;
    let transElm = document.querySelector("#transactions");
    // document.body.insertBefore(settingsDiv, transElm);
    const duplicatesBox = settingsDiv.querySelector("#duplicates");
    const periodSelect = settingsDiv.querySelector("#period");
    const changePeriod = () => {
        const periodValue = periodSelect.value;
        removeGraphs();

        let [year, quar] = periodValue.split(",").map(s => +s);
        let title = periodSelect.selectedOptions[0].text;
        let filtered = filterTransactions(year, quar);

        const {root, income, ignored} = labelTransactions(filtered);
        if (!root.transactions.length && !root.children) return;
        makeHPieGraph(root, title);
        makeFlowGraph({root, income}, title);

        // Filter duplicates
        if (duplicatesBox.checked) {
            let descs = new Set();
            filtered = filtered.filter(t => {
                const isDup = descs.has(t.desc);
                if (!isDup) descs.add(t.desc);
                return !isDup;
            });
        }

        // Stats:
        let uniqueDescs = [...new Set(filtered.map(t => t.desc))].length;
        let unlabeled = filtered.filter(t => !t.labels[0]).length;
        let statsElm = document.querySelector("#transaction-stats");
        if (statsElm) {
            statsElm.innerText = `${transactions.length} total transactions.\n`;
            statsElm.innerText += `Showing ${filtered.length} transactions.\n`;
            statsElm.innerText += `${uniqueDescs} unique descriptions.\n`;
            statsElm.innerText += `${unlabeled} transactions without label.`;
        }
    };
    periodSelect.addEventListener("change", changePeriod);
    duplicatesBox.addEventListener("change", changePeriod);

    changePeriod();
};