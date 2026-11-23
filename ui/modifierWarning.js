// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { COLORS, makeButton, makePanel, textStyle } from './theme.js';

export const MODIFIER_ACHIEVEMENT_WARNING = 'MATCHES WITH MODIFIERS DO NOT COUNT TOWARD ACHIEVEMENTS.';

const STORAGE_KEY = 'blockBattleSeenModifierWarning';
const DEPTH = 6000;
const PANEL = { width: 460, height: 230 };

function hasSeenWarning() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function markWarningSeen() {
    try {
        localStorage.setItem(STORAGE_KEY, '1');
    } catch {
        return;
    }
}

export function warnModifiersOnce(scene) {
    if (scene.modifierWarning || hasSeenWarning()) return null;
    markWarningSeen();
    const parts = [];
    const add = (...objects) => {
        for (const object of objects) {
            object.setScrollFactor?.(0);
            object.setDepth?.(DEPTH + parts.length);
            parts.push(object);
        }
    };
    add(scene.add.rectangle(500, 300, 1000, 600, 0x000000, 0.6).setInteractive());
    add(makePanel(scene, 500, 300, PANEL.width, PANEL.height));
    add(scene.add.text(500, 225, 'HEADS UP', textStyle('title', { fontSize: '30px', fill: COLORS.accent })).setOrigin(0.5));
    add(scene.add.text(500, 285, `${MODIFIER_ACHIEVEMENT_WARNING}\nPLAY WITH NONE ON TO EARN PROGRESS.`, textStyle('body', {
        fontSize: '18px',
        align: 'center',
        wordWrap: { width: PANEL.width - 50 }
    })).setOrigin(0.5));

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        parts.forEach(object => object.destroy());
        if (scene.modifierWarning === handle) scene.modifierWarning = null;
    };
    const ok = makeButton(scene, 500, 370, 150, 46, 'OK', close);
    add(ok.box, ok.text);

    const handle = { close };
    scene.modifierWarning = handle;
    scene.events.once('shutdown', close);
    return handle;
}
