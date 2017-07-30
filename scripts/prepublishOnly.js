#!/usr/bin/env node

const path = require('path');

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const ghd = require('ghd');

const dirname = path.join(__dirname, '..', 'bin');
const username = 'modulesio';
const repo = 'chromium-zeo';
const hash = '4730b34dad34142a9971634e58f87bc3a612c7ac';
const files = [
  {
    username,
    repo,
    hash,
    path: '/linux.tar.gz',
    file: path.join(dirname, 'linux.tar.gz'),
  },
  {
    username,
    repo,
    hash,
    path: '/windows.tar.gz',
    file: path.join(dirname, 'windows.tar.gz'),
  },
];

console.log('downloading binaries...');

rimraf(dirname, err => {
  if (!err) {
    mkdirp(dirname, err => {
      if (!err) {
        Promise.all(files.map(file => ghd(file)))
          .then(() => {
            console.log('downloaded binaries');

            process.exit(0);
          })
          .catch(err => {
            console.warn(err);
          });
      } else {
        throw err;
      }
    });
  } else {
    throw err;
  }
});
