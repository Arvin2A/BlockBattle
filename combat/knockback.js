// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import {
    addSceneUpdateListener,
    spawnHitParticles,
    DEATH_RAY_COLOR
} from './effects.js';
import { getKnockbackResistance } from './characterStats.js';
import { getFighters as getAllFighters } from './targets.js';

export const STRONG_KB_PERCENT = 60;
export const HEAVY_KB_PERCENT = 100;
export const VIOLENT_KB_PERCENT = 150;
export const ULTRA_KB_PERCENT = 200;
const ULTRA_FREEZE_BONUS = 300;
const VIOLENT_FREEZE_BONUS = 150;
const HEAVY_FREEZE_BONUS = 80;
const STRONG_FREEZE_SCALE = 1.25;
const HEAVY_FREEZE_SCALE = 1.5;
// Attacks stay locked through the death ray freeze and this long after it.
const DEATH_RAY_ATTACK_LOCK_MS = 150;
const DEATH_RAY_MIN_VX = 1000;
const DEATH_RAY_FREE_LIFT = 0.35;
const DEATH_RAY_LIFT_PENALTY = 1.5;
const LAUNCH_FREEZE_MIN_SPEED = 400;
const LAUNCH_ARC_HEIGHT = 0.08;
const VICTIM_SHAKE = { heavyMin: 3, heavyMax: 6, heavyRamp: 16, violent: 8, ultra: 12 };

export function shakeVictim(target, intensity) {
    target.victimShake = Math.max(target.victimShake ?? 0, intensity);
}

export function jitterVictim(target, intensity, ms) {
    const until = target.scene.time.now + ms;
    target.jitterStrength = intensity;
    target.jitterUntil = Math.max(target.jitterUntil ?? 0, until);
}

export function applyVictimShakes(scene, fighters) {
    const frozen = scene.hitFreezeUntil > scene.time.now;
    for (const fighter of fighters) {
        if (!fighter) continue;
        const jitter = scene.time.now < (fighter.jitterUntil ?? 0) ? fighter.jitterStrength ?? 0 : 0;
        if (!fighter.victimShake && !jitter) continue;
        if (!frozen) fighter.victimShake = 0;
        const strength = Math.max(fighter.victimShake ?? 0, jitter);
        if (!strength) continue;
        const offset = {
            x: Phaser.Math.FloatBetween(-strength, strength),
            y: Phaser.Math.FloatBetween(-strength, strength)
        };
        fighter.victimShakeOffset = offset;
        fighter.x += offset.x;
        fighter.y += offset.y;
    }
}

export function restoreVictimShakes(fighters) {
    for (const fighter of fighters) {
        const offset = fighter?.victimShakeOffset;
        if (!offset) continue;
        fighter.x -= offset.x;
        fighter.y -= offset.y;
        fighter.victimShakeOffset = null;
    }
}

export function isInvincible(player) {
    return player.scene.time.now < (player.invincibleUntil ?? 0);
}

function isFighter(scene, target) {
    return getAllFighters(scene).includes(target);
}


export function hitFreeze(scene, ms = 50) {
    const now = scene.time.now;
    scene.lastHitFreeze = { at: now, ms };
    // A 200%+ launch earlier this frame stretches this attack's freeze.
    if (scene.ultraHitAt === now) {
        freezeUntil(scene, now + ms + ULTRA_FREEZE_BONUS);
        return;
    }
    const launch = scene.launchFreeze?.at === now ? scene.launchFreeze : { ms: 0, scale: 1 };
    freezeUntil(scene, now + (ms + launch.ms) * launch.scale);
}

function freezeUntil(scene, until, ultra = false) {
    if (ultra) scene.hitFreezeUltra = true;
    if (until <= (scene.hitFreezeUntil ?? 0)) return;
    if (!(scene.hitFreezeUntil > scene.time.now)) scene.hitFreezeStartedAt = scene.time.now;
    scene.hitFreezeUntil = until;
    scene.physics.world.pause();
    scene.anims.pauseAll();
    scene.tweens.pauseAll();
    scene.baseZoom = 2;
    scene.hitFreezeEnd?.remove(false);
    scene.hitFreezeEnd = scene.time.delayedCall(until - scene.time.now, () => {
        refundFrozenHitstun(scene, scene.hitFreezeStartedAt, scene.time.now - scene.hitFreezeStartedAt);
        scene.hitFreezeUntil = 0;
        scene.hitFreezeEnd = null;
        scene.hitFocus = null;
        scene.physics.world.resume();
        scene.anims.resumeAll();
        scene.tweens.resumeAll();
        scene.baseZoom = 1;
        if (scene.hitFreezeUltra) {
            scene.sound.play('superexplosion');
            scene.deathRayAttackLockUntil = scene.time.now + DEATH_RAY_ATTACK_LOCK_MS;
        }
        scene.hitFreezeUltra = false;
    });
}

