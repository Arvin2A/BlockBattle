// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { COLORS, HEX, makeButton, makePanel, textStyle } from './theme.js';
import { isPhoneScreen } from './touchAssist.js';
import { openAdvancedInfo } from './advancedInfo.js';

const STORAGE_KEY = 'blockBattleSettings';
const VOLUME_STEP = 0.1;
const MATCH_SCENES = ['GameScene', 'OnlineGameScene'];
export const TOUCH_LAYOUTS = ['DPAD', 'THUMBSTICK'];
const SCREEN_SHAKE = { DEFAULT: 1, REDUCED: 0.4, NONE: 0 };
const SCREEN_SHAKE_OPTIONS = Object.keys(SCREEN_SHAKE);

const DEFAULTS = { masterVolume: 1, gameVolume: 1, touchControls: null, screenShake: 'DEFAULT', hitParticles: true };

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

function getScreenShakeOption() {
    return SCREEN_SHAKE_OPTIONS.includes(settings.screenShake) ? settings.screenShake : 'DEFAULT';
}

export function getScreenShakeScale() {
    return SCREEN_SHAKE[getScreenShakeOption()];
}

export function hitParticlesEnabled() {
    return settings.hitParticles !== false;
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

export function addSettingsButton(scene, {
    x = 968,
    y = 32,
    scale = 0.12,
    depth = 3000,
    container = null,
    onPress,
    texture = 'settingsBtn',
    pressedTexture = 'pressedSettingsBtn',
    tint = null
} = {}) {
    const button = scene.add.image(x, y, texture)
        .setScale(scale)
        .setScrollFactor(0)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
    if (tint !== null) button.setTint(tint);
    button.skin = { texture, pressedTexture };
    container?.add(button);
    const lift = () => button.setTexture(button.skin.texture);
    button.on('pointerdown', () => {
        button.setTexture(button.skin.pressedTexture);
        (onPress ?? (() => openSettings(scene, { container })))();
    });
    scene.input.on('pointerup', lift);
    button.on('pointerout', lift);
    return button;
}

export function setSettingsButtonTint(scene, button, tint) {
    const grey = tint !== null && scene.textures.exists('settingsBtnGrey') && scene.textures.exists('pressedSettingsBtnGrey');
    button.skin = grey
        ? { texture: 'settingsBtnGrey', pressedTexture: 'pressedSettingsBtnGrey' }
        : { texture: 'settingsBtn', pressedTexture: 'pressedSettingsBtn' };
    button.setTexture(button.skin.texture);
    if (grey) button.setTint(tint);
    else button.clearTint();
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
    const showInfo = !MATCH_SCENES.includes(scene.sys.settings.key) || Boolean(scene.openCharacterInfo);
    const touchRow = 4;
    const infoRow = touch ? 5 : 4;
    const rows = infoRow + (showInfo ? 1 : 0);
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

    label(2, 'SCREEN SHAKE');
    const shake = makeButton(scene, 690, rowY(2), 194, 40, getScreenShakeOption(), () => {
        const next = SCREEN_SHAKE_OPTIONS[(SCREEN_SHAKE_OPTIONS.indexOf(getScreenShakeOption()) + 1) % SCREEN_SHAKE_OPTIONS.length];
        settings.screenShake = next;
        saveSettings();
        shake.text.setText(next);
    }, 20);
    add(shake.box, shake.text);

    label(3, 'HIT PARTICLES');
    const particles = makeButton(scene, 690, rowY(3), 194, 40, hitParticlesEnabled() ? 'ON' : 'OFF', () => {
        settings.hitParticles = !hitParticlesEnabled();
        saveSettings();
        particles.text.setText(hitParticlesEnabled() ? 'ON' : 'OFF');
    }, 20);
    add(particles.box, particles.text);

    if (touch) {
        label(touchRow, 'TOUCH CONTROLS');
        const toggle = makeButton(scene, 690, rowY(touchRow), 194, 40, getTouchLayout(), () => {
            const next = TOUCH_LAYOUTS[(TOUCH_LAYOUTS.indexOf(getTouchLayout()) + 1) % TOUCH_LAYOUTS.length];
            settings.touchControls = next;
            saveSettings();
            toggle.text.setText(next);
        }, 20);
        add(toggle.box, toggle.text);
        if (matchRunning(scene.game)) {
            add(scene.add.text(690, rowY(touchRow) + 30, 'STARTS NEXT MATCH', textStyle('body', { fontSize: '13px', fill: COLORS.muted }))
                .setOrigin(0.5));
        }
    }

    const dismiss = () => {
        parts.forEach(object => object.destroy());
        scene.settingsPanel = null;
        scene.input.keyboard?.off('keydown-ESC', close);
    };
    const close = () => {
        dismiss();
        onClose?.();
    };

    if (showInfo) {
        label(infoRow, 'FIGHTER INFO');
        const view = makeButton(scene, 690, rowY(infoRow), 194, 40, 'VIEW', () => {
            dismiss();
            const reopen = () => openSettings(scene, { container, onClose });
            if (scene.openCharacterInfo) scene.openCharacterInfo(reopen);
            else openAdvancedInfo(scene, { container, onClose: reopen });
        }, 20);
        add(view.box, view.text);
    }
    const back = makeButton(scene, 500, top + height - 45, 200, 44, 'BACK', close);
    add(back.box, back.text);
    scene.input.keyboard?.once('keydown-ESC', close);
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown-ESC', close));

    scene.settingsPanel = { close };
    return scene.settingsPanel;
}
