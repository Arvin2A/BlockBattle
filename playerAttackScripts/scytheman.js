// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { grindExplosion, grindTick, setGrindFloat, ALWAYS_ON_GRINDERS, interruptGrinder, grinderCanResume, holdGrinderInPlace } from '../combat/grinder.js';
import { MIN_ABILITY_COOLDOWN_MS, SIDE_SPECIAL_POWER } from '../gameSettings.js';
import { isGrounded, pinTarget, slamImpact } from '../combat/pin.js';
import { addSceneUpdateListener } from '../combat/effects.js';
import { applySkin } from '../combat/skins.js';
import { jitterVictim } from '../combat/knockback.js';

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'scytheatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const SLAM_FINISHER = {
    hitFreeze: 0,
    knockback: { x: 600, y: 600, onDown: 'popUp' }
};
function slamThirdAttack(api, scene, attacker, target, animKey) {
    api.thirdAttack(scene, attacker, target, animKey, SLAM_FINISHER);
}
function tryAttack2(api, scene, attacker, target, animKey, thirdAnimKey) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        slamThirdAttack(api, scene, attacker, target, thirdAnimKey);
    } else if (api.aimsDown(attacker)) {
        api.spikeAttack(scene, attacker, target, animKey);
    } else {
        if (attacker.horizontalMovementActive) {
            api.pushAttack(scene, attacker, target, animKey);
        } else {
            api.attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 400;
}
const GRASS_CUT_RESISTANCE = { perCut: 0.01, max: 1 };

const SLAM = {
    radius: 75,
    sweep: 110 * Math.PI / 180,
    swingMs: 150,
    scale: 2.5,
    range: 150,
    damage: 0.20,
    groundPinMs: 500,
    airPinMs: 1000,
    crashSpeed: 2200,
    crashTimeoutMs: 1500,
    recoveryMs: 350,
    hop: { x: 350, y: 380 }
};

function placeScythe(scythe, player, angle, facing) {
    scythe.setPosition(
        player.x + Math.sin(angle) * SLAM.radius * facing,
        player.y - Math.cos(angle) * SLAM.radius
    );
    scythe.setRotation(angle * facing);
}

function fadeScythe(scene, scythe, follow = null) {
    if (!scythe.active) return;
    const removeFollow = follow ? addSceneUpdateListener(scene, () => {
        if (scythe.active) follow();
    }) : () => {};
    scene.tweens.add({
        targets: scythe,
        alpha: 0,
        duration: 250,
        onComplete: () => {
            removeFollow();
            scythe.destroy();
        }
    });
}

function tryGruelingSlam(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        const facing = direction === 'left' ? -1 : 1;
        player.lastDir = { x: facing, y: 0 };
        player.isUsingSideSpecial = true;
        player.canAttack = false;
        api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);

        const scythe = scene.add.image(player.x, player.y, 'whitescythe')
            .setScale(SLAM.scale)
            .setFlipX(facing > 0)
            .setDepth(player.depth + 1);

        api.applySkin(scythe, player.skin);
        scene.objs.add(scythe);
        placeScythe(scythe, player, 0, facing);
        scene.sound.play('scytheslam');

        const swing = { angle: 0 };
        let cancelled = false;
        const tweens = [];
        const removeFollow = api.addSceneUpdateListener(scene, () => {
            if (!scythe.active || cancelled) return;
            if (player.hitstun || !player.active) {
                cancelled = true;
                tweens.forEach(tween => tween.remove());
                removeFollow();
                fadeScythe(scene, scythe, () => placeScythe(scythe, player, swing.angle, facing));
                player.canAttack = true;
                player.isUsingSideSpecial = false;
                return;
            }
            placeScythe(scythe, player, swing.angle, facing);
        });
        tweens.push(scene.tweens.add({
            targets: swing,
            angle: SLAM.sweep,
            duration: SLAM.swingMs,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                if (cancelled) return;
                removeFollow();
                placeScythe(scythe, player, SLAM.sweep, facing);
                landGruelingSlam(api, scene, player, target, scythe, facing);
                if (player.active && !player.hitstun) player.setVelocity(facing * SLAM.hop.x, -SLAM.hop.y);
                scene.time.delayedCall(SLAM.recoveryMs, () => {
                    player.canAttack = true;
                    player.isUsingSideSpecial = false;
                });
            }
        }));
    }
    player.lastTap[direction] = currentTime;
}

function landGruelingSlam(api, scene, player, target, scythe, facing, options = {}) {
    const targetGrounded = isGrounded(target);
    const hit = api.strike(scene, player, target, {
        special: true,
        range: options.range ?? SLAM.range,
        bypass: { ignoreCanAttack: true, ignoreAttackerStun: true, allowTargetBelow: true, ...options.bypass },
        ...(options.direction ? { direction: options.direction } : {}),
        damage: options.damage ?? SLAM.damage * SIDE_SPECIAL_POWER,
        plankDamage: 0.15,
        hitstun: targetGrounded ? SLAM.groundPinMs : SLAM.airPinMs + SLAM.crashTimeoutMs,
        hitstunGrowth: false,
        hitFreeze: 90,
        sound: 'slamimpact',
        noDeathRay: true,
        resetCombo: false,
        knockback: () => ({ x: 0, y: targetGrounded ? 0 : SLAM.crashSpeed }),
        holdsOnLanding: true,
        decelerateAfter: 50,
        onHit: () => target.flash(),
        missSound: 'miss'
    });
    if (!hit) {
        fadeScythe(scene, scythe, () => placeScythe(scythe, player, SLAM.sweep, facing));
        return;
    }
    if (targetGrounded) slamImpact(scene, target);
    pinTarget(scene, player, target, {
        ...SLAM,
        grounded: targetGrounded,
        onFrame: () => {
            if (scythe.active) scythe.setPosition(target.x - facing * 15, target.y - 20);
        },
        onEnd: () => fadeScythe(scene, scythe)
    });
}

const UP_REAP = {
    windupMs: 380,
    windupFrom: -150 * Math.PI / 180,
    windupTo: -105 * Math.PI / 180,
    swingTo: 70 * Math.PI / 180,
    swingMs: 130,
    range: 180,
    minDot: 0.2,
    damage: 0.15,
    recoveryMs: 350
};

function tryUpReap(api, scene, player, target, currentTime) {
    if (player.hitstun || player.freeze || currentTime < player.nextSideSpecialTime) return;
    const facing = player.lastDir.x || player.facingX || 1;
    player.lastDir = { x: facing, y: 0 };
    player.isUsingSideSpecial = true;
    player.canAttack = false;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);

    const scythe = scene.add.image(player.x, player.y, 'whitescythe')
        .setScale(SLAM.scale)
        .setFlipX(facing > 0)
        .setDepth(player.depth + 1);

    api.applySkin(scythe, player.skin);
    scene.objs.add(scythe);
    const swing = { angle: UP_REAP.windupFrom };
    placeScythe(scythe, player, swing.angle, facing);
    scene.sound.play('slice');

    let cancelled = false;
    const tweens = [];
    const release = () => {
        player.canAttack = true;
        player.isUsingSideSpecial = false;
    };
    const removeFollow = api.addSceneUpdateListener(scene, () => {
        if (!scythe.active || cancelled) return;
        if (player.hitstun || !player.active) {
            cancelled = true;
            tweens.forEach(tween => tween.remove());
            removeFollow();
            fadeScythe(scene, scythe, () => placeScythe(scythe, player, swing.angle, facing));
            release();
            return;
        }
        placeScythe(scythe, player, swing.angle, facing);
    });
    tweens.push(scene.tweens.chain({
        targets: swing,
        tweens: [
            { angle: UP_REAP.windupTo, duration: UP_REAP.windupMs, ease: 'Sine.easeOut' },
            {
                angle: UP_REAP.swingTo,
                duration: UP_REAP.swingMs,
                ease: 'Cubic.easeIn',
                onStart: () => scene.sound.play('scytheslam'),
                onComplete: () => {
                    if (cancelled) return;
                    removeFollow();
                    placeScythe(scythe, player, UP_REAP.swingTo, facing);
                    landGruelingSlam(api, scene, player, target, scythe, facing, {
                        range: UP_REAP.range,
                        damage: UP_REAP.damage,
                        direction: { x: 0, y: -1 },
                        bypass: { allowTargetBelow: false, direction: { x: 0, y: -1 }, minDot: UP_REAP.minDot }
                    });
                    scene.time.delayedCall(UP_REAP.recoveryMs, release);
                }
            }
        ]
    }));
}

