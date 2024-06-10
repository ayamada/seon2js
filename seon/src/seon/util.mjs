import * as Sa from './sa.mjs';
import * as Seon from './seon.mjs';
import * as Mangle from './mangle.mjs';


const isArray = Array.isArray;
const isPlainObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };
const tnEwTo = (msg, { lineNo, colNo }={}) => (lineNo ? tnE(`${msg} at line=${lineNo} col=${colNo}`) : tnE(msg));
const kvs2obj = (kvs) => {
  const o = {};
  while (kvs.length) {
    o[kvs[0]] = kvs[1];
    kvs = kvs.slice(2);
  }
  return o;
};
// NB: これはpostwalkなので子→親の順でconverterがかけられていく
export const postwalkWithMeta = (inputTree, converter) => {
  const metaMap = Seon.getLastMetaMap();
  const migrateMeta = (src, dst) => {
    const m = metaMap.get(src);
    if (m !== undefined) { metaMap.set(dst, m) }
  };
  const postwalk = (tree) => {
    const result = isArray(tree) ? converter(Seon.inheritMark(tree, tree.map(postwalk)))
      : isPlainObject(tree) ? converter(kvs2obj(Object.keys(tree).flatMap((k)=> {
        const v = tree[k];
        const newK = converter(k);
        const newV = postwalk(v);
        migrateMeta(k, newK);
        migrateMeta(v, newV);
        return [newK, newV];
      })))
      : converter(tree);
    migrateMeta(tree, result);
    return result;
  };
  return postwalk(inputTree);
};


// json化の際に true, false, null のシンボルだけは対応する値に変換する。
// 値にnullyが含まれるので要注意(inを使い判定する必要がある)
const symbol2jsonValue = {
  [Seon.makeSymbol('true')]: true,
  [Seon.makeSymbol('false')]: false,
  [Seon.makeSymbol('null')]: null,
};


// NB: これはpostwalkWithMetaから呼ばれるので、bの子要素には既に
//     rewriteForJsonがかかった状態だという理解でよい。
const block2object = (b) => {
  if (b%2) {
    tnEwTo("found odd number of elements in object literal",
      Seon.getLastMetaMap().get(b));
  }
  const result = {};
  let i = 0;
  while (i < b.length) {
    const key = b[i++];
    // 本来なら、このkeyが単一で存在できるものか、この次にvalを必要とするかを
    // 判断する必要があるが、ここではjson化する事だけを考えればよく、jsonでは
    // keyは必ず文字列である事が求められている
    if (!isStringOrSa(key)) {
      tnEwTo("found non-string key in object literal",
        Seon.getLastMetaMap().get(b));
    }
    const val = b[i++];
    result[key] = val;
  }
  return result;
};


// 素のjson内にsaの提供するsymbolやkeywordを残すべきではない。
// (なぜなら、jsonファイルを出力するというのは大体
// 他のjsライブラリ向けへの対応であり、その際にsaエンコードの
// 文字列を出す事にメリットはほぼ無いので)
// なので、json中のsa値は変換する必要がある。
const rewriteForJson = (v) => (
  // NB: listおよびvectorはそのままでいい(JSONからはarrayとして解釈される)
  (isArray(v) && Seon.isBlock(v)) ? block2object(v)
  : Seon.isSymbol(v) ? ((v in symbol2jsonValue) ? symbol2jsonValue[v] : Mangle.x2mangledString(v))
  : Seon.isKeyword(v) ? Mangle.x2mangledString(v)
  // なおsa以外の、jsonで扱えない要素はそのままにして続行する。
  // 正規表現等はJSON.stringifyにそのまま渡された結果 {} になってしまう。
  // だがJSON上で正規表現等を正しく扱う手段はない。諦める。
  : v);


export const convertSeonStringToJsonStruct = (seonString) => {
  const seonData = Seon.readOneFromSeonString(seonString);
  return postwalkWithMeta(seonData, rewriteForJson);
};


// Seon.readAllFromSeonStringした結果の構造内のsymbol/keywordを置換して回る。
// 置換条件は以下(ちょっと複雑)。
// - 構造内の要素とreplaceTableのkeyが完全一致する場合(symbolやkeyword等)、
//   その要素はreplaceTableのvalで置き換える。
// - replaceTableのkeyが純文字列(上記sa系でない文字列)の場合、
//   namespaceが同じかを見て、同じならSeon.renameNamespaceにかけて置き換える。
// - もしreplaceTableのvalが関数なら、関数に対象を渡し、その結果で置き換える。
//   (対象判定自体は上記と同じく、replaceTableのkeyで判定される)
// とりあえず '%CURRENT' の書き換えをしておくとよい。
// またseon2jsonレベルの簡単な処理であれば値への置換も可能。
export const rewriteAllSymbols = (exprs, replaceTable) => postwalkWithMeta(exprs, (tree) => {
  if (!Seon.isSymbol(tree) && !Seon.isKeyword(tree)) { return tree }
  // 単純置換
  if (tree in replaceTable) {
    const v = replaceTable[tree];
    return (v?.constructor === Function) ? v(tree) : v;
  }
  // namespaceのみのrename
  const oldNamespace = Seon.referNamespace(tree);
  const newNamespace = replaceTable[oldNamespace];
  return ((newNamespace == null) ? tree
    : (newNamespace.constructor === Function) ? newNamespace(tree)
    : Seon.renameNamespace(tree, newNamespace));
});


// seonコード文字列を渡すと、nsを適切に変換した構造を返してくれる。
// 単にreadAllFromSeonStringしてからrewriteAllSymbolsしているだけだが、
// この二つは大体セットで使うので関数化した。
export const seonCode2exprs = (seonCode, replaceTable, seonOpts={}) => {
  const exprs = Seon.readAllFromSeonString(seonCode, seonOpts);
  return rewriteAllSymbols(exprs, replaceTable);
};


export default {
  postwalkWithMeta,
  convertSeonStringToJsonStruct,
  rewriteAllSymbols,
  seonCode2exprs,
};
