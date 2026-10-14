// mp/serverConfig.js
// Which online server the game talks to (browser only, Node never loads this).
//
// - Page opened from the BlockBattle server itself (npm run lan / your own server):
//   talk to that same server.
// - Page opened from a static site (GitHub Pages, InfinityFree): only possible if the
//   build was given a server address, e.g.  VITE_MP_SERVER=wss://play.example.com/mp
//   (deploy.yml reads it from the MP_SERVER_URL repository variable).
//   Without one, the ONLINE button is hidden on those sites.

import { getServerSocketUrl } from './protocol.js';

const CONFIGURED_SERVER = (import.meta.env.VITE_MP_SERVER ?? '').trim();

export function getOnlineServerUrl() {
    return CONFIGURED_SERVER || getServerSocketUrl();
}

function servedByBlockBattleServer() {
    return Boolean(document.querySelector('meta[name="blockbattle-server"]'));
}

export function isOnlineAvailable() {
    // import.meta.env.DEV: "npm run dev", where Vite forwards /mp to a local server.
    return Boolean(CONFIGURED_SERVER) || servedByBlockBattleServer() || import.meta.env.DEV;
}

// Asks the server if it's up (its /mp/status page). Resolves true/false, never throws.
export async function checkServerOnline(timeoutMs = 4000) {
    if (!isOnlineAvailable()) return false;
    const url = new URL(getOnlineServerUrl());
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// True when playing through a public server rather than a LAN one.
export function usesRemoteServer() {
    return Boolean(CONFIGURED_SERVER);
}

export function getOnlineServerHost() {
    try {
        return new URL(getOnlineServerUrl()).host;
    } catch {
        return location.host;
    }
}
