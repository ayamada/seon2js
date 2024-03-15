import * as Sa from 'seon/sa';
import * as Seon from 'seon/seon';
import * as Mangle from 'seon/mangle';
import * as SeonUtil from 'seon/util';


// NB: defspから参照するものは基本的に全部ここに押し込む事。
//     (本当は隔離したいが、あまり隔離するとnodeの機能とか使えなくなり
//     困るので、今のところ隔離にはなってない)


import * as Fs from 'node:fs';
import * as Path from "node:path";
import * as Process from 'node:process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const tnE = (msg) => { throw new Error(msg) };


let theEnv;
// ここで扱える要素についてはTranspile.transpileAll内を参照
// - theEnv.srcPath
// - theEnv.metaMap
// - theEnv.spVars[spSymbol] = spFn
// - theEnv.callStack: []
// - theEnv.inDestructuringBindStack: [false]
// - theEnv.transpileOne(expr)
// - theEnv.tnEwL(msg)
// - rigidifiedNamespaceTable: {}
// - transpileFlags: {}

export const isInDestructuringBind = () => theEnv.inDestructuringBindStack[theEnv.inDestructuringBindStack.length-1];


// NB: spSymbolは文字列以外も来るが、その場合はundefinedが返される
export const spApply = (spSymbol, spArgs) => {
  const spFn = theEnv.spVars[spSymbol];
  return spFn?.(... spArgs);
};


const executeJs = (jsCodeStr) => {
  // TODO: これもうちょっとどうにかしたさはあるが…。
  //       jsで真っ当にこういう事やる場合はWorker使って隔離するのだろうけど…
  //       将来にはなんとかしたい
  return eval(jsCodeStr);
};


// これはseonの ::foo 型キーワードのnamespace用の文字列を返す。
// jsではclasspath相当の起点を確定できないし、そもそもjsのモジュールシステムで
// classpath相当を気にすべきではないので、末尾だけ切り出す。
// 将来的に問題になる可能性はあるが、そうなってから考え直す…。
export const determineCurrentNamespace = (srcPath) => {
  // TODO: Pathを使って取り出すようにする事
  const parts = srcPath.split(/\/|\\/);
  const filename = parts[parts.length-1];
  // TODO: 拡張子を捨てましょう！
  return "TODO";
};


// NB: ... を考慮しつつ引数を結合する。引数は全てTにより文字列化されている事。
//     最外部の括弧は状況により種類が変動するので、そこは自分でつける事。
export const joinArgs = (transpiledArgs) => {
  const result = [];
  for (let i = 0; i < transpiledArgs.length; i++) {
    const arg = transpiledArgs[i];
    const suffix = ((i === transpiledArgs.length-1) || (arg === '...')) ? '' : ',';
    result.push(arg+suffix);
  }
  return result.join('');
};


// 渡されたs2spソース文字列からsp定義を読み込む(spフェーズの実行を行う)
const applySpecialSources = (spSourceString, srcPath) => {
  const exprs = SeonUtil.seonCode2exprs(spSourceString, {
    '%SEON': '%SEON',
    '%CURRENT': 's2sp-core',
  });
  const ssccMetaMap = Seon.getLastMetaMap();

  // exprsを順番に適用していく。
  // exprs.forEach(T) するだけでもいいのだが、それだと
  // エラー時にmetaを参照する際にs2spソースのmetaではなく
  // 本来のソースのmetaを見にいってしまい、正しく行番号を取得する事ができない。
  // なのでそこだけ細工する必要がある
  // TODO: ここは「古いmetaを退避してからtheEnv.metaMapを書き換え、exprs.forEach(T)を行い、theEnv.metaMapを元に戻す」処理にすべき？↓だと二重に行番号が出てしまうケースがあるのでは…
  exprs.forEach((expr) => {
    const meta = ssccMetaMap.get(expr);
    const tnEwL = (msg) => {
      if (meta) {
        const { lineNo, colNo } = meta;
        tnE(`${msg} at line=${lineNo} col=${colNo} in file=${srcPath}`);
      } else {
        tnE(msg);
      }
    };
    if (!Seon.isList(expr)) {
      tnEwL('expr must be list in top-level of s2sp');
    }
    try {
      // spSourceStringは基本的に (defsp ...) 系の羅列でできており、
      // これを実行してtheEnv.spVarsに登録する事が重要であり、
      // その実行結果は捨てても問題ない(というか下手に実行してはいけない)
      spApply(expr[0], expr.slice(1));
    } catch (e) {
      //console.error(e);
      tnEwL(e.message);
    }
  });
};


