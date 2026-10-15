// What a player runs during an online match. Nothing here decides gameplay:
// OnlineGameScene draws what the server's GameScene looks like (via MirrorView)
// and sends this player's buttons to the server. OnlineOverlayScene sits on top
// with the parts only this player sees: ping, the "YOU" marker, touch buttons,
// and the end-of-match screen.

import Phaser from 'phaser';
import { preload } from './GameScene/preload.js';
import { MirrorView } from '../mp/mirror.js';
import { net } from '../mp/client.js';
import { END_REASONS } from '../mp/protocol.js';
import { encodeButtons, readControllerInput, INPUT_BUTTONS } from '../input.js';

// Online you control one fighter, so both keyboard layouts work.
const KEY_BINDINGS = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyE: 'attack', ShiftLeft: 'attack', ShiftRight: 'attack',
    KeyQ: 'special', Slash: 'special',
    AltLeft: 'misc', AltRight: 'misc'
};
const CAPTURED_KEYS = 'W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SHIFT,ALT,Q,FORWARD_SLASH';

const SLOT_COLORS = { p1: '#ff4343', p2: '#3d8bff' };

function emptyButtons() {
    return Object.fromEntries(INPUT_BUTTONS.map(button => [button, false]));
}

export class OnlineGameScene extends Phaser.Scene {
    constructor() {
        super('OnlineGameScene');
    }

    preload() {
        preload.call(this);
    }

    init(data) {
        this.match = data.match;
        this.playerIds = null;
        this.matchRunning = false;
        this.matchOver = false;
        this.endMessage = null;
    }

    create() {
        // Same two cameras, created in the same order, as GameScene so the
        // mirrored "which camera draws this" filters mean the same thing here.
        this.hudCam = this.cameras.add(0, 0, 1000, 600, false, 'hudCam');
        this.cameras.main.fadeIn(500, 0, 0, 0);

        this.mirror = new MirrorView(this);
        this.setupInput();

        this.cleanups = [
            net.on('matchStart', () => {
                this.matchRunning = true;
                this.events.emit('online-start');
            }),
            net.on('matchEnd', message => this.endMatch(message)),
            net.on('disconnected', () => this.endMatch({ reason: 'lost_connection', winner: null }))
        ];
        net.setFrameHandler(message => {
            this.mirror.apply(message);
            if (message.meta) this.playerIds = message.meta.players;
        });

        this.scene.launch('OnlineOverlayScene', { gameScene: this });
        this.events.once('shutdown', () => this.cleanup());

        net.send({ t: 'loaded' });
    }

    getOwnPlayerObject() {
        const id = this.playerIds?.[this.match.slot];
        return id ? this.mirror.get(id) : null;
    }

    // ---- input ----

    setupInput() {
        this.keysHeld = new Set();
        this.keyPresses = emptyButtons();
        this.padPrevious = {};
        this.padInput = { held: emptyButtons(), pressed: emptyButtons() };
        this.touchInput = { held: emptyButtons(), pressed: emptyButtons() };
        this.lastSentHeld = -1;

        const keyboard = this.input.keyboard;
        keyboard.addCapture(CAPTURED_KEYS);
        keyboard.on('keydown', event => {
            if (event.code === 'Escape') {
                this.events.emit('online-escape');
                return;
            }
            const button = KEY_BINDINGS[event.code];
            if (!button) return;
            if (!event.repeat && !this.keysHeld.has(event.code)) this.keyPresses[button] = true;
            this.keysHeld.add(event.code);
            // Send right away instead of waiting for the next frame: less input lag.
            this.flushInput();
        });
        keyboard.on('keyup', event => {
            if (!KEY_BINDINGS[event.code]) return;
            this.keysHeld.delete(event.code);
            this.flushInput();
        });

        // Don't leave a key "stuck" down if the window loses focus mid-press.
        this.releaseAllKeys = () => {
            this.keysHeld.clear();
            this.flushInput();
        };
        this.game.events.on('blur', this.releaseAllKeys);
        this.game.events.on('hidden', this.releaseAllKeys);
    }

    pollControllers() {
        const held = emptyButtons();
        const pressed = emptyButtons();
        const pads = navigator.getGamepads?.() ?? [];
        for (const pad of pads) {
            if (!pad?.connected) continue;
            const input = readControllerInput(pad, this.padPrevious[pad.index] ?? {});
            this.padPrevious[pad.index] = input;
            for (const button of INPUT_BUTTONS) {
                held[button] ||= input[button];
                pressed[button] ||= input[button + 'Pressed'];
            }
        }
        this.padInput = { held, pressed };
    }

