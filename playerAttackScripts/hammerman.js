// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { SIDE_SPECIAL_POWER } from '../gameSettings.js';

function attackAnim(attacker) {
    return attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammeratk' : 'hammeratk';
}

function attack(api, scene, attacker, victim) {
    const animKey = attackAnim(attacker);
    tryAttack3(api, scene, attacker, victim, animKey, animKey);
}

// No tilt sheet yet, so tilts reuse the swing sprite; the swosh is what gives them away.
// SLEDGEHAMMER has no tilts: tilting just does his normal swing.
function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    if (attacker.variant === 'SLEDGEHAMMER') return attack(api, scene, attacker, victim);
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'hammeratk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
function destroyPlank(api, scene, plank) {
    if (!plank.active) return;
    plank.expireEvent?.remove(false);
    scene.planks.remove(plank, false, false);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );
    plank.destroy();
    scene.sound.play('plankbreak');
}


function steelPlank(
    api,
    scene,
    attacker,
    { allowChainsawMode = false } = {}
) {
    if (attacker.hitstun || attacker.freeze) return;

    

    if (!attacker.steelPlanks) {
        attacker.steelPlanks = [];
    }

    attacker.steelPlanks = attacker.steelPlanks.filter(p => p.active);

    const maxPlanks = attacker.variant === 'SLEDGEHAMMER' ? 1 : 2;

    if (attacker.steelPlanks.length >= maxPlanks) return;

    const offset = 60; // Horizontal distance from attacker
    const x = attacker.x + (attacker.lastDir.x >= 0 ? offset : -offset);
    const y = attacker.y - 75;

    const rotated = true;

    const createAnimation = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammerquickslam1' : 'hammeratk';
    api.setAttackSprite(attacker, createAnimation);

    const plankTexture = attacker.variant === 'SLEDGEHAMMER'
        ? 'strongsteel'
        : 'lightsteel';

    const plank = scene.physics.add.image(x, y, plankTexture);
    api.applySkin(plank, attacker.skin);

    const plankSound = attacker.variant === 'SLEDGEHAMMER'
        ? 'thicksteelplank'
        : 'steelplank';

    scene.sound.play(plankSound);

    plank.setOrigin(0.5);
    plank.setAngle(90);
    plank.setDepth(3);


    plank.body.allowGravity = false;
    plank.setImmovable(true);

    plank.body.setSize(10, 200);
    plank.body.setOffset(95, 0);

    plank.health = attacker.variant === 'SLEDGEHAMMER' ? 0.50 : 0.13;
    plank.maxHealth = plank.health;
    plank.finalStand = attacker.variant === 'SLEDGEHAMMER';

    plank.owner = attacker;
    scene.objs.add(plank);
    scene.planks.add(plank);
    attacker.steelPlanks.push(plank);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );

    const plankDeletionTime = attacker.variant === 'SLEDGEHAMMER' ? 20000 : 10000;
    plank.expireEvent = scene.time.delayedCall(plankDeletionTime, () => {
        destroyPlank(api, scene, plank);
    });
}

const MALLET_SWING = {
    range: 110,
    damage: 0.20,
    plankDamage: 0.08,
    hitstun: 800,
    hitFreeze: 100,
    sound: 'hammerhit',
    knockback: { x: 450, y: 300 },
    decelerateAfter: 1000,
    missSound: 'miss'
};
const SHIELD_BREAK_COST = 1.2;
const SLEDGEHAMMER_SWING = {
    range: 150,
    shieldCost: SHIELD_BREAK_COST,
    damage: 0.30,
    plankDamage: 0.30,
    hitstun: 400,
    hitFreeze: 100,
    sound: 'sledgehammerhit',
    knockback: { x: 1050, y: 500 },
    decelerateAfter: 1000
};

const SLEDGEHAMMER_SPIKE = {
    windupMs: 800,
    windupLean: -25,
    animScale: 0.6,
    launchSpeed: 900,
    launchGrowth: true,
    recoveryMs: 700,
    windupSound: 'sledgewhoosh',
    hitstunScale: 2 / 1.7,
    hit: {
        range: SLEDGEHAMMER_SWING.range + 20,
        shieldCost: SLEDGEHAMMER_SWING.shieldCost,
        damage: SLEDGEHAMMER_SWING.damage,
        plankDamage: SLEDGEHAMMER_SWING.plankDamage,
        hitstun: SLEDGEHAMMER_SWING.hitstun,
        hitstunGrowth: true,
        hitFreeze: SLEDGEHAMMER_SWING.hitFreeze,
        sound: SLEDGEHAMMER_SWING.sound,
        decelerateAfter: 300
    }
};

function hardSwing(api, scene, attacker, target, animKey) {
    api.setAttackSprite(attacker, animKey);
    //short windup before the mallet connects, like veryhardSwing but much quicker.
    api.afterWindup(scene, attacker, 150, () => {
        if (!api.strike(scene, attacker, target, MALLET_SWING)) attacker.combo = 0;
        attacker.canAttack = false;
        api.clearQueuedStunTimers(scene, attacker, target);
    });
    scene.time.delayedCall(250, () => {
        api.hideAttackSprite(attacker);
    });
    scene.time.delayedCall(550, () => {
        attacker.canAttack = true;
    });
}
function veryhardSwing(api, scene, attacker, target, animKey) {
    //Hardest swing, only used for the sledgehammer variant of hammerman.
    api.setAttackSprite(attacker, animKey);
    attacker.attackBypassesHitstun = true;
    attacker.sledgeSwingLandsAt = scene.time.now + 800;
    attacker.sledgeSwingRange = SLEDGEHAMMER_SWING.range;
    api.afterWindup(scene, attacker, 800, () => {
        //the delay makes slegdehammer man telegraphable and punishable, but also makes it feel like a big swing.
        const hit = attacker.active && attacker.variant === "SLEDGEHAMMER" &&
            api.strike(scene, attacker, target, { ...SLEDGEHAMMER_SWING, bypass: { ignoreAttackerStun: true, ignoreCanAttack: true } });
        if (!hit) attacker.combo = 0;
        attacker.canAttack = false;
        api.clearQueuedStunTimers(scene, attacker, target);
    });
    scene.time.delayedCall(1500, () => {
        //obviously its a longer delay, its a sledgehammer. the player should be punished for using it.
        attacker.canAttack = true;
    });
    scene.time.delayedCall(750, () => {
        if (attacker.canAttack) {
            scene.sound.play('sledgewhoosh');
        }
    });
}
function tryAttack3(api, scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (api.aimsDown(attacker)) {
        api.spikeAttack(scene, attacker, target, attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammerquickslam1' : animKey,
            attacker.variant === 'SLEDGEHAMMER' ? SLEDGEHAMMER_SPIKE : {});
    } else if (attacker.variant == 'MALLET') {
        hardSwing(api, scene, attacker, target, animKey);
    } else if (attacker.variant == 'SLEDGEHAMMER') {
        veryhardSwing(api, scene, attacker, target, animKey);
    }


    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
const REPAIR_BASE_HEAL = 0.0375;
const REPAIR_SIPHON_HEAL = 0.1875;
function tryRepair(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const repairCD = player.dirSpecialCooldown;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {

        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        // One heal swing covers all 3 hits; the hits themselves are invisible.
        api.setAttackSprite(player, "hammeratkheal");
        player.isUsingSideSpecial = false;

        const spawnRepairBox = () => api.spawnHealFlash(scene, player);

        const repairStrike = () => {
            scene.sound.play("repair");
            const hasAttacked = api.pushAttack(scene, player, target, null, { special: true });
            player.KBmultiplier -= hasAttacked ? REPAIR_SIPHON_HEAL : REPAIR_BASE_HEAL;
            spawnRepairBox();
        };
        const unlockAim = api.lockAimDuringWindup(player);
        scene.time.delayedCall(300, () => {
            repairStrike();
            scene.time.delayedCall(100, () => {
                repairStrike();
                scene.time.delayedCall(150, () => {
                    repairStrike();
                    unlockAim();
                });
            });
        });
        api.startSideSpecialCooldown(player, currentTime, repairCD);
    }

    player.lastTap[direction] = currentTime;
}
// Quickslam's first hit pops the target straight up for the follow-up jump.
const QUICKSLAM_POWER = SIDE_SPECIAL_POWER;
const QUICKSLAM_HITSTUN_SCALE = 1.3;
function quickslamLaunchUp({ attacker, kb, damageScale, grounded, side }) {
    const dirY = attacker.lastDir.y === 0 ? -1 : attacker.lastDir.y; //always launch upwards if on same level
    if (grounded && dirY > 0.7) return { x: 50 * kb * side * QUICKSLAM_POWER, y: -1500 * kb * QUICKSLAM_POWER };
    return { x: 50 * kb * damageScale * attacker.lastDir.x * QUICKSLAM_POWER, y: -1000 * QUICKSLAM_POWER };
}

function quickslamSpikeDown({ attacker, kb, damageScale, grounded }) {
    const dirX = attacker.quickslamDirX;
    const dirY = attacker.lastDir.y === 0 ? 1 : attacker.lastDir.y; //special case
    if (grounded && dirY > 0.7) return { x: 200 * kb * dirX * QUICKSLAM_POWER, y: -1500 * kb * QUICKSLAM_POWER };
    return { x: 500 * kb * damageScale * dirX * QUICKSLAM_POWER, y: 1000 * QUICKSLAM_POWER };
}

const QUICKSLAM_DASH = { speed: 1000, ms: 112, endSlowdown: 5, riseFrame: 1 };

function quickslamDash(api, scene, attacker, target, animKey = 'sledgehammerquickslam1') {
    const dirX = attacker.quickslamDirX;
    const sequence = (attacker.attackSequence ?? 0) + 1;
    attacker.quickslamJumpUntil = 0;
    attacker.quickslamJumpTarget = null;
    api.setAttackSprite(attacker, animKey);
    attacker.atk.anims.pause(attacker.atk.anims.currentAnim.frames[QUICKSLAM_DASH.riseFrame]);
    attacker.isUsingSideSpecial = true;
    attacker.afterimage = true;
    attacker.lastDir = { x: dirX, y: 0 };
    attacker.setVelocityX(dirX * QUICKSLAM_DASH.speed);
    scene.time.delayedCall(QUICKSLAM_DASH.ms, () => {
        if (!attacker.active) return;
        attacker.isUsingSideSpecial = false;
        attacker.afterimage = false;
        if (attacker.attackSequence !== sequence) return;
        if (attacker.hitstun) {
            attacker.isAttacking = false;
            api.hideAttackSprite(attacker);
            return;
        }
        attacker.setVelocityX(attacker.body.velocity.x / QUICKSLAM_DASH.endSlowdown);
        attacker.atk.anims.resume();
        quickslam1(api, scene, attacker, target);
    });
}

function quickslam1(api, scene, attacker, target) {
    //quickslam is a special attack that does less knockback and damage then the normal attack.
    //This is only for sledgehammer.
    //Used as a quick move that contrast's sledgehammer's slow, telegraphed, and easily punishable attacks.
    const hit = attacker.variant === "SLEDGEHAMMER" && api.strike(scene, attacker, target, {
        special: true,
        range: 250,
        bypass: { ignoreCanAttack: true },
        damage: 0.25 * QUICKSLAM_POWER,
        hitstun: 400,
        hitFreeze: 100,
        knockback: quickslamLaunchUp,
        decelerateAfter: 1000,
        onHit: () => {
            attacker.quickslamJumpUntil = scene.time.now + 1000;
            attacker.quickslamJumpTarget = target;
            scene.time.delayedCall(QUICKSLAM_FOLLOW_MS, () => quickslamFollowUp(api, scene, attacker));
            target.canAttack = false;
            scene.time.delayedCall(800, () => {
                target.canAttack = true;
            });
        }
    });
    if (!hit) attacker.combo = 0;
    api.clearQueuedStunTimers(scene, attacker, target);

    scene.sound.play('sledgewhoosh');
    scene.time.delayedCall(203, () => {
        api.spawnDirtBurst(
            scene,
            attacker.x + (attacker.lastDir.x * 150),
            attacker.y,
            28,
            5,
            6,
            1.5,
            [0xff6a00, 0xff8c00, 0xffb000],
            1000,
            1500,
            true
        );
        scene.sound.play('sledgehammerquickslam');
    });

}
const QUICKSLAM_FOLLOW_MS = 400;
const QUICKSLAM_LEAP = { side: 70, above: 130, ms: 200 };

function quickslamFollowUp(api, scene, attacker) {
    const target = attacker.quickslamJumpTarget;
    const expired = scene.time.now > attacker.quickslamJumpUntil;
    attacker.quickslamJumpUntil = 0;
    attacker.quickslamJumpTarget = null;
    if (attacker.variant !== 'SLEDGEHAMMER' || !target || expired || !attacker.active ||
        attacker.hitstun || !target.active || target.eliminated) {
        return false;
    }

    attacker.canAttack = true;

    const startX = attacker.x;
    const startY = attacker.y;
    const sideX = attacker.quickslamDirX || attacker.lastDir.x || 1;
    attacker.moveDirLock = sideX;
    attacker.lastDir = { x: sideX, y: 0 };
    const endX = () => target.x - sideX * QUICKSLAM_LEAP.side;
    const endY = () => target.y - QUICKSLAM_LEAP.above;
    const movement = { progress: 0 };
    const originalGravity = attacker.body.allowGravity;
    const wasUsingSideSpecial = attacker.isUsingSideSpecial;
    const wasDecelerating = attacker.willDecelerate;

    attacker.setVelocity(0, 0);
    attacker.body.allowGravity = false;
    attacker.isUsingSideSpecial = true;
    attacker.willDecelerate = false;


    scene.tweens.add({
        targets: movement,
        progress: 1,
        duration: QUICKSLAM_LEAP.ms,
        ease: 'Linear',
        onUpdate: () => {
            if (!attacker.active) return;
            attacker.setPosition(
                Phaser.Math.Linear(startX, endX(), movement.progress),
                Phaser.Math.Linear(startY, endY(), movement.progress)
            );
        },
        onComplete: () => {
            if (!attacker.active) {
                attacker.moveDirLock = null;
                return;
            }
            attacker.setPosition(endX(), endY());
            attacker.setVelocity(0, 0);
            attacker.body.allowGravity = originalGravity;
            attacker.isUsingSideSpecial = wasUsingSideSpecial;
            attacker.willDecelerate = wasDecelerating;
            quickslam2(api, scene, attacker, target);

        }
    });

    return true;
}
const QUICKSLAM2_LOCK_MS = 250;
const QUICKSLAM2_REACH = { range: 280, minDot: 0.5 };

function aimAt(attacker, target) {
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
}

function quickslam2(api, scene, attacker, target, animKey = 'sledgehammerquickslam2') {
    const sideX = attacker.moveDirLock;
    api.setAttackSprite(attacker, animKey);
    scene.time.delayedCall(QUICKSLAM2_LOCK_MS, () => {
        if (attacker.moveDirLock === sideX) attacker.moveDirLock = null;
    });
    //The second quickslam is the aerial version, instead of sending the target flying up, it sends them flying down.
    api.afterWindup(scene, attacker, 50, () => {
        const aim = target?.active ? aimAt(attacker, target) : attacker.lastDir;
        const hit = api.strike(scene, attacker, target, {
            special: true,
            range: QUICKSLAM2_REACH.range,
            bypass: { ignoreCanAttack: true, allowTargetBelow: true, direction: aim, minDot: QUICKSLAM2_REACH.minDot },
            damage: 0.25 * QUICKSLAM_POWER,
            hitstun: 400,
            hitstunGrowth: false,
            shieldCost: SHIELD_BREAK_COST,
            hitFreeze: 100,
            sound: 'sledgehammerquickslam',
            knockback: quickslamSpikeDown,
            decelerateAfter: 1000,
            onHit: () => scene.sound.play('damn', { volume: 2 })
        });
        if (!hit) attacker.combo = 0;
        else api.stretchHitstun(scene, target, QUICKSLAM_HITSTUN_SCALE);
        attacker.canAttack = true;
        api.clearQueuedStunTimers(scene, attacker, target);
    });
}
const SLEDGE_DOWN_SLAM = {
    range: 200,
    minDot: 0.2,
    aim: { x: 0.8, y: 0.6 },
    damage: 0.15,
    hitstun: 350,
    hitFreeze: 80,
    ground: { x: 150, y: 700 },
    air: { x: 250, y: 600 }
};

function sledgeDownSlamKnockback({ attacker, target, kb, damageScale, grounded }) {
    const dirX = Math.sign(target.x - attacker.x) || attacker.lastDir.x || 1;
    if (grounded) return { x: SLEDGE_DOWN_SLAM.ground.x * kb * dirX, y: -SLEDGE_DOWN_SLAM.ground.y * kb };
    return { x: SLEDGE_DOWN_SLAM.air.x * kb * damageScale * dirX, y: SLEDGE_DOWN_SLAM.air.y * kb };
}

function trySledgeDownSlam(api, scene, attacker, target, currentTime) {
    if (attacker.hitstun || attacker.freeze || currentTime < attacker.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
    const facing = attacker.lastDir.x || attacker.facingX || 1;
    attacker.lastDir = { x: facing, y: 0 };
    api.setAttackSprite(attacker, 'sledgehammerquickslam2');
    api.afterWindup(scene, attacker, 50, () => {
        if (!attacker.active || attacker.hitstun) return;
        api.strike(scene, attacker, target, {
            special: true,
            range: SLEDGE_DOWN_SLAM.range,
            direction: { x: facing * SLEDGE_DOWN_SLAM.aim.x, y: SLEDGE_DOWN_SLAM.aim.y },
            bypass: { ignoreCanAttack: true, allowTargetBelow: true, minDot: SLEDGE_DOWN_SLAM.minDot },
            damage: SLEDGE_DOWN_SLAM.damage,
            hitstun: SLEDGE_DOWN_SLAM.hitstun,
            hitFreeze: SLEDGE_DOWN_SLAM.hitFreeze,
            sound: 'sledgehammerquickslam',
            knockback: sledgeDownSlamKnockback,
            decelerateAfter: target => SLEDGE_DOWN_SLAM.hitstun * target.KBmultiplier,
            resetCombo: false
        });
        attacker.canAttack = true;
    });
}

const WHIRLWIND = {
    anim: 'whirlwind',
    hits: 3,
    firstHitMs: 157,
    hitEveryMs: 179,
    endAfterLastHitMs: 45,
    holdLastFrameMs: 200,
    tiltDegrees: 10,
    riseHeight: 340,
    riseEase: 'Quad.easeOut',
    range: 115,
    sound: { key: 'twirl', seek: 0.2, rate: 1.5, volume: 0.8 },
    hitSound: { key: 'hammerhit', rate: 0.7 },
    carry: {
        damage: 0.05,
        plankDamage: 0.05,
        hitstun: 300,
        hitstunGrowth: false,
        hitFreeze: 40,
        noDeathRay: true,
        resetCombo: false
    },
    launch: {
        damage: 0.12,
        plankDamage: 0.12,
        hitstun: 450,
        hitFreeze: 90,
        x: 700,
        y: 250,
        resetCombo: false
    }
};

function whirlwindLaunch(launchX) {
    return ({ kb }) => ({ x: WHIRLWIND.launch.x * kb * launchX, y: -WHIRLWIND.launch.y * kb });
}

function trySledgeWhirlwind(api, scene, player, victim, currentTime) {
    if (player.hitstun || player.freeze || player.sledgeWhirling) return;
    if (currentTime < player.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    const facing = player.lastDir.x || player.facingX || 1;
    const lastHitMs = WHIRLWIND.firstHitMs + WHIRLWIND.hitEveryMs * (WHIRLWIND.hits - 1);
    const riseMs = lastHitMs + WHIRLWIND.endAfterLastHitMs;
    const riseEase = Phaser.Tweens.Builders.GetEaseFunction(WHIRLWIND.riseEase);
    const startY = player.y;
    const startedAt = scene.time.now;
    const sequence = (player.whirlwindSequence ?? 0) + 1;
    const launchX = facing;
    const carried = new Map();

    player.whirlwindSequence = sequence;
    player.sledgeWhirling = true;
    player.isUsingSideSpecial = true;
    player.hasHitSideSpecial = true;
    player.canAttack = false;
    player.lastDir = { x: facing, y: 0 };
    player.aimLock = { x: facing, y: 0 };
    player.atkAngleOverride = -WHIRLWIND.tiltDegrees * facing;
    player.body.setAllowGravity(false);
    api.setAttackSprite(player, WHIRLWIND.anim);
    player.atk.setAngle(player.atkAngleOverride);
    const twirl = scene.sound.add(WHIRLWIND.sound.key);
    twirl.play({ seek: WHIRLWIND.sound.seek, rate: WHIRLWIND.sound.rate, volume: WHIRLWIND.sound.volume });

    const stillWhirling = () => player.whirlwindSequence === sequence && player.sledgeWhirling;
    const release = foe => {
        carried.delete(foe);
        if (foe.body) foe.body.setAllowGravity(true);
    };
    const finish = () => {
        if (!stillWhirling()) return;
        removeUpdate();
        twirl.stop();
        twirl.destroy();
        [...carried.keys()].forEach(release);
        player.sledgeWhirling = false;
        player.isUsingSideSpecial = false;
        player.canAttack = true;
        player.aimLock = null;
        player.atkAngleOverride = null;
        player.body.setAllowGravity(true);
        player.isAttacking = false;
        player.atk.stop();
        player.atk.setTexture('sledge_idle');
        player.atk.setAngle(0);
        api.hideAttackSprite(player);
        if (!player.hitstun) player.setVelocity(0, 0);
    };
    const finishAfterFreeze = () => {
        const frozenFor = (scene.hitFreezeUntil ?? 0) - scene.time.now;
        if (frozenFor > 0) {
            scene.time.delayedCall(frozenFor + WHIRLWIND.endAfterLastHitMs, finishAfterFreeze);
            return;
        }
        if (!stillWhirling()) return;
        player.atk.anims.pause();
        scene.time.delayedCall(WHIRLWIND.holdLastFrameMs, finish);
    };
    const playHitSound = () => scene.sound.play(WHIRLWIND.hitSound.key, { rate: WHIRLWIND.hitSound.rate });
    const whirlBypass = { ignoreCanAttack: true, allowTargetBelow: true, ignoreFacing: true };
    const carrySpec = {
        ...WHIRLWIND.carry,
        onHit: (hitScene, target) => {
            carried.set(target, { x: target.x - player.x, y: target.y - player.y, hitAt: hitScene.time.now });
            target.body.setAllowGravity(false);
            target.willDecelerate = false;
            target.setVelocity(0, 0);
            playHitSound();
        }
    };
    const whirlHit = index => {
        if (!stillWhirling() || !player.active || player.hitstun) return;
        const last = index === WHIRLWIND.hits - 1;
        const spec = last
            ? {
                ...WHIRLWIND.launch,
                knockback: whirlwindLaunch(launchX),
                decelerateAfter: target => WHIRLWIND.launch.hitstun * target.KBmultiplier,
                onHit: (hitScene, target) => {
                    release(target);
                    playHitSound();
                }
            }
            : carrySpec;
        api.strike(scene, player, victim ?? api.getEnemies(scene, player)[0], {
            special: true,
            ...spec,
            range: WHIRLWIND.range,
            bypass: whirlBypass,
            direction: { x: launchX, y: 0 }
        });
        if (last) scene.time.delayedCall(WHIRLWIND.endAfterLastHitMs, finishAfterFreeze);
    };
    const catchTries = new Map();
    const catchTouching = () => {
        if (player.hitstun || scene.time.now - startedAt >= lastHitMs) return;
        for (const foe of api.getEnemies(scene, player)) {
            if (carried.has(foe) || scene.time.now < (catchTries.get(foe) ?? 0)) continue;
            if (!api.attackIsElligible(player, foe, WHIRLWIND.range, { ...whirlBypass, silent: true })) continue;
            catchTries.set(foe, scene.time.now + WHIRLWIND.hitEveryMs);
            api.strike(scene, player, foe, {
                special: true,
                ...carrySpec,
                range: WHIRLWIND.range,
                bypass: whirlBypass,
                direction: { x: launchX, y: 0 },
                singleTarget: true
            });
        }
    };
    const removeUpdate = api.addSceneUpdateListener(scene, (time, delta) => {
        if (!stillWhirling() || scene.hitFreezeUntil > scene.time.now) return;
        if (!player.active || player.hitstun || scene.time.now - startedAt > lastHitMs + 1000) {
            finish();
            return;
        }
        const progress = Math.min(1, (scene.time.now - startedAt) / riseMs);
        const targetY = startY - WHIRLWIND.riseHeight * riseEase(progress);
        player.setVelocity(0, Math.min(0, (targetY - player.y) * 1000 / Math.max(delta, 1)));
        for (const [foe, hold] of carried) {
            if (!foe.active || foe.eliminated || foe.lastHitAt !== hold.hitAt) {
                release(foe);
                continue;
            }
            foe.setPosition(player.x + hold.x, player.y + hold.y);
            foe.setVelocity(0, 0);
        }
        catchTouching();
    });
    for (let index = 0; index < WHIRLWIND.hits; index++) {
        scene.time.delayedCall(WHIRLWIND.firstHitMs + WHIRLWIND.hitEveryMs * index, () => whirlHit(index));
    }
}

const MALLET_DASH = {
    stops: 3,
    angle: Math.PI / 4,
    speed: 850,
    dashMs: 70,
    pauseMs: 110,
    endSlowdown: 3,
    range: 130,
    minDot: 0.2,
    carryDistance: 70,
    carryHoldMs: 150,
    hit: {
        damage: 0.06,
        plankDamage: 0,
        hitstun: 350,
        hitstunGrowth: false,
        stun: { target: 250, attacker: 0 },
        hitFreeze: 40,
        sound: 'light',
        knockback: { x: 200, y: 200, growth: false, scaleWithDamage: false },
        resetCombo: false,
        noDeathRay: true
    },
    finalHit: {
        damage: 0.12,
        plankDamage: 0,
        hitstun: 400,
        hitFreeze: 70,
        sound: 'light',
        knockback: { x: 350, y: 450 },
        decelerateAfter: 900
    }
};

function carryMalletVictim(scene, player, foe, aim) {
    foe.body.setAllowGravity(false);
    foe.setVelocity(0, 0);
    foe.setPosition(player.x + aim.x * MALLET_DASH.carryDistance, player.y + aim.y * MALLET_DASH.carryDistance);
    foe.hitstunUntil = Math.max(foe.hitstunUntil ?? 0, scene.time.now + MALLET_DASH.carryHoldMs);
    foe.willDecelerate = false;
}

function releaseMalletVictim(foe) {
    if (foe?.body) foe.body.setAllowGravity(true);
}

function malletDashStop(api, scene, player, victim, aim, stop, dashState) {
    const last = stop === MALLET_DASH.stops - 1;
    player.setVelocity(0, 0);
    api.setAttackSprite(player, 'hammeratk');
    if (stop === 1) player.atk.playReverse('hammeratk', true);
    player.atk.setAngle(player.atkAngleOverride);
    scene.sound.play('swosh', { volume: 0.6 });
    const spec = { special: true, ...(last ? MALLET_DASH.finalHit : MALLET_DASH.hit), direction: aim };
    const carried = dashState.carried;
    if (carried) {
        carryMalletVictim(scene, player, carried, aim);
        if (last) {
            releaseMalletVictim(carried);
            dashState.carried = null;
        }
        api.landHit(scene, player, carried, spec);
        api.clearQueuedStunTimers(scene, player, carried);
        return;
    }
    const bypass = { ignoreCanAttack: true, allowTargetBelow: true, direction: aim, minDot: MALLET_DASH.minDot };
    const hit = api.strike(scene, player, victim, { ...spec, range: MALLET_DASH.range, bypass });
    if (!hit) return;
    api.clearQueuedStunTimers(scene, player, victim);
    if (!last) {
        dashState.carried = victim;
        carryMalletVictim(scene, player, victim, aim);
    }
}

function tryMalletDash(api, scene, player, victim, direction, currentTime) {
    if (player.hitstun || player.freeze || player.malletDashing) return;
    if (currentTime < player.nextSideSpecialTime) return;
    api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    const dirX = player.lastDir.x || player.facingX || 1;
    const dirY = direction === 'up' ? -1 : 1;
    const aim = { x: dirX * Math.cos(MALLET_DASH.angle), y: dirY * Math.sin(MALLET_DASH.angle) };
    const sequence = (player.malletDashSequence ?? 0) + 1;
    const dashState = { carried: null };
    player.malletDashSequence = sequence;
    player.malletDashing = true;
    player.isUsingSideSpecial = true;
    player.hasHitSideSpecial = true;
    player.afterimage = true;
    player.lastDir = { ...aim };
    player.aimLock = { ...aim };
    player.atkAngleOverride = dirX * dirY * MALLET_DASH.angle * 180 / Math.PI;
    player.body.setAllowGravity(false);
    scene.sound.play('lunge');

    const stillDashing = () => player.malletDashSequence === sequence && player.active && !player.hitstun;
    const removeUpdate = api.addSceneUpdateListener(scene, () => {
        const foe = dashState.carried;
        if (!foe) return;
        if (!stillDashing() || !foe.active || foe.eliminated) {
            releaseMalletVictim(foe);
            dashState.carried = null;
            return;
        }
        carryMalletVictim(scene, player, foe, aim);
    });
    const finish = () => {
        if (player.malletDashSequence !== sequence || !player.malletDashing) return;
        removeUpdate();
        releaseMalletVictim(dashState.carried);
        dashState.carried = null;
        player.malletDashing = false;
        player.isUsingSideSpecial = false;
        player.afterimage = false;
        player.atkAngleOverride = null;
        player.aimLock = null;
        player.lastDir = { x: dirX, y: 0 };
        player.body.setAllowGravity(true);
        if (!player.hitstun) {
            player.setVelocity(player.body.velocity.x / MALLET_DASH.endSlowdown, player.body.velocity.y / MALLET_DASH.endSlowdown);
        }
    };
    const dash = stop => {
        if (!stillDashing()) {
            finish();
            return;
        }
        api.startDashTrail(player, MALLET_DASH.dashMs);
        player.setVelocity(aim.x * MALLET_DASH.speed, aim.y * MALLET_DASH.speed);
        scene.time.delayedCall(MALLET_DASH.dashMs, () => {
            if (!stillDashing()) {
                finish();
                return;
            }
            malletDashStop(api, scene, player, victim, aim, stop, dashState);
            if (stop === MALLET_DASH.stops - 1) {
                scene.time.delayedCall(MALLET_DASH.pauseMs, finish);
                return;
            }
            scene.time.delayedCall(MALLET_DASH.pauseMs, () => dash(stop + 1));
        });
    };
    dash(0);
}

function tryQuickslam(api, scene, attacker, target, direction, currentTime) {
    const dtapDelay = 250;
    const slamCD = attacker.dirSpecialCooldown;

    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;

    if (currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot) {
        attacker.quickslamDirX = direction === 'left' ? -1 : 1;
        quickslamDash(api, scene, attacker, target);
        api.startSideSpecialCooldown(attacker, currentTime, slamCD);
    }
    attacker.lastTap[direction] = currentTime;
}

export default {
    spikeAnimation: attackAnim,
    variantAttackSpriteScales: { MALLET: 0.75 },
    variantDemoAnimations: {
        MALLET: ['hammeratk', 'hammeratkheal'],
        SLEDGEHAMMER: ['sledgehammeratk', 'sledgehammerquickslam1']
    },
    variantDemoIdle: { MALLET: 'hammeratk', SLEDGEHAMMER: 'sledge_idle' },
    variantDemoAnchors: { SLEDGEHAMMER: { x: 0, y: 0 } },
    armColor: 0x072900,
    variantStats: { SLEDGEHAMMER: { armColor: 0x8a8a8a } },
    hitSounds: { light: 'hammerhit' },
    // Mallet swing sheets are drawn facing right and need their own nudge so
    // the arm sits behind the body with the handle out the front.
    rightFacingAttackSprites: ['hammeratk', 'hammeratkheal', 'whirlwind'],
    textureAttackSpriteOffsets: {
        whirlwind: { x: -45, y: 5 },
        hammeratk: { x: -52, y: 20 },
        hammeratkheal: { x: -6, y: -5 }
    },
    handleAttack: attack,
    upSpecialVariants: ['MALLET', 'SLEDGEHAMMER'],
    downSpecialVariants: ['MALLET', 'SLEDGEHAMMER'],
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) => {
        if (attacker.variant !== 'SLEDGEHAMMER') {
            if (direction === 'up' || direction === 'down') return tryMalletDash(api, scene, attacker, victim, direction, currentTime);
            return tryRepair(api, scene, attacker, victim, direction, currentTime);
        }
        if (direction === 'up') return trySledgeWhirlwind(api, scene, attacker, victim, currentTime);
        if (direction === 'down') return trySledgeDownSlam(api, scene, attacker, victim, currentTime);
        return tryQuickslam(api, scene, attacker, victim, direction, currentTime);
    },
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: {
        MALLET: steelPlank,
        SLEDGEHAMMER: steelPlank
    },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};