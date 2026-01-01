let drug;
export const makeDraggable = (node, data, handle = node) => {
    handle.draggable = true;
    let pointer = {x: 0, y: 0};
    let checkScrollId = 0;
    let checkScroll = () => {
        const source = document.elementFromPoint(pointer.x, pointer.y);
        bubble(source, target => {
            // if (target.tagName == 'HTML') debugger;
            if (!canScrollY(target)) return false;
            const rect = target.getBoundingClientRect();
            const top = Math.max(rect.top, 0);
            const bottom = Math.min(rect.bottom, window.innerHeight);
            const height = bottom - top;
            const midY = (top + bottom) / 2;
            const halfHeight = height / 2;
            const offset = pointer.y - midY;
            const threshold = halfHeight * 0.8;
            if (Math.abs(offset) <= threshold) return false;
            const linear = offset + threshold * (offset > 0 ? -1 : 1);
            console.debug('linear what', linear);
            //target.scrollTop += linear;
            return true;
        });
        checkScrollId = requestAnimationFrame(checkScroll);
    };
    let moveListener = (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    };

    // handlers:
    const dragStart = event => {
        node.classList?.add('dragging');
        drug = data;
        event.dataTransfer.dropEffect = 'move';
        window.addEventListener('pointermove', moveListener);
        checkScrollId = requestAnimationFrame(checkScroll);
    };
    const endCallback = event => {
        node.classList?.remove('dragging');
        if (prevOver) {
            prevOver.dispatchEvent(new CustomEvent('drop', {bubbles: true}));
            prevOver = null;
        }
        window.removeEventListener('pointermove', moveListener);
        cancelAnimationFrame(checkScrollId);
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
const canScrollY = element => {
    return element.scrollHeight > element.clientHeight;
};
const bubble = (target, cb) => {
    if (!target) return false;
    const captured = cb(target);
    if (captured) return true;
    return bubble(target.parentNode, cb);
};