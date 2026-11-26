// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Public attack API. The building blocks live in combat/:
//   blueprints.js    strike()/landHit(), the one hit pipeline every attack uses
//   eligibility.js   attackIsElligible() and its bypassOptions
//   knockback.js     knockback, hitstop and the death ray
//   effects.js       particles, shake, explosions
//   characterStats.js per-character tuning read from playerAttackScripts/
// Character-exclusive moves live in playerAttackScripts/ and get everything
// through the `api` object at the bottom of this file.
import { getEnemies, nearestEnemy, overlapEnemies } from './combat/targets.js';
import { getCharacterScript, getAttackCooldown, getAttackDamageScale, getHeatStat, isSuppressed } from './combat/characterStats.js';
import {
    addSceneUpdateListener,
    spawnDirtBurst,
    spawnCrater,
    spawnExplosion,
    spawnHealFlash,
    spawnHitParticles,
    triggerScreenShake
} from './combat/effects.js';
import {
    applyKnockback,
    stretchHitstun,
    deathRayAttackLocked,
    hitFreeze,
    isInvincible,
    HEAVY_KB_PERCENT,
    VIOLENT_KB_PERCENT,
    ULTRA_KB_PERCENT
} from './combat/knockback.js';
import {
    removeGrass,
    cutNearbyGrass,
    updateScythemanGrass,
    plantGrass,
    hasOwnGrassNear,
    getGrassPlatform
} from './combat/grass.js';
import { damagePlank, damagePlanksInAttack, isBlockedByWall } from './combat/planks.js';
import { attackIsElligible, DEFAULT_BYPASS_OPTIONS } from './combat/eligibility.js';
import { blocksHit, deflects, releaseCounter, trackDeflectable, attackLockedByBlock } from './combat/block.js';
import { startUpTiltArc, UP_TILT_RANGE } from './combat/universalMoves.js';
import { applySkin } from './combat/skins.js';
import {
    hasIdleAttackSprite,
    hideAttackSprite,
    getAttackSpriteOffset,
    getAttackSpriteFlipX,
    getAttackSpriteScale,
    positionAttackSprite,
    getAttackSpriteAngle,
    setAttackSprite
} from './combat/attackSprite.js';
import {
    NET_IMMUNITY_MS,
    strike,
    landHit,
    capHorizontalLaunchY,
    queueStunRelease,
    clearQueuedStunTimers,
    scheduleDecelerate,
    recoverAfterAttack,
    afterWindup,
    playHitSound
} from './combat/blueprints.js';

export {
    spawnDirtBurst,
    spawnExplosion,
    spawnHitParticles,
    triggerScreenShake,
    applyKnockback,
    isInvincible,
    HEAVY_KB_PERCENT,
    VIOLENT_KB_PERCENT,
    ULTRA_KB_PERCENT,
    updateScythemanGrass,
    attackIsElligible,
    DEFAULT_BYPASS_OPTIONS,
    hasIdleAttackSprite,
    getAttackSpriteOffset,
    getAttackSpriteFlipX,
    getAttackSpriteScale,
    positionAttackSprite,
    getAttackSpriteAngle,
    setAttackSprite
};

function startSideSpecialCooldown(player, currentTime, duration) {
    player.hasUsedSideSpecial = true;
    player.sideSpecialCooldownDuration = duration;
    player.nextSideSpecialTime = currentTime + duration;
}

export function getMapPlatforms(scene) {
    return [
        ...scene.gameState.map.platforms.getChildren(),
        ...scene.gameState.map.topPlatforms.getChildren()
    ].filter(platform => platform.active && platform.body?.enable);
}
function platformsWithoutStandingPlatform(scene, player) {
    const platforms = getMapPlatforms(scene);

    return platforms.filter(platform => platform !== player.currentPlatform);
}

function getGroundedPlatform(scene, attacker, platforms = getMapPlatforms(scene)) {
    const playerBody = attacker.body;

    if (!playerBody?.blocked.down && !playerBody?.touching.down) return null;

    return platforms
        .filter(platform =>
            playerBody.right > platform.body.left &&
            playerBody.left < platform.body.right &&
            Math.abs(playerBody.bottom - platform.body.top) <= 4
        )
        .sort((first, second) =>
            Math.abs(playerBody.bottom - first.body.top) -
            Math.abs(playerBody.bottom - second.body.top)
        )[0];
}

