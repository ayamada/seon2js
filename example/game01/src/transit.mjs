import {registerTick, getDeltaMsec, getTotalElapsedMsec} from './tick.mjs'
import {isInputLocked, isUsedLockKey, lockInput, unlockInput} from './input.mjs'


const currentTickFns = [];
const applyThunk = (f) => f();
let isInstalled;


// (optional)inputをロックしながら、
// 定期的に renderFn(最大1の進行度) を実行しながら、
// msec待つやつ(msec経過後にinputをアンロックし、resolveを返す)
export const transitAsync = (renderFn, msec, lockKey=undefined) => {
  if (!isInstalled) {
    registerTick(() => currentTickFns.forEach(applyThunk));
    isInstalled = 1;
  }
  if (lockKey) {
    if (isUsedLockKey(lockKey)) {
      return new Promise((resolve, reject)=>reject('already locked'));
    }
    lockInput(lockKey);
  }
  const startMsec = getTotalElapsedMsec();
  return new Promise((resolve, reject) => {
    const f = () => {
      const nowMsec = getTotalElapsedMsec();
      const progress = Math.min(1, (nowMsec - startMsec)/msec);
      renderFn(progress);
      if (1 <= progress) {
        currentTickFns.splice(currentTickFns.indexOf(f), 1);
        resolve();
        if (lockKey) { unlockInput(lockKey) }
      }
    };
    currentTickFns.push(f);
  });
};
