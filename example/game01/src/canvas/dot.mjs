import {xorshift} from '../math/xorshift.mjs'
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0, executeUploadReservedTextures} from './gl/texture.mjs'
import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from './brppn.mjs'
import {isDev} from '../is-dev.mjs'
import {renderSprite} from '../glfn/sprite.mjs'
import {renderWireFrame} from '../glfn/wire-frame.mjs'


// TODO: rectのxとyが、leftとtop固定なのか、anchor点なのか、すぐに分からない問題がある。すぐ分かるようにした方がよい。
//       これ本質的にはxywhの問題では？leftとtopという名前なら明確だが、anchor点を示す名前をxとyではない名前にするのが本質的な解決なのでは？そうだとするなら、新しい名前は何がよい？
//       - anchorX, anchorY - これはない。これは既にlayoutの方で割合値として使っている為
//       - originX, originY - これもない。親座標系の原点と紛らわしい
//       - ...
//       - ...
//       - ...
//       - ...


// TODO: 結局、alphaを扱いたければglDepthはほぼ使えない(もしくはunityレベルで描画順をきちんと制御するか)なので、isUseGlDepthTest有効関連の処理は廃止する事。
//       - ただ、zをどうするかは悩ましい。pixiみたいにchildrenのz-sortをできるようにしたさはあるので。ただglにzを渡す必要性はほぼなくなった…(一応カメラ外を描画させない為に指定する可能性はある)。ここはもうちょい考える事。
//       - renderDotの逆順処理を残すかも悩ましいが、ここは一旦順序固定に戻す。なぜならここの順序をきちんとやりたければunityレベルの描画順制御が必要で、順序を逆にする程度では全然駄目なので。それならもう消しておいた方がいい。



// DOT(Display-Object-Tree) レイアウトエンジン


