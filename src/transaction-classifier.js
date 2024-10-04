import("./rules.js").then(mod => {
    mod.addRules(addClassifier);
}).catch(err => {
    console.log(err);
});
import HierarchalPieGraph from "./HierarchalPieGraph.js";
import FlowGraph from "./FlowGraph.js";

const dateValToMDY = (n, sep = "/") => {
    const d = new Date(n);
    return d.getMonth() + 1 + sep + d.getDate() + sep + d.getFullYear();
};
const mdyToDate = (mdy, sep = "/") => {
    let [m,d,y] = mdy.split(sep);
    return new Date(y,m-1,d);
};

const canvasSize = {x: 600, y: 600};
const graphs = [];
let textInp = document.querySelector("#transaction-input");
let unlabeledDiv = document.querySelector("#unlabeled");
let classifiers = [];

const updateloop = () => {
    for (const graph of graphs) {
        graph.update();
    }
    requestAnimationFrame(updateloop);
};
updateloop();

const transactionInputChange = event => {
    const file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = event => {
        const textContent = event.target.result;
        const csv = textContent.trim();
        let transactions = csv.split("\n").map(line => ({
            cols: line.split(","),
            source: line
        }));
        let headers = transactions.shift().cols;
        let fieldIndices = {};
        for (let i = 0; i < headers.length; ++i) {
            let header = headers[i];
            fieldIndices[header] = i;
        }
        const dateField = fieldIndices["Transaction Date"];
        const descField = fieldIndices["Description"];
        const amountField = fieldIndices["Amount"];
        transactions.forEach(t => {
            t.date = t.cols[dateField];
            t.desc = t.cols[descField];
            t.amount = +t.cols[amountField];
        });

        // Stats:
        let statsElm = document.querySelector("#transaction-stats");
        statsElm.innerText = `${transactions.length} total transactions.\n`;
        let uniqueDescs = [...new Set(transactions.map(t => t.desc))];
        statsElm.innerText += `${uniqueDescs.length} unique descriptions`;

        // All time ignored:
        // let layers = [];
        // fillLayers(ignored, layers);
        // let graph = new FlowGraph(layers, "All Time Ignored", {x: 1000, y: 600});
        // graphs.push(graph);
        // document.body.appendChild(graph.canvas);

        for (const t of transactions) {
            let [m,d,y] = t.date.split("/");
            if (!/\d\d?\/\d\d?\/\d{4}/.test(t.date))
                console.error("invalid date: ", t.date);
            t.timestamp = +new Date(y,m-1,d);
            t.year = +y;
            t.quarter = (m - 1) / 3 | 0;
            t.month = +m;
            t.day = +d;
        }
        const filterCustom = (start, end) =>
            transactions.filter(t => t.timestamp >= start && t.timestamp < end);

        
        const minDateT = transactions.reduce((cur,min) =>
            cur.timestamp < min.timestamp ? cur : min);
        const maxDateT = transactions.reduce((cur,max) =>
            cur.timestamp > max.timestamp ? cur : max);
        const filterTransactions = (year, q) =>
            transactions.filter(t =>
                (!year || t.year == year) && (!(q+1) || t.quarter == q));
        
        // Make options:
        let options = "";
        const addOption = (value, text) =>
            (options += `<option value="${value}">${text}</option>\n`);
        let year = minDateT.year, quarter = minDateT.quarter;
        while (year < maxDateT.year || quarter <= maxDateT.quarter) {
            addOption(`${year},${quarter}`, `${year} Q${quarter + 1}`);
            if (year == maxDateT.year && quarter == maxDateT.quarter)
                addOption(year, `${year} Ending ${maxDateT.month}/${maxDateT.day}`);
            if (quarter == 3)
                addOption(year, year);
            year += quarter == 3;
            quarter = (quarter + 1) % 4;
        }
        options += `<option value="all">All Time</option>`;
        options = options.split("\n").reverse().join("\n");

        // Make Settings
        let settingsDiv = document.createElement("div");
        settingsDiv.innerHTML = `
            <label for="period">Choose a time period:</label>
            <select id="period">${options}</select>`;
        document.body.appendChild(settingsDiv);
        const periodSelect = document.querySelector("#period");
        periodSelect.addEventListener("change", ({target: {value}}) => {
            while (graphs.length) document.body.removeChild(graphs.pop().canvas);

            let split = value.split(",").map(s => +s);
            let title = value == "all" ? "All Time" :
            split[0] + ((split[1] + 1) ? " Q" + (split[1] + 1) : "");
            let filtered = filterTransactions(split[0], split[1]);
            const {root, income, ignored} = labelTransactions(filtered);
            makeFlowGraph({root, income}, title);
            makeHPieGraph(root, title);
        });

        // Remove examples:
        while (graphs.length) document.body.removeChild(graphs.pop().canvas);

        // All time Flow:
        const {root, income, ignored} = labelTransactions(transactions);
        makeFlowGraph({root, income}, "All Time");
        // HPie:
        makeHPieGraph(root, "All Time");

        // Account Balances:
        transactions = transactions.filter(t => !t.desc.includes("Sweep"));
        let accounts = new Map();
        for (const t of transactions) {
            const accountName = t.cols[0];
            let account = accounts.get(accountName);
            if (!account) accounts.set(accountName, account = {
                transactions: [],
                dailyChange: new Map()
            });
            account.transactions.push(t);
            let date = t.cols[2] || t.cols[1];
            let [m,d,y] = date.split("/");
            let timestamp = +new Date(y,m-1,d);
            let bal = account.dailyChange.get(timestamp) || 0;
            account.dailyChange.set(timestamp, bal + t.amount);
        }
        for (const [accountName, account] of accounts.entries()) {
            let {dailyChange} = account;
            const stamps = Array.from(dailyChange.keys());
            const dailyChangeEntries = Array.from(dailyChange.entries());
            const minStamp = stamps.reduce((min, cur) => cur < min ? cur : min, Infinity);
            const maxStamp = stamps.reduce((max, cur) => cur > max ? cur : max, -Infinity);
            let dailyBalance = account.dailyBalance = [];
            const msDay = 1000 * 60 * 60 * 24;
            let i = 0;
            let prevBal = 0;
            dailyChangeEntries.sort(([stampA], [stampB]) => stampA - stampB);
            console.log(accountName, "dailyChangeEntries:", dailyChangeEntries);
            console.log(accountName, "transactions:", accounts.get(accountName).transactions);
            for (const [stamp, change] of dailyChangeEntries) {
                let stampI = Math.round((stamp - minStamp) / msDay) + 1; // + 1 to skip 0th slot
                for (; i < stampI; ++i) dailyBalance[i] = prevBal;
                dailyBalance[stampI] = prevBal += change;
            }
            let minBal = dailyBalance.reduce((min, cur) => cur < min ? cur : min, Infinity);
            let maxBal = dailyBalance.reduce((max, cur) => cur > max ? cur : max, -Infinity);
            const balDiff = maxBal - minBal;
            if (!accountName.includes("Credit") && minBal < 0) {
                for (let i = 0; i < dailyBalance.length; ++i)
                    dailyBalance[i] -= minBal;
                minBal -= minBal;
                maxBal -= minBal;
            }

            let dataPoints = [];
            for (let i = 0, len = dailyBalance.length; i < len; ++i) {
                const bal = dailyBalance[i];
                const y = (bal - minBal) / balDiff;
                dataPoints.push({x: i / len, y});
            }
            
            // Drawing setup
            let canvas = document.createElement("canvas");
            canvas.width = 500;
            canvas.height = 400;
            let ctx = canvas.getContext("2d");
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            
            // Data line:
            ctx.beginPath();
            ctx.strokeStyle = "orange";
            ctx.moveTo(dataPoints[0].x, dataPoints[0].y);
            for (let i = 1; i < dataPoints.length; ++i) {
                const point = dataPoints[i];
                ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
            }
            ctx.stroke();

            // Y baseline:
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "white";
            const y0 = (0 - minBal) / balDiff;
            ctx.moveTo(0, y0 * canvas.height);
            ctx.lineTo(1 * canvas.width, y0 * canvas.height);
            ctx.stroke();

            ctx.restore();
            // Draw Title:
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Ubuntu";
            ctx.fillText(accountName, canvas.width / 4, 20);
            ctx.fillText(`min bal: ${minBal | 0}, max bal: ${maxBal | 0}`, canvas.width / 4, 40);
            ctx.fillText(`first transaction date: ${dateValToMDY(minStamp)}`, canvas.width / 4, 60);
            ctx.fillText(`last transaction date: ${dateValToMDY(maxStamp)}`, canvas.width / 4, 80);

            document.body.appendChild(canvas);
        }
    };
    reader.readAsText(file);
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
    sector.children = sector.children?.map(decodeGraph);
    return sector;
};

