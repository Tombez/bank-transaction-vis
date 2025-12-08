#!/usr/bin/env node
"use strict";

// configuration:
let expectedHeaders = {
    "arvest": "Account,Date,Pending?,Description,Category,Check,Credit,Debit",
    "embold": "Transaction ID,Posting Date,Effective Date,Transaction Type,Amount,Check Number,Reference Number,Description,Transaction Category,Type,Balance,Memo,Extended Description",
    "firsthorizon": "Date,Account,Description,Check #,Category,Credit,Debit",
    "laurelroad": "Date,Amount,Description,Ref.#",
    "nfcu": "Posting Date,Transaction Date,Amount,Credit Debit Indicator,type,Type Group,Reference,Instructed Currency,Currency Exchange Rate,Instructed Amount,Description,Category,Check Serial Number,Card Ending",
    "paypal": "Date,Time,TimeZone,Name,Type,Status,Currency,Amount,Receipt ID,Balance",
    "pnc": [
        {
            header: "Transaction Date,Transaction Description,Amount,Balance"
        },
        {
            startingDate: "9/1/2025",
            header: "Transaction Date,Transaction Description,Amount"
        }
    ],
    "vanguard": "Account Number,Trade Date,Settlement Date,Transaction Type,Transaction Description,Investment Name,Symbol,Shares,Share Price,Principal Amount,Commissions and Fees,Net Amount,Accrued Interest,Account Type,",
};
let linesToSkipMap = {
    "laurelroad": 2
}

// create require:
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// import nodejs libraries:
const fs = require("fs");
const path = require("path");

// import other source code:
import {CSV, default as CSVTable, removeCR} from "./CSVTable.js";
import {fromYmdToMdy, padYearMdy, nowString, mdyToDate} from "./date-utils.js";

// define helpers:
const readFileSync = filePath => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const textDecoder = new TextDecoder();
        return textDecoder.decode(dataBuffer);
    } catch (err) {
        console.error(err);
    }
};
const writeFileSync = (filePath, content) => {
    try {
        fs.writeFileSync(filePath, content);
    } catch (err) {
        console.error(err);
    }
};
const getDirectories = srcPath => fs.readdirSync(path.resolve(srcPath)).filter(
    fileName => fs.lstatSync(path.join(srcPath, fileName)).isDirectory()
);
const getFiles = srcPath => fs.readdirSync(path.resolve(srcPath)).filter(
    fileName => !fs.lstatSync(path.join(srcPath, fileName)).isDirectory()
);
const sanitize$Text = text => text.replaceAll(/[^-\d\.]/g, "");

// main:
const args = process.argv.slice(2);

if (!args.length) {
    console.log("Please provide a path to a folder in which to consolidate transactions.");
    process.exit(1);
}
let directory = args[0];
let allDirFiles = getFiles(directory);
let csvFileNames = allDirFiles.filter(name => /\.csv$/i.test(name));
let nonCsvFileNames = allDirFiles.filter(name => !/\.csv$/i.test(name));
if (nonCsvFileNames.length)
    console.log("Ignoring non-csv files: ", nonCsvFileNames);
console.log("CSV File Names: ", csvFileNames);

let outputCSV = new CSV(`Account,Transaction Date,Posted Date,Description,Amount`, true);

