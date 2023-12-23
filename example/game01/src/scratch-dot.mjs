import {registerTick, getDeltaMsec, getTotalElapsedMsec, setTimeoutAsync, waitMsecAsync} from "./tick.mjs"
import {isReadyGl, fetchGlFn} from "./canvas/gl/glfn.mjs"
import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from "./canvas/brppn.mjs"
import {createProgramFromShaderSources, isCCW} from "./canvas/gl/util.mjs"
import {isInputLocked, lockInput, unlockInput} from "./input.mjs"
import {isLastPointerPressed, getLastPointerBrppnX, getLastPointerBrppnY, registerActionListener} from "./input/screen.mjs"
import {xorshift} from "./math/xorshift.mjs"
import {mat4clone, mat4make, mat4overwrite, mat4reset, mat4compose, mat4composeR, mat4move, mat4scale, mat4rotate, mat4invert, mat4transpose, mat4setFudgeFactor} from "./math/mat4a.mjs"
import {renderWireFrame} from "./glfn/wire-frame.mjs"
import {renderSprite} from "./glfn/sprite.mjs"
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0, createTa, registerToTa, referTaEntry, reregisterToTa, testTaRegulation} from "./canvas/gl/texture.mjs"
import {tickDot, renderDot, findDotById, cleanFindDotCache, calculateLocalRectFromDot, isInDotRect} from "./canvas/dot.mjs"
import {makeTextCanvas, makeTextCanvasAndRegisteredTexId, updateTextCanvas, updateTextCanvasAsync} from "./canvas/text.mjs"
import {makeFpsDot} from "./dot/fps.mjs"
import {makeOofDot} from "./dot/out-of-frame.mjs"
import {transitAsync} from "./transit.mjs"
import {makeParticleDot, clearAllParticles, emitOneParticle, emitParticleEmitter, emitConfettiOne} from "./dot/particle.mjs"
import {makeIMObj, progressIMObj} from "./math/physics.mjs"
import {makeBaseWidget, makeTextWidget, makeButtonWidget, registerButtonListeners, changeWidgetBgColor, changeWidgetText, changeWidgetTextStyle, getLastActionX, getLastActionY, restorePropagation, emitButtonEffect} from "./widget/base.mjs"
import {setHtmlTitle, openUrl} from "./html/util.mjs"
import * as htmlIld from "./html/initial-loading-dom.mjs"
import * as f5ui from "./dot/f5ui.mjs"
//import {rect2LeftTop, rect2centerXY} from "./math/xywh-rect.mjs"


import {VA} from "./foreign/asg-va99.min.mjs"
import * as zatsu from "./canvas/zatsu.mjs"
import * as resource from "./scratch-resource.mjs"
import {gameState, resetGameData} from "./scratch-state.mjs"
import * as config from "./scratch-config.mjs"


//////////////////////////////////////////////////////////////////////////////


const TEXKEY = resource.TEXKEY;
const SE = resource.SE;
const BGM = resource.BGM;
const DICT = resource.DICT;


// TODO: この辺りもstateに入れたいが…
let indicatorTarget;
let isSyncProtagonistYFromIMObj;
let isStopGameByDemo;
let isStopBattle = 1;
let isOnLisper;
let isDefeatingBoss;
let isZoomOut;
let isRequiredJumpInThisFrame;


//////////////////////////////////////////////////////////////////////////////


let clearTripMsec = 0;
const clearTripThreshold = 50;
const tickConfetti = (gl) => {
  const deltaMsec = getDeltaMsec();
  clearTripMsec += deltaMsec;
  config.confettiOptions.texKey = TEXKEY.texTextSnow;
  //config.confettiOptions.fallingStartPointWidthRatio = 1.1;
  const targetX = !config.isSupportScrollingSnow ? 0 : gameState.rotIMObj ? (gameState.rotIMObj.pos[0]*objMoveFactor/-2) : 0;
  while (clearTripMsec > clearTripThreshold) {
    clearTripMsec -= clearTripThreshold;
    emitConfettiOne(gl, snowEffectLayer, config.confettiOptions, targetX);
  }
};


//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////


const makeButton = (params) => makeButtonWidget({ bgColor: config.defaultButtonBgColor, ... params });



const objMoveFactor = 0.85;


const openCloseMsec = 200;


// TODO: openStatusWindowAsyncとcloseStatusWindowAsyncも同時に実行しても大丈夫にする事
const openStatusWindowAsync = async () => {
  if (subWindowsLayer.$local.a == 1) { return } // 既に開いている
  subWindowsLayer.$local.a = 0;
  subWindowsLayer.$needGlobalUpdate = 1;
  const startTime = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const nowTime = getTotalElapsedMsec();
    const progress = Math.min(1, (nowTime - startTime)/openCloseMsec);
    const invProgress = 1 - progress;
    const y = invProgress/-4;
    subWindowsLayer.$local.a = progress;
    subWindowsLayer.$local.y = y;
    subWindowsLayer.$needGlobalUpdate = 1;
    if (progress == 1) { break }
  }
};
const closeStatusWindowAsync = async () => {
  if (subWindowsLayer.$local.a == 0) { return } // 既に閉じている
  subWindowsLayer.$local.a = 1;
  subWindowsLayer.$needGlobalUpdate = 1;
  const startTime = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const nowTime = getTotalElapsedMsec();
    const progress = Math.min(1, (nowTime - startTime)/openCloseMsec);
    const invProgress = 1 - progress;
    const y = progress/-4;
    subWindowsLayer.$local.a = invProgress;
    subWindowsLayer.$local.y = y;
    subWindowsLayer.$needGlobalUpdate = 1;
    if (progress == 1) { break }
  }
};


const registerAndMakeCanvasAndReturnTexKey = (gl, texKey, texIdx, canvasGeneratorThunk) => {
  if (referTex(gl, texKey)) { return texKey }
  const canvas = canvasGeneratorThunk();
  registerTex(gl, texKey, canvas);
  if (texIdx) { assignAndUploadGlTex(gl, texKey, texIdx) }
  return texKey;
};

const makeStatusWindowCanvasAndReturnTexKey = (gl, texIdx=undefined) => registerAndMakeCanvasAndReturnTexKey(gl, 'scratch/window1', texIdx, () => {
  const canvas = document.createElement('canvas');
  let margin = 8;
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rc = zatsu.canvas(canvas, undefined);
  let left = margin;
  let top = margin;
  let w = canvas.width - margin*2;
  let h = canvas.height - margin*2;
  rc.rectangle(left, top, w, h, {
    fill: '#FFF',
  });
  margin = 2;
  left += margin;
  top += margin;
  w -= margin*2;
  h -= margin*2;
  rc.rectangle(left, top, w, h, {
    stroke: '#FFF',
    fill: '#117',
    fillStyle: 'solid',
    //strokeWidth: 8,
    hachureAngle: 60, // angle of hachure,
    hachureGap: 16,
    seed: 1234567,
  });
  return canvas;
});

const makeFloorCanvasAndReturnTexKey = (gl, texId, texIdx=undefined, isUpper=undefined, isWall=0) => registerAndMakeCanvasAndReturnTexKey(gl, texId, texIdx, () => {
  const canvas = document.createElement('canvas');
  let margin = 32;
  canvas.width = 256;
  canvas.height = 256;
  if (!isUpper || isWall) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#666';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const rc = zatsu.canvas(canvas, undefined);
  let left = margin;
  let top = margin;
  let w = canvas.width - margin*2;
  let h = canvas.height - margin*2;
  if (!isUpper) {
    rc.rectangle(left, top, w, h, {
      fill: '#210',
      fillStyle: 'solid',
      seed: 1234567,
    });
    margin /= 2;
    left += margin;
    top += margin;
    w -= margin*2;
    h -= margin*2;
    rc.rectangle(left, top, w, h, {
      fill: '#AAB',
      fillStyle: 'cross-hatch',
      //strokeWidth: 8,
      hachureAngle: 60, // angle of hachure,
      hachureGap: 16,
      seed: 1234567,
    });
    left += margin;
    top += margin;
    w -= margin*2;
    h -= margin*2;
    rc.rectangle(left, top, w, h, {
      fill: '#123',
      fillStyle: 'dots',
      strokeWidth: 8,
      seed: 1234567,
    });
  } else {
    rc.eraseRect(left, top, w, h);
  }
  return canvas;
});

const spaceLayer = {
  $children: [],
};
const makeStar = (x, y, size, luminosity) => ({
  $local: {
    x: x,
    y: y,
    w: size,
    h: size,
    r: luminosity,
    g: luminosity,
    b: luminosity,
    a: 1,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextSnow;
    dot.$needGlobalUpdate = 1;
  },
});
for (let i = 0; i < 24; i++) {
  const x = (xorshift()-0.5)*3.5;
  const y = (xorshift()-0.5)*1.4-0.2;
  const size = 0.005+xorshift()*0.005;
  const luminosity = 0.5+xorshift()*0.5;
  spaceLayer.$children.push(makeStar(x, y, size, luminosity));
}

const moonLayer = {
  $children: [
    {
      $local: {
        x: 0.8,
        y: -0.8 + 0.2,
        w: 0.2,
        h: 0.2,
        r: 0.9,
        g: 0.9,
        b: 0.1,
        a: 1,
      },
      $texKey: undefined, // NB: $initFnで設定される
      $initFn: (gl, dot)=> {
        dot.$texKey = TEXKEY.texTextSnow;
        dot.$needGlobalUpdate = 1;
      },
    },
  ],
};
const objLayer = {
  $local: {},
  $children: [],
};

const emitTextMessage = (gl, texKey, x, y, scale=1) => textEffectLayer.$children.push({
  $layout: {
    isAutoGlobalW: 1,
  },
  $local: {
    x: x,
    y: y,
    w: 0,
    h: 0.2,
    scaleX: scale,
    scaleY: scale,
  },
  $texKey: texKey,
});

const emitShoot = (gl, dot, isForce=undefined) => {
  if (!isForce && (gameState.mode != "game")) { return }
  // 自機中央の座標を取る
  const x = -gameState.rotIMObj.pos[0];
  if (isOnLisper) {
    // 旗が動いてない時に限り、旗を射出できる
    if (flagDot.$isInactive) {
      // 旗を持ってない状態にする
      protagonist.$texKey = lispernoflagTexKey;
      // 旗を射出する
      flagDot.$isInactive = 0;
      flagDot.startMsec = getTotalElapsedMsec();
      flagDot.$local.x = protagonist.$local.x+0.7;
      flagDot.$local.y = protagonist.$local.y-0.8;
      VA.P(SE.shootout);
    }
  } else {
    VA.P(SE.error);
    emitTextMessage(gl, TEXKEY.texTextRunout, x, 0.3);
  }
};

const protagonistInitialY = 0.75;

