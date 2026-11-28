// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import {
    ACHIEVEMENTS,
    countDoneAchievements,
    getAchievementProgress,
    getMasteryProgress,
    getSaveData,
    getRequiredAchievement,
    isAchievementDone,
    isAchievementLocked,
    mergeSaveData
} from '../achievements.js';
import { createTransferCode, redeemTransferCode } from '../mp/saveTransfer.js';
import { preloadAchievementIcons } from '../scenes/GameScene/preload.js';
import { clipScrollablePanel } from './clipScroll.js';
import { COLORS, FONTS, HEX, makeButton, makePanel, textStyle } from './theme.js';
import { getConnectedControllers, getMenuGamepadInput } from '../navigation.js';

const PANEL = { x: 500, y: 300, width: 780, height: 564 };
const TOP = PANEL.y - PANEL.height / 2;
const LIST = { x: 500, y: 311, width: 740, height: 394, cardWidth: 690, cardHeight: 96 };
const ICON_SIZE = 72;
const LOCKED_ALPHA = 0.25;
const DESCRIPTION_WIDTH = 360;
const REWARD_WIDTH = 170;
const SAVE_BUTTON = { y: TOP + PANEL.height - 34, width: 230, height: 38, offset: 230 };
const SCROLL_STEP = 0.12;
const CODE_ENTRY = { width: 420, height: 230, inputY: 288, inputWidth: 240, inputHeight: 52 };
const TRANSFER_ERRORS = {
    offline: 'CAN\'T REACH THE ONLINE SERVER',
    too_many: 'TOO MANY TRIES, WAIT A FEW MINUTES',
    not_found: 'THAT CODE IS WRONG, USED OR EXPIRED',
    bad_code: 'CODES LOOK LIKE K7F-2QX',
    bad_save: 'THAT SAVE COULDN\'T BE LOADED',
    full: 'THE SERVER IS BUSY, TRY AGAIN SOON',
    failed: 'SOMETHING WENT WRONG, TRY AGAIN'
};
const TOAST = {
    width: 310, height: 74, margin: 14, gap: 8, maxShown: 4, staggerMs: 250,
    slideMs: 320, holdMs: 3200, barWidth: 150, barHeight: 8, barMs: 700,
    flashMs: 650, flashScale: { x: 1.18, y: 1.6 }
};

function fitIcon(image, size) {
    return image.setScale(Math.min(size / image.width, size / image.height));
}

function progressLabel(achievement) {
    if (isAchievementDone(achievement)) return 'COMPLETE';
    const required = getRequiredAchievement(achievement);
    if (required) return `${required.name} REQUIRED`;
    if (achievement.masteryOf) return masteryLabel(achievement);
    if (achievement.goal <= 1) return 'NOT YET';
    return `${getAchievementProgress(achievement)} / ${achievement.goal}`;
}

function masteryToastLabel(achievement) {
    const { wins, targets } = getMasteryProgress(achievement);
    return `${wins}/${targets}`;
}

function masteryLabel(achievement) {
    const { wins, targets } = getMasteryProgress(achievement);
    return `${wins} / ${targets} WINS`;
}

export class AchievementsScene extends Phaser.Scene {
    constructor() {
        super('AchievementsScene');
    }

    init(data = {}) {
        this.onDone = data.onClose ?? null;
        this.finished = false;
        this.codeEntry = null;
        this.transferBusy = false;
        this.startStatus = data.status ?? '';
        this.previousPad = {};
    }

    preload() {
        preloadAchievementIcons.call(this);
    }

    create() {
        this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.72).setInteractive();
        makePanel(this, PANEL.x, PANEL.y, PANEL.width, PANEL.height);

        this.add.text(PANEL.x, TOP + 36, 'ACHIEVEMENTS', textStyle('title')).setOrigin(0.5);
        this.add.text(PANEL.x, TOP + 72, `${countDoneAchievements()} / ${ACHIEVEMENTS.length} COMPLETE`,
            textStyle('body', { fontSize: '18px', fill: COLORS.accent })).setOrigin(0.5);

