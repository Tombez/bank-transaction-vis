import memoMixin from './memoMixin.js';

export const LazyHtmlMixin = memoMixin(Base => class extends Base {
    #node;
    constructor() {
        super();
        this.hasNode = false;
        this.className = null;
        this.onGenerate = null;
    }
    get node() {
        if (!this.hasNode) {
            this.hasNode = true;
            this.generateHtml();
        }
        return this.#node;
    }
    set node(node) {
        this.#node = node;
        this.hasNode = !!node;
    }
    generateHtml() {
        this.#node = document.createElement('div');
        if (this.className) {
            this.#node.className = this.className;
            this.className = null;
        }
        this.#node.classList.add('lazy');

        if (this.onGenerate) {
            this.onGenerate();
            this.onGenerate = null;
        }
    }
});
export const LazyHtml = LazyHtmlMixin();