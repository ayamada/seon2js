let rafId;
let deltaMsec = 0;
let maxDeltaMsec = 500;
let totalElapsedMsec = 0;
let prevMsec;
let tickCount = 0;
let isInTicker;
const countMax = Number.MAX_SAFE_INTEGER - 1;
const handles = [];
const waiters = [];

const ticker = (nowMsec)=> {
  tickCount = (tickCount + 1) % countMax;
  if (!prevMsec) { prevMsec = nowMsec }
  deltaMsec = nowMsec - prevMsec;
  if (maxDeltaMsec < deltaMsec) { deltaMsec = maxDeltaMsec }
  totalElapsedMsec += deltaMsec;
  prevMsec = nowMsec;
  for (let i = waiters.length - 1; 0 <= i; i--) {
    const [endMsec, resolve] = waiters[i];
    if (endMsec <= totalElapsedMsec) {
      waiters.splice(i, 1);
      resolve();
    }
  }
  isInTicker = 1;
  for (const f of handles) { f() } // NB: handlesの実行順を「登録された順」に固定する事が必須なので↑のように展開できない、注意
  isInTicker = 0;
  rafId = requestAnimationFrame(ticker);
};

const _registerTick = (f) => handles.push(f);
const _unregisterTick = (f) => {
  const idx = handles.indexOf(f);
  if (idx != -1) { handles.splice(idx, 1) }
};

export const registerTick = (f) => {
  if (!rafId) { rafId = requestAnimationFrame(ticker) }
  // NB: handlesにfを追加するだけだが、ticker内からこれを実行した際は
  //     同じフレームで実行されてしまう問題が出る。
  //     ので、ticker内ではないところから実行される事を保証する。
  if (isInTicker) {
    setTimeout(() => _registerTick(f), 0);
  } else {
    _registerTick(f);
  }
};

export const unregisterTick = (f) => {
  // NB: handlesからfを消すだけだが、ticker内からこれを実行した際に
  //     実行中のhandlesのスキップが発生し得る。そうならないように、
  //     ticker内ではないところから実行される事を保証する。
  if (isInTicker) {
    setTimeout(() => _unregisterTick(f), 0);
  } else {
    _unregisterTick(f);
  }
};

export const getDeltaMsec = () => deltaMsec;
export const getTotalElapsedMsec = () => totalElapsedMsec;

// NB: これはループする！同一フレームかどうかの判定にのみ使う事
export const getTickCount = () => tickCount;

// 何らかの理由でフレームレートが大幅に落ちた場合は、
// maxDeltaMsecだけ進んだ扱いにする
export const setMaxDeltaMsec = (v) => { maxDeltaMsec = v };


// TODO: こっちはtickとは無関係なので、別namespaceに置きたいが…
export const setTimeoutAsync = (msec) => new Promise((resolve, reject) => setTimeout(resolve, msec));


export const waitMsecAsync = (msec) => new Promise((resolve, reject) => waiters.push([totalElapsedMsec + msec, resolve]));
