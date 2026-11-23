// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const POLL_MS = 2000;

const SCENE_STATUS = [
    ['OnlineGameScene', { details: 'In an online match', match: true }],
    ['GameScene', { details: 'In a local match', match: true }],
    ['CharacterSelectScene', { details: 'Picking a fighter' }],
    ['MapAndModifierSelectScene', { details: 'Picking a map' }],
    ['OnlineLobbyScene', { details: 'In the online menu' }],
    ['AchievementsScene', { details: 'Checking achievements' }],
    ['MenuScene', { details: 'In the main menu' }]
];

export function startDesktopPresence(game) {
    const desktop = window.blockBattleDesktop;
    if (!desktop?.setStatus) return;
    let lastKey = null;
    let startTimestamp = null;
    const update = () => {
        const active = new Set(game.scene.getScenes(true).map(scene => scene.sys.settings.key));
        const entry = SCENE_STATUS.find(([key]) => active.has(key));
        const key = entry?.[0] ?? null;
        if (key === lastKey) return;
        lastKey = key;
        if (!entry) {
            desktop.setStatus(null);
            return;
        }
        const { details, match } = entry[1];
        startTimestamp = match ? Date.now() : null;
        desktop.setStatus({ details, startTimestamp: startTimestamp ?? undefined });
    };
    update();
    setInterval(update, POLL_MS);
}
