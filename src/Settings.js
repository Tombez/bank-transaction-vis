import {LazyHtmlMixin} from './LazyHtml.js';

export const getUnique = () => `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;

export const Settings = class extends LazyHtmlMixin(Map) {
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
                const target = event.target;
                const isCheckbox = type == 'checkbox';
                const value = isCheckbox ? target.checked : target.value;
                this.set(name, value);
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