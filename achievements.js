// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHARACTER_ROSTER } from './characterRoster.js';
import { getCharacterTexture } from './characterTextures.js';

const STORAGE_KEY = 'blockBattleAchievements';
const QUALIFYING_CPU = ['NORMAL', 'HARD', 'VERY HARD'];
const ONLINE_MIN_DAMAGE = 30;
const BOT_MASTER_LEVELS = [
    { id: 'BOT_MASTER_I', numeral: 'I', difficulty: 'EASY', reward: 'NONE' },
    { id: 'BOT_MASTER_II', numeral: 'II', difficulty: 'NORMAL', reward: 'NONE' },
    { id: 'BOT_MASTER_III', numeral: 'III', difficulty: 'HARD', reward: 'NONE' },
    { id: 'BOT_MASTER_IV', numeral: 'IV', difficulty: 'VERY HARD', reward: '???' }
];

const BOT_TARGETS = CHARACTER_ROSTER.flatMap(character =>
    character.variants.map(variant => `${character.key}:${variant.name}`));

export function botTargetKey(characterKey, variantName) {
    return `${characterKey}:${variantName}`;
}

function cleanBotTarget(entry) {
    if (typeof entry !== 'string') return null;
    if (BOT_TARGETS.includes(entry)) return entry;
    const character = CHARACTER_ROSTER.find(each => each.key === entry);
    return character ? botTargetKey(character.key, character.variants[0].name) : null;
}

const fighterName = (characterKey, variantName) => {
    const character = CHARACTER_ROSTER.find(entry => entry.key === characterKey);
    return `${variantName} ${character?.name ?? characterKey.toUpperCase()}`;
};

const playingAs = (result, characterKey, variantName) =>
    result.character === characterKey && result.variant === variantName;

function variantUnlock({ id, name, as, unlocks, description, goal = 1, counts }) {
    return {
        id,
        name,
        icon: getCharacterTexture(unlocks[0], unlocks[1]),
        description: `As ${fighterName(...as)}, ${description}`,
        reward: `UNLOCKS ${fighterName(...unlocks)}`,
        unlocks: { character: unlocks[0], variant: unlocks[1] },
        goal,
        counts: result => (result.qualifies && playingAs(result, ...as) ? counts(result) : 0)
    };
}

export const ACHIEVEMENTS = [
    variantUnlock({
        id: 'UNLOCK_CHAINSAW',
        name: 'NOT A SCRATCH',
        as: ['axeman', 'LUMBERER'],
        unlocks: ['axeman', 'CHAINSAW'],
        description: 'win a match without getting KO\'d once.',
        counts: result => (result.won && result.timesKOd === 0 ? 1 : 0)
    }),
    variantUnlock({
        id: 'UNLOCK_LAWNMOWER',
        name: 'FRESH CUT',
        as: ['scytheman', 'LANDSCAPER'],
        unlocks: ['scytheman', 'LAWNMOWER'],
        description: 'win a match after cutting 100 grass in it.',
        counts: result => (result.won && result.grassCut >= 100 ? 1 : 0)
    }),
    variantUnlock({
        id: 'UNLOCK_TRAPPER',
        name: 'MASTER-BAITER',
        as: ['fisherman', 'ANGLER'],
        unlocks: ['fisherman', 'TRAPPER'],
        description: 'KO someone while you\'re still at 0% KB.',
        counts: result => (result.untouchedKO ? 1 : 0)
    }),
    variantUnlock({
        id: 'UNLOCK_DAGGER',
        name: 'EN GARDE',
        as: ['swordman', 'LONGSWORD'],
        unlocks: ['swordman', 'DAGGER'],
        description: 'win a match with 5 SWORD GUARD counters.',
        counts: result => (result.won && result.counters >= 5 ? 1 : 0)
    }),
    variantUnlock({
        id: 'UNLOCK_SLEDGEHAMMER',
        name: 'BARELY BRUISED',
        as: ['hammerman', 'MALLET'],
        unlocks: ['hammerman', 'SLEDGEHAMMER'],
        description: 'win a match while you\'re below 0% KB.',
        counts: result => (result.won && result.finalKB < 1 ? 1 : 0)
    }),
    variantUnlock({
        id: 'UNLOCK_DEMOLITIONIST',
        name: 'SPECIAL DELIVERY',
        as: ['crowbarman', 'HOOKER'],
        unlocks: ['crowbarman', 'DEMOLITIONIST'],
        description: 'win a match where you KO someone with a GRAB fling.',
        counts: result => (result.won && result.flingKO ? 1 : 0)
    }),
    {
        id: 'BLOCK_HEAD',
        name: 'WHAT A DAMN BLOCKHEAD!',
        icon: 'achievement_BlockHead',
        description: 'Block 500 hits in total.',
        reward: 'NONE',
        goal: 500,
        counts: result => (result.qualifies ? result.blocks : 0)
    },
    ...BOT_MASTER_LEVELS.map(level => ({
        id: level.id,
        name: `BOT MASTER ${level.numeral}`,
        icon: `achievement_BotMaster${level.numeral}`,
        description: `Beat every fighter and every variant as a ${level.difficulty} CPU, one by one. Any fighter of yours works.`,
        reward: level.reward,
        goal: BOT_TARGETS.length,
        botDifficulty: level.difficulty
    }))
];

export const ACHIEVEMENT_RULES = 'Only counts with no modifiers, online or against a NORMAL CPU or harder. BOT MASTER counts against any CPU, still with no modifiers. Online, you also need to deal 30% damage. If anyone in the match is AFK or gone for half of it, it does not count for anybody.';

