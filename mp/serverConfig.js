// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { cleanInviteCode, getServerSocketUrl } from './protocol.js';
import { DEFAULT_SERVER, SERVERS } from './servers.js';

const SERVER_STORAGE_KEY = 'blockBattleServer';
const PUBLIC_GAME_URL = 'https://arvin2a.github.io/BlockBattle/';
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

export function takeInviteFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.has('join')) return null;
    const code = cleanInviteCode(params.get('join'));
    const server = params.get('server');
    params.delete('join');
    params.delete('server');
    const rest = params.toString();
    history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
    if (!code || (server && !SERVERS[server])) return { error: 'That invite link is broken or out of date.' };
    if (server) selectServer(server);
    return { code };
}

export function makeInviteLink(code) {
    const url = new URL(import.meta.env.DEV ? `${location.origin}${location.pathname}` : PUBLIC_GAME_URL);
    url.searchParams.set('server', selectedServer);
    url.searchParams.set('join', code);
    return url.toString();
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
