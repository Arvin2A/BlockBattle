// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { grindExplosion, grindTick, setGrindFloat, ALWAYS_ON_GRINDERS, interruptGrinder, grinderCanResume, holdGrinderInPlace } from '../combat/grinder.js';

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'scytheatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const SLAM_FINISHER = {
    hitFreeze: 0,
    knockback: { x: 350, y: 700, onDown: 'popUp' }
};
function slamThirdAttack(api, scene, attacker, target, animKey) {
    api.thirdAttack(scene, attacker, target, animKey, SLAM_FINISHER);
}
function tryAttack2(api, scene, attacker, target, animKey, thirdAnimKey) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        slamThirdAttack(api, scene, attacker, target, thirdAnimKey);
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

function isGrounded(player) {
    return player.body.blocked.down || player.body.touching.down;
}

const SLAM = {
    radius: 75,
    sweep: 110 * Math.PI / 180,
    swingMs: 150,
    scale: 2.5,
    range: 150,
    damage: 0.20,
    groundPinMs: 1000,
    airPinMs: 2000,
    crashSpeed: 2200,
    crashTimeoutMs: 1500,
    recoveryMs: 350
};

function placeScythe(scythe, player, angle, facing) {
    scythe.setPosition(
        player.x + Math.sin(angle) * SLAM.radius * facing,
        player.y - Math.cos(angle) * SLAM.radius
    );
    scythe.setRotation(angle * facing);
}

function fadeScythe(scene, scythe) {
    if (!scythe.active) return;
    scene.tweens.add({
        targets: scythe,
        alpha: 0,
        duration: 250,
        onComplete: () => scythe.destroy()
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
        scene.objs.add(scythe);
        placeScythe(scythe, player, 0, facing);
        scene.sound.play('scytheslam');

        const swing = { t: 0 };
        const removeFollow = api.addSceneUpdateListener(scene, () => {
            if (scythe.active) placeScythe(scythe, player, swing.t * SLAM.sweep, facing);
        });
        scene.tweens.add({
            targets: swing,
            t: 1,
            duration: SLAM.swingMs,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                removeFollow();
                placeScythe(scythe, player, SLAM.sweep, facing);
                landGruelingSlam(api, scene, player, target, scythe, facing);
                scene.time.delayedCall(SLAM.recoveryMs, () => {
                    player.canAttack = true;
                    player.isUsingSideSpecial = false;
                });
            }
        });
    }
    player.lastTap[direction] = currentTime;
}

function landGruelingSlam(api, scene, player, target, scythe, facing) {
    const targetGrounded = isGrounded(target);
    const hit = api.strike(scene, player, target, {
        range: SLAM.range,
        bypass: { ignoreCanAttack: true, allowTargetBelow: true },
        damage: SLAM.damage,
        plankDamage: 0.15,
        hitstun: targetGrounded ? SLAM.groundPinMs : SLAM.airPinMs + SLAM.crashTimeoutMs,
        hitstunGrowth: false,
        hitFreeze: 90,
        sound: 'slamimpact',
        noDeathRay: true,
        resetCombo: false,
        knockback: () => ({ x: 0, y: targetGrounded ? 0 : SLAM.crashSpeed }),
        decelerateAfter: 50,
        onHit: () => target.flash(),
        missSound: 'miss'
    });
    if (!hit) {
        fadeScythe(scene, scythe);
        return;
    }
    if (targetGrounded) slamImpact(api, scene, target);
    pinTarget(api, scene, player, target, scythe, facing, targetGrounded);
}

function slamImpact(api, scene, target) {
    api.spawnDirtBurst(scene, target.x, target.body.bottom, 16, 6, 10, 1.5);
    api.triggerScreenShake(scene, 10, 250);
}

