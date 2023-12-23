
const process = require("node:process");
const fs = require('node:fs')

const srcFile = process.argv[2];
const isDev = (process.argv[3] !== "0");


const data = fs.readFileSync(srcFile, "utf-8");

const markerStart = "/*AUTO_ISDEV_START*/";
const markerEnd = "/*AUTO_ISDEV_END*/";
const escapeRegExp = (reStr) => reStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const regexp = new RegExp(escapeRegExp(markerStart)+"\\w+"+escapeRegExp(markerEnd), 'sg');
const replaced = markerStart + isDev + markerEnd;
const newData = data.replaceAll(regexp, replaced);

fs.writeFileSync(srcFile, newData);



