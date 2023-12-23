#!/usr/bin/env node


import fs from 'node:fs';
import path from 'node:path';
import process from "node:process";
import { parseArgs } from "node:util";
import chokidar from 'chokidar';

import * as sa from 'seon/sa';
import * as sym from 'seon/sym';
import * as seon from 'seon/seon';
import * as seonUtil from 'seon/util';

import * as compile from './src-compiler/seon2js/compiler/v0/compile.mjs';
// TODO: もうちょっと↑のcompileとここのcliとで、責務を正しく分担させたい(今はかなりぐちゃぐちゃ)


// TODO: watch中に、もしs2spファイルが更新された場合、それを参照している全てのs2mjsファイルも再度アップデートし直さないといけない。判定が難しいなら「抱えている全ファイルを再更新」でもいいので、あとで実装しておく事


// TODO: 多重実行の禁止！


// TODO: windows対応


// TODO: それぞれのsrcDir毎に配置先(dstDir)を変えれる機能がほしい。実装自体は簡単そうだが、引数の与え方が難しい(複数のsrcDirと複数のdstDirの内、どれがどれに対応してるのかを指定できないといけない)。引数にファイルとしてconfig.seonみたいなの渡す方がよい？


const tnE = (msg) => { throw new Error(msg) };


const mkdirp = (path) => fs.mkdirSync(path, {recursive: true, mode: 0o755});


const getFileMtime = (path) => fs.statSync(path).mtime;


const copyFile = (srcPath, dstPath) => {
  mkdirp(path.dirname(dstPath));
  fs.copyFileSync(srcPath, dstPath);
};


const convertSeonToJson = (config, srcPath, dstPath) => {
  const seonString = fs.readFileSync(srcPath, "utf-8");
  const jsonString = seonUtil.convertSeonStringToJsonString(seonString, srcPath);
  mkdirp(path.dirname(dstPath));
  fs.writeFileSync(dstPath, jsonString);
};


const splitPathWithoutExt = (p) => exchangeExt(path.normalize(p), '').split(path.sep);
const isSafeNamespacePart = (s) => sym.isValidNamespaceString(s) && ((/^[-\w]+$/).test(s));
const canGenerateNamespace = (p) => splitPathWithoutExt(p).every(isSafeNamespacePart);


// 拡張子抜きにしてから、末尾から一致している部分を抜き、slashをdotにする
// ただしそれがnamespace化ができない名前だった場合はnullyを返す
// (具体的には 0.s2mjs とか foo.bar.s2mjs とかがアウト)
const calculateCurrentNamespace = (srcPath, dstPath) => {
  const a = splitPathWithoutExt(srcPath);
  const b = splitPathWithoutExt(dstPath);
  const result = [];
  while (a.length && b.length) {
    const av = a.pop();
    const bv = b.pop();
    if (av !== bv) { break }
    if (!canGenerateNamespace(av)) { return }
    result.unshift(av);
  }
  if (!result.length) { tnE(`assertion failed`) }
  return result.join('.');
};

// TODO: s2jsから(m)jsを生成する際に、mapファイルも同時に生成したい！面倒そうだが…
const transpileSeonToJs = (config, srcPath, dstPath) => {
  const mapPath = dstPath + ".map";
  // pathがnamespace安全な文字だけで構築されていない場合はスキップする
  const currentNamespace = calculateCurrentNamespace(srcPath, dstPath);
  if (!currentNamespace) {
    console.log(`found "${srcPath}", but failed to generate namespace from path, skipped`);
    return;
  }
  const seonConfig = {
    filename: srcPath,
    currentNamespace: currentNamespace,
  };
  const exprs = seonUtil.renameInternalSeonNamespaces(seon.readAllFromSeonString(seonConfig, fs.readFileSync(srcPath, "utf-8")), 's2');
  // TODO: 可能ならこの処理はcompile内に移動したい
  const needPrependLangFnAutomatically = (srcPath.indexOf('/seon2js/lang/v0/s2.s2mjs') === -1); // TODO: 判定をもっと厳密にしたい
  if (needPrependLangFnAutomatically) {
    const langFnPath = path.relative(path.dirname(dstPath), path.join(config.dstDir, 'seon2js/lang/v0/s2.mjs'));
    exprs.unshift(seon.readFromSeonString(`(s2-import ${JSON.stringify('./'+langFnPath)})`));
  }
  const env = compile.makeEnv({
    config: config,
    mapPath: mapPath,
    metaMap: seon.getLastMetaMap(),
    seonState: seon.getLastSeonState(),
    // TODO: コンパイルオプションフラグをここに入れる
  });
  const needMakeMap = false; // TODO: コンパイルオプションフラグから取る？
  const result = compile.compileAll(env, exprs);
  const mapResult = compile.makeMap(env);
  const tail = needMakeMap ? compile.makeTail(path.basename(mapPath)) : '';
  mkdirp(path.dirname(dstPath));
  fs.writeFileSync(dstPath, result + tail);
  console.log(`found "${srcPath}", transpile to "${dstPath}"`);
  if (needMakeMap) {
    fs.writeFileSync(mapPath, mapResult);
    console.log(`and generate "${mapPath}"`);
  }
};


