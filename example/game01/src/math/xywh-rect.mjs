// rectは {x: 1, y: 2, w: 3, h: 4} のようなobjectを引数として取る。
// ただし返り値は2要素のarrayなので要注意。


let returnXY = [0, 0]; // xとyの二値を返す際にこれを使う


// rectのleft, topの座標を算出し取得する。
// rightはleft+rect.w, bottomはtop+rect.hで容易に計算できるので返さない。
// 返り値がリエントラントではないので要注意。
// これを呼ぶという事はanchorは左上ではない筈なのでデフォルト値は中心。
// 迷うようなら明示的にanchorX, anchorYを指定する事
export const rect2LeftTop = (rect, anchorX=0, anchorY=0) => {
  // anchorXが-1の時は横補正は0、anchorXが1の時は横補正が-1になる
  returnXY[0] = rect.x - rect.w*(1+anchorX)/2;
  returnXY[1] = rect.y - rect.h*(1+anchorY)/2;
  return returnXY;
};


// rectの中心座標を算出し取得する。
// 返り値がリエントラントではないので要注意。
// これを呼ぶという事はanchorは中央ではない筈なのでデフォルト値は左上。
// 迷うようなら明示的にanchorX, anchorYを指定する事
export const rect2centerXY = (rect, anchorX=-1, anchorY=-1) => {
  rect2LeftTop(rect, anchorX, anchorY);
  returnXY[0] += rect.w/2;
  returnXY[1] += rect.h/2;
  return returnXY;
};
