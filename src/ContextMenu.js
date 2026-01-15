import {LazyHtml} from './LazyHtml.js';

export default class ContextMenu extends LazyHtml {
    constructor() {
        super();
        this.entries = [];
        this.listener = this.listener.bind(this);
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('context-menu');
        for (const [label, callback] of this.entries) {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item';
            btn.innerText = label;
            this.node.appendChild(btn);
            btn.addEventListener('click', event => {
                this.node.style.display = 'none';
                callback(event);
            });
        }
    }
    listen(target) {
        target.addEventListener('contextmenu', this.listener);
    }
    listener(event) {
        this.node.style.left = `${event.pageX}px`;
        this.node.style.top = `${event.pageY}px`;
        this.node.style.display = 'block';
        document.body.appendChild(this.node);
        document.addEventListener('pointerdown', (event) => {
            if (event.target.classList.contains('context-menu-item')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            document.body.removeChild(this.node);
        }, {once: true});
    }
}