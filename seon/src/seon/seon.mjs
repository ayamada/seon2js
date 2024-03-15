import * as Sa from './sa.mjs';


// SEON - S-Expression-Object-Notation - read engine for seon2js


// モジュール概要
// - 後述の「SEONフォーマット」のテキストを読み、jsのarrayやobjectで組まれた
//   構造を返す機能の提供
//   - これ自体は単なる「readエンジン」であり、何らかの役割を果たす為には
//     この後に任意の「evalエンジン」を接続する必要がある
// - 上記の逆変換を行う機能の提供
//   - つまり「writeエンジン」でもある(が、writeは必須という訳ではない)
// - 要はつまりJSONみたいなやつ(だから名前もSEONにした)


// SEONフォーマット概要
// - SEONフォーマットは、多くをclojureとednとschemeをベースにしている。
//   https://clojure.org/reference/reader
//   https://github.com/edn-format/edn
//   http://practical-scheme.net/gauche/man/?l=ja&p=%23%E6%A7%8B%E6%96%87
// - 基本的にはclojure/ednと大体同じ。違いは以下。
//   - `,` の扱いを、従来のS式と同じ(unquote)に戻した(一番大きな相違点)
//   - 数値は現在のところ10進整数と10進小数のみサポート。
//     (将来的には10進以外の記法もサポートするが、dispatch対応になる想定)
//     またjsの `.1` のような0省略記法には未対応。
//   - symbolとkeywordを安全に扱う為に、「sa(stringified-atom)」を用意した。
//     詳細はsa.mjsを参照だが、symbolとkeywordは
//     「symbol/keywordであると同時に、エンコードされた文字列でもある」。
//     jsのobjectのkey部にsymbol/keywordを安全に格納できるメリットがあるが、
//     「文字列だけ処理したいが、symbol/keywordは処理したくない」時に
//     うっかりしやすい問題がある。要注意。
//   - quote等の自動展開シンボルは %SEON のnamespaceを持たせるようにした
//     (ユーザのsymbol名前空間をなるべく侵略したくないので)
//   - {} はjsのobjectに変換される関係で、keyは必ず文字列かkeywordの
//     いずれかでなくてはならない(前述の通り、symbolとkeywordは文字列の一種)。
//     symbolも許容しようと思えば可能なのだが、ここにsymbolがあると、
//     束縛値に変換されるのかsymbolのままなのか曖昧で逆に扱いづらくなるので、
//     symbolは禁止する事にした。柔軟にkeyを設定したい場合は、
//     空の {} を生成し、その後にエントリ追加すればいい。
//   - () と [] と {} はいずれもjsのarrayに変換される。これらを区別する為に
//     それぞれ以下の追加propertyが付与される。
//     - () には `%L=1`
//     - [] には `%V=1`
//     - {} には `%O=1`
//   - #"..." はclojure同様、正規表現に変換される
//   - #_ はclojure同様の「1要素コメント」、兼、「readエンジンへのメタ指定」。
//     #_ の後に指定keyを持つ{}を入れる事で、readエンジンの設定を行える。
//     しかし設定項目は全て未実装。
//   - #t #true #f #false #nil #null #inf #+inf #-inf #nan はquoteされていても
//     jsの true false null Infinity -Infinity NaN に解決される。
//     (symbolとしてのtrueやfalseはquoteしてsymbolとして扱える)
//     ただ、通常はsymbol版を使えばよいので、これを意識する必要は薄い。
//     (これらが必要になるのは、special-formやmacro内などに限られる)
//     なお実装上の理由で #undefined のみ提供されていないので注意。
//   - 上記以外にも # はじまりの機能を好きに定義し直せる。
//     これはディスパッチシンボルテーブルいじりによって提供される。
// - readの実行後、別途metaMapが提供される。
//   これはread結果の構造に含まれるsymbol, keyword, array, objectの各部を
//   keyとするMapで、そのvalueは { filename, lineNo, colNo } になっている。
//   要はエラー時にソース行番号などを示す為の情報。
//   マクロ展開などにより構造が変化する場合は、metaの引き継ぎを忘れるな！
//   seon/utilにて、このmetaの引き継ぎを行いやすくする関数が提供されている。


