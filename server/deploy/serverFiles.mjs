// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRY = 'server/index.js';
const ALWAYS = ['package.json', 'package-lock.json', 'server/deploy/serverFiles.mjs'];
const IMPORT_PATTERN = /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const READ_PATTERN = /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;

const found = new Set(ALWAYS);
const queue = [ENTRY];
while (queue.length) {
    const file = queue.pop();
    if (found.has(file) && file !== ENTRY) continue;
    found.add(file);
    let source;
    try {
        source = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
        continue;
    }
    const dir = path.dirname(file);
    for (const match of source.matchAll(IMPORT_PATTERN)) {
        const target = path.normalize(path.join(dir, match[1] ?? match[2]));
        if (!found.has(target)) queue.push(target);
    }
    for (const match of source.matchAll(READ_PATTERN)) {
        found.add(path.normalize(path.join(dir, match[1])));
    }
}

process.stdout.write([...found].sort().join('\n') + '\n');
