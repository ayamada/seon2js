

const process = require("node:process");
const fs = require('node:fs');

const { execSync } = require('node:child_process');
const sh = (cmd, opts) => {
  try {
    const result = execSync(cmd, opts).toString().trim();
    if (result) { console.log(result) }
  } catch (err) {
    console.log(err.stdout.toString());
    console.log(err.stderr.toString());
    console.log(err.message);
    //throw err; // too long and difficult
    process.exit(1);
  }
}




const main = () => {
  // 最初に必須コマンドの有無を調べる
  sh('which zip > /dev/null');

  // ビルドディレクトリの用意(事前に削除されているものとする)
  sh('mkdir -p build 2>&1');

  // build 配下に必須ファイルをコピー
  sh('cp -a html build/ 2>&1');
  // NB: これだけでよい筈だが…

  // build/html/m.min.js を生成
  sh('npm run make 2>&1');

  // NB: ここ以降のshコマンドは基本的に {cwd: 'build'} をつける

  // デプロイに不要なファイルの削除
  sh('rimraf html/m.js 2>&1', {cwd: 'build'});
  sh('rimraf html/mjs/ 2>&1', {cwd: 'build'});
  sh('rimraf html/m.min.js.map 2>&1', {cwd: 'build'});

  // m.min.js を m.js として配置
  sh('mv html/m.min.js html/m.js 2>&1', {cwd: 'build'});

  // zipに固める
  sh('zip -r ../www.zip html 2>&1', {cwd: 'build'});

  // NB: deploy-http-test の為に build/ は消さずに放置する
  console.log('all done.');
};



main();