// A hit freeze pauses physics but not scene.time, and hitstun runs on scene.time.
// Without this, a launch's hitstun ticks away while the victim hangs in the air,
// and they can steer out of it the moment the world resumes. The death ray's
// 300ms freeze ate most of the chainsaw explosion's flat 500ms this way.
function refundFrozenHitstun(scene, frozenAt, frozenFor) {
    if (!(frozenFor > 0)) return;
    for (const fighter of getAllFighters(scene)) {
        if (fighter.hitstunUntil > frozenAt) fighter.hitstunUntil += frozenFor;
        if (fighter.launchArcUntil > frozenAt) fighter.launchArcUntil += frozenFor;
    }
}

function launchDeathRay(scene, target, vx, vy) {
    const now = scene.time.now;
    scene.ultraHitAt = now;
    scene.hitFocus = target;
    const last = scene.lastHitFreeze;
    const attackFreeze = last?.at === now ? last.ms : 0;
    freezeUntil(scene, now + attackFreeze + ULTRA_FREEZE_BONUS, true);

    const angle = Math.atan2(vy, vx);
    const length = 6000;
    const layers = [
        scene.add.rectangle(target.x, target.y, length, 300, DEATH_RAY_COLOR, 0.35),
        scene.add.rectangle(target.x, target.y, length, 190, DEATH_RAY_COLOR),
        scene.add.rectangle(target.x, target.y, length, 65, 0xffffff)
    ];
    const behindFighters = Math.min(...getAllFighters(scene).map(fighter => scene.objs.getIndex(fighter)));
    layers.forEach((layer, index) => {
        layer.setOrigin(0.5, 0.5).setRotation(angle).setScale(0.15, 1);
        scene.objs.addAt(layer, behindFighters + index);
    });
    const baseAlpha = layers.map(layer => layer.alpha);

    const GROW_MS = 120;
    const FADE_MS = 450;
    const removeUpdate = addSceneUpdateListener(scene, () => {
        const elapsed = scene.time.now - now;
        const holdUntil = Math.max(now + GROW_MS + 60, scene.hitFreezeUntil || 0);
        const fade = (scene.time.now - holdUntil) / FADE_MS;
        if (fade >= 1) {
            removeUpdate();
            layers.forEach(layer => layer.destroy());
            return;
        }
        const grow = Math.min(1, elapsed / GROW_MS);
        const scaleX = 0.15 + 0.85 * (1 - Math.pow(1 - grow, 3));
        const pulse = 1 + Math.sin(elapsed / 25) * 0.08;
        const shrink = fade > 0 ? 1 - fade * fade : 1;
        layers.forEach((layer, index) => {
            layer.setScale(scaleX, pulse * shrink);
            layer.setAlpha(baseAlpha[index] * shrink);
        });
    });
}

function launchFreeze(scene, ms, scale, speed) {
    if (speed < LAUNCH_FREEZE_MIN_SPEED) return;
    const now = scene.time.now;
    scene.launchFreeze = { at: now, ms, scale };
    const last = scene.lastHitFreeze;
    const attackFreeze = last?.at === now ? last.ms : 0;
    freezeUntil(scene, now + (attackFreeze + ms) * scale);
}

export function deathRayAttackLocked(scene) {
    return scene.hitFreezeUltra || scene.time.now < (scene.deathRayAttackLockUntil ?? 0);
}

// Pass { noDeathRay: true } for hits that shouldn't ever fire the death ray,
// like pulls and explosions.
export function clearLaunchArc(target) {
    if (!target.launchArc) return;
    target.launchArc = false;
    target.launchArcUntil = 0;
    target.body?.setGravityY(0);
}

function startLaunchArc(scene, target, vx, vy) {
    clearLaunchArc(target);
    if (!isFighter(scene, target) || !target.body) return vy;
    const seconds = ((target.hitstunUntil ?? 0) - scene.time.now) / 1000;
    const speed = Math.abs(vx);
    const grounded = target.body.blocked.down || target.body.touching.down;
    if (seconds <= 0 || speed < 1 || vy > 0 || (vy === 0 && grounded)) return vy;
    const height = LAUNCH_ARC_HEIGHT * speed * seconds;
    target.launchArc = true;
    target.launchArcUntil = target.hitstunUntil;
    target.body.setGravityY(8 * height / (seconds * seconds));
    return vy - 4 * height / seconds;
}

