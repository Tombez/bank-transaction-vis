import {Graph} from './Graph.js';
import Vec2 from '../Vec2.js';
import {getWeek, MS_DAY} from '../date-utils.js';
import {Range} from '../utils.js';

export default class ActivityGraph extends Graph {
    constructor() {
        super(null, null, null, new Vec2());
    }
    generateHtml() {
        super.generateHtml();
        this.canvas.classList.add('activity-graph');
        this.canvas.title = 'Activity Graph';
    }
    update(days, range, balancePoints) {
        if (!this.hasNode) this.generateHtml();
        const weekRange = new Range(getWeek(range.min), getWeek(range.max));
        const weekCount = weekRange.diff + 1;
        this.canvas.width = this.size.x = weekCount;
        this.canvas.height = this.size.y = 7;

        this.hasChanged = true;
        this.draw(days, new Date(range.min).getDay(), weekCount, range,
            balancePoints);
    }
    draw(days, startY, weekCount, range, balancePoints) {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.size.x, this.size.y);

        ctx.fillStyle = '#fff';
        for (let y = startY; y < 7; ++y) {
            for (let x = 0; x < weekCount; ++x) {
                if (days.get(x * 7 + y - startY)) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        if (balancePoints) {
            ctx.fillStyle = '#2c64cc';
            for (const {timestamp, balance} of balancePoints) {
                const index = (timestamp - range.min) / MS_DAY | 0 + startY;
                const x = index / 7 | 0;
                const y = index % 7;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    static populateDays(days, transactions, range) {
        for (const transaction of transactions) {
            const diff = transaction.timestamp - range.min;
            const day = Math.round(diff / MS_DAY);
            days.set(day, 1);
        }
    }
}