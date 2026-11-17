// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { getCharacterScript } from '../combat/characterStats.js';
import { getAttackSpriteFlipX, getAttackSpriteOffset } from '../combat/attackSprite.js';
import { createGameAnimations } from '../scenes/GameScene/animations.js';

const BASE_ANCHOR = { x: 45, y: -15 };
const MAX_SCALE = 3;
const FIRST_SWING_MS = 350;
const GAP_MS = 450;
const LOOPING_SWING_MS = 900;

const boundsCache = new Map();

function opaqueBounds(scene, textureKey) {
    if (boundsCache.has(textureKey)) return boundsCache.get(textureKey);
    const texture = scene.textures.get(textureKey);
    const source = texture.getSourceImage();
    const frames = texture.getFrameNames();
    const list = (frames.length ? frames : ['__BASE']).map(name => texture.get(name));
    const fallback = { left: -list[0].width / 2, right: list[0].width / 2, top: -list[0].height / 2, bottom: list[0].height / 2 };
    let bounds = null;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(source, 0, 0);
        const pixels = context.getImageData(0, 0, source.width, source.height).data;
        for (const frame of list) {
            for (let y = 0; y < frame.cutHeight; y++) {
                const row = (frame.cutY + y) * source.width;
                for (let x = 0; x < frame.cutWidth; x++) {
                    if (pixels[(row + frame.cutX + x) * 4 + 3] < 16) continue;
                    const localX = x - frame.cutWidth / 2;
                    const localY = y - frame.cutHeight / 2;
                    if (!bounds) bounds = { left: localX, right: localX + 1, top: localY, bottom: localY + 1 };
                    bounds.left = Math.min(bounds.left, localX);
                    bounds.right = Math.max(bounds.right, localX + 1);
                    bounds.top = Math.min(bounds.top, localY);
                    bounds.bottom = Math.max(bounds.bottom, localY + 1);
                }
            }
        }
    } catch {
        bounds = null;
    }
    const result = bounds ?? fallback;
    boundsCache.set(textureKey, result);
    return result;
}

function demoSetup(scene, character, variant) {
    const fake = { name: character.name, variant: variant.name, lastDir: { x: 1, y: 0 } };
    const script = getCharacterScript(fake) ?? {};
    const props = (script.variantDemoProps?.[variant.name] ?? script.demoProps ?? [])
        .filter(prop => scene.textures.exists(prop.texture));
    const animations = (script.variantDemoAnimations?.[variant.name] ?? script.demoAnimations ?? [])
        .filter(entry => typeof entry === 'string'
            ? scene.anims.exists(entry)
            : props.some(prop => prop.texture === entry.prop));
    const idle = script.variantDemoIdle?.[variant.name] ?? script.demoIdle ?? null;
    const anchor = script.variantDemoAnchors?.[variant.name] ?? script.demoAnchor ?? null;
    const scale = script.variantAttackSpriteScales?.[variant.name] ?? 1;
    const textureOf = key => scene.anims.get(key)?.frames[0]?.textureKey ?? key;
    const scaleOf = textureKey => script.textureAttackSpriteScales?.[textureKey] ?? scale;
    const placement = (textureKey, animKey = textureKey) => {
        if (anchor) return { x: anchor.x, y: anchor.y, flip: !anchor.facesRight };
        const offset = getAttackSpriteOffset(fake, textureKey);
        return {
            x: BASE_ANCHOR.x + offset.x,
            y: BASE_ANCHOR.y + offset.y,
            flip: animKey === 'scytheatktilt' ? false : getAttackSpriteFlipX(fake, textureKey)
        };
    };
    return { animations, idle, scale, scaleOf, props, textureOf, placement };
}

function fitBounds(scene, bodyKey, setup) {
    const total = { ...opaqueBounds(scene, bodyKey) };
    const include = (textureKey, animKey) => {
        if (!scene.textures.exists(textureKey)) return;
        const bounds = opaqueBounds(scene, textureKey);
        const { x, y, flip } = setup.placement(textureKey, animKey);
        const left = flip ? -bounds.right : bounds.left;
        const right = flip ? -bounds.left : bounds.right;
        const scale = setup.scaleOf(textureKey);
        total.left = Math.min(total.left, x + left * scale);
        total.right = Math.max(total.right, x + right * scale);
        total.top = Math.min(total.top, y + bounds.top * scale);
        total.bottom = Math.max(total.bottom, y + bounds.bottom * scale);
    };
    setup.animations.forEach(key => {
        if (typeof key === 'string') include(setup.textureOf(key), key);
    });
    if (setup.idle) include(setup.idle);
    setup.props.forEach(prop => {
        const bounds = opaqueBounds(scene, prop.texture);
        const frame = scene.textures.getFrame(prop.texture);
        const scale = prop.scale ?? 1;
        const shiftX = (0.5 - (prop.originX ?? 0.5)) * frame.width;
        const shiftY = (0.5 - (prop.originY ?? 0.5)) * frame.height;
        total.left = Math.min(total.left, prop.x + (bounds.left + shiftX) * scale);
        total.right = Math.max(total.right, prop.x + (bounds.right + shiftX) * scale);
        total.top = Math.min(total.top, prop.y + (bounds.top + shiftY) * scale);
        total.bottom = Math.max(total.bottom, prop.y + (bounds.bottom + shiftY) * scale);
    });
    return total;
}

