#!/usr/bin/env node


import fs from 'node:fs';
import process from "node:process";
import path from 'node:path';
import { parseArgs } from "node:util";


import * as seonUtil from 'seon/util';


const mkdirp = (path) => fs.mkdirSync(path, {recursive: true, mode: 0o755});


const convertSeonToJson = (srcPath, dstPath, isShowErrorStacktrace) => {
  const seonString = fs.readFileSync(srcPath, "utf-8");
  let jsonString;
  try {
    jsonString = seonUtil.convertSeonStringToJsonString(seonString, srcPath);
  } catch (e) {
    if (isShowErrorStacktrace) { console.log(e) }
    console.log("Error: " + e.message);
    process.exit(1);
  }
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
    npx seon2json
      path/to/src.seon # specify input *.seon file
      [path/to/result.json] # specify output file or determine automatically
      [-s --show-error-stacktrace] # display stacktrace on error (for debug)
      [-h --help] # show help`);
  process.exit(1);
};


const parseConfig = {
  allowPositionals: true,
  options: {
    "help": {
      type: "boolean",
      short: "h",
    },
    "show-error-stacktrace": {
      type: "boolean",
      short: "s",
    },
  },
};


const main = () => {
  const cmdArgs = parseArgs(parseConfig);
  const { help } = cmdArgs.values;
  const isShowErrorStacktrace = cmdArgs.values["show-error-stacktrace"];
  let [srcPath, dstPath] = cmdArgs.positionals;
  if (help) { displayUsageAndExit() }
  if (!srcPath) { displayUsageAndExit() }
  if (!dstPath) {
    dstPath = exchangeExt(srcPath, ".json");
    if (srcPath === dstPath) { displayUsageAndExit() }
  }
  if (!fs.existsSync(srcPath)) {
    console.log(`file not found: ${srcPath}`);
    process.exit(1);
  }
  convertSeonToJson(srcPath, dstPath, isShowErrorStacktrace);
  console.log(`Done. Wrote to ${dstPath}`);
};


main();