// dot(display-object-tree) は、以下のような構造を持つ、素のobject
// {
//   $id: "任意の文字列", // findDotById()用のキー名。高速検索できる
//   $layout: {
//     // 親の色を引き継がずにリセットする場合の値
//     resetColors: [1, 1, 1, 1],
//     // 親のZを引き継がずにリセットする場合の値
//     resetZ: 0,
//     // 変動する画面端を楽に指定できるよう、「座標系の原点」を設定する
//     // "inherit" "canvas" "screen" "aspect" を指定
//     // "inherit" なら親dotの座標系をそのまま引き継ぐが、
//     // それ以外なら対応する基準矩形から座標系を再設定し直す
//     // (親dotの座標系は無視される)
//     // トップレベルで何も指定しなければ "aspect" 相当になる
//     resetParentRectType: "inherit", // 省略時は "inherit" 扱い
//     // 基準矩形の左端なら-1、中心なら0、右端なら1を指定
//     resetOriginX: -1, // 省略時は0扱い
//     // 基準矩形の上端なら-1、中心なら0、下端なら1を指定
//     resetOriginY: 1, // 省略時は0扱い
//     // 自身のrectがwとhを持つ時、自身のxとyに対して
//     // どのように「端寄せ」するかを指定する。0だとrect中心が基準。
//     // またレンダリング対象が回転処理等をする際のpivotの役割も兼ねている
//     anchorX: 0, // 省略時は0。pixiとは違い-1～1が基準
//     anchorY: 0, // 省略時は0。pixiとは違い-1～1が基準
//     // 以下は$texKeyのアスペクト比に基き$global.wや$global.hを算出する。
//     // 同時に両方を真値にしても意味がない。
//     // ※テクスチャを参照する性質上、テクスチャロード済が必須！
//     //   ロード前はアスペクト比1で計算されるので、必要であれば
//     //   テクスチャロード完了後は再計算させる事。
//     isAutoGlobalW: false, // 真値にすると$local.wを無視し、hからwを算出する
//     isAutoGlobalH: false, // 真値にすると$local.hを無視し、wからhを算出する
//   },
//   $local: {
//     x: -0.9, // 省略時は0
//     y: -0.9, // 省略時は0
//     w: null, // 省略時は0。このdot自身の横幅(子要素は考慮しない)
//     h: null, // 省略時は0。このdot自身の縦幅(子要素は考慮しない)
//     scaleX: 1, // 省略時は1
//     scaleY: 1, // 省略時は1
//     r: 1, // 省略時は1
//     g: 1, // 省略時は1
//     b: 1, // 省略時は1
//     a: 1, // 省略時は1
//     z: 0, // 省略時はbaseStep*childrenIdxベースのランダム値
//     // zは-1～1外を指定すると描画されなくなる。zの実値は加算ベースなので、
//     // 子要素を持ち得るdotには、あまり-1や1に近い値を設定すべきではない。
//     // 注意する事。
//   },
//   $needGlobalUpdate: true, // 真なら親dotおよび$localを元に$globalが再計算される(その後、偽値がセットし直される)。これは子dotに伝播する。手動セット必須、忘れるな！
//   // global系は自身もしくは親の$needGlobalUpdateが真の時に更新される
//   $global: {
//     x: null,
//     y: null,
//     w: null,
//     h: null,
//     scaleX: null,
//     scaleY: null,
//     r: null,
//     g: null,
//     b: null,
//     a: null,
//     z: null,
//   },
//   $children: [], // 子要素の別のdotが複数入る
//   $isInactive: false, // これが真値なら子要素ともども、$global更新、$tickFn実行、描画、がスキップされる
//   $renderFn: (gl, dot)=>{...}, // renderDot時に実行される関数。省略時はrenderSpriteのラッパーが実行される
//   $renderParams: {...}, // renderSpriteに渡される。extraMatrix等を渡す際に使う
//   $texKey: "...", // renderSpriteがtexBookから参照する際のkey。これが無指定ならrenderSprite自体が実行されない
//   $tickFn: (gl, dot)=>{...}, // tickDot時に実行される関数
//   $initFn: (gl, dot)=>{...}, // このdotの$tickFnや$renderFnが初めて実行されるその直前に1回だけ実行される関数。あるdotが自前のテクスチャをglを使って生成したい時などに使うとよい。なお「1回だけ実行」の実装は、「実行したらこのdotから$initFnのエントリを消す」事で実現しているので注意する事
//   $isTerminateRecursiveSearch: false, // これが真値ならここより子要素にrenderFnおよびtickFnはない。子要素自体はあるかもしれないが、そのrenderおよびtickは行わなくてよい(おそらくこのdotが子要素まで含めてrenderやtickを行う)。なお$globalの更新自体は$isTerminateRecursiveSearchを持つdotの子要素にも行われる。もしこれが嫌なら$children以外のプロパティとして子要素を持つとよい
//   $isDisplayDebug: false, // trueならデバッグ用ワイヤーボックスを表示
//   // dotのroot部はこのプロパティを持つ事が必須(root判別用途も兼ねている)
//   $root: {}, // 自動更新されるプロパティがたくさん含まれるが気にしなくてよい
//   // 上記以外の `$` で始まらないプロパティは自由に使ってよい
// }


// TODO: シンボリックリンク的なdotをつけられるようにする。これによって共有構造への対応とする
//       - これまでの共有構造は廃止する
//       - シンボリックリンク以外での共有dotの存在を禁止する
//         - 複数箇所から参照されている場合にエラーにするのではなく、古い方の参照を消すだけにしたい
//       - $global.parent が設定されるようにする(これにより↑の判定を行う？)
//       - これにより循環参照が起こるので、使わなくなったdotは明示的にdisposeする必要が出るかもしれない(実際のdispose処理は、dotから$globalを除去するだけでいい筈)


