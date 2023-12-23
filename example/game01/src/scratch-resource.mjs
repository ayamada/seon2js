// scratch-old.mjs からリソース部分だけ分離したもの


import {VA} from "./foreign/asg-va99.min.mjs"
import * as htmlIld from "./html/initial-loading-dom.mjs"
import {referTex, registerTex, setMutableGlTex, assignAndUploadGlTex, referGlTexIdx, referGlTexIdxOrUpload0, createTa, registerToTa, referTaEntry, reregisterToTa, testTaRegulation} from "./canvas/gl/texture.mjs"
import {makeTextCanvas, makeTextCanvasAndRegisteredTexId, updateTextCanvas, updateTextCanvasAsync} from "./canvas/text.mjs"


// TODO: TEXのkeyはそのままtexture-bookのkeyに使われる為、mangling防止の為に敢えて文字列指定になっているが、これは圧縮効率が悪い。SEのように、manglingが利くような構成にしたい。考える事
export const TEX = {};
export const TEXKEY = {};
export const SE = {};
export const BGM = {};
export const DICT = {};


const SE_SRC = {};
const BGM_SRC = {};


export const mergeDict = (newEntriesObject) => Object.keys(newEntriesObject).forEach((k)=>(DICT[k] = newEntriesObject[k]));


const prepareAudioData = () => {
  // 音色の定義(ASGからのコピペ)
  const noiseFC = (isShortFreq=0, offset=0, div=1)=> {
    const cosineComplement = (a, b, p) => ((a+b)/2)-(b-a)*0.5*Math.cos(p*Math.PI);
    const roundedSquareComplement = (a, b, p, freqByTick, div=1) => cosineComplement(a, b, Math.min(1, p*Math.max(1, 0.5/div/freqByTick)));

    const prngMax = 0xFFFF;
    const memoize = [];
    const shiftAmount = isShortFreq ? 6 : 1;
    let loopCount;
    const prngFC = (times) => {
      if (times < 0) { return 0x8000 }
      if (loopCount) { times %= loopCount }
      if (memoize[times]) { return memoize[times] }
      let acc = prngFC(times-1);
      acc >>>= 1;
      acc |= ((acc ^ (acc >>> shiftAmount)) & 1) << 15;
      acc &= prngMax;
      if (acc === memoize[0]) { loopCount = times }
      memoize[times] = acc;
      return acc;
    };
    for (let i = 0; i <= offset; i++) { prngFC(i) } // prepare cache
    // TODO: noiseFCでもpinkPowerを指定できるようにしたい(noiseFCの場合は「同じ値が連続しやすくなる度合い」)
    // TODO: noiseGB同様に、memoize側で出力値も保持するようにする
    const idx2v = (idx) => ((prngFC(idx)&1)*2-1);
    //return (_, c) => idx2v(c+offset); // roundedSquareComplement なし版
    return (p, c, freqByTick) => roundedSquareComplement(
      idx2v(c+offset),
      idx2v(c+offset+1),
      p,
      freqByTick,
      div);
  };
  const noiseWhite = (pinkPower=1, offset=0, div=1) => {
    const isShortFreq = false;
    const cosineComplement = (a, b, p) => ((a+b)/2)-(b-a)*0.5*Math.cos(p*Math.PI);

    const prngMax = 0xFFFF;
    const memoize = [];
    const shiftAmount = isShortFreq ? 6 : 1;
    let loopCount;
    const prngFC = (times) => {
      if (times < 0) { return [0x8000, 0] }
      if (loopCount) { times %= loopCount }
      if (memoize[times]) { return memoize[times] }
      let acc = prngFC(times-1)[0];
      acc >>>= 1;
      acc |= ((acc ^ (acc >>> shiftAmount)) & 1) << 15;
      acc &= prngMax;
      if (acc === memoize[0]?.[0]) { loopCount = times }
      const result = [acc, (acc/prngMax)*2 - 1];
      memoize[times] = result;
      return result;
    };
    for (let i = 0; i <= offset; i++) { prngFC(i) } // prepare cache
    const idx2v = (idx) => {
      const n = prngFC(idx)[1];
      return Math.sign(n) * Math.pow(Math.abs(n), pinkPower);
    };
    return (p, c, freqByTick) => cosineComplement(
      idx2v(c+offset),
      idx2v(c+offset+1),
      p);
  };
  const wfSine = (p)=>Math.sin(p*2*Math.PI);

  // NB: 以下のデータの内、結局使わなかったものはコメントアウトする事(ロードが長くなる為)

  // SE
  SE_SRC.coin = [42.6,.3,[-1,1],,[,.02,.005,.5],[1,.8,.8],[,,6.6,6.6]];
  //SE_SRC.beep = [12,.8,[-1,1],,[,.05,.001],[1,1]];
  SE_SRC.puyojump = [3,1,[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1,.9,.8,.7,.6,.5,.4,.3,.2,.1,0,-0.1,-0.2,-0.3,-0.4,-0.5,-0.6,-0.7,-0.8,-0.9,-1,-0.9,-0.8,-0.7,-0.6,-0.5,-0.4,-0.3,-0.2,-0.1],,[.02,.02,.05],[1,1],[,12,24]];
  SE_SRC.caret = [33,.3,[-1,1],2,[,.01,.01,.01],[1,1,.02]];
  SE_SRC.submit = {i:[SE_SRC.caret],c:[[[!0,0,7,5280],[!0,0,3,.9],[-7],[-3],[0,8]]]};
  SE_SRC.error = {i:[[-15,1,[-1,1],2,[,.2,.01],[1,1]]],c:[[[!0,0,7,5280],[!0,0,3,.9],[0],[!1],[0,4]]]};
  //SE_SRC.healing = [10,1,[-1,1,1],2,[.01,.1,.1],[1,.2]];
  //SE_SRC.healed = {i:[SE_SRC.healing],c:[[[!0,0,7,3840],[!0,0,3,.9],[-7],[-3],[0,8]]]};
  SE_SRC.lvup = {i:[[-12,1,[0,.7,1,.7,-0.2,.5,-0.5,.2,-0.7,-1,-0.7],3,[.01,.01,.1,.2],[1,.2,.2],[]]],c:[[[!0,0,7,108],[!0,0,4,0],[!0,0,6,16],[!0,0,3,1],[17],[20],[22],[!0,0,3,.8],[32,2],[34],[29],[!0,3,2,4],[27,8]],[[!0,0,3,.5],[!0,0,6,16],[!0,0,4,-0.75],[10],[14],[17],[!0,0,4,.75],[24,2],[26],[!1],[!0,3,2,4],[!0,0,4,-0.75],[22,8]],[[!0,0,4,0],[!0,0,6,16],[!0,0,3,1],[2],[2],[!0,0,3,.7],[10],[10,2],[!1],[14],[!0,3,2,4],[15,8]]]};
  //SE_SRC.yarare = [36,1,(wfSine),,[.25,.25,.25,.25,.5,.75],[.9,.7,.5,.2,.1],[-6,-18,-30,-36,-42,-45],[.2,.2,.2,.2,.2,.2],[6,6,6,6,6,6],5,5];
  //SE_SRC.dot = [-6,.5,[(noiseFC),0],1,[0,.2,.2],[.5,1,.5]];

  // BGM
  BGM_SRC.dd2 = {i:[[36,.9,[noiseWhite,2],3,[.01,.01,.01,.01,.01],[.9,.4,.2,.1],[-2,-4,-6,-8,-9]]],c:[[[!0,0,7,240],[!0,3,6,16],[!0,0,3,.3],[!0,0,2,8],[48],[!0,0,3,.9],[!0,0,2,1],[1],[0],[-1],[!1],[1],[0],[-1]]]};
  BGM_SRC.bydlEx = {i:[[36,1,[noiseWhite,.1],2,[.01,.01,.1,.01],[.9,.5,.1],[0,-8,-9]]],c:[[[!0,0,7,1800],[!0,0,2,8],[0,4],[!0,0,2,1],[-7],[false],[-7,2]]]};
  BGM_SRC.xmas = {i:[[27,1,,3,[.01,.01,.1,.4],[1,.3,.2,0],,,[,.05,.05,.4],,5]],c:[[[!0,0,7,120],[!0,0,6,4],[4],[0],[2],[7],[4],[0],[2],[-5],[4],[0],[2],[7],[!0,0,7,96],[9],[11],[!0,0,2,5],[12,6]]]};

  // NB: ロード完了前でもObject.keysで一覧だけ見れるよう、
  //     placeholderだけ確保しておく(まだ音は鳴らない)
  Object.keys(SE_SRC).forEach((k)=> (SE[k] = undefined));
  Object.keys(BGM_SRC).forEach((k)=> (BGM[k] = undefined));
};


