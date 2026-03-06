import HierarchalPieGraph from './HierarchalPieGraph.js';
import ContextMenu from '../ContextMenu.js';
import {Filter} from '../TransactionFile.js';

export class SpendingHPieGraph extends HierarchalPieGraph {
    contextmenu(event) {
        const sector = this.getMouseSector();
        if (sector) {
            const contextMenu = new ContextMenu();
            if (sector.transactions.length) {
                contextMenu.entries.push([
                    `View ${sector.name} own Transactions`,
                    () => this.viewTransactions(sector, true)
                ]);
            }
            if (sector.numTransactions && sector.children?.length) {
                contextMenu.entries.push([
                    `View ${sector.name} all Transactions`,
                    () => this.viewTransactions(sector, false)
                ]);
            }
            if (contextMenu.entries.length) {
                event.preventDefault();
                contextMenu.listener(event);
            }
        }
    }
    viewTransactions(sector, own) {
        let label;
        if (own) {
            if (!sector.transactions.length) return;
            label = sector.transactions[0].labels.join('/');
        } else {
            if (sector.transactions.length)
                label = sector.transactions[0].labels.join('/');
            else {
                let depth = 0;
                const empty = sector => !sector.transactions.length;
                for (; empty(sector) && sector.children?.length; ++depth)
                    sector = sector.children[0];
                let labels = sector.transactions[0].labels;
                label = labels.slice(0, -depth).join('/');
            }
        }
        const detail = [];
        const name = `Category${own ? '' : ' starts with'}: ${label}`;
        const callback = own ? t => t.labels.join('/') == label :
            t => t.labels.join('/').startsWith(label);
        detail.push(new Filter(name, callback));

        const bubbles = true;
        const event = new CustomEvent('view-transactions', {detail, bubbles});
        this.node.dispatchEvent(event);
    }
}