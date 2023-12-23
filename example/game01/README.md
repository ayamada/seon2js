# example game 01

これはseon2js付属のサンプルゲームです。
seon2jsの開発が進むにつれ、動かなくなる可能性はあります。


## Iteration of development

1. `npm i`
2. `npm run http-api` at other console
3. `npm run s2js-watch` at another console
4. Open `http://127.0.0.1:3001/` by your browser
5. Edit `src/scratch.s2mjs` or other `src/*` files, and reload browser
6. If you extend seon2js itself, you can.
    - `npm run link-all`
    - Edit `../../seon2js/src/seon2js/lang/v0/s2.s2sp` or `../../seon2js/src/seon2js/lang/v0/s2.s2mjs`
    - Stop `npm run s2js-watch` process and Rerun `npm run s2js-watch`


## Deploy

You should stop processes of `npm run http-api` and `npm run s2js-watch`
before run deploy process.

- `npm run deploy-zip` to make all-in-one zip.
- `npm run deploy-http-test` to play this game of deployed version
  on `http://127.0.0.1:3001/` for operation check.


## 利用素材

- Lisp Alien: https://www.lisperati.com/logo.html のものをベースに改変
- 上記以外はayamada作成
