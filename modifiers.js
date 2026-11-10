// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const CLICK_VALUE_FORMATS = {
    damage: value => `${value}x`,
    speed: value => `+${value}%`
};

const clickModifier = (name, description, tier, stat, step, steps) => ({
    name,
    description,
    tier,
    enabled: false,
    value: step,
    clicker: { stat, step, steps }
});

export const modifierOptions = {
    NO_ABILITY_COOLDOWN: {
        name: 'NO ABILITY COOLDOWNS',
        description: 'spam spam spam spam spams spam sapm.',
        tier: 'purple',
        enabled: false
    },
    NO_GRAVITY_FRICTION: {
        name: 'NO GRAVITY + FRICTION',
        description: 'Remember the hitstun bugs? They are a feature now.',
        tier: 'purple',
        enabled: false
    },

    FAST: {
        name: 'FAST',
        description: '200% Movement Speed and Halved Cooldowns.',
        tier: 'red',
        enabled: false
    },
    MAP_HAZARDS: {
        name: 'WEATHER HAZARDS',
        description: 'Maps now have a chance for disasters to occur!',
        tier: 'red',
        enabled: false
    },
    SUDDEN_DEATH: {
        name: 'SUDDEN DEATH',
        description: 'Players start off with 300% damage.',
        tier: 'red',
        enabled: false
    },
	INFINITE_BRIDGE: {
        name: 'INFINITE BRIDGE',
        description: 'A snowy bridge that never ends, with speedometers.',
        tier: 'misc',
        onlineAllowed: false,
        enabled: false
    },
    NO_VERTICAL_KILLZONE: {
        name: 'NO VERTICAL KILLZONE',
        description: 'No kill zones above or below. COLLISION ON makes them solid walls.',
        tier: 'purple',
        enabled: false,
        collisions: false,
        collisionToggle: true
    },
    NO_HORIZONTAL_KILLZONE: {
        name: 'NO HORIZONTAL KILLZONE',
        description: 'No kill zones left or right. COLLISION ON makes them solid walls.',
        tier: 'purple',
        enabled: false,
        collisions: false,
        collisionToggle: true
    },
    CUSTOM_DAMAGE_S: clickModifier('CUSTOM DAMAGE S', 'Multiplies all damage. Click the box for +5x, up to 50x.', 'purple', 'damage', 5, 10),
    CUSTOM_SPEED_S: clickModifier('CUSTOM SPEED S', 'Adds movement speed. Click the box for +500%, up to +5000%.', 'purple', 'speed', 500, 10),    CUSTOM_DAMAGE_A: clickModifier('CUSTOM DAMAGE A', 'Multiplies all damage. Click the box for +1x, up to 10x.', 'red', 'damage', 1, 10),
    CUSTOM_SPEED_A: clickModifier('CUSTOM SPEED A', 'Adds movement speed. Click the box for +50%, up to +500%.', 'red', 'speed', 50, 10),
    DOUBLE_DAMAGE: {
        name: 'DOUBLE DAMAGE',
        description: 'Players deal 200% more damage.',
        tier: 'orange',
        enabled: false
    },
    CUSTOM_DAMAGE_R: clickModifier('CUSTOM DAMAGE R', 'Multiplies all damage. Click the box for +0.1x, up to 1x.', 'yellow', 'damage', 0.1, 10),
    CUSTOM_SPEED_R: clickModifier('CUSTOM SPEED R', 'Adds movement speed. Click the box for +10%, up to +100%.', 'yellow', 'speed', 10, 10),
    SLUGGISH: {
        name: 'SLUGGISH',
        description: 'Players have 50% Movement Speed.',
        tier: 'yellow',
        enabled: false
    },
    SUPER_SLUGGISH: {
        name: 'SUPER SLUGGISH',
        description: 'Players have 25% Movement Speed. Why bro??',
        tier: 'yellow',
        enabled: false
    }
};

const NULLIFIED_WHEN = {
    SLUGGISH: options => options.SUPER_SLUGGISH.enabled,
    NO_HORIZONTAL_KILLZONE: (_options, map) => Boolean(map?.infinite)
};

export function formatModifierValue(modifier) {
    return CLICK_VALUE_FORMATS[modifier.clicker.stat](modifier.value);
}

export function getEnabledCustomValues(stat) {
    return Object.values(modifierOptions)
        .filter(modifier => modifier.enabled && modifier.clicker?.stat === stat)
        .map(modifier => modifier.value);
}

export function getActiveModifierCards(map) {
    return Object.entries(modifierOptions)
        .filter(([, modifier]) => modifier.enabled)
        .map(([key, modifier]) => ({
            name: modifier.name,
            tier: modifier.tier,
            value: modifier.clicker ? formatModifierValue(modifier) : null,
            nullified: Boolean(NULLIFIED_WHEN[key]?.(modifierOptions, map))
        }));
}

export function isValidClickValue(modifier, value) {
    const { step, steps } = modifier.clicker;
    if (!Number.isFinite(value)) return false;
    const clicks = value / step;
    return Math.abs(clicks - Math.round(clicks)) < 1e-6 && clicks >= 1 - 1e-6 && clicks <= steps + 1e-6;
}

export function sanitizeOnlineModifiers(selection) {
    if (!Array.isArray(selection) || selection.length > Object.keys(modifierOptions).length) return null;
    const seen = new Set();
    const cleaned = [];
    for (const entry of selection) {
        const key = entry?.key;
        if (typeof key !== 'string' || !Object.hasOwn(modifierOptions, key) || seen.has(key)) return null;
        const modifier = modifierOptions[key];
        if (modifier.onlineAllowed === false) return null;
        seen.add(key);
        const item = { key };
        if (modifier.clicker) {
            if (!isValidClickValue(modifier, entry.value)) return null;
            item.value = entry.value;
        }
        if (modifier.collisionToggle) item.collisions = Boolean(entry.collisions);
        cleaned.push(item);
    }
    if (seen.has('NO_VERTICAL_KILLZONE') && seen.has('NO_HORIZONTAL_KILLZONE')) return null;
    return cleaned;
}

export function applyModifierSelection(selection) {
    for (const { key, value, collisions } of selection ?? []) {
        const modifier = modifierOptions[key];
        if (!modifier) continue;
        modifier.enabled = true;
        if (value !== undefined) modifier.value = value;
        if (collisions !== undefined) modifier.collisions = collisions;
    }
}
