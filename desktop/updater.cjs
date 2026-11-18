// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app, net } = require('electron');

const UPDATE_URL = process.env.BLOCKBATTLE_UPDATE_URL || 'https://arvin2a.github.io/BlockBattle/desktop/';
const MANIFEST_NAME = 'game-update.json';
const SHELL_VERSION = require('../package.json').desktopShellVersion;
const CHECK_TIMEOUT_MS = 5000;
const FILE_TIMEOUT_MS = 60000;
const PARALLEL_DOWNLOADS = 6;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function cleanRelativePath(relative) {
    const clean = path.posix.normalize(String(relative).replace(/\\/g, '/')).replace(/^\/+/, '');
    if (!clean || clean === '.' || clean.startsWith('../') || clean === '..') return null;
    return clean;
}

function isValidManifest(manifest) {
    if (!manifest || typeof manifest.builtAt !== 'string' || !manifest.files || typeof manifest.files !== 'object') return false;
    return Object.entries(manifest.files).every(([relative, entry]) =>
        cleanRelativePath(relative) === relative
        && entry && HASH_PATTERN.test(entry.sha256)
        && Number.isSafeInteger(entry.size) && entry.size >= 0);
}

async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await net.fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`${url} answered ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    } finally {
        clearTimeout(timer);
    }
}

async function writeAtomic(file, data) {
    const temp = `${file}.part`;
    await fs.promises.writeFile(temp, data);
    await fs.promises.rename(temp, file);
}

class GameFiles {
    constructor(bundledRoot) {
        this.bundledRoot = bundledRoot;
        this.updateRoot = path.join(app.getPath('userData'), 'game-update');
        this.storeRoot = path.join(this.updateRoot, 'files');
        this.currentPath = path.join(this.updateRoot, 'current.json');
        this.bundled = readJson(path.join(bundledRoot, MANIFEST_NAME));
        this.active = this.pickActive();
    }

    pickActive() {
        const downloaded = readJson(this.currentPath);
        if (!isValidManifest(downloaded)) return null;
        if (this.bundled && this.bundled.builtAt >= downloaded.builtAt) return null;
        return downloaded;
    }

    get current() {
        return this.active ?? this.bundled;
    }

    storePath(relative, entry) {
        return path.join(this.storeRoot, entry.sha256 + path.extname(relative));
    }

    isBundled(relative, entry) {
        return this.bundled?.files?.[relative]?.sha256 === entry.sha256;
    }

    resolve(requestPath) {
        const relative = cleanRelativePath(requestPath);
        if (!relative) return null;
        const entry = this.active?.files[relative];
        if (entry && !this.isBundled(relative, entry)) return this.storePath(relative, entry);
        const file = path.normalize(path.join(this.bundledRoot, relative));
        if (!file.startsWith(this.bundledRoot + path.sep)) return null;
        return file;
    }

    async check() {
        const manifest = JSON.parse((await fetchWithTimeout(`${UPDATE_URL}${MANIFEST_NAME}?t=${Date.now()}`, CHECK_TIMEOUT_MS)).toString('utf8'));
        if (!isValidManifest(manifest)) throw new Error('The update list is broken');
        if (this.current && manifest.builtAt <= this.current.builtAt) return null;
        if (Number.isFinite(manifest.minShell) && manifest.minShell > SHELL_VERSION) return { manifest, needsNewApp: true };
        const missing = Object.entries(manifest.files).filter(([relative, entry]) =>
            !this.isBundled(relative, entry) && !fs.existsSync(this.storePath(relative, entry)));
        return { manifest, missing, needsNewApp: false };
    }

    async download({ manifest, missing }, onProgress) {
        await fs.promises.mkdir(this.storeRoot, { recursive: true });
        const totalBytes = missing.reduce((sum, [, entry]) => sum + entry.size, 0);
        let doneBytes = 0;
        let next = 0;
        onProgress(0, totalBytes);
        const worker = async () => {
            while (next < missing.length) {
                const [relative, entry] = missing[next++];
                const url = UPDATE_URL + relative.split('/').map(encodeURIComponent).join('/') + `?v=${entry.sha256.slice(0, 16)}`;
                const data = await fetchWithTimeout(url, FILE_TIMEOUT_MS);
                const hash = crypto.createHash('sha256').update(data).digest('hex');
                if (hash !== entry.sha256) throw new Error(`${relative} did not download correctly`);
                await writeAtomic(this.storePath(relative, entry), data);
                doneBytes += entry.size;
                onProgress(doneBytes, totalBytes);
            }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, missing.length) }, worker));
        await writeAtomic(this.currentPath, JSON.stringify(manifest));
        this.active = manifest;
        await this.removeUnusedFiles();
    }

    async removeUnusedFiles() {
        const keep = new Set(Object.entries(this.active.files).map(([relative, entry]) => path.basename(this.storePath(relative, entry))));
        for (const name of await fs.promises.readdir(this.storeRoot)) {
            if (!keep.has(name)) await fs.promises.rm(path.join(this.storeRoot, name), { force: true });
        }
    }
}

module.exports = { GameFiles };