const tinyelfTexKey = 'scratch/tinyelf';
const tinyelfBaseWidth = 0.4;

const lisperTexKey = 'scratch/lisper';
const lispernoflagTexKey = 'scratch/lispernoflag';
const lisperBaseWidth = 1.0;

const makeHatDot = (x, y, scale) => ({
  $isInactive: 1,
  $texKey: 'xmas/hat',
  $layout: {
    anchorX: 0,
    anchorY: 0.9,
  },
  $local: {
    x: x,
    y: y,
    w: -0.3,
    h: 0.3,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    scaleX: scale,
    scaleY: scale,
  },
  $renderParams: {
    focusRect: {
      x: 0,
      y: 0,
      w: 64,
      h: 64,
    },
  },
});

const hatDotInLisper = makeHatDot(-0.1, -0.3, 1);

const lisperDot = {
  $isInactive: 1,
  $texKey: lisperTexKey,
  $layout: {
    anchorX: 0,
    anchorY: 0.9,
  },
  $local: {
    x: 0,
    y: protagonistInitialY,
    w: lisperBaseWidth,
    h: lisperBaseWidth*300/530,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    scaleX: 2,
    scaleY: 2,
  },
  $children: [
    {
      $texKey: tinyelfTexKey,
      $layout: {
        anchorX: -0.1,
        anchorY: 0.95,
      },
      $local: {
        x: -0.25,
        y: -0.3,
        w: -tinyelfBaseWidth,
        h: tinyelfBaseWidth*15/12,
        scaleX: 0.5,
        scaleY: 0.5,
        a: 0, // 非表示中でも$globalを計算したいので、aで制御する
      },
    },
    hatDotInLisper,
  ],
};
const lisperDotDS = {
  $isInactive: 1,
  $texKey: lispernoflagTexKey,
  $layout: {
    anchorX: 0,
    anchorY: 0.5,
  },
  $local: {
    x: 0,
    y: protagonistInitialY,
    w: lisperBaseWidth,
    h: lisperBaseWidth*300/530/10,
    r: 0,
    g: 0,
    b: 0,
    a: 0.4,
    scaleX: 2,
    scaleY: 2,
  },
};

const makeTinyelfDot = () => ({
  $texKey: tinyelfTexKey,
  $layout: {
    anchorX: -0.1,
    anchorY: 0.95,
  },
  $local: {
    x: 0,
    y: protagonistInitialY,
    w: tinyelfBaseWidth,
    h: tinyelfBaseWidth*15/12,
    r: 0.1,
    g: 0.1,
    b: 0.1,
    a: 1,
  },
});

const tinyelfDot = makeTinyelfDot();
const tinyelfDotDS = {
  $texKey: tinyelfTexKey,
  $layout: {
    anchorX: -0.1,
    anchorY: 1,
  },
  $local: {
    x: 0,
    y: protagonistInitialY+0.02,
    w: tinyelfBaseWidth,
    h: tinyelfBaseWidth/10,
    r: 0,
    g: 0,
    b: 0,
    a: 0.7,
  },
};

const tinyelfDotForEvent = makeTinyelfDot();
tinyelfDotForEvent.$isInactive = 1;
tinyelfDotForEvent.$local.r = 1;
tinyelfDotForEvent.$local.g = 1;
tinyelfDotForEvent.$local.b = 1;
tinyelfDotForEvent.$local.w = -tinyelfDotForEvent.$local.w;


let protagonist = tinyelfDot;
let protagonistDS = tinyelfDotDS;
protagonist.$$pressFn = emitShoot;
protagonist.$local.a = 0;
protagonist.$needGlobalUpdate = 1;
protagonistDS.$local.a = 0;
protagonistDS.$needGlobalUpdate = 1;


