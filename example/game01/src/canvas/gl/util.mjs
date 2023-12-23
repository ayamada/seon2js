const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { return shader }
  const log = gl.getShaderInfoLog(shader);
  console.log(log);
  gl.deleteShader(shader);
  return null;
}


export const createProgramFromShaderSources = (gl, vertexShaderSource, fragmentShaderSource) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) { return program }
  const log = gl.getProgramInfoLog(program);
  console.log(log);
  gl.deleteProgram(program);
  return null;
}


// TODO: これは本当はmathに入れたいが、いいnamespaceのモジュールがない
// 三点がCCW順になっているかを真偽値で返す
export const isCCW = (v0x, v0y, v1x, v1y, v2x, v2y) => {
  // NB: 一直線や同一点がある時に判定がおかしくなるが、それは仕様とする
  //     (どちらの判定であっても何も描画されない筈なので問題にならない筈)
  // v0を起点としたv1とv2の角度を求め、そこから判定する
  v1x -= v0x;
  v1y -= v0y;
  v2x -= v0x;
  v2y -= v0y;
  const v1angle = Math.atan2(v1y, v1x);
  const v2angle = Math.atan2(v2y, v2x);
  return ((v1angle < v2angle) ? ((v2angle - v1angle > Math.PI) ? 1 : 0) : ((v1angle - v2angle > Math.PI) ? 0 : 1));
};


export const setupGlConfig = (gl, glConfig) => {
  let glClearBit = gl.COLOR_BUFFER_BIT;
  gl.clearColor(0, 0, 0, 1);
  if (glConfig.isUseGlDepthTest) {
    gl.enable(gl.DEPTH_TEST);
    gl.clearDepth(1.0);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    glClearBit |= gl.DEPTH_BUFFER_BIT;
  } else {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
  }
  if (glConfig.isUseGlBlend) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
  } else {
    gl.disable(gl.BLEND);
  }
  if (glConfig.isUseGlCull) {
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  } else {
    gl.disable(gl.CULL_FACE);
  }
  if (glConfig.isUseGlStencil) {
    gl.clearStencil(0);
    glClearBit |= gl.STENCIL_BUFFER_BIT;
  }
  return glClearBit;
};