const WHIRL_DROP = {
    fallSpeed: 1300,
    keepX: 0.3,
    spinPerMs: 1.6 * Math.PI / 100,
    reach: { x: 90, below: 130, above: 20 },
    damage: 0.15,
    bounce: 380,
    maxMs: 1500,
    endLockMs: 200,
    sound: 'whirlingloop',
    soundRate: 0.75
};

function canPlaySound(scene, key) {
    return Boolean(scene.game.config.audio?.noAudio || scene.cache.audio.exists(key));
}

function tryWhirlDrop(api, scene, player, currentTime) {
    if (player.hitstun || player.freeze || player.whirlDropping || isGrounded(player)) return;
    if (currentTime < player.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    const facing = player.lastDir.x || player.facingX || 1;
    player.lastDir = { x: facing, y: 0 };
    player.whirlDropping = true;
    player.isUsingSideSpecial = true;
    player.canAttack = false;
    player.afterimage = true;

    const scythe = scene.add.image(player.x, player.y, 'whitescythe')
        .setScale(SLAM.scale)
        .setFlipX(facing > 0)
        .setDepth(player.depth + 1);

    api.applySkin(scythe, player.skin);
    scene.objs.add(scythe);
    const startedAt = scene.time.now;
    const whirl = canPlaySound(scene, WHIRL_DROP.sound)
        ? scene.sound.add(WHIRL_DROP.sound, { loop: true, rate: WHIRL_DROP.soundRate })
        : null;
    whirl?.play();
    scene.sound.play('whoosh');

    let ended = false;
    const end = () => {
        if (ended) return;
        ended = true;
        removeUpdate();
        whirl?.stop();
        whirl?.destroy();
        player.whirlDropping = false;
        player.afterimage = false;
        player.isUsingSideSpecial = false;
        scene.time.delayedCall(WHIRL_DROP.endLockMs, () => { player.canAttack = true; });
    };
    const landOn = foe => {
        const foeGrounded = isGrounded(foe);
        const hit = api.landHit(scene, player, foe, {
            special: true,
            damage: WHIRL_DROP.damage,
            plankDamage: 0,
            hitstun: foeGrounded ? SLAM.groundPinMs : SLAM.airPinMs + SLAM.crashTimeoutMs,
            hitstunGrowth: false,
            hitFreeze: 90,
            sound: 'slamimpact',
            noDeathRay: true,
            resetCombo: false,
            direction: { x: 0, y: 1 },
            knockback: () => ({ x: 0, y: foeGrounded ? 0 : SLAM.crashSpeed }),
            holdsOnLanding: true,
            decelerateAfter: 50,
            onHit: () => foe.flash()
        });
        if (!hit) return false;
        if (foeGrounded) slamImpact(scene, foe);
        placeScythe(scythe, player, Math.PI, facing);
        pinTarget(scene, player, foe, {
            ...SLAM,
            grounded: foeGrounded,
            onFrame: () => {
                if (scythe.active) scythe.setPosition(foe.x - facing * 15, foe.y - 20);
            },
            onEnd: () => fadeScythe(scene, scythe)
        });
        player.setVelocity(player.body.velocity.x, -WHIRL_DROP.bounce);
        return true;
    };
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        if (!player.active || player.hitstun || now - startedAt > WHIRL_DROP.maxMs) {
            fadeScythe(scene, scythe);
            end();
            return;
        }
        player.setVelocity(player.body.velocity.x * WHIRL_DROP.keepX, WHIRL_DROP.fallSpeed);
        placeScythe(scythe, player, (now - startedAt) * WHIRL_DROP.spinPerMs, facing);
        for (const foe of api.getEnemies(scene, player)) {
            if (!foe.active || api.isInvincible(foe)) continue;
            const dx = Math.abs(foe.x - player.x);
            const dy = foe.y - player.y;
            if (dx > WHIRL_DROP.reach.x || dy > WHIRL_DROP.reach.below || dy < -WHIRL_DROP.reach.above) continue;
            if (landOn(foe)) {
                end();
                return;
            }
        }
        if (isGrounded(player)) {
            slamImpact(scene, player);
            scene.sound.play('slamimpact');
            fadeScythe(scene, scythe);
            end();
        }
    });
}

const SOW = {
    seeds: 7,
    cooldownMs: 250,
    spreadX: { min: 120, step: 70 },
    launchY: -380,
    lifetimeMs: 3000,
    radius: 4,
    color: 0x8a5a2b,
    grassSpacing: 40
};

function sow(api, scene, player) {
    const now = scene.time.now;
    if (player.hitstun || player.freeze) return;
    if (now < (player.nextSowTime ?? 0)) return;
    player.nextSowTime = now + SOW.cooldownMs;

    const facing = player.lastDir.x || (player.flipX ? -1 : 1);
    scene.sound.play('whoosh');
    for (let i = 0; i < SOW.seeds; i++) {
        throwSeed(api, scene, player, facing * (SOW.spreadX.min + i * SOW.spreadX.step));
    }
}

function throwSeed(api, scene, player, velocityX) {
    const seed = scene.add.circle(player.x, player.y - 10, SOW.radius, SOW.color)
        .setStrokeStyle(1, 0x000000)
        .setDepth(player.depth + 1);
    scene.physics.add.existing(seed);
    seed.body.setVelocity(velocityX, SOW.launchY);
    scene.objs.add(seed);

    const feetOffset = player.body.bottom - player.y;
    const landsFromAbove = (_seed, platform) =>
        seed.body.velocity.y >= 0 && seed.body.prev.y + seed.body.height <= platform.body.top + 8;
    const collider = scene.physics.add.collider(seed, api.getMapPlatforms(scene), null, landsFromAbove);

    let removeUpdate = () => {};
    const removeSeed = () => {
        if (!seed.active) return;
        removeUpdate();
        collider.destroy();
        expire.remove(false);
        scene.events.off('shutdown', removeSeed);
        seed.destroy();
    };
    const expire = scene.time.delayedCall(SOW.lifetimeMs, removeSeed);
    scene.events.once('shutdown', removeSeed);

    removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (!seed.active || !(seed.body.blocked.down || seed.body.touching.down)) return;
        const platform = api.getGrassPlatform(scene, seed.x, seed.body.bottom);
        const grassY = seed.body.bottom - feetOffset;
        if (platform && !api.hasOwnGrassNear(scene, player, seed.x, grassY, SOW.grassSpacing)) {
            api.plantGrass(scene, player, seed.x, grassY);
        }
        removeSeed();
    });
}

