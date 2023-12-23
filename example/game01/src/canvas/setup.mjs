import {registerTick} from '../tick.mjs'
import {update, makeUpCanvas} from './brppn.mjs'
import {installPointerSupervisor, preventDefaultSomePointerEvents} from '../input/screen.mjs'


// TODO: もっと正しいモジュール名と抽象化を考える


const reformStyleForGame = (s)=> {
  s.margin = 0;
  s.padding = 0;
  s.overflow = 'hidden';
  s.touchAction = 'none';
  s.userSelect = 'none';
  s.WebkitUserSelect = 'none';
};

export const setupBrowser = ()=> reformStyleForGame(document.body.style);


const defaultGlOptions = {
  //stencil: true,
  antialias: false,
  //alpha: true,
  //depth: false,
  //desynchronized: true,
  //failIfMajorPerformanceCaveat: false,
  //powerPreference: "default",
  //premultipliedAlpha: true,
  preserveDrawingBuffer: true,
  //xrCompatible: false,
};

export const setupAll = ({canvasId, offScreenMarginPx=16, aspectRatio=1, glOptions={}, ooaRatioLR=[1,1], ooaRatioTB=[1,1]})=> {
  const mergedGlOptions = { ... defaultGlOptions, ... glOptions };

  setupBrowser();
  const canvas = makeUpCanvas(undefined, aspectRatio, offScreenMarginPx, ooaRatioLR, ooaRatioTB);
  canvas.id = canvasId;

  ////canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas);

  installPointerSupervisor(canvas);
  preventDefaultSomePointerEvents(canvas);

  // TODO: もうちょっとエラー原因を絞り、原因に対応する適切なメッセージを返した方がいい。webgl1は使えるが2は使えないのか、lostContext中なのか、等々
  const gl = canvas.getContext("webgl2", mergedGlOptions);
  if (!gl) {
    throw new Error('ブラウザのハードウェアアクセラレーションが有効でありません');
  }

  registerTick(()=> update(canvas));

  return gl;
};
