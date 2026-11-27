// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export const STUN_MAX_MS = 1500;
export const STUN_CHAIN_MAX_MS = 3000;

export function applyStun(scene, target, ms) {
    if (!target?.active || !(ms > 0)) return false;
    const now = scene.time.now;
    if (!target.stunned) target.stunChainStartedAt = now;
    const chainEndsAt = (target.stunChainStartedAt ?? now) + STUN_CHAIN_MAX_MS;
    if (now >= chainEndsAt) return false;
    const until = Math.min(now + ms, now + STUN_MAX_MS, chainEndsAt);
    target.stunUntil = Math.max(target.stunUntil ?? 0, until);
    return true;
}

export function clearStun(target) {
    target.stunUntil = 0;
    target.stunChainStartedAt = 0;
}
