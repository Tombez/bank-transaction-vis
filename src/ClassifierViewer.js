import {LazyHtml} from './LazyHtml.js';

export class Classifier extends LazyHtml {
    constructor(type, unique, label) {
        super();
        this.type = type;
        this.unique = unique;
        this.label = label;
    }
    classify(date, desc, amount) {
        switch(this.type) {
            case 'exact':
                return desc == this.unique && this.label;
            case 'starts':
                return desc.startsWith(this.unique) && this.label;
            case 'has':
                return desc.includes(this.unique) && this.label;
            case 'custom':
                return this.unique(date, desc, amount) && this.label;
            case 'custom-return':
                return this.unique(date, desc, amount);
            default:
                throw new TypeError(`Unknown rule type "${type}"`);
        };
    }
    generateHtml() {
        super.generateHtml();
        this.node.textContent = `${this.type}(${this.unique}): ${this.label}`;
    }
}

export class ClassifierViewer extends LazyHtml {
    constructor(classifiers) {
        super();
        this.classifiers = classifiers;
    }
    generateHtml() {
        super.generateHtml();
        for (const classifier of this.classifiers)
            this.node.appendChild(classifier.node);
    }
    add(classifier) {
        this.classifiers.push(classifier);
        if (this.hasNode) this.node.append(classifier.node);
    }
}