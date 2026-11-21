// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.
import Phaser from 'phaser';
import { HEX } from './theme.js';
import { PLAYER_COLORS } from '../matchModes.js';

const SCREEN = { width: 1000, height: 600 };
const CENTER = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
const EDGE_MARGIN = 30;
const POINTER = { size: 22, alpha: 0.9, depth: 900, stroke: 3 };
const DISTANCE_SCALE = { near: 1, far: 0.6, farPx: 1200 };

function pointerColor(player) {
    return player.isCpu ? HEX.cpu : PLAYER_COLORS[player.color]?.hex ?? HEX.border;
}

function createArrow(scene, player) {
    const s = POINTER.size;
    const arrow = scene.add.graphics();
    arrow.fillStyle(pointerColor(player), 1);
    arrow.fillTriangle(s * 0.6, 0, -s * 0.5, -s * 0.5, -s * 0.5, s * 0.5);
    arrow.lineStyle(POINTER.stroke, 0x000000, 1);
    arrow.strokeTriangle(s * 0.6, 0, -s * 0.5, -s * 0.5, -s * 0.5, s * 0.5);
    arrow.setAlpha(POINTER.alpha).setDepth(POINTER.depth).setVisible(false);
    scene.hud.add(arrow);
    return arrow;
}

export function createOffscreenPointers(scene, players) {
    return players.map(player => ({ player, arrow: createArrow(scene, player) }));
}

export function updateOffscreenPointers(scene, pointers) {
    const cam = scene.cameras.main;
    const view = cam.worldView;
    for (const { player, arrow } of pointers) {
        const tracked = player.active && !player.eliminated && player.visible;
        if (!tracked || Phaser.Geom.Rectangle.Contains(view, player.x, player.y)) {
            arrow.setVisible(false);
            continue;
        }

        const sx = (player.x - view.x) * cam.zoom;
        const sy = (player.y - view.y) * cam.zoom;
        const dx = sx - CENTER.x;
        const dy = sy - CENTER.y;
        const halfW = CENTER.x - EDGE_MARGIN;
        const halfH = CENTER.y - EDGE_MARGIN;
        const t = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));

        const offBy = Math.hypot(dx, dy) * (1 - t) / cam.zoom;
        const closeness = 1 - Math.min(offBy / DISTANCE_SCALE.farPx, 1);
        const scale = DISTANCE_SCALE.far + (DISTANCE_SCALE.near - DISTANCE_SCALE.far) * closeness;

        arrow.setPosition(CENTER.x + dx * t, CENTER.y + dy * t)
            .setRotation(Math.atan2(dy, dx))
            .setScale(scale)
            .setVisible(true);
    }
}
