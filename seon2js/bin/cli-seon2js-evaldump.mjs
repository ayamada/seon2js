#!/usr/bin/env node


import * as Fs from 'node:fs';
import * as Path from "node:path";
import * as Process from "node:process";
import * as Os from "node:os";
import * as NodeUtil from "node:util";
import * as ChildProcess from "node:child_process";


import * as Transpile from "seon2js/transpile";
import * as Sh from "seon2js/sh";


const tnE = (msg) => { throw new Error(msg) };


// node -p の、ファイル指定で動かせる版を再現する
const buildShCmdOfNodeP = (f) => `node -p "eval(require('fs').readFileSync('${f}', 'utf-8'))"`;


const runJsCode = (jsCode, isShouldPrintLastValue, isVerbose=undefined, isMjs=undefined) => Sh.shWithTmpFileAsync(jsCode, (isShouldPrintLastValue ? buildShCmdOfNodeP : ((f) => `node '${f}'`)), isVerbose, isMjs);


const parseOptions = {
  allowPositionals: true,
  options: {
    "help": {
      type: "boolean",
      short: "h",
    },
    "verbose": {
      type: "boolean",
      short: "v",
    },
    "eval": {
      type: "string",
      short: "e",
    },
    "print": {
      type: "string",
      short: "p",
    },
    "dump": {
      type: "boolean",
      short: "d",
    },
  }};


const displayUsageAndExit = () => {
  const basename = Path.basename(Process.argv[1]);
  console.error(`usage:
    npx ${basename}
      [foo.s2mjs] # read seon2js code by file and run
      [-e --eval "..."] # read seon2js code by parameter and run
      [-p --print "..."] # eval code and print last result (experimental)
      [-d --dump] # dump transpiled code, do not run
      [-v --verbose] # display stacktrace and exec cmd for debug
      [-h --help] # show help`);
  Process.exit(1);
};


const displayErrorAndExit = (msg) => {
  console.error('Error: ' + msg);
  Process.exit(1);
};


const main = async () => {
  let parsed;
  let isVerbose;
  let isMjs;

  try {
    parsed = NodeUtil.parseArgs(parseOptions);
  } catch (e) {
    console.error(e.message);
    displayUsageAndExit();
  }
  const { help, verbose } = parsed.values;
  if (help) { displayUsageAndExit() }
  const [targetFile, ... invalidArgs] = parsed.positionals;
  if (invalidArgs.length) {
    displayErrorAndExit('read file should be only one');
  }
  let evalCode = parsed.values['eval'];
  const printCode = parsed.values['print'];
  let isShouldPrintLastValue;
  if (printCode != null) {
    evalCode = printCode;
    isShouldPrintLastValue = true;
  }
  if ((targetFile != null) && (evalCode != null)) {
    displayErrorAndExit('received file path and eval code, take either');
  }
  if ((targetFile == null) && (evalCode == null)) {
    displayErrorAndExit('specify file path, or eval code by -e');
  }
  if (targetFile != null) {
    if (!Fs.existsSync(targetFile)) {
      displayErrorAndExit(`"${targetFile}" not exists`);
    }
    evalCode = Fs.readFileSync(targetFile, "utf-8");
    if (targetFile.match(/\.s2mjs$/)) { isMjs = 1 }
  }
  const isDump = parsed.values["dump"];
  const isNeedRun = !isDump;

  // まずtranspileする
  let transpiledJsCode;
  try {
    transpiledJsCode = await Transpile.transpileAll(evalCode, {
      srcPath: targetFile,
    });
  } catch (e) {
    if (verbose) { console.error(e) }
    // TODO: transpileのエラー時にスタックトレースも表示したい。Errorインスタンスにくっつける形で持ってこれる筈なので対応する事
    displayErrorAndExit(e.message + ((targetFile != null) ? ` in ${targetFile}` : ''));
  }
  if (isDump) {
    console.log(transpiledJsCode);
    return;
  }

  const failedAndExit = (e) => {
    // NB: ChildProcess.execの生成する例外はe.message内にstderrを内包している
    //     らしい。そしてstderrはSh.shWithTmpFileAsync()内でも出力しているので
    //     冗長になる。とても悩ましいがe.messageは隠す事にする。
    //     (execより手前でエラーが発生した場合は原因が分からなくなる問題がある)
    //     デバッグ中は特に困るので -v オプションで出すようにした。
    if (verbose) { console.error(e) }
    const msg = (targetFile != null) ? `Error in ${targetFile}` : '';
    if (msg) { console.error(msg) }
    Process.exit(1);
  };

  // 最後に別プロセスnodeを起動し、eval実行する
  if (isNeedRun) {
    try {
      Process.stdout.write(await runJsCode(transpiledJsCode, isShouldPrintLastValue, isVerbose, isMjs));
    } catch (e) {
      failedAndExit(e);
    }
  }
};


await main();
