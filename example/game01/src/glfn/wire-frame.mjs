import {createProgramFromShaderSources} from '../canvas/gl/util.mjs'
import {mat4clone, mat4make, mat4overwrite, mat4reset, mat4compose, mat4composeR, mat4move, mat4scale, mat4rotate, mat4invert, mat4transpose} from '../math/mat4a.mjs'
import {isReadyGl, fetchGlFn} from '../canvas/gl/glfn.mjs'
import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from '../canvas/brppn.mjs'


// WebGLの仕様上は gl.lineWidth(lineWidth) で線の太さを変えられる、
// という事になっているが、
// const sizeRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);
// console.log('sizeRange: ' + JSON.stringify(sizeRange));
// の結果はどこの環境でも `[1, 1]` なので、実質的に1ドットから変更する事は
// できないらしい…。
// だからこれが提供するワイヤーフレームも線の太さは1ドット固定。


const vertMat4Data = mat4make(); // これをvertShaderに適用する


const vertexShaderSource = `#version 300 es
  uniform vec4 u_XYrXrY;
  uniform mat4 u_matrix;
  in vec4 a_position;
  void main() {
    gl_Position = u_matrix * a_position;
    gl_Position.x += u_XYrXrY.x;
    gl_Position.y += u_XYrXrY.y;
    gl_Position.x *= u_XYrXrY.z;
    gl_Position.y *= u_XYrXrY.w;
  }`;

const fragmentShaderSource = `#version 300 es
  precision highp float;
  uniform vec4 u_color;
  out vec4 outColor;
  void main() {
    outColor = u_color;
  }`;


const emptyO = Object.freeze({});


const glFnWireFrame = (gl) => {
  const program = createProgramFromShaderSources(gl, vertexShaderSource, fragmentShaderSource);
  const ratioUniformLocation = gl.getUniformLocation(program, "u_XYrXrY");
  const matrixUniformLocation = gl.getUniformLocation(program, "u_matrix");
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const colorLocation = gl.getUniformLocation(program, "u_color");
  const positionBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  const vertMat4Data = mat4make();
  return (gl, points, color=emptyO, globalParams=emptyO, anchorX=0, anchorY=0, renderParams=emptyO, isIgnoreExtraMatrix=undefined) => {
    const { x=0, y=0, z=-0.9 } = globalParams; // NB: ignore parent colors
    const { r=1, g=1, b=1, a=1 } = color;
    let { extraMatrix } = renderParams;
    // ワイヤーフレームは大体、何よりも手前に表示したいケースが多いので、
    // z省略時の値はかなり手前寄りに設定しておく
    mat4reset(vertMat4Data);
    // equivalent mat4move(vertMat4Data, x, y, z)
    vertMat4Data[12] = x;
    vertMat4Data[13] = y;
    vertMat4Data[14] = z;
    if (extraMatrix && !isIgnoreExtraMatrix) {
      mat4compose(vertMat4Data, extraMatrix);
    }
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

    const canvas = gl.canvas;
    const adjustX = getLastGlAdjustBrppnX(canvas);
    const adjustY = getLastGlAdjustBrppnY(canvas);
    const ratioX = getLastGlRatioX(canvas);
    const ratioY = getLastGlRatioY(canvas);
    gl.uniform4f(ratioUniformLocation, adjustX, adjustY, ratioX, ratioY);
    gl.uniformMatrix4fv(matrixUniformLocation, false, vertMat4Data);
    gl.uniform4f(colorLocation, r, g, b, a);

    gl.drawArrays(gl.LINES, 0, points.length/2);
    gl.bindVertexArray(null);
  };
};


export const renderWireFrame = (... args) => fetchGlFn(glFnWireFrame)(... args);
