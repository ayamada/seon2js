import {isReadyGl, fetchGlFn} from './glfn.mjs'


// テクスチャ実体は「生成/ロード」→「glテクスチャページ割り当て」→「使用」と
// 使用するまでの手間が大変なので、これらを名前付きパラメータで
// 参照できるようにした方がいい。それを管理するのがこのモジュール。
// テクスチャ実体は通常、imgもしくはcanvasのdom実体。
// なおスプライトシートも一つのテクスチャなので、これで扱う。
// (そこから個別の領域を切り出す部分は、個別にメタ情報で対応してもらう)


// TODO: 「texIdx0番は汎用で毎フレームuploadする用」の仕様は廃止！全てのtextureは必ずtexIdxにbindするか、ta経由でしか使えないようにしたい


// TODO: samplerパラメータの管理機能もここに入れたい。以下はspriteから持ってきたもの
////const wrapOption = isWrapRepeat ? (isWrapMirrored ? gl.MIRRORED_REPEAT : gl.REPEAT) : gl.CLAMP_TO_EDGE;
////// TODO: scaleOptionも可変にしたい。しかし案外難しい…
//////       gl.TEXTURE_MAG_FILTER (拡大)は gl.LINEAR と gl.NEAREST の二択だが、
//////       gl.TEXTURE_MIN_FILTER (縮小)は上記に加えて、以下のmipmap系オプションがある。
//////       - gl.NEAREST_MIPMAP_NEAREST
//////       - gl.LINEAR_MIPMAP_NEAREST
//////       - gl.NEAREST_MIPMAP_LINEAR (無指定の時はこれになるらしい)
//////       - gl.LINEAR_MIPMAP_LINEAR
//////       だからmipmap系のオプションについては後で考えるとして、とりあえずisLinearもしくはisNearestのどちらかを導入したい。
//////       でも急がないので、後回しで。
//////       (なおmipmap系を使えるようにする場合、textureのgenerateMipmap対応も同時に行う必要があるので注意する事。これを忘れるとmipmapは使えない)
//////       これ一旦mipmap系オプションのサポートなしで実装する方向で。TODOでだけ入れておく
////const scaleOption = gl.NEAREST;
////gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, wrapOption);
////gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, wrapOption);
////gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, scaleOption);
////gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, scaleOption);
////gl.uniform1i(imageLocation, glTextureIdx);


// TODO: generateMipmap対応


const presetStorage = {};


export const referTex = (gl, k) => gl.canvas.storage?.[k] || presetStorage[k] || makePreset[k]?.(k);


export const registerTex = (gl, k, dom) => {
  let storage = gl.canvas.storage;
  if (!storage) {
    storage = {};
    gl.canvas.storage = storage;
  }
  if (storage[k]) { throw new Error(`already registered ${k}`) }
  // TODO: 他に追加処理が必要なら追加する(atlas対応時あたりに必要になる)
  storage[k] = dom;
};
export const unregisterTex = (gl, k) => {
  const storage = gl.canvas.storage;
  const oldEntry = referTex(gl, k);
  if (!oldEntry) { throw new Error(`not registered ${k}`) }
  // TODO: 他に削除処理が必要なら追加する
  delete storage[k];
};
export const updateTex = (gl, k, dom) => {
  unregisterTex(gl, k);
  registerTex(gl, k, dom);
};




// WebGL2では、テクスチャ数は最低でも16以上使える事が保証されている。
// つまりtextureIdxは15までは確実に使える。この前提で組む事。
// (なお0番は動的割り当て用に常に空けておく事)

const uploadTexture = (gl, k, textureIdx) => {
  const dom = referTex(gl, k);
  if (!dom) { return }
  //console.log(k, `${dom.width}x${dom.height}`); // for debug これが毎フレーム出なくなればok
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + textureIdx);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // TODO: これが重い！処理時間のほとんどを使っている。これをいかになくせるかが鍵で、その為にはtaサポートが必須…
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dom);
  //gl.generateMipmap(gl.TEXTURE_2D); // TODO: 一部のテクスチャだけこれを実行したい。これを実行するかを動的に制御するには？
  return textureIdx;
};

