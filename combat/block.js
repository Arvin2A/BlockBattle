// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { PLAYER_COLORS } from '../matchModes.js';
import { HEX } from '../ui/theme.js';
import { getAttackCooldown, getCharacterStat } from './characterStats.js';
import { startSmackArc } from './universalMoves.js';

export const BLOCK = {
    minStart: 0.3,
    drainPerSec: 0.35,
    hitCostScale: 4,
    minHitCost: 0.08,
    maxHitCost: 0.5,
    regrowPerSec: 0.25,
    regrowDelayMs: 500,
    breakStunMs: 1500,
    breakOverflowStunScale: 1.5,
    breakRefill: 0.3,
    blockstunMs: 120,
    pushback: 120,
    pad: 30,
    minScale: 0.45,
    fillAlpha: 0.35,
    hitFillAlpha: 0.6,
    soundGapMs: 120,
    blockStunStartMs: 800,
    blockStunHalfLifeMs: 255,
    blockStunFloorMs: 125,
    cueScale: 1.8,
    cueEndScale: 2.3,
    cueAlpha: 0.9,
    cueMs: 220,
    counterSelfFreezeMs: 120,
    specialCostScale: 0.85,
    counterHop: { away: 80, height: 45 }
};

export const AIR_DODGE = {
    speed: 750,
    minSpeed: 450,
    riseDamping: 0.75,
    maxRise: 400,
    invincibleMs: 450,
    driftMs: 200,
    sound: 'whoosh',
    volume: 2.5
};

const DEFAULT_STYLE = {
    stunStartMs: BLOCK.blockStunStartMs,
    stunFloorMs: BLOCK.blockStunFloorMs,
    costScale: 1,
    regrowScale: 1,
    counter: false,
    deflects: false,
    sound: 'block',
    cueTexture: 'blockshield'
};

export function blockStyle(player, key) {
    return getCharacterStat(player, 'block', null)?.[key] ?? DEFAULT_STYLE[key];
}

function isFrozen(scene) {
    return scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
}

function canDefend(player) {
    return player.active && !player.hitstun && !player.freeze && !player.ledge &&
        !player.smack && !player.smackedBy && !player.activeGrab && !player.grabbedBy &&
        !player.isAttacking && !player.isUsingSideSpecial;
}

function canStartBlock(player) {
    return canDefend(player) && (player.shield ?? 1) >= BLOCK.minStart;
}

function canHoldBlock(player) {
    return player.active && isGrounded(player) && !player.hitstun && !player.ledge && !player.smackedBy && !player.grabbedBy;
}

function isGrounded(player) {
    return Boolean(player.body?.blocked.down || player.body?.touching.down);
}

function airDodgeDirection(player, input) {
    const held = (input?.right ? 1 : 0) - (input?.left ? 1 : 0);
    const vx = player.body.velocity.x;
    const x = held || (Math.abs(vx) > 10 ? Math.sign(vx) : 0);
    return { x, y: -1 };
}

function airDodge(scene, player, input) {
    const now = scene.time.now;
    const dir = airDodgeDirection(player, input);
    const length = Math.hypot(dir.x, dir.y) || 1;
    const rising = Math.max(0, -player.body.velocity.y);
    const speed = Math.max(AIR_DODGE.minSpeed, AIR_DODGE.speed - rising * AIR_DODGE.riseDamping);
    player.airDodgeUsed = true;
    player.airDodgeUntil = now + AIR_DODGE.driftMs;
    player.invincibleUntil = Math.max(player.invincibleUntil ?? 0, now + AIR_DODGE.invincibleMs);
    player.airDodgePhaseUntil = now + AIR_DODGE.invincibleMs;
    player.setVelocity(dir.x / length * speed, Math.max(dir.y / length * speed, -AIR_DODGE.maxRise));
    player.flash?.();
    scene.sound.play(AIR_DODGE.sound, { rate: 2, volume: AIR_DODGE.volume });
}

export function isAirDodgePhasing(player) {
    return player.scene.time.now < (player.airDodgePhaseUntil ?? 0);
}

export function isAirDodging(player) {
    return player.scene.time.now < (player.airDodgeUntil ?? 0);
}

function startBlock(scene, player) {
    player.blocking = true;
    player.blockStartedAt = scene.time.now;
    player.horizontalMovementActive = false;
}

export function stopBlock(scene, player) {
    if (!player.blocking) return;
    player.blocking = false;
    player.shieldRegrowAt = scene.time.now + BLOCK.regrowDelayMs;
}

function breakStunMs(player) {
    const overflow = Math.max(0, -(player.shield ?? 0));
    return BLOCK.breakStunMs * (1 + BLOCK.breakOverflowStunScale * overflow);
}

function breakShield(scene, player) {
    const now = scene.time.now;
    const stunMs = breakStunMs(player);
    player.blocking = false;
    player.shield = BLOCK.breakRefill;
    player.shieldRegrowAt = now + stunMs;
    player.hitstunUntil = Math.max(player.hitstunUntil ?? 0, now + stunMs);
    player.willDecelerate = true;
    player.setVelocityX(0);
    scene.sound.play('glassbreak');
    player.shieldBrokenUntil = now + stunMs;
    const mark = getBreakMark(scene, player);
    mark.setScale(1.6);
    scene.tweens.add({ targets: mark, scale: 1, duration: 180, ease: 'Back.Out' });
}

function getBreakMark(scene, player) {
    if (!player.shieldBreakMark) {
        player.shieldBreakMark = scene.add.image(player.x, player.y, 'shieldbreak')
            .setTint(shieldColors(player).fill)
            .setDepth(9)
            .setVisible(false);
        scene.objs?.add(player.shieldBreakMark);
        player.once('destroy', () => player.shieldBreakMark?.destroy());
    }
    return player.shieldBreakMark;
}

function drawBreakMark(scene, player) {
    if (!player.shieldBreakMark) return;
    const broken = player.active && scene.time.now < (player.shieldBrokenUntil ?? 0);
    player.shieldBreakMark.setPosition(player.x, player.y).setVisible(broken);
}

function shieldColors(player) {
    if (player.isBot) return { fill: HEX.shieldCpu, stroke: HEX.shieldCpuStroke };
    const { hex, shieldStroke } = PLAYER_COLORS[player.color];
    return { fill: hex, stroke: shieldStroke };
}

function showBlockCue(scene, player) {
    const cue = scene.add.image(player.x, player.y, blockStyle(player, 'cueTexture'))
        .setTint(shieldColors(player).fill)
        .setScale(BLOCK.cueScale)
        .setAlpha(BLOCK.cueAlpha)
        .setDepth(8);
    scene.objs?.add(cue);
    scene.tweens.add({
        targets: cue,
        scale: BLOCK.cueEndScale,
        alpha: 0,
        duration: BLOCK.cueMs,
        ease: 'Quad.Out',
        onUpdate: () => cue.setPosition(player.x, player.y),
        onComplete: () => cue.destroy()
    });
}

function drawShield(scene, player) {
    const colors = shieldColors(player);
    if (!player.shieldFx) {
        player.shieldFx = scene.add.rectangle(player.x, player.y, 10, 10, colors.fill, BLOCK.fillAlpha)
            .setStrokeStyle(3, colors.stroke)
            .setDepth(7)
            .setVisible(false);
        scene.objs?.add(player.shieldFx);
        player.once('destroy', () => player.shieldFx?.destroy());
    }
    const fx = player.shieldFx;
    if (!player.blocking || !player.active) {
        fx.setVisible(false);
        return;
    }
    const scale = BLOCK.minScale + (1 - BLOCK.minScale) * Math.max(0, player.shield);
    const size = (player.width + BLOCK.pad) * scale;
    const hit = scene.time.now < (player.shieldHitUntil ?? 0);
    fx.setPosition(player.x, player.y)
        .setSize(size, size)
        .setFillStyle(colors.fill, hit ? BLOCK.hitFillAlpha : BLOCK.fillAlpha)
        .setVisible(true);
}

export function canBreakGrab(player) {
    return Boolean(player.wantsBlock) && (player.shield ?? 1) >= BLOCK.minStart;
}

export function raiseBlock(scene, player) {
    if (!player.blocking) player.blockStartedAt = scene.time.now;
    player.blocking = true;
}

export function updateBlock(scene, player, wantsBlock, input = null) {
    player.shield ??= 1;
    const pressed = wantsBlock && !player.wantsBlock;
    player.wantsBlock = wantsBlock;
    if (isGrounded(player) || player.ledge) player.airDodgeUsed = false;
    if (!isFrozen(scene)) {
        const dt = Math.min(scene.game.loop.delta, 50) / 1000;
        const grounded = isGrounded(player);
        if (player.blocking && (!wantsBlock || !canHoldBlock(player))) {
            stopBlock(scene, player);
        } else if (!player.blocking && wantsBlock && grounded && canStartBlock(player)) {
            startBlock(scene, player);
        } else if (pressed && !grounded && !player.airDodgeUsed && canDefend(player)) {
            airDodge(scene, player, input);
        }
        if (player.blocking) {
            player.shield -= BLOCK.drainPerSec * blockStyle(player, 'costScale') * (player.blockDrainScale ?? 1) * dt;
            player.setVelocityX(player.body.velocity.x * 0.8);
            if (player.shield <= 0) breakShield(scene, player);
        } else if (scene.time.now >= (player.shieldRegrowAt ?? 0)) {
            player.shield = Math.min(1, player.shield + BLOCK.regrowPerSec * blockStyle(player, 'regrowScale') * dt);
        }
    }
    drawShield(scene, player);
    drawBreakMark(scene, player);
}

function blockStunMs(target, now) {
    const held = Math.max(0, now - (target.blockStartedAt ?? -Infinity));
    const decayed = blockStyle(target, 'stunStartMs') * Math.pow(0.5, held / BLOCK.blockStunHalfLifeMs);
    return Math.max(blockStyle(target, 'stunFloorMs'), decayed);
}

function counterLaunch(scene, blocker, attacker, stunMs, countsAsCounter = true) {
    const now = scene.time.now;
    const dir = Math.sign(attacker.x - blocker.x) || -(blocker.lastDir?.x ?? 1);
    attacker.lastHitAt = now;
    if (countsAsCounter && blocker.stats) blocker.stats.counters += 1;
    attacker.freezeUntil = now - 1;
    attacker.hitstunUntil = Math.max(attacker.hitstunUntil ?? 0, now + stunMs);
    attacker.flash?.();
    if (attacker.body) startSmackArc(scene, attacker, dir, BLOCK.counterHop);
}

export function blocksHit(scene, target, attacker, damage = 0, { minCost = BLOCK.minHitCost, ranged = false, shieldCost = null, deferCounter = false, rebound = false, special = false } = {}) {
    if (!target?.blocking) return false;
    const now = scene.time.now;
    const baseCost = shieldCost ?? Phaser.Math.Clamp(damage * BLOCK.hitCostScale, minCost, BLOCK.maxHitCost);
    const cost = special && baseCost < 1 ? baseCost * BLOCK.specialCostScale : baseCost;
    target.shield -= cost * blockStyle(target, 'costScale');
    target.shieldHitUntil = now + 80;
    if (target.stats) target.stats.blocks += 1;
    const stunMs = blockStunMs(target, now);
    const realCounter = !ranged && blockStyle(target, 'counter');
    const counters = realCounter || (!ranged && rebound);
    target.freezeUntil = Math.max(target.freezeUntil ?? 0, now + (counters ? BLOCK.counterSelfFreezeMs : stunMs));
    const away = Math.sign(target.x - attacker.x) || (attacker.lastDir?.x ?? 1);
    target.setVelocityX(away * BLOCK.pushback);
    if (now - (target.lastBlockSoundAt ?? -Infinity) >= BLOCK.soundGapMs) {
        target.lastBlockSoundAt = now;
        scene.sound.play(blockStyle(target, 'sound'));
        showBlockCue(scene, target);
    }
    if (attacker.isUsingSideSpecial) attacker.hasHitSideSpecial = true;
    if (counters && deferCounter) attacker.pendingCounter = { blocker: target, stunMs };
    else if (counters) counterLaunch(scene, target, attacker, stunMs, realCounter);
    else if (!ranged) attacker.freezeUntil = Math.max(attacker.freezeUntil ?? 0, now + stunMs);
    attacker.blockPenaltyUntil = Math.max(
        attacker.blockPenaltyUntil ?? 0,
        now + getAttackCooldown(attacker) + stunMs
    );
    if (target.shield <= 0) breakShield(scene, target);
    else target.onBlockedHit?.(scene, attacker, { ranged });
    return true;
}

export function releaseCounter(scene, attacker) {
    const pending = attacker.pendingCounter;
    attacker.pendingCounter = null;
    if (!pending || !attacker.active || attacker.eliminated) return false;
    counterLaunch(scene, pending.blocker, attacker, pending.stunMs);
    return true;
}

export function trackDeflectable(scene, object, owner) {
    object.deflectOwner = owner;
    scene.deflectables ??= new Set();
    scene.deflectables.add(object);
    object.once('destroy', () => scene.deflectables?.delete(object));
}

export function deflectables(scene) {
    return scene.deflectables ?? [];
}

export function deflects(scene, target, shooter, damage = 0, { shieldCost = null } = {}) {
    if (!target?.blocking || !blockStyle(target, 'deflects')) return 0;
    const damageScale = target.deflectDamageScale ?? 1;
    blocksHit(scene, target, shooter, damage, { ranged: true, shieldCost });
    return damageScale;
}

export function attackLockedByBlock(scene, attacker) {
    return scene.time.now < (attacker.blockPenaltyUntil ?? 0);
}
