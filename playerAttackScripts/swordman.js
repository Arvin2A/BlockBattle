// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'swordatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};

const SHEATHE = {
    speedScale: 1.25,
    blockDrainScale: 2,
    deflectDamageScale: 1.2,
    pose: { texture: 'sheathe', frame: 15 },
    push: {
        range: 100,
        damage: 0.02,
        plankDamage: 0.01,
        hitstun: 300,
        hitstunGrowth: false,
        hitFreeze: 40,
        sound: 'light',
        knockback: { x: 320, y: 260, growth: false, scaleWithDamage: false },
        decelerateAfter: 400,
        noDeathRay: true
    }
};

const QUICK_DRAW = {
    sound: 'quickdraw',
    hitDelayMs: 70,
    extraWindupMs: 150,
    recoveryScale: 2,
    parryRange: 260,
    slash: {
        range: 175,
        damage: 0.12,
        plankDamage: 0.15,
        hitstun: 675,
        hitFreeze: 160,
        victimShake: 5,
        sound: null,
        knockback: { x: 650, y: 300, yGrowth: false, onDown: 'popUp' },
        decelerateAfter: 1000,
        noDeathRay: true,
        unblockable: true,
        bypass: { ignoreCanAttack: true }
    }
};

function faceSideways(player) {
    const facing = player.lastDir.x || player.sheathFacing || 1;
    player.lastDir = { x: facing, y: 0 };
    player.sheathFacing = facing;
}

function setSheathed(player, sheathed, api = null) {
    player.sheathed = sheathed;
    player.moveSpeedScale = sheathed ? SHEATHE.speedScale : 1;
    player.blockDrainScale = sheathed ? SHEATHE.blockDrainScale : 1;
    player.deflectDamageScale = sheathed ? SHEATHE.deflectDamageScale : 1;
    player.sheathedPose = SHEATHE.pose;
    player.onBlockedHit = sheathed && api
        ? (scene, attacker) => parryDraw(api, scene, player, attacker)
        : null;
}

function parryDraw(api, scene, player, attacker) {
    if (!player.sheathed || player.drawing) return;
    player.lastDir = { x: Math.sign((attacker?.x ?? player.x) - player.x) || player.sheathFacing || 1, y: 0 };
    player.sheathFacing = player.lastDir.x;
    setSheathed(player, false);
    player.combo = 0;
    player.blockPosePlayed = true;
    api.setAttackSprite(player, 'sheatheatk');
    scene.sound.play(QUICK_DRAW.sound);
    scene.time.delayedCall(QUICK_DRAW.hitDelayMs, () => {
        if (!player.active || !api.getEnemies(scene, player).includes(attacker)) return;
        api.strike(scene, player, attacker, {
            ...QUICK_DRAW.slash,
            range: QUICK_DRAW.parryRange,
            singleTarget: true,
            bypass: { ...QUICK_DRAW.slash.bypass, ignoreFacing: true }
        });
    });
}

function sheathe(api, scene, player, victim) {
    if (player.drawing || player.isAttacking || player.hitstun || player.freeze || player.blocking) return;
    if (player.sheathed) {
        quickDraw(api, scene, player, victim);
        return;
    }
    faceSideways(player);
    api.setAttackSprite(player, 'sheathe');
    api.pushAttack(scene, player, victim, null, SHEATHE.push);
    setSheathed(player, true, api);
}

function quickDraw(api, scene, player, victim) {
    if (player.drawing || player.isAttacking || player.hitstun || player.freeze) return;
    if (scene.time.now < (player.nextAttackTime ?? 0)) return;
    faceSideways(player);
    player.drawing = true;
    player.inputLocked = true;
    player.inputLockReleasableAt = Infinity;
    player.releaseInputLock = null;
    player.setVelocityX(0);
    api.setAttackSprite(player, 'sheatheatkwindup');
    const sequence = player.attackSequence;
    let stopWatching = () => {};
    const release = () => {
        stopWatching();
        player.drawing = false;
        player.inputLocked = false;
        setSheathed(player, false);
    };
    const slash = () => {
        if (!player.drawing || player.attackSequence !== sequence) return;
        release();
        player.combo = 0;
        api.setAttackSprite(player, 'sheatheatk');
        scene.sound.play(QUICK_DRAW.sound);
        scene.time.delayedCall(QUICK_DRAW.hitDelayMs, () => {
            if (!player.active || player.hitstun) return;
            api.strike(scene, player, victim, QUICK_DRAW.slash);
        });
        player.nextAttackTime = scene.time.now + api.getAttackCooldown(player) * QUICK_DRAW.recoveryScale;
    };
    const holdWindup = () => scene.time.delayedCall(QUICK_DRAW.extraWindupMs, slash);
    stopWatching = api.addSceneUpdateListener(scene, () => {
        if (!player.drawing) return;
        if (player.hitstun || !player.active) {
            player.atk.off('animationcomplete-sheatheatkwindup', holdWindup);
            player.atk.stop();
            player.isAttacking = false;
            release();
            return;
        }
        player.setVelocityX(0);
    });
    player.atk.once('animationcomplete-sheatheatkwindup', holdWindup);
}

function unlessSheathed(handler) {
    return (api, scene, attacker, victim, ...rest) => attacker.sheathed
        ? quickDraw(api, scene, attacker, victim)
        : handler(api, scene, attacker, victim, ...rest);
}

function updateSheathe(api, scene, player) {
    if (player.lastDir.x) player.sheathFacing = player.lastDir.x;
    if (player.sheathed && player.respawnFalling) setSheathed(player, false);
}

export function NeutralPoke() {
    
}

function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'DAGGER' ? 'daggeratk' : 'swordatk';
    if (animKey == 'daggeratk') {
        tryDaggerAttack(api, scene, attacker, victim, animKey, animKey);
    } else {
        // Second hit of the combo swings back with swordatksecond.
        const comboAnimKey = attacker.combo === 1 ? 'swordatksecond' : animKey;
        api.tryAttack(scene, attacker, victim, comboAnimKey, 'swordatkthird');
    }
}
const DAGGER_JAB = {
    range: 85,
    damage: 0.02,
    hitstun: 350,
    hitstunGrowth: false,
    stun: { target: 350, attacker: 200 },
    knockback: { x: 10, y: 100, growth: false, scaleWithDamage: false, lift: 0, delay: 50 },
    sound: 'light',
    resetCombo: false
};

function daggerattack(api, scene, attacker, target, animKey) {
    // DAGGER's jab: weaker and quicker than the standard one, and the combo runs to 6.
    if (!attacker.canAttack || attacker.hitstun) return;

    api.setAttackSprite(attacker, animKey);
    const hit = api.strike(scene, attacker, target, DAGGER_JAB);
    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    if (attacker.combo >= 6) attacker.combo = 0;

    scene.time.delayedCall(50, () => {
        api.hideAttackSprite(attacker);
    });
    api.queueStunRelease(scene, attacker, target, 0, 350);
    return hit;
}
function tryDaggerAttack(api, scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 5) {
        //three more hits for dagger
        api.thirdAttack(scene, attacker, target, thirdAnimKey);
    } else {
        if (attacker.horizontalMovementActive) {
            api.pushAttack(scene, attacker, target, animKey);
        } else {
            daggerattack(api, scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + api.getAttackCooldown(attacker); // Attack cooldown
}
function lungePush(api, scene, attacker, target, animKey) {
    api.setAttackSprite(attacker, animKey);
    api.strike(scene, attacker, target, {
        range: 155,
        bypass: { ignoreCanAttack: true },
        damage: 0.30,
        hitstun: 300,
        hitFreeze: 50,
        plankDamage: 0,
        sound: 'swordslash1',
        knockback: { x: 250, y: 500 },
        decelerateAfter: 1000,
        //fix for lunge
        onHit: () => { attacker.hasHitSideSpecial = true; }
    });
    api.clearQueuedStunTimers(scene, attacker, target);
    api.recoverAfterAttack(scene, attacker);
}
const QUICKSTEP = {
    vanishMs: 180,
    blinkDistance: 150,
    blinkStep: 10,
    blinkInset: 4,
    dashDistance: 100,
    dashSpeed: 1100,
    hitRange: 110,
    passPad: 10,
    cooldownMs: 600,
    damage: 0.075,
    smoke: [0x1e0f2d, 0x3b2a4d, 0x6d6280]
};

const PLUNGE = {
    stops: 5,
    speed: 900,
    dashMs: 50,
    pauseMs: 60,
    range: 110,
    hit: {
        damage: 0.05,
        plankDamage: 0,
        hitstun: 300,
        hitstunGrowth: false,
        stun: { target: 200, attacker: 0 },
        hitFreeze: 30,
        sound: 'light',
        knockback: { x: 220, y: 60, growth: false, scaleWithDamage: false },
        resetCombo: false,
        noDeathRay: true
    },
    finalHit: {
        damage: 0.10,
        plankDamage: 0,
        hitstun: 400,
        hitFreeze: 70,
        sound: 'swordslash1',
        knockback: { x: 350, y: 400 },
        decelerateAfter: 900
    }
};

function quickstepDirection(scene, player) {
    const input = scene.playerInputs?.[player.slot] ?? {};
    const x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (!x && !y) return { x: player.lastDir.x || player.sheathFacing || 1, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
}

function blocksBlink(scene, rect) {
    const solids = [scene.gameState.map.ground, ...(scene.planks?.getChildren() ?? [])]
        .filter(solid => solid?.active && solid.body?.enable);
    return solids.some(solid => Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(
        solid.body.left, solid.body.top, solid.body.width, solid.body.height)));
}

function blinkTarget(api, scene, player, dir) {
    const body = player.body;
    const offset = { x: body.center.x - player.x, y: body.center.y - player.y };
    let reached = { x: player.x, y: player.y };
    for (let travelled = QUICKSTEP.blinkStep; travelled <= QUICKSTEP.blinkDistance; travelled += QUICKSTEP.blinkStep) {
        const x = player.x + dir.x * travelled;
        const y = player.y + dir.y * travelled;
        const inset = QUICKSTEP.blinkInset;
        const rect = new Phaser.Geom.Rectangle(
            x + offset.x - body.width / 2 + inset, y + offset.y - body.height / 2 + inset,
            body.width - inset * 2, body.height - inset * 2);
        if (blocksBlink(scene, rect)) break;
        reached = { x, y };
    }
    return reached;
}

function puff(api, scene, x, y) {
    api.spawnDirtBurst(scene, x, y, 12, 4, 8, 1.6, QUICKSTEP.smoke, 220, 360);
}

function foePassedThrough(api, scene, player, from, to) {
    const path = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
    const pad = QUICKSTEP.passPad;
    return api.getEnemies(scene, player).find(foe => {
        const body = foe.body;
        if (!foe.active || foe.eliminated || !body?.enable) return false;
        const rect = new Phaser.Geom.Rectangle(body.x - pad, body.y - pad, body.width + pad * 2, body.height + pad * 2);
        return Phaser.Geom.Intersects.LineToRectangle(path, rect);
    }) ?? null;
}

function quickstep(api, scene, player) {
    const now = scene.time.now;
    if (player.hitstun || player.freeze || player.isUsingSideSpecial) return;
    if (now < (player.nextQuickstepTime ?? 0)) return;
    const dir = quickstepDirection(scene, player);
    player.nextQuickstepTime = now + QUICKSTEP.cooldownMs;
    player.isUsingSideSpecial = true;
    player.quickstepping = true;
    player.hasHitSideSpecial = true;
    player.clipThroughPlayers = true;
    player.inputLocked = true;
    player.inputLockReleasableAt = Infinity;
    player.releaseInputLock = null;
    player.invincibleUntil = Math.max(player.invincibleUntil ?? 0, now + QUICKSTEP.vanishMs);
    player.setVelocity(0, 0);
    player.setAlpha(0);
    api.hideAttackSprite(player);
    puff(api, scene, player.x, player.y);
    scene.sound.play('teleport');

    let phase = 'vanished';
    let elapsed = 0;
    let dashVelocity = { x: 0, y: 0 };
    let target = null;
    let stopWatching = () => {};
    const finish = () => {
        stopWatching();
        player.setAlpha(1);
        player.isUsingSideSpecial = false;
        player.quickstepping = false;
        player.clipThroughPlayers = false;
        player.afterimage = false;
        player.inputLocked = false;
        player.setVelocity(dashVelocity.x / 3, dashVelocity.y / 3);
        scene.time.delayedCall(100, () => {
            if (!player.isAttacking || player.atk.texture.key === 'daggeratk') api.hideAttackSprite(player);
        });
    };
    const reappear = () => {
        const origin = { x: player.x, y: player.y };
        const spot = blinkTarget(api, scene, player, dir);
        player.body.reset(spot.x, spot.y);
        player.setAlpha(1);
        puff(api, scene, spot.x, spot.y);
        target = foePassedThrough(api, scene, player, origin, spot);
        if (!target) {
            finish();
            return;
        }
        const aim = { x: target.x - player.x, y: target.y - player.y };
        const length = Math.hypot(aim.x, aim.y) || 1;
        dashVelocity = { x: aim.x / length * QUICKSTEP.dashSpeed, y: aim.y / length * QUICKSTEP.dashSpeed };
        if (Math.abs(aim.x) > 1) player.lastDir = { x: Math.sign(aim.x), y: 0 };
        player.hitstunUntil = 0;
        player.freeze = false;
        player.canAttack = true;
        player.invincibleUntil = Math.max(player.invincibleUntil ?? 0, scene.time.now + QUICKSTEP.dashDistance / QUICKSTEP.dashSpeed * 1000);
        player.afterimage = true;
        player.hasHitSideSpecial = false;
        api.setAttackSprite(player, 'daggeratk');
        player.atk.setAngle(0);
        scene.sound.play('swosh');
        phase = 'dashing';
        elapsed = 0;
    };
    const tryHit = () => {
        if (player.hasHitSideSpecial || !target?.active) return;
        if (Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y) > QUICKSTEP.hitRange) return;
        player.hasHitSideSpecial = true;
        const direction = { x: Math.sign(dashVelocity.x) || player.lastDir.x || 1, y: 0 };
        api.strike(scene, player, target, {
            range: QUICKSTEP.hitRange,
            bypass: { ignoreCanAttack: true, ignoreFacing: true },
            direction,
            damage: QUICKSTEP.damage,
            hitstun: 300,
            hitFreeze: 50,
            plankDamage: 0,
            sound: 'swordslash1',
            knockback: { x: 125, y: 200 },
            decelerateAfter: 1000,
            singleTarget: true
        });
    };
    stopWatching = api.addSceneUpdateListener(scene, () => {
        if (!player.active || (phase === 'dashing' && player.hitstun)) {
            finish();
            return;
        }
        const delta = scene.hitFreezeUntil > scene.time.now ? 0 : scene.game.loop.delta;
        elapsed += delta;
        if (phase === 'vanished') {
            player.setVelocity(0, 0);
            if (elapsed >= QUICKSTEP.vanishMs) reappear();
            return;
        }
        player.setVelocity(dashVelocity.x, dashVelocity.y);
        tryHit();
        if (elapsed >= QUICKSTEP.dashDistance / QUICKSTEP.dashSpeed * 1000) finish();
    });
}

function plungeStop(api, scene, player, victim, dir, stop) {
    const last = stop === PLUNGE.stops - 1;
    player.setVelocity(0, 0);
    api.setAttackSprite(player, 'daggeratk');
    player.atk.setAngle(0);
    const spec = last ? PLUNGE.finalHit : PLUNGE.hit;
    api.strike(scene, player, victim, {
        ...spec,
        range: PLUNGE.range,
        bypass: { ignoreCanAttack: true },
        direction: { x: dir, y: 0 }
    });
}

function wantsDiagonalQuickstep(scene, player) {
    const input = scene.playerInputs?.[player.slot];
    return Boolean(input && (input.special || input.specialPressed) && (input.up || input.down));
}

function tryPlunge(api, scene, player, direction, victim, currentTime) {
    if (wantsDiagonalQuickstep(scene, player)) {
        quickstep(api, scene, player);
        return;
    }
    const dtapDelay = 250;
    if (player.hitstun || player.freeze) return;
    if (direction !== 'left' && direction !== 'right') return;
    const doubleTap = currentTime - player.lastTap[direction] < dtapDelay || player.isBot;
    player.lastTap[direction] = currentTime;
    if (!doubleTap || currentTime < player.nextSideSpecialTime) return;

    const dir = direction === 'left' ? -1 : 1;
    const sequence = (player.plungeSequence ?? 0) + 1;
    player.plungeSequence = sequence;
    player.lastDir = { x: dir, y: 0 };
    player.isUsingSideSpecial = true;
    player.plunging = true;
    player.hasHitSideSpecial = true;
    player.hasDamagedPlanksThisDash = false;
    player.afterimage = true;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    const stillPlunging = () => player.plungeSequence === sequence && player.active && !player.hitstun;
    const finish = () => {
        if (player.plungeSequence !== sequence) return;
        player.isUsingSideSpecial = false;
        player.plunging = false;
        player.afterimage = false;
        api.hideAttackSprite(player);
    };
    const dash = stop => {
        if (!stillPlunging()) {
            finish();
            return;
        }
        player.setVelocity(dir * PLUNGE.speed, 0);
        scene.sound.play('swosh', { volume: 0.6 });
        scene.time.delayedCall(PLUNGE.dashMs, () => {
            if (!stillPlunging()) {
                finish();
                return;
            }
            plungeStop(api, scene, player, victim, dir, stop);
            if (stop === PLUNGE.stops - 1) {
                scene.time.delayedCall(PLUNGE.pauseMs, finish);
                return;
            }
            scene.time.delayedCall(PLUNGE.pauseMs, () => dash(stop + 1));
        });
    };
    dash(0);
}
function tryLunge(api, scene, player, direction, currentTime, animKey = 'swordatk') {
    //LUNGE: exclusive for the swordsman, this is performed by double tapping left or right
    // It launches the player forward in the direction they are lunging in
    //Why do this? Using arrow keys and right shift is harder than using WASD and E, back when swordman and axeman's player was hardcoded.
    //Basically it balances out the controls.
    const dtapDelay = 250;
    const lungecd = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        api.setAttackSprite(player, animKey);
        player.atk.y = player.y + player.lastDir.y * 50 + api.getAttackSpriteOffset(player).y;
        player.isUsingSideSpecial = true;
        player.afterimage = true;
        player.hasHitSideSpecial = false;
        player.hasDamagedPlanksThisDash = false;

        if (player.lastDir.y < 0) {
            player.atk.setAngle(90);
        } else if (player.lastDir.y > 0) {
            player.atk.setAngle(-90);
        } else {
            player.atk.setAngle(0);
        }
        const lspeed = 600;
        if (direction === 'left') {
            player.setVelocityX(-lspeed);
        } else if (direction === 'right') {
            player.setVelocityX(lspeed);
        }

        api.startSideSpecialCooldown(player, currentTime, lungecd);
        scene.sound.play('lunge');

        scene.time.delayedCall(500, () => {
            player.isUsingSideSpecial = false;
            player.afterimage = false;
        });

        scene.time.delayedCall(400, () => {
            api.hideAttackSprite(player);
        });
    }
    player.lastTap[direction] = currentTime;

}

export default {
    variantDemoAnimations: {
        LONGSWORD: ['swordatk', 'swordatksecond', 'swordatkthird', 'swordatktilt', 'sheathe', 'sheatheatk'],
        DAGGER: ['daggeratk', 'swordatktilt']
    },
    variantDemoIdle: { LONGSWORD: 'swordatk' },
    armColor: 0x1e0f2d,
    hitSounds: {
        light: ['swordslash1', 'swordslash2'],
        finisher: 'swordthirdhitsfx',
        // The sword's finisher swing makes its sound even when it whiffs.
        finisherMiss: 'swordthirdhitsfx'
    },
    variantStats: {
        DAGGER: { attackCooldown: 100, armColor: 0x222222 },
        LONGSWORD: {
            block: { stunStartMs: 1100, stunFloorMs: 500, costScale: 1.5, regrowScale: 1.5, counter: true, deflects: true, sound: 'longswordparry', cueTexture: 'longswordblock' }
        }
    },
    // Nudges the attack sprite: x along the facing direction, y down the screen.
    variantAttackSpriteOffsets: { LONGSWORD: { x: 0, y: 8 } },
    rightFacingAttackSprites: ['sheathe', 'sheatheatk'],
    textureAttackSpriteOffsets: {
        sheathe: { x: -37.5, y: 8.8 },
        sheatheatk: { x: -37.5, y: 8.8 }
    },
    textureAttackSpriteScales: { sheathe: 2 / 3, sheatheatk: 2 / 3 },
    update: updateSheathe,
    handleAttack: unlessSheathed((api, scene, attacker, victim) =>
        attack(api, scene, attacker, victim)),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) => {
        if (attacker.variant === 'DAGGER') {
            tryPlunge(api, scene, attacker, direction, victim, currentTime);
            return;
        }
        if (attacker.drawing) return;
        const sequence = attacker.attackSequence;
        tryLunge(api, scene, attacker, direction, currentTime);
        if (attacker.sheathed && attacker.attackSequence !== sequence) setSheathed(attacker, false);
    },
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { LONGSWORD: sheathe, DAGGER: quickstep },
    handleDirSpecialAttack: (api, scene, attacker, victim) => {
        // Dashing through a plank damages it once per dash, near the victim or not.
        const dashPlankDamage = attacker.variant === 'DAGGER' ? 0.15 : 0.30;
        if (!attacker.hasDamagedPlanksThisDash) {
            attacker.hasDamagedPlanksThisDash =
                api.damagePlanksInAttack(attacker, dashPlankDamage * api.getAttackDamageScale(attacker));
        }
        if (api.distanceBetween(attacker, victim) > 150) return;
        if (attacker.variant !== 'DAGGER') lungePush(api, scene, attacker, victim, 'swordatkthird');
    },
    handleHorizantalTilt: unlessSheathed((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600)),
    handleDownTilt: unlessSheathed((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300)),
    handleUpTilt: unlessSheathed((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300))
};