import {Graph} from './Graph.js';
import Vec2 from '../Vec2.js';

const MS_DAY = 1000 * 60 * 60 * 24;

export default class ActivityGraph extends Graph {
    constructor() {
        super(null, null, null, new Vec2());
    }
    generateHtml() {
        super.generateHtml();
        this.canvas.classList.add('activity-graph');
    }
    update(days) {
        if (!this.hasNode) this.generateHtml();
        this.canvas.width = this.size.x = days.length;
        this.canvas.height = this.size.y = 1;

        this.hasChanged = true;
        this.draw(days);
    }
    draw(days) {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.size.x, this.size.y);

        ctx.fillStyle = '#fff';
        let filledCount = 0;
        for (let i = 0; i < days.length; ++i) {
            if (days.get(i)) {
                filledCount++;
                ctx.fillRect(i, 0, 1, 1);
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