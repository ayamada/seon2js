import { assert } from 'chai';
import * as Sa from 'seon/sa';
import * as Seon from 'seon/seon';
import * as Mangle from 'seon/mangle';
import * as SeonUtil from 'seon/util';


// TODO:
// 以下は旧版では例外を投げるようにしていた、多くのdoesNotThrowをどうする？
// 現行版ではエラーチェックを省いたunchecked版のみになったが、
// ここのtestどうするかは悩ましい。エラー出ない事を保証するのも微妙だし、
// (これらの値を積極的に与える事を許容しているように見えてしまう)
// かといってこれらのエッジケースについて書いておかないのも困りそう。


// https://www.chaijs.com/api/assert/
const testChai = () => {
  assert(true);
  assert(1);
  //assert.fail();
  assert.equal(123, 123);
  assert.notEqual([1,2,3], [1,2,3]);
  assert.deepEqual([1,2,3], [1,2,3]);
  assert.notDeepEqual([1,2,3], [9,9,9]);
  assert.throws(()=>{ throw new Error('abc') });
  //assert.doesNotThrow(()=>{ throw new Error('abc') });
  assert.exists(false);
  assert.exists(0);
  assert.exists('');
  assert.notExists(null);
  assert.notExists(undefined);
};


const testSa = () => {
  const sep = Sa.saMarkerCharacter;
  assert(Sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}`));
  assert(Sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}`));
  assert(!Sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}\n`));
  assert(!Sa.isSaLikeString(`${sep}${sep}${sep}${sep}${sep}${sep}${sep}`));
  assert(!Sa.isSaLikeString("abc"));
  assert(!Sa.isSaLikeString(123));
  assert(!Sa.isSaLikeString(null));
  assert(!Sa.isSaLikeString(undefined));

  const fooSa = Sa.make('foo', 'bar', 'baz');
  assert.equal(fooSa, Sa.make('foo', 'bar', 'baz'));
  assert(Sa.isSaLikeString(fooSa));

  assert.deepEqual(Sa.parse(fooSa), ['foo', 'bar', 'baz']);
  assert.notExists(Sa.parse("abc"));
  assert.notExists(Sa.parse(null));
  assert.notExists(Sa.parse(undefined));
  assert.notExists(Sa.parse({}));
  assert.notExists(Sa.parse([fooSa]));
  assert.notExists(Sa.parse(123));

  assert.equal(Sa.sa2type(fooSa), 'foo');
  assert.equal(Sa.sa2meta(fooSa), 'bar');
  assert.equal(Sa.sa2content(fooSa), 'baz');
  assert.notExists(Sa.sa2type("ababa"));
  assert.notExists(Sa.sa2meta("ababa"));
  assert.notExists(Sa.sa2content("ababa"));
  assert.notExists(Sa.sa2type(null));
  assert.notExists(Sa.sa2meta(null));
  assert.notExists(Sa.sa2content(null));
  assert.notExists(Sa.sa2type(1));
  assert.notExists(Sa.sa2meta(1));
  assert.notExists(Sa.sa2content(1));
  assert.equal(Sa.sa2meta(Sa.make('a', undefined, null)), '');
  assert.equal(Sa.sa2content(Sa.make('a', undefined, null)), '');

  // TODO: 多重sa化のテストを追加しておきたい(今は正常動作を別途確認してあるが、将来いじった後に、それが壊れていない事を保証できるように)
};


const testSeon = () => {
  const sym1 = Seon.makeSymbol('*debug*');
  const sym2 = Seon.makeSymbol('clj-yaml.core/generate-string');
  const sym3 = Seon.makeSymbol('/');
  const sym4 = Seon.makeSymbol('co.mp//');
  const kw1 = Seon.makeKeyword('abc');
  const kw2 = Seon.makeKeyword('ns.a/name.b');
  assert.doesNotThrow(()=>Seon.makeSymbol('//'));
  assert.doesNotThrow(()=>Seon.makeSymbol('/foo'));
  assert.doesNotThrow(()=>Seon.makeSymbol('foo/'));
  assert.doesNotThrow(()=>Seon.makeSymbol(','));
  assert.doesNotThrow(()=>Seon.makeSymbol('0'));
  assert.doesNotThrow(()=>Seon.makeKeyword(':abc'));
  assert.doesNotThrow(()=>Seon.makeKeyword(''));
  assert.doesNotThrow(()=>Seon.makeKeyword(' '));
  assert.throw(()=>Seon.makeKeyword(null));
  assert.throw(()=>Seon.makeKeyword(1));
  assert.equal(sym1.constructor, String);
  assert.equal(kw1.constructor, String);
  assert.equal(Seon.makeSymbol('abc'), Seon.makeSymbol('abc'));
  assert.equal(Seon.makeKeyword('abc'), Seon.makeKeyword('abc'));
  assert.notEqual(Seon.makeSymbol('abc'), Seon.makeKeyword('abc'));

  assert(Seon.isSymbol(sym1));
  assert(!Seon.isSymbol(kw1));
  assert(!Seon.isSymbol('abc'));
  assert(!Seon.isSymbol(123));
  assert(!Seon.isSymbol(null));
  assert(!Seon.isSymbol({}));
  assert(!Seon.isSymbol([sym1]));

  assert(!Seon.isKeyword(sym1));
  assert(Seon.isKeyword(kw1));
  assert(!Seon.isKeyword('abc'));
  assert(!Seon.isKeyword(123));
  assert(!Seon.isKeyword(null));
  assert(!Seon.isKeyword({}));
  assert(!Seon.isKeyword([kw1]));

  assert.equal(Seon.SYM`hoge`, Seon.makeSymbol('hoge'));
  assert.equal(Seon.SYM('hoge'), Seon.makeSymbol('hoge'));
  assert.equal(Seon.KW`foo/bar`, Seon.makeKeyword('foo/bar'));
  assert.equal(Seon.KW('foo/bar'), Seon.makeKeyword('foo/bar'));

  assert.equal(Seon.symbol2string(sym1), '*debug*');
  assert.equal(Seon.symbol2string(sym2), 'clj-yaml.core/generate-string');
  assert.equal(Seon.symbol2string(sym3), '/');
  assert.equal(Seon.symbol2string(sym4), 'co.mp//');
  assert.notExists(Seon.symbol2string(kw1));
  assert.notExists(Seon.symbol2string(kw2));
  assert.notExists(Seon.symbol2string('abc'));
  assert.notExists(Seon.symbol2string(123));
  assert.notExists(Seon.symbol2string(null));
  assert.notExists(Seon.symbol2string({}));
  assert.notExists(Seon.symbol2string([sym1]));

  assert.notExists(Seon.keyword2string(sym1));
  assert.notExists(Seon.keyword2string(sym2));
  assert.notExists(Seon.keyword2string(sym3));
  assert.notExists(Seon.keyword2string(sym4));
  assert.equal(Seon.keyword2string(kw1), 'abc');
  assert.equal(Seon.keyword2string(kw2), 'ns.a/name.b');
  assert.notExists(Seon.keyword2string('abc'));
  assert.notExists(Seon.keyword2string(123));
  assert.notExists(Seon.keyword2string(null));
  assert.notExists(Seon.keyword2string({}));
  assert.notExists(Seon.keyword2string([kw1]));

  assert.equal(Seon.x2string(sym1), '*debug*');
  assert.equal(Seon.x2string(sym2), 'clj-yaml.core/generate-string');
  assert.equal(Seon.x2string(sym3), '/');
  assert.equal(Seon.x2string(sym4), 'co.mp//');
  assert.equal(Seon.x2string(kw1), 'abc');
  assert.equal(Seon.x2string(kw2), 'ns.a/name.b');
  assert.notExists(Seon.x2string('abc'));
  assert.notExists(Seon.x2string(123));
  assert.notExists(Seon.x2string(null));
  assert.notExists(Seon.x2string({}));
  assert.notExists(Seon.x2string([sym1]));
  assert.notExists(Seon.x2string([kw1]));

  assert.notExists(Seon.referNamespace(sym1));
  assert.equal(Seon.referNamespace(sym2), 'clj-yaml.core');
  assert.notExists(Seon.referNamespace(sym3));
  assert.equal(Seon.referNamespace(sym4), 'co.mp');
  assert.notExists(Seon.referNamespace(kw1));
  assert.equal(Seon.referNamespace(kw2), 'ns.a');
  assert.notExists(Seon.referNamespace('abc'));
  assert.notExists(Seon.referNamespace(123));
  assert.notExists(Seon.referNamespace(null));
  assert.notExists(Seon.referNamespace({}));
  assert.notExists(Seon.referNamespace([sym1]));
  assert.notExists(Seon.referNamespace([kw1]));

  assert.equal(Seon.referName(sym1), '*debug*');
  assert.equal(Seon.referName(sym2), 'generate-string');
  assert.equal(Seon.referName(sym3), '/');
  assert.equal(Seon.referName(sym4), '/');
  assert.equal(Seon.referName(kw1), 'abc');
  assert.equal(Seon.referName(kw2), 'name.b');
  assert.notExists(Seon.referName('abc'));
  assert.notExists(Seon.referName(123));
  assert.notExists(Seon.referName(null));
  assert.notExists(Seon.referName({}));
  assert.notExists(Seon.referName([sym1]));
  assert.notExists(Seon.referName([kw1]));

  assert.equal(Seon.renameNamespace(sym1, 'ns.ns'), Seon.makeSymbol('ns.ns/*debug*'));
  assert.equal(Seon.renameNamespace(kw2, null), Seon.makeKeyword('name.b'));
  assert.equal(Seon.renameNamespace(sym1, null), sym1);
  assert.equal(Seon.renameNamespace(kw2, 'ns.a'), kw2);
  assert.doesNotThrow(()=>Seon.renameNamespace('abc', 'foo'));
  assert.doesNotThrow(()=>Seon.renameNamespace(123, 'foo'));
  assert.doesNotThrow(()=>Seon.renameNamespace(null, 'foo'));
  assert.doesNotThrow(()=>Seon.renameNamespace({}, 'foo'));
  assert.doesNotThrow(()=>Seon.renameNamespace(sym1, 123));
  assert.doesNotThrow(()=>Seon.renameNamespace(sym1, '/'));
  assert.doesNotThrow(()=>Seon.renameNamespace(sym1, ''));
  assert.doesNotThrow(()=>Seon.renameNamespace(sym1, {}));
  assert.doesNotThrow(()=>Seon.renameNamespace(sym1, null));

  const arr = [1,2,3];
  const list1 = Seon.markAsList([1,2,3]);
  const list2 = Seon.markAsList2([1,2,3]);
  const vec1 = Seon.markAsVector([1,2,3]);
  const vec2 = Seon.markAsVector2([1,2,3]);
  const blk1 = Seon.markAsBlock([1,2,3]);
  const blk2 = Seon.markAsBlock2([1,2,3]);
  assert(!Seon.isList(arr));
  assert(Seon.isList(list1));
  assert(Seon.isList(list2));
  assert(!Seon.isList(vec1));
  assert(!Seon.isList(blk1));
  assert(!Seon.isVector(arr));
  assert(!Seon.isVector(list1));
  assert(Seon.isVector(vec1));
  assert(Seon.isVector(vec2));
  assert(!Seon.isVector(blk1));
  assert(!Seon.isBlock(arr));
  assert(!Seon.isBlock(list1));
  assert(!Seon.isBlock(vec1));
  assert(Seon.isBlock(blk1));
  assert(Seon.isBlock(blk2));
  // assert.deepEqualでは同一判定になるらしい…どうする？
  assert.deepEqual(arr, list1);
  assert.deepEqual(arr, vec1);
  assert.deepEqual(arr, blk1);
  // TODO: 以下をきちんと判定できるようにしたい
  //assert.notDeepEqual(arr, list1);
  //assert.notDeepEqual(arr, vec1);
  //assert.notDeepEqual(arr, blk1);
  //assert.notDeepEqual(list1, vec1);
  //assert.notDeepEqual(vec1, blk1);
  //assert.notDeepEqual(list1, blk1);
  //assert.notDeepEqual(list1, list2);
  //assert.notDeepEqual(vec1, vec2);
  //assert.notDeepEqual(blk1, blk2);
  //assert.deepEqual(Seon.inheritMark(arr, [...arr]), arr);
  //assert.deepEqual(Seon.inheritMark(list1, [...arr]), list1);
  //assert.deepEqual(Seon.inheritMark(vec1, [...arr]), vec1);
  //assert.deepEqual(Seon.inheritMark(blk1, [...arr]), blk1);
  //assert.notDeepEqual(Seon.inheritMark(list1, [4,5,6]), list1);

  // ; 一行コメント
  assert.deepEqual(Seon.readAllFromSeonString("1;2"), [1]);
  assert.deepEqual(Seon.readAllFromSeonString("1;\n2"), [1,2]);
  assert.deepEqual(Seon.readAllFromSeonString("1;;2\n3"), [1,3]);
  assert.deepEqual(Seon.readAllFromSeonString(";;; foo"), []);

  // " string
  assert.deepEqual(Seon.readAllFromSeonString('"abc"'), ["abc"]);
  assert.deepEqual(Seon.readAllFromSeonString('"\\ta\\r\\nbc"'), ["\ta\r\nbc"]);
  assert.deepEqual(Seon.readAllFromSeonString('"a\\"b"'), ['a"b']);
  assert.deepEqual(Seon.readAllFromSeonString('"a\\\\b"'), ["a\\b"]);
  assert.throws(()=>Seon.readAllFromSeonString('"abc'));
  assert.deepEqual(Seon.readAllFromSeonString('"\u0001"'), ["\u0001"]);
  assert.throws(()=>Seon.readAllFromSeonString('"\u0001symbol\u0001\u0001abc\u0001"'));

  // bare token
  // - space
  assert.deepEqual(Seon.readAllFromSeonString("1 2\t3\r4\n5  6"), [1,2,3,4,5,6]);
  // - number
  assert.deepEqual(Seon.readAllFromSeonString("+1 -2 +3.4 -5.6"), [1,-2,3.4,-5.6]);
  assert.deepEqual(Seon.readAllFromSeonString("99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"), [1e+308]);
  assert.deepEqual(Seon.readAllFromSeonString("999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"), [Infinity]);
  assert.throws(()=>Seon.readAllFromSeonString('.1'));

  // structure
  // - () and #()
  assert.deepEqual(Seon.readAllFromSeonString("()"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString("#()"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString("(#(1 2 3)())"), [[[1,2,3],[]]]);
  assert(Seon.isList(Seon.readOneFromSeonString("()")));
  assert(Seon.isList(Seon.readOneFromSeonString("#()")));
  assert(!Seon.isVector(Seon.readOneFromSeonString("()")));
  assert(!Seon.isBlock(Seon.readOneFromSeonString("()")));
  assert.throws(()=>Seon.readAllFromSeonString('('));
  assert.throws(()=>Seon.readAllFromSeonString(')'));
  assert.throws(()=>Seon.readAllFromSeonString('(]'));
  assert.throws(()=>Seon.readAllFromSeonString('(}'));
  // - [] and #[]
  assert.deepEqual(Seon.readAllFromSeonString("[]"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString("#[]"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString("[(#[1])]"), [[[[1]]]]);
  assert(!Seon.isList(Seon.readOneFromSeonString("[]")));
  assert(Seon.isVector(Seon.readOneFromSeonString("[]")));
  assert(Seon.isVector(Seon.readOneFromSeonString("#[]")));
  assert(!Seon.isBlock(Seon.readOneFromSeonString("[]")));
  assert.throws(()=>Seon.readAllFromSeonString('['));
  assert.throws(()=>Seon.readAllFromSeonString(']'));
  assert.throws(()=>Seon.readAllFromSeonString('[)'));
  assert.throws(()=>Seon.readAllFromSeonString('[}'));
  // - {} and #{}
  assert.deepEqual(Seon.readAllFromSeonString("{}"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString("#{}"), [[]]);
  assert.deepEqual(Seon.readAllFromSeonString('{"a" 1 "b" 2}'), [["a",1,"b",2]]);
  assert(!Seon.isList(Seon.readOneFromSeonString("{}")));
  assert(!Seon.isVector(Seon.readOneFromSeonString("{}")));
  assert(Seon.isBlock(Seon.readOneFromSeonString("{}")));
  assert(Seon.isBlock(Seon.readOneFromSeonString("#{}")));
  assert.throws(()=>Seon.readAllFromSeonString('{'));
  assert.throws(()=>Seon.readAllFromSeonString('}'));
  assert.throws(()=>Seon.readAllFromSeonString('{)'));
  assert.throws(()=>Seon.readAllFromSeonString('{]'));

  // special character
  // ' %SEON/quote
  const quoteSym = Seon.makeSymbol('%SEON/quote');
  assert.deepEqual(Seon.readAllFromSeonString("'1"), [[quoteSym, 1]]);
  assert.deepEqual(Seon.readAllFromSeonString("'(+ 1 2)"), [[quoteSym, [Seon.makeSymbol('+'), 1, 2]]]);
  assert.deepEqual(Seon.readAllFromSeonString("''1"), [[quoteSym, [quoteSym, 1]]]);
  assert.throws(()=>Seon.readAllFromSeonString("'"));
  assert.throws(()=>Seon.readAllFromSeonString("(')"));
  // @ %SEON/deref
  const derefSym = Seon.makeSymbol('%SEON/deref');
  assert.deepEqual(Seon.readAllFromSeonString("@1"), [[derefSym, 1]]);
  assert.deepEqual(Seon.readAllFromSeonString("@(+ 1 2)"), [[derefSym, [Seon.makeSymbol('+'), 1, 2]]]);
  assert.deepEqual(Seon.readAllFromSeonString("@@1"), [[derefSym, [derefSym, 1]]]);
  assert.throws(()=>Seon.readAllFromSeonString("@"));
  assert.throws(()=>Seon.readAllFromSeonString("(@)"));
  // ` %SEON/quasiquote
  // , %SEON/unquote
  // ,@ %SEON/unquote-splicing
  const quasiquoteSym = Seon.makeSymbol('%SEON/quasiquote');
  const unquoteSym = Seon.makeSymbol('%SEON/unquote');
  const unquoteSplicingSym = Seon.makeSymbol('%SEON/unquote-splicing');
  assert.deepEqual(Seon.readAllFromSeonString("`1"), [[quasiquoteSym, 1]]);
  assert.deepEqual(Seon.readAllFromSeonString("`(+ 1 ,abc)"), [[quasiquoteSym, [Seon.makeSymbol('+'), 1, [unquoteSym, Seon.makeSymbol('abc')]]]]);
  assert.deepEqual(Seon.readAllFromSeonString("`(+ 1 ,@abc)"), [[quasiquoteSym, [Seon.makeSymbol('+'), 1, [unquoteSplicingSym, Seon.makeSymbol('abc')]]]]);
  assert.deepEqual(Seon.readAllFromSeonString("``1"), [[quasiquoteSym, [quasiquoteSym, 1]]]);
  assert.throws(()=>Seon.readAllFromSeonString("`"));
  assert.throws(()=>Seon.readAllFromSeonString("(`)"));
  assert.throws(()=>Seon.readAllFromSeonString(","));
  assert.throws(()=>Seon.readAllFromSeonString("(,)"));
  assert.throws(()=>Seon.readAllFromSeonString(",@"));
  assert.throws(()=>Seon.readAllFromSeonString("(,@)"));
  // : %SEON/keyword
  assert.deepEqual(Seon.readAllFromSeonString(":foo1"), [Seon.makeKeyword('foo1')]);
  assert.deepEqual(Seon.readAllFromSeonString(":name-space.core/function-name"), [Seon.makeKeyword('name-space.core/function-name')]);
  assert.deepEqual(Seon.readAllFromSeonString("::foo"), [Seon.makeKeyword('%CURRENT/foo')]);
  //assert.deepEqual(Seon.readAllFromSeonString("::foo/bar"), [Seon.makeKeyword('%CURRENT/bar')]); // この動作を許容するかは悩ましい。旧版ではエラーにしていたが…
  // ^ %SEON/reserved
  assert.throws(()=>Seon.readAllFromSeonString("^{}"));
  // \ %SEON/reserved
  assert.throws(()=>Seon.readAllFromSeonString("\\a"));
  // ~ %SEON/reserved
  assert.throws(()=>Seon.readAllFromSeonString("~abc"));

  // readOneFromSeonString
  assert.deepEqual(Seon.readAllFromSeonString(":foo1"), [Seon.makeKeyword('foo1')]);

  // dispatch misc
  // #_ discard-one-elem
  assert.deepEqual(Seon.readAllFromSeonString("1 #_[2] 3"), [1, 3]);
  assert.deepEqual(Seon.readAllFromSeonString("1 #_222 3"), [1, 3]);
  assert.deepEqual(Seon.readAllFromSeonString("1 #_abc 3"), [1, 3]);
  // #t #true #f #false #nil #null #inf #+inf #-inf #nan
  assert.equal(Seon.readOneFromSeonString("#t"), true);
  assert.equal(Seon.readOneFromSeonString("#true"), true);
  assert.equal(Seon.readOneFromSeonString("#f"), false);
  assert.equal(Seon.readOneFromSeonString("#false"), false);
  assert.equal(Seon.readOneFromSeonString("#nil"), null);
  assert.equal(Seon.readOneFromSeonString("#null"), null);
  assert.equal(Seon.readOneFromSeonString("#inf"), Infinity);
  assert.equal(Seon.readOneFromSeonString("#+inf"), Infinity);
  assert.equal(Seon.readOneFromSeonString("#-inf"), -Infinity);
  assert(Number.isNaN(Seon.readOneFromSeonString("#nan")));
  // #empty
  assert.equal(Seon.readOneFromSeonString("#empty"), Sa.make('denotation', '', 'empty'));
  // #"..." 正規表現
  // NB: Seon上の #"\\w+" と、js上の /\w+/ を比較している
  assert.equal(Seon.readOneFromSeonString('#"\\\\w+"').source, (/\w+/).source);
  // 未設定のdispatchはエラー扱い
  assert.throws(()=>Seon.readAllFromSeonString("##Inf"));
  assert.throws(()=>Seon.readAllFromSeonString("#:record"));
  //assert.throws(()=>Seon.readAllFromSeonString("#'foo/bar")); // NB: これは先に ' が展開され #(%SEON/quote foo/bar) となり、 #() 構文の一種と解釈されてしまう。これを防ぐには #() の展開時に、先頭が %SEON/quote でない事をチェックしたりする必要があるが…(unquoteをunquote-splicingにするのと同じような処理)。これきちんとやろうとすると将来にコストが爆発するので、やめときたい
  assert.throws(()=>Seon.readAllFromSeonString("#=(+ 1 2)"));
  assert.throws(()=>Seon.readAllFromSeonString("#^{:a 1}"));
  assert.throws(()=>Seon.readAllFromSeonString("#?(:clj 123)"));
  assert.throws(()=>Seon.readAllFromSeonString("#?@(:clj [1])"));
  assert.throws(()=>Seon.readAllFromSeonString("#foo"));

  // getLastMetaMap
  const [resultNum1, resultSym1, resultExpr1] = Seon.readAllFromSeonString(`
  123
  ababa
  (+ 1 2)`);
  assert.equal(Seon.getLastMetaMap().get(resultExpr1).lineNo, 4);
  assert.equal(Seon.getLastMetaMap().get(resultExpr1).colNo, 3);

  // throwErrorIfInvalidSymbolName
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("123"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("-123"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("+123"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName(".1"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("a b"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("(abc)"));
  assert.throws(()=>Seon.throwErrorIfInvalidSymbolName("\u0001"));
  assert.doesNotThrow(()=>Seon.throwErrorIfInvalidSymbolName("abc"));
  assert.doesNotThrow(()=>Seon.throwErrorIfInvalidSymbolName("foo-bar/baz-1"));
  assert.doesNotThrow(()=>Seon.throwErrorIfInvalidSymbolName("foo.bar"));
  assert.doesNotThrow(()=>Seon.throwErrorIfInvalidSymbolName("foo?.bar"));
};


const testMangle = () => {
  // string2mangledString
  // TODO

  // x2mangledString
  // TODO

  // symbol2mangledString
  // TODO

  // keyword2mangledString
  // TODO
};


const testUtil = () => {
  // postwalkWithMeta
  Seon.readAllFromSeonString("1");
  const dump = [];
  SeonUtil.postwalkWithMeta([1, 2, [3, 4], 5], (x)=>(dump.push(x), x));
  // postwalkWithMetaは親より子を先に探索するのでこうなる
  assert.deepEqual(dump, [1, 2, 3, 4, [3, 4], 5, [1, 2, [3, 4], 5]]);

  // convertSeonStringToJsonStruct
  assert.deepEqual(SeonUtil.convertSeonStringToJsonStruct(`[123 456]`), [123, 456]);
  assert.deepEqual(SeonUtil.convertSeonStringToJsonStruct(`{:abc-def 123}`), {"abcDef": 123});

  // rewriteAllSymbols
  const exprs1 = Seon.readAllFromSeonString(`
  123
  ababa/obobo
  '(+ 1 2)
  ::key
  null`);
  const meta = Seon.getLastMetaMap();
  assert.equal(meta.get(exprs1[2]).lineNo, 4);
  assert.equal(meta.get(exprs1[2]).colNo, 3);
  const exprs2 = SeonUtil.rewriteAllSymbols(exprs1, {
    '%SEON': 'foo',
    '%CURRENT': 'my',
    [Seon.makeSymbol('null')]: null,
  });
  assert.equal(exprs1[2][0], Seon.makeSymbol('%SEON/quote'));
  assert.equal(exprs2[2][0], Seon.makeSymbol('foo/quote'));
  assert.equal(exprs2[1], Seon.makeSymbol('ababa/obobo'));
  assert.equal(exprs2[2][1][0], Seon.makeSymbol('+'));
  assert.equal(exprs1[3], Seon.makeKeyword('%CURRENT/key'));
  assert.equal(exprs2[3], Seon.makeKeyword('my/key'));
  assert.equal(exprs1[4], Seon.makeSymbol('null'));
  assert.equal(exprs2[4], null);
  // rewriteAllSymbols後にmetaの引き継ぎがされているかのチェック
  assert.equal(meta.get(exprs2[2]).lineNo, 4);
  assert.equal(meta.get(exprs2[2]).colNo, 3);
  assert.deepEqual(meta.get(exprs1[2][1]), meta.get(exprs2[2][1]));
  assert.deepEqual(meta.get(exprs1[3]), meta.get(exprs2[3]));
};


const main = () => {
  testChai();
  testSa();
  testSeon();
  testMangle();
  testUtil();
};


main();