// DONT REMOVE COMMENT: will be used for a joke boss fight
function tryMowLegacy(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const mowCD = player.dirSpecialCooldown;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.isUsingSideSpecial = true;
        player.isAttacking = true;
        player.hasHitSideSpecial = false;

        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        const fakescythe = scene.add.image(player.x, player.y, 'whitescythe');
        fakescythe.setScale(2);

        scene.physics.add.existing(fakescythe);

        const speed = 1500;

        fakescythe.body.setVelocity(
            player.lastDir.x * speed,
            -100
        );
        fakescythe.body.allowGravity = false;
        scene.objs.add(fakescythe);
        const removePlatformColliders = api.addProjectilePlatformColliders(
            scene,
            fakescythe,
            player
        );

        const spinSpeed =
            player.lastDir.x > 0 ? 0.45 : -0.45;

        let returning = false;

        scene.time.delayedCall(550, () => {
            returning = true;
        });
        let canhit = true;
        let mowsound = scene.sound.add('twirl', {
            loop: true
        });
        mowsound.play();
        player.isUsingSideSpecial = false;
        let dir = (direction === 'left') ? -1 : 1
        api.overlapEnemies(scene, fakescythe, player, target => {
            if (player.hasHitSideSpecial) return;
            if (!canhit || api.isInvincible(target)) return;
            if (api.blocksHit(scene, target, player, 0.08, { ranged: true, special: true })) {
                player.hasHitSideSpecial = true;
                return;
            }
            target.hitstunUntil = 100 + scene.time.now;
            const slash = scene.add.image(target.x, target.y, 'slasheffect');
            slash.setScale(1.5);
            scene.tweens.add({
                targets: slash,
                alpha: 0,
                duration: 100,
                onComplete: () => slash.destroy()
            });
            canhit = false;
            scene.time.delayedCall(40, () => {
                canhit = true;
            });
            if (target.revokeMowStun) {
                scene.time.removeEvent(target.revokeMowStun);
            }

            const mowStunToken = ++target.mowStunToken;
            const mowStunDuration = 1000;

            target.revokeMowStun = scene.time.delayedCall(mowStunDuration, () => {
                if (target.mowStunToken !== mowStunToken) return;
                player.hasHitSideSpecial = true;
                target.willDecelerate = true;
                target.revokeMowStun = null;
            });

            scene.sound.play('slash');
            target.KBmultiplier += 0.08 * api.getAttackDamageScale(player);
            target.lastHitBy = player;
            api.applyKnockback(scene, target, 500 * dir, 300);
            target.flash();

        });
        const scytheUpdate = () => {

            if (!fakescythe.active) return;

            fakescythe.rotation += spinSpeed;

            if (returning) {
                dir = dir * -1;
                const dx = player.x - fakescythe.x;
                const dy = player.y - fakescythe.y;

                const dist = Math.hypot(dx, dy);

                fakescythe.body.setVelocity(
                    (dx / dist) * 1500,
                    (dy / dist) * 1500
                );

                if (dist < 60) {

                    removeScytheUpdate();
                    removePlatformColliders();

                    fakescythe.destroy();

                    player.isUsingSideSpecial = false;
                    player.isAttacking = false;

                    mowsound.stop();
                }
            }
        };

        const removeScytheUpdate = api.addSceneUpdateListener(scene, scytheUpdate);

        scene.time.delayedCall(3000, () => {

            if (fakescythe.active) {

                removeScytheUpdate();
                removePlatformColliders();

                fakescythe.destroy();

                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
        });

        api.startSideSpecialCooldown(player, currentTime, mowCD);

    }

    player.lastTap[direction] = currentTime;

}

const SHIELD = { from: 0xffffff, to: 0x2f5bff, alpha: 0.85, inMs: 120, holdMs: 700, outMs: 450 };

function lerpColor(from, to, t) {
    const channel = shift => {
        const a = (from >> shift) & 0xff;
        const b = (to >> shift) & 0xff;
        return Math.round(a + (b - a) * t) << shift;
    };
    return channel(16) | channel(8) | channel(0);
}

function updateResistanceShield(scene, player, texture = 'resistanceshield') {
    let shield = player.resistanceShield;
    if (!shield?.active) {
        shield = player.resistanceShield = scene.add.image(player.x, player.y, texture)
            .setDepth(player.depth + 1)
            .setAlpha(0);
        scene.objs.add(shield);
        player.shieldCutCount = player.grassCutCount;
    }
    shield.setPosition(player.x, player.y);
    shield.setScale(Math.abs(player.scaleX), Math.abs(player.scaleY));

    if (player.grassCutCount <= player.shieldCutCount) {
        player.shieldCutCount = player.grassCutCount;
        return;
    }
    player.shieldCutCount = player.grassCutCount;
    const { perCut, max } = GRASS_CUT_RESISTANCE;
    shield.setTint(lerpColor(SHIELD.from, SHIELD.to, Math.min(player.grassCutCount * perCut, max) / max));

    player.shieldTween?.stop();
    player.shieldTween = scene.tweens.chain({
        targets: shield,
        tweens: [
            { alpha: SHIELD.alpha, duration: SHIELD.inMs },
            { alpha: 0, delay: SHIELD.holdMs, duration: SHIELD.outMs }
        ]
    });
}
const MOWER = {
    scale: 0.8,
    meterColor: 0x4caf50,
    heldArm: { x: 21 / 130, y: 22 / 75 },
    heldOffset: { x: 18, y: -14 },
    heldCutReach: 53,
    backWheel: { x: 64, y: 22 },
    body: { width: 110, height: 50, offsetX: 10, offsetY: 23 },
    engineVolume: 0.6,
    cordMs: 10000,
    cordFastCuts: 150,
    cordFastScale: 0.5,
    plowTickMs: 50,
    plowExplodeMs: 2000,
    plowCutRange: 45,
    plowGrindRange: 150,
    plowMinDot: 0.8,
    plowVerticalReach: { up: 30, down: 35 },
    plowChipDamage: 0.001,
    plowBlockCost: 0.004,
    steelPlankDamage: 0.01,
    rideLift: 14,
    rideMowerDrop: 4,
    botPlowIdleMs: 800,
    rideSpeed: 1.6,
    rideCutRange: 50,
    rideRunSpeed: 1.2,
    boost: 1.4,
    boostMs: 400,
    wreckRemountMs: 1000,
    wreckSelfDamage: 0.08,
    ejectKbScale: 1.5,
    ejectDamage: 0.4,
    ejectShieldCost: 0.45,
    ejectSplashRange: 110,
    doubleTapMs: 250
};

const EJECT = {
    startSpeed: 600,
    maxSpeed: 2000,
    growthPerSec: 2.2,
    pushPerSec: 1200,
    lifetimeMs: 2500,
    minRate: 0.6,
    maxRate: 1.5,
    rateCurve: 0.5,
    rateStep: 0.05,
    cutRange: 50,
    grassSpeedScale: 1.5,
    grassBoostMs: 200
};

const PLOW_EXPLOSION = { damage: 0.25, force: 450, hitstun: 400, hitFreeze: 60, explosionScale: 0.7 };
const PLOW_HIT = { ...PLOW_EXPLOSION, damage: 0.45, force: 412.5, hitstun: 500 };
const BLOCKED_PLOW_HIT = {
    unblockable: true,
    damage: 0,
    plankDamage: 0,
    hitstun: 250,
    hitstunGrowth: false,
    hitFreeze: PLOW_HIT.hitFreeze,
    sound: 'explosion',
    knockback: { x: PLOW_HIT.force * 0.5, y: PLOW_HIT.force, lift: -0.05 },
    decelerateAfter: 400,
    resetCombo: false,
    noDeathRay: true
};

const CORD_PUSH = {
    range: 140,
    damage: 0.04,
    plankDamage: 0.03,
    knockback: { x: 750, y: 450, growth: false, scaleWithDamage: false },
    noDeathRay: true,
    noGrassCut: true
};
const CORD_COOLDOWN_MS = 400;

const RIDE_PUSH = {
    reachX: 70,
    reachY: 50,
    minSpeed: 60,
    cooldownMs: 500,
    hit: {
        damage: 0.02,
        plankDamage: 0,
        hitstun: 300,
        hitstunGrowth: false,
        sound: 'anyhit',
        knockback: { x: 300, y: 450, lift: -1, growth: false, scaleWithDamage: false },
        resetCombo: false,
        noDeathRay: true
    }
};

const CLIPPINGS = {
    max: 45,
    perCut: 3,
    perSpray: 5,
    cooldownMs: 50,
    spreadDeg: 18,
    speed: 900,
    lifetimeMs: 380,
    size: 6,
    color: 0x2f7d1f,
    damage: 0.004,
    hitstun: 120,
    slowMs: 1200
};

