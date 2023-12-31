import * as sym from "seon/sym"


// clojureのmunge/demungeに近い処理を行うが、demunge相当は提供されない
// (つまりrestoreはできない)


// TODO: string2mangledString, x2mangledString, symbol2mangledString, keyword2mangledString のもっと短くてよい名前を考える。条件は以下
//       - 引数の型が明確に分かる事
//       - 返り値の型が明確に分かる事
//       - 短い名前である事(できれば mangle. のprefixをつけても冗長にならない名前)


const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };


const mangleTable = {
  '#': '_SHARP_',
  '%': '_PERCENT_',
  '&': '_AMPERSAND_',
  '*': '_STAR_',
  '+': '_PLUS_',
  '-': '_MINUS_', // NB: 1文字だけや、末尾に出現した時に、この判定が使われる
  '/': '_SLASH_',
  ':': '_COLON_',
  '<': '_LT_',
  '=': '_EQ_',
  '>': '_GT_',
  '@': '_CIRCA_',
  '\\': '_BSLASH_',
  '^': '_CARET_',
  '|': '_BAR_',
  '~': '_TILDE_',
  '!': '_BANG_',
  // NB: 以下はminifyに重要なのでmanglingせずそのまま残す
  //'?': '_QMARK_',
};


const capitalize = (s) => s.length ? (s[0].toUpperCase() + s.slice(1)) : s;


// clojureでsymbolやkeywordによくつけられる名前のようなstringを、
// js風の名前のstringに変換して返す。
// kebab->camelに近いが、よりjsライクな名前になるような個別の変換処理がある。
// clojureのmunge相当だが、demungeは提供されない(元には戻せない)
export const string2mangledString = (s) => {
  if (!isStringOrSa(s)) { return }
  // jsから扱えるよう、symbolはmangleを確実に行える必要がある。
  // (完璧なdemangleは一旦諦める)
  // 現状は以下のルールでmangleを行う
  // - 末尾 / は特別扱い。 _SLASH_ に置換する(最優先)
  s = s.replace(/\/$/, '_SLASH_');
  // - 上記以外の / は . に置換する(将来はきちんとnsやvarの解決をする)(優先)
  s = s.replace("/", '.');
  // - . は基本そのままにする(一部問題のあるケースはある。あとで考える)
  // - [$A-Za-z0-9_] は基本そのまま(場合によりCapitalizeされる程度)
  // - - の文字は消し、その次の文字をCapitalizeする
  s = s.replaceAll(/-(.)/g, (_, c)=>capitalize(c));
  // - 末尾が ! の場合それは消す(jsに副作用の有無を気にする習慣はない。demangleは諦める)
  s = s.replace(/^(.*)\!$/, (_, all)=>all);
  // - 末尾が ? の場合それは消し、名前全体をCapitalizeした後に先頭に is をつける
  //   (ただしこの処理は.で分割される一番末尾にのみ適用する事)
  s = s.replace(/^(.*)\?$/, (_, all)=> {
    const parts = all.split('.');
    const last = parts.pop();
    parts.push('is'+capitalize(last));
    return parts.join('.');
  });
  // - -> は 2 にする(特殊ショートカット)
  s = s.replaceAll(/\-\>/g, '2');
  // - 上記以外の記号はmangleTableで変換する。
  //   なお特例として ? はminifyに重要なので(`?.`の為)許可している。
  //   ただし上記の通り「末尾に付く ! と ?」は先に加工されているので要注意
  s = s.replaceAll(/([^$\w.?])/g, (c)=>(mangleTable[c]??c));
  // - 上記の処理の結果として数値はじまりになっていた場合、先頭に文字をつけて数値はじまりを回避する
  s = s.replace(/^\d/, 'x$&');
  return s;
};
// xがsymbolもしくはkeywordもしくは純stringの時のみに対応している
export const x2mangledString = (x) => string2mangledString(sym.sk2stringUnchecked(x) ?? x);
export const symbol2mangledString = (x) => (sym.isSymbol(x) ? x2mangledString(x) : undefined);
export const keyword2mangledString = (x) => (sym.isKeyword(x) ? x2mangledString(x) : undefined);
// NB: keyword2mangledStringは :foo-bar/baz-buzz を "fooBar.bazBuzz" に変換する
//     (先頭の : を含めずに処理する)


