const unique = () => `${Date.now() % 1e8}-${Math.random() * 1e8 | 0}`;

export class TabBar {
    constructor() {
        this.node = document.createElement('div');
        this.node.className = 'header tab-bar';
        this.nodes = [];
        this.selected = null;
        this.node.addEventListener('change', this.change.bind(this));
        this.name = `name-${unique()}`;
    }
    change(event) {
        const tabNode = event.target.parentNode;
        if (this.selected) {
            this.selected.content.hidden = true;
        }
        tabNode.content.hidden = false;
        this.selected = tabNode;
    }
    addTab(name, node) {
        node.classList.add('tab-content');
        const id = `input-${unique()}`;
        const tabNode = document.createElement('div');
        tabNode.content = node;
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.id = id;
        radio.name = this.name;
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = name;
        tabNode.appendChild(radio);
        tabNode.appendChild(label);
        this.node.appendChild(tabNode);
        this.nodes.push(tabNode);
        if (!this.selected) {
            this.selected = tabNode;
            node.hidden = false;
            radio.checked = true;
        } else node.hidden = true;
        return tabNode;
    }
}