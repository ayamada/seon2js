#!/usr/bin/env node


import Fs from "node:fs";
import Process from "node:process";
import Path from "node:path";
import NodeUtil from "node:util";


import SeonUtil from "seon/util";


const mkdirp = (path) => Fs.mkdirSync(path, {recursive: true, mode: 0o755});


const rewritePatchVersionByCurrentDate = (oldVersion) => {
  let [all, major, minor, patch, identifier] = oldVersion.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
  if (!all) { throw new Error("found invalid version string in package.seon") }
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = ('0' + (date.getMonth() + 1)).slice(-2);
  const dd = ('0' + date.getDate()).slice(-2);
  patch = '' + yyyy + mm + dd;
  const newVersion = `${major}.${minor}.${patch}${identifier??''}`;
  return newVersion;
};


const convertSeonToJson = (srcPath, dstPath, isShowErrorStacktrace, isRewritePatchVersionByCurrentDate) => {
  const seonString = Fs.readFileSync(srcPath, "utf-8");
  let jsonStruct;
  try {
    jsonStruct = SeonUtil.convertSeonStringToJsonStruct(seonString);
  } catch (e) {
    if (isShowErrorStacktrace) { console.log(e) }
    console.log("Error: " + e.message);
    Process.exit(1);
  }
  if (isRewritePatchVersionByCurrentDate) {
    const version = jsonStruct?.['version'];
    if (version) {
      jsonStruct['version'] = rewritePatchVersionByCurrentDate(version);
    }
  }
  const jsonString = JSON.stringify(jsonStruct, null, 2);
  mkdirp(Path.dirname(dstPath));
  Fs.writeFileSync(dstPath, jsonString);
};


const exchangeExt = (targetPath, newExt) => {
  const pathParsed = { ... Path.parse(targetPath) };
  pathParsed.ext = newExt;
  delete pathParsed.base;
  return Path.format(pathParsed);
};


const displayUsageAndExit = () => {
  console.log(`usage:
    npx seon2json
      path/to/src.seon # specify input *.seon file
      [path/to/result.json] # specify output file or determine automatically
      [-s --show-error-stacktrace] # display stacktrace on error (for debug)
      [--rewrite-patch-version-by-current-date] # rewrite :version of entry
      [-h --help] # show help`);
  Process.exit(1);
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
    "rewrite-patch-version-by-current-date": {
      type: "boolean",
    },
  },
};


const main = () => {
  const cmdArgs = NodeUtil.parseArgs(parseConfig);
  const { help } = cmdArgs.values;
  const isShowErrorStacktrace = cmdArgs.values["show-error-stacktrace"];
  const isRewritePatchVersionByCurrentDate = cmdArgs.values["rewrite-patch-version-by-current-date"];
  let [srcPath, dstPath] = cmdArgs.positionals;
  if (help) { displayUsageAndExit() }
  if (!srcPath) { displayUsageAndExit() }
  if (!dstPath) {
    dstPath = exchangeExt(srcPath, ".json");
    if (srcPath === dstPath) { displayUsageAndExit() }
  }
  if (!Fs.existsSync(srcPath)) {
    console.log(`file not found: ${srcPath}`);
    Process.exit(1);
  }
  convertSeonToJson(srcPath, dstPath, isShowErrorStacktrace, isRewritePatchVersionByCurrentDate);
  console.log(`Done. Wrote to ${dstPath}`);
};


main();