// TODO: $anotherParent 対応
//       - 描画順はこれによらず通常通りだが、x,y,scaleは別のdotを参照するやつ
//       - dotツリー上の親と、render上の親を変更したいケースに対応できるやつ
//           - op0076作っていて、案外これがほしい時が多かった
//       - ただこれを実装するには「`$anotherParent`の方が先にupdateGlobalが済んでいる事」の条件が必要なのでは？この条件を満たせてない場合は1フレーム前のx,y,scaleを参照してしまう事になる。通常ならそれでも大きな問題はないが、ブラウザリサイズ時などで大きな問題が起こる…
//           - つまりupdateGlobalの処理の方にも手を入れる必要があるという事
//       - どうすれば軽量に実装できるか、もうちょい考える


const parentGlobalTemplate = Object.freeze({
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  scaleX: 1,
  scaleY: 1,
  r: 1,
  g: 1,
  b: 1,
  a: 1,
  z: 0,
});

// NB: シューティングゲームで弾丸オブジェクト10000個とか出しても、
//     -1～1の範囲を越えない程度の量に設定しなくてはいけない。
//     ただしfloatの有効桁数限界(19桁程度？)を越えて小さくなってもいけない
const baseStep = -0.0000001;

const makeStepZ = (idx) => baseStep*(idx+1) + baseStep*0.01*xorshift();

const calculateTexW = (gl, texKey, h) => {
  const dom = referTex(gl, texKey);
  if (!dom) { return 0 }
  const domW = dom.width;
  const domH = dom.height;
  if (!domW || !domH) { return 0 }
  return h * domW / domH;
};

const calculateTexH = (gl, texKey, w) => {
  const dom = referTex(gl, texKey);
  if (!dom) { return 0 }
  const domW = dom.width;
  const domH = dom.height;
  if (!domW || !domH) { return 0 }
  return w * domH / domW;
};

const rectTypeFnMap = {
  "canvas": getCanvasBrppnLRTB,
  "screen": getScreenBrppnLRTB,
  "aspect": getAspectBrppnLRTB,
};

