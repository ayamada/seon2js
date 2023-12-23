import {isLastPointerPressed, getLastPointerBrppnX, getLastPointerBrppnY, registerActionListener} from '../input/screen.mjs'
import {makeParticleDot, clearAllParticles, emitOneParticle, emitParticleEmitter} from '../dot/particle.mjs'
import {makeTextCanvas, makeTextCanvasAndRegisteredTexId, updateTextCanvas, updateTextCanvasAsync} from '../canvas/text.mjs'
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0, createTa, registerToTa, referTaEntry, reregisterToTa} from '../canvas/gl/texture.mjs'


// TODO: これbaseだけじゃなく全部入っている。buttonとかでも結局baseのパラメータを見る必要があるので一つのファイルにまとまっていた方が良いからだが、それならwidget.mjsとすべきでは？


// TODO: どのwidgetにどのmethodを適用できるか分からなくなるので、widgetのtypeを設定するようにして、各methodの先頭でtypeのチェックを行った方がよい。実行コストが落ちてもこれはやっとく価値がある。またこのtypeはclos型の継承ツリーに対応できる必要がある(実装は簡易的なものでいいが、とにかく継承を正しく判定できる必要がある)。これはjsのclassシステムでは駄目(トップレベル自体は素のobjectでないといけない為)。


// TODO: パラメータまとめを作る事


const defaultColor = Object.freeze({
  r: 1,
  g: 1,
  b: 1,
  a: 1,
});


const defaultTextStyle = Object.freeze({
  ctx2dProps: {
    fillStyle: "#FFF",
    strokeStyle: "#333",
    miterLimit: 1,
  },
  lineHeightRatio: 1.0,
  strokeWidthRatio: 0.2,
  //bgStyle: "#700",
  //trimCanvas: 1,
  marginRatioTop: 0.2,
});
const defaultButtonTextStyle = Object.freeze({
  ... defaultTextStyle,
  dropshadowStyle: "#003",
  dropshadowAdjustRatioX: -0.05,
  dropshadowAdjustRatioY: -0.05,
});


// 全てのwidgetは、このwidgetをベースにする。
// 具体的にはウィンドウ背面回り(bgDot)のサポートと、
// 枠領域を除いたコンテンツ領域のrect情報の提供。
// この中に、様々な種別に応じたウィンドウ要素を置ける。
export const makeBaseWidget = (params) => {
  // TODO: ninePatch的なウィンドウ描画への対応が必要なのだけど…
  let {id, texKey='embed/white2x2', anchorX=0, anchorY=0, x=0, y=0, w, h, marginFallback=0, marginLeft=undefined, marginTop=undefined, marginRight=undefined, marginBottom=undefined, initFn=undefined, bgColor=defaultColor, contentColor=defaultColor, fgColor=defaultColor, bgRenderParams=undefined} = params;
  marginLeft ??= marginFallback;
  marginRight ??= marginFallback;
  marginTop ??= marginFallback;
  marginBottom ??= marginFallback;
  const windowLeft = x - (anchorX+1)*w/2;
  const windowTop = y - (anchorY+1)*h/2;
  const contentW = w - marginLeft - marginRight;
  const contentH = h - marginTop - marginBottom;
  const contentLeft = windowLeft + marginLeft;
  const contentRight = contentLeft + contentW;
  const contentTop = windowTop + marginTop;
  const contentBottom = contentTop + contentH;
  const rect = {
    // NB: これらはlocal座標系
    window: {
      left: windowLeft,
      right: windowLeft + w,
      top: windowTop,
      bottom: windowTop + h,
      w: w,
      h: h,
    },
    // ここに収まるようコンテンツを入れる事になる
    content: {
      left: contentLeft,
      right: contentRight,
      top: contentTop,
      bottom: contentBottom,
      w: contentW,
      h: contentH,
    },
    // NB: これのみ単なるサイズ情報(単位はbrppnだが)
    marginLeft: marginLeft,
    marginRight: marginRight,
    marginTop: marginTop,
    marginBottom: marginBottom,
  };
  const bgDot = {
    $layout: {
      anchorX: anchorX,
      anchorY: anchorY,
    },
    $local: {
      x: 0,
      y: 0,
      w: w,
      h: h,
      r: bgColor.r,
      g: bgColor.g,
      b: bgColor.b,
      a: bgColor.a,
    },
    $texKey: texKey,
    $renderParams: bgRenderParams,
  };
  // anchor値の状態によらず、contentDotはbgDotの中央に位置する必要がある。
  // その為に、anchor値依存の位置補正を行う。
  const contentCenterX = (contentLeft + contentRight)/2;
  const contentCenterY = (contentTop + contentBottom)/2;
  const contentDeltaX = contentCenterX - x + anchorX * contentW / 2;
  const contentDeltaY = contentCenterY - y + anchorY * contentH / 2;
  const contentDot = {
    $layout: {
      anchorX: anchorX,
      anchorY: anchorY,
    },
    $local: {
      x: contentDeltaX,
      y: contentDeltaY,
      w: contentW,
      h: contentH,
      r: contentColor.r,
      g: contentColor.g,
      b: contentColor.b,
      a: contentColor.a,
    },
  };
  // 大昔のPCゲーみたいな枠テクスチャでコンテンツの一部を隠す場合に使う。
  // 座標系自体はbgDotと同じ扱いになる(大体のパラメータが同じになる)
  const fgDot = {
    $layout: {
      anchorX: anchorX,
      anchorY: anchorY,
    },
    $local: {
      x: 0,
      y: 0,
      w: w,
      h: h,
      r: fgColor.r,
      g: fgColor.g,
      b: fgColor.b,
      a: fgColor.a,
    },
  };
  return {
    params: params,
    rect: rect,
    //
    $id: id,
    $layout: {
    },
    $local: {
      x: x,
      y: y,
    },
    $initFn: initFn,
    // const widget = findDotById(rootDot, id);
    // widget.$children[0] => bgDot
    // widget.$children[1] => contentDot
    // widget.$children[2] => fgDot
    $children: [bgDot, contentDot, fgDot]};
};


