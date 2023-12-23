// あまりにcontextLostの扱いが難しいので、それをどうにか楽にできるようにする。
// gl描画を提供するモジュールは、以下のように定義する。
//
// // この関数には名前をつけておく事を推奨(後述)
// const glFnWireFrame = (gl) => {
//   // glセットアップコードをここに書く
//   return (gl, ... renderParams) => {
//     // 実際の描画コードをここに書く。
//     // renderParamsは任意のパラメータにできるが、先頭のglは絶対に
//     // glでなくてはならない。
//     // このreturnで返る部分が、後述のrenderWireFrameで実行される。
//   };
// };
// export const renderWireFrame = (... args) => fetchGlFn(glFnWireFrame)(... args);
// // これはつい `export const renderWireFrame = fetchGlFn(glFnWireFrame);` としたくなってしまうが、そうしてしまうとgccのunused code eliminationの対象外となってしまう。注意。
//
// このようにする事で、以下が保証される。
// - 内部でgl.canvasに勝手にaddEventListenerが実行され、contextLostが監視される
//   (複数のglで別々の判定になる。以降の部分も同様で、安全)
// - contextLostが発生している最中はrender関数を呼んでもスキップされる
// - contextLostが発生している最中かどうかは isReadyGl で判断できる
// - contextLostから復旧した際に自動的に上記glセットアップコードが再実行される
//   (render関数も再生成される)

// NB: setupFnの実行順は「関数の名前」のascii順で決まる。
//     名前なしの場合は優先度最低になる。
//     詳細はman asciiを見て決めるとよいが、とりあえず `$` 始まりが優先度最高。
//     このsetupFnの実行順はcontextLostが発生した後の復帰時に影響する。
//     どのような実行順になっても影響がないように組むべきだが、
//     うっかりそうなっていなかった時でも、最低でも実行順が安定するように
//     この仕様を残す事にした。


// TODO: 引数を (... args) で処理している箇所があるが、これはGCを起こすのでは？GCの源を毎フレーム生成したくない。できればなくしたいが…
//       - とはいうものの、予め引数をarrayとしてpackしておくぐらいしかないのでは？


const gl2state = new Map();
const setupFn2definition = new Map();

const fallbackFn = (gl) => (gl) => {};


let isRegisteredTickFn;
const installGlContextListeners = (gl) => {
  const _state = gl2state.get(gl);
  if (_state) { return _state }

  const state = {
    glFnEntries: {},
    //isReadyGl: false,
  };

  gl2state.set(gl, state);

  state.runSetupFns = () => {
    state.isReadyGl = true;
    // NB: isReadyGl can be false in this (runSetupFns) loop by lost context
    Object.keys(state.glFnEntries).sort().forEach((key)=> {
      if (!state.isReadyGl) { return }
      const renderFn = state.glFnEntries[key][0](gl) || fallbackFn;
      if (!state.isReadyGl) { return }
      state.glFnEntries[key][1] = renderFn;
    });
  };

  state.handleContextLost = (e) => {
    //console.log("handleContextLost");
    state.isReadyGl = false;
    for (const name in state.glFnEntries) {
      state.glFnEntries[name][1] = null;
    }
    e.preventDefault();
  };

  state.handleContextRestored = (e) => {
    //console.log("handleContextRestored");
    // Must be up to restored flag after next tick
    setTimeout(state.runSetupFns, 0);
  };

  const canvas = gl.canvas;
  canvas.addEventListener("webglcontextlost", state.handleContextLost, false);
  canvas.addEventListener("webglcontextrestored", state.handleContextRestored, false);
  state.runSetupFns();

  return state;
};


export const isReadyGl = (gl) => {
  const state = installGlContextListeners(gl);
  return state?.isReadyGl;
}


export const freeGlContextListeners = (gl) => {
  const state = gl2state.get(gl);
  if (!state) { return }
  const canvas = gl.canvas;
  canvas.removeEventListener("webglcontextlost", state.handleContextLost, false);
  canvas.removeEventListener("webglcontextrestored", state.handleContextRestored, false);
  gl2state.delete(gl);
};


export const fetchGlFn = (setupFn) => {
  let definition = setupFn2definition.get(setupFn);
  if (!definition) {
    definition = {
      name: setupFn.name || ('~~' + setupFn.toString()),
      render: (... args) => {
        // NB: render関数の最初の引数は必ずglインスタンスでなくてはならない
        const gl = args[0];
        if (!gl.canvas) { throw new Error('invalid gl') }
        const state = installGlContextListeners(gl);
        let fns = state.glFnEntries[definition.name];
        if (!fns) {
          fns = [setupFn, null];
          state.glFnEntries[definition.name] = fns;
        }
        if (state.isReadyGl) {
          let renderFn = fns[1];
          if (!renderFn) {
            renderFn = setupFn(... args);
            fns[1] = renderFn;
          }
          renderFn(... args);
        }
      },
    };
    setupFn2definition.set(setupFn, definition);
  }
  return definition.render;
};
