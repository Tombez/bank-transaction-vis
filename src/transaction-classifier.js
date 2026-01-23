import HierarchalPieGraph from "./graphs/HierarchalPieGraph.js";
import FlowGraph from "./graphs/FlowGraph.js";
import {Csv} from "./Csv.js";
import {dateToYmd} from "./date-utils.js";
import BarGraph from "./graphs/BarGraph.js";
import {ViewLineGraph} from "./graphs/ViewLineGraph.js";
import AccountBalancesGraph from './graphs/AccountBalancesGraph.js';
import {TransactionFile} from './TransactionFile.js';
import {Account} from './Account.js';
import {Bank} from './Bank.js';
import {TabBar} from './TabBar.js';
import TransactionViewer from './TransactionViewer.js';
Array.prototype.best = function(toScore = a => a, direction = "min") {
    if (!this.length) return null;
    const isBetter = "min" == direction ? (a, b) => a < b : (a, b) => a > b;
    let bestValue = "min" == direction ? Infinity : -Infinity;
    return this.reduce((best, cur) => {
        const curValue = toScore(cur);
        return isBetter(curValue, bestValue) ? 
            (bestValue = curValue, cur) : 
            best;
    }, bestValue);
};

const canvasSize = {x: 800, y: 800};
const graphs = [];
let textInp;
let unlabeledDiv;
let addBankBtn;
let exportBtn;
let classifiers = [];
let bankList = window.bankList = [];
let transactionTab = null;

const updateloop = () => {
    for (const graph of graphs) {
        if (graph.update) graph.update();
    }
    requestAnimationFrame(updateloop);
};
updateloop();

const removeGraphs = () => {
    for (let cur; cur = graphs.pop();) {
        cur = cur.node || cur.canvas || cur;
        cur.parentNode.removeChild(cur);
    }
};

const transactionInputChange = event => {
    for (const file of [...event.target.files]) {
        const isBtv = /\.btv$/.test(file.name);
        if (/^text\/(csv|plain)$/.test(file.type) || isBtv) {
            file.arrayBuffer = file.arrayBuffer();
            let reader = new FileReader();
            reader.onload = event => {
                const text = event.target.result;
                if (isBtv) {
                    readBtv(text);
                } else {
                    loadCsvFile(file, text);
                }
            };
            reader.readAsText(file);
        }
    }
    event.target.value = "";
};

