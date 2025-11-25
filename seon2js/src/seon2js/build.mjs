

// TODO: config.isNeedCleanUpDstDirAfter が真の時は、
//       システムの一時ディレクトリにファイルツリーを書き出しているので、
//       ctrl-Cで終了する際は config.dstDir を消すようにしたい。
//       シグナル監視をつけて実装する事！
//       (シグナル監視のやり方は旧asg-playerにある)


import Fs from 'node:fs';
import Path from 'node:path';
import Process from "node:process";
import ChildProcess from "node:child_process";
import Chokidar from 'chokidar';

import * as Transpile from "./transpile.mjs";
import * as Sh from "./sh.mjs";


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


const transpileSeonToJs = (config, srcPath, dstPath) => {
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
    if (mapResult) {
      const mapPath = dstPath + ".map";
      Fs.writeFileSync(mapPath, mapResult);
      transpiledJsCode += `\n//# sourceMappingURL=${Path.basename(mapPath)}`;
      msg += `, and generate "${mapPath}"`;
    }
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


const bundleState = {
  waitMsec: 500,
  reservedTimestamp: undefined,
  isRunningSuperviser: undefined,
  isRunningBundle: undefined,
  isNeedRerunBundle: undefined,
};


// 複数のストレージpathと、その内のどれかに所属する一つのリソースpathを
// 引数に渡す。すると返り値として対応するストレージpathの一つが返される。
// 見付からない(resourcePathがstoragePathsの外にある)場合は、undefinedを返す。
// 複数見付かった(storagePaths内に重複がある)場合は、例外を投げる。
// TODO: もっと適切な関数名にしたい
const determineOneStoragePath = (storagePaths, resourcePath) => {
  // Path.relativeの結果が .. で始まらないならマッチ
  const results = storagePaths.filter((sp)=>Path.relative(sp, resourcePath).indexOf('..'));
  if (!results.length) { return }
  if (results.length == 1) { return results[0] }
  tnE(`found multiple storagePaths, cannot determine one by resourcePath=${JSON.stringify(resourcePath)}, storagePaths=${JSON.stringify(storagePaths)}`);
};


// TODO: この回りは https://esbuild.github.io/api/ 辺りを確認しながら、
//       外部プロセス実行ではなくesbuildを実行したい。
//       できれば差分ビルドおよびwatchモードにも対応させたい(めんどい)
export const formatBundleCommand = (config) => {
  const { srcDirs, dstDir, bundleOutFile, bundleParams } = config;
  const {
    bundleEntryPoints,
    bundleExtraArgs = '',
  } = bundleParams;
  // --bundle-entry-point で指定されたpathがもし --src-dir 内のpathであれば、それは --dst-dir 内のpathへとマッピングしなくてはならない
  const resolveEntryPointPath = (p) => {
    let entryPointPath = p;
    const matchedSrcDir = determineOneStoragePath(srcDirs, p);
    if (matchedSrcDir) {
      entryPointPath = exchangeDstExt(p.replace(matchedSrcDir, dstDir));
    }
    if (!Fs.existsSync(entryPointPath)) {
      const msg = `!!! bundle entry point file ${entryPointPath} not found, cannot bundle !!!`;
      console.log(msg);
      throw new Error(msg);
    }
    return entryPointPath;
  };
  const O_ENTRYPOINTS = bundleEntryPoints.map(resolveEntryPointPath).join(' ');
  const shCode = `npx esbuild ${O_ENTRYPOINTS} --bundle --outfile=${bundleOutFile} ${bundleExtraArgs}`;
  //console.log(shCode); // for debug
  return shCode;
};
const executeBundle = async (config) => {
  const shCode = formatBundleCommand(config);
  const [err, stdout, stderr] = await Sh.shExecAsync(shCode);
  if (stdout.length) { console.log(stdout) }
  if (stderr.length) { console.error(stderr) }
  if (err) {
    const beeper = config.isBeepError ? "\u0007" : "";
    console.error(`${beeper}failed to bundle!`);
    console.log("Error: " + err.message);
  } else {
    console.log(`done to bundle all files to ${config.bundleOutFile} !`);
  }
};

// ファイルが変動があった。とりあえず予約フラグを立てておき、
// 一定秒数後にbundleOutFileを更新する
// TODO: これesbuild以外にも他のbundlerを使えるようにしておきたい(難しい)
const applyBundleLater = (config) => {
  if (config.bundleOutFile == null) { return } // 無指定なら何もしない
  bundleState.reservedTimestamp = Date.now() + bundleState.waitMsec;
  if (bundleState.isRunningBundle) {
    // 現在bundle実行中なら、終わるのを待ってから再実行する
    // (その為のフラグを立てる)
    isNeedRerunBundle = 1;
  }
  if (!bundleState.isRunningSuperviser) {
    bundleState.isRunningSuperviser = 1;
    const superviser = async () => {
      if (Date.now() < bundleState.reservedTimestamp) {
        setTimeout(superviser, 50);
        return;
      }
      bundleState.isRunningBundle = 1;
      await executeBundle(config);
      if (bundleState.isNeedRerunBundle) {
        bundleState.isNeedRerunBundle = 0;
        await executeBundle(config);
      }
      bundleState.isRunningBundle = 0;
      bundleState.isRunningSuperviser = 0;
    };
    setTimeout(superviser, 50);
  }
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
        applyBundleLater(config);
        break;
      // - s2js, s2mjs は変換してdstに吐く。ログも出す
      case ".s2js":
      case ".s2mjs":
        transpileSeonToJs(config, srcPath, dstPath);
        applyBundleLater(config);
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
          applyBundleLater(config);
          console.log(`done to retranspile all files!`);
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
    console.log(`${beeper}found "${srcPath}", but occur exception`);
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
  const oneSrcDir = determineOneStoragePath(config.srcDirs, srcPath);
  if (oneSrcDir == null) {
    tnE(`${JSON.stringify(srcPath)} is in outside of config.srcDirs=${JSON.stringify(config.srcDirs)}`);
  }
  return exchangeDstExt(srcPath.replace(oneSrcDir, config.dstDir));
};


const runOnce = (config) => config.srcDirs.forEach((srcDir) => {
  if (Fs.statSync(srcDir).isDirectory()) {
    // srcDirはディレクトリだった。内部にあるファイル全部を再帰的に処理する
    traverseDir(srcDir, (srcPath, builtPath) => processFile(
      config,
      srcPath,
      exchangeDstExt(Path.join(config.dstDir, builtPath)),
      false));
  } else {
    // srcDirはディレクトリではなく単一ファイルだった。一個だけ処理して終了
    processFile(
      config,
      srcDir,
      exchangeDstExt(Path.join(config.dstDir, Path.basename(srcDir))),
      false);
  }
});


const runWatch = (config) => {
  console.log(`start to supervise ${config.srcDirs}`);
  const watcher = Chokidar.watch(config.srcDirs, {
    // TODO: ここの設定をconfigからいじれるようにする？
    //ignored: /(^|[\/\\])\../, // ignore dotfiles // 普通に ../seon2js/ みたいに指定するケースがあったので廃止
    //ignored: (path, stats) => stats?.isFile() && !path.endsWith('.js'), // こういう関数渡しも可能らしい
    //usePolling: true, // polling監視を行う。cpuを消費するが、削除されたファイルが復活した時の監視ミスがなくなるらしい(これをしないと、src内のディレクトリを消してから復活させた時に、中のファイルの変更判定を追跡できなくなる不具合があるらしい)。でも有効にするかどうかはかなり悩む
    persistent: true,
    atomic: true,
    awaitWriteFinish: { // ファイルサイズに変化がなくなるまでイベント発火を待つ
      pollInterval: 50,
      stabilityThreshold: 100,
    },
  });
  const updateFn = (srcPath) => processFile(config, srcPath, resolveDstPath(config, srcPath));
  const unlinkFn = (srcPath) => {
    const dstPath = resolveDstPath(config, srcPath);
    if (!Fs.existsSync(dstPath)) {
      return console.log(`${srcPath} unlinked, but ${dstPath} is not exists`);
    }
    console.log(`${srcPath} unlinked, and unlink ${dstPath}`);
    try {
      Fs.unlinkSync(dstPath);
    } catch (e) {
      console.log(e);
    }
  };
  watcher.on('add', updateFn);
  watcher.on('change', updateFn);
  watcher.on('unlink', unlinkFn);
  //watcher.on('error', (e) => console.error(e));
};


// TODO: もっと適切な名前にしたい
export const bootstrap = (config) => {
  //console.log(config); // for debug
  mkdirp(config.dstDir);
  const runFn = config.isWatch ? runWatch : runOnce;
  runFn(config);
};