// TODO: ここの処理をある程度processFileと共通化させたい
const srcExtToDstExt = {
  ".seon": ".json",
  ".s2js": ".js",
  ".s2mjs": ".mjs",
};
const resolveDstExt = (srcPath) => {
  const srcExt = path.extname(srcPath);
  return srcExtToDstExt[srcExt] || srcExt;
};


const processFile = (config, srcPath, dstPath, isCheckMtime=false) => {
  if (isCheckMtime && fs.existsSync(dstPath)) {
    if (getFileMtime(srcPath) <= getFileMtime(dstPath)) {
      console.log(`found "${srcPath}", but older than "${dstPath}"`);
      return;
    }
  }
  const srcExt = path.extname(srcPath);
  // TODO: switchではなく、srcExtToDstExtみたいにテーブル化した方がよい
  switch (srcExt) {
    // - json, js, mjs はそのままコピーする。ログも出す
    case ".json":
    case ".js":
    case ".mjs":
      console.log(`found "${srcPath}", copy to "${dstPath}"`);
      copyFile(srcPath, dstPath);
      break;
    // - seon, s2js, s2mjs は変換してdstに吐く。ログも出す
    case ".seon":
      console.log(`found "${srcPath}", transpile to "${dstPath}"`);
      convertSeonToJson(config, srcPath, dstPath);
      break;
    case ".s2js":
    case ".s2mjs":
      transpileSeonToJs(config, srcPath, dstPath);
      break;
    // - s2sp はdefspecial用ファイル、何もしないがログは出す
    case ".s2sp":
      console.log(`found special file "${srcPath}", but do nothing`);
      break;
    // - それ以外は何もしないが、ログは出す
    default:
      console.log(`found unknown file "${srcPath}", but do nothing`);
  }
};


const traverseDir = (dirPath, handleFn, capPath="") => {
  const allDirents = fs.readdirSync(dirPath, {withFileTypes: true});
  for (const dirent of allDirents) {
    const absPath = path.join(dirPath, dirent.name);
    const builtPath = path.join(capPath, dirent.name);
    if (dirent.isDirectory()) {
      traverseDir(absPath, handleFn, builtPath);
    } else {
      handleFn(absPath, builtPath);
    }
  }
};


const exchangeExt = (p, newExt) => {
  const pathParsed = { ... path.parse(p) };
  pathParsed.ext = newExt;
  delete pathParsed.base;
  return path.format(pathParsed);
};


const exchangeDstExt = (dstPath) => exchangeExt(dstPath, resolveDstExt(dstPath));


const resolveDstPath = (srcs, dst, srcPath) => {
  // まずsrcsから、srcPath先頭にないものは除外する
  srcs = srcs.filter((src)=>!srcPath.indexOf(src));
  if (srcs.length !== 1) { tnE(`cannot determine dstPath from srcPath=${srcPath}, srcs=${JSON.stringify(srcs)}`) }
  return exchangeDstExt(srcPath.replace(srcs[0], dst));
};


