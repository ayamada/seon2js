import * as Seon from "./seon.mjs"


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
  // ■ 最初に出てきた / はnamespace区切り文字(ただし末尾でない事！)。
  //    今は . に置換する(TODO: 将来はきちんとnsやvarの解決をする)
  s = s.replace(/^([^\/]+)\/(.)/, "$1.$2");
  // ■ 例えば foo?.bar.baz なら、fooとbarとbazに分けて処理を行う必要がある。
  //    ここからは分割して処理する(?や.も単体で保持する)
  const parts = s.split(/(\?|\.)/);
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if ((part === '') || (part === '?') || (part === '.')) { continue }
    // ■ -> は 2 にする(特殊ショートカット)
    part = part.replaceAll(/\-\>/g, '2');
    // ■ 以前のバージョンでは末尾 ? はis接頭辞に変換していたが、
    //    foo?.bar みたいなショートカットシンボルを扱えるようにした結果
    //    意味のconflictが起こり分かりづらくなってしまう為、
    //    isはisで示す事になった。間違わないようにする事。
    //    (これ実は問題ないかもしれない。その場合は昔の処理を復活させる事)
    // ■ - の文字は消し、その次の文字をCapitalizeする(先頭と末尾除く)
    part = part.replaceAll(/(.)-(.)/g, (_, c1, c2)=>(c1+capitalize(c2)));
    // ■ 末尾が ! の場合それを消す。
    //    jsに副作用の有無を気にする習慣はないが、人間の為にこれを提供する。
    //    例えばarray.sortはin place(副作用)動作なので、
    //    (array.sort!) と書けるとlisperにとっては非常に分かりやすい。
    part = part.replace(/^(.+)\!$/, (_, all)=>all);
    // ■ 上記全ての処理後に残った記号はmangleTableで変換する。
    part = part.replaceAll(/([^$\w.?])/g, (c)=>(mangleTable[c]??c));
    // ■ 上記の処理の結果として万が一数値はじまりになっていた場合、
    //    先頭に文字をつけて数値はじまりを回避する。
    //    (ほぼ->はじまり専用の対応)
    part = part.replace(/^(\d)/, "x$1");
    // ■ partをpartsに反映する
    parts[i] = part;
  }
  s = parts.join('');
  return s;
};


// NB: xがsymbolもしくはkeywordもしくは純stringの時のみに対応している。
//     それ以外だった時はundefinedを返す。
export const x2mangledString = (x) => string2mangledString(Seon.x2string(x) ?? x);
export const symbol2mangledString = (x) => (Seon.isSymbol(x) ? x2mangledString(x) : undefined);
export const keyword2mangledString = (x) => (Seon.isKeyword(x) ? x2mangledString(x) : undefined);


export default {
  string2mangledString,
  x2mangledString,
  symbol2mangledString,
  keyword2mangledString,
};
