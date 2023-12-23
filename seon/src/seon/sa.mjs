// sa とは stringified-atom の略で、lisp固有のsymbolやkeywordを
// json上で表現する為の「js文字列としてエンコードされるatom」。
// saはjs文字列なのでimmutableであり、===で確実な比較が可能。
// (これが一番大きいメリット)


// saは内部にtype, meta, contentの三つの値を格納できる。
// - typeはそのsaの種類を示す。最初から提供されている三つのsa種別以外を使いたい
//   場合は、まずテーブルに登録しておく必要がある。
//   また、typeの名前に使える文字は正規表現の \w で許容される文字のみ使用可能。
//   またgcc最適化の為に、{}にdotアクセスできる形式の名前が望ましい
// - metaはこのsaのメタ情報を示す。
//   clojureとは違い、メタ情報の違うsa同士は===で同一判定にはならない事に注意。
// - contentはこのsaの本体の情報を示す。


// `Unchecked` とついている関数は、必要なチェックをスキップして値を返す。
// 高速だが、通常は `Unchecked` なしの方の関数を使った方が安全。


const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isString = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };


// NB: これはseonバージョンによって差し替える想定。
//     また内部エントリは手でいじる事を許容する。
//     内部エントリの構造は以下のようになる。
//     saTypeDefinitionTable[type] = { // 内部は省略可能
//       meta: {
//         encoder: (v) => { ... }, // 文字列化が必須、省略可能
//         decoder: (v) => { ... }, // ↑と対応する処理が必要、省略可能
//       },
//       content: {
//         encoder: (v) => { ... }, // 文字列化が必須、省略可能
//         decoder: (v) => { ... }, // ↑と対応する処理が必要、省略可能
//       },
//     };
let saTypeDefinitionTable = {};
const type2definition = (type) => saTypeDefinitionTable[type] || tnE(`sa type not found: ${type}`);
export const getSaTypeDefinitionTable = () => saTypeDefinitionTable;
export const setSaTypeDefinitionTable = (newTable) => (saTypeDefinitionTable = newTable);
// TODO: このインターフェースは改めるかも(直にテーブルをいじらせない方がいい気がする…)


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
export const isSaLikeString = (sa) => (isString(sa) && saRe.test(sa));


// もし高速性が必要な場合は、自己責任でこれらを使ってもよい(取扱注意)
export const makeUnchecked = (type, encodedMeta, encodedContent) => `${saMarkerCharacter}${type}${saMarkerCharacter}${encodedMeta??''}${saMarkerCharacter}${encodedContent??''}${saMarkerCharacter}`;
export const parseUnchecked = (sa) => sa?.match?.(saRe); // return [sa, type, encodedMeta, encodedContent] or null or undefined
export const sa2typeUnchecked = (sa) => sa?.match?.(saRe)?.[1];
export const sa2encodedMetaUnchecked = (sa) => sa?.match?.(saRe)?.[2];
export const sa2encodedContentUnchecked = (sa) => sa?.match?.(saRe)?.[3];


// typeに応じたsaを生成する。typeは事前に登録しておく必要がある。
// metaとcontentはデフォルトでは文字列しか格納できないが、
// type事前登録でencoder/decoderを適切に設定しておく事で、
// 文字列以外も格納できるようになる。
// 何らかの不正や不備があれば例外が投げられる。多くは以下が原因。
// - type未登録
// - 使用禁止文字入りのtype名
// - metaやcontentが文字列以外の何か
export const make = (type, meta, content) => {
  const definitionEntry = type2definition(type);
  const metaEncoder = definitionEntry.meta?.encoder;
  const contentEncoder = definitionEntry.content?.encoder;
  const encodedMeta = metaEncoder ? metaEncoder(meta) : meta;
  const encodedContent = contentEncoder ? contentEncoder(content) : content;
  return ((
    isString(type) && (/^\w+$/.test(type))
    &&
    isString(encodedMeta) && !encodedMeta.includes(saMarkerCharacter)
    &&
    isString(encodedContent)
  ) ? makeUnchecked(type, encodedMeta, encodedContent)
    : tnE(`sa.make: found invalid parameter: ${type}, ${encodedMeta}, ${encodedContent}`));
};


// saより情報を取り出す。
// 対象がsaでない時はundefinedを返す。
// saだけどtypeが登録されていない時、何らかのエラーがあった時は例外を投げる。
export const parse = (sa) => {
  const stee = (isString(sa) && parseUnchecked(sa));
  if (!stee) { return }
  const [_, type, encodedMeta, encodedContent] = stee;
  const definitionEntry = type2definition(type);
  const metaDecoder = definitionEntry.meta?.decoder;
  const contentDecoder = definitionEntry.content?.decoder;
  const meta = metaDecoder ? metaDecoder(encodedMeta) : encodedMeta;
  const content = contentDecoder ? contentDecoder(encodedContent) : encodedContent;
  return {
    type: type,
    meta: meta,
    content: content,
  };
};


// TODO: 可能ならもっと最適化したいが…
export const sa2type = (sa) => parse(sa)?.type;
export const sa2meta = (sa) => parse(sa)?.meta;
export const sa2content = (sa) => parse(sa)?.content;


