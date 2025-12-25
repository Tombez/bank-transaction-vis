import {hsl} from "./color-utils.js";
import {Graph} from './Graph.js';

const defaultGraphOptions = {
    lineVsBar: false,
    drawValues: true,
    drawLabels: true,
    drawValueLines: true,
    drawLabelLines: false,
    maxValueLines: 10,
    randomHue: true,
    defaultHue: 162,
    valuePadding: 8,
    labelPadding: 8,
    lineWidth: 2,
    fontSize: 18,
    tooltip: false,
};
let accentColor = hsl(defaultGraphOptions.defaultHue/360);

export default class BarGraph extends Graph {
    constructor(title, values, labels, width, height) {
        super(values, labels, width, height);
        this.options = JSON.parse(localStorage.getItem('graphOptions')) ?? defaultGraphOptions;
        this.optionPanel = new OptionPanel(this.options, () => this.dataUpdate());
        this.title = title;
        this.constructHTML();
        this.dataUpdate();
    }
    constructHTML() {
        if (!this.optionPanel) {
            super.constructHTML();
            return;
        }
        this.tooltipVLine = document.createElement('div');
        this.tooltipHLine = document.createElement('div');
        this.tooltipVLine.style = this.tooltipHLine.style = 'background: black; position: absolute; display: none; top: 0px; left: 0px;';
        this.tooltipVLine.style.width = this.tooltipHLine.style.height = '1px';
        this.tooltipVLine.style.height = this.tooltipHLine.style.width = '100%';
        this.container.appendChild(this.tooltipVLine);
        this.container.appendChild(this.tooltipHLine);
        this.container.appendChild(this.optionPanel.panel);
    }
    mousemove(event) {
        if (this.options.tooltip) {
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }
    }
    mouseenter(event) {
        if (this.options.tooltip) {
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
            this.tooltipUpdate();
            this.tooltipVLine.style.display = this.tooltipHLine.style.display = 'block';
            this.tooltipUpdateInterval = setInterval(this.tooltipUpdate.bind(this), 33);
        }
    }
    mouseleave(event) {
        clearInterval(this.tooltipUpdateInterval);
        this.tooltipVLine.style.display = this.tooltipHLine.style.display = 'none';
    }
    tooltipUpdate() {
        let rect = this.canvas.getBoundingClientRect();
        this.tooltipVLine.style.left = (this.mouseX - rect.left) + 'px';
        this.tooltipHLine.style.top = (this.mouseY - rect.top) + 'px';
    }
    dataUpdate() {
        localStorage.setItem('graphOptions', JSON.stringify(this.options));
        this.highestValue = Math.max.apply(Math, this.values);
        this.lowestValue = Math.min.apply(Math, this.values);
        this.valueStep = 1;
        while (this.highestValue / this.valueStep > this.options.maxValueLines) {
            this.valueStep = (parseInt(this.valueStep.toPrecision(1)) + 1) * Math.pow(10, this.valueStep.toString().length - 1);
        }
        this.largestValueLine = Math.ceil(this.highestValue / this.valueStep) * this.valueStep;
        this.ctx.setFontSize(this.options.fontSize, true);
        const largestValueWidth = Math.ceil(this.ctx.measureText(this.largestValueLine).width);
        const valPad = this.options.valuePadding * 2;
        this.valueOffset = this.options.drawValues ? largestValueWidth + valPad : 0;
        const labelWidth = Math.ceil(this.ctx.measureText(this.labels[0]).width);
        const labelPad = this.options.valuePadding * 2;
        this.labelOffset = this.options.drawLabels ? labelWidth + labelPad : 0;
        this.valueScale = (this.canvas.height - this.labelOffset - this.options.valuePadding - this.options.fontSize / 2) / this.largestValueLine;
        const numLabels = this.labels.length || this.values.length;
        const dataWidth = (this.canvas.width - this.valueOffset) / (numLabels - (this.options.lineVsBar ? 0.5 : 0));
        const labelEndSpace = this.options.lineVsBar ?
            Math.max(this.options.fontSize / 2 - dataWidth, 0) : 0;
        this.labelScale = (this.canvas.width - this.valueOffset - labelEndSpace) / (numLabels - (this.options.lineVsBar ? 0.5 : 0));
        this.draw(this.ctx);
    }
    draw(ctx) {
        const textColor = '#fff';
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.translate(0, this.canvas.height);
        ctx.lineWidth = this.options.lineWidth;
        ctx.lineCap = this.ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.fillStyle = textColor;
        ctx.strokeStyle = '#999';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        this.ctx.setFontSize(this.options.fontSize, true);
        this.drawValues(ctx);
        ctx.rotate(-Math.PI/2);
        this.drawLabels(ctx);
        ctx.rotate(Math.PI/2);
        ctx.stroke();
        ctx.beginPath();
        let hue = this.options.randomHue ? ~~(Math.random() * 301) : this.options.defaultHue;
        ctx.globalAlpha = 0.8;
        ctx.scale(1, -1);
        ctx.strokeStyle = ctx.fillStyle = hsl(hue/360);
        this.drawData(ctx);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = textColor;
        this.drawTitle(ctx);
    }
    drawTitle(ctx) {
        ctx.textAlign = 'center';
        ctx.setFontSize(this.options.fontSize + 4, true);
        ctx.fillText(this.title, ctx.canvas.width / 2, this.options.fontSize / 2 + this.options.labelPadding);
    }
    drawValues(ctx) {
        let x = this.valueOffset - this.options.valuePadding;
        for(let n = 0; n <= this.largestValueLine; n += this.valueStep) {
            let y = -(this.labelOffset + n * this.valueScale);
            if (n && this.options.drawValues) {
                ctx.fillText(n + '', x, y);
            }
            if (this.options.drawValueLines) {
                ctx.moveTo(this.valueOffset, y);
                ctx.lineTo(this.canvas.width, y);
            }
        }
    }
    drawLabels(ctx) {
        let labelWidth = this.options.fontSize + this.options.labelPadding;
        let previousY = 0;
        let x = this.labelOffset - this.options.valuePadding;
        for (let n = 0; n < this.labels.length; n++) {
            if (!this.labels[n]) continue;
            let y = this.valueOffset + (this.options.lineVsBar ? n : n + 0.5) * this.labelScale;
            if (y - previousY >= labelWidth) {
                previousY = y;
                if (this.options.drawLabels) {
                    ctx.fillText(this.labels[n], x, y);
                }
                if (this.options.drawLabelLines) {
                    ctx.moveTo(this.labelOffset, y);
                    ctx.lineTo(this.canvas.height, y);
                }
            }
        }
    }
    drawData(ctx) {
        ctx.moveTo(this.valueOffset, this.labelOffset);
        let x;
        for (let n = 0; n < this.values.length; n++) {
            x = this.valueOffset + n * this.labelScale;
            let y = this.labelOffset + this.values[n] * this.valueScale;
            ctx.lineTo(x, y);
            if (!this.options.lineVsBar) {
                ctx.lineTo(x + this.labelScale, y);
            }
        }
        ctx.lineTo(x + (this.options.lineVsBar ? 0 : this.labelScale), this.labelOffset);
        ctx.closePath();
    }
}

