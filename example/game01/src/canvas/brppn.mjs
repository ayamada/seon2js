// TODO: stableになったら、このモジュール単体でnpm登録する事を検討


// TODO: lrtb系の名前をlrtbwhにrenameする事を検討(結局wとhも提供する事にしたので)。またkey名を`left`とかではなく`l`と1文字にする事も検討(wとhが1文字なので)


// TODO: このモジュールのより適切な名前を考え直す。現状だと「標準の原点位置は画面中央」というニュアンスが含まれてないので。
//       - ...
//       - ...
//       - ...


// brppnとは Bottom-Rigth-Plus-Plus-Normalizedの略で、
// 原点が画面中央かつ右下方向が＋＋の、正規化された座標系の事。
// (原点位置についてはずらす事が可能だが、標準位置は画面中央)
//
// ブラウザスクリーン内から取れる、指定されたアスペクト比の最も大きい矩形を
// 正規化の為の基準とする(縦か横の小さい方の長さを2として正規化する)。
// この矩形を「aspectRect(もしくは単にaspect)」と呼ぶ。
// これより、この座標系での長さ単位もbrppnと呼ばれる。
// (前述の通り、基準矩形の短辺は常に2brppnの長さになる)
//
// この領域の実サイズはブラウザ依存であるが故に、ブラウザリサイズ時の
// 自動追随機能もここに含まれる(ただし呼び出しは自動化されていないので注意)。
//
// canvasをブラウザスクリーン最大化する際に、境界部が微妙に100%にならない問題が
// あり、これを回避する為に実ブラウザサイズより少し多く余白をcanvas側に取る
// 機能がついている。描画の際にはこの余白も考慮した方がよい。
// (なおこの余白領域は手動によるブラウザリサイズの際に少し見える事がある。
// そこをきちんと描画するかどうかは用途により判断する事になるが、
// 原点位置をずらす運用をする場合は結局全部きちんと描画するしかない事になる)
//
// ブラウザスクリーンのアスペクト比はまず指定されたアスペクト比と一致しない。
// なので左右もしくは上下に余白を作る形になる。
// この際の左と右(もしくは上と下)の比率をパラメータ指定できる。
// (なお前述のスクリーン外余白もあるが、これについては上記計算には含まれない)
//
// 上記のように「実canvas矩形」「ブラウザスクリーンから見えている領域」
// 「正規化基準矩形」の三種の矩形があり、また、このそれぞれについて
// 「実ピクセル数基準(左上原点)」「brppn座標系」の二種の座標系の表現がある。
// このモジュールは、これらの情報へのアクセサも提供する。


const calculateAspectShortSidePx = (preferredAspectRatio, screenAspectRatio, newScreenPxW, newScreenPxH) => (
  (1 < preferredAspectRatio) ? (
    (preferredAspectRatio < screenAspectRatio) ? newScreenPxH : (newScreenPxH * screenAspectRatio / preferredAspectRatio)
  ) : (
    (preferredAspectRatio < screenAspectRatio) ? (newScreenPxW * preferredAspectRatio / screenAspectRatio) : newScreenPxW
  )
);


const tallyOrOne = (arr) => (arr.reduce((a,b) => (a + b), 0) || 1);


