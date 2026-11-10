// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// What a player runs during an online match. Nothing here decides gameplay:
// OnlineGameScene draws what the server's GameScene looks like (via MirrorView)
// and sends this player's buttons to the server. OnlineOverlayScene sits on top
// with the parts only this player sees: ping, the "YOU" marker, touch buttons,
// and the end-of-match screen.

import Phaser from 'phaser';
import { preload } from './GameScene/preload.js';
import { MirrorView } from '../mp/mirror.js';
import { net } from '../mp/client.js';
import { getServerName } from '../mp/serverConfig.js';
import { END_REASONS } from '../mp/protocol.js';
import { encodeButtons, readControllerInput, INPUT_BUTTONS } from '../input.js';
import { QuickChat } from './OnlineQuickChat.js';
import { COLORS, FONTS, makeButton, makePanel } from '../ui/theme.js';
import { addTouchAssist, isPhoneScreen } from '../ui/touchAssist.js';
import { addThumbstick } from '../ui/touchJoystick.js';
import { hasMiscButton } from '../attacks.js';
import { PLAYER_COLORS, isTeamMode } from '../matchModes.js';

const KEY_BINDINGS = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyE: 'attack', ShiftLeft: 'attack', ShiftRight: 'attack',
    KeyQ: 'special', Slash: 'special',
    AltLeft: 'misc', AltRight: 'misc',
    KeyR: 'block', Period: 'block'
};
const CAPTURED_KEYS = 'W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SHIFT,ALT,Q,FORWARD_SLASH,R,PERIOD';


const FRAME_MS = 1000 / 60;
const MIN_BUFFER_MS = 33;
const MAX_BUFFER_MS = 100;
const BUFFER_PERCENTILE = 0.9;
const BUFFER_SHRINK_MS = 0.25;
const CLOCK_WINDOW_MS = 2000;
const RESYNC_MS = 250;
const CLOCK_CATCH_UP = 0.05;
const MAX_CLOCK_ADJUST = 0.1;
const MAX_STEP_MS = 100;
const SEEN_FRAME_MEMORY = 1200;
const LATE_BUCKETS_MS = [50, 100, 200, 500];

