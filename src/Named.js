import {capitalize, Range} from './utils.js';
import {LazyHtmlMixin, LazyHtml} from './LazyHtml.js';
import memoMixin from './memoMixin.js';
import ActivityGraph from './graphs/ActivityGraph.js';
import {Settings} from './Settings.js';

const NamedMixin = memoMixin(Base => class extends LazyHtmlMixin(Base) {
    #nameSettingName;
    #icon;
    constructor(name, {settingName, icon, titleType, titleClass}) {
        super();
        this.#nameSettingName = settingName;
        this.#icon = icon;
        this.titleType = titleType;
        this.titleClass = titleClass;

        this.settings = new Settings();
        this.content = new LazyHtml();
        this.content.className = 'content';
        this.content.onGenerate = () => this.generateContentHtml();
        
        this.name = name;
        this.children = [];
        this.activityGraph = new ActivityGraph();
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('named');
        this.header = document.createElement('div');
        this.header.className = 'header';

        this.title = document.createElement(this.titleType);
        this.title.className = this.titleClass;
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'emoji';
        emojiSpan.title = capitalize(this.#nameSettingName);
        emojiSpan.innerText = this.#icon;
        this.title.appendChild(emojiSpan);
        this.nameSpan = document.createElement('span');
        this.nameSpan.textContent = this.name;
        this.title.appendChild(this.nameSpan);
        this.nameSpan.addEventListener('keypress', event => {
            if (event.key == 'Enter') this.nameSpan.blur();
        });
        this.header.appendChild(this.title);

        this.btnWrapper = document.createElement('div');
        this.btnWrapper.className = 'btn-wrapper';
        this.header.appendChild(this.btnWrapper);

        this.node.appendChild(this.header);
        this.node.appendChild(this.activityGraph.node);
    }
    generateContentHtml() {
        this.content.node.appendChild(this.settings.node);
        this.settings.node.hidden = true;
        this.node.appendChild(this.content.node);
        this.orderChildren();
    }
    onEdit() {
        this.nameSpan.setAttribute('contenteditable', 'plaintext-only');
        this.nameSpan.focus();
    }
    doneEditing() {
        this.nameSpan.setAttribute('contenteditable', false);
        this.name = this.nameSpan.textContent;
    }
    checkFullyFilled() {
        this.isFullyFilled = this.children.every(c => c.isFullyFilled);
        this.updateFilledStyle();
    }
    updateFilledStyle() {
        if (this.hasNode) {
            if (this.isFullyFilled) {
                this.header.classList.add('fully-filled');
            } else this.header.classList.remove('fully-filled');
        }
    }
    compile() {
        for (const child of this.children) child.compile();
        const hasRange = this.children.filter(c => c.stampRange);
        this.transactions = this.children.map(c => c.transactions).flat();
        if (!hasRange.length) return;

        this.stampRange = Range.fromRanges(hasRange.map(c => c.stampRange));
        this.orderChildren();
    }
    orderChildren() {
        if (!this.stampRange) return;
        const dfault = new Range(this.stampRange.min, this.stampRange.min);
        const orderPos = r => (r || dfault).max;
        this.children.sort(({stampRange: a}, {stampRange: b}) =>
            orderPos(b) - orderPos(a));
        if (this.hasNode && this.content.hasNode) {
            for (let i = 0; i < this.children.length; ++i) {
                const child = this.children[i];
                child.node.style.order = i + 1;
            }
        }
    }
    get name() {
        return this.settings.get(this.#nameSettingName);
    }
    set name(name) {
        if (name == this.settings.get(this.#nameSettingName)) return;
        this.settings.set(this.#nameSettingName, name);
        if (this.hasNode) {
            this.nameSpan.textContent = name;
            
            const event = new CustomEvent('rename', {detail: this, bubbles: true});
            this.node.dispatchEvent(event);
        }
    }
});

const Collapsable = memoMixin(Base => class extends Base {
    #collapseBtn;
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const collapseBtn = document.createElement('button');
        this.#collapseBtn = collapseBtn;
        collapseBtn.className = 'icon icon-expand';
        collapseBtn.ariaLabel = collapseBtn.title = 'Expand';
        this.btnWrapper.appendChild(collapseBtn);
        collapseBtn.addEventListener('click', event => {
            if (!this.content.hasNode || this.content.node.hidden) {
                this.expand();
            } else {
                this.collapse();
            }
        });
    }
    collapse() {
        this.content.node.hidden = true;
        this.#collapseBtn.classList.remove('icon-collapse');
        this.#collapseBtn.classList.add('icon-expand');
        this.#collapseBtn.ariaLabel = this.#collapseBtn.title = 'Expand';
    }
    expand() {
        this.content.node.hidden = false;
        this.#collapseBtn.classList.remove('icon-expand');
        this.#collapseBtn.classList.add('icon-collapse');
        this.#collapseBtn.ariaLabel = this.#collapseBtn.title = 'Collapse';
    }
});

const Deletable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon icon-delete';
        deleteBtn.ariaLabel = deleteBtn.title = 'Delete';
        this.btnWrapper.appendChild(deleteBtn);
        deleteBtn.addEventListener('click', event => {
            this.delete();
        });
    }
    delete() {
        const event = new CustomEvent('delete', {detail: this, bubbles: true});
        this.node.dispatchEvent(event);
        this.node.parentNode?.removeChild(this.node);
    }
});
const Editable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const editBtn = document.createElement('button');
        editBtn.className = 'icon icon-edit';
        editBtn.ariaLabel = editBtn.title = 'Edit';
        this.btnWrapper.appendChild(editBtn);
        editBtn.addEventListener('click', event => {
            const deleteBtn = this.node.querySelector('.icon-delete');
            if (!this.settings.hasNode || this.settings.node.hidden) {
                if (typeof this.expand == 'function') this.expand();
                this.settings.node.hidden = false;
                editBtn.classList.remove('icon-edit');
                editBtn.classList.add('icon-done');
                editBtn.ariaLabel = editBtn.title = 'Done';
                if (deleteBtn) deleteBtn.hidden = false;
                if (this.onEdit) this.onEdit();
            } else {
                if (typeof this.collapse == 'function') this.collapse();
                this.settings.node.hidden = true;
                editBtn.classList.remove('icon-done');
                editBtn.classList.add('icon-edit');
                editBtn.ariaLabel = editBtn.title = 'Edit';
                if (deleteBtn) deleteBtn.hidden = true;
                if (this.doneEditing) this.doneEditing();
            }
        });
        const deleteBtn = this.node.querySelector('.icon-delete');
        if (deleteBtn) deleteBtn.hidden = true;
    }
});

export const Named = Editable(Collapsable(Deletable(NamedMixin())));

export class BankRoot extends Named {}