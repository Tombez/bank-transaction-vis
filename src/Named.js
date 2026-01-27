import {capitalize, Range} from './utils.js';
import {LazyHtmlMixin, LazyHtml} from './LazyHtml.js';
import memoMixin from './memoMixin.js';
import ActivityGraph from './graphs/ActivityGraph.js';

const Settings = class extends LazyHtmlMixin(Map) {
    #settings = [];
    constructor() {
        super();
        this.inputs = {};
        this.fragments = [];
    }
    settingChanged(event) {}
    add(type, name, settingText, events, options) {
        const unique = `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;
        const id = `setting-${unique}`;
        const obj = {id, type, name, settingText, events, options};
        if (this.hasNode) this.generateSetting(obj);
        else this.#settings.push(obj);
    }
    generateSetting({id, type, name, settingText, events, options}) {
        const frag = document.createElement('div');
        const isSelect = type == 'select';
        const tagName = isSelect ? 'select' : 'input';
        const tagEnd = isSelect ? `>${
            options.map((op, i) => `<option value=${i-1}>${op}</option>`).join()
        }</select>` : '/>';
        frag.innerHTML = `<label for="${id}">
            ${settingText}
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

const NamedMixin = memoMixin(Base => Collapsable(class extends LazyHtmlMixin(Base) {
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
        
        this.settings.add('text', settingName, `What is the name of the ${settingName}?`, ({change: event => {
            this.name = event.target.value;
        }}));
        
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
        this.assignTitle(this.settings.get(this.#nameSettingName));
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
    assignTitle(name) {
        const title = capitalize(this.#nameSettingName);
        if (!this.span) this.span = document.createElement('span');
        this.span.className = 'emoji';
        this.span.title = title;
        this.span.innerText = this.#icon;

        this.title.innerText = name;
        this.title.prepend(this.span);

        const event = new CustomEvent('rename', {detail: this, bubbles: true});
        this.node.dispatchEvent(event);
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
        this.settings.set(this.#nameSettingName, name);
        if (this.hasNode) {
            this.settings.inputs[this.#nameSettingName].value = name;
            this.assignTitle(name);
        }
    }
}));

const Collapsable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const collapseBtn = document.createElement('div');
        collapseBtn.className = 'icon icon-expand';
        this.btnWrapper.appendChild(collapseBtn);
        collapseBtn.addEventListener('click', event => {
            if (!this.content.hasNode || this.content.node.hidden) {
                this.content.node.hidden = false;
                collapseBtn.classList.remove('icon-expand');
                collapseBtn.classList.add('icon-collapse');
            } else {
                this.content.node.hidden = true;
                collapseBtn.classList.remove('icon-collapse');
                collapseBtn.classList.add('icon-expand');
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
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'icon icon-delete';
        this.btnWrapper.appendChild(deleteBtn);
        deleteBtn.addEventListener('click', event => {
            this.delete();
        });
    }
    delete() {
        const event = new CustomEvent('delete', {detail: this, bubbles: true});
        this.node.dispatchEvent(event);
        if (this.node.parentNode) {
            this.node.parentNode.removeChild(this.node);
        }
    }
});
const Editable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const editBtn = document.createElement('div');
        editBtn.className = 'icon icon-edit';
        this.btnWrapper.appendChild(editBtn);
        editBtn.addEventListener('click', event => {
            const deleteBtn = this.node.querySelector('.icon-delete');
            if (!this.settings.hasNode || this.settings.node.hidden) {
                const expandBtn = this.header.querySelector('.icon-expand:not(.icon-collapse)');
                if (expandBtn) expandBtn.click();
                this.settings.node.hidden = false;
                editBtn.classList.remove('icon-edit');
                editBtn.classList.add('icon-done');
                if (deleteBtn) deleteBtn.hidden = false;
            } else {
                this.settings.node.hidden = true;
                editBtn.classList.remove('icon-done');
                editBtn.classList.add('icon-edit');
                if (deleteBtn) deleteBtn.hidden = true;
            }
        });
        const deleteBtn = this.node.querySelector('.icon-delete');
        if (deleteBtn) deleteBtn.hidden = true;
    }
});

export const Named = Editable(Deletable(NamedMixin()));