// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { FONTS, makeButton } from './theme.js';

const MODES = ['both', 'p1', 'p2'];

function modeLabel(mode, players) {
    if (mode === 'both') return 'BOTH';
    const player = mode === 'p1' ? players.player : players.player2;
    if (!player?.isBot) return mode.toUpperCase();
    const bothBots = players.player?.isBot && players.player2?.isBot;
    return bothBots ? `CPU ${mode === 'p1' ? 1 : 2}` : 'CPU';
}

export function createPerspectiveSwitch(scene, startMode = 'p1') {
    const state = { mode: startMode };
    const cycle = () => {
        state.mode = MODES[(MODES.indexOf(state.mode) + 1) % MODES.length];
        scene.sound.play('hover2');
    };
    state.button = makeButton(scene, 500, 195, 220, 32, '', cycle, 15);
    state.button.text.setFontFamily(FONTS.body);
    scene.hud.add([state.button.box, state.button.text]);
    state.key = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    state.cycle = cycle;
    return state;
}

export function updatePerspective(scene, state) {
    if (state.key && Phaser.Input.Keyboard.JustDown(state.key)) state.cycle();

    const players = scene.gameState.players;
    state.button.text.setText(`VIEW: ${modeLabel(state.mode, players)}  [V]`);
    if (state.mode === 'both') return null;
    return state.mode === 'p1' ? players.player : players.player2;
}
