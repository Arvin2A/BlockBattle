// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { FONTS } from './theme.js';

export const BUBBLE = {
    ms: 3000,
    fadeMs: 400,
    heightAbovePlayer: 95,
    depth: 900,
    gap: 4,
    max: 3
};

export function createBubbleText(scene, text, fill) {
    return scene.add.text(0, 0, text, {
        fontFamily: FONTS.title,
        fontSize: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        fill,
        padding: { x: 8, y: 5 }
    }).setOrigin(0.5, 1).setDepth(BUBBLE.depth);
}

export function bubbleAlpha(expiresAt, now) {
    return Math.min(1, (expiresAt - now) / BUBBLE.fadeMs);
}