        const closeX = PANEL.x + PANEL.width / 2 - 34;
        const closeBox = this.add.rectangle(closeX, TOP + 34, 48, 40, 0x771c1c).setStrokeStyle(2, HEX.border)
            .setInteractive({ useHandCursor: true });
        this.add.text(closeX, TOP + 34, 'X', textStyle('body', { fontSize: '26px' })).setOrigin(0.5);
        closeBox.on('pointerover', () => closeBox.setFillStyle(0xc0392b));
        closeBox.on('pointerout', () => closeBox.setFillStyle(0x771c1c));
        closeBox.on('pointerdown', () => this.finish());

        this.buildList();
        this.buildSaveButtons();

        const keyboard = this.input.keyboard;
        keyboard?.on('keydown-ESC', () => this.finish());
        ['UP', 'W'].forEach(key => keyboard?.on(`keydown-${key}`, () => this.scrollBy(-SCROLL_STEP)));
        ['DOWN', 'S'].forEach(key => keyboard?.on(`keydown-${key}`, () => this.scrollBy(SCROLL_STEP)));
    }

    buildList() {
        const content = this.rexUI.add.sizer({ orientation: 'y', width: LIST.cardWidth, space: { item: 10 } });
        this.panel = this.rexUI.add.scrollablePanel({
            x: LIST.x,
            y: LIST.y,
            width: LIST.width,
            height: LIST.height,
            scrollMode: 0,
            background: this.add.rectangle(0, 0, LIST.width, LIST.height, HEX.panel).setStrokeStyle(3, HEX.cpu),
            panel: { child: content, mask: false },
            sliderY: {
                track: this.add.rectangle(0, 0, 12, 0, 0x555555),
                thumb: this.add.rectangle(0, 0, 12, 50, 0xaaaaaa)
            },
            scroller: { rectBoundsInteractive: true, threshold: 5, slidingDeceleration: 5000, backDeceleration: 2000 },
            space: { left: 10, right: 10, top: 10, bottom: 10, panel: 10 },
            mouseWheelScroller: { focus: 2, speed: 0.1 }
        });
        ACHIEVEMENTS.forEach(achievement => content.add(this.buildCard(achievement), { expand: true }));
        this.panel.layout();
        clipScrollablePanel(this, this.panel, { inset: 6 });
    }

    buildCard(achievement) {
        const done = isAchievementDone(achievement);
        const locked = isAchievementLocked(achievement);
        const card = this.rexUI.add.sizer({
            orientation: 'x',
            width: LIST.cardWidth,
            height: LIST.cardHeight,
            space: { left: 12, right: 12, top: 10, bottom: 10, item: 14 }
        });
        card.addBackground(this.add.rectangle(0, 0, LIST.cardWidth, LIST.cardHeight, HEX.accent, done ? 0.12 : 0)
            .setStrokeStyle(done ? 3 : 2, done ? HEX.accent : HEX.cpu));

        const icon = fitIcon(this.add.image(0, 0, achievement.icon), ICON_SIZE).setAlpha(done ? 1 : locked ? LOCKED_ALPHA : 0.45);
        if (locked) icon.setTint(HEX.cpu);
        card.add(icon, { proportion: 0, align: 'center' });

        const details = this.rexUI.add.sizer({ orientation: 'y', space: { item: 4 } });
        details.add(this.add.text(0, 0, achievement.name, textStyle('body', {
            fontSize: '22px', fill: done ? COLORS.accent : locked ? COLORS.cpu : COLORS.text
        })), { align: 'left' });
        details.add(this.add.text(0, 0, achievement.description, textStyle('body', {
            fontSize: '14px', fill: locked ? COLORS.cpu : COLORS.muted, wordWrap: { width: DESCRIPTION_WIDTH }, lineSpacing: 2
        })), { align: 'left' });
        card.add(details, { proportion: 1, align: 'center' });

        const reward = this.rexUI.add.sizer({ orientation: 'y', width: REWARD_WIDTH, space: { item: 3 } });
        reward.add(this.add.text(0, 0, 'REWARD', textStyle('body', { fontSize: '12px', fill: COLORS.muted })), { align: 'center' });
        reward.add(this.add.text(0, 0, achievement.reward, textStyle('body', {
            fontSize: '15px', fill: locked ? COLORS.cpu : achievement.unlocks || achievement.goldReward ? COLORS.accent : COLORS.text,
            align: 'center', wordWrap: { width: REWARD_WIDTH }
        })), { align: 'center' });
        reward.add(this.add.text(0, 0, progressLabel(achievement), textStyle('body', {
            fontSize: '13px', fill: done ? COLORS.accent : locked ? COLORS.cpu : COLORS.muted, align: 'center'
        })), { align: 'center' });
        card.add(reward, { proportion: 0, align: 'center' });
        return card;
    }

    buildSaveButtons() {
        const codeText = this.add.text(PANEL.x, SAVE_BUTTON.y - 9, '', textStyle('title', {
            fontSize: '22px', fill: COLORS.accent, strokeThickness: 3
        })).setOrigin(0.5);
        const status = this.add.text(PANEL.x, SAVE_BUTTON.y, this.startStatus, textStyle('body', {
            fontSize: '12px', fill: COLORS.accent, align: 'center', wordWrap: { width: 200 }
        })).setOrigin(0.5);
        this.showStatus = (text, code = '') => {
            codeText.setText(code);
            status.setText(text).setY(code ? SAVE_BUTTON.y + 14 : SAVE_BUTTON.y).setColor(code ? COLORS.muted : COLORS.accent);
        };
        makeButton(this, PANEL.x - SAVE_BUTTON.offset, SAVE_BUTTON.y, SAVE_BUTTON.width, SAVE_BUTTON.height,
            'GET TRANSFER CODE', () => this.getTransferCode(), 16);
        makeButton(this, PANEL.x + SAVE_BUTTON.offset, SAVE_BUTTON.y, SAVE_BUTTON.width, SAVE_BUTTON.height,
            'ENTER TRANSFER CODE', () => this.openCodeEntry(), 16);
    }

    transferError(error) {
        return TRANSFER_ERRORS[error] ?? TRANSFER_ERRORS.failed;
    }

    getTransferCode() {
        if (this.transferBusy) return;
        this.transferBusy = true;
        this.showStatus('MAKING A CODE...');
        createTransferCode(getSaveData()).then(result => {
            this.transferBusy = false;
            if (!this.sys.isActive()) return;
            if (!result.code) return this.showStatus(this.transferError(result.error));
            navigator.clipboard?.writeText(result.code).catch(() => {});
            this.showStatus('ONE USE, 10 MINUTES', result.code);
        });
    }

    openCodeEntry() {
        if (this.codeEntry || this.transferBusy) return;
        const parts = [
            this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.6).setInteractive(),
            makePanel(this, 500, 300, CODE_ENTRY.width, CODE_ENTRY.height),
            this.add.text(500, 300 - CODE_ENTRY.height / 2 + 30, 'ENTER TRANSFER CODE', textStyle('title', { fontSize: '24px' })).setOrigin(0.5),
            this.add.rectangle(500, CODE_ENTRY.inputY, CODE_ENTRY.inputWidth, CODE_ENTRY.inputHeight, 0x0d0d0d).setStrokeStyle(2, HEX.border)
        ];
        const message = this.add.text(500, CODE_ENTRY.inputY + 38, '', textStyle('body', { fontSize: '13px', fill: COLORS.error })).setOrigin(0.5);
        const load = makeButton(this, 420, 300 + CODE_ENTRY.height / 2 - 34, 140, 40, 'LOAD', () => submit(), 18);
        const cancel = makeButton(this, 580, 300 + CODE_ENTRY.height / 2 - 34, 140, 40, 'CANCEL', () => close(), 18);
        parts.push(message, load.box, load.text, cancel.box, cancel.text);
        parts.forEach(part => part.setDepth(100));

        const rect = this.game.canvas.getBoundingClientRect();
        const scale = rect.width / 1000;
        const field = document.createElement('input');
        field.type = 'text';
        field.maxLength = 7;
        field.placeholder = 'K7F-2QX';
        field.autocomplete = 'off';
        field.spellcheck = false;
        Object.assign(field.style, {
            position: 'fixed',
            left: `${rect.left + (500 - CODE_ENTRY.inputWidth / 2 + 4) * scale}px`,
            top: `${rect.top + (CODE_ENTRY.inputY - CODE_ENTRY.inputHeight / 2 + 4) * scale}px`,
            width: `${(CODE_ENTRY.inputWidth - 8) * scale}px`,
            height: `${(CODE_ENTRY.inputHeight - 8) * scale}px`,
            fontSize: `${26 * scale}px`,
            fontFamily: FONTS.body,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: `${3 * scale}px`,
            color: COLORS.accent,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            zIndex: 1000
        });
        document.body.appendChild(field);
        const keyboard = this.input.keyboard;
        keyboard?.disableGlobalCapture();
        setTimeout(() => field.focus(), 0);

        let busy = false;
        const close = () => {
            if (!this.codeEntry) return;
            this.codeEntry = null;
            field.remove();
            keyboard?.enableGlobalCapture();
            parts.forEach(part => part.destroy());
        };
        const submit = () => {
            if (busy) return;
            busy = true;
            message.setColor(COLORS.muted).setText('LOADING...');
            redeemTransferCode(field.value).then(result => {
                busy = false;
                if (!this.codeEntry) return;
                if (!result.save || !mergeSaveData(result.save)) {
                    message.setColor(COLORS.error).setText(this.transferError(result.error ?? 'bad_save'));
                    field.focus();
                    return;
                }
                close();
                this.scene.restart({ onClose: this.onDone, status: 'SAVE LOADED!' });
            });
        };
        field.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') close();
        });
        this.codeEntry = { close };
        this.events.once('shutdown', close);
    }

    scrollBy(amount) {
        if (!this.panel) return;
        this.panel.t = Phaser.Math.Clamp(this.panel.t + amount, 0, 1);
    }

    finish() {
        if (this.codeEntry) {
            this.codeEntry.close();
            return;
        }
        if (this.finished) return;
        this.finished = true;
        this.sound.play('hover2');
        const onDone = this.onDone;
        this.scene.stop();
        onDone?.();
    }

    update() {
        const pad = getConnectedControllers(this)[0];
        if (!pad) return;
        const input = getMenuGamepadInput(pad);
        const pressed = key => input[key] && !this.previousPad[key];
        if (pressed('up')) this.scrollBy(-SCROLL_STEP);
        if (pressed('down')) this.scrollBy(SCROLL_STEP);
        if (pressed('b')) this.finish();
        this.previousPad = { ...input };
    }
}

