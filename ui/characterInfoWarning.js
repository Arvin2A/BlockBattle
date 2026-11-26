// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { COLORS, makeButton, makePanel, textStyle } from './theme.js';

const STORAGE_KEY = 'blockBattleCharacterInfoWarning';
const WARNING_VERSION = '2026-11-25-4';
const TIMES_TO_SHOW = 3;
const DEPTH = 6000;
const PANEL = { width: 520, height: 280 };

function shownCount() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        return saved?.version === WARNING_VERSION ? saved.shown ?? 0 : 0;
    } catch {
        return 0;
    }
}

function countShown() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: WARNING_VERSION, shown: shownCount() + 1 }));
    } catch {
        return;
    }
}

export function needsCharacterInfoWarning() {
    return shownCount() < TIMES_TO_SHOW;
}

export function withCharacterInfoWarning(scene, onProceed, onReadInfo) {
    if (scene.characterInfoWarning) return;
    if (!needsCharacterInfoWarning()) {
        onProceed();
        return;
    }
    countShown();
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
    add(scene.add.text(500, 200, 'PLEASE READ THE CHARACTER INFO', textStyle('title', { fontSize: '24px', fill: COLORS.accent })).setOrigin(0.5));
    add(scene.add.text(500, 275,
        'LOTS OF FIGHTERS GOT NEW MOVES THIS UPDATE, AND SOME LOST OLD ONES.\n' +
        'CHECK YOUR FIGHTER BEFORE YOU PLAY: PRESS I, OR OPEN SETTINGS > FIGHTER INFO. NEW MOVES ARE GREEN AND CHANGED ONES ARE YELLOW.',
        textStyle('body', { fontSize: '16px', align: 'center', wordWrap: { width: PANEL.width - 50 } })).setOrigin(0.5));

    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        parts.forEach(object => object.destroy());
        if (scene.characterInfoWarning === handle) scene.characterInfoWarning = null;
    };
    const proceed = makeButton(scene, 395, 375, 190, 46, 'PROCEED', () => {
        close();
        onProceed();
    });
    const read = makeButton(scene, 605, 375, 190, 46, 'READ INFO', () => {
        close();
        onReadInfo();
    });
    add(proceed.box, proceed.text, read.box, read.text);

    const handle = { close };
    scene.characterInfoWarning = handle;
    scene.events.once('shutdown', close);
}