// TODO: 一件ずつawaitするのではなく、並列ダウンロード実行して、全部のダウンロードが終わるのをawaitするように直す事
const loadTextureAsync = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = (e) => reject(e);
  img.src = url;
});


export const setupText = (gl) => {
  const registerTexText = (texTextOptions, label, targetTa, taX, taY) => {
    const texKey = makeTextCanvasAndRegisteredTexId(gl, texTextOptions, label);
    registerToTa(gl, targetTa, texKey, taX, taY);
    return texKey;
  };

  const ta2 = createTa(gl, 'ta2', 2); // 文字ロゴ用

  // 内容固定の文字テクスチャはこの時点で用意しておく
  const texTextOptions = {
    ctx2dProps: {
      fillStyle: "#FFF", // character color and so on
      strokeStyle: "#333", // character outline color and so on
      miterLimit: 1,
    },
    fontResolution: 48,
  };
  //TEXKEY.texTextCheckin = registerTexText(texTextOptions, 'チェックイン！', ta2, 0, 1024);
  //TEXKEY.texTextCheckout = registerTexText(texTextOptions, 'チェックアウト！', ta2, 1024, 1024);
  TEXKEY.texTextRunout = registerTexText(texTextOptions, '何も持っていない！', ta2, 0, 1024+256);
  TEXKEY.texTextAck = registerTexText(texTextOptions, '！？', ta2, 1024, 1024+256);
  TEXKEY.texTextSnow = registerTexText({
    ctx2dProps: {
      fillStyle: "#FFF",
      strokeStyle: "rgba(0,0,0,0)",
    },
    marginRatioFallback: 0.05,
    fontResolution: 192,
    strokeWidthRatio: 0, // ratio by fontResolution
    trimCanvas: 1,
  }, '●', ta2, 0, 512+256);
  const indicatorOptions = {
    ctx2dProps: {
      fillStyle: "#FFF", // character color and so on
      strokeStyle: "#333", // character outline color and so on
      miterLimit: 2,
    },
    fontResolution: 96,
  };
  TEXKEY.texTextIndicatorLeft = registerTexText(indicatorOptions, '←', ta2, 0, 512);
  TEXKEY.texTextIndicatorRight = registerTexText(indicatorOptions, '→', ta2, 256, 512);
  const descTextOptions = {
    ctx2dProps: {
      fillStyle: "#FFF", // character color and so on
      strokeStyle: "rgba(63,63,63,0.5)", // character outline color and so on
      miterLimit: 3,
    },
    //fontFamily: "serif",
    fontResolution: 48,
    //lineHeightRatio: 1.2,
    marginRatioFallback: 0.1,
    strokeWidthRatio: 0.2,
  };
  TEXKEY.texTextTitleSubText = registerTexText(descTextOptions, DICT.titleSubText, ta2, 512, 512+256+128);
  TEXKEY.texTextVersionText = registerTexText(descTextOptions, DICT.versionText, ta2, 512, 512+128);
  const logoOptions = {
    ctx2dProps: {
      //fillStyle: "#F00", // character color and so on
      //strokeStyle: "#070", // character outline color and so on
      fillStyle: "#0B0", // character color and so on
      strokeStyle: "#700", // character outline color and so on
      miterLimit: 20,
    },
    align: "center",
    fontFamily: "serif",
    fontResolution: 96,
    lineHeightRatio: 1.2,
    marginRatioFallback: 0.1,
    strokeWidthRatio: 1.5,
  };
  TEXKEY.texTextTitleLogo = registerTexText(logoOptions, DICT.titleText, ta2, 0, 0);
  TEXKEY.texTextEndingLogo = registerTexText(logoOptions, DICT.endingText, ta2, 0, 1024+512);
};





