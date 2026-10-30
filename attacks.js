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
import { getCharacterScript, getAttackCooldown, getAttackDamageScale } from './combat/characterStats.js';
import {
    addSceneUpdateListener,
    spawnDirtBurst,
    spawnCrater,
    spawnExplosion,
    spawnHitParticles,
    triggerScreenShake
} from './combat/effects.js';
import {
    applyKnockback,
    deathRayAttackLocked,
    hitFreeze,
    isInvincible,
    HEAVY_KB_PERCENT,
    VIOLENT_KB_PERCENT,
    ULTRA_KB_PERCENT
} from './combat/knockback.js';
import { removeGrass, cutNearbyGrass, updateScythemanGrass } from './combat/grass.js';
import { damagePlank, damagePlanksInAttack, isBlockedByWall } from './combat/planks.js';
import { attackIsElligible, DEFAULT_BYPASS_OPTIONS } from './combat/eligibility.js';
import {
    hasIdleAttackSprite,
    hideAttackSprite,
    getAttackSpriteOffset,
    getAttackSpriteFlipX,
    positionAttackSprite,
    getAttackSpriteAngle,
    setAttackSprite
} from './combat/attackSprite.js';
import {
    strike,
    landHit,
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
    positionAttackSprite,
    getAttackSpriteAngle,
    setAttackSprite
};

function startSideSpecialCooldown(player, currentTime, duration) {
    player.hasUsedSideSpecial = true;
    player.sideSpecialCooldownDuration = duration;
    player.nextSideSpecialTime = currentTime + duration;
}

function getMapPlatforms(scene) {
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
        knockback: { x: 400, y: 500, spike: { x: 325, y: -200 } },
        decelerateAfter: 600
    },
    finisher: {
        range: 100,
        damage: 0.07,
        plankDamage: 0.10,
        hitstun: 500,
        hitFreeze: 100,
        sound: 'finisher',
        knockback: { x: 500, y: 500, onDown: 'popUp' },
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
    setAttackSprite(attacker, animKey);
    if (onUse) {
        onUse(scene);
    }
    const hit = strike(scene, attacker, target, {
        range,
        damage: kb,
        hitstun: kbTime + 300,
        hitstunGrowth: false,
        hitFreeze: freeze,
        sound: sfx,
        onHit,
        knockback: {
            x: 1000 * xMul,
            y: 500 * yMul,
            growth: false,
            maxDamageScale: 2,
            spike: { x: 325, y: -100 }
        },
        decelerateAfter: kbTime,
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
    } else {
        if (attacker.horizontalMovementActive) {
            pushAttack(scene, attacker, target, animKey);
        } else {
            attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + getAttackCooldown(attacker);
}

export function downslamAttack(scene, attacker, target) {
    attacker.isAttacking = false;
    spawnDirtBurst(scene, attacker.x, attacker.y, 16, 6, 10, 1.5);
    scene.sound.play('slamimpact');

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    if (Math.hypot(dx, dy) > 125 || isInvincible(target) || isBlockedByWall(attacker, target)) return false;

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
    return true;
}

const sharedAttackHelpers = {
    strike,
    landHit,
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
    tryAttack,
    damagePlanksInAttack,
    addSceneUpdateListener,
    addProjectilePlatformColliders,
    getMapPlatforms,
    platformsWithoutStandingPlatform,
    getAttackSpriteOffset,
    applyKnockback,
    getAttackDamageScale,
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
    damagePlank,
    removeGrass,
    cutNearbyGrass,
    distanceBetween: (first, second) => Phaser.Math.Distance.Between(
        first.x, first.y, second.x, second.y
    )
};

export function handleAttack(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleAttack(sharedAttackHelpers, scene, attacker, victim);
}

export function updateChainsawWood(scene, attacker, victim) {
    return getCharacterScript(attacker)?.updateChainsawWood?.(scene, attacker, victim);
}

export function updateCharacter(scene, player, victim) {
    return getCharacterScript(player)?.update?.(sharedAttackHelpers, scene, player, victim);
}

export function toggleChainsawMode(scene, attacker) {
    return getCharacterScript(attacker)?.toggleChainsawMode?.(scene, attacker);
}

export function tryQuickslamJump(scene, attacker, currentTime) {
    return getCharacterScript(attacker)?.tryQuickslamJump?.(
        sharedAttackHelpers, scene, attacker, currentTime
    ) ?? false;
}

export function handleDirSpecial(scene, attacker, direction, currentTime, victim, force = false) {
    const characterScript = getCharacterScript(attacker);
    if (force) attacker.lastTap[direction] = currentTime - 1;
    return characterScript?.handleDirSpecial(
        sharedAttackHelpers, scene, attacker, direction, currentTime, victim
    );
}

export function handleNeutralSpecial(scene, attacker, victim) {
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
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleHorizantalTilt(
        sharedAttackHelpers, scene, attacker, victim, direction
    );
}

export function handleDownTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleDownTilt(sharedAttackHelpers, scene, attacker, victim);
}

export function handleUpTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleUpTilt(sharedAttackHelpers, scene, attacker, victim);
}
