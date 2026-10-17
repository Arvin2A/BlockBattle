import { net } from '../mp/client.js';
import { QUICK_CHAT_CATEGORIES, QuickChatLimiter } from '../mp/quickChat.js';

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

const ROW_COLOR = 0x171717;
const ROW_HOVER_COLOR = 0x444444;
const ROW_ACTIVE_COLOR = 0x333333;

const TEXT_STYLE = {
    fontFamily: 'GameFont',
    fontSize: '13px',
    fill: '#ffffff'
};

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
        scene.input.keyboard.on('keydown-T', this.onToggleKey);
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
        }
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
        const { phrases } = QUICK_CHAT_CATEGORIES[index];
        const height = phrases.length * ROW_HEIGHT;
        const anchorY = this.categoryRows[index].box.y;
        const top = Math.max(MENU_TOP, Math.min(anchorY, MENU_BOTTOM - height));
        const x = MENU_LEFT + CATEGORY_WIDTH + 4;
        this.phraseRows = phrases.map((phrase, phraseIndex) =>
            this.createRow(x, top + phraseIndex * ROW_HEIGHT, PHRASE_WIDTH, phrase, () => this.send(phrase))
        );
    }

    send(phrase) {
        if (!this.limiter.tryUse(Date.now())) return;
        net.send({ t: 'chat', m: phrase });
        this.close();
    }

    showBubble(slot, phrase) {
        if (!this.slotColors[slot]) return;
        this.bubbles.get(slot)?.text.destroy();
        const text = this.scene.add.text(0, 0, phrase, {
            ...TEXT_STYLE,
            fontSize: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            fill: this.slotColors[slot],
            padding: { x: 8, y: 5 }
        }).setOrigin(0.5, 1).setDepth(BUBBLE_DEPTH).setVisible(false);
        this.bubbles.set(slot, { text, expiresAt: this.scene.time.now + BUBBLE_MS });
    }

    update() {
        const wait = this.limiter.waitFor(Date.now());
        this.toggleRow.label.setText(wait > 0 ? `open chat -  ${Math.ceil(wait / 1000)}s` : 'open chat - t');
        const alpha = wait > 0 ? 0.4 : 1;
        for (const row of this.phraseRows) row.label.setAlpha(alpha);

        const now = this.scene.time.now;
        for (const [slot, bubble] of this.bubbles) {
            const remaining = bubble.expiresAt - now;
            if (remaining <= 0) {
                bubble.text.destroy();
                this.bubbles.delete(slot);
                continue;
            }
            const player = this.getPlayerObject(slot);
            if (!player?.visible) {
                bubble.text.setVisible(false);
                continue;
            }
            const point = this.worldToScreen(player.x, player.y - BUBBLE_HEIGHT_ABOVE_PLAYER);
            bubble.text
                .setPosition(point.x, point.y)
                .setAlpha(Math.min(1, remaining / BUBBLE_FADE_MS))
                .setVisible(true);
        }
    }

    destroy() {
        this.scene.input.keyboard.off('keydown-T', this.onToggleKey);
        this.scene.input.off('pointerdown', this.onScenePointerDown);
        this.removeChatListener();
        for (const bubble of this.bubbles.values()) bubble.text.destroy();
        this.bubbles.clear();
    }
}