class Option {
    constructor(_label, _options, _changed) {
        this.label = _label;
        this.options = _options;
        this.changed = _changed;
        this.value = _options[_label];
        this.container = document.createElement('span');
        this.container.className = 'optionContainer';
        this.labelTag = document.createElement('div');
        this.labelTag.textContent = this.label + ':';
        this.labelTag.className = 'optionLabel';
        this.container.appendChild(this.labelTag);
    }
}
class BooleanOption extends Option {
    constructor(_label, _options, _changed) {
        super(_label, _options, _changed);
        this.slider = document.createElement('div');
        this.slider.className = 'booleanSlider';
        this.fill = document.createElement('div');
        this.fill.className = 'booleanFill';
        this.fill.style.background = accentColor;
        this.fill.style.width = (this.value ? '100%' : '5px');
        this.ball = document.createElement('div');
        this.ball.className = 'booleanBall';
        this.ball.style.transform = (this.value ? 'translateX(100%)' : '');
        this.slider.appendChild(this.fill);
        this.slider.appendChild(this.ball);
        this.container.appendChild(this.slider);
        this.slider.addEventListener('click', event => {
            this.value = !this.value;
            this.ball.style.transform = (this.value ? 'translateX(100%)' : '');
            this.fill.style.width = (this.value ? '100%' : '5px');
            this.options[this.label] = this.value;
            this.changed();
            event.preventDefault();
        });
    }
}
class NumberOption extends Option {
    constructor(_label, _options, _changed) {
        super(_label, _options, _changed);
        this.input = document.createElement('input');
        this.input.className = 'inputOption';
        this.input.value = this.value;
        this.input.style.color = accentColor;
        this.container.appendChild(this.input);
        this.input.addEventListener('change', function(event) {
        this.input.value = this.input.value.replace(/\.[\S\s]*/, '').replace(/\D/g, '');
        this.options[this.label] = parseInt(this.input.value);
        this.changed();
        }.bind(this));
    }
}
class OptionPanel {
    constructor(_options, _changed) {
        this.panel = document.createElement('div');
        this.panel.className = 'optionPanel';
        this.typeMap = {
            boolean: BooleanOption,
            number: NumberOption,
        };
        let optionArray = Object.keys(_options);
        for (let optionKey of optionArray) {
            this.panel.appendChild(new this.typeMap[typeof _options[optionKey]](optionKey, _options, _changed).container);
        }
        let boundFunctions = ['mousemove', 'mousedown', 'mouseup', 'keydown', 'move'];
        for (let name of boundFunctions) {
            this[name] = this[name].bind(this);
        }
        this.panel.addEventListener('mousedown', this.mousedown);
        window.addEventListener('mouseup', this.mouseup);
        window.addEventListener('keydown', this.keydown);
    }
    mousedown(event) {
        if (event.target.tagName.toLowerCase() != 'input' && event.which == 1) {
            event.preventDefault();
            document.activeElement.blur();
            this.mousemove(event);
            let rect = this.panel.getBoundingClientRect();
            this.diffX = event.clientX - rect.left;
            this.diffY = event.clientY - rect.top;
            window.addEventListener('mousemove', this.mousemove);
            this.moveInterval = setInterval(this.move, 33);
        }
    }
    mouseup(event) {
        if (event.which == 1 && this.moveInterval) {
            window.removeEventListener('mousemove', this.mousemove);
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
    }
    mousemove(event) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
    }
    move() {
        this.panel.style.left = (this.mouseX - this.diffX) + 'px';
        this.panel.style.top = (this.mouseY - this.diffY) + 'px';
    }
    keydown(event) {
        if (event.target.tagName.toLowerCase() != 'input' && event.keyCode == 79) { // 'o'
            this.panel.style.display = (this.panel.style.display == 'none' ? 'inline-block' : 'none');
        }
    }
}

