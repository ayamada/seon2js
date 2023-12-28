import * as sa from 'seon/sa';
import * as sym from 'seon/sym';
import * as seon from 'seon/seon';
import * as seonUtil from 'seon/util';


import { default as fs } from "node:fs";
import { default as process } from "node:process";
import { default as path } from "node:path";


const car = (a) => a[0];
const cdr = (a) => a.slice(1);
const cadr = (a) => a[1];
const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const isStringPure = (s) => (isStringOrSa(s) && !sa.isSaLikeString(s));
const isNonNegativeInteger = (i) => (Number.isInteger(i) && (0 <= i));
const tnE = (msg) => { throw new Error(msg) };
const assert = (x) => (x || tnE('assertion failed'));


const resolveSymbolToNamespace = (s) => {
  let acc = sym.symbol2mangledName(s);

  tnE('niy'); // TODO: 実fsを参照し、対応するファイルを特定し、ベースファイルからの相対位置を算出しなくてはならない…
  // https://nodejs.org/api/path.html#pathrelativefrom-to を使う必要がある筈

  return acc;
};


let currentEnv;
let currentCompileOne;
let definitions = {};


const defineSpecial = (symbol, fn) => (definitions[symbol] = {
  type: 'special',
  args: [... Array(fn.length).keys()].map((i)=>sym.makeSymbol("arg"+i)),
  content: fn,
});


const resetDefinitions = () => {
  definitions = {};

  // 以下は最初に用意しておく必要がある。他はv0.s2spで定義する

  // (defspecial hoge "(foo, bar)=>foo.code(foo, bar)")
  defineSpecial(sym.makeSymbol('defspecial'), (symbol, jsCode) => {
    //console.log('DEBUG', JSON.stringify(jsCode)); // for debug
    const fn = eval(jsCode); // TODO: evalなしに実装できる方法はある？
    // TODO: おそらく↑のevalをなしにはできない。ただeval用のnamespaceを分離する事は可能そうなので、それだけ対応する方向で考えたい(eval内の変数にはgccのmanglingがかけられないので、そこを退避する為にはeval用namespaceの分離は必須になる筈。ただ今のところはコンパイル部にはgccはかからないので問題はない…)
    defineSpecial(symbol, fn);
    currentEnv.vars[symbol] = definitions[symbol];
    const name = sym.symbol2mangledName(symbol);
    return `/* (defspecial ${name} ...) */`;
  });

  // (defmacro hoge [foo bar] ...)
  defineSpecial(sym.makeSymbol('defmacro'), (symbol, bindings, ... bodies) => {
    tnE('niy'); // TODO: 将来対応予定
    definitions[symbol] = {
      type: 'macro',
      args: bindings,
      content: bodies,
    };
    currentEnv.vars[symbol] = definitions[symbol];
    const name = sym.symbol2mangledName(symbol);
    return `/* (defmacro ${name} ...) */`;
  });

  // (require-specials "src/seon2js/lang/v0/s2.s2sp")
  defineSpecial(sym.makeSymbol('require-specials'), (filepath) => {
    const exprs = seon.readAllFromSeonString({
      filename: filepath,
      currentNamespace: 'user', // TODO: あとでfilepathから生成するようにする
    }, fs.readFileSync(filepath, "utf-8"));
    exprs.forEach(currentCompileOne);
    return `/* (require-specials ${JSON.stringify(filepath)}) */`;
  });
};


const tripleDotSymbol = sym.makeSymbol('...');


// NB: これはs2.s2spのobjectからも使いたいのでここに置いているが、
//     本当はcompile.mjs内のcompileObject用の機能
export const compileObjectEntry = ([k, v]) => {
  const vStr = currentCompileOne(v);
  if (k === tripleDotSymbol) {
    return `... (${vStr})`;
  } else {
    let kStr;
    if (sym.isSymbol(k) || sym.isKeyword(k)) {
      // NB: ここをkebab2camelに通すか、そのままにするかは悩むところだが、
      //     一旦そのままにして進める実装にしてみる事にした。
      //     将来に変更する可能性はある
      kStr = sym.sa2stringForJson(k);
      // プロパティ化できないなら例外を投げる。これが嫌なら文字列で指定する事
      if (!(/^[$A-Za-z_][$\w]*$/).test(kStr)) { tnE(`cannot convert to property name: "${kStr}"`) }
    } else if (sym.isSastring(k)) {
      kStr = JSON.stringify(sym.sastring2string(k));
    } else if (isStringOrSa(k)) {
      kStr = JSON.stringify(k);
    } else {
      // kは必ず何らかの文字列でなくてはならない(symbol, keywordも文字列判定)
      tnE(`invalid key in object: ${k}`);
    }
    return `${kStr}: (${vStr})`;
  }
};


const resolveSeon2jsPath = (config) => config.seon2jsBaseDir;
const resolveS2s2mjsPath = (config) => path.join(resolveSeon2jsPath(config), 'src/seon2js/lang/v0/s2.s2mjs');
const resolveS2s2spPath = (config) => path.join(resolveSeon2jsPath(config), 'src/seon2js/lang/v0/s2.s2sp');


export const setCurrentCompileOne = (compileOne) => (currentCompileOne = compileOne);