const setupTbState = (gl) => {
  let tbState = gl.canvas.tbState;
  if (!tbState) {
    tbState = {
      k2glTexIdx: {},
      mutableIndices: [],
    };
    gl.canvas.tbState = tbState;
  }
  return tbState;
};

// assignAndUploadGlTexで割り当てられるtextureIdxは通常は一度セットしたら
// 後から変更はできない。しかしこの関数でmutableフラグを立てておく事で
// 後からの変更を可能にできる。
export const setMutableGlTex = (gl, textureIdx, isMutable) => {
  let tbState = setupTbState(gl);
  tbState.mutableIndices[textureIdx] = isMutable;
};

export const assignAndUploadGlTex = (gl, k, textureIdx) => {
  if (!textureIdx) { return } // 0番は常に空けておく
  let tbState = setupTbState(gl);
  const k2glTexIdx = tbState.k2glTexIdx;
  if (!tbState.isInstalled) {
    tbState.isInstalled = 1;
    fetchGlFn(function $uploadRegisteredTextures (gl) {
      Object.keys(k2glTexIdx).forEach((kk) => uploadTexture(gl, kk, k2glTexIdx[kk]));
      return (gl)=> {}; // dummy
    });
  }
  // もし既にtextureIdxを値として持つエントリがあるなら、先に消しておく
  let textureIdxIsAlreadyUsedBy;
  for (const kk in k2glTexIdx) {
    if (textureIdx === k2glTexIdx[kk]) { textureIdxIsAlreadyUsedBy = kk }
  }
  if (textureIdxIsAlreadyUsedBy) {
    if (tbState.mutableIndices[textureIdx]) {
      delete k2glTexIdx[textureIdxIsAlreadyUsedBy];
    } else if (k !== textureIdxIsAlreadyUsedBy) {
      // NB: kとtextureIdxIsAlreadyUsedByが同じ時のみ、再アップロードを許可する
      //     (元domが更新された際にこれが必要となる為)
      // TODO: 例外を投げるべきか投げないべきか、とても悩ましい
      throw new Error(`already assigned ${textureIdx} by ${textureIdxIsAlreadyUsedBy}`);
      //return;
    }
  }
  k2glTexIdx[k] = textureIdx;
  uploadTexture(gl, k, textureIdx);
};

export const referGlTexIdx = (gl, k) => gl.canvas.tbState?.k2glTexIdx[k];
export const referGlTexIdxOrUpload0 = (gl, k) => referGlTexIdx(gl, k) || uploadTexture(gl, k, 0);
export const referGlTex = (gl, k) => gl.canvas.tbState?.k2glTexIdx[k];
// あとは以下のようにするだけ(gl.samplerParameteri()とかをしておく必要はある)
// gl.uniform1i(u_texLocation, referGlTexIdxOrUpload0(gl, 'foo/bar'));


// 以下は組み込みで提供するテクスチャ
const makePreset = {
  'embed/white2x2': (k) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 2, 2);
    presetStorage[k] = canvas;
    return canvas;
  },
  // TODO: もっと追加する事
};


// 簡易的なta対応
export const createTa = (gl, k, textureIdx) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    canvas._assignTable = {}; // k => {x,y,w,h}
    registerTex(gl, k, canvas);
    assignAndUploadGlTex(gl, k, textureIdx);
  gl.canvas._taRevTable ||= {};
  return k;
};

const isCollided1d = (x1, w1, x2, w2) => {
  const c1 = x1 + w1/2;
  const c2 = x2 + w2/2;
  return Math.abs(c1 - c2)*2 < w1 + w2;
};
const isCollided2d = (rect1, rect2) => isCollided1d(rect1.x, rect1.w, rect2.x, rect2.w) && isCollided1d(rect1.y, rect1.h, rect2.y, rect2.h);

// ta更新の為にuploadTextureをする必要があるのだけど、1フレームに何度もta更新を実行するようなケースが結構あり、その度に同じテクスチャをアップロードするのは効率が悪いので避けたい。ので予約制にする
const uploadTextureLater = (gl, taKey) => {
  if (!gl.reservedTaKeyListsForUpload) { gl.reservedTaKeyListsForUpload = {} }
  gl.reservedTaKeyListsForUpload[taKey] = taKey;
};

