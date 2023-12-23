import {createProgramFromShaderSources} from '../canvas/gl/util.mjs'
import {mat4clone, mat4make, mat4overwrite, mat4reset, mat4compose, mat4composeR, mat4move, mat4scale, mat4rotate, mat4invert, mat4transpose} from '../math/mat4a.mjs'
import {isReadyGl, fetchGlFn} from '../canvas/gl/glfn.mjs'
import {getAspectRatio, getOffScreenMarginPx, getLastBrppnShortSidePx, getLastScreenPxW, getLastScreenPxH, getAspectPxXYWH, getScreenPxXYWH, getCanvasPxXYWH, getAspectBrppnLRTB, getScreenBrppnLRTB, getCanvasBrppnLRTB, getLastGlRatioX, getLastGlAdjustBrppnX, getLastGlRatioY, getLastGlAdjustBrppnY} from '../canvas/brppn.mjs'
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0, referTaEntry} from '../canvas/gl/texture.mjs'


// TODO: もっともっと最適化が必要


// TODO: テクスチャ領域から任意の領域のみをsrc領域とできる(ta対応)
//       - これ自体は一応できている。ただ現状ではスクロール不可(スクロールするとsrc領域外が見えてしまう
//       - きちんと対応させる為には、gl.REPEAT等に頼らずに、自前でglslで折り返し処理を書く必要がある！非常に大変だが、自前のタイリングバリエーション(レンガ的タイリング等)を自由に追加できる余地もできるのでやりたい。しかし難しい…


// NB: テクスチャのスクロール時に、xとyが0から大きく離れすぎた時に誤差が目に見えてしまうので、このspriteで呼ぶ前に、適切にmodする事！
//     - isWrapRepeat=0 の時はmodすべきではない
//     - isWrapRepeat=1 の時は、x方向はw*2, y方向はh*2でmodすればよい
//       - なお、↑のTODOのta対応がされた場合は、このmodもより複雑になる(offsetまで考えないといけなくなる)


const vertexShaderSource = `#version 300 es
  uniform vec4 u_XYrXrY;
  uniform mat4 u_matrix;
  in vec4 a_position;
  in vec2 a_texCoord;
  out vec2 v_texCoord;
  void main() {
    gl_Position = u_matrix * a_position;
    gl_Position.x += u_XYrXrY.x;
    gl_Position.y += u_XYrXrY.y;
    gl_Position.x *= u_XYrXrY.z;
    gl_Position.y *= u_XYrXrY.w;
    v_texCoord = a_texCoord;
  }`;
const fragmentShaderSource = `#version 300 es
  precision highp float;
  uniform vec4 u_color;
  uniform sampler2D u_image;
  in vec2 v_texCoord;
  out vec4 outColor;
  void main() {
    vec4 c = texture(u_image, v_texCoord) * u_color;
    if (c.a < 0.01) discard;
    outColor = c;
  }`;


const setRect = (rectData, x, y, width, height, isStrip) => {
  var x2 = x + width;
  var y2 = y + height;
  rectData[0] = x;
  rectData[1] = y;
  rectData[2] = x;
  rectData[3] = y2;
  rectData[4] = x2;
  rectData[5] = y;
  rectData[6] = x2;
  rectData[7] = y2;
  if (!isStrip) {
    rectData[8] = x2;
    rectData[9] = y;
    rectData[10] = x;
    rectData[11] = y2;
  }
  return rectData;
};


const srcRectData = new Float32Array(12);
const dstRectData = new Float32Array(8);
const vertMat4Data = mat4make();
const emptyObj = Object.freeze({});


