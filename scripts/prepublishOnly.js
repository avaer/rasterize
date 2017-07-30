#!/usr/bin/env node

const path = require('path');
const mkdirp = require('mkdirp');
const ghd = require('ghd');

const dirname = path.join(__dirname, '..', 'bin');
const files = [
  {
    username: 'modulesio',
    repo: 'chromium-zeo',
    hash: '4730b34dad34142a9971634e58f87bc3a612c7ac',
    path: '/linux.tar.gz',
  },
  {
    username: 'modulesio',
    repo: 'chromium-zeo',
    hash: '4730b34dad34142a9971634e58f87bc3a612c7ac',
    path: '/windows.tar.gz',
  },
];

console.log('downloading binaries...');

mkdirp(dirname, err => {
  if (!err) {
    Promise.all(files.map(({
      username,
      repo,
      hash,
      path,
    }) => 
      ghd({
        username,
        repo,
        hash,
        path,
        dirname,
      })
    ))
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

