import * as Sa from "seon/sa";
import * as Seon from "seon/seon";
import * as Mangle from "seon/mangle";
import * as SeonUtil from "seon/util";


import * as Fs from "node:fs";
import * as Path from "node:path";


import * as Special from "./special.mjs";


let theEnv;


const isArray = Array.isArray;
const isStringOrSa = (s) => (s?.constructor === String);
const isObject = (o) => (o?.constructor === Object);
const tnE = (msg) => { throw new Error(msg) };
const searchLatestMeta = () => {
  for (const expr of theEnv.callStack.reverse()) {
    const meta = theEnv.metaMap.get(expr);
    if (meta) { return meta }
  }
};
const tnEwL = (msg) => {
  const meta = searchLatestMeta();
  if (meta) {
    const { lineNo, colNo } = meta;
    tnE(`${msg} at line=${lineNo} col=${colNo}`);
  } else {
    tnE(msg);
  }
};


let lastResultMap;
// isMakeMapFile時のmapはここから取得する
export const getLastResultMap = () => lastResultMap;


// 以下は特殊な判定が必要なsymbol/denotation
const tripleDotSymbol = Seon.makeSymbol('...');
const denotationEmpty = Sa.make('denotation', '', 'empty');


const transpileList = (expr) => {
  // NB: 特別扱いで、空の () は #empty に置換する
  if (!expr.length) { return denotationEmpty }
  const [carExpr, ... cdrExprs] = expr;
  const spResult = Special.spApply(carExpr, cdrExprs);
  if (spResult != null) {
    return spResult;
  } else if (carExpr === tripleDotSymbol) {
    // TODO: ここには来ないのでは？()内に...が出現するのは関数の引数部分のみだけど、それはつまりfnスペシャルフォームがなんとかするという事であり、fnスペシャルフォームの引数部分は[]なので。
    // 関数定義は (fn [... foo] xxx) -> foo=(... bar)=>xxx なのでここには来ない
    // 関数実行は (foo ... bar) -> foo(... bar) なのでここには来ない
    tnEwL('invalid syntax (maybe)');
  } else if (Seon.isKeyword(carExpr)) {
    if (cdrExprs.length !== 1) {
      tnEwL('keyword(property) notation get only just one argument');
    }
    // (:prop obj) -> obj.prop
    // NB: これを obj.prop とするか obj?.prop とするかはとても悩んだが、
    //     obj.prop = 123 はできても obj?.prop = 123 はできないので、
    //     obj.prop にするしかなかった。
    //     (本当はclojure風の動作にできる ?. にしたかった)
    //     ?. の方が良い時は明示的に (?. obj :prop) とする事。
    return `(${transpileOne(cdrExprs[0])}).${Mangle.x2mangledString(carExpr)}`;
  } else if (Seon.isVector(carExpr)) {
    if ((cdrExprs.length !== 1) || (carExpr.length !== 1)) {
      tnEwL('bracket notation must have only just one expr');
    }
    // ([2] objOrArr) -> objOrArr[2]
    return `(${transpileOne(cdrExprs[0])}${transpileOne(carExpr)})`;
  } else if (Seon.isBlock(carExpr)) {
    // TODO: 将来はこの記法を何かに使う可能性はある
    // ({} val) -> ???
    tnEwL('invalid syntax (reserved)');
  } else if (Seon.isList(carExpr) || Seon.isSymbol(carExpr)) {
    // clojureのように、dotはじまりのsymbolならmethod callとして認識する
    if (Seon.isSymbol(carExpr) && !Seon.symbol2string(carExpr).indexOf('.')) {
      const [method, obj, ... args] = expr.map(transpileOne);
      // (.foo obj arg1 arg2) -> (obj.foo)(arg1, arg2)
      return `(${obj})${method}(${Special.joinArgs(args)})`;
    }
    // もしcarExprがnamespaceを持ち、そのnamespaceが
    // theEnv.rigidifiedNamespaceTableに登録されているなら即座にエラーにする
    if (theEnv.rigidifiedNamespaceTable[Seon.referNamespace(carExpr)]) {
      tnEwL(`${Seon.x2string(carExpr)} is undefined special-form`);
    }
    // 通常の関数実行
    const [f, ... args] = expr.map(transpileOne);
    // (foo arg1 arg2) -> (foo)(arg1, arg2)
    // ((foo bar) arg1 arg2) -> (foo(bar))(arg1, arg2)
    return `(${f})(${Special.joinArgs(args)})`;
  } else if (isArray(carExpr)) {
    // carは生arrayだった。何かミスがある…
    tnEwL(`found unknown glitch ${JSON.stringify(expr)}`);
  } else {
    tnEwL(`invalid syntax ${JSON.stringify(expr)}`);
  }
};
// NB: bracket notation(a[1])やcomputed-property-namesでは
//     [foo,] は許されない！しかし denotationEmpty の場合は
//     最後のみ余分な , が必要になる。難しい…
const transpileVector = (expr) => {
  const result = [];
  for (let i = 0; i < expr.length; i++) {
    const v = expr[i];
    if (v === tripleDotSymbol) {
      result.push(' ... ');
    } else if (v === denotationEmpty) {
      result.push(' , '); // NB: この時のみ、末尾でも , をつける必要がある！
    } else {
      const isLast = (i === expr.length-1);
      const suffix = isLast ? '' : ',';
      result.push(transpileOne(v) + suffix);
    }
  }
  return '[' + result.join('') + ']';
};
// NB: objectはstatementの{}と明確に区別される必要がある。
//     大体の場合、{}ではなく({})で囲む事により対応できる。
//     (こうしないとブロックと判別できず構文エラーになる為)
//     ただ問題があり、destructuring-bind内では({})は構文エラーになる！
//     なのでこの状態に応じて変える必要がある。
const wrapBlockParenthesis = (blockStr) => (Special.isInDestructuringBind() ? ('{' + blockStr + '}') : ('({' + blockStr + '})'));
// NB: この関数はBlockと名前がついているが、生成して返す値は必ず
//     object判定用の{}になり、コードブロックの展開には決して使われない。
const transpileBlock = (expr) => {
  const contents = [];
  let i = 0;
  while (i < expr.length) {
    const v1 = expr[i++];
    if (v1 === tripleDotSymbol) {
      const v2 = expr[i++];
      contents.push(`... ${transpileOne(v2)},`);
    } else if (Seon.isSymbol(v1)) {
      contents.push(`${transpileOne(v1)},`);
    } else if (Seon.isKeyword(v1)) {
      const v2 = expr[i++];
      contents.push(`${Mangle.x2mangledString(v1)}:${transpileOne(v2)},`);
    } else if (Seon.isVector(v1)) {
      if (v1.length != 1) {
        tnEwL('computed-property-names must have only just one expr');
      }
      const v2 = expr[i++];
      contents.push(`${transpileOne(v1)}:${transpileOne(v2)},`);
    } else {
      const v2 = expr[i++];
      contents.push(`${transpileOne(v1)}:${transpileOne(v2)},`);
    }
  }
  // NB: 内容の末尾が , なら、これを除去する必要がある。
  //     (これは末尾が `... rest` で終わる際の必須条件になっている)
  const result = contents.join('').replace(/,$/, '');
  return wrapBlockParenthesis(result);
};
// NB: この関数はspecialが{}を返した時にだけ実行される。
//     (通常のs2jsソース上に出てくる{}はtranspileBlockの方で処理される)
//     全てのエントリにおいて即値しか扱えないが、即値でよいケースも多く、
//     specialでいちいち (BLK ...) と書かなくてすむので、用意された。
const transpileObject = (expr) => {
  const contents = [];
  Object.entries(expr).forEach(([k, v]) => {
    if (Seon.isSymbol(k) || Seon.isKeyword(k)) {
      k = Mangle.x2mangledString(k);
    }
    contents.push(`${k}:${transpileOne(v)},`);
  });
  return wrapBlockParenthesis(contents.join(''));
};
const transpileSymbol = (expr) => {
  const result = Mangle.x2mangledString(expr);
  Seon.throwErrorIfInvalidSymbolName(result);
  return result;
};
const transpileOne = (expr) => {
  theEnv.callStack.push(expr);
  const result = (Seon.isList(expr) ? transpileList(expr)
    : Seon.isVector(expr) ? transpileVector(expr)
    : Seon.isBlock(expr) ? transpileBlock(expr)
    : isArray(expr) ? transpileList(expr) // specialで使いやすいよう、list扱いにしておく
    : isObject(expr) ? transpileObject(expr) // specialが{}を返した時の対応
    // expr.constructor を安全に判定できるよう、nully値は早目に除去しておく
    : (expr === null) ? 'null'
    : (expr === undefined) ? 'undefined'
    : (expr === tripleDotSymbol) ? expr // 特殊処理の為にそのまま残す
    : (expr === denotationEmpty) ? expr // 特殊処理の為にそのまま残す
    : Seon.isDenotation(expr) ? tnEwL('invalid denotation') // 特殊処理できないdenotationはエラー
    : Seon.isSymbol(expr) ? transpileSymbol(expr)
    // keywordはsa文字列のまま埋め込む。console.logしづらい問題は諦める
    : Seon.isKeyword(expr) ? JSON.stringify(expr)
    // NB: 文字列よりも先にsa系の判定を終わらせておく事！
    : isStringOrSa(expr) ? JSON.stringify(expr)
    : (expr.constructor === Number) ? ('('+expr.toString()+')') // infもnanもこれでいける。たまに出てくる記号(. - e)が他と結合しないよう括弧で囲む
    : (expr.constructor === RegExp) ? ('('+expr.toString()+')') // slashが他と結合しないよう括弧で囲む
    : (expr.constructor === Boolean) ? expr.toString()
    // 将来の拡張で上記以外のものが出てくるようになる可能性は高い。
    // ここでエラーにする事で、それを通知する
    // TODO: ここのexpr表示をもっと分かりやすくしたいが…
    : tnEwL(`cannot transpile ${expr}`, expr));
  theEnv.callStack.pop();
  return result;
};


