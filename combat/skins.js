// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { ACHIEVEMENTS, isAchievementDone } from '../achievements.js';

const STORAGE_KEY = 'blockBattleGoldSkins';
const GOLD_SUFFIX = '_gold';
export const GOLD_ARM_COLOR = 0xb98827;

export const GOLD_TEXTURES = [
    { key: 'axeman', path: 'assets/sprites/axeman/axeman-default-gold.png' },
    { key: 'chainsawman', path: 'assets/sprites/axeman/axeman-chainsaw-gold.png' },
    { key: 'swordman', path: 'assets/sprites/swordman/swordman-default-gold.png' },
    { key: 'daggerman', path: 'assets/sprites/swordman/swordman-dagger-gold.png' },
    { key: 'fisherman', path: 'assets/sprites/fisherman/fisherman-default-gold.png' },
    { key: 'trapperman', path: 'assets/sprites/fisherman/fisherman-trapper-gold.png' },
    { key: 'scytheman', path: 'assets/sprites/scytheman/scytheman-default-gold.png' },
    { key: 'lawnmowerman', path: 'assets/sprites/scytheman/scytheman-lawnmower-gold.png' },
    { key: 'hammerman', path: 'assets/sprites/hammerman/hammerman-default-gold.png' },
    { key: 'sledgehammerman', path: 'assets/sprites/hammerman/hammerman-sledgehammer-gold.png' },
    { key: 'rockman', path: 'assets/sprites/rockman/rockman-default-1-gold.png' },
    { key: 'rockmanphase1', path: 'assets/sprites/rockman/rockman-default-2-gold.png' },
    { key: 'rockmanphase2', path: 'assets/sprites/rockman/rockman-default-3-gold.png' },
    { key: 'rockmanphase3', path: 'assets/sprites/rockman/rockman-default-4-gold.png' },
    { key: 'crowbarman', path: 'assets/sprites/crowbarman/crowbarman-default-gold.png' },
    { key: 'demolitionistman', path: 'assets/sprites/crowbarman/crowbarman-demolishionist-gold.png' },
    { key: 'gunman', path: 'assets/sprites/gunman/gunman-default-gold.png' },
    { key: 'sledge_idle', path: 'assets/sprites/hammerman/sledge_idle-gold.png' },
    { key: 'sledgehammeratk', path: 'assets/sprites/hammerman/sledgehammerswing-gold.png', frame: [150, 150] },
    { key: 'sledge_walk', path: 'assets/sprites/hammerman/sledge_walk-gold.png', frame: [150, 150] },
    { key: 'sledgehammerquickslam1', path: 'assets/sprites/hammerman/quickslam-gold.png', frame: [175, 175] },
    { key: 'sledgehammerquickslam2', path: 'assets/sprites/hammerman/quickslam2-gold.png', frame: [175, 175] },
    { key: 'whirlwind', path: 'assets/sprites/hammerman/whirlwind-gold.png', frame: [200, 200] },
    { key: 'axeatk', path: 'assets/sprites/axeman/axeatk1-gold.png', frame: [50, 50] },
    { key: 'axeatkthird', path: 'assets/sprites/axeman/axeatk2-gold.png', frame: [75, 50] },
    { key: 'axeatktilt', path: 'assets/sprites/axeman/axetilt-gold.png', frame: [75, 75] },
    { key: 'activechainsaw', path: 'assets/sprites/axeman/activechainsaw-gold.png', frame: [50, 50] },
    { key: 'inactivechainsaw', path: 'assets/sprites/axeman/inactivechainsaw-gold.png', frame: [50, 50] },
    { key: 'clawhammer', path: 'assets/sprites/axeman/clawhammer-gold.png', frame: [50, 50] },
    { key: 'swordatk', path: 'assets/sprites/swordman/swordatk1.1-gold.png', frame: [130, 50] },
    { key: 'swordatksecond', path: 'assets/sprites/swordman/swordatk1.2-gold.png', frame: [130, 50] },
    { key: 'swordatkthird', path: 'assets/sprites/swordman/swordatk1.3-gold.png', frame: [130, 50] },
    { key: 'swordatktilt', path: 'assets/sprites/swordman/swordatk3-gold.png', frame: [100, 50] },
    { key: 'sheathe', path: 'assets/sprites/swordman/sheathe-gold.png', frame: [200, 75] },
    { key: 'sheatheatk', path: 'assets/sprites/swordman/sheateatk-gold.png', frame: [200, 75] },
    { key: 'daggeratk', path: 'assets/sprites/swordman/daggeratk-gold.png', frame: [75, 50] },
    { key: 'rodatk', path: 'assets/sprites/fisherman/testrodAtk-gold.png', frame: [300, 300] },
    { key: 'reelin', path: 'assets/sprites/fisherman/reelIn-gold.png', frame: [300, 300] },
    { key: 'fishslap', path: 'assets/sprites/fisherman/fishermanslap-gold.png', frame: [300, 300] },
    { key: 'linelessrod', path: 'assets/sprites/fisherman/linelessRod-gold.png' },
    { key: 'harpoonatk', path: 'assets/sprites/fisherman/harpoonatk-gold.png', frame: [130, 50] },
    { key: 'harpoonlessatk', path: 'assets/sprites/fisherman/harpoonlessatk-gold.png', frame: [130, 50] },
    { key: 'netthrow', path: 'assets/sprites/fisherman/net_throw-gold.png', frame: [130, 50] },
    { key: 'scytheatk', path: 'assets/sprites/scytheman/scytheatk1-gold.png', frame: [50, 50] },
    { key: 'scytheatktilt', path: 'assets/sprites/scytheman/scythelightatk-gold.png', frame: [75, 75] },
    { key: 'pullcord', path: 'assets/sprites/scytheman/pullcord-gold.png', frame: [130, 75] },
    { key: 'whitescythe', path: 'assets/sprites/scytheman/whitescythe-gold.png' },
    { key: 'hammeratk', path: 'assets/sprites/hammerman/malletswing1.1-gold.png', frame: [200, 100] },
    { key: 'hammeratkheal', path: 'assets/sprites/hammerman/malletswing1.2-gold.png', frame: [130, 75] },
    { key: 'hammerdash', path: 'assets/sprites/hammerman/malletswing1.3-gold.png', frame: [100, 100] },
    { key: 'slateatk1', path: 'assets/sprites/rockman/slateatk1.1-gold.png', frame: [130, 100] },
    { key: 'slateatktilt', path: 'assets/sprites/rockman/slateatktilt-gold.png', frame: [75, 75] },
    { key: 'slateplunge', path: 'assets/sprites/rockman/slateplunge1.1-gold.png', frame: [130, 100] },
    { key: 'crowbaratk', path: 'assets/sprites/crowbarman/crowbaratk-gold.png', frame: [50, 50] },
    { key: 'crowbargrab', path: 'assets/sprites/crowbarman/crowbargrab-gold.png', frame: [200, 200] },
    { key: 'grabspin', path: 'assets/sprites/crowbarman/grabspin-gold.png', frame: [200, 200] },
    { key: 'bigcrowbarslam', path: 'assets/sprites/crowbarman/bigcrowbarslam-gold.png', frame: [200, 150] },
    { key: 'tapecast', path: 'assets/sprites/crowbarman/tapecast-gold.png', frame: [75, 60] },
    { key: 'bigcrowbar', path: 'assets/sprites/crowbarman/bigcrowbar-gold.png' },
    { key: 'tapestrip', path: 'assets/sprites/crowbarman/tapestrip-gold.png' },
    { key: 'tapefist', path: 'assets/sprites/crowbarman/tapefist-gold.png' },
    { key: 'gunmanatk', path: 'assets/sprites/gunman/gunmanatk-gold.png', frame: [50, 50] },
    { key: 'gunmanspecial', path: 'assets/sprites/gunman/gunmanspecial-gold.png', frame: [75, 75] },
    { key: 'hook', path: 'assets/sprites/fisherman/hook-gold.png' },
    { key: 'fish1', path: 'assets/sprites/fisherman/fish1-gold.png' },
    { key: 'fish2', path: 'assets/sprites/fisherman/fish2-gold.png' },
    { key: 'fish3', path: 'assets/sprites/fisherman/fish3-gold.png' },
    { key: 'axeprojectile', path: 'assets/sprites/axeman/axeprojectile-gold.png' },
    { key: 'harpoon', path: 'assets/sprites/fisherman/harpoon-gold.png' },
    { key: 'lawnmower-held', path: 'assets/sprites/scytheman/lawnmower-held-gold.png' },
    { key: 'lawnmower-only', path: 'assets/sprites/scytheman/lawnmower-only-gold.png' },
    { key: 'lawnmowerrun', path: 'assets/sprites/scytheman/lawnmowerrun-gold.png', frame: [130, 75] },
    { key: 'lilcrowbar', path: 'assets/sprites/crowbarman/lilcrowbar-gold.png' },
    { key: 'plank', path: 'assets/sprites/axeman/plank-gold.png' },
    { key: 'lightsteel', path: 'assets/sprites/hammerman/steelplank-gold.png' },
    { key: 'strongsteel', path: 'assets/sprites/hammerman/thicksteelplank-gold.png' }
];

