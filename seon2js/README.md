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


## 不具合情報

- 現在のところ、 `#"..."` による正規表現記法内に出現するbackslash文字 ```\``` は、 ```\\``` のように二個入力する必要があります
    - 具体的には `(.split "123\n456" #"\\n")` のようにする事になります。これはclojureでの正規表現記法とは異なるので注意が必要です
    - これは正規表現記法の `#"..."` の内部のparse処理が、通常の文字列のtokenizerと共有しているのが原因です
    - 将来には直す予定ですが、その為にはseonのparserの大幅な改善が必要な為、当面はこの仕様のまま開発を進めます


## 分かりづらい用語＆一時メモ

- `r0is` `r1is` とは
    - `revised N implementation of seon2js` の略。要は[schemeのRnRS](https://standards.scheme.org/)相当
    - 互換性を大きく捨てて改善する際にNの数値を上げる
    - package.seon上のバージョンとの関係性についてはChangeLogを参照
      (major versionが一対一でNに対応している訳ではない事に要注意)

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
    - 将来的には `sp/import-s2sp` でもjs同様に `"foo/bar"` のdot prefixなし指定の自動resolveをできるようにしたい(`import` の方はjsレイヤで動くので対応済)


## ChangeLog

### r1is

An experiment of namespaced special-forms

- 3.0.0: 20240???
    - Add more options to `npx seon2js-build`
        - `--dst-file`
        - `--bundle-entry-point`
        - `--bundle-extra-args`
    - Remove `src/seon2js/gcc.mjs` and related codes
    - Add js reserved words to seon2js.vim

- 2.2.1: 20240401
    - Mark `sp/str` as like a fn for seon2js.vim

- 2.2.0: 20240401
    - Refactor and compact special.mjs and sp.s2sp
    - Many improvements for seon2js.vim

- 2.1.1: 20240330
    - Fix destructuring-bind like `(const {(sp/??= a 123)} obj)` to work

- 2.1.0: 20240329
    - Add `--src` option to `npx seon2js-build` that is alias of `--src-dir`
    - Support to target one source file directly
      by `--src-dir` option in `npx seon2js-build`
    - Update version of google-closure-compiler
    - Improve `npm run test-build` a bit

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
