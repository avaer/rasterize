const rasterize = ({
  wss,
}) => {
  wss.on('connection', c => {
    const {url} = c.upgradeReq;

    if (url === '/rasterizeWs') {
      c.send('internal');
      c.close();
    }
  });

  return Promise.resolve(() => {});
};

module.exports = rasterize;
