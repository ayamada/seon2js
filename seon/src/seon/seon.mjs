import * as sa from './sa.mjs';
import * as sym from './sym.mjs';


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
//   - () と [] はどちらもjsのarrayに変換される。ただしseon2jsでは両者を
//     区別したいので、 [] の方には追加propertyで `%V=1` が付与される。
//     (vはvectorのv。つまりseonおよびseon2jsでは [] はvectorと呼ぶ)
//     それ以外の区別はない。JSON.stringifyしても両者の区別はなくなる。
//     この判別用に isVector() が提供される。
//   - #"..." はclojure同様、正規表現に変換される。
//     ただしこれはjson文字列化をサポートしていない。
//     JSON.stringifyすると単なる空の {} になる。これはもう仕様として諦める。
//   - #_ はclojure同様の「1要素コメント」だが、これがobjectかつ
//     特定のkey(SEON名前空間を持つsymbol)を含んでいる場合は
//     「readエンジンへのメタ指定」として解釈される。
//   - #t #true #f #false #nil #null #inf #+inf #-inf #nan はquoteされていても
//     jsの true false null Infinity -Infinity NaN に解決される。
//     (symbolとしてのtrueやfalseはquoteできるが、#t類はquoteできない)
//   - 上記以外にも # はじまりの機能を好きに定義し直せる。
//     これはディスパッチシンボルテーブルいじりによって提供される。
// - readの実行後、別途metaMapが提供される。
//   これはread結果の構造に含まれるsymbol, keyword, array, objectの各部を
//   keyとするMapで、そのvalueは { filename, lineNo, colNo } になっている。
//   要はエラー時にソース行番号などを示す為の情報。
//   マクロ展開などにより構造が変化する場合は、metaの引き継ぎを忘れるな！


// seonの吐いたjs構造を評価するevalエンジンは、
// 以下の特殊シンボルを処理する必要がある。
// - %SEON/quote - 普通のlispのquoteと同じ
// - %SEON/quasiquote - 同上。なおclojure型の動作を求められる可能性が高い
// - %SEON/unquote - 同上
// - %SEON/unquote-splicing - 同上
// - %SEON/deref - これは基本的には関数扱いでよい(clojure由来)


// 略語/内部構造メモ
// - to: token-object。ソース文字列をtokenizeした各部分毎に生成される。
//   実体は { category, content, lineNo, colNo } になる。
//   contentに分割されたソース文字列の本体が入っている。
// - pp: parenthesis-pair。括弧対応。 () [] {} の三種。


// 汎用ユーティリティ
const car = (a) => a[0];
const cdr = (a) => a.slice(1);
const cadr = (a) => a[1];
const isArray = Array.isArray;
const isObject = (o) => (o?.constructor === Object);
const isStringOrSa = (s) => (s?.constructor === String);
const tnE = (msg) => { throw new Error(msg) };
const assert = (x) => (x || tnE('assertion failed'));
const tnEwTo = (msg, to) => tnE(`${msg} at line=${to.lineNo} col=${to.colNo} in filename=${seonState.filename}`);


// read毎のSEONの状態をここに持たせる。
// 将来に拡張可能にする想定あり。
// NB: ここはgcc対策不要(全てのアクセスがmanglingされる想定)
const initialSeonState = Object.freeze({
  //filename: undefined,
  //currentNamespace: undefined,
  dmz: {}, // 外部から任意の状態を保存する用。ここはmanglingされない想定！
});
let seonState = {};
const resetSeonState = () => (seonState = { ... initialSeonState });
export const getLastSeonState = () => seonState;


// evalの際にエラー行番号などを表示させる為の
// 「各array→{filename, lineNo, colNo}」のエントリを持つMapが
// readの際に、自動的に生成される。これを参照できるやつ。
// なおこれはread毎にresetされるので、read後はすぐに取得した方がよい。
let metaMap;
const resetMetaMap = () => (metaMap = new Map());
export const getLastMetaMap = () => metaMap;
const registerMetaOnce = (target, to) => (metaMap.get(target) || metaMap.set(target, {
  // NB: ここはgcc対策不要(全てのアクセスがキーワード扱いになっている)
  filename: seonState.filename,
  lineNo: to.lineNo,
  colNo: to.colNo,
}));
const unregisterMeta = (target) => metaMap.delete(target);
const registerMeta = (target, to) => (unregisterMeta(target), registerMetaOnce(target, to));
const referMeta = (target) => metaMap.get(target);


