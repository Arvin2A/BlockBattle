// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blockBattleDesktop', {
    setStatus: status => ipcRenderer.send('discord-status', status)
});
