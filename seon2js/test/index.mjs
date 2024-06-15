import { assert } from 'chai';
import * as Process from 'node:process';
import * as Sa from 'seon/sa';
import * as Seon from 'seon/seon';
import * as SeonUtil from 'seon/util';
import * as Transpile from "seon2js/transpile";


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
  assert.doesNotThrow(()=>{ new Error('abc') });
  assert.exists(false);
  assert.exists(0);
  assert.exists('');
  assert.notExists(null);
  assert.notExists(undefined);
};


const isVerbose = false;
const tt = (seonCode) => Transpile.transpileAll(seonCode, {
  isUseCachedSpVars: 1,
  srcPath: Process.argv[1],
});
const assertEqualForSeonCodeAsync = (seonCode, result) => assert.equal(tt(seonCode), result);
const aefsca = assertEqualForSeonCodeAsync; // よく使うので短縮名を用意
const assertThrowForSeonCodeAsync = (seonCode) => {
  let err;
  try {
    tt(seonCode);
  } catch (e) {
    err = e;
  }
  assert.throw(()=>{if (err) {throw err}});
}
const assertDoesNotThrowForSeonCodeAsync = (seonCode) => {
  let err;
  try {
    tt(seonCode);
  } catch (e) {
    err = e;
  }
  assert.doesNotThrow(()=>{if (err) {throw err}});
}


const assertEqualForSeonCode2 = (seonCode, evalResult=undefined, dumpCode=undefined) => {
  let code;
  if (dumpCode != null) {
    assert.equal((code = tt(seonCode)), dumpCode);
  } else {
    code = tt(seonCode);
  }
  assert.deepEqual(eval(code), evalResult);
}
const aefsca2 = assertEqualForSeonCode2; // よく使うので短縮名を用意
const assertThrowForSeonCode2 = (seonCode) => {
  let err;
  try {
    eval(tt(seonCode));
  } catch (e) {
    err = e;
  }
  assert.throw(()=>{if (err) {throw err}});
}


const testTranspile = async () => {
  await aefsca2('[]', []);
  await aefsca2('{}', {});
  await aefsca2('[{}]', [({})]);
  await aefsca('(console.log 1 2)', '(console.log)((1),(2))');
  await aefsca('(.log console 1 2)', '(console).log((1),(2))');
  await aefsca('{[(Math.max 1 2)] 34}', '({[(Math.max)((1),(2))]:(34)})');
  await aefsca('#"foo"', '(/foo/)');
  await aefsca('#t', 'true');
  await aefsca('#f', 'false');
  await aefsca('#nil', 'null');
  await aefsca2('#inf', Number.POSITIVE_INFINITY);
  await aefsca2('#+inf', Number.POSITIVE_INFINITY);
  await aefsca2('#-inf', Number.NEGATIVE_INFINITY);
  await aefsca2('#nan', Number.NaN);
  await aefsca2('null', null);
  assertThrowForSeonCode2('nil');

  // TODO: destructuring-bindのテストを追加する事

  // TODO: もっと追加
};