const flagDot = {
  startMsec: 0,
  $isInactive: 1,
  $texKey: 'scratch/flag',
  $layout: {
    anchorX: 0,
    anchorY: 0,
  },
  $local: {
    x: 0,
    y: 0,
    w: 0.5,
    h: 0.5,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
};

const boxDot = {
  $texKey: 'xmas/box',
  $layout: {
    anchorX: 0,
    anchorY: 0.9,
  },
  $local: {
    x: 0,
    y: protagonistInitialY - 2,
    w: 0.4,
    h: 0.4,
    r: 10000,
    g: 10000,
    b: 10000,
    a: 1,
  },
};

const hatDot = makeHatDot(0, 0, 1);

const blastDown = {
  $layout: {
    anchorX: 0,
    anchorY: -1,
  },
  $renderParams: {
    isWrapRepeat: 0,
    isWrapMirrored: 0,
    kaleidoscopicRect: {
      x: 0, // NB: initFnで上書きされる
      y: 0, // NB: initFnで上書きされる
      w: 1, // NB: initFnで上書きされる
      h: 1, // NB: initFnで上書きされる
    },
    focusRect: {
      x: 0,
      y: 0,
      w: 512, // NB: initFnで上書きされる
      h: 512, // NB: initFnで上書きされる
    },
  },
  $texKey: undefined, // NB: $initFnで設定される
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextSnow;
    dot.$needGlobalUpdate = 1;
    const dom = referTex(gl, dot.$texKey);
    dot.$renderParams.kaleidoscopicRect.w = dom.width;
    dot.$renderParams.kaleidoscopicRect.h = dom.height/2;
    dot.$renderParams.kaleidoscopicRect.y = dom.height/2;
    dot.$renderParams.focusRect.w = dom.width;
    dot.$renderParams.focusRect.h = dom.height/2;
  },
  $local: {
    x: 0,
    y: 0,
    w: 1,
    h: 0.1,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
};

const blastUp = {
  $layout: {
    anchorX: 0,
    anchorY: 1,
  },
  $renderParams: {
    isWrapRepeat: 0,
    isWrapMirrored: 0,
    kaleidoscopicRect: {
      x: 0, // NB: initFnで上書きされる
      y: 0, // NB: initFnで上書きされる
      w: 1, // NB: initFnで上書きされる
      h: 1, // NB: initFnで上書きされる
    },
    focusRect: {
      x: 0,
      y: 0,
      w: 512, // NB: initFnで上書きされる
      h: 512, // NB: initFnで上書きされる
    },
  },
  $texKey: undefined, // NB: $initFnで設定される
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextSnow;
    dot.$needGlobalUpdate = 1;
    const dom = referTex(gl, dot.$texKey);
    dot.$renderParams.kaleidoscopicRect.w = dom.width;
    dot.$renderParams.kaleidoscopicRect.h = dom.height/2;
    dot.$renderParams.kaleidoscopicRect.y = 0
    dot.$renderParams.focusRect.w = dom.width;
    dot.$renderParams.focusRect.h = dom.height/2;
  },
  $local: {
    x: 0,
    y: 0,
    w: 1,
    h: 0.5,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
};

const blast = {
  $isInactive: 1,
  $local: {
    x: 0,
    y: protagonistInitialY,
    w: 1,
    h: 1,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
  $children: [
    blastDown,
    blastUp,
  ],
};


// 床の横引き伸ばし倍率
const baseFloorMulX = 4;
const baseFloorMulY = 2;


const wallBaseY = -1.1 + 0.7;
const wallBaseScale = 1.4;

const scratchWall1 = {
  $layout: {
    anchorX: 0,
    anchorY: 0,
  },
  $local: {
    x: 0,
    y: wallBaseY,
    w: 1 * baseFloorMulX / 1,
    h: 1 * baseFloorMulY / 2,
    scaleX: wallBaseScale,
    scaleY: wallBaseScale,
    //a: 0.5,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $renderParams: {
    isWrapRepeat: 1,
    isWrapMirrored: 0,
    kaleidoscopicRect: {
      x: 0,
      y: 0,
      w: 1, // NB: initFnで上書きされる
      h: 1, // NB: initFnで上書きされる
    },
    focusRect: {
      x: 0,
      y: 0,
      w: 512, // NB: initFnで上書きされる
      h: 512, // NB: initFnで上書きされる
    },
    //extraMatrix: (()=>{
    //  const m = mat4make();
    //  m[10]=0.1; // z圧縮しないとはみ出る
    //  mat4setFudgeFactor(m, 1.667);
    //  //mat4rotate(m, -Math.PI/4, 1, 0, 0);
    //  //mat4move(m, 0, -4, 0);
    //  //mat4rotate(m, Math.PI/4, 1, 0, 0);
    //  //mat4move(m, 0, 0.1, 0);
    //  gameState.floorMatrixBase = mat4clone(m);
    //  return m;
    //})(),
  },
  $initFn: (gl, dot)=> {
    const k = makeFloorCanvasAndReturnTexKey(gl, 'scratch/obj-wall1', 5, true, 1);
    dot.$texKey = k;
    const dom = referTex(gl, k);
    dot.$renderParams.kaleidoscopicRect.w = dom.width;
    dot.$renderParams.kaleidoscopicRect.h = dom.height;
    dot.$renderParams.focusRect.w = dom.width * 2 * baseFloorMulX / 1;
    dot.$renderParams.focusRect.h = dom.height * 2 * baseFloorMulY / 2;
  },
};
const scratchFloor1 = {
  $layout: {
  },
  $local: {
    x: 0,
    y: 0.75,
    w: 8 * baseFloorMulX,
    h: 8,
    //a: 0.5,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $renderParams: {
    isWrapRepeat: 1,
    isWrapMirrored: 0,
    kaleidoscopicRect: {
      x: 0,
      y: 0,
      w: 1, // NB: initFnで上書きされる
      h: 1, // NB: initFnで上書きされる
    },
    focusRect: {
      x: 0,
      y: 0,
      w: 512, // NB: initFnで上書きされる
      h: 512, // NB: initFnで上書きされる
    },
    extraMatrix: (()=>{
      const m = mat4make();
      m[10]=0.1; // z圧縮しないとはみ出る
      mat4setFudgeFactor(m, 1.667);
      mat4rotate(m, -Math.PI/4, 1, 0, 0);
      gameState.floorMatrixBase = mat4clone(m);
      return m;
    })(),
  },
  $initFn: (gl, dot)=> {
    const k = makeFloorCanvasAndReturnTexKey(gl, 'scratch/obj-floor1', 6, true);
    dot.$texKey = k;
    const dom = referTex(gl, k);
    dot.$renderParams.kaleidoscopicRect.w = dom.width;
    dot.$renderParams.kaleidoscopicRect.h = dom.height;
    dot.$renderParams.focusRect.w = dom.width * 2 * baseFloorMulX;
    dot.$renderParams.focusRect.h = dom.height * 2 * baseFloorMulY;
  },
};
const scratchFloor2 = {
  $layout: {
  },
  $local: {
    x: 0,
    y: 0.75,
    w: 8 * baseFloorMulX,
    h: 8,
    //a: 0.5,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $renderParams: {
    isWrapRepeat: 1,
    isWrapMirrored: 0,
    kaleidoscopicRect: {
      x: 0,
      y: 0,
      w: 1, // NB: initFnで上書きされる
      h: 1, // NB: initFnで上書きされる
    },
    focusRect: {
      x: 0,
      y: 0,
      w: 512, // NB: initFnで上書きされる
      h: 512, // NB: initFnで上書きされる
    },
    extraMatrix: (()=>{
      const m = mat4make();
      m[10]=0.1; // z圧縮しないとはみ出る
      mat4setFudgeFactor(m, 1.667);
      mat4move(m, 0, 0.08, 0);
      mat4rotate(m, -Math.PI/4, 1, 0, 0);
      gameState.floorMatrixBase = mat4clone(m);
      return m;
    })(),
  },
  $initFn: (gl, dot)=> {
    const k = makeFloorCanvasAndReturnTexKey(gl, 'scratch/obj-floor2', 13, false);
    dot.$texKey = k;
    const dom = referTex(gl, k);
    dot.$renderParams.kaleidoscopicRect.w = dom.width;
    dot.$renderParams.kaleidoscopicRect.h = dom.height;
    dot.$renderParams.focusRect.w = dom.width * 2 * baseFloorMulX;
    dot.$renderParams.focusRect.h = dom.height * 2 * baseFloorMulY;
  },
};


const snowEffectLayer = makeParticleDot('layer/snow-effect');
const gameEffectLayer = makeParticleDot('layer/game-effect');
const uiEffectLayer = makeParticleDot('layer/ui-effect');
const f5uiEffectLayer = makeParticleDot('layer/f5ui-effect');

const textEffectLayer = {
  $local: {},
  $children: [],
  $tickFn: (gl, dot) => {
    const ttlMsec = 1000;
    const now = getTotalElapsedMsec();
    // とにかく一定時間だけ上昇させて消す
    for (let i = dot.$children.length - 1; 0 <= i; i--) {
      const child = dot.$children[i];
      if (!child.startMsec) {
        child.startMsec = now;
        child.startY = child.$local.y;
      }
      const p = Math.min(1, (now - child.startMsec)/ttlMsec);
      child.$local.y = child.startY - 0.5*p;
      child.$needGlobalUpdate = 1;
      if (1 <= p) {
        dot.$children.splice(i, 1);
      }
    }
  },
};


const dummyMainGameScene = {
  $id: 'scene/dummy-main-game',
  $local: {},
  $children: [
  ],
};

const farEnemy = {
  $isInactive: 0,
  $layout: {
    anchorX: 0,
    anchorY: 0,
  },
  $local: {
    x: 0,
    y: 1,
    w: 224/512,
    h: 1,
    scaleX: 0.5,
    scaleY: 0.5,
  },
  $texKey: 'xmas/xmammoth',
};

const enemy = {
  lastTouchMsec: 0,
  lastHitMsec: 0,
  //
  $isInactive: 1,
  $layout: {
    anchorX: 0,
    anchorY: 0.98,
  },
  $local: {
    x: 0,
    y: 0,
    w: 224/512,
    h: 1,
    scaleX: 3,
    scaleY: 3,
  },
  $texKey: 'xmas/xmammoth',
};

const enemyDS = {
  //
  $isInactive: 1,
  $layout: {
    anchorX: 0,
    anchorY: 0,
  },
  $local: {
    x: 0,
    y: 0,
    w: 224/512,
    h: 0.05,
    r: 0,
    g: 0,
    b: 0,
    a: 0.7,
    // NB: 撃破時の対応の為に、↓はenemyのscaleと同一にしておく事
    scaleX: 3,
    scaleY: 3,
  },
  $texKey: 'xmas/xmammoth',
};

const isInRect = (rect, x, y, padding) => {
  const left = rect.x + (rect.anchorX*rect.w)/2 - padding;
  const right = left + rect.w + padding;
  const top = rect.y + (rect.anchorY*rect.h)/2 - padding;
  const bottom = top + rect.h + padding;
  return ((left <= x) && (x <= right) && (top <= y) && (y <= bottom));
};

const isNear = (x1, y1, x2, y2, dist) => ((x1-x2)**2+(y1-y2)**2 < dist**2);

const enemyColor = {
  r: 0.2,
  g: 0.9,
  b: 1,
  a: 1,

};

const doFadeoutObjLayerAsync = async (waitMsec) => {
  const startMsec = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    objLayer.$local.a = invP;
    objLayer.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  objLayer.$children = [];
  objLayer.$local.a = 1;
};

const emitDestroy = async (gl) => {
  lockInput('demo/destroy-enemy');
  VA.BGM();
  // このタイミングでまだ移動しているとスクロールが止まらなくなる。
  // これを防ぐ為に手で移動速度を0にする
  gameState.moveFactorX = 0;
  gameState.rotIMObj.spd[0] = 0;
  gameState.rotIMObj.acc[0] = 0;
  indicatorTarget = null;
  isStopGameByDemo = 1;
  isStopBattle = 1;
  // 弾丸を全部消す。レイヤのaを徐々に0にする
  doFadeoutObjLayerAsync(8000);
  // ボスが猛烈にぶるぶるする
  isDefeatingBoss = 1;
  await waitMsecAsync(2000);
  // ボスが大爆発しつつ縮んでいく
  let startMsec = getTotalElapsedMsec();
  let waitMsec = 5000;
  const startScaleX = enemy.$local.scaleX;
  const startScaleY = enemy.$local.scaleY;
  const endScaleX = 0.5;
  const endScaleY = 0.5;
  const particleTimerThreshold = 100;
  const seTimerThreshold = 500
  let particleTimer = particleTimerThreshold;
  let seTimer = seTimerThreshold;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const delta = getDeltaMsec();
    particleTimer += delta;
    seTimer += delta;
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    while (particleTimerThreshold < particleTimer) {
      particleTimer -= particleTimerThreshold;
      const g = enemy.$global;
      let x = g.x - g.w/2 + xorshift()*g.w;
      let y = g.y - g.h/2 + xorshift()*g.h;
      emitParticleEmitter(gameEffectLayer, {
        x: x,
        y: y,
        ttlMsec: 500,
        maxRadius: 0.5,
        quantity: 5,
      });
      x = g.x - g.w/2 + xorshift()*g.w;
      y = g.y - g.h/2 + xorshift()*g.h;
      emitNovaAsync2(gl, x, y, 0.5, 5, 500);
    }
    if (seTimerThreshold < seTimer) {
      seTimer -= seTimerThreshold;
      VA.P(SE.attack1);
    }
    enemy.$local.scaleX = startScaleX + p*(endScaleX-startScaleX);
    enemy.$local.scaleY = startScaleY + p*(endScaleY-startScaleY);
    enemy.$needGlobalUpdate = 1;
    enemyDS.$local.scaleX = enemy.$local.scaleX;
    enemyDS.$local.scaleY = enemy.$local.scaleY;
    enemyDS.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // 小さいツリーになる
  enemy.$texKey = 'xmas/tree';
  enemy.$renderParams = {focusRect: {
      x: 0,
      y: 0,
      w: 64,
      h: 128,
    }};
  isDefeatingBoss = 0;
  await waitMsecAsync(1500);
  // 宇宙に飛んでいって逃げていく
  VA.P(SE.unidentified);
  enemyDS.$local.a = 0;
  enemyDS.$needGlobalUpdate = 1;
  startMsec = getTotalElapsedMsec();
  waitMsec = 2000;
  const startY = gameState.bossAbsY;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    gameState.bossAbsY = startY - p*4;
    enemy.$local.y = gameState.bossAbsY;
    enemy.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // ステータスウィンドウを消す
  closeStatusWindowAsync();
  // また操作可能にする
  isStopGameByDemo = 0;
  unlockInput('demo/destroy-enemy');
  // インジケーターは箱を示す
  indicatorTarget = boxDot;
};


// TODO: objLayerなどを個別に動かさなくてすむように、スクロールについてはこちらで表現したいが…今から変更するの面倒では？
//const scrollLayer = {
//  $local: {},
//  $children: [
//    // TODO
//  ],
//};
const sgCameraLayer = {
  $id: 'sgCamera',
  $local: {},
  $children: [
    scratchWall1,
    scratchFloor2,
    scratchFloor1,
    //scrollLayer,
    enemyDS,
    lisperDotDS,
    protagonistDS,
    boxDot,
    enemy,
    lisperDot,
    protagonist,
    flagDot,
    objLayer,
    blast,
    textEffectLayer,
  ],
};

const updateScratchWall1 = (p) => {
  // TODO: こういう操作なしに自然に扱えるようにしたいが…
  const wFactor = p**1.5; // TODO: 微妙に不自然なのを直したいが…
  const wy = wallBaseY - wFactor*0.81;
  const ws = wallBaseScale + wFactor*1;
  scratchWall1.$local.y = wy;
  scratchWall1.$local.scaleX = ws;
  scratchWall1.$local.scaleY = ws;
  scratchWall1.$needGlobalUpdate = 1;
};

// sgCameraLayer.$local.xを動かす際に、いきなり大きく移動しないよう、
// 毎フレーム少しずつ動かすもの
const moveSgCameraDelta = () => {
  const deltaDist = (gameState.sgCameraDelta - sgCameraLayer.$local.x);
  if (deltaDist) {
    const deltaMsec = getDeltaMsec();
    const threshold = 0.001 * deltaMsec;
    const v = Math.max(-threshold, Math.min(threshold, deltaDist));
    sgCameraLayer.$local.x += v;
    sgCameraLayer.$needGlobalUpdate = 1;
  }
};


const doZoomOut = async (waitMsec, x) => {
  const startMsec = getTotalElapsedMsec();
  farEnemy.$isInactive = 0;
  farEnemy.$local.x = x;
  farEnemy.$local.y = 1;
  farEnemy.$local.scaleX = 0.5;
  farEnemy.$local.scaleY = 0.5;
  farEnemy.$needGlobalUpdate = 1;
  const startX = gameState.sgCameraDelta;
  const endX = startX / 2;
  const deltaX = endX - startX;
  while (1) {
    await waitMsecAsync(1);
    const p = Math.min(1, (getTotalElapsedMsec() - startMsec)/waitMsec);
    const scale = 1 - p/2;
    const x = startX + deltaX*p;
    const y = p / 2; // 拡大時に、下の方はあまり拡大しないように補正する
    gameState.sgCameraDelta = x;
    moveSgCameraDelta();
    sgCameraLayer.$local.y = y;
    sgCameraLayer.$local.scaleX = scale;
    sgCameraLayer.$local.scaleY = scale;
    sgCameraLayer.$needGlobalUpdate = 1;
    updateScratchWall1(p);

    farEnemy.$local.y = 1 - p*3;
    farEnemy.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  isZoomOut = 1;
};

const doZoomIn = async (waitMsec) => {
  const startMsec = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const p = Math.min(1, (getTotalElapsedMsec() - startMsec)/waitMsec);
    const invP = 1 - p;
    const scale = 1 - invP/2;
    const y = invP / 2;
    sgCameraLayer.$local.y = y;
    sgCameraLayer.$local.scaleX = scale;
    sgCameraLayer.$local.scaleY = scale;
    sgCameraLayer.$needGlobalUpdate = 1;
    updateScratchWall1(invP);
    if (1 <= p) { break }
  }
  isZoomOut = 0;
};

const doVibrateAsync = async (waitMsec, power, progressFn) => {
  const startMsec = getTotalElapsedMsec();
  const oldY = sgCameraLayer.$local.y;
  while (1) {
    await waitMsecAsync(1);
    const p = Math.min(1, (getTotalElapsedMsec() - startMsec)/waitMsec);
    const invP = 1 - p;
    sgCameraLayer.$local.y = oldY + xorshift()*0.05*power;
    sgCameraLayer.$needGlobalUpdate = 1;
    progressFn?.(p);
    if (1 <= p) { break }
  }
  sgCameraLayer.$local.y = oldY;
  sgCameraLayer.$needGlobalUpdate = 1;
};

const runAnimationObj = () => {
  const deltaMsec = getDeltaMsec();
  const objs = objLayer.$children;
  for (let i = objs.length-1; 0 <= i; i--) {
    const obj = objs[i];
    // アニメーションを進める
    obj.animMsec ??= 0;
    obj.animMsec += deltaMsec;
    if (500 <= obj.animMsec) {
      obj.animMsec -= 500;
      const oldIdx = obj.$renderParams.focusRect.x/64;
      const newIdx = (oldIdx+1) % 2;
      obj.$renderParams.focusRect.x = newIdx*64;
    }
  }
};

const moveEnemyBullets = (gl, playerX, deltaMsec) => {
  const now = getTotalElapsedMsec();
  // objLayer.$children 内のobjを、idx逆順で動かす(消すケースがある為)
  const objs = objLayer.$children;
  for (let i = objs.length-1; 0 <= i; i--) {
    const obj = objs[i];

    obj.$needGlobalUpdate = 1; // 基本的にobjは常に何かしら更新される

    // 移動させる
    const scale = Math.min(1, (now - obj.startMsec)/1000);
    obj.$local.scaleX = scale;
    obj.$local.scaleY = scale;
    obj.originalX -= deltaMsec*0.001;

    // 振動させる(上書きされる可能性あり)
    obj.$local.x = obj.originalX + xorshift()*0.01;
    obj.$local.y = obj.originalY - xorshift()*0.01;
    //const m = obj.$renderParams.extraMatrix;
    //const p = 0.01;
    //m[12] = xorshift()*p;
    //m[13] = xorshift()*p;

    // まだ $global がなければスキップ
    if (!obj.$global) {
      continue;
    }

    // 主人公よりもあまりに左に遠い場合、消去(ジャンプで越えた場合に起こる)
    const farThreshold = 10;
    if (farThreshold < playerX - obj.$local.x) {
      objs.splice(i, 1);
      continue;
    }

    // 非主人公のlisperに重なると、爆発(ノックバックなし)
    if (!isOnLisper) {
      if (isNearX(lisperDot.$global.x-0.5, obj.$global.x, 0.5)) {
        emitNovaAsync2(gl, obj.$global.x, obj.$global.y+0.1, 0.5, 5, 500);
        objs.splice(i, 1);
        continue;
      }
    }

    // 主人公に重なると、爆発して左ノックバック(lisper時はノックバック極小)
    // NB: 主人公サイズが2種類あり、また実際のrect判定とは違うので、要注意！(lisperの時は当たり判定の中心がやや左に寄る)
    const distX = (isOnLisper ? 0.5 : 1) * protagonist.$global.w / 2;
    const adjustX = isOnLisper ? distX : 0;
    const x1 = obj.$global.x + adjustX;
    const x2 = protagonist.$global.x;
    if (isNearX(x1, x2, Math.abs(distX))) {
      const distY = (isOnLisper ? 1 : 1) * protagonist.$global.h / 2;
      const y1 = obj.$global.y;
      const y2 = protagonist.$global.y;
      if (isNearX(y1, y2, Math.abs(distY))) {
        // 適切に爆風を出す
        emitNovaAsync2(gl, obj.$global.x, obj.$global.y+0.1, 0.5, 5, 500);
        // lisperの時はノックバック量は極小にする。
        // また既に左に動いている時に減速にならないよう制御する
        const oldSpd = gameState.rotIMObj.spd[0];
        const newSpd = isOnLisper ? 0.001 : 0.01;
        gameState.rotIMObj.spd[0] = Math.max(oldSpd, newSpd);
        VA.P(SE.paan);
        objs.splice(i, 1);
        continue;
      }
    }

    // 旗に重なると、爆発して消滅
    //if (!flagDot.$isInactive) {
    //  // TODO
    //  if (0) {
    //    // TODO
    //    objs.splice(i, 1);
    //    continue;
    //  }
    //}

    // TODO: 以下は古い処理
    //// 弾き飛ばされ状態なら、progressを進めて処理して終了
    //if (obj.isKickOut) {
    //  const denominator = 1000;
    //  obj.checkInProgress += deltaMsec;
    //  const progress = Math.min(1, obj.checkInProgress / denominator);
    //  const invProgress = 1 - progress;
    //  obj.$local.x = playerX + obj.kickOutDirection * 8 * progress;
    //  obj.$local.y = obj.originalY - 2 * progress;
    //  obj.$local.a = Math.min(1, invProgress * 3);
    //  obj.$local.scaleX = 1;
    //  obj.$local.scaleY = 1;
    //  if (1 <= progress) { objs.splice(i, 1) }
    //  continue; // 弾き飛ばされ状態の時は、この先の処理は行わない
    //}

    //// 主人公に十分に近い場合はチェックインしようとする状態へと遷移する
    //if (Math.abs(playerX - obj.$local.x) < 0.5) {
    //  obj.goingCheckIn = 1;
    //  obj.checkInProgress ??= 0;
    //} else {
    //  // …と思ったけど、解除ありだと面倒なので、一旦なしで
    //  //obj.goingCheckIn = 0;
    //}
    //// 主人公に十分に近い場合はチェックインしようとする。そうでなければチェックイン状態を解除しようとする
    //if (obj.goingCheckIn) {
    //  const denominator = 500;
    //  obj.checkInProgress += deltaMsec;
    //  const progress = Math.min(1, obj.checkInProgress / denominator);
    //  const invProgress = 1 - progress;
    //  // progressに応じた移動処理を行う
    //  const distX = playerX - obj.originalX;
    //  obj.$local.x = obj.originalX + distX * progress;
    //  const scale = 0.2 + 0.8*invProgress;
    //  obj.$local.scaleX = scale;
    //  obj.$local.scaleY = scale;
    //  if (1 <= progress) {
    //    // チェックイン可能ならカウントを増やす
    //    const gp = gameState.player;
    //    const msgY = 0.6;
    //    if (gp.numberOfGuestsMax <= gp.numberOfGuests) {
    //      // チェックイン不可、弾き飛ばす
    //      VA.P(SE.error);
    //      emitTextMessage(gl, TEXKEY.texTextAck, playerX, msgY);
    //      obj.isKickOut = 1;
    //      obj.kickOutDirection = Math.sign(xorshift()-0.5);
    //      obj.checkInProgress = 0;
    //    } else {
    //      // チェックイン完了。エフェクトを出し、このobjを除去
    //      VA.P(SE.coin);
    //      emitTextMessage(gl, TEXKEY.texTextCheckin, playerX, msgY);
    //      objs.splice(i, 1);
    //      if (config.isUseCheat) {
    //        gp.numberOfGuests += 10;
    //      } else {
    //        gp.numberOfGuests++;
    //      }
    //      updateStatusWindow();
    //      // 始めて満室になったらボス登場デモを実行する
    //      if ((gp.enemyHP == null) && (gp.numberOfGuestsMax <= gp.numberOfGuests)) {
    //        //startEnemyDemo();
    //      }
    //    }
    //  }
    //} else {
    //  // 解除ありだと面倒なので、一旦なしで
    //}
  }
};

const spawnEnemyBullet = (x, y) => ({
  startMsec: getTotalElapsedMsec(),
  animMsec: 0,
  originalX: x,
  originalY: y,
  //
  $layout: {
    anchorX: 0,
    anchorY: 0.9,
  },
  $local: {
    x: x,
    y: y,
    w: 0.2,
    h: 0.4,
    scaleX: 0,
    scaleY: 0,
  },
  $renderParams: {
    //extraMatrix: mat4make(),
    //registerToTa(gl, ta1, 'xmas/tree', 256, 256); // 64x128x2
    focusRect: {
      x: 0,
      y: 0,
      w: 64,
      h: 128,
    },
  },
  $texKey: 'xmas/tree',
});

const checkSpawnEnemyBullets = (playerX, deltaMsec) => {
  gameState.nextSpawnTimerMsec -= deltaMsec;
  if (0 < gameState.nextSpawnTimerMsec) { return }
  gameState.nextSpawnTimerMsec = 1000 + (xorshift()*1500)|0;
  if (10 < objLayer.$children.length) { return }
  //const enemyX = gameState.bossAbsX - playerX * objMoveFactor;
  const enemyX = gameState.bossAbsX;
  const ebDot = spawnEnemyBullet(enemyX, 0.75);
  objLayer.$children.push(ebDot);
};

const isNearX = (x1, x2, threshold) => (Math.abs(x1 - x2) <= threshold);

const moveEnemy = (gl, playerX) => {
  const now = getTotalElapsedMsec();

  // 旗と接触したら、敵のHP減少(ただし一定時間無敵あり)
  if (
    !flagDot.$isInactive
    &&
    (500 < (now - enemy.lastHitMsec))
    &&
    isNearX(enemy.$global.x, flagDot.$global.x, 0.2)
  ) {
    emitParticleEmitter(gameEffectLayer, {
      x: flagDot.$global.x,
      y: flagDot.$global.y+0.1,
      ttlMsec: 500,
      maxRadius: 0.5,
    });
    enemy.lastHitMsec = now;
    VA.P(SE.attack1);
    const oldHp = gameState.player.enemyHP;
    const damage = config.isUseCheat ? 30 : 1;
    const newHp = Math.max(0, oldHp - damage);
    gameState.player.enemyHP = newHp;
    updateStatusWindow();
    if (!newHp) {
      emitDestroy(gl);
    }
  }
};

const syncProtagonistDirection = () => {
  if (protagonist !== tinyelfDot) {
    protagonist.$local.scaleX = 2;
    protagonist.$needGlobalUpdate = 1;
    protagonistDS.$local.scaleX = 2;
    protagonistDS.$needGlobalUpdate = 1;
  } else if (gameState.moveFactorX) {
    const mfx = (0 < gameState.moveFactorX) ? 1 : -1;
    protagonist.$local.scaleX = mfx;
    protagonist.$needGlobalUpdate = 1;
    protagonistDS.$local.scaleX = mfx;
    protagonistDS.$needGlobalUpdate = 1;
  }
};


const inspectToNeedSlowDownAndUpdateMoveFactorX = () => {
  isRequiredJumpInThisFrame = 0;
  // ロック状態もしくは押されていない場合は減速確定
  if (isInputLocked() || !isLastPointerPressed()) { return 1 }
  const pointerX = getLastPointerBrppnX();
  const uX = protagonist.$global.x;
  let uThresholdX = Math.abs(protagonist.$local.w) * 0.4 * (isOnLisper ? 0.5 : 1);
  // TODO: isOnLisperの時の判定はもっと調整しないといけない！！
  if (isOnLisper) { uThresholdX *= 2 }
  // 押されているが左右どちらでもない場合は減速確定
  if ((uX-uThresholdX < pointerX) && (pointerX < uX+uThresholdX)) {
    // ただし主人公の当たり判定より十分上の場合、ジャンプ要求があったという事を記録しておく
    const uX = protagonist.$global.x;
    const pointerY = getLastPointerBrppnY();
    if (pointerY < protagonist.$global.y-protagonist.$global.h) {
      isRequiredJumpInThisFrame = 1;
    }
    return 1;
  }
  // TODO: uiボタン上で押されている場合も減速扱いにする必要がある、あとで実装する事
  // 加速確定。左右どちらへの加速なのかをmoveFactorXに反映する
  gameState.moveFactorX = (uX < pointerX) ? -1 : 1;
  syncProtagonistDirection();
  return 0;
};

const moveFloorsAndUpdateIMObj = (playerX) => {
  const deltaMsec = getDeltaMsec();
  const focusRect1 = scratchFloor1.$renderParams.focusRect;
  const focusRect2 = scratchFloor2.$renderParams.focusRect;
  const focusWall1 = scratchWall1.$renderParams.focusRect;
  const prevAngleSpdX = gameState.rotIMObj.spd[0];
  gameState.rotIMObj.acc[0] = gameState.moveFactorX * 0.00001;
  progressIMObj(gameState.rotIMObj, deltaMsec);
  const angleSpdX = gameState.rotIMObj.spd[0];
  if (1) {
    // TODO: focusRect.x は本来ならmodループさせないといけないパラメータだけど、今回は「ゲーム内での自機のx位置」も兼ねさせる事になった為、ループさせられなくなった。注意
    focusRect1.x = playerX * 50;
    focusRect2.x = playerX * 50;
    focusWall1.x = playerX * 50;
    //const angle = playerX % (Math.PI*2);
    //const m = scratchFloor1.$renderParams.extraMatrix;
    //gameState.rotAngle = angle;
    //mat4overwrite(m, gameState.floorMatrixBase);
    //mat4rotate(m, angle, 0, 0, 1);
  }
  // NB: y移動はfocusRect操作ではなく、protagonist.$local.y操作で実現している
  // デモ中の一部は、重力によるy反映を無視する(デモ中落下/ジャンプ中など)
  if (isSyncProtagonistYFromIMObj) {
    protagonist.$local.y = protagonistInitialY + Math.min(0, gameState.rotIMObj.pos[1]);
    protagonist.$needGlobalUpdate = 1;
  }
  // NB: 今回はz(奥)移動を使わない事になった
  //const prevAngleSpdZ = gameState.rotIMObj.spd[2];
  //gameState.rotIMObj.acc[2] = gameState.moveFactorZ * 0.00001;
  //progressIMObj(gameState.rotIMObj, deltaMsec);
  //const angleSpdZ = gameState.rotIMObj.spd[2];
  //if (prevAngleSpdZ || angleSpdZ) {
  //  focusRect1.y = gameState.rotIMObj.pos[2]*50;
  //  focusRect2.y = gameState.rotIMObj.pos[2]*50;
  //  focusWall1.y = gameState.rotIMObj.pos[2]*50;
  //}
};

const emitJump = () => {
  VA.P(SE.puyojump);
  gameState.rotIMObj.pos[1] = -0.005;
  gameState.rotIMObj.spd[1] = -0.005;
  gameState.rotIMObj.acc[1] = 0.000005;
};
const movePlayer = (deltaMsec, isSlowDown) => {
  if (isStopGameByDemo) { return }
  const oldSgCameraDelta = gameState.sgCameraDelta;
  // x方向はplayer以外を動かすが、y方向はplayerを動かす
  const isGrownded = (protagonistInitialY <= protagonist.$local.y);
  if (isSlowDown) {
    // 摩擦減速する
    gameState.moveFactorX = 0;
    if (gameState.movingSE) {
      VA.D(gameState.movingSE);
      gameState.movingSE = null;
    }
    if (isGrownded) {
      // 無駄にspdが上がらないよう、接地時はリセットする
      gameState.rotIMObj.spd[1] = 0;
      gameState.rotIMObj.acc[1] = 0;
      // 停止中でも、クリックされたらジャンプする
      if (!isInputLocked() && isLastPointerPressed() && isRequiredJumpInThisFrame) {
        isRequiredJumpInThisFrame = 0;
        emitJump();
      }
    }
  } else {
    if (isGrownded) {
      emitJump();
    }
    // gameState.moveFactorX 方向に加速する
    //if (!gameState.movingSE) {
    //  gameState.movingSE = VA.P(SE.dot);
    //  gameState.movingSE.loop = true;
    //}
    // 移動に応じて、sgCameraも一定範囲まで動かす
    let sgMoveAmount = gameState.moveFactorX * deltaMsec / 5000;
    if (Math.sign(oldSgCameraDelta) != Math.sign(sgMoveAmount)) { sgMoveAmount *= 2 }
    gameState.sgCameraDelta += sgMoveAmount;
    const sgCameraDeltaThreshold = 0.5;
    gameState.sgCameraDelta = Math.max(Math.min(gameState.sgCameraDelta, sgCameraDeltaThreshold), 0 - sgCameraDeltaThreshold);
  }
};

const tickMainGameScene = (gl, dot) => {
  //tickConfetti(gl);
  const deltaMsec = getDeltaMsec();
  const isDemoMode = ({
    "title": 1,
    "ending": 1,
  })[gameState.mode];
  const isInGame = ({
    "game": 1,
  })[gameState.mode];

  // プレイヤーおよびカメラの移動
  if (isDemoMode) {
    // 常に一定速度で横移動するだけのモード。sgCameraは動かさない
    gameState.moveFactorX = -0.1;
  } else if (isInGame) {
    movePlayer(deltaMsec, inspectToNeedSlowDownAndUpdateMoveFactorX());
  } else {
    // デモモードでもプレイ中でもなければ、ここ以降の処理はしない
    return;
  }

  runAnimationObj();

  if (!gameState.rotIMObj) { return }
  const playerX = -gameState.rotIMObj.pos[0];

  // 床と壁を動かす
  moveFloorsAndUpdateIMObj(playerX);
  // 床の動いた分だけ、箱も動かす
  boxDot.$local.x = gameState.boxX - playerX * objMoveFactor;
  boxDot.$needGlobalUpdate = 1;
  // 床の動いた分だけ、爆風も動かす
  blast.$local.x = gameState.blastX - playerX * objMoveFactor;
  blast.$needGlobalUpdate = 1;

  // sgCameraも動かす
  moveSgCameraDelta();

  // 関連レイヤも補正する
  textEffectLayer.$local.x = -playerX; // NB: ここだけはobjMoveFactorではないらしい
  textEffectLayer.$needGlobalUpdate = 1;
  objLayer.$local.x = - playerX * objMoveFactor;
  objLayer.$needGlobalUpdate = 1;
  if (config.isSupportScrollingSnow) {
    snowEffectLayer.$local.x = -playerX * objMoveFactor / 2;
    snowEffectLayer.$needGlobalUpdate = 1;
  }

  const now = getTotalElapsedMsec();

  if (isInGame) {
    // 敵をスクロール追随
    if (gameState.player.enemyHP) { moveEnemy(gl, playerX) }
    if (gameState.player.enemyHP != null) {
      // absX と absY から実座標を更新
      const enemyX = gameState.bossAbsX - playerX * objMoveFactor;
      const enemyY = gameState.bossAbsY;
      enemy.$local.x = enemyX + xorshift()*(isDefeatingBoss ? 0.2 : 0.05);
      enemy.$local.y = enemyY + xorshift()*(isDefeatingBoss ? 0.1 : 0.00);
      enemy.$needGlobalUpdate = 1;
      enemyDS.$local.x = enemy.$local.x;
      enemyDS.$local.y = enemy.$local.y;
      enemyDS.$needGlobalUpdate = 1;
    }
    // 非自機のlisperをスクロール追随
    if (!isOnLisper) {
      const lisperX = gameState.lisperX - playerX * objMoveFactor;
      lisperDot.$local.x = lisperX + xorshift()*0.00;
      lisperDot.$needGlobalUpdate = 1;
      lisperDotDS.$local.x = lisperDot.$local.x;
      lisperDotDS.$needGlobalUpdate = 1;
    }

    // indicatorの表示を制御＆ターゲット接触イベントの実行
    if (indicatorTarget) {
      const x = indicatorTarget.$local.x;
      const denominator = isZoomOut ? 1 : 2;
      let threshold = 5/denominator;
      indicatorLeft.$isInactive = (-threshold < x);
      indicatorRight.$isInactive = (x < threshold);
      // 特定ポイントに近付いたらデモを実行し、次のフェーズに入る。
      // 具体的には以下のパターンがある。
      // - 初めて箱に近付いた
      // - まだ乘っていないLisp Monsterに接触した
      // - ボス撃破後に箱に近付いた
      // 基本的には「indicatorTargetに十分近付いた」で判定してよい
      // (ただしボス生存中のみ例外)
      threshold = 1*denominator; // 初回箱のみ非接触で判定、他は接触で判定するのでこうする。間違いではない
      if ((indicatorTarget != enemy) && (-threshold < x) && (x < threshold)) {
        // 二重実行しないよう、先にindicatorTargetを空にしておく
        const oldIndicatorTarget = indicatorTarget;
        indicatorTarget = null;
        // イベント発動
        if (oldIndicatorTarget === lisperDot) { // lisperに乗る
          doRideLisperDemoAsync(gl);
        } else if (!isZoomOut) { // 初めて箱に近付いた(ボス出現)
          doEncounterBossDemoAsync(gl);
        } else { // 二回目に箱に近付いた(ボス撃破後)
          doOpenBoxDemoAsync(gl);
        }
      }
    }

    if (!isStopBattle) {
      // 敵弾の生成と移動
      checkSpawnEnemyBullets(playerX, deltaMsec);
      moveEnemyBullets(gl, playerX, deltaMsec);

      // 敵ボスと接触
      const enemyX = enemy.$local.x;
      const threshold = isOnLisper ? 0.4 : 0.6;
      const isKnockBacking = ((now - enemy.lastTouchMsec) < 500);
      if (!isKnockBacking && (-threshold < enemyX) && (enemyX < threshold)) {
        enemy.lastTouchMsec = now;
        const x = protagonist.$global.x + (isOnLisper ? 0.0 : 0.0);
        const y = protagonist.$global.y + (isOnLisper ? -0.1 : 0.1);
        emitNovaAsync2(gl, x, y, 0.5, 5, 500);
        gameState.rotIMObj.spd[0] = 0.01;
        VA.P(SE.paan);
      }
    }
  }

  // 旗射出状態の場合、ゲーム状態によらず旗を動かす(ヒット判定は別)
  if (!flagDot.$isInactive) {
    const p = Math.min(1, (now - flagDot.startMsec)/1000);
    const startX = protagonist.$local.x+0.7;
    const startY = protagonist.$local.y-0.8;
    const diffX = Math.sin(p*Math.PI)*2.5;
    const diffY = Math.sin(p*Math.PI)*0.5;
    flagDot.$local.x = startX + diffX;
    flagDot.$local.y = startY + diffY;
    flagDot.$needGlobalUpdate = 1;
    if (1 <= p) {
      flagDot.$isInactive = 1;
      protagonist.$texKey = lisperTexKey;
    }
  }
};

const mainGameScene = {
  $id: 'scene/main-game',
  //$isInactive: 1,
  $local: {
    y: -0.2,
  },
  $children: [
    spaceLayer,
    moonLayer,
    farEnemy,
    sgCameraLayer,
    snowEffectLayer,
    gameEffectLayer,
  ],
  $tickFn: tickMainGameScene,
};

const titleVersionDot = {
  $layout: {
    resetParentRectType: "aspect",
    resetOriginX: -1,
    resetOriginY: 1,
    anchorX: -1,
    anchorY: 1,
    isAutoGlobalW: 1,
  },
  $local: {
    x: 0.01,
    y: -0.01,
    w: 0,
    h: 0.1,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextVersionText;
    dot.$needGlobalUpdate = 1;
  },
};

const endingLogo = {
  $layout: {
    isAutoGlobalH: 1,
  },
  $local: {
    x: 0,
    y: -0.3,
    w: 2,
    h: 0,
  },
  $texKey: undefined,
  $renderParams: {
    extraMatrix: mat4make(),
  },
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextEndingLogo;
    dot.$needGlobalUpdate = 1;
  },
  $tickFn: (gl, dot)=> {
    const m = dot.$renderParams.extraMatrix;
    const p = 0.02;
    m[12] = xorshift()*p;
    m[13] = xorshift()*p;
  },
  //$isDisplayDebug: 1,
};

const titleLogo = {
  $layout: {
    isAutoGlobalH: 1,
  },
  $local: {
    x: 0,
    y: -0.1,
    w: 3,
    h: 0,
  },
  $texKey: undefined,
  $renderParams: {
    extraMatrix: mat4make(),
  },
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextTitleLogo;
    dot.$needGlobalUpdate = 1;
  },
  $tickFn: (gl, dot)=> {
    const m = dot.$renderParams.extraMatrix;
    const p = 0.02;
    m[12] = xorshift()*p;
    m[13] = xorshift()*p;
  },
  //$isDisplayDebug: 1,
};