// NB: 毎フレーム(もしくはresizeイベント受信毎に)この関数を呼ぶ事
export const update = (canvas, isForce=undefined) => {
  // 古い情報の取得
  const brppnState = canvas.brppnState;
  const oldScreenPxW = brppnState.lastScreenPxW;
  const oldScreenPxH = brppnState.lastScreenPxH;

  // 現在のブラウザスクリーン情報の取得
  const viewport = window.visualViewport;
  // TODO: ここに問題あり！「ブラウザのズーム」だとdevicePixelRatioが変動するがviewport.scaleは変動しない。「ジェスチャのピンチズーム」だとdevicePixelRatioは変動しないがviewport.scaleは変動する。超困る。とりあえずジェスチャ全禁止してdevicePixelRatioだけ見る方向で回避しているが、将来的にはもうちょっと考える必要がある
  const dpr = self.devicePixelRatio;
  const newScreenPxW = Math.round(viewport.width * dpr);
  const newScreenPxH = Math.round(viewport.height * dpr);

  // 前回測定時から変動がないなら再計算しない
  if ((oldScreenPxW === newScreenPxW) && (oldScreenPxH === newScreenPxH) && !isForce) { return canvas }

  // 必要な情報を更に取得
  const oldCanvasPxW = canvas.width;
  const oldCanvasPxH = canvas.height;
  const preferredAspectRatio = brppnState.preferredAspectRatio;
  const offScreenMarginPx = brppnState.offScreenMarginPx;

  // TODO: ここにmaxResolution/minResolution系のパラメータを考慮できる必要がある！案外難しいので後回し…
  const newCanvasPxW = Math.max(1, newScreenPxW + offScreenMarginPx*2);
  const newCanvasPxH = Math.max(1, newScreenPxH + offScreenMarginPx*2);

  const screenAspectRatio = newScreenPxW / newScreenPxH;
  const aspectShortSidePx = calculateAspectShortSidePx(preferredAspectRatio, screenAspectRatio, newScreenPxW, newScreenPxH);

  brppnState.lastAspectShortSidePx = aspectShortSidePx;
  brppnState.lastScreenPxW = newScreenPxW;
  brppnState.lastScreenPxH = newScreenPxH;
  // GL座標系はアスペクト比を無視して、canvasのwとhを常に2として扱う。ので、
  // brppnからGLへの変換用の値は、以下の計算になる。
  const glRatioX = aspectShortSidePx / newCanvasPxW;
  const glRatioY = -1 * aspectShortSidePx / newCanvasPxH;
  brppnState.lastGlRatioX = glRatioX;
  brppnState.lastGlRatioY = glRatioY;
  const isHorizontallyLong = (1 < preferredAspectRatio);

  // brppn座標系での長さを算出
  const aspectBrppnW = isHorizontallyLong ? (2*preferredAspectRatio) : 2;
  const aspectBrppnH = isHorizontallyLong ? 2 : (2/preferredAspectRatio);
  const screenBrppnW = 2 * newScreenPxW / aspectShortSidePx;
  const screenBrppnH = 2 * newScreenPxH / aspectShortSidePx;
  const canvasBrppnW = 2 * newCanvasPxW / aspectShortSidePx;
  const canvasBrppnH = 2 * newCanvasPxH / aspectShortSidePx;
  const denominatorW = tallyOrOne(brppnState.ooaRatioLR);
  const denominatorH = tallyOrOne(brppnState.ooaRatioTB);
  const ooaBrppnW = screenBrppnW - aspectBrppnW;
  const ooaBrppnH = screenBrppnH - aspectBrppnH;
  const ooaBrppnLeftW = ooaBrppnW * brppnState.ooaRatioLR[0] / denominatorW;
  const ooaBrppnRightW = ooaBrppnW * brppnState.ooaRatioLR[1] / denominatorW;
  const ooaBrppnTopH = ooaBrppnH * brppnState.ooaRatioTB[0] / denominatorH;
  const ooaBrppnBottomH = ooaBrppnH * brppnState.ooaRatioTB[1] / denominatorH;
  const aspectPxW = aspectBrppnW * aspectShortSidePx / 2;
  const aspectPxH = aspectBrppnH * aspectShortSidePx / 2;
  const aspectPxLeft = offScreenMarginPx + (ooaBrppnLeftW * aspectShortSidePx / 2);
  const aspectPxTop = offScreenMarginPx + (ooaBrppnTopH * aspectShortSidePx / 2);
  const glAdjustBrppnX = (ooaBrppnLeftW - ooaBrppnRightW) / 2;
  const glAdjustBrppnY = (ooaBrppnTopH - ooaBrppnBottomH) / 2;
  const aspectBrppnLeft = aspectBrppnW / -2;
  const aspectBrppnRight = aspectBrppnW / 2;
  const aspectBrppnTop = aspectBrppnH / -2;
  const aspectBrppnBottom = aspectBrppnH / 2;
  const canvasBrppnLeft = canvasBrppnW / -2 - glAdjustBrppnX;
  const canvasBrppnRight = canvasBrppnW / 2 - glAdjustBrppnX;
  const canvasBrppnTop = canvasBrppnH / -2 - glAdjustBrppnY;
  const canvasBrppnBottom = canvasBrppnH / 2 - glAdjustBrppnY;
  const screenBrppnLeft = screenBrppnW / -2 - glAdjustBrppnX;
  const screenBrppnRight = screenBrppnW / 2 - glAdjustBrppnX;
  const screenBrppnTop = screenBrppnH / -2 - glAdjustBrppnY;
  const screenBrppnBottom = screenBrppnH / 2 - glAdjustBrppnY;
  brppnState.lastGlAdjustBrppnX = glAdjustBrppnX;
  brppnState.lastGlAdjustBrppnY = glAdjustBrppnY;
  brppnState.canvasBrppnLRTB = {
    left: canvasBrppnLeft,
    right: canvasBrppnRight,
    top: canvasBrppnTop,
    bottom: canvasBrppnBottom,
    w: canvasBrppnW,
    h: canvasBrppnH,
  };
  brppnState.screenBrppnLRTB = {
    left: screenBrppnLeft,
    right: screenBrppnRight,
    top: screenBrppnTop,
    bottom: screenBrppnBottom,
    w: screenBrppnW,
    h: screenBrppnH,
  };
  brppnState.aspectBrppnLRTB = {
    left: aspectBrppnLeft,
    right: aspectBrppnRight,
    top: aspectBrppnTop,
    bottom: aspectBrppnBottom,
    w: aspectBrppnW,
    h: aspectBrppnH,
  };
  brppnState.canvasPxXYWH = {x: 0, y: 0, w: newCanvasPxW, h: newCanvasPxH};
  brppnState.screenPxXYWH = {x: offScreenMarginPx, y: offScreenMarginPx, w: newScreenPxW, h: newScreenPxH};
  brppnState.aspectPxXYWH = {x: aspectPxLeft, y: aspectPxTop, w: aspectPxW, h: aspectPxH};

  // 最後に、canvasに新しいサイズを適用する
  if (oldCanvasPxW !== newCanvasPxW) {
    canvas.width = newCanvasPxW;
    // TODO: ↓をMath.roundすべきかはかなり悩ましい
    canvas.style.width = Math.round(newCanvasPxW/dpr) + 'px';
  }
  if (oldCanvasPxH !== newCanvasPxH) {
    canvas.height = newCanvasPxH;
    // TODO: ↓をMath.roundすべきかはかなり悩ましい
    canvas.style.height = Math.round(newCanvasPxH/dpr) + 'px';
  }
  return canvas;
};


