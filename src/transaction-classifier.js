import("./rules.js").then(mod => {
    mod.addRules(addClassifier);
}).catch(err => {
    console.log(err);
});
import HierarchalPieGraph from "./HierarchalPieGraph.js";
import FlowGraph from "./FlowGraph.js";

const dateToMDY = (n, sep = "/") => {
    const d = new Date(n);
    return d.getMonth() + 1 + sep + d.getDate() + sep + d.getFullYear();
};

const canvasSize = {x: 600, y: 600};
const graphs = [];
let textInp = document.querySelector("#transaction-input");
let unlabeledDiv = document.querySelector("#unlabled");
let classifiers = [];

const loop = () => {
    for (const graph of graphs) {
        graph.update();
    }
    requestAnimationFrame(loop);
};
loop();

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
            t.date = t.cols[dateField],
            t.desc = t.cols[descField],
            t.amount = t.cols[amountField]
        });

        // const {root, income} = labelTransactions(transactions);
        // makeFlowGraph({root, income}, "All Transactions");

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

        // let animDate = minDateT.timestamp;
        // const animate = () => {
        //     for (const graph of graphs) document.body.removeChild(graph.canvas);
        //     while (graphs.pop());
        //     const endDate = animDate + 1000 * 60 * 60 * 24 * 365.25;
        //     let curTrans = filterCustom(animDate, endDate);
        //     animDate += 1000 * 60 * 60 * 24;
        //     const {root, income} = labelTransactions(curTrans);
        //     makeFlowGraph({root, income}, `${dateToMDY(animDate)} to ${dateToMDY(endDate)}`);
        //     //setTimeout(animate, 50);
        // };
        // animate();


        
        let {year, quarter} = minDateT;
        console.log("minDate:", minDateT, "year " + year, "quarter " + quarter)
        const filterQuarter = () =>
            transactions.filter(t => t.year == year && t.quarter == quarter);
        let curQuarter = filterQuarter();
        while (curQuarter.length) {
            const {root, income} = labelTransactions(curQuarter);
            makeFlowGraph({root, income}, `${year} Q${quarter + 1}`);
            year += quarter == 3;
            quarter = (quarter + 1) % 4;
            curQuarter = filterQuarter();
        }

        year = minDateT.year;
        const filterYear = () =>
            transactions.filter(t => t.year == year);
        for (let curYear = filterYear(); curYear.length;) {
            const {root, income} = labelTransactions(curYear);
            makeFlowGraph({root, income}, `${year}`);
            year++;
            curYear = filterYear();
        }
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
    // console.log("ignored:", ignored);
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
    // console.log(JSON.stringify(encodeGraph(root)));
    // console.log("total:", root.total);
    console.log("no matching transactions:", classifiers.filter(c => !c.transactions));
    return {root, income: incomeRoot};
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
    console.log(layers);

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
