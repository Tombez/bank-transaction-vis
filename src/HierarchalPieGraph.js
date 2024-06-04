import {hsl} from "./color-utils.js";

export default class HierarchyGraph {
    constructor(root, title, canvasSize) {
        this.root = root;
        this.title = title;
        this.outerRadius = 350;
        this.innerRadius = 40;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.texts = [];
        this.hoverBox = null;
        this.dragging = null;
        this.mouse = {x: 0, y: 0};

        const radius = (this.outerRadius-this.innerRadius)/3+this.innerRadius;

        this.canvas.width = canvasSize.x;
        this.canvas.height = canvasSize.y;
        this.attachListeners();
        this.calculatePieces(root.children, root.total, -0.5*Math.PI, 1.5*Math.PI, this.innerRadius, radius);
    }
    attachListeners() {
        this.canvas.addEventListener("mousedown", event => {
            const x = this.mouse.x = event.offsetX - event.target.width/2;
            const y = this.mouse.y = event.offsetY - event.target.height/2;

            // let mAngle = Math.atan2(this.mouse.y, this.mouse.x);
            // if (mAngle < -0.5*Math.PI) mAngle += 2*Math.PI;
            // const mRadius = Math.hypot(this.mouse.x, this.mouse.y);
            // let hoverSector = whichSector(mAngle, mRadius, root.children);
            // if (hoverSector) {
            //     root = hoverSector;
            //     texts = [];
            //     this.calculatePieces(root.children, root.total, -0.5*Math.PI, 1.5*Math.PI, innerRadius, radius);
            // }

            // Find closest text to mouse
            const [minText, minDist] = this.texts.reduce(([minText, min], text) => {
                const tx = text[4];
                const ty = text[5];

                const difX = x-tx;
                const difY = y-ty;
                const distSq = difX**2+difY**2;
                return distSq < min ? [text, distSq] : [minText, min];
            }, [null, Infinity]);
            if (minDist<20**2) this.dragging = minText;
        });
        this.canvas.addEventListener("mouseup", event => {
            this.dragging = null;
        });
        this.canvas.addEventListener("mousemove", event => {
            this.mouse.x = event.offsetX - event.target.width / 2;
            this.mouse.y = event.offsetY - event.target.height / 2;
            if (this.dragging) {
                this.dragging[4] = this.mouse.x;
                this.dragging[5] = this.mouse.y;
            }
        });
    }
    textCollisions() {
        for (let i = 0; i < this.texts.length; ++i) {
            const a = this.texts[i];
            for (let j = i + 1; j < this.texts.length; j++) {
                const b = this.texts[j];
                const difX = a[4]-b[4];
                const difY = a[5]-b[5];
                if (difX**2+difY**2<20**2) {
                    a[4] += difX / 100;
                    a[5] += difY / 100;
                    b[4] -= difX / 100;
                    b[5] -= difY / 100;
                    a[4] += a[4] / 400;
                    a[5] += a[5] / 400;
                    b[4] += b[4] / 400;
                    b[5] += b[5] / 400;
                }
            }
        }
    }
    whichSector(angle, radius, sectors) { // recursive
        if (!sectors) return null;
        for (const sector of sectors) {
            if (radius < sector.innerRadius) return null;
            if (angle >= sector.startAngle && angle < sector.endAngle) {
                if (radius < sector.outerRadius) return sector;
                return this.whichSector(angle, radius, sector.children);
            }
        }
        return null;
    }
    checkHover(pieces) {
        let mAngle = Math.atan2(this.mouse.y, this.mouse.x);
        if (mAngle < -0.5*Math.PI) mAngle += 2*Math.PI;
        const mRadius = Math.hypot(this.mouse.x, this.mouse.y);
        let hoverSector = this.whichSector(mAngle, mRadius, this.root.children);
        if (!hoverSector) {
            this.hoverBox = null;
            return;
        }
        this.hoverBox = {
            x: this.mouse.x + 10,
            y: this.mouse.y + 10,
            lines: [
                `Name: ${hoverSector.name}`,
                `Percent: ${(hoverSector.percent*100).toFixed(2)}%`,
                `Total: $${hoverSector.total.toFixed(2)}`,
                `${hoverSector.numTransactions} total transactions`,
                `${hoverSector.transactions?.length||0} own transactions`
            ]
        };
    }
    update() {
        this.calculate();
        this.draw();
    }
    calculate() {
        this.checkHover();
        this.textCollisions();
    }
    draw() {
        this.ctx.save();

        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.translate(this.canvas.width/2, this.canvas.height/2);

        this.drawPieces(this.root.children);
        this.drawText();

        // Draw Center Total:
        this.ctx.fillStyle = "#fff";
        this.ctx.font = "bold 20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";
        this.ctx.fillText(`Total`, 0, 0);
        this.ctx.textBaseline = "top";
        this.ctx.fillText(`$${this.root.total | 0}`, 0, 0);
        // Draw Title:
        this.ctx.textBaseline = "top";
        this.ctx.fillText(this.title, 0, 10 - this.canvas.height / 2);

        this.drawHoverBox();
        this.ctx.restore();
    }
    drawPieces(pieces) { // recursive
        for (const cur of pieces) {
            if (!cur.name) continue;

            this.ctx.beginPath();
            this.ctx.fillStyle = cur.color;
            this.ctx.strokeStyle = "#fff";
            drawSector(this.ctx, 0, 0, cur.innerRadius, cur.outerRadius, cur.startAngle, cur.endAngle);
            this.ctx.fill();
            this.ctx.stroke();

            if (cur.children) this.drawPieces(cur.children);
        }
    }
    drawText() {
        this.ctx.fillStyle = "#fff";
        this.ctx.strokeStyle = "#000";

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        for (let [text, ox, oy, ang, dx, dy] of this.texts) {
            this.ctx.font = "bold 20px Arial";

            this.ctx.beginPath();
            this.ctx.lineWidth = 2.5;
            this.ctx.strokeStyle = "#000";
            this.ctx.moveTo(ox, oy);
            this.ctx.lineTo(dx, dy);
            this.ctx.stroke();

            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = "#fff";
            this.ctx.stroke();

            this.ctx.save();
            this.ctx.translate(dx, dy);
            this.ctx.rotate(ang);
            this.ctx.lineWidth = 0.8;
            this.ctx.strokeStyle = "#000";
            this.ctx.fillText(text, 0, 0);
            this.ctx.strokeText(text, 0, 0);

            this.ctx.restore();
        }
    }
    drawHoverBox() {
        if (!this.hoverBox) return;

        const textSize = 18;
        const margin = 1.05;
        const wMargin = 5;

        this.ctx.font = `${textSize}px Arial`;
        const width = this.hoverBox.lines.reduce((max, cur) =>
            Math.max(max, this.ctx.measureText(cur).width), -Infinity) + wMargin * 2;
        const height = textSize * margin * this.hoverBox.lines.length;

        this.ctx.fillStyle = "#bbb";
        this.ctx.strokeStyle = "#000";
        this.ctx.fillRect(this.hoverBox.x, this.hoverBox.y, width, height);
        this.ctx.strokeRect(this.hoverBox.x, this.hoverBox.y, width, height);

        this.ctx.fillStyle = "#000";
        this.ctx.textBaseline = "top";
        this.ctx.textAlign = "left";
        let drawY = this.hoverBox.y + (textSize * margin - textSize) / 2;
        for (const text of this.hoverBox.lines) {
            this.ctx.fillText(text, this.hoverBox.x + wMargin, drawY);
            // ctx.strokeText(text, this.hoverBox.x + wMargin, drawY);
            drawY += textSize * margin;
        }
    }
    calculatePieces(pieces, total, startAng, endAng, inrRad, outrRad, colLight = 0.5) { // recursive
        pieces.sort((a,b)=>b.total-a.total);

        let sa = startAng,
            ea = startAng;
        for (const cur of pieces) {
            sa = ea;
            const percent = cur.total / total;
            ea = sa + (endAng - startAng) * percent;
            cur.startAngle = sa;
            cur.endAngle = ea;
            cur.innerRadius = inrRad;
            cur.outerRadius = outrRad;
            cur.percent = percent;

            if (!cur.name) continue;

            const color = hsl((sa+0.5*Math.PI) / (2*Math.PI), 1, colLight);
            cur.color = color;

            const midAngle = (sa + ea)/2;
            let midRad = (inrRad + outrRad)/2;
            const textX = Math.cos(midAngle)*midRad;
            const textY = Math.sin(midAngle)*midRad;
            let drawAngle = (midAngle + Math.PI*2) % (Math.PI*2);
            if (drawAngle > 0.5*Math.PI && drawAngle < 1.5*Math.PI)
                drawAngle += Math.PI;
            this.texts.push([cur.name, textX, textY, drawAngle, textX, textY]);

            const newOuterRad = Math.sqrt(2*outrRad**2-inrRad**2);

            if (Array.isArray(cur.children))
                this.calculatePieces(cur.children, cur.total, sa, ea, outrRad, newOuterRad, colLight * 0.8);
        }
    }
}

const drawSector = (ctx, x, y, innerRadius, outerRadius, startAngle, endAngle) => {
    const startX = Math.cos(startAngle);
    const startY = Math.sin(startAngle);
    const endX = Math.cos(endAngle);
    const endY = Math.sin(endAngle);
    ctx.moveTo(x+startX*innerRadius, y+startY*innerRadius);
    ctx.lineTo(x+startX*outerRadius, y+startY*outerRadius);
    ctx.arc(x, y, outerRadius, startAngle, endAngle);
    ctx.lineTo(x+endX*innerRadius, y+endY*innerRadius);
    ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
};
