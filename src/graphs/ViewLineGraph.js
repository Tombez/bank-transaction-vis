import {LineGraph} from './LineGraph.js';
import {dateToYmd} from '../date-utils.js';
import {Range} from '../utils.js';

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
    getViewRange() {
        const width = this.canvas.width - this.axisSpace.x;
        const minPercent = (this.range.min - this.axisSpace.x) / width;
        const maxPercent = (this.range.max - this.axisSpace.x) / width;
        let min = this.dataRangeX.min + minPercent * this.dataRangeX.diff;
        let max = this.dataRangeX.min + maxPercent * this.dataRangeX.diff;
        return new Range(min, max);
    }
    draw(ctx = this.ctx) {
        const rangeX = this.getViewRange();
        let min = Infinity;
        let max = -Infinity;
        for (const line of this.values) {
            if (!line.label.active) continue;
            let oneInRange = false;
            for (const point of line) {
                const stamp = point.x;
                if (stamp < rangeX.min || stamp > rangeX.max) continue;
                oneInRange = true;
                const bal = point.y;
                min = Math.min(min, bal);
                max = Math.max(max, bal);
            }
            line.inRange = oneInRange;
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
        super.setPointer(event);
    }
    pointerdown(event) {
        this.setPointer(event);
        console.debug('pointerdown button', event.button);
        if (event.button == 0) {
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
                    this.canvas.setPointerCapture(event.pointerId);
                }
            } else super.pointerdown(event);
        }
    }
    pointerup(event) {
        super.pointerup(event);
        if (event.button == 0) {
            this.holding = null;
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