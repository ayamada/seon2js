import {registerTick, getDeltaMsec, getTotalElapsedMsec, setTimeoutAsync, waitMsecAsync} from '../tick.mjs'
import {makeBaseWidget, makeTextWidget, makeButtonWidget, registerButtonListeners, changeWidgetBgColor, changeWidgetText, changeWidgetTextStyle, getLastActionX, getLastActionY, restorePropagation, emitButtonEffect} from '../widget/base.mjs'
import {isInputLocked, lockInput, unlockInput} from '../input.mjs'



// TODO: きちんと動くようメンテする事


const f5buttonColorDisabled = {
  r: 0.5,
  g: 0.5,
  b: 0.5,
  a: 1,
};
const f5buttonColorNormal = {
  r: 1,
  g: 1,
  b: 1,
  a: 1,
};


const openCloseMsec = 200;


const doNothing = (... args) => {};
export const makeF5uiDot = (id, useStopPropagationLayer=undefined) => {
  const children = [
    makeF5Button(0),
    makeF5Button(1),
    makeF5Button(2),
    makeF5Button(3),
    makeF5Button(4),
  ];
  const makeChildLayer = (idx, originX) => ({
    $layout: {
      resetParentRectType: "screen",
      resetOriginX: originX,
      resetOriginY: 1,
    },
    $local: {
      x: 0,
      y: -0.2,
    },
    $children: [children[idx]],
  });
  const dot = {
    openRate: 0, // 0～1。初期状態は非表示
    labels: ["F5", "F5", "F5", "F5", "F5"],
    handles: [undefined, undefined, undefined, undefined, undefined],
    disables: [undefined, undefined, undefined, undefined, undefined],
    displays: [undefined, undefined, undefined, undefined, undefined],
    children: children,
    //
    $id: id,
    $layout: {
      resetParentRectType: "screen",
      resetOriginX: 0,
      resetOriginY: 0,
      anchorX: 0,
      anchorY: 0,
    },
    $local: {
      // NB: オンオフはyおよびaで処理する。初期状態はオフ
      a: 0,
      y: 1,
      // NB: これ自体が全画面の当たり判定を持つ
      w: 1000,
      h: 1000,
    },
    $$pressFn: (useStopPropagationLayer ? doNothing : undefined),
    $children: [
      makeChildLayer(0, -0.8),
      makeChildLayer(1, -0.4),
      makeChildLayer(2, 0),
      makeChildLayer(3, 0.4),
      makeChildLayer(4, 0.8),
    ],
    $isInactive: 1, // 初期状態は非表示
  };
  function makeF5Button (buttonIdx) {
    const buttonDot = makeButtonWidget({
      text: "F5",
      x: 0,
      y: 0,
      w: 0.7,
      h: 0.3,
      texKey: 'scratch/btn-neon',
      marginFallback: 0.1,
      marginLeft: 0.1,
      marginRight: 0.1,
      marginTop: 0.05,
      marginBottom: 0.05,
      pressFn: (gl, btn)=> {
        if (!dot.disables[buttonIdx]) { dot.handles[buttonIdx]?.(gl, btn) }
      },
      bgRenderParams: {
        focusRect: {
          x: 0*32,
          y: 0,
          w: 32,
          h: 32,
        },
      },
    });
    buttonDot.$isInactive = 1;
    return buttonDot;
  };
  return dot;
};


// TODO: openF5uiAsyncとcloseF5uiAsyncを同時に実行しても大丈夫なようにする必要があるが…どうすればいい？
export const openF5uiAsync = async (f5uiDot) => {
  if (f5uiDot.openRate == 1) { return } // 既に開いている
  const lockKey = 'openF5uiAsync';
  lockInput(lockKey);
  f5uiDot.$isInactive = 0;
  f5uiDot.openRate = 0;
  const startTime = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const nowTime = getTotalElapsedMsec();
    const progress = Math.min(1, (nowTime - startTime)/openCloseMsec);
    f5uiDot.openRate = progress;
    f5uiDot.$local.a = progress;
    f5uiDot.$needGlobalUpdate = 1;
    const invProgress = 1 - progress;
    const y = invProgress/4;
    f5uiDot.children.forEach((child)=>{
      child.$local.y = y;
      child.$needGlobalUpdate = 1;
    });
    if (progress == 1) { break }
  }
  unlockInput(lockKey);
};
// TODO: openF5uiAsyncとcloseF5uiAsyncを同時に実行しても大丈夫なようにする必要があるが…どうすればいい？
export const closeF5uiAsync = async (f5uiDot) => {
  if (f5uiDot.openRate == 0) { return } // 既に閉じている
  const lockKey = 'closeF5uiAsync';
  lockInput(lockKey);
  f5uiDot.$isInactive = 0;
  f5uiDot.openRate = 1;
  const startTime = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const nowTime = getTotalElapsedMsec();
    const progress = Math.min(1, (nowTime - startTime)/openCloseMsec);
    const invProgress = 1 - progress;
    f5uiDot.openRate = invProgress;
    f5uiDot.$local.a = invProgress;
    f5uiDot.$needGlobalUpdate = 1;
    const y = progress/4;
    f5uiDot.children.forEach((child)=>{
      child.$local.y = y;
      child.$needGlobalUpdate = 1;
    });
    if (progress == 1) { break }
  }
  f5uiDot.$isInactive = 1;
  unlockInput(lockKey);
};


export const setF5uiButtonState = (f5uiDot, buttonIdx, { text, handle, isDisable, isDisplay }) => {
  if (text != null) {
    f5uiDot.labels[buttonIdx] = text;
    changeWidgetText(f5uiDot.children[buttonIdx], text);
  }
  if (handle != null) {
    f5uiDot.handles[buttonIdx] = handle;
  }
  if (isDisable != null) {
    f5uiDot.disables[buttonIdx] = isDisable;
    // TODO: ここのdisable色設定をwidget側で処理できるようにしたい
    const newColor = isDisable ? f5buttonColorDisabled : f5buttonColorNormal;
    changeWidgetBgColor(f5uiDot.children[buttonIdx], newColor);
  }
  if (isDisplay != null) {
    f5uiDot.displays[buttonIdx] = isDisplay;
    f5uiDot.children[buttonIdx].$isInactive = !isDisplay;
  }
  // TODO: 他にも色変更などあれば反映したい
};