const DIRT = {
    speed: { min: 90, max: 170 },
    gravityY: 700,
    scale: { start: 1.6, end: 0.4 },
    alpha: { start: 0.9, end: 0 },
    tint: [0x6b4a2b, 0x8b5a2b, 0x5a3d1e],
    lifespan: 450,
    frequency: 30,
    quantity: 1,
    emitting: false
};

function isMower(player) {
    return player.variant === 'LAWNMOWER';
}

function isWithoutMower(player) {
    return player.mowerState === 'cord' || player.mowerState === 'dismounted';
}

function facingOf(player) {
    return player.lastDir.x || (player.flipX ? -1 : 1);
}

function setupMower(scene, player) {
    if (player.mower) return;
    player.mower = scene.add.sprite(player.x, player.y, 'lawnmower-held')
        .setScale(MOWER.scale)
        .setDepth(player.depth + 1)
        .setVisible(false);
    applySkin(player.mower, player.skin);
    scene.objs.add(player.mower);
    const dirt = angle => {
        const emitter = scene.add.particles(0, 0, '__WHITE', { ...DIRT, angle });
        scene.objs.add(emitter);
        return emitter;
    };
    player.mowerDirt = { 1: dirt({ min: 200, max: 235 }), [-1]: dirt({ min: 305, max: 340 }) };
    player.mowerLoopSFX = scene.sound.add('lawnmower-loop', { volume: MOWER.engineVolume, loop: true });
    player.mowerEndSFX = scene.sound.add('lawnmower-end', { volume: MOWER.engineVolume });
    player.mowerState = 'ready';
    player.mowerCordUntil = 0;
    player.mowerRemountAt = 0;
    player.mowerBoostUntil = 0;
    player.clippings = 0;
    player.nextClippingsTime = 0;
    player.onGrassCut = () => onGrassCut(scene, player);
}

function onGrassCut(scene, player) {
    if (isWithoutMower(player)) return;
    player.clippings = Math.min(CLIPPINGS.max, player.clippings + CLIPPINGS.perCut);
    if (player.mowerState === 'ride') player.mowerBoostUntil = scene.time.now + MOWER.boostMs;
}

function startEngine(scene, player) {
    if (player.engineOn) return;
    player.engineOn = true;
    player.mowerEndSFX.stop();
    player.mowerLoopSFX.play();
}

function stopEngine(player, { quiet = false } = {}) {
    if (!player.engineOn) return;
    player.engineOn = false;
    player.mowerLoopSFX.stop();
    if (!quiet) player.mowerEndSFX.play();
}

function cordMs(player) {
    if (player.noAbilityCooldown) return MIN_ABILITY_COOLDOWN_MS;
    const progress = Math.min(1, (player.grassCutCount ?? 0) / MOWER.cordFastCuts);
    return MOWER.cordMs * (1 - (1 - MOWER.cordFastScale) * progress);
}

function startCord(scene, player, { quiet = false } = {}) {
    player.mowerState = 'cord';
    player.clippings = 0;
    player.mowerCordMs = cordMs(player);
    player.mowerCordUntil = scene.time.now + player.mowerCordMs;
    player.mower.stop().setVisible(false);
    stopEngine(player, { quiet });
}

function layerMower(player, inFront) {
    const objs = player.scene?.objs;
    if (!objs || objs.getIndex(player.mower) < 0) return;
    if (inFront) objs.moveAbove(player.mower, player);
    else objs.moveBelow(player.mower, player);
}

function showHeldMower(player) {
    player.mower.stop().setTexture('lawnmower-held').setVisible(true);
    layerMower(player, true);
}

function showRideMower(player, running) {
    if (running) {
        if (player.mower.anims.currentAnim?.key !== 'lawnmowerrun' || !player.mower.anims.isPlaying) {
            player.mower.play('lawnmowerrun', true);
        }
    } else if (player.mower.texture.key !== 'lawnmower-only') {
        player.mower.stop().setTexture('lawnmower-only');
    }
    player.mower.setVisible(true);
}

function startPlow(api, scene, player, victim) {
    player.mowerState = 'plow';
    player.plowContactMs = 0;
    player.plowLastContactAt = 0;
    player.plowLastHitAt = scene.time.now;
    showHeldMower(player);
    startEngine(scene, player);
    player.plowEvent = scene.time.addEvent({
        delay: MOWER.plowTickMs,
        loop: true,
        callback: () => plowTick(api, scene, player, api.nearestEnemy(scene, player) ?? victim)
    });
}

function stopPlow(scene, player, nextState = 'ready') {
    player.plowEvent?.remove(false);
    player.plowEvent = null;
    setGrindFloat(scene, player, false);
    player.mower.stop().setVisible(false);
    stopEngine(player);
    player.mowerState = nextState;
}

function plowThroughPlanks(api, scene, player) {
    const bounds = player.mower.getBounds();
    for (const plank of [...(scene.planks?.getChildren() ?? [])]) {
        if (!plank.active || !plank.body?.enable) continue;
        if (!Phaser.Geom.Intersects.RectangleToRectangle(bounds, plank.body)) continue;
        const steel = plank.texture.key === 'strongsteel' || plank.texture.key === 'lightsteel';
        api.damagePlank(scene, plank, steel ? MOWER.steelPlankDamage : plank.health);
    }
}

function heldCutPoint(player) {
    return { x: player.x + facingOf(player) * MOWER.heldCutReach, y: player.body.bottom - 15 };
}

function plowTick(api, scene, player, victim) {
    if (player.mowerState !== 'plow') return;
    if (!player.active || player.hitstun || player.freeze) {
        stopPlow(scene, player);
        interruptGrinder(scene, player);
        return;
    }
    if (player.ledge || player.blocking) return;
    plowThroughPlanks(api, scene, player);
    const cut = heldCutPoint(player);
    api.cutNearbyGrass(scene, cut.x, cut.y, MOWER.plowCutRange, player);
    const victimBlocking = Boolean(victim.blocking);
    const contact = grindTick(api, scene, player, victim, player.plowLastContactAt, {
        range: MOWER.plowGrindRange,
        chipDamage: MOWER.plowChipDamage,
        blockCost: MOWER.plowBlockCost,
        blockedBuildsContact: false,
        eligibility: {
            direction: { x: facingOf(player), y: 0 },
            minDot: MOWER.plowMinDot,
            verticalReach: MOWER.plowVerticalReach
        }
    });
    if (contact === null) {
        player.plowLastContactAt = 0;
        if (!ALWAYS_ON_GRINDERS && player.isBot && scene.time.now - player.plowLastHitAt > MOWER.botPlowIdleMs) {
            stopPlow(scene, player);
        }
        return;
    }
    if (victimBlocking) {
        blockedPlowExplosion(api, scene, player, victim);
        return;
    }
    player.plowContactMs += contact;
    player.plowLastContactAt = scene.time.now;
    player.plowLastHitAt = scene.time.now;
    if (player.plowContactMs < MOWER.plowExplodeMs || api.isInvincible(victim)) return;
    grindExplosion(api, scene, player, victim, PLOW_HIT);
    stopPlow(scene, player);
    startCord(scene, player);
}

function blockedPlowExplosion(api, scene, player, victim) {
    stopPlow(scene, player);
    startCord(scene, player);
    if (api.isInvincible(victim)) return;
    api.landHit(scene, player, victim, {
        ...BLOCKED_PLOW_HIT,
        direction: { x: Math.sign(victim.x - player.x) || facingOf(player), y: 0 }
    });
    victim.flash();
    api.spawnExplosion(scene, victim, PLOW_HIT.explosionScale);
}

function startRide(scene, player) {
    player.mowerState = 'ride';
    player.noGrassTrail = true;
    player.renderLiftY = MOWER.rideLift;
    showRideMower(player, false);
    layerMower(player, true);
    startEngine(scene, player);
}

function stopRide(player, nextState = 'ready', { quiet = false } = {}) {
    player.noGrassTrail = false;
    player.renderLiftY = 0;
    player.mowerBoostUntil = 0;
    player.mower.stop().setVisible(false).setRotation(0);
    stopEngine(player, { quiet });
    player.mowerState = nextState;
}