// seonの吐いたjs構造を評価するevalエンジンは以下の特殊シンボルを処理する事。
// seon/utilにて、これらの特殊シンボルの変換サポート関数が提供されている。
// - %SEON/quote - 普通のlispのquoteと同じ
// - %SEON/quasiquote - 同上
// - %SEON/unquote - 同上
// - %SEON/unquote-splicing - 同上
// - %SEON/deref - clojure由来。拡張可能な汎用関数を割り当てるとよい


// 略語/内部構造メモ
// - to: token-object。ソース文字列をtokenizeした各部分毎に生成される。
//   実体は { category, content, lineNo, colNo } になる。
//   ただしcategoryとcontentは省略されている場合あり。
//   - lineNoおよびColNoは0はじまりではなく1はじまり！
// - pp: parenthesis-pair。括弧対応。 () [] {} の三種。


// 汎用ユーティリティ
const isArray = Array.isArray;
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };
export const tnEwTo = (msg, to) => tnE(to ? `${msg} at line=${to.lineNo} col=${to.colNo}` : msg);


// NB: これらはseonレベルではエラーチェックをしていない。その為、本来なら
//     エラーとすべき「-1」や「::::」のようなsymbolやkeywordを作れてしまう。
//     これらについては呼び出し元(seon2js)サイドでチェックする事。
const makeSymbolOrKeyword = (type, symbolStr) => {
  const [first, ... rest] = symbolStr.split('/');
  return (first.length && rest.length) ? Sa.make(type, first, rest.join('/')) : Sa.make(type, '', symbolStr);
};
export const makeSymbol = (symbolStr) => makeSymbolOrKeyword('symbol', symbolStr);
// NB: symbolStrにキーワード先頭の : は含めない事！注意！
export const makeKeyword = (symbolStr) => makeSymbolOrKeyword('keyword', symbolStr);
export const makeDenotation = (name) => Sa.make('denotation', '', name);
export const isSymbol = (o) => (Sa.sa2type(o) === 'symbol');
export const isKeyword = (o) => (Sa.sa2type(o) === 'keyword');
export const isDenotation = (o) => (Sa.sa2type(o) === 'denotation');
export const x2string = (s) => {
  const parsed = Sa.parse(s);
  if (!parsed) { return }
  const [type, namespace, content] = parsed;
  return (namespace === '') ? content : (namespace + '/' + content);
};
export const symbol2string = (s) => (isSymbol(s) ? x2string(s) : undefined);
export const keyword2string = (s) => (isKeyword(s) ? x2string(s) : undefined);
const emptyString2undefined = (s) => ((s === '') ? undefined : s);
export const referNamespace = (s) => emptyString2undefined(Sa.sa2meta(s));
export const referName = (s) => emptyString2undefined(Sa.sa2content(s));
export const renameNamespace = (s, newNamespace) => {
  const parsed = Sa.parse(s);
  if (!parsed) { return }
  const [type, , content] = parsed;
  return Sa.make(type, newNamespace, content);
};
// NB: lisp処理系を作る際にmakeSymbolは頻出。ショートカット記法を提供しておく
// js上で SYM`foo` と書ける。また SYM('foo') も許容する
export const SYM = (ss) => makeSymbol(isArray(ss) ? ss[0] : ss);
// js上で KW`foo` と書ける。また KW('foo') も許容する
export const KW = (ss) => makeKeyword(isArray(ss) ? ss[0] : ss);


