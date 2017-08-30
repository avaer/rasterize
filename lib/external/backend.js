const path = require('path');
const child_process = require('child_process');

const getport = require('getport');
const CRI = require('chrome-remote-interface');

const isWindows = /^win/.test(process.platform);

const BROWSER_BIN_PATHS = isWindows ? [
  path.join(path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe')),
  path.join(path.join(process.env['LOCALAPPDATA'], 'Chromium', 'Application', 'chrome.exe')),
] : [
  'google-chrome',
  'chromium',
];

const rasterize = ({
  express,
  app,
  wss,
  port,
}) => {
  const cleanups = [];

  const workerStatic = express.static(path.join(__dirname, '..', 'worker'));
  function serveRasterize(req, res, next) {
    workerStatic(req, res, next);
  }
  app.use('/rasterize', serveRasterize);

  let proxyConnection = null;
  const inQueue = [];
  const outQueue = [];
  wss.on('connection', c => {
    const {url} = c.upgradeReq;

    if (url === '/rasterizeWsProxy') {
      proxyConnection = c;

      c.on('message', m => {
        outQueue.shift()(m);
      });
      c.on('close', () => {
        proxyConnection = null;

        const err = new Error('rasterize lost proxy connection');
        for (let i = 0; i < outQueue.length; i++) {
          outQueue[i](err);
        }
        outQueue.length = 0;
      });

      for (let i = 0; i < inQueue.length; i++) {
        inQueue[i]();
      }
      inQueue.length = 0;
    }
  });

  cleanups.push(() => {
    function removeMiddlewares(route, i, routes) {
      if (
        route.handle.name === 'serveRasterize'
      ) {
        routes.splice(i, 1);
      }
      if (route.route) {
        route.route.stack.forEach(removeMiddlewares);
      }
    }
    app._router.stack.forEach(removeMiddlewares);
  });

  const _getPort = () => new Promise((accept, reject) => {
    getport((port + 9222) % 65535, (err, port) => {
      if (!err) {
        accept(port);
      } else {
        reject(err);
      }
    });
  });
  const _requestBrowser = rasterizerPort => new Promise((accept, reject) => {
    const _recurse = i => {
      if (i < BROWSER_BIN_PATHS.length) {
        const _next = () => {
          _recurse(i + 1);
        };

        const browserBinPath = BROWSER_BIN_PATHS[i];

        const _requestBrowserVersion = cb => {
          if (isWindows) {
            child_process.execFile('wmic', [
              'datafile',
              'where',
              'name="' + browserBinPath.replace(/\\/g, '\\\\') + '"',
              'get',
              'Version',
            ], {
              encoding: 'utf8',
            }, (err, s) => {
              if (!err) {
              const match = s.match(/^([0-9]+)/m);

              if (match) {
                const browserVersion = parseInt(match[1], 10);
                cb(null, browserVersion)
              } else {
                const err = new Error('no match');
                err.code = 'ENOENT';
                cb(err);
              }
              } else {
                cb(err);
              }
            });
          } else {
            child_process.execFile(browserBinPath, [
              '--version',
            ], {
              encoding: 'utf8',
            }, (err, s) => {
              if (!err) {
                const match = s.match(/^(Google Chrome|Chromium) ([0-9]+)/m);

                if (match) {
                  const browserVersion = parseInt(match[2], 10);
                } else {
                  const err = new Error('no match');
                  err.code = 'ENOENT';
                  cb(err);
                }
              } else {
                cb(err);
              }
            });
          }
        };

        _requestBrowserVersion((err, version) => {
          if (!err) {
            if ((isWindows && version >= 60) || (!isWindows && version >= 59)) {
              const browserProcess = child_process.spawn(browserBinPath, [
                '--headless',
                `--remote-debugging-port=${rasterizerPort}`,
                '--no-sandbox',
                '--no-zygote',
              ]);

              if (browserProcess.pid) {
                const _exit = (code, signal) => {
                  console.warn('rasterize browser process exited unexpectedly, so rendering is broken', {code, signal});
                };
                browserProcess.on('exit', _exit);

                cleanups.push(() => {
                  chromiumProcess.kill();

                  browserProcess.removeListener('exit', _exit);
                });

                accept(browserProcess);
              } else {
                browserProcess.on('error', reject);
              }
            } else {
              _next();
            }
          } else if (err.code === 'ENOENT') {
            _next();
          } else {
            reject(err);
          }
        });
      } else {
        const err = new Error('no compatible rasterize browser found');
        err.code = 'ENOENT';
        reject(err);
      }
    };
    _recurse(0);
  });
  const _requestRasterizer = rasterizerPort => new Promise((accept, reject) => {
    const startTime = Date.now();
    const _recurse = () => {
      CRI({
        port: rasterizerPort,
      })
        .then(client => {
          const {Page, Console} = client;
          Promise.all([
            Page.enable(),
            Console.enable(),
          ])
            .then(() => {
              Console.messageAdded(({message}) => {
                if (message.level === 'warning' || message.level === 'error') {
                  console.warn('chromium:' + message.url + ':' + message.line + ':' + message.column + ': ' + message.text);
                }
              });
              Page.loadEventFired(() => {
                accept();
              });
            })
            .then(() => Page.navigate({url: `http://127.0.0.1:${port}/rasterize/worker.html#127.0.0.1:${port}`}));
        })
        .catch(err => {
          const now = Date.now();

          if (now - startTime > 2000) {
            console.warn(err);

            setTimeout(_recurse, 2000);
          } else {
            setTimeout(_recurse, 50);
          }
        });
    };
    _recurse();
  });

  return _getPort()
    .then(rasterizerPort =>
      _requestBrowser(rasterizerPort)
        .then(() => _requestRasterizer(rasterizerPort))
    )
    .then(() => {
      wss.on('connection', c => {
        const {url} = c.upgradeReq;

        if (url === '/rasterizeWs') {
          c.send('external');

          c.on('message', m => {
            const _proxy = () => {
              proxyConnection.send(m);

              outQueue.push(m => {
                c.send(m);
              });
              outQueue.push(m => {
                c.send(m);
              });
            };

            if (proxyConnection) {
              _proxy();
            } else {
              inQueue.push(_proxy);
            }
          });
        }
      });

      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          cleanup();
        }
      };
    });
};

module.exports = rasterize;
