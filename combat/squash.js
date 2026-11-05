// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getFlatSquash, FLAT_SQUASH } from './universalMoves.js';

export const SQUASH = {
    jump: 0.22,
    downslam: 0.3,
    downslamHold: 0.22,
    downslamLand: -0.32,
    landMin: -0.06,
    landMax: -0.24,
    landSpeedForMax: 900,
    landSpeedMin: 150,
    widthPerStretch: 0.6,
    limit: 0.4,
    stiffness: 520,
    damping: 16
};

function getSquash(player) {
    if (!player.squash) player.squash = { value: 0, speed: 0, applied: null };
    return player.squash;
}

export function kickSquash(player, amount) {
    const squash = getSquash(player);
    squash.value = amount;
    squash.speed = 0;
}

export function cancelDownslamFx(player) {
    if (!player.downslamFx) return;
    player.downslamFx = false;
    kickSquash(player, 0);
    if (!player.heavyLaunch && !player.isUsingSideSpecial) player.afterimage = false;
}

export function squashOnLanding(player, fallSpeed) {
    if (player.downslamming && player.downslamFx) {
        kickSquash(player, SQUASH.downslamLand);
        return;
    }
    if (fallSpeed < SQUASH.landSpeedMin) return;
    const t = Math.min(1, (fallSpeed - SQUASH.landSpeedMin) / (SQUASH.landSpeedForMax - SQUASH.landSpeedMin));
    kickSquash(player, SQUASH.landMin + (SQUASH.landMax - SQUASH.landMin) * t);
}

function stretchObject(object, scaleX, scaleY, offsetY) {
    if (!object) return null;
    const applied = { object, scaleX: object.scaleX, scaleY: object.scaleY, offsetY };
    object.setScale(object.scaleX * scaleX, object.scaleY * scaleY);
    object.y += offsetY;
    return applied;
}

export function applySquash(scene, players) {
    const frozen = scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
    const dt = Math.min(scene.game.loop.delta, 50) / 1000;
    for (const player of players) {
        if (!player?.active) continue;
        const squash = getSquash(player);
        if (!frozen) {
            const target = player.downslamming && player.downslamFx ? SQUASH.downslamHold : 0;
            squash.speed += (-(squash.value - target) * SQUASH.stiffness - squash.speed * SQUASH.damping) * dt;
            squash.value = Phaser.Math.Clamp(squash.value + squash.speed * dt, -SQUASH.limit, SQUASH.limit);
        }
        const flat = getFlatSquash(player, scene.time.now);
        const lift = player.renderLiftY ?? 0;
        const squashed = Math.abs(squash.value) >= 0.002 || flat > 0;
        if (!squashed && !lift) continue;
        const scaleY = flat > 0 ? 1 - FLAT_SQUASH.height * flat : squashed ? 1 + squash.value : 1;
        const scaleX = flat > 0 ? 1 + FLAT_SQUASH.width * flat : squashed ? 1 - squash.value * SQUASH.widthPerStretch : 1;
        const offsetY = player.displayHeight * 0.5 * (1 - scaleY) - lift;
        squash.applied = [
            stretchObject(player, scaleX, scaleY, offsetY),
            stretchObject(player.flashObject, scaleX, scaleY, offsetY)
        ];
    }
}

export function restoreSquash(players) {
    for (const player of players) {
        const applied = player?.squash?.applied;
        if (!applied) continue;
        for (const entry of applied) {
            if (!entry) continue;
            entry.object.setScale(entry.scaleX, entry.scaleY);
            entry.object.y -= entry.offsetY;
        }
        player.squash.applied = null;
    }
}