export class AchievementToastScene extends Phaser.Scene {
    constructor() {
        super('AchievementToastScene');
    }

    init(data = {}) {
        this.queue = [...(data.updates ?? [])];
        this.startDelay = data.delay ?? 0;
        this.showing = 0;
    }

    preload() {
        preloadAchievementIcons.call(this);
        this.load.audio('achievementSlideIn', 'audio/achivementSlideIn.wav');
        this.load.audio('achievementComplete', 'audio/achivementComplete.wav');
    }

    create() {
        this.time.delayedCall(this.startDelay, () => this.showBatch());
    }

    enqueue(updates) {
        this.queue.push(...updates);
        if (!this.showing) this.showBatch();
    }

    showBatch() {
        const batch = this.queue.splice(0, TOAST.maxShown);
        if (!batch.length) {
            this.scene.stop();
            return;
        }
        this.showing = batch.length;
        batch.forEach((update, slot) => {
            this.time.delayedCall(slot * TOAST.staggerMs, () => this.showToast(update, slot));
        });
    }

    showToast({ achievement, before, after, completed }, slot) {
        const left = -TOAST.width / 2;
        const textX = left + 76;
        const restX = 1000 - TOAST.margin - TOAST.width / 2;
        const y = 600 - TOAST.margin - TOAST.height / 2 - slot * (TOAST.height + TOAST.gap);
        const flash = this.add.rectangle(0, 0, TOAST.width, TOAST.height, HEX.accent, 0.9).setVisible(false);
        const parts = [
            flash,
            makePanel(this, 0, 0, TOAST.width, TOAST.height).setStrokeStyle(3, completed ? HEX.accent : HEX.cpu),
            fitIcon(this.add.image(left + 40, 0, achievement.icon), 52),
            this.add.text(textX, -27, completed ? 'ACHIEVEMENT UNLOCKED!' : 'ACHIEVEMENT PROGRESS', textStyle('body', {
                fontSize: '12px', fill: completed ? COLORS.accent : COLORS.muted
            })),
            this.add.text(textX, -12, achievement.name, textStyle('body', { fontSize: '18px' }))
        ];
        let bar = null;
        if (completed) {
            parts.push(this.add.text(textX, 12, achievement.reward === 'NONE' ? 'COMPLETE' : achievement.reward, textStyle('body', {
                fontSize: '12px', fill: COLORS.muted, wordWrap: { width: TOAST.width - 90 }
            })));
        } else {
            const barX = textX;
            const barY = 20;
            const label = this.add.text(barX + TOAST.barWidth + 8, barY, achievement.masteryOf ? masteryToastLabel(achievement) : `${after} / ${achievement.goal}`, textStyle('body', {
                fontSize: '12px', fill: COLORS.text
            })).setOrigin(0, 0.5);
            const track = this.add.rectangle(barX, barY, TOAST.barWidth, TOAST.barHeight, 0x333333).setOrigin(0, 0.5);
            bar = this.add.rectangle(barX, barY, TOAST.barWidth, TOAST.barHeight, HEX.accent).setOrigin(0, 0.5)
                .setScale(before / achievement.goal, 1);
            parts.push(track, bar, label);
        }
        const toast = this.add.container(1000 + TOAST.width / 2 + 10, y, parts).setDepth(9000);
        this.sound.play('achievementSlideIn');
        this.tweens.add({
            targets: toast,
            x: restX,
            duration: TOAST.slideMs,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (bar) {
                    this.tweens.add({
                        targets: bar,
                        scaleX: Math.min(1, after / achievement.goal),
                        duration: TOAST.barMs,
                        ease: 'Cubic.easeOut'
                    });
                }
                if (completed) this.playFlash(flash);
            }
        });
        this.tweens.add({
            targets: toast,
            x: 1000 + TOAST.width / 2 + 10,
            delay: TOAST.slideMs + TOAST.holdMs,
            duration: TOAST.slideMs,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                toast.destroy();
                this.showing -= 1;
                if (!this.showing) this.showBatch();
            }
        });
    }

    playFlash(flash) {
        this.sound.play('achievementComplete');
        flash.setVisible(true).setAlpha(0.9).setScale(1);
        this.tweens.add({
            targets: flash,
            scaleX: TOAST.flashScale.x,
            scaleY: TOAST.flashScale.y,
            alpha: 0,
            duration: TOAST.flashMs,
            ease: 'Quad.easeOut'
        });
    }
}

export function showAchievementToasts(scene, updates, { delay = 0 } = {}) {
    if (!updates?.length) return;
    const scenes = scene.scene;
    if (scenes.isActive('AchievementToastScene')) {
        scenes.get('AchievementToastScene').enqueue(updates);
        return;
    }
    scenes.launch('AchievementToastScene', { updates, delay });
    scenes.bringToTop('AchievementToastScene');
}
