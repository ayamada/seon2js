import * as Fs from 'node:fs';
import * as Path from "node:path";
import * as Process from "node:process";
import * as Os from "node:os";
import * as NodeUtil from "node:util";
import * as ChildProcess from "node:child_process";


// NB: これの使い方は↓のshWithTmpFileAsync内の呼び出し部を参照。
//     必ず返り値の処理を行う事！
export const shExecAsync = (shCode) => new Promise((resolve, reject) => ChildProcess.exec(shCode, (... args) => resolve(args)));


// この関数は以下の処理を順に行う
// - 引数のcontentを、安全にランダム生成したtmpFilenameに書き出す
// - shCodeGenFn(tmpFilename)を実行し、shコマンド文字列を生成する
// - 生成されたshコマンドを実行し、実行結果を取得する。
//   この際にshコマンドがstderrに何か出していれば、それを本来のstderrに出す
// - tmpFilenameを削除する
// - shコマンドのexit-codeが0以外であるなら例外を投げる
// - そうでなければ、shコマンドのstdoutを呼出元に返す
export const shWithTmpFileAsync = async (content, shCodeGenFn, isVerbose=undefined, isMjs=undefined) => {
  const tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 's2js-'));
  const tmpFileExt = isMjs ? 'mjs' : 'js';
  const tmpFilename = Path.join(tmpDir, 'tmp.'+tmpFileExt);
  Fs.writeFileSync(tmpFilename, content);
  const shCode = shCodeGenFn(tmpFilename);
  if (isVerbose) { console.error(shCode) }
  const [err, stdout, stderr] = await shExecAsync(shCode);
  Fs.rmSync(tmpDir, {recursive: true, force: true});
  if (stderr.length) { console.error(stderr) }
  if (err) { throw err }
  return stdout;
};