function getProjectileBlockingPlatforms(scene, attacker) {
    const platforms = getMapPlatforms(scene);
    const supportingPlatform = getGroundedPlatform(scene, attacker, platforms);

    if (!supportingPlatform) return platforms;
    return platforms.filter(platform =>
        platform.body.top >= supportingPlatform.body.top - 1
    );
}

function addProjectilePlatformColliders(scene, projectile, attacker) {
    const platforms = getMapPlatforms(scene);
    if (!getGroundedPlatform(scene, attacker, platforms)) return () => { };

    const colliders = getProjectileBlockingPlatforms(scene, attacker)
        .map(platform => scene.physics.add.collider(projectile, platform));

    return () => colliders.forEach(collider => collider.destroy());
}

function missCombo(attacker) {
    if (attacker.name === 'SWORDMAN') {
        attacker.combo = (attacker.combo || 0) + 1;
        attacker.comboTimer = 600;
    } else {
        attacker.combo = 0;
    }
}

export const STANDARD_HITS = Object.freeze({
    jab: {
        range: 100,
        damage: 0.03,
        hitstun: 650,
        hitstunGrowth: false,
        stun: { target: 650, attacker: 400 },
        knockback: { x: 100, y: 100, growth: false, scaleWithDamage: false, lift: 0, delay: 50 },
        sound: 'light',
        resetCombo: false
    },
    push: {
        range: 100,
        damage: 0.05,
        plankDamage: 0.03,
        hitstun: 450,
        hitstunGrowth: false,
        hitFreeze: 50,
        sound: 'light',
        knockback: { x: 400, y: 500 },
        decelerateAfter: 600,
        noDeathRay: true
    },
    finisher: {
        range: 100,
        damage: 0.07,
        plankDamage: 0.10,
        hitstun: 500,
        hitFreeze: 100,
        sound: 'finisher',
        knockback: { x: 600, y: 400, onDown: 'popUp' },
        decelerateAfter: 1000
    }
});

export function attack(scene, attacker, target, animKey, overrides = {}) {
    if (!attacker.canAttack || attacker.hitstun) return;

    setAttackSprite(attacker, animKey);
    const hit = strike(scene, attacker, target, { ...STANDARD_HITS.jab, ...overrides });
    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
    } else {
        missCombo(attacker);
        scene.sound.play('miss');
    }
    if (attacker.combo >= 3) attacker.combo = 0;

    attacker.canAttack = false;
    scene.time.delayedCall(150, () => {
        hideAttackSprite(attacker);
    });
    queueStunRelease(scene, attacker, target, getAttackCooldown(attacker), 650);
    return hit;
}

export function pushAttack(scene, attacker, target, animKey, overrides = {}) {
    if (animKey) {
        setAttackSprite(attacker, animKey);
    } else {
        attacker.attackSequence = (attacker.attackSequence ?? 0) + 1;
    }
    const hit = strike(scene, attacker, target, { ...STANDARD_HITS.push, missSound: 'miss', ...overrides });
    if (!hit) missCombo(attacker);
    clearQueuedStunTimers(scene, attacker, target);

    const isDagger = attacker.name === "SWORDMAN" && attacker.variant === "DAGGER";
    recoverAfterAttack(scene, attacker, { recovery: isDagger ? 400 : getAttackCooldown(attacker) });
    return hit;
}

export function thirdAttack(scene, attacker, target, animKey, overrides = {}) {
    setAttackSprite(attacker, animKey);

    const hit = strike(scene, attacker, target, { ...STANDARD_HITS.finisher, ...overrides });
    if (hit) {
        if (attacker.name === 'SWORDMAN') scene.anims.get(animKey)?.resume();
    } else {
        const whiffSound = getCharacterScript(attacker)?.hitSounds?.finisherMiss;
        if (whiffSound) {
            scene.sound.play(whiffSound);
            attacker.combo = 0;
            attacker.comboTimer = 0;
        }
    }
    clearQueuedStunTimers(scene, attacker, target);

    recoverAfterAttack(scene, attacker, { recovery: 400 });
    return hit;
}

