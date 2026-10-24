// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/serverConfig.js
// Which online server the game talks to (browser only, Node never loads this).
//
// - Page opened from the BlockBattle server itself (npm run lan / your own server):
//   talk to that same server.
// - Page opened from a static site (GitHub Pages, InfinityFree): only possible if the
//   build was given a server address, e.g.  VITE_MP_SERVER=wss://play.example.com/mp
//   (deploy.yml reads it from the MP_SERVER_URL repository variable).
//   VITE_MP_SERVER_NAME (repo variable MP_SERVER_NAME) is the name shown to players,
//   like "NEW YORK".

import { getServerSocketUrl } from './protocol.js';

const CONFIGURED_SERVER = (import.meta.env.VITE_MP_SERVER ?? '').trim();
const CONFIGURED_NAME = (import.meta.env.VITE_MP_SERVER_NAME ?? '').trim().toUpperCase();

export function getOnlineServerUrl() {
    return CONFIGURED_SERVER || getServerSocketUrl();
}

function servedByBlockBattleServer() {
    return Boolean(document.querySelector('meta[name="blockbattle-server"]'));
}

// Whether this copy of the game knows of any server to play on.
export function isOnlineConfigured() {
    // import.meta.env.DEV: "npm run dev", where Vite forwards /mp to a local server.
    return Boolean(CONFIGURED_SERVER) || servedByBlockBattleServer() || import.meta.env.DEV;
}

// True when playing through a public server rather than a LAN one.
export function usesRemoteServer() {
    return Boolean(CONFIGURED_SERVER);
}

// Short name shown to players, e.g. "NEW YORK" or "LAN".
export function getServerName() {
    if (CONFIGURED_NAME) return CONFIGURED_NAME;
    return usesRemoteServer() ? 'ONLINE' : 'LAN';
}

export function getOnlineServerHost() {
    try {
        return new URL(getOnlineServerUrl()).host;
    } catch {
        return location.host;
    }
}

// Asks the server how it's doing (its /mp/status page).
// Resolves { online, queued, matches }, or null if it's off/unreachable. Never throws.
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
