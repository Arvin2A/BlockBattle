// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { isVariantUnlocked } from '../achievements.js';
import { createFighterDemo } from './fighterDemo.js';
import { COLORS, FONTS, HEX, makeButton, makePanel, textStyle } from './theme.js';

const DEPTH = 2500;
const PANEL = { x: 500, y: 300, width: 700, height: 480 };
const TOP = PANEL.y - PANEL.height / 2;
const GRID = { columns: 8, tile: 70, gap: 8, top: TOP + 72 };
const PREVIEW = { x: 300, width: 250, height: 260 };
const COLUMN_X = 645;

export function openFighterPicker(scene, { getSelection, changeCharacter, changeVariant, openInfo, onClose = null }) {
    if (scene.fighterPicker) return scene.fighterPicker;
    const parts = [];
    const add = (object, depth = 0) => {
        object.setDepth(DEPTH + depth);
        object.setScrollFactor?.(0);
        parts.push(object);
        return object;
    };

    add(scene.add.rectangle(500, 300, 2000, 1200, 0x000000, 0.78).setInteractive());
    add(makePanel(scene, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 1), 1);
    add(scene.add.text(PANEL.x, TOP + 34, 'SELECT CHARACTER', textStyle('title', { fontSize: '28px' })).setOrigin(0.5), 2);

    const closeX = PANEL.x + PANEL.width / 2 - 34;
    const closeBox = add(scene.add.rectangle(closeX, TOP + 34, 48, 40, 0x771c1c).setStrokeStyle(2, HEX.border)
        .setInteractive({ useHandCursor: true }), 3);
    add(scene.add.text(closeX, TOP + 34, 'X', textStyle('body', { fontSize: '26px' })).setOrigin(0.5), 4);
    closeBox.on('pointerover', () => closeBox.setFillStyle(0xc0392b));
    closeBox.on('pointerout', () => closeBox.setFillStyle(0x771c1c));
    closeBox.on('pointerdown', () => close(true));

    const rows = Math.ceil(CHARACTER_ROSTER.length / GRID.columns);
    const tiles = CHARACTER_ROSTER.map((character, index) => {
        const row = Math.floor(index / GRID.columns);
        const rowStart = row * GRID.columns;
        const inRow = Math.min(GRID.columns, CHARACTER_ROSTER.length - rowStart);
        const rowWidth = inRow * GRID.tile + (inRow - 1) * GRID.gap;
        const x = PANEL.x - rowWidth / 2 + GRID.tile / 2 + (index - rowStart) * (GRID.tile + GRID.gap);
        const y = GRID.top + GRID.tile / 2 + row * (GRID.tile + GRID.gap);
        const box = add(scene.add.rectangle(x, y, GRID.tile, GRID.tile, HEX.panel).setStrokeStyle(2, 0x555555)
            .setInteractive({ useHandCursor: true }), 2);
        add(scene.add.image(x, y - 7, getCharacterTexture(character.key, character.variants[0].name)).setDisplaySize(48, 48), 3);
        add(scene.add.text(x, y + GRID.tile / 2 - 9, character.name, textStyle('body', { fontSize: '10px' })).setOrigin(0.5), 3);
        box.on('pointerover', () => box.setFillStyle(HEX.panelHover));
        box.on('pointerout', () => box.setFillStyle(HEX.panel));
        box.on('pointerdown', () => {
            const current = getSelection().characterIndex;
            if (index === current) return;
            changeCharacter(index - current);
        });
        return { box, x, y };
    });
    const cursor = add(scene.add.rectangle(tiles[0].x, tiles[0].y, GRID.tile + 6, GRID.tile + 6).setStrokeStyle(4, HEX.p1), 4);
    let cursorIndex = null;

    const lowerTop = GRID.top + rows * GRID.tile + (rows - 1) * GRID.gap + 16;
    const lowerBottom = TOP + PANEL.height - 30;
    const previewY = (lowerTop + lowerBottom) / 2;
    const previewHeight = Math.min(PREVIEW.height, lowerBottom - lowerTop);
    add(scene.add.rectangle(PREVIEW.x, previewY, PREVIEW.width, previewHeight, 0x0d0d0d, 0.9).setStrokeStyle(2, 0x333333), 2);
    const demo = createFighterDemo(scene, { x: PREVIEW.x, y: previewY, width: PREVIEW.width - 30, height: previewHeight - 30 });
    demo.container.setDepth(DEPTH + 3);

    const name = add(scene.add.text(COLUMN_X, lowerTop + 26, '', textStyle('title', { fontSize: '26px', strokeThickness: 4 })).setOrigin(0.5), 3);
    const variantText = add(scene.add.text(COLUMN_X, lowerTop + 62, '', textStyle('body', { fontSize: '20px' })).setOrigin(0.5), 3);
    const variantArrows = [-1, 1].map(direction => {
        const arrow = add(scene.add.text(COLUMN_X + direction * 110, lowerTop + 62, direction < 0 ? '<' : '>', textStyle('body', {
            fontSize: '28px', fill: COLORS.muted
        })).setOrigin(0.5).setInteractive({ useHandCursor: true }), 3);
        arrow.on('pointerover', () => arrow.setColor(COLORS.text));
        arrow.on('pointerout', () => arrow.setColor(COLORS.muted));
        arrow.on('pointerdown', () => {
            scene.sound.play('hover2');
            changeVariant(direction);
        });
        return arrow;
    });
    const variantNote = add(scene.add.text(COLUMN_X, lowerTop + 88, '', textStyle('body', {
        fontSize: '13px', fill: COLORS.muted
    })).setOrigin(0.5), 3);
    const desc = add(scene.add.text(COLUMN_X, lowerTop + 128, '', textStyle('body', {
        fontSize: '16px', fill: COLORS.muted, align: 'center', wordWrap: { width: 300 }
    })).setOrigin(0.5), 3);

    const info = makeButton(scene, COLUMN_X, lowerBottom - 70, 220, 36, 'ADVANCED INFO', () => openInfo(), 18);
    info.text.setColor(COLORS.accent);
    const done = makeButton(scene, COLUMN_X, lowerBottom - 22, 220, 40, 'DONE', () => close(false), 22);
    [info.box, info.text, done.box, done.text].forEach(part => add(part, 3));
    add(scene.add.text(PANEL.x, TOP + PANEL.height - 12, '< > FIGHTER   ^ v VARIANT   I INFO   ENTER DONE', {
        fontFamily: FONTS.body, fontSize: '12px', fill: '#999999'
    }).setOrigin(0.5), 3);

    const refresh = () => {
        const { characterIndex, variantIndex } = getSelection();
        const character = CHARACTER_ROSTER[characterIndex];
        const variant = character.variants[variantIndex] ?? character.variants[0];
        const tile = tiles[characterIndex];
        scene.tweens.killTweensOf(cursor);
        scene.tweens.add({ targets: cursor, x: tile.x, y: tile.y, duration: cursorIndex === null ? 0 : 90, ease: 'Quad.easeOut' });
        if (cursorIndex !== null && cursorIndex !== characterIndex) scene.sound.play('hover');
        cursorIndex = characterIndex;
        name.setText(character.name);
        variantText.setText(variant.name).setColor(variant.color ?? COLORS.text);
        const hasVariants = character.variants.length > 1;
        const canSwitch = character.variants.some((each, index) => index !== variantIndex && isVariantUnlocked(character.key, each.name));
        variantArrows.forEach(arrow => arrow.setVisible(hasVariants).setAlpha(canSwitch ? 1 : 0.35));
        variantNote.setText(hasVariants && !canSwitch ? 'OTHER VARIANT LOCKED - SEE ACHIEVEMENTS' : '');
        desc.setText(variant.desc ?? '');
        demo.show(characterIndex, variantIndex);
    };

    const keyboard = scene.input.keyboard;
    const whenActive = action => () => {
        if (!scene.advancedInfo) action();
    };
    const keyHandlers = {
        'keydown-LEFT': () => changeCharacter(-1),
        'keydown-A': () => changeCharacter(-1),
        'keydown-RIGHT': () => changeCharacter(1),
        'keydown-D': () => changeCharacter(1),
        'keydown-UP': () => changeVariant(-1),
        'keydown-W': () => changeVariant(-1),
        'keydown-DOWN': () => changeVariant(1),
        'keydown-S': () => changeVariant(1),
        'keydown-I': () => openInfo(),
        'keydown-ENTER': () => close(true),
        'keydown-SPACE': () => close(true),
        'keydown-ESC': () => close(true)
    };
    const bound = Object.fromEntries(Object.entries(keyHandlers).map(([event, action]) => [event, whenActive(action)]));
    Object.entries(bound).forEach(([event, handler]) => keyboard?.on(event, handler));

    let closed = false;
    const close = (withSound = false) => {
        if (closed) return;
        closed = true;
        Object.entries(bound).forEach(([event, handler]) => keyboard?.off(event, handler));
        demo.destroy();
        scene.tweens.killTweensOf(cursor);
        parts.forEach(part => part.destroy());
        if (scene.fighterPicker === handle) scene.fighterPicker = null;
        if (withSound) scene.sound.play('hover2');
        onClose?.();
    };

    const handlePad = pressed => {
        if (scene.advancedInfo) return;
        if (pressed('left')) changeCharacter(-1);
        if (pressed('right')) changeCharacter(1);
        if (pressed('up')) changeVariant(-1);
        if (pressed('down')) changeVariant(1);
        if (pressed('a') || pressed('b')) close(true);
    };

    const handle = { close, refresh, handlePad };
    scene.fighterPicker = handle;
    scene.events.once('shutdown', () => close(false));
    refresh();
    return handle;
}
