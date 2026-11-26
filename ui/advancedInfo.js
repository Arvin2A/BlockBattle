// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { COLORS, FONTS, HEX, textStyle } from './theme.js';

const DEPTH = 3000;
const PANEL = { x: 500, y: 300, width: 560, height: 540 };
const TOP = PANEL.y - PANEL.height / 2;
const ICON_SIZE = 104;
const ICON_Y = TOP + 170;
const BODY = { y: TOP + 238, width: 470, height: 280, size: 17 };
const BODY_LEFT = PANEL.x - PANEL.width / 2 + 30;
const SCROLLBAR_X = PANEL.x + PANEL.width / 2 - 22;
const WHEEL_STEP = 0.5;
const KEY_STEP = 40;
const TYPE_MS_PER_CHAR = 6;
const TYPE_MAX_MS = 1200;

const ENTRIES = CHARACTER_ROSTER.flatMap((character, characterIndex) =>
    character.variants.map((variant, variantIndex) => ({ character, variant, characterIndex, variantIndex })));

const MARKUP_COLORS = { new: COLORS.new, changed: COLORS.changed };
const MARKUP_TAG = /\{(\/?)(new|changed)(?:@([\d-]+))?\}/g;
const HIGHLIGHT_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function highlightExpired(stamp) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp ?? '');
    if (!match) return false;
    const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    return Date.now() >= start + HIGHLIGHT_DAYS * DAY_MS;
}
const LEGEND = '{new}GREEN{/new} IS NEW, {changed}YELLOW{/changed} CHANGED THIS UPDATE.\n\n';

function parseMarkup(text) {
    let plain = '';
    const colors = [];
    const stack = [];
    let last = 0;
    const take = chunk => {
        plain += chunk;
        const color = stack[stack.length - 1] ?? null;
        for (let i = 0; i < chunk.length; i++) colors.push(color);
    };
    for (const match of text.matchAll(MARKUP_TAG)) {
        take(text.slice(last, match.index));
        if (match[1]) stack.pop();
        else stack.push(highlightExpired(match[3]) ? null : MARKUP_COLORS[match[2]]);
        last = match.index + match[0].length;
    }
    take(text.slice(last));
    return { plain, colors };
}

const cleanAbilities = abilities => String(abilities ?? '')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function isAdvancedInfoOpen(scene) {
    return Boolean(scene.advancedInfo);
}

let lastViewed = { characterIndex: 0, variantIndex: 0 };