// なるべくGCが起こらないように組む事
const updateGlobalOneTrue = (gl, dot, parentGlobal, idx) => {
  // Set default(fallback) parameters
  dot.$layout ||= {};
  //dot.$layout.resetColors ??= undefined;
  //dot.$layout.resetZ ??= undefined;
  dot.$layout.resetParentRectType ??= "inherit";
  dot.$layout.resetOriginX ??= 0;
  dot.$layout.resetOriginY ??= 0;
  dot.$layout.anchorX ??= 0;
  dot.$layout.anchorY ??= 0;
  //dot.$layout.isAutoGlobalW ??= false;
  //dot.$layout.isAutoGlobalH ??= false;
  dot.$local ||= {};
  dot.$local.x ??= 0;
  dot.$local.y ??= 0;
  dot.$local.w ??= 0;
  dot.$local.h ??= 0;
  dot.$local.scaleX ??= 1;
  dot.$local.scaleY ??= 1;
  dot.$local.r ??= 1;
  dot.$local.g ??= 1;
  dot.$local.b ??= 1;
  dot.$local.a ??= 1;
  dot.$local.z ??= makeStepZ(idx);
  dot.$children ||= [];
  // Set global parameters
  dot.$global ||= {};
  const lrtb = rectTypeFnMap[dot.$layout.resetParentRectType]?.(gl.canvas);
  if (lrtb) {
    const rectLeft = lrtb.left;
    const rectTop = lrtb.top;
    const rectW = lrtb.w;
    const rectH = lrtb.h;
    const scaleX = dot.$local.scaleX;
    const scaleY = dot.$local.scaleY;
    dot.$global.scaleX = scaleX; // scaleX確定
    dot.$global.scaleY = scaleY; // scaleY確定
    // TODO: この辺りのxとyがどうも、scale=1でない時にずれている事がある気がする…。op0076の、$layout設定ありのparticleLayerでずれている時があったので、おそらくこの辺りの処理だと思うのだけど…。↓のresetOriginX等の計算をミスってるかもしれない？優先度は低いので、あとで考え直したい
    const originX = rectLeft + (rectW * (dot.$layout.resetOriginX+1) / 2);
    const originY = rectTop + (rectH * (dot.$layout.resetOriginY+1) / 2);
    dot.$global.x = originX + dot.$local.x; // x確定
    dot.$global.y = originY + dot.$local.y; // y確定
  } else { // inherit
    dot.$global.scaleX = dot.$local.scaleX * parentGlobal.scaleX; ; // scaleX確定
    dot.$global.scaleY = dot.$local.scaleY * parentGlobal.scaleY; ; // scaleY確定
    dot.$global.x = parentGlobal.x + (dot.$local.x * parentGlobal.scaleX); // x確定
    dot.$global.y = parentGlobal.y + (dot.$local.y * parentGlobal.scaleY); // y確定
  }
  // NB: textのような「dom生成前からtexKeyは持つけど、参照先はまだ空で、
  //     生成後にようやくアスペクト比が確定する」ようなものがある。
  //     これらは生成が完全に完了するまでは隠しておきたい(そうでないと
  //     一瞬不完全なアスペクト比の画像が見えてしまうケースがある)。
  //     これを適切に隠す為には、wもしくはhを0にしておく必要がある。
  //     また生成完了後に明示的に$needGlobalUpdate=1する必要がある。
  dot.$global.w = (dot.$layout.isAutoGlobalW ? calculateTexW(gl, dot.$texKey, dot.$local.h) : dot.$local.w) * dot.$global.scaleX; // w確定
  dot.$global.h = (dot.$layout.isAutoGlobalH ? calculateTexH(gl, dot.$texKey, dot.$local.w) : dot.$local.h) * dot.$global.scaleY; // h確定
  const resetColors = dot.$layout.resetColors;
  dot.$global.r = resetColors?.[0] ?? (dot.$local.r * parentGlobal.r);
  dot.$global.g = resetColors?.[1] ?? (dot.$local.g * parentGlobal.g);
  dot.$global.b = resetColors?.[2] ?? (dot.$local.b * parentGlobal.b);
  dot.$global.a = resetColors?.[3] ?? (dot.$local.a * parentGlobal.a);
  dot.$global.z = dot.$layout.resetZ ?? (dot.$local.z + parentGlobal.z);
  dot.$needGlobalUpdate = 0;
};

const updateGlobalOne = (gl, dot, parentGlobal, needGlobalUpdateByParent, idx) => {
  if (dot.$isInactive) {
    // NB: 無効化停止中に親だけ更新されているケースがありえる。
    //     なので復帰時に$globalの更新が強制的に行われるよう、
    //     $needGlobalUpdateフラグを立てておく必要がある
    dot.$needGlobalUpdate = 1;
    return;
  }
  const needGlobalUpdate = needGlobalUpdateByParent || (dot.$needGlobalUpdate == null) || dot.$needGlobalUpdate;
  if (needGlobalUpdate) {
    updateGlobalOneTrue(gl, dot, parentGlobal, idx);
  }
  for (let i = 0; i < dot.$children.length; i++) {
    const child = dot.$children[i];
    if (child) { updateGlobalOne(gl, child, dot.$global, needGlobalUpdate, i) }
  }
};



const runTickFnRecursively = (gl, dot) => {
  if (dot.$isInactive) { return }
  const initFn = dot.$initFn;
  if (initFn) {
    dot.$initFn = undefined; // deleteはobject内エントリ増減が起こるので避ける
    initFn(gl, dot);
  }
  // NB: renderFnは子から先に実行される場合があるが、
  //     tickFnは常に実行順を保証する必要がある。
  //     ただし親が先か子が先かはかなり悩む…。
  //     現在は「親が自分自身を除去する」
  //     「親が子を追加/除去する」「子が親から自分自身を除去する」
  //     あたりのケースを考えて、子から先に実行する事にした
  if (!dot.$isTerminateRecursiveSearch) {
    if (dot.$children) {
      // childも除去されるケースがある、注意
      for (let i = dot.$children.length - 1; 0 <= i; i--) {
        const child = dot.$children[i];
        if (child) { runTickFnRecursively(gl, child) }
      }
    }
  }
  dot.$tickFn?.(gl, dot);
};

