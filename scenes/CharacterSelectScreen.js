// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { addSettingsButton, setSettingsButtonTint } from '../ui/settings.js';
import {
    botMode,
    simulationMode,
    BOT_DIFFICULTIES,
    botDifficulty,
    setBotDifficulty
} from "../gameSettings.js";
import { COLORS, HEX, makeButton, textStyle } from "../ui/theme.js";
import { preloadCharacterSelection } from "./GameScene/preload.js";
import { getCharacterTexture } from "../characterTextures.js";
import { fadeOutTo } from "./transitions.js";
import { addMapBackdrop, getSelectedButtonTint, getSelectedMapPreview } from "./MapAndModifierSelect.js";
import { CHARACTER_ROSTER } from "../characterRoster.js";
import { createFighterDemo } from "../ui/fighterDemo.js";
import { chosenSkin, isGoldSkinEnabled, isGoldSkinUnlocked, setGoldSkinEnabled } from "../combat/skins.js";
import { openAdvancedInfo } from "../ui/advancedInfo.js";
import { withCharacterInfoWarning } from "../ui/characterInfoWarning.js";
import { botTargetKey, getBotMasterAchievement, getBotWins, getRequiredAchievement, isAchievementDone, isVariantUnlocked } from "../achievements.js";
import {
    getConnectedControllers,
    getMenuGamepadInput
} from "../navigation.js";

export var player1Character = '';
export var player2Character = '';
export var player1Variant = '';
export var player2Variant = '';

export function setSelectedCharacters(p1Character, p1Variant, p2Character, p2Variant) {
    player1Character = p1Character;
    player1Variant = p1Variant;
    player2Character = p2Character;
    player2Variant = p2Variant;
}

const TITLE_Y = 34;
const GRID = { columns: 8, top: 66, cell: 100, smallCell: 78, gap: 8 };
const CARD = { width: 470, xs: [255, 745], bottom: 588, gapAbove: 76 };
const BANNER_HEIGHT = 34;
const BANNER_COLORS = { normal: 0xb3261e, hover: 0x8f1e18, pressed: 0x5c1310 };
const TAB = { width: 84, height: 24 };
const GOLD_TOGGLE = { width: 150, height: 28 };
const PAD_BUTTON = 40;
const PAD_SPREAD = 44;
const LOCKED_PREVIEW_TEXTS = ['Nope.', 'Nuh uh.'];

