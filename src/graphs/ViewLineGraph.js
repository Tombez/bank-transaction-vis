import {LineGraph} from './LineGraph.js';
import {dateToYmd} from '../date-utils.js';
import {Range} from '../utils.js';

export class ViewLineGraph extends LineGraph {
    constructor(title, values, labels, size, dataRangeX, dataRangeY) {
        super(title, values, labels, size);
        this.viewSliderHeight = 40;
        this.ballRadius = this.viewSliderHeight / 6;
        this.range = new Range();
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
        let min = this.dataRangeX.min + this.range.min * this.dataRangeX.diff;
        let max = this.dataRangeX.min + this.range.max * this.dataRangeX.diff;
        return new Range(min, max);
    }
    getPixelRange() {
        const width = this.canvas.width - this.axisSpace.x;
        const min = this.range.min * width + this.axisSpace.x;
        const max = this.range.max * width + this.axisSpace.x;
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
        const rangeY = new Range(min, max);
        super.draw(ctx, rangeX, rangeY);
        this.drawViewBar(ctx, rangeX, rangeY);
    }
    drawViewBar(ctx, rangeX) {
        ctx.beginPath();
        ctx.fillStyle = '#423946';
        ctx.globalAlpha = 0.7;
        const pixelRange = this.getPixelRange();
        const beforeWidth = pixelRange.min - this.axisSpace.x;
        const afterWidth = this.canvas.width - pixelRange.max;
        ctx.rect(this.axisSpace.x, ctx.height, beforeWidth, this.viewSliderHeight);
        ctx.rect(pixelRange.max, ctx.height, afterWidth, this.viewSliderHeight);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.strokeStyle = '#423946';
        ctx.moveTo(pixelRange.min, this.canvas.height);
        ctx.lineTo(pixelRange.min, this.ctx.height);

        ctx.moveTo(pixelRange.max, this.canvas.height);
        ctx.lineTo(pixelRange.max, this.ctx.height);
        ctx.lineWidth = 2;
        ctx.stroke();

        const r = this.ballRadius;
        const midY = (this.ctx.height + this.canvas.height) / 2;

        const beginLabel = dateToYmd(new Date(rangeX.min));
        const endLabel = dateToYmd(new Date(rangeX.max));
        ctx.setFontSize(18, true);
        const handleColor = '#5e5164';
        ctx.fillStyle = handleColor;
        ctx.strokeStyle = '#000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const beginWidth = ctx.measureText(beginLabel).width;
        const endWidth = ctx.measureText(endLabel).width;
        let endX = pixelRange.max + r;
        if (endWidth > afterWidth - r) endX = pixelRange.max - endWidth - r;
        let beginX = pixelRange.min - beginWidth - r;
        if (beginWidth > beforeWidth - r + this.axisSpace.x)
            beginX = pixelRange.min + r;
        const overlapping = pixelRange.min + r > endX ||
            pixelRange.max - r < beginX + beginWidth;
        let y = midY - ctx.fontSize * (overlapping ? 1 : 1 / 2);
        ctx.strokeText(beginLabel, beginX, y);
        ctx.fillText(beginLabel, beginX, y);
        y = midY - ctx.fontSize * (overlapping ? 0 : 1 / 2);
        ctx.strokeText(endLabel, endX, y);
        ctx.fillText(endLabel, endX, y);

        ctx.beginPath();
        ctx.fillStyle = handleColor;
        let x = pixelRange.min;
        y = overlapping ? midY - ctx.fontSize / 2 : midY;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, 2 * Math.PI);

        x = pixelRange.max;
        y = overlapping ? midY + ctx.fontSize / 2 : midY;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
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
                const pixelRange = this.getPixelRange();
                if (pointer.x >= pixelRange.min - r &&
                    pointer.x <= pixelRange.min + r) this.holding = 'min';
                else if (pointer.x >= pixelRange.max - r &&
                    pointer.x <= pixelRange.max + r) this.holding = 'max';
                else if (pointer.x > pixelRange.min + r &&
                    pointer.x < pixelRange.max - r) this.holding = 'both';

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
            const range = this.getPixelRange();
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
            const width = this.canvas.width - this.axisSpace.x;
            this.range.min = (range.min - this.axisSpace.x) / width;
            this.range.max = (range.max - this.axisSpace.x) / width;
            this.hasChanged = true;
        }
    }
}