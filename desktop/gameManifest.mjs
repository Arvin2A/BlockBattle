// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MANIFEST_NAME = 'game-update.json';

const root = path.resolve(process.argv[2] || process.env.BUILD_DIR || 'dist');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? listFiles(full) : [full];
    });
}

const files = {};
for (const file of listFiles(root).sort()) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative === MANIFEST_NAME) continue;
    const data = readFileSync(file);
    files[relative] = { sha256: createHash('sha256').update(data).digest('hex'), size: data.length };
}

const manifest = {
    version: packageJson.version,
    builtAt: new Date().toISOString(),
    minShell: packageJson.desktopShellVersion,
    files
};

writeFileSync(path.join(root, MANIFEST_NAME), JSON.stringify(manifest));
console.log(`Wrote ${MANIFEST_NAME} for ${Object.keys(files).length} files in ${root}`);