export const changeWidgetBgColor = (widget, newColor) => {
  const dot = widget.$children[0];
  if (newColor.r != null) { dot.$local.r = newColor.r }
  if (newColor.g != null) { dot.$local.g = newColor.g }
  if (newColor.b != null) { dot.$local.b = newColor.b }
  if (newColor.a != null) { dot.$local.a = newColor.a }
  dot.$needGlobalUpdate = 1;
};

export const changeWidgetContentColor = (widget, newColor) => {
  const dot = widget.$children[0];
  if (newColor.r != null) { dot.$local.r = newColor.r }
  if (newColor.g != null) { dot.$local.g = newColor.g }
  if (newColor.b != null) { dot.$local.b = newColor.b }
  if (newColor.a != null) { dot.$local.a = newColor.a }
  dot.$needGlobalUpdate = 1;
};

export const changeWidgetFgColor = (widget, newColor) => {
  const dot = widget.$children[0];
  if (newColor.r != null) { dot.$local.r = newColor.r }
  if (newColor.g != null) { dot.$local.g = newColor.g }
  if (newColor.b != null) { dot.$local.b = newColor.b }
  if (newColor.a != null) { dot.$local.a = newColor.a }
  dot.$needGlobalUpdate = 1;
};


const isPureObject = (o) => (o?.constructor === Object);

const deepMergeObject = (m1, m2) => {
  const result = { ... m1 };
  Object.keys(m2).forEach((k) => (result[k] = (isPureObject(m1[k]) && isPureObject(m2[k])) ? deepMergeObject(m1[k], m2[k]) : m2[k]));
  return result;
};


// textの行数がmaxLinesより多いなら削り、少ないなら足す
const clampTextLines = (text, maxLines) => {
  let lines = text.split("\n");
  while (lines.length < maxLines) { lines.push("") } // 足す
  if (maxLines < lines.length) { lines.length = maxLines } // 削る
  lines = lines.map((line)=>((line==="") ? "　" : line)); // 空行を埋める
  return lines.join("\n");
};


const applyGlForText = (gl, widget) => {
  const taParams = widget.taParams;
  const contentDot = widget.$children[1];
  const labelId = contentDot.$texKey;
  if (taParams) {
    if (referTaEntry(gl, labelId)) {
      reregisterToTa(gl, labelId);
    } else {
      registerToTa(gl, taParams.taKey, labelId, taParams.x, taParams.y);
    }
  }
  const glTexIdx = widget.glTexIdx;
  if (glTexIdx) { assignAndUploadGlTex(gl, labelId, glTexIdx) }
};

