// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { HEX } from './theme.js';

const DIRECTIONS = ['left', 'right'];
const HORIZONTAL_DEADZONE = 0.35;

export function addThumbstick(scene, { x, y, radius = 80, onChange, container = null }) {
    const base = scene.add.circle(x, y, radius, HEX.panel, 0.4)
        .setStrokeStyle(3, HEX.border, 0.35)
        .setScrollFactor(0)
        .setDepth(999)
        .setInteractive()
        .setData('silentHover', true);
    const knob = scene.add.circle(x, y, radius * 0.45, HEX.border, 0.35)
        .setScrollFactor(0)
        .setDepth(1000);
    container?.add(base);
    container?.add(knob);

    const held = { left: false, right: false };
    let pointerId = null;

    const setHeld = next => {
        for (const direction of DIRECTIONS) {
            if (held[direction] === next[direction]) continue;
            held[direction] = next[direction];
            onChange(direction, next[direction]);
        }
    };

    const follow = pointer => {
        const nx = Phaser.Math.Clamp((pointer.x - x) / radius, -1, 1);
        knob.setPosition(x + nx * radius, y);
        setHeld({
            left: nx < -HORIZONTAL_DEADZONE,
            right: nx > HORIZONTAL_DEADZONE
        });
    };

    const press = pointer => {
        if (pointerId !== null && pointerId !== pointer.id) return;
        pointerId = pointer.id;
        knob.setFillStyle(HEX.border, 0.6);
        follow(pointer);
    };

    const release = pointer => {
        if (pointer.id !== pointerId) return;
        pointerId = null;
        knob.setPosition(x, y).setFillStyle(HEX.border, 0.35);
        setHeld({ left: false, right: false });
    };

    const move = pointer => {
        if (pointer.id === pointerId && pointer.isDown) follow(pointer);
    };

    base.on('pointerdown', press);
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
    scene.events.once('shutdown', () => {
        scene.input.off('pointermove', move);
        scene.input.off('pointerup', release);
        scene.input.off('pointerupoutside', release);
    });

    return { circle: base, knob, press, release, sticky: true };
}
