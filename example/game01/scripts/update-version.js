
const process = require("node:process");

const packageJsonFile = "./package.json";
const srcFile = process.argv[2];


const fs = require('node:fs')

const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, "utf-8"));
if (!packageJson) throw new Error("found invalid package.json");

const oldVersion = packageJson.version || "0.0.0-SNAPSHOT";

let [all, major, minor, patch, identifier] = oldVersion.match(/^(\d+)\.(\d+)\.(\d+)(-\w+)?$/);

if (!all) throw new Error("found invalid version string in package.json");

const date = new Date();
const yyyy = date.getFullYear();
const mm = ('0' + (date.getMonth() + 1)).slice(-2);
const dd = ('0' + date.getDate()).slice(-2);
patch = yyyy + mm + dd;
const newVersion = `${major}.${minor}.${patch}${identifier||''}`;

packageJson.version = newVersion;
fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2));

const newVersionLine = `const version = '${newVersion}'; /* AUTO-UPDATED */\n`;
fs.writeFileSync(srcFile, fs.readFileSync(srcFile, "utf-8").replace(/const version \= .+\n/, newVersionLine));


