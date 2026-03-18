import {LazyHtml} from './LazyHtml.js';
import TransactionViewer from './TransactionViewer.js';

export class Classifier extends LazyHtml {
    transactions = [];
    hasChanged = false;
    constructor(type, unique, label) {
        super();
        this.type = type;
        this.unique = unique;
        this.label = label;
    }
    classify(date, desc, amount) {
        switch(this.type) {
            case 'exact':
                return desc == this.unique && this.label;
            case 'starts':
                return desc.startsWith(this.unique) && this.label;
            case 'has':
                return desc.includes(this.unique) && this.label;
            case 'custom':
                return this.unique(date, desc, amount) && this.label;
            case 'custom-return':
                return this.unique(date, desc, amount);
            default:
                throw new TypeError(`Unknown rule type "${type}"`);
        };
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('classifier');
        this.node.innerHTML = `
        <div class="classifier-header">
            <button class="classifier-dropdown" aria-label="Expand/Collapse"></button>
            <select class="classifier-type" aria-label="Text Match Type">
                <option value="exact">Exact</option>
                <option value="starts">Starts</option>
                <option value="has">Has</option>
            </select>&nbsp;"<span class="classifier-unique">deposit</span>":&nbsp;
            <span class="classifier-category"></span>&nbsp;
            (<span class="classifier-match-count"></span>)
            <button class="icon icon-edit" aria-label="Edit"></button>
        </div>

        <div class="classifier-content hidden">
            <div>Amount is&nbsp;<select class="classifier-amount-boundary" aria-label="Acceptable Amount Range">
                <option value="any">Any</option>
                <option value="less">Less Than</option>
                <option value="equal">Equal To</option>
                <option value="greater">Greater Than</option>
            </select>&nbsp;<input type="number" step="0.01" class="classifier-amount" style="display:none" aria-label="Amount" />
            </div>
            <div>Date is&nbsp;<select class="classifier-date-boundary" aria-label="Acceptable Date Range">
                <option value="any">Any</option>
                <option value="less">Before</option>
                <option value="equal">Equal To</option>
                <option value="greater">After</option>
            </select>&nbsp;<input type="date" class="classifier-date" style="display:none" aria-label="Date" />
            </div>
            <button class="classifier-delete" style="display:none" aria-label="Delete">Delete</button>
        </div>`;
        this.node.addEventListener('keydown', event => {
            const target = event.srcElement;
            if (target.tagName == 'INPUT' ||
                target.contentEditable == 'plaintext-only')
            {
                if (event.key == 'Escape' || event.key == 'Enter') {
                    target.blur();
                }
            }
        });

        const get = selector => this.node.querySelector(selector);
        this.typeNode = get('.classifier-type');
        this.typeNode.value = this.type;
        this.typeNode.addEventListener('change', event => {
            this.type = event.target.value;
            this.changed();
        })
        this.uniqueNode = get('.classifier-unique');
        this.uniqueNode.textContent = this.unique;
        this.uniqueNode.addEventListener('input', event => {
            this.unique = event.target.textContent;
            this.changed();
        });
        this.categoryNode = get('.classifier-category');
        this.categoryNode.textContent = this.label;
        this.categoryNode.addEventListener('input', event => {
            this.label = event.target.textContent;
            this.changed();
        });
        this.matchCount = get('.classifier-match-count');
        this.matchCount.textContent = (this.transactions || []).length;
        this.amountBoundaryNode = get('.classifier-amount-boundary');
        this.amountNode = get('.classifier-amount');
        this.amountNode.addEventListener('change', event => {
            let value = event.target.value;
            if (value) {
                const float = parseFloat(value);
                if (!Number.isNaN(float)) {
                    this.amount = float;
                    this.changed();
                }
            }
        });
        this.amountBoundaryNode.addEventListener('change', event => {
            const display = event.target.value == 'any' ? 'none' :
                'inline-block';
            this.amountNode.style.display = display;
            this.changed();
        });
        this.dateBoundaryNode = get('.classifier-date-boundary');
        this.dateNode = get('.classifier-date');
        this.dateBoundaryNode.addEventListener('change', event => {
            const display = event.target.value == 'any' ? 'none' :
                'inline-block';
            this.dateNode.style.display = display;
            this.changed();
        });
        this.inputs = [this.typeNode, this.amountBoundaryNode, this.amountNode,
            this.dateBoundaryNode, this.dateNode];
        for (const input of this.inputs) input.disabled = true;
        this.deleteBtn = get('.classifier-delete');
        this.deleteBtn.addEventListener('click', event => {
            const options = {detail: this, bubbles: true};
            const deleteEvent = new CustomEvent('classifier-delete', options);
            this.node.dispatchEvent(deleteEvent);
        });
        this.contentEditables = [this.uniqueNode, this.categoryNode];
        this.contentNode = get('.classifier-content');
        this.dropdownBtn = get('.classifier-dropdown');
        this.dropdownBtn.addEventListener('click', event => {
            if (event.target.classList.contains('expanded')) {
                this.collapse();
            } else {
                this.expand();
            }
        });
        this.editBtn = get('.icon-edit');
        this.editBtn.addEventListener('click', event => {
            if (this.editBtn.classList.contains('icon-edit')) {
                this.edit();
            } else {
                this.doneEditing();
            }
        });

        const buttons = [this.dropdownBtn, this.editBtn, this.deleteBtn];
        for (const input of [...this.inputs, ...buttons])
            input.title = input.ariaLabel;

        this.tViewer = new TransactionViewer(this.transactions);
        this.contentNode.append(this.tViewer.node);
    }
    edit() {
        this.editBtn.classList.remove('icon-edit');
        this.editBtn.classList.add('icon-done');
        this.expand();
        for (const input of this.inputs) input.disabled = false;
        for (const node of this.contentEditables)
            node.contentEditable = 'plaintext-only';
        this.deleteBtn.style.display = 'block';
    }
    doneEditing() {
        this.editBtn.classList.remove('icon-done');
        this.editBtn.classList.add('icon-edit');
        for (const input of this.inputs) input.disabled = true;
        for (const node of this.contentEditables)
            node.contentEditable = 'false';
        this.deleteBtn.style.display = 'none';
        if (this.hasChanged) {
            const options = {bubbles: true};
            const event = new CustomEvent('classifier-changed', options);
            this.node.dispatchEvent(event);
        }
    }
    expand() {
        this.dropdownBtn.classList.add('expanded');
        this.contentNode.classList.remove('hidden');
    }
    collapse() {
        this.dropdownBtn.classList.remove('expanded');
        this.contentNode.classList.add('hidden');
        this.doneEditing();
    }
    update() {
        if (!this.hasNode) return;
        this.matchCount.textContent = (this.transactions || []).length;
        this.tViewer.transactions = this.transactions;
        this.tViewer.update();
        this.hasChanged = false;
    }
    changed() {
        this.hasChanged = true;
    }
}

export class ClassifierViewer extends LazyHtml {
    constructor(classifiers) {
        super();
        this.classifiers = classifiers;
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('classifier-viewer');
        this.listNode = document.createElement('div');
        this.listNode.className = 'classifier-list';
        this.node.append(this.listNode);
        for (const classifier of this.classifiers)
            this.listNode.appendChild(classifier.node);
        this.listNode.addEventListener('classifier-delete', event => {
            if (!event.detail instanceof Classifier) return;
            this.remove(event.detail);
        });
    }
    add(classifier) {
        this.classifiers.push(classifier);
        if (this.listNode) this.listNode.append(classifier.node);
    }
    remove(classifier) {
        if (classifier.hasNode)
            classifier.node.parentNode.removeChild(classifier.node);
        const index = this.classifiers.indexOf(classifier);
        if (index > -1) this.classifiers.splice(index, 1);
    }
    update() {
        if (!this.hasNode) return;
        for (const classifier of this.classifiers) classifier.update();

        const score = classifier => classifier.transactions?.length || 0;
        this.classifiers.sort((a, b) => score(b) - score(a));
        for (let i = 0; i < this.classifiers.length; ++i)
            this.classifiers[i].node.style.order = i + 1;
    }
}