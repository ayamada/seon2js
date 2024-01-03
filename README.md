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

- specialやmacroの展開時に、エラー行を正しく出せるよう、参照元オブジェクトをスタックで管理する必要がある(metaを持っている参照元オブジェクトが出てくるまでスタックをなめられるようにしたい)
- babashkaのbbみたいな、単独でスクリプト実行できるラッパーコマンドの提供
- defspecialでよく必要になる「実体は関数だけれども、1回以上参照されている時だけファイル先頭で名前衝突を起こさない名前で関数定義し、その関数名で埋め込む」機能の実装
- ビルド時の最適化フラグ実装(cli内コメント参照)
- エラーログをもうちょっと整理したい(スタックトレースは必要なものだけ出したい)。これをするには自前でスタックトレース管理をするしかない？
- clojureのvar的な何かを導入(namespaceなしsymbolを正しくresolveする為に必要)
- gensym相当の提供(ファイル単体でuniqueなだけだと将来のホットリロード実装時に衝突してしまう。諦めてuuid4とかにするしかない？)
- defmacro実装
- npm-util.s2spの同梱
- repl実装
- テスト完備
- オプショナルな静的型付け対応
- セルフホスティング(このタイミングで綺麗に書き直すので、今は雑で構わない)
- support hot-reloading like shadow-cljs on browser
- support to build in windows
- 諸々の英語化


