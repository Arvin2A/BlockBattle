// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { COLORS, FONTS, HEX, textStyle } from './theme.js';

const DEPTH = 3000;
const PANEL = { x: 500, y: 300, width: 560, height: 540 };
const TOP = PANEL.y - PANEL.height / 2;
const ICON_SIZE = 120;
const BODY = { y: TOP + 238, width: 470, height: 280, size: 17 };
const BODY_LEFT = PANEL.x - PANEL.width / 2 + 30;
const SCROLLBAR_X = PANEL.x + PANEL.width / 2 - 22;
const WHEEL_STEP = 0.5;
const KEY_STEP = 40;
const TYPE_MS_PER_CHAR = 6;
const TYPE_MAX_MS = 1200;

const ENTRIES = CHARACTER_ROSTER.flatMap((character, characterIndex) =>
    character.variants.map((variant, variantIndex) => ({ character, variant, characterIndex, variantIndex })));

const cleanAbilities = abilities => String(abilities ?? '')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function isAdvancedInfoOpen(scene) {
    return Boolean(scene.advancedInfo);
}

export function openAdvancedInfo(scene, { characterIndex = 0, variantIndex = 0, onClose = null, container = null } = {}) {
    if (scene.advancedInfo) return scene.advancedInfo;
    let index = Math.max(0, ENTRIES.findIndex(entry =>
        entry.characterIndex === characterIndex && entry.variantIndex === variantIndex));

    const parts = [];
    const add = (object, depth = 0) => {
        parts.push(object.setDepth(DEPTH + depth).setScrollFactor(0));
        container?.add(object);
        return object;
    };

    add(scene.add.rectangle(500, 300, 2000, 1200, 0x000000, 0.78).setInteractive());
    add(scene.add.rectangle(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 0x151515, 1).setStrokeStyle(4, 0x686868), 1);

    const title = add(scene.add.text(PANEL.x, TOP + 38, '', {
        fontFamily: FONTS.body,
        fontSize: '30px',
        fill: COLORS.text,
        stroke: COLORS.stroke,
        strokeThickness: 5
    }).setOrigin(0.5), 2);
    const subtitle = add(scene.add.text(PANEL.x, TOP + 76, '', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        fill: COLORS.accent,
        stroke: COLORS.stroke,
        strokeThickness: 3
    }).setOrigin(0.5), 2);
    const icon = add(scene.add.image(PANEL.x, TOP + 160, ENTRIES[index].character.key), 2);
    const body = add(scene.add.text(BODY_LEFT, BODY.y, '', textStyle('body', {
        fontSize: `${BODY.size}px`,
        lineSpacing: 5,
        wordWrap: { width: BODY.width }
    })), 2);
    add(scene.add.rectangle(PANEL.x, BODY.y - 8, PANEL.width - 40, 2, 0x444444), 2);
    const track = add(scene.add.rectangle(SCROLLBAR_X, BODY.y + BODY.height / 2, 6, BODY.height, 0x2a2a2a), 2);
    const thumb = add(scene.add.rectangle(SCROLLBAR_X, BODY.y, 6, 40, 0x888888).setOrigin(0.5, 0), 3);
    const viewport = add(scene.add.zone(BODY_LEFT + BODY.width / 2, BODY.y + BODY.height / 2, BODY.width + 30, BODY.height)
        .setInteractive(), 2);

    let scroll = 0;
    const maxScroll = () => Math.max(0, body.height - BODY.height);
    const applyScroll = () => {
        scroll = Math.max(0, Math.min(maxScroll(), scroll));
        body.setY(BODY.y - scroll).setCrop(0, scroll, body.width, BODY.height);
        const max = maxScroll();
        const scrollable = max > 0;
        track.setVisible(scrollable);
        thumb.setVisible(scrollable);
        if (!scrollable) return;
        const thumbHeight = Math.max(30, BODY.height * BODY.height / body.height);
        thumb.setSize(6, thumbHeight).setY(BODY.y + (BODY.height - thumbHeight) * (scroll / max));
    };
    const scrollBy = amount => {
        scroll += amount;
        applyScroll();
    };

    let dragFrom = null;
    viewport.on('pointerdown', pointer => {
        dragFrom = { y: pointer.y, scroll };
    });
    const onPointerMove = pointer => {
        if (!dragFrom || !pointer.isDown) return;
        scroll = dragFrom.scroll + (dragFrom.y - pointer.y);
        applyScroll();
    };
    const onPointerUp = () => {
        dragFrom = null;
    };
    const onWheel = (_pointer, _objects, _deltaX, deltaY) => scrollBy(deltaY * WHEEL_STEP);

    const makeArrow = (x, label, step) => {
        const box = add(scene.add.rectangle(x, TOP + 160, 44, 44, 0x202020).setStrokeStyle(2, 0x444444)
            .setInteractive({ useHandCursor: true }), 2);
        const text = add(scene.add.text(x, TOP + 160, label, { fontFamily: FONTS.body, fontSize: '26px', fill: COLORS.text })
            .setOrigin(0.5), 3);
        box.on('pointerover', () => box.setFillStyle(0x333333));
        box.on('pointerout', () => box.setFillStyle(0x202020));
        box.on('pointerdown', () => step());
        return { box, text };
    };

    const closeX = PANEL.x + PANEL.width / 2 - 34;
    const closeBox = add(scene.add.rectangle(closeX, TOP + 34, 48, 40, 0x771c1c).setStrokeStyle(2, HEX.border)
        .setInteractive({ useHandCursor: true }), 4);
    add(scene.add.text(closeX, TOP + 34, 'X', { fontFamily: FONTS.body, fontSize: '26px', fill: COLORS.text }).setOrigin(0.5), 5);
    closeBox.on('pointerover', () => closeBox.setFillStyle(0xc0392b));
    closeBox.on('pointerout', () => closeBox.setFillStyle(0x771c1c));

    let typing = null;
    const stopTyping = () => {
        if (typing) setTexts(typing.targets);
        typing = null;
    };

    const layoutBody = text => {
        body.setWordWrapWidth(BODY.width).setText(text);
        const wrapped = body.getWrappedText(text).join('\n');
        body.setWordWrapWidth(null).setText(wrapped);
        return wrapped;
    };
    const setTexts = targets => {
        targets.forEach(({ object, text }) => object.setText(text));
        applyScroll();
    };

    const show = (animate = false) => {
        stopTyping();
        scroll = 0;
        const { character, variant } = ENTRIES[index];
        const name = `${variant.name} ${character.name}`;
        subtitle.setColor(variant.color ?? COLORS.accent);
        const iconKey = getCharacterTexture(character.key, variant.name);
        icon.setVisible(scene.textures.exists(iconKey));
        if (icon.visible) icon.setTexture(iconKey).setDisplaySize(ICON_SIZE, ICON_SIZE);
        const abilities = cleanAbilities(variant.abilities) || 'Nothing extra to know about this fighter yet.';
        const targets = [
            { object: title, text: 'ADVANCED INFO' },
            { object: subtitle, text: name },
            { object: body, text: layoutBody(abilities) }
        ];
        if (!animate) {
            setTexts(targets);
            return;
        }
        const longest = Math.max(...targets.map(({ text }) => text.length));
        const duration = Math.min(TYPE_MAX_MS, longest * TYPE_MS_PER_CHAR);
        targets.forEach(({ object }) => object.setText(''));
        typing = { targets, duration, elapsed: 0 };
    };
    const onUpdate = (_time, delta) => {
        if (!typing) return;
        typing.elapsed += delta;
        const progress = Math.min(1, typing.elapsed / typing.duration);
        setTexts(typing.targets.map(({ object, text }) => ({ object, text: text.slice(0, Math.ceil(text.length * progress)) })));
        if (progress >= 1) stopTyping();
    };

    const step = direction => {
        index = (index + direction + ENTRIES.length) % ENTRIES.length;
        scene.sound.play('hover2');
        show(false);
    };
    makeArrow(PANEL.x - 150, '<', () => step(-1));
    makeArrow(PANEL.x + 150, '>', () => step(1));

    const keyboard = scene.input.keyboard;
    const keyHandlers = {
        'keydown-LEFT': () => step(-1),
        'keydown-A': () => step(-1),
        'keydown-RIGHT': () => step(1),
        'keydown-D': () => step(1),
        'keydown-UP': () => scrollBy(-KEY_STEP),
        'keydown-W': () => scrollBy(-KEY_STEP),
        'keydown-DOWN': () => scrollBy(KEY_STEP),
        'keydown-S': () => scrollBy(KEY_STEP),
        'keydown-ESC': () => close()
    };
    const pointerHandlers = { pointermove: onPointerMove, pointerup: onPointerUp, wheel: onWheel };

    const teardown = () => {
        if (scene.advancedInfo !== handle) return false;
        scene.advancedInfo = null;
        typing = null;
        scene.events.off('update', onUpdate);
        scene.events.off('postupdate', listenToKeys);
        Object.entries(keyHandlers).forEach(([event, handler]) => keyboard?.off(event, handler));
        Object.entries(pointerHandlers).forEach(([event, handler]) => scene.input.off(event, handler));
        scene.events.off('shutdown', teardown);
        parts.forEach(part => part.destroy());
        return true;
    };
    const close = () => {
        if (!teardown()) return;
        scene.sound.play('hover2');
        onClose?.();
    };
    closeBox.on('pointerdown', close);

    const handle = { close, step };
    scene.advancedInfo = handle;
    const listenToKeys = () => {
        if (scene.advancedInfo !== handle) return;
        Object.entries(keyHandlers).forEach(([event, handler]) => keyboard?.on(event, handler));
    };
    scene.events.once('postupdate', listenToKeys);
    scene.events.on('update', onUpdate);
    Object.entries(pointerHandlers).forEach(([event, handler]) => scene.input.on(event, handler));
    scene.events.once('shutdown', teardown);
    show(true);
    return handle;
}
