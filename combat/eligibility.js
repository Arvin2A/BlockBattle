// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { isInvincible } from './knockback.js';
import { cutGrassBeforeMaturity } from './grass.js';
import { isBlockedByWall } from './planks.js';

// Every check attackIsElligible makes can be skipped with one of these.
// Pass only the ones you need: attackIsElligible(a, t, 150, { ignoreCanAttack: true }).
export const DEFAULT_BYPASS_OPTIONS = Object.freeze({
    // Hit even while the attacker can't attack or is in hitstun. Used by specials
    // that run on their own timers. The hit is also allowed to land through hitstun.
    ignoreCanAttack: false,
    // Hit a target more than 25px below, whichever way the attacker faces.
    allowTargetBelow: false,
    // Hit through spawn and dash invincibility.
    ignoreInvincibility: false,
    // Range is the only check; direction doesn't matter.
    ignoreFacing: false,
    // Hit through other fighters' walls. Your own walls never block you.
    ignoreWalls: false,
    // A pure check: no flash, no grass cutting, no hitstun bypass. For the bots.
    silent: false,
    // Aim this way instead of attacker.lastDir, as { x, y }.
    direction: null
});

function isFacingTarget(direction, dx, dy, distance, allowTargetBelow) {
    const dot = (dx / distance) * direction.x + (dy / distance) * direction.y;
    const isFacingUp = direction.y < -0.9 && Math.abs(direction.x) < 0.2;
    const isFacingDown = direction.y > 0.9 && Math.abs(direction.x) < 0.2;
    const isTargetAbove = dy < (isFacingUp || isFacingDown ? -25 : -10) && Math.abs(dy) <= 135;
    const isTargetBelow = dy > 25;
    if ((!allowTargetBelow && isTargetBelow && isFacingUp) ||
        (isFacingDown && isTargetAbove)) return false;
    return (allowTargetBelow && isTargetBelow) ||
        dot > 0.7 || isFacingUp || isTargetAbove;
}

export function attackIsElligible(attacker, target, range = 100, bypassOptions = {}) {
    if (typeof bypassOptions !== 'object' || bypassOptions === null) {
        throw new TypeError(
            'attackIsElligible: the 4th argument is now a bypassOptions object, ' +
            'e.g. { ignoreCanAttack: true, allowTargetBelow: true }'
        );
    }
    const {
        ignoreCanAttack,
        allowTargetBelow,
        ignoreInvincibility,
        ignoreFacing,
        ignoreWalls,
        silent,
        direction
    } = { ...DEFAULT_BYPASS_OPTIONS, ...bypassOptions };

    if (!ignoreCanAttack && (!attacker.canAttack || attacker.hitstun)) return false;
    if (!ignoreInvincibility && isInvincible(target)) return false;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return false;
    if (!ignoreWalls && isBlockedByWall(attacker, target)) return false;
    if (!silent) target.flash();

    const eligible = ignoreFacing ||
        isFacingTarget(direction ?? attacker.lastDir, dx, dy, distance, allowTargetBelow);
    if (eligible && !silent) {
        if (ignoreCanAttack) attacker.attackBypassesHitstun = true;
        cutGrassBeforeMaturity(attacker);
    }
    return eligible;
}
