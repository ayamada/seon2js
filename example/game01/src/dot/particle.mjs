import {getTotalElapsedMsec} from '../tick.mjs'
import {isCCW} from '../canvas/gl/util.mjs'
import {xorshift} from '../math/xorshift.mjs'
import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from '../canvas/brppn.mjs'
import * as sprite from '../glfn/sprite.mjs'


// TODO: もっともっと最適化が必要


// TODO: glsl回りがまだ古いコードベースであまり効率的でない。できれば全部の多角形を一度に描画するようにしたい(これは三角形ベースなら可能だが、四角形ベースでは無理では？また将来にテクスチャ対応する際には確実に無理になる…)


// TODO: これは古い？とりあえず四角形には対応した…
// - tripeは三角形単位ではなく、頂点単位に変更する
//     - 「ある一つのエミッタ」は以下を持つ
//         - 一つのttl(とstartMsec)(つまり全体のprogressを算出する為の値)
//         - 3個でセットになる、以下の情報のセット。これはまとめてGLに渡される。矩形の場合はこれを4or6個ずつ使うだけ。高速かつ1実行で全て完了する
//             - 開始頂点と終了頂点
//             - 開始色と終了色(alpha統合する想定)
//     - なるべく「最初に全情報を配列にセットして以降はなるべく変動しない」ようにしたいが、実際には複数のエミッタを同時に処理する関係上、終わったエミッタを外す処理は必要になる。ただこれも毎フレームチェックはしない実装にしたい
//         - lost context、新しいエミッタが追加されたタイミング、およびそこから一定(例えば60)フレームごとのタイミングでのみ、配列の更新を行うなど
//             - これの為に、GL側で、終わってるかどうかの判定をできるようにする事。progressが-1なら終わってる扱いにするとか(1付近は避けた方がいい。全てのpeがalpha=0で終わると仮定できるなら何も考えずに1で問題ないのだが…)
//             - lost context対応は、restoreハンドル内に配列リビルドを仕込んでおけばok


export const clearAllParticles = (dot) => {
  dot.particles = [];
};


const makeRectData = (isTriangle) => new Float32Array(isTriangle ? 6 : 8);

// 単体でパラメータ調整したパーティクル登録する。
// 紙吹雪など、飛ばす方向を揃えたりする際に使う
export const emitOneParticle = (dot, entrySrc) => {
  const entry = { ... entrySrc };
  entry.startMsec ??= getTotalElapsedMsec();
  entry.endMsec ??= entry.startMsec + entry.ttlMsec;
  entry.spriteGlobalParams ??= {};
  entry.rectData ??= makeRectData(entry.v3x == null);
  dot.particles.push(entry);
};


export const emitParticleEmitter = (dot, {x=0, y=0, baseSize=0.05, maxRadius=5, ttlMsec=5000, quantity=16, startAlpha=1.0, endAlpha=0, color=undefined, isReverse=0, doneFn=undefined, forceX=undefined, forceY=undefined, isSquare=0, startScale=1, endScale=1}) => {
  // TODO: 毎回emitOneParticleするのではなく、1グループとして扱いたい(なぜならdoneFnは一つなので)
  for (let i = 0; i < quantity; i++) {
    const size = baseSize * (0.5 + xorshift());
    const radius = xorshift() * maxRadius;
    let angle = xorshift() * Math.PI * 2;
    let startX = x;
    let startY = y;
    let endX = x + radius * Math.sin(angle);
    let endY = y + radius * Math.cos(angle);
    if (forceX != null) { endX = forceX }
    if (forceY != null) { endY = forceY }
    if (isReverse) {
      [startX, endX] = [endX, startX];
      [startY, endY] = [endY, startY];
    }
    angle = xorshift() * Math.PI * 2;
    const v0x = size * Math.sin(angle);
    const v0y = size * Math.cos(angle);
    angle = xorshift() * Math.PI * 2;
    let v1x = size * Math.sin(angle);
    let v1y = size * Math.cos(angle);
    angle = xorshift() * Math.PI * 2;
    let v2x = size * Math.sin(angle);
    let v2y = size * Math.cos(angle);
    if (!isCCW(v0x, v0y, v1x, v1y, v2x, v2y)) {
      let tmp = v1x; v1x = v2x; v2x = tmp;
      tmp = v1y; v1y = v2y; v2y = tmp;
    }
    const v3x = isSquare ? (v1x + v2x - v0x) : undefined;
    const v3y = isSquare ? (v1y + v2y - v0y) : undefined;
    const entry = {
      size: size,
      startX: startX,
      deltaX: endX - startX,
      startY: startY,
      deltaY: endY - startY,
      startAlpha: startAlpha,
      deltaAlpha: endAlpha - startAlpha,
      startMsec: null, // set by emitOneParticle
      ttlMsec: ttlMsec,
      color: color,
      v0x: v0x,
      v0y: v0y,
      v1x: v1x,
      v1y: v1y,
      v2x: v2x,
      v2y: v2y,
      v3x: v3x, // this for square particle
      v3y: v3y, // this for square particle
      doneFn: doneFn,
      startScale: startScale,
      deltaScale: endScale - startScale,
    };
    emitOneParticle(dot, entry);
  }
};