// TODO: fromSceneKey もしくは toSceneKey がnullの時にも適切に動作するようにする事
const transitScenes = async (gl, fromSceneKey, toSceneKey, transitMsec) => {
  const lockKey = 'transition/scene';
  const fromSceneDot = findDotById(rootDot, fromSceneKey);
  const toSceneDot = findDotById(rootDot, toSceneKey);
  fromSceneDot.$isInactive = 0;
  fromSceneDot.$local.a = 1;
  fromSceneDot.$needGlobalUpdate = 1;
  toSceneDot.$isInactive = 0;
  toSceneDot.$local.a = 0;
  toSceneDot.$needGlobalUpdate = 1;
  lockInput(lockKey);
  await transitAsync((p) => {
    toSceneDot.$local.a = p;
    toSceneDot.$needGlobalUpdate = 1;
  }, transitMsec/2);
  await transitAsync((p) => {
    fromSceneDot.$local.a = 1 - p;
    fromSceneDot.$needGlobalUpdate = 1;
  }, transitMsec/2);
  fromSceneDot.$isInactive = 1;
  unlockInput(lockKey);
};

const transitFromGameToEnding = async (gl) => {
  //const exitButton = findDotById(rootDot, 'scratch/title-back-button');
  //exitButton.$isInactive = 1;
  //VA.BGM();
  closeStatusWindowAsync();
  //f5ui.closeF5uiAsync(f5uiLayerDot);
  // titleからボタンを奪い移植する
  const articleButtonLayer = findDotById(rootDot, 'article-button-layer');
  titleScene.$children = titleScene.$children.filter((dot)=> (dot.$id !== 'article-button-layer'));
  endingScene.$children.push(articleButtonLayer);
  articleButtonLayer.$isInactive = 1;
  endingScene.$needGlobalUpdate = 1;
  await transitScenes(gl, 'scene/dummy-main-game', 'scene/ending', 1600);
  //VA.BGM(SE.lvup, 1);
  VA.BGM(BGM.xmas, 1);
  gameState.mode = "ending";
  articleButtonLayer.$isInactive = 0;
  articleButtonLayer.$needGlobalUpdate = 1;
  let startMsec = getTotalElapsedMsec();
  const startY = protagonist.$local.y;
  while (gameState.mode === "ending") {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    protagonist.$local.y = startY - 0.5*Math.abs(Math.sin((now - startMsec)/500));
    protagonist.$needGlobalUpdate = 1;
    tickConfetti(gl);
    //emitParticleEmitter(gameEffectLayer, {
    //  x: endingLogo.$global.x,
    //  y: endingLogo.$global.y,
    //  quantity: 1,
    //});
  }
  protagonist.$local.y = protagonistInitialY; // ジャンプ強制解除
  // TODO: 加速度も止める必要あり
  protagonist.$needGlobalUpdate = 1;
  // このタイミングで既存のmenと雪を全部消す
  objLayer.$children = [];
  clearAllParticles(snowEffectLayer);
};

