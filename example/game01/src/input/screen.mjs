import {isInputLocked, registerSuperviseHandle} from '../input.mjs'
import {rawScreenX2brppnX, rawScreenY2brppnY} from '../canvas/brppn.mjs'


// TODO: スマホでもtouch系だけではなく、同時にmouse系ハンドルも呼ばれる環境があるらしい…どうする？ → androidかiOSかのどっちかなので、実際に動かして確認するしかない


// TODO: これどうやったらsingletonやめられる？stateをなんとかしたらsingletonやめられる？installPointerSupervisorによるwindowへのaddEventListenerがあるので、それだけでは駄目そうだが…


let isHandlersRegistered;
const state = {};
const failedPos = -9999999;
let _lastPointerBrppnX = failedPos;
let _lastPointerBrppnY = failedPos;
let _isLastPointerPressed;
let _isLastSubButtonPressed;
let _isLastWheelPressed;
let _hasTouchScreen;


// canvasPointerHandleTable[boolPressOrRelease][intButtonNo] = [fn1, fn2, ...]
const canvasPointerHandleTable = {
  "true": {},
  "false": {},
};


const receiveMovePointerEvent = (e) => {
  const x = e.clientX;
  const y = e.clientY;
  if (x == null || y == null) { return }
  const canvas = state.canvas;
  _lastPointerBrppnX = rawScreenX2brppnX(canvas, x);
  _lastPointerBrppnY = rawScreenY2brppnY(canvas, y);
};


const receivePressMouse = (e) => {
  receiveMovePointerEvent(e);
  if (!e.button) {
    _isLastPointerPressed = true;
  } else if (e.button == 1) {
    _isLastWheelPressed = true;
  } else if (e.button == 2) {
    _isLastSubButtonPressed = true;
  }
  if (!isInputLocked()) { canvasPointerHandleTable[!0][e.button]?.forEach(f=>f()) }
};


const receiveReleaseMouse = (e) => {
  receiveMovePointerEvent(e);
  if (!e.button) {
    _isLastPointerPressed = false;
  } else if (e.button == 1) {
    _isLastWheelPressed = false;
  } else if (e.button == 2) {
    _isLastSubButtonPressed = false;
  }
  if (!isInputLocked()) { canvasPointerHandleTable[!1][e.button]?.forEach(f=>f()) }
};


const updateLastTouchPos = (e) => {
  _hasTouchScreen = 1;
  const touches = e.changedTouches;
  if (!touches.length) { return }
  receiveMovePointerEvent(touches[touches.length-1]);
};


const receivePressTouch = (e) => {
  // NB: 各handle内から座標を参照できるよう、先に座標を更新しておく
  updateLastTouchPos(e);
  // TODO: マルチタッチ対応
  _isLastPointerPressed = true;
  if (!isInputLocked()) { canvasPointerHandleTable[!0][0]?.forEach(f=>f()) }
};


const receiveReleaseTouch = (e) => {
  // NB: 各handle内から座標を参照できるよう、先に座標を更新しておく
  updateLastTouchPos(e);
  // TODO: マルチタッチ対応
  _isLastPointerPressed = false;
  if (!isInputLocked()) { canvasPointerHandleTable[!1][0]?.forEach(f=>f()) }
};


const receiveCancelTouch = (e) => {
  // TODO: マルチタッチ対応？
  _isLastPointerPressed = false;
  if (!isInputLocked()) { canvasPointerHandleTable[!1][0]?.forEach(f=>f()) }
};


const opt = {passive: true};
export const installPointerSupervisor = (canvas) => {
  state.canvas = canvas;
  if (isHandlersRegistered) { return }
  isHandlersRegistered = 1;
  // Moving
  self.addEventListener("mousemove", receiveMovePointerEvent, opt);
  self.addEventListener("touchmove", updateLastTouchPos, opt);
  // On
  self.addEventListener("mousedown", receivePressMouse, opt);
  self.addEventListener("touchstart", receivePressTouch, opt);
  // Off
  self.addEventListener("mouseup", receiveReleaseMouse, opt);
  self.addEventListener("touchend", receiveReleaseTouch, opt);
  self.addEventListener("touchcancel", receiveCancelTouch, opt);
};


// NB: brppn座標系での値が返る
export const getLastPointerBrppnX = () => isInputLocked() ? failedPos : _lastPointerBrppnX;
export const getLastPointerBrppnY = () => isInputLocked() ? failedPos : _lastPointerBrppnY;
export const isLastPointerPressed = () => _isLastPointerPressed;
export const isLastSubButtonPressed = () => _isLastSubButtonPressed;
export const isLastWheelPressed = () => _isLastWheelPressed;


// NB: タッチ操作で「既にonなのに更にonのイベントが発生する」事が普通に起こる。
//     (off→offも同様)
//     PC上でだけ開発していると忘れがちだが、これが起こっても大丈夫なように
//     組む必要がある。
export const registerActionListener = (canvas, target, isSenseRelease, h) => {
  (canvasPointerHandleTable[!isSenseRelease][target|0] ||= []).push(h);
};


export const preventDefaultSomePointerEvents = (dom) => {
  const p = (e)=>e.preventDefault();
  dom.addEventListener("mousedown", p);
  dom.addEventListener("touchstart", p);
  dom.addEventListener("mouseup", p);
  dom.addEventListener("touchend", p);
};


export const isFoundTouchDevice = () => _hasTouchScreen;


// 非ロック状態→ロック状態と遷移したら、全てのpressed状態を解除する
// (非ロック→ロック→非ロックと遷移した際にpressedが継続されるのはよくない)
// また、この際にreleaseハンドルを呼んではいけない
// (これによりpress→pressと呼ばれる事が起こり得るが、そもそもtouch環境では
// この呼び出し順になる事は普通に起こり得るので、そもそもこの呼び出し順に
// 対応していないのはまずい。常にpress→pressにも対応してある事が
// registerActionListenerで登録されるハンドルには求められる)
registerSuperviseHandle((isLocked)=>{
  if (isLocked) {
    _isLastPointerPressed = false;
    _isLastSubButtonPressed = false;
    _isLastWheelPressed = false;
  } else {
    // 今のところ、ロック解除時に何かする必要はない
  }
});
