import {Graph} from './Graph.js';
import {Color} from "../color-utils.js";
import {dateToYmd} from '../date-utils.js';

export class LineGraph extends Graph {
    constructor(...args) {
        super(...args);
        this.axisSpace = {x: 50, y: 30};
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
            ctx.lineWidth = 1 + window.devicePixelRatio;
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
            
            // Draw horizontal lines:
            ctx.beginPath();
            ctx.fillStyle = '#000';
            const yAxisWidth = axisSpace.x / axisScaler.x;
            ctx.fillRect(-yAxisWidth, 0, yAxisWidth, this.canvas.height);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.fillStyle = "white";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.setFontSize(22, true);
            ctx.globalAlpha = 0.2;
            const yStep = 2000;
            ctx.beginPath();
            let y = Math.floor(dataRangeY.min / yStep) * yStep;
            for (; y < dataRangeY.max; y += yStep) {
                if (y < dataRangeY.min) continue;
                const drawY = (y - dataRangeY.min) / dataRangeY.diff * ctx.height;
                ctx.moveTo(0, drawY);
                ctx.lineTo(ctx.width, drawY);
                ctx.temp(() => {
                    ctx.globalAlpha = 1;
                    ctx.translate(-5, drawY);
                    ctx.scale(1, -1);
                    ctx.fillText(`$${y/1000|0}k`, 0, 0);
                });
            }
            
            // Draw vertical lines:
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const minYear = new Date(dataRangeX.min).getFullYear();
            const maxYear = new Date(dataRangeX.max).getFullYear();
            const yearCount = maxYear - minYear;
            const margin = 8;
            const toPixel = x =>
                (x - dataRangeX.min) / dataRangeX.diff * ctx.width;
            const drawLabel = (label, x) => {
                if (x < dataRangeX.min) return;
                const drawX = toPixel(x);
                ctx.moveTo(drawX, 0);
                ctx.lineTo(drawX, ctx.height);
                ctx.temp(() => {
                    ctx.globalAlpha = 1;
                    ctx.translate(drawX, -5);
                    ctx.scale(1, -1);
                    ctx.fillText(label, 0, 0);
                });
            };
            const getMonthName = (date, length = 'short') => {
                return date.toLocaleString('default', { month: length });
            };
            const minYearMs = +new Date(minYear, 0, 1);
            const ax = toPixel(minYearMs);
            const bx = toPixel(+new Date(minYear + 1, 0, 1));
            let label = `'${new Date(minYearMs).getFullYear()-2000}`;
            let textWidth = ctx.measureText(label).width;
            let spaceBetween = bx - ax - textWidth - margin * 2;
            textWidth = ctx.measureText('Q3').width;
            let drawQ3s = (spaceBetween -= textWidth + margin * 2) >= 0;
            textWidth = ctx.measureText('Q4').width;
            let drawEvenQs = (spaceBetween -= (textWidth + margin * 2) * 2) >= 0;
            textWidth = ctx.measureText('May').width;
            let drawMonths = (spaceBetween -= (textWidth + margin * 2) * 4) >= 0;
            for (let year = minYear; year <= maxYear; ++year) {
                const x = +new Date(year, 0, 1);
                const label = `'${new Date(x).getFullYear()-2000}`;
                drawLabel(label, x);
                if (drawQ3s) {
                    ctx.setFontSize(ctx.fontSize - 3, true);
                    drawLabel('Q3', +new Date(year, 6, 1));
                    if (drawEvenQs) {
                        drawLabel('Q2', +new Date(year, 3, 1));
                        drawLabel('Q4', +new Date(year, 9, 1));
                    }
                    if (drawMonths) {
                        ctx.setFontSize(ctx.fontSize - 4, true);
                        for (const month of [1, 2, 4, 5, 7, 8, 10, 11]) {
                            const date = new Date(year, month, 1);
                            drawLabel(getMonthName(date), +date);
                        }
                    }
                }
                ctx.setFontSize(22, true);
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
        ctx.fillText(this.title, x, 20);
        ctx.setFontSize(22, true);
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
    constructor(title, values, labels, size, dataRangeX, dataRangeY) {
        super(title, values, labels, size);
        this.viewSliderHeight = 40;
        this.ballRadius = this.viewSliderHeight / 6;
        this.range = {min: this.axisSpace.x, max: size.x};
        this.holding;
        this.dataRangeX = dataRangeX;
        this.dataRangeY = dataRangeY;
        this.hasChanged = true;
        this.prevPointer = {x: 0, y: 0};
    }
    generateHtml() {
        super.generateHtml();
        this.ctx.height -= this.viewSliderHeight;
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
        let min = this.dataRangeX.min + minPercent * this.dataRangeX.diff;
        let max = this.dataRangeX.min + maxPercent * this.dataRangeX.diff;
        const rangeX = {min, max, diff: max - min};
        min = Infinity;
        max = -Infinity;
        for (const line of this.values) {
            for (const point of line) {
                const stamp = point.x;
                if (stamp < rangeX.min || stamp > rangeX.max) continue;
                const bal = point.y;
                min = Math.min(min, bal);
                max = Math.max(max, bal);
            }
        }
        const rangeY = {min, max, diff: max - min};
        super.draw(ctx, rangeX, rangeY);
        this.drawViewBar(ctx, rangeX, rangeY);
    }
    drawViewBar(ctx, rangeX) {
        ctx.beginPath();
        ctx.fillStyle = '#423946';
        ctx.globalAlpha = 0.7;
        const leftWidth = this.range.min - this.axisSpace.x;
        const rightWidth = this.canvas.width - this.range.max;
        ctx.rect(this.axisSpace.x, ctx.height, leftWidth, this.viewSliderHeight);
        ctx.rect(this.range.max, ctx.height, rightWidth, this.viewSliderHeight);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.strokeStyle = '#423946';
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

        const leftLabel = dateToYmd(new Date(rangeX.min));
        const rightLabel = dateToYmd(new Date(rangeX.max));
        ctx.setFontSize(18, true);
        ctx.fillStyle = '#5e5164ff';
        ctx.strokeStyle = '#000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const labelWidth = ctx.measureText(rightLabel).width;
        let x = this.range.max + r;
        if (labelWidth > rightWidth - r) x = this.range.max - labelWidth - r;
        ctx.fillText(rightLabel, x, midY);
        x = this.range.min - labelWidth - r;
        if (labelWidth > leftWidth - r + this.axisSpace.x)
            x = this.range.min + r;
        ctx.fillText(leftLabel, x, midY);
    }
    setPointer(event) {
        this.prevPointer.x = this.pointer.x;
        this.prevPointer.y = this.pointer.y;
        if (event.target == this.canvas)
            super.setPointer(event);
        else {
            let rect = this.canvas.getBoundingClientRect();
            const ratio = this.size.x / rect.width;
            this.pointer.x = (event.clientX - rect.left) * ratio;
            this.pointer.y = (event.clientY - rect.top) * ratio;
        }
    }
    pointerdown(event) {
        this.setPointer(event);
        if (this.pointer.y >= this.ctx.height) {
            const pointer = this.pointer;
            const r = this.ballRadius;
            if (pointer.x >= this.range.min - r && pointer.x <= this.range.min + r)
                this.holding = 'min';
            else if (pointer.x >= this.range.max - r && pointer.x <= this.range.max + r)
                this.holding = 'max';
            else if (pointer.x > this.range.min + r && pointer.x < this.range.max - r)
                this.holding = 'both';

            if (this.holding) {
                const pointerup = this.pointerup.bind(this);
                window.addEventListener('pointerup', pointerup, {once: true});
            }
        } else super.pointerdown(event);
    }
    pointerup(event) {
        super.pointerup(event);
        this.holding = null;
        if (this.moveListener) {
            window.removeEventListener('pointermove', this.moveListener);
            this.moveListener = null;
        }
    }
    pointerleave(event) {
        super.pointerleave(event);
        if (this.holding && !this.moveListener) {
            this.moveListener = this.pointermove.bind(this);
            window.addEventListener('pointermove', this.moveListener);
        }
    }
    pointermove(event) {
        super.pointermove(event);
        if (this.holding) {
            const range = this.range;
            if (this.holding == 'both') {
                const difference = this.pointer.x - this.prevPointer.x;
                range.min = Math.min(Math.max(range.min + difference, this.axisSpace.x), range.max - 1);
                range.max = Math.min(Math.max(range.max + difference, range.min + 1), this.canvas.width);
            } else {
                const [min, max] = this.holding == 'min' ?
                [this.axisSpace.x, range.max - 1] :
                [range.min + 1, this.canvas.width];
                range[this.holding] = Math.min(Math.max(this.pointer.x, min), max);
            }
            this.hasChanged = true;
        }
    }
}