const checkAndUpdateCRInfo = (gl, $root) => {
  const canvas = gl.canvas;
  const w = canvas.width;
  const h = canvas.height;
  if (($root.lastCanvasResolutionW === w) && ($root.lastCanvasResolutionH === h)) { return 0 }
  $root.lastCanvasResolutionW = w;
  $root.lastCanvasResolutionH = h;
  return 1;
};

export const updateGlobal = (gl, rootDot, isForce=undefined) => {
  if (!rootDot.$root) { throw new Error("must need $root property") }
  const needForce = checkAndUpdateCRInfo(gl, rootDot.$root) || isForce;
  updateGlobalOne(gl, rootDot, parentGlobalTemplate, needForce, 0);
};

export const tickDot = (gl, rootDot) => {
  updateGlobal(gl, rootDot);
  runTickFnRecursively(gl, rootDot);
  updateGlobal(gl, rootDot);
};






const emptyArray = Object.freeze([]);
const _findDotById = (dot, id) => {
  if (dot.$id === id) { return dot }
  for (const child of (dot.$children || emptyArray)) {
    const r = _findDotById(child, id);
    if (r) { return r }
  }
}
// dotツリー検索ユーティリティ
export const findDotById = (rootDot, id) => {
  rootDot.$root ||= {};
  const table = (rootDot.$root.findCacheTable ||= {});
  const r0 = table[id];
  if (r0) { return r0 }
  const r1 = _findDotById(rootDot, id);
  if (r1) { table[id] = r1 }
  return r1;
};
export const cleanFindDotCache = (rootDot, id) => {
  if (!rootDot.$root?.findCacheTable) { return }
  if (id == null) {
    rootDot.$root.findCacheTable = {};
  } else {
    delete rootDot.$root.findCacheTable[id];
  }
};


// ある特定のdotのそのローカル座標での矩形のXYWHを取り出す(子要素は考慮しない)
const tmpResult = [];
export const calculateLocalRectFromDot = (dot) => {
  const anchorX = dot.$layout?.anchorX || 0;
  const anchorY = dot.$layout?.anchorY || 0;
  const x = dot.$local?.x || 0;
  const y = dot.$local?.y || 0;
  const w = dot.$local?.w || 0;
  const h = dot.$local?.h || 0;
  let left = x - w * (anchorX + 1) / 2;
  let top = y - h * (anchorY + 1) / 2;
  tmpResult[0] = left;
  tmpResult[1] = top;
  tmpResult[2] = w;
  tmpResult[3] = h;
  return tmpResult;
};


// ある特定のdotの矩形内に指定ローカル座標が含まれているかを判定する
export const isInDotRect = (dot, localX, localY) => {
  const [left, top, w, h] = calculateLocalRectFromDot(dot);
  const right = left + w;
  const bottom = top + h;
  return (left <= localX && localX <= right && top <= localY && localY <= bottom);
};







const debugPoints = new Float32Array((6+4)*4);
const debugColor = {a: 1};