export const loadAll = async (gl) => {
  // TODO: 結局使わなかったものはコメントアウトする事！

  // load textures (await)
  try {
    TEX['scratch/tinyelf'] = await loadTextureAsync("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAPCAMAAADnP957AAAAAXNSR0IArs4c6QAAAB5QTFRFAAAA/+wn////AOQ2/8yqAIdR/6MAq1I2Ka3/AAAANYLk7wAAAAp0Uk5TAP///////////36JFFYAAABDSURBVAiZbY1RCsAwCEMtjZbc/8KLw9oy9vzJU1GzD0x2HgmvXMYRooVAdvgKRE88wvvCFF4ZLlCPeAa1tsW4VL/SPL+fAfagHZb8AAAAAElFTkSuQmCC");
    //TEX['scratch/btn-flat'] = await loadTextureAsync("./img/btn-flat.png"); // 64x64(縦4横4)
    //TEX['scratch/btn-neon'] = await loadTextureAsync("./img/btn-neon.png"); // 128x32(横4)
    TEX['scratch/nova'] = await loadTextureAsync("./img/nova.png"); // 64x64
    //TEX['scratch/shiirare'] = await loadTextureAsync("./img/shiirare.png"); // 256x256
    TEX['scratch/lisper'] = await loadTextureAsync("./img/lisplogo_alien.svg");
    TEX['scratch/lispernoflag'] = await loadTextureAsync("./img/lispernoflag.svg");
    TEX['scratch/flag'] = await loadTextureAsync("./img/flag.svg");
    TEX['xmas/xmammoth'] = await loadTextureAsync("./img/xmammoth.png");
    //TEX['xmas/bag'] = await loadTextureAsync("./img/xmas-bag.png");
    TEX['xmas/box'] = await loadTextureAsync("./img/xmas-box.png");
    TEX['xmas/hat'] = await loadTextureAsync("./img/xmas-hat.png");
    TEX['xmas/tree'] = await loadTextureAsync("./img/xmas-tree.png");
    TEX['effect/shiirare'] = await loadTextureAsync("./img/shiirare.png");
  } catch (e) {
    console.log(e);
    htmlIld.displayMessageInterim('ロードに失敗しました');
    return;
  }

  Object.keys(TEX).forEach((k)=> registerTex(gl, k, TEX[k]));

  const ta1 = createTa(gl, 'ta1', 1); // 小スプライト用
  registerToTa(gl, ta1, 'scratch/nova', 256, 0); // 64x64
  registerToTa(gl, ta1, 'scratch/tinyelf', 256+128, 0); // 12x15
  // svgはサイズ指定必須
  registerToTa(gl, ta1, 'scratch/lisper', 1024, 0, 530/300*256, 256);
  registerToTa(gl, ta1, 'scratch/lispernoflag', 1024+512, 0, 530/300*256, 256);
  registerToTa(gl, ta1, 'scratch/flag', 1024+512, 256, 170/140*256, 256);
  registerToTa(gl, ta1, 'xmas/xmammoth', 0, 0); // 224x512
  registerToTa(gl, ta1, 'xmas/tree', 256, 256); // 64x128x2
  //registerToTa(gl, ta1, 'xmas/bag', 256+128, 256); // 64x64x2
  registerToTa(gl, ta1, 'xmas/hat', 256+256, 256); // 64x64x2
  registerToTa(gl, ta1, 'xmas/box', 256+256+128, 256); // 64x64
  registerToTa(gl, ta1, 'effect/shiirare', 0, 512); // 256x256


  // TODO: 可能なら以下もta1に登録したい(これは汎用的すぎ、予測不可能な問題が出る可能性が高いので、今は専用のtexIdxを割り当てている)
  assignAndUploadGlTex(gl, 'embed/white2x2', 14);


  prepareAudioData();

  // load prior audio (NOT lazy)
  //SE.submit = await VA.L(SE_SRC.submit);
  SE.launch = await VA.L("audio/launch-psg.m4a");
  //BGM.dd2 = await VA.L(BGM_SRC.dd2);
  //BGM.dandd = await VA.L("audio/dandd.m4a");

  // load SE from SE_SRC (lazy)
  Object.entries(SE_SRC).forEach(([k,v])=>{
    VA.L(v).then((se)=>SE[k]=se);
  });
  // load extra SE (lazy)
  VA.L("audio/attack1-psg.m4a").then((b) => SE.attack1 = b );
  VA.L("audio/unidentified.m4a").then((b) => SE.unidentified = b );
  //VA.L("audio/grow-psg.m4a").then((b) => SE.grow = b );
  VA.L("audio/paan-psg.m4a").then((b) => SE.paan = b );
  //VA.L("audio/wind00.m4a").then((b) => SE.wind00 = b );
  VA.L("audio/shootout-psg.m4a").then((b) => SE.shootout = b );
  //VA.L("audio/launch-psg.m4a").then((b) => SE.launch = b );

  // load BGM from BGM_SRC (lazy)
  Object.entries(BGM_SRC).forEach(([k,v])=>{
    VA.L(v).then((bgm)=>BGM[k]=bgm);
  });

  // load extra BGM (lazy)
  //VA.L("audio/dandd.m4a").then((b) => BGM.dandd = b );
};


