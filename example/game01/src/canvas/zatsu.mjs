// TODO: あとでより豪華なgradraw.mjsを作るまでのつなぎ


export const canvas = (dom, _) => {
  const ctx = dom.getContext("2d");
  const instance = {};
  instance.eraseRect = (left, top, w, h, options) => {
    ctx.clearRect(left, top, w, h);
  };
  instance.rectangle = (left, top, w, h, options) => {
    // TODO: できればstrokeにも対応した方がよいが…
    ctx.fillStyle = options.fill;
    ctx.fillRect(left, top, w, h);
  };
  instance.circle = (x, y, diameter, options) => {
    ctx.fillStyle = options.fill;
    ctx.beginPath();
    ctx.arc(x, y, diameter/2, 0, Math.PI*2);
    ctx.fill();
  };
  return instance;
};