export const ACHIEVEMENT_ICONS = [
    'achievement_BlockHead',
    ...BOT_MASTER_LEVELS.map(level => `achievement_BotMaster${level.numeral}`)
];

function emptySave() {
    return { done: {}, progress: {}, botWins: {} };
}

function cleanSave(raw, reached = []) {
    const save = emptySave();
    if (!raw || typeof raw !== 'object') return save;
    for (const achievement of ACHIEVEMENTS) {
        if (raw.done?.[achievement.id] === true) save.done[achievement.id] = true;
        const progress = Number(raw.progress?.[achievement.id]);
        if (Number.isFinite(progress) && progress > 0) save.progress[achievement.id] = Math.min(achievement.goal, Math.floor(progress));
        if (!achievement.botDifficulty && save.progress[achievement.id] >= achievement.goal) {
            save.done[achievement.id] = true;
            delete save.progress[achievement.id];
            reached.push(achievement);
        }
    }
    for (const level of BOT_MASTER_LEVELS) {
        const wins = raw.botWins?.[level.difficulty];
        if (!Array.isArray(wins)) continue;
        save.botWins[level.difficulty] = [...new Set(wins.map(cleanBotTarget).filter(Boolean))];
    }
    return save;
}

let reachedOnLoad = [];

function loadSave() {
    try {
        return cleanSave(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), reachedOnLoad);
    } catch {
        return emptySave();
    }
}

let save = loadSave();
if (reachedOnLoad.length) writeSave();

function writeSave() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
    }
}

export function getAchievementProgress(achievement) {
    if (achievement.botDifficulty) return save.botWins[achievement.botDifficulty]?.length ?? 0;
    return save.done[achievement.id] ? achievement.goal : save.progress[achievement.id] ?? 0;
}

export function takeUnlocksReachedOnLoad() {
    const updates = reachedOnLoad.map(achievement => ({ achievement, before: achievement.goal, after: achievement.goal, completed: true }));
    reachedOnLoad = [];
    return updates;
}

export function getBotWins(difficulty) {
    return [...(save.botWins[difficulty] ?? [])];
}

export function getBotMasterAchievement(difficulty) {
    return ACHIEVEMENTS.find(achievement => achievement.botDifficulty === difficulty) ?? null;
}

export function isAchievementDone(achievement) {
    return Boolean(save.done[achievement.id]);
}

export function countDoneAchievements() {
    return ACHIEVEMENTS.filter(isAchievementDone).length;
}

export function isVariantUnlocked(characterKey, variantName) {
    const character = CHARACTER_ROSTER.find(entry => entry.key === characterKey);
    if (!character || character.variants[0]?.name === variantName) return true;
    const unlock = ACHIEVEMENTS.find(achievement =>
        achievement.unlocks?.character === characterKey && achievement.unlocks.variant === variantName);
    return !unlock || isAchievementDone(unlock);
}

export function getVariantUnlockAchievement(characterKey, variantName) {
    return ACHIEVEMENTS.find(achievement =>
        achievement.unlocks?.character === characterKey && achievement.unlocks.variant === variantName) ?? null;
}

function finishIfReached(achievement, finished) {
    if (save.done[achievement.id] || getAchievementProgress(achievement) < achievement.goal) return;
    save.done[achievement.id] = true;
    delete save.progress[achievement.id];
    finished.push(achievement);
}

export function recordMatchResult(result) {
    if (!result) return [];
    const finished = [];
    const updates = [];
    for (const achievement of ACHIEVEMENTS) {
        if (save.done[achievement.id]) continue;
        const before = getAchievementProgress(achievement);
        if (achievement.botDifficulty) {
            if (!result.won || result.cpuDifficulty !== achievement.botDifficulty || !result.noModifiers) continue;
            const wins = save.botWins[achievement.botDifficulty] ??= [];
            const target = result.cpuCharacter && result.cpuVariant ? botTargetKey(result.cpuCharacter, result.cpuVariant) : null;
            if (target && BOT_TARGETS.includes(target) && !wins.includes(target)) wins.push(target);
        } else {
            const gained = achievement.counts(result);
            if (!(gained > 0)) continue;
            save.progress[achievement.id] = Math.min(achievement.goal, (save.progress[achievement.id] ?? 0) + gained);
        }
        finishIfReached(achievement, finished);
        const after = getAchievementProgress(achievement);
        const completed = Boolean(save.done[achievement.id]);
        if (after > before || completed) updates.push({ achievement, before, after, completed });
    }
    writeSave();
    return updates;
}

export function qualifiesForAchievements({ online, noModifiers, cpuDifficulty, damageDealt = 0 }) {
    if (!noModifiers) return false;
    if (online) return damageDealt >= ONLINE_MIN_DAMAGE;
    return QUALIFYING_CPU.includes(cpuDifficulty);
}

export function getSaveData() {
    return JSON.stringify(save);
}

export function mergeSaveData(text) {
    let incoming;
    try {
        incoming = cleanSave(JSON.parse(text));
    } catch {
        return false;
    }
    const merged = emptySave();
    for (const achievement of ACHIEVEMENTS) {
        if (save.done[achievement.id] || incoming.done[achievement.id]) merged.done[achievement.id] = true;
        else {
            const progress = Math.max(save.progress[achievement.id] ?? 0, incoming.progress[achievement.id] ?? 0);
            if (progress > 0) merged.progress[achievement.id] = progress;
        }
    }
    for (const level of BOT_MASTER_LEVELS) {
        const wins = new Set([...(save.botWins[level.difficulty] ?? []), ...(incoming.botWins[level.difficulty] ?? [])]);
        if (wins.size) merged.botWins[level.difficulty] = [...wins];
    }
    save = merged;
    writeSave();
    return true;
}
