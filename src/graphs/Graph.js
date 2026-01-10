import {LazyHtml} from '../LazyHtml.js';

export class Graph extends LazyHtml {
    constructor(title, values, labels, size) {
        super();
        this.title = title;
        this.values = values;
        this.labels = labels;
        this.size = size;
        this.pointer = {x: 0, y: 0};
        this.touchAction = 'auto';
    }
    attachListeners() {
        for (let eventName of ['down', 'move', 'enter', 'leave', 'up']) {
            eventName = 'pointer' + eventName;
            this.canvas.addEventListener(eventName, this[eventName].bind(this));
        }
        for (const eventName of ['contextmenu', 'touchstart'])
            this.canvas.addEventListener(eventName, this[eventName].bind(this));
    }
    generateHtml() {
        super.generateHtml();
        this.node.classList.add('graph-container');
        this.node.style = 'position: relative;';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'graph no-select';
        this.canvas.style['touch-action'] = this.touchAction;
        this.node.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.width = this.canvas.width = this.size.x;
        this.ctx.height = this.canvas.height = this.size.y;
        this.ctx.temp = function (cb) {this.save(); cb(); this.restore()};
        this.fontName = 'Arial, sans-serif';
        this.ctx.setFontSize = function(size, bold) {
            this.font = `${bold ? 'bold ' : ''}${size}px ${this.fontName}`;
            this.fontSize = size;
        };

        this.attachListeners();
    }
    update() {
        if (this.hasChanged) {
            this.hasChanged = false;
            this.draw();
        }
    }
    setPointer(event) {
        let rect = event.target.getBoundingClientRect();
        const ratio = this.size.x / rect.width;
        this.pointer.x = event.offsetX * ratio;
        this.pointer.y = event.offsetY * ratio;
    }
    pointerdown(event) {
        this.setPointer(event);
    }
    pointermove(event) {
        this.setPointer(event);
    }
    pointerenter(event) {
        this.setPointer(event);
    }
    pointerleave(event) {
        this.setPointer(event);
    }
    pointerup(event) {
        this.setPointer(event);
    }
    contextmenu(event) {}
    touchstart(event) {
        event.preventDefault();
    }
}