export const installStandardSp = (env) => {
  theEnv = env;
  // とりあえずevalさえあれば何とかなる
  theEnv.spVars[SYM`sp/eval-js-at-compile-time!`] = (jsCodeStr) => (eval(jsCodeStr), '');
  // sp.s2spのpathを解決する(少しややっこしいので注意)
  const selfpath = require.resolve("seon2js/special");
  const filepath = selfpath.replace(/special\.mjs$/, 'sp.s2sp');
  const s2spName = "sp";
  const s2spCode = Fs.readFileSync(filepath, 'utf-8');
  applySpecialSources(s2spCode, s2spName);
};


const tripleDotSymbol = Seon.makeSymbol('...');
const denotationEmpty = Sa.make('denotation', '', 'empty');
// tripleDotSymbolを考慮してexprの配列を展開し直す
const expandArrayWithTripleDot = (exprs) => {
  const result = [];
  let isBeforeTripleDot;
  exprs.forEach((v) => {
    if (isBeforeTripleDot) {
      result.push(...v);
      isBeforeTripleDot = false;
    } else if (false) {
      // TODO
    } else {
      result.push(v);
    }
  });
  console.log(result);
  return result;
};


////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
// 以下はspecial用のユーティリティ関数定義


// 内部ニーモニックの提供
const T = (expr) => theEnv.transpileOne(expr);
const SYM = (s) => Seon.SYM(s);
const KW = (s) => Seon.KW(s);
const EVAL = (expr) => executeJs(T(expr));
const ARR2LST = (a) => Seon.markAsList([... a]);
const ARR2VEC = (a) => Seon.markAsVector([... a]);
const ARR2BLK = (a) => Seon.markAsBlock([... a]);
const LST = (... exprs) => ARR2LST(exprs);
const VEC = (... exprs) => ARR2VEC(exprs);
const BLK = (... exprs) => ARR2BLK(exprs);


let gensymCount = 0;
export const gensym = () => Seon.makeSymbol('%GENSYM/g'+(++gensymCount));


// NB: spApplyはほぼtranspile用で、spFuncallは完全にsp専用。
// NB: これは文字列を返す！defsp内で使う場合は考慮が必要…
const spFuncall = (spSymbol, ... args) => {
  spSymbol = Seon.isSymbol(spSymbol) ? spSymbol : Seon.makeSymbol(spSymbol);
  return spApply(spSymbol, args);
};


// https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements
// NB: いきなり { が出現した場合は「ブロック」のstatementとみなす。
//     なので、objectを示す場合は必ず ({ ... }) 表記にする事。
const statementBeginningRe = /^(return|break|continue|throw|if|switch|try|var|let|const|do|for|while|export)([^$\w]|$)/;
// 引数の文字列がstatementっぽい識別子で始まっているなら真を返す
const isBeginStatement = (s) => (statementBeginningRe.test(s) || !s.indexOf('{'));


