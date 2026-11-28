// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/protocol.js
// Things the browser game and the online server (server/index.js) have to agree on.
// Plain JS with no Phaser imports so Node can load it too.

import { MAPS } from '../scenes/GameScene/MapDefinitions.js';
import { toAsciiName } from './nameFilter.js';

// Bump this whenever messages change so old tabs get a clear "refresh" error.
export const PROTOCOL_VERSION = 22;

export const RECONNECT_GRACE_MS = { lobby: 60000, match: 20000, menu: 15000 };

export const MP_PATH = '/mp';
export const DEFAULT_PORT = 8080;

export const MAP_CHOICES = [...Object.keys(MAPS), 'RANDOM'];

export const SKINS = ['gold'];

export function cleanSkin(skin) {
    return SKINS.includes(skin) ? skin : null;
}

export const MAX_NAME_LENGTH = 16;
export const MAX_LOBBY_NAME_LENGTH = 24;

export const DEVICE_ID_STORAGE_KEY = 'blockBattleDeviceId';

export function cleanDeviceId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

// Names are plain English letters, digits, spaces and _-.!?' only, so lookalike
// letters from other alphabets can't sneak a blocked word past the name filter.
export function cleanName(name, maxLength = MAX_NAME_LENGTH) {
    const cleaned = toAsciiName(name)
        .replace(/\|/g, 'l')
        .replace(/[^A-Za-z0-9 _\-.!?']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || 'Player';
}

// Why a match ended, shown to players.
export const END_REASONS = {
    KO: 'ko',
    FORFEIT: 'forfeit',
    DISCONNECT: 'disconnect',
    SERVER_ERROR: 'server_error',
    AFK: 'afk'
};

export const SAVE_TRANSFER = { lifetimeMs: 10 * 60 * 1000, maxSaveBytes: 8192 };

export function cleanTransferCode(code) {
    const letters = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z0-9]{6}$/.test(letters) ? `${letters.slice(0, 3)}-${letters.slice(3)}` : null;
}

export const INVITE_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function cleanInviteCode(code) {
    const letters = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return letters.length === INVITE_CODE_LENGTH && [...letters].every(letter => INVITE_CODE_LETTERS.includes(letter)) ? letters : null;
}

const RESULT_COUNTS = ['timesKOd', 'grassCut', 'counters', 'blocks'];
const RESULT_FLAGS = ['won', 'untouchedKO', 'flingKO', 'qualifies', 'noModifiers'];

export function cleanMatchResult(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.character !== 'string' || typeof raw.variant !== 'string') return null;
    const result = { character: raw.character.slice(0, 32), variant: raw.variant.slice(0, 32) };
    for (const key of RESULT_COUNTS) {
        const value = Number(raw[key]);
        result[key] = Number.isFinite(value) ? Math.max(0, Math.min(10000, Math.floor(value))) : 0;
    }
    for (const key of RESULT_FLAGS) result[key] = raw[key] === true;
    const kb = Number(raw.finalKB);
    result.finalKB = Number.isFinite(kb) ? kb : 99;
    return result;
}

const STAT_LIMITS = { kos: 999, maxKB: 1000, damage: 1000000 };

export function cleanMatchStats(raw, slots) {
    if (!raw || typeof raw !== 'object') return null;
    const stats = {};
    for (const slot of slots) {
        const entry = raw[slot];
        if (!entry || typeof entry !== 'object') continue;
        stats[slot] = Object.fromEntries(Object.entries(STAT_LIMITS).map(([key, limit]) => {
            const value = Number(entry[key]);
            return [key, Number.isFinite(value) ? Math.max(0, Math.min(limit, value)) : 0];
        }));
    }
    return Object.keys(stats).length ? stats : null;
}

// ws://host/mp on the same server that served the page.
export function getServerSocketUrl(location = globalThis.location) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${MP_PATH}`;
}