const glFnSprite = (gl) => {
  const program = createProgramFromShaderSources(gl, vertexShaderSource, fragmentShaderSource);
  const ratioUniformLocation = gl.getUniformLocation(program, "u_XYrXrY");
  const matrixUniformLocation = gl.getUniformLocation(program, "u_matrix");
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
  const colorLocation = gl.getUniformLocation(program, "u_color");
  const imageLocation = gl.getUniformLocation(program, "u_image");
  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();
  const sampler = gl.createSampler();
  const vao = gl.createVertexArray();
  // TODO: globalParamsは当初{}固定だったが、particleのglfnも兼ねさせる事になり、arrayも可能になった。その結果かなり分かりづらくなってしまったので、もうちょっと整頓したい
  return (gl, texKey=undefined, globalParams=emptyObj, anchorX=0, anchorY=0, renderParams=emptyObj) => {
    // TODO: TilingSprite的動作の為の引数を追加(DEV.md参照)
    // TODO: kaleidoscopicRectとfocusRectは左上原点px単位のcanvas座標系。わかりづらいのでなんとかしたい…。kaleidoscopicRectはcanvas座標系になるのは仕方ないけど、focusRectの方は正規座標系の方が扱いやすい気はするが…
    const { extraMatrix, kaleidoscopicRect=emptyObj, focusRect=emptyObj, isWrapRepeat=1, isWrapMirrored=0 } = renderParams;

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    const canvas = gl.canvas;
    const adjustX = getLastGlAdjustBrppnX(canvas);
    const adjustY = getLastGlAdjustBrppnY(canvas);
    const ratioX = getLastGlRatioX(canvas);
    const ratioY = getLastGlRatioY(canvas);
    gl.uniform4f(ratioUniformLocation, adjustX, adjustY, ratioX, ratioY);

    const isGpArray = Array.isArray(globalParams);
    let gpIdx = 0;
    let prevTexKey, texKeyTrue, dom;
    while (1) {
      const gp = isGpArray ? globalParams[gpIdx++] : globalParams;
      if (!gp) { break }

      const { x=0, y=0, w=0, h=0, r=1, g=1, b=1, a=1, z=0, extraDstRectData, isTriangle, extraTexKey } = gp;
      if (extraTexKey != null) { texKey = extraTexKey }
      if (texKey == null) { if (isGpArray) { continue } else { break } }
      if (prevTexKey !== texKey) {
        prevTexKey = texKey;
        const taEntry = referTaEntry(gl, texKey);
        texKeyTrue = taEntry ? taEntry.taKey : texKey;
        dom = referTex(gl, texKeyTrue);
        if (!dom) { if (isGpArray) { continue } else { break } }

        const texW = dom.width;
        const texH = dom.height;
        let {x: ksX=0, y: ksY=0, w: ksW=texW, h: ksH=texH} = kaleidoscopicRect;
        // TODO: ks類の反映(難しい。glsl側で折り返し処理を実装する必要がある)
        let {x: focusX=0, y: focusY=0, w: focusW=(taEntry ? taEntry.w : dom.width), h: focusH=(taEntry ? taEntry.h : dom.height)} = focusRect;
        if (taEntry) {
          focusX += taEntry.x;
          focusY += taEntry.y;
        }
        setRect(srcRectData, (ksX+focusX)/texW, (ksY+focusY)/texH, focusW/texW, focusH/texH, false);

        const glTextureIdx = referGlTexIdxOrUpload0(gl, texKeyTrue);
        gl.activeTexture(gl.TEXTURE0 + glTextureIdx);
        gl.bindSampler(glTextureIdx, sampler);
        // TODO: ここを毎回実行したくない。samplerもtextureの方で管理したい
        const wrapOption = isWrapRepeat ? (isWrapMirrored ? gl.MIRRORED_REPEAT : gl.REPEAT) : gl.CLAMP_TO_EDGE;
        // TODO: scaleOptionも可変にしたい。しかし案外難しい…
        //       gl.TEXTURE_MAG_FILTER (拡大)は gl.LINEAR と gl.NEAREST の二択だが、
        //       gl.TEXTURE_MIN_FILTER (縮小)は上記に加えて、以下のmipmap系オプションがある。
        //       - gl.NEAREST_MIPMAP_NEAREST
        //       - gl.LINEAR_MIPMAP_NEAREST
        //       - gl.NEAREST_MIPMAP_LINEAR (無指定の時はこれになるらしい)
        //       - gl.LINEAR_MIPMAP_LINEAR
        //       だからmipmap系のオプションについては後で考えるとして、とりあえずisLinearもしくはisNearestのどちらかを導入したい。
        //       でも急がないので、後回しで。
        //       (なおmipmap系を使えるようにする場合、textureのgenerateMipmap対応も同時に行う必要があるので注意する事。これを忘れるとmipmapは使えない)
        const scaleOption = gl.NEAREST;
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, wrapOption);
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, wrapOption);
        gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, scaleOption);
        gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, scaleOption);
        gl.uniform1i(imageLocation, glTextureIdx);
      }

      // TODO: extraMatrixありの時の行列計算はかなり重い(extraMatrixなしなら軽い)。変動がない時は前回計算したvertMat4Dataを使い回せるとベターだが、予想以上に難しい
      //       この場合の「再計算が必要な時」は以下のパターンになる
      //       - まだ1回も計算していない時(当たり前)
      //       - 前回計算時からcanvasサイズが変動した時。しかしこれが案外判定がめんどい
      //         - 実行回数が少なければ「前回実行時のcanvasのwとhを記憶しておき、それと比較して違ってれば再計算」だけでよいのだけど、それをsprite描画全部でやる訳にはいかない。これを一番やりやすいのは、毎フレームの最初に1回だけcanvasのwとhのチェックを行い、違ってたら全matrixキャッシュを破棄する、というやり方だと思う。つまりsprite毎にmatrixを保持する必要があるのだけど、現状は全てを引数で渡している非オブジェクト指向の組み方をしているのでmatrixを保持しづらい。
      //           - 普通にキャッシュ領域も引数で渡していいのでは？
      mat4reset(vertMat4Data);
      if (extraMatrix) {
        // TODO: これだとbrppnでooaRatioLRもしくはooaRatioTBが1:1でない時に傾きが崩れる問題がある。おそらく「原点座標をずらしてから合成してまた元の原点座標に戻す」みたいなやり方にする必要があるのだが…
        mat4move(vertMat4Data, x, y, z);
        mat4compose(vertMat4Data, extraMatrix);
      } else {
        // equivalent to mat4move(vertMat4Data, x, y, z)
        vertMat4Data[12] = x;
        vertMat4Data[13] = y;
        vertMat4Data[14] = z;
        //vertMat4Data[15] = 1;
      }
      gl.uniformMatrix4fv(matrixUniformLocation, false, vertMat4Data);

      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, srcRectData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(texCoordAttributeLocation);
      gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      if (!extraDstRectData) {
        // 表示座標はvertMat4Dataで反映する。dstRectDataにはanchor値を反映
        // (これにより、extraMatrixによるrotateの中心もanchorに固定できる)
        setRect(
          dstRectData,
          (anchorX+1)*-0.5*w,
          (anchorY+1)*-0.5*h,
          w,
          h,
          true);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, (extraDstRectData ?? dstRectData), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform4f(colorLocation, r, g, b, a);
      const countOfVertices = isTriangle ? 3 : 4;
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, countOfVertices);

      if (!isGpArray) { break }
    }
    gl.bindVertexArray(null);
  };
};


export const renderSprite = (... args) => fetchGlFn(glFnSprite)(... args);