function wreckMower(api, scene, player) {
    stopRide(player, 'dismounted', { quiet: true });
    player.clippings = 0;
    player.mowerRemountAt = scene.time.now + (player.noAbilityCooldown ? MIN_ABILITY_COOLDOWN_MS : MOWER.wreckRemountMs);
    if (!player.active) return;
    api.spawnExplosion(scene, { x: player.x, y: player.body.bottom - 20 }, 0.7);
    scene.sound.play('explosion');
    player.flash();
    player.KBmultiplier += MOWER.wreckSelfDamage;
}

function addMowerBody(scene, player, x, texture) {
    const halfHeight = 75 * MOWER.scale / 2;
    const mower = scene.physics.add.sprite(x, player.body.bottom - halfHeight - 1, texture)
        .setScale(MOWER.scale)
        .setDepth(player.depth + 1);
    mower.body.setSize(MOWER.body.width, MOWER.body.height).setOffset(MOWER.body.offsetX, MOWER.body.offsetY);
    applySkin(mower, player.skin);
    scene.objs.add(mower);
    return { mower, solid: scene.gameState.map.platforms };
}

function eject(api, scene, player, victim, direction) {
    if (player.mowerState === 'ride') stopRide(player, 'ready', { quiet: true });
    if (player.mowerState === 'plow') stopPlow(scene, player);
    player.lastDir = { x: direction, y: 0 };
    startCord(scene, player, { quiet: true });
    scene.sound.play('whoosh');

    const { mower, solid } = addMowerBody(scene, player, player.x + direction * 60, 'lawnmowerrun');
    mower.play('lawnmowerrun');
    mower.setFlipX(direction < 0);
    mower.body.setAllowGravity(false);
    mower.setCollideWorldBounds(true);
    mower.body.onWorldBounds = true;
    let speed = EJECT.startSpeed;
    let owner = player;
    let damageScale = 1;
    let grassBoostUntil = 0;
    mower.setVelocity(direction * speed, 0);
    api.trackDeflectable(scene, mower, player);
    const engine = scene.sound.add('lawnmower-loop', { volume: MOWER.engineVolume, loop: true });
    player.ejectEngines ??= new Set();
    player.ejectEngines.add(engine);
    let rate = EJECT.minRate;
    engine.play();
    engine.setRate(rate);

    let exploded = false;
    const colliders = [];
    let enemyOverlaps = [];
    const explode = directHit => {
        if (exploded || !mower.active) return;
        exploded = true;
        [...colliders, ...enemyOverlaps].forEach(collider => collider.destroy());
        scene.physics.world.off('worldbounds', explodeAtBounds);
        removeUpdate();
        expire.remove(false);
        player.ejectEngines?.delete(engine);
        engine.stop();
        engine.destroy();
        const caught = api.getEnemies(scene, owner).filter(enemy => !api.isInvincible(enemy) && (enemy === directHit ||
            Phaser.Math.Distance.Between(mower.x, mower.y, enemy.x, enemy.y) <= MOWER.ejectSplashRange));
        if (caught.length) {
            for (const enemy of caught) {
                grindExplosion(api, scene, owner, enemy, {
                    special: true,
                    ...PLOW_EXPLOSION,
                    damage: MOWER.ejectDamage * damageScale * SIDE_SPECIAL_POWER,
                    shieldCost: MOWER.ejectShieldCost,
                    force: PLOW_EXPLOSION.force * MOWER.ejectKbScale * SIDE_SPECIAL_POWER,
                    ranged: true,
                    explosionScale: 0.9,
                    direction: { x: Math.sign(enemy.x - mower.x) || direction, y: 0 }
                });
            }
        } else {
            api.spawnExplosion(scene, mower, 0.9);
            scene.sound.play('explosion');
        }
        mower.destroy();
    };
    const explodeAtBounds = body => {
        if (body === mower.body) explode(false);
    };
    const hitsWall = () => {
        const touching = mower.body.touching;
        const blocked = mower.body.blocked;
        if (touching.left || touching.right || blocked.left || blocked.right) explode(false);
    };
    const watchEnemies = () => api.overlapEnemies(scene, mower, owner, enemy => {
        if (exploded || !mower.active) return;
        const deflectScale = api.isInvincible(enemy) ? 0 : api.deflects(scene, enemy, owner, MOWER.ejectDamage * damageScale, { shieldCost: MOWER.ejectShieldCost });
        if (!deflectScale) {
            explode(enemy);
            return;
        }
        damageScale *= deflectScale;
        direction = Math.sign(owner.x - enemy.x) || -direction;
        owner = enemy;
        mower.deflectOwner = owner;
        mower.setFlipX(direction < 0);
        mower.setVelocity(direction * speed, 0);
        enemyOverlaps.forEach(overlap => overlap.destroy());
        enemyOverlaps = watchEnemies();
    });
    enemyOverlaps = watchEnemies();
    colliders.push(
        scene.physics.add.collider(mower, solid, hitsWall),
        scene.physics.add.collider(mower, scene.planks, (_mower, plank) => {
            if (plank.health > 0) api.damagePlank(scene, plank, plank.health);
            explode(false);
        })
    );
    scene.physics.world.on('worldbounds', explodeAtBounds);
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (!mower.active) return;
        const frozen = scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
        const dt = frozen ? 0 : Math.min(scene.game.loop.delta, 50) / 1000;
        speed = Math.min(EJECT.maxSpeed, speed * Math.pow(EJECT.growthPerSec, dt) + EJECT.pushPerSec * dt);
        if (api.cutNearbyGrass(scene, mower.x, mower.body.bottom - 15, EJECT.cutRange, player) > 0) {
            grassBoostUntil = scene.time.now + EJECT.grassBoostMs;
        }
        const grassBoost = scene.time.now < grassBoostUntil ? EJECT.grassSpeedScale : 1;
        mower.setVelocity(direction * speed * grassBoost, 0);
        const progress = (speed - EJECT.startSpeed) / (EJECT.maxSpeed - EJECT.startSpeed);
        const nextRate = EJECT.minRate + (EJECT.maxRate - EJECT.minRate) * Math.pow(progress, EJECT.rateCurve);
        if (Math.abs(nextRate - rate) >= EJECT.rateStep) {
            rate = nextRate;
            engine.setRate(rate);
        }
    });
    const expire = scene.time.delayedCall(EJECT.lifetimeMs, () => explode(false));
}

function ridePush(api, scene, player, victim) {
    const now = scene.time.now;
    if (now < (player.nextRidePushAt ?? 0) || !victim?.active || api.isInvincible(victim)) return;
    const dx = victim.x - player.x;
    const vx = player.body.velocity.x;
    const drivingInto = Math.sign(vx) === Math.sign(dx) && Math.abs(vx) >= RIDE_PUSH.minSpeed;
    if (!drivingInto || Math.abs(dx) > RIDE_PUSH.reachX || Math.abs(victim.y - player.y) > RIDE_PUSH.reachY) return;
    if (api.isBlockedByWall(player, victim)) return;
    player.nextRidePushAt = now + RIDE_PUSH.cooldownMs;
    victim.flash();
    api.landHit(scene, player, victim, { ...RIDE_PUSH.hit, direction: { x: Math.sign(dx) || 1, y: 0 } });
}

function cordPush(api, scene, player, victim) {
    if (scene.time.now < player.nextAttackTime) return;
    if (!player.canAttack || player.hitstun) return;
    api.pushAttack(scene, player, victim, 'pullcord', CORD_PUSH);
    player.nextAttackTime = scene.time.now + CORD_COOLDOWN_MS;
}

function lawnmowerAttack(api, scene, player, victim) {
    setupMower(scene, player);
    if (player.hitstun || player.freeze) return;
    switch (player.mowerState) {
        case 'ride':
        case 'launch':
            return;
        case 'cord':
        case 'dismounted':
            return cordPush(api, scene, player, victim);
        case 'plow':
            if (!player.isBot && !ALWAYS_ON_GRINDERS) stopPlow(scene, player);
            return;
        default:
            return startPlow(api, scene, player, victim);
    }
}

