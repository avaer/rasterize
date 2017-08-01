const render = require('../worker/render');
const Anchor = require('../worker/anchor');

const rasterize = () => Promise.resolve((src, width, height) => render(src, width, height)
  .then(({
    imageArrayBuffer,
    anchors,
    measures,
  }) => Promise.all([
    createImageBitmap(new Blob([imageArrayBuffer], {type: 'image/png'}), 0, 0, width, height, {
      imageOrientation: 'flipY',
    }),
    Promise.resolve(anchors.map(([left, right, top, bottom, onclick, onmousedown, onmouseup]) =>
      new Anchor(left, right, top, bottom, onclick, onmousedown, onmouseup)
    )),
    Promise.resolve(measures),
  ]))
  .then(([
    imageBitmap,
    anchors,
    measures,
  ]) => ({
    imageBitmap,
    anchors,
    measures,
  })));

module.exports = rasterize;
