# seon2js

これは「『S式で書けるJSON』で『lisp->jsのトランスレータ』を実装できるか」の実験実装です。

実験結果としては「実装できるし実用もできる、が、きちんと整備するには言語仕様策定回りの能力が必要」という感じになりました。

今後も開発は続けていきますが、仕様を大きく変更する可能性が高いです。

- [docs/lisp-advent-calendar-2023.md](docs/lisp-advent-calendar-2023.md) に紹介記事を置いています。


## seon2jsの設計方針および価値観

トランスパイル後のコードが以下のようになるようにする

- `On browser` : (スマホ含む)ブラウザ上で動作する事
- `For developing small-game` : ミニゲーム開発向け
    - `Fastest loading and bootstrap` : ロードと起動時間が最小になる事
    - `But not capped` : 実行環境由来を除き、機能の制限がなされない事
    - `Don't raise GC` : GCをなるべく起こさない(≒GCを起こさない書き方が可能)
- `Fruitfulness` : 量産向け
    - `Can be construct DSL` : (量産速度向上の為に)マクロ等でDSL拡張できる事


対応しない事

- `Don't support browsers marked as obsoleted version` : 古いブラウザは捨てる
- `Keep core simple` : 高度な言語機能は後付けのライブラリとして提供されるべき


プロジェクト全体を通しての価値観

- 『最初に完璧な設計をする事はできない』


## TODO

- seonの開発が安定してきたら、seonのリポジトリは別に分ける
- 自前でのスタックトレース出力(今は余計なjs層まで出てしまっている)
- defmacro実装
- repl実装
- オプショナルな静的型付け対応
- セルフホスティング(このタイミングで綺麗に書き直すので、今は雑で構わない)
- support hot-reloading like shadow-cljs on browser
- support to build in windows
- 諸々の英語化


