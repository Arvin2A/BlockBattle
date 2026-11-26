// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { openAdvancedInfo } from './advancedInfo.js';

const IGNORED_SCENES = ['AchievementToastScene'];

function isTyping() {
    const element = document.activeElement;
    if (!element) return false;
    return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function activeScenes(game) {
    return game.scene.getScenes(true, true).filter(scene => !IGNORED_SCENES.includes(scene.sys.settings.key));
}

function toggleCharacterInfo(game) {
    const scenes = activeScenes(game);
    const open = scenes.find(scene => scene.advancedInfo);
    if (open) {
        open.advancedInfo.close();
        return;
    }
    const owner = scenes.find(scene => typeof scene.openCharacterInfo === 'function');
    if (owner) {
        if (owner.canOpenCharacterInfo?.() === false) return;
        owner.openCharacterInfo();
        return;
    }
    const top = scenes[0];
    if (!top || top.canOpenCharacterInfo?.() === false) return;
    top.sound.play('hover2');
    openAdvancedInfo(top);
}

export function installCharacterInfoHotkey(game) {
    const onKeyDown = event => {
        if (event.code !== 'KeyI' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        if (isTyping()) return;
        toggleCharacterInfo(game);
    };
    window.addEventListener('keydown', onKeyDown);
    game.events.once('destroy', () => window.removeEventListener('keydown', onKeyDown));
}