// TODO: カテゴリ別にtestを分割した方がよい
const testSpecials = async () => {
  await aefsca('(sp/raw-js "console.log(1+2)")', 'console.log(1+2)');
  await aefsca2('(sp/raw-js "1+2")', 3);

  await assertThrowForSeonCodeAsync('(sp/eval-js-at-compile-time! "global.foo()")');
  await assertDoesNotThrowForSeonCodeAsync('(sp/eval-js-at-compile-time! "global.foo=(()=>{})")');
  await assertDoesNotThrowForSeonCodeAsync('(sp/eval-js-at-compile-time! "global.foo()")');

  await aefsca2('(sp/defsp test/sum [a b] (sp/raw-js "a+b")) (test/sum 1 2)', 3);
  await aefsca2('(sp/defsp test/sum2 [a b] (sp/raw-js "const c = a+b") (Math.max a b c)) (test/sum2 1 2)', 3);
  await aefsca('(sp/defsp test/funcall [... args] args) (test/funcall foo 1 2)', ';\n(foo)((1),(2))');

  await assertThrowForSeonCodeAsync('(sp/unbound-symbol 123)');
  await assertDoesNotThrowForSeonCodeAsync('(ababa/foo 123)');
  await aefsca2('(sp/rigidify-namespace-for-s2sp! "ababa")', undefined);
  await assertThrowForSeonCodeAsync('(ababa/foo 123)');

  //await aefsca('(defmacro test/hoge [a] {:a a}) (test/hoge 3)', ';\n({a:(3)})'); // TODO

  // TODO: aefsca2を使うようにしていった方がいい。直しましょう！しかしきちんとやるにはobjectやconstやletが必要では…
  await aefsca('(delete obj.prop)', '(delete obj.prop)');
  await aefsca('(delete (:prop obj))', '(delete (obj).prop)');
  await aefsca('(delete! (["a"] obj))', '(delete (obj["a"]))');
  await aefsca('(sp/delete obj.prop)', '(delete obj.prop)');
  await aefsca('(sp/delete! obj.prop)', '(delete obj.prop)');
  // TODO: 簡単にawaitの動作確認をするには何がいい？やっぱPromiseしかない？うーん…
  await aefsca('(await (fetch url))', '(await (fetch)(url))');
  await aefsca('(await! (fetch url))', '(await (fetch)(url))');
  await aefsca('(sp/await (fetch url))', '(await (fetch)(url))');
  await aefsca('(sp/await! (fetch url))', '(await (fetch)(url))');
  // NB: throwのエラー内容チェックはtry側で行う
  // TODO
  await aefsca('(throw (new Error "a"))', 'throw (new (Error)("a"))');
  await aefsca('(throw! (new Error "a"))', 'throw (new (Error)("a"))');
  await aefsca('(sp/throw (new Error "a"))', 'throw (new (Error)("a"))');
  await aefsca('(sp/throw! (new Error "a"))', 'throw (new (Error)("a"))');

  await aefsca('(new Map)', '(new (Map)())');
  await aefsca('(new Date 0)', '(new (Date)((0)))');
  await aefsca('(new Array 9 8 7)', '(new (Array)((9),(8),(7)))');
  await aefsca('(sp/new Map)', '(new (Map)())');

  await aefsca('(return)', 'return ');
  await aefsca('(return! 123)', 'return (123)');
  await aefsca('(sp/return)', 'return ');
  await aefsca('(sp/return!)', 'return ');
  await aefsca('(break)', 'break ');
  await aefsca('(break! foo)', 'break foo');
  await aefsca('(sp/break)', 'break ');
  await aefsca('(sp/break! foo)', 'break foo');
  await aefsca('(continue)', 'continue ');
  await aefsca('(continue! foo)', 'continue foo');
  await aefsca('(sp/continue)', 'continue ');
  await aefsca('(sp/continue! foo)', 'continue foo');

  await aefsca('(if 1 2 3)', '((1) ? (((2))) : (((3))))');
  await aefsca2('(if 1 2 3)', 2);
  await aefsca2('(sp/if 0 2 3)', 3);
  await aefsca('(if (isFoo) true (throw (new Error "a")))', 'if ((isFoo)()) {(true)} else {throw (new (Error)("a"))}');
  await aefsca('(if-not 1 2 3)', '((1) ? (((3))) : (((2))))');
  await aefsca2('(sp/if-not 1 2 3)', 3);

  // TODO: cond実装したらtestたくさん書きましょう
  //await aefsca2('(cond ...)', false); // TODO
  //await aefsca2('(cond ...)', false); // TODO
  //await aefsca2('(cond ...)', false); // TODO
  //await aefsca2('(cond ...)', false); // TODO

  //await aefsca2('(let a 1) (when (- 1 a) (set! a 9)) a', 1);
  //await aefsca2('(let a 1) (when-not (- 1 a) (set! a 9)) a', 9);

  // TODO: メンテしましょう
  await aefsca('(fn [a { b } ... args] { a :b b args })', '( (a,{b}, ... args) => (({a,b:b,args})))');
  const faResult = '(async () => (({})))';
  await aefsca('(async-fn [] {})', faResult);
  await aefsca('(fn-async [] {})', faResult);
  await aefsca('(fn [] (aaa) (await (bbb)) (ccc))', '( () => ((aaa)(), (await (bbb)()), (ccc)()))');
  await aefsca('(fn [] (aaa) (bbb) (return (ccc)))', '( () => {(aaa)();\n(bbb)();\nreturn (ccc)()})');

  await aefsca('(do)', '{}');
  await aefsca('(do (aaa) (bbb) (ccc))', '((aaa)(), (bbb)(), (ccc)())');
  await aefsca('(do (aaa) (bbb) (throw (new Error "ababa")))', '{(aaa)();\n(bbb)();\nthrow (new (Error)("ababa"))}');

  await aefsca('(??= a 123)', '((a)??=((123)))');
  await aefsca('(fn [(??= a 123)] a)', '( (a=((123))) => (a))');
  await assertThrowForSeonCodeAsync('(fn [(??= a 1 2)] a)');

  const importResult1 = 'import "./foo.js"';
  await aefsca('(import "./foo.js")', importResult1);
  await aefsca('(import "./foo.js" {})', importResult1);
  const importResult2 = 'import * as Path from "node:path"';
  await aefsca('(import "node:path" Path)', importResult2);
  const importResult3 = 'import {existsSync,default as Fs} from "node:fs"';
  await aefsca('(import "node:fs" {existsSync :default Fs})', importResult3);
  await aefsca('(import {"./foo.js" {} "node:path" Path "node:fs" {existsSync :default Fs}})', [importResult1, importResult2, importResult3].join(";\n"));
  await aefsca('(import "./foo.s2js")', 'import "./foo.js"');
  await aefsca('(import "./foo.s2mjs")', 'import "./foo.mjs"');

  await aefsca('(let foo-bar 123)', 'let fooBar = (123)');
  await aefsca('(let %%%)', 'let _PERCENT__PERCENT__PERCENT_');

  await aefsca('(const foo-bar 123)', 'const fooBar = (123)');
  await aefsca('(const [(??= a 9)] [1 2])', 'const [a=((9))] = [(1),(2)]');
  await aefsca('(const {(??= a 9)} {:a 1})', 'const {a=((9))} = ({a:(1)})');

  await aefsca('(const-fn foo [a b c] (Math.max a (Math.min b c)))', 'const foo = ( (a,b,c) => ((Math.max)(a,(Math.min)(b,c))))');
  const cfaResult = 'const foo = (async () => ((await (foo)())))';
  await aefsca('(const-fn-async foo [] (await (foo)))', cfaResult);
  await aefsca('(const-async-fn foo [] (await (foo)))', cfaResult);

  await aefsca('(export (const foo 123))', 'export const foo = (123)');
  await aefsca('(export const foo 123)', 'export const foo = (123)');
  await aefsca('(export-const foo-bar 123)', 'export const fooBar = (123)');
  await aefsca('(export-const-fn foo [] 123)', 'export const foo = ( () => ((123)))');
  const ecfaResult = 'export const foo = (async () => ((123)))';
  await aefsca('(export-const-fn-async foo [] 123)', ecfaResult);
  await aefsca('(export-const-async-fn foo [] 123)', ecfaResult);

  await aefsca('(set! a b 1)', '((a)=(b)=((1)))');
  await assertThrowForSeonCodeAsync('(= a 1)');
  await aefsca('(=== a b)', '((a)===(b))');
  await assertThrowForSeonCodeAsync('(=== a b c)'); // NB: これは案外問題になるので敢えて禁止にしてある、注意
  await aefsca('(== a b)', '((a)==(b))');
  await aefsca('(!== a b)', '((a)!==(b))');
  await aefsca('(!= a b)', '((a)!=(b))');
  await aefsca('(not=== a b)', '((a)!==(b))');
  await aefsca('(not== a b)', '((a)!=(b))');
  await aefsca('(not= a b)', '((a)!==(b))');

  await aefsca2('(< -1 1)', true);
  await aefsca2('(< 1 1)', false);
  await aefsca2('(<= 1 1)', true);
  await aefsca2('(<= 1 -1)', false);
  await aefsca2('(> -1 1)', false);
  await aefsca2('(> 1 1)', false);
  await aefsca2('(>= 1 1)', true);
  await aefsca2('(>= 1 -1)', true);

  await aefsca('(in a b)', '((a)in(b))');

  await aefsca('(&& a b c)', '((a)&&(b)&&(c))');
  await aefsca('(and a b c)', '((a)&&(b)&&(c))');
  await aefsca('(|| a b c)', '((a)||(b)||(c))');
  await aefsca('(or a b c)', '((a)||(b)||(c))');
  await aefsca('(?? a b c)', '((a)??(b)??(c))');
  await aefsca('(undefined-or a b c)', '((a)??(b)??(c))');
  await aefsca('(+ a b c)', '((a)+(b)+(c))');
  await aefsca('(add a b c)', '((a)+(b)+(c))');
  await aefsca('(str a b c)', '(("")+(a)+(b)+(c))');
  await aefsca('(- a b c)', '((a)-(b)-(c))');
  await aefsca('(sub a b c)', '((a)-(b)-(c))');
  await aefsca('(* a b c)', '((a)*(b)*(c))');
  await aefsca('(mul a b c)', '((a)*(b)*(c))');
  await aefsca('(/ a b c)', '((a)/(b)/(c))');
  await aefsca('(div a b c)', '((a)/(b)/(c))');
  await aefsca('(% a b)', '((a)%(b))');
  await aefsca('(rem a b)', '((a)%(b))');
  await aefsca('(** a b)', '((a)**(b))');
  await aefsca('(pow a b)', '((a)**(b))');

  await aefsca('(&&= a b c)', '((a)&&=(b)&&(c))');
  await aefsca('(and! a b c)', '((a)&&=(b)&&(c))');
  await aefsca('(||= a b c)', '((a)||=(b)||(c))');
  await aefsca('(or! a b c)', '((a)||=(b)||(c))');
  await aefsca('(??= a b)', '((a)??=(b))'); // これのみ処理が違うので要注意
  await aefsca('(undefined-or! a b c)', '((a)??=(b)??(c))');
  await aefsca('(+= a b c)', '((a)+=(b)+(c))');
  await aefsca('(add! a b c)', '((a)+=(b)+(c))');
  await aefsca('(str! a b c)', '((a)+=(b)+(c))');
  await aefsca('(-= a b c)', '((a)-=(b)-(c))');
  await aefsca('(sub! a b c)', '((a)-=(b)-(c))');
  await aefsca('(*= a b c)', '((a)*=(b)*(c))');
  await aefsca('(mul! a b c)', '((a)*=(b)*(c))');
  await aefsca('(/= a b c)', '((a)/=(b)/(c))');
  await aefsca('(div! a b c)', '((a)/=(b)/(c))');
  await aefsca('(%= a b)', '((a)%=(b))');
  await aefsca('(rem! a b)', '((a)%=(b))');
  await aefsca('(**= a b)', '((a)**=(b))');
  await aefsca('(pow! a b)', '((a)**=(b))');

  await aefsca('(+= a b)', '((a)+=(b))');
  await aefsca('(+= a b c)', '((a)+=(b)+(c))');
  await aefsca('(+= a b c d)', '((a)+=(b)+(c)+(d))');
  await assertThrowForSeonCodeAsync('(pow! a b c)');

  await aefsca2('(! 1)', false);
  await aefsca2('(! 0)', true);
  await aefsca2('(not "a")', false);
  await aefsca2('(!! undefined)', false);
  await aefsca2('(coerce-boolean "")', false);
  await aefsca2('(let a 1) [a (++ a) a]', [1, 2, 2]);
  await aefsca2('(let a 1) [a (++! a) a]', [1, 2, 2]);
  await aefsca2('(let a 1) [a (inc! a) a]', [1, 2, 2]);
  await aefsca2('(let a 1) [a (inc0! a) a]', [1, 1, 2]);
  await aefsca2('(let a 1) [a (-- a) a]', [1, 0, 0]);
  await aefsca2('(let a 1) [a (--! a) a]', [1, 0, 0]);
  await aefsca2('(let a 1) [a (dec! a) a]', [1, 0, 0]);
  await aefsca2('(let a 1) [a (dec0! a) a]', [1, 1, 0]);
  await aefsca2('(|0 1.23)', 1);
  await aefsca2('(sint32 4000000000)', -294967296);
  await aefsca2('(coerce-sint32 -1.23)', -1);
  await aefsca2('(let a 1.23) [a (|=0 a) a]', [1.23, 1, 1]);
  await aefsca2('(let a 1.23) [a (sint32! a) a]', [1.23, 1, 1]);
  await aefsca2('(let a 1.23) [a (coerce-sint32! a) a]', [1.23, 1, 1]);

  await aefsca2('(.max Math 1 2)', 2, '(Math).max((1),(2))');
  await aefsca2('(const a [9 8 7]) ([1] a)', 8, 'const a = [(9),(8),(7)];\n(a[(1)])');
  await aefsca2('(const o {:a 1 :b 2}) (:b o)', 2, 'const o = ({a:(1),b:(2)});\n(o).b');
  await aefsca2('(const o {:a 1 :b 2}) (. o :b)', 2, 'const o = ({a:(1),b:(2)});\n((o).b)');
  await aefsca2('(const o {:a 1 :b 2}) (?. o :b)', 2, 'const o = ({a:(1),b:(2)});\n((o)?.b)');
  await aefsca2('(const o undefined) (?. o :b)', undefined);

  await aefsca2('(let a 1) (try (set! a 2) (catch e (set! a 3))) a', 2);
  await aefsca2('(let a 1) (try (throw! 4) (catch e (set! a 3))) a', 3);
  await aefsca2('(let a 1) (try (set! a 2) (finally (set! a 5))) a', 5);
  await aefsca2('(let a 1) (try (set! a 2) (catch e (set! a 3)) (finally (set! a 5))) a', 5);
  await aefsca2('(let a 1) (try (throw! 4) (catch e (set! a 3)) (finally (set! a 5))) a', 5);

  await assertThrowForSeonCode2('(test/test)');
  await aefsca2('(sp/import-s2sp "./test.s2sp") (test/test)', 1);
  await assertThrowForSeonCode2('(sp/import-s2sp "test.s2sp") (test/test)');

  await aefsca2('(sp/is-prod)', false);
  await aefsca2('(sp/is-dev)', true);
  await aefsca2('(sp/is-eliminate-assert)', false);
  await aefsca2('(sp/is-rename-const-let)', false);

  await aefsca2('(sp/assert 1) 1', 1);
  await assertThrowForSeonCode2('(sp/assert 0)');
  await aefsca2('(try (sp/assert 0) (catch e e.message))', 'assertion failed at line=1 col=6');

  await aefsca2(
    '(const {a ... rest} {:a 1})      (sp/assert-empty-object rest) a', 1);
  await assertThrowForSeonCode2(
    '(const {a ... rest} {:a 1 :b 2}) (sp/assert-empty-object rest) a');
};


const main = async () => {
  await testTranspile();
  await testSpecials();
};


await main();
