// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { PLAYER_COLORS } from '../matchModes.js';
import { COLORS } from '../ui/theme.js';
import { BUBBLE, bubbleAlpha, createBubbleText } from '../ui/speechBubble.js';
import { addSceneUpdateListener } from './effects.js';

function speakerColor(scene, player) {
    if (player.isCpu && !scene.online) return COLORS.cpu;
    return PLAYER_COLORS[player.color]?.css ?? COLORS.accent;
}

export function sayLine(scene, player, line) {
    player.spokenLine?.destroy();
    const text = createBubbleText(scene, line, speakerColor(scene, player));
    scene.objs.add(text);
    player.spokenLine = text;
    const expiresAt = scene.time.now + BUBBLE.ms;
    const remove = addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        if (!text.active || !player.active || now >= expiresAt) {
            remove();
            if (text.active) text.destroy();
            if (player.spokenLine === text) player.spokenLine = null;
            return;
        }
        text.setPosition(player.x, player.y - BUBBLE.heightAbovePlayer)
            .setAlpha(bubbleAlpha(expiresAt, now))
            .setVisible(player.visible);
    });
}
