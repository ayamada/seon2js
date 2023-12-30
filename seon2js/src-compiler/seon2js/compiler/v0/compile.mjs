import * as sa from 'seon/sa';
import * as sym from 'seon/sym';
import * as seon from 'seon/seon';
import * as special from './special.mjs';
import * as mangle from './mangle.mjs';
// ↑のバージョンを変える事で、envの初期状態を変えられるようにする
// (出来の悪い過去のコードをまとめてdeprecatedにすると同時に、
// 以前バージョンのseon向けコードも一応実行可能にする)


// NB: 普通のlisp処理系だと「いかにしてきっちりさせるか」が大事になってくるが、
//     このseon2jsで大事なのは「いかにして最小コードにできるか」が大事。
//     (compile部をビルド後のコードに含めない手もあるが…)
//     実装方針に迷ったら、これを思い出す事。


// - あらゆる変数名は、今のところsymbol2stringでそのまま埋め込まれる。
//   つまりjsで許容されている $ と \w だけで変数名を構築する必要がある。
//   ただし将来はkebab->camel的変換をする事を予定する。
//   (これは後付けでやっても問題は出ないので後回し)


// TODO: currentEnv.lastParent 回りは関数化したい


const car = (a) => a[0];
const cdr = (a) => a.slice(1);
const cadr = (a) => a[1];
const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const isStringPure = (s) => (isStringOrSa(s) && !sa.isSaLikeString(s));
const tnE = (msg) => { throw new Error(msg) };
const tnEwL = (msg, expr) => {
  if (/ at line\=\d+ col\=\d+ in filename\=/.test(msg)) { tnE(msg) }
  const meta = currentEnv?.metaMap?.get(expr);
  const suffix = meta ? ` at line=${meta.lineNo} col=${meta.colNo} in filename=${meta.filename}` : '';
  tnE(`${msg} ${expr}${suffix}`);
};
const assert = (x) => (x || tnE('assertion failed'));


let currentEnv;


export const makeEnv = (opts) => {
  const prevEnv = currentEnv;
  const env = {
    ... opts,
    //mapPath: mapPath,
    //metaMap: seon.getLastMetaMap(),
    //seonState: seon.getLastSeonState(),
    vars: {}, // NB: ここのkeyはsymbolそのものなので注意(property名でのアクセスはできない)
    // TODO: 追加が必要なものがまだたくさんある…
  };
  currentEnv = env;
  special.importSeon2jsBasic(env, compileOne);
  currentEnv = prevEnv;
  return env;
};


const compileVector = (v) => {
  if (!v.length) { return '[]' }
  const oldParent = currentEnv.lastParent;
  currentEnv.lastParent = v;
  const result = '[(' + v.map(compileOne).join('), (') + ')]';
  currentEnv.lastParent = oldParent;
  return result;
};


const compileObject = (o) => {
  special.setCurrentCompileOne(compileOne); // TODO: これを実行する位置をもっと考え直す
  const oldParent = currentEnv.lastParent;
  currentEnv.lastParent = o;
  try {
    // NB: objectはstatementの{}と明確に区別される必要がある。
    //     ()で囲む事で「これはexprに属するものだ」と示す。
    const result = '({' + Object.entries(o).map(special.compileObjectEntry).join(', ') + '})';
    currentEnv.lastParent = oldParent;
    return result;
  } catch (e) {
    tnEwL(e.message, expr);
  }
};


// clojureのようにagetを補完する対象かを判別する。
// 条件は、keywordか、vectorか、objectか。
// TODO: ただし将来にobjectのproperty構文の実装内容によっては、aget補完と干渉するケースがあるかもしれない。注意する事
const isNeedComplementGet = (expr) => sym.isKeyword(expr) || seon.isVector(expr) || isObject(expr);


const agetSymbol = sym.makeSymbol('aget');


const tripleDotSymbol = sym.makeSymbol('...');


// TODO: defmacroおよびquasiquote回りの実装は後回しにする事になった
//       (一応defspecialでも代用できるので)

// (defmacro apply-macro [foo ... bar] `(,foo ,@bar)) があったとして、
// これが使われる時は (apply-macro + 1 2 3) のようになっているので、
// quasiquote部分は一旦置いておいて
// foo => +
// bar => [1 2 3]
// の変換もしくは束縛が必要になる。この変換テーブルを生成する
const makeReplaceTable = (definedArgs, givenArgs) => {
  const replaceTable = {};
  for (let i = 0; i < givenArgs.length; i++) {
    const symbol = definedArgs[i];
    // definedArgs内の `...` シンボル対応
    if (symbol === tripleDotSymbol) {
      // 残っているものをまとめて処理する必要がある
      const nextSymbol = definedArgs[i+1];
      replaceTable[nextSymbol] = givenArgs.slice(i);
      break;
    }
    // TODO: givenArgs内の `...` シンボルも考慮する必要がある…どうする？
    //       これはそのままjsに渡して問題ない気がするが、要確認
    //       (ただ将来にvar対応する場合は変換必須になるので注意)
    const targeExpr = givenArgs[i];
    replaceTable[symbol] = targetExpr;
  }
  return replaceTable;
};


