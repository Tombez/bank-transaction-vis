import {LazyHtml} from './LazyHtml.js';

export default class TransactionViewer extends LazyHtml {
    constructor(header, transactions) {
        super();
        this.header = header;
        this.transactions = transactions;
        this.itemsPerPage = 10;
        this.pages = this.transactions / 10;
    }
    generateHtml() {
        super.generateHtml();
        this.node.className = 'table-content-wrapper';
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
                ${this.transactions.map(t => `<tr>
                    ${t.map(d => `<td>${d}</td>`).join("\n")}
                </tr>`).join("\n")}
            </tbody>
            </table>`;
        this.node.innerHTML = tableHTML;
        const pageBar = document.createElement('div');
        pageBar.className = 'page-bar btn-wrapper';
        pageBar.innerHTML = `
        <div class="icon icon-left">Previous</div>
        <div class="page-first">
            <div class="page-btn">1</div>
            <div class="ellipsis">..</div>
        </div>
        <div class="page-btn">1</div>
        <div class="page-last">
            <div class="ellipsis">..</div>
            <div class="page-btn"></div>
        </div>
        <div class="icon icon-right">Next</div>
        `;
        this.node.appendChild(pageBar);
    }
}