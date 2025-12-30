
import {Color} from "./color-utils.js";
import {dateValToMdy} from "./date-utils.js";

export class Graph {
    constructor(values, labels, width, height) {
        this.values = values;
        this.labels = labels;
        this.constructHTML();
        this.ctx = this.canvas.getContext('2d');
        this.ctx.width = this.canvas.width = width;
        this.ctx.height = this.canvas.height = height;
        this.fontName = '"Helvetica Neue", Helvetica, sans-serif';
        this.ctx.setFontSize = function(size, bold) {
            this.font = `${bold ? 'bold ' : ''}${size}px ${this.fontName}`;
        };
        this.canvas.addEventListener('mousemove', this.mousemove.bind(this));
        this.canvas.addEventListener('mouseenter', this.mouseenter.bind(this));
        this.canvas.addEventListener('mouseleave', this.mouseleave.bind(this));
        this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
        this.canvas.addEventListener('mouseup', this.mouseup.bind(this));
    }
    constructHTML() {
        this.container = document.createElement('div');
        this.container.classList.add('graph-container');
        this.container.style = 'position: relative;';
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
    }
    mousemove(event) {}
    mouseenter(event) {}
    mouseleave(event) {}
    mousedown(event) {}
    mouseup(event) {}
}

export class LineGraph extends Graph {
    constructor(...args) {
        super(...args);
        this.ctx.temp = function (cb) {this.save(); cb(); this.restore()};
        this.axisSpace = {x: 50, y: 50};
        this.generateColors();
    }
    generateColors() {
        let colors = Array.from({length: this.values.length}, () => new Color());
        let count = 0;
        for (let step = 0.1; count < 20 && colors.length > 1; step *= 0.6, count++) {
            let pairs = [];
            for (let i = 0; i < colors.length; ++i) {
                const color = colors[i];
                let nearest = null;
                for (let j = 0; j < colors.length; ++j) {
                    if (j == i) continue;
                    const cur = colors[j];
                    const dist = color.dist(cur);
                    if (!nearest || dist < color.dist(nearest))
                        nearest = cur;
                }
                pairs.push([color, nearest]);
            }
            const moveFromExtremes = a => {
                const margin = 0.20;
                if (a.length() < margin) a.normalize().scale(0.25);
                const fromWhite = a.diff(new Color(1, 1, 1));
                const distWhite = fromWhite.length();
                if (distWhite < margin)
                    a.add(fromWhite.normalize().scale(margin - distWhite));
            };
            for (let [a, b] of pairs) {
                const vector = a.diff(b).normalize().scale(step/2);
                a.add(vector).clamp();
                moveFromExtremes(a);
                b.add(vector.scale(-1)).clamp();
                moveFromExtremes(b);
            }
        }
        for (const line of this.values) line.color = colors.pop();
    }
    draw(ctx = this.ctx, dataRangeX, dataRangeY) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.temp(() => {
            const axisSpace = this.axisSpace;
            ctx.translate(axisSpace.x, ctx.height - axisSpace.y);
            const axisScaler = {x: (ctx.width - axisSpace.x) / ctx.width,
                y: ((ctx.height - axisSpace.y) / ctx.height)};
            ctx.scale(axisScaler.x, -1 * axisScaler.y * 0.95);
    
            // Draw Data lines:
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.7;
            ctx.lineJoin = 'round';
            for (const line of this.values) {
                ctx.strokeStyle = line.color.toString();
                let dataPoints = [];
                for (const point of line) {
                    const bal = point.y;
                    const stamp = point.x;
                    const x = (stamp - dataRangeX.min) / dataRangeX.diff;
                    const y = (bal - dataRangeY.min) / dataRangeY.diff;
                    dataPoints.push({x, y});
                }
    
                if (dataPoints.length) {
                    const first = dataPoints[0];
                    ctx.beginPath();
                    ctx.moveTo(first.x * ctx.width, first.y * ctx.height);
                    for (let i = 1; i < dataPoints.length; ++i) {
                        const point = dataPoints[i];
                        ctx.lineTo(point.x * ctx.width, point.y * ctx.height);
                    }
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
            
            // Draw X Axes:
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.fillStyle = "white";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.setFontSize(16, true);
            ctx.globalAlpha = 0.4;
            const yStep = 2000;
            ctx.beginPath();
            let y = Math.floor(dataRangeY.min / yStep) * yStep;
            for (; y < dataRangeY.max; y += yStep) {
                const drawY = (y - dataRangeY.min) / dataRangeY.diff * ctx.height;
                ctx.moveTo(0, drawY);
                ctx.lineTo(ctx.width, drawY);
                ctx.temp(() => {
                    ctx.globalAlpha = 1;
                    ctx.translate(-5, drawY);
                    ctx.scale(1.4, -1.4);
                    ctx.fillText(`$${y/1000|0}k`, 0, 0);
                });
            }

            // Draw Y Axes:
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const minYear = new Date(dataRangeX.min).getFullYear();
            const maxYear = new Date(dataRangeX.max).getFullYear();
            for (let year = minYear; year <= maxYear; ++year) {
                const x = +new Date(year, 0, 1);
                const drawX = (x - dataRangeX.min) / dataRangeX.diff * ctx.width;
                ctx.moveTo(drawX, 0);
                ctx.lineTo(drawX, ctx.height);
                ctx.temp(() => {
                    ctx.globalAlpha = 1;
                    ctx.translate(drawX, -5);
                    ctx.scale(1.4, -1.4);
                    ctx.fillText(`'${new Date(x).getFullYear()-2000}`, 0, 0);
                });
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
    
            // Y baseline:
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "white";
            const y0 = (0 - dataRangeY.min) / dataRangeY.diff;
            ctx.moveTo(0, y0 * ctx.height);
            ctx.lineTo(1 * ctx.width, y0 * ctx.height);
            ctx.stroke();
        });
    
        // Draw Title:
        ctx.fillStyle = "white";
        ctx.globalAlpha = 0.8;
        const x = ctx.width / 2;
        ctx.textAlign = 'center';
        ctx.setFontSize(26, true);
        ctx.fillText("Account Balances Over Time", x, 20);
        ctx.setFontSize(22, true);
        ctx.fillText(`min bal: ${dataRangeY.min | 0}, max bal: ${dataRangeY.max | 0}`, x, 40);
        ctx.fillText(`first transaction date: ${dateValToMdy(dataRangeX.min)}`, x, 60);
        ctx.fillText(`last transaction date: ${dateValToMdy(dataRangeX.max)}`, x, 80);
        ctx.globalAlpha = 1;
    
        // Draw Graph Key:
        const keyFontSize = 18;
        ctx.setFontSize(keyFontSize, true);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        let y = 0;
        for (let i = 0; i < this.values.length; ++i) {
            const line = this.values[i];
            const label = this.labels[i];
            ctx.fillStyle = "white";
            ctx.fillText(label, ctx.width - 30, y += keyFontSize + 4);
            ctx.fillStyle = line.color;
            ctx.fillRect(ctx.width - 20, y - 7, 10, 10);
        }
    }
}

export class ViewLineGraph extends LineGraph {
    constructor(values, labels, width, height, dataRangeX, dataRangeY) {
        super(values, labels, width, height);
        this.viewSliderHeight = 40;
        this.ballRadius = this.viewSliderHeight / 6;
        this.ctx.height -= this.viewSliderHeight;
        this.range = {min: this.axisSpace.x, max: width};
        this.holding;
        this.dataRangeX = dataRangeX;
        this.dataRangeY = dataRangeY;
        this.hasChanged = true;
    }
    update() {
        if (this.hasChanged) {
            this.draw();
            this.hasChanged = false;
        }
    }
    draw(ctx = this.ctx) {
        const width = this.canvas.width - this.axisSpace.x;
        const minPercent = (this.range.min - this.axisSpace.x) / width;
        const maxPercent = (this.range.max - this.axisSpace.x) / width;
        const min = this.dataRangeX.min + minPercent * this.dataRangeX.diff;
        const max = this.dataRangeX.min + maxPercent * this.dataRangeX.diff;
        const rangeX = {min, max, diff: max - min};
        super.draw(ctx, rangeX, this.dataRangeY);
        this.drawViewBar(ctx, this.dataRangeX, this.dataRangeY);
    }
    drawViewBar(ctx) {
        ctx.beginPath();
        ctx.fillStyle = '#423946'
        ctx.globalAlpha = 0.7;
        const leftWidth = this.range.min - this.axisSpace.x;
        const rightWidth = this.canvas.width - this.range.max;
        ctx.rect(this.axisSpace.x, ctx.height, leftWidth, this.viewSliderHeight);
        ctx.rect(this.range.max, ctx.height, rightWidth, this.viewSliderHeight);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.strokeStyle = ctx.fillStyle = '#423946';
        ctx.moveTo(this.range.min, this.canvas.height);
        ctx.lineTo(this.range.min, this.ctx.height);

        ctx.moveTo(this.range.max, this.canvas.height);
        ctx.lineTo(this.range.max, this.ctx.height);
        ctx.lineWidth = 2;
        ctx.stroke();

        const r = this.ballRadius;
        const midY = (this.ctx.height + this.canvas.height) / 2;
        for (const x of [this.range.min, this.range.max]) {
            ctx.beginPath();
            ctx.moveTo(x + r, midY);
            ctx.arc(x, midY, r, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    mousedown(event) {
        if (event.offsetY >= this.ctx.height) {
            const mouse = {x: event.offsetX, y: event.offsetY};
            const r = this.ballRadius;
            if (mouse.x >= this.range.min - r && mouse.x <= this.range.min + r)
                this.holding = 'min';
            else if (mouse.x >= this.range.max - r && mouse.x <= this.range.max + r)
                this.holding = 'max';

            if (this.holding) {
                const mouseup = this.mouseup.bind(this);
                window.addEventListener('mouseup', mouseup, {once: true});
            }
        } else super.mousedown(event);
    }
    mouseup(event) {
        this.holding = null;
        if (this.moveListener) {
            window.removeEventListener('mousemove', this.moveListener);
            this.moveListener = null;
        }
    }
    mouseleave(event) {
        if (this.holding && !this.moveListener) {
            this.moveListener = this.mousemove.bind(this);
            window.addEventListener('mousemove', this.moveListener);
        }
    }
    mousemove(event) {
        if (this.holding) {
            const range = this.range;
            const [min, max] = this.holding == 'min' ?
                [this.axisSpace.x, range.max - 1] :
                [range.min + 1, this.canvas.width];
            range[this.holding] = Math.min(Math.max(event.offsetX, min), max);
            this.hasChanged = true;
        }
    }
}