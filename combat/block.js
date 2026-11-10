// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { PLAYER_COLORS } from '../matchModes.js';
import { HEX } from '../ui/theme.js';
import { getAttackCooldown } from './characterStats.js';

export const BLOCK = {
    minStart: 0.3,
    drainPerSec: 0.35,
    hitCostScale: 4,
    minHitCost: 0.08,
    maxHitCost: 0.5,
    regrowPerSec: 0.25,
    regrowDelayMs: 500,
    breakStunMs: 1500,
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
    cueMs: 220
};

function isFrozen(scene) {
    return scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
}

function canStartBlock(player) {
    return player.active && !player.hitstun && !player.freeze && !player.ledge &&
        !player.smack && !player.smackedBy && !player.activeGrab && !player.grabbedBy &&
        !player.isAttacking && !player.isUsingSideSpecial &&
        (player.shield ?? 1) >= BLOCK.minStart;
}

function canHoldBlock(player) {
    return player.active && !player.hitstun && !player.ledge && !player.smackedBy && !player.grabbedBy;
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

function breakShield(scene, player) {
    const now = scene.time.now;
    player.blocking = false;
    player.shield = BLOCK.breakRefill;
    player.shieldRegrowAt = now + BLOCK.breakStunMs;
    player.hitstunUntil = Math.max(player.hitstunUntil ?? 0, now + BLOCK.breakStunMs);
    player.willDecelerate = true;
    player.setVelocityX(0);
    scene.sound.play('glassbreak');
    player.shieldBrokenUntil = now + BLOCK.breakStunMs;
    const mark = getBreakMark(scene, player);
    mark.setScale(1.6);
    scene.tweens.add({ targets: mark, scale: 1, duration: 180, ease: 'Back.Out' });
}

function getBreakMark(scene, player) {
    if (!player.shieldBreakMark) {
        const texture = player.color === 'blue' ? 'p2shieldbreak' : 'p1shieldbreak';
        player.shieldBreakMark = scene.add.image(player.x, player.y, texture)
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
    const cue = scene.add.image(player.x, player.y, 'blockshield')
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

export function updateBlock(scene, player, wantsBlock) {
    player.shield ??= 1;
    player.wantsBlock = wantsBlock;
    if (!isFrozen(scene)) {
        const dt = Math.min(scene.game.loop.delta, 50) / 1000;
        if (player.blocking && (!wantsBlock || !canHoldBlock(player))) {
            stopBlock(scene, player);
        } else if (!player.blocking && wantsBlock && canStartBlock(player)) {
            startBlock(scene, player);
        }
        if (player.blocking) {
            player.shield -= BLOCK.drainPerSec * dt;
            player.setVelocityX(player.body.velocity.x * 0.8);
            if (player.shield <= 0) breakShield(scene, player);
        } else if (scene.time.now >= (player.shieldRegrowAt ?? 0)) {
            player.shield = Math.min(1, player.shield + BLOCK.regrowPerSec * dt);
        }
    }
    drawShield(scene, player);
    drawBreakMark(scene, player);
}

function blockStunMs(target, now) {
    const held = Math.max(0, now - (target.blockStartedAt ?? -Infinity));
    const decayed = BLOCK.blockStunStartMs * Math.pow(0.5, held / BLOCK.blockStunHalfLifeMs);
    return Math.max(BLOCK.blockStunFloorMs, decayed);
}

export function blocksHit(scene, target, attacker, damage = 0, { minCost = BLOCK.minHitCost, ranged = false } = {}) {
    if (!target?.blocking) return false;
    const now = scene.time.now;
    target.shield -= Phaser.Math.Clamp(damage * BLOCK.hitCostScale, minCost, BLOCK.maxHitCost);
    target.shieldHitUntil = now + 80;
    target.freezeUntil = Math.max(target.freezeUntil ?? 0, now + blockStunMs(target, now));
    const away = Math.sign(target.x - attacker.x) || (attacker.lastDir?.x ?? 1);
    target.setVelocityX(away * BLOCK.pushback);
    if (now - (target.lastBlockSoundAt ?? -Infinity) >= BLOCK.soundGapMs) {
        target.lastBlockSoundAt = now;
        scene.sound.play('block');
        showBlockCue(scene, target);
    }
    if (attacker.isUsingSideSpecial) attacker.hasHitSideSpecial = true;
    const stunMs = blockStunMs(target, now);
    if (!ranged) attacker.freezeUntil = Math.max(attacker.freezeUntil ?? 0, now + stunMs);
    attacker.blockPenaltyUntil = Math.max(
        attacker.blockPenaltyUntil ?? 0,
        now + getAttackCooldown(attacker) + stunMs
    );
    if (target.shield <= 0) breakShield(scene, target);
    return true;
}

export function attackLockedByBlock(scene, attacker) {
    return scene.time.now < (attacker.blockPenaltyUntil ?? 0);
}
