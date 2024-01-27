import * as Sym from './sym.mjs';
import * as Seon from './seon.mjs';
import * as Mangle from './mangle.mjs';


const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const kvs2obj = (kvs) => {
  const o = {};
  while (kvs.length) {
    o[kvs[0]] = kvs[1];
    kvs = kvs.slice(2);
  }
  return o;
};
export const postwalkWithMeta = (inputTree, converter) => {
  const metaMap = Seon.getLastMetaMap();
  const migrateMeta = (src, dst) => {
    const m = metaMap.get(src);
    if (m !== undefined) { metaMap.set(dst, m) }
  };
  const postwalk = (tree) => {
    const result = Seon.isVector(tree) ? Seon.markAsVector(converter(tree.map(postwalk)))
      : isArray(tree) ? converter(tree.map(postwalk))
      : isObject(tree) ? converter(kvs2obj(Object.keys(tree).flatMap((k)=> {
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


// json化の際に true, false, nil, null のシンボルだけは対応する値に変換する。
// 値にnullyが含まれるので要注意(hasOwnPropertyを使い判定する必要がある)
const symbol2jsonValue = kvs2obj([
  Sym.makeSymbol('true'), true,
  Sym.makeSymbol('false'), false,
  Sym.makeSymbol('nil'), null,
  Sym.makeSymbol('null'), null,
]);


// 素のjson内にsaの提供するsymbolやkeywordを残すべきではない。
// (なぜなら、jsonファイルを出力するというのは大体
// 他のjsライブラリ向けへの対応であり、その際にsaエンコードの
// 文字列を出す事にメリットはほぼ無いので)
// なので、json中のsa値は変換する必要がある。
const rewriteSaForJson = (v) => (
  Sym.isSymbol(v) ? (symbol2jsonValue.hasOwnProperty(v) ? symbol2jsonValue[v] : Mangle.x2mangledString(v))
  : Sym.isKeyword(v) ? Mangle.x2mangledString(v)
  : Sym.isSastring(v) ? Sym.sastring2string(v)
  // なおsa以外の、jsonで扱えない要素はそのままにして続行する。
  // 正規表現等はJSON.stringifyにそのまま渡された結果 {} になってしまう。
  // これについてはもう諦める…。
  : v);


export const convertSeonStringToJsonStruct = (seonString, filename=undefined) => {
  const seonData = Seon.readFromSeonString({filename}, seonString);
  return postwalkWithMeta(seonData, rewriteSaForJson);
};


// seon構造データをなめ、全内部symbolの内の %SEON 名前空間のrenameを行う
export const renameInternalSeonNamespaces = (seonData, newNamespaceString) => postwalkWithMeta(seonData, (tree) => (Sym.isSymbol(tree) && Sym.referNamespace(tree) === '%SEON') ? Sym.spawnWithAnotherNamespace(tree, newNamespaceString) : tree);
