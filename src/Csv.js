import {isDateStr} from './date-utils.js';

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
const withoutLetters = /^[^a-zA-Z]+$/;

const couldBeHeaderValue = value => !value ||
    !onlyNumericWithDecimal.test(value) && !isDateStr(value);

export const CSV_DATA_TYPES = {
    EMPTY: 0,
    NUMBER: 1,
    DATE: 2,
    STRING: 3,
    MIXED: 4
};

export const typeOf = str => {
    if (!str) return CSV_DATA_TYPES.EMPTY;
    if (isDateStr(str)) return CSV_DATA_TYPES.DATE;
    if (withoutLetters.test(str)) return CSV_DATA_TYPES.NUMBER;
    return CSV_DATA_TYPES.STRING;
};

export class Csv {
    constructor(text = "", hasHeader, linesToSkip = 0) {
        this.rows = readCsv(text);
        if (linesToSkip) this.rows.splice(0, linesToSkip);
        this.hasHeader = hasHeader === undefined ? this.detectHeader() :
            hasHeader;
        
        this.headings = this.hasHeader ? this.rows.shift() : null;
        this.update();
    }
    detectHeader() {
        if (!this.rows.length) return false;

        const firstRow = this.rows[0];
        return firstRow.length && firstRow.every(couldBeHeaderValue);
    }
    update() {
        if (!this.rows.length) return;

        if (!this.headings) {
            const colCount = this.rows[0].length;
            this.headings = Array.from({length: colCount}, () => '');
        }
        if (this.headings.length && typeof this.headings[0] == 'string') {
            this.headings = this.headings.map(text => new CsvHeading(text));
        }

        const colTypes = this.rows[0].map(() => new Set());
        for (const row of this.rows) {
            for (let x = 0; x < row.length; ++x) {
                colTypes[x].add(typeOf(row[x]));
            }
        }

        this.headings.forEach((heading, i) => {
            const types = colTypes[i];
            heading.isSparse = types.has(CSV_DATA_TYPES.EMPTY);
            if (heading.isSparse && types.size > 1)
                types.delete(CSV_DATA_TYPES.EMPTY);
            heading.type = types.size == 1 ?
                [...types.values()][0] : CSV_DATA_TYPES.MIXED;
        });
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
        this.update();
    }
    clone() {
        let clone = new Csv();
        clone.hasHeader = this.hasHeader;
        clone.headings = this.headings.map(h => h.text);
        clone.rows = this.rows.map(row => row.slice());
        clone.update();
        return clone;
    }
    toString() {
        const headerText = this.hasHeader ?
            this.headings.map(h => h.text).join(",") + "\n" : "";
        return headerText + this.rows.map(
            row => row.map(Csv.escapeValue).join(","))
            .join("\n");
    }
    static escapeValue(value) {
        return /["\n,]/g.test(value) ?
            `"${value.replaceAll('"', '""')}"` :
            value;
    }
}

class CsvHeading {
    constructor(text, type, isSparse) {
        this.text = text;
        this.type = type;
        this.isSparse = isSparse;
    }
}