export function openAdvancedInfo(scene, {
    characterIndex = lastViewed.characterIndex,
    variantIndex = lastViewed.variantIndex,
    onClose = null,
    container = null
} = {}) {
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
    const subtitle = add(scene.add.text(PANEL.x, TOP + 72, '', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        fill: COLORS.accent,
        stroke: COLORS.stroke,
        strokeThickness: 3
    }).setOrigin(0.5), 2);
    const tagline = add(scene.add.text(PANEL.x, TOP + 98, '', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        fill: COLORS.muted,
        align: 'center',
        wordWrap: { width: 420 }
    }).setOrigin(0.5, 0), 2);
    const icon = add(scene.add.image(PANEL.x, ICON_Y, ENTRIES[index].character.key), 2);
    const bodyStyle = textStyle('body', { fontSize: `${BODY.size}px`, lineSpacing: 5 });
    const measure = scene.make.text({ x: 0, y: 0, text: '', style: { ...bodyStyle, wordWrap: { width: BODY.width } } }, false);
    measure.setText('A');
    const singleLineHeight = measure.height;
    measure.setText('A\nA');
    const lineHeight = measure.height - singleLineHeight;
    const body = { runs: [], length: 0, height: 0 };
    add(scene.add.rectangle(PANEL.x, BODY.y - 8, PANEL.width - 40, 2, 0x444444), 2);
    const track = add(scene.add.rectangle(SCROLLBAR_X, BODY.y + BODY.height / 2, 6, BODY.height, 0x2a2a2a), 2);
    const thumb = add(scene.add.rectangle(SCROLLBAR_X, BODY.y, 6, 40, 0x888888).setOrigin(0.5, 0), 3);
    const viewport = add(scene.add.zone(BODY_LEFT + BODY.width / 2, BODY.y + BODY.height / 2, BODY.width + 30, BODY.height)
        .setInteractive(), 2);

    let scroll = 0;
    const maxScroll = () => Math.max(0, body.height - BODY.height);
    const placeRun = run => {
        const object = run.object;
        const screenY = BODY.y + run.y - scroll;
        const top = Math.max(0, BODY.y - screenY);
        const bottom = Math.min(object.height, BODY.y + BODY.height - screenY);
        object.setY(screenY);
        if (bottom <= top || !object.text) {
            object.setVisible(false);
            return;
        }
        object.setVisible(true).setCrop(0, top, object.width, bottom - top);
    };
    const applyScroll = () => {
        scroll = Math.max(0, Math.min(maxScroll(), scroll));
        body.runs.forEach(placeRun);
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
        const box = add(scene.add.rectangle(x, ICON_Y, 44, 44, 0x202020).setStrokeStyle(2, 0x444444)
            .setInteractive({ useHandCursor: true }), 2);
        const text = add(scene.add.text(x, ICON_Y, label, { fontFamily: FONTS.body, fontSize: '26px', fill: COLORS.text })
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
        if (typing) setTexts(typing.targets, body.length);
        typing = null;
    };

    const clearBody = () => {
        body.runs.forEach(run => run.object.destroy());
        body.runs = [];
    };
    const layoutBody = markup => {
        clearBody();
        const { plain, colors } = parseMarkup(markup);
        const lines = measure.getWrappedText(plain);
        const context = measure.context;
        let cursor = 0;
        let order = 0;
        lines.forEach((line, lineIndex) => {
            const found = plain.indexOf(line, cursor);
            const lineStart = found < 0 ? cursor : found;
            cursor = lineStart + line.length;
            let start = 0;
            while (start < line.length) {
                const color = colors[lineStart + start] ?? null;
                let end = start + 1;
                while (end < line.length && (colors[lineStart + end] ?? null) === color) end++;
                const text = line.slice(start, end);
                const object = scene.add.text(BODY_LEFT + context.measureText(line.slice(0, start)).width, BODY.y, '',
                    { ...bodyStyle, fill: color ?? bodyStyle.fill })
                    .setDepth(DEPTH + 2).setScrollFactor(0);
                container?.add(object);
                body.runs.push({ object, text, y: lineIndex * lineHeight, order });
                order += text.length;
                start = end;
            }
        });
        body.length = order;
        body.height = lines.length ? (lines.length - 1) * lineHeight + singleLineHeight : 0;
    };
    const showBody = count => {
        body.runs.forEach(run => {
            const visible = run.text.slice(0, Math.max(0, count - run.order));
            if (run.object.text !== visible) run.object.setText(visible);
        });
    };
    const setTexts = (targets, bodyCount) => {
        targets.forEach(({ object, text }) => object.setText(text));
        showBody(bodyCount);
        applyScroll();
    };

    const show = (animate = false) => {
        stopTyping();
        scroll = 0;
        const { character, variant, characterIndex: shownCharacter, variantIndex: shownVariant } = ENTRIES[index];
        lastViewed = { characterIndex: shownCharacter, variantIndex: shownVariant };
        const name = `${variant.name} ${character.name}`;
        subtitle.setColor(variant.color ?? COLORS.accent);
        const iconKey = getCharacterTexture(character.key, variant.name);
        tagline.setText(variant.desc ?? '');
        const iconTop = tagline.y + tagline.height + 6;
        const iconBottom = BODY.y - 14;
        const iconSize = Math.min(ICON_SIZE, iconBottom - iconTop);
        icon.setVisible(scene.textures.exists(iconKey)).setY((iconTop + iconBottom) / 2);
        if (icon.visible) icon.setTexture(iconKey).setDisplaySize(iconSize, iconSize);
        const abilities = cleanAbilities(variant.abilities) || 'Nothing extra to know about this fighter yet.';
        const highlighted = parseMarkup(abilities).colors.some(Boolean);
        layoutBody(highlighted ? LEGEND + abilities : abilities);
        const targets = [
            { object: title, text: 'ADVANCED INFO' },
            { object: subtitle, text: name },
            { object: tagline, text: variant.desc ?? '' }
        ];
        if (!animate) {
            setTexts(targets, body.length);
            return;
        }
        const longest = Math.max(body.length, ...targets.map(({ text }) => text.length));
        const duration = Math.min(TYPE_MAX_MS, longest * TYPE_MS_PER_CHAR);
        targets.forEach(({ object }) => object.setText(''));
        showBody(0);
        typing = { targets, duration, elapsed: 0 };
    };
    const onUpdate = (_time, delta) => {
        if (!typing) return;
        typing.elapsed += delta;
        const progress = Math.min(1, typing.elapsed / typing.duration);
        setTexts(typing.targets.map(({ object, text }) => ({ object, text: text.slice(0, Math.ceil(text.length * progress)) })),
            Math.ceil(body.length * progress));
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
        clearBody();
        measure.destroy();
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