function lawnmowerMisc(api, scene, player) {
    setupMower(scene, player);
    if (player.hitstun || player.freeze) return;
    if (player.mowerState === 'ride') {
        stopRide(player);
        return;
    }
    if (player.mowerState === 'plow') stopPlow(scene, player);
    if (player.mowerState === 'ready') startRide(scene, player);
}

function lawnmowerDirSpecial(api, scene, player, direction, currentTime, victim) {
    setupMower(scene, player);
    const doubleTap = currentTime - player.lastTap[direction] < MOWER.doubleTapMs || player.isBot;
    player.lastTap[direction] = currentTime;
    if (!doubleTap || player.hitstun || player.freeze) return;
    if (!['ready', 'ride', 'plow'].includes(player.mowerState)) return;
    if (direction === 'up') return tryMowerLaunch(api, scene, player, victim, currentTime);
    if (direction === 'down') return tryCrashRide(api, scene, player, victim, currentTime);
    eject(api, scene, player, victim, direction === 'left' ? -1 : 1);
}

const MOWER_LAUNCH = {
    chargeMs: 500,
    tilt: Math.PI / 4,
    rate: { from: 0.8, to: 2.4 },
    speed: 1500,
    fastMs: 320,
    curveMs: 450,
    curveFallSpeed: 180,
    curveSpeedScale: 0.2,
    hitRange: 100,
    minDot: 0.3,
    hit: {
        damage: 0.18,
        plankDamage: 0,
        hitstun: 500,
        hitFreeze: 120,
        sound: 'slamimpact',
        knockback: { x: 950, y: 950 },
        decelerateAfter: target => 500 * target.KBmultiplier,
        resetCombo: false
    },
    dirtFrequency: { from: 25, to: 250 },
    sparkFrequency: { from: 120, to: 8 },
    sparks: {
        speed: { min: 180, max: 420 },
        gravityY: 500,
        scale: { start: 1.3, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd700, 0xffc400, 0xfff08a],
        lifespan: 380,
        quantity: 2,
        emitting: false
    }
};

function mowerLaunchEmitters(scene, facing) {
    const back = facing > 0 ? { min: 170, max: 250 } : { min: 290, max: 370 };
    const wide = facing > 0 ? { min: 130, max: 290 } : { min: 250, max: 410 };
    const dirt = scene.add.particles(0, 0, '__WHITE', { ...DIRT, angle: back });
    const sparks = scene.add.particles(0, 0, '__WHITE', { ...MOWER_LAUNCH.sparks, angle: wide });
    scene.objs.add(dirt);
    scene.objs.add(sparks);
    return { dirt, sparks };
}

function tryMowerLaunch(api, scene, player, victim, currentTime) {
    if (player.hitstun || player.freeze || player.mowerLaunching) return;
    if (currentTime < player.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    if (player.mowerState === 'ride') stopRide(player, 'ready', { quiet: true });
    if (player.mowerState === 'plow') stopPlow(scene, player);
    const facing = facingOf(player);
    player.lastDir = { x: facing, y: 0 };
    player.mowerState = 'launch';
    player.mowerLaunching = true;
    player.isUsingSideSpecial = true;
    player.canAttack = false;
    showHeldMower(player);
    const engine = scene.sound.add('lawnmower-loop', { volume: MOWER.engineVolume, loop: true, rate: MOWER_LAUNCH.rate.from });
    engine.play();
    const { dirt, sparks } = mowerLaunchEmitters(scene, facing);
    dirt.setFrequency(MOWER_LAUNCH.dirtFrequency.from);
    sparks.setFrequency(MOWER_LAUNCH.sparkFrequency.from, MOWER_LAUNCH.sparks.quantity);
    dirt.start();
    sparks.start();
    const aim = { x: facing * Math.cos(MOWER_LAUNCH.tilt), y: -Math.sin(MOWER_LAUNCH.tilt) };
    const startedAt = scene.time.now;
    let phase = 'charge';
    let dashStartedAt = 0;
    let landed = false;

    const stopEffects = () => {
        engine.stop();
        engine.destroy();
        dirt.stop();
        sparks.stop();
        scene.time.delayedCall(MOWER_LAUNCH.sparks.lifespan, () => {
            dirt.destroy();
            sparks.destroy();
        });
    };
    const finish = () => {
        removeUpdate();
        player.mower.setRotation(0);
        player.mowerLaunching = false;
        player.isUsingSideSpecial = false;
        player.afterimage = false;
        player.canAttack = true;
        player.body.setAllowGravity(true);
    };
    const abortCharge = () => {
        stopEffects();
        player.mowerState = 'ready';
        finish();
    };
    const launch = () => {
        phase = 'dash';
        dashStartedAt = scene.time.now;
        stopEffects();
        const mowerAt = { x: player.mower.x, y: player.mower.y };
        startCord(scene, player, { quiet: true });
        player.mower.setRotation(0);
        api.spawnExplosion(scene, mowerAt, 0.9);
        api.triggerScreenShake(scene, 6, 200);
        scene.sound.play('explosion');
        player.afterimage = true;
        player.body.setAllowGravity(false);
        api.startDashTrail(player, MOWER_LAUNCH.fastMs);
    };
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        if (!player.active || player.hitstun) {
            if (phase === 'charge') abortCharge();
            else finish();
            return;
        }
        if (phase === 'charge') {
            const t = Math.min(1, (now - startedAt) / MOWER_LAUNCH.chargeMs);
            player.mower.setRotation(-facing * MOWER_LAUNCH.tilt * Math.min(1, t * 2));
            player.mower.setOrigin(facing > 0 ? MOWER.heldArm.x : 1 - MOWER.heldArm.x, MOWER.heldArm.y)
                .setPosition(player.x + facing * MOWER.heldOffset.x, player.y + MOWER.heldOffset.y)
                .setFlipX(facing < 0);
            const backX = player.x - facing * 10;
            const backY = player.body.bottom - 10;
            dirt.setPosition(backX, backY);
            sparks.setPosition(backX, backY);
            const lerp = (from, to) => Math.round(from + (to - from) * t);
            dirt.setFrequency(lerp(MOWER_LAUNCH.dirtFrequency.from, MOWER_LAUNCH.dirtFrequency.to));
            sparks.setFrequency(lerp(MOWER_LAUNCH.sparkFrequency.from, MOWER_LAUNCH.sparkFrequency.to), MOWER_LAUNCH.sparks.quantity);
            engine.setRate(MOWER_LAUNCH.rate.from + (MOWER_LAUNCH.rate.to - MOWER_LAUNCH.rate.from) * t);
            player.setVelocity(0, Math.min(player.body.velocity.y, 0));
            if (t >= 1) launch();
            return;
        }
        const elapsed = now - dashStartedAt;
        if (elapsed < MOWER_LAUNCH.fastMs && !landed) {
            player.setVelocity(aim.x * MOWER_LAUNCH.speed, aim.y * MOWER_LAUNCH.speed);
            const bypass = { ignoreCanAttack: true, direction: aim, minDot: MOWER_LAUNCH.minDot };
            const foe = api.getEnemies(scene, player).find(enemy =>
                api.attackIsElligible(player, enemy, MOWER_LAUNCH.hitRange, { ...bypass, silent: true }));
            if (foe && api.strike(scene, player, foe, { special: true, ...MOWER_LAUNCH.hit, range: MOWER_LAUNCH.hitRange, bypass, direction: aim, singleTarget: true })) {
                landed = true;
                dashStartedAt = now - MOWER_LAUNCH.fastMs;
                api.clearQueuedStunTimers(scene, player, foe);
            }
            return;
        }
        const curve = Math.min(1, (elapsed - MOWER_LAUNCH.fastMs) / MOWER_LAUNCH.curveMs);
        const eased = 1 - (1 - curve) * (1 - curve);
        const speedScale = 1 - (1 - MOWER_LAUNCH.curveSpeedScale) * eased;
        const rise = 1 - eased;
        player.setVelocity(
            aim.x * MOWER_LAUNCH.speed * speedScale,
            aim.y * MOWER_LAUNCH.speed * speedScale * rise + MOWER_LAUNCH.curveFallSpeed * curve * curve
        );
        if (curve >= 1) finish();
    });
}

