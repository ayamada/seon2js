import * as sa from './sa.mjs';
import * as sym from './sym.mjs';
import * as seon from './seon.mjs';
import * as mangle from './mangle.mjs';


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
  const metaMap = seon.getLastMetaMap();
  const migrateMeta = (src, dst) => {
    const m = metaMap.get(src);
    if (m !== undefined) { metaMap.set(dst, m) }
  };
  const postwalk = (tree) => {
    const result = seon.isVector(tree) ? seon.markAsVector(converter(tree.map(postwalk)))
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
  sym.makeSymbol('true'), true,
  sym.makeSymbol('false'), false,
  sym.makeSymbol('nil'), null,
  sym.makeSymbol('null'), null,
]);


// 素のjson内にsaの提供するsymbolやkeywordを残すべきではない。
// (なぜなら、jsonファイルを出力するというのは大体
// 他のjsライブラリ向けへの対応であり、その際にsaエンコードの
// 文字列を出す事にメリットはほぼ無いので)
// なので、json中のsa値は変換する必要がある。
const rewriteSaForJson = (v) => (
  sym.isSymbol(v) ? (symbol2jsonValue.hasOwnProperty(v) ? symbol2jsonValue[v] : mangle.x2mangledString(v))
  : sym.isKeyword(v) ? mangle.x2mangledString(v)
  : sym.isSastring(v) ? sym.sastring2string(v)
  // なおsa以外の、jsonで扱えない要素はそのままにして続行する。
  // 正規表現等はJSON.stringifyにそのまま渡された結果 {} になってしまう。
  // これについてはもう諦める…。
  : v);


// seon構造(read済)をjson文字列に変換して返す。
export const convertSeonStructToJsonString = (seonData) => JSON.stringify(postwalkWithMeta(seonData, rewriteSaForJson), null, 2);


// seon文字列をjson文字列に変換して返す。
export const convertSeonStringToJsonString = (seonString, filename=undefined) => convertSeonStructToJsonString(seon.readFromSeonString({filename: filename}, seonString));


// seon構造データをなめ、全内部symbolの内の %SEON 名前空間のrenameを行う
export const renameInternalSeonNamespaces = (seonData, newNamespaceString) => postwalkWithMeta(seonData, (tree) => (sym.isSymbol(tree) && sym.referNamespace(tree) === '%SEON') ? sym.spawnWithAnotherNamespace(tree, newNamespaceString) : tree);