const KEYBOARD = {
    1: { up: 'W', down: 'S', left: 'A', right: 'D', lock: 'E', variant: 'Q', unlock: 'R' },
    2: { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', lock: 'SHIFT', variant: 'FORWARD_SLASH', unlock: 'PERIOD' }
};
const INSTRUCTIONS = {
    1: 'WASD  MOVE\nE  LOCK IN\nQ  VARIANT\nR  UNLOCK\nI  FIGHTER INFO',
    2: 'ARROWS  MOVE\nSHIFT  LOCK IN\n/  VARIANT\n.  UNLOCK'
};

export class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectScene' });
    }

    preload() {
        preloadCharacterSelection.call(this);
    }

    create() {
        this.cameras.main.fadeIn(200, 0, 0, 0);
        this.cameras.main.setBackgroundColor('#1b1b1b');
        addMapBackdrop(this, getSelectedMapPreview());
        setSettingsButtonTint(this, addSettingsButton(this), getSelectedButtonTint());
        this.input.mouse?.disableContextMenu();

        this.isTouch = this.sys.game.device.input.touch;
        this.characters = CHARACTER_ROSTER;
        this.controllerPreviousInput = [{}, {}];
        this.lastMover = 2;
        this.starting = false;

        this.slots = {
            1: this.makeSlot(1, 1),
            2: this.makeSlot(2, botMode ? Phaser.Math.Between(0, this.characters.length - 1) : 0)
        };

        this.add.text(500, TITLE_Y, simulationMode
            ? 'SELECT BOTH CPUS'
            : botMode ? 'SELECT PLAYER AND CPU' : 'SELECT PLAYER 1 AND PLAYER 2',
        textStyle('body', { fontSize: '32px', stroke: COLORS.stroke, strokeThickness: 6 })).setOrigin(0.5);

        makeButton(this, 868, 32, 100, 34, 'BACK', () => this.goBack(), 18);

        this.buildGrid();
        this.buildBanner();
        [1, 2].forEach(player => this.buildCard(player));

        this.keys = Object.fromEntries([1, 2].map(player => [player,
            this.input.keyboard.addKeys(KEYBOARD[player], false)]));
        this.startKeys = this.input.keyboard.addKeys({ enter: 'ENTER' }, false);

        [1, 2].forEach(player => this.refreshSlot(player));
        this.refreshGrid();

        const onEscape = () => {
            if (this.settingsPanel || this.advancedInfo || this.starting || this.characterInfoWarning) return;
            this.goBack();
        };
        this.input.keyboard.on('keydown-ESC', onEscape);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown-ESC', onEscape);
        });
    }

    canOpenCharacterInfo() {
        return !this.settingsPanel && !this.starting && !this.characterInfoWarning;
    }

    openCharacterInfo(afterClose) {
        const slot = this.slots[1];
        this.sound.play('hover2');
        openAdvancedInfo(this, { characterIndex: slot.index, variantIndex: slot.variant, onClose: afterClose });
    }

    makeSlot(player, index) {
        const colors = player === 1
            ? simulationMode
                ? { fill: HEX.simCpu1, hover: 0x333333, text: COLORS.text, label: 'CPU 1' }
                : { fill: HEX.p1, hover: 0xff6666, text: COLORS.text, label: 'P1' }
            : simulationMode
                ? { fill: HEX.simCpu2, hover: 0xdddddd, text: COLORS.stroke, label: 'CPU 2' }
                : botMode
                    ? { fill: HEX.cpu, hover: 0x888888, text: COLORS.text, label: 'CPU' }
                    : { fill: HEX.p2, hover: 0x5aa0ff, text: COLORS.text, label: 'P2' };
        const isCpu = simulationMode || (botMode && player === 2);
        return { player, index, variant: 0, locked: false, colors, isCpu, card: null, cursor: null };
    }

    get gridCell() {
        return this.characters.length > GRID.columns ? GRID.smallCell : GRID.cell;
    }

    tilePosition(index) {
        const cell = this.gridCell;
        const columns = Math.min(GRID.columns, this.characters.length);
        const rowStart = Math.floor(index / columns) * columns;
        const inRow = Math.min(columns, this.characters.length - rowStart);
        const rowWidth = inRow * cell + (inRow - 1) * GRID.gap;
        const column = index - rowStart;
        return {
            x: 500 - rowWidth / 2 + cell / 2 + column * (cell + GRID.gap),
            y: GRID.top + cell / 2 + Math.floor(index / columns) * (cell + GRID.gap)
        };
    }

    get gridBottom() {
        const rows = Math.ceil(this.characters.length / GRID.columns);
        return GRID.top + rows * this.gridCell + (rows - 1) * GRID.gap;
    }

    buildGrid() {
        const cell = this.gridCell;
        this.tiles = this.characters.map((character, index) => {
            const { x, y } = this.tilePosition(index);
            const box = this.add.rectangle(x, y, cell, cell, 0x1e1e1e, 0.92)
                .setStrokeStyle(2, 0x555555)
                .setInteractive({ useHandCursor: true })
                .setData('silentHover', true);
            const icon = this.add.image(x, y - cell * 0.08, character.key).setDisplaySize(cell * 0.72, cell * 0.72);
            const name = this.add.text(x, y + cell / 2 - 11, character.name, textStyle('body', {
                fontSize: `${Math.round(cell * 0.13)}px`
            })).setOrigin(0.5);
            const check = this.drawCheck(x + cell / 2 - 16, y - cell / 2 + 18, 1);
            box.on('pointerdown', pointer => this.pickFromGrid(index, pointer.rightButtonDown()));
            box.on('pointerover', () => box.setStrokeStyle(2, 0x999999));
            box.on('pointerout', () => box.setStrokeStyle(2, 0x555555));
            return { box, icon, name, check, x, y };
        });

        [1, 2].forEach(player => {
            const slot = this.slots[player];
            const frame = this.add.rectangle(0, 0, cell + 6, cell + 6).setStrokeStyle(4, slot.colors.fill).setDepth(10);
            const tag = this.add.rectangle(0, 0, slot.colors.label.length * 9 + 12, 18, slot.colors.fill).setDepth(11)
                .setStrokeStyle(1, HEX.border);
            const tagText = this.add.text(0, 0, slot.colors.label, textStyle('body', {
                fontSize: '14px', fill: slot.colors.text
            })).setOrigin(0.5).setDepth(12);
            slot.cursor = { frame, tag, tagText };
        });
    }

    buildBanner() {
        const y = (this.gridBottom + this.cardTop - TAB.height / 2) / 2;
        const hint = this.isTouch ? 'TAP TO START' : 'PRESS E / SHIFT / ENTER OR CLICK';
        const box = this.add.rectangle(0, 0, 1000, BANNER_HEIGHT, BANNER_COLORS.normal, 0.95)
            .setInteractive({ useHandCursor: true });
        const title = this.add.text(-150, 0, 'READY TO FIGHT!', textStyle('title', {
            fontSize: '20px', strokeThickness: 4
        })).setOrigin(0.5);
        const sub = this.add.text(300, 0, hint, textStyle('body', { fontSize: '14px', fill: COLORS.accent })).setOrigin(0.5);
        let hovered = false;
        box.on('pointerover', () => {
            hovered = true;
            box.setFillStyle(BANNER_COLORS.hover, 0.95);
        });
        box.on('pointerout', () => {
            hovered = false;
            box.setFillStyle(BANNER_COLORS.normal, 0.95);
        });
        box.on('pointerdown', () => {
            box.setFillStyle(BANNER_COLORS.pressed, 0.95);
            this.time.delayedCall(120, () => {
                if (box.active) box.setFillStyle(hovered ? BANNER_COLORS.hover : BANNER_COLORS.normal, 0.95);
            });
            this.startMatch();
        });
        this.banner = this.add.container(-1000, y, [box, title, sub]).setDepth(40);
        this.bannerShown = false;
    }

    get cardTop() {
        return this.gridBottom + CARD.gapAbove;
    }

    buildCard(player) {
        const slot = this.slots[player];
        const top = this.cardTop;
        const height = CARD.bottom - top;
        const centerX = CARD.xs[player - 1];
        const left = centerX - CARD.width / 2;
        const columnX = left + 347;
        const previewX = left + 121;
        const previewY = top + (height + 12) / 2;
        const previewWidth = 210;
        const previewHeight = height - 42;

        this.add.rectangle(centerX, top + height / 2, CARD.width, height, HEX.panel, 0.95)
            .setStrokeStyle(4, slot.colors.fill === HEX.simCpu1 ? 0x444444 : slot.colors.fill);

        this.add.rectangle(previewX, previewY, previewWidth, previewHeight, 0x0d0d0d, 0.9).setStrokeStyle(2, 0x333333);
        const demo = createFighterDemo(this, { x: previewX, y: previewY, width: previewWidth - 16, height: previewHeight - 30 });

        if (this.isTouch) this.buildPad(player, columnX, top + 78);
        else {
            this.add.text(columnX, top + 78, INSTRUCTIONS[player], textStyle('body', {
                fontSize: '16px', fill: COLORS.muted, align: 'center', lineSpacing: 4
            })).setOrigin(0.5);
        }

        const name = this.add.text(columnX, top + 172, '', textStyle('title', { fontSize: '26px', strokeThickness: 4 })).setOrigin(0.5);
        const variantText = this.add.text(columnX, top + 204, '', textStyle('body', { fontSize: '18px' })).setOrigin(0.5);
        const variantArrows = [-1, 1].map(direction => {
            const arrow = this.add.text(columnX + direction * 92, top + 204, direction < 0 ? '<' : '>', textStyle('body', {
                fontSize: '28px', fill: COLORS.muted
            })).setOrigin(0.5).setInteractive({ useHandCursor: true });
            arrow.on('pointerover', () => arrow.setColor(COLORS.text));
            arrow.on('pointerout', () => arrow.setColor(COLORS.muted));
            arrow.on('pointerdown', () => this.cycleVariant(player, direction));
            return arrow;
        });

        if (slot.isCpu) this.buildDifficulty(player, columnX, top + 244, top + 148);
        const goldToggle = slot.isCpu ? null : makeButton(this, columnX, top + 254, GOLD_TOGGLE.width, GOLD_TOGGLE.height, '', () => this.toggleGold(player), 15);
        const lockNote = this.add.text(columnX, top + 228, 'LOCKED - SEE ACHIEVEMENTS', textStyle('body', {
            fontSize: '14px', fill: COLORS.error
        })).setOrigin(0.5).setVisible(false);
        const lockedPreview = this.add.container(previewX, previewY, [
            this.add.rectangle(0, 0, previewWidth, previewHeight, 0x000000, 0.6),
            this.add.text(0, 0, '', textStyle('title', { fontSize: '30px' })).setOrigin(0.5)
        ]).setDepth(5).setVisible(false);
        const previewCheck = this.add.text(previewX, previewY - previewHeight / 2 + 20, 'DEFEATED', textStyle('title', {
            fontSize: '22px', fill: COLORS.accent, strokeThickness: 4
        })).setOrigin(0.5).setDepth(6).setVisible(false);

        const readyY = top + height - 42;

        const lockShade = this.add.rectangle(centerX, top + height / 2, CARD.width, height, 0x000000, 0.45).setVisible(false);
        const readyImage = this.add.image(previewX, previewY, 'ready').setVisible(false);
        readyImage.setScale(Math.min(previewWidth / readyImage.width, previewHeight / readyImage.height));

        const readyBox = this.add.rectangle(columnX, readyY, 198, 40, slot.colors.fill)
            .setStrokeStyle(3, HEX.border)
            .setInteractive({ useHandCursor: true });
        const readyText = this.add.text(columnX, readyY, 'READY', textStyle('body', {
            fontSize: '22px', fill: slot.colors.text
        })).setOrigin(0.5);
        readyBox.on('pointerdown', () => this.toggleLock(player));
        const greyedOut = () => slot.locked || this.isVariantLocked(player);
        readyBox.on('pointerover', () => {
            if (!this.isVariantLocked(player)) readyBox.setFillStyle(slot.locked ? 0x888888 : slot.colors.hover);
        });
        readyBox.on('pointerout', () => readyBox.setFillStyle(greyedOut() ? HEX.cpu : slot.colors.fill));
        const refreshReady = () => {
            const variantLocked = this.isVariantLocked(player);
            readyBox.setFillStyle(greyedOut() ? HEX.cpu : slot.colors.fill);
            readyText.setText(slot.locked ? 'UNREADY' : variantLocked ? 'LOCKED' : 'READY')
                .setColor(greyedOut() ? COLORS.text : slot.colors.text);
        };

        const tabX = left + 22 + TAB.width / 2;
        this.add.rectangle(tabX, top, TAB.width, TAB.height, slot.colors.fill).setStrokeStyle(3, HEX.border);
        this.add.text(tabX, top, slot.colors.label, textStyle('title', {
            fontSize: '18px', fill: slot.colors.text, strokeThickness: 0
        })).setOrigin(0.5);

        slot.card = { demo, name, variantText, variantArrows, lockShade, readyImage, refreshReady, lockNote, lockedPreview, previewCheck, goldToggle };
    }

    buildPad(player, x, y) {
        const slot = this.slots[player];
        const button = (bx, by, label, onPress) => {
            const box = this.add.rectangle(bx, by, PAD_BUTTON, PAD_BUTTON, slot.colors.fill, 0.9)
                .setStrokeStyle(2, HEX.border)
                .setInteractive({ useHandCursor: true });
            this.add.text(bx, by, label, textStyle('body', { fontSize: label.length > 1 ? '16px' : '24px', fill: slot.colors.text }))
                .setOrigin(0.5);
            box.on('pointerdown', () => {
                box.setAlpha(0.6);
                onPress();
            });
            box.on('pointerup', () => box.setAlpha(1));
            box.on('pointerout', () => box.setAlpha(1));
        };
        button(x, y - PAD_SPREAD, '^', () => this.moveCursor(player, 0, -1));
        button(x, y + PAD_SPREAD, 'v', () => this.moveCursor(player, 0, 1));
        button(x - PAD_SPREAD, y, '<', () => this.moveCursor(player, -1, 0));
        button(x + PAD_SPREAD, y, '>', () => this.moveCursor(player, 1, 0));
        button(x, y, 'OK', () => this.toggleLock(player));
    }

    buildDifficulty(player, x, y, progressY) {
        const label = this.add.text(x, y, '', textStyle('body', { fontSize: '18px', fill: COLORS.accent })).setOrigin(0.5);
        const tracksBotMaster = botMode && !simulationMode;
        const progress = this.add.text(x, progressY, '', textStyle('body', { fontSize: '13px', fill: COLORS.muted })).setOrigin(0.5);
        const show = () => {
            label.setText(`CPU: ${botDifficulty[player]}`);
            if (!tracksBotMaster) return;
            const achievement = getBotMasterAchievement(botDifficulty[player]);
            const beaten = getBotWins(botDifficulty[player]).length;
            const required = achievement && getRequiredAchievement(achievement);
            if (required) {
                progress.setText(`${required.name} REQUIRED`).setColor(COLORS.cpu);
                this.refreshBotWins();
                return;
            }
            progress.setText(achievement && isAchievementDone(achievement)
                ? `${achievement.name} COMPLETE`
                : `${achievement?.name ?? 'BOT MASTER'}: ${beaten} / ${achievement?.goal ?? beaten} BEATEN`)
                .setColor(achievement && isAchievementDone(achievement) ? COLORS.accent : COLORS.muted);
            this.refreshBotWins();
        };
        [-1, 1].forEach(direction => {
            const arrow = this.add.text(x + direction * 92, y, direction < 0 ? '<' : '>', textStyle('body', {
                fontSize: '26px', fill: COLORS.cpu
            })).setOrigin(0.5).setInteractive({ useHandCursor: true });
            arrow.on('pointerover', () => arrow.setColor(COLORS.text));
            arrow.on('pointerout', () => arrow.setColor(COLORS.cpu));
            arrow.on('pointerdown', () => {
                if (this.slots[player].locked) return;
                const count = BOT_DIFFICULTIES.length;
                const index = BOT_DIFFICULTIES.indexOf(botDifficulty[player]);
                setBotDifficulty(player, BOT_DIFFICULTIES[(index + direction + count) % count]);
                this.sound.play('hover2');
                show();
            });
        });
        show();
    }

    drawCheck(cx, cy, size) {
        const check = this.add.graphics().setDepth(6).setVisible(false);
        const points = [[cx - 8 * size, cy], [cx - 2 * size, cy + 6 * size], [cx + 9 * size, cy - 7 * size]];
        [[7 * size, 0x000000], [4 * size, HEX.accent]].forEach(([width, color]) => {
            check.lineStyle(width, color, 1).beginPath().moveTo(...points[0]);
            check.lineTo(...points[1]).lineTo(...points[2]).strokePath();
        });
        return check;
    }

    beatenCharacters() {
        return new Set(botMode && !simulationMode ? getBotWins(botDifficulty[2]) : []);
    }

    refreshBotWins() {
        const beaten = this.beatenCharacters();
        this.tiles.forEach((tile, index) => {
            const character = this.characters[index];
            tile.check.setVisible(character.variants.every(variant => beaten.has(botTargetKey(character.key, variant.name))));
        });
        [1, 2].forEach(player => {
            const slot = this.slots[player];
            const character = this.characters[slot.index];
            const target = botTargetKey(character.key, character.variants[slot.variant].name);
            slot.card?.previewCheck.setVisible(slot.isCpu && beaten.has(target));
        });
    }

    pickFromGrid(index, wantsP2) {
        const player = wantsP2 || this.slots[1].locked ? 2 : 1;
        const slot = this.slots[player];
        if (slot.locked) return;
        this.sound.play('hover');
        this.setIndex(player, index);
    }

    moveCursor(player, dx, dy) {
        const slot = this.slots[player];
        if (slot.locked) return;
        const length = this.characters.length;
        const columns = Math.min(GRID.columns, length);
        let next = slot.index;
        if (dx) next = (slot.index + dx + length) % length;
        if (dy) {
            next = slot.index + dy * columns;
            if (next < 0 || next >= length) return;
        }
        if (next === slot.index) return;
        this.sound.play('hover');
        this.setIndex(player, next);
    }

    setIndex(player, index) {
        const slot = this.slots[player];
        if (slot.index !== index) slot.variant = 0;
        slot.index = index;
        this.lastMover = player;
        this.refreshSlot(player);
        this.refreshGrid();
    }

    cycleVariant(player, direction) {
        const slot = this.slots[player];
        if (slot.locked) return;
        const variants = this.characters[slot.index].variants;
        if (variants.length === 1) {
            this.sound.play('deny');
            return;
        }
        slot.variant = (slot.variant + direction + variants.length) % variants.length;
        this.lastMover = player;
        this.sound.play('hover2');
        this.refreshSlot(player);
        this.refreshGrid();
    }

    toggleLock(player) {
        const slot = this.slots[player];
        this.setLocked(player, !slot.locked);
    }

    isVariantLocked(player) {
        const slot = this.slots[player];
        const character = this.characters[slot.index];
        return !isVariantUnlocked(character.key, character.variants[slot.variant].name);
    }

    setLocked(player, locked) {
        const slot = this.slots[player];
        if (slot.locked === locked) return;
        if (locked && this.isVariantLocked(player)) {
            this.sound.play('deny');
            return;
        }
        slot.locked = locked;
        this.sound.play('hover2');
        slot.card.lockShade.setVisible(locked);
        slot.card.readyImage.setVisible(locked);
        slot.cursor.frame.setFillStyle(slot.colors.fill, locked ? 0.3 : 0);
        slot.card.refreshReady();
        this.refreshBanner();
    }

    refreshBanner() {
        const show = this.slots[1].locked && this.slots[2].locked;
        if (show === this.bannerShown) return;
        this.bannerShown = show;
        this.tweens.killTweensOf(this.banner);
        this.tweens.add({
            targets: this.banner,
            x: show ? 500 : -1000,
            duration: show ? 260 : 180,
            ease: show ? 'Back.easeOut' : 'Quad.easeIn'
        });
    }

    refreshSlot(player) {
        const slot = this.slots[player];
        const character = this.characters[slot.index];
        const variant = character.variants[slot.variant];
        const { name, variantText, variantArrows, demo, lockNote, lockedPreview, refreshReady } = slot.card;
        const variantLocked = this.isVariantLocked(player);
        if (variantLocked && !lockedPreview.visible) {
            lockedPreview.list[1].setText(Phaser.Utils.Array.GetRandom(LOCKED_PREVIEW_TEXTS));
        }
        lockedPreview.setVisible(variantLocked);
        refreshReady();
        if (this.tiles) this.refreshBotWins();
        name.setFontSize(26).setText(character.name).setColor(variant.color ?? COLORS.text);
        if (name.width > 180) name.setFontSize(Math.floor(26 * 180 / name.width));
        const multiple = character.variants.length > 1;
        variantText.setText(variant.name).setColor(multiple && !variantLocked ? variant.color ?? COLORS.text : COLORS.cpu);
        lockNote.setVisible(variantLocked);
        variantArrows.forEach(arrow => arrow.setVisible(multiple));
        demo.show(slot.index, slot.variant);
        this.refreshGold(player);

        const cell = this.gridCell;
        const other = this.slots[player === 1 ? 2 : 1];
        const shared = other.index === slot.index;
        [1, 2].forEach(each => {
            const eachSlot = this.slots[each];
            const eachTile = this.tiles[eachSlot.index];
            const inset = shared && each === 2;
            const size = inset ? cell - 8 : cell + 6;
            const { frame, tag, tagText } = eachSlot.cursor;
            frame.setSize(size, size);
            this.tweens.killTweensOf(frame);
            this.tweens.add({ targets: frame, x: eachTile.x, y: eachTile.y, duration: each === player ? 90 : 0, ease: 'Quad.easeOut' });
            const tagX = eachTile.x + (each === 1 ? -1 : 1) * (cell / 2 - tag.width / 2 - 2);
            const tagY = eachTile.y - cell / 2 - 2;
            tag.setPosition(tagX, tagY);
            tagText.setPosition(tagX, tagY);
        });
    }

    toggleGold(player) {
        const slot = this.slots[player];
        const character = this.characters[slot.index];
        if (slot.locked || slot.isCpu || !isGoldSkinUnlocked(character.key)) return;
        setGoldSkinEnabled(character.key, !isGoldSkinEnabled(character.key));
        this.sound.play('hover2');
        [1, 2].forEach(each => this.refreshGold(each));
    }

    refreshGold(player) {
        const slot = this.slots[player];
        const character = this.characters[slot.index];
        const { goldToggle, demo } = slot.card;
        demo.setSkin(slot.isCpu ? null : chosenSkin(character.key));
        if (!goldToggle) return;
        const unlocked = isGoldSkinUnlocked(character.key) && !this.isVariantLocked(player);
        const enabled = isGoldSkinEnabled(character.key);
        [goldToggle.box, goldToggle.text].forEach(part => part.setVisible(unlocked));
        goldToggle.text.setText(enabled ? 'GOLD: ON' : 'GOLD: OFF').setColor(enabled ? COLORS.accent : COLORS.muted);
        goldToggle.box.setStrokeStyle(3, enabled ? HEX.accent : HEX.border);
    }

    refreshGrid() {
        this.tiles.forEach((tile, index) => tile.icon.setTexture(this.characters[index].key));
        const order = this.lastMover === 1 ? [2, 1] : [1, 2];
        order.forEach(player => {
            const slot = this.slots[player];
            const character = this.characters[slot.index];
            this.tiles[slot.index].icon.setTexture(getCharacterTexture(character.key, character.variants[slot.variant].name));
        });
    }

    selection(player) {
        const slot = this.slots[player];
        const character = this.characters[slot.index];
        return { key: character.key, variant: character.variants[slot.variant].name };
    }

    startMatch() {
        if (!this.slots[1].locked || !this.slots[2].locked || this.starting || this.characterInfoWarning) return;
        withCharacterInfoWarning(this, () => this.beginMatch(), () => this.openCharacterInfo());
    }

    beginMatch() {
        if (this.starting) return;
        this.starting = true;
        this.sound.play('hover2');
        const p1 = this.selection(1);
        const p2 = this.selection(2);
        setSelectedCharacters(p1.key, p1.variant, p2.key, p2.variant);
        fadeOutTo(this, () => {
            this.scene.start('GameScene', {
                player1Character: p1.key,
                player2Character: p2.key,
                player1Variant: p1.variant,
                player2Variant: p2.variant
            });
        });
    }

    goBack() {
        if (this.starting) return;
        fadeOutTo(this, () => this.scene.start('MapAndModifierSelectScene', { page: 'modifiers' }));
    }

    handleCommand(player, command) {
        const slot = this.slots[player];
        if (command === 'unlock') return this.setLocked(player, false);
        if (command === 'lock') {
            if (slot.locked) return this.startMatch();
            return this.setLocked(player, true);
        }
        if (slot.locked) return;
        if (command === 'variant') return this.cycleVariant(player, 1);
        if (command === 'variantBack') return this.cycleVariant(player, -1);
        const moves = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
        if (moves[command]) this.moveCursor(player, ...moves[command]);
    }

    update() {
        const justDown = key => Phaser.Input.Keyboard.JustDown(key);
        const keyCommands = [1, 2].map(player => {
            const keys = this.keys[player];
            return Object.keys(KEYBOARD[player]).filter(command => justDown(keys[command]))
                .map(command => [player, command]);
        }).flat();
        const enter = justDown(this.startKeys.enter);

        const controllers = getConnectedControllers(this);
        const padCommands = [];
        for (let slot = 0; slot < 2; slot++) {
            const pad = controllers[slot];
            const previous = this.controllerPreviousInput[slot];
            if (!pad) {
                this.controllerPreviousInput[slot] = {};
                continue;
            }
            const input = getMenuGamepadInput(pad);
            this.controllerPreviousInput[slot] = { ...input };
            const pressed = key => input[key] && !previous[key];
            const map = { left: 'left', right: 'right', up: 'up', down: 'down', a: 'lock', b: 'unlock', rb: 'variant', lb: 'variantBack' };
            Object.entries(map).forEach(([button, command]) => {
                if (pressed(button)) padCommands.push([slot + 1, command]);
            });
        }

        if (this.settingsPanel || this.advancedInfo || this.starting || this.characterInfoWarning) return;
        if (enter) this.startMatch();
        [...keyCommands, ...padCommands].forEach(([player, command]) => this.handleCommand(player, command));
    }
}
