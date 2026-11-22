// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import crypto from 'node:crypto';
import { SAVE_TRANSFER, cleanTransferCode } from '../mp/protocol.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_BODY_BYTES = SAVE_TRANSFER.maxSaveBytes + 512;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const LIMITS = { save: 10, redeem: 20 };
const MAX_STORED = 5000;

function randomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function readJson(request) {
    return new Promise(resolve => {
        let size = 0;
        const chunks = [];
        request.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                request.destroy();
                resolve(null);
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                resolve(null);
            }
        });
        request.on('error', () => resolve(null));
    });
}

export function createSaveTransfers(log) {
    const stored = new Map();
    const attempts = new Map();

    const sweep = () => {
        const now = Date.now();
        for (const [code, entry] of stored) if (entry.expiresAt <= now) stored.delete(code);
        for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
    };
    setInterval(sweep, 60 * 1000).unref();

    const allow = (kind, address) => {
        const key = `${kind}:${address}`;
        const now = Date.now();
        const entry = attempts.get(key);
        if (!entry || entry.resetAt <= now) {
            attempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
            return true;
        }
        entry.count += 1;
        return entry.count <= LIMITS[kind];
    };

    async function save(request, address) {
        if (!allow('save', address)) return [429, { error: 'too_many' }];
        const body = await readJson(request);
        const data = body?.save;
        if (typeof data !== 'string' || !data.length || data.length > SAVE_TRANSFER.maxSaveBytes) return [400, { error: 'bad_save' }];
        sweep();
        if (stored.size >= MAX_STORED) return [503, { error: 'full' }];
        let code = randomCode();
        while (stored.has(code)) code = randomCode();
        stored.set(code, { data, expiresAt: Date.now() + SAVE_TRANSFER.lifetimeMs });
        log(`Save transfer code made (${stored.size} waiting)`);
        return [200, { code, expiresInMs: SAVE_TRANSFER.lifetimeMs }];
    }

    async function redeem(request, address) {
        if (!allow('redeem', address)) return [429, { error: 'too_many' }];
        const body = await readJson(request);
        const code = cleanTransferCode(body?.code);
        const entry = code ? stored.get(code) : null;
        if (!entry || entry.expiresAt <= Date.now()) {
            if (code) stored.delete(code);
            return [404, { error: 'not_found' }];
        }
        stored.delete(code);
        log('Save transfer code used');
        return [200, { save: entry.data }];
    }

    return { save, redeem };
}
