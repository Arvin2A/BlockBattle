// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { attackIsElligible } from './eligibility.js';
import { applyKnockback, hitFreeze } from './knockback.js';
import { addSceneUpdateListener } from './effects.js';
import { damagePlanksInAttack } from './planks.js';
import { cutGrassInSwing } from './grass.js';
import { hideAttackSprite } from './attackSprite.js';
import { getAttackDamageScale, getHitSound } from './characterStats.js';

const PLUNGE_KNOCKBACK_BONUS = 1.0;

export function clearQueuedStunTimers(scene, attacker, target) {
    if (attacker.revokeAggressorStun) {
        scene.time.removeEvent(attacker.revokeAggressorStun);
        attacker.revokeAggressorStun = null;
    }
    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
        target.revokeVictimStun = null;
    }
}

export function queueStunRelease(scene, attacker, target, attackerDelay = 400, victimDelay = 650) {
    clearQueuedStunTimers(scene, attacker, target);
    const stunToken = (target.stunToken || 0) + 1;
    target.stunToken = stunToken;
    attacker.revokeAggressorStun = scene.time.delayedCall(attackerDelay, () => {
        attacker.canAttack = true;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.revokeAggressorStun = null;
    });
    target.revokeVictimStun = scene.time.delayedCall(victimDelay, () => {
        if (target.stunToken !== stunToken) return;
        target.freeze = false;
        target.willDecelerate = true;
        target.revokeVictimStun = null;
    });
}

export function scheduleDecelerate(scene, target, delay) {
    target.decelerateEvent?.remove(false);
    target.decelerateEvent = scene.time.delayedCall(delay, () => {
        target.decelerateEvent = null;
        if (target.active) target.willDecelerate = true;
    });
}

export function recoverAfterAttack(scene, attacker, { hideAfter = 250, recovery = 400 } = {}) {
    attacker.canAttack = false;
    if (hideAfter !== null) scene.time.delayedCall(hideAfter, () => hideAttackSprite(attacker));
    scene.time.delayedCall(recovery, () => {
        attacker.canAttack = true;
    });
}

export function afterWindup(scene, attacker, delay, onRelease, { interruptible = false, onInterrupt = null } = {}) {
    const windup = { interrupted: false };
    const removeCheck = interruptible
        ? addSceneUpdateListener(scene, () => {
            if (attacker.hitstun) windup.interrupted = true;
        })
        : () => { };
    scene.time.delayedCall(delay, () => {
        removeCheck();
        if (windup.interrupted) onInterrupt?.();
        else onRelease();
    });
    return windup;
}

export function playHitSound(scene, attacker, sound) {
    const key = sound === 'light' || sound === 'finisher'
        ? getHitSound(attacker, sound)
        : Array.isArray(sound) ? Phaser.Utils.Array.GetRandom(sound) : sound;
    if (key) scene.sound.play(key);
}

function resolveLaunch(attacker, target, knockback, direction, damageScale) {
    const kb = target.KBmultiplier;
    const grounded = target.body.touching.down;
    const side = Math.random() < 0.5 ? -1 : 1;
    if (typeof knockback === 'function') {
        return knockback({ attacker, target, direction, kb, damageScale, grounded, side });
    }

    const {
        x = 0,
        y = 0,
        growth = true,
        scaleWithDamage = true,
        maxDamageScale = Infinity,
        lift = -0.5,
        onDown = 'straight',
        spike = null
    } = knockback;
    const growthScale = growth ? kb : 1;
    const plungeBonus = target.plunged ? PLUNGE_KNOCKBACK_BONUS : 0;
    const xScale = scaleWithDamage ? Math.min(damageScale, maxDamageScale) + plungeBonus : 1;

    let dirX = direction.x;
    let dirY = direction.y;
    if (dirY === 0) {
        dirY = lift;
    } else if (dirY === 1 && onDown === 'popUp') {
        dirX = attacker.x <= target.x ? 0.75 : -0.75;
        dirY = -1;
    }

    if (spike && dirY > 0.7 && grounded) {
        return { x: spike.x * growthScale * xScale * side, y: spike.y * growthScale };
    }
    return { x: x * growthScale * xScale * dirX, y: y * growthScale * dirY };
}

export function landHit(scene, attacker, target, spec = {}) {
    const {
        damage = 0,
        plankDamage = damage,
        hitstun = 0,
        hitstunGrowth = true,
        stun = null,
        knockback = null,
        hitFreeze: hitFreezeMs = 0,
        sound = null,
        decelerateAfter = null,
        resetCombo = true,
        noDeathRay = false,
        onHit = null
    } = spec;
    const now = scene.time.now;
    const direction = spec.direction || attacker.lastDir;
    const damageScale = getAttackDamageScale(attacker);

    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
        target.revokeVictimStun = null;
    }
    target.lastHitAt = now;
    target.hitstunUntil = now + hitstun * (hitstunGrowth ? target.KBmultiplier : 1);
    if (stun) {
        target.freezeUntil = now + (stun.target ?? 0);
        attacker.freezeUntil = now + (stun.attacker ?? 0);
        attacker.willDecelerate = false;
        attacker.setVelocity(0, 0);
    } else {
        target.freezeUntil = now - 1;
        attacker.freezeUntil = now - 1;
        attacker.willDecelerate = true;
        target.willDecelerate = false;
    }
    attacker.comboTimer = 600;

    target.KBmultiplier += damage * damageScale;
    damagePlanksInAttack(attacker, plankDamage * damageScale);

    const launch = knockback && resolveLaunch(attacker, target, knockback, direction, damageScale);
    onHit?.(scene);
    if (hitFreezeMs > 0) hitFreeze(scene, hitFreezeMs);
    playHitSound(scene, attacker, sound);

    if (launch) {
        const launchDelay = typeof knockback === 'object' ? knockback.delay ?? 0 : 0;
        if (launchDelay > 0) {
            applyKnockback(scene, target, 0, 0, { noDeathRay });
            scene.time.delayedCall(launchDelay, () => {
                applyKnockback(scene, target, launch.x, launch.y, { noDeathRay });
            });
        } else {
            applyKnockback(scene, target, launch.x, launch.y, { noDeathRay });
        }
    }

    if (decelerateAfter !== null) {
        const delay = typeof decelerateAfter === 'function' ? decelerateAfter(target) : decelerateAfter;
        scheduleDecelerate(scene, target, delay);
    }
    if (resetCombo) {
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }
}

export function strike(scene, attacker, target, spec = {}) {
    const { range = 100, bypass = {}, direction = null, missSound = null } = spec;
    const plankDamage = spec.plankDamage ?? spec.damage ?? 0;
    damagePlanksInAttack(attacker, plankDamage * getAttackDamageScale(attacker));
    cutGrassInSwing(attacker, range);
    const eligible = attackIsElligible(attacker, target, range, {
        ...bypass,
        direction: direction ?? bypass.direction ?? null
    });
    if (!eligible) {
        if (missSound) scene.sound.play(missSound);
        return false;
    }
    landHit(scene, attacker, target, spec);
    return true;
}