// 内部に複数行のテキストを表示させられるwidget。
// makeBaseWidgetがベース。
export const makeTextWidget = (params) => {
  let {text="", textStyle={}, maxLines=1, taParams=undefined, glTexIdx=undefined} = params;
  textStyle = deepMergeObject(textStyle, defaultTextStyle);
  text = clampTextLines(text, maxLines);
  const widget = makeBaseWidget(params);
  widget.maxLines = maxLines;
  widget.taParams = taParams;
  widget.glTexIdx = glTexIdx;
  const contentDot = widget.$children[1];
  const contentRect = widget.rect.content;
  contentDot.$initFn = (gl, dot) => {
    const labelId = makeTextCanvasAndRegisteredTexId(gl, textStyle, text);
    const c = referTex(gl, labelId);
    dot.textCanvas = c;
    dot.$texKey = labelId;
    dot.$local.h = contentRect.h;
    dot.$local.w = Math.min(contentRect.w, (contentRect.h * c.width / c.height));
    dot.$needGlobalUpdate = 1;
    applyGlForText(gl, widget);
  };
  return widget;
};


const changeWidgetTextInternal2 = (gl, widget, contentRect, newText) => {
  const contentDot = widget.$children[1];
  const c = contentDot.textCanvas;
  updateTextCanvas(c, newText);
  contentDot.$local.w = Math.min(contentRect.w, (contentRect.h * c.width / c.height));
  contentDot.$needGlobalUpdate = 1;
  applyGlForText(gl, widget);
};


const changeWidgetTextInternal = (widget, newText) => {
  const contentDot = widget.$children[1];
  const contentRect = widget.rect.content;
  if (contentDot.$initFn) {
    const f = contentDot.$initFn;
    contentDot.$initFn = (gl, dot) => {
      f(gl, dot);
      changeWidgetTextInternal2(gl, widget, contentRect, newText);
    };
  } else {
    contentDot.$initFn = (gl, dot) => changeWidgetTextInternal2(gl, widget, contentRect, newText);
  }
};


export const changeWidgetText = (widget, newText) => {
  const maxLines = widget.maxLines;
  changeWidgetTextInternal(widget, clampTextLines(newText, maxLines));
};


// 文字色変更用
export const changeWidgetTextStyle = (widget, newTextStyle) => {
  throw new Error('NIY'); // TODO
};


// 押しボタンのあるwidget。
// makeTextWidgetがベース。
// これはinputに依存しているので注意
export const makeButtonWidget = (params) => {
  // TODO: もっと多用な押し判定を設定できるようにする事
  // TODO: 押しボタンのtext向けのデフォルトのレンダリング設定をfallback追加したい(textWidgetのデフォルトオプションではなく)
  let {textStyle={}, pressFn, releaseFn} = params;
  const newParams = {
    ... params,
    textStyle: deepMergeObject(textStyle, defaultButtonTextStyle),
  };
  const widget = makeTextWidget(newParams);
  const bgDot = widget.$children[0];
  if (pressFn) {
    bgDot.$$pressFn = (gl, dot) => pressFn(gl, widget);
  }
  if (releaseFn) {
    bgDot.$$releaseFn = (gl, dot) => releaseFn(gl, widget);
  }
  return widget;
};


// 後述のsubmitFnからアクセスする用
let isPassing, lastActionX, lastActionY;
export const getLastActionX = () => lastActionX;
export const getLastActionY = () => lastActionY;
export const restorePropagation = () => (isPassing = 1);


// TODO: 旧bankerシリーズのボタンのように「矩形内で押して離した」時にだけ反応するタイプも作りたいが…
const emitPress = (gl, dot, x, y, isPressed) => {
  if (dot.$isInactive) { return 0 }

  // このチェックは子が優先、かつ同じレベルでは末尾の方が優先
  // (描画優先度と同じに合わせる必要がある)
  // (なおdepth有効時だと逆順にする必要があるが、これはもう諦める…)
  if (dot.$children) {
    for (let i = dot.$children.length-1; 0 <= i; i--) {
      const child = dot.$children[i];
      if (emitPress(gl, child, x, y, isPressed)) { return 1 }
    }
  }
  const anchorX = dot.$layout.anchorX;
  const anchorY = dot.$layout.anchorY;
  const w = Math.abs(dot.$global.w);
  const h = Math.abs(dot.$global.h);
  const left = dot.$global.x - (anchorX+1)*w/2;
  const top = dot.$global.y - (anchorY+1)*h/2;
  const right = left + w;
  const bottom = top + h;
  const handle = isPressed ? dot.$$pressFn : dot.$$releaseFn;
  if (handle && !dot.$isInactive && (left <= x) && (x <= right) && (top <= y) && (y <= bottom)) {
    lastActionX = x;
    lastActionY = y;
    isPassing = 0;
    handle(gl, dot);
    return !isPassing;
  }
  return 0;
};
export const registerButtonListeners = (gl, rootDot) => {
  const canvas = gl.canvas;
  registerActionListener(canvas, 0, 0, ()=> emitPress(gl, rootDot, getLastPointerBrppnX(), getLastPointerBrppnY(), true));
  registerActionListener(canvas, 0, 1, ()=> emitPress(gl, rootDot, getLastPointerBrppnX(), getLastPointerBrppnY(), false));
};