function emptyNetStats() {
    return {
        frames: 0,
        missedSlot: 0,
        maxLateMs: 0,
        lateOver: Object.fromEntries(LATE_BUCKETS_MS.map(ms => [ms, 0])),
        resyncs: 0,
        fastFirst: 0,
        fastReceived: 0,
        fastConnected: false,
        fastOpenMs: null,
        bufferMs: 0,
        maxBufferMs: 0
    };
}

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
        this.frameQueue = [];
        this.seenFrames = new Set();
        this.inputSeq = 0;
        this.clockSamples = [];
        this.clockOffset = null;
        this.bufferMs = MAX_BUFFER_MS;
        this.playTime = null;
        this.firstFrameAt = null;
        this.netStats = emptyNetStats();
        window.blockBattleNetStats = this.netStats;
        net.setFrameHandler((message, fast) => this.receiveFrame(message, fast));

        this.scene.launch('OnlineOverlayScene', { gameScene: this });
        this.events.once('shutdown', () => this.cleanup());

        net.send({ t: 'loaded' });
    }

    getOwnPlayerObject() {
        return this.getPlayerObject(this.match.slot);
    }

    getPlayerObject(slot) {
        const id = this.playerIds?.[slot];
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
        net.sendInput({ t: 'in', h: heldMask, p: pressedMask, q: this.inputSeq++ });
        this.lastSentHeld = heldMask;
        this.keyPresses = emptyButtons();
        this.padInput.pressed = emptyButtons();
        this.touchInput.pressed = emptyButtons();
    }

    update(_time, delta) {
        this.pollControllers();
        this.flushInput();
        this.playFrames(delta);
    }

    // ---- mirror frames ----

    receiveFrame(message, fast) {
        this.trackFastPath(fast);
        if (this.seenFrames.has(message.f)) return;
        this.seenFrames.add(message.f);
        if (this.seenFrames.size > SEEN_FRAME_MEMORY) {
            this.seenFrames.delete(this.seenFrames.values().next().value);
        }
        const now = performance.now();
        const sample = message.ts - now;
        const samples = this.clockSamples;
        samples.push({ time: now, sample });
        while (samples[0].time < now - CLOCK_WINDOW_MS) samples.shift();
        this.clockOffset = Math.max(...samples.map(entry => entry.sample));
        const lateness = samples.map(entry => this.clockOffset - entry.sample).sort((a, b) => a - b);
        const jitterMs = lateness[Math.floor((lateness.length - 1) * BUFFER_PERCENTILE)];
        const wantedMs = Phaser.Math.Clamp(jitterMs + FRAME_MS, MIN_BUFFER_MS, MAX_BUFFER_MS);
        this.bufferMs = Math.max(wantedMs, this.bufferMs - BUFFER_SHRINK_MS);

        const stats = this.netStats;
        const lateMs = this.clockOffset - sample;
        stats.bufferMs = Math.round(this.bufferMs);
        stats.maxBufferMs = Math.max(stats.maxBufferMs, stats.bufferMs);
        stats.frames++;
        stats.maxLateMs = Math.max(stats.maxLateMs, Math.round(lateMs));
        for (const ms of LATE_BUCKETS_MS) {
            if (lateMs > ms) stats.lateOver[ms]++;
        }
        if (this.playTime !== null && message.ts < this.playTime) stats.missedSlot++;
        if (fast) stats.fastFirst++;
        const queue = this.frameQueue;
        let index = queue.length;
        while (index > 0 && queue[index - 1].f > message.f) index--;
        queue.splice(index, 0, message);
    }

    trackFastPath(fast) {
        const stats = this.netStats;
        const now = performance.now();
        this.firstFrameAt ??= now;
        if (fast) stats.fastReceived++;
        stats.fastConnected = net.fastConnected;
        if (stats.fastConnected && stats.fastOpenMs === null) {
            stats.fastOpenMs = Math.round(now - this.firstFrameAt);
        }
    }

    applyFrame(message) {
        this.mirror.apply(message);
        if (message.meta) this.playerIds = message.meta.players;
    }

    playFrames(delta) {
        if (this.clockOffset === null) return;
        const target = performance.now() + this.clockOffset - this.bufferMs;
        if (this.playTime === null || Math.abs(target - this.playTime) > RESYNC_MS) {
            if (this.playTime !== null) this.netStats.resyncs++;
            this.playTime = target;
        } else {
            const step = Math.min(delta, MAX_STEP_MS);
            const limit = step * MAX_CLOCK_ADJUST;
            this.playTime += step + Phaser.Math.Clamp((target - this.playTime) * CLOCK_CATCH_UP, -limit, limit);
        }
        const queue = this.frameQueue;
        while (queue.length && queue[0].ts <= this.playTime) this.applyFrame(queue.shift());
    }

    logNetStats() {
        console.info('[BlockBattle] online match network stats', { ...this.netStats });
    }

    // ---- match flow ----

    endMatch(message) {
        if (this.matchOver) return;
        this.matchOver = true;
        this.matchRunning = false;
        this.endMessage = message;
        this.logNetStats();
        this.events.emit('online-end', message);
    }

    leaveTo(sceneKey, data) {
        if (!this.matchOver) net.send({ t: 'forfeit' });
        this.matchOver = true;
        this.scene.stop('OnlineOverlayScene');
        if (sceneKey === 'MenuScene') net.disconnect();
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
        const { slot, roster, mode } = this.match;
        this.slotColors = Object.fromEntries(roster.map(entry => [entry.slot, PLAYER_COLORS[entry.color].css]));
        const self = roster.find(entry => entry.slot === slot);
        const color = this.slotColors[slot];
        const others = roster.filter(entry => entry.slot !== slot);

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
        this.quickChat = new QuickChat(this, {
            slotColors: this.slotColors,
            getPlayerObject: slot => game.getPlayerObject(slot),
            worldToScreen: (x, y) => this.worldToScreen(x, y)
        });
        game.events.on('online-start', this.onStart, this);
        game.events.on('online-end', this.onEnd, this);
        game.events.on('online-escape', this.onEscape, this);
        this.events.once('shutdown', () => {
            game.events.off('online-start', this.onStart, this);
            game.events.off('online-end', this.onEnd, this);
            game.events.off('online-escape', this.onEscape, this);
            this.quickChat.destroy();
        });

        if (this.sys.game.device.input.touch) this.createTouchControls();
        else if (roster.length === 2) this.createKeyGuides(slot);

        const versus = others.length === 1
            ? `VS ${others[0].name}`
            : isTeamMode(mode) ? `TEAM ${PLAYER_COLORS[self.color].label}` : `${roster.length}-PLAYER FREE FOR ALL`;
        this.banner = this.add.text(500, 455, [
            `YOU ARE ${slot.toUpperCase()}`,
            versus
        ].join('\n'), {
            fontFamily: 'VCROSD',
            fontSize: '34px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);
        this.controlsHint = this.add.text(500, 525, 'EITHER KEY LAYOUT WORKS    LEAVE: ESC', {
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
        if (this.quickChat.isOpen) {
            this.quickChat.close();
            return;
        }
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

    onEnd({ winners, reason }) {
        const won = Boolean(winners?.includes(this.match.slot));
        const duel = this.match.roster.length === 2;
        const titles = {
            [END_REASONS.KO]: won ? 'VICTORY!' : 'DEFEAT',
            [END_REASONS.FORFEIT]: won ? (duel ? 'YOUR OPPONENT LEFT, YOU WIN' : 'EVERYONE ELSE LEFT, YOU WIN') : 'YOU LEFT THE MATCH',
            [END_REASONS.DISCONNECT]: duel ? 'YOUR OPPONENT DISCONNECTED, YOU WIN' : 'EVERYONE ELSE LEFT, YOU WIN',
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
        makePanel(this, 500, 300, 560, 250).setDepth(5000);
        this.add.text(500, 225, title, {
            fontFamily: FONTS.body,
            fontSize: title.length > 12 ? '26px' : '44px',
            fill: won ? COLORS.accent : COLORS.text,
            align: 'center',
            wordWrap: { width: 520 }
        }).setOrigin(0.5).setDepth(5003);

        const buttons = canRequeue && this.match.quick
            ? [
                { x: 380, label: 'PLAY AGAIN', action: () => this.gameScene.leaveTo('OnlineLobbyScene', { autoQueue: true }) },
                { x: 620, label: 'LOBBY', action: () => this.gameScene.leaveTo('OnlineLobbyScene') }
            ]
            : canRequeue
                ? [{ x: 500, label: 'LOBBY', action: () => this.gameScene.leaveTo('OnlineLobbyScene') }]
            : [{ x: 500, label: 'MAIN MENU', action: () => this.gameScene.leaveTo('MenuScene') }];

        for (const button of buttons) {
            const { box, text } = makeButton(this, button.x, 330, 200, 60, button.label, button.action, 26);
            box.setDepth(5001);
            text.setDepth(5002);
        }
        this.input.keyboard.once('keydown-ENTER', buttons[0].action);
        this.add.text(500, 395, `ENTER: ${buttons[0].label}`, {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#999999'
        }).setOrigin(0.5).setDepth(5004);
    }

    // Next to your own stat box, like the local game's guide, but showing both
    // layouts since either one controls your fighter online.
    createKeyGuides(slot) {
        const x = slot === 'p1' ? 400 : 800;
        const scale = 0.55;
        const left = this.add.image(x + 35, 65, 'p1guide').setScale(scale);
        const right = this.add.image(x + 128, 65, 'p2guide').setScale(scale);
        const or = this.add.text(x + 85, 65, 'OR', {
            fontFamily: 'GameFont',
            fontSize: '10px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        [left, right, or].forEach(object => object.setAlpha(0.65));
    }

    createTouchControls() {
        const touch = this.gameScene.touchInput;
        // Phaser only tracks one finger by default; allow multi-touch like the local game does.
        const extraPointers = 6 - this.input.manager.pointersTotal;
        if (extraPointers > 0) this.input.addPointer(extraPointers);
        const phone = isPhoneScreen();
        const layout = phone ? [
            [940, 420, 'A', 'attack'],
            [940, 330, 'S', 'special'],
            [850, 420, 'B', 'block']
        ] : [
            [60, 420, '←', 'left'],
            [240, 420, '→', 'right'],
            [150, 330, '↑', 'up'],
            [150, 420, '↓', 'down'],
            [850, 420, 'A', 'attack'],
            [940, 330, 'S', 'special'],
            [940, 240, 'B', 'block']
        ];
        const self = this.match.self;
        if (self && hasMiscButton(self.character, self.variant)) {
            layout.push([760, 420, 'ALT', 'misc']);
        }
        const touchButtons = [];
        addTouchAssist(this, touchButtons);
        if (phone) {
            touchButtons.push(addThumbstick(this, {
                x: 130,
                y: 400,
                onChange: (button, down) => {
                    touch.held[button] = down;
                    if (down) touch.pressed[button] = true;
                    this.gameScene.flushInput();
                }
            }));
        }
        for (const [x, y, label, button, radius = 45] of layout) {
            const circle = this.add.circle(x, y, radius, 0x000000, 0.45).setInteractive().setData('silentHover', true);
            this.add.text(x, y, label, {
                fontSize: label.length > 1 ? '26px' : '44px',
                color: '#ffffff',
                fontFamily: FONTS.body
            }).setOrigin(0.5).setAlpha(0.6);
            let pointerId = null;
            const release = pointer => {
                if (pointer.id !== pointerId) return;
                pointerId = null;
                touch.held[button] = false;
                circle.setFillStyle(0x000000, 0.45);
                this.gameScene.flushInput();
            };
            const press = pointer => {
                pointerId = pointer.id;
                touch.held[button] = true;
                touch.pressed[button] = true;
                circle.setFillStyle(0xffffff, 0.5);
                this.gameScene.flushInput();
            };
            circle.on('pointerdown', press);
            circle.on('pointerup', release);
            circle.on('pointerupoutside', release);
            touchButtons.push({ circle, press, release });
        }
    }

    update() {
        this.pingText.setText(net.ping === null ? getServerName() : `${getServerName()}  ${net.ping} ms`);
        this.quickChat.update();

        // Little arrow over your own fighter so you never lose track of yourself.
        const player = this.gameScene.getOwnPlayerObject();
        if (!player || this.gameScene.matchOver) {
            this.youMarker.setVisible(false);
            return;
        }
        const point = this.worldToScreen(player.x, player.y - 70);
        this.youMarker.setPosition(point.x, point.y).setVisible(player.visible);
    }

    worldToScreen(x, y) {
        const camera = this.gameScene.cameras.main;
        return {
            x: (x - camera.scrollX - camera.width * 0.5) * camera.zoom + camera.width * 0.5,
            y: (y - camera.scrollY - camera.height * 0.5) * camera.zoom + camera.height * 0.5
        };
    }
}
