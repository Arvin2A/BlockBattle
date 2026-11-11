// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { COLORS, HEX, makeButton, makePanel, textStyle } from './theme.js';
import { isPhoneScreen } from './touchAssist.js';

const STORAGE_KEY = 'blockBattleSettings';
const VOLUME_STEP = 0.1;
const MATCH_SCENES = ['GameScene', 'OnlineGameScene'];
export const TOUCH_LAYOUTS = ['DPAD', 'THUMBSTICK'];

const DEFAULTS = { masterVolume: 1, gameVolume: 1, touchControls: null };

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        return { ...DEFAULTS, ...saved };
    } catch {
        return { ...DEFAULTS };
    }
}

let settings = loadSettings();

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
    }
}

export function getTouchLayout() {
    return TOUCH_LAYOUTS.includes(settings.touchControls)
        ? settings.touchControls
        : (isPhoneScreen() ? 'THUMBSTICK' : 'DPAD');
}

export function usesThumbstick() {
    return getTouchLayout() === 'THUMBSTICK';
}

function matchRunning(game) {
    return MATCH_SCENES.some(key => game.scene.isActive(key));
}

export function applyVolume(game, inMatch = matchRunning(game)) {
    if (!game?.sound) return;
    game.sound.volume = settings.masterVolume * (inMatch ? settings.gameVolume : 1);
}

export function useMatchVolume(scene) {
    applyVolume(scene.game, true);
    scene.events.once('shutdown', () => applyVolume(scene.game, false));
}

function stepVolume(value, direction) {
    return Phaser.Math.Clamp(Math.round((value + direction * VOLUME_STEP) * 10) / 10, 0, 1);
}

const percent = value => `${Math.round(value * 100)}%`;

function setEnabled({ box, text }, enabled) {
    box.setFillStyle(HEX.panel).setStrokeStyle(3, enabled ? HEX.border : HEX.cpu);
    text.setColor(enabled ? COLORS.text : COLORS.cpu);
    if (enabled) box.setInteractive({ useHandCursor: true });
    else box.disableInteractive();
}

export function addSettingsButton(scene, { x = 968, y = 32, scale = 0.12, depth = 3000, container = null, onPress } = {}) {
    const button = scene.add.image(x, y, 'settingsBtn')
        .setScale(scale)
        .setScrollFactor(0)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
    container?.add(button);
    const lift = () => button.setTexture('settingsBtn');
    button.on('pointerdown', () => {
        button.setTexture('pressedSettingsBtn');
        (onPress ?? (() => openSettings(scene, { container })))();
    });
    scene.input.on('pointerup', lift);
    button.on('pointerout', lift);
    return button;
}

export function openSettings(scene, { container = null, onClose } = {}) {
    if (scene.settingsPanel) return scene.settingsPanel;
    const parts = [];
    const add = (...objects) => {
        for (const object of objects) {
            object.setScrollFactor?.(0);
            object.setDepth?.(6000 + parts.length);
            container?.add(object);
            parts.push(object);
        }
    };
    const touch = scene.sys.game.device.input.touch;
    const rows = touch ? 3 : 2;
    const rowGap = 70;
    const height = 170 + rows * rowGap;
    const top = 300 - height / 2;

    add(scene.add.rectangle(500, 300, 1000, 600, 0x000000, 0.6).setInteractive());
    add(makePanel(scene, 500, 300, 580, height));
    add(scene.add.text(500, top + 45, 'SETTINGS', textStyle('title')).setOrigin(0.5));

    const rowY = index => top + 115 + index * rowGap;
    const label = (index, text) => add(scene.add.text(240, rowY(index), text, textStyle('body', { fontSize: '22px' })).setOrigin(0, 0.5));

    const volumeRow = (index, title, key) => {
        label(index, title);
        const value = scene.add.text(690, rowY(index), percent(settings[key]), textStyle('body', { fontSize: '22px', fill: COLORS.accent }))
            .setOrigin(0.5);
        const less = makeButton(scene, 615, rowY(index), 44, 40, '<', () => change(-1), 22);
        const more = makeButton(scene, 765, rowY(index), 44, 40, '>', () => change(1), 22);
        const refresh = () => {
            value.setText(percent(settings[key]));
            setEnabled(less, settings[key] > 0);
            setEnabled(more, settings[key] < 1);
        };
        const change = direction => {
            settings[key] = stepVolume(settings[key], direction);
            saveSettings();
            applyVolume(scene.game);
            refresh();
        };
        add(less.box, less.text, more.box, more.text, value);
        refresh();
    };

    volumeRow(0, 'MASTER VOLUME', 'masterVolume');
    volumeRow(1, 'IN GAME VOLUME', 'gameVolume');

    if (touch) {
        label(2, 'TOUCH CONTROLS');
        const toggle = makeButton(scene, 690, rowY(2), 194, 40, getTouchLayout(), () => {
            const next = TOUCH_LAYOUTS[(TOUCH_LAYOUTS.indexOf(getTouchLayout()) + 1) % TOUCH_LAYOUTS.length];
            settings.touchControls = next;
            saveSettings();
            toggle.text.setText(next);
        }, 20);
        add(toggle.box, toggle.text);
        if (matchRunning(scene.game)) {
            add(scene.add.text(690, rowY(2) + 30, 'STARTS NEXT MATCH', textStyle('body', { fontSize: '13px', fill: COLORS.muted }))
                .setOrigin(0.5));
        }
    }

    const close = () => {
        parts.forEach(object => object.destroy());
        scene.settingsPanel = null;
        scene.input.keyboard?.off('keydown-ESC', close);
        onClose?.();
    };
    const back = makeButton(scene, 500, top + height - 45, 200, 44, 'BACK', close);
    add(back.box, back.text);
    scene.input.keyboard?.once('keydown-ESC', close);
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown-ESC', close));

    scene.settingsPanel = { close };
    return scene.settingsPanel;
}
