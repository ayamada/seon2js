# seon2js

A transpiler from seon to js

See https://github.com/ayamada/seon2js


## Usage

### cli-seon2js-evaldump.mjs

```sh
npx seon2js -e '(console.log 1 2)'
```

To run seon2js code, like `node -e '...'`

```sh
npx seon2js -e '(console.log 1 2)' -d
```

To dump gcc(google-closure-compiler)-passed js code. Do not run.

```sh
npx seon2js -p '1 2 [3 4]'
```

To run and print last value, like `node -p '...'`
(but this code be warned by gcc)

```sh
npx seon2js foo.s2mjs
```

To run this file, like `node ...`
But this is experimental!
Not yet supported command line arguments.
You may use this with `-d` or `-t`.
If you run certainly, you should transpile and run transpiled file.

See `npx seon2js -h` for more information.


### cli-seon2js-build.mjs

```sh
npx seon2js-build --src-dir path/to/src --src-dir more/src --dst-dir path/to/html/mjs
```

To convert from all `*.s2mjs` and `*.s2js` files in `--src-dir`, to `--dst-dir`.

See `npx seon2js-build -h` for more information.


## 分かりづらい用語＆一時メモ

- `r0is` `r1is` とは
    - `revised N implementation of seon2js` の略。要はschemeのRnRS相当
    - 互換性を大きく捨てて改善する際にNの数値を上げる
    - androidやmacのosバージョン毎のコードネームにも近い
    - package.seon上のバージョンとの相互関係は基本ない
      (下手に関係を持たせるとnpm管理上の問題が発生する為)

- seon2jsにおける `transpile` と `compile` の使い分け
    - 「seon2jsコードをseon2jsでjsに変換する」 → `transpile`
    - 「(seon2jsの吐き出した)jsコードをgccで変換する」 → `compile`

- `sp` とは
    - `special-form` の略。lispのそれとほぼ同じ。macroもこれに含まれる
    - seon2jsはトランスパイラであり、コードの置換以外は基本何も行わないが、このspecial-form関連についてはトランスパイルのタイミングで何かしらの処理を実行する事ができる。もちろんユーザは好きなspを自分で追加できる
    - `sp` は `*.s2sp` ファイルで定義を行い、s2spファイルは `sp/import-s2sp` によって読み込める
    - このsp定義は基本的にはtranspile時に全て解消し、transpile後のjsコードには残らない。なので通常の関数と大きく区別しやすい見た目の方がよい。 `#()` 形式や名前を全て大文字にする等を色々試したがいまいちで、結局 `sp/` のprefix(専用namespace)をつけて区別するのが一番マシという結論になった。なので `sp` 定義は基本的に専用namespaceをつけるルールとしている
        - ただし標準提供しているものについてはあまりに基本機能なもの(例えば `if` とか)が多く、それらについては `sp/if` を提供すると同時にspなしの `if` も提供している。混乱しない範囲でこれらを使ってもよい(もし混乱するようならnamespace付きで使った方がよい)

- s2mjs/s2spで書いたライブラリの追加方法について
    - `seon2js-build` には複数の `--src-dir` 指定ができるので、追加ライブラリの各ファイルの入ったpathを `--src-dir` で指定すればok
    - それらは全部 `--dst-dir` 内に出力されるので、 `import` や `sp/import-s2sp` でのpath指定は `--dst-dir` 内での相対pathを指定する必要がある。ちょっとややっこしいが、基本的にはmjsでのモジュールと同じ感覚で扱える
    - 将来的には `sp/import-s2sp` でもjs同様に `"foo/bar"` の指定(`"./foo/bar.mjs"` とかではない)をできるようにしたい(`import` の方はjsレイヤで動くので対応済)


## ChangeLog

### r1is

- 2.0.0: 20240315
    - Provide `npx seon2js` for tests and run one-liner
    - Provide `npx seon2js-build` for build
        - Provide many transpile options
    - Renew almost special-forms
        - Provide tests for almost special-forms
    - Renew mangling rules for symbols and keywords
    - Provide `ftdetect/seon2js.vim` for vim/neovim
        - Please add plugin managers of vim/neovim to `"ayamada/seon2js"`
    - Bump up version of seon to 5.0.0
    - Remove `example/game01/` now, but may come new example games in future


### r0is

The initial prototype

- 0.1.2: 20231226
    - Bump up version of seon
    - Fix redundant error log
    - Fix test by `npm run test-s2js-once`

- 0.1.1: 20231223
    - Move chokidar from devDependencies to dependencies for cli

- 0.1.0: 20231223
    - Initial Release
