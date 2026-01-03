let drug;
let over = null;
export const makeDraggable = (node, data, handle = node) => {
    handle.draggable = true;
    let pointer = {x: 0, y: 0};
    let checkScrollId = 0;
    let checkScroll = () => {
        const source = document.elementFromPoint(pointer.x, pointer.y);
        bubble(source, target => {
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
            const linear = offset - threshold * Math.sign(offset);
            const range = halfHeight - threshold;
            const ease = (linear / range) ** 2 * range * Math.sign(linear);
            target.scrollTop += ease;
            return true;
        });
        checkScrollId = requestAnimationFrame(checkScroll);
    };

    // handlers:
    const dragstart = event => {
        console.debug('dragstart isTrusted ', event.isTrusted);
        setTimeout(() => node.classList?.add('dragging'), 0);
        drug = data;
        event.dataTransfer.effectAllowed = 'move';

        // Required for iOS to maintain the drag
        event.dataTransfer.setData('text/plain', 'item-id');

        checkScrollId = requestAnimationFrame(checkScroll);
    };
    const drag = event => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        if (over && !isPointerInsideNode(event, over)) {
            const options = {bubbles: true, clientX: pointer.x, clientY: pointer.y};
            over.dispatchEvent(new CustomEvent('dragleave', options));
        }
    };
    const dragend = event => {
        console.debug('dragend');
        setTimeout(() => node.classList?.remove('dragging'), 1);
        // if (prevOver) {
        //     prevOver.dispatchEvent(new CustomEvent('drop', {bubbles: true}));
        //     prevOver = null;
        // }
        cancelAnimationFrame(checkScrollId);
    };

    // Listeners:
    handle.addEventListener('dragstart', dragstart);
    handle.addEventListener('drag', drag);
    handle.addEventListener('dragend', dragend);

    // Mobile Listeners:
    // let hasTouched = false;
    // handle.addEventListener('touchstart', (event) => {
    //     console.debug('touchstart');
    //     hasTouched = true;
    // });
    // let prevOver = null;
    // handle.addEventListener('touchmove', (event) => {
    //     if (!drug) return;
    //     event.preventDefault();
    //     const {clientX, clientY} = event.targetTouches[0];
    //     const over = document.elementFromPoint(clientX, clientY);
    //     if (over && over != prevOver) {
    //         if (prevOver) prevOver.dispatchEvent(new CustomEvent('dragleave',
    //             {bubbles: true, clientX, clientY}));
    //         over.dispatchEvent(new CustomEvent('dragenter', {bubbles: true}));
    //         prevOver = over;
    //     }
    // });
    handle.addEventListener('contextmenu', (event) => {
        // if (!hasTouched) return;
        console.debug('contextmenu');
        // event.preventDefault();
        // dragstart({dataTransfer:{}});
    });
    // handle.addEventListener('touchend', event => {
    //     console.debug('touchend');
    //     dragend(event)
    // });
    // handle.addEventListener('touchcancel', event => {
    //     console.debug('touchcancel');
    //     // dragend(event);
    // });
    
};
export const makeDroppable = (node, test, drop) => {
    const dragEnter = event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.add('drag-over');
        over = node;
    };
    const dragLeave = event => {
        if (!test(drug)) return;
        if (event.target == node ||
            !isPointerInsideNode(event, node))
        {
            event.preventDefault();
            node.classList.remove('drag-over');
            over = null;
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
const isPointerInsideNode = ({clientX, clientY}, node) =>
    isPointInsideNode({x: clientX, y: clientY}, node);
const canScrollY = element => {
    return element.scrollHeight > element.clientHeight;
};
const bubble = (target, cb) => {
    if (!target) return false;
    const captured = cb(target);
    if (captured) return true;
    return bubble(target.parentNode, cb);
};