// TODO: ここ(discard定義)回りは別モジュール化したいが…
let dispatcheeSymbolConvertTable = {};
// TODO: このdispatcheeSymbolConvertTableを外部からいじれる手段を提供する(clojureのreader macroと大体同じ)
dispatcheeSymbolConvertTable[Seon.makeSymbol('t')] = true;
dispatcheeSymbolConvertTable[Seon.makeSymbol('true')] = true;
dispatcheeSymbolConvertTable[Seon.makeSymbol('f')] = false;
dispatcheeSymbolConvertTable[Seon.makeSymbol('false')] = false;
dispatcheeSymbolConvertTable[Seon.makeSymbol('nil')] = null;
dispatcheeSymbolConvertTable[Seon.makeSymbol('null')] = null;
//dispatcheeSymbolConvertTable[Seon.makeSymbol('undefined')] = undefined; // 非常に誤判定しやすい為、これの提供は行わない事になった
dispatcheeSymbolConvertTable[Seon.makeSymbol('inf')] = Number.POSITIVE_INFINITY;
dispatcheeSymbolConvertTable[Seon.makeSymbol('+inf')] = Number.POSITIVE_INFINITY;
dispatcheeSymbolConvertTable[Seon.makeSymbol('-inf')] = Number.NEGATIVE_INFINITY;
dispatcheeSymbolConvertTable[Seon.makeSymbol('nan')] = Number.NaN;
dispatcheeSymbolConvertTable[Seon.makeSymbol('empty')] = Seon.makeDenotation('empty'); // [1,,3] の間の空きを表現する為のdenotation
const shiftStack = (to, stack) => {
  if (!stack.length) { Seon.tnEwTo(`invalid format "${to.content}"`, to) }
  return stack.shift();
};
const dispatcheeSymbolDiscard = Seon.makeSymbol('_');
// NB: ※※※ここで構造を生成した場合は、忘れずにmetaMapに登録する事※※※
// NB: この中でdispatch処理を行った場合はtruthyを返す事！
//     (truthyを返さなかった場合、更に後続のdispatch処理がなされてしまい、
//     最終的にはエラー扱いになる)
// NB: 先頭ほど優先度が高い(先に実行される)
const transpilerDispatchFns = [
  // #_ (discard one element)
  (to, dispatchee, stack) => {
    // この時のdispatcheeは _ だが、後続の数値やsymbolと結合し謎symbolに
    // なってしまうケースが普通にある。それも含めて判定する必要がある。
    if (Seon.symbol2string(dispatchee)?.indexOf('_') === 0) {
      // dispatcheeが素の _ の場合は後続と結合していないので、
      // 明示的に更に一個の要素を消す必要がある。
      // (結合している場合に消さないといけないものは結合対象という事になり、
      // その時は何もしなくてよい)
      if (dispatchee === dispatcheeSymbolDiscard) {
        const v = shiftStack(to, stack);
        // TODO: 将来に #_{SEON/VER 12.3} のような、特定記法のobjectが
        //       #_ によって読み飛ばされた際に、その内容を反映する機能を
        //       追加する構想がある。ここに対応コードを入れる事になる。
      }
      return 1;
    }
  },
  // #"..." (regexp)
  (to, dispatchee, stack) => {
    if (isStringOrSa(dispatchee) && !Sa.isSaLikeString(dispatchee)) {
      stack.unshift(new RegExp(dispatchee));
      return 1;
    }
  },
  // 即値型の #symbol
  (to, dispatchee, stack) => {
    const v = dispatcheeSymbolConvertTable[dispatchee];
    if (v !== undefined) {
      stack.unshift(v);
      return 1;
    }
  },
  // #() #[] #{}
  (to, dispatchee, stack) => {
    if (isArray(dispatchee)) {
      if (dispatchee[Seon.listMarkerKey]) {
        dispatchee[Seon.listMarkerKey] = 2;
      } else if (dispatchee[Seon.vectorMarkerKey]) {
        dispatchee[Seon.vectorMarkerKey] = 2;
      } else if (dispatchee[Seon.blockMarkerKey]) {
        dispatchee[Seon.blockMarkerKey] = 2;
      } else {
        Seon.tnEwTo('not reached', to);
      }
      stack.unshift(dispatchee);
      return 1;
    }
  },
  // TODO: schemeの `#n=`, `#n#` (shared-structure)みたいな奴のサポート
  //       - この仕様についてはSRFI-38を見る事
  //         https://srfi.schemers.org/srfi-38/srfi-38.html
  //       -  `#n#` の末尾 # が問題だが、末尾文字を変更して対応したい
];


