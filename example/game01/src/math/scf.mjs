// 亜クッキー係数(SCF, Sub-Cookie-Factor)とは
//
// - 真クッキー係数(TCF, True-Cookie-Factor)は「1.15」。
//   cookie clickerにおいて、buidingsが一つ増える毎に増加する費用の割合。
// - 亜クッキー係数(SCF, Sub-Cookie-Factor)は、柔軟に指定できる、
//   「ランクが1上がる毎に増加する費用の割合」。
//   扱いやすいよう、クラス分けされた既定値が提供されている。
export const class10scf = 11/10; // (1.1) 提供クラス中最も増分コストが安い
export const class9scf = 10/9; // (1.111...)
export const class8scf = 9/8; // (1.125)
export const class7scf = 8/7; // (1.143...) 最も真クッキー係数に近い
export const class6scf = 7/6; // (1.167...) 二番目に真クッキー係数に近い
export const class5scf = 6/5; // (1.2) class5以下は係数が大きすぎ実用的でない
export const class4scf = 5/4; // (1.25)
export const class3scf = 4/3; // (1.333...)
export const class2scf = 3/2; // (1.5)
export const class1scf = 2/1; // (2.0) バイバイン
//   これらのクラス値を使わずに直に数値で係数を指定してもよいが、
//   基本的に1以上の数値を設定する事になる。
// - SCF分類値が高い程、上昇率はゆるやかになる
//   (つまり結果として、レベルアップ速度が高速という事になる)
// - これで算出した結果は基本的に「コスト値」なので、経験値として利用する場合は
//   「レベルアップ時に経験値を消費もしくはリセットする」扱いにする方がよい。
//   (どうしても累積にしたい場合は、別途「累積経験値」を保持した方がよい)


// ベース経験値係数とSCF係数から、「次レベルの経験値量」を生成する。
// 小数点以下は切り捨てられる。
// 直に makeNextExpCalculator(baseExpFactor, scf)(currentLevel) として
// 使う事も一応可能(ただしGC注意)。
// また、オプショナル引数が設定してあるので、
// makeNextExpCalculator()(currentLevel) だけで機能する。
export const makeNextExpCalculator = (baseExpFactor=10, scf=class7scf) => (currentLevel) => (0 < currentLevel) ? Math.floor(baseExpFactor * Math.pow(scf, currentLevel)) : baseExpFactor;


// これはscfとは無関係。
// 0 1 2 3 4 5 ... のような数列の指定位置までの和を求める関数。
// マイナス値を指定した場合は常に0が返される。
// これは「三角数」というらしい
export const calcTriangularNum = (n) => ((0 < n) ? (n*(n+1)/2) : 0);