const sgpList = [];

const renderFn = (gl, dot) => {
  if (!dot.particles?.length) { return }
  const nowMsec = getTotalElapsedMsec();
  // 以下の情報だけ親レイヤの情報を引き継ぐ
  // (それ以外はscale等含めて引き継がない)
  const layerX = dot.$global.x;
  const layerY = dot.$global.y;

  sgpList.length = 0;
  for (const entry of dot.particles) {
    // TODO: 可能ならこの辺の計算はglslにやらせたいが…
    const {texKey, size, startX, deltaX, startY, deltaY, startAlpha, deltaAlpha, startMsec, ttlMsec, color, v0x, v0y, v1x, v1y, v2x, v2y, v3x, v3y, startScale, deltaScale, spriteGlobalParams, rectData} = entry;
    const isTriangle = (v3x == null);
    const progress = (nowMsec - startMsec) / ttlMsec;
    const x = layerX + startX + deltaX * progress;
    const y = layerY + startY + deltaY * progress;
    const r = color?.r ?? xorshift();
    const g = color?.g ?? xorshift();
    const b = color?.b ?? xorshift();
    const alpha = (startAlpha + deltaAlpha * progress) * (color?.a ?? 1);
    const scale = startScale + deltaScale * progress;
    rectData[0] = v0x*scale;
    rectData[1] = v0y*scale;
    rectData[2] = v1x*scale;
    rectData[3] = v1y*scale;
    rectData[4] = v2x*scale;
    rectData[5] = v2y*scale;
    if (!isTriangle) {
      rectData[6] = v3x*scale;
      rectData[7] = v3y*scale;
    }
    spriteGlobalParams.x = x;
    spriteGlobalParams.y = y;
    //spriteGlobalParams.w = scale;
    //spriteGlobalParams.h = scale;
    spriteGlobalParams.r = r;
    spriteGlobalParams.g = g;
    spriteGlobalParams.b = b;
    spriteGlobalParams.a = alpha;
    //spriteGlobalParams.z = 0;
    spriteGlobalParams.extraDstRectData = rectData;
    spriteGlobalParams.isTriangle = isTriangle;
    spriteGlobalParams.extraTexKey = texKey ?? 'embed/white2x2';
    sgpList.push(spriteGlobalParams);
  }
  sprite.renderSprite(gl, undefined, sgpList);
}


const tickFn = (gl, dot) => {
  const nowMsec = getTotalElapsedMsec();
  // NB: 中でclearAllParticlesが呼ばれる可能性があるので、
  //     毎回dot.particlesを参照する必要がある
  //     (古いparticlesを参照していない事を保証する)
  for (let i = dot.particles.length-1; 0 <= i; i--) {
    if (dot.particles[i].endMsec < nowMsec) {
      dot.particles[i].doneFn?.();
      dot.particles.splice(i, 1);
    }
  }
};


