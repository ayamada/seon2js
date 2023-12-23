

// IMObj = Inertial Migration Object = 慣性移動オブジェクト。
// 1msec単位で、多次元の慣性移動(角速度含む)およびoptionalの衝突判定を行う。
// つまり簡易の物理演算エンジン。
// makeIMObj()で慣性移動を扱うobjectを生成し(手で生成してもよい)、
// progressIMObj()で指定のmsecだけ時間経過させる(位置と速度を変動させる)。


// 角速度も「次元の一種」として扱ってよい(2Dゲーでも2次元以上にしてよい)
export const makeIMObj = (dimensions=1) => ({
  pos: Array(dimensions).fill(0),
  spd: Array(dimensions).fill(0),
  acc: Array(dimensions).fill(0),
  decelRates: Array(dimensions).fill(0.99),
  //decelStopLimits: 0.00001, // spdの絶対値がこの数値以下になったら0にcoerceする(これにより余計な計算をしなくてすむ)
});

// 上記を考慮して、もう1パターン作ってみる
const prevPos = [];
let spdTmp, msecIdx, dimIdx, isChanged;
export const progressIMObj = (imobj, msec, cdfn=undefined) => {
  const dimensions = imobj.pos.length;
  const decelStopLimits = imobj.decelStopLimits || 0.00001;
  // NB: ここを1msec単位でやらない手もある。
  //     しかし誤差を少なくするには累乗計算が必要になり、
  //     60fpsでの1フレームが17msecほどであるなら、
  //     素直に毎フレーム17回ほど加算と乗算をした方が安くて正確、
  //     という結論になった。
  for (msecIdx = 0; msecIdx < msec; msecIdx++) {
    isChanged = false;
    for (dimIdx = 0; dimIdx < dimensions; dimIdx++) {
      prevPos[dimIdx] = imobj.pos[dimIdx];
      spdTmp = (imobj.spd[dimIdx] + imobj.acc[dimIdx]) * imobj.decelRates[dimIdx];
      if (Math.abs(spdTmp) < decelStopLimits) { spdTmp = 0 }
      imobj.spd[dimIdx] = spdTmp;
      imobj.pos[dimIdx] += spdTmp;
      if (spdTmp) { isChanged = true }
    }
    // 衝突判定関数cdfnに新しい位置情報を渡す。ここでimobjを書き換えてもよい
    if (isChanged) { cdfn?.(imobj, prevPos, msecIdx, msec) }
  }
  return imobj;
};
