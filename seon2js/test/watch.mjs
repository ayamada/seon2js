

import * as Sh from "seon2js/sh";


import * as Process from "node:process";
import * as ChildProcess from "node:child_process";


const shAsync = async (shCode) => {
  const [err, stdout, stderr] = await Sh.shExecAsync(shCode);
  if (stdout.length) { console.log(stdout) }
  if (stderr.length) { console.error(stderr) }
  if (err) { throw err }
};


const sleepAsync = (msec) => (new Promise((r) => setTimeout(r, msec)));


const cmds = [
  'npx',
  [
    'seon2js-build',
    '--src-dir=test/invalid',
    '--dst-dir=tmp/src',
    '--watch',
  ],
  //{detached: true}, // これ入れても意味ない？
];


const main = async () => {
  await shAsync(`npx rimraf tmp`);
  const child = ChildProcess.spawn(... cmds);
  let runningLog = '';
  const processData = (data) => {
    const msg = data.toString();
    if (runningLog) { runningLog += "\n" }
    runningLog += msg;
    console.log(msg);
  };
  child.stdout.on('data', processData);
  child.stderr.on('data', processData);
  child.on('close', (code, signal) => console.log(`closed by code=${code} signal=${signal}`));
  child.on('exit', (code) => console.log(`exited by code=${code}`));
  child.on('error', (err) => console.error(err.toString()));
  await sleepAsync(1000);
  if (!runningLog) {
    // TODO: よくわからないが、1000msec待っても子プロセス側のトランスパイル処理が実行されない時がある(子プロセスは起動しているがstdoutに処理内容のログが出ない)。本当はちゃんと直さないといけないのだけど、このtestは手でしか実行しないので、このエラーが出たら再度実行し直せばすむ。今は放置する。あとでCI実行とかするようになったら原因を調べて直す事！
    throw new Error('could not bootstrap child transpiler, please retry');
  }
  if (child.killed || (child.exitCode !== null)) {
    console.error('FAILED: child process were already shutdowned !!!');
    await shAsync(`npx rimraf tmp`);
    await sleepAsync(100);
    Process.exit(1);
  }
  console.log('process is alive, do to stop ...');
  child.kill('SIGHUP');
  await sleepAsync(1000);
  //child.disconnect();
  //child.unref();
  console.log('all ok.');
  await shAsync(`npx rimraf tmp`);
  await sleepAsync(100);
  // TODO: 明示的にexitしないとプロセスが終わらない。子process関連で何か終了を阻害するものがあるっぽいのだけどよく分からない。テスト用途ではexit(0)でも問題ないので、将来に時間のある時の対応としたい
  Process.exit(0);
};


main();