// TODO: 引数多い。canvas以外はobjectにまとめた方がよいのでは？
export const makeUpCanvas = (canvas=undefined, preferredAspectRatio=1, offScreenMarginPx=16, ooaRatioLR=[1,1], ooaRatioTB=[1,1]) => {
  if (!canvas) { canvas = document.createElement('canvas') }
  if (canvas.brppnState) { return canvas } // 初期化済なら何もしない

  // スクリーン中央に配置
  const s = canvas.style;
  s.display = 'inline-block';
  s.margin = 0;
  s.padding = 0;
  s.overflow = 'hidden';
  s.touchAction = 'none';
  s.userSelect = 'none';
  s.WebkitUserSelect = 'none';
  s.position = 'absolute';
  s.top = '50%';
  s.left = '50%';
  s.transform = 'translate(-50%,-50%)';
  s.zIndex = 20; // NB: この値に不満があるならmakeUpCanvas実行後に再設定する事
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.body.appendChild(canvas);

  // インスタンスパラメータを設定
  canvas.brppnState = {
    preferredAspectRatio: preferredAspectRatio,
    offScreenMarginPx: offScreenMarginPx,
    ooaRatioLR: ooaRatioLR,
    ooaRatioTB: ooaRatioTB,
    // TODO: 以下のパラメータを引数から設定できるようにする。まず引数変数名を決めましょう
    // - ...
    // - ...
    //maxResolutionX: undefined,
    //maxResolutionY: undefined,
    //minResolutionX: undefined,
    //minResolutionY: undefined,
    // 以下はこの後のupdateですぐ再設定される
    //lastAspectShortSidePx: 100,
    //lastScreenPxW: 2,
    //lastScreenPxH: 2,
    //lastGlRatioX: 1,
    //lastGlRatioY: -1,
    //lastGlAdjustBrppnX: 0,
    //lastGlAdjustBrppnY: 0,
  };

  // ブラウザサイズを初回適用
  return update(canvas, 1);
};


