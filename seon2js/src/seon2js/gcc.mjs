import * as Sh from "./sh.mjs";


// オプション文字列を生成する補助ユーティリティ
// TODO: これjs風camelCaseではなく、gccのオプション名そのままの方が使いやすいと思う…。ただ、その場合は「全て」に対応する必要があり、結局extraOptionsだけでいいという事になる。それなら結局現状でよしとするしかないのでは？
export const buildOptionString = (options) => {
  const {
    compilationLevel="SIMPLE",
    languageOut="ECMASCRIPT_2021",
    formatting, // ="PRETTY_PRINT",
    extraOptions="",
  } = options;
  const result = [];
  // TODO: もっとカスタマイズ可能にしましょう
  if (compilationLevel) { result.push(`-O ${compilationLevel}`) }
  if (formatting) { result.push(`--formatting ${formatting}`) }
  if (languageOut) { result.push(`--language_out ${languageOut}`) }
  if (extraOptions) { result.push(extraOptions) }
  return result.join(' ');
};


// NB: これはgcc警告をstderrに出す。
//     またerror時は例外を投げる。
export const compileAsync = async (jsCode, options=undefined, isVerbose=undefined, isMjs=undefined) => {
  options = (options?.constructor === String) ? options : buildOptionString(options||{});
  return await Sh.shWithTmpFileAsync(jsCode, (f) => (`npx google-closure-compiler --js ${f} ${options}`), isVerbose, isMjs);
};