export const listMarkerKey = '%L';
export const vectorMarkerKey = '%V';
export const blockMarkerKey = '%B';
export const isList = (a) => (isArray(a) && a[listMarkerKey]);
export const isVector = (a) => (isArray(a) && a[vectorMarkerKey]);
export const isBlock = (a) => (isArray(a) && a[blockMarkerKey]);
export const markAsList = (a) => ((a[listMarkerKey] = 1), a);
export const markAsVector = (a) => ((a[vectorMarkerKey] = 1), a);
export const markAsBlock = (a) => ((a[blockMarkerKey] = 1), a);
export const markAsList2 = (a) => ((a[listMarkerKey] = 2), a);
export const markAsVector2 = (a) => ((a[vectorMarkerKey] = 2), a);
export const markAsBlock2 = (a) => ((a[blockMarkerKey] = 2), a);
// 上記種別を引き継がせる
export const inheritMark = (oldArr, newArr) => {
  (isList(oldArr) && (newArr[listMarkerKey] = oldArr[listMarkerKey]));
  (isVector(oldArr) && (newArr[vectorMarkerKey] = oldArr[vectorMarkerKey]));
  (isBlock(oldArr) && (newArr[blockMarkerKey] = oldArr[blockMarkerKey]));
  return newArr;
};


// read毎のSEONの状態をここに持たせる。
let seonState;
const resetSeonState = () => (seonState = {
  metaMap: new Map(),
});


// evalの際にエラー行番号などを表示させる為の
// 「各node→{lineNo, colNo}」のエントリを持つMapが、readの際に、
// 自動的に生成される。これを参照できるやつ。
// なおこれはread毎に生成されるので、必要ならread後すぐに取得する事。
export const getLastMetaMap = () => seonState?.metaMap;
const referMeta = (entity) => seonState.metaMap.get(entity);
const registerMeta = (entity, to) => seonState.metaMap.set(entity, { ... to });
const unregisterMeta = (entity) => seonState.metaMap.delete(entity);


// 文字列リテラル内で特別な変換が必要なエスケープ文字(の \ を抜いたもの)
// なお `\` や `"` 等もエスケープ必須だが、これらはそのままの意味なので
// 「特別な変換」は不要でありここに記す必要はない。
const specialCharactersInStringLiteral = {
  "t": "\t",
  "r": "\r",
  "n": "\n",
};


// " はじまりの文字列から、seon文字列リテラル部分を読み取り、アンエスケープし、
// その結果をtoおよび残り部分の情報として配列で返す。
const parseString = (leftover, startLineNo, startColNo) => {
  let isEscaping;
  let result = '';
  let lineNo = startLineNo;
  let colNo = startColNo;
  const throwError = () => tnEwTo(`invalid string (startLineNo=${startLineNo}, startColNo=${startColNo})`, { lineNo, colNo });
  if (leftover[0] !== '"') { throwError() } // 先頭は必ず `"`
  leftover = leftover.slice(1);
  colNo++;
  while (1) {
    if (!leftover.length) { throwError() } // 文字列終了の `"` なしにファイル終端に到達した
    const chr = leftover[0];
    leftover = leftover.slice(1);
    colNo++;
    if (isEscaping) {
      result += (specialCharactersInStringLiteral[chr] || chr);
      isEscaping = false;
    } else if (chr === '"') {
      break;
    } else if (chr === "\\") {
      isEscaping = true;
    } else if (chr === "\n") {
      result += chr;
      lineNo++;
      colNo = 1;
    } else {
      result += chr;
    }
  }
  // saとして解釈できる文字列を普通に与える事は許容しない
  if (Sa.isSaLikeString(result)) { throwError() }
  return [result, leftover, lineNo, colNo];
};




