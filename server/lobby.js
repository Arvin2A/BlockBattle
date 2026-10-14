// The 1v1 queue and every running match.
//
// A match goes:  queue -> matchFound -> authority tab boots + both players load
//                -> start -> (inputs in, mirror frames out) -> end
//
// Players only ever send: who they are, queue/leave, button states, forfeit.
// All game results come from the authority tab, never from a player.

import crypto from 'node:crypto';
import { WebSocket } from 'ws';
import { ALL_BUTTONS_MASK } from '../input.js';
import { isValidSelection } from '../characterRoster.js';
import { cleanName, END_REASONS, MAP_CHOICES, PROTOCOL_VERSION } from '../mp/protocol.js';

const BOOT_TIMEOUT_MS = 45000;
const END_LINGER_MS = 4000;
const MAX_MESSAGES_PER_SECOND = 300;
const MAX_PLAYER_MESSAGE_BYTES = 2048;

const randomId = (bytes = 6) => crypto.randomBytes(bytes).toString('hex');

function sendJson(ws, message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function pickMap(a, b) {
    const options = [a, b].filter(choice => choice !== 'RANDOM');
    if (!options.length) return Math.random() < 0.5 ? 'DESERT' : 'SNOWY';
    return options[Math.floor(Math.random() * options.length)];
}

export class Lobby {
    constructor({ launchAuthority, closeAuthority, maxMatches, log }) {
        this.launchAuthority = launchAuthority;
        this.closeAuthority = closeAuthority;
        this.maxMatches = maxMatches;
        this.log = log;
        this.clients = new Map();
        this.queue = [];
        this.matches = new Map();
        this.statusTimer = setInterval(() => this.broadcastStatus(), 2000);
    }

    // ---- players ----

    addClient(ws, address) {
        const client = {
            id: randomId(4),
            ws,
            address,
            greeted: false,
            name: 'Player',
            choice: null,
            state: 'idle', // idle | queued | match
            match: null,
            // The match that just ended, still shown behind the results screen.
            watching: null,
            slot: null,
            messageCount: 0,
            messageWindow: Date.now()
        };
        this.clients.set(client.id, client);

        ws.on('message', (data, isBinary) => {
            if (isBinary || data.length > MAX_PLAYER_MESSAGE_BYTES) return;
            if (!this.withinRateLimit(client)) return;
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch {
                return;
            }
            if (message && typeof message === 'object') this.handleClientMessage(client, message);
        });
        ws.on('close', () => this.removeClient(client));
        ws.on('error', () => {});
    }

    withinRateLimit(client) {
        const now = Date.now();
        if (now - client.messageWindow >= 1000) {
            client.messageWindow = now;
            client.messageCount = 0;
        }
        client.messageCount++;
        if (client.messageCount > MAX_MESSAGES_PER_SECOND) {
            if (client.messageCount === MAX_MESSAGES_PER_SECOND + 1) {
                this.log(`Ignoring spam from ${client.address}`);
            }
            return false;
        }
        return true;
    }

    handleClientMessage(client, message) {
        if (!client.greeted) {
            if (message.t !== 'hello') return;
            if (message.v !== PROTOCOL_VERSION) {
                sendJson(client.ws, { t: 'error', msg: 'Your game is out of date with the server. Refresh the page.' });
                client.ws.close();
                return;
            }
            client.greeted = true;
            sendJson(client.ws, { t: 'welcome', id: client.id });
            this.sendStatus(client);
            return;
        }

        switch (message.t) {
            case 'ping':
                if (typeof message.c === 'number') sendJson(client.ws, { t: 'pong', c: message.c });
                break;
            case 'queue':
                client.watching = null;
                this.enqueue(client, message);
                break;
            case 'leave':
                client.watching = null;
                this.dequeue(client);
                sendJson(client.ws, { t: 'left' });
                break;
            case 'loaded':
                if (client.match) this.markLoaded(client.match, client);
                break;
            case 'in':
                this.forwardInput(client, message);
                break;
            case 'forfeit':
                client.watching = null;
                if (client.match) this.forfeit(client.match, client.slot, END_REASONS.FORFEIT);
                break;
        }
    }

    removeClient(client) {
        this.clients.delete(client.id);
        this.dequeue(client);
        if (client.match) this.forfeit(client.match, client.slot, END_REASONS.DISCONNECT);
        this.broadcastStatus();
    }

    // ---- queue ----

    enqueue(client, message) {
        if (client.state !== 'idle') return;
        const character = String(message.character ?? '');
        const variant = String(message.variant ?? '');
        if (!isValidSelection(character, variant)) {
            sendJson(client.ws, { t: 'error', msg: 'That fighter does not exist on this server. Refresh the page.' });
            return;
        }
        client.name = cleanName(message.name);
        client.choice = {
            character,
            variant,
            map: MAP_CHOICES.includes(message.map) ? message.map : 'RANDOM'
        };
        client.state = 'queued';
        this.queue.push(client);
        this.log(`${client.name} (${character} ${variant}) joined the queue`);
        this.matchmake();
        this.sendQueuePositions();
    }

    dequeue(client) {
        const index = this.queue.indexOf(client);
        if (index === -1) return;
        this.queue.splice(index, 1);
        client.state = 'idle';
        this.sendQueuePositions();
    }

    sendQueuePositions() {
        this.queue.forEach((client, index) => {
            sendJson(client.ws, { t: 'queued', pos: index + 1, size: this.queue.length });
        });
        this.broadcastStatus();
    }

    matchmake() {
        while (this.queue.length >= 2 && this.matches.size < this.maxMatches) {
            const p1 = this.queue.shift();
            const p2 = this.queue.shift();
            this.createMatch(p1, p2);
        }
        if (this.queue.length >= 2) {
            for (const client of this.queue) {
                sendJson(client.ws, { t: 'error', msg: 'All arenas on this server are busy, you will be matched when one frees up.' });
            }
        }
    }

    // ---- matches ----

    createMatch(p1, p2) {
        const match = {
            id: randomId(),
            key: randomId(16),
            players: { p1, p2 },
            map: pickMap(p1.choice.map, p2.choice.map),
            state: 'booting', // booting | running | ended
            authority: null,
            authorityReady: false,
            tab: null,
            loaded: new Set(),
            bootTimer: null
        };
        this.matches.set(match.id, match);

        for (const [slot, client] of Object.entries(match.players)) {
            const opponent = slot === 'p1' ? p2 : p1;
            client.state = 'match';
            client.match = match;
            client.slot = slot;
            sendJson(client.ws, {
                t: 'matchFound',
                matchId: match.id,
                slot,
                map: match.map,
                opponent: { name: opponent.name, ...opponent.choice }
            });
        }
        this.log(`Match ${match.id}: ${p1.name} vs ${p2.name} on ${match.map}`);

        match.bootTimer = setTimeout(() => {
            if (match.state === 'booting') {
                this.log(`Match ${match.id} took too long to start`);
                this.endMatch(match, null, END_REASONS.SERVER_ERROR);
            }
        }, BOOT_TIMEOUT_MS);

        Promise.resolve(this.launchAuthority(match))
            .then(tab => {
                match.tab = tab;
                if (match.state === 'ended') this.closeAuthority(match);
            })
            .catch(error => {
                this.log(`Match ${match.id}: could not start the game host: ${error.message}`);
                this.endMatch(match, null, END_REASONS.SERVER_ERROR);
            });
        this.broadcastStatus();
    }

    // Called for the hidden tab's connection (already checked to be local).
    attachAuthority(ws, matchId, key) {
        const match = this.matches.get(matchId);
        const expected = Buffer.from(match?.key ?? '');
        const given = Buffer.from(String(key));
        if (!match || match.authority || match.state !== 'booting' ||
            expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
            ws.close(1008, 'unknown match');
            return;
        }
        match.authority = ws;

        ws.on('message', (data, isBinary) => {
            if (isBinary) return;
            const text = data.toString();
            // Mirror frames go straight through to both players without re-parsing.
            if (text.startsWith('{"t":"m"')) {
                for (const client of Object.values(match.players)) {
                    const inMatch = client.match === match || client.watching === match;
                    if (inMatch && client.ws.readyState === WebSocket.OPEN) client.ws.send(text);
                }
                return;
            }
            if (match.state === 'ended') return;
            let message;
            try {
                message = JSON.parse(text);
            } catch {
                return;
            }
            if (message.t === 'hello') {
                const { p1, p2 } = match.players;
                sendJson(ws, {
                    t: 'config',
                    map: match.map,
                    p1: { name: p1.name, ...p1.choice },
                    p2: { name: p2.name, ...p2.choice }
                });
            } else if (message.t === 'ready') {
                match.authorityReady = true;
                this.tryStart(match);
            } else if (message.t === 'end' && (message.winner === 'p1' || message.winner === 'p2')) {
                this.endMatch(match, message.winner, END_REASONS.KO);
            }
        });
        ws.on('close', () => {
            if (match.state !== 'ended') {
                this.log(`Match ${match.id}: the game host closed unexpectedly`);
                this.endMatch(match, null, END_REASONS.SERVER_ERROR);
            }
        });
        ws.on('error', () => {});
    }

    markLoaded(match, client) {
        match.loaded.add(client.slot);
        this.tryStart(match);
    }

    tryStart(match) {
        if (match.state !== 'booting' || !match.authorityReady || match.loaded.size < 2) return;
        match.state = 'running';
        clearTimeout(match.bootTimer);
        sendJson(match.authority, { t: 'start' });
        for (const client of Object.values(match.players)) {
            sendJson(client.ws, { t: 'matchStart' });
        }
        this.log(`Match ${match.id} started`);
    }

    forwardInput(client, message) {
        const match = client.match;
        if (!match || match.state !== 'running') return;
        const held = Number(message.h);
        const pressed = Number(message.p);
        if (!Number.isInteger(held) || !Number.isInteger(pressed)) return;
        sendJson(match.authority, {
            t: 'in',
            s: client.slot,
            h: held & ALL_BUTTONS_MASK,
            p: pressed & ALL_BUTTONS_MASK
        });
    }

    forfeit(match, leavingSlot, reason) {
        if (match.state === 'ended') return;
        const winner = leavingSlot === 'p1' ? 'p2' : 'p1';
        this.endMatch(match, winner, reason);
    }

    endMatch(match, winner, reason) {
        if (match.state === 'ended') return;
        match.state = 'ended';
        clearTimeout(match.bootTimer);
        this.log(`Match ${match.id} ended: ${reason}${winner ? `, ${match.players[winner].name} wins` : ''}`);

        for (const client of Object.values(match.players)) {
            if (client.match !== match) continue;
            sendJson(client.ws, { t: 'matchEnd', winner, reason });
            client.watching = reason === END_REASONS.KO ? match : null;
            client.match = null;
            client.slot = null;
            client.state = 'idle';
        }

        // Keep the arena up a moment after a KO so the final frames reach players.
        const linger = reason === END_REASONS.KO ? END_LINGER_MS : 0;
        setTimeout(() => {
            this.matches.delete(match.id);
            match.authority?.close();
            this.closeAuthority(match);
            this.matchmake();
            this.broadcastStatus();
        }, linger);
    }

    // ---- status ----

    getStatus() {
        return {
            online: [...this.clients.values()].filter(client => client.greeted).length,
            queued: this.queue.length,
            matches: [...this.matches.values()].filter(match => match.state !== 'ended').length
        };
    }

    sendStatus(client) {
        sendJson(client.ws, { t: 'status', ...this.getStatus() });
    }

    broadcastStatus() {
        const status = { t: 'status', ...this.getStatus() };
        for (const client of this.clients.values()) {
            if (client.greeted && client.state !== 'match') sendJson(client.ws, status);
        }
    }

    shutdown() {
        clearInterval(this.statusTimer);
        for (const match of this.matches.values()) {
            this.endMatch(match, null, END_REASONS.SERVER_ERROR);
        }
    }
}