const labelTransactions = transactions => {
    let categories = new Map();

    classifiers.sort((a,b) => b.unique.length - a.unique.length);

    for (const transaction of transactions) {
        const {date, desc, amount} = transaction;

        const [label, classifier] = labelTransaction(date, desc, amount);
        if (!classifier.transactions) classifier.transactions = [];
        classifier.transactions.push(transaction);
        transaction.classifier = classifier;
        const labels = label.split("/");
        transaction.labels = labels;
        const category = labels[0];

        if (!category) {
            let elm = document.createElement("pre");
            elm.textContent = transaction.source;
            unlabeledDiv.appendChild(elm);
            unlabeledDiv.style.display = "block";
        }

        let curCategory = categories;
        for (const label of labels) {
            if (!curCategory.has(label))
                curCategory.set(label, new Map());
            curCategory = curCategory.get(label);
        }
        if (!curCategory.transactions) curCategory.transactions = [];
        curCategory.transactions.push(transaction);
    }
    // let labeledCSV = transactions.map(row => row.join(",")).join("\n");

    const ignored = categories.get("Ignored");
    categories.delete("Ignored");
    console.log("ignored:", ignored);
    const income = categories.get("Income");
    categories.delete("Income");
    console.log("income:", income);

    const consolidate = (map) => { // recursive
        if (!map) return [];
        return Array.from(map.entries()).map(([name, val]) => {
            let children = consolidate(val);
            if (!children.length) children = null;
            const transactions = val.transactions;
            const transactionsTotal =
                (transactions || []).reduce((sum,c)=>sum+(-c.amount),0);
            const childrenTotal =
                (children || []).reduce((sum, c) => sum + c.total, 0);
            const total = Math.abs(transactionsTotal + childrenTotal);
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
    let incomeRoot = consolidate(new Map([["Income", income]]))[0];
    let ignoredRoot = consolidate(new Map([["Ignored", ignored]]))[0];
    // console.log(JSON.stringify(encodeGraph(root)));
    // console.log("total:", root.total);
    console.log("no matching transactions:", classifiers.filter(c => !c.transactions));
    return {root, income: incomeRoot, ignored: ignoredRoot};
};

const makeHPieGraph = (root, title) => {
    let graph = new HierarchalPieGraph(root, title, canvasSize);
    graphs.push(graph);
    console.log(title + " root:", graph.root);
    document.body.appendChild(graph.canvas);
    return graph;
};
const makeFlowGraph = ({root, income}, title) => {
    let layers = [];
    fillLayers(income, layers);
    for (const col of layers)
        for (const piece of col) {
            [piece.left, piece.right] = [piece.right, piece.left];
            piece.color = "#285";
        }
    layers.reverse();
    const incomeLayersLen = layers.length;

    
    income.right = [{vOffset: 0, piece: root}];
    root.left = [{vOffset: 0, piece: income}];
    root.name = "Spending";
    root.color = "#900";
    fillLayers(root, layers, layers.length);
    console.log("Flow layers", layers);

    const deficit = income.total - root.total;
    if (deficit > 0) {
        let savings = {
            name: "Savings",
            total: deficit,
            left: [{vOffset: 0, piece: income}],
            color: "#090"
        };
        income.right.push({vOffset: 1 - deficit / income.total, piece: savings});
        layers[incomeLayersLen].push(savings);
    } else if (deficit < 0) {
        let savings = {
            name: "From Savings",
            total: -deficit,
            right: [{vOffset: 0, piece: root}],
            color: "#900"
        };
        root.left.push({vOffset: 1 - -deficit / root.total, piece: savings});
        layers[incomeLayersLen - 1].push(savings);
    }

    let graph = new FlowGraph(layers, title, {x: 1000, y: 600});
    graphs.push(graph);
    document.body.appendChild(graph.canvas);
    return graph;
};
const fillLayers = (root, layers, index = 0) => { // recursive
    if (!layers[index]) layers[index] = [];
    layers[index++].push(root);
    if (root.children) {
        root.children.sort((a, b) => b.total - a.total);
        for (const child of root.children) {
            fillLayers(child, layers, index);
            let vOffset = 0;
            root.right = root.children.map(c => {
                let wrapper = {vOffset, piece: c};
                vOffset += c.total / root.total;
                return wrapper;
            });
            child.left = [{vOffset: 0, piece: root}];
        }
    }
};

const labelTransaction = (date, desc, amount) => {
    for (const classifier of classifiers) {
        let label = classifier(date, desc, amount);
        if (label) return [label, classifier];
    }
    return ["", ()=>{}];
};

const addClassifier = (type, uniques, label) => {
    if (!Array.isArray(uniques)) uniques = [uniques];
    for (const unique of uniques) {
        let classifier = switchClassifier(type, unique, label);
        classifier.type = type;
        classifier.unique = unique.toString();
        classifier.label = label;
        classifiers.push(classifier);
    }
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

const makeExample = event => {
    let transactionInput = document.querySelector("#transaction-input");
    transactionInput.addEventListener("change", transactionInputChange);

    fetch("./example-graph.json").then(res => {
        res.json().then(encoded => {
            const root = decodeGraph(encoded);
            makeHPieGraph(root, "Example");
        });
    });
};

if (document.readyState !== "loading") makeExample();
else document.addEventListener("DOMContentLoaded", makeExample);
