const AutoWs = require('autows');
const Anchor = require('../worker/anchor');

const rasterize = () => {
  const _requestConnection = () => new Promise((accept, reject) => {
    const connection = new AutoWs(_wsUrl('/rasterizeWs'));

    const _cleanup = ()  => {
      connection.removeListener('message', _message);
    };
    const _message = e => {
      _cleanup();

      if (e.data === 'external') {
        connection.queue = [];
        connection.on('message', e => {
          connection.queue.shift()(e.data);
        });

        accept(connection);
      } else {
        connection.destroy();

        const err = new Error('could not connect to external backend');
        err.code = 'ENOENT';
        reject(err);
      }
    };
    connection.on('message', _message);
  });

  return _requestConnection()
    .then(connection => {
      return (src, width, height) => {
        connection.send(JSON.stringify([width, height]) + src);

        return Promise.all([
          new Promise((accept, reject) => {
            connection.queue.push(imageArrayBuffer => {
              createImageBitmap(new Blob([imageArrayBuffer], {type: 'image/png'}), 0, 0, width, height, {
                imageOrientation: 'flipY',
              })
                .then(accept)
                .catch(reject);
            });
          }),
          new Promise((accept, reject) => {
            connection.queue.push(metadataJson => {
              const metadata = JSON.parse(metadataJson);
              const anchors = metadata.anchors.map(([left, right, top, bottom, onclick, onmousedown, onmouseup]) =>
                new Anchor(left, right, top, bottom, onclick, onmousedown, onmouseup)
              );
              const {measures} = metadata;
              accept({
                anchors,
                measures,
              });
            });
          })
        ])
          .then(([
            imageBitmap,
            {
              anchors,
              measures,
            },
          ]) => ({
            imageBitmap,
            anchors,
            measures,
          }));
      };
    });
};
const _wsUrl = s => {
  const l = window.location;
  return ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + s;
};

module.exports = rasterize;
