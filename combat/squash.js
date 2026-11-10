// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getFlatSquash, FLAT_SQUASH } from './universalMoves.js';

export const SQUASH = {
    jump: 0.33,
    landMin: -0.09,
    landMax: -0.36,
    landSpeedForMax: 900,
    landSpeedMin: 150,
    widthPerStretch: 0.6,
    limit: 0.6,
    stiffness: 520,
    damping: 16,
    chopMs: 70
};

export const SPEED_STRETCH = {
    speedMin: 320,
    speedMax: 1000,
    amount: 0.675,
    curve: 1.5,
    thinPerStretch: 0.6,
    response: 18
};

function getSquash(player) {
    if (!player.squash) {
        player.squash = { value: 0, speed: 0, applied: null, holdUntil: 0, motion: 0, motionHorizontal: 1 };
    }
    return player.squash;
}

export function kickSquash(player, amount, holdMs = 0) {
    const squash = getSquash(player);
    squash.value = amount;
    squash.speed = 0;
    squash.holdUntil = holdMs > 0 ? player.scene.time.now + holdMs : 0;
    squash.nextChopAt = 0;
}

function stepSpeedStretch(squash, player, dt) {
    const { x, y } = player.body?.velocity ?? { x: 0, y: 0 };
    const speed = Math.hypot(x, y);
    if (speed > 1) squash.motionHorizontal = (x * x) / (speed * speed);
    const t = Phaser.Math.Clamp((speed - SPEED_STRETCH.speedMin) / (SPEED_STRETCH.speedMax - SPEED_STRETCH.speedMin), 0, 1);
    const target = Math.pow(t, SPEED_STRETCH.curve) * SPEED_STRETCH.amount;
    squash.motion += (target - squash.motion) * (1 - Math.exp(-dt * SPEED_STRETCH.response));
}

export function cancelDownslamFx(player) {
    if (!player.downslamFx) return;
    player.downslamFx = false;
    if (!player.heavyLaunch && !player.isUsingSideSpecial) player.afterimage = false;
}

export function squashOnLanding(player, fallSpeed) {
    if (player.downslamming) return;
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
            if (scene.time.now >= squash.holdUntil) {
                squash.speed += (-squash.value * SQUASH.stiffness - squash.speed * SQUASH.damping) * dt;
                squash.value = Phaser.Math.Clamp(squash.value + squash.speed * dt, -SQUASH.limit, SQUASH.limit);
                stepSpeedStretch(squash, player, dt);
            } else {
                squash.motion = 0;
            }
        }
        const flat = getFlatSquash(player, scene.time.now);
        const lift = player.renderLiftY ?? 0;
        const squashed = Math.abs(squash.value) >= 0.002 || flat > 0;
        const stretching = squash.motion >= 0.002 && flat <= 0;
        if (!squashed && !stretching && !lift) {
            squash.visual = null;
            continue;
        }
        const horizontal = squash.motionHorizontal;
        const motionX = stretching ? 1 + squash.motion * (horizontal - (1 - horizontal) * SPEED_STRETCH.thinPerStretch) : 1;
        const motionY = stretching ? 1 + squash.motion * ((1 - horizontal) - horizontal * SPEED_STRETCH.thinPerStretch) : 1;
        if (scene.time.now >= (squash.nextChopAt ?? 0)) {
            squash.shownY = (flat > 0 ? 1 - FLAT_SQUASH.height * flat : squashed ? 1 + squash.value : 1) * motionY;
            squash.shownX = (flat > 0 ? 1 + FLAT_SQUASH.width * flat : squashed ? 1 - squash.value * SQUASH.widthPerStretch : 1) * motionX;
            squash.nextChopAt = scene.time.now + SQUASH.chopMs;
        }
        const scaleY = squash.shownY;
        const scaleX = squash.shownX;
        const offsetY = player.displayHeight * 0.5 * (1 - scaleY) - lift;
        squash.visual = { scaleX, scaleY, offsetY };
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
