// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'slateatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const BRACE = { healTick: 0.1, tickMs: 1000, minMs: 1000, healFlashMs: 200, healSound: 'slateheal', minKB: 1, tint: 0x8f949c, sound: 'rockbreak', hitDamageScale: 1 / 1.5 };
const ROCKFALL = {
    speed: 1100,
    invincibleWindowMs: 60,
    range: 60,
    shake: 6,
    sound: 'sledgewhoosh',
    hit: {
        damage: 0.04,
        plankDamage: 0,
        hitstun: 300,
        hitstunGrowth: false,
        sound: 'slatepunch',
        knockback: { x: 250, y: 350, growth: false, scaleWithDamage: false },
        resetCombo: false,
        noDeathRay: true
    }
};

function isGrounded(player) {
    return player.body.blocked.down || player.body.touching.down;
}

function inHitstun(scene, player) {
    return scene.time.now < (player.hitstunUntil ?? 0);
}

function setStone(player, stone) {
    if (stone) {
        player.setTint(BRACE.tint);
        player.atk?.setTint(BRACE.tint);
        return;
    }
    if (player.heatTinted) return;
    player.clearTint();
    player.atk?.clearTint();
}

function startBrace(scene, player) {
    player.bracing = true;
    player.inputLocked = true;
    player.inputLockReleasableAt = scene.time.now + BRACE.minMs;
    player.releaseInputLock = () => stopBrace(player);
    player.braceKB = player.KBmultiplier;
    player.nextBraceHealAt = scene.time.now + BRACE.tickMs;
    player.setVelocityX(0);
    setStone(player, true);
    scene.sound.play(BRACE.sound);
}

function keepRockfallInvincible(scene, player) {
    player.invincibleUntil = Math.max(player.invincibleUntil ?? 0, scene.time.now + ROCKFALL.invincibleWindowMs);
}

function startRockfall(scene, player) {
    player.rockfalling = true;
    player.inputLocked = true;
    player.inputLockReleasableAt = Infinity;
    player.releaseInputLock = null;
    player.rockfallHits = new Set();
    keepRockfallInvincible(scene, player);
    player.setVelocity(0, ROCKFALL.speed);
    setStone(player, true);
    scene.sound.play(ROCKFALL.sound);
}

function stopBrace(player) {
    if (!player.bracing && !player.rockfalling) return;
    player.bracing = false;
    player.rockfalling = false;
    player.inputLocked = false;
    player.inputLockReleasableAt = Infinity;
    player.releaseInputLock = null;
    setStone(player, false);
}

function brace(api, scene, player) {
    if (player.rockfalling) {
        stopBrace(player);
        return;
    }
    if (player.bracing) {
        if (scene.time.now >= player.inputLockReleasableAt) stopBrace(player);
        return;
    }
    if (player.hitstun || player.freeze || player.isAttacking) return;
    if (isGrounded(player)) startBrace(scene, player);
    else startRockfall(scene, player);
}

function updateRockfall(api, scene, player) {
    if (inHitstun(scene, player) || !player.active || player.respawnFalling) {
        stopBrace(player);
        return;
    }
    keepRockfallInvincible(scene, player);
    for (const enemy of api.getEnemies(scene, player)) {
        if (player.rockfallHits.has(enemy) || api.isInvincible(enemy)) continue;
        const below = api.attackIsElligible(player, enemy, ROCKFALL.range, {
            ignoreCanAttack: true,
            silent: true,
            direction: { x: 0, y: 1 },
            minDot: 0.5
        });
        if (!below) continue;
        player.rockfallHits.add(enemy);
        api.landHit(scene, player, enemy, { ...ROCKFALL.hit, direction: { x: Math.sign(enemy.x - player.x) || 1, y: 0 } });
    }
    if (isGrounded(player)) {
        player.rockfalling = false;
        api.spawnDirtBurst(scene, player.x, player.body.bottom, 14);
        api.triggerScreenShake(scene, ROCKFALL.shake, 200);
        startBrace(scene, player);
        return;
    }
    player.setVelocity(0, Math.max(player.body.velocity.y, ROCKFALL.speed));
}

