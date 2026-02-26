import {Graph} from './Graph.js';
import Vec2 from '../Vec2.js';
import {getWeek, MS_DAY} from '../date-utils.js';
import {Range} from '../utils.js';

export default class ActivityGraph extends Graph {
    constructor() {
        super(null, null, null, new Vec2());
        this.hasChanged = false;
    }
    generateHtml() {
        super.generateHtml();
        this.canvas.classList.add('activity-graph');
        this.canvas.title = 'Activity Graph';
        this.animationFrame();
    }
    update(days, range, balancePoints) {
        const weekRange = new Range(getWeek(range.min), getWeek(range.max));
        const weekCount = weekRange.diff + 1;
        this.size.x = weekCount;
        this.size.y = 7;
        if (this.hasNode) {
            this.canvas.width = this.size.x;
            this.canvas.height = this.size.y;
        }

        this.days = days;
        this.startY = new Date(range.min).getDay();
        this.range = range;
        this.balancePoints = balancePoints;
        
        this.hasChanged = true;
        this.animationFrame();
    }
    draw() {
        const {days, startY, range, balancePoints} = this;
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.size.x, this.size.y);

        ctx.beginPath();
        ctx.fillStyle = '#fff';
        for (let y = startY; y < 7; ++y) {
            for (let x = 0; x < this.size.x; ++x) {
                if (days.get(x * 7 + y - startY)) {
                    ctx.rect(x, y, 1, 1);
                }
            }
        }
        ctx.fill();

        if (balancePoints) {
            ctx.beginPath();
            ctx.fillStyle = '#0047cc';
            for (const {timestamp} of balancePoints) {
                const index = ((timestamp - range.min) / MS_DAY | 0) + startY;
                const x = index / 7 | 0;
                const y = index % 7;
                ctx.rect(x, y, 1, 1);
            }
            ctx.fill();
        }
    }
    contextrestored() {
        super.contextrestored();
        const event = new CustomEvent('re-draw activity', {bubbles: true});
        this.node.dispatchEvent(event);
    }
    static populateDays(days, transactions, range) {
        for (const transaction of transactions) {
            const diff = transaction.timestamp - range.min;
            const day = Math.round(diff / MS_DAY);
            days.set(day, 1);
        }
    }
}