function isUpTilt(xMul, yMul) {
    return xMul === 0 && yMul > 0 && yMul < 1;
}

export const SPIKE = {
    windupMs: 300,
    windBackDegrees: -10,
    windBackShare: 1 / 3,
    leanDegrees: 35,
    weaponExtraDegrees: 25,
    launchDegrees: 65,
    launchSpeed: 750,
    range: 170,
    verticalReach: { up: 60, down: 110 },
    poseHoldMs: 150,
    hitstunScale: 2,
    smashMs: 60,
    minDot: 0.05,
    recoveryMs: 400,
    hit: {
        damage: 0.05,
        plankDamage: 0.03,
        hitstun: 600,
        hitstunGrowth: false,
        hitFreeze: 80,
        sound: 'light',
        decelerateAfter: 300,
        missSound: 'miss'
    }
};

export function aimsDown(attacker) {
    return attacker.lastDir.y > 0 || Boolean(attacker.scene?.playerInputs?.[attacker.slot]?.down);
}

function isDownTilt(xMul, yMul) {
    return xMul === 0 && yMul > 1;
}

function spikeLaunch(facing, speed, growth) {
    const angle = Phaser.Math.DegToRad(SPIKE.launchDegrees);
    return ({ target, damageScale }) => {
        const power = growth ? speed * target.KBmultiplier * damageScale : speed;
        const grounded = target.body.blocked.down || target.body.touching.down;
        const y = Math.sin(angle) * power;
        return { x: facing * Math.cos(angle) * power, y: grounded ? -y : y };
    };
}

