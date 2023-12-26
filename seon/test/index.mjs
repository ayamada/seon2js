import { assert } from 'chai';
import * as sa from 'seon/sa';
import * as sym from 'seon/sym';
import * as seon from 'seon/seon';
import * as util from 'seon/util';


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
  const stdtOriginal = sa.getSaTypeDefinitionTable();
  sa.setSaTypeDefinitionTable({ ... stdtOriginal, foo: {}});

  const sep = sa.saMarkerCharacter;
  assert(sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}`));
  assert(sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}`));
  assert(!sa.isSaLikeString(`${sep}a${sep}b${sep}c${sep}\n`));
  assert(!sa.isSaLikeString(`${sep}${sep}${sep}${sep}${sep}${sep}${sep}`));
  assert(!sa.isSaLikeString("abc"));
  assert(!sa.isSaLikeString(123));
  assert(!sa.isSaLikeString(null));
  assert(!sa.isSaLikeString(undefined));

  const fooSa = sa.makeUnchecked('foo', 'bar', 'baz');
  assert.equal(fooSa, sa.make('foo', 'bar', 'baz'));
  assert(sa.isSaLikeString(fooSa));
  assert.doesNotThrow(()=>sa.makeUnchecked('INVALID', '', ''));
  assert.throws(()=>sa.make('INVALID', '', ''));

  assert.deepEqual(sa.parseUnchecked(fooSa), [fooSa, 'foo', 'bar', 'baz']);
  assert.deepEqual(sa.parse(fooSa), {
    type: 'foo',
    meta: 'bar',
    content: 'baz',
  });
  assert.notExists(sa.parse("abc"));
  assert.notExists(sa.parse(null));
  assert.notExists(sa.parse(undefined));
  assert.notExists(sa.parse({}));
  assert.notExists(sa.parse(123));

  assert.equal(sa.sa2type(fooSa), 'foo');
  assert.equal(sa.sa2meta(fooSa), 'bar');
  assert.equal(sa.sa2content(fooSa), 'baz');
  assert.equal(sa.sa2typeUnchecked(fooSa), 'foo');
  assert.equal(sa.sa2encodedMetaUnchecked(fooSa), 'bar');
  assert.equal(sa.sa2encodedContentUnchecked(fooSa), 'baz');
  assert.notExists(sa.sa2type("ababa"));
  assert.notExists(sa.sa2meta("ababa"));
  assert.notExists(sa.sa2content("ababa"));
  assert.notExists(sa.sa2typeUnchecked("ababa"));
  assert.notExists(sa.sa2encodedMetaUnchecked("ababa"));
  assert.notExists(sa.sa2encodedContentUnchecked("ababa"));
  assert.notExists(sa.sa2type(null));
  assert.notExists(sa.sa2meta(null));
  assert.notExists(sa.sa2content(null));
  assert.notExists(sa.sa2typeUnchecked(null));
  assert.notExists(sa.sa2encodedMetaUnchecked(null));
  assert.notExists(sa.sa2encodedContentUnchecked(null));
  assert.notExists(sa.sa2type(1));
  assert.notExists(sa.sa2meta(1));
  assert.notExists(sa.sa2content(1));
  assert.notExists(sa.sa2typeUnchecked(1));
  assert.notExists(sa.sa2encodedMetaUnchecked(1));
  assert.notExists(sa.sa2encodedContentUnchecked(1));

  // TODO: 多重sa化のテストを追加しておきたい(今は正常動作を別途確認してあるが、将来いじった後に、それが壊れていない事を保証できるように)
};


