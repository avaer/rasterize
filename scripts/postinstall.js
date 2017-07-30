#!/usr/bin/env node

const path = require('path');

const mkdirp = require('mkdirp');
const tar = require('tar');

const isWindows = /^win/.test(process.platform);

const dirname = path.join(__dirname, '..', 'bin');
const file = path.join(dirname, (isWindows ? 'windows' : 'linux') + '.tar.gz');

console.log('extracting binaries...');

tar.x({
  file,
  cwd: dirname,
  unlink: true,
}, err => {
  if (!err) {
    console.log('extracted binaries');
    process.exit(0);
  } else {
    throw err;
  }
});
