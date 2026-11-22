// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getOnlineHttpUrl, isOnlineConfigured } from './serverConfig.js';
import { cleanTransferCode } from './protocol.js';

const TIMEOUT_MS = 8000;

async function post(route, body) {
    if (!isOnlineConfigured()) return { error: 'offline' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(getOnlineHttpUrl(route), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            cache: 'no-store',
            signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        return response.ok ? data : { error: data.error ?? 'failed' };
    } catch {
        return { error: 'offline' };
    } finally {
        clearTimeout(timer);
    }
}

export function createTransferCode(saveData) {
    return post('save', { save: saveData });
}

export function redeemTransferCode(code) {
    const cleaned = cleanTransferCode(code);
    if (!cleaned) return Promise.resolve({ error: 'bad_code' });
    return post('redeem', { code: cleaned });
}