// アクセサを提供
export const getAspectRatio = (canvas) => canvas.brppnState.preferredAspectRatio;
// 原点に関わらない、px単位の情報
export const getOffScreenMarginPx = (canvas) => canvas.brppnState.offScreenMarginPx;
export const getLastBrppnShortSidePx = (canvas) => canvas.brppnState.lastAspectShortSidePx;
export const getLastScreenPxW = (canvas) => canvas.brppnState.lastScreenPxW;
export const getLastScreenPxH = (canvas) => canvas.brppnState.lastScreenPxH;
// canvas左上原点px座標系での矩形三種の値を得る
export const getAspectPxXYWH = (canvas) => canvas.brppnState.aspectPxXYWH;
export const getScreenPxXYWH = (canvas) => canvas.brppnState.screenPxXYWH;
export const getCanvasPxXYWH = (canvas) => canvas.brppnState.canvasPxXYWH;
// brppn座標系での矩形三種の値を得る
export const getAspectBrppnLRTB = (canvas) => canvas.brppnState.aspectBrppnLRTB;
export const getScreenBrppnLRTB = (canvas) => canvas.brppnState.screenBrppnLRTB;
export const getCanvasBrppnLRTB = (canvas) => canvas.brppnState.canvasBrppnLRTB;
// brppn座標系→GL座標系にする(基本使わない。ほぼリファレンス用コード)
export const brppnX2glX = (canvas, brppnX) => canvas.brppnState.lastGlRatioX * (brppnX + canvas.brppnState.lastGlAdjustBrppnX);
export const brppnY2glY = (canvas, brppnY) => canvas.brppnState.lastGlRatioY * (brppnY + canvas.brppnState.lastGlAdjustBrppnY);
// glsl側で上記変換を行う為のパラメータ提供
export const getLastGlRatioX = (canvas) => canvas.brppnState.lastGlRatioX;
export const getLastGlAdjustBrppnX = (canvas) => canvas.brppnState.lastGlAdjustBrppnX;
export const getLastGlRatioY = (canvas) => canvas.brppnState.lastGlRatioY;
export const getLastGlAdjustBrppnY = (canvas) => canvas.brppnState.lastGlAdjustBrppnY;
// dpr未適用のscreen座標からbrppn座標を算出(ポインティングデバイス用)
export const rawScreenX2brppnX = (canvas, rawX) => (rawX*self.devicePixelRatio + canvas.brppnState.offScreenMarginPx - canvas.brppnState.aspectPxXYWH.x - canvas.brppnState.aspectPxXYWH.w/2) / canvas.brppnState.lastAspectShortSidePx * 2;
export const rawScreenY2brppnY = (canvas, rawY) => (rawY*self.devicePixelRatio + canvas.brppnState.offScreenMarginPx - canvas.brppnState.aspectPxXYWH.y - canvas.brppnState.aspectPxXYWH.h/2) / canvas.brppnState.lastAspectShortSidePx * 2;
