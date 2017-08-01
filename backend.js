const external = require('./lib/external/backend');
const internal = require('./lib/internal/backend');

module.exports = options => external(options)
  .then(cleanup => ({
    type: 'external',
    cleanup: cleanup,
  }))
  .catch(err => {
    if (err.code === 'ENOENT') {
      return internal(options)
        .then(cleanup => ({
          type: 'internal',
          cleanup: cleanup,
        }));
    } else {
      return Promise.reject(err);
    }
  });
