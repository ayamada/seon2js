#!/usr/bin/env node


import * as Fs from 'node:fs';
import * as Path from "node:path";
import * as Process from "node:process";
import * as Os from "node:os";
import * as NodeUtil from "node:util";
import * as ChildProcess from "node:child_process";


import * as Transpile from "seon2js/transpile";
import * as Gcc from "seon2js/gcc";
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
    "dump-only-transpile-result": {
      type: "boolean",
      short: "t",
    },
    "compilation-level": {
      type: "string",
      short: "O",
    },
    "compilation-level-is-advanced": {
      type: "boolean",
      short: "A",
    },
  }};


const displayUsageAndExit = () => {
  const basename = Path.basename(Process.argv[1]);
  console.error(`usage:
    npx ${basename}
      [foo.s2mjs] # read seon2js code by file and run
      [-e --eval "..."] # read seon2js code by parameter and run
      [-p --print "..."] # eval code and print last result (experimental)
      [-O --compilation-level "SIMPLE"] # pass to -O for gcc argument
      [-A] # shortcut for '-O ADVANCED'
      [-d --dump] # apply gcc and dump gcc-passed code, do not run
      [-t --dump-only-transpile-result] # dump transpiled js code, do not run
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
  let isDump = parsed.values["dump"];
  let isDumpOnlyTranspileResult = parsed.values["dump-only-transpile-result"];
  // デフォルトはeval実行をする
  let isNeedRun = 1;
  // ただし、もしisDumpのどちらかが真なら、eval引数のeval実行はしない
  if (isDump || isDumpOnlyTranspileResult) { isNeedRun = false }
  // もしeval実行が偽なら、最低表示保証としてisDumpを真にしておく
  if (!isNeedRun) { isDump = true };
  // ただし、もしisDumpが両方真なら、isDumpOnlyTranspileResultのみ真にする
  if (isDump && isDumpOnlyTranspileResult) {
    isDump = false;
  }
  const compilationLevelOriginal = parsed.values["compilation-level"];
  let compilationLevel = compilationLevelOriginal;
  const isCompilationLevelAdvanced = parsed.values["compilation-level-is-advanced"];
  if (isCompilationLevelAdvanced) {
    compilationLevel = "ADVANCED";
  }
  if (!compilationLevel) {
    compilationLevel = "SIMPLE";
  }
  // gccにかけるかどうか。当初は-t以外はかけるようにしていたが、
  // あまりに重いのでgcc関連のオプションが指定された時だけかける事にした。
  // 具体的には以下が相当する。
  const isApplyGcc = (isDump || compilationLevelOriginal || isCompilationLevelAdvanced);

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
  if (isDumpOnlyTranspileResult) {
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

  // 次にgccにかける
  let finalJsCode = transpiledJsCode;
  if (isApplyGcc) {
    try {
      finalJsCode = await Gcc.compileAsync(transpiledJsCode, {
        compilationLevel,
        formatting: "PRETTY_PRINT",
        extraOptions: "",
      }, verbose);
    } catch (e) {
      failedAndExit(e);
    }
    if (isDump) {
      console.log(finalJsCode);
      return;
    }
  }

  // 最後に別プロセスnodeを起動し、eval実行する
  if (isNeedRun) {
    try {
      Process.stdout.write(await runJsCode(finalJsCode, isShouldPrintLastValue, isVerbose, isMjs));
    } catch (e) {
      failedAndExit(e);
    }
  }
};


await main();
