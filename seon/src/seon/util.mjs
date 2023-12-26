import * as sa from './sa.mjs';
import * as sym from './sym.mjs';
import * as seon from './seon.mjs';


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
const postwalk = (tree, converter) => (seon.isVector(tree) ? seon.markAsVector(converter(tree.map((v)=>postwalk(v, converter))))
  : isArray(tree) ? converter(tree.map((v)=>postwalk(v, converter)))
  : isObject(tree) ? converter(kvs2obj(Object.keys(tree).flatMap((k)=>[converter(k), postwalk(tree[k], converter)])))
  : converter(tree));


export const postwalkWithMeta = (inputTree, converter) => {
  const metaMap = seon.getLastMetaMap();
  const migrateMeta = (src, dst) => {
    const m = metaMap.get(src);
    if (m !== undefined) { metaMap.set(dst, m) }
  };
  const postwalk2 = (tree) => {
    const result = seon.isVector(tree) ? seon.markAsVector(converter(tree.map(postwalk2)))
      : isArray(tree) ? converter(tree.map(postwalk2))
      : isObject(tree) ? converter(kvs2obj(Object.keys(tree).flatMap((k)=> {
        const v = tree[k];
        const newK = converter(k);
        const newV = postwalk2(v);
        migrateMeta(k, newK);
        migrateMeta(v, newV);
        return [newK, newV];
      })))
      : converter(tree);
    migrateMeta(tree, result);
    return result;
  };
  return postwalk2(inputTree);
};


// seon構造データをjson文字列に変換して返す。
// symbolとkeywordとsastringを素の文字列に変換する必要がある。
// (なぜなら、jsonファイルを出力するというのは大体
// 他のjsライブラリ向けへの対応であり、その際にsaエンコードの
// 文字列を出す事にメリットはほぼ無いので)
// ただ、この際にkebab-caseも変換するかどうかは悩む…。
// (jsの変数やプロパティなら変換した方がよいが、jsonの場合{}のkeyも必ず
// 文字列でありkebab-caseのままの方がいいケースと半々ぐらいのように思える為)
// なおjsonで扱えない要素があっても無視して続行する。
// 正規表現は {} になってしまう。これについてはもう諦める…。
// ただし true, false, nil, null のシンボルだけは対応する値に変換する。
const symbolTable = kvs2obj([
  sym.makeSymbol('true'), true,
  sym.makeSymbol('false'), false,
  sym.makeSymbol('nil'), null,
  sym.makeSymbol('null'), null,
]);
export const convertSeonStructToJsonString = (seonData) => JSON.stringify(postwalk(seonData, ((s) => (symbolTable[s] ?? sym.sa2stringForJson(s)))), null, 2);


// seon文字列をjson文字列に変換して返す。
export const convertSeonStringToJsonString = (seonString, filename=undefined) => convertSeonStructToJsonString(seon.readFromSeonString({filename: filename}, seonString));


// seon構造データをなめ、全内部symbolの内の %SEON 名前空間のrenameを行う
export const renameInternalSeonNamespaces = (seonData, newNamespaceString) => postwalkWithMeta(seonData, (tree) => (sym.isSymbol(tree) && sym.referNamespace(tree) === '%SEON') ? sym.spawnWithAnotherNamespace(tree, newNamespaceString) : tree);