// 与えられた文字列を「comment」「string」「undigested」の三種にtokenizeする。
// 「undigested」のものは後で更に細かくtokenizeする必要がある。
// (disassembleUndigestedTokenObjectがそれを行う)
// この結果は「tokenObjectの配列」として返される。
const tokenizePhase1 = (leftover, startLineNo, startColNo) => {
  const result = [];
  let currentLineNo = startLineNo;
  let currentColNo = startColNo;
  let buf = '';

  const commitBufAs = (category) => {
    result.push({
      category: category,
      content: buf,
      lineNo: startLineNo,
      colNo: startColNo,
    });
    startLineNo = currentLineNo;
    startColNo = currentColNo;
    buf = '';
  };
  const commitBufAsUndigestedIfNotEmpty = () => (buf.length && commitBufAs('undigested'));
  while (leftover.length) {
    const peekedChr = leftover[0];
    if (peekedChr === ';') {
      commitBufAsUndigestedIfNotEmpty();
      // ; コメントのparseを開始
      const posOfLf = leftover.indexOf("\n");
      buf = (posOfLf === -1) ? leftover : leftover.slice(0, posOfLf);
      leftover = (posOfLf === -1) ? '' : leftover.slice(posOfLf + 1);
      currentLineNo++;
      currentColNo = 1;
      commitBufAs('comment');
    } else if (peekedChr === '"') {
      commitBufAsUndigestedIfNotEmpty();
      // " 文字列のparseを開始
      [buf, leftover, currentLineNo, currentColNo] = parseString(leftover, currentLineNo, currentColNo);
      commitBufAs('string');
    } else {
      // それ以外はundigestedとして蓄積
      buf += peekedChr;
      leftover = leftover.slice(1);
      if (peekedChr === "\n") {
        currentLineNo++;
        currentColNo = 1;
      } else {
        currentColNo++;
      }
    }
  }
  commitBufAsUndigestedIfNotEmpty();
  return result;
};


// 空白文字判定されるもの一覧
const spaceCharacterDefinitionTable = {
  " ": 'whitespace',
  "\r": 'carriage-return',
  "\n": 'line-feed',
  "\t": 'tab',
};


const specialCharacterDefinitionTable = {
  "'": '%SEON/quote',
  "`": '%SEON/quasiquote',
  ",": '%SEON/unquote', // clojureとは割り当てが違うので要注意
  "@": '%SEON/deref', // unquoteと合わさってunquote-splicingにするか、素の関数
  '#': '%SEON/dispatch', // 後続要素により挙動が変化する、カスタマイズ可能記号
  ":": '%SEON/keyword', // clojure由来。二個重ねるケースあり、注意
  "^": '%SEON/reserved', // clojureのmetadataだがseonでは予約語扱い
  "\\": '%SEON/reserved', // clojureのcharacter literalだがseonでは予約語扱い
  "~": '%SEON/reserved', // clojureのunquoteだがseonでは予約語扱い
  // "%": undefined, // 普通にidentifier構築に使える文字
  // "$": undefined, // 普通にidentifier構築に使える文字
  // ".": undefined, // 普通にidentifier構築に使える文字
  // "/": undefined, // 普通にidentifier構築に使える文字
};


// 構造文字判定されるもの一覧
const ppOpenToCloseTable = {
  "(": ")",
  "{": "}",
  "[": "]",
}
const ppCloseToOpenTable = Object.fromEntries(Object.entries(ppOpenToCloseTable).map(([k, v])=>[v, k]));


// disassembleの為に、各文字を大カテゴリで分類し直す
const expandForDC2C = (category, dt) => {
  const result = {};
  for (const k in dt) { result[k] = category }
  return result;
};
const disassembledCharacter2category = {
  ... expandForDC2C('space', spaceCharacterDefinitionTable),
  ... expandForDC2C('special', specialCharacterDefinitionTable),
  ... expandForDC2C('structure', ppOpenToCloseTable),
  ... expandForDC2C('structure', ppCloseToOpenTable),
};