const CRASH_RIDE = {
    fallSpeed: 1100,
    keepX: 0.4,
    reach: { x: 80, below: 110, above: 10 },
    grindRange: 130,
    grindMs: 450,
    tickMs: 50,
    chipDamage: 0.012,
    jitter: 8,
    maxFallMs: 1500,
    bounce: 350,
    sideOffset: 38,
    dropY: 10,
    rebound: { x: 320, y: 380 },
    explosion: { ...PLOW_EXPLOSION, damage: 0.2, force: 500 }
};

function tryCrashRide(api, scene, player, victim, currentTime) {
    if (player.hitstun || player.freeze || player.crashRiding || isGrounded(player)) return;
    if (currentTime < player.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    if (player.mowerState === 'plow') stopPlow(scene, player);
    if (player.mowerState !== 'ride') startRide(scene, player);
    player.crashRiding = true;
    player.noSpeedStretch = true;
    if (player.squash) player.squash.motion = 0;
    player.renderLiftY = 0;
    player.isUsingSideSpecial = true;
    player.afterimage = true;
    scene.sound.play('whoosh');
    const startedAt = scene.time.now;
    let grind = null;

    const finish = () => {
        removeUpdate();
        setGrindFloat(scene, player, false);
        player.body.setAllowGravity(true);
        player.crashRiding = false;
        player.noSpeedStretch = false;
        player.mower.setRotation(0);
        if (player.mowerState === 'ride') player.renderLiftY = MOWER.rideLift;
        player.isUsingSideSpecial = false;
        player.afterimage = false;
    };
    const explodeOn = foe => {
        grindExplosion(api, scene, player, foe, {
            special: true,
            ...CRASH_RIDE.explosion,
            direction: { x: Math.sign(foe.x - player.x) || facingOf(player), y: 0 }
        });
        stopRide(player, 'ready', { quiet: true });
        startCord(scene, player);
        player.setVelocity(player.body.velocity.x, -CRASH_RIDE.bounce);
        finish();
    };
    const findFoeBelow = () => api.getEnemies(scene, player).find(foe => {
        if (!foe.active || api.isInvincible(foe)) return false;
        const dy = foe.y - player.y;
        return Math.abs(foe.x - player.x) <= CRASH_RIDE.reach.x && dy <= CRASH_RIDE.reach.below && dy >= -CRASH_RIDE.reach.above;
    });
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        if (!player.active || player.hitstun || player.mowerState !== 'ride') {
            finish();
            return;
        }
        if (grind) {
            player.setVelocity(0, 0);
            if (now < grind.nextTickAt) return;
            grind.nextTickAt = now + CRASH_RIDE.tickMs;
            const contact = grindTick(api, scene, player, grind.foe, grind.lastContactAt, {
                special: true,
                range: CRASH_RIDE.grindRange,
                chipDamage: CRASH_RIDE.chipDamage,
                hitstun: CRASH_RIDE.tickMs * 3,
                freeze: CRASH_RIDE.tickMs * 2,
                eligibility: { allowTargetBelow: true, ignoreFacing: true }
            });
            if (contact === null) {
                grind = null;
                player.body.setAllowGravity(true);
                setGrindFloat(scene, player, false);
                return;
            }
            grind.lastContactAt = now;
            jitterVictim(grind.foe, CRASH_RIDE.jitter, CRASH_RIDE.tickMs * 2);
            if (now - grind.startedAt >= CRASH_RIDE.grindMs) explodeOn(grind.foe);
            return;
        }
        const foe = findFoeBelow();
        if (foe) {
            grind = { foe, startedAt: now, nextTickAt: now, lastContactAt: 0 };
            player.body.setAllowGravity(false);
            player.setVelocity(0, 0);
            scene.sound.play('slamimpact');
            return;
        }
        if (isGrounded(player)) {
            const facing = facingOf(player);
            api.spawnDirtBurst(scene, player.x - facing * CRASH_RIDE.sideOffset, player.body.bottom, 10, 4, 7, 1.2);
            scene.sound.play('swosh');
            stopRide(player, 'ready', { quiet: true });
            player.setVelocity(-facing * CRASH_RIDE.rebound.x, -CRASH_RIDE.rebound.y);
            finish();
            return;
        }
        if (now - startedAt > CRASH_RIDE.maxFallMs) {
            finish();
            return;
        }
        player.setVelocity(player.body.velocity.x * CRASH_RIDE.keepX, CRASH_RIDE.fallSpeed);
    });
}

function lawnmowerClippings(api, scene, player, victim) {
    setupMower(scene, player);
    const now = scene.time.now;
    if (player.hitstun || player.freeze || player.clippings < 1 || isWithoutMower(player)) return;
    if (now < player.nextClippingsTime) return;
    player.nextClippingsTime = now + CLIPPINGS.cooldownMs;
    player.clippings -= 1;
    scene.sound.play('whoosh');
    const facing = facingOf(player);
    for (let i = 0; i < CLIPPINGS.perSpray; i++) {
        const spread = (i / (CLIPPINGS.perSpray - 1) - 0.5) * 2 * CLIPPINGS.spreadDeg;
        const angle = Phaser.Math.DegToRad(spread + Phaser.Math.Between(-4, 4));
        throwClipping(api, scene, player, victim, Math.cos(angle) * facing, Math.sin(angle));
    }
}

function throwClipping(api, scene, player, victim, dirX, dirY) {
    const clipping = scene.add.rectangle(
        player.x + dirX * 30, player.y + 5, CLIPPINGS.size, CLIPPINGS.size / 2, CLIPPINGS.color
    ).setDepth(player.depth + 1).setRotation(Math.atan2(dirY, dirX));
    scene.physics.add.existing(clipping);
    clipping.body.setAllowGravity(false);
    clipping.body.setVelocity(dirX * CLIPPINGS.speed, dirY * CLIPPINGS.speed);
    scene.objs.add(clipping);

    const remove = () => {
        if (!clipping.active) return;
        colliders.forEach(collider => collider.destroy());
        expire.remove(false);
        clipping.destroy();
    };
    const colliders = [
        scene.physics.add.collider(clipping, api.getMapPlatforms(scene), remove),
        ...api.overlapEnemies(scene, clipping, player, victim => {
            if (api.isInvincible(victim)) return;
            victim.flash();
            api.landHit(scene, player, victim, {
                special: true,
                damage: CLIPPINGS.damage,
                plankDamage: 0,
                shieldCost: 0,
                hitstun: CLIPPINGS.hitstun,
                hitstunGrowth: false,
                sound: 'anyhit',
                resetCombo: false,
                ranged: true,
                onHit: () => {
                    victim.clippedUntil = scene.time.now + CLIPPINGS.slowMs;
                }
            });
            remove();
        })
    ];
    const expire = scene.time.delayedCall(CLIPPINGS.lifetimeMs, remove);
}

function updateMowerDirt(player, facing, active) {
    for (const side of [1, -1]) {
        const emitter = player.mowerDirt[side];
        const on = active && side === facing;
        if (on) {
            emitter.setPosition(player.x + facing * MOWER.backWheel.x, player.y + MOWER.backWheel.y);
            if (!emitter.emitting) emitter.start();
        } else if (emitter.emitting) {
            emitter.stop();
        }
    }
}

function holdClippings(api, scene, player, victim) {
    if (player.isBot || player.blocking || player.ledge) return;
    const input = scene.playerInputs?.[player.slot];
    const heldDirection = input?.special ? (input.up ? 'up' : input.down ? 'down' : null) : null;
    if (heldDirection && heldDirection !== player.mowerHeldSpecialDirection) {
        player.lastTap[heldDirection] = scene.time.now - 1;
        lawnmowerDirSpecial(api, scene, player, heldDirection, scene.time.now, victim);
    }
    player.mowerHeldSpecialDirection = heldDirection;
    if (!input?.special || input.left || input.right || heldDirection) return;
    lawnmowerClippings(api, scene, player, victim);
}

