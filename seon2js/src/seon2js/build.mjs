

import Fs from 'node:fs';
import Path from 'node:path';
import Process from "node:process";
import Chokidar from 'chokidar';


import * as Seon from 'seon/seon';
import * as SeonUtil from 'seon/util';


import * as Transpile from "./transpile.mjs";
//import * as Gcc from "./gcc.mjs";
//import * as Sh from "./sh.mjs";


// TODO: windows対応


const tnE = (msg) => { throw new Error(msg) };


const mkdirp = (path) => Fs.mkdirSync(path, {recursive: true, mode: 0o755});


const getFileMtime = (path) => Fs.statSync(path).mtime;


const copyFile = (srcPath, dstPath) => {
  mkdirp(Path.dirname(dstPath));
  Fs.copyFileSync(srcPath, dstPath);
};


const exchangeExt = (p, newExt) => {
  const pathParsed = { ... Path.parse(p) };
  pathParsed.ext = newExt;
  delete pathParsed.base;
  return Path.format(pathParsed);
};
const splitPathWithoutExt = (p) => exchangeExt(Path.normalize(p), '').split(Path.sep);


const isSafeNamespaceString = (namespaceString) => {
  // TODO: これどうやって判定する？
  return 1; // TODO
};


// 拡張子抜きにしてから、末尾から一致している部分を抜き、slashをdotにする
// ただしそれがnamespace化ができない名前だった場合はundefinedを返す
const calculateCurrentNamespace = (srcPath, dstPath) => {
  const a = splitPathWithoutExt(srcPath);
  const b = splitPathWithoutExt(dstPath);
  const result = [];
  while (a.length && b.length) {
    const av = a.pop();
    const bv = b.pop();
    if (av !== bv) { break }
    result.unshift(av);
  }
  if (!result.length) { tnE(`assertion failed`) }
  const currentNamespaceString = result.join('.');
  if (isSafeNamespaceString(currentNamespaceString)) { return currentNamespaceString }
};


const transpileSeonToJs = async (config, srcPath, dstPath) => {
  const isMakeMapFile = config.isMakeMapFile;
  const currentNamespace = calculateCurrentNamespace(srcPath, dstPath);
  const content = Fs.readFileSync(srcPath, "utf-8");
  let transpiledJsCode = Transpile.transpileAll(content, {
    srcPath,
    isMakeMapFile,
    isUseCachedSpVars: false,
    transpileFlags: config.transpileFlags,
    currentNamespace,
  });
  let msg = `found "${srcPath}", transpile to "${dstPath}"`;
  mkdirp(Path.dirname(dstPath));
  // NB: 処理の都合上、mapファイルを先に処理する必要がある
  //     (mapファイルがある時は末尾にsourceMappingURLを追加する必要がある為)
  if (isMakeMapFile) {
    const mapResult = Transpile.getLastResultMap();
    const mapPath = dstPath + ".map";
    Fs.writeFileSync(mapPath, mapResult);
    transpiledJsCode += `\n//# sourceMappingURL=${Path.basename(mapPath)}`;
    msg += `, and generate "${mapPath}"`;
  }
  Fs.writeFileSync(dstPath, transpiledJsCode);
  console.log(msg);
};


// TODO: ここの処理をある程度processFileと共通化させたい
const srcExtToDstExt = {
  ".seon": ".json",
  ".s2js": ".js",
  ".s2mjs": ".mjs",
};
const resolveDstExt = (srcPath) => {
  const srcExt = Path.extname(srcPath);
  return srcExtToDstExt[srcExt] || srcExt;
};