const drawDebug = (gl, dot) => {
  const w = dot.$global.w;
  if (!w) { return }
  const h = dot.$global.h;
  if (!h) { return }
  debugColor.r = xorshift();
  debugColor.g = xorshift();
  debugColor.b = xorshift();
  const anchorX = dot.$layout.anchorX;
  const anchorY = dot.$layout.anchorY;
  const baseX = (anchorX+1)*-0.5*w;
  const baseY = (anchorY+1)*-0.5*h;
  const left = baseX;
  const right = baseX + w;
  const top = baseY;
  const bottom = baseY + h;
  const posAnchorX = 0;
  const posAnchorY = 0;
  const anchorSize = (w+h) / 32;
  // main rect
  debugPoints[0]  = left;
  debugPoints[1]  = top;
  debugPoints[2]  = right;
  debugPoints[3]  = top;
  debugPoints[4]  = left;
  debugPoints[5]  = top;
  debugPoints[6]  = left;
  debugPoints[7]  = bottom;
  debugPoints[8]  = left;
  debugPoints[9]  = top;
  debugPoints[10] = right;
  debugPoints[11] = bottom;
  debugPoints[12] = right;
  debugPoints[13] = top;
  debugPoints[14] = left;
  debugPoints[15] = bottom;
  debugPoints[16] = right;
  debugPoints[17] = top;
  debugPoints[18] = right;
  debugPoints[19] = bottom;
  debugPoints[20] = left;
  debugPoints[21] = bottom;
  debugPoints[22] = right;
  debugPoints[23] = bottom;
  // anchor point
  debugPoints[24] = 0;
  debugPoints[25] = 0 - anchorSize;
  debugPoints[26] = 0 + anchorSize;
  debugPoints[27] = 0;
  debugPoints[28] = 0 + anchorSize;
  debugPoints[29] = 0;
  debugPoints[30] = 0;
  debugPoints[31] = 0 + anchorSize;
  debugPoints[32] = 0;
  debugPoints[33] = 0 + anchorSize;
  debugPoints[34] = 0 - anchorSize;
  debugPoints[35] = 0;
  debugPoints[36] = 0 - anchorSize;
  debugPoints[37] = 0;
  debugPoints[38] = 0;
  debugPoints[39] = 0 - anchorSize;
  renderWireFrame(gl, debugPoints, debugColor, dot.$global, anchorX, anchorY, dot.$renderParams, (0.5 < xorshift()));
};


const drawSelf = (gl, dot) => {
  // renderFnがあるならそれで描画、なければrenderSpriteでtexKeyを描画
  const renderFn = dot.$renderFn;
  if (renderFn) {
    renderFn(gl, dot); // 必要なパラメータは自分で見る事
  } else {
    const texKey = dot.$texKey;
    if (texKey) {
      renderSprite(gl, texKey, dot.$global, dot.$layout.anchorX, dot.$layout.anchorY, dot.$renderParams);
    }
  }
};


// 重複dotチェック用のカウンター。prod版では消滅する
let serial = 0;


// なるべくGCが起こらないように組む事
const renderOne = (gl, dot, isParentDisplayDebug, isUseDepthBuffer) => {
  if (dot.$isInactive) { return }
  const isDisplayDebug = isParentDisplayDebug || dot.$isDisplayDebug;
  if (!isUseDepthBuffer) { drawSelf(gl, dot) } // zBufなしなら先に描画
  if (!dot.$isTerminateRecursiveSearch) {
    const children = dot.$children;
    const lastIdx = children.length - 1;
    for (let i = 0; i <= lastIdx; i++) {
      const child = isUseDepthBuffer ? children[lastIdx-i] : children[i];
      if (isDev) {
        // child.$isInactive が真のものは $global がない。
        // もちろんレンダリングはされないのだが、そのチェックはこの後の
        // renderOne(gl, child, ...) で行われるので、
        // ここでも$globalなしのものはチェック判定から除外する必要がある
        if (child?.$global) {
          if (serial === child.$global.serial) {
            console.log('found duplicated dot! you should fix it!', child);
            continue;
          }
          child.$global.serial = serial;
        }
      }
      if (0 < dot.$global.a) {
        renderOne(gl, child, isDisplayDebug, isUseDepthBuffer);
      }
    }
  }
  if (isUseDepthBuffer) { drawSelf(gl, dot) } // zBufありなら後に描画
  // デバッグワイヤーフレームを描画
  if (isDev) {
    if (isDisplayDebug) { drawDebug(gl, dot) }
  }
};


export const renderDot = (gl, rootDot) => {
  executeUploadReservedTextures(gl);
  if (isDev) { serial++ }
  renderOne(gl, rootDot, 0, gl.isEnabled(gl.DEPTH_TEST));
}