function pinTarget(api, scene, player, target, scythe, facing, grounded) {
    const hitAt = target.lastHitAt;
    const crashEndsAt = scene.time.now + SLAM.crashTimeoutMs;
    const pinMs = grounded ? SLAM.groundPinMs : SLAM.airPinMs;
    let pinnedUntil = null;

    const startPin = () => {
        pinnedUntil = scene.time.now + pinMs;
        target.hitstunUntil = pinnedUntil;
        target.setVelocity(0, 0);
        player.nextSideSpecialTime = Math.max(
            player.nextSideSpecialTime,
            pinnedUntil + player.dirSpecialCooldown
        );
        player.sideSpecialCooldownDuration = player.nextSideSpecialTime - scene.time.now;
    };
    if (grounded) startPin();

    const removePin = api.addSceneUpdateListener(scene, () => {
        const now = scene.time.now;
        const freed = !target.active || target.outOfBounds || target.lastHitAt !== hitAt;
        const over = pinnedUntil === null ? now >= crashEndsAt : now >= pinnedUntil;
        if (freed || over) {
            removePin();
            fadeScythe(scene, scythe);
            return;
        }
        if (pinnedUntil === null) {
            if (isGrounded(target)) {
                startPin();
                slamImpact(api, scene, target);
                scene.sound.play('slamimpact');
            } else {
                target.setVelocity(0, SLAM.crashSpeed);
            }
        } else {
            target.hitstunUntil = Math.max(target.hitstunUntil, pinnedUntil);
            target.setVelocityX(0);
        }
        if (scythe.active) scythe.setPosition(target.x - facing * 15, target.y - 20);
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
        scene.physics.add.overlap(fakescythe, target, () => {
            if (player.hasHitSideSpecial) return;
            if (!canhit || api.isInvincible(target)) return;
            if (api.blocksHit(scene, target, player, 0.08, { ranged: true })) {
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

function updateResistanceShield(scene, player) {
    let shield = player.resistanceShield;
    if (!shield?.active) {
        shield = player.resistanceShield = scene.add.image(player.x, player.y, 'resistanceshield')
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
    cordMs: 6000,
    fuelPerCutMs: 250,
    plowTickMs: 50,
    plowExplodeMs: 2000,
    plowCutRange: 45,
    plowGrindRange: 110,
    rideLift: 14,
    rideMowerDrop: 4,
    botPlowIdleMs: 800,
    rideSpeed: 1.6,
    rideCutRange: 50,
    rideRunSpeed: 1.2,
    boost: 1.4,
    boostMs: 400,
    remountMs: 1500,
    looseSpeed: 500,
    looseMs: 600,
    ejectKbScale: 1.5,
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
    rateStep: 0.05
};

const PLOW_EXPLOSION = { damage: 0.25, force: 450, hitstun: 400, hitFreeze: 60, explosionScale: 0.7 };

const CORD_PUSH = {
    range: 125,
    damage: 0.04,
    plankDamage: 0.03,
    knockback: { x: 750, y: 450, growth: false, scaleWithDamage: false },
    noDeathRay: true
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

function facingOf(player) {
    return player.lastDir.x || (player.flipX ? -1 : 1);
}

function setupMower(scene, player) {
    if (player.mower) return;
    player.mower = scene.add.sprite(player.x, player.y, 'lawnmower-held')
        .setScale(MOWER.scale)
        .setDepth(player.depth + 1)
        .setVisible(false);
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
    player.clippings = Math.min(CLIPPINGS.max, player.clippings + CLIPPINGS.perCut);
    if (player.mowerState === 'cord') player.mowerCordUntil -= MOWER.fuelPerCutMs;
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

function startCord(scene, player, { quiet = false } = {}) {
    player.mowerState = 'cord';
    player.mowerCordUntil = scene.time.now + MOWER.cordMs;
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
        callback: () => plowTick(api, scene, player, victim)
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
    const cut = heldCutPoint(player);
    api.cutNearbyGrass(scene, cut.x, cut.y, MOWER.plowCutRange, player);
    const contact = grindTick(api, scene, player, victim, player.plowLastContactAt, {
        range: MOWER.plowGrindRange
    });
    if (contact === null) {
        player.plowLastContactAt = 0;
        if (!ALWAYS_ON_GRINDERS && player.isBot && scene.time.now - player.plowLastHitAt > MOWER.botPlowIdleMs) {
            stopPlow(scene, player);
        }
        return;
    }
    player.plowContactMs += contact;
    player.plowLastContactAt = scene.time.now;
    player.plowLastHitAt = scene.time.now;
    if (player.plowContactMs < MOWER.plowExplodeMs || api.isInvincible(victim)) return;
    grindExplosion(api, scene, player, victim, PLOW_EXPLOSION);
    stopPlow(scene, player);
    startCord(scene, player);
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
    player.mower.stop().setVisible(false);
    stopEngine(player, { quiet });
    player.mowerState = nextState;
}

function knockOffMower(api, scene, player, victim) {
    const direction = Math.sign(player.body.velocity.x) || facingOf(player);
    stopRide(player, 'dismounted');
    player.mowerRemountAt = scene.time.now + MOWER.remountMs;
    spawnLooseMower(api, scene, player, victim, direction);
}

function addMowerBody(scene, player, x, texture) {
    const halfHeight = 75 * MOWER.scale / 2;
    const mower = scene.physics.add.sprite(x, player.body.bottom - halfHeight - 1, texture)
        .setScale(MOWER.scale)
        .setDepth(player.depth + 1);
    mower.body.setSize(MOWER.body.width, MOWER.body.height).setOffset(MOWER.body.offsetX, MOWER.body.offsetY);
    scene.objs.add(mower);
    const landsFromAbove = (_mower, platform) =>
        mower.body.velocity.y >= 0 && mower.body.prev.y + mower.body.height <= platform.body.top + 8;
    const solid = scene.gameState.map.platforms;
    const thin = scene.gameState.map.topPlatforms;
    return { mower, solid, thin, landsFromAbove };
}

function spawnLooseMower(api, scene, player, victim, direction) {
    const { mower, solid, thin, landsFromAbove } = addMowerBody(scene, player, player.x, 'lawnmower-only');
    mower.setFlipX(direction < 0);
    mower.setVelocity(direction * MOWER.looseSpeed, 0);
    let hit = false;
    const colliders = [
        scene.physics.add.collider(mower, solid),
        scene.physics.add.collider(mower, thin, null, landsFromAbove),
        scene.physics.add.overlap(mower, victim, () => {
            if (hit || api.isInvincible(victim)) return;
            hit = true;
            victim.flash();
            api.landHit(scene, player, victim, {
                direction: { x: direction, y: 0 },
                damage: 0.03,
                plankDamage: 0,
                hitstun: 300,
                hitstunGrowth: false,
                sound: 'anyhit',
                ranged: true,
                knockback: { x: 300, y: 200, growth: false, scaleWithDamage: false },
                decelerateAfter: 300,
                resetCombo: false,
                noDeathRay: true
            });
        })
    ];
    scene.tweens.add({
        targets: mower,
        alpha: 0,
        delay: MOWER.looseMs * 0.6,
        duration: MOWER.looseMs * 0.4,
        onComplete: () => {
            colliders.forEach(collider => collider.destroy());
            mower.destroy();
        }
    });
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
    mower.setVelocity(direction * speed, 0);
    const engine = scene.sound.add('lawnmower-loop', { volume: MOWER.engineVolume, loop: true });
    player.ejectEngines ??= new Set();
    player.ejectEngines.add(engine);
    let rate = EJECT.minRate;
    engine.play();
    engine.setRate(rate);

    let exploded = false;
    const colliders = [];
    const explode = directHit => {
        if (exploded || !mower.active) return;
        exploded = true;
        colliders.forEach(collider => collider.destroy());
        mower.off('worldbounds', explodeAtBounds);
        removeUpdate();
        expire.remove(false);
        player.ejectEngines?.delete(engine);
        engine.stop();
        engine.destroy();
        const near = Phaser.Math.Distance.Between(mower.x, mower.y, victim.x, victim.y) <= MOWER.ejectSplashRange;
        if ((directHit || near) && victim.active && !api.isInvincible(victim)) {
            grindExplosion(api, scene, player, victim, {
                ...PLOW_EXPLOSION,
                force: PLOW_EXPLOSION.force * MOWER.ejectKbScale,
                ranged: true,
                explosionScale: 0.9,
                direction: { x: Math.sign(victim.x - mower.x) || direction, y: 0 }
            });
        } else {
            api.spawnExplosion(scene, mower, 0.9);
            scene.sound.play('explosion');
        }
        mower.destroy();
    };
    const explodeAtBounds = () => explode(false);
    const hitsWall = () => {
        const touching = mower.body.touching;
        const blocked = mower.body.blocked;
        if (touching.left || touching.right || blocked.left || blocked.right) explode(false);
    };
    colliders.push(
        scene.physics.add.collider(mower, solid, hitsWall),
        scene.physics.add.overlap(mower, victim, () => explode(true)),
        scene.physics.add.collider(mower, scene.planks, (_mower, plank) => {
            if (plank.health > 0) api.damagePlank(scene, plank, plank.health);
            explode(false);
        })
    );
    mower.on('worldbounds', explodeAtBounds);
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (!mower.active) return;
        const frozen = scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
        const dt = frozen ? 0 : Math.min(scene.game.loop.delta, 50) / 1000;
        speed = Math.min(EJECT.maxSpeed, speed * Math.pow(EJECT.growthPerSec, dt) + EJECT.pushPerSec * dt);
        mower.setVelocity(direction * speed, 0);
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
    eject(api, scene, player, victim, direction === 'left' ? -1 : 1);
}

function lawnmowerClippings(api, scene, player, victim) {
    setupMower(scene, player);
    const now = scene.time.now;
    if (player.hitstun || player.freeze || player.clippings < 1) return;
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
        scene.physics.add.overlap(clipping, victim, () => {
            if (api.isInvincible(victim)) return;
            victim.flash();
            api.landHit(scene, player, victim, {
                damage: CLIPPINGS.damage,
                plankDamage: 0,
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
    const input = scene.playerInputs?.[player.id === 2 ? 'p2' : 'p1'];
    if (!input?.special || input.left || input.right) return;
    lawnmowerClippings(api, scene, player, victim);
}

function updateLawnmower(api, scene, player, victim) {
    if (!isMower(player)) return;
    setupMower(scene, player);
    player.mowerApi = api;
    if (player.body.touching.down || player.body.blocked.down) player.sacrificeJumpUsed = false;
    holdClippings(api, scene, player, victim);
    const now = scene.time.now;
    const facing = facingOf(player);

    if (player.mowerState === 'cord' && now >= player.mowerCordUntil) player.mowerState = 'ready';
    if (player.mowerState === 'dismounted' && now >= player.mowerRemountAt) player.mowerState = 'ready';
    if (player.mowerState === 'ready' && grinderCanResume(scene, player)) startPlow(api, scene, player, victim);
    holdGrinderInPlace(scene, player, player.mowerState === 'plow' ? player.plowLastContactAt : 0);

    if (player.mowerState === 'ride') {
        if (player.hitstun || player.freeze || !player.active) {
            knockOffMower(api, scene, player, victim);
            updateMowerDirt(player, facing, false);
            return;
        }
        const boost = now < player.mowerBoostUntil ? MOWER.boost : 1;
        player.movementSpeed = player.baseMovementSpeed * player.playerSpeedScaling * MOWER.rideSpeed * boost;
        const running = boost > 1 ||
            Math.abs(player.body.velocity.x) > player.baseMovementSpeed * MOWER.rideRunSpeed;
        showRideMower(player, running);
        player.mower.setOrigin(0.5, 73 / 75)
            .setPosition(player.x, player.body.bottom + MOWER.rideMowerDrop)
            .setDepth(player.depth + 1)
            .setFlipX(facing < 0);
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
            progress: 1 - remaining / MOWER.cordMs,
            color: 0x777777,
            text: `PULL CORD ${Math.ceil(remaining / 1000)}s  ${clips}`,
            textColor: '#bbbbbb'
        };
    }
    if (player.mowerState === 'dismounted') {
        const remaining = Math.max(0, player.mowerRemountAt - now);
        return {
            progress: 1 - remaining / MOWER.remountMs,
            color: 0x777777,
            text: `REMOUNTING  ${clips}`,
            textColor: '#bbbbbb'
        };
    }
    const label = player.mowerState === 'ride' ? 'RIDING' : player.mowerState === 'plow' ? 'PLOWING' : 'MOWER READY';
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

const SACRIFICE = {
    jumpSpeed: 400,
    dropSpeed: 250,
    splashRange: 110,
    lifetimeMs: 4000
};

function canSacrificeMower(player) {
    return isMower(player) && player.mower &&
        ['ready', 'plow', 'ride'].includes(player.mowerState) &&
        player.hasDoubleJumped && !player.doubleJumpClipped && !player.sacrificeJumpUsed &&
        !player.body.touching.down && !player.body.blocked.down;
}

function sacrificeJump(scene, player, victim) {
    if (!canSacrificeMower(player)) return false;
    if (player.mowerState === 'ride') stopRide(player, 'ready', { quiet: true });
    if (player.mowerState === 'plow') stopPlow(scene, player);
    startCord(scene, player, { quiet: true });
    player.sacrificeJumpUsed = true;
    player.setVelocityY(-SACRIFICE.jumpSpeed);
    player.doubleJumpEffect?.setAlpha(1);
    scene.tweens.add({ targets: player.doubleJumpEffect, alpha: 0, duration: 200, ease: 'Cubic.easeOut' });
    scene.sound.play('whoosh');
    dropMower(scene, player, victim);
    return true;
}

function dropMower(scene, player, victim) {
    const api = player.mowerApi;
    const { mower, solid, thin, landsFromAbove } = addMowerBody(scene, player, player.x, 'lawnmower-only');
    mower.setFlipX(facingOf(player) < 0);
    mower.setVelocity(player.body.velocity.x * 0.3, SACRIFICE.dropSpeed);
    let exploded = false;
    const colliders = [];
    const explode = () => {
        if (exploded || !mower.active) return;
        exploded = true;
        colliders.forEach(collider => collider.destroy());
        removeUpdate();
        expire.remove(false);
        const near = victim?.active &&
            Phaser.Math.Distance.Between(mower.x, mower.y, victim.x, victim.y) <= SACRIFICE.splashRange;
        if (near && !api.isInvincible(victim)) {
            grindExplosion(api, scene, player, victim, {
                ...PLOW_EXPLOSION,
                ranged: true,
                direction: { x: Math.sign(victim.x - mower.x) || facingOf(player), y: 0 }
            });
        } else {
            api.spawnExplosion(scene, mower, 0.9);
            scene.sound.play('explosion');
        }
        mower.destroy();
    };
    colliders.push(
        scene.physics.add.collider(mower, solid, explode),
        scene.physics.add.collider(mower, thin, explode, landsFromAbove),
        scene.physics.add.collider(mower, scene.planks, (_mower, plank) => {
            if (plank.health > 0) api.damagePlank(scene, plank, plank.health);
            explode();
        })
    );
    if (victim) colliders.push(scene.physics.add.overlap(mower, victim, explode));
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (!mower.active) return;
        const bounds = scene.physics.world.bounds;
        const out = mower.x < bounds.left || mower.x > bounds.right || mower.y > bounds.bottom;
        if (out) explode();
    });
    const expire = scene.time.delayedCall(SACRIFICE.lifetimeMs, explode);
}

function forVariant(lawnmower, landscaper) {
    return (api, scene, attacker, ...rest) => attacker.variant === 'LAWNMOWER'
        ? lawnmower(api, scene, attacker, ...rest)
        : landscaper(api, scene, attacker, ...rest);
}

export default {
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
    tryExtraJump: (scene, player, victim) => sacrificeJump(scene, player, victim),
    canExtraJump: canSacrificeMower,
    handleAttack: forVariant(lawnmowerAttack, (api, scene, attacker, victim) =>
        tryAttack2(api, scene, attacker, victim, 'scytheatk', 'scytheatk')),
    handleDirSpecial: forVariant(lawnmowerDirSpecial, (api, scene, attacker, direction, currentTime, victim) =>
        tryGruelingSlam(api, scene, attacker, victim, direction, currentTime)),
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