const parseFromLeftover = (parser, leftover, lineNo, colNo) => {
  try {
    // parserは [parsed, newLeftover] の二値、もしくはnullyを返す
    const result = parser(leftover);
    if (result) {
      const [parsed, newLeftover] = result;
      // NB: numberもsymbolも改行を含まないので、lineNoは変化しない！
      const newColNo = colNo + leftover.length - newLeftover.length;
      return [parsed, newLeftover, lineNo, newColNo];
    }
  } catch (e) {
    tnEwTo(e.message, { lineNo, colNo });
  }
};
const validNumberAndLeftoverRe = /^([-+]?\d+(?:\.\d+)?)(.*)$/s;
const parseNumberFromLeftover = (leftover) => {
  let matched = leftover.match(validNumberAndLeftoverRe);
  if (matched) {
    const numStr = matched[1].replace(/^\+/, '');
    const newLeftover = matched[2];
    try {
      return [JSON.parse(numStr), newLeftover];
    } catch (e) {
      tnE(`invalid number literal ${numStr}`);
    }
  } else {
    // js風のdotはじまり小数(`.1` 等)は禁止。
    // 間違えやすそうなのでわざとここでマッチさせて例外を投げる
    matched = leftover.match(/^([-+]?\.\d+)(.*)$/s);
    if (matched) { tnE(`invalid number literal ${matched[1]}`) }
  }
};
// NB: この正規表現は数値にもマッチする！先にparseNumberFromLeftoverを通す事！
const validSymbolAndLeftoverRe = /^([-*+!?$%&=<>\/\w.|~^]+)(.*)$/s;
const parseSymbolFromLeftover = (leftover) => {
  const matched = leftover.match(validSymbolAndLeftoverRe);
  if (matched) {
    const [, symbolStr, newLeftover] = matched;
    const newSymbol = makeSymbol(symbolStr);
    return [newSymbol, newLeftover];
  }
};
export const throwErrorIfInvalidSymbolName = (name) => {
  // 数値としてvalidなものはsymbol名としては不正
  // parseNumberFromLeftover は .1 を検出すると例外を出す(このチェックも大事)
  if (!parseNumberFromLeftover(name)) {
    const matched = name.match(validSymbolAndLeftoverRe);
    // マッチし、leftoverが空なら検査成功
    if (matched && !matched[2].length) { return }
  }
  tnE(`invalid symbol name ${name}`);
};


const disassembleUndigestedTokenObject = (to) => {
  // NB: ここの呼び出し元はflatMapなので、必ず「toのlist」を返す必要がある！
  if (to.category != 'undigested') { return [to] }
  const result = [];
  let leftover = to.content;
  let { lineNo, colNo } = to;
  let category, content, tmp;
  const commit = () => result.push({ category, content, lineNo, colNo });
  while (leftover.length) {
    const peekedChr = leftover[0];
    // 括弧類および特殊記号を個別に分解する
    if (category = disassembledCharacter2category[peekedChr]) {
      content = peekedChr;
      commit();
      leftover = leftover.slice(1);
      if (peekedChr === "\n") {
        lineNo++;
        colNo = 1;
      } else {
        colNo++;
      }
    }
    // NB: 数値は一部のシンボルと重なる為、先に判定する
    else if (tmp = parseFromLeftover(parseNumberFromLeftover, leftover, lineNo, colNo)) {
      [content, leftover, lineNo, colNo] = tmp;
      category = 'number';
      commit();
    }
    // NB: シンボルは他と重なる為、最後に判定する
    else if (tmp = parseFromLeftover(parseSymbolFromLeftover, leftover, lineNo, colNo)) {
      [content, leftover, lineNo, colNo] = tmp;
      category = 'symbol';
      commit();
    } else {
      // asciiの制御コード範囲の文字が来た時や、
      // コメント/文字列でない位置にunicode文字があった場合にここに来る
      tnEwTo(`invalid character found: "${peekedChr}"`, { lineNo, colNo });
    }
  }
  return result;
};


