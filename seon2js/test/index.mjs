import { assert } from 'chai';
import * as sa from 'seon/sa';
import * as sym from 'seon/sym';
import * as seon from 'seon/seon';
import * as compile from '../src-compiler/seon2js/compiler/v0/compile.mjs';


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


const testSeon2js = () => {
  // TODO
};


const main = () => {
  testSeon2js();
};


main();
