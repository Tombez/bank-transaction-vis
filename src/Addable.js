import memoMixin from './memoMixin.js';

export const Addable = memoMixin(Base => class extends Base {
    constructor(...args) {
        super(...args);
    }
    generateHtml() {
        super.generateHtml();
        const addBtn = document.createElement('button');
        addBtn.className = 'icon icon-add';
        addBtn.ariaLabel = addBtn.title = 'Add';
        this.btnWrapper.appendChild(addBtn);
        addBtn.addEventListener('click', event => {
            this.add();
        });
    }
    add() {}
});