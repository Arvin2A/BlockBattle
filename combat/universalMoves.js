// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getMapPlatforms } from '../attacks.js';
import { landHit, strike } from './blueprints.js';
import { getCharacterStat } from './characterStats.js';
import { isInvincible } from './knockback.js';
import { isBlockedByWall } from './planks.js';
import { spawnDirtBurst, triggerScreenShake } from './effects.js';
import { updateBlock, blocksHit, canBreakGrab, raiseBlock } from './block.js';
import { consumePress } from '../input.js';

export const SMACK = {
    range: 125,
    cooldownMs: 1500,
    grabMs: 140,
    slamMs: 80,
    holdHeight: 70,
    reach: 45,
    damage: 0.03,
    totalStunMs: 1200,
    attackerFreeBeforeMs: 0,
    arcHeight: 70,
    arcMs: 900,
    reboundAway: 240,
};

const CLIMB_BUTTONS = ['up', 'left', 'right', 'attack', 'special', 'misc', 'block'];

export const FLAT_SQUASH = {
    holdMs: 1000,
    easeMs: 250,
    width: 0.6,
    height: 0.65
};

export const LEDGE = {
    reachX: 150,
    aboveY: 30,
    belowY: 150,
    hangMs: 1500,
    climbMs: 400,
    regrabMs: 1000,
    slideMs: 240,
    slideSpeed: 900,
    slideRange: 90,
    flash: { scale: 2, alpha: 0.9, ms: 260 },
    slideHit: {
        damage: 0.02,
        plankDamage: 0,
        hitstun: 250,
        hitstunGrowth: false,
        knockback: { x: 380, y: 120, lift: -1, growth: false, scaleWithDamage: false },
        sound: 'light',
        noDeathRay: true,
        resetCombo: false
    }
};

function isGrounded(player) {
    return Boolean(player.body?.touching.down || player.body?.blocked.down);
}

function frameDelta(scene) {
    if (scene.gamePaused || scene.hitFreezeUntil > scene.time.now) return 0;
    return Math.min(scene.game.loop.delta, 50);
}

function platformUnder(scene, player) {
    const body = player.body;
    return getMapPlatforms(scene)
        .filter(platform =>
            body.right > platform.body.left &&
            body.left < platform.body.right &&
            Math.abs(body.bottom - platform.body.top) <= 6
        )
        .sort((a, b) => Math.abs(body.bottom - a.body.top) - Math.abs(body.bottom - b.body.top))[0] ?? null;
}

function overAnyPlatform(scene, player) {
    return getMapPlatforms(scene).some(platform =>
        player.x >= platform.body.left &&
        player.x <= platform.body.right &&
        platform.body.top >= player.body.bottom - 4
    );
}

export function isUniversalBusy(player) {
    return Boolean(player.blocking || player.ledge || player.ledgeSlide || player.smack);
}

function ensureArm(scene, player) {
    if (player.armFx) return player.armFx;
    const arm = scene.add.sprite(player.x, player.y, 'uni-slam', 11)
        .setDepth((player.depth ?? 5) + 1)
        .setVisible(false);
    arm.setTint(getCharacterStat(player, 'armColor', 0xffffff));
    scene.objs?.add(arm);
    player.once('destroy', () => arm.destroy());
    player.armFx = arm;
    return arm;
}

function playArm(scene, player, animKey, facing) {
    const arm = ensureArm(scene, player);
    arm.setFlipX(facing < 0).setVisible(true);
    arm.play(animKey, true);
}

function hideArm(player) {
    if (!player.armFx) return;
    player.armFx.stop();
    player.armFx.setVisible(false);
}

function syncArm(player) {
    const arm = player.armFx;
    if (!arm) return;
    arm.setPosition(player.x, player.y);
    const inUse = player.smack || player.ledge;
    if (!inUse && arm.visible && !arm.anims.isPlaying) arm.setVisible(false);
}

export function canSmackDown(scene, attacker, target) {
    if (!target?.active || !attacker.active) return false;
    if (scene.time.now < (attacker.nextSmackAt ?? 0)) return false;
    if (!isGrounded(attacker) || attacker.hitstun || attacker.freeze || attacker.isAttacking) return false;
    if (isUniversalBusy(attacker) || attacker.activeGrab || attacker.grabbedBy || attacker.isUsingSideSpecial) return false;
    if (target.ledge || target.smackedBy || target.activeGrab || target.grabbedBy || isInvincible(target)) return false;
    if (Math.hypot(target.x - attacker.x, target.y - attacker.y) > SMACK.range) return false;
    return !isBlockedByWall(attacker, target);
}

export function smackDown(scene, attacker, target) {
    if (!canSmackDown(scene, attacker, target)) return false;
    const dir = Math.sign(target.x - attacker.x) || attacker.lastDir.x || 1;
    const platform = platformUnder(scene, attacker);
    const groundTop = platform ? platform.body.top : attacker.body.bottom;
    const halfWidth = target.body.width / 2;
    let holdX = attacker.x + dir * SMACK.reach;
    if (platform) {
        holdX = Phaser.Math.Clamp(holdX, platform.body.left + halfWidth, platform.body.right - halfWidth);
    }

    if (blocksHit(scene, target, attacker, SMACK.damage)) {
        attacker.nextSmackAt = scene.time.now + SMACK.cooldownMs;
        attacker.lastDir = { x: dir, y: 0 };
        attacker.setVelocityX(0);
        playArm(scene, attacker, 'uni-slam', dir);
        return true;
    }
    const targetWasStunned = target.hitstun || target.freeze;
    const targetStunBefore = target.hitstunUntil ?? 0;
    target.smackedBy = attacker;
    target.weaponHiddenBySmack = { impacted: false };
    target.hitstunUntil = Math.max(target.hitstunUntil ?? 0, scene.time.now + SMACK.grabMs + SMACK.slamMs + 500);
    target.willDecelerate = false;
    target.body.allowGravity = false;
    target.setVelocity(0, 0);
    target.flash();

    attacker.smack = {
        target,
        dir,
        elapsed: 0,
        targetWasStunned,
        targetStunBefore,
        from: { x: target.x, y: target.y },
        holdX,
        holdY: groundTop - SMACK.holdHeight,
        landY: groundTop - target.body.height / 2 - 1,
        groundTop
    };
    attacker.canAttack = false;
    attacker.lastDir = { x: dir, y: 0 };
    attacker.setVelocityX(0);
    attacker.nextSmackAt = scene.time.now + SMACK.cooldownMs;
    playArm(scene, attacker, 'uni-slam', dir);
    scene.sound.play('grab');
    return true;
}

function releaseSmack(scene, attacker) {
    const smack = attacker.smack;
    attacker.smack = null;
    attacker.canAttack = true;
    if (!smack) return;
    const target = smack.target;
    if (target.smackedBy === attacker) target.smackedBy = null;
    if (!target.weaponHiddenBySmack?.impacted) target.weaponHiddenBySmack = null;
    if (target.body) target.body.allowGravity = true;
}

function stepSmack(scene, attacker, dt) {
    const smack = attacker.smack;
    const target = smack.target;
    if (!target.active || !attacker.active || attacker.hitstun || target.outOfBounds) {
        releaseSmack(scene, attacker);
        return;
    }
    attacker.setVelocityX(0);
    smack.elapsed += dt;
    target.setVelocity(0, 0);

    if (smack.elapsed < SMACK.grabMs) {
        if (!smack.targetWasStunned && canBreakGrab(target)) {
            target.hitstunUntil = smack.targetStunBefore;
            releaseSmack(scene, attacker);
            raiseBlock(target);
            blocksHit(scene, target, attacker, SMACK.damage);
            return;
        }
        const t = Phaser.Math.Easing.Quadratic.Out(smack.elapsed / SMACK.grabMs);
        target.setPosition(
            Phaser.Math.Linear(smack.from.x, smack.holdX, t),
            Phaser.Math.Linear(smack.from.y, smack.holdY, t)
        );
        return;
    }
    const slamT = (smack.elapsed - SMACK.grabMs) / SMACK.slamMs;
    if (slamT < 1) {
        const t = Phaser.Math.Easing.Quadratic.In(slamT);
        target.setPosition(smack.holdX, Phaser.Math.Linear(smack.holdY, smack.landY, t));
        return;
    }

    target.setPosition(smack.holdX, smack.landY);
    releaseSmack(scene, attacker);
    attacker.canAttack = false;
    const victimStunMs = SMACK.totalStunMs - SMACK.grabMs - SMACK.slamMs;
    const recoverMs = victimStunMs - SMACK.attackerFreeBeforeMs;
    attacker.nextAttackTime = Math.max(attacker.nextAttackTime ?? 0, scene.time.now + recoverMs);
    attacker.smackEndlagUntil = scene.time.now + recoverMs;
    scene.time.delayedCall(recoverMs, () => {
        if (!attacker.smack) attacker.canAttack = true;
    });
    landHit(scene, attacker, target, {
        damage: SMACK.damage,
        plankDamage: 0,
        hitstun: victimStunMs,
        hitstunGrowth: false,
        hitFreeze: 60,
        sound: 'slamimpact',
        noDeathRay: true,
        resetCombo: false
    });
    target.weaponHiddenBySmack = {
        impacted: true,
        hitAt: target.lastHitAt,
        landedAt: target.lastLandedHitAt,
        leftGround: false,
        until: scene.time.now + SMACK.arcMs + 600
    };
    startSmackArc(scene, target, smack.dir);
    target.flatSquash = { startedAt: scene.time.now };
    spawnDirtBurst(scene, target.x, smack.groundTop, 16, 6, 10, 1.5);
    triggerScreenShake(scene, 6, 200);
}

function stepSmackWeapon(scene, player) {
    const hidden = player.weaponHiddenBySmack;
    if (!hidden?.impacted) return;
    const grounded = isGrounded(player);
    if (!grounded) hidden.leftGround = true;
    const landed = hidden.leftGround && grounded;
    const gotHit = player.lastHitAt !== hidden.hitAt;
    const hitSomeone = player.lastLandedHitAt !== hidden.landedAt;
    if (landed || gotHit || hitSomeone || scene.time.now >= hidden.until) player.weaponHiddenBySmack = null;
}

function weaponHidden(player) {
    return Boolean(player.weaponHiddenBySmack || player.smack || player.ledge || player.armFx?.visible);
}

export function hideWeaponsForUniversalMoves(players) {
    for (const player of players) {
        const atk = player?.atk;
        if (!atk || !weaponHidden(player)) continue;
        player.atkHiddenWas = atk.visible;
        atk.setVisible(false);
        if (player.mower) {
            player.mowerHiddenWas = player.mower.visible;
            player.mower.setVisible(false);
        }
    }
}

export function restoreHiddenWeapons(players) {
    for (const player of players) {
        if (player?.atkHiddenWas === undefined) continue;
        player.atk?.setVisible(player.atkHiddenWas);
        player.atkHiddenWas = undefined;
        if (player.mowerHiddenWas !== undefined) {
            player.mower?.setVisible(player.mowerHiddenWas);
            player.mowerHiddenWas = undefined;
        }
    }
}

function startSmackArc(scene, target, dir) {
    const seconds = SMACK.arcMs / 1000;
    const arcGravity = 8 * SMACK.arcHeight / (seconds * seconds);
    target.smackArc = {
        elapsed: 0,
        hitAt: target.lastHitAt,
        extraGravity: arcGravity - scene.physics.world.gravity.y
    };
    target.willDecelerate = false;
    target.body.allowGravity = true;
    target.body.gravity.y = target.smackArc.extraGravity;
    target.setVelocity(dir * SMACK.reboundAway, -4 * SMACK.arcHeight / seconds);
}

function endSmackArc(player) {
    player.smackArc = null;
    if (player.body) player.body.gravity.y = 0;
}

function stepSmackArc(scene, player, dt) {
    const arc = player.smackArc;
    if (!arc) return;
    arc.elapsed += dt;
    if (!player.active || player.lastHitAt !== arc.hitAt || arc.elapsed > SMACK.arcMs * 2.5) {
        endSmackArc(player);
        return;
    }
    player.body.gravity.y = arc.extraGravity;
    if (arc.elapsed > 80 && isGrounded(player) && player.body.velocity.y >= 0) {
        player.setVelocityX(0);
        player.willDecelerate = true;
        endSmackArc(player);
    }
}

export function getFlatSquash(player, now) {
    const flat = player.flatSquash;
    if (!flat) return 0;
    const elapsed = now - flat.startedAt;
    if (elapsed < FLAT_SQUASH.holdMs) return 1;
    const t = (elapsed - FLAT_SQUASH.holdMs) / FLAT_SQUASH.easeMs;
    if (t >= 1) {
        player.flatSquash = null;
        return 0;
    }
    return 1 - Phaser.Math.Easing.Quadratic.InOut(t);
}

function findLedge(scene, player, opponent) {
    const body = player.body;
    let best = null;
    for (const platform of getMapPlatforms(scene)) {
        const top = platform.body.top;
        const dy = player.y - top;
        if (dy < -LEDGE.aboveY || dy > LEDGE.belowY) continue;
        for (const [cornerX, toward] of [[platform.body.left, 1], [platform.body.right, -1]]) {
            const outside = (cornerX - player.x) * toward;
            if (outside < -body.width / 2) continue;
            const gap = Math.abs(player.x - cornerX) - body.width / 2;
            if (gap > LEDGE.reachX) continue;
            const taken = opponent?.ledge?.platform === platform && opponent.ledge.toward === toward;
            if (taken) continue;
            const score = Math.abs(gap) + Math.abs(dy);
            if (!best || score < best.score) best = { platform, cornerX, toward, top, score };
        }
    }
    return best;
}

export function tryLedgeGrab(scene, player, opponent) {
    const now = scene.time.now;
    if (!player.active || isGrounded(player) || player.hitstun || player.freeze) return false;
    if (isUniversalBusy(player) || player.activeGrab || player.grabbedBy || player.isUsingSideSpecial) return false;
    if (player.ledgeUsed || now < (player.nextLedgeAt ?? 0)) return false;
    if (overAnyPlatform(scene, player)) return false;
    const ledge = findLedge(scene, player, opponent);
    if (!ledge) return false;

    const hangX = ledge.cornerX - ledge.toward * (player.body.width / 2 + 1);
    const hangY = ledge.top - 1;
    player.ledge = {
        platform: ledge.platform,
        toward: ledge.toward,
        cornerX: ledge.cornerX,
        top: ledge.top,
        hangX,
        hangY,
        elapsed: 0,
        climbing: false,
        climbElapsed: 0,
        invincibleBefore: player.invincibleUntil ?? 0
    };
    player.ledgeUsed = true;
    player.hasDoubleJumped = false;
    player.downslamming = false;
    player.isAttacking = false;
    player.lastDir = { x: ledge.toward, y: 0 };
    player.body.allowGravity = false;
    player.setVelocity(0, 0);
    player.setPosition(hangX, hangY);
    playArm(scene, player, 'uni-ledgehang', ledge.toward);
    scene.sound.play('grab');
    return true;
}

function endLedge(scene, player, { keepProtection = false } = {}) {
    const ledge = player.ledge;
    player.ledge = null;
    player.body.allowGravity = true;
    player.body.checkCollision.none = false;
    hideArm(player);
    if (keepProtection) return;
    endProtection(scene, player, ledge?.invincibleBefore);
}

function endProtection(scene, player, invincibleBefore = 0) {
    player.uninterruptible = false;
    player.invincibleUntil = Math.max(invincibleBefore, scene.time.now);
}

function shrugOffStun(player) {
    player.hitstunUntil = 0;
    player.freezeUntil = 0;
}

export function ledgeDrop(scene, player) {
    if (!player.ledge || player.ledge.climbing) return;
    endLedge(scene, player);
    player.nextLedgeAt = scene.time.now + LEDGE.regrabMs;
}

export function ledgeClimb(scene, player) {
    const ledge = player.ledge;
    if (!ledge || ledge.climbing) return;
    ledge.climbing = true;
    ledge.climbElapsed = 0;
    ledge.invincibleBefore = player.invincibleUntil ?? 0;
    player.invincibleUntil = scene.time.now + 60000;
    player.uninterruptible = true;
    shrugOffStun(player);
    player.body.checkCollision.none = true;
    playArm(scene, player, 'uni-ledgepull', ledge.toward);
}

function stepLedge(scene, player, opponent, input, dt) {
    const ledge = player.ledge;
    if (!ledge.platform.active || !ledge.platform.body?.enable || (!ledge.climbing && player.hitstun)) {
        endLedge(scene, player);
        player.nextLedgeAt = scene.time.now + LEDGE.regrabMs;
        return;
    }
    if (ledge.climbing) shrugOffStun(player);
    player.setVelocity(0, 0);
    if (!ledge.climbing) {
        ledge.elapsed += dt;
        player.setPosition(ledge.hangX, ledge.hangY);
        const climbPress = input && CLIMB_BUTTONS.find(button => input[button + 'Pressed']);
        if (input?.downPressed) {
            consumePress(input, 'down');
            ledgeDrop(scene, player);
            return;
        } else if (climbPress) {
            consumePress(input, climbPress);
            ledgeClimb(scene, player);
        } else if (ledge.elapsed >= LEDGE.hangMs) {
            ledgeClimb(scene, player);
        }
        if (!ledge.climbing) return;
    }

    ledge.climbElapsed += dt;
    const t = Math.min(1, ledge.climbElapsed / LEDGE.climbMs);
    const standX = ledge.cornerX + ledge.toward * (player.body.width / 2 + 4);
    const standY = ledge.top - player.body.height / 2 - 1;
    const rise = Phaser.Math.Easing.Quadratic.Out(Math.min(1, t / 0.6));
    const across = Phaser.Math.Easing.Quadratic.InOut(Math.max(0, (t - 0.4) / 0.6));
    player.setPosition(
        Phaser.Math.Linear(ledge.hangX, standX, across),
        Phaser.Math.Linear(ledge.hangY, standY, rise)
    );
    if (t < 1) return;

    const toward = ledge.toward;
    const invincibleBefore = ledge.invincibleBefore;
    endLedge(scene, player, { keepProtection: true });
    startLedgeSlide(scene, player, toward, invincibleBefore);
}

function startLedgeSlide(scene, player, toward, invincibleBefore) {
    player.ledgeSlide = { toward, elapsed: 0, hit: false, invincibleBefore };
    player.lastDir = { x: toward, y: 0 };
    player.afterimage = true;
    player.willDecelerate = false;
    player.setVelocityX(toward * LEDGE.slideSpeed);
    scene.sound.play('lunge');
    showRegainFlash(scene, player);
}

function showRegainFlash(scene, player) {
    const flash = scene.add.rectangle(player.x, player.y, player.width, player.height, 0xffffff, LEDGE.flash.alpha)
        .setDepth((player.depth ?? 5) + 2);
    scene.objs?.add(flash);
    scene.tweens.add({
        targets: flash,
        scale: LEDGE.flash.scale,
        alpha: 0,
        duration: LEDGE.flash.ms,
        ease: 'Quad.Out',
        onUpdate: () => flash.setPosition(player.x, player.y),
        onComplete: () => flash.destroy()
    });
}

function stepLedgeSlide(scene, player, opponent, dt) {
    const slide = player.ledgeSlide;
    slide.elapsed += dt;
    shrugOffStun(player);
    if (slide.elapsed >= LEDGE.slideMs) {
        player.ledgeSlide = null;
        endProtection(scene, player, slide.invincibleBefore);
        player.willDecelerate = true;
        if (!player.heavyLaunch && !player.downslamFx) player.afterimage = false;
        return;
    }
    player.setVelocityX(slide.toward * LEDGE.slideSpeed);
    if (slide.hit || !opponent?.active) return;
    slide.hit = strike(scene, player, opponent, {
        ...LEDGE.slideHit,
        range: LEDGE.slideRange,
        direction: { x: slide.toward, y: 0 },
        bypass: { ignoreCanAttack: true }
    });
}

export function updateUniversalMoves(scene, player, opponent, input) {
    if (!player?.active || !player.body) return;
    ensureArm(scene, player);
    const dt = frameDelta(scene);
    if (isGrounded(player)) player.ledgeUsed = false;

    stepSmackArc(scene, player, dt);
    stepSmackWeapon(scene, player);
    if (player.smack) {
        stepSmack(scene, player, dt);
    } else if (input?.downPressed && canSmackDown(scene, player, opponent)) {
        smackDown(scene, player, opponent);
    }

    if (player.ledge) stepLedge(scene, player, opponent, input, dt);
    if (player.ledgeSlide) stepLedgeSlide(scene, player, opponent, dt);

    updateBlock(scene, player, input ? Boolean(input.block) : Boolean(player.botWantsBlock));
    syncArm(player);
}
