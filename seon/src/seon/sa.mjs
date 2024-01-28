// sa とは stringified-atom の略で、lisp固有のsymbolやkeywordを
// json上で表現する為の「js文字列としてエンコードされるatom」。
// saはjs文字列なのでimmutableであり、===で確実な比較が可能。
// (これが一番大きいメリット)


// saは内部にtype, meta, contentの三つの値を格納できる。
// - typeはそのsaの種類を示す。標準提供されているsa種別以外を使いたい場合は、
//   まずテーブルに登録しておく必要がある。
//   また、typeの名前に使える文字は正規表現の \w で許容される文字のみ使用可能
// - metaはこのsaのメタ情報を示す。
//   clojureとは違い、メタ情報の違うsa同士は===で同一判定にはならない事に注意。
// - contentはこのsaの本体の情報を示す。


// `Unchecked` とついている関数は、必要なチェックをスキップして値を返す。
// 高速だが、通常は `Unchecked` なしの方の関数を使った方が安全。


const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };


// TODO: `\u0001` で安全かどうか各ブラウザで最終確認を取る事！
export const saMarkerCharacter = "\u0001";


// saは "\1(type)\1(meta)\1(content)\1" のような文字列で表現される。
// - typeはこのsaの種別を示す。
//   英数と `_` だけで組まれた、非常に種類の限定された文字列で示される。
// - metaはこのsaのメタ情報を示す。 `\1` 以外のあらゆる文字列を含められる。
//   (複雑な構造を入れたい時はJSON.stringify()にやらせればよい)
//   どのような値がどのような形式で収められるかはtypeに依存するが、
//   とにかく `\1` を含まない文字列になっていれば収納できる。
// - contentはこのsaの内容を示す。 `\1` を含む、あらゆる文字列を含められる。
const saRe = new RegExp(`^${saMarkerCharacter}(\\w+)${saMarkerCharacter}([^${saMarkerCharacter}]*)${saMarkerCharacter}(.*)${saMarkerCharacter}$`, 's');


// 外部入力された文字列がsaっぽくないかをチェックする為のもの。
// isSaLikeString()が真を返す「外部入力された文字列」は
// 問題を起こす可能性が高いので、できれば事前に弾く事を勧める。
export const isSaLikeString = (sa) => (isStringOrSa(sa) && saRe.test(sa));


// 各値のvalidateとencode/decodeは呼び出し元が責任を持つ事になった。必ず
// 以下をチェックする事！
// - typeは、\w系の文字が1文字以上ある文字列である事
// - metaは、`\1` を含まない文字列である事
// - contentは、文字列である事
export const make = (type, meta, content) => `${saMarkerCharacter}${type}${saMarkerCharacter}${meta??''}${saMarkerCharacter}${content??''}${saMarkerCharacter}`;


// saより情報を取り出す。
// return [sa, type, meta, content] or null or undefined
export const parse = (sa) => sa?.match?.(saRe)?.slice(1);
export const sa2type = (sa) => sa?.match?.(saRe)?.[1];
export const sa2meta = (sa) => sa?.match?.(saRe)?.[2];
export const sa2content = (sa) => sa?.match?.(saRe)?.[3];


