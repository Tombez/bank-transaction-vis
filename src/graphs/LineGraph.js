import {Graph} from './Graph.js';
import {Color} from "../color-utils.js";
import {binarySearchI} from '../utils.js';

export class LineGraph extends Graph {
    constructor(...args) {
        super(...args);
        this.axisSpace = {x: 50, y: 30};
        this.generateColors();
        this.shouldDrawVertical = false;
        this.labels = this.labels.map(l => ({name: l, active: true}));
        for (let i = 0; i < this.values.length; ++i)
            this.values[i].label = this.labels[i];
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
    toPixelSpace(pos, dataRangeX, dataRangeY) {
        pos.x = (pos.x - dataRangeX.min) / dataRangeX.diff * this.ctx.width;
        pos.y = (pos.y - dataRangeY.min) / dataRangeY.diff * this.ctx.height;
        return pos;
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
                if (!line.label.active) continue;
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
            ctx.setFontSize(22);
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
                    ctx.setFontSize(ctx.fontSize - 3);
                    drawLabel('Q3', +new Date(year, 6, 1));
                    if (drawEvenQs) {
                        drawLabel('Q2', +new Date(year, 3, 1));
                        drawLabel('Q4', +new Date(year, 9, 1));
                    }
                    if (drawMonths) {
                        ctx.setFontSize(ctx.fontSize - 4);
                        for (const month of [1, 2, 4, 5, 7, 8, 10, 11]) {
                            const date = new Date(year, month, 1);
                            drawLabel(getMonthName(date), +date);
                        }
                    }
                }
                ctx.setFontSize(22);
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

            // Vertical Intersector
            if (this.shouldDrawVertical) {
                const width = this.canvas.width - this.axisSpace.x;
                const percentX = (this.pointer.x - this.axisSpace.x) / width;
                const barX = dataRangeX.min + percentX * dataRangeX.diff;
                this.drawVertical(ctx, dataRangeX, dataRangeY, barX);
            } else this.verticalIntersections = null;
        });
    
        // Draw Title:
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.8;
        const x = ctx.width / 2;
        ctx.textAlign = 'center';
        ctx.setFontSize(26, true);
        ctx.fillText(this.title, x, 20);
        ctx.globalAlpha = 1;
    
        // Draw Graph Key:
        const keyItems = this.verticalIntersections ?
            this.verticalIntersections.map(({line, label}) => [line, label]) :
            this.values.map((line, i) => [line, this.labels[i]]);
        const keyFontSize = 18;
        ctx.setFontSize(keyFontSize);
        const boxMargin = 10;
        const keyBoxSize = 10;
        const margin = 4;
        const rowHeight = keyFontSize + margin;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        let y = 0;
        for (const [line, label] of keyItems) {
            label.rect = null;
            if (!line.inRange) continue;
            const colorInactive = '#999';
            ctx.fillStyle = label.active ? '#fff' : colorInactive;
            const boxX = ctx.width - keyBoxSize - boxMargin;
            ctx.fillText(label.name, boxX - boxMargin, y += rowHeight);

            ctx.fillStyle = line.color;
            ctx.strokeStyle = colorInactive;
            ctx.lineWidth = 1 + Math.sqrt(devicePixelRatio);
            const args = [boxX, y - keyBoxSize / 2, keyBoxSize, keyBoxSize];
            if (label.active) ctx.fillRect(...args);
            else ctx.strokeRect(...args);

            let rect = new DOMRect();
            const textWidth = ctx.measureText(label.name).width;
            rect.width = textWidth + keyBoxSize + boxMargin * 2;
            rect.x = this.canvas.width - rect.width;
            rect.y = y - keyFontSize / 2;
            rect.height = rowHeight;

            label.rect = rect;
        }
    }
    pointerdown(event) {
        super.pointerdown(event);
        if (event.button == 0) { // left-click

            let toggledLabel = false;
            for (const label of this.labels) {
                const pointInside = (p, rect) =>
                    p.x >= rect.left && p.x <= rect.right &&
                    p.y >= rect.top  && p.y <= rect.bottom;
                if (label.rect && pointInside(this.pointer, label.rect)) {
                    toggledLabel = true;
                    label.active = !label.active;
                    this.changed = true;
                    break;
                }
            }
            if (!toggledLabel) {
                this.shouldDrawVertical = true;
                this.hasChanged = true;
                this.canvas.setPointerCapture(event.pointerId);
            }
        } else if (event.button == 2) { // right-click

        }
    }
    pointerup(event) {
        super.pointerup(event);
        if (event.button == 0) {
            this.shouldDrawVertical = false;
            this.hasChanged = true;
        }
    }
    pointermove(event) {
        super.pointermove(event);
        if (this.shouldDrawVertical) this.hasChanged = true;
    }
    drawVertical(ctx, dataRangeX, dataRangeY, barX) {
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const {x} = this.toPixelSpace({x: barX, y: 0}, dataRangeX, dataRangeY);
        ctx.moveTo(x, dataRangeY.min);
        ctx.lineTo(x, dataRangeY.max);
        ctx.stroke();
        
        let intersections = this.getIntersections(barX);
        intersections.sort(({y: ay}, {y: by}) => by - ay);
        this.verticalIntersections = intersections;
        const r = 3 + window.devicePixelRatio;
        const margin = 3;
        for (let i = intersections.length - 1; i >= 0; --i) {
            let {line, x, y, valueString} = intersections[i];
            ({x, y} = this.toPixelSpace({x, y}, dataRangeX, dataRangeY));
            ctx.beginPath();
            ctx.fillStyle = line.color;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fill();

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.temp(() => {
                ctx.translate(x + r + margin, y);
                const halfHeight = ctx.fontSize / 2;
                const width = ctx.measureText(valueString).width;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, -halfHeight, width, halfHeight * 2);
                ctx.scale(1, -1);
                ctx.fillStyle = '#fff';
                ctx.fillText(valueString, 0, 0);
            })
        }
    }
    getIntersections(targetX) {
        let intersections = [];
        for (let i = 0; i < this.values.length; ++i) {
            const line = this.values[i];
            const label = this.labels[i];
            if (!label.active) continue;
            const index = binarySearchI(line, ({x}) => targetX - x);
            let beforeItem = line[index];
            if (beforeItem.x > targetX || index == line.length - 1) continue;
            const afterItem = line[index + 1];
            const reverseInterpolate = (start, end, n) =>
                (n - start) / (end - start);
            const interpolate = (start, end, percent) =>
                (end - start) * percent + start;
            const percent = reverseInterpolate(beforeItem.x, afterItem.x, targetX);
            const y = interpolate(beforeItem.y, afterItem.y, percent);
            const valueString = (Math.round(y * 100) / 100).toLocaleString();
            intersections.push({line, x: targetX, y, label, valueString});
        }
        return intersections;
    }
}