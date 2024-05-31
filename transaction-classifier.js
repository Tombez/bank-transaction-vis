// replace: "POS Debit - Visa Check Card 1123 - "
// replace: "SQ *"
// replace: "SQ "
// replace: "TST* "
// replace: "TST "
// replace: "PLUS DEBIT "
// replace: "Payment to "
// replace: "ACH Transaction - "

import {addRules} from "./rules.js";

document.addEventListener("DOMContentLoaded", event => {
    let transactionInput = document.querySelector("#transaction-input");
    transactionInput.addEventListener("change", transactionInputChange);

    fetch("./example-graph.json").then(res => {
        res.json().then(encoded => {
            const root = decodeGraph(encoded);
            makeGraph(root);
        });
    });
});

const transactionInputChange = event => {
    const file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = event => {
        const root = processFile(event.target.result);
        makeGraph(root);
    };
    reader.readAsBinaryString(file);
};

const encodeGraph = root => {
    let copy = [
        root.name,
        +(root.total.toFixed(2)),
        root.numTransactions
    ];
    if (root.children) copy.push(root.children.map(encodeGraph));
    return copy;
};
const decodeGraph = array => {
    let sector = {
        name: array.shift(),
        total: array.shift(),
        numTransactions: array.shift(),
        children: array.shift()
    };
    if (sector.children) sector.children = sector.children.map(decodeGraph);
    return sector;
};

const hsl = (h, s=1, l=0.5) => ({
    h: h, s: s, l: l, toString:
        function(){return `hsl(${this.h*360|0},${this.s*100|0}%,${this.l*100|0}%)`}
});

let textInp = document.querySelector("#transaction-input");
let enterBtn = document.querySelector("#submit");
let unlabeledDiv = document.querySelector("#unlabled");
let classifiers = [];
let categories = new Map();

const processFile = textContent => {
    const csv = textContent.trim();
    let transactions = csv.split("\n").map(line=>line.split(","));
    let headers = transactions[0];
    let fieldIndices = {};
    for (let i = 0; i < headers.length; ++i) {
        let header = headers[i];
        fieldIndices[header] = i;
    }
    let dateField = fieldIndices["Transaction Date"];
    let descField = fieldIndices["Description"];
    let amountField = fieldIndices["Amount"];
    let categoryField = fieldIndices["Category"];
    let subCatField = fieldIndices["Sub Category"];
    let terCatField = fieldIndices["Tertiary Category"];

    classifiers.sort((a,b) => b.unique.length - a.unique.length);

    for (let i = 1; i < transactions.length; i++) {
        const transaction = transactions[i];
        const date = transaction[dateField];
        const description = transaction[descField];
        const amount = transaction[amountField];

        const [label, classifier] = labelTransaction(date, description, amount);
        if (!classifier.transactions) classifier.transactions = [];
        classifier.transactions.push(transaction);
        transaction.classifier = classifier;
        const labels = label.split("/");
        const category = labels[0];

        if (!category) {
            let elm = document.createElement("pre");
            elm.textContent = transaction.join(",");
            unlabeledDiv.appendChild(elm);
        }

        transaction[categoryField] = category;
        transaction[subCatField] = labels[1] || "";
        transaction[terCatField] = labels[2] || "";

        let curCategory = categories;
        for (let i = 0; i < labels.length; ++i) {
            const label = labels[i];

            if (!curCategory.has(label))
                curCategory.set(label, new Map());
            curCategory = curCategory.get(label);
        }
        if (!curCategory.transactions) curCategory.transactions = [];
        curCategory.transactions.push(transaction);
    }
    let labeledCSV = transactions.map(row => row.join(",")).join("\n");

    const ignored = categories.get("Ignored");
    categories.delete("Ignored");
    console.log("ignored:", ignored);
    const income = categories.get("Income");
    categories.delete("Income");
    console.log("income:", income);

    const consolidate = (map) => {
        return Array.from(map.entries()).map(([name, val]) => {
            let children = consolidate(val);
            if (!children.length) children = null;
            const transactions = val.transactions;
            const transactionsTotal =
                (transactions || []).reduce((sum,c)=>sum+(-c[amountField]),0);
            const childrenTotal =
                (children || []).reduce((sum, c) => sum + c.total, 0);
            const total = transactionsTotal + childrenTotal;
            const numTransactions = (transactions ? transactions.length : 0) +
                (children || []).reduce((sum, c) => sum + c.numTransactions, 0);
            return ({
                name,
                total,
                children,
                transactions,
                numTransactions,
                transactionsTotal,
                childrenTotal
            });
        });
    };
    let root = consolidate(new Map([["root", categories]]))[0];
    console.log(JSON.stringify(encodeGraph(root)));
    console.log("total:", root.total);
    console.log("root:", root);
    console.log("no matching transactions:", classifiers.filter(c => !c.transactions));
    return root;
};