function updateBrace(api, scene, player) {
    if (player.rockfalling) {
        updateRockfall(api, scene, player);
        return;
    }
    if (!player.bracing) return;
    if (inHitstun(scene, player)) {
        const taken = player.KBmultiplier - player.braceKB;
        if (taken > 0) player.KBmultiplier -= taken * (1 - BRACE.hitDamageScale);
        stopBrace(player);
        return;
    }
    if (!player.active || player.respawnFalling || !isGrounded(player)) {
        stopBrace(player);
        return;
    }
    player.setVelocityX(0);
    if (scene.time.now >= player.nextBraceHealAt) {
        player.nextBraceHealAt += BRACE.tickMs;
        if (player.KBmultiplier > BRACE.minKB) {
            player.KBmultiplier = Math.max(BRACE.minKB, player.KBmultiplier - BRACE.healTick);
            api.spawnHealFlash(scene, player, BRACE.healFlashMs);
            scene.sound.play(BRACE.healSound);
        }
    }
    player.braceKB = player.KBmultiplier;
}

const PLUNGE_FRAMES = { bladeOut: 15, bladeIn: 33 };
const PLUNGE_BLADE_SPEED_BOOST = 1.5;
const PLUNGE_ARM_OFFSET = 38;
const PLUNGE_DRAW_HIT = {
    range: 150,
    damage: 0.035,
    hitstun: 900,
    hitstunGrowth: false,
    hitFreeze: 80,
    sound: 'swosh',
    knockback: { x: 600, y: 500, growth: false, maxDamageScale: 2 },
    decelerateAfter: 600
};
const PLUNGE_BLADE_HIT = {
    range: 150,
    damage: 0.075,
    plankDamage: 0.08,
    hitstun: 450,
    hitFreeze: 50,
    sound: 'plunge',
    knockback: { x: 300, y: 500 },
    decelerateAfter: 600
};

function plungeHit(api, scene, attacker, target, dirX, spec) {
    const bypass = { ignoreCanAttack: true, direction: { x: dirX, y: 0 } };
    if (!api.attackIsElligible(attacker, target, spec.range, { ...bypass, silent: true })) return false;
    return api.strike(scene, attacker, target, { ...spec, bypass, direction: bypass.direction });
}

function markPlunged(scene, target) {
    target.plunged = true;
    target.plungeEvent?.remove(false);
    target.plungeEvent = scene.time.delayedCall(2500, () => {
        target.plunged = false;
        target.plungeEvent = null;
    });
}

function updatePlungeMovement(api, scene, player) {
    if (!player.isPlunging || player.hitstun || player.freeze || !player.horizontalMovementActive) return;
    const boost = player.plungeBladeOut ? PLUNGE_BLADE_SPEED_BOOST : 1;
    player.movementSpeed = player.baseMovementSpeed * (1 + player.playerSpeedScaling) * boost *
        api.getHeatStat(player, 'speedScale') * api.getHeatStat(player, 'slideScale');
}