    flushInput() {
        if (this.matchOver) return;
        const held = emptyButtons();
        for (const code of this.keysHeld) held[KEY_BINDINGS[code]] = true;
        for (const button of INPUT_BUTTONS) {
            held[button] ||= this.padInput.held[button] || this.touchInput.held[button];
        }
        const heldMask = encodeButtons(held);
        const pressedMask = encodeButtons(this.keyPresses) |
            encodeButtons(this.padInput.pressed) |
            encodeButtons(this.touchInput.pressed);

        if (heldMask === this.lastSentHeld && pressedMask === 0) return;
        net.send({ t: 'in', h: heldMask, p: pressedMask });
        this.lastSentHeld = heldMask;
        this.keyPresses = emptyButtons();
        this.padInput.pressed = emptyButtons();
        this.touchInput.pressed = emptyButtons();
    }

    update() {
        this.pollControllers();
        this.flushInput();
    }

    // ---- match flow ----

    endMatch(message) {
        if (this.matchOver) return;
        this.matchOver = true;
        this.matchRunning = false;
        this.endMessage = message;
        this.events.emit('online-end', message);
    }

    leaveTo(sceneKey, data) {
        if (!this.matchOver) net.send({ t: 'forfeit' });
        this.matchOver = true;
        this.scene.stop('OnlineOverlayScene');
        this.scene.start(sceneKey, data);
    }

    cleanup() {
        this.cleanups.forEach(cleanup => cleanup());
        this.cleanups = [];
        this.game.events.off('blur', this.releaseAllKeys);
        this.game.events.off('hidden', this.releaseAllKeys);
        net.clearFrames();
        this.sound.stopAll();
        this.mirror.shutdown();
    }
}

export class OnlineOverlayScene extends Phaser.Scene {
    constructor() {
        super('OnlineOverlayScene');
    }

    init(data) {
        this.gameScene = data.gameScene;
        this.match = this.gameScene.match;
        this.escapeArmedUntil = 0;
    }

