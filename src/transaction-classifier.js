import {addRules} from "./rules.js";
import HierarchalPieGraph from "./HierarchalPieGraph.js";

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

document.addEventListener("DOMContentLoaded", event => {
    let transactionInput = document.querySelector("#transaction-input");
    transactionInput.addEventListener("change", transactionInputChange);

    fetch("./example-graph.json").then(res => {
        res.json().then(encoded => {
            const root = decodeGraph(encoded);
            makeGraph(root, "Example");
        });
    });
});

const transactionInputChange = event => {
    const file = event.target.files[0];
    let reader = new FileReader();
    reader.onload = event => {
        const textContent = event.target.result;
        const csv = textContent.trim();
        let transactions = csv.split("\n").map(line=>line.split(","));
        let headers = transactions.shift();
        let fieldIndices = {};
        for (let i = 0; i < headers.length; ++i) {
            let header = headers[i];
            fieldIndices[header] = i;
        }
        const dateField = fieldIndices["Transaction Date"];
        const descField = fieldIndices["Description"];
        const amountField = fieldIndices["Amount"];
        transactions = transactions.map(t => ({
            date: t[dateField],
            desc: t[descField],
            amount: t[amountField]
        }));
        const {root, income} = labelTransactions(transactions);

        makeGraph(root, "All Transactions");
        makeGraph(income, "Income");

        for (const t of transactions) {
            let [m,d,y] = t.date.split("/");
            t.timestamp = +new Date(y,m-1,d);
            t.year = +y;
            t.quarter = (m - 1) / 3 | 0;
        }
        const minDateT = transactions.reduce((cur,min) =>
            cur.timestamp < min.timestamp ? cur : min);
        let {year, quarter} = minDateT;
        const filterQuarter = () =>
            transactions.filter(t => t.year == year && t.quarter == quarter);
        let curQuarter = filterQuarter();
        while (curQuarter.length) {
            const {root} = labelTransactions(curQuarter);
            makeGraph(root, `${year} Q${quarter + 1}`);
            year += quarter == 3;
            quarter = (quarter + 1) % 4;
            curQuarter = filterQuarter();
        }

        year = minDateT.year;
        const filterYear = () =>
            transactions.filter(t => t.year == year);
        for (let curYear = filterYear(); curYear.length;) {
            const {root} = labelTransactions(curYear);
            makeGraph(root, `${year}`);
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
            elm.textContent = transaction.join(",");
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
    console.log("ignored:", ignored);
    const income = categories.get("Income");
    categories.delete("Income");
    console.log("income:", income);

    const consolidate = (map) => { // recursive
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
    let incomeRoot = consolidate(new Map([["income", income]]))[0];
    console.log(JSON.stringify(encodeGraph(root)));
    console.log("total:", root.total);
    console.log("root:", root);
    console.log("no matching transactions:", classifiers.filter(c => !c.transactions));
    return {root, income: incomeRoot};
};

const makeGraph = (root, title) => {
    let graph = new HierarchalPieGraph(root, title, canvasSize);
    graphs.push(graph);
    document.body.appendChild(graph.canvas);
    return graph;
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
addRules(addClassifier);