export const transpileAll = (s2jsCode, options={}) => {
  let { srcPath='./nowhere.mjs', isMakeMapFile, isUseCachedSpVars, currentNamespace , transpileFlags={}} = options;
  currentNamespace ??= Special.determineCurrentNamespace(srcPath);
  lastResultMap = undefined; // TODO: どうやってmapファイル情報を生成する…

  const prevDispatchFns = Seon.getDispatchFns();
  Seon.setDispatchFns(transpilerDispatchFns);
  let resultJsCode;
  try {
    // NB: theEnvはtranspile実行毎に書き換えられる。再帰実行に注意！
    if (!isUseCachedSpVars || !theEnv) {
      theEnv = {
        srcPath,
        metaMap: new Map(),
        spVars: {},
        callStack: [],
        inDestructuringBindStack: [false],
        transpileOne,
        tnEwL,
        rigidifiedNamespaceTable: {},
        transpileFlags,
      };
      Special.installStandardSp(theEnv); // NB: これは内部でmetaMap更新する！
    } else {
      // srcPathは変動し得る
      theEnv.srcPath = srcPath;
      // 例外で終了した際にstackが残るので、そこだけ綺麗にしておく
      theEnv.callStack = [];
      theEnv.inDestructuringBindStack = [false];
    }
    const exprs = SeonUtil.seonCode2exprs(s2jsCode, {
      '%SEON': '%SEON',
      '%CURRENT': currentNamespace,
    });
    // seonCode2exprsを実行したので、metaMapも更新する
    // (古い情報が残るが、testでは諦める)
    Seon.getLastMetaMap().forEach((v, k) => theEnv.metaMap.set(k, v));
    // specialを展開しつつ、構造を展開していく
    // (ここでほぼ文字列になるので、両者は同時にやる必要がある)
    resultJsCode = exprs.map(transpileOne).join(";\n");
    // NB: isMakeMapFile時であっても `\n//# sourceMappingURL=${mapPath}` を
    //     末尾に追加する処理は呼出元で行ってもらう。
    //     (mapPathの相対配置位置が不明な為)
    //     なので、ここでsourceMappingURLをつける必要はない。
  } finally {
    Seon.setDispatchFns(prevDispatchFns);
  }
  return resultJsCode;
};


