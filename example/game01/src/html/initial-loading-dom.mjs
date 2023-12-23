// 既にdocument内に配置済の `initial-loading-dom` を操作するもの。
// 事前に、画面中央への配置とloadingアニメーションがdomとcssで設定しておく事。
// これを消したり、またデバッグやエラーメッセージ用途で書き換えたりする。
// 略称をildとする。


let domId;
export const setDomId = (id) => (domId = id);


const processDom = (proc) => proc(document.getElementById(domId));


export const hide = () => processDom((dom) => (dom && (dom.style.display = "none")));


// ild領域を仮のメッセージ領域として代用する。
// 初期ロード失敗時のエラー表示を行ったり、デバッグログを出したりするのに使う。
// 複数回実行された場合は、最後に実行された際のmsgのみが表示され、
// それ以前のmsgは消える。
export const displayMessageInterim = (msg) => processDom((dom) => {
  if (dom) {
    dom.style.display = "block";
    dom.style.zIndex = 500;
    dom.style.color = "#FFF";
    dom.style.backgroundColor = "#000";
    dom.textContent = msg;
  } else {
    alert(msg);
  }
});


