import * as Sym from "./sym.mjs"


// clojureのmunge/demungeに近い処理を行うが、demunge相当は提供しない。
// この際の処理は、gccでのminifyに対して最適化されている為、
// 一部不自然な部分があるが、許容する事。


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
  '-': '_MINUS_',
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
  '!': '_BANG_', // !foo したい場合は (! foo) と書く事
  // NB: 以下はgccでのminifyに重要なので、manglingせず敢えてそのまま残す
  //'.': '_DOT_', // foo.bar.baz を単一symbol扱いのままjsに渡せるようにする
  //'?': '_QMARK_', // foo?.bar?.baz を単一symbol扱いのままjsに渡せるようにする
};


const capitalize = (s) => s.length ? (s[0].toUpperCase() + s.slice(1)) : s;


// clojureでsymbolやkeywordによくつけられる記号を含むstring名を、
// 「jsの常套句」として通用するstringに変換して返す。
// 「jsの常套句」とは、「jsの変数名としてvalidになる文字列」を
// . や ?. で結合したものと考えてよい。
// (Math.max や console.log みたいなものが該当。こういう常套句は
// 熟練のjs使いでも頭の中では無意識の内に一語として考えている…)
//
// 上記の例外を除き、js変数名に使えない記号を文字列に変換する処理を行う。
// (大体clojureのmungeに近い処理だが、demungeは提供されない(元には戻せない))
// kebab->camelにも近いが、より特化した個別の変換処理を含んでいる。
export const string2mangledString = (s) => {
  if (!isStringOrSa(s)) { return } // 文字列でないものは処理できない
  // TODO: ここには普通に foo.bar.baz のようなシンボルが流れてくる事になった。という事は「先頭」「末尾」の判定はこのfoo bar bazそれぞれで行わないといけない！全体的に処理を考え直す必要がある…
  // TODO
  // TODO
  // TODO
  // TODO
  // TODO
  // TODO
  // 末尾 / は特別扱い。 _SLASH_ に置換する(最優先)
  s = s.replace(/\/$/, '_SLASH_');
  // 上記以外の / は . に置換する(将来はきちんとnsやvarの解決をする)(優先)
  s = s.replace("/", '.');
  // -> は 2 にする(特殊ショートカット)
  s = s.replaceAll(/\-\>/g, '2');
  // . は基本そのままにする(ショートカット)
  //
  // ? も基本そのままにする(ショートカット)
  // 以前のバージョンではis接頭辞に変換していたが、 foo?.bar みたいな
  // ショートカットシンボルを扱えるようにした結果、意味のconflictが起こり
  // 分かりづらくなってしまう為、isはisで示す事になった。間違わないようにする事
  // (ただ、これ実は問題ないかもしれない…その場合は以下のコードを復活させる)
  // s = s.replace(/^(.+)\?$/, (_, all)=> {
  //   const parts = all.split('.');
  //   const last = parts.pop();
  //   parts.push('is'+capitalize(last));
  //   return parts.join('.');
  // });
  //
  // [$A-Za-z0-9_] は基本そのまま(Capitalizeされる等はある)
  //
  // - の文字は消し、その次の文字をCapitalizeする(先頭と末尾除く)
  s = s.replaceAll(/(.)-(.)/g, (_, c1, c2)=>(c1+capitalize(c2)));
  // 末尾が ! の場合それを消す。
  // jsに副作用の有無を気にする習慣はないが、人間の為だけにこれを提供する。
  // 例えばarray.sortはin place(副作用)動作なので、
  // (array.sort!) と書けるとlisperにとっては非常に分かりやすい。
  s = s.replace(/^(.+)\!$/, (_, all)=>all);
  // 上記全ての処理後に残った記号はmangleTableで変換する。
  // なお特例として . と ? は許可している事に要注意。
  s = s.replaceAll(/([^$\w.?])/g, (c)=>(mangleTable[c]??c));
  // 上記の処理の結果として万が一数値はじまりになっていた場合、
  // 先頭に文字をつけて数値はじまりを回避する
  s = s.replace(/^\d/, 'x$&');
  return s;
};


// TODO: ここは以下をきちんとする必要がある！
//       - symbol/keyword時は、namespaceとnameを分けて処理する
//         (今は foo/bar にstringifyしてるだけ…)
//       - ...
// NB: xがsymbolもしくはkeywordもしくは純stringの時のみに対応している。
//     それ以外だった時はundefinedを返す。
export const x2mangledString = (x) => string2mangledString(Sym.sk2stringUnchecked(x) ?? x);
export const symbol2mangledString = (x) => (Sym.isSymbol(x) ? x2mangledString(x) : undefined);
export const keyword2mangledString = (x) => (Sym.isKeyword(x) ? x2mangledString(x) : undefined);


