#!/usr/bin/env node


import fs from 'node:fs';
import process from "node:process";
import path from 'node:path';


import * as seonUtil from 'seon/util';


const mkdirp = (path) => fs.mkdirSync(path, {recursive: true, mode: 0o755});


const convertSeonToJson = (srcPath, dstPath) => {
  const seonString = fs.readFileSync(srcPath, "utf-8");
  const jsonString = seonUtil.convertSeonStringToJsonString(seonString, dstPath, srcPath);
  mkdirp(path.dirname(dstPath));
  fs.writeFileSync(dstPath, jsonString);
};


const exchangeExt = (targetPath, newExt) => {
  const pathParsed = { ... path.parse(targetPath) };
  pathParsed.ext = newExt;
  delete pathParsed.base;
  return path.format(pathParsed);
};


const displayUsageAndExit = () => {
  console.log(`usage:
    npx seon2json [path/to/src.seon] [path/to/dst.json]`);
  process.exit(1);
};


const main = (srcPath, dstPath) => {
  if (!srcPath) { displayUsageAndExit() }
  if (!dstPath) {
    dstPath = exchangeExt(srcPath, ".json");
    if (srcPath === dstPath) { displayUsageAndExit() }
  }
  if (!fs.existsSync(srcPath)) {
    console.log(`srcPath not found: ${srcPath}`);
    process.exit(1);
  }
  convertSeonToJson(srcPath, dstPath);
};


main(process.argv[2], process.argv[3]);
