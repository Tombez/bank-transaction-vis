export const removeCR = text => text.replaceAll(/\r\n?/g, "\n");

export const readCSV = text => {
    const quoteReg = /"((?:[^"]|"")*)"/y;
    const noQuoteReg = /((?:[^,\n\r])*)/y;
    const eol = /\r\n|\r|\n|$/y;

    const rows = [];
    let row = [];
    for (let i = 0; i <= text.length;) {
        eol.lastIndex = i;
        if (eol.test(text)) {
            if (i > 0 && text[i - 1] == ",") row.push("");
            rows.push(row);
            row = [];
            i = eol.lastIndex;
            if (i >= text.length) break;
            continue;
        }
        let regex = text[i] == '"' ? quoteReg : noQuoteReg;
        regex.lastIndex = i;
        let match = regex.exec(text);
        if (!match || (!match[1] && match[1] !== "")) {
            throw new Error(`Mal-formed quoted value: ${text.slice(i, 30)}, index: ${i}`);
        }
        let value = match[1];
        if (regex == quoteReg) value = value.replaceAll('""', '"');
        row.push(value);
        i = regex.lastIndex;
        if (text[i] == ",") ++i;
    }

    return rows;
};



const onlyNumericWithDecimal = /^-?\d*\.?\d*$/;
const isDate = /^(?:\d{4}([-\/\.])\d{1,2}\1\d{1,2}|\d{1,2}([-\/\.])\d{1,2}\2\d{2}(?:\d{2})?)$/;

const couldBeHeaderValue = value => !value || !onlyNumericWithDecimal.test(value) &&
    !isDate.test(value);

export class CSV {
    constructor(text, hasHeaders, linesToSkip = 0) {
        this.rows = readCSV(text);
        if (linesToSkip) this.rows.splice(0, linesToSkip);
        this.hasHeaders = hasHeaders === undefined ? this.detectHeaders() : hasHeaders;
        if (this.hasHeaders) this.headers = this.rows.shift();
    }
    detectHeaders() {
        if (!this.rows.length) return false;

        const firstRow = this.rows[0];
        return firstRow.every(couldBeHeaderValue);
    }
    toString() {
        const headerText = this.hasHeaders ? this.headers.join(",") + "\n" : "";
        return headerText + this.rows.map(row => row.join(",")).join("\n");
    }
}

export default class CSVTable extends CSV {
    constructor(text, hasHeaders) {
        super(text, hasHeaders);

        this.table = document.createElement("table");
        let tableHTML = `<thead>
            <tr>
            ${headers.map(h => `<th scope="col">${h}</th>`).join("\n")}
            </tr>
        </thead>
        <tbody>
            ${rows.map(t => `<tr>
                ${t.map(d => `<td>${d}</td>`).join("\n")}
            </tr>`).join("\n")}
        </tbody>`;
        this.table.innerHTML = tableHTML;
    }
}
