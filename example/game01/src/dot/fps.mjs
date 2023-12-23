import {makeTextCanvas, updateTextCanvasAsync} from '../canvas/text.mjs'
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0} from '../canvas/gl/texture.mjs'
import {registerTick, getDeltaMsec, getTotalElapsedMsec, setTimeoutAsync, waitMsecAsync} from '../tick.mjs'


const texKey = 'fps/label';


const tickFps = (gl, dot) => {
  const elapsedMsec = getDeltaMsec();
  const fpsCanvas = dot.fpsCanvas;
  dot.currentCount++;
  const oldTotalMsec = dot.totalMsec;
  const newTotalMsec = oldTotalMsec + elapsedMsec;
  dot.totalMsec = newTotalMsec;
  const progressSec = Math.floor(newTotalMsec/1000) - Math.floor(oldTotalMsec/1000);
  if (progressSec) {
    const newFps = Math.round(dot.currentCount / progressSec);
    dot.currentCount = 0;
    updateTextCanvasAsync(fpsCanvas, "FPS:"+newFps).then(()=>{
      dot.$needGlobalUpdate = 1;
      if (dot.textureIdx) { assignAndUploadGlTex(gl, texKey, dot.textureIdx) }
    });
  }
};


// TODO: dotツリー生成時にglを要求したくないのだけど…
//       glが必要なのはtex登録回りなので、可能ならtickFpsの中で
//       初回の初期化をやって$needGlobalUpdateをセットするようにしたい
export const makeFpsDot = (textureIdx=undefined) => {
  const fpsCanvas = makeTextCanvas({
    ctx2dProps: {
      fillStyle: "#777",
      strokeStyle: "#000",
      //strokeStyle: "#FFF",
    },
    strokeWidthRatio: 0.2,
    //bgStyle: "#700", // for debug
  });
  return {
    textureIdx: textureIdx,
    fpsCanvas: fpsCanvas,
    currentCount: 0,
    totalMsec: 0,
    //
    $layout: {
      resetParentRectType: "screen",
      resetOriginX: 1,
      resetOriginY: -1,
      anchorX: 1,
      anchorY: -1,
      isAutoGlobalW: 1,
    },
    $local: {
      h: 0.05,
      z: -0.9999,
    },
    $global: {},
    $texKey: texKey,
    $initFn: (gl, dot) => {
      registerTex(gl, texKey, fpsCanvas);
      if (textureIdx) { assignAndUploadGlTex(gl, texKey, textureIdx) }
      dot.$needGlobalUpdate = 1;
    },
    $tickFn: tickFps,
    //$isDisplayDebug: 1, // for debug
  };
};
