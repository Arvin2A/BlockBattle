// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export const PLAYER_COLORS = {
    red: { hex: 0xff4343, css: '#ff4343', meter: 0xf54242, shieldStroke: 0xa01c1c, stat: 'redstat', label: 'RED' },
    blue: { hex: 0x3d8bff, css: '#3d8bff', meter: 0x00aaff, shieldStroke: 0x1a4fa8, stat: 'bluestat', label: 'BLUE' },
    green: { hex: 0x3fbf5f, css: '#3fbf5f', meter: 0x2fa84f, shieldStroke: 0x1f7a3a, stat: 'greenstat', label: 'GREEN' },
    yellow: { hex: 0xffd93d, css: '#ffd93d', meter: 0xe6c200, shieldStroke: 0xa88a00, stat: 'yellowstat', label: 'YELLOW' }
};

export const MATCH_MODES = {
    '1v1': { players: 2, colors: ['red', 'blue'], teams: null },
    '1v1v1': { players: 3, colors: ['red', 'green', 'blue'], teams: null },
    '2v2': { players: 4, colors: ['red', 'red', 'blue', 'blue'], teams: [0, 0, 1, 1] },
    '1v1v1v1': { players: 4, colors: ['red', 'yellow', 'green', 'blue'], teams: null }
};

export const MODE_TOGGLE_ORDER = ['1v1v1v1', '2v2', '1v1v1', '1v1'];
export const SLOTS = ['p1', 'p2', 'p3', 'p4'];
export const MATCH_LIVES = 3;

export function isValidMode(mode) {
    return Object.hasOwn(MATCH_MODES, mode);
}

export function buildRoster(modeKey, entries) {
    const mode = MATCH_MODES[modeKey];
    return entries.map((entry, index) => ({
        ...entry,
        slot: SLOTS[index],
        color: mode.colors[index],
        team: mode.teams ? mode.teams[index] : index
    }));
}

export function isTeamMode(modeKey) {
    return Boolean(MATCH_MODES[modeKey]?.teams);
}
