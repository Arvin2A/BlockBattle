import { CHARACTER_ATTACK_SCRIPTS } from '../playerAttackScripts/index.js';

export function getCharacterScript(attacker) {
    return CHARACTER_ATTACK_SCRIPTS[attacker.name];
}

// Per-character tuning lives in each attack script. A value in
// variantStats[variant] wins over the script's own value, which wins over fallback.
export function getCharacterStat(attacker, key, fallback) {
    const script = getCharacterScript(attacker);
    return script?.variantStats?.[attacker.variant]?.[key] ?? script?.[key] ?? fallback;
}

export function getAttackCooldown(attacker) {
    return getCharacterStat(attacker, 'attackCooldown', 400);
}

// kind is 'light' (normal hits) or 'finisher' (combo enders). Scripts set these
// in hitSounds; an array picks one at random. Light hits fall back to anyhit,
// finishers stay silent.
export function getHitSound(attacker, kind) {
    const sound = getCharacterStat(attacker, 'hitSounds', null)?.[kind] ??
        (kind === 'light' ? 'anyhit' : null);
    return Array.isArray(sound) ? Phaser.Utils.Array.GetRandom(sound) : sound;
}

export function getAttackDamageScale(attacker) {
    const baseDamageScale = Number.isFinite(attacker.baseDamageScale)
        ? attacker.baseDamageScale
        : 1;
    const externalDamageScale = Number.isFinite(attacker.externalDamageScale)
        ? attacker.externalDamageScale
        : 1;

    const grassDamageScale = attacker.inGrass && attacker.name !== 'SCYTHEMAN'
        ? 0.75
        : 1;
    const scytheGrassCutScale = attacker.name === 'SCYTHEMAN'
        ? 1 + (attacker.grassCutCount || 0) * 0.001
        : 1;

    return baseDamageScale * externalDamageScale * grassDamageScale * scytheGrassCutScale;
}