const DOWN_LAUNCH_REBOUND = { scale: 0.45, minFallSpeed: 250, maxSpeed: 650, keepX: 0.6 };

export function markDownwardLaunch(target, vy, keepHitstun = false) {
    const body = target.body;
    if (!body || !(vy > 0) || body.blocked.down || body.touching.down) return;
    target.downLaunch = { since: target.scene.time.now, pin: keepHitstun, rebounded: false, fallSpeed: vy };
}

export function updateLandingHitstun(player) {
    const launch = player.downLaunch;
    if (!launch) return;
    if (!player.hitstun) {
        player.downLaunch = null;
        return;
    }
    const body = player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (!grounded) {
        if (body.velocity.y > 0) launch.fallSpeed = body.velocity.y;
        return;
    }
    if (player.scene.time.now <= launch.since || body.velocity.y < 0) return;
    const bounces = !launch.pin && !launch.rebounded && launch.fallSpeed >= DOWN_LAUNCH_REBOUND.minFallSpeed;
    if (!bounces) {
        player.downLaunch = null;
        body.setVelocityX(0);
        return;
    }
    launch.rebounded = true;
    launch.since = player.scene.time.now;
    clearLaunchArc(player);
    const up = Math.min(launch.fallSpeed * DOWN_LAUNCH_REBOUND.scale, DOWN_LAUNCH_REBOUND.maxSpeed);
    player.setVelocity(body.velocity.x * DOWN_LAUNCH_REBOUND.keepX, -up);
}

export function stretchHitstun(scene, target, scale) {
    const now = scene.time.now;
    if (target.hitstunUntil > now) target.hitstunUntil = now + (target.hitstunUntil - now) * scale;
}

export function updateLaunchArc(player) {
    if (!player.launchArc) return;
    const body = player.body;
    const landed = (body.blocked.down || body.touching.down) && body.velocity.y >= 0;
    const arcOver = player.launchArcUntil > 0 && player.scene.time.now >= player.launchArcUntil;
    if (!player.hitstun || player.freeze || player.grabbedBy || landed || arcOver) clearLaunchArc(player);
}

function deathRayNeedsVx(vx, vy) {
    const lift = Math.max(0, -vy) / Math.max(Math.abs(vx), 1);
    return DEATH_RAY_MIN_VX * (1 + Math.max(0, lift - DEATH_RAY_FREE_LIFT) * DEATH_RAY_LIFT_PENALTY);
}

export function applyKnockback(scene, target, vx, vy, { noDeathRay = false, ignoreResistance = false } = {}) {
    const resistance = ignoreResistance ? 1 : getKnockbackResistance(target);
    const resistantVx = vx / resistance;
    const resistantVy = vy / resistance;
    target.setVelocity(resistantVx, startLaunchArc(scene, target, resistantVx, resistantVy));

    const speed = Math.hypot(resistantVx, resistantVy);
    if (isFighter(scene, target)) {
        const kbPercent = (target.KBmultiplier * 100) - 100;
        const strong = kbPercent >= STRONG_KB_PERCENT;
        const heavy = kbPercent >= HEAVY_KB_PERCENT;
        const violent = kbPercent >= VIOLENT_KB_PERCENT;
        const ultra = !noDeathRay && kbPercent >= ULTRA_KB_PERCENT &&
            Math.abs(resistantVx) >= deathRayNeedsVx(resistantVx, resistantVy);
        if (!heavy) spawnHitParticles(scene, target, resistantVx, resistantVy);
        if (heavy) {
            target.heavyLaunch = true;
            target.violentLaunch = violent;
            target.ultraLaunch = ultra;
            target.heavyLaunchAt = scene.time.now;
            target.afterimage = true;
            if (ultra) {
                shakeVictim(target, VICTIM_SHAKE.ultra);
                launchDeathRay(scene, target, resistantVx, resistantVy);
            } else if (violent) {
                shakeVictim(target, VICTIM_SHAKE.violent);
                launchFreeze(scene, VIOLENT_FREEZE_BONUS, HEAVY_FREEZE_SCALE, speed);
            } else {
                shakeVictim(target, Phaser.Math.Clamp(
                    VICTIM_SHAKE.heavyMin + (kbPercent - HEAVY_KB_PERCENT) / VICTIM_SHAKE.heavyRamp,
                    VICTIM_SHAKE.heavyMin, VICTIM_SHAKE.heavyMax));
                launchFreeze(scene, HEAVY_FREEZE_BONUS, HEAVY_FREEZE_SCALE, speed);
            }
        } else if (strong) {
            launchFreeze(scene, 0, STRONG_FREEZE_SCALE, speed);
        }
    }

    return speed;
}