// TODO: スタックを消費しないよう組み直した方がよい(現状だと構造の入れ子が深い時にMaximum call stack size exceededが起こってしまう)。とてもめんどい
// _atooli : assembleTokenObjectsOnlyList Internal
const _atooli = (tos, openTag, closeTag, startLine, startCol) => {
  const result = [];
  const throwError = (to, isLoseCloseTag=undefined) => {
    const openCloseTagMsg = (openTag && closeTag) ? `started ${JSON.stringify(openTag)} at ${startLine}:${startCol}, searching ${JSON.stringify(closeTag)}, but ` : '';
    const foundMsg = isLoseCloseTag ? `lost`
      : (openTag && closeTag) ? `found ${JSON.stringify(to.content)}`
      : `found unopened orphan ${JSON.stringify(to.content)}`
    tnEwTo('structure unmatched: ' + openCloseTagMsg + foundMsg, to);
  };
  while (tos.length) {
    const to = tos[0];
    tos = tos.slice(1);
    // structure以外をストックしていく
    if (to.category !== 'structure') {
      result.push(to);
      continue;
    }
    // ここより下ではto.categoryは必ずstructureになる
    // 自身のcloseTagを発見したら、ここで結果を返す
    if (closeTag === to.content) {
      // 自身の結果に閉じタグを含めておく(外で種類に応じた処理を行う為)
      result.push(to)
      return [result, tos];
    }
    const newOpenTag = to.content;
    const newCloseTag = ppOpenToCloseTable[newOpenTag];
    // newCloseTagがない＝to.contentは不一致の閉じタグだった
    if (!newCloseTag) { throwError(to) }
    // newCloseTagがある＝to.contentは新しい構造開始タグ
    const [assembled, leftTos] = _atooli(tos, newOpenTag, newCloseTag, to.lineNo, to.colNo);
    // 子の先頭に開始タグを含めておく(外で種類に応じた処理を行う為)
    assembled.unshift(to);
    result.push(assembled);
    tos = leftTos;
  }
  // 閉じタグが閉じないままtosを全消費するのはエラー
  if (closeTag !== undefined) { throwError(tos[tos.length-1], 1) }
  // 正常に最後まで処理できた
  return [result, tos];
};


const assembleTokenObjectsOnlyList = (tos) => {
  const { lineNo, colNo } = tos[0];
  return _atooli(tos, undefined, undefined, lineNo, colNo)[0];
}


const dispatcheeSymbolDiscard = makeSymbol('_');
// NB: ※※※ここで構造を生成した場合は、忘れずにmetaMapに登録する事※※※
// NB: この中でdispatch処理を行った場合はtruthyを返す事！
//     (truthyを返さなかった場合、更に後続のdispatch処理がなされてしまい、
//     最終的にはエラー扱いになる)
// NB: 先頭ほど優先度が高い(先に実行される)
const defaultDispatchFns = [
  // #_ (discard one element)
  (to, dispatchee, stack) => {
    // この時のdispatcheeは _ だが、後続の数値やsymbolと結合し謎symbolに
    // なってしまうケースが普通にある。それも含めて判定する必要がある。
    if (symbol2string(dispatchee)?.indexOf('_') === 0) {
      // dispatcheeが素の _ の場合は後続と結合していないので、
      // 明示的に更に一個の要素を消す必要がある。
      // (結合している場合に消さないといけないものは結合対象という事になり、
      // その時は何もしなくてよい)
      if (dispatchee === dispatcheeSymbolDiscard) {
        const v = shiftStack(to, stack);
        // TODO: 将来に #_{SEON/VER 12.3} のような、特定記法のobjectが
        //       #_ によって読み飛ばされた際に、その内容を反映する機能を
        //       追加する構想がある。ここに対応コードを入れる事になる。
      }
      return 1;
    }}];