    create() {
        const { slot, opponent } = this.match;
        const color = SLOT_COLORS[slot];

        this.pingText = this.add.text(990, 592, '', {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 1);

        this.waitingText = this.add.text(500, 300, 'LOADING MATCH...', {
            fontFamily: 'VCROSD',
            fontSize: '32px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.youMarker = this.add.triangle(0, 0, 0, 0, 16, 0, 8, 12, Phaser.Display.Color.HexStringToColor(color).color)
            .setStrokeStyle(2, 0x000000)
            .setVisible(false);

        this.noticeText = this.add.text(500, 560, '', {
            fontFamily: 'GameFont',
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        const game = this.gameScene;
        game.events.on('online-start', this.onStart, this);
        game.events.on('online-end', this.onEnd, this);
        game.events.on('online-escape', this.onEscape, this);
        this.events.once('shutdown', () => {
            game.events.off('online-start', this.onStart, this);
            game.events.off('online-end', this.onEnd, this);
            game.events.off('online-escape', this.onEscape, this);
        });

        if (this.sys.game.device.input.touch) this.createTouchControls();

        this.banner = this.add.text(500, 455, [
            `YOU ARE ${slot.toUpperCase()}`,
            `VS ${opponent.name}`
        ].join('\n'), {
            fontFamily: 'VCROSD',
            fontSize: '34px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);
        this.controlsHint = this.add.text(500, 525, 'MOVE: WASD / ARROWS    ATTACK: E / SHIFT    SPECIAL: Q / '/'    LEAVE: ESC', {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0);

        if (game.matchRunning) this.onStart();
        if (game.endMessage) this.onEnd(game.endMessage);
    }

    onStart() {
        this.waitingText.setVisible(false);
        this.banner.setAlpha(1);
        this.controlsHint.setAlpha(1);
        this.tweens.add({
            targets: [this.banner, this.controlsHint],
            alpha: 0,
            delay: 2500,
            duration: 600
        });
    }

    onEscape() {
        if (this.gameScene.matchOver) return;
        if (this.time.now < this.escapeArmedUntil) {
            this.gameScene.leaveTo('OnlineLobbyScene');
            return;
        }
        this.escapeArmedUntil = this.time.now + 2500;
        this.showNotice('PRESS ESC AGAIN TO LEAVE (COUNTS AS A LOSS)', 2500);
    }

    showNotice(text, duration) {
        this.noticeText.setText(text).setAlpha(1);
        this.tweens.killTweensOf(this.noticeText);
        this.tweens.add({ targets: this.noticeText, alpha: 0, delay: duration, duration: 300 });
    }

    onEnd({ winner, reason }) {
        const won = winner === this.match.slot;
        const titles = {
            [END_REASONS.KO]: won ? 'VICTORY!' : 'DEFEAT',
            [END_REASONS.FORFEIT]: won ? 'YOUR OPPONENT LEFT, YOU WIN' : 'YOU LEFT THE MATCH',
            [END_REASONS.DISCONNECT]: 'YOUR OPPONENT DISCONNECTED, YOU WIN',
            [END_REASONS.SERVER_ERROR]: 'THE MATCH CRASHED ON THE SERVER',
            lost_connection: 'LOST CONNECTION TO THE SERVER'
        };
        const title = titles[reason] ?? 'MATCH OVER';
        // Let people see the KO and "X WINS!" first.
        const delay = reason === END_REASONS.KO ? 1800 : 0;
        this.time.delayedCall(delay, () => this.showEndPanel(title, won, reason !== 'lost_connection'));
    }

    showEndPanel(title, won, canRequeue) {
        this.waitingText.setVisible(false);
        this.youMarker.setVisible(false);
        this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.55);
        this.add.rectangle(500, 300, 560, 250, 0x171717, 0.95).setStrokeStyle(3, 0xffffff);
        this.add.text(500, 225, title, {
            fontFamily: 'VCROSD',
            fontSize: title.length > 12 ? '26px' : '44px',
            fill: won ? '#ffd34d' : '#ffffff',
            align: 'center',
            wordWrap: { width: 520 }
        }).setOrigin(0.5);

        const buttons = canRequeue
            ? [
                { x: 380, label: 'PLAY AGAIN', action: () => this.gameScene.leaveTo('OnlineLobbyScene', { autoQueue: true }) },
                { x: 620, label: 'LOBBY', action: () => this.gameScene.leaveTo('OnlineLobbyScene') }
            ]
            : [{ x: 500, label: 'MAIN MENU', action: () => this.gameScene.leaveTo('MenuScene') }];

        for (const button of buttons) {
            const box = this.add.rectangle(button.x, 330, 200, 60, 0x333333)
                .setStrokeStyle(3, 0xffffff)
                .setInteractive({ useHandCursor: true });
            this.add.text(button.x, 330, button.label, {
                fontFamily: 'VCROSD',
                fontSize: '26px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            box.on('pointerover', () => box.setFillStyle(0x555555));
            box.on('pointerout', () => box.setFillStyle(0x333333));
            box.on('pointerdown', button.action);
        }
        this.input.keyboard.once('keydown-ENTER', buttons[0].action);
        this.add.text(500, 395, canRequeue ? 'ENTER: PLAY AGAIN' : 'ENTER: MAIN MENU', {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#999999'
        }).setOrigin(0.5);
    }

    createTouchControls() {
        const touch = this.gameScene.touchInput;
        // Phaser only tracks one finger by default; allow multi-touch like the local game does.
        const extraPointers = 6 - this.input.manager.pointersTotal;
        if (extraPointers > 0) this.input.addPointer(extraPointers);
        const layout = [
            [60, 420, '←', 'left'],
            [240, 420, '→', 'right'],
            [150, 330, '↑', 'up'],
            [150, 420, '↓', 'down'],
            [850, 420, 'A', 'attack'],
            [940, 330, 'S', 'special']
        ];
        const self = this.match.self;
        if (self?.character === 'axeman' && self.variant === 'CHAINSAW') {
            layout.push([760, 420, 'ALT', 'misc']);
        }
        for (const [x, y, label, button] of layout) {
            const circle = this.add.circle(x, y, 45, 0x000000, 0.45).setInteractive();
            this.add.text(x, y, label, {
                fontSize: label.length > 1 ? '26px' : '44px',
                color: '#ffffff',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setAlpha(0.6);
            let pointerId = null;
            const release = pointer => {
                if (pointer.id !== pointerId) return;
                pointerId = null;
                touch.held[button] = false;
                circle.setFillStyle(0x000000, 0.45);
                this.gameScene.flushInput();
            };
            circle.on('pointerdown', pointer => {
                pointerId = pointer.id;
                touch.held[button] = true;
                touch.pressed[button] = true;
                circle.setFillStyle(0xffffff, 0.5);
                this.gameScene.flushInput();
            });
            circle.on('pointerup', release);
            circle.on('pointerout', release);
            circle.on('pointerupoutside', release);
        }
    }

    update() {
        this.pingText.setText(net.ping === null ? 'LAN' : `LAN  ${net.ping} ms`);

        // Little arrow over your own fighter so you never lose track of yourself.
        const player = this.gameScene.getOwnPlayerObject();
        if (!player || this.gameScene.matchOver) {
            this.youMarker.setVisible(false);
            return;
        }
        const camera = this.gameScene.cameras.main;
        const screenX = (player.x - camera.scrollX - camera.width * 0.5) * camera.zoom + camera.width * 0.5;
        const screenY = (player.y - 70 - camera.scrollY - camera.height * 0.5) * camera.zoom + camera.height * 0.5;
        this.youMarker.setPosition(screenX, screenY).setVisible(player.visible);
    }
}
