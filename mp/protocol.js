// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/protocol.js
// Things the browser game and the online server (server/index.js) have to agree on.
// Plain JS with no Phaser imports so Node can load it too.

import { MAPS } from '../scenes/GameScene/MapDefinitions.js';
import { toAsciiName } from './nameFilter.js';

// Bump this whenever messages change so old tabs get a clear "refresh" error.
export const PROTOCOL_VERSION = 9;

export const MP_PATH = '/mp';
export const DEFAULT_PORT = 8080;

export const MAP_CHOICES = [...Object.keys(MAPS), 'RANDOM'];

export const MAX_NAME_LENGTH = 16;

export const DEVICE_ID_STORAGE_KEY = 'blockBattleDeviceId';

export function cleanDeviceId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

// Names are plain English letters, digits, spaces and _-.!?' only, so lookalike
// letters from other alphabets can't sneak a blocked word past the name filter.
export function cleanName(name) {
    const cleaned = toAsciiName(name)
        .replace(/\|/g, 'l')
        .replace(/[^A-Za-z0-9 _\-.!?']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME_LENGTH);
    return cleaned || 'Player';
}

// Why a match ended, shown to players.
export const END_REASONS = {
    KO: 'ko',
    FORFEIT: 'forfeit',
    DISCONNECT: 'disconnect',
    SERVER_ERROR: 'server_error'
};

// ws://host/mp on the same server that served the page.
export function getServerSocketUrl(location = globalThis.location) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${MP_PATH}`;
}
