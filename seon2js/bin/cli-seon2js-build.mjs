#!/usr/bin/env node


import Fs from 'node:fs';
import Path from 'node:path';
import Process from "node:process";
import * as NodeUtil from "node:util";
import Chokidar from 'chokidar';

import * as Seon from 'seon/seon';
import * as SeonUtil from 'seon/util';

import * as Build from "seon2js/build";


// TODO: 多重実行の禁止！


const parseOptions = {
  allowPositionals: false,
  options: {
    "help": {
      type: "boolean",
      short: "h",
    },
    "src-dir": {
      type: "string",
      multiple: true,
    },
    "src": {
      type: "string",
      multiple: true,
    },
    "dst-dir": {
      type: "string",
    },
    "watch": {
      type: "boolean",
      //short: "w",
    },
    "show-error-stacktrace": {
      type: "boolean",
      short: "s",
    },
    "beep-error": {
      type: "boolean",
      short: "b",
    },
    // コンパイルフラグ系は `tf-` のprefixをつけて区別する(transpile-flags)
    "tf-prod": {
      type: "boolean",
    },
    "tf-eliminate-assert": {
      type: "boolean",
    },
    "tf-rename-const-let": {
      type: "boolean",
    },
    // bundle用の引数は `bundle-` のprefixをつけて区別する
    "bundle-out-file": {
      type: "string",
    },
    "bundle-entry-point": {
      type: "string",
      multiple: true,
    },
    "bundle-extra-args": {
      type: "string",
      multiple: true,
    },
    // TODO: あとmap生成フラグが必要。いい名前を決める事
  }};


const displayUsageAndExit = () => {
  const basename = Path.basename(Process.argv[1]);
  console.error(`usage:
  npx ${basename}
    --src-dir=path/to/src # specify source directory or file
    [--src-dir=more/src] # can specify multiple directories or files
    [--src=another/src] # same as --src-dir

    [--dst-dir=path/to/html/dst] # output to one directory, and/or
    [--bundle-out-file=path/to/html/out.js] # output and bundle to one file, should need with --bundle-entry-point
    [--bundle-entry-point='...'] # esbuild-option: entryPoints
    [--bundle-extra-args='...'] # esbuild-option: extra args if you want (default: '')

    [--watch] # start to supervise all src-dir and transpile
    [-b --beep-error] # alert error with beep
    [-s --show-error-stacktrace] # display stacktrace on error (for debug)

    [--tf-eliminate-assert] # transpile-flag: eliminate-assert
    [--tf-rename-const-let] # transpile-flag: rename-const-let (experimental)
    [--tf-prod] # transpile-flag: prod, eliminate-assert

    [-h --help] # show this help`);
  Process.exit(1);
};


const main = () => {
  const cmdArgs = NodeUtil.parseArgs(parseOptions);
  const srcDirs = ([]).concat((cmdArgs.values['src-dir'] || []), (cmdArgs.values['src'] || []));
  let dstDir = cmdArgs.values['dst-dir'];
  const isHelp = cmdArgs.values['help'];
  const isWatch = cmdArgs.values['watch'];
  const isBeepError = cmdArgs.values['beep-error'];
  const isShowErrorStacktrace = cmdArgs.values["show-error-stacktrace"];
  const isMakeMapFile = false; // TODO: 将来対応予定
  const bundleOutFile = cmdArgs.values['bundle-out-file'];
  const bundleParams = {
    bundleEntryPoints: (cmdArgs.values['bundle-entry-point']||[]),
    bundleExtraArgs: (cmdArgs.values['bundle-extra-args']||[]).join(' '),
  };
  let isNeedCleanUpDstDirAfter;
  //const [foo, bar, baz] = cmdArgs.positionals;
  if (isHelp) { return displayUsageAndExit() }
  if (!dstDir) {
    if (!bundleOutFile) { return displayUsageAndExit() }
    dstDir = Fs.mkdtempSync("/tmp/send2js-build-");
    isNeedCleanUpDstDirAfter = 1;
  }
  if (bundleOutFile && !bundleParams.bundleEntryPoints.length) {
    console.log(`Error: --bundle-out-file should need with --bundle-entry-point`);
    Process.exit(1);
  }
  if (!srcDirs.length) { return displayUsageAndExit() }
  if (!srcDirs.every((d)=>Fs.existsSync(d))) {
    console.log(`src-dir directory not found: ${JSON.stringify(srcDirs)}`);
    Process.exit(1);
  }
  const seon2jsBaseDir = Path.resolve(Path.dirname(Process.argv[1]), '../seon2js');
  // 組み込みのseon2js.lang(つまりclojure.core相当)を強制的に追加する
  // srcDirs.unshift(Path.join(seon2jsBaseDir, 'src-seon2js-lib')); // NB: これはなくなった。ただ将来にまた復活させる可能性があるのでコメントは残しておく
  const isRunningWatchServer = 0; // TODO: 既にwatchサーバが起動していたらエラー終了する事！しかしどうやって判定させる…
  if (isRunningWatchServer) {
    throw new Error('Already running watch server!');
  }
  const isProd = cmdArgs.values['tf-prod'];
  const isEliminateAssert = isProd || cmdArgs.values['tf-eliminate-assert'];
  const isRenameConstLet = cmdArgs.values['tf-rename-const-let'];
  const transpileFlags = {
    isProd,
    isEliminateAssert,
    isRenameConstLet,
  };
  const config = {
    srcDirs,
    dstDir,
    //seon2jsBaseDir, // NB: これは不要になった筈だが、もしかするとまだ必要かもしれない。消す予定だが、一旦保留
    isWatch,
    isBeepError,
    isShowErrorStacktrace,
    isMakeMapFile,
    transpileFlags,
    isNeedCleanUpDstDirAfter,
    bundleOutFile,
    bundleParams,
  };
  Build.bootstrap(config);
};


main();
