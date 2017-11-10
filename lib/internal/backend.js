const rasterize = ({
  wss,
}) => {
  wss.on('connection', (c, {url}) => {
    if (url === '/rasterizeWs') {
      c.send('internal');
      c.close();
    }
  });

  return Promise.resolve(() => {});
};

module.exports = rasterize;