const tmpA = [];

// NB: これはdotのrenderDotの直前に実行する事
export const executeUploadReservedTextures = (gl) => {
  if (gl.reservedTaKeyListsForUpload) {
    for (const taKey in gl.reservedTaKeyListsForUpload) {
      uploadTexture(gl, taKey, referGlTexIdx(gl, taKey));
      tmpA.push(taKey);
    }
    for (const taKey of tmpA) { delete gl.reservedTaKeyListsForUpload[taKey] }
    tmpA.length = 0;
  }
};

export const registerToTa = (gl, taKey, k, x, y, w=undefined, h=undefined) => {
  if (referTaEntry(gl, k)) { throw new Error(`already registered ${k}`) }
  const taCanvas = referTex(gl, taKey);
  if (!taCanvas) { throw new Error(`${taKey} not found`) }
  const assignTable = taCanvas._assignTable;
  const texDom = referTex(gl, k);
  if (!texDom) { throw new Error(`${k} not found`) }
  const texW = texDom.width;
  const texH = texDom.height;
  w ??= texW;
  h ??= texH;
  const texRect = { taKey: taKey, x: x, y: y, w: w, h: h };
  // TODO: is-devで衝突チェックの有無を決めたい
  if (1) {
    Object.keys(assignTable).forEach((aKey)=>{
      const aRect = assignTable[aKey];
      const aLeft = aRect.x;
      const aRight = aRect.x + aRect.w;
      const aTop = aRect.y;
      const aBottom = aRect.y + aRect.h;
      if ((taKey === aRect.taKey) && isCollided2d(texRect, aRect)) {
        throw new Error(`found collision between ${aKey} and ${k} in ${taKey}`);
      }
    });
  }
  // canvasコピーを実行
  const taCtx = taCanvas.getContext("2d");
  const texCtx = texDom.getContext?.("2d");
  if (texCtx) {
    // texDomはcanvasだった
    taCtx.putImageData(texCtx.getImageData(0, 0, w, h), x, y);
  } else {
    // texDomはimgだった
    taCtx.drawImage(texDom, 0, 0, texW, texH, x, y, w, h);
  }
  // glに再アップロードを予約
  uploadTextureLater(gl, taKey);
  // assignTableに登録
  assignTable[k] = texRect;
  // 高速で参照できるようにしておく
  gl.canvas._taRevTable[k] = texRect;
};


export const referTaEntry = (gl, k) => gl.canvas._taRevTable[k];


export const unregisterToTa = (gl, k) => {
  const taEntry = referTaEntry(gl, k);
  // TODO: エントリが存在してなかった時の対応を入れる事
  const taKey = taEntry.taKey;
  const taCanvas = referTex(gl, taKey);
  const assignTable = taCanvas._assignTable;
  // 該当領域のクリア
  const ctx = taCanvas.getContext("2d");
  ctx.clearRect(taEntry.x, taEntry.y, taEntry.w, taEntry.h);
  // assignTableから解除
  delete assignTable[k];
  // 高速参照テーブルからも削除
  delete gl.canvas._taRevTable[k];
  // glに再アップロードを予約
  uploadTextureLater(gl, taKey);
};

// unregisterToTa -> registerToTa する。テキスト系テクスチャ用。
// なおテキスト系テクスチャはサイズが変動するケースがあるので、
// 右側余白を大き目に確保した方がよい
// (レアケースだが、もし行数が増える場合は、下方向も大き目に確保する事)
export const reregisterToTa = (gl, k) => {
  const taEntry = referTaEntry(gl, k);
  unregisterToTa(gl, k);
  registerToTa(gl, taEntry.taKey, k, taEntry.x, taEntry.y);
};


export const testTaRegulation = (gl) => {
  console.log('started testTaRegulation');
  // TODO: 何をどうテストすればよい？？？？？？
  console.log('done testTaRegulation');
};


