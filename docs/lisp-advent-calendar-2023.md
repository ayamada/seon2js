# lisp->jsトランスパイラ『seon2js』の紹介

これは [Lisp Advent Calendar 2023](https://adventar.org/calendars/9364) 24日目の記事です。

(追記：seon2js本体の更新に伴い、あちこち古くなっています。とりあえずseon2js内のソースを示すurlについては当時のブランチ内を指すurlに差し替えました)


## 最初にまとめ

- 実験的に『seon2js』という自作lisp->jsトランスパイラ作った
- それを部分的に使いブラウザゲームつくった。以下のurlから遊べる
    - https://ayamada.itch.io/xmas2023
- ソースはここのgithubにあるから見たい人は見ればいい
    - ただし突貫で作ったので作りが雑だしドキュメントはない
    - (追記：seon2jsは本体が更新され、当時のものから大きく変化しました。当時のものは[release/r0is](https://github.com/ayamada/seon2js/tree/release/r0is)ブランチから確認してください)
- あとは読まなくていい…とりあえずゲームあそんで帰ってくれ！


## 質疑応答

![nekov](./nekov.gif?raw=true) 「seon2jsって何？」

> ![obav](./obav.gif?raw=true) 「私の作った、lisp->jsトランスパイラだ」

![nekov](./nekov.gif?raw=true) 「もう実用的なlisp処理系もaltjsもたくさんあるよ。それなのに新しいやつが必要なの？」

> ![obav](./obav.gif?raw=true) 「私が本当にやりたいのは『ブラウザ上で動作する』『ロードと起動時間最小』のミニゲームを『量産』する事だ。この三つの条件を全て満たす開発ツールはなかった！だから作ったのだ」

> ![obav](./obav.gif?raw=true) 「『ブラウザ上で動作する』にはjsもしくはwasmで動かせばよいし、そういうゲームエンジンも多数ある。だが『ロードと起動時間最小』にするにはライブラリやランタイムの厳選が必要であり、ここでほとんどのゲームエンジンとlisp処理系が脱落する。にも関わらず最後の『量産』の為にはDSLを構築し育てていく事が必須であり、lispの助けが必要になるのだ」

![nekov](./nekov.gif?raw=true) 「なんでそんなロード最小ミニブラゲにこだわるの？」

> ![obav](./obav.gif?raw=true) 「それはこの記事では重要ではない。この記事のずっと下の方に書いておくが、別に読まなくて問題はない」

![nekov](./nekov.gif?raw=true) 「じゃあそのseon2jsって役に立つの？」

> ![obav](./obav.gif?raw=true) 「『ブラウザ上で動作する』『ロードと起動時間最小』のミニゲームを『量産』する用途には役に立つだろう。作った目的がそれだからな。だがそれ以外の用途については未知数だ。普通のlisperがwebフロントエンドをいじりたいのであれば[BiwaScheme](https://www.biwascheme.org/)や[shadow-cljs](https://github.com/thheller/shadow-cljs)等を試した方がずっと良いだろう」

![nekov](./nekov.gif?raw=true) 「seon2jsって使いやすい？」

> ![obav](./obav.gif?raw=true) 「使いづらいぞ！インタープリタはjsそのものだ！数値の0や空文字列が偽値判定だったりという『歴史ある』仕様が満載だ！」

> ![obav](./obav.gif?raw=true) 「もちろんlispなのでマクロでラッピング等して使いやすくはできる。だがそれは少しずつだが『ロード最小』から離反していく。だから敢えて基本はjsそのものをなるべく残すようにした」

![nekov](./nekov.gif?raw=true) 「seon2jsの2jsはワカル。でもseonって何？」

> ![obav](./obav.gif?raw=true) 「lispはS式で書くものだが、標準のjs環境ではjsonしかまともに扱えるS式相当がない。jsonは許容不可能なS式すぎる、あまりにも。だからjsonの代わりにまともに使えるS式相当をまず用意する必要があった。それが `S-Expression-Object-Notation` 、seonだ」

> ![obav](./obav.gif?raw=true) 「要は『S式で書けるjson』と言って大体問題ない。記法は多くを[clojureのedn](https://github.com/edn-format/edn)から持ってき、一部をschemeからつけ足した」

![nekov](./nekov.gif?raw=true) 「seonどんな感じなの？」

> ![obav](./obav.gif?raw=true) 「このプロジェクトの [package.seon](https://github.com/ayamada/seon2js/blob/release/r0is/seon/package.seon) を見てもらおうか。これで全部という訳ではないが大体こういう感じだ。見ての通り、大部分がedn互換になっている」

> ![obav](./obav.gif?raw=true) 「この `*.seon` ファイルを `*.json` ファイルに変換するcliツールを標準でつけてある。つまりさっきの `package.seon` から、このプロジェクトの `package.json` が実際に変換生成されているという訳だ」

> ![obav](./obav.gif?raw=true) 「もちろん、この変換機能がメインという訳ではない、これはあくまでおまけだ、本命はlisp作る方だからな。このseonの本来の役目は『汎用readライブラリ』だ」

> ![obav](./obav.gif?raw=true) 「なおsymbolとkeywordはseon内部では別物として区別されるが、上記cliツールでjsonに書き出す際のみ特別に、どちらも単なる文字列に変換している。全くjsonは許容不可能なS式すぎて困ったものだ」

![nekov](./nekov.gif?raw=true) 「へえ、なるほど。じゃあこれ使ったら自作lisp作り放題じゃないの？」

> ![obav](./obav.gif?raw=true) 「いいところに目をつけたな！その通りだ！…なんでこのような構造にしているかという理由はちょっと長くなる」

> ![obav](./obav.gif?raw=true) 「ある程度開発をやった人なら分かるだろうが、『品質の良いソフトウェア』を極めようとしたら、ドッグフーディングとかインクリメンタル開発とかイテレーティブとかPDCAサイクルとか色々あるが何にせよ『ループ』を『高速』で回す必要がある。『ループ』の方はなんでも好きなやつを選べばいいが、開発面を『高速』で回すにはDSLの助けが必要不可欠だ。そしてどういうDSLが最適なのかは開発対象の性質によって大きく差がある上、ある程度開発をやってみない事には『あるDSLがどれぐらい最適なのか』すら分からないのだ。つまり『開発を始める前に、一番最適なDSLを選択/設計する』事は不可能だ。だから『開発しながら、同時にDSLも育成していく』しかないのだが、それが可能な言語には何がある？だから結局lispしか勝たんのだ。だがそのlispすら今言った法則には勝てない。『最初に完璧な設計をする事はできない』のだ。だからいつでも新しいlisp処理系を作り直せるような構造にした。そういう事だ」

![nekov](./nekov.gif?raw=true) 「seonってどう読むの？」

> ![obav](./obav.gif?raw=true) 「neonがネオンなのだから、seonはセオンだろうと思っていたが、実はneonは英語だとニーアン(`[ˈniːɒn]`)らしい。好きに読め！私はnginx=ヌギンクス派だ！」

![nekov](./nekov.gif?raw=true) 「seonだけ使ってもいい？」

> ![obav](./obav.gif?raw=true) 「いいぞ！ [https://www.npmjs.com/package/seon](https://www.npmjs.com/package/seon) から持っていってくれ。ライセンスはzlibだ」

![nekov](./nekov.gif?raw=true) 「なんでzlibライセンスなの？」

> ![obav](./obav.gif?raw=true) 「先に書いたように、seon2jsは『ロード最小ミニブラゲ量産』の為のものだが、ちょろっとミニゲーム作ってウェブに置く際に、いちいちライセンス記載とか面倒だしサイズの無駄だ！しかしだからといって[public domain](https://ja.wikipedia.org/wiki/%E3%83%91%E3%83%96%E3%83%AA%E3%83%83%E3%82%AF%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3)や[CC0](https://creativecommons.jp/sciencecommons/aboutcc0/)や[Unlicense](https://unlicense.org/)にするのは万が一裁判所案件にでもなった際に不利になる可能性が0ではない、なぜならこれらは「著作者が権利を放棄する」内容のものとみなされるからだ。そういう不安を少しでもなくす為に一般的なオープンソースライセンスを採用したいのだが、『製品へのライセンス表示をしなくてもいい』と明確に記載してある一般的オープンソースライセンスは私の知る限り[zlib](https://ja.wikipedia.org/wiki/Zlib_License)しかないのだ！」

> ![obav](./obav.gif?raw=true) 「もちろんトランスパイラ本体だけzlibライセンスであっても仕方ないので、描画ライブラリや音響ライブラリも『ロード最小ミニブラゲ』向きのものを自作している。これらもzlibライセンスだ」

![nekov](./nekov.gif?raw=true) 「ふーん。じゃあseon2jsの方はどんな感じのコードになるの？」

> ![obav](./obav.gif?raw=true) 「ゲームのソースは https://github.com/ayamada/seon2js/tree/release/r0is/example/game01/ 内にあるが、以前から作っていたゲーム用jsライブラリが多く、seon2jsのコードはまだわずかだ。とりあえず https://github.com/ayamada/seon2js/blob/release/r0is/example/game01/src/scratch.s2mjs あたりを見てみてくれ」

> ![obav](./obav.gif?raw=true) 「seon2jsのソースファイルの拡張子は `.s2mjs` もしくは `.s2js` となっている。トランスパイラには引数として入力(監視)ディレクトリと出力ディレクトリを指定する。入力ディレクトリ中に入っている `.mjs` や `.js` ファイルはそのまま出力ディレクトリへとコピーされる。 `.s2mjs` や `.s2js` ファイルはトランスパイルして `.mjs` や `.js` に変換されて出力ディレクトリへと書き出される。そういう形式だ」

![nekov](./nekov.gif?raw=true) 「見てみたよ。これだけ？量少なくない？」

> ![obav](./obav.gif?raw=true) 「色々あって開発時間が少ないのだ…。最終的には、末端のjsライブラリ部分を除き、全部s2mjs化したいのだが、まだ全然進んでいない。ゲーム部分のコードも過去からの使い回しばかりだ」

![nekov](./nekov.gif?raw=true) 「seon2jsは『自作lisp』って言ってるけど、実際のコード見てみた感じ、これものすごくclojure寄りじゃない？」

> ![obav](./obav.gif?raw=true) 「言語としてのclojureは良い部分が多く、結果として参考にした部分も多くなった。またclojureの基本データ構造は `[]` と `{}` を多用するので、これもjsとの親和性が高かった。jsのobjectはimmutableではないが、これはこれでGCを起こしづらいというメリットもある」

> ![obav](./obav.gif?raw=true) 「とは言え、clojureにも `,` を `unquote` ではなく単なるspace(delimiter)文字にしてしまった等の個人的に気に入らない仕様があちこちにあり、そういう部分はこの際だからlisp寄りに戻しておきたい。そうなると必然的にclojureから離れるしかない。だからseon2jsはclojureを非常に参考にしてはいるが、clojure互換にはなれないのだ」

![nekov](./nekov.gif?raw=true) 「リファレンスとかないの？」

> ![obav](./obav.gif?raw=true) 「そんな時間の余裕はなかった、すまんな。だが未来には作られている事だろう。今は直にメインライブラリのソースを見てくれ。 https://github.com/ayamada/seon2js/blob/release/r0is/seon2js/src/seon2js/lang/v0/s2.s2sp に後述するdefspecial定義がたくさん入っている。また https://github.com/ayamada/seon2js/blob/release/r0is/seon2js/src/seon2js/lang/v0/s2.s2mjs の方には関数が少しだけ入っている」

![nekov](./nekov.gif?raw=true) 「こっちも見てみたよ。あとseon2jsトランスパイラ自体のソースコードも見てみた。これちょっと雑すぎない？」

> ![obav](./obav.gif?raw=true) 「時間がなかなか取れないのだ…。現行のseon2jsは一種のリファレンス実装であり、『実際に作る事が可能だ』という実証実験に成功した段階だ、と言っていい。今後の発展と共に、マシになっていく予定だ」

![nekov](./nekov.gif?raw=true) 「DSLDSLってうるさく言ってたけど、その割にはseon2jsは `defmacro` 提供してなくない？」

> ![obav](./obav.gif?raw=true) 「jsにトランスパイルする関係で、マクロ展開フェーズでのコード実行環境の保証が案外大変だったので `defmacro` 実装は延期した。代わりにjsコードを実行できる `defspecial` が提供されているので、今はそっちで代用してほしい。 https://github.com/ayamada/seon2js/blob/release/r0is/seon2js/src/seon2js/lang/v0/s2.s2sp あたりが参考になるだろう」

![nekov](./nekov.gif?raw=true) 「seon2jsのトランスパイルを実行してみたけど、生成されたjsのサイズ別に小さくないよ」

> ![obav](./obav.gif?raw=true) 「seon2jsで生成したjsコードは最後にまとめて[google-closure-compiler](https://github.com/google/closure-compiler/)の `ADVANCED` 最適化にかけられ、ここで不要コード除去等のminify処理がなされる想定だ。この後のサイズを見て判断する必要がある。サンプルゲームの [package.seon](https://github.com/ayamada/seon2js/blob/release/r0is/example/game01/package.seon) 内にもこれをかける処理を書いてある。こういう感じで使う事になるだろう」

> ![obav](./obav.gif?raw=true) 「このサンプルゲームの最終的なjsファイルのサイズは大体50kだ。これでもまだ大きく、後述の[js13kGames](https://js13kgames.com/)に参加できるレベルには達していない。もっとseon2js化を進め、より小さいサイズにできるようにする事も将来の課題の一つだ」

> ![obav](./obav.gif?raw=true) 「なおゲームの場合はjsファイル以外の各種リソースファイルのサイズも大きくなる問題はあるが、それはまた別の話とさせてもらう。大体はメガデモみたいな方向性で解決すると思ってもらっていい」

![nekov](./nekov.gif?raw=true) 「seonのアイデアはいいけど、この実装だと微妙に扱いづらいね。seonを元に自前で別ライブラリや別lispを実装してもいい？」

> ![obav](./obav.gif?raw=true) 「いいぞ！いい出来になったら私にも使わせてくれ！だからライセンスは可能ならzlibでお願いしたい。理由は前述の通りだ」

![nekov](./nekov.gif?raw=true) 「こういう言語処理系って、未来に処理系自体のアップデートが止まったらつらくない？seon2jsのメンテいつまでも続けてくれるの？」

> ![obav](./obav.gif?raw=true) 「seon2jsはモジュール(ファイル)単位でトランスパイルされる関係で、変換後は素のjsモジュールとして扱える。だから、もし未来にseon2jsのメンテが止まっても、seon2jsで書いたコードをjs出力して、以降は単なるjsコードとしてメンテしていく手が一応使える。pretty-printし直したりといった再調整作業は必要だが」

> ![obav](./obav.gif?raw=true) 「もちろんブラウザ組み込みの処理系としてのjsそのものがobsoletedになる時代が来たら終わりだ。だがその時代は当面は来なさそうに見える、まだ今のところはな」


## 利用ツール/類似ツールの紹介

![ulv](./ulv.gif?raw=true) seon2jsで利用しているやつ

- [node, npm](https://nodejs.org/)
    - ブラウザなしでjsをインタプリタ実行するやつ。他のやつでもいいが、トランスパイルした後は関係なくなるのでどれでもよく、とりあえず一番普及しているnodeを採用
- [chokidar](https://github.com/paulmillr/chokidar)
    - ファイル更新監視してくれるnode向けjsライブラリ。これを使って `--watch` オプションを実装している


![ulv](./ulv.gif?raw=true) サンプルゲームで利用しているやつ

- [google-closure-compiler](https://github.com/google/closure-compiler/)
    - minifyの肝。minify能力は同系統ツールの中でもトップクラスだが癖が強く扱うのは大変。こいつにとって `foo.bar` と `foo['bar']` は別物
- [VA99](https://github.com/ayamada/va99)
    - 自作の最小構成音響再生ライブラリ。ファイルサイズは2k。zlibライセンス
- 自作の最小構成音源動的生成ライブラリ(名称未定、公開準備中)
    - もうちょい仕様と動作が固まったらパッケージ作ってgithubとnpmに置きます
- 自作の最小構成WebGLライブラリ(名称未定、公開準備中)
    - もうちょい仕様と動作が固まったらパッケージ作ってgithubとnpmに置きます


![ulv](./ulv.gif?raw=true) 直接関連がある訳ではないけどseon2jsと似たような目的のやつ

- [squint-cljs](https://github.com/squint-cljs/squint), [cherry-cljs](https://github.com/squint-cljs/cherry)
    - https://zenn.dev/uochan/articles/2023-12-09-play-with-squint に紹介記事あり
    - cljsをmjsにトランスパイルしてくれるやつ。seon2jsと方向性が近いが、seon2jsとは違い、大体clojure準拠。だがjs上にclojureを再現しようとすればするほどビルドサイズも増えてしまう


## 質疑応答(2)

> ![obav](./obav.gif?raw=true) 「ここからは、読まなくてもいい奴だぞ！」

![nekov](./nekov.gif?raw=true) 「どうして『ロード最小ミニブラゲ』作りたいの？」

> ![obav](./obav.gif?raw=true) 「SNSで数ページずつのらくがき(と言えない高レベルなものの方が多数だが)漫画を量産公開している人達がいて、その人達をフォローしておくと、その人の新作がどんどんタイムラインに流れてきて楽しめる。要はこれのゲーム版をやりたいのだ、私は」

> ![obav](./obav.gif?raw=true) 「だから『google playやapp storeやsteamでインストールしてね』という形にはできない。プレイ時間が数分のミニゲームを公開したり遊んだりするだけなのにストアを通すような手間はかけられないし、G社とかA社とかに依存したくないし、審査とかしんどくて何もかも不毛だからだ。SNSのショートメッセージ内のurlを開いたらすぐロード完了して即座にプレイできないといけない」

> ![obav](./obav.gif?raw=true) 「同じ理由で、ローディングロゴとか見ながら待たされるようなものも全然駄目だ。仮想敵が『SNSのらくがき漫画連載』なのに、ロゴ表示が終わるのを待たされるようではもうその時点で負けというかゲーム遊んでもらう前にページ閉じられるぞ！」

> ![obav](./obav.gif?raw=true) 「具体的なサイズ目標としては、『[js13kGames](https://js13kgames.com/)に参加できそうなサイズ感』を目安にしている。ただjs13kGames自体は『zip圧縮後のサイズさえ13k以内なら、起動後のプレイ前処理に数分とかかかってもよい』みたいなレギュレーションでかなりメガデモ指向なので、これはあくまで目安だ。私の目的はあくまで『SNS連載まんが読むのと同程度の気軽さでプレイ開始してもらえる事』だから、サイズだけ小さくてもプレイ開始までにかかる時間が長ければアウトだ」

![nekov](./nekov.gif?raw=true) 「その『ロード最小ミニブラゲ』つくって需要あるの？」

> ![obav](./obav.gif?raw=true) 「私は『間違いなく、ある！』と確信している。一時期Unity社も『[Project Tiny](https://blog.unity.com/ja/technology/project-tiny-preview-package-is-here)』を作ろうとしていた。未来には必ず大手も参入してくるだろうが、大手が参入したとしてもlispを提供してくれるとはとても思えない。だが最終的にはlispしか勝たんのだ、lisp履修してない人にはそれが分からんのです。何にせよ、lisp付きのがほしければ自作するしかないという結論だ」

![nekov](./nekov.gif?raw=true) 「それ儲かるの？」

> ![obav](./obav.gif?raw=true) 「これ単体で利益が出たりするものではない。モデルケースとしている『SNSのらくがき漫画連載』と同じだ。モデルケースの成功例は色々あるので利益が気になる人は自分で確認してくれ」

![nekov](./nekov.gif?raw=true) 「[pico-8](https://www.lexaloffle.com/pico-8.php)とかでは駄目なの？」

> ![obav](./obav.gif?raw=true) 「pico-8はかなり理想的なゲーム開発環境だ。私もとても好きだ。だけれども、以下に挙げる点が私にとっては問題となった。pico-8アプリを起動し、その中の `splore` でゲームを公開したり遊んだりする環境として見るなら、いずれも問題にはならず最高なのだが」
> - ![obav](./obav.gif?raw=true) 「ローディングはほぼないのだが、起動時にロゴが出て数秒ほど待たされる。ロードが一瞬で終わっても、これがあると結局『SNS上のurlをクリックしたらもう始まってる』という『感覚』が得られない。この感覚がないと、競合となるSNS連載らくがき漫画には勝てない」
> - ![obav](./obav.gif?raw=true) 「性能(解像度など)の上限が固定されている。『レギュレーションとして性能の上限が設定されている』事は、実はゲーム制作において不利では全くなくむしろ有利に働くと考えているのだが、それはそれとして『いざとなったらレギュレーションを外し全力を出せるモードがついている』事も同時に必要だと考えている」

![nekov](./nekov.gif?raw=true) 「そういえばseon2jsのspecial定義見てて気付いたけど、defclass提供されてないね。jsってclassあったよね」

> ![obav](./obav.gif?raw=true) 「必要になった人がそのタイミングで、自分でdefspecialを書いて入れてくれ！そもそものseon2jsの開発スタイルがそういう感じなのだ。サンプルゲームを作ってる最中に、必要だがまだ用意されていないspecial formもしくは関数が出て来たタイミングで、それのdefspecialを書いて使い勝手を確認しつつ追加していくスタイルだ。そしてseon2jsはclojure寄りなので、クラスを書く必要がほとんどない」

![nekov](./nekov.gif?raw=true) 「seon2jsは静的型付けにしたりしないの？」

> ![obav](./obav.gif?raw=true) 「将来にセルフホスティング対応を行うタイミングで、後付けライブラリとして実装する予定はある。だが遠い未来の話であり当面はない」

> ![obav](./obav.gif?raw=true) 「seon2jsの開発目的は『ロード最小ミニブラゲ量産』だ。この最後の『ゲ量産』が問題であり、『ゲ』は当初に決めた仕様通り作り終えて遊んでみたら全然おもしろくなかったというケースが極普通に存在し、その時は大幅に作り直しするしかない、どんなにきちんと動いていてもだ。このようなケースでは静的型が逆に足枷になる事が多い」

> ![obav](./obav.gif?raw=true) 「一方、seon2jsのようなコンパイラやトランスパイラのようなものを書くのであれば静的型付けは非常に大きな助けになる。『巨大なルールブックの構築』みたいなものだからだろう」

> ![obav](./obav.gif?raw=true) 「だから『動的型付けのみ』と『静的型付けあり』の両方が必要であり、状況に応じてオンオフを選べなくてはならない」

![nekov](./nekov.gif?raw=true) 「seon2jsのトランスパイラ本体だけrustとかで書けばよかったんじゃないの？」

> ![obav](./obav.gif?raw=true) 「先にも言ったが、『最初に完璧な設計をする事はできない』のだ。『seon2js』自体も『何度も作り直しする』前提なのだ。設計がきちんとできてない内に静的型付けを採用してもコストが増すばかりで、完成が遠ざかる結果になるだろう。仕様の固まらない初期は動的型で雑に開発を行い、仕様の固まった頃に後付けで静的型を導入する、このような柔軟さが必要なのだ」

![nekov](./nekov.gif?raw=true) 「話を戻すけど、ロードが超快適でもゲームがおもしろくなかったら意味なくない？」

> ![obav](./obav.gif?raw=true) 「その通りだ！だが『おもしろさ』は狙って設計する事が非常に難しく、『量産』もしくは『素早くこねくり回せること』だけがそこへの遠回りな一本道だと私は考えている。その為にはDSLが必要なのだ」

> ![obav](./obav.gif?raw=true) 「とは言え、大手はそれをDSLなしでやろうとするだろう。大資本を使い人海戦術で『量産』数を揃えようとするだろう。例えば今web上にある各漫画連載メディア(連載webまんが雑誌サイト？名称不明…)からは何となくそういう感じを受ける。それらは『メディア』としてはまあまあ成功するだろう、なぜならメディアとしては、抱えているたくさんの連載群の中から少数でも『大ヒット作』が出れば『成功』であり元が取れるからだ、だからその成功率を上げる手段としてたくさんの『作家』を抱える必要があるのだ。だが『そのメディアの中で連載させてもらう作家の内の一人』としては、いい作品を作れるかどうかは元々の判定からそれほど変わっていない(いい編集者役がつけば成功率は増すかもしれないが、それはメディアの外でもそうだ)。個人としていい作品を生み出せる可能性のベース値を上げたければ結局、自身の生産サイクルを高速化し個人レベルでも『量産』に手をつけるしかない」

> ![obav](./obav.gif?raw=true) 「中規模以上のゲーム制作も似たような状況だと考えている。あるソシャゲ内のテキストシナリオの良さに出来不出来があるのは？あるゲーム内のイベントやステージ等で、おもしろいものとそうでないものの違いは？…結局、ゲームの各部位のおもしろさを全部一定以上にしたければ、とにかく『量産』して『出来のわるいもの』を抜いて『出来のいいもの』だけ残すしかないのでは？という事だ」

> ![obav](./obav.gif?raw=true) 「この思想の裏には『制作中の作品(もしくは内容の一部)がおもしろくなるかどうかは、実際にある程度作ってみるまでは、あまり正しく判断する事ができない』という価値観がある。…もう分かるな？結局ここでも『最初に完璧な設計をする事はできない』のだ！だから『まず作る』ところから始めないといけなかったのだ。そして『量産』あるいは『素早くこねくり回せる』必要があったのだ。さあ、分かったら、あなたも自分の作品の開発を進めるのだ！サイクルを高速回転させろ」




<!--
![nekov](./nekov.gif?raw=true)
![obav](./obav.gif?raw=true)
![ulv](./ulv.gif?raw=true)
-->