// TODO: なるべくemitButtonEffectToSelfと共通にしたい
const emitButtonEffectToEffectLayer = (widget, effectLayer) => {
  const bgDot = widget.$children[0];
  const anchorX = bgDot.$layout.anchorX;
  const anchorY = bgDot.$layout.anchorY;
  const x = bgDot.$global.x;
  const y = bgDot.$global.y;
  const w = Math.abs(bgDot.$global.w);
  const h = Math.abs(bgDot.$global.h);
  const left = w * -0.5 * (1 + anchorX);
  const right = w * 0.5 * (1 - anchorX);
  const top = h * -0.5 * (1 + anchorY);
  const bottom = h * 0.5 * (1 - anchorY);
  const params = {
    startX: x,
    deltaX: 0,
    startY: y,
    deltaY: 0,
    startAlpha: 1,
    deltaAlpha: -1,
    //size: size, // unused
    //startMsec: null, // set by emitOneParticle
    ttlMsec: 400, // TODO: 要調整
    color: {r:1,g:1,b:1,a:1},
    v0x: left,
    v0y: top,
    v1x: left,
    v1y: bottom,
    v2x: right,
    v2y: top,
    v3x: right,
    v3y: bottom,
    //doneFn: doneFn,
    startScale: 1,
    deltaScale: 0.2,
  };
  emitOneParticle(effectLayer, params);
};

// TODO: なるべくemitButtonEffectToEffectLayerと共通にしたい
const emitButtonEffectToSelf = (widget) => {
  const bgDot = widget.$children[0];
  const selfParticleLayer = makeParticleDot();
  selfParticleLayer.$layout = {}; // makeParticleDotが自動で行うレイアウトリセット設定を取り消す
  widget.$children.push(selfParticleLayer);
  const doneFn = ()=>{
    const idx = widget.$children.indexOf(selfParticleLayer);
    if (idx != -1) { widget.$children.splice(idx, 1) }
  };
  const anchorX = bgDot.$layout.anchorX;
  const anchorY = bgDot.$layout.anchorY;
  const x = bgDot.$global.x;
  const y = bgDot.$global.y;
  const w = Math.abs(bgDot.$global.w);
  const h = Math.abs(bgDot.$global.h);
  const left = w * -0.5 * (1 + anchorX);
  const right = w * 0.5 * (1 - anchorX);
  const top = h * -0.5 * (1 + anchorY);
  const bottom = h * 0.5 * (1 - anchorY);
  // diffX, diffY は、基本0だけど、このbgDotのanchorがボタン中心でない場合はその分だけずらす必要がある
  const diffX = anchorX * w / 2;
  const diffY = anchorY * h / 2;
  const params = {
    startX: diffX,
    deltaX: 0,
    startY: diffY,
    deltaY: 0,
    startAlpha: 1,
    deltaAlpha: -1,
    //size: size, // unused
    //startMsec: null, // set by emitOneParticle
    ttlMsec: 400, // TODO: 要調整
    color: {r:1,g:1,b:1,a:1},
    v0x: left,
    v0y: top,
    v1x: left,
    v1y: bottom,
    v2x: right,
    v2y: top,
    v3x: right,
    v3y: bottom,
    doneFn: doneFn,
    startScale: 1,
    deltaScale: 0.2,
  };
  emitOneParticle(selfParticleLayer, params);
};

// NB: なるべくeffectLayerを指定した方がよい(effectLayerなしだとGC源になる)
export const emitButtonEffect = (widget, effectLayer=undefined) => effectLayer ? emitButtonEffectToEffectLayer(widget, effectLayer) : emitButtonEffectToSelf(widget);