let style = document.createElement('style');
style.textContent = `
.optionPanel
{
    background:rgb(54,57,62);
    border-radius:5px;
    border: 1px solid black;
    color:#ddd;
    display:inline-block;
    padding:5px;
    /*position:fixed;
    box-shadow:0 0 20px #000;
    cursor: grab;
    left:5px;
    z-index:999;
    top:120px;*/
    margin-left: 8px;
    vertical-align: top;
}

.booleanBall
{
    background:#fff;
    border:1px solid #ccc;
    border-radius:50%;
    box-shadow:0 0 10px #000;
    height:18px;
    margin:-2px;
    width:18px;

    position: relative;
    left: 0;
    transition: all 100ms ease-in;
}

.booleanSlider
{
    border: 1.5px solid #000;
    border-radius:10px;
    cursor:pointer;
    display:inline-block;
    float:right;
    height:16px;
    vertical-align:middle;
    width:36px;
    background: rgba(0, 0, 0, 0);
}
.booleanFill
{
    border-radius:10px;
    width: 100%;
    height: 100%;
    float: left;
    transition: width 100ms ease-in;
}

.inputOption
{
    background:rgba(0,0,0,0);
    border: 1px solid #000;
    float:right;
    text-align:center;
    width:36px;
}

.inputOption:focus
{
    box-shadow:0 0 3px #000;
    outline:0!important;
}

.optionContainer
{
    display:block;
    padding:2px;
    white-space:nowrap;
}

.optionLabel
{
    display:inline-block;
    margin-right:5px;
    vertical-align:middle;
}
.stats-table
{
    display: none;
}
`;
document.head.appendChild(style);