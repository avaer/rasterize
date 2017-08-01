const external = require('./lib/external/frontend');
const internal = require('./lib/internal/frontend');

module.exports = () => external()
  .then(rasterize => ({
    type: 'external',
    rasterize: rasterize,
  }))
  .catch(err => {
    if (err.code === 'ENOENT') {
      return internal()
        .then(rasterize => ({
          type: 'internal',
          rasterize: rasterize,
        }));
    } else {
      return Promise.reject(err);
    }
  });
