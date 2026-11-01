// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export let botMode = false;
// Bot vs bot: P2 is the usual CPU and P1 is a second one. Only on while botMode is.
export let simulationMode = false;

export function changeBotMode(newBotMode, newSimulationMode = false) {
    botMode = newBotMode;
    simulationMode = newBotMode && newSimulationMode;
}

// How well each CPU plays, by player id. Kept until the page is reloaded.
// HARD is the full-strength bot from before the tiers existed.
export const BOT_DIFFICULTIES = ['EASY', 'NORMAL', 'HARD'];
export const botDifficulty = { 1: 'HARD', 2: 'HARD' };

export function setBotDifficulty(playerID, difficulty) {
    botDifficulty[playerID] = difficulty;
}
