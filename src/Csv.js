export const removeCR = text => text.replaceAll(/\r\n?/g, "\n");

export const readCsv = text => {
    const quoteReg = /"((?:[^"]|"")*)"/y;
    const noQuoteReg = /((?:[^,\n\r])*)/y;
    const eol = /\r\n|\r|\n|$/y;

    const rows = [];
    let row = [];
    for (let i = 0; i <= text.length;) {
        eol.lastIndex = i;
        if (eol.test(text)) {
            if (i > 0 && text[i - 1] == ",") row.push("");
            if (row.length) rows.push(row);
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

export class Csv {
    constructor(text = "", hasHeader, linesToSkip = 0) {
        this.rows = readCsv(text);
        if (linesToSkip) this.rows.splice(0, linesToSkip);
        this.hasHeader = hasHeader === undefined ? this.detectHeader() :
            hasHeader;
        if (this.hasHeader) this.headings = this.rows.shift();
    }
    detectHeader() {
        if (!this.rows.length) return false;

        const firstRow = this.rows[0];
        return firstRow.length && firstRow.every(couldBeHeaderValue);
    }
    makeReorder(columns) {
        let csv = new Csv();
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
    clone() {
        let clone = new Csv();
        clone.hasHeader = this.hasHeader;
        clone.headings = this.headings.slice();
        clone.rows = this.rows.map(row => row.slice());
        return clone;
    }
    toString() {
        const headerText = this.hasHeader ? this.headings.join(",") + "\n" : "";
        return headerText + this.rows.map(
            row => row.map(Csv.escapeValue).join(","))
            .join("\n");
    }
    static escapeValue(value) {
        return /["\n,]/g.test(value) ?
            `"${value.replaceAll('"', '""')}"` :
            value;
    };
}