function tryPlunge(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = player.dirSpecialCooldown;

    if (player.isPlunging || player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (
        currentTime - player.lastTap[direction] >= dtapDelay &&
        !player.isBot
    ) {
        player.lastTap[direction] = currentTime;
        return;
    }

    api.startSideSpecialCooldown(player, currentTime, pullCD);
    player.attackBypassesHitstun = false;
    player.isAttacking = true;
    player.attackSequence = (player.attackSequence ?? 0) + 1;

    const dirX = direction === 'left' ? -1 : 1;
    const arm = scene.physics.add.sprite(player.x + dirX * PLUNGE_ARM_OFFSET, player.y, 'slateplunge');
    arm.body.setAllowGravity(false);
    arm.setFrame(0);
    arm.setFlipX(dirX < 0);
    if (player.heated) arm.setTint(player.tintTopLeft);
    scene.objs.add(arm);

    player.atk.stop();
    player.atk.setVisible(false);

    const hits = { drawOut: false, blade: false, drawIn: false };
    let missPlayed = false;

    const plungeUpdate = () => {
        if (!arm.active || !arm.anims) {
            finishPlunge();
            return;
        }
        arm.setPosition(player.x + dirX * PLUNGE_ARM_OFFSET, player.y);
        player.atk.setVisible(false);
        const frame = arm.anims.currentFrame?.index - 1;
        if (!(frame >= 0)) return;

        player.plungeBladeOut = frame >= PLUNGE_FRAMES.bladeOut && frame < PLUNGE_FRAMES.bladeIn;

        if (frame < PLUNGE_FRAMES.bladeOut) {
            if (!hits.drawOut) hits.drawOut = plungeHit(api, scene, player, target, dirX, PLUNGE_DRAW_HIT);
        } else if (player.plungeBladeOut) {
            if (!hits.blade && plungeHit(api, scene, player, target, dirX, PLUNGE_BLADE_HIT)) {
                hits.blade = true;
                markPlunged(scene, target);
                api.clearQueuedStunTimers(scene, player, target);
            }
        } else {
            if (!hits.blade && !missPlayed) {
                missPlayed = true;
                player.combo = 0;
                scene.sound.play('miss');
            }
            if (!hits.blade && !hits.drawIn) hits.drawIn = plungeHit(api, scene, player, target, dirX, PLUNGE_DRAW_HIT);
        }
    };

    const removePlungeUpdate = api.addSceneUpdateListener(scene, plungeUpdate);

    arm.play('slateplunge');
    player.afterimage = true;
    player.isPlunging = true;
    player.plungeBladeOut = false;

    let finished = false;
    const finishPlunge = () => {
        if (finished) return;
        finished = true;
        removePlungeUpdate();
        player.afterimage = false;
        player.isPlunging = false;
        player.plungeBladeOut = false;
        player.isAttacking = false;
        player.attackBypassesHitstun = false;
        api.hideAttackSprite(player);
        if (arm.active) arm.destroy();
    };
    arm.once('animationcomplete-slateplunge', finishPlunge);

    player.lastTap[direction] = currentTime;
}

const unlessPlunging = handler => (api, scene, attacker, ...args) => {
    if (attacker.isPlunging) return;
    return handler(api, scene, attacker, ...args);
};

export default {
    demoAnimations: ['slateatk', 'slateatksecond', 'slateatkthird', 'slateatktilt'],
    demoIdle: 'slateatk1',
    armColor: 0x2c2d31,
    heat: { damageScale: 1.3, slideScale: 1.3, speedScale: 1.5, resistanceScale: 0.75, rangeBonus: 10, tint: 0xff9c8a },
    hitSounds: {
        light: ['slatelight1', 'slatelight2'],
        finisher: 'slatepunch'
    },
    // His arms are drawn facing right.
    rightFacingAttackSprites: ['slateatk1'],
    textureAttackSpriteOffsets: {
        slateatk1: { x: 5, y: -10, up: { x: 28, y: 15 }, down: { x: -28, y: 15 } }
    },
    // Second hit of the combo punches with the other arm, like SWORDMAN's back swing.
    handleAttack: unlessPlunging((api, scene, attacker, victim) =>
        api.tryAttack(scene, attacker, victim,
            attacker.combo === 1 ? 'slateatksecond' : 'slateatk', 'slateatkthird')),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPlunge(api, scene, attacker, victim, direction, currentTime),
    update: (api, scene, player) => {
        updatePlungeMovement(api, scene, player);
        updateBrace(api, scene, player);
    },
    onMatchEnd: (scene, player) => stopBrace(player),
    handleNeutralSpecial: unlessPlunging(brace),
    variantNeutralSpecials: { METAMORPHIC: unlessPlunging(brace) },
    handleHorizantalTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600)),
    handleDownTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300)),
    handleUpTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300))
};