export const importSeon2jsBasic = (env, compileOne) => {
  currentEnv = env;
  currentCompileOne = compileOne;
  resetDefinitions();
  Object.keys(definitions).forEach((k)=> (env.vars[k] = definitions[k]));
  // 手でrequire-specialsを実行する事でdefspecialを全部読み込む
  const s2s2spPath = resolveS2s2spPath(currentEnv.config);
  definitions[sym.makeSymbol('require-specials')].content(s2s2spPath);
};


const s2exportTable = {};
const prepareS2exportTable = () => {
  if (!Object.keys(s2exportTable).length) {
    // 各ファイルのtranspile前にs2.s2mjsを読み込み、変換を可能にする必要がある
    const s2s2mjsPath = resolveS2s2mjsPath(currentEnv.config);
    const exprs = seon.readAllFromSeonString({
      filename: s2s2mjsPath,
      currentNamespace: 'user', // TODO: あとでfilepathから生成するようにする
    }, fs.readFileSync(s2s2mjsPath, "utf-8"));
    seonUtil.postwalkWithMeta(exprs, (expr) => {
      if (isArray(expr) && sym.isSymbol(expr[0]) && (!sym.symbol2string(expr[0]).indexOf('s2-export-'))) { s2exportTable[expr[1]] = 1 }
      return expr;
    });
  }
};


// NB: s2.s2spの為に、頻出する処理を以下のルールで短縮定義しておく
// - 大文字始まり(is等の例外あり)
// - 数文字程度(頻出ほど文字数を少なく)
const S = sym.makeSymbol;
const K = sym.makeKeyword;
const C = (expr) => currentCompileOne(expr); // NB: currentCompileOne自体がletで書き変わるので、直代入できない事に注意
const S2MN = sym.symbol2mangledName;
const K2MN = sym.keyword2mangledName;
const isS = sym.isSymbol;
const isK = sym.isKeyword;
const isV = seon.isVector;
const JSONS = JSON.stringify;


// import対象の拡張子が `.s2mjs` 等だった場合は、トランスパイル後の拡張子である `.mjs` 等に変更する必要がある。その処理をする
const reformImportPath = (importPath) => {
  if (!isStringPure(importPath)) { return importPath }
  return importPath.replace(/\.s2(m?js)$/, '.$1');
};


// https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements
// NB: いきなり { が出現した場合は「ブロック」のstatementとみなす。
//     なので、objectを示す場合は必ず ({ ... }) 表記にする事。
// TODO: 現状だと return$aaa みたいな変数名があった時に誤認する。時間のある時に正規表現の \b のところを考え直す事(案外難しい)
const statementBeginningRe = /^(return|break|continue|throw|if|switch|try|var|let|const|do|for|while|export)\b/;
// 引数の文字列がstatementっぽい識別子で始まっているなら真を返す
const isBeginStatement = (s) => (statementBeginningRe.test(s) || !s.indexOf('{'));


// NB: これはfnやdo等で共通的に使う。
// - bodiesが空なら {} を返す
// - bodiesがstatementを含んでいなければ (aaa, bbb, ...) 形式で返す
// - bodiesがstatementを含んでいるなら { aaa; bbb; ... } 形式で返す
//   ↑の際にappendReturnIfPossibleが真なら、末尾のexprの前に return をつける
//   (末尾がstatementだった場合はreturnをつけずにそのままにする)
const stringifyBodies = (bodies, appendReturnIfPossible=undefined) => {
  if (!bodies.length) { return '{}' }
  const compiledBodies = bodies.map(C);
  // TODO: ↓の判定には例外があり、親がfnかつ、lastのみstatementかつ、lastのstatementがreturnなら、returnを取って全体をexprだけだった扱いにできる。しかしかなり複雑になる…。seon2js全体がもっと安定してから挑戦する事
  if (compiledBodies.filter(isBeginStatement).length) {
    if (appendReturnIfPossible) {
      const lastIdx = compiledBodies.length - 1;
      const last = compiledBodies[lastIdx];
      if (!isBeginStatement(last)) {
        compiledBodies[lastIdx] = 'return ' + last;
      }
    }
    return '{' + compiledBodies.join(';\n') + '}';
  } else {
    return '(' + compiledBodies.join(', ') + ')';
  }
};


// これ複雑なので、こっちで書いて名前で参照する形にする
const makeFn = (prefix='') => (... args) => {
  const symbol = isS(args[0]) ? args[0] : undefined;
  const stringifiedSymbol = symbol ? S2MN(symbol) : '';
  const bindings = symbol ? args[1] : args[0];
  const bodies = symbol ? args.slice(2) : args.slice(1);
  // TODO: 引数デフォルト値指定((a, b=123)=>{})に対応するには？
  // TODO: 引数のdestructuring-bind((a, {b, c})=>{})に対応するには？
  const stringifiedBindings = bindings.length ? bindings.map(S2MN).reverse().reduce((acc, s)=> (s === '...') ? `${s} ${acc}` : `${s}, ${acc}`) : '';
  const stringifiedBodies = stringifyBodies(bodies, 1);
  return (symbol == null) ? `(${prefix} (${stringifiedBindings}) => ${stringifiedBodies})`
    : `(${prefix} function ${stringifiedSymbol} (${stringifiedBindings}) ${stringifiedBodies})`;
};