const transitFromEndingToTitle = async (gl) => {
  lockInput('backto/title');
  //const exitButton = findDotById(rootDot, 'scratch/title-back-button');
  //exitButton.$isInactive = 1;
  VA.BGM();
  const waitMsec = 600;
  transitAsync((p) => {
    protagonist.$local.r = 0.1;
    protagonist.$local.g = 0.1;
    protagonist.$local.b = 0.1;
    protagonist.$needGlobalUpdate = 1;
  }, waitMsec);
  transitScenes(gl, 'scene/ending', 'scene/title', waitMsec);
  await doZoomIn(waitMsec);
  gameState.mode = "title";
  updateStatusWindow();
  closeStatusWindowAsync();
  unlockInput('backto/title');
};

const emitMeteoriteAsync = async (gl, x, y, scale) => {
  const waitMsec = 2000;
  const initScale = 1;
  const playerX = -gameState.rotIMObj.pos[0];
  // 爆破エフェクトの準備
  blast.$isInactive = 0;
  gameState.blastX = x + playerX * objMoveFactor;
  blast.$local.x = gameState.blastX - playerX * objMoveFactor;
  blast.$local.y = y;
  blast.$local.scaleX = initScale;
  blast.$local.scaleY = initScale;
  blast.$local.a = 1;
  blast.$needGlobalUpdate = 1;
  // 画面を揺らす
  await doVibrateAsync(waitMsec, 1, (p) => {
    blast.$local.scaleX = initScale+p*scale;
    blast.$local.scaleY = initScale+p*scale;
    blast.$local.a = 2*(1-p);
    blast.$needGlobalUpdate = 1;
  });
  // 後始末
  blast.$isInactive = 1;
};


const doEncounterBossDemoAsync = async (gl) => {
  lockInput('demo/obj1');
  VA.BGM();
  await waitMsecAsync(500);
  // texTextAckを出す
  let playerX = -gameState.rotIMObj.pos[0];
  const textY = protagonist.$local.y - 0.5;
  VA.P(SE.caret);
  emitTextMessage(gl, TEXKEY.texTextAck, playerX, textY, 1);
  doVibrateAsync(2000, 2, undefined);
  await waitMsecAsync(1000);
  // 敵ボスが奥から上空へと出発
  const farEnemyX = 0;
  await doZoomOut(5000, farEnemyX);
  // farEnemyをオフにし、代わりにenemyの位置を設定してから、enemyを表示
  farEnemy.$isInactive = 1;
  farEnemy.$needGlobalUpdate = 1;
  gameState.bossAbsX = playerX*objMoveFactor + 1;
  gameState.bossAbsY = protagonistInitialY;
  enemy.$local.x = gameState.bossAbsX - playerX * objMoveFactor;
  enemy.$local.y = -2 - 4;
  enemy.$local.a = 1;
  enemy.$isInactive = 0;
  enemy.$needGlobalUpdate = 1;
  // 敵ボスが上空から落下登場
  let waitMsec = 3000;
  let startMsec = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    enemy.$local.y = protagonistInitialY - invP*3.5;
    enemy.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // 着地してblastと振動
  enemy.$local.r = 1;
  enemy.$local.g = 1;
  enemy.$local.b = 1;
  enemy.$needGlobalUpdate = 1;
  enemyDS.$local.x = enemy.$local.x;
  enemyDS.$local.y = enemy.$local.y;
  enemyDS.$isInactive = 0;
  enemyDS.$needGlobalUpdate = 1;
  // 敵をスクロールに追随させる為に、このタイミングで敵HPを設定する
  gameState.player.enemyHP = 30;
  VA.P(SE.launch);
  emitMeteoriteAsync(gl, enemy.$local.x, enemy.$local.y, 10);
  waitMsec = 2000;
  startMsec = getTotalElapsedMsec();
  await waitMsecAsync(500);
  const startPlayerX = playerX;
  const startBoxX = gameState.boxX;
  // 主人公は左に吹き飛ぶ
  gameState.rotIMObj.spd[0] = 0.01;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    // 箱は右に吹き飛ぶ
    gameState.boxX = startBoxX + p*4;
    boxDot.$local.x = gameState.boxX - playerX * objMoveFactor;
    boxDot.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // サブウィンドウ表示
  updateStatusWindow();
  openStatusWindowAsync();
  // 左の遠くにLisp Monsterを配置(論理座標も設定)
  let lispDist = 20;
  if (config.isUseCheat) { lispDist /= 5 }
  gameState.lisperX = playerX*objMoveFactor - gameState.sgCameraDelta - lispDist;
  lisperDot.$isInactive = 0;
  lisperDot.$local.y = protagonistInitialY;
  lisperDot.$needGlobalUpdate = 1;
  lisperDotDS.$isInactive = 0;
  lisperDotDS.$local.y = protagonistInitialY;
  lisperDotDS.$needGlobalUpdate = 1;
  await waitMsecAsync(1000);
  // 操作可能
  unlockInput('demo/obj1');
  // ボスが攻撃と移動を開始する
  isStopBattle = 0;
  // BGMの変更
  VA.BGM(BGM.bydlEx, 0, 1, 3);
  // indicatorの対応
  await waitMsecAsync(config.isUseCheat ? 500 : 5000);
  indicatorTarget = lisperDot;
};

const emitShiirareAsync = async (x, y, size, waitMsec) => {
  const startScale = size;
  const endScale = size;
  const startAlpha = 1;
  const endAlpha = 1;
  shiirareDot.$local.x = x;
  shiirareDot.$local.y = y;
  shiirareDot.$isInactive = 0;
  shiirareDot.$needGlobalUpdate = 1;
  const startMsec = getTotalElapsedMsec();
  while (1) {
    await waitMsecAsync(1);
    const p = Math.min(1, (getTotalElapsedMsec() - startMsec)/waitMsec);
    const invP = 1 - p;
    const scale = startScale + p*(endScale-startScale);
    shiirareDot.$local.scaleX = scale;
    shiirareDot.$local.scaleY = scale;
    shiirareDot.$local.a = startAlpha + p*(endAlpha-startAlpha);
    shiirareDot.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  shiirareDot.$isInactive = 1;
  shiirareDot.$needGlobalUpdate = 1;
};

const emitNovaAsync2 = async (gl, x, y, startSize, endSize, msec) => {
  x -= (gameState.rotIMObj.pos[0]*objMoveFactor/2);
  y += 0;
  emitConfettiOne(gl, snowEffectLayer, {
    texKey: 'scratch/nova',
    fixedColor: {r:1, g:1, b:1, a:1},
    x: x,
    y: y,
    maxRadius: 0,
    isSquare: 1,
    startScale: startSize,
    endScale: endSize,
    useBillBoard: 1,
    ttlMsec: msec,
  }, 0);
};


const doRideLisperDemoAsync = async (gl) => {
  VA.BGM();
  // まずボスの攻撃を一時的に無効化する(当たり判定をなくすか、敵弾を全部消す)
  isStopBattle = 1;
  lockInput('demo/obj2');
  await waitMsecAsync(500);
  // texTextAckを出す
  let playerX = -gameState.rotIMObj.pos[0];
  const textY = protagonist.$local.y - 0.5;
  VA.P(SE.caret);
  emitTextMessage(gl, TEXKEY.texTextAck, playerX, textY, 2);
  await waitMsecAsync(1500);
  // ゲーム演算一時停止
  isStopGameByDemo = 1;
  isSyncProtagonistYFromIMObj = 0;
  // ジャンプしてLispMonsterに乗る
  // この際はゲーム演算を無視して直に移動させる
  VA.P(SE.puyojump);
  protagonistDS.$isInactive = 1;
  const startX = protagonist.$local.x;
  const startY = protagonist.$local.y;
  const targetDot = lisperDot.$children[0];
  const deltaX = (targetDot.$global.x - protagonist.$global.x)*2.0;
  const deltaY = (targetDot.$global.y - protagonist.$global.y)*2.0;
  const startMsec = getTotalElapsedMsec();
  const waitMsec = 1500;
  const sgcX = sgCameraLayer.$local.x;
  const sgcDeltaX = deltaX * 0.0;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    protagonist.$local.x = startX + deltaX*p;
    protagonist.$local.y = startY + deltaY*p - Math.sin(p*Math.PI)*1;
    protagonist.$needGlobalUpdate = 1;
    gameState.sgCameraDelta = sgcX + sgcDeltaX*p;
    if (1 <= p) { break }
  }
  // 主人公キャラの差し替えを行う
  isOnLisper = 1;
  protagonist.$isInactive = 1;
  protagonist = lisperDot;
  protagonistDS = lisperDotDS;
  lisperDot.$children[0].$local.a = 1;
  protagonist.$needGlobalUpdate = 1;
  // lisperをクリックした時に、旗射出可能なら射出できるよう、handlerを設定する
  protagonist.$$pressFn = emitShoot;
  // すごい事がおこったという事を示す、すごいエフェクトを出す
  VA.P(SE.coin);
  await emitShiirareAsync(0, 0.5, 5, 2000);
  await waitMsecAsync(1000);
  // ゲーム演算再開
  isStopGameByDemo = 0;
  isSyncProtagonistYFromIMObj = 1;
  unlockInput('demo/obj2');
  // ボスが攻撃と移動を再開
  isStopBattle = 0;
  // indicatorの対応
  indicatorTarget = enemy;
  VA.BGM(BGM.bydlEx, 0, 1, 3);
};


const doOpenBoxDemoAsync = async (gl) => {
  let startMsec, waitMsec;
  const jumpFactor = 0.5;
  lockInput('demo/obj3');
  // 着地を待つと同時にこっそりsgCameraの調整を行う
  const startSgCameraDelta = gameState.sgCameraDelta;
  const endSgCameraDelta = 0.3;
  startMsec = getTotalElapsedMsec();
  waitMsec = 1200;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    gameState.sgCameraDelta = startSgCameraDelta + (endSgCameraDelta - startSgCameraDelta)*p;
    if (1 <= p) { break }
  }
  // 確実に着地を完了している事を保証する
  gameState.rotIMObj.pos[1] = 0;
  protagonist.$local.y = protagonistInitialY;
  protagonist.$needGlobalUpdate = 1;
  // この状態でゲームを停止させ、デモを実行する
  isStopGameByDemo = 1;
  isSyncProtagonistYFromIMObj = 0;
  // ジャンプ移動に必要なパラメータの記録
  const boxX = boxDot.$global.x;
  const boxY = boxDot.$global.y;
  const baseHatX = lisperDot.$global.x - 0.1;
  const baseHatY = lisperDot.$global.y - 0.3;
  // tinyelfがジャンプして、箱の横に着地。この為に
  // 今表示しているtinyelfを隠し、イベント用tinyelfを代わりに動かす
  lisperDot.$children[0].$isInactive = 1;
  const startTinyelfX = lisperDot.$children[0].$global.x;
  const startTinyelfY = lisperDot.$children[0].$global.y;
  const endTinyelfX = boxX - 0.2;
  const endTinyelfY = boxY;
  tinyelfDotForEvent.$local.scaleX = 0.5;
  tinyelfDotForEvent.$local.scaleY = 0.5;
  tinyelfDotForEvent.$local.x = startTinyelfX;
  tinyelfDotForEvent.$local.y = startTinyelfY;
  tinyelfDotForEvent.$isInactive = 0;
  tinyelfDotForEvent.$needGlobalUpdate = 1;
  VA.P(SE.puyojump);
  startMsec = getTotalElapsedMsec();
  waitMsec = 1500;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    tinyelfDotForEvent.$local.x = startTinyelfX + (endTinyelfX - startTinyelfX)*p;
    tinyelfDotForEvent.$local.y = startTinyelfY + (endTinyelfY - startTinyelfY)*p - Math.sin(p*Math.PI)*jumpFactor;
    tinyelfDotForEvent.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  await waitMsecAsync(1000);
  // 箱が開き、中の帽子が見える
  VA.P(SE.coin);
  emitParticleEmitter(gameEffectLayer, {
    x: boxX,
    y: boxY+0.1,
    ttlMsec: 500,
    maxRadius: 0.5,
  });
  await waitMsecAsync(500);
  boxDot.$isInactive = 1;
  hatDot.$local.x = boxX;
  hatDot.$local.y = boxY;
  hatDot.$isInactive = 0;
  hatDot.$needGlobalUpdate = 1;
  await waitMsecAsync(1000);
  // tinyelfと帽子、ジャンプして元の位置まで戻ってくる
  VA.P(SE.puyojump);
  startMsec = getTotalElapsedMsec();
  waitMsec = 1500;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    tinyelfDotForEvent.$local.x = startTinyelfX + (endTinyelfX - startTinyelfX)*invP;
    tinyelfDotForEvent.$local.y = startTinyelfY + (endTinyelfY - startTinyelfY)*invP - Math.sin(p*Math.PI)*jumpFactor;
    tinyelfDotForEvent.$needGlobalUpdate = 1;
    hatDot.$local.x = boxX + (baseHatX-boxX)*p;
    hatDot.$local.y = boxY + (baseHatY-boxY)*p - Math.sin(p*Math.PI)*jumpFactor;
    hatDot.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // 一時スプライトを元に戻す
  tinyelfDotForEvent.$isInactive = 1;
  lisperDot.$children[0].$isInactive = 0;
  hatDot.$isInactive = 1;
  hatDotInLisper.$isInactive = 0;
  await waitMsecAsync(500);
  // すごい事がおこったという事を示す、すごいエフェクトを出す
  VA.P(SE.lvup);
  await emitShiirareAsync(0, 0.5, 5, 2000);
  await waitMsecAsync(2000);
  // Lisperが飛んで去っていく処理
  VA.P(SE.unidentified);
  startMsec = getTotalElapsedMsec();
  waitMsec = 4000;
  const startX = protagonist.$local.x;
  const startY = protagonist.$local.y;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    protagonist.$local.x = startX + p*2;
    protagonist.$local.y = startY - p*4;
    protagonist.$needGlobalUpdate = 1;
    protagonistDS.$local.x = protagonist.$local.x;
    protagonistDS.$local.a = invP*0.4;
    protagonistDS.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // エンディングへと移行
  unlockInput('demo/obj3');
  transitFromGameToEnding(gl);
};


const doOpeningDemoAsync = async (gl) => {
  let startMsec = getTotalElapsedMsec();
  let waitMsec = 1000;
  let playerX = -gameState.rotIMObj.pos[0];
  // まず右の遠くに何か(白熱プレゼント箱)が落下
  gameState.boxX = playerX*objMoveFactor;
  let startX = gameState.boxX;
  let startY = protagonistInitialY - 2;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    gameState.boxX = startX + p*0.5;
    boxDot.$local.x = gameState.boxX - playerX * objMoveFactor;
    boxDot.$local.y = startY + p*2;
    boxDot.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  // 着地エフェクト発火
  // box色の再設定
  boxDot.$local.r = 1;
  boxDot.$local.g = 1;
  boxDot.$local.b = 1;
  boxDot.$needGlobalUpdate = 1;
  VA.P(SE.launch);
  await emitMeteoriteAsync(gl, boxDot.$local.x, boxDot.$local.y, 2);
  await waitMsecAsync(1000);
  // 左にスクロール
  let moveFactorX = 4;
  if (config.isUseCheat) { moveFactorX /= 5 }
  startMsec = getTotalElapsedMsec();
  waitMsec = 2000;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    gameState.moveFactorX = moveFactorX;
    // 床と壁を動かす
    playerX = -gameState.rotIMObj.pos[0];
    moveFloorsAndUpdateIMObj(playerX);
    // 床の動いた分だけ、箱も動かす
    boxDot.$local.x = gameState.boxX - playerX * objMoveFactor;
    boxDot.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  await waitMsecAsync(500);
  // 次に画面中央に(白熱主人公)が落下
  isSyncProtagonistYFromIMObj = 0;
  protagonist.$local.x = 0.5;
  protagonist.$local.y = protagonistInitialY - 2;
  protagonist.$local.r = 2;
  protagonist.$local.g = 2;
  protagonist.$local.b = 2;
  protagonist.$local.a = 1;
  protagonist.$needGlobalUpdate = 1;
  startX = protagonist.$local.x;
  startY = protagonist.$local.y;
  startMsec = getTotalElapsedMsec();
  waitMsec = 1000;
  while (1) {
    await waitMsecAsync(1);
    const now = getTotalElapsedMsec();
    const p = Math.min(1, (now - startMsec)/waitMsec);
    const invP = 1 - p;
    protagonist.$local.x = startX - p*0.5;
    protagonist.$local.y = startY + p*2;
    protagonist.$needGlobalUpdate = 1;
    if (1 <= p) { break }
  }
  protagonistDS.$local.y = protagonistInitialY;
  protagonistDS.$local.a = 0.7;
  protagonistDS.$needGlobalUpdate = 1;
  // 着地エフェクト発火
  VA.P(SE.launch);
  protagonist.$local.r = 1;
  protagonist.$local.g = 1;
  protagonist.$local.b = 1;
  protagonist.$needGlobalUpdate = 1;
  await emitMeteoriteAsync(gl, protagonist.$local.x, protagonist.$local.y, 2);
  await waitMsecAsync(1000);
  isSyncProtagonistYFromIMObj = 1;
  // 主人公、右を向く
  gameState.moveFactorX = -1;
  syncProtagonistDirection();
  gameState.moveFactorX = 0;
  // プレゼント箱のインジケーターを開始
  indicatorTarget = boxDot;
};


const transitFromTitleToGame = async (gl) => {
  lockInput('demo/opening');
  transitAsync((p) => {
    protagonist.$local.r = p;
    protagonist.$local.g = p;
    protagonist.$local.b = p;
    protagonist.$needGlobalUpdate = 1;
  }, 600);
  await transitScenes(gl, 'scene/title', 'scene/dummy-main-game', 600);
  gameState.mode = "game";
  await waitMsecAsync(500);
  await doOpeningDemoAsync(gl);
  unlockInput('demo/opening');
  VA.BGM(BGM.dd2, 0, 1, 0.5);
  //f5ui.openF5uiAsync(f5uiLayerDot);
  //f5ui.closeF5uiAsync(f5uiLayerDot);
  //updateStatusWindow();
  //openStatusWindowAsync();
};

const taDebug = {
  $isInactive: !config.displayDebugKey,
  $local: {
    w: 2,
    h: 2,
  },
  $texKey: config.displayDebugKey,
};

const titleSubTextDot = {
  $layout: {
    resetParentRectType: "aspect",
    resetOriginX: -1,
    resetOriginY: -1,
    anchorX: -1,
    anchorY: -1,
    isAutoGlobalW: 1,
  },
  $local: {
    x: 0.01,
    y: 0.01,
    w: 0,
    h: 0.1,
  },
  $texKey: undefined, // NB: $initFnで設定される
  $initFn: (gl, dot)=> {
    dot.$texKey = TEXKEY.texTextTitleSubText;
    dot.$needGlobalUpdate = 1;
  },
};

const makeArticleButtonLayer = () => ({
  $id: 'article-button-layer',
  $layout: {
    resetParentRectType: "aspect", // TODO: 本当はscreenにしたいが、そうする場合はoofよりも手前側に置く必要がある
    resetOriginX: -1,
    resetOriginY: -1,
  },
  $local: {},
  $children: [
    titleSubTextDot,
    makeButton({
      id: 'scratch/article-link-button',
      text: '24日目の記事を読みに行く',
      w: 1.0,
      h: 0.15,
      x: 0.6,
      y: 0.2,
      bgColor: config.defaultButtonBgColor,
      marginFallback: 0.01,
      taParams: { taKey: 'ta2', x: 512, y: 512+256 }, // ???x???
      releaseFn: (gl, dot)=> {
        VA.P(SE.submit);
        emitButtonEffect(dot, uiEffectLayer);
        openUrl(DICT.articleUrl);
      },
    }),
  ],
});

const titleScene = {
  $id: 'scene/title',
  $isInactive: 0,
  //$tickFn: (gl, dot)=> {
  //  tickConfetti(gl);
  //},
  $children: [
    titleVersionDot,
    //descriptionDot,
    titleLogo,
    taDebug,
    makeArticleButtonLayer(),
    makeButton({
      id: 'scratch/gameStartButton',
      text: '* START *',
      x: 0,
      y: 0.7,
      w: 0.8,
      h: 0.4,
      bgColor: config.defaultButtonBgColor,
      marginFallback: 0.1,
      taParams: { taKey: 'ta2', x: 1536, y: 512+256 }, // 287x81
      pressFn: (gl, dot)=> {
        resetGameData();
        VA.P(SE.submit);
        emitButtonEffect(dot, uiEffectLayer);
        //emitParticleEmitter(gameEffectLayer, {x: 0, y: 0});
        transitFromTitleToGame(gl);
      }}),
  ],
};


const endingScene = {
  $id: 'scene/ending',
  $isInactive: 1,
  $local: {},
  $children: [
    endingLogo,
    //{
    //  $layout: {
    //    resetParentRectType: "aspect", // TODO: 本当はscreenにしたいが、そうする場合はoofよりも手前側に置く必要がある
    //    resetOriginX: 1,
    //    resetOriginY: -1,
    //  },
    //  $local: {},
    //  $children: [
    //    makeButton({
    //      id: 'scratch/title-back-button',
    //      text: 'タイトルに戻る',
    //      w: 0.5,
    //      h: 0.1,
    //      x: -0.3,
    //      y: 0.1,
    //      bgColor: config.defaultButtonBgColor,
    //      marginFallback: 0.01,
    //      taParams: { taKey: 'ta2', x: 512, y: 512 }, // ???x???
    //      pressFn: (gl, dot)=> {
    //        VA.P(SE.submit);
    //        emitButtonEffect(dot, uiEffectLayer);
    //        transitFromEndingToTitle(gl);
    //      },
    //    }),
    //  ],
    //},
  ],
};


const statusWindowWidget = makeTextWidget({
  id: 'scratch/statusWindowWidget',
  anchorX: 1,
  anchorY: -1,
  x: -0.05,
  y: 0.05,
  w: 1.1,
  h: 0.3,
  texKey: 'scratch/window1',
  marginFallback: 0.03,
  marginLeft: 0.1,
  marginRight: 0.1,
  text: "DEBUG",
  initFn: (gl, dot)=> makeStatusWindowCanvasAndReturnTexKey(gl, 11),
  //textStyle: {},
  maxLines: 1,
  glTexIdx: 10,
});

const updateStatusWindow = () => {
  const p = gameState.player;
  const newText = `ENEMY : ${p.enemyHP??0}`;
  const isNeedDisplay = 1;
  changeWidgetText(statusWindowWidget, newText);
};

const subWindowsLayer = {
  $id: 'layer/sub-windows',
  $layout: {
    resetParentRectType: "screen",
    resetOriginX: 1,
    resetOriginY: -1,
    anchorX: 1,
    anchorY: -1,
  },
  $local: {
    x: 0,
    y: 0,
    a: 0,
    scaleX: 0.5,
    scaleY: 0.5,
  },
  $global: {},
  $children: [
    statusWindowWidget,
  ],
};
// TODO: subWindowsLayer内の各ウィンドウも、f5uiと同様の動きをさせたい。でもとりあえずaの制御だけから実装を進める。動きはあとで。

const makeIndicator = (posX, isLeft) => {
  return {
    $isInactive: 1,
    $layout: {},
    $local: {
      x: posX,
      y: 0,
      w: 0.5,
      h: 0.5,
    },
    $texKey: undefined, // NB: $initFnで設定される
    $initFn: (gl, dot)=> {
      const label = isLeft ? '←' : '→';
      dot.$texKey = isLeft ? TEXKEY.texTextIndicatorLeft : TEXKEY.texTextIndicatorRight;
      dot.$needGlobalUpdate = 1;
    },
    $tickFn: (gl, dot) => {
      dot.$local.a = (((getTotalElapsedMsec()/500)|0)%2) ? 1 : 0;
      dot.$needGlobalUpdate = 1;
    },
  };
};
const indicatorLeft = makeIndicator(-1.4, true);
const indicatorRight = makeIndicator(1.4, false);
const indicatorLayerDot = {
  $children: [indicatorLeft, indicatorRight],
};

const shiirareDot = {
  $isInactive: 1,
  $texKey: 'effect/shiirare',
  $layout: {
  },
  $local: {
    w: 1,
    h: 1,
    scaleX: 1,
    scaleY: 1,
  },
  $renderParams: {
    extraMatrix: mat4make(),
  },
  $tickFn: (gl, dot) => {
    const m = dot.$renderParams.extraMatrix;
    // 毎フレーム、ランダムな角度に回転させる
    mat4rotate(m, xorshift()*3, 0, 0, 1);
  },
};

export const rootDot = {
  $isDisplayDebug: config.isUseCheat,
  $root: {},
  $children: [
    dummyMainGameScene,
    mainGameScene,
    endingScene,
    titleScene,
    tinyelfDotForEvent,
    hatDot,
    shiirareDot,
    uiEffectLayer,
    (()=>{
      const oofDot = makeOofDot();
      //oofDot.$local.r = 0.75;
      //oofDot.$local.g = 0.75;
      //oofDot.$local.b = 0.75;
      if (config.isUseCheat) { oofDot.$local.a = 0.75 }
      return oofDot;
    })(),
    subWindowsLayer,
    indicatorLayerDot,
    //f5uiLayerDot,
    f5uiEffectLayer,
    //makeFpsDot(15),
  ],
};




