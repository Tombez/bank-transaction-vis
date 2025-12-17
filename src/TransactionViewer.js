export default class TransactionViewer {
    constructor(header, transactions) {
        this.header = header ?? [];
        this.transactions = transactions;

        this.pageNode = document.createElement('div');
        this.pageNode.className = 'table-content-wrapper';
        let tableHTML = `<table>
            <thead class="sticky-header">
                ${
                    header
                    ?
                    `<tr>
                        ${header.map(h => `<th scope="col">${h}</th>`).join("\n")}
                    </tr>`
                    :
                    ""
                }
            </thead>
            <tbody>
                ${transactions.map(t => `<tr>
                    ${t.map(d => `<td>${d}</td>`).join("\n")}
                </tr>`).join("\n")}
            </tbody>
            </table>`;
        this.pageNode.innerHTML = tableHTML;
    }
}