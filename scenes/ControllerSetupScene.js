// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { emptyControllerInput, readControllerInput } from '../input.js';

// Gamepad state shared with GameScene, which reads controllerInputs each frame.
const controllerAssignments = { p1: null, p2: null };
export const controllerInputs = {
    p1: {},
    p2: {}
};
const controllerPreviousInputs = {
    p1: {},
    p2: {}
};
const connectedControllers = new globalThis.Map();
const pendingControllers = [];
let firstControllerAssigned = false;

// Runs for the whole session underneath every other scene: polls gamepads,
// asks which player a newly connected one belongs to, and handles fullscreen.
export class ControllerSetupScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ControllerSetupScene' });
    }

    create() {
        this.setupKeys = this.input.keyboard.addKeys({
            assignP1: 'ONE',
            assignP2: 'TWO',
            fullscreen: 'F',
            escape: 'ESC'
        });
        this.pendingDevice = null;
        this.setupUi = [];
        this.pollTimer = 0;
        this.fullscreenButton = null;
        if (this.sys.game.device.input.touch) {
            const button = this.add.circle(38, 38, 26, 0x000000, 0.55)
                .setScrollFactor(0)
                .setDepth(9000)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(38, 38, 'F', {
                fontFamily: 'GameFont',
                fontSize: '22px',
                fill: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(9001);
            button.on('pointerdown', () => this.scale.toggleFullscreen());
            this.fullscreenButton = { button, label };
        }
        this.scene.launch('MenuScene');
    }

    update(_time, delta) {
        this.pollTimer += delta;
        if (this.pollTimer >= 1000 / 60) {
            this.pollTimer = 0;
            this.pollControllers();
        }
        this.updateControllerInputs();

        if (this.fullscreenButton || this.pendingDevice) {
            this.scene.bringToTop('ControllerSetupScene');
        }
        if (Phaser.Input.Keyboard.JustDown(this.setupKeys.fullscreen) &&
            this.scale.fullscreen.available && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }
        if (Phaser.Input.Keyboard.JustDown(this.setupKeys.escape)) {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else if (this.pendingDevice) {
                this.resolvePendingController('reject');
            }
        }

        if (!this.pendingDevice) return;
        if (Phaser.Input.Keyboard.JustDown(this.setupKeys.assignP1)) {
            this.resolvePendingController('p1');
        } else if (Phaser.Input.Keyboard.JustDown(this.setupKeys.assignP2)) {
            this.resolvePendingController('p2');
        }
    }

    pollControllers() {
        const pads = navigator.getGamepads?.() ?? [];
        const seen = new Set();

        for (const pad of pads) {
            if (!pad) continue;
            seen.add(pad.index);
            if (connectedControllers.has(pad.index)) continue;

            const device = { index: pad.index, id: pad.id };
            connectedControllers.set(pad.index, device);
            if (!firstControllerAssigned) {
                controllerAssignments.p1 = pad.index;
                firstControllerAssigned = true;
            } else {
                pendingControllers.push(device);
            }
        }

        for (const index of connectedControllers.keys()) {
            if (seen.has(index)) continue;
            connectedControllers.delete(index);
            const pendingIndex = pendingControllers.findIndex(pending => pending.index === index);
            if (pendingIndex !== -1) pendingControllers.splice(pendingIndex, 1);
            if (controllerAssignments.p1 === index) controllerAssignments.p1 = null;
            if (controllerAssignments.p2 === index) controllerAssignments.p2 = null;
            if (this.pendingDevice?.index === index) this.closeControllerPrompt();
        }

        if (!this.pendingDevice && pendingControllers.length) {
            this.showControllerPrompt(pendingControllers[0]);
        }
    }

    updateControllerInputs() {
        const pads = navigator.getGamepads?.() ?? [];
        for (const playerKey of ['p1', 'p2']) {
            const index = controllerAssignments[playerKey];
            const pad = index === null ? null : pads[index];
            const previous = controllerPreviousInputs[playerKey];
            const next = pad ? readControllerInput(pad, previous) : emptyControllerInput();
            controllerInputs[playerKey] = next;
            controllerPreviousInputs[playerKey] = next;
        }
    }

    showControllerPrompt(device) {
        this.pendingDevice = device;
        this.scene.bringToTop('ControllerSetupScene');

        const backdrop = this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.72)
            .setScrollFactor(0)
            .setDepth(10000)
            .setInteractive();
        const panel = this.add.rectangle(500, 300, 620, 260, 0x171717, 1)
            .setScrollFactor(0)
            .setDepth(10001)
            .setStrokeStyle(4, 0xffffff);
        const title = this.add.text(500, 218, 'CONTROLLER CONNECTED', {
            fontFamily: 'VCROSD',
            fontSize: '30px',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
        const deviceName = this.add.text(500, 263, device.id, {
            fontFamily: 'GameFont',
            fontSize: '16px',
            fill: '#cccccc',
            align: 'center',
            wordWrap: { width: 540 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
        const buttons = [
            { x: 300, label: 'USE AS P1', action: 'p1', shortcut: '1' },
            { x: 500, label: 'USE AS P2', action: 'p2', shortcut: '2' },
            { x: 700, label: 'REJECT', action: 'reject', shortcut: 'ESC' }
        ];

        for (const button of buttons) {
            const box = this.add.rectangle(button.x, 350, 170, 64, 0x333333, 1)
                .setScrollFactor(0)
                .setDepth(10002)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(button.x, 350, `${button.label}\n[${button.shortcut}]`, {
                fontFamily: 'GameFont',
                fontSize: '16px',
                fill: '#ffffff',
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10003);
            box.on('pointerover', () => box.setFillStyle(0x555555));
            box.on('pointerout', () => box.setFillStyle(0x333333));
            box.on('pointerdown', () => this.resolvePendingController(button.action));
            this.setupUi.push(box, label);
        }
        this.setupUi.push(backdrop, panel, title, deviceName);
    }

    resolvePendingController(action) {
        const device = this.pendingDevice;
        if (!device) return;
        const pendingIndex = pendingControllers.findIndex(item => item.index === device.index);
        if (pendingIndex !== -1) pendingControllers.splice(pendingIndex, 1);

        if (action === 'p1' || action === 'p2') {
            controllerAssignments[action] = device.index;
            controllerInputs[action] = emptyControllerInput();
            controllerPreviousInputs[action] = emptyControllerInput();
        }
        this.closeControllerPrompt();
        if (pendingControllers.length) this.showControllerPrompt(pendingControllers[0]);
    }

    closeControllerPrompt() {
        this.setupUi.forEach(object => object.destroy());
        this.setupUi = [];
        this.pendingDevice = null;
    }
}
