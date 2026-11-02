// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const CLOUDFLARE_TURN_URL = 'https://rtc.live.cloudflare.com/v1/turn/keys';
const CREDENTIAL_TTL_SECONDS = 3600;
const REQUEST_TIMEOUT_MS = 5000;
const BLOCKED_PORT = /:53(\?|$)/;

function isOff(value) {
    return ['false', '0', 'no', 'off'].includes((value ?? '').trim().toLowerCase());
}

function cleanIceServers(iceServers) {
    const list = Array.isArray(iceServers) ? iceServers : [iceServers];
    return list
        .filter(server => server && server.urls)
        .map(server => ({
            ...server,
            urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(url => !BLOCKED_PORT.test(url))
        }))
        .filter(server => server.urls.length > 0);
}

export function describeIceSetup(env) {
    if (isOff(env.BB_FAST_PATH)) return 'off (BB_FAST_PATH=false), WebSocket only';
    if (env.BB_TURN_KEY_ID && env.BB_TURN_API_TOKEN) {
        return isOff(env.BB_TURN_RELAY_ONLY)
            ? 'Cloudflare TURN, direct connections allowed'
            : 'Cloudflare TURN, relay only (addresses stay hidden)';
    }
    return 'direct, no TURN (works on the same network only)';
}

export function createIceProvider(env, log) {
    if (isOff(env.BB_FAST_PATH)) return async () => null;
    const keyId = (env.BB_TURN_KEY_ID ?? '').trim();
    const token = (env.BB_TURN_API_TOKEN ?? '').trim();
    if (!keyId || !token) return async () => ({ servers: [], relayOnly: false });
    const relayOnly = !isOff(env.BB_TURN_RELAY_ONLY);

    return async () => {
        try {
            const response = await fetch(`${CLOUDFLARE_TURN_URL}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });
            if (!response.ok) throw new Error(`Cloudflare answered ${response.status}`);
            const servers = cleanIceServers((await response.json()).iceServers);
            if (servers.length === 0) throw new Error('Cloudflare sent no TURN servers');
            return { servers, relayOnly };
        } catch (error) {
            log(`Could not get TURN credentials (${error.message}). This match uses WebSocket only.`);
            return null;
        }
    };
}