for (const fileName of csvFileNames) {
    const filePath = path.join(directory, fileName);
    let text = removeCR(readFileSync(filePath));

    const institutionMatch = fileName.match(/-(\w+)-/);
    if (!institutionMatch) {
        console.warn(`Could not find institution name in filename: ${fileName}`);
        continue;
    }
    const institution = institutionMatch[1];

    let expectedHeader = expectedHeaders[institution];
    if (Array.isArray(expectedHeader)) {
        const dateMatch = fileName.match(/(\d{4})-(\d\d)\.csv/);
        if (dateMatch) {
            const headerFormats = expectedHeader;
            const csvDate = new Date(+dateMatch[1], dateMatch[2] - 1, 1);
            for (let i = 1; i < headerFormats.length; i++) {
                const headerFormat = headerFormats[i];
                const headerDate = mdyToDate(headerFormat.startingDate);
                if (headerDate <= csvDate) expectedHeader = headerFormat.header;
            }
        }
        if (Array.isArray(expectedHeader))
            expectedHeader = expectedHeader[0];
    }

    const linesToSkip = linesToSkipMap[institution] ?? 0;

    let csv = new CSV(text, undefined, linesToSkip);

    const actualHeaderLine = csv.headers?.join(",");
    if (actualHeaderLine != expectedHeader) {
        console.warn(`WARNING: ${institution} has changed header format:`);
        if (actualHeaderLine === undefined) {
            console.log(`first row of csv: ${csv.rows[0]}`);
            throw new Error(`No headers found; detection: ${csv.detectHeaders()}, expected header: ${expectedHeader}`);
        } else if (expectedHeader) {
            console.warn(`expected header length: ${expectedHeader.length}, found header length: ${actualHeaderLine.length}`);
            let firstMismatch = 0;
            for (; firstMismatch < expectedHeader.length; ++firstMismatch)
                if (expectedHeader[firstMismatch] != actualHeaderLine[firstMismatch])
                    break;
            console.log(`first mismatch index: ${firstMismatch}`);
            console.log(`expected header: ${expectedHeader.slice(firstMismatch)}`);
            console.log(`actual header  : ${actualHeaderLine.slice(firstMismatch)}`);
            console.log(`correct & incorrect char: "${expectedHeader[firstMismatch]}${actualHeaderLine[firstMismatch]}"`);
            console.log(`correct and incorrect char codes: (${expectedHeader.charCodeAt(firstMismatch)},${actualHeaderLine.charCodeAt(firstMismatch)})`);
            console.log(`found header: ${JSON.stringify(csv.headers)}`);
        }
    }

    rowLoop: for (const row of csv.rows) {
        if (!row.length) continue;
        const getCol = headerName => {
            const index = csv.headers.indexOf(headerName);
            if (index == -1)
                throw new Error(`${institution} headers doesn't have ${headerName}.`);
            else if (index >= row.length)
                throw new Error(`row is missing index ${index} element: [${row.map(a => `"${a}"`)}], row length: ${row.length}`);
            return row[index];
        };

        switch(institution) {
            case "arvest": {
                outputCSV.rows.push([
                    "Arvest Checking",
                    fromYmdToMdy(getCol("Date")),
                    "",
                    getCol("Description"),
                    sanitize$Text(getCol("Credit")) + sanitize$Text(getCol("Debit"))
                ]);
                break;
            }
            case "embold": {
                outputCSV.rows.push([
                    "Embold Checking",
                    getCol("Posting Date"),
                    getCol("Effective Date"),
                    getCol("Description").replace("PLUS DEBIT ", ""),
                    getCol("Amount")
                ]);
                break;
            }
            case "firsthorizon": {
                outputCSV.rows.push([
                    "First Horizon",
                    getCol("Date"),
                    "",
                    getCol("Description"),
                    sanitize$Text(getCol("Credit")) + sanitize$Text(getCol("Debit"))
                ]);
                break;
            }
            case "laurelroad": {
                outputCSV.rows.push([
                    "Laurel Road",
                    getCol("Date"),
                    "",
                    getCol("Description"),
                    getCol("Amount")
                ]);
                break;
            }
            case "nfcu": {
                const account = "NFCU " + (fileName.includes("credit") ? "Credit" : "Checking");
                outputCSV.rows.push([
                    account,
                    getCol("Transaction Date"),
                    getCol("Posting Date"),
                    getCol("Description"),
                    sanitize$Text(getCol("Amount")) * (getCol("Credit Debit Indicator") == "Debit" ? -1 : 1)
                ]);
                break;
            }
            case "pnc": {
                outputCSV.rows.push([
                    "PNC",
                    fromYmdToMdy(getCol("Transaction Date")),
                    "",
                    getCol("Transaction Description"),
                    sanitize$Text(getCol("Amount"))
                ]);
                break;
            }
            case "vanguard": {
                const isBrokerage = getCol("Account Number").endsWith("35");
                const account = isBrokerage ? "Vanguard Brokerage" : "Vanguard IRA";

                const transactionDetail = getCol("Transaction Description") || getCol("Transaction Type");
                const security = getCol("Symbol") || getCol("Investment Name");
                const desc = `${transactionDetail} ${security}`;
                outputCSV.rows.push([
                    account,
                    fromYmdToMdy(getCol("Trade Date")),
                    fromYmdToMdy(getCol("Settlement Date")),
                    desc,
                    getCol("Net Amount")
                ]);
                break;
            }
            case "paypal": {
                outputCSV.rows.push([
                    "Paypal",
                    getCol("Date"),
                    "",
                    (getCol("Name") + " " + getCol("Type")).trim(),
                    sanitize$Text(getCol("Amount"))
                ]);
                break;
            }
            default:
                console.warn(`WARNING: Handling for institution ${institution} not found.`);
                break rowLoop;
        }
    }
    if (!csv.hasHeaders) console.log(`${institution} does not have headers.`);
}

const simpleReplacements = [
    /POS Debit - Visa Check Card \d{4} - /g, // debit from card number
    /^(TST|UEP|CKE| SQ)(?: |\*) ?/g, // card reader branding
    "ACH Transaction - ",
    "PLUS DEBIT ",
    "Payment to ",
    / - ?\d{4}/g, // dash followed by last four digits of card
    ",",
    / +(?= )/g // multiple consecutive whitespace
];
for (const row of outputCSV.rows) {
    const DESC_INDEX = 3;
    let desc = row[DESC_INDEX];
    for (const sr of simpleReplacements) {
        desc = desc.replaceAll(sr, "");
    }
    row[DESC_INDEX] = desc.trim();

    row[1] = padYearMdy(row[1]);
    row[2] = padYearMdy(row[2]);

    row[4] = sanitize$Text(String(row[4]));
}

let outFileName = args[1] || `transactions-consolidated-${nowString()}.csv`;
if (!outFileName.includes(".")) outFileName += ".csv";
const outFilePath = path.join(directory, outFileName);
writeFileSync(outFilePath, outputCSV.toString());
console.log(`Successfully output formatted transactions to '${outFileName}'`);
