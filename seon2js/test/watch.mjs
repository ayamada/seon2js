

import * as Sh from "seon2js/sh";


//import * as Fs from 'node:fs';
//import * as Path from "node:path";
//import * as Os from "node:os";
//import * as NodeUtil from "node:util";
import * as Process from "node:process";
import * as ChildProcess from "node:child_process";


const shAsync = async (shCode) => {
  const [err, stdout, stderr] = await Sh.shExecAsync(shCode);
  if (stdout.length) { console.log(stdout) }
  if (stderr.length) { console.error(stderr) }
  if (err) { throw err }
};


//const baseTestAsync = async () => {
//  await shAsync(`npx rimraf tmp`);
//  await shAsync(`npx seon2js-build --src-dir scripts --dst-dir tmp`);
//  await shAsync(`node tmp/generate-seon2js-vim.mjs > tmp/seon2js.vim`);
//  // TODO: 外部コマンドのdiffに頼らないチェックに直す事
//  await shAsync(`diff tmp/seon2js.vim ../ftdetect/seon2js.vim`);
//  await shAsync(`npx rimraf tmp`);
//  await shAsync(`npx seon2js-build --src scripts/generate-seon2js-vim.s2mjs --dst-dir tmp`);
//  await shAsync(`node tmp/generate-seon2js-vim.mjs > tmp/seon2js.vim`);
//  // TODO: 外部コマンドのdiffに頼らないチェックに直す事
//  await shAsync(`diff tmp/seon2js.vim ../ftdetect/seon2js.vim`);
//  await shAsync(`npx rimraf tmp`);
//};


//const bundleTestAsync = async () => {
//  await shAsync(`npx rimraf tmp`);
//  await shAsync(`npx seon2js-build --src-dir=test/bundle --dst-dir=tmp/src --bundle-out-file=tmp/test-bundle.js --bundle-entry-point=test/bundle/foo.mjs`);
//  await shAsync(`node tmp/test-bundle.js | grep ababa > /dev/null`);
//  await shAsync(`npx rimraf tmp`);
//};

const sleepAsync = (msec) => (new Promise((r) => setTimeout(r, msec)));

const cmds = [
  'npx',
  [
    'seon2js-build',
    '--src-dir=test/invalid',
    '--dst-dir=tmp/src',
    '--watch',
  ],
  //{detached: true}, // NB: この引数を与えるべきなのかよくわからなかった
];

const main = async () => {
  await shAsync(`npx rimraf tmp`);
  const process = ChildProcess.spawn(... cmds);
  process.stdout.on('data', (data) => console.log(data.toString()));
  process.stderr.on('data', (data) => console.error(data.toString()));
  process.on('close', (code, signal) => console.log(`closed by code=${code} signal=${signal}`));
  process.on('exit', (code) => console.log(`exited by code=${code}`));
  process.on('error', (err) => console.error(err.toString()));
  await sleepAsync(1000);
  const isNotWatched = process.killed || (process.exitCode !== null);
  if (!isNotWatched) {
    console.log('process is alive, do to stop ...');
    process.kill('SIGHUP');
    await sleepAsync(100);
  }
  await shAsync(`npx rimraf tmp`);
  await sleepAsync(100);
  if (isNotWatched) {
    console.error('terminated watcher process of seon2js-build !!!');
    await sleepAsync(100);
    Process.exit(1);
  } else {
    console.log('all done.');
    await sleepAsync(100);
    Process.exit(0);
  }
};


main();


