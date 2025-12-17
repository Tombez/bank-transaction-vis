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

const couldBeHeaderValue = value => !value ||
    !onlyNumericWithDecimal.test(value) && !isDate.test(value);

export class CSV {
    constructor(text = "", hasHeader, linesToSkip = 0) {
        this.rows = readCSV(text);
        if (linesToSkip) this.rows.splice(0, linesToSkip);
        this.hasHeader = hasHeader === undefined ? this.detectHeader() :
            hasHeader;
        if (this.hasHeader) this.headings = this.rows.shift();
    }
    detectHeader() {
        if (!this.rows.length) return false;

        const firstRow = this.rows[0];
        return firstRow.every(couldBeHeaderValue);
    }
    makeReorder(columns) {
        let csv = new CSV();
        if (this.hasHeader) this.rows.push(this.headings);
        for (let y = 0; y < this.rows.length; ++y) {
            const row = this.rows[y];
            if (!row.length) continue;
            const newRow = columns.map((col, i) => col == -1 ? '' : row[col]);
            csv.rows.push(newRow);
        }
        if (this.hasHeader) {
            this.rows.pop();
            csv.headings = csv.rows.pop();
            csv.hasHeader = true;
        }
        return csv;
    }
    append(csv) {
        this.rows = this.rows.concat(csv.rows);
    }
    toString() {
        const headerText = this.hasHeader ? this.headings.join(",") + "\n" : "";
        return headerText + this.rows.map(
            row => row.map(CSV.escapeCsv).join(","))
            .join("\n");
    }
    static escapeValue(value) {
        return !/["\n,]/g.test(value) ?
            `"${value.replaceAll('"', '""')}"` :
            value;
    };
}

export default class CSVTable extends CSV {
    constructor(text, hasHeader) {
        super(text, hasHeader);

        this.table = document.createElement("table");
        console.log(this.headings);
        let tableHTML = `<thead>
            <tr>
            ${this.headings.map(h => `<th scope="col">${h}</th>`).join("\n")}
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