const processFile = (config, srcPath, dstPath, isCheckMtime=false) => {
  if (isCheckMtime && Fs.existsSync(dstPath)) {
    if (getFileMtime(srcPath) <= getFileMtime(dstPath)) {
      console.log(`found "${srcPath}", but older than "${dstPath}"`);
      return;
    }
  }
  const srcExt = Path.extname(srcPath);
  try {
    // TODO: switchではなく、srcExtToDstExtみたいにテーブル化したい
    switch (srcExt) {
      // - json, js, mjs はそのままコピーする。ログも出す
      case ".json":
      case ".js":
      case ".mjs":
        console.log(`found "${srcPath}", copy to "${dstPath}"`);
        copyFile(srcPath, dstPath);
        break;
      // - s2js, s2mjs は変換してdstに吐く。ログも出す
      case ".s2js":
      case ".s2mjs":
        transpileSeonToJs(config, srcPath, dstPath);
        break;
      // - s2sp はdefspecial用ファイル。処理がちょっと複雑になる
      case ".s2sp":
        if (config.isWatch) {
          // runWatchからの実行なら、このs2spファイルをimport-s2spしている
          // 全てのソースを再トランスパイルする必要がある。
          // 判定が大変なので、単に全部を再トランスパイルする。
          // ただしその際にs2sp更新が再帰的に行われる為、
          // 無限再帰しないようにする必要がある。
          console.log(`found special file "${srcPath}", retranspile all files!`);
          runOnce({ ... config, isWatch: false, isInRecursive: true });
          console.log(`done retranspile all files!`);
          // TODO: これはrunWatch初回実行時はとてもややっこしくなるし重くなる。なんとかならない？
        } else {
          // runOnceからの実行なら何もしない
          console.log(`found special file "${srcPath}", but do nothing`);
        }
        break;
      // - それ以外は何もしないが、ログは出す
      default:
        console.log(`found unknown file "${srcPath}", but do nothing`);
    }
  } catch (e) {
    const beeper = config.isBeepError ? "\u0007" : "";
    console.log(`found "${srcPath}", but occur exception ${beeper}`);
    if (config.isShowErrorStacktrace) { console.log(e) }
    console.log("Error: " + e.message);
  }
};


const traverseDir = (dirPath, handleFn, capPath="") => {
  const allDirents = Fs.readdirSync(dirPath, {withFileTypes: true});
  for (const dirent of allDirents) {
    const absPath = Path.join(dirPath, dirent.name);
    const builtPath = Path.join(capPath, dirent.name);
    if (dirent.isDirectory()) {
      traverseDir(absPath, handleFn, builtPath);
    } else {
      handleFn(absPath, builtPath);
    }
  }
};


const exchangeDstExt = (dstPath) => exchangeExt(dstPath, resolveDstExt(dstPath));


const resolveDstPath = (config, srcPath) => {
  // まずconfig.srcDirsから、srcPathが先頭にないものを除外する
  const srcs = config.srcDirs.filter((src)=>!srcPath.indexOf(src));
  // srcsが1個に確定しない場合はエラー
  if (srcs.length !== 1) { tnE(`cannot determine dstPath from srcPath=${srcPath}, srcDirs=${JSON.stringify(config.srcDirs)}`) }
  return exchangeDstExt(srcPath.replace(srcs[0], config.dstDir));
};


const runOnce = (config) => config.srcDirs.forEach((srcDir)=>traverseDir(
  srcDir,
  (srcPath, builtPath) => processFile(
    config,
    srcPath,
    exchangeDstExt(Path.join(config.dstDir, builtPath)),
    false)));


const runWatch = (config) => {
  console.log(`start to supervise ${config.srcDirs}`);
  const watcher = Chokidar.watch(config.srcDirs, {
    // TODO: ここの設定をconfigからいじれるようにする
    //ignored: /(^|[\/\\])\../, // ignore dotfiles // 普通に ../seon2js/ みたいに指定するケースがあったので廃止
    //usePolling: true, // polling監視を行う。cpuを消費するが、削除されたファイルが復活した時の監視ミスがなくなるらしい(これをしないと、src内のディレクトリを消してから復活させた時に、中のファイルの変更判定を追跡できなくなる不具合があるらしい)。でも有効にするかどうかはかなり悩む
    awaitWriteFinish: { // ファイルサイズに変化がなくなるまでイベント発火を待つ
      pollInterval: 50,
      stabilityThreshold: 100,
    },
  });
  const updateFn = (srcPath) => processFile(config, srcPath, resolveDstPath(config, srcPath));
  const unlinkFn = (srcPath) => {
    const dstPath = resolveDstPath(config, srcPath);
    console.log(`unlink ${srcPath}, and unlink ${dstPath}`);
    try {
      Fs.unlinkSync(dstPath);
    } catch (e) {
      console.log(e);
    }
  };
  watcher.on('add', updateFn);
  watcher.on('change', updateFn);
  watcher.on('unlink', unlinkFn);
};


// TODO: もっと適切な名前にしたい
export const bootstrap = (config) => {
  //console.log(config); // for debug
  mkdirp(config.dstDir);
  const runFn = config.isWatch ? runWatch : runOnce;
  runFn(config);
};