export function spikeAttack(scene, attacker, target, animKey, options = {}) {
    if (!attacker.canAttack || attacker.hitstun) return false;
    const {
        windupMs = SPIKE.windupMs,
        windupLean = 0,
        launchSpeed = SPIKE.launchSpeed,
        launchGrowth = false,
        recoveryMs = SPIKE.recoveryMs,
        animScale = 1,
        windupSound = null,
        hitstunScale = SPIKE.hitstunScale,
        hit = {}
    } = options;
    const facing = attacker.facingX || Math.sign(attacker.lastDir.x) || 1;
    const aim = { x: facing, y: 0 };
    const lean = degrees => {
        attacker.setAngle(facing * degrees);
        attacker.atkAngleOverride = facing * (degrees + SPIKE.weaponExtraDegrees);
        attacker.atk.setAngle(attacker.atkAngleOverride);
    };
    attacker.aimLock = aim;
    attacker.lastDir = { ...aim };
    attacker.combo = 0;
    attacker.canAttack = false;
    attacker.nextAttackTime = scene.time.now + windupMs + recoveryMs;
    const firstFrame = scene.anims.get(animKey)?.frames[0];
    attacker.atk.stop();
    if (firstFrame) attacker.atk.setTexture(firstFrame.textureKey, firstFrame.textureFrame);
    positionAttackSprite(attacker, animKey);
    attacker.isAttacking = true;
    let spiking = true;
    const swing = () => {
        setAttackSprite(attacker, animKey);
        attacker.atk.anims.timeScale = animScale;
        attacker.atk.setAngle(attacker.atkAngleOverride);
        attacker.atk.once(`animationcomplete-${animKey}`, () => {
            if (!spiking || !attacker.active) return;
            attacker.isAttacking = true;
            attacker.atk.setVisible(true);
            attacker.atk.setAngle(attacker.atkAngleOverride);
        });
    };
    const pose = { degrees: 0 };
    let poseTween = null;
    const tweenLean = (degrees, duration, ease, then = null) => {
        poseTween?.stop();
        poseTween = scene.tweens.add({
            targets: pose,
            degrees,
            duration,
            ease,
            onUpdate: () => attacker.active && lean(pose.degrees),
            onComplete: () => {
                if (!attacker.active) return;
                lean(degrees);
                then?.();
            }
        });
    };
    lean(0);
    if (windupLean) tweenLean(windupLean, windupMs, 'Sine.easeOut');
    else {
        const backMs = windupMs * SPIKE.windBackShare;
        tweenLean(SPIKE.windBackDegrees, backMs, 'Sine.easeOut', () => {
            swing();
            tweenLean(SPIKE.leanDegrees, windupMs - backMs, 'Quad.easeIn');
        });
    }
    if (windupSound) scene.time.delayedCall(Math.max(0, windupMs - 50), () => {
        if (attacker.active && !attacker.hitstun) scene.sound.play(windupSound);
    });
    const resetPose = () => {
        spiking = false;
        poseTween?.stop();
        if (!attacker.active) return;
        if (!attacker.atk.anims.isPlaying) {
            attacker.isAttacking = false;
            hideAttackSprite(attacker);
        }
        attacker.setAngle(0);
        attacker.atkAngleOverride = null;
        attacker.atk.anims.timeScale = 1;
        if (attacker.aimLock === aim) attacker.aimLock = null;
        if (!attacker.activeGrab) attacker.atk.setAngle(getAttackSpriteAngle(attacker));
    };
    afterWindup(scene, attacker, windupMs, () => {
        if (!attacker.active) return;
        if (windupLean) {
            swing();
            tweenLean(SPIKE.leanDegrees, SPIKE.smashMs, 'Quad.easeIn');
        } else {
            poseTween?.stop();
            lean(SPIKE.leanDegrees);
        }
        attacker.canAttack = true;
        const landed = strike(scene, attacker, target, {
            ...SPIKE.hit,
            ...hit,
            range: hit.range ?? SPIKE.range,
            bypass: { verticalReach: SPIKE.verticalReach, minDot: SPIKE.minDot },
            direction: aim,
            knockback: spikeLaunch(facing, launchSpeed, launchGrowth)
        });
        if (!landed) attacker.combo = 0;
        if (landed && hitstunScale !== 1) {
            const now = scene.time.now;
            getEnemies(scene, attacker)
                .filter(foe => foe.lastHitAt === now && foe.hitstunUntil > now)
                .forEach(foe => stretchHitstun(scene, foe, hitstunScale));
        }
        recoverAfterAttack(scene, attacker, { recovery: recoveryMs });
        clearQueuedStunTimers(scene, attacker, target);
        scene.time.delayedCall(SPIKE.poseHoldMs + (windupLean ? SPIKE.smashMs : 0), resetPose);
    }, {
        interruptible: true,
        onInterrupt: () => {
            resetPose();
            attacker.isAttacking = false;
            attacker.canAttack = true;
            hideAttackSprite(attacker);
        }
    });
    return true;
}

export function tiltAttack(scene, attacker, target, {
    animKey,
    kb = 0.1,
    xMul = 1,
    yMul = 0,
    range = 120,
    freeze = 80,
    sfx = 'anyhit',
    kbTime = 200,
    onHit = null,
    onUse = null
}) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;
    if (isDownTilt(xMul, yMul)) {
        onUse?.(scene);
        return spikeAttack(scene, attacker, target, animKey, {
            launchGrowth: false,
            hit: { damage: kb, sound: sfx, hitFreeze: freeze, hitstun: kbTime + 300, decelerateAfter: kbTime, onHit }
        });
    }
    setAttackSprite(attacker, animKey);
    if (onUse) {
        onUse(scene);
    }
    const arcs = isUpTilt(xMul, yMul);
    const hit = strike(scene, attacker, target, {
        range: arcs ? UP_TILT_RANGE : range,
        damage: kb,
        hitstun: kbTime + 300,
        hitstunGrowth: false,
        hitFreeze: freeze,
        sound: sfx,
        onHit: arcs
            ? (hitScene, victim) => {
                onHit?.(hitScene);
                startUpTiltArc(hitScene, attacker, victim);
            }
            : onHit,
        knockback: arcs ? null : {
            x: 1000 * xMul,
            y: 500 * yMul,
            growth: false,
            maxDamageScale: 2
        },
        decelerateAfter: arcs ? null : kbTime,
        missSound: 'miss'
    });
    if (!hit) attacker.combo = 0;

    recoverAfterAttack(scene, attacker, { recovery: 300 });
    attacker.nextAttackTime = scene.time.now + 400;
    return hit;
}

