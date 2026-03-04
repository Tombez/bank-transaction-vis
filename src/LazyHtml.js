import memoMixin from './memoMixin.js';

export const LazyHtmlMixin = memoMixin(Base => class extends Base {
    #node;
    onGenerate = null;
    get hasNode() {
        return !!this.#node;
    }
    set hasNode(value) {}
    get node() {
        if (!this.hasNode) this.generateHtml();
        return this.#node;
    }
    set node(node) {
        this.#node = node;
    }
    generateHtml() {
        this.#node = document.createElement('div');
        this.#node.className = 'lazy';

        if (this.onGenerate) {
            const onGenerate = this.onGenerate;
            this.onGenerate = null;
            onGenerate.apply(this);
        }
    }
});
export const LazyHtml = LazyHtmlMixin();