// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { addSceneUpdateListener, spawnDirtBurst, triggerScreenShake } from './effects.js';

export function isGrounded(player) {
    return player.body.blocked.down || player.body.touching.down;
}

export function slamImpact(scene, target) {
    spawnDirtBurst(scene, target.x, target.body.bottom, 16, 6, 10, 1.5);
    triggerScreenShake(scene, 10, 250);
}

export function pinTarget(scene, player, target, {
    grounded,
    groundPinMs,
    airPinMs,
    crashSpeed,
    crashTimeoutMs,
    extendCooldown = true,
    flatten = false,
    onFrame = null,
    onEnd = null
}) {
    const hitAt = target.lastHitAt;
    const crashEndsAt = scene.time.now + crashTimeoutMs;
    const pinMs = grounded ? groundPinMs : airPinMs;
    let pinnedUntil = null;

    const startPin = () => {
        pinnedUntil = scene.time.now + pinMs;
        target.hitstunUntil = pinnedUntil;
        target.setVelocity(0, 0);
        if (flatten) target.flatSquash = { startedAt: scene.time.now, holdMs: pinMs };
        if (!extendCooldown) return;
        player.nextSideSpecialTime = Math.max(
            player.nextSideSpecialTime,
            pinnedUntil + player.dirSpecialCooldown
        );
        player.sideSpecialCooldownDuration = player.nextSideSpecialTime - scene.time.now;
    };
    if (grounded) startPin();

    const removePin = addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        const freed = !target.active || target.outOfBounds || target.lastHitAt !== hitAt;
        const over = pinnedUntil === null ? now >= crashEndsAt : now >= pinnedUntil;
        if (freed || over) {
            removePin();
            if (flatten && pinnedUntil !== null && target.flatSquash) {
                target.flatSquash = { startedAt: scene.time.now, holdMs: 0 };
            }
            onEnd?.();
            return;
        }
        if (pinnedUntil === null) {
            if (isGrounded(target)) {
                startPin();
                slamImpact(scene, target);
                scene.sound.play('slamimpact');
            } else {
                target.setVelocity(0, crashSpeed);
            }
        } else {
            target.hitstunUntil = Math.max(target.hitstunUntil, pinnedUntil);
            target.setVelocityX(0);
        }
        onFrame?.();
    });
}
