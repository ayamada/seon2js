

const lockState = {};
const superviseHandlers = [];
let _isLastInputLocked;

export const isInputLocked = () => _isLastInputLocked;

export const isUsedLockKey = (key) => !!lockState[key];

export const lockInput = (key) => {
  if (lockState[key]) { throw new Error(`already locked by ${key}`) }
  const oldLocked = _isLastInputLocked;
  lockState[key] = 1;
  _isLastInputLocked = true;
  if (!oldLocked) {
    // 非ロック→ロックへと変化したので、superviseHandlersへ通知
    for (const f of superviseHandlers) { f(true) }
  }
};

export const unlockInput = (key) => {
  if (!lockState[key]) { throw new Error(`not locked by ${key}`) }
  delete lockState[key];
  _isLastInputLocked = false;
  for (const prop in lockState) { _isLastInputLocked = true }
  if (!_isLastInputLocked) {
    // ロック→非ロックへと変化したので、superviseHandlersへ通知
    for (const f of superviseHandlers) { f(false) }
  }
};

// isInputLocked()の結果が変化した時のみ、fnが呼ばれる。
// その際にfnには引数として変化後のisLockedが渡される
export const registerSuperviseHandle = (fn) => superviseHandlers.push(fn);
