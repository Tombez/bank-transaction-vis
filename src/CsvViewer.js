import {LazyHtml} from './LazyHtml.js';
import {Csv, CSV_DATA_TYPES} from './Csv.js';

const typeText = (type) => {
    switch (type) {
        case CSV_DATA_TYPES.EMPTY:
            return 'Empty';
        case CSV_DATA_TYPES.NUMBER:
            return 'Number';
        case CSV_DATA_TYPES.DATE:
            return 'Date';
        case CSV_DATA_TYPES.STRING:
            return 'String';
        case CSV_DATA_TYPES.MIXED:
            return 'Mixed';
        default:
            return 'Unknown';
    }
};

export class CsvViewer extends LazyHtml {
    constructor(csv) {
        super();
        this.csv = csv;
        this.itemsPerPage = 8;
    }
    generateHtml() {
        super.generateHtml();
        this.node.className = 'csv-viewer';

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-content-wrapper';
        let tableHTML = `<table>
        <thead class="sticky-header">
        ${
            this.csv.headings
            ?
            `<tr>
            ${this.csv.headings.map((h) => `
                <th scope="col">${h.text}
                <span class="col-type">${typeText(h.type)}</span>
                <span class="sparse-descriptor">${h.isSparse ? 'Sparse' : ''}</span>
                </th>
            `).join('\n')}
            </tr>`
            :
            ""
        }
        </thead>
        <tbody>
        </tbody>
        </table>`;
        tableWrapper.innerHTML = tableHTML;
        this.node.appendChild(tableWrapper);

        const pageBar = document.createElement('div');
        pageBar.className = 'page-bar btn-wrapper';
        pageBar.innerHTML = `
        <div class="icon icon-left" aria-label="previous" title="previous"></div>
        <div class="icon page-btn page-first">1</div>
        <div class="ellipsis page-first">..</div>
        <div class="icon page-btn page-selected">1</div>
        <div class="ellipsis page-last">..</div>
        <div class="icon page-btn page-last">${this.pageCount}</div>
        <div class="icon icon-right" aria-label="next" title="next"></div>
        <div class="page-items"></div>
        `;
        this.node.appendChild(pageBar);
        
        this.node.querySelector('.icon-left').addEventListener('click', () => {
            this.displayPage(--this.page);
        });
        this.node.querySelector('.icon-right').addEventListener('click', () => {
            this.displayPage(++this.page);
        });
        this.node.querySelector('.page-first').addEventListener('click', () =>
            this.displayPage(this.page = 0));
        this.node.querySelector('.page-btn.page-last').addEventListener('click',
            () => this.displayPage(this.page = this.pageCount - 1));
        this.update();
    }
    displayPage(number) {
        if (number > this.pageCount - 1) number = this.pageCount - 1;
        if (number < 0) number = 0;
        this.page = number;

        this.node.querySelector('.page-selected').innerText = number + 1;
        const pageItems = this.node.querySelector('.page-items');
        const itemStart = this.page * this.itemsPerPage + 1;
        let itemEnd = itemStart - 1 + this.itemsPerPage;
        itemEnd = Math.min(itemEnd, this.csv.rows.length);
        pageItems.innerText = `Items ${itemStart}–${itemEnd} of ${this.csv.rows.length}`;
        const lastPage = this.node.querySelector('.page-btn.page-last');
        lastPage.innerText = this.pageCount;

        for (const node of [...this.node.querySelectorAll('.page-first')])
            node.style.display = number == 0 ? 'none' : '';
        for (const node of [...this.node.querySelectorAll('.page-last')])
            node.style.display = this.pageCount == 0 || number == this.pageCount - 1 ? 'none' : '';

        const startIndex = number * this.itemsPerPage;
        let endIndex = startIndex + this.itemsPerPage;
        endIndex = Math.min(endIndex, this.csv.rows.length);
        let rowsText = "";
        for (let i = startIndex; i < endIndex; ++i) {
            const t = this.csv.rows[i];
            rowsText += `<tr>
                    ${t.map(d => `<td>${d}</td>`).join("\n")}
                </tr>\n`;
        }

        const tbody = this.node.querySelector('tbody');
        tbody.innerHTML = rowsText;
    }
    update() {
        this.pageCount = Math.ceil(this.csv.rows.length / this.itemsPerPage);
        if (!this.page) this.page = 0;
        if (this.hasNode) this.displayPage(this.page);
    }
}