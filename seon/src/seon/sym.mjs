import * as sa from './sa.mjs';


// seonで必要となるsymbol, keyword, 将来対応予定のsastring,
// それからおまけでnumberの処理を行うモジュール


const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };


sa.setSaTypeDefinitionTable({
  // seon向けに以下の三つを初期提供する
  // NB: ここはgccにmanglingされると困るので、文字列で指定する事
  //     (content, encoder, decoderはmanglingされて正しいが、
  //     symbol, keyword, sastringはmanglingされると困る。ややっこしい…)
  'symbol': {},
  'keyword': {},
  'sastring': {content: {encoder: JSON.stringify, decoder: JSON.parse}},
  // TODO: 後から他にも追加できるようにしておく
});


const validNumberAndLeftoverRe = /^([-+]?\d+(?:\.\d+)?)(.*)$/s;
// symbolを構築可能な文字は以下の通りだが、slashのみ特殊な制約がある。
// このslash回りの制約は別途チェックする事！
// またsymbolがnumberとも解釈できる場合は、number判定が優先される。
// 忘れずに事前にnumber判定も行い、もしnumber判定に通った場合はエラーにする事。
// なおdotもseon2jsレベルでは制約をつけるが、seonレベルでは
// 気にしなくてよい(もし不正だった際にエラーにするのはseon2js側の責務)
// これはkeywordも同じ判定になる(先頭の `:` を除く)
const validSymbolAndLeftoverRe = /^([-*+!?$%&=<>\/\w.]+)(.*)$/s;


// NB: 上記二つは「一連のソースファイルの先頭から切り出す」正規表現なので、
//     単に「この文字列がvalidかどうか」をチェックしたい場合は、
//     leftover部が空であるかどうかも同時に確認する必要がある。
const isValidCheckByRe = (re, s) => {
  const matched = s.match(re);
  return (matched && !matched[2].length);
};
export const isValidNumberString = (s) => isValidCheckByRe(validNumberAndLeftoverRe, s);
// NB: これはnamespaceとnameを個別に判定する想定になっている。
//     だからslashが含まれる場合はinvalid判定になる。
//     (slash一文字の時は事前に判定して避ける事)
export const isValidSymbolString = (s) => ((!isValidNumberString(s)) && !(s.includes('/')) && isValidCheckByRe(validSymbolAndLeftoverRe, s));
export const isValidNamespaceString = (s) => isValidSymbolString(s??'_');
export const isValidNameString = (s) => ((s === '/') || isValidSymbolString(s));


// NB: makeSymbolとmakeKeywordは基本機能として提供する想定なので、
//     きちんと型チェックする必要がある
const makeKeywordOrSymbol = (type, arg1, arg2) => {
  // arg1は文字列でないといけない
  // arg2はnullyか文字列でないといけない
  if (!isStringOrSa(arg1) || ((arg2 != null) && !isStringOrSa(arg2))) {
    tnE(`cannot make ${type} by: ${arg1} ${arg2}`);
  }
  let namespace, name;
  if (arg2 != null) {
    namespace = arg1;
    name = arg2;
  } else {
    name = arg1;
    const slashPos = arg1.indexOf('/');
    // slashで分割するが、例外としてslash一文字の時のみ分割しない
    if ((slashPos != -1) && (arg1.length != 1)) {
      namespace = arg1.substring(0, slashPos);
      name = arg1.substring(slashPos+1);
    }
  }
  // 利用可能な文字種のチェックを行い、saを生成して返す
  return (isValidNamespaceString(namespace) && isValidNameString(name)) ? sa.makeUnchecked(type, namespace, name) : tnE(`invalid character found in ${type}: ${namespace} ${name}`);
}
export const makeSymbol = (arg1, arg2=undefined) => makeKeywordOrSymbol('symbol', arg1, arg2);
export const makeKeyword = (arg1, arg2=undefined) => makeKeywordOrSymbol('keyword', arg1, arg2);


// referNamespaceとreferNameにsymbolとkeyword以外をかけた時の挙動は以下となる
// - saでないstringの場合：nameは元のstring、namespaceはnully
// - symbol, keyword以外のsaの場合：どちらもnully。例外は出さない
// - nully、数値、{}、等々の場合：どちらもnully。例外は出さない
const canReferNamespaceOrName = {
  // NB: ここはgccにmanglingされると困るので、文字列で指定する事
  'symbol': 1,
  'keyword': 1,
};
export const referNamespace = (saO) => {
  if (!isStringOrSa(saO)) { return }
  const stee = sa.parseUnchecked(saO);
  if (!stee) { return }
  if (canReferNamespaceOrName[stee[1]]) {
    const v = stee[2];
    if (v !== '') { return v }
  }
};
export const referName = (saO) => {
  if (!isStringOrSa(saO)) { return }
  const stee = sa.parseUnchecked(saO);
  if (!stee) { return saO } // 非saの文字列の場合、referNameは元の文字列を返す
  if (canReferNamespaceOrName[stee[1]]) {
    const v = stee[3];
    if (v !== '') { return v }
  }
};
export const isKeyword = (saO) => (sa.sa2typeUnchecked(saO) === 'keyword');
export const isSymbol = (saO) => (sa.sa2typeUnchecked(saO) === 'symbol');
export const sk2stringUnchecked = (k, prefix='') => {
  const stee = sa.parseUnchecked(k);
  if (!stee) { return }
  const ns = stee[2];
  const name = stee[3];
  return prefix + ((ns?.length) ? (ns+'/'+name) : name);
};
// 対応物以外を渡すとnullyが返る仕様
export const symbol2string = (k) => isSymbol(k) ? sk2stringUnchecked(k) : undefined;
export const keyword2string = (k) => isKeyword(k) ? sk2stringUnchecked(k, ':') : undefined;


