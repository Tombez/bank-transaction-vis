import {LazyHtml} from './LazyHtml.js';

export default class TransactionViewer extends LazyHtml {
    constructor(header, transactions) {
        super();
        this.header = header;
        this.transactions = transactions;
        this.itemsPerPage = 3;
        this.pageCount = Math.ceil(this.transactions.length / this.itemsPerPage);
        this.page = 0;
    }
    generateHtml() {
        super.generateHtml();
        this.node.className = 'transaction-viewer';
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-content-wrapper';
        this.node.appendChild(tableWrapper);
        let tableHTML = `<table>
            <thead class="sticky-header">
                ${
                    this.header
                    ?
                    `<tr>
                        ${this.header.map(h => `<th scope="col">${h}</th>`).join("\n")}
                    </tr>`
                    :
                    ""
                }
            </thead>
            <tbody>
            </tbody>
            </table>`;
        tableWrapper.innerHTML = tableHTML;
        const pageBar = document.createElement('div');
        pageBar.className = 'page-bar btn-wrapper';
        pageBar.innerHTML = `
        <div class="icon icon-left">Previous</div>
        <div class="page-first">
            <div class="page-btn">1</div>
        </div>
        <div class="ellipsis">..</div>
        <div class="page-btn">1</div>
        <div class="ellipsis">..</div>
        <div class="page-last">
            <div class="page-btn">${this.pageCount}</div>
        </div>
        <div class="icon icon-right">Next</div>
        `;
        this.node.appendChild(pageBar);
        this.node.querySelector('.icon-left').addEventListener('click', () => {
            if (this.page > 0) {
                this.displayPage(this.page--);
            }
        });
        this.node.querySelector('.icon-right').addEventListener('click', () => {
            if (this.page + 1 < this.pageCount) {
                this.displayPage(this.page++);
            }
        });
        this.displayPage(1);
    }
    displayPage(number) {
        if (number > this.pageCount - 1) number = this.pageCount - 1;
        if (number < 0) number = 0;

        const startIndex = number * this.itemsPerPage;
        let endIndex = startIndex + this.itemsPerPage;
        endIndex = Math.min(endIndex, this.transactions.length);
        let rowsText = "";
        for (let i = startIndex; i < endIndex; ++i) {
            const t = this.transactions[i];
            rowsText += `<tr>
                    ${t.map(d => `<td>${d}</td>`).join("\n")}
                </tr>\n`;
        }

        const tbody = this.node.querySelector('tbody');
        tbody.innerHTML = rowsText;
    }
}