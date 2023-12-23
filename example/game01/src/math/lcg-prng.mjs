// TODO: もっといいモジュール名、関数名を考える


const bit32 = 2**31;
const bit31full = bit32 - 1;

// makeRngの返す値は唯一のプロパティsを持つだけの単なるオブジェクト。
// 自由に参照したり書き換えたりしてよい
export const makeRng = (s=Math.floor(Math.random()*bit32)) => ({s: s});

export const nextRng = (o) => (bit31full & (o.s = Math.imul(48271, o.s))) / bit32;

