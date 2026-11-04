// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { net } from '../mp/client.js';
import { QUICK_CHAT_CATEGORIES, QUICK_CHAT_PHRASES, QuickChatLimiter } from '../mp/quickChat.js';
import { COLORS } from '../ui/theme.js';

const KEYBINDS_STORAGE_KEY = 'blockBattleChatKeybinds';
const DIGIT_KEY = /^(?:Digit|Numpad)([0-9])$/;

const ROW_HEIGHT = 26;
const CATEGORY_WIDTH = 130;
const PHRASE_WIDTH = 150;
const MENU_LEFT = 12;
const MENU_BOTTOM = 588;
const MENU_TOP = 8;
const MENU_DEPTH = 1000;
const BUBBLE_DEPTH = 900;
const BUBBLE_MS = 3000;
const BUBBLE_FADE_MS = 400;
const BUBBLE_HEIGHT_ABOVE_PLAYER = 95;
const MAX_BUBBLES = 3;
const BUBBLE_GAP = 4;

const ROW_COLOR = 0x171717;
const ROW_HOVER_COLOR = 0x444444;
const ROW_ACTIVE_COLOR = 0x333333;

const TEXT_STYLE = {
    fontFamily: 'GameFont',
    fontSize: '13px',
    fill: '#ffffff'
};

function loadKeybinds() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEYBINDS_STORAGE_KEY));
        const keybinds = {};
        for (const [digit, phrase] of Object.entries(saved ?? {})) {
            if (/^[0-9]$/.test(digit) && QUICK_CHAT_PHRASES.has(phrase)) keybinds[digit] = phrase;
        }
        return keybinds;
    } catch {
        return {};
    }
}

function saveKeybinds(keybinds) {
    try {
        localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(keybinds));
    } catch {
        return;
    }
}

export class QuickChat {
    constructor(scene, { slotColors, getPlayerObject, worldToScreen }) {
        this.scene = scene;
        this.slotColors = slotColors;
        this.getPlayerObject = getPlayerObject;
        this.worldToScreen = worldToScreen;
        this.limiter = new QuickChatLimiter();
        this.isOpen = false;
        this.activeCategory = null;
        this.phraseRows = [];
        this.bubbles = new Map();
        this.keybinds = loadKeybinds();
        this.hoveredPhrase = null;

        this.toggleRow = this.createRow(MENU_LEFT, MENU_BOTTOM - ROW_HEIGHT, CATEGORY_WIDTH, 'chat  t', () => this.toggle());
        this.categoryRows = QUICK_CHAT_CATEGORIES.map((category, index) => {
            const y = MENU_BOTTOM - ROW_HEIGHT * (QUICK_CHAT_CATEGORIES.length - index + 1) - 4;
            const row = this.createRow(MENU_LEFT, y, CATEGORY_WIDTH, `${category.name}  >`, () => this.openCategory(index));
            row.box.on('pointerover', () => this.openCategory(index));
            return row;
        });
        this.setRowsVisible(this.categoryRows, false);

        this.onToggleKey = () => this.toggle();
        this.onScenePointerDown = (pointer, over) => {
            if (this.isOpen && !over.length) this.close();
        };
        this.onKeyDown = event => this.handleDigit(event);
        scene.input.keyboard.on('keydown-T', this.onToggleKey);
        scene.input.keyboard.on('keydown', this.onKeyDown);
        scene.input.on('pointerdown', this.onScenePointerDown);
        this.removeChatListener = net.on('chat', message => this.showBubble(message.s, message.m));
    }

