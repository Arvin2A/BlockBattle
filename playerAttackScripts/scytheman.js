// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

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
    airPinMs: 3000,
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
            if (!canhit) return;
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
export default {
    hitSounds: {
        light: ['axeslash1', 'axeslash2'],
        finisher: 'scythethirdhitsfx'
    },
    grassCutResistance: GRASS_CUT_RESISTANCE,
    handleAttack: (api, scene, attacker, victim) =>
        tryAttack2(api, scene, attacker, victim, 'scytheatk', 'scytheatk'),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryGruelingSlam(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: sow,
    variantNeutralSpecials: { LANDSCAPER: sow },
    update: (api, scene, player) => updateResistanceShield(scene, player),
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};