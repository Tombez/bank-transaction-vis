export default class TransactionViewer {
    constructor(headers, transactions) {
        this.headers = headers;
        this.transactions = transactions;

        this.table = document.createElement("table");
        let tableHTML = `<thead>
            <tr>
            ${headers.map(h => `<th scope="col">${h}</th>`).join("\n")}
            </tr>
        </thead>
        <tbody>
            ${transactions.map(t => `<tr>
                ${t.map(d => `<td>${d}</td>`).join("\n")}
            </tr>`).join("\n")}
        </tbody>`;
        this.table.innerHTML = tableHTML;
    }
}