    createRow(x, y, width, text, onSelect) {
        const box = this.scene.add.rectangle(x, y, width, ROW_HEIGHT - 2, ROW_COLOR, 0.9)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xffffff, 0.5)
            .setDepth(MENU_DEPTH)
            .setInteractive({ useHandCursor: true });
        const label = this.scene.add.text(x + 8, y + (ROW_HEIGHT - 2) / 2, text, TEXT_STYLE)
            .setOrigin(0, 0.5)
            .setDepth(MENU_DEPTH);
        const row = { box, label, active: false };
        box.on('pointerover', () => box.setFillStyle(ROW_HOVER_COLOR, 0.95));
        box.on('pointerout', () => box.setFillStyle(row.active ? ROW_ACTIVE_COLOR : ROW_COLOR, 0.9));
        box.on('pointerdown', onSelect);
        return row;
    }

    setRowsVisible(rows, visible) {
        for (const row of rows) {
            row.box.setVisible(visible);
            row.label.setVisible(visible);
            if (visible) row.box.setInteractive();
            else row.box.disableInteractive();
        }
    }

    destroyRows(rows) {
        for (const row of rows) {
            row.box.destroy();
            row.label.destroy();
            row.hint?.destroy();
        }
    }

    keyFor(phrase) {
        return Object.keys(this.keybinds).find(digit => this.keybinds[digit] === phrase) ?? null;
    }

    handleDigit(event) {
        const match = DIGIT_KEY.exec(event.code);
        if (!match || event.repeat) return;
        const digit = match[1];
        if (this.hoveredPhrase) {
            this.bindKey(digit, this.hoveredPhrase);
        } else if (this.keybinds[digit]) {
            this.send(this.keybinds[digit]);
        }
    }

    bindKey(digit, phrase) {
        const previous = this.keyFor(phrase);
        if (previous !== null) delete this.keybinds[previous];
        if (previous !== digit) this.keybinds[digit] = phrase;
        saveKeybinds(this.keybinds);
        this.refreshHints();
    }

    refreshHints() {
        for (const row of this.phraseRows) {
            const digit = this.keyFor(row.phrase);
            row.hint.setText(digit === null ? '' : `[${digit}]`);
        }
    }

    createPhraseRow(x, y, phrase) {
        const row = this.createRow(x, y, PHRASE_WIDTH, phrase, () => this.send(phrase));
        row.phrase = phrase;
        row.hint = this.scene.add.text(x + PHRASE_WIDTH - 8, row.label.y, '', { ...TEXT_STYLE, fill: COLORS.accent })
            .setOrigin(1, 0.5)
            .setDepth(MENU_DEPTH);
        row.box.on('pointerover', () => {
            this.hoveredPhrase = phrase;
        });
        row.box.on('pointerout', () => {
            if (this.hoveredPhrase === phrase) this.hoveredPhrase = null;
        });
        return row;
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        this.setRowsVisible(this.categoryRows, true);
    }

    close() {
        this.isOpen = false;
        this.activeCategory = null;
        this.setRowsVisible(this.categoryRows, false);
        this.destroyRows(this.phraseRows);
        this.phraseRows = [];
        this.hoveredPhrase = null;
        for (const row of this.categoryRows) {
            row.active = false;
            row.box.setFillStyle(ROW_COLOR, 0.9);
        }
    }

    openCategory(index) {
        if (!this.isOpen || this.activeCategory === index) return;
        this.activeCategory = index;
        this.categoryRows.forEach((row, rowIndex) => {
            row.active = rowIndex === index;
            if (row.active) row.box.setFillStyle(ROW_ACTIVE_COLOR, 0.9);
            else row.box.setFillStyle(ROW_COLOR, 0.9);
        });

        this.destroyRows(this.phraseRows);
        this.hoveredPhrase = null;
        const { phrases } = QUICK_CHAT_CATEGORIES[index];
        const height = phrases.length * ROW_HEIGHT;
        const anchorY = this.categoryRows[index].box.y;
        const top = Math.max(MENU_TOP, Math.min(anchorY, MENU_BOTTOM - height));
        const x = MENU_LEFT + CATEGORY_WIDTH + 4;
        this.phraseRows = phrases.map((phrase, phraseIndex) => this.createPhraseRow(x, top + phraseIndex * ROW_HEIGHT, phrase));
        this.refreshHints();
    }

    send(phrase) {
        if (!this.limiter.tryUse(Date.now())) return;
        net.send({ t: 'chat', m: phrase });
        if (this.isOpen) this.close();
    }

    showBubble(slot, phrase) {
        if (!this.slotColors[slot]) return;
        const stack = this.bubbles.get(slot) ?? [];
        while (stack.length >= MAX_BUBBLES) stack.shift().text.destroy();
        const text = this.scene.add.text(0, 0, phrase, {
            ...TEXT_STYLE,
            fontSize: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            fill: this.slotColors[slot],
            padding: { x: 8, y: 5 }
        }).setOrigin(0.5, 1).setDepth(BUBBLE_DEPTH).setVisible(false);
        stack.push({ text, expiresAt: this.scene.time.now + BUBBLE_MS });
        this.bubbles.set(slot, stack);
    }

    update() {
        const wait = this.limiter.waitFor(Date.now());
        this.toggleRow.label.setText(wait > 0 ? `open chat -  ${Math.ceil(wait / 1000)}s` : 'open chat - t');
        const alpha = wait > 0 ? 0.4 : 1;
        for (const row of this.phraseRows) {
            row.label.setAlpha(alpha);
            row.hint.setAlpha(alpha);
        }

        const now = this.scene.time.now;
        for (const [slot, stack] of this.bubbles) {
            while (stack.length && stack[0].expiresAt <= now) stack.shift().text.destroy();
            if (!stack.length) {
                this.bubbles.delete(slot);
                continue;
            }
            const player = this.getPlayerObject(slot);
            if (!player?.visible) {
                for (const bubble of stack) bubble.text.setVisible(false);
                continue;
            }
            const point = this.worldToScreen(player.x, player.y - BUBBLE_HEIGHT_ABOVE_PLAYER);
            let bottom = point.y;
            for (let index = stack.length - 1; index >= 0; index--) {
                const bubble = stack[index];
                bubble.text
                    .setPosition(point.x, bottom)
                    .setAlpha(Math.min(1, (bubble.expiresAt - now) / BUBBLE_FADE_MS))
                    .setVisible(true);
                bottom -= bubble.text.height + BUBBLE_GAP;
            }
        }
    }

    destroy() {
        this.scene.input.keyboard.off('keydown-T', this.onToggleKey);
        this.scene.input.keyboard.off('keydown', this.onKeyDown);
        this.scene.input.off('pointerdown', this.onScenePointerDown);
        this.removeChatListener();
        for (const stack of this.bubbles.values()) {
            for (const bubble of stack) bubble.text.destroy();
        }
        this.bubbles.clear();
    }
}
