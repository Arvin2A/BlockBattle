#!/usr/bin/env node
// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Adds any file in audio/ that isn't referenced yet to the match preload()
// in scenes/GameScene/preload.js. The sound key is the filename without its
// extension, e.g. audio/reel.wav -> this.load.audio('reel', 'audio/reel.wav');
//
// Usage: ./add-audio.js          (or: npm run add-audio)
//        ./add-audio.js --dry    (show what would be added, change nothing)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(root, 'audio');
const preloadPath = path.join(root, 'scenes', 'GameScene', 'preload.js');
const AUDIO_EXTS = new Set(['.wav', '.ogg', '.mp3', '.m4a', '.flac', '.webm']);
const SECTION_HEADER = `    // =====================================================
    // AUDIO - NEW (added by add-audio.js, move into a section if you like)
    // =====================================================
`;

const dryRun = process.argv.includes('--dry');
let src = fs.readFileSync(preloadPath, 'utf8');

const referencedFiles = new Set([...src.matchAll(/['"]audio\/([^'"]+)['"]/g)].map(m => m[1]));
const usedKeys = new Set([...src.matchAll(/load\.audio\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));

const newLines = [];
for (const file of fs.readdirSync(audioDir).sort()) {
    if (file.startsWith('.') || !AUDIO_EXTS.has(path.extname(file).toLowerCase())) continue;
    if (referencedFiles.has(file)) continue;

    const key = path.basename(file, path.extname(file));
    if (usedKeys.has(key)) {
        console.warn(`skip ${file}: key '${key}' is already used by another sound`);
        continue;
    }
    usedKeys.add(key);
    newLines.push(`    this.load.audio('${key}', 'audio/${file}');`);
}

if (newLines.length === 0) {
    console.log('No new audio files.');
    process.exit(0);
}

// Insert just before the closing brace of `export function preload()`.
const fnStart = src.indexOf('export function preload(');
const fnEnd = fnStart === -1 ? -1 : src.indexOf('\n}', fnStart);
if (fnEnd === -1) {
    console.error('Could not find the end of preload() in preload.js');
    process.exit(1);
}

const before = src.slice(0, fnEnd).replace(/\s*$/, '\n');
const header = src.includes(SECTION_HEADER) ? '' : '\n' + SECTION_HEADER + '\n';
src = before + header + newLines.join('\n') + '\n' + src.slice(fnEnd);

console.log(newLines.map(l => l.trim()).join('\n'));
if (dryRun) {
    console.log('(dry run, nothing written)');
} else {
    fs.writeFileSync(preloadPath, src);
    console.log(`Added ${newLines.length} sound(s) to ${path.relative(root, preloadPath)}`);
}