const testSym = () => {
  const sym1 = sym.makeSymbol('*debug*');
  const sym2 = sym.makeSymbol('clj-yaml.core', 'generate-string');
  const sym3 = sym.makeSymbol('/');
  const sym4 = sym.makeSymbol('co.mp//');
  const kw1 = sym.makeKeyword('abc');
  const kw2 = sym.makeKeyword('ns.a/name.b');
  assert.throws(()=>sym.makeSymbol('//'));
  assert.throws(()=>sym.makeSymbol('/foo'));
  assert.throws(()=>sym.makeSymbol('foo/'));
  assert.throws(()=>sym.makeSymbol(','));
  assert.throws(()=>sym.makeSymbol('0'));
  assert.throws(()=>sym.makeKeyword(':abc'));
  assert.throws(()=>sym.makeKeyword(''));
  assert.throws(()=>sym.makeKeyword(' '));
  assert.throws(()=>sym.makeKeyword(null));
  assert.throws(()=>sym.makeKeyword(1));
  assert.equal(sym1.constructor, String);
  assert.equal(kw1.constructor, String);
  assert.equal(sym.makeSymbol('abc'), sym.makeSymbol('abc'));
  assert.equal(sym.makeKeyword('abc'), sym.makeKeyword('abc'));
  assert.notEqual(sym.makeSymbol('abc'), sym.makeKeyword('abc'));

  assert.notExists(sym.referNamespace(sym1));
  assert.equal(sym.referNamespace(sym2), 'clj-yaml.core');
  assert.notExists(sym.referNamespace(sym3));
  assert.equal(sym.referNamespace(sym4), 'co.mp');
  assert.notExists(sym.referNamespace(kw1));
  assert.equal(sym.referNamespace(kw2), 'ns.a');
  assert.notExists(sym.referNamespace('abc'));
  assert.notExists(sym.referNamespace(123));
  assert.notExists(sym.referNamespace(null));
  assert.notExists(sym.referNamespace({}));

  assert.equal(sym.referName(sym1), '*debug*');
  assert.equal(sym.referName(sym2), 'generate-string');
  assert.equal(sym.referName(sym3), '/');
  assert.equal(sym.referName(sym4), '/');
  assert.equal(sym.referName(kw1), 'abc');
  assert.equal(sym.referName(kw2), 'name.b');
  assert.equal(sym.referName('abc'), 'abc');
  assert.notExists(sym.referName(123));
  assert.notExists(sym.referName(null));
  assert.notExists(sym.referName({}));

  assert(sym.isSymbol(sym1));
  assert(!sym.isSymbol(kw1));
  assert(!sym.isSymbol('abc'));
  assert(!sym.isSymbol(123));
  assert(!sym.isSymbol(null));
  assert(!sym.isSymbol({}));

  assert(!sym.isKeyword(sym1));
  assert(sym.isKeyword(kw1));
  assert(!sym.isKeyword('abc'));
  assert(!sym.isKeyword(123));
  assert(!sym.isKeyword(null));
  assert(!sym.isKeyword({}));

  assert.equal(sym.symbol2string(sym1), '*debug*');
  assert.equal(sym.symbol2string(sym2), 'clj-yaml.core/generate-string');
  assert.equal(sym.symbol2string(sym3), '/');
  assert.equal(sym.symbol2string(sym4), 'co.mp//');
  assert.notExists(sym.symbol2string(kw1));
  assert.notExists(sym.symbol2string(kw2));
  assert.notExists(sym.symbol2string('abc'));
  assert.notExists(sym.symbol2string(123));
  assert.notExists(sym.symbol2string(null));
  assert.notExists(sym.symbol2string({}));
  assert.notExists(sym.keyword2string(sym1));
  assert.notExists(sym.keyword2string(sym2));
  assert.notExists(sym.keyword2string(sym3));
  assert.notExists(sym.keyword2string(sym4));
  assert.equal(sym.keyword2string(kw1), ':abc');
  assert.equal(sym.keyword2string(kw2), ':ns.a/name.b');
  assert.notExists(sym.keyword2string('abc'));
  assert.notExists(sym.keyword2string(123));
  assert.notExists(sym.keyword2string(null));
  assert.notExists(sym.keyword2string({}));

  assert.equal(sym.spawnWithAnotherType(sym1, 'keyword'), sym.makeKeyword('*debug*'));
  assert.equal(sym.spawnWithAnotherType(kw2, 'symbol'), sym.makeSymbol('ns.a/name.b'));
  assert.equal(sym.spawnWithAnotherType(sym1, 'symbol'), sym1);
  assert.equal(sym.spawnWithAnotherType(kw2, 'keyword'), kw2);
  assert.throws(()=>sym.spawnWithAnotherType('abc', 'keyword'));
  assert.throws(()=>sym.spawnWithAnotherType(123, 'keyword'));
  assert.throws(()=>sym.spawnWithAnotherType(null, 'keyword'));
  assert.throws(()=>sym.spawnWithAnotherType({}, 'keyword'));
  assert.throws(()=>sym.spawnWithAnotherType(sym1, 'abc'));
  assert.throws(()=>sym.spawnWithAnotherType(sym1, 123));
  assert.throws(()=>sym.spawnWithAnotherType(sym1, null));
  assert.throws(()=>sym.spawnWithAnotherType(sym1, {}));

  assert.equal(sym.spawnWithAnotherNamespace(sym1, 'ns.ns'), sym.makeSymbol('ns.ns/*debug*'));
  assert.equal(sym.spawnWithAnotherNamespace(kw2, null), sym.makeKeyword('name.b'));
  assert.equal(sym.spawnWithAnotherNamespace(sym1, null), sym1);
  assert.equal(sym.spawnWithAnotherNamespace(kw2, 'ns.a'), kw2);
  assert.throws(()=>sym.spawnWithAnotherNamespace('abc', 'foo'));
  assert.throws(()=>sym.spawnWithAnotherNamespace(123, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherNamespace(null, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherNamespace({}, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherNamespace(sym1, 123));
  assert.throws(()=>sym.spawnWithAnotherNamespace(sym1, '/'));
  assert.throws(()=>sym.spawnWithAnotherNamespace(sym1, ''));
  assert.throws(()=>sym.spawnWithAnotherNamespace(sym1, {}));
  assert.doesNotThrow(()=>sym.spawnWithAnotherNamespace(sym1, null));

  assert.equal(sym.spawnWithAnotherName(sym1, 'ababa'), sym.makeSymbol('ababa'));
  assert.equal(sym.spawnWithAnotherName(kw2, 'obobo'), sym.makeKeyword('ns.a/obobo'));
  assert.equal(sym.spawnWithAnotherName(sym1, '*debug*'), sym1);
  assert.equal(sym.spawnWithAnotherName(kw2, 'name.b'), kw2);
  assert.throws(()=>sym.spawnWithAnotherName('abc', 'foo'));
  assert.throws(()=>sym.spawnWithAnotherName(123, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherName(null, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherName({}, 'foo'));
  assert.throws(()=>sym.spawnWithAnotherName(sym1, 123));
  assert.doesNotThrow(()=>sym.spawnWithAnotherName(sym1, '/'));
  assert.throws(()=>sym.spawnWithAnotherName(sym1, ''));
  assert.throws(()=>sym.spawnWithAnotherName(sym1, {}));
  assert.throws(()=>sym.spawnWithAnotherName(sym1, null));

  assert.deepEqual(sym.parseNumberFromLeftover('-0.12 '), [-0.12, ' ']);
  assert.notExists(sym.parseNumberFromLeftover(''));
  assert.notExists(sym.parseNumberFromLeftover(' 0.1'));
  assert.notExists(sym.parseNumberFromLeftover('abc'));
  assert.throws(()=>sym.parseNumberFromLeftover('.1'));

  assert.deepEqual(sym.parseSymbolFromLeftover('abc 123'), [sym.makeSymbol('abc'), ' 123']);
  assert.deepEqual(sym.parseSymbolFromLeftover('co.mp// '), [sym4, ' ']);
  assert.notExists(sym.parseSymbolFromLeftover(''));
  assert.notExists(sym.parseSymbolFromLeftover('@'));
  assert.notExists(sym.parseSymbolFromLeftover(':abc'));
  assert.throws(()=>sym.parseSymbolFromLeftover('////'));
  assert.throws(()=>sym.parseSymbolFromLeftover('-0.12 '));

  const sastr1 = sym.string2sastring("abc");
  const sastr2 = sym.string2sastring(")}];\nabc\u0001def\n[{(");
  assert(sym.isSastring(sastr1));
  assert(sym.isSastring(sastr2));
  assert(!sym.isSastring(sym1));
  assert(!sym.isSastring(kw1));
  assert(!sym.isSastring("abc"));
  assert(!sym.isSastring(""));
  assert.notExists(sym.sastring2string("abc"));
  assert.equal(sym.sastring2string(sastr1), "abc");
  assert.equal(sym.sastring2string(sastr2), ")}];\nabc\u0001def\n[{(");
  assert(sa.isSaLikeString(sastr1));
  assert(sa.isSaLikeString(sastr2));
  assert.notEqual(sastr1, sym.string2sastring(sastr1));
  assert(sa.isSaLikeString(sym.string2sastring(sastr2)));

  assert.equal(sym.sa2stringForJson(sym1), '*debug*');
  assert.equal(sym.sa2stringForJson(sym2), 'clj-yaml.core/generate-string');
  assert.equal(sym.sa2stringForJson(sym3), '/');
  assert.equal(sym.sa2stringForJson(sym4), 'co.mp//');
  assert.equal(sym.sa2stringForJson(kw1), 'abc');
  assert.equal(sym.sa2stringForJson(kw2), 'ns.a/name.b');
  assert.equal(sym.sa2stringForJson(sastr1), 'abc');
  assert.equal(sym.sa2stringForJson(sastr2), ")}];\nabc\u0001def\n[{(");
  assert.equal(sym.sa2stringForJson('abc'), 'abc');
  assert.equal(sym.sa2stringForJson(123), 123);
  assert.equal(sym.sa2stringForJson(null), null);
  assert.deepEqual(sym.sa2stringForJson({}), {});
};


const testSeon = () => {
  const config = {
    filename: "test-file.seon",
    currentNamespace: "test-name-space.core",
  };

  // ; 一行コメント
  assert.deepEqual(seon.readAllFromSeonString("1;2"), [1]);
  assert.deepEqual(seon.readAllFromSeonString("1;\n2"), [1,2]);
  assert.deepEqual(seon.readAllFromSeonString("1;;2\n3"), [1,3]);
  assert.deepEqual(seon.readAllFromSeonString(";;; foo"), []);

  // " string
  assert.deepEqual(seon.readAllFromSeonString('"abc"'), ["abc"]);
  assert.deepEqual(seon.readAllFromSeonString('"\\ta\\r\\nbc"'), ["\ta\r\nbc"]);
  assert.deepEqual(seon.readAllFromSeonString('"a\\"b"'), ['a"b']);
  assert.deepEqual(seon.readAllFromSeonString('"a\\\\b"'), ["a\\b"]);
  assert.throws(()=>seon.readAllFromSeonString('"abc'));
  assert.deepEqual(seon.readAllFromSeonString('"\u0001"'), ["\u0001"]);
  //assert.throws(()=>seon.readAllFromSeonString('"\u0001symbol\u0001\u0001abc\u0001"')); // TODO: これを禁止するかはかなり悩む。が実用上は禁止しようがしなかろうが問題にならないのであとで考える

  // bare token
  // - space
  assert.deepEqual(seon.readAllFromSeonString("1 2\t3\r4\n5  6"), [1,2,3,4,5,6]);
  // - number
  assert.deepEqual(seon.readAllFromSeonString("+1 -2 +3.4 -5.6"), [1,-2,3.4,-5.6]);
  assert.deepEqual(seon.readAllFromSeonString("99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"), [1e+308]);
  assert.deepEqual(seon.readAllFromSeonString("999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"), [Infinity]);
  assert.throws(()=>seon.readAllFromSeonString('.1'));

  // structure
  // - ()
  assert.deepEqual(seon.readAllFromSeonString("()"), [[]]);
  assert.deepEqual(seon.readAllFromSeonString("((1 2 3)())"), [[[1,2,3],[]]]);
  assert.throws(()=>seon.readAllFromSeonString('('));
  assert.throws(()=>seon.readAllFromSeonString(')'));
  assert.throws(()=>seon.readAllFromSeonString('(]'));
  assert.throws(()=>seon.readAllFromSeonString('(}'));
  // - []
  assert.deepEqual(seon.readAllFromSeonString("[]"), [[]]);
  assert.deepEqual(seon.readAllFromSeonString("[([1])]"), [[[[1]]]]);
  assert(seon.isVector(seon.readFromSeonString("[]")));
  const s1 = seon.readFromSeonString("()");
  assert(!seon.isVector(s1));
  seon.markAsVector(s1);
  assert(seon.isVector(s1));
  assert.throws(()=>seon.readAllFromSeonString('['));
  assert.throws(()=>seon.readAllFromSeonString(']'));
  assert.throws(()=>seon.readAllFromSeonString('[)'));
  assert.throws(()=>seon.readAllFromSeonString('[}'));
  // - {}
  assert.deepEqual(seon.readAllFromSeonString("{}"), [{}]);
  assert.deepEqual(seon.readAllFromSeonString('{"a" 1 "b" 2}'), [{a:1,b:2}]);
  const o = {};
  o[sym.makeSymbol('foo')] = 1;
  o[sym.makeSymbol('foo/bar')] = 2;
  o[sym.makeKeyword('baz')] = 3;
  o[sym.makeKeyword('baz/buzz')] = 4;
  assert.deepEqual(seon.readAllFromSeonString("{foo 1 foo/bar 2 :baz 3 :baz/buzz 4}"), [o]);
  assert.throws(()=>seon.readAllFromSeonString('{1 2}')); // key must be string
  assert.throws(()=>seon.readAllFromSeonString('{"a"}'));
  assert.throws(()=>seon.readAllFromSeonString('{"a" "b" "c"}'));
  assert.throws(()=>seon.readAllFromSeonString('{'));
  assert.throws(()=>seon.readAllFromSeonString('}'));
  assert.throws(()=>seon.readAllFromSeonString('{)'));
  assert.throws(()=>seon.readAllFromSeonString('{]'));

  // special character
  // ' %SEON/quote
  const quoteSym = sym.makeSymbol('%SEON/quote');
  assert.deepEqual(seon.readAllFromSeonString("'1"), [[quoteSym, 1]]);
  assert.deepEqual(seon.readAllFromSeonString("'(+ 1 2)"), [[quoteSym, [sym.makeSymbol('+'), 1, 2]]]);
  assert.deepEqual(seon.readAllFromSeonString("''1"), [[quoteSym, [quoteSym, 1]]]);
  assert.throws(()=>seon.readAllFromSeonString("'"));
  assert.throws(()=>seon.readAllFromSeonString("(')"));
  // @ %SEON/deref
  const derefSym = sym.makeSymbol('%SEON/deref');
  assert.deepEqual(seon.readAllFromSeonString("@1"), [[derefSym, 1]]);
  assert.deepEqual(seon.readAllFromSeonString("@(+ 1 2)"), [[derefSym, [sym.makeSymbol('+'), 1, 2]]]);
  assert.deepEqual(seon.readAllFromSeonString("@@1"), [[derefSym, [derefSym, 1]]]);
  assert.throws(()=>seon.readAllFromSeonString("@"));
  assert.throws(()=>seon.readAllFromSeonString("(@)"));
  // ` %SEON/quasiquote
  // , %SEON/unquote
  // ,@ %SEON/unquote-splicing
  const quasiquoteSym = sym.makeSymbol('%SEON/quasiquote');
  const unquoteSym = sym.makeSymbol('%SEON/unquote');
  const unquoteSplicingSym = sym.makeSymbol('%SEON/unquote-splicing');
  assert.deepEqual(seon.readAllFromSeonString("`1"), [[quasiquoteSym, 1]]);
  assert.deepEqual(seon.readAllFromSeonString("`(+ 1 ,abc)"), [[quasiquoteSym, [sym.makeSymbol('+'), 1, [unquoteSym, sym.makeSymbol('abc')]]]]);
  assert.deepEqual(seon.readAllFromSeonString("`(+ 1 ,@abc)"), [[quasiquoteSym, [sym.makeSymbol('+'), 1, [unquoteSplicingSym, sym.makeSymbol('abc')]]]]);
  assert.deepEqual(seon.readAllFromSeonString("``1"), [[quasiquoteSym, [quasiquoteSym, 1]]]);
  assert.throws(()=>seon.readAllFromSeonString("`"));
  assert.throws(()=>seon.readAllFromSeonString("(`)"));
  assert.throws(()=>seon.readAllFromSeonString(","));
  assert.throws(()=>seon.readAllFromSeonString("(,)"));
  assert.throws(()=>seon.readAllFromSeonString(",@"));
  assert.throws(()=>seon.readAllFromSeonString("(,@)"));
  // : %SEON/keyword
  assert.deepEqual(seon.readAllFromSeonString(":foo1"), [sym.makeKeyword('foo1')]);
  assert.deepEqual(seon.readAllFromSeonString(":name-space.core/function-name"), [sym.makeKeyword('name-space.core/function-name')]);
  assert.deepEqual(seon.readAllFromSeonString("::foo"), [sym.makeKeyword('user/foo')]);
  assert.deepEqual(seon.readAllFromSeonString(config, "::foo"), [sym.makeKeyword('test-name-space.core/foo')]);
  assert.throws(()=>seon.readAllFromSeonString("::foo/bar"));
  // ^ %SEON/reserved
  assert.throws(()=>seon.readAllFromSeonString("^{}"));
  // \ %SEON/reserved
  assert.throws(()=>seon.readAllFromSeonString("\\a"));
  // ~ %SEON/reserved
  assert.throws(()=>seon.readAllFromSeonString("~abc"));

  // readFromSeonString
  assert.deepEqual(seon.readAllFromSeonString(":foo1"), [sym.makeKeyword('foo1')]);

  // dispatch misc
  // #_ discard-one-elem
  assert.deepEqual(seon.readAllFromSeonString("1 #_[2] 3"), [1, 3]);
  assert.deepEqual(seon.readAllFromSeonString("1 #_222 3"), [1, 3]);
  assert.deepEqual(seon.readAllFromSeonString("1 #_abc 3"), [1, 3]);
  // #t #true #f #false #nil #null #inf #+inf #-inf #nan
  assert.equal(seon.readFromSeonString("#t"), true);
  assert.equal(seon.readFromSeonString("#true"), true);
  assert.equal(seon.readFromSeonString("#f"), false);
  assert.equal(seon.readFromSeonString("#false"), false);
  assert.equal(seon.readFromSeonString("#nil"), null);
  assert.equal(seon.readFromSeonString("#null"), null);
  assert.equal(seon.readFromSeonString("#inf"), Infinity);
  assert.equal(seon.readFromSeonString("#+inf"), Infinity);
  assert.equal(seon.readFromSeonString("#-inf"), -Infinity);
  assert(Number.isNaN(seon.readFromSeonString("#nan")));
  // #"..." 正規表現
  // NB: seon上の #"\\w+" と、js上の /\w+/ を比較している
  assert.equal(seon.readFromSeonString('#"\\\\w+"').source, (/\w+/).source);
  // 未設定のdispatchはエラー扱い
  assert.throws(()=>seon.readAllFromSeonString("#(+ % 2)")); // TODO: これのみ将来対応予定
  assert.throws(()=>seon.readAllFromSeonString("##Inf"));
  assert.throws(()=>seon.readAllFromSeonString("#!/bin/sh"));
  assert.throws(()=>seon.readAllFromSeonString("#:record"));
  assert.throws(()=>seon.readAllFromSeonString("#{:a :b}"));
  assert.throws(()=>seon.readAllFromSeonString("#[1 2]"));
  assert.throws(()=>seon.readAllFromSeonString("#'foo/bar"));
  assert.throws(()=>seon.readAllFromSeonString("#=(+ 1 2)"));
  assert.throws(()=>seon.readAllFromSeonString("#^{:a 1}"));
  assert.throws(()=>seon.readAllFromSeonString("#?(:clj 123)"));
  assert.throws(()=>seon.readAllFromSeonString("#?@(:clj [1])"));
  assert.throws(()=>seon.readAllFromSeonString("#foo"));

  // getLastMetaMap
  const [num1, sym1, expr1] = seon.readAllFromSeonString(config, `
  123
  ababa
  (+ 1 2)`);
  assert.deepEqual(seon.getLastMetaMap().get(expr1), {
    filename: config.filename,
    lineNo: 4,
    colNo: 3,
  });

  // getLastSeonState
  seon.readFromSeonString(config, "1");
  assert.equal(seon.getLastSeonState().filename, config.filename);
  assert.equal(seon.getLastSeonState().currentNamespace, config.currentNamespace);
  seon.readFromSeonString("1");
  assert.equal(seon.getLastSeonState().filename, '(unknown)');
  assert.equal(seon.getLastSeonState().currentNamespace, 'user');
  // TODO: あとで他の項目が追加されるので、その際に忘れずにテストも増やす事

};


const testUtil = () => {
  // renameInternalSeonNamespaces
  const result1 = seon.readAllFromSeonString(`
  123
  ababa
  '(+ 1 2)`);
  const meta = seon.getLastMetaMap();
  const metaResult = {
    filename: '(unknown)',
    lineNo: 4,
    colNo: 3,
  };
  assert.deepEqual(meta.get(result1[2]), metaResult);
  const result2 = util.renameInternalSeonNamespaces(result1, 'foobar');
  assert.deepEqual(meta.get(result2[2]), metaResult);
  assert.deepEqual(meta.get(result1[2][1]), meta.get(result2[2][1]));
};


const main = () => {
  testChai();
  testSa();
  testSym();
  testSeon();
  testUtil();
};


main();