const makeGraph = root => {
    const outerRadius = 400;
    const innerRadius = 50;
    let canvas = document.querySelector("#canvas");
    let ctx = canvas.getContext("2d");

    const drawBar = (x, y, innerRadius, outerRadius, startAngle, endAngle) => {
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
    const radius = (outerRadius-innerRadius)/3+innerRadius;

    let texts = [];
    let mouse = {x: 0, y: 0};
    let hoverBox = null;

    const textCollisions = () => {
        for (let i = 0; i < texts.length; ++i) {
            for (let j = i + 1; j < texts.length; j++) {
                const a = texts[i], b = texts[j];
                const difX = a[4]-b[4];
                const difY = a[5]-b[5];
                if (difX**2+difY**2<20**2) {
                    a[4] += difX/100;
                    a[5] += difY/100;
                    b[4] -= difX/100;
                    b[5] -= difY/100;
                    a[4] += a[4] / 400;
                    a[5] += a[5] / 400;
                    b[4] += b[4] / 400;
                    b[5] += b[5] / 400;
                }
            }
        }
    };
    const whichSector = (angle, radius, sectors) => {
        if (!sectors) return null;
        for (const sector of sectors) {
            if (radius < sector.innerRadius) return null;
            if (angle >= sector.startAngle && angle < sector.endAngle) {
                if (radius < sector.outerRadius) return sector;
                return whichSector(angle, radius, sector.children);
            }
        }
        return null;
    };
    const checkHover = (pieces, mouse) => {
        let mAngle = Math.atan2(mouse.y, mouse.x);
        if (mAngle < -0.5*Math.PI) mAngle += 2*Math.PI;
        const mRadius = Math.hypot(mouse.x, mouse.y);
        let hoverSector = whichSector(mAngle, mRadius, pieces);
        if (!hoverSector) {
            hoverBox = null;
            return;
        }
        hoverBox = {
            x: mouse.x + 10,
            y: mouse.y + 10,
            lines: [
                `Name: ${hoverSector.name}`,
                `Percent: ${(hoverSector.percent*100).toFixed(2)}%`,
                `Total: $${hoverSector.total.toFixed(2)}`,
                `${hoverSector.numTransactions} total transactions`,
                `${hoverSector.transactions?.length||0} own transactions`
            ]
        };
    };
    const loop = () => {
        calculate();
        draw(root.children, root.total);
        requestAnimationFrame(loop);
    };
    const calculate = () => {
        checkHover(root.children, mouse);
        textCollisions();
    };
    const draw = (pieces, total) => {
        ctx.save();

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.translate(canvas.width/2, canvas.height/2);

        drawPieces(pieces);
        drawText();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Total`, 0, 0);
        ctx.textBaseline = "top";
        ctx.fillText(`$${total | 0}`, 0, 0);

        drawHoverBox();
        ctx.restore();
    };
    const drawPieces = (pieces) => {
        for (const cur of pieces) {
            if (!cur.name) continue;

            ctx.beginPath();
            ctx.fillStyle = cur.color;
            ctx.strokeStyle = "#fff";
            drawBar(0, 0, cur.innerRadius, cur.outerRadius, cur.startAngle, cur.endAngle);
            ctx.fill();
            ctx.stroke();

            if (cur.children) drawPieces(cur.children);
        }
    };
    const drawText = () => {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let [text, ox, oy, ang, dx, dy] of texts) {
            ctx.font = "bold 22px Arial";

            ctx.beginPath();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#000";
            ctx.moveTo(ox, oy);
            ctx.lineTo(dx, dy);
            ctx.stroke();

            ctx.lineWidth = 1;
            ctx.strokeStyle = "#fff";
            ctx.stroke();

            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(ang);
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = "#000";
            ctx.fillText(text, 0, 0);
            ctx.strokeText(text, 0, 0);

            ctx.restore();
        }
    };
    const drawHoverBox = () => {
        if (!hoverBox) return;

        const textSize = 18;
        const margin = 1.05;
        const wMargin = 5;

        ctx.font = `${textSize}px Arial`;
        const width = hoverBox.lines.reduce((max, cur) =>
            Math.max(max, ctx.measureText(cur).width), -Infinity) + wMargin * 2;
        const height = textSize * margin * hoverBox.lines.length;

        ctx.fillStyle = "#bbb";
        ctx.strokeStyle = "#000";
        ctx.fillRect(hoverBox.x, hoverBox.y, width, height);
        ctx.strokeRect(hoverBox.x, hoverBox.y, width, height);

        ctx.fillStyle = "#000";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        let drawY = hoverBox.y + (textSize * margin - textSize) / 2;
        for (const text of hoverBox.lines) {
            ctx.fillText(text, hoverBox.x + wMargin, drawY);
            // ctx.strokeText(text, hoverBox.x + wMargin, drawY);
            drawY += textSize * margin;
        }
    };

    const calculatePieces = (pieces, total, startAng, endAng, inrRad, outrRad, colLight = 0.5) => {
        pieces.sort((a,b)=>b.total-a.total);

        let sa = 0;
        let ea = startAng;
        for (const cur of pieces) {
            sa = ea;
            const percent = cur.total/total;
            ea = sa + (endAng-startAng)*percent;
            cur.startAngle = sa;
            cur.endAngle = ea;
            cur.innerRadius = inrRad;
            cur.outerRadius = outrRad;
            cur.percent = percent;

            if (!cur.name) continue;

            const color = hsl((sa+0.5*Math.PI)/(2*Math.PI), 1, colLight);
            cur.color = color;

            const midAngle = (sa + ea)/2;
            let midRad = (inrRad + outrRad)/2;
            const textX = Math.cos(midAngle)*midRad;
            const textY = Math.sin(midAngle)*midRad;
            let drawAngle = (midAngle + Math.PI*2) % (Math.PI*2);
            if (drawAngle > 0.5*Math.PI && drawAngle < 1.5*Math.PI)
                drawAngle += Math.PI;
            texts.push([cur.name, textX, textY, drawAngle, textX, textY]);

            const newOuterRad = Math.sqrt(2*outrRad**2-inrRad**2);

            if (Array.isArray(cur.children))
                calculatePieces(cur.children, cur.total, sa, ea, outrRad, newOuterRad, colLight * 0.8);
        }
    };
    calculatePieces(root.children, root.total, -0.5*Math.PI, 1.5*Math.PI, innerRadius, radius);
    loop();

    let dragging = null;
    canvas.addEventListener("mousedown", event => {
        const x = mouse.x = event.offsetX - event.target.width/2;
        const y = mouse.y = event.offsetY - event.target.height/2;

        // let mAngle = Math.atan2(mouse.y, mouse.x);
        // if (mAngle < -0.5*Math.PI) mAngle += 2*Math.PI;
        // const mRadius = Math.hypot(mouse.x, mouse.y);
        // let hoverSector = whichSector(mAngle, mRadius, root.children);
        // if (hoverSector) {
        //     root = hoverSector;
        //     texts = [];
        //     calculatePieces(root.children, root.total, -0.5*Math.PI, 1.5*Math.PI, innerRadius, radius);
        // }

        const [minText, minDist] = texts.reduce(([minText, min], text) => {
            const tx = text[4];
            const ty = text[5];

            const difX = x-tx;
            const difY = y-ty;
            const distSq = difX**2+difY**2;
            return distSq < min ? [text, distSq] : [minText, min];
        }, [null, Infinity]);
        if (minDist<20**2) dragging = minText;
    });
    canvas.addEventListener("mouseup", event => {
        dragging = null;
    });
    canvas.addEventListener("mousemove", event => {
        mouse.x = event.offsetX - event.target.width/2;
        mouse.y = event.offsetY - event.target.height/2;
        if (dragging) {
            dragging[4] = mouse.x;
            dragging[5] = mouse.y;
        }
    });
}

const labelTransaction = (date, desc, amount) => {
    for (const classifier of classifiers) {
        let label = classifier(date, desc, amount);
        if (label) return [label, classifier];
    }
    return ["", ()=>{}];
};

const addClassifier = (type, unique, label) => {
    let classifier = switchClassifier(type, unique, label);
    classifier.type = type;
    classifier.unique = unique.toString();
    classifier.label = label;
    classifiers.push(classifier);
};
const switchClassifier = (type, unique, label) => {
    switch(type) {
        case "exact":
            return (date,desc,amount) => desc == unique && label;
        case "starts":
            return (date,desc,amount) => desc.startsWith(unique) && label;
        case "has":
            return (date,desc,amount) => desc.includes(unique) && label;
        case "custom":
            return (date,desc,amount) => unique(date,desc,amount) && label;
        default:
            throw new TypeError(`Unknown type "${type}"`);
    }
};
addRules(addClassifier);
