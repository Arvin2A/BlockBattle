// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';

const VERSIONS = typeof __ASSET_VERSIONS__ === 'undefined' ? {} : __ASSET_VERSIONS__;

function versionFile(file) {
    if (typeof file?.url !== 'string' || file.url.includes('?')) return;
    const version = VERSIONS[file.url.replace(/^\.?\//, '')];
    if (version) file.url = `${file.url}?v=${version}`;
}

const addFile = Phaser.Loader.LoaderPlugin.prototype.addFile;
Phaser.Loader.LoaderPlugin.prototype.addFile = function (file) {
    (Array.isArray(file) ? file : [file]).forEach(versionFile);
    return addFile.call(this, file);
};
