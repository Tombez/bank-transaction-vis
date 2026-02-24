import {capitalize, Range} from './utils.js';
import {LazyHtmlMixin, LazyHtml} from './LazyHtml.js';
import memoMixin from './memoMixin.js';
import ActivityGraph from './graphs/ActivityGraph.js';

export const getUnique = () => `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;

const Settings = class extends LazyHtmlMixin(Map) {
    #settings = [];
    constructor() {
        super();
        this.inputs = {};
        this.fragments = [];
    }
    settingChanged(event) {}
    add(type, name, settingText, events = {}, options, required) {
        const unique = getUnique();
        const id = `setting-${unique}`;
        const obj = {id, type, name, settingText, events, options, required};
        if (this.hasNode) this.generateSetting(obj);
        else this.#settings.push(obj);
    }
    generateSetting({id, type, name, settingText, events, options, required}) {
        const frag = document.createElement('div');
        const isSelect = type == 'select';
        const tagName = isSelect ? 'select' : 'input';
        const tagEnd = isSelect ? `>${
            options.map((op, i) => `<option value=${i-1}>${op}</option>`).join()
        }</select>` : '/>';
        frag.innerHTML = `<label for="${id}">
            ${settingText}${required ? '<span class="required">*</span>' : ''}
            <${tagName} class="setting" id="${id}" type="${type}"${tagEnd}
        </label>`;
        this.node.appendChild(frag);
        const input = frag.querySelector('#' + id);
        if (!events['change']) events['change'] = null;
        for (const eventName in events) {
            input.addEventListener(eventName, event => {
                if (event.target.type == 'checkbox')
                    event.target.value = event.target.checked;
                let value = event.target.value;
                this.set(name, event.target.value);
                if (typeof events[eventName] == 'function')
                    events[eventName](event);
                this.settingChanged(event);
            });
        }
        this.inputs[name] = input;
    }
    generateHtml() {
        super.generateHtml();
        for (const setting of this.#settings) this.generateSetting(setting);
        this.#settings.length = 0;
        this.updateInputs();
    }
    updateInputs() {
        if (!this.hasNode) return;
        for (let [key, value] of this.entries()) {
            const input = this.inputs[key];
            if (input) {
                input.value = value;
                if (input.type === 'checkbox') input.checked = value;
            }
        }
    }
    fromEncoded(obj) {
        for (const key in obj)
            this.set(key, obj[key]);
    }
    encode() {
        let obj = {};
        for (const [key, value] of this.entries()) obj[key] = value;
        return obj;
    }
};

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
        this.header.className = 'header flash-highlight';
        setTimeout(() => this.header.classList.remove('flash-highlight'), 1e3);

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
    }
    onEdit() {
        this.nameSpan.setAttribute('contenteditable', 'plaintext-only');
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
        const dfault = new Range(this.stampRange.min, this.stampRange.min);
        const orderPos = r => (r || dfault).max;
        this.children.sort(({stampRange: a}, {stampRange: b}) =>
            orderPos(b) - orderPos(a));
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
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'icon icon-expand';
        collapseBtn.ariaLabel = collapseBtn.title = 'Expand';
        this.btnWrapper.appendChild(collapseBtn);
        collapseBtn.addEventListener('click', event => {
            if (!this.content.hasNode || this.content.node.hidden) {
                this.content.node.hidden = false;
                collapseBtn.classList.remove('icon-expand');
                collapseBtn.classList.add('icon-collapse');
                collapseBtn.ariaLabel = collapseBtn.title = 'Collapse';
            } else {
                this.content.node.hidden = true;
                collapseBtn.classList.remove('icon-collapse');
                collapseBtn.classList.add('icon-expand');
                collapseBtn.ariaLabel = collapseBtn.title = 'Expand';
            }
        });
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
                const expandBtn = this.header.querySelector('.icon-expand:not(.icon-collapse)');
                if (expandBtn) expandBtn.click();
                this.settings.node.hidden = false;
                editBtn.classList.remove('icon-edit');
                editBtn.classList.add('icon-done');
                editBtn.ariaLabel = editBtn.title = 'Done';
                if (deleteBtn) deleteBtn.hidden = false;
                if (this.onEdit) this.onEdit();
            } else {
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