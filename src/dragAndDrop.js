let drug;
export const makeDraggable = (node, data, handle = node) => {
    handle.draggable = true;

    // handlers:
    const dragStart = event => {
        node.classList?.add('dragging');
        drug = data;
        event.dataTransfer.dropEffect = 'move';
        console.log('drag start');
    };
    const endCallback = event => {
        node.classList?.remove('dragging');
        if (prevOver) {
            prevOver.dispatchEvent(new CustomEvent('drop', {bubbles: true}));
            prevOver = null;
        }
    };

    // Listeners:
    handle.addEventListener('dragstart', dragStart);
    handle.addEventListener('dragend', endCallback);

    // Mobile Listeners:
    let hasTouched = false;
    handle.addEventListener('touchstart', (event) => {
        hasTouched = true;
        console.log('touch start');
    });
    let prevOver = null;
    handle.addEventListener('touchmove', (event) => {
        if (!drug) return;
        event.preventDefault();
        const touch = event.targetTouches[0];
        const over = document.elementFromPoint(touch.clientX, touch.clientY);
        if (over && over != prevOver) {
            if (prevOver) prevOver.dispatchEvent(new CustomEvent('dragleave',
                {bubbles: true}));
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
    const dragOver = event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.add('drag-over');
    };
    node.addEventListener('dragover', dragOver);
    node.addEventListener('dragenter', dragOver);
    node.addEventListener('dragleave', event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.remove('drag-over');
    });
    node.addEventListener('drop', event => {
        if (!test(drug)) return;
        event.preventDefault();
        node.classList.remove('drag-over');
        drop(drug);
    });
};