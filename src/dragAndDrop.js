let drug;
export const makeDraggable = (node, data, handle = node) => {
    handle.draggable = true;
    let moveListener = (event) => {
        const height = window.innerHeight;
        if (event.screenY < height / 10) console.debug('scroll up');
        else if (event.screenY > height * .9) console.debug('scroll down');
    };

    // handlers:
    const dragStart = event => {
        node.classList?.add('dragging');
        drug = data;
        event.dataTransfer.dropEffect = 'move';
        window.addEventListener('pointermove', moveListener);
    };
    const endCallback = event => {
        node.classList?.remove('dragging');
        if (prevOver) {
            prevOver.dispatchEvent(new CustomEvent('drop', {bubbles: true}));
            prevOver = null;
        }
        window.removeEventListener('pointermove', moveListener);
    };

    // Listeners:
    handle.addEventListener('dragstart', dragStart);
    handle.addEventListener('dragend', endCallback);

    // Mobile Listeners:
    let hasTouched = false;
    handle.addEventListener('touchstart', (event) => {
        hasTouched = true;
    });
    let prevOver = null;
    handle.addEventListener('touchmove', (event) => {
        if (!drug) return;
        event.preventDefault();
        const {clientX, clientY} = event.targetTouches[0];
        const over = document.elementFromPoint(clientX, clientY);
        if (over && over != prevOver) {
            if (prevOver) prevOver.dispatchEvent(new CustomEvent('dragleave',
                {bubbles: true, clientX, clientY}));
            over.dispatchEvent(new CustomEvent('dragenter', {bubbles: true}));
            prevOver = over;
        }
    });
    handle.addEventListener('contextmenu', (event) => {
        if (!hasTouched) return;
        event.preventDefault();
        dragStart({dataTransfer:{}});
    });
    handle.addEventListener('touchend', endCallback);
    handle.addEventListener('touchcancel', endCallback);
    
};
export const makeDroppable = (node, test, drop) => {
    const dragEnter = event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.add('drag-over');
    };
    const dragLeave = event => {
        if (!test(drug)) return true;
        if (!isPointInsideNode({x: event.clientX, y: event.clientY}, node)) {
            event.preventDefault();
            node.classList.remove('drag-over');
        }
    };
    const dragOver = event => {
        if (test(drug)) event.preventDefault();
    };

    node.addEventListener('dragenter', dragEnter);
    node.addEventListener('dragleave', dragLeave);
    node.addEventListener('dragover', dragOver);
    node.addEventListener('drop', event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.remove('drag-over');
        drop(drug);
        drug = null;
    });
};

const isPointInsideNode = ({x, y}, node) => {
    const box = node.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
};