const compileExpr = (expr) => {
  // - 空の () は [] と同じ扱い
  if (!expr.length) { return '[]' }
  // - まずcarを調べる必要がある
  const carEntity = currentEnv.vars[car(expr)];
  if (carEntity) {
    const {type, args, content} = carEntity;
    // - carの中身がspecialもしくはmacroなら、このタイミングで処理し、その結果を埋める
    try {
      if (type == 'special') {
        return content.apply(null, cdr(expr));
      } else if (type == 'macro') {
        // TODO
        tnE(`niy`); // TODO
      }
    } catch (e) {
      console.log(e);
      // specialやmacroがエラーを出したら、ここでtnEwLでソース情報をつける
      tnEwL(e.message, expr);
    }
  }
  // - carの中身がkeywordや[]や{}なら、clojureのようにagetを補完する
  if (isNeedComplementGet(car(expr))) {
    // metaも移行する必要がある
    const meta = currentEnv.metaMap.get(expr);
    expr = [agetSymbol, ... expr];
    if (meta) { currentEnv.metaMap.set(expr, meta) }
  }
  // exprはmethodもしくは関数の実行。
  const oldParent = currentEnv.lastParent;
  currentEnv.lastParent = expr;
  const compiledExprs = expr.map(compileOne);
  currentEnv.lastParent = oldParent;
  if (sym.isSymbol(car(expr)) && !sym.referName(car(expr)).indexOf('.')) {
    // - もしsymbolかつdotはじまりであればmethod。
    // (obj).method(... args) の形になるように展開する
    const [method, obj, ... args] = compiledExprs;
    const argsStr = args.length ? ('(' + args.join('), (') + ')') : '';
    // TODO
    return '(' + obj + ')' + method + '(' + argsStr + ')';
  } else {
    // - そうでなければ関数。 (fn)(... args) の形になるように展開する
    const [fn, ... args] = compiledExprs;
    const argsStr = args.length ? ('(' + args.join('), (') + ')') : '';
    return '(' + fn + ')(' + argsStr + ')';
  }
};


const compileSymbol = (symbol) => {
  // - dotを含むものは、まず適切に分解する必要あり？なし？
  // TODO: 将来に対応予定…
  // - 特定のnsを持つもの(`js` とか `js-infix` とか)への対応
  // TODO: 将来に対応予定…
  // まず束縛の内容を参照する
  const entity = currentEnv.vars[symbol];
  if (entity) {
    const {type, args, content} = entity;
    // - 束縛の内容がspecialもしくはmacroに属するものの場合、ここでは単に「specialやmacroを値として扱う事はできない」例外を投げるだけにする。specialやmacroの実際の処理はcompileExprにやらせる
    if (type == 'special' || type == 'macro') {
      tnEwL(`cannot access to value of ${type}`, (currentEnv.lastParent ?? symbol));
    }
  }
  // - そうでなければ変数扱いでok
  return mangle.symbol2mangledString(symbol);
};


// exprから、jsソースチャンク文字列の配列を生成する。
// 状況に応じてenvを参照したり書き換えたりもする。
// これはトップレベルかどうかは意識しない。トップレベルにしか置けない式
// (もしくはその逆)をエラーにするのはjs処理系の責務とする。
// (ただしdefmacro系は例外)
const compileOne = (expr) => {
  const resultJsCode = seon.isVector(expr) ? compileVector(expr)
    : isObject(expr) ? compileObject(expr)
    : isArray(expr) ? compileExpr(expr)
    : sym.isSymbol(expr) ? compileSymbol(expr)
    // expr.constructor を安全にする為に、nully値は早目に除去しておく
    : (expr === null) ? 'null'
    : (expr === undefined) ? 'undefined'
    : sym.isKeyword(expr) ? JSON.stringify(expr) // NB: キーワードの役割は「enum的なidentifier」なので、敢えてsym.keyword2string等にはかけない事にした。{}内のキー名にキーワードを使うとマッチしない問題があるが、これはそもそもgccのmanglingをかけると動かなくなる挙動なので、むしろこの方がわかりやすいと判断した
    : sym.isSastring(expr) ? JSON.stringify(sym.sastring2string(expr))
    : isStringOrSa(expr) ? JSON.stringify(expr) // NB: 先にsa系を判定しておく必要あり
    : (expr.constructor === Number) ? expr.toString() // infもnanもこれでいける
    : (expr.constructor === RegExp) ? expr.toString()
    : (expr.constructor === Boolean) ? expr.toString()
    // 素のseonが生成できるのは上記ぐらい？
    // 将来の拡張で上記以外のものが出てくるようになる可能性は高い。
    // ここでエラーにする事で、それを通知する
    : tnEwL(`cannot compile`, expr);

  // 最後に、式の外側の状態に応じて、末尾に ; をつける。
  // 具体的には、トップレベル、function内トップレベル、が ; をつける条件になる
  const suffix = ''; // TODO
  return resultJsCode + suffix;
};


export const compileAll = (env, exprs) => {
  currentEnv = env;
  currentEnv.lastParent = exprs;
  // TODO: 将来的にはpretty-printしたい
  return exprs.map(compileOne).join(";\n");
}


export const makeMap = (env) => {
  // TODO
  return "TODO";
};


export const makeTail = (mapPath) => `\n//# sourceMappingURL=${mapPath}`;