export function tryAttack(scene, attacker, target, animKey, thirdAnimKey) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        thirdAttack(scene, attacker, target, thirdAnimKey);
    } else if (aimsDown(attacker)) {
        spikeAttack(scene, attacker, target, animKey);
    } else {
        if (attacker.horizontalMovementActive) {
            pushAttack(scene, attacker, target, animKey);
        } else {
            attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + getAttackCooldown(attacker);
}

export function downslamAttack(scene, attacker) {
    attacker.isAttacking = false;
    spawnDirtBurst(scene, attacker.x, attacker.y, 16, 6, 10, 1.5);
    scene.sound.play('slamimpact');

    let hit = false;
    for (const target of getEnemies(scene, attacker)) {
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        if (Math.hypot(dx, dy) > 125 || isInvincible(target) || isBlockedByWall(attacker, target)) continue;

        const direction = dx === 0 ? (attacker.lastDir.x || 1) : Math.sign(dx);
        target.flash();
        landHit(scene, attacker, target, {
            damage: 0.10,
            plankDamage: 0,
            hitstun: 500,
            hitstunGrowth: false,
            sound: 'anyhit',
            resetCombo: false,
            knockback: ({ kb }) => ({ x: 100 * kb * direction, y: -500 * kb }),
            decelerateAfter: victim => 200 * victim.KBmultiplier
        });
        hit = true;
    }
    getCharacterScript(attacker)?.onDownslam?.(sharedAttackHelpers, scene, attacker);
    return hit;
}

const DASH_TRAIL = { everyMs: 15, lingerMs: 150 };

function startDashTrail(player, ms) {
    player.dashTrail = { until: player.scene.time.now + ms + DASH_TRAIL.lingerMs, everyMs: DASH_TRAIL.everyMs };
}

const sharedAttackHelpers = {
    startDashTrail,
    NET_IMMUNITY_MS,
    strike,
    blocksHit,
    deflects,
    releaseCounter,
    trackDeflectable,
    landHit,
    capHorizontalLaunchY,
    STANDARD_HITS,
    recoverAfterAttack,
    afterWindup,
    scheduleDecelerate,
    clearQueuedStunTimers,
    queueStunRelease,
    playHitSound,
    attack,
    pushAttack,
    thirdAttack,
    tiltAttack,
    aimsDown,
    spikeAttack,
    stretchHitstun,
    tryAttack,
    damagePlanksInAttack,
    addSceneUpdateListener,
    addProjectilePlatformColliders,
    getMapPlatforms,
    platformsWithoutStandingPlatform,
    getAttackSpriteOffset,
    applyKnockback,
    getAttackDamageScale,
    getHeatStat,
    getAttackCooldown,
    getProjectileBlockingPlatforms,
    attackIsElligible,
    isBlockedByWall,
    isInvincible,
    setAttackSprite,
    positionAttackSprite,
    hideAttackSprite,
    hitFreeze,
    startSideSpecialCooldown,
    spawnDirtBurst,
    spawnCrater,
    spawnExplosion,
    spawnHealFlash,
    damagePlank,
    removeGrass,
    cutNearbyGrass,
    plantGrass,
    hasOwnGrassNear,
    getGrassPlatform,
    triggerScreenShake,
    getEnemies,
    applySkin,
    nearestEnemy,
    overlapEnemies,
    distanceBetween: (first, second) => Phaser.Math.Distance.Between(
        first.x, first.y, second.x, second.y
    )
};

function attackLocked(scene, attacker) {
    return scene.time.now < (attacker.attackLockedUntil ?? 0) || isSuppressed(attacker);
}

export function handleAttack(scene, attacker, victim) {
    if (deathRayAttackLocked(scene) || attackLockedByBlock(scene, attacker) || attackLocked(scene, attacker)) return;
    return getCharacterScript(attacker)?.handleAttack(sharedAttackHelpers, scene, attacker, victim);
}

export function updateChainsawWood(scene, attacker, victim) {
    return getCharacterScript(attacker)?.updateChainsawWood?.(scene, attacker, victim);
}

export function tryExtraJump(scene, player, victim) {
    return getCharacterScript(player)?.tryExtraJump?.(scene, player, victim) ?? false;
}

export function canExtraJump(player) {
    return getCharacterScript(player)?.canExtraJump?.(player) ?? false;
}

export function handleMatchEnd(scene, player) {
    return getCharacterScript(player)?.onMatchEnd?.(scene, player);
}

export function updateCharacter(scene, player, victim) {
    return getCharacterScript(player)?.update?.(sharedAttackHelpers, scene, player, victim);
}

export function toggleChainsawMode(scene, attacker) {
    return getCharacterScript(attacker)?.toggleChainsawMode?.(scene, attacker);
}

export function usesToggleAttack(attacker) {
    return getCharacterScript(attacker)?.toggleAttackVariants?.includes(attacker.variant) ?? false;
}

export function getSpecialMeter(scene, player) {
    return getCharacterScript(player)?.specialMeter?.(scene, player) ?? null;
}

export function hasMiscButton(name, variant) {
    return getCharacterScript({ name: name.toUpperCase() })?.miscVariants?.includes(variant) ?? false;
}

export function handleMisc(scene, attacker, victim) {
    return getCharacterScript(attacker)?.handleMisc?.(sharedAttackHelpers, scene, attacker, victim);
}

export function tryQuickslamJump(scene, attacker, currentTime) {
    return getCharacterScript(attacker)?.tryQuickslamJump?.(
        sharedAttackHelpers, scene, attacker, currentTime
    ) ?? false;
}

function specialLockedBySmack(scene, attacker) {
    return scene.time.now < (attacker.smackEndlagUntil ?? 0) || isSuppressed(attacker);
}

export function handleDirSpecial(scene, attacker, direction, currentTime, victim, force = false) {
    if (specialLockedBySmack(scene, attacker)) return;
    const characterScript = getCharacterScript(attacker);
    if (force) attacker.lastTap[direction] = currentTime - 1;
    return characterScript?.handleDirSpecial(
        sharedAttackHelpers, scene, attacker, direction, currentTime, victim
    );
}

export function hasUpSpecial(attacker) {
    return Boolean(getCharacterScript(attacker)?.upSpecialVariants?.includes(attacker.variant));
}

export function hasDownSpecial(attacker) {
    return Boolean(getCharacterScript(attacker)?.downSpecialVariants?.includes(attacker.variant));
}

export function handleNeutralSpecial(scene, attacker, victim) {
    if (specialLockedBySmack(scene, attacker)) return;
    const characterScript = getCharacterScript(attacker);
    const variantHandler = characterScript?.variantNeutralSpecials?.[attacker.variant];
    const handler = variantHandler ?? characterScript?.handleNeutralSpecial;
    return handler?.(sharedAttackHelpers, scene, attacker, victim);
}

export function handleDirSpecialAttack(scene, attacker, victim) {
    return getCharacterScript(attacker)?.handleDirSpecialAttack?.(
        sharedAttackHelpers, scene, attacker, victim
    );
}

export function handleHorizantalTilt(scene, attacker, victim, direction) {
    if (deathRayAttackLocked(scene) || attackLockedByBlock(scene, attacker) || attackLocked(scene, attacker)) return;
    return getCharacterScript(attacker)?.handleHorizantalTilt(
        sharedAttackHelpers, scene, attacker, victim, direction
    );
}

export function handleDownTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene) || attackLockedByBlock(scene, attacker) || attackLocked(scene, attacker)) return;
    return getCharacterScript(attacker)?.handleDownTilt(sharedAttackHelpers, scene, attacker, victim);
}

export function handleUpTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene) || attackLockedByBlock(scene, attacker) || attackLocked(scene, attacker)) return;
    return getCharacterScript(attacker)?.handleUpTilt(sharedAttackHelpers, scene, attacker, victim);
}
