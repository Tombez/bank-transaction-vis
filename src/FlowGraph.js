export default class FlowGraph {
    constructor(layers, title, canvasSize) {
        this.layers = layers;
        this.title = title;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");

        this.canvas.width = canvasSize.x;
        this.canvas.height = canvasSize.y;
        this.verticalPad = 10;
        this.barWidth = 20;
        this.horizontalPad = 100;

        this.mouse = {x: 0, y: 0};
        this.attachListeners();

        this.calculatePieces(layers);
    }
    attachListeners() {
        this.canvas.addEventListener("mousedown", event => {
            const x = this.mouse.x = event.offsetX;
            const y = this.mouse.y = event.offsetY;

            console.log(this.closestPiece.transactions.map(t=>t.cols.join(",")).join("\n"));
        });
        this.canvas.addEventListener("mouseup", event => {
            
        });
        this.canvas.addEventListener("mousemove", event => {
            this.mouse.x = event.offsetX;
            this.mouse.y = event.offsetY;
        });
        this.canvas.addEventListener("mouseenter", event => {
            this.focused = true;
        });
        this.canvas.addEventListener("mouseout", event => {
            this.focused = false;
        });
    }
    calculatePieces(layers) {
        this.horizontalGap = (
            this.canvas.width - this.horizontalPad * 2 - layers.length * this.barWidth
        ) / (layers.length - 1);
        if (this.horizontalGap < 40)
            console.warning("horizontal gap is low: ", this.horizontalGap);

        let x = this.horizontalPad;
        for (const layer of layers) {
            layer.x = x;
            x += this.horizontalGap + this.barWidth;

            layer.total = layer.reduce((sum, p) => p.total + sum, 0);
            layer.possiblePixelsPer$ = (this.canvas.height - (layer.length + 1) * this.verticalPad) / layer.total;
            if (layer.possiblePixelsPer$ < 0) debugger;
        }
        this.rootLayer = layers.reduce((least, cur) =>
            cur.possiblePixelsPer$ < least.possiblePixelsPer$ ? cur : least);
        this.rootIndex = layers.indexOf(this.rootLayer);
        this.pixelsPerDollar = this.rootLayer.possiblePixelsPer$;

        for (const layer of layers) {
            const verticalPad = (
                this.canvas.height - layer.total * this.pixelsPerDollar
            ) / (layer.length + 1);
            let y = verticalPad;
            for (const piece of layer) {
                if (!piece.color) piece.color = "#258";
                piece.height = piece.total * this.pixelsPerDollar;
                piece.y = y;
                y += verticalPad + piece.height;
            }
        }
    }
    checkHover() {
        this.closestPiece = null;
        if (!this.focused) return;
        let leastDistSq = Infinity;
        for (const col of this.layers) {
            for (const piece of col) {
                let px = col.x + this.barWidth / 2;
                let py = piece.y + piece.height / 2;

                const distSq = (px - this.mouse.x)**2 + (py - this.mouse.y)**2;
                if (distSq < leastDistSq) {
                    leastDistSq = distSq;
                    this.closestPiece = piece;
                }
            }
        }
    }
    update() {
        this.checkHover();
        this.draw();
    }
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (const col of this.layers) {
            for (const piece of col) {
                ctx.fillStyle = piece.color;
                ctx.fillRect(col.x, piece.y, this.barWidth, piece.height);
            }
        }

        ctx.globalAlpha = 0.7;
        for (let i = 0; i+1 < this.layers.length; i++) {
            const col = this.layers[i];
            for (const left of col) {
                if (!left.right) continue;
                for (const {vOffset: rVOffset, piece: right} of left.right) {
                    const {vOffset} = right.left.find(o => o.piece == left);
                    const leftY = left.y + rVOffset * left.height;
                    const leftX = col.x + this.barWidth;
                    const rightY = right.y + vOffset * right.height;
                    const rightX = leftX + this.horizontalGap;
                    const height = Math.min(left.height, right.height);

                    const gradient = ctx.createLinearGradient(leftX, 0, rightX, 0);
                    gradient.addColorStop(0, left.color);
                    gradient.addColorStop(1, right.color);
                    ctx.fillStyle = gradient;

                    ctx.beginPath();
                    ctx.moveTo(leftX, leftY);
                    ctx.bezierCurveTo(
                        leftX + (rightX - leftX) * 0.3, leftY,
                        rightX - (rightX - leftX) * 0.3, rightY,
                        rightX, rightY);
                    ctx.lineTo(rightX, rightY + height);
                    ctx.bezierCurveTo(
                        rightX - (rightX - leftX) * 0.3, rightY + height,
                        leftX + (rightX - leftX) * 0.3, leftY + height,
                        leftX, leftY + height);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        for (const col of this.layers) {
            for (const piece of col) {
                // if (piece.height < 2) continue;
                const fontSize = piece == this.closestPiece ? 16 : 12;
                const drawX = col.x + this.barWidth / 2;
                const drawY = piece.y + piece.height / 2 - 1;
                const text = piece.name + " $" + Math.round(piece.total).toLocaleString();
                const pad = 3; // pixels

                ctx.font = `bold ${fontSize}px Arial`;
                const backdropW = ctx.measureText(text).width + pad * 2
                const backdropH = fontSize + pad * 2;;

                ctx.fillStyle = "black";
                ctx.globalAlpha = 0.5;
                ctx.fillRect(drawX - backdropW / 2, drawY - backdropH / 2, backdropW, backdropH);
                ctx.globalAlpha = 1;
                
                ctx.fillStyle = "#fff";
                ctx.fillText(text, drawX, drawY);
            }
        }

        ctx.font = "bold 18px Arial";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#fff";
        ctx.fillText(this.title, this.canvas.width / 2, 5);
    }
}