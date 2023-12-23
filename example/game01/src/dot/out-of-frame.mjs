import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from '../canvas/brppn.mjs'


// TODO: 今はglFnSpriteとembed/white2x2を使っているが、ここはテクスチャなしのglslに軽量化したい
// TODO: できればちょっとしたglslベースの繰り返し模様をつけれるようにしたい
// TODO: イース的な枠表示(しかし、動的に枠幅を安定させるのはとても困難)


const tickOof = (gl, dot) => {
  // coverLeft coverTop は左上原点、coverRight coverBottom は右下原点
  const [coverLeft, coverTop, coverRight, coverBottom] = dot.$children;
  const canvas = gl.canvas;
  if (dot.prevCanvasW !== canvas.width || dot.prevCanvasH !== canvas.height) {
    dot.prevCanvasW = canvas.width;
    dot.prevCanvasH = canvas.height;
    const canvasRect = getCanvasBrppnLRTB(canvas);
    const aspectRect = getAspectBrppnLRTB(canvas);
    const sizeLeft = aspectRect.left - canvasRect.left;
    const sizeTop = aspectRect.top - canvasRect.top;
    const sizeRight = canvasRect.right - aspectRect.right;
    const sizeBottom = canvasRect.bottom - aspectRect.bottom;
    dot.$needGlobalUpdate = 1;
    coverLeft.$local.w = sizeLeft;
    coverLeft.$local.h = canvasRect.h;
    coverRight.$local.w = sizeRight;
    coverRight.$local.h = canvasRect.h;
    const topBottomW = canvasRect.w - sizeLeft - sizeRight;
    coverTop.$local.x = sizeLeft;
    coverTop.$local.w = topBottomW;
    coverTop.$local.h = sizeTop;
    coverBottom.$local.x = 0 - sizeRight;
    coverBottom.$local.w = topBottomW;
    coverBottom.$local.h = sizeBottom;
  }
};


const makeCover = (parentRectType, anchorValueX, anchorValueY) => ({
  $layout: {
    resetParentRectType: parentRectType,
    resetOriginX: anchorValueX,
    resetOriginY: anchorValueY,
    anchorX: anchorValueX,
    anchorY: anchorValueY,
  },
  $local: {
    x: 0,
    y: 0,
  },
  $global: {},
  $texKey: 'embed/white2x2',
  $renderParams: {z: -0.9},
});


export const makeOofDot = () => ({
  //prevCanvasW: 0,
  //prevCanvasH: 0,
  //
  $local: {
    // 色は好きに変更してよい
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  },
  $tickFn: tickOof,
  $children: [
    makeCover("canvas", -1, -1),
    makeCover("canvas", -1, -1),
    makeCover("canvas", 1, 1),
    makeCover("canvas", 1, 1),
  ],
});

