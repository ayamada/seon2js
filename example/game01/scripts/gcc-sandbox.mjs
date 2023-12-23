
const bar = 'bar';
//function foo (aaa) { return aaa+aaa }
let foo = (aaa) => aaa+aaa;
const result = {
  'foo': 1,
  bar: bar,
};
window['FOO'] = foo;
console.log(result);