let dispatchFns = defaultDispatchFns;
export const getDispatchFns = () => dispatchFns;
export const setDispatchFns = (newDispatchFns) => (dispatchFns = newDispatchFns);


const shiftStack = (to, stack) => {
  if (!stack.length) { tnEwTo(`invalid format "${to.content}"`, to) }
  return stack.shift();
};


// stackから1要素を取り出し、対応するsymbolと一緒に括弧で囲み、stackに保存し直す
// (例えば ' であれば、stackから1要素を抜き (%SEON/quote xxx) にして入れる)
const specialCharacterStandardProcess = (to, stack) => {
  const specialType = specialCharacterDefinitionTable[to.content];
  const v = shiftStack(to, stack);
  const list = markAsList([makeSymbol(specialType), v]);
  registerMeta(list, to);
  stack.unshift(list);
};


const derefSymbol = makeSymbol('%SEON/deref');
const unquoteSymbol = makeSymbol('%SEON/unquote');
const unquoteSplicingSymbol = makeSymbol('%SEON/unquote-splicing');


// NB: ※※※ここで構造を生成した場合は、忘れずにmetaMapに登録する事※※※
const specialCharacterProcessTable = {
  '%SEON/quote': specialCharacterStandardProcess,
  '%SEON/quasiquote': specialCharacterStandardProcess,
  '%SEON/unquote': (to, stack) => {
    const v = shiftStack(to, stack);
    // 通常は以下の変換だけですむが、
    // ,a => (unquote a)
    // もしvが (%SEON/deref xxx) だった時は更に以下の変換をしなくてはならない
    // ,@a => ,(deref a) => (unquote (deref a)) => (unquote-splicing a)
    const result = markAsList((isArray(v) && !isVector(v) && v.length && (v[0] === derefSymbol)) ? [unquoteSplicingSymbol, v[1]] : [unquoteSymbol, v]);
    registerMeta(result, to);
    stack.unshift(result);
  },
  '%SEON/deref': specialCharacterStandardProcess,
  '%SEON/dispatch': (to, stack) => {
    const dispatchee = shiftStack(to, stack);
    for (const fn of dispatchFns) {
      if (fn(to, dispatchee, stack)) { return }
    }
    tnEwTo(`invalid format "${to.content}"`, to);
  },
  '%SEON/keyword': (to, stack) => {
    let k;
    const target = shiftStack(to, stack);
    if (isSymbol(target)) {
      k = Sa.make('keyword', ... (Sa.parse(target).slice(1)));
    } else if (isKeyword(target)) {
      // ::foo 形式だった。seonサイドでnamespace解決まで行いたくないので、
      // 仮に %CURRENT というnamespaceを埋め込んでおく。
      // これはseon2jsが %SEON をrenameするタイミングで同時に
      // ファイル名に対応したnamespaceに変換してもらう。
      // なお ::foo/bar 形式(aliased namespace)への対応は今は諦める。
      k = renameNamespace(target, '%CURRENT');
    } else {
      tnEwTo(`invalid format "${to.content}"`, to);
    }
    registerMeta(k, to);
    stack.unshift(k);
  },
  '%SEON/reserved': (to, stack) => tnEwTo(`found reserved character "${to.content}"`, to),
};