export function createFighterDemo(scene, { x, y, width, height }) {
    createGameAnimations(scene);
    const holder = scene.add.container(x, y);
    const body = scene.add.image(0, 0, CHARACTER_ROSTER[0].key);
    const weapon = scene.add.sprite(0, 0, CHARACTER_ROSTER[0].key).setVisible(false);
    holder.add([body, weapon]);

    let setup = null;
    let props = [];
    let step = 0;
    let timer = null;
    let generation = 0;

    const place = (textureKey, animKey) => {
        const { x: wx, y: wy, flip } = setup.placement(textureKey, animKey);
        weapon.setPosition(wx, wy).setFlipX(flip).setScale(setup.scaleOf(textureKey));
    };

    const showIdle = () => {
        weapon.stop();
        if (!setup.idle || !scene.textures.exists(setup.idle)) {
            weapon.setVisible(false);
            return;
        }
        weapon.setTexture(setup.idle, 0).setVisible(true);
        place(setup.idle);
    };

    const schedule = (delay, callback) => {
        timer?.remove(false);
        timer = scene.time.delayedCall(delay, callback);
    };

    const swing = () => {
        if (!setup.animations.length) return;
        const key = setup.animations[step % setup.animations.length];
        step++;
        const mine = generation;
        if (typeof key !== 'string') {
            const prop = props[setup.props.findIndex(each => each.texture === key.prop)];
            weapon.stop().setVisible(false);
            prop.setVisible(true);
            schedule(key.ms ?? LOOPING_SWING_MS, () => {
                if (mine !== generation) return;
                prop.setVisible(false);
                showIdle();
                schedule(GAP_MS, swing);
            });
            return;
        }
        const textureKey = setup.textureOf(key);
        weapon.stop();
        weapon.setTexture(textureKey, 0).setVisible(true);
        place(textureKey, key);
        const finish = () => {
            if (mine !== generation || !weapon.active) return;
            showIdle();
            schedule(GAP_MS, swing);
        };
        weapon.play(key);
        if (scene.anims.get(key).repeat === -1) schedule(LOOPING_SWING_MS, finish);
        else weapon.once(`animationcomplete-${key}`, finish);
    };

    const show = (characterIndex, variantIndex) => {
        const character = CHARACTER_ROSTER[characterIndex];
        const variant = character.variants[variantIndex] ?? character.variants[0];
        generation++;
        timer?.remove(false);
        weapon.removeAllListeners();
        step = 0;
        setup = demoSetup(scene, character, variant);
        const bodyKey = getCharacterTexture(character.key, variant.name);
        body.setTexture(bodyKey);
        props.forEach(prop => prop.destroy());
        props = setup.props.map(prop => scene.add.image(prop.x, prop.y, prop.texture)
            .setOrigin(prop.originX ?? 0.5, prop.originY ?? 0.5)
            .setScale(prop.scale ?? 1));
        props.forEach((prop, index) => holder.addAt(prop, 1 + index));
        const stepProps = setup.animations.filter(entry => typeof entry !== 'string').map(entry => entry.prop);
        props.forEach((prop, index) => prop.setVisible(!stepProps.includes(setup.props[index].texture)));
        const bounds = fitBounds(scene, bodyKey, setup);
        const fitScale = Math.min(MAX_SCALE, width / (bounds.right - bounds.left), height / (bounds.bottom - bounds.top));
        holder.setScale(fitScale).setPosition(
            x - (bounds.left + bounds.right) / 2 * fitScale,
            y - (bounds.top + bounds.bottom) / 2 * fitScale
        );
        showIdle();
        schedule(FIRST_SWING_MS, swing);
    };

    const destroy = () => {
        generation++;
        timer?.remove(false);
        holder.destroy();
    };
    scene.events.once('shutdown', () => timer?.remove(false));

    return { container: holder, show, destroy };
}