export const makeParticleDot = (id=undefined) => ({
  particles: [],
  $id: id,
  $layout: { newParentRectType: "canvas" },
  $local: {},
  $tickFn: tickFn,
  $renderFn: renderFn,
});


export const emitConfettiOne = (gl, dot, {texKey=undefined, isFalling=undefined, fixedColor=undefined, x=0, y=0, baseSize=0.1, maxRadius=5, startAlpha=1.0, endAlpha=0, isReverse=0, doneFn=undefined, forceX=undefined, forceY=undefined, isSquare=0, startScale=1, endScale=1, fallingStartPointWidthRatio=1.1, useBillBoard=undefined, ttlMsec=0}, targetX) => {
  if (texKey || useBillBoard) { isSquare = 1 } // texKey指定時は強制的に矩形化する
  const zRate = (0.5 + xorshift()); // どのぐらい奥側にあるかを示す指標
  ttlMsec ||= (10000 / zRate); // 奥側ほど見た目上の速度が遅くなる
  const color = fixedColor || {r:zRate, g:zRate, b:zRate, a:1}; // 奥側ほど暗くなる
  const size = baseSize * zRate; // 奥側ほど小さい
  let startX, startY, endX, endY, angle;
  if (isFalling) {
    const lrtb = getAspectBrppnLRTB(gl.canvas);
    const width = lrtb.w * fallingStartPointWidthRatio;
    startX = targetX + (xorshift() - 0.5) * width;
    startY = -1.1;
    endX = startX + (xorshift() - 0.5) * 1;
    endY = 1.1;
  } else {
    angle = xorshift() * Math.PI * 2;
    const radius = xorshift() * maxRadius;
    startX = x;
    startY = y;
    endX = x + radius * Math.sin(angle);
    endY = y + radius * Math.cos(angle);
  }
  if (forceX != null) { endX = forceX }
  if (forceY != null) { endY = forceY }
  if (isReverse) {
    [startX, endX] = [endX, startX];
    [startY, endY] = [endY, startY];
  }
  let v0x, v0y, v1x, v1y, v2x, v2y, v3x, v3y;
  if (useBillBoard) {
    v0x = size * -1;
    v0y = size * -1;
    v1x = size * -1;
    v1y = size * 1;
    v2x = size * 1;
    v2y = size * -1;
  } else {
    angle = xorshift() * Math.PI * 2;
    v0x = size * Math.sin(angle);
    v0y = size * Math.cos(angle);
    angle = xorshift() * Math.PI * 2;
    v1x = size * Math.sin(angle);
    v1y = size * Math.cos(angle);
    angle = xorshift() * Math.PI * 2;
    v2x = size * Math.sin(angle);
    v2y = size * Math.cos(angle);
    if (!isCCW(v0x, v0y, v1x, v1y, v2x, v2y)) {
      let tmp = v1x; v1x = v2x; v2x = tmp;
      tmp = v1y; v1y = v2y; v2y = tmp;
    }
  }
  v3x = isSquare ? (v1x + v2x - v0x) : undefined;
  v3y = isSquare ? (v1y + v2y - v0y) : undefined;
  const entry = {
    texKey: texKey,
    size: size,
    startX: startX,
    deltaX: endX - startX,
    startY: startY,
    deltaY: endY - startY,
    startAlpha: startAlpha,
    deltaAlpha: endAlpha - startAlpha,
    startMsec: null, // set by emitOneParticle
    ttlMsec: ttlMsec,
    color: color,
    v0x: v0x,
    v0y: v0y,
    v1x: v1x,
    v1y: v1y,
    v2x: v2x,
    v2y: v2y,
    v3x: v3x, // this for square particle
    v3y: v3y, // this for square particle
    doneFn: doneFn,
    startScale: startScale,
    deltaScale: endScale - startScale,
  };
  emitOneParticle(dot, entry);
};
