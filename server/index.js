// BlockBattle LAN server.
//
//   npm run lan       (builds the game, then starts this)
//   npm run server    (starts this with the last build)
//
// It does three things:
//   1. Serves the game to every device on your network (http://<this computer>:8080).
//   2. Runs the 1v1 queue (server/lobby.js).
//   3. Hosts every match in a hidden Chrome tab running the real game, so game
//      logic happens here and not on the players' devices (mp/authority.js).
//
// Settings (environment variables):
//   PORT=8080            port to listen on
//   HOST=0.0.0.0         address to listen on (127.0.0.1 when behind Caddy / a Cloudflare Tunnel)
//   BB_ALLOWED_ORIGINS=  comma-separated websites allowed to connect, e.g.
//                        https://arvin2a.github.io,https://yoursite.infinityfreeapp.com
//                        (empty = anyone; pages served by this server are always allowed)
//   BB_MAX_PER_IP=8      connections allowed from one IP address
//   BB_MAX_MATCHES=4     matches that can run at the same time
//   CHROME_PATH=...      Chrome/Chromium/Edge to use if it isn't found automatically
//   BB_GAME_URL=...      page the hidden tabs load (e.g. a Vite dev server, see README)
//   BB_AUTHORITY=manual  don't start Chrome; print each match's URL to open yourself

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createStaticHandler } from './static.js';
import { HeadlessChrome, findChrome } from './chrome.js';
import { Lobby } from './lobby.js';
import { DEFAULT_PORT, MP_PATH } from '../mp/protocol.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PATH = '/BlockBattle/';
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.BB_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
const MAX_PER_IP = Math.max(1, Number(process.env.BB_MAX_PER_IP) || 8);
const MAX_MATCHES = Math.max(1, Number(process.env.BB_MAX_MATCHES) || 4);
const GAME_URL = process.env.BB_GAME_URL || `http://127.0.0.1:${PORT}${BASE_PATH}`;
const MANUAL_AUTHORITY = process.env.BB_AUTHORITY === 'manual';

const log = message => console.log(`[${new Date().toLocaleTimeString()}] ${message}`);

let chrome = null;
if (!MANUAL_AUTHORITY) {
    const chromePath = findChrome();
    if (!chromePath) {
        console.error([
            'Online matches run inside a hidden Chrome window, but no Chrome/Chromium/Edge was found.',
            'Install Google Chrome, or point CHROME_PATH at your browser, e.g.',
            '  CHROME_PATH="/path/to/chrome" npm run server'
        ].join('\n'));
        process.exit(1);
    }
    chrome = new HeadlessChrome(chromePath, log);
}

function authorityUrl(match) {
    const url = new URL(GAME_URL);
    url.searchParams.set('authority', match.id);
    url.searchParams.set('key', match.key);
    return url.toString();
}

const lobby = new Lobby({
    maxMatches: MAX_MATCHES,
    log,
    async launchAuthority(match) {
        const url = authorityUrl(match);
        if (MANUAL_AUTHORITY) {
            log(`Open this to host match ${match.id}: ${url}`);
            return null;
        }
        return chrome.openTab(url);
    },
    closeAuthority(match) {
        if (match.tab) chrome?.closeTab(match.tab);
        match.tab = null;
    }
});

const serveStatic = createStaticHandler(path.join(ROOT, 'dist'), BASE_PATH);
const server = http.createServer((request, response) => {
    if (request.url === `${MP_PATH}/status`) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(lobby.getStatus()));
        return;
    }
    serveStatic(request, response);
});

const isLoopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

// Caddy and Cloudflare Tunnel connect from this same computer and say who the real
// player is in these headers.
const isProxied = request => Boolean(
    request.headers['x-forwarded-for'] || request.headers['cf-connecting-ip'] || request.headers.forwarded
);

function playerAddress(request) {
    const direct = request.socket.remoteAddress;
    if (!isLoopback(direct)) return direct;
    return request.headers['cf-connecting-ip'] ??
        request.headers['x-forwarded-for']?.split(',')[0].trim() ??
        direct;
}

function originAllowed(request) {
    if (!ALLOWED_ORIGINS.length) return true;
    const origin = request.headers.origin;
    if (!origin) return false;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    try {
        return new URL(origin).host === request.headers.host;
    } catch {
        return false;
    }
}

const connectionsPerAddress = new Map();

// Big limit for the match hosts' first frame; players' messages are capped in lobby.js.
const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== MP_PATH || !originAllowed(request)) {
        socket.destroy();
        return;
    }
    sockets.handleUpgrade(request, socket, head, ws => {
        if (url.searchParams.get('role') === 'authority') {
            // Only the hidden tabs on this computer may act as a match host.
            if (!isLoopback(request.socket.remoteAddress) || isProxied(request)) {
                ws.close(1008, 'not allowed');
                return;
            }
            lobby.attachAuthority(ws, url.searchParams.get('match'), url.searchParams.get('key') ?? '');
            return;
        }

        const address = playerAddress(request);
        const count = connectionsPerAddress.get(address) ?? 0;
        if (count >= MAX_PER_IP) {
            ws.close(1008, 'too many connections');
            return;
        }
        connectionsPerAddress.set(address, count + 1);
        ws.on('close', () => {
            const remaining = (connectionsPerAddress.get(address) ?? 1) - 1;
            if (remaining > 0) connectionsPerAddress.set(address, remaining);
            else connectionsPerAddress.delete(address);
        });
        lobby.addClient(ws, address);
    });
});

function lanAddresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter(info => info && info.family === 'IPv4' && !info.internal)
        .map(info => info.address);
}

server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Close the other server or start with PORT=8081.`);
    } else {
        console.error(error);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    const addresses = isLoopback(HOST) ? [] : lanAddresses();
    console.log('');
    console.log('  BlockBattle LAN server is running!');
    console.log('');
    console.log(`  On this computer:        http://localhost:${PORT}${BASE_PATH}`);
    for (const address of addresses) {
        console.log(`  On your network (Wi-Fi): http://${address}:${PORT}${BASE_PATH}`);
    }
    if (isLoopback(HOST)) {
        console.log('  Only reachable through this computer (e.g. your Caddy / Cloudflare Tunnel).');
    } else if (!addresses.length) {
        console.log('  (No network connection found, only this computer can join.)');
    }
    if (ALLOWED_ORIGINS.length) console.log(`  Websites allowed to connect: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('');
    console.log('  Everyone opens that address, clicks ONLINE, then FIND MATCH.');
    console.log('  If others can\'t connect, allow Node.js through this computer\'s firewall.');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
});

let shuttingDown = false;
function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    log('Shutting down...');
    lobby.shutdown();
    chrome?.stop();
    sockets.clients.forEach(ws => ws.terminate());
    server.close();
    setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => chrome?.stop());