export function preloadGoldTextures(load) {
    for (const { key, path, frame } of GOLD_TEXTURES) {
        if (frame) load.spritesheet(key + GOLD_SUFFIX, path, { frameWidth: frame[0], frameHeight: frame[1] });
        else load.image(key + GOLD_SUFFIX, path);
    }
}

export function skinTextureKey(scene, key, skin) {
    if (skin !== 'gold') return key;
    const goldKey = key + GOLD_SUFFIX;
    return scene.textures.exists(goldKey) ? goldKey : key;
}

function swapToSkin(sprite) {
    const frame = sprite.frame;
    if (!sprite.skin || !frame?.texture) return null;
    const key = skinTextureKey(sprite.scene, frame.texture.key, sprite.skin);
    if (key === frame.texture.key) return null;
    const skinned = sprite.scene.textures.getFrame(key, frame.name);
    if (!skinned) return null;
    const original = { texture: sprite.texture, frame };
    sprite.texture = skinned.texture;
    sprite.frame = skinned;
    return original;
}

function restore(sprite, original) {
    if (!original) return;
    sprite.texture = original.texture;
    sprite.frame = original.frame;
}

export function applySkin(sprite, skin) {
    if (!sprite) return;
    sprite.skin = skin ?? null;
    if (sprite.skinStepInstalled) return;
    sprite.skinStepInstalled = true;
    if (sprite.addRenderStep) {
        sprite.addRenderStep((renderer, gameObject, drawingContext, parentMatrix, renderStep, displayList, displayListIndex) => {
            const original = swapToSkin(gameObject);
            gameObject.renderWebGLStep(renderer, gameObject, drawingContext, parentMatrix, renderStep + 1, displayList, displayListIndex);
            restore(gameObject, original);
        }, 0);
    }
    const renderCanvas = sprite.renderCanvas;
    if (renderCanvas) {
        sprite.renderCanvas = (renderer, src, camera, parentMatrix) => {
            const original = swapToSkin(src);
            renderCanvas.call(src, renderer, src, camera, parentMatrix);
            restore(src, original);
        };
    }
}

function masteryAchievement(characterKey) {
    return ACHIEVEMENTS.find(achievement => achievement.masteryOf === characterKey) ?? null;
}

function devGoldSkins() {
    try {
        return Boolean(import.meta.env?.DEV) && new URLSearchParams(window.location.search).has('goldskins');
    } catch {
        return false;
    }
}

export function isGoldSkinUnlocked(characterKey) {
    if (devGoldSkins()) return true;
    const mastery = masteryAchievement(characterKey);
    return Boolean(mastery && isAchievementDone(mastery));
}

function readPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch {
        return {};
    }
}

export function isGoldSkinEnabled(characterKey) {
    return readPreferences()[characterKey] !== false;
}

export function setGoldSkinEnabled(characterKey, enabled) {
    const preferences = readPreferences();
    preferences[characterKey] = Boolean(enabled);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        return;
    }
}

export function chosenSkin(characterKey) {
    return isGoldSkinUnlocked(characterKey) && isGoldSkinEnabled(characterKey) ? 'gold' : null;
}