// NB: これはfnやdo等で共通的に使う。
// - bodiesが空なら {} を返す
// - bodiesがstatementを含んでいなければ (aaa, bbb, ...) 形式で返す
// - bodiesがstatementを含んでいるなら { aaa; bbb; ... } 形式で返す
//   ↑の際にappendReturnIfPossibleが真なら、末尾のexprの前に return をつける
//   (末尾がstatementだった場合はreturnをつけずにそのままにする)
// この返り値の最初の文字が { かどうかで、結果がstatementかそれ以外かが分かる
// (objectが返る場合は必ず ({}) 表記にする必要がある)
const stringifyBodies = (bodies, appendReturnIfPossible=undefined, isBodyBlockForce=undefined) => {
  if (!bodies.length) { return '{}' }
  const transpiledBodies = bodies.map(theEnv.transpileOne);
  // TODO: ↓の判定には例外があり、親がfnかつ、lastのみstatementかつ、lastのstatementがreturnなら、returnを取って全体をexprだけだった扱いにできる。しかしかなり複雑になる…。seon2js全体がもっと安定してから挑戦する事
  if (isBodyBlockForce || transpiledBodies.filter(isBeginStatement).length) {
    if (appendReturnIfPossible) {
      const lastIdx = transpiledBodies.length - 1;
      const last = transpiledBodies[lastIdx];
      if (!isBeginStatement(last)) {
        transpiledBodies[lastIdx] = 'return ' + last;
      }
    }
    return '{' + transpiledBodies.join(';\n') + '}';
  } else {
    return '(' + transpiledBodies.join(', ') + ')';
  }
};


// "[...]" -> "(...)"
const rewriteFromVectorToList = (vecStr) => ('(' + vecStr.slice(1, -1) + ')');


// NB: これ非常に複雑なので、こっちで書いて名前で参照する形にする
// (fn [arg1 arg2 arg3] expr1 expr2 expr3)
// ↓
// (arg1, arg2, arg3) => { expr1; expr2; return expr3 }
// or
// (arg1, arg2, arg3) => ( expr1, expr2, expr3 )
//
// (fn sym [arg1 arg2 arg3] expr1 expr2 expr3)
// ↓
// function sym (arg1, arg2, arg3) { expr1; expr2; return expr3 }
//
// 呼び出し方は以下
// makeFnJsString('async')(sym, [arg1, arg2, arg3], expr1, expr2, expr3)
// or
// makeFnJsString('async')([arg1, arg2, arg3], expr1, expr2, expr3)
const makeFnJsString = (prefix='') => (... args) => {
  const symbol = Seon.isSymbol(args[0]) ? args[0] : undefined;
  const bindings = symbol ? args[1] : args[0];
  const bodies = symbol ? args.slice(2) : args.slice(1);
  // symbolありなら、()=>{}短縮記法ではなくfunction記法が確定する。という事は、
  // たとえbodyの中身がexprのみであってもbodyの展開は{}にならなくてはいけない！
  // ( `function foo () ()` はinvalid。 `function foo () {}` でないといけない)
  const isBodyBlockForce = !!symbol;
  // fn系は引数指定ミスしやすいので、bindingsのみチェックをきちんと行う
  if (!Array.isArray(bindings) || Seon.isList(bindings) || Seon.isBlock(bindings)) { tnE('invalid bindings') }
  // bindingsは強制的にdestructuring-bind可能に
  theEnv.inDestructuringBindStack.push(true);
  const stringifiedBindings = rewriteFromVectorToList(theEnv.transpileOne(Seon.markAsVector([... bindings])));
  theEnv.inDestructuringBindStack.pop();
  // body部は強制的にdestructuring-bind不可に
  theEnv.inDestructuringBindStack.push(false);
  const transpiledBodies = stringifyBodies(bodies, 1, isBodyBlockForce);
  theEnv.inDestructuringBindStack.pop();
  // 結果を組み立てて返す(symbolなしなら短縮記法にする)
  return (symbol ? `(${prefix} function ${Mangle.x2mangledString(symbol)} ${stringifiedBindings} ${transpiledBodies})` : `(${prefix} ${stringifiedBindings} => ${transpiledBodies})`);
};


// import対象の拡張子が `.s2mjs` 等だった場合は、トランスパイル後の拡張子である `.mjs` 等に変更する必要がある。その処理をする
const reformImportPath = (importPath) => importPath.replace(/\.s2(m?js)$/, '.$1');


// cwd と theEnv.srcPath と s2spPath から、
// Fs.readFileSync() に渡して読み込めるpathを生成して返す。
// s2spPathは、theEnv.srcPathから見た相対位置なので、こうなる
const resolveS2spPath = (s2spPath) => Path.join(Path.dirname(theEnv.srcPath), s2spPath);


const importS2sp = (s2spPath) => {
  // TODO: 一度importしたファイルを何度もimportしないようにできるとより良い
  if (!s2spPath.match(/^\.?\.\/.*$/)) { theEnv.tnEwL(`s2spPath should be begin ./ or ../ but found ${JSON.stringify(s2spPath)}`) }
  // TODO: 今は "../foo/bar.s2sp" や "./foo/bar.s2sp" の指定しかできないが、
  //       将来的にはjsのimport同様に "foo/bar" 指定できるようにしたい。
  //       (難易度が高い)
  const filepath = resolveS2spPath(s2spPath);
  const s2spCode = Fs.readFileSync(filepath, 'utf-8');
  applySpecialSources(s2spCode, s2spPath);
  return '';
};


// sp/ifの内部処理
const spIf = (pred, branch1, branch2, isForceBlock=undefined) => {
  const stringifiedBranch1 = stringifyBodies([branch1]);
  const stringifiedBranch2 = stringifyBodies([branch2]);
  const isStatementBranch1 = isBeginStatement(stringifiedBranch1);
  const isStatementBranch2 = isBeginStatement(stringifiedBranch2);
  if (isStatementBranch1 || isStatementBranch2 || isForceBlock) {
    // jsのif文で返す(statement扱いになる。もしbranchがexprなら{}で囲む必要がある)
    const result1 = isStatementBranch1 ? stringifiedBranch1 : ('{'+stringifiedBranch1+'}');
    const result2 = isStatementBranch2 ? stringifiedBranch2 : ('{'+stringifiedBranch2+'}');
    return `if (${T(pred)}) ${result1} else ${result2}`;
  } else {
    // jsの三項演算子で返す(expr扱い)
    return `(${T(pred)} ? (${stringifiedBranch1}) : (${stringifiedBranch2}))`;
  }
};


// NB: これはあくまで最適化の為の判定なので厳密ではない。
//     これを呼び出す側は、判定漏れがあっても動作するように組む事！
const isConstantlyTruthy = (expr) => {
  return false; // TODO: あとで以下の判定を組む事
  // - 0以外の数値ならtruthy
  // - ""以外の文字列ならtruthy
  // - keywordならtruthy
  // - trueのsymbolならtruthy
  // 上記以外にもtruthyに確定できるものは多いが、
  // 最適化目的としては上記だけ判定できていれば問題ないので省略
};


// sp/condの内部処理
// TODO: 一旦「常にjsのifに展開する」仕様で実装したが、やっぱこれはよくない！if同様に、全部のbranchがexprか、一つでもblockを含むかで形式を変えるべき！なぜならclojureのように、condの返り値を受け取る事を期待する場面がそこそこあるので…
const spCond = (pred, branch, ... leftover) => {
  tnE('niy');
  //// condの末尾のpredは、truthyな固定値である事が多い。そうなら最適化できる
  //// (condの末尾に限らず)
  //if (isConstantlyTruthy(pred)) { return `(${T(branch)})` }
  //// しかし稀にそうではない末尾もある。最後までpredが偽値を返した時は
  //// undefinedを返す仕様とする
  //if (!leftover.length) { return spIf(pred, branch, undefined, 1) }
  //const stringifiedBranch = stringifyBodies([branch]);
  //const isStatementBranch = isBeginStatement(stringifiedBranch);
  //const result1 = isStatementBranch ? stringifiedBranch : ('{'+stringifiedBranch+'}');
  //const result2 = spCond(... leftover);
  //return `if (${T(pred)}) ${result1} else ${result2}`;
};