const runOnce = (srcDirs, dstDir, config) => srcDirs.forEach((srcDir)=>traverseDir(
  srcDir,
  (srcPath, builtPath) => processFile(
    config,
    srcPath,
    exchangeDstExt(path.join(dstDir, builtPath)),
    false)));


const runWatch = (srcs, dst, config) => {
  console.log(`start to supervise ${srcs}`);
  const watcher = chokidar.watch(srcs, {
    // TODO: ここの設定をconfigからいじれるようにする
    //ignored: /(^|[\/\\])\../, // ignore dotfiles // 普通に ../seon2js/ みたいに指定するケースがあったので廃止
    //usePolling: true, // polling監視を行う。cpuを消費するが、削除されたファイルが復活した時の監視ミスがなくなるらしい(これをしないと、src内のディレクトリを消してから復活させた時に、中のファイルの変更判定を追跡できなくなる不具合があるらしい)。でも有効にするかどうかはかなり悩む
    awaitWriteFinish: { // ファイルサイズに変化がなくなるまでイベント発火を待つ
      pollInterval: 50,
      stabilityThreshold: 100,
    },
  });
  const updateFn = (srcPath) => {
    const dstPath = resolveDstPath(srcs, dst, srcPath);
    try {
      processFile(config, srcPath, dstPath);
    } catch (e) {
      console.log(`found "${srcPath}", but occur exception`);
      console.log(e.stack);
    }
  };
  const unlinkFn = (srcPath) => {
    const dstPath = resolveDstPath(srcs, dst, srcPath);
    console.log(`unlink ${srcPath}, and unlink ${dstPath}`);
    try {
      fs.unlinkSync(dstPath);
    } catch (e) {
      console.log(e);
    }
  };
  watcher.on('add', updateFn);
  watcher.on('change', updateFn);
  watcher.on('unlink', unlinkFn);
};


const displayUsageAndExit = () => {
  console.log(`usage:
    npx seon2js --srcDir path/to/src --srcDir more/src --srcDir another/src --dstDir path/to/html/dst [--watch]`);
  process.exit(1);
};


const main = () => {
  const cmdArgs = parseArgs({
    allowPositionals: true,
    options: {
      "help": {
        type: "boolean",
        short: "h",
      },
      "srcDir": {
        type: "string",
        multiple: true,
      },
      "dstDir": {
        type: "string",
      },
      "watch": {
        type: "boolean",
        //short: "w",
      },
      // TODO: 以下あたりの追加のスイッチが必要。いい名前を決める事
      //       - debug除去フラグ
      //       - assert除去フラグ
      //       - const -> let 変換最適化フラグ
      //       - prodフラグ(上記フラグをまとめてオンにするやつ)
      //       - map生成フラグ
      //       - 他には？
      // TODO: 上記スイッチ実装後、忘れずにdisplayUsageAndExitとREADME内usageにも追記する事
    }});
  const { help, srcDir, dstDir, watch } = cmdArgs.values;
  //const [foo, bar, baz] = cmdArgs.positionals;
  if (help) { displayUsageAndExit() }
  if (!srcDir) { displayUsageAndExit() }
  if (!dstDir) { displayUsageAndExit() }
  if (!srcDir.every((d)=>fs.existsSync(d))) {
    console.log(`srcDir directory not found: ${srcDir}`);
    process.exit(1);
  }
  const seon2jsBaseDir = path.resolve(path.dirname(process.argv[1]), '../seon2js');
  // 組み込みのseon2js.lang(つまりclojure.core相当)を強制的に追加する
  srcDir.unshift(path.join(seon2jsBaseDir, 'src'));
  const isRunningWatchServer = 0; // TODO: 既にwatchサーバが起動していたらエラー終了する事！しかしどうやって判定させる…
  if (isRunningWatchServer) {
    throw new Error('Already running watch server!');
  }
  const config = {
    srcDir,
    dstDir,
    seon2jsBaseDir,
    // TODO: フラグ系もここに入れる必要がある
  };
  mkdirp(dstDir);
  const runArgs = [srcDir, dstDir, config];
  const runFn = watch ? runWatch : runOnce;
  runFn(... runArgs);
};


main();