// vector向けユーティリティ
export const markAsVector = (a) => ((isArray(a) && (a['%V'] = 1)), a);
export const isVector = (a) => (isArray(a) && a['%V']);


// 文字列リテラル内で特別な変換が必要なエスケープ文字(の \ を抜いたもの)
// なお `\` や `"` 等もエスケープ必須だが、これらはそのままの意味なので
// 「特別な変換」は不要でありここに記す必要はない。
const specialCharactersInStringLiteral = {
  "t": "\t",
  "r": "\r",
  "n": "\n",
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
  ",": '%SEON/unquote', // clojureとは割り当てが違うので注意
  "@": '%SEON/deref', // unquoteと合わさってunquote-splicingになる。素でも関数として機能させてもよい(clojure由来)
  '#': '%SEON/dispatch', // この後に来る要素によって挙動が変化する
  ":": '%SEON/keyword', // clojure由来。二個重ねるケースあり、注意
  "^": '%SEON/reserved', // clojureのmetadataだが、seonでは予約語扱い
  "\\": '%SEON/reserved', // clojureのcharacter literalだが、seonでは予約語扱い
  "~": '%SEON/reserved', // clojureのunquoteだが、seonでは予約語扱い
  // "%": undefined, // 普通にsymbol構築に使える文字
  // "$": undefined, // 普通にsymbol構築に使える文字
  // ".": undefined, // 普通にsymbol構築に使える文字。もしclojureのように特殊な処理をしたい場合はevalエンジン側で対応する事
  // "/": undefined, // 普通にsymbol構築に使える文字だが、symbol/keywordのseparator文字でもある為、例外を投げる書式あり、要注意
};


// 構造文字判定されるもの一覧
const ppOpenToCloseTable = {
  "(": ")",
  "{": "}",
  "[": "]",
}
const ppCloseToOpenTable = {
  ")": "(",
  "}": "{",
  "]": "[",
}


// " はじまりの文字列から、seon文字列リテラル部分を読み取り、アンエスケープし、
// その結果をtoとして返す。
const parseString = (leftover, startLineNo, startColNo) => {
  const throwError = () => tnEwTo('invalid string, starting', {
    lineNo: startLineNo,
    colNo: startColNo,
  });
  if (car(leftover) !== '"') { throwError() } // 先頭は必ず `"`
  leftover = cdr(leftover);
  let isEscaping;
  let currentLineNo = startLineNo;
  let currentColNo = startColNo+1;
  let result = '';
  while (1) {
    if (!leftover.length) { throwError() } // 文字列終了の `"` なしにファイル終端に到達した
    const chr = car(leftover);
    currentColNo++;
    leftover = cdr(leftover);
    if (isEscaping) {
      result += (specialCharactersInStringLiteral[chr] || chr);
      isEscaping = false;
    } else if (chr === '"') {
      break;
    } else if (chr === "\\") {
      isEscaping = true;
    } else if (chr === "\n") {
      result += chr;
      currentLineNo++;
      currentColNo = 1;
    } else {
      result += chr;
    }
  }
  // TODO: この段階でresultがsa.isSaLikeStringを満たすなら例外を投げるべきかも
  //       (ユースケースがまだ不明なので、これはs2js完成後に再検討する)
  return [result, leftover, currentLineNo, currentColNo];
};


