import {ViewLineGraph} from './ViewLineGraph.js';
import ContextMenu from '../ContextMenu.js';

export default class AccountBalancesGraph extends ViewLineGraph {
    constructor(title, values, labels, size, dataRangeX, dataRangeY) {
        super(title, values, labels, size, dataRangeX, dataRangeY);
    }
    contextmenu(event) {
        console.debug('contextmenu');
        event.preventDefault();
        const contextMenu = new ContextMenu();
        contextMenu.entries.push([
            'View Visible Transactions',
            () => console.debug('view transactions')
        ]);
        contextMenu.listener(event);
    }
}