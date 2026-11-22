// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { makeButton, makePanel, textStyle } from './theme.js';

const DEPTH = 6000;
const PANEL = { width: 420, height: 200 };

export function openConfirm(scene, { title = 'Are you sure?', onYes, onNo, container = null } = {}) {
    if (scene.settingsPanel) return null;
    const parts = [];
    const add = (...objects) => {
        for (const object of objects) {
            object.setScrollFactor?.(0);
            object.setDepth?.(DEPTH + parts.length);
            container?.add(object);
            parts.push(object);
        }
    };
    add(scene.add.rectangle(500, 300, 1000, 600, 0x000000, 0.6).setInteractive());
    add(makePanel(scene, 500, 300, PANEL.width, PANEL.height));
    add(scene.add.text(500, 250, title, textStyle('title', { fontSize: '30px' })).setOrigin(0.5));

    const dismiss = () => {
        parts.forEach(object => object.destroy());
        scene.input.keyboard?.off('keydown-ESC', answerNo);
        if (scene.settingsPanel === handle) scene.settingsPanel = null;
    };
    const answerYes = () => {
        dismiss();
        onYes?.();
    };
    const answerNo = () => {
        dismiss();
        onNo?.();
    };
    const yes = makeButton(scene, 410, 330, 150, 46, 'YES', answerYes);
    const no = makeButton(scene, 590, 330, 150, 46, 'NO', answerNo);
    add(yes.box, yes.text, no.box, no.text);

    const handle = { close: dismiss };
    scene.settingsPanel = handle;
    scene.input.keyboard?.once('keydown-ESC', answerNo);
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown-ESC', answerNo));
    return handle;
}
