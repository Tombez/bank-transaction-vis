import {LazyHtml} from './LazyHtml.js';

export default class TransactionViewer extends LazyHtml {
    constructor(header, transactions) {
        super();
        this.header = header;
        this.transactions = transactions;
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
    }
}