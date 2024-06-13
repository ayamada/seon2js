

import * as Sh from "seon2js/sh";


const shAsync = async (shCode) => {
  const [err, stdout, stderr] = await Sh.shExecAsync(shCode);
  if (stdout.length) { console.log(stdout) }
  if (stderr.length) { console.error(stderr) }
  if (err) { throw err }
};


const baseTestAsync = async () => {
  await shAsync(`npx rimraf tmp`);
  await shAsync(`npx seon2js-build --src-dir scripts --dst-dir tmp`);
  await shAsync(`node tmp/generate-seon2js-vim.mjs > tmp/seon2js.vim`);
  // TODO: 外部コマンドのdiffに頼らないチェックに直す事
  await shAsync(`diff tmp/seon2js.vim ../ftdetect/seon2js.vim`);
  await shAsync(`npx rimraf tmp`);
  await shAsync(`npx seon2js-build --src scripts/generate-seon2js-vim.s2mjs --dst-dir tmp`);
  await shAsync(`node tmp/generate-seon2js-vim.mjs > tmp/seon2js.vim`);
  // TODO: 外部コマンドのdiffに頼らないチェックに直す事
  await shAsync(`diff tmp/seon2js.vim ../ftdetect/seon2js.vim`);
  await shAsync(`npx rimraf tmp`);
};


const bundleTestAsync = async () => {
  await shAsync(`npx rimraf tmp`);
  await shAsync(`npx seon2js-build --src-dir=test/bundle --dst-dir=tmp/src --bundle-out-file=tmp/test-bundle.js --bundle-entry-point=test/bundle/foo.mjs`);
  await shAsync(`node tmp/test-bundle.js | grep ababa > /dev/null`);
  await shAsync(`npx rimraf tmp`);
};


const main = async () => {
  await baseTestAsync();
  await bundleTestAsync();
};


main();