// 与えられた文字列を「comment」「string」「undigested」の三種にtokenizeする。
// 「undigested」のものは後で更に細かくtokenizeする事。
// この結果は「tokenObjectの配列」として返される。
const tokenizePhase1 = (leftover, startLineNo, startColNo) => {
  let currentLineNo = startLineNo;
  let currentColNo = startColNo;
  let buf = '';
  const result = [];
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
  const commitBufAsUndigestedIfNotEmpty = () => {
    if (buf.length) { commitBufAs('undigested') }
  };
  while (leftover.length) {
    const peekedChr = car(leftover);
    if (peekedChr === ';') {
      commitBufAsUndigestedIfNotEmpty();
      const i = leftover.indexOf("\n");
      buf = (i === -1) ? leftover : leftover.slice(0, i);
      leftover = (i === -1) ? '' : leftover.slice(i+1);
      currentLineNo++;
      currentColNo = 1;
      commitBufAs('comment');
    } else if (peekedChr === '"') {
      commitBufAsUndigestedIfNotEmpty();
      [buf, leftover, currentLineNo, currentColNo] = parseString(leftover, currentLineNo, currentColNo);
      commitBufAs('string');
    } else {
      buf += peekedChr;
      leftover = cdr(leftover);
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


const parseFromLeftover = (parser, leftover, lineNo, colNo) => {
  try {
    // parserの返す値についてはsymの方を参照だが、
    // [parsed, newLeftover] の二値、もしくはnullyが返ってくる事になっている
    const result = parser(leftover);
    if (result) {
      const [parsed, newLeftover] = result;
      // NB: numberもsymbolも改行を含まないので、lineNoは変化しない
      const newColNo = colNo + leftover.length - newLeftover.length;
      return [parsed, newLeftover, lineNo, newColNo];
    }
  } catch (e) {
    tnEwTo(e.message, {
      lineNo: lineNo,
      colNo: colNo,
    });
  }
};
const parseNumberFromLeftover = (leftover, lineNo, colNo) => parseFromLeftover(sym.parseNumberFromLeftover, leftover, lineNo, colNo);
const parseSymbolFromLeftover = (leftover, lineNo, colNo) => parseFromLeftover(sym.parseSymbolFromLeftover, leftover, lineNo, colNo);


// disassembleの為に、各文字を大カテゴリで分類し直す
const expandForDC2C = (category, dt) => {
  const result = {};
  for (const k in dt) { result[k] = category }
  return result;
};
const disassembleCharacter2category = {
  ... expandForDC2C('space', spaceCharacterDefinitionTable),
  ... expandForDC2C('special', specialCharacterDefinitionTable),
  ... expandForDC2C('structure', ppOpenToCloseTable),
  ... expandForDC2C('structure', ppCloseToOpenTable),
};


const disassembleUndigestedTokenObject = (to) => {
  // ここの呼び出し元はflatMapなので、必ず「toのlist」を返す必要がある
  if (to.category != 'undigested') { return [to] }
  const result = [];
  let leftover = to.content;
  let currentLineNo = to.lineNo;
  let currentColNo = to.colNo;
  let tmpResult, _;
  const commit = (category, content) => result.push({
    category: category,
    content: content,
    lineNo: currentLineNo,
    colNo: currentColNo,
  });
  while (leftover.length) {
    const peekedChr = car(leftover);
    // NB: 数値は一部のリーダーマクロやシンボルと重なる為、最初に判定する
    if (tmpResult = parseNumberFromLeftover(leftover, currentLineNo, currentColNo)) {
      commit('number', car(tmpResult));
      [_, leftover, currentLineNo, currentColNo] = tmpResult;
    }
    // 括弧類および特殊記号を個別に分解する
    else if (tmpResult = disassembleCharacter2category[peekedChr]) {
      commit(tmpResult, peekedChr);
      leftover = cdr(leftover);
      if (peekedChr === "\n") {
        currentLineNo++;
        currentColNo = 1;
      } else {
        currentColNo++;
      }
    }
    // NB: シンボルは他と重なる為、最後に判定する
    else if (tmpResult = parseSymbolFromLeftover(leftover, currentLineNo, currentColNo)) {
      commit('symbol', car(tmpResult));
      [_, leftover, currentLineNo, currentColNo] = tmpResult;
    } else {
      // asciiの制御コード範囲の文字が来た時や、
      // コメント/文字列でない位置にunicode文字があった場合にここに来る
      tnEwTo(`invalid character found: "${peekedChr}"`, {
        lineNo: currentLineNo,
        colNo: currentColNo,
      });
    }
  }
  return result;
};


// 判定の優先度の為、まずコメント、文字列、undigestedの三種に分離し、
// その後にundigestedを完全に分解する、という二段処理にする必要がある
const tokenize = (seonString) => tokenizePhase1(seonString, 1, 1).flatMap(disassembleUndigestedTokenObject);


// atool = assembleTokenObjectsOnlyList Internal
// TODO: スタックを消費しないよう組み直す必要がある(現状だと構造の入れ子が深い時にMaximum call stack size exceededが起こってしまう)
const _atooli = (tos, openTag, closeTag, startLine, startCol) => {
  const result = [];
  while (tos.length) {
    const to = tos[0];
    tos = tos.slice(1);
    // structure以外をストックしていく
    if (to.category !== 'structure') {
      result.push(to);
      continue;
    }
    // closeTagを発見したら、ここで結果を返す
    if ((to.category === 'structure') && (closeTag === to.content)) {
      // 自身の結果に閉じタグを含めておく(外で種類に応じた処理を行う為)
      result.push(to);
      return [result, tos];
    }
    const newOpenTag = to.content;
    const newCloseTag = ppOpenToCloseTable[newOpenTag];
    // newCloseTagがない＝to.contentは不一致の閉じタグだった
    if (!newCloseTag) {
      tnE(`structure unmatched: started "${openTag}" at ${startLine}:${startCol}, searching "${closeTag}", but found "${to.content}"`);
    }
    // newCloseTagがある＝to.contentは新しい構造開始タグ。
    // 再帰的に構造を生成する
    const [assembled, leftTos] = _atooli(tos, newOpenTag, newCloseTag, to.lineNo, to.colNo);
    // 子の先頭に開始タグを含めておく(外で種類に応じた処理を行う為)
    assembled.unshift(to);
    result.push(assembled);
    tos = leftTos;
  }
  // 正常に最後まで処理できた
  if (closeTag === '<EOF>') { return [result, tos] }
  // 閉じタグで閉じてないのにtosを全消費するのはエラー
  tnE(`structure unmatched: started "${openTag}" at ${startLine}:${startCol}, searching "${closeTag}", but not found`);
};


const assembleTokenObjectsOnlyList = (tos) => {
  const [result, leftTos] = _atooli(tos, '<BOF>', '<EOF>', 1, 1);
  assert(!leftTos.length);
  return result;
}


const shiftStack = (to, stack) => {
  if (!stack.length) { tnEwTo(`invalid format "${to.content}"`, to) }
  return stack.shift();
};


// dispatch未対応メモ
// - #() clojure's nameless function (TODO: そのうち対応予定)
// - ## clojure's NaN, Inf, -Inf (他で対応済)
// - #! clojure's shebang line comment (対応なし予定)
// - #: clojure's record (対応なし予定)
// - #{} clojure's set (対応なし予定)
// - #' clojure's var (対応なし予定)
// - #= deprecated clojure's eval (対応なし予定)
// - #^ clojure's metadata (対応なし予定)
// - #? clojure's reader-conditional (対応なし予定)
// - #?@ clojure's reader-conditional-splicing (対応なし予定)


let dispatcheeSymbolConvertTable = {};
dispatcheeSymbolConvertTable[sym.makeSymbol('t')] = true;
dispatcheeSymbolConvertTable[sym.makeSymbol('true')] = true;
dispatcheeSymbolConvertTable[sym.makeSymbol('f')] = false;
dispatcheeSymbolConvertTable[sym.makeSymbol('false')] = false;
dispatcheeSymbolConvertTable[sym.makeSymbol('nil')] = null;
dispatcheeSymbolConvertTable[sym.makeSymbol('null')] = null;
dispatcheeSymbolConvertTable[sym.makeSymbol('inf')] = Number.POSITIVE_INFINITY;
dispatcheeSymbolConvertTable[sym.makeSymbol('+inf')] = Number.POSITIVE_INFINITY;
dispatcheeSymbolConvertTable[sym.makeSymbol('-inf')] = Number.NEGATIVE_INFINITY;
dispatcheeSymbolConvertTable[sym.makeSymbol('nan')] = Number.NaN;
// TODO: このdispatcheeSymbolConvertTableをいじれる手段を提供する


const dispatcheeSymbolDiscard = sym.makeSymbol('_');


// NB: ※※※ここで構造を生成した場合は、忘れずにmetaMapに登録する事※※※
// NB: この中でdispatch処理を行った場合はtruthyを返す事！
//     (truthyを返さなかった場合、更に後続のdispatch処理がなされてしまい、
//     最終的にはエラー扱いになる)
const defaultDispatchFns = [
  // #_ (discard one element)
  (to, dispatchee, stack)=>{
    // この時のdispatcheeは基本的には _ だが、
    // 後続の数値やsymbolと結合してしまうケースがある。
    // その場合も判定できなくてはならない。
    if (sym.symbol2string(dispatchee)?.indexOf('_') === 0) {
      // dispatcheeが素の _ の場合は後続と結合していないので、
      // 明示的に更に一個の要素を消す必要がある。
      // (結合している場合に消さないといけないものは結合対象という事になり、
      // その時は何もしなくてよい)
      if (dispatchee === dispatcheeSymbolDiscard) {
        const v = shiftStack(to, stack);
        // NB: 将来に #_{SEON/VER 12.3} のような、特定記法のobjectが
        //     #_ によって読み飛ばされた際に、その内容をseonState.dmzに反映する
        //     機能を追加する想定がある。ただこれがセキュリティ的に確実に安全か
        //     どうかがいまいち不安なので、現段階では実装が見送られた。
        //if (isObject(v)) {
        //  for (const k in v) {
        //    if (sym.isSymbol(k)) {
        //      const ssvKey = resolveOverwritableSeonStateVendorKey(sym.symbol2string(k));
        //      if (ssvKey) { seonState.dmz[ssvKey] = v[k] }
        //    }
        //  }
        //}
      }
      return 1;
    }
  },
  // #"..." (regexp)
  (to, dispatchee, stack)=>{
    if (isStringOrSa(dispatchee) && !sa.isSaLikeString(dispatchee)) {
      stack.unshift(new RegExp(dispatchee));
      return 1;
    }
  },
  // #symbol系
  (to, dispatchee, stack)=>{
    const v = dispatcheeSymbolConvertTable[dispatchee];
    if (v !== undefined) {
      stack.unshift(v);
      return 1;
    }
  },
  // TODO: 無名関数対応。clojureの `#(...)` を `(fn [%] ...)` に展開するやつ
  // TODO: schemeの `#n=`, `#n#` (shared-structure)みたいな奴のサポート
  //       - この仕様についてはSRFI-38を見る事
  //         https://srfi.schemers.org/srfi-38/srfi-38.html
  //       -  `#n#` の末尾 # が問題だが、末尾文字を変更して対応したい
  // TODO: bigint対応。まず先行文字だけ決めておきましょう
];


// TODO: これを外部からいじれる方法を提供する
let dispatchFns = defaultDispatchFns;


const specialCharacterStandardProcess = (to, stack) => {
  const specialType = specialCharacterDefinitionTable[to.content];
  const v = shiftStack(to, stack);
  const list = [sym.makeSymbol(specialType), v];
  registerMetaOnce(list, to);
  stack.unshift(list);
};


const derefSymbol = sym.makeSymbol('%SEON/deref');
const unquoteSymbol = sym.makeSymbol('%SEON/unquote');
const unquoteSplicingSymbol = sym.makeSymbol('%SEON/unquote-splicing');


// NB: ※※※ここで構造を生成した場合は、忘れずにmetaMapに登録する事※※※
const specialCharacterProcessTable = {
  '%SEON/quote': specialCharacterStandardProcess,
  '%SEON/quasiquote': specialCharacterStandardProcess,
  '%SEON/unquote': (to, stack) => {
    const v = shiftStack(to, stack);
    // 通常は以下の変換だけですむが、
    // - ,a => (unquote a)
    // vが (%SEON/deref xxx) だった時は更に以下の変換をしなくてはならない
    // - ,@a => ,(deref a) => (unquote (deref a)) => (unquote-splicing a)
    const result = (isArray(v) && !isVector(v) && v.length && (car(v) === derefSymbol)) ? [unquoteSplicingSymbol, cadr(v)] : [unquoteSymbol, v];
    registerMetaOnce(result, to);
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
    if (sym.isSymbol(target)) {
      k = sym.spawnWithAnotherType(target, 'keyword');
    } else if (sym.isKeyword(target)) {
      // ::foo 形式への対応を行う。なお ::foo/bar はエラーとする
      if (sym.referNamespace(target) != null) { tnEwTo(`invalid format "${to.content}"`, to) }
      k = sym.makeKeyword(seonState.currentNamespace, sym.referName(target));
    } else {
      tnEwTo(`invalid format "${to.content}"`, to);
    }
    registerMetaOnce(k, to);
    stack.unshift(k);
  },
  '%SEON/reserved': (to, stack) => tnEwTo(`reserved character "${to.content}"`, to),
};


// TODO: スタックを消費しないよう組み直す必要がある(現状だと構造の入れ子が深い時にMaximum call stack size exceededが起こってしまう)
const expandTot = (tot) => {
  const totHead = tot[0];
  // 先頭と末尾は必ずstructureなので、除外する
  const totContents = tot.slice(1, -1);
  const stack = [];
  // special文字対応の為に、末尾から処理していく必要がある
  for (let i = totContents.length-1; 0 <= i; i--) {
    const to = totContents[i];
    if (Array.isArray(to)) {
      stack.unshift(expandTot(to));
    } else if (to.category === 'special') {
      const specialType = specialCharacterDefinitionTable[to.content];
      const specialProcessor = specialCharacterProcessTable[specialType];
      if (!specialProcessor) { tnEwTo(`unknown character "${to.content}"`, to) }
      specialProcessor(to, stack);
    } else {
      // categoryがstring, number, symbolのいずれかだった
      const content = to.content;
      // symbolはevalエンジン内で例外を投げる可能性がありmetaMap登録が必要
      // (ただしmetaMapに登録できるsymbolは一つだけなので情報が不正確になる
      // 可能性はある。ただ同じsymbolが何個あろうとどれか不正なら全部不正なので
      // 例外を出す分には問題ない…)
      if (sym.isSymbol(content)) { registerMetaOnce(content, to) }
      stack.unshift(content);
    }
  }
  // {} か [] か () かで処理が変動する
  if (totHead.content === '(') {
    registerMetaOnce(stack, totHead);
    return stack; // () の時はarrayのまま返せる
  } else if (totHead.content === '[') {
    markAsVector(stack);
    registerMetaOnce(stack, totHead);
    return stack; // [] の時はvectorとして返す
  } else {
    const object = {};
    if (stack.length % 2) { tnEwTo(`found odd number of elements in object literal`, totHead) }
    while (stack.length) {
      const k = stack[0];
      if (k?.constructor !== String) { tnEwTo(`found non-string key in object literal`, totHead) }
      object[k] = stack[1];
      stack.splice(0, 2);
    }
    registerMetaOnce(object, totHead);
    return object;
  }
};


// 文字列を「連続した複数のS式」として解釈し、その解釈結果を配列として返す。
// (もしこれを完全なlispコードとしたければ、この配列の先頭に `list` やら
// `begin` やら `do` やら `progn` やらのシンボルを入れるべき。要注意！)
// もし一個もS式に相当しなければ空配列が返る。
export const readAllFromSeonString = (opts, seonString) => {
  // opts指定なし対応
  if (seonString == null) {
    seonString = opts;
    opts = {};
  }
  const { filename, currentNamespace } = opts;
  resetSeonState();
  seonState.filename = filename ?? '(unknown)';
  seonState.currentNamespace = currentNamespace ?? 'user';
  resetMetaMap();
  // opts.currentNamespaceの正規性をチェック
  try {
    sym.makeSymbol(seonState.currentNamespace, 'test');
  } catch (e) {
    tnE(`invalid namespace ${seonState.currentNamespace}`);
  }

  const tosFull = tokenize(seonString);
  // tokenize後、spaceおよびcommentを除去する
  // (先にこれを行っておかないと、dispatch等の「次の要素に適用する」系の
  // リーダーマクロが面倒な事になる)
  const tosFiltered = tosFull.filter((to)=>(to.category!='space')).filter((to)=>(to.category!='comment'));
  // []{}()をarray化する。相方チェックも兼ねている
  const tot = assembleTokenObjectsOnlyList(tosFiltered);
  // トップレベルも配列として扱いたいので、先頭に `(` を、末尾に `)` を入れ、
  // 正式な配列扱いにする。
  // TODO: 先頭のシンボルが内部展開される%SEON系だった場合に問題になるが、
  //       今は見逃す…将来に対応を考える
  //       (おそらく tot.map(expandTot) みたいな事になる筈だが…)
  tot.unshift({
    category: 'structure',
    content: '(',
    lineNo: 0,
    colNo: 0,
  });
  tot.push({
    category: 'structure',
    content: ')',
  });
  // 上記のtoを解除すると同時に、
  // structure含むリーダーマクロ文字を式化すると同時に、
  // metaMapやseonStateの登録も行う
  const exprs = expandTot(tot);
  // まだ後処理が何か必要？
  return exprs;
};


// 文字列からS式を一個読み、それを返す。schemeのread的挙動。
// これは `seon2json` の挙動に使われる。
// TODO: 実装が冗長(二個目以降も全部parseしている)、しかし今は諦める
export const readFromSeonString = (opts, s) => car(readAllFromSeonString(opts, s));


// TODO: write系の手続きも提供しましょう
// TODO: pretty-printも提供したいが…