export const spawnWithAnotherType = (saO, newType) => {
  if (!isStringOrSa(newType) || !sa.getSaTypeDefinitionTable()[newType]) {
    tnE(`invalid type ${newType}`);
  }
  const stee = sa.parseUnchecked(saO);
  if (stee) { return sa.makeUnchecked(newType, stee[2], stee[3]) }
  tnE(`cannot spawn from ${saO}`);
};
export const spawnWithAnotherNamespace = (saO, newNamespace) => {
  if (!isValidNamespaceString(newNamespace)) {
    tnE(`invalid namespace ${newNamespace}`);
  }
  const stee = sa.parseUnchecked(saO);
  if (stee) { return sa.makeUnchecked(stee[1], newNamespace, stee[3]) }
  tnE(`cannot spawn from ${saO}`);
};
export const spawnWithAnotherName = (saO, newName) => {
  if (!isValidNameString(newName)) {
    tnE(`invalid name ${newName}`);
  }
  const stee = sa.parseUnchecked(saO);
  if (stee) { return sa.makeUnchecked(stee[1], stee[2], newName) }
  tnE(`cannot spawn from ${saO}`);
};


// 引数の文字列の先頭から数値部分を切り出しparseし、結果と残りの二値を返す。
// 特殊な処理として、上記の「数値部分」がjs形式のdotはじまり小数(`.1`みたいな)
// だった場合のみ例外を投げる。
// 与えられた文字列の先頭が数値書式でなかった場合はundefinedを返す。
export const parseNumberFromLeftover = (leftover) => {
  let matched = leftover.match(validNumberAndLeftoverRe);
  if (!matched) {
    // js風のdotはじまり小数は禁止。
    // 間違えやすそうなのでわざとここでマッチさせて例外を投げる
    // (本当は↑の正規表現と一緒にしたいけれど、普通にやると
    // 整数がマッチしなくなるので、分けて判定する)
    matched = leftover.match(/^([-+]?\.\d+)(.*)$/s);
    if (!matched) { return }
  }
  const numStr = matched[1].replace(/^\+/, '');
  const newLeftover = matched[2];
  try {
    return [JSON.parse(numStr), newLeftover];
  } catch (e) {
    tnE(`invalid number literal ${numStr}`);
  }
};


export const parseSymbolFromLeftover = (leftover) => {
  const matched = leftover.match(validSymbolAndLeftoverRe);
  if (!matched) { return }
  const symbolStr = matched[1];
  const newLeftover = matched[2];
  // NB: もしsymbolStrが不正な場合、makeSymbolは例外を投げる
  //     (parseNumberFromLeftover内のtnEと同じ役目)
  const result = makeSymbol(symbolStr);
  return [result, newLeftover];
};


// 標準提供のsastringのユーティリティ
// NB: sastring2stringの扱いは異様に難しい！
//     sa自体も文字列である為、多重にstring2sastringを適用する事が可能な上、
//     「sastringを使いたい時」というのがそもそも「外部からの任意文字列が
//     偶然(もしくは故意に)saっぽかった場合でも安全に扱えるようにしたい」
//     ケースであり、つまり「saっぽい文字列にstring2sastringをかける」
//     事になるのがほとんど。しかしこれを安全にsastring2stringで解除するには
//     静的型言語のような機能が必要！しかしjsは動的型ベースなので…。
//     これが何を言っているのか分からない人はおそらく正しく扱えない。
//     sastring2stringは使わずに、外部からの入力はisSaLikeStringにかけて
//     真を返すものを弾くようにした方がよい。
//     (そもそも大体の外部入力チェックで、saMarkerCharacterを含むような入力が
//     入ってくる事はまず不正な入力と見ていいと思う)
//     どういう事なのか理解できた人は自己責任で使ってもよい。
//     (string2sastringだけ使い、sastring2stringは封印するのがおすすめ)
export const isSastring = (s) => (sa.sa2typeUnchecked(s) === 'sastring');
export const string2sastring = (str) => sa.make('sastring', '', str);
export const sastring2string = (saO) => {
  const o = sa.parse(saO);
  if (o?.type === 'sastring') { return o.content }
};


