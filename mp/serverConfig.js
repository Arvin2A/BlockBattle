// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getServerSocketUrl } from './protocol.js';
import { DEFAULT_SERVER, SERVERS } from './servers.js';

const SERVER_STORAGE_KEY = 'blockBattleServer';
const ONLINE_ENABLED = import.meta.env.VITE_MP_ONLINE === 'true' || Boolean((import.meta.env.VITE_MP_SERVER ?? '').trim());

let selectedServer = readSavedServer();

function readSavedServer() {
    try {
        const saved = localStorage.getItem(SERVER_STORAGE_KEY);
        return SERVERS[saved] ? saved : DEFAULT_SERVER;
    } catch {
        return DEFAULT_SERVER;
    }
}

export function getServers() {
    return Object.entries(SERVERS).map(([id, server]) => ({ id, ...server }));
}

export function getSelectedServerId() {
    return selectedServer;
}

export function selectServer(id) {
    if (!SERVERS[id]) return false;
    selectedServer = id;
    try {
        localStorage.setItem(SERVER_STORAGE_KEY, id);
    } catch {}
    return true;
}

export function getOnlineServerUrl() {
    return ONLINE_ENABLED ? SERVERS[selectedServer].url : getServerSocketUrl();
}

export function isOnlineConfigured() {
    return ONLINE_ENABLED || import.meta.env.DEV;
}

export function getServerName() {
    return ONLINE_ENABLED ? SERVERS[selectedServer].name : 'ONLINE';
}

export function getOnlineServerHost() {
    try {
        return new URL(getOnlineServerUrl()).host;
    } catch {
        return location.host;
    }
}

export function getOnlineHttpUrl(route) {
    const url = new URL(getOnlineServerUrl());
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${route}`;
    return url;
}

// Asks the server how it's doing (its /mp/status page).
// Resolves { online, waiting, quick, lobbies, matches }, or null if it's off/unreachable. Never throws.
export async function fetchServerStatus(timeoutMs = 4000) {
    if (!isOnlineConfigured()) return null;
    const url = new URL(getOnlineServerUrl());
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
