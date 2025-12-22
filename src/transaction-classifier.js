import("./rules.js").then(mod => {
    mod.addRules(addClassifier);
}).catch(err => {
    console.log(err);
});
import HierarchalPieGraph from "./HierarchalPieGraph.js";
import FlowGraph from "./FlowGraph.js";
import {CSV, removeCR} from "./CSVTable.js";
import {Color} from "./color-utils.js";
import {dateValToMdy, dateToYmd, mdyToDate, isDateStr} from "./date-utils.js";
import BarGraph from "./BarGraph.js";
import {Bank, Account, TransactionFile} from "./Account.js";
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
let textInp = document.querySelector("#transaction-input");
let unlabeledDiv = document.querySelector("#unlabeled");
let addBankBtn = document.querySelector('#add-bank-btn');
let exportBtn = document.querySelector('#export-btn');
let classifiers = [];
let bankList = window.bankList = [];

addBankBtn.addEventListener('click', () => createNewBank('Default bank'));
exportBtn.addEventListener('click', () => {
    const btvText = JSON.stringify(bankList.map(b => b.encode()));
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
});

const updateloop = () => {
    for (const graph of graphs) {
        if (graph.update) graph.update();
    }
    requestAnimationFrame(updateloop);
};
updateloop();

const removeGraphs = () => {
    for (let cur; cur = graphs.pop();) {
        cur = cur.container || cur.canvas || cur;
        document.body.removeChild(cur);
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
        const bankObjs = JSON.parse(text);
        for (const bankObj of bankObjs) {
            const bank = Bank.decode(bankObj);
            addBank(bank);
            bank.pageNode.querySelector('.icon-collapse')?.click();
        }
        compileTransactions();
    } catch (error) {
        console.error(error);
        alert('Failed to read btv file, ' + error);
    }
};
const loadCsvFile = (file, text) => {
    const csv = new CSV(text);
    let tranFile = new TransactionFile(file, csv);

    let accountName = Account.searchTranFileForAccountName(tranFile) || 'Default Account';
    let account;
    let bank = bankList.find(
        bank => account = bank.accounts.find(a => a.name == accountName));
    if (!account) {
        // todo: identify account based on csv header
    }
    if (!account) { // create new account
        account = new Account(accountName);
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

    compileTransactions();
}
const addBank = (bank) => {
    bankList.push(bank);
    const bankListDiv = document.querySelector('#bank-list');
    bankListDiv.appendChild(bank.pageNode);
    bank.pageNode.addEventListener('delete', event => {
        const index = bankList.findIndex(
            bank => bank.pageNode === event.target);
        if (index > -1) {
            bankList.splice(index, 1);
        }
        compileTransactions();
    });
    bank.pageNode.addEventListener('change', compileTransactions);
}
const compileTransactions = () => {
    let simpleCsv;
    for (const bank of bankList) {
        for (const account of bank.accounts) {
            for (const tranFile of account.transactionFiles) {
                if (!tranFile.isFullyFilled) continue;
                const cur = tranFile.getSimplifiedCsv(account.name);
                console.debug('appending simple csv: ', cur);
                if (!simpleCsv) simpleCsv = cur;
                else simpleCsv.append(cur);
            }
        }
    }
    removeGraphs();
    if (simpleCsv && simpleCsv.rows.length) {
        console.debug('loading transactions csv: ', simpleCsv);
        loadTransactions(simpleCsv);
    }

};
const loadTransactions = (csv) => {
    let transactions = csv.rows.map(row => ({
        cols: row
    }));
    let headings = csv.headings;
    let fieldIndices = {};
    for (let i = 0; i < headings.length; ++i) {
        let colName = headings[i];
        fieldIndices[colName] = i;
    }
    const dateField = fieldIndices["Transaction Date"];
    const descField = fieldIndices["Description"];
    const amountField = fieldIndices["Amount"];
    transactions.forEach(t => {
        t.date = t.cols[dateField];
        t.desc = t.cols[descField];
        t.amount = +t.cols[amountField];
        if (isNaN(t.amount)) debugger;
    });

    for (const t of transactions) {
        let [m,d,y] = t.date.split("/");
        if (!isDateStr(t.date))
            console.error("invalid date: ", t.date);
        t.timestamp = +new Date(y,m-1,d);
        t.year = +y;
        t.quarter = (m - 1) / 3 | 0;
        t.month = +m;
        t.day = +d;
    }
    const filterCustom = (start, end) =>
        transactions.filter(t => t.timestamp >= start && t.timestamp < end);
    
    const minDateT = transactions.best(({timestamp}) => timestamp);
    const maxDateT = transactions.best(({timestamp}) => timestamp, "max");
    const filterTransactions = (year, q) =>
        transactions.filter(t =>
            (!year || t.year == year) && (!(q+1) || t.quarter == q));

    const addGraphForCategory = (category, title = category, invert = false) => {
        labelTransactions(transactions);
        let year = minDateT.year, quarter = minDateT.quarter;
        let interestCSV = "";
        let interestData = [], interestLabels = [];
        while (year * 4 + quarter <= maxDateT.year * 4 + maxDateT.quarter) {
            let filtered = filterTransactions(year, quarter);
            filtered = filtered.filter(t => t.labels.includes(category));
            let interest = filtered.reduce((sum, t) => sum + t.amount, 0);
            if (invert) interest *= -1;
            interest = interest.toFixed(2);
            const label = `${year} Q${quarter + 1}`;
            interestCSV += `${label}, ${interest}\n`;
            interestData.push(interest);
            interestLabels.push(label);
            year += quarter == 3;
            quarter = (quarter + 1) % 4;
        }
        let interestGraph = new BarGraph(title, interestData, interestLabels, canvasSize.x, 500);
        document.body.appendChild(interestGraph.container);
        console.debug(interestCSV);
    };
    // addGraphForCategory('Interest', 'Quarterly Interest Earned');
    // addGraphForCategory('Food', 'Quarterly Food Spending', true);
    // addGraphForCategory('Fuel', 'Quarterly Fuel Spending', true);
    
    // makeOptions();


    let accounts = calculateDailyBalances(transactions);

    const accountValues = Array.from(accounts.values());
    
    const stampRange = {
        min: accountValues.best(({stampRange: {min}}) => min).stampRange.min,
        max: accountValues.best(({stampRange: {max}}) => max, "max").stampRange.max
    };
    stampRange.diff = stampRange.max - stampRange.min;
    
    const balRange = {
        min: accountValues.best(({balRange: {min}}) => min).balRange.min,
        max: accountValues.best(({balRange: {max}}) => max, "max").balRange.max
    };
    balRange.diff = balRange.max - balRange.min;
    
    makeBalancesGraph(transactions, accounts, stampRange, balRange);

    // Make Net Worth Graph:
    {
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

        let netWorthGraph = new BarGraph("Net Worth Over Time", totalDailyBalance, labels, canvasSize.x, 400);
        console.debug("net worth graph", netWorthGraph);
        window.netWorthGraph = netWorthGraph;
        graphs.push(netWorthGraph);
        document.body.appendChild(netWorthGraph.container);
    }
};
const makeOptions = () => {
    // Make options:
    let options = "";
    const addOption = (value, text) =>
        (options += `<option value="${value}">${text}</option>\n`);
    let year = minDateT.year, quarter = minDateT.quarter;
    while (year * 4 + quarter <= maxDateT.year * 4 + maxDateT.quarter) {
        addOption(`${year},${quarter}`, `${year} Q${quarter + 1}`);
        if (year == maxDateT.year && quarter == maxDateT.quarter)
            addOption(year, `${year} Ending ${maxDateT.month}/${maxDateT.day}`);
        else if (quarter == 3)
            addOption(year, year);
        year += quarter == 3;
        quarter = (quarter + 1) % 4;
    }
    options += `<option value="all">All Time</option>`;
    options = options.split("\n").reverse().join("\n");

    let settingsDiv = document.createElement("div");
    settingsDiv.innerHTML = `
        <label for="period">Choose a time period:</label>
        <select id="period">${options}</select>
        <label for="duplicates">Filter repeat descriptions:</label>
        <input type="checkbox" id="duplicates" name="duplicates" checked />`;
    let transElm = document.querySelector("#transactions");
    document.body.insertBefore(settingsDiv, transElm);
    const duplicatesBox = document.querySelector("#duplicates");
    const periodSelect = document.querySelector("#period");
    const changePeriod = () => {
        const periodValue = periodSelect.value;
        removeGraphs();

        let [year, quar] = periodValue.split(",").map(s => +s);
        let title = periodSelect.selectedOptions[0].text;
        let filtered = filterTransactions(year, quar);

        const {root, income, ignored} = labelTransactions(filtered);
        makeFlowGraph({root, income}, title);
        makeHPieGraph(root, title);

        // Filter duplicates
        if (duplicatesBox.checked) {
            let descs = new Set();
            filtered = filtered.filter(t => {
                const isDup = descs.has(t.desc);
                if (!isDup) descs.add(t.desc);
                return !isDup;
            });
        }

        // Stats:
        let uniqueDescs = [...new Set(filtered.map(t => t.desc))].length;
        let unlabeled = filtered.filter(t => !t.labels[0]).length;
        let statsElm = document.querySelector("#transaction-stats");
        if (statsElm) {
            statsElm.innerText = `${transactions.length} total transactions.\n`;
            statsElm.innerText += `Showing ${filtered.length} transactions.\n`;
            statsElm.innerText += `${uniqueDescs} unique descriptions.\n`;
            statsElm.innerText += `${unlabeled} transactions without label.`;
        }
    };
    periodSelect.addEventListener("change", changePeriod);
    duplicatesBox.addEventListener("change", changePeriod);

    changePeriod();
};
const calculateDailyBalances = (transactions) => {
    // Account Balances:
    let nonSweepTrans = transactions.filter(t => !t.desc.includes("Sweep") || t.desc == "Cash Sweep Interest");
    nonSweepTrans = nonSweepTrans.filter(t => !t.desc.match(/(Buy|Sell) [A-Z]{3,4}/));
    nonSweepTrans = nonSweepTrans.filter(t => !t.desc.match(/Transfer Received from Another Account [A-Z]{3,4}/));
    nonSweepTrans = nonSweepTrans.filter(t => !t.desc.startsWith("Amazon Order "));
    let accounts = new Map();
    for (const t of nonSweepTrans) {
        const accountName = t.cols[0];
        let account = accounts.get(accountName);
        if (!account) accounts.set(accountName, account = {
            transactions: [],
            dailyChange: new Map()
        });
        account.transactions.push(t);
        let date = t.cols[2] || t.cols[1];
        let timestamp = +mdyToDate(date);
        let bal = account.dailyChange.get(timestamp) || 0;
        account.dailyChange.set(timestamp, bal + t.amount);
    }
    for (const [accountName, account] of accounts.entries()) {
        let {dailyChange} = account;
        const stamps = Array.from(dailyChange.keys());
        const dailyChangeEntries = Array.from(dailyChange.entries());
        const stamp = account.stampRange =
            {min: stamps.best(), max: stamps.best(a => a, "max")};
        let dailyBalance = account.dailyBalance = [];
        Date.msDay = 1000 * 60 * 60 * 24;
        let i = 0;
        let prevBal = 0;
        dailyChangeEntries.sort(([stampA], [stampB]) => stampA - stampB);
        console.debug(accountName, account);
        console.debug(accountName, "transactions:", accounts.get(accountName).transactions);
        for (const [curStamp, change] of dailyChangeEntries) {
            let stampI = Math.round((curStamp - stamp.min) / Date.msDay);
            for (; i < stampI; ++i) dailyBalance[i] = prevBal;
            dailyBalance[stampI] = prevBal += change;
        }
        const balRange = account.balRange =
            {min: dailyBalance.best(), max: dailyBalance.best(a => a, "max")};
        if (!accountName.includes("Credit") && balRange.min < 0) {
            for (let i = 0; i < dailyBalance.length; ++i)
                dailyBalance[i] -= balRange.min;
            balRange.max -= balRange.min;
            balRange.min -= balRange.min;
        }
    }
    return accounts;
};
const makeBalancesGraph = (transactions, accounts, stampRange, balRange) => {
    // Drawing setup
    let canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    let ctx = canvas.getContext("2d");
    ctx.fontName = '"Helvetica Neue", Helvetica, sans-serif';
    ctx.setFontSize = function(size, {bold} = {}) {
        this.font = `${bold ? 'bold ' : ''}${size}px ${this.fontName}`;
    };
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.temp = function (cb) {this.save(); cb(); this.restore()};
    ctx.temp(() => {
        const axisSpace = {x: 50, y: 50};
        ctx.translate(axisSpace.x, canvas.height - axisSpace.y);
        const axisScaler = {x: (canvas.width - axisSpace.x) / canvas.width,
            y: ((canvas.height - axisSpace.y) / canvas.height)};
        ctx.scale(axisScaler.x, -1 * axisScaler.y * 0.95);

        // Draw X Axes:
        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.setFontSize(16, {bold:true});
        ctx.globalAlpha = 0.4;
        const yStep = 2000;
        ctx.beginPath();
        for (let y = Math.floor(balRange.min / yStep) * yStep; y < balRange.max; y += yStep) {
            const drawY = (y - balRange.min) / balRange.diff * canvas.height;
            ctx.moveTo(0, drawY);
            ctx.lineTo(canvas.width, drawY);
            ctx.temp(() => {
                ctx.globalAlpha = 1;
                ctx.translate(-5, drawY);
                ctx.scale(1.4, -1.4);
                ctx.fillText(`$${y/1000|0}k`, 0, 0);
            });
        }
        // Draw Y Axes:
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const minYear = new Date(stampRange.min).getFullYear();
        const maxYear = new Date(stampRange.max).getFullYear();
        for (let year = minYear; year <= maxYear; ++year) {
            const x = +new Date(year, 0, 1);
            const drawX = (x - stampRange.min) / stampRange.diff * canvas.width;
            ctx.moveTo(drawX, 0);
            ctx.lineTo(drawX, canvas.height);
            ctx.temp(() => {
                ctx.globalAlpha = 1;
                ctx.translate(drawX, -5);
                ctx.scale(1.4, -1.4);
                ctx.fillText(`'${new Date(x).getFullYear()-2000}`, 0, 0);
            });
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Generate Colors:
        let colors = Array.from({length: accounts.size}, () => new Color());
        let count = 0;
        for (let step = 0.1; count < 20 && colors.length > 1; step *= 0.6, count++) {
            let pairs = [];
            for (let i = 0; i < colors.length; ++i) {
                const color = colors[i];
                let nearest = null;
                for (let j = 0; j < colors.length; ++j) {
                    if (j == i) continue;
                    const cur = colors[j];
                    const dist = color.dist(cur);
                    if (!nearest || dist < color.dist(nearest))
                        nearest = cur;
                }
                pairs.push([color, nearest]);
            }
            const moveFromExtremes = a => {
                const margin = 0.20;
                if (a.length() < margin) a.normalize().scale(0.25);
                const fromWhite = a.diff(new Color(1, 1, 1));
                const distWhite = fromWhite.length();
                if (distWhite < margin)
                    a.add(fromWhite.normalize().scale(margin - distWhite));
            };
            for (let [a, b] of pairs) {
                const vector = a.diff(b).normalize().scale(step/2);
                a.add(vector).clamp();
                moveFromExtremes(a);
                b.add(vector.scale(-1)).clamp();
                moveFromExtremes(b);
            }
        }
        
        // Draw Data lines:
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        for (const [accountName, account] of accounts.entries()) {
            const {dailyBalance} = account;
            
            account.color = colors.shift();
            ctx.strokeStyle = account.color.toString();
            let dataPoints = [];
            for (let i = 0, len = dailyBalance.length; i < len; ++i) {
                const bal = dailyBalance[i];
                const stamp = account.stampRange.min + i * Date.msDay;
                const x = (stamp - stampRange.min) / stampRange.diff;
                const y = (bal - balRange.min) / balRange.diff;
                dataPoints.push({x, y});
            }

            if (dataPoints.length) {
                ctx.beginPath();
                ctx.moveTo(dataPoints[0].x * canvas.width, dataPoints[0].y * canvas.height);
                for (let i = 1; i < dataPoints.length; ++i) {
                    const point = dataPoints[i];
                    ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
                }
                ctx.stroke();
            }
        }

        // Y baseline:
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "white";
        const y0 = (0 - balRange.min) / balRange.diff;
        ctx.moveTo(0, y0 * canvas.height);
        ctx.lineTo(1 * canvas.width, y0 * canvas.height);
        ctx.stroke();
    });

    // Draw Title:
    ctx.fillStyle = "white";
    ctx.globalAlpha = 0.8;
    ctx.setFontSize(26, {bold:true});
    ctx.fillText("Account Balances Over Time", canvas.width / 4, 20);
    ctx.setFontSize(22, {bold:true});
    ctx.fillText(`min bal: ${balRange.min | 0}, max bal: ${balRange.max | 0}`, canvas.width / 4, 40);
    ctx.fillText(`first transaction date: ${dateValToMdy(stampRange.min)}`, canvas.width / 4, 60);
    ctx.fillText(`last transaction date: ${dateValToMdy(stampRange.max)}`, canvas.width / 4, 80);
    ctx.globalAlpha = 1;

    // Draw Graph Key:
    const keyFontSize = 22;
    ctx.setFontSize(keyFontSize, {bold:true});
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    let y = 0;
    for (const [accountName, account] of accounts.entries()) {
        ctx.fillStyle = "white";
        ctx.fillText(accountName, canvas.width - 30, y += keyFontSize + 4);
        ctx.fillStyle = account.color;
        ctx.fillRect(canvas.width - 20, y - 7, 10, 10);
    }

    graphs.push(canvas);
    document.body.appendChild(canvas);
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
            elm.textContent = transaction.cols.join(",");
            // unlabeledDiv.appendChild(elm);
            // unlabeledDiv.style.display = "block";
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
    document.body.appendChild(graph.canvas);
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

const makeExample = event => {
    let transactionInput = document.querySelector("#transaction-input");
    transactionInput.addEventListener("change", transactionInputChange);

    fetch("./example-graph.json").then(res => {
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

if (document.readyState !== "loading") makeExample();
else document.addEventListener("DOMContentLoaded", makeExample);