const readBtv = (text) => {
    try {
        const btv = JSON.parse(text)
        const bankObjs = btv.banks;
        if (btv.classifiers.length) loadRules(btv.classifiers);
        for (const bankObj of bankObjs) {
            const bank = Bank.decode(bankObj);
            addBank(bank);
            bank.node.querySelector('.icon-collapse')?.click();
        }
        compileTransactions();
    } catch (error) {
        console.error(error);
        alert('Failed to read btv file, ' + error);
    }
};
const exportBtv = () => {
    const btvText = JSON.stringify({
        banks: bankList.map(b => b.encode()),
        classifiers: serializeClassifiers(classifiers)
    });
    const filename = 'transactions.btv';
    const blob = new Blob([btvText], {
        type: 'data:attachment/plain;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    // Append the link to the document body (necessary for Firefox).
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};
const loadRules = rules => {
    for (const rule of rules) loadRule(rule);
    console.log('classifiers', classifiers);
};
const loadRule = (rule, parentCategory) => {
    let category = rule.category;
    if (parentCategory)
        category = `${parentCategory}/${category}`;
    for (const typeName in rule.types) {
        const uniques = rule.types[typeName];
        addClassifier(typeName, uniques, category);
    }
    if (rule.subCategories)
        for (const subRule of rule.subCategories)
            loadRule(subRule, category);
};
const serializeClassifiers = (classifiers) => {
    let categories = new Map();
    for (const {type, unique, label} of classifiers) {
        let context = categories;
        const labels = label.split('/')
        for (let i = 0; i < labels.length; ++i) {
            const category = labels[i];
            let categoryObj = context.get(category);
            if (!categoryObj) {
                categoryObj = {category};
                context.set(category, categoryObj);
            }
            context = categoryObj;
            if (i + 1 < labels.length) {
                categoryObj.subCategories = context = new Map();
            }
        }
        if (!context.types) context.types = {};
        if (!context.types[type]) context.types[type] = [];
        context.types[type].push(unique);
    }
    const mapToArrayRecursive = map => {
        return Array.from(map.values()).map(item => {
            if (item.subCategories)
                item.subCategories = mapToArrayRecursive(item.subCategories);
            return item;
        });
    };
    return mapToArrayRecursive(categories);
};
const loadCsvFile = (file, text) => {
    const csv = new Csv(text);
    const firstFile = new TransactionFile(file, csv);
    let tranFiles = [];

    let accountNames = Account.searchTranFileForAccountNames(firstFile);
    if (accountNames.length > 1) {
        const accColIndex = Account.searchTranFileForAccountCol(firstFile);
        for (let i = 0; i < accountNames.length; ++i) {
            const accName = accountNames[i];
            const indices = new Array(csv.headings.length)
                .map((_,i) => i + (i >= accColIndex));
            const newCsv = csv.clone();
            newCsv.rows = newCsv.rows.filter(row => row[accColIndex] == accName);
            let name = accName;
            const match = file.name.match(/([^\.]+)((\.[a-z]+)*)/i);
            if (match) name = `${match[1]}-${accName}${match[2]}`;
            tranFiles.push(new TransactionFile({name}, newCsv));
        }
    }

    if (!tranFiles.length) tranFiles.push(firstFile);
    for (const tranFile of tranFiles)
        addTransactionFile(tranFile);

    compileTransactions();
};
const addBank = (bank) => {
    bankList.push(bank);
    const bankListDiv = document.querySelector('#bank-list');
    bankListDiv.appendChild(bank.node);
    bank.node.addEventListener('delete', event => {
        const index = bankList.findIndex(
            bank => bank.node === event.target);
        if (index > -1) {
            bankList.splice(index, 1);
        }
        compileTransactions();
    });
    bank.node.addEventListener('change', compileTransactions);
};
const createNewBank = () => {
    let newName = 'Default Bank';
    for (let i = 1; bankList.find(bank => bank.name == newName); ++i)
        newName = 'Default Bank ' + i;
    let bank = new Bank(newName);
    addBank(bank);
};
const addTransactionFile = (tranFile) => {
    let account;
    let bank = bankList.find(
        bank => account = bank.accounts.find(a => a.name == tranFile.name));
    if (!account && tranFile.csv.hasHeader) {
        // Identify account based on csv header
        const header = tranFile.csv.headings.join();
        bank = bankList.find(
            bank => account = bank.accounts.find(
                a => a.headerFormats.includes(header)));
    }
    if (!account) { // create new account
        account = new Account(tranFile.name);
        if (!bank) {
            bank = Bank.findFromFile(tranFile, bankList);
            if (!(bank instanceof Bank)) {
                // Create new bank
                bank = new Bank(bank);
                addBank(bank);
            }
        }
        bank.addAccount(account);
    }
    account.addTransactionFile(tranFile);
};
const compileTransactions = (filters = []) => {
    let transactions = [];
    for (const bank of bankList) {
        for (const account of bank.accounts) {
            account.transactions = [];
            for (const tranFile of account.transactionFiles) {
                if (!tranFile.isFullyFilled) continue;
                const fileTransactions = tranFile.getTransactions();
                for (const t of fileTransactions) {
                    transactions.push(t);
                    account.transactions.push(t);
                }
            }
        }
    }
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    removeGraphs();

    const tViewer = recreateTViewer(transactions);
    
    const accounts = bankList.map(bank => bank.accounts).flat();
    if (!accounts.length) return;

    loadTransactions(transactions);
    calculateDailyBalances(accounts);
    
    const stampRange = {
        min: accounts.best(({stampRange: {min}}) => min).stampRange.min,
        max: accounts.best(({stampRange: {max}}) => max, "max").stampRange.max
    };
    stampRange.diff = stampRange.max - stampRange.min;
    
    const balRange = {
        min: accounts.best(({balRange: {min}}) => min).balRange.min,
        max: accounts.best(({balRange: {max}}) => max, "max").balRange.max
    };
    balRange.diff = balRange.max - balRange.min;
    
    
    makeBalancesGraph(accounts, tViewer, stampRange, balRange);
    makeNetWorthGraph(accounts, stampRange, balRange);
};
const recreateTViewer = (transactions) => {
    const tranContainer = document.querySelector('#transactions');
    const oldViewer = tranContainer.querySelector('.transaction-viewer');
    if (oldViewer) oldViewer.parentNode.removeChild(oldViewer);
    let tViewer = new TransactionViewer(transactions);
    tranContainer.appendChild(tViewer.node);
    return tViewer;
};
const loadTransactions = (transactions) => {
    console.debug('transactions: ', transactions);
    
    transactions.forEach(t => {
        if (isNaN(t.amount)) debugger;
    });

    for (const t of transactions) {
        t.timestamp = +t.date;
        t.year = t.date.getFullYear();
        t.month = t.date.getMonth + 1;
        t.quarter = (t.month - 1) / 3 | 0;
        t.day = t.date.getDate();
    }
    const filterCustom = (start, end) =>
        transactions.filter(t => t.timestamp >= start && t.timestamp < end);
    
    const minDateT = transactions.best(({timestamp}) => timestamp);
    const maxDateT = transactions.best(({timestamp}) => timestamp, "max");
    const filterTransactions = (year, q = -1) =>
        transactions.filter(t =>
            (!year || t.year == year) && (!(q+1) || t.quarter == q));

    const addGraphForCategory = (category, title = category, invert = false) => {
        labelTransactions(transactions);
        let year = minDateT.year, quarter = minDateT.quarter;
        let interestCsv = "";
        let interestData = [], interestLabels = [];
        while (year * 4 + quarter <= maxDateT.year * 4 + maxDateT.quarter) {
            let filtered = filterTransactions(year, quarter);
            filtered = filtered.filter(t => t.labels.includes(category));
            let interest = filtered.reduce((sum, t) => sum + t.amount, 0);
            if (invert) interest *= -1;
            interest = interest.toFixed(2);
            const label = `${year} Q${quarter + 1}`;
            interestCsv += `${label}, ${interest}\n`;
            interestData.push(interest);
            interestLabels.push(label);
            year += quarter == 3;
            quarter = (quarter + 1) % 4;
        }
        const size = {x: canvasSize.x, y: 500};
        let graph = new BarGraph(title, interestData, interestLabels, size);
        graphs.push(graph);
        document.body.appendChild(graph.node);
        console.debug(interestCsv);
    };
    // addGraphForCategory('Interest', 'Quarterly Interest Earned');
    // addGraphForCategory('Food', 'Quarterly Food Spending', true);
    // addGraphForCategory('Fuel', 'Quarterly Fuel Spending', true);
    
    // updateOptions(transactions, filterTransactions, minDateT, maxDateT);
};
const calculateDailyBalances = (accounts) => {
    for (const account of accounts) {
        const dailyChange = account.dailyChange = new Map();
        for (const t of account.transactions) {
            let bal = dailyChange.get(t.timestamp) || 0;
            dailyChange.set(t.timestamp, bal + t.amount);
        }

        const dailyChangeEntries = Array.from(dailyChange.entries());
        const stamps = Array.from(dailyChange.keys());
        const stamp = account.stampRange =
            {min: stamps.best(), max: stamps.best(a => a, "max")};
        let dailyBalance = account.dailyBalance = [];
        Date.msDay = 1000 * 60 * 60 * 24;
        let i = 0;
        let prevBal = 0;
        dailyChangeEntries.sort(([stampA], [stampB]) => stampA - stampB);
        for (const [curStamp, change] of dailyChangeEntries) {
            let stampI = Math.round((curStamp - stamp.min) / Date.msDay);
            for (; i < stampI; ++i) dailyBalance[i] = prevBal;
            dailyBalance[stampI] = prevBal += change;
        }
        const balRange = account.balRange =
            {min: dailyBalance.best(), max: dailyBalance.best(a => a, "max")};
        if (!account.name.includes("Credit") && balRange.min < 0) {
            for (let i = 0; i < dailyBalance.length; ++i)
                dailyBalance[i] -= balRange.min;
            balRange.max -= balRange.min;
            balRange.min -= balRange.min;
        }
    }
};
const makeBalancesGraph = (accounts, tViewer, stampRange, balRange) => {
    const graph = new AccountBalancesGraph(accounts, stampRange, balRange);
    graph.node.addEventListener('view-transactions', ({detail: filters}) => {
        tViewer.filters = filters;
        tViewer.update();
        transactionTab.childNodes[1]?.click();
    });
    graphs.push(graph);
    document.querySelector('#chart').appendChild(graph.node);
};
const makeNetWorthGraph = (accounts, stampRange, balRange) => {
    const totalDailyBalance = [];
    for (let d = stampRange.min, i = 0; d < stampRange.max; d += Date.msDay, ++i) {
        let total = 0;
        for (const account of accounts.values()) {
            if (account.stampRange.min <= d) {
                let index = Math.round((d - account.stampRange.min) / Date.msDay);
                if (d > account.stampRange.max)
                    index = account.dailyBalance.length - 1;
                total += account.dailyBalance[index];
            }
        }
        totalDailyBalance[i] = total;
    }

    let dataPoints = [];
    const labels = [];
    let prevYear = -Infinity;
    for (let i = 0, len = totalDailyBalance.length; i < len; ++i) {
        const bal = totalDailyBalance[i];
        const stamp = stampRange.min + i * Date.msDay;
        const date = new Date(stamp);
        const year = +date.getFullYear();
        let label = "";
        const isFirstOrLast = prevYear == -Infinity || i + 1 == len;
        if (year > prevYear || isFirstOrLast) {
            prevYear = year;
            label = isFirstOrLast ? dateToYmd(date) : date.getFullYear();
        }
        labels.push(label);

        const x = (stamp - stampRange.min) / stampRange.diff;
        const y = (bal - balRange.min) / balRange.diff;
        dataPoints.push({x, y});
    }

    const size = {x: canvasSize.x, y: 400};
    let netWorthGraph = new BarGraph("Net Worth Over Time", totalDailyBalance, labels, size);
    console.debug("net worth graph", netWorthGraph);
    window.netWorthGraph = netWorthGraph;
    graphs.push(netWorthGraph);
    document.querySelector('#chart').appendChild(netWorthGraph.node);
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

    // Match longer and therefore more specific rules first:
    classifiers.sort((a,b) => b.unique.length - a.unique.length);
    // Match sub-categories first
    classifiers.sort((a,b) => b.label.length - a.label.length);

    for (const transaction of transactions) {
        let {date, desc, amount} = transaction;
        desc = desc.toLowerCase();

        let [label, classifier] = labelTransaction(date, desc, amount);
        if (!label) {
            label = 'Uncategorized';
            let elm = document.createElement("pre");
            elm.textContent = transaction.cols.join(",");
            // unlabeledDiv.appendChild(elm);
            // unlabeledDiv.style.display = "block";
        }
        if (!classifier.transactions) classifier.transactions = [];
        classifier.transactions.push(transaction);
        transaction.classifier = classifier;
        const labels = label.split("/");
        transaction.labels = labels;
        const category = labels[0];

        let curCategory = categories;
        for (const label of labels) {
            if (!curCategory.has(label))
                curCategory.set(label, new Map());
            curCategory = curCategory.get(label);
        }
        if (!curCategory.transactions) curCategory.transactions = [];
        curCategory.transactions.push(transaction);
    }
    // let labeledCsv = transactions.map(row => row.join(",")).join("\n");

    const ignored = categories.get("Ignored");
    categories.delete("Ignored");
    console.debug("ignored:", ignored);
    const income = categories.get("Income");
    categories.delete("Income");
    console.debug("income:", income);

    const consolidate = (map) => { // recursive
        if (!map) return [];
        return Array.from(map.entries()).map(([name, val]) => {
            let children = consolidate(val);
            if (!children.length) children = null;
            const transactions = val?.transactions ?? [];
            const transactionsTotal =
                transactions.reduce((sum,c)=>sum+(-c.amount),0);
            const childrenTotal =
                (children || []).reduce((sum, c) => sum + c.total, 0);
            const total = Math.abs(transactionsTotal + childrenTotal);
            const numTransactions = transactions.length +
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
    // console.debug(JSON.stringify(encodeGraph(root)));
    // console.debug("total:", root.total);
    console.debug("no matching transactions:", classifiers.filter(c => !c.transactions));
    return {root, income: incomeRoot, ignored: ignoredRoot};
};

const makeHPieGraph = (root, title) => {
    let graph = new HierarchalPieGraph(root, title, canvasSize);
    graphs.push(graph);
    console.debug(title + " root:", graph.root);
    document.querySelector('#chart').appendChild(graph.node);
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
    console.debug("Flow layers", layers);

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
    document.querySelector('#chart').appendChild(graph.node);
    return graph;
};
const fillLayers = (root, layers, index = 0) => { // recursive
    if (!layers[index]) layers[index] = [];
    layers[index++].push(root);
    if (!root.children) return;

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
        case "custom-return":
            return unique;
        default:
            throw new TypeError(`Unknown rule type "${type}"`);
    };
};

const makeExample = () => {
    fetch("./src/json/example-graph.json").then(res => {
        if (!res.ok) return console.error(res);
        res.json().then(encoded => {
            const root = decodeGraph(encoded);
            makeHPieGraph(root, "Example");
            const income = {
                name: "Income",
                children: [{
                    name: "Salary",
                    total: 104000
                }, {
                    name: "Interest",
                    total: 2000
                }],
                total: 106000,
                color: "#285"
            };
            makeFlowGraph({root, income}, "Example");
        });
    });
};
const afterPageLoad = event => {
     fetch("./src/json/default-rules.json").then(res => {
        if (!res.ok) return console.error(res);
        res.json().then(rules => {
            loadRules(rules);
        });
    });

    let tabBar = new TabBar();
    document.querySelector('header').after(tabBar.node);
    tabBar.addTab('Banks', document.querySelector('#bank-tab'));
    tabBar.addTab('Charts', document.querySelector('#chart'));
    const transactionElm = document.querySelector('#transactions');
    transactionTab = tabBar.addTab('Transactions', transactionElm);

    textInp = document.querySelector("#transaction-input");
    unlabeledDiv = document.querySelector("#unlabeled");
    addBankBtn = document.querySelector('#add-bank-btn');
    exportBtn = document.querySelector('#export-btn');

    addBankBtn.addEventListener('click', createNewBank);
    exportBtn.addEventListener('click', exportBtv);


    let transactionInput = document.querySelector("#transaction-input");
    transactionInput.addEventListener("change", transactionInputChange);

    makeExample();
}

if (document.readyState !== "loading") afterPageLoad();
else document.addEventListener("DOMContentLoaded", afterPageLoad);