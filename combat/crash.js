// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { SQUASH, kickSquash } from './squash.js';
import { clearLaunchArc } from './knockback.js';
import { getKnockbackResistance } from './characterStats.js';
import { spawnHitParticles } from './effects.js';
import { scheduleDecelerate } from './blueprints.js';

export const CRASH = {
    minSpeed: 600,
    rebound: 0.6,
    maxRebound: 550,
    stunMs: 220,
    holdMs: 90
};

function isExempt(player) {
    return Boolean(!player.body.enable || player.freeze || player.downslamming || player.isUsingSideSpecial ||
        player.ledge || player.ledgeSlide || player.grabbedBy || player.activeGrab ||
        player.smackedBy || player.smackArc);
}

function impactSpeed(velocity, hitPositive, hitNegative) {
    if (Math.abs(velocity) <= CRASH.minSpeed) return 0;
    return (velocity > 0 ? hitPositive : hitNegative) ? velocity : 0;
}

function reboundFrom(impact, resistance) {
    return -Math.sign(impact) * Math.min(Math.abs(impact) * CRASH.rebound, CRASH.maxRebound) / resistance;
}

function crash(scene, player, impactX) {
    const vx = reboundFrom(impactX, getKnockbackResistance(player));
    const vy = player.body.velocity.y;
    const now = scene.time.now;
    clearLaunchArc(player);
    player.setVelocity(vx, vy);
    player.hitstunUntil = Math.max(player.hitstunUntil ?? 0, now + CRASH.stunMs);
    player.willDecelerate = false;
    scheduleDecelerate(scene, player, player.hitstunUntil - now);
    kickSquash(player, SQUASH.limit, CRASH.holdMs);
    spawnHitParticles(scene, player, vx, vy);
}

export function updateCrashes(scene, players) {
    const frozen = scene.gamePaused || scene.hitFreezeUntil > scene.time.now;
    for (const player of players) {
        if (!player?.active || !player.body) continue;
        const body = player.body;
        const last = player.crashTrack;
        if (!frozen && last && !last.exempt && !isExempt(player)) {
            const { touching, blocked } = body;
            const impactX = impactSpeed(last.x, touching.right || blocked.right, touching.left || blocked.left);
            const impactY = impactSpeed(last.y, touching.down || blocked.down || player.tunnelCaught, touching.up || blocked.up);
            if (impactX) crash(scene, player, impactX);
            else if (impactY) kickSquash(player, -SQUASH.limit, CRASH.holdMs);
        }
        player.tunnelCaught = false;
        player.crashTrack = { x: body.velocity.x, y: body.velocity.y, exempt: isExempt(player) };
    }
}
