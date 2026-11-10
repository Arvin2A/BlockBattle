// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { blocksHit } from './block.js';

const CONTACT_GRAVITY_SCALE = 0;
const CONTACT_MAX_FALL_SPEED = 0;
const CONTACT_HOLD_MS = 120;
const UPWARD_RANGE_SCALE = 0.5;

export const ALWAYS_ON_GRINDERS = true;

export function holdGrinderInPlace(scene, player, lastContactAt) {
    const grinding = lastContactAt > 0 && scene.time.now - lastContactAt < CONTACT_HOLD_MS &&
        !player.hitstun && !player.freeze;
    if (grinding) {
        player.grinderHeld = true;
        player.movementSpeed = 0;
        player.setVelocity(0, 0);
        setGrindFloat(scene, player, true);
    } else if (player.grinderHeld) {
        player.grinderHeld = false;
        setGrindFloat(scene, player, false);
    }
}
const GRINDER_RESUME_MS = 1000;

export function interruptGrinder(scene, player) {
    if (scene.time.now < (player.grinderResumeAt ?? 0)) return;
    player.grinderResumeAt = scene.time.now + GRINDER_RESUME_MS;
}

export function grinderCanResume(scene, player) {
    return ALWAYS_ON_GRINDERS && scene.time.now >= (player.grinderResumeAt ?? 0) &&
        player.active && !player.hitstun && !player.freeze &&
        !player.blocking && !player.ledge && !player.ledgeSlide && !player.smack && !player.smackedBy;
}

export function setGrindFloat(scene, attacker, floating, {
    gravityScale = CONTACT_GRAVITY_SCALE,
    maxFallSpeed = CONTACT_MAX_FALL_SPEED
} = {}) {
    if (!attacker.body) return;
    const worldGravity = scene.physics.world.gravity.y;
    attacker.body.gravity.y = floating ? -worldGravity * (1 - gravityScale) : 0;
    attacker.grindFloatAt = floating ? scene.time.now : 0;
    if (floating && attacker.body.velocity.y > maxFallSpeed) {
        attacker.setVelocityY(maxFallSpeed);
    }
}

function grindReach(attacker, victim, range) {
    const dx = victim.x - attacker.x;
    const dy = victim.y - attacker.y;
    const upward = attacker.lastDir.y < 0 || (dy < 0 && Math.abs(dy) > Math.abs(dx));
    return upward ? range * UPWARD_RANGE_SCALE : range;
}

export function grindTick(api, scene, attacker, victim, lastContactAt, {
    range = api.STANDARD_HITS.jab.range,
    chipDamage = 0.01,
    hitstun = 150,
    freeze = 60,
    blockCost = 0.02,
    blockedBuildsContact = true,
    float = {}
} = {}) {
    const inReach = victim.active && api.attackIsElligible(
        attacker, victim, grindReach(attacker, victim, range), { ignoreCanAttack: true, silent: true }
    );
    if (!inReach) {
        setGrindFloat(scene, attacker, false);
        return null;
    }
    setGrindFloat(scene, attacker, true, float);

    const now = scene.time.now;
    if (blocksHit(scene, victim, attacker, chipDamage, { minCost: blockCost })) {
        if (!blockedBuildsContact) return 0;
        return lastContactAt > 0 ? now - lastContactAt : 0;
    }
    victim.KBmultiplier += chipDamage * api.getAttackDamageScale(attacker);
    victim.hitstunUntil = now + hitstun;
    victim.freezeUntil = now + freeze;
    victim.willDecelerate = false;
    victim.flash();
    scene.sound.play('anyhit');
    scene.time.delayedCall(hitstun, () => {
        if (victim.active && scene.time.now >= victim.hitstunUntil) {
            victim.willDecelerate = true;
        }
    });
    return lastContactAt > 0 ? now - lastContactAt : 0;
}

export function grindExplosion(api, scene, attacker, victim, {
    damage = 0.25,
    force = 450,
    hitstun = 400,
    hitFreeze = 60,
    explosionScale = 0.7,
    noDeathRay = false,
    direction = null,
    ranged = false
} = {}) {
    api.landHit(scene, attacker, victim, {
        direction,
        ranged,
        damage,
        plankDamage: 0,
        hitstun,
        hitFreeze,
        sound: 'explosion',
        knockback: { x: force, y: force, lift: -0.25, spike: { x: force * 0.9, y: -force * 0.55 } },
        decelerateAfter: target => hitstun * target.KBmultiplier,
        resetCombo: false,
        noDeathRay
    });
    victim.flash();
    api.spawnExplosion(scene, victim, explosionScale * victim.KBmultiplier);
}