function updateLawnmower(api, scene, player, victim) {
    if (!isMower(player)) return;
    updateResistanceShield(scene, player, 'timeclock');
    setupMower(scene, player);
    player.mowerApi = api;
    holdClippings(api, scene, player, victim);
    const now = scene.time.now;
    const facing = facingOf(player);

    if (player.mowerState === 'cord' && now >= player.mowerCordUntil) player.mowerState = 'ready';
    if (player.mowerState === 'dismounted' && now >= player.mowerRemountAt) player.mowerState = 'ready';
    if (player.mowerState === 'ready' && grinderCanResume(scene, player)) startPlow(api, scene, player, victim);
    holdGrinderInPlace(scene, player, player.mowerState === 'plow' ? player.plowLastContactAt : 0);

    if (player.mowerState === 'ride') {
        if (player.hitstun || player.freeze || !player.active) {
            wreckMower(api, scene, player);
            updateMowerDirt(player, facing, false);
            return;
        }
        const boost = now < player.mowerBoostUntil ? MOWER.boost : 1;
        player.movementSpeed = player.baseMovementSpeed * player.playerSpeedScaling * MOWER.rideSpeed * boost;
        const running = boost > 1 ||
            Math.abs(player.body.velocity.x) > player.baseMovementSpeed * MOWER.rideRunSpeed;
        showRideMower(player, running);
        if (player.crashRiding) {
            player.mower.setOrigin(0.5, 0.5)
                .setRotation(facing * Math.PI / 2)
                .setPosition(player.x - facing * CRASH_RIDE.sideOffset, player.y + CRASH_RIDE.dropY)
                .setDepth(player.depth + 1)
                .setFlipX(facing < 0);
        } else {
            player.mower.setOrigin(0.5, 73 / 75)
                .setRotation(0)
                .setPosition(player.x, player.body.bottom + MOWER.rideMowerDrop)
                .setDepth(player.depth + 1)
                .setFlipX(facing < 0);
        }
        api.cutNearbyGrass(scene, player.x, player.y, MOWER.rideCutRange, player);
        ridePush(api, scene, player, victim);
    } else if (player.mowerState === 'plow' || player.mowerState === 'ready') {
        if (player.mower.texture.key !== 'lawnmower-held' || !player.mower.visible) showHeldMower(player);
        player.mower.setOrigin(facing > 0 ? MOWER.heldArm.x : 1 - MOWER.heldArm.x, MOWER.heldArm.y)
            .setPosition(player.x + facing * MOWER.heldOffset.x, player.y + MOWER.heldOffset.y)
            .setDepth(player.depth + 1)
            .setFlipX(facing < 0);
    }
    updateMowerDirt(player, facing, player.mowerState === 'plow' && !player.ledge && !player.smack && !player.smackedBy);

    updatePullCord(player);
}

function updatePullCord(player) {
    const cordOut = player.mowerState === 'cord' || player.mowerState === 'dismounted';
    if (cordOut) {
        player.idleWeaponTexture = 'pullcord';
        return;
    }
    if (player.idleWeaponTexture !== 'pullcord') return;
    player.idleWeaponTexture = null;
    if (!player.isAttacking) player.atk.setVisible(false);
}


function lawnmowerMeter(scene, player) {
    if (!isMower(player)) return null;
    const now = scene.time.now;
    const clips = `CLIPS ${player.clippings ?? 0}`;
    if (player.mowerState === 'cord') {
        const remaining = Math.max(0, player.mowerCordUntil - now);
        return {
            progress: 1 - remaining / (player.mowerCordMs ?? MOWER.cordMs),
            color: 0x777777,
            text: `PULL CORD ${Math.ceil(remaining / 1000)}s  ${clips}`,
            textColor: '#bbbbbb'
        };
    }
    if (player.mowerState === 'dismounted') {
        const remaining = Math.max(0, player.mowerRemountAt - now);
        return {
            progress: 1 - remaining / MOWER.wreckRemountMs,
            color: 0x777777,
            text: `REMOUNTING  ${clips}`,
            textColor: '#bbbbbb'
        };
    }
    const label = player.mowerState === 'ride' ? 'RIDING' : player.mowerState === 'plow' ? 'PLOWING'
        : player.mowerState === 'launch' ? 'LAUNCHING' : 'MOWER READY';
    return { progress: 1, color: MOWER.meterColor, text: `${label}  ${clips}`, textColor: '#ffffff' };
}

function silenceLawnmower(scene, player) {
    if (!isMower(player) || !player.mower) return;
    player.plowEvent?.remove(false);
    player.plowEvent = null;
    stopEngine(player, { quiet: true });
    player.mowerEndSFX.stop();
    for (const engine of player.ejectEngines ?? []) engine.stop();
    updateMowerDirt(player, facingOf(player), false);
}

function forVariant(lawnmower, landscaper) {
    return (api, scene, attacker, ...rest) => attacker.variant === 'LAWNMOWER'
        ? lawnmower(api, scene, attacker, ...rest)
        : landscaper(api, scene, attacker, ...rest);
}

export default {
    spikeAnimation: () => 'scytheatk',
    variantDemoAnimations: {
        LANDSCAPER: ['scytheatk', 'scytheatktilt'],
        LAWNMOWER: ['pullcord', { prop: 'lawnmower-held', ms: 1400 }]
    },
    variantDemoIdle: { LAWNMOWER: 'pullcord' },
    variantDemoProps: {
        LAWNMOWER: [{
            texture: 'lawnmower-held',
            x: MOWER.heldOffset.x,
            y: MOWER.heldOffset.y,
            originX: MOWER.heldArm.x,
            originY: MOWER.heldArm.y,
            scale: MOWER.scale
        }]
    },
    armColor: 0x1e1e1e,
    hitSounds: {
        light: ['axeslash1', 'axeslash2'],
        finisher: 'scythethirdhitsfx'
    },
    grassCutResistance: GRASS_CUT_RESISTANCE,
    variantStats: { LAWNMOWER: { grassCutResistance: false, armColor: 0x303b00 } },
    rightFacingAttackSprites: ['pullcord'],
    textureAttackSpriteOffsets: { pullcord: { x: 18, y: 20 } },
    toggleAttackVariants: ['LAWNMOWER'],
    miscVariants: ['LAWNMOWER'],
    handleMisc: lawnmowerMisc,
    specialMeter: lawnmowerMeter,
    onMatchEnd: silenceLawnmower,
    handleAttack: forVariant(lawnmowerAttack, (api, scene, attacker, victim) =>
        tryAttack2(api, scene, attacker, victim, 'scytheatk', 'scytheatk')),
    upSpecialVariants: ['LANDSCAPER', 'LAWNMOWER'],
    downSpecialVariants: ['LANDSCAPER', 'LAWNMOWER'],
    handleDirSpecial: forVariant(lawnmowerDirSpecial, (api, scene, attacker, direction, currentTime, victim) => {
        if (direction === 'up') return tryUpReap(api, scene, attacker, victim, currentTime);
        if (direction === 'down') return tryWhirlDrop(api, scene, attacker, currentTime);
        return tryGruelingSlam(api, scene, attacker, victim, direction, currentTime);
    }),
    handleNeutralSpecial: sow,
    variantNeutralSpecials: { LANDSCAPER: sow, LAWNMOWER: lawnmowerClippings },
    update: forVariant(updateLawnmower, (api, scene, player) => updateResistanceShield(scene, player)),
    handleHorizantalTilt: forVariant(lawnmowerAttack, (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600)),
    handleDownTilt: forVariant(lawnmowerAttack, (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300)),
    handleUpTilt: forVariant(lawnmowerAttack, (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300))
};
