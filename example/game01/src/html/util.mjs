// NB: iOSでは、touchstart起点ではurlを開く事ができない！
//     touchendもしくはclick起点で実行する事！
//     (Androidではtouchstartでも可能)
//     (PCはclick, mousedown, mouseupで可能、touch系は不可)
export const openUrl = (url) => {
  const a = document.createElement('a');
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
};


export const setHtmlTitle = (title) => document.title = title;