// TODO: スタックを消費しないよう組み直した方がよい(現状だと構造の入れ子が深い時にMaximum call stack size exceededが起こってしまう)。とてもめんどい
const expandTot = (tot, isTopLevel=undefined) => {
  const totHead = tot[0];
  // 先頭と末尾のstructureタグを除去
  const totContents = isTopLevel ? tot : tot.slice(1, -1);
  const stack = [];
  // special文字対応の為に、末尾から処理していく必要がある
  for (let i = totContents.length-1; 0 <= i; i--) {
    const to = totContents[i];
    if (Array.isArray(to)) {
      // structureだった。先に再帰処理を行ってからstackに入れる
      stack.unshift(expandTot(to));
    } else if (to.category === 'special') {
      // 特殊文字だった。それぞれの処理を行う
      const specialType = specialCharacterDefinitionTable[to.content];
      const specialProcessor = specialCharacterProcessTable[specialType];
      if (!specialProcessor) { tnEwTo(`unknown character "${to.content}"`, to) }
      // 特殊文字はstackを変動させる場合が多い
      specialProcessor(to, stack);
    } else {
      // categoryがstring, number, symbolのいずれかだった
      const content = to.content;
      // symbolはevalエンジン内で例外を投げる可能性がありmetaMap登録が必要！
      // なお同じsymbolが複数ある場合でも、metaMapに登録できるsymbolは
      // その内の一つだけなのでlineNoとcolNoは全部共通になる問題がある。
      // しかし同じsymbolが何個あろうとそれが不正symbolなら全部不正symbolであり
      // 例外を出す分には問題ない(全部直してもらうまでは例外を出すので)。
      if (isSymbol(content)) { registerMeta(content, to) }
      stack.unshift(content);
    }
  }
  if (!isTopLevel) {
    ({
      '(': markAsList,
      '[': markAsVector,
      '{': markAsBlock,
    })[totHead.content]?.(stack);
  }
  registerMeta(stack, totHead);
  return stack;
};


// 文字列を「連続した複数のS式」として解釈し、その解釈結果を配列として返す。
// (もしこれを完全なlispコードとしたければ、この配列の先頭に `list` やら
// `begin` やら `do` やら `progn` やらのシンボルを入れるべき。要注意！)
// もし一個もS式に相当しなければ空配列が返る。
export const readAllFromSeonString = (seonString, opts={}) => {
  resetSeonState();
  // readOneFromSeonStringにて、途中から再開する場合は
  // offsetLineNo, offsetColNo を指定する事で行番号の辻褄を合わせられる
  let { offsetLineNo=1, offsetColNo=1 } = opts;
  // 先頭のみ #! の処理を特別に行う必要がある！
  if ((offsetLineNo == 1) && (offsetLineNo == 1) && (!seonString.indexOf("#!"))) {
    // 次の\nまで読み飛ばす
    seonString = seonString.split("\n").slice(1).join("\n");
    offsetLineNo++;
  }
  // 判定の優先度の為、まず;コメント、文字列、undigestedの三種に分離し、
  // その後にundigestedを完全に分解する、という二段処理にする必要がある。
  // (;コメントと文字列は、いわゆるS式構文に混ぜられない書式になっている為)
  // tokenizePhase1が前者を行い、disassembleUndigestedTokenObjectが後者を行う。
  const tosAll = tokenizePhase1(seonString, offsetLineNo, offsetColNo).flatMap(disassembleUndigestedTokenObject);
  // tokenizePhase1後、spaceおよびcommentを除去する
  // (先にこれを行っておかないと、dispatch等の「次の要素に適用する」系の
  // リーダーマクロが面倒な事になる)
  const tosFiltered = tosAll.filter((to)=>!(({'space':1, 'comment':1})[to.category]));
  if (!tosFiltered.length) { return [] }
  // []{}()をarray化する。相方チェックも兼ねている
  const tot = assembleTokenObjectsOnlyList(tosFiltered);
  // structureやリーダーマクロ文字を式化すると同時に、
  // metaMapやseonStateの登録も行う
  const exprs = expandTot(tot, 1);
  // まだ後処理が何か必要？
  return exprs;
};


// 文字列からS式を一個読み、それを返す。schemeのread的挙動。
// これは `seon2json` の挙動にも使われる。
// TODO: 全部parseしてから最初の一個を返しているので効率が悪い。しかし動作には問題ないので対応優先度はとても低い
export const readOneFromSeonString = (s, opts={}) => readAllFromSeonString(s, opts)[0];


// TODO: write系の手続きも提供しましょう
// TODO: pretty-printも提供したいが…
