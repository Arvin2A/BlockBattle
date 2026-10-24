// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// The open-match list and every running match.
//
// A player hosts an open match (their fighter + map), everyone in the lobby sees it
// listed as 1/2, and anyone can join it. That way nobody has to guess what map
// the other players picked.
//
// A match goes:  host -> join -> matchFound -> authority tab boots + both players load
//                -> start -> (inputs in, mirror frames out) -> end
//
// Players only ever send: who they are, host/join/leave, button states, forfeit.
// All game results come from the authority tab, never from a player.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocket } from 'ws';
import { createNameFilter } from '../mp/nameFilter.js';
import { ALL_BUTTONS_MASK } from '../input.js';
import { isValidSelection } from '../characterRoster.js';
import { cleanName, END_REASONS, MAP_CHOICES, PROTOCOL_VERSION } from '../mp/protocol.js';
import { QUICK_CHAT_PHRASES, QuickChatLimiter } from '../mp/quickChat.js';

const CHAT_LATENCY_SLACK_MS = 300;

const BOOT_TIMEOUT_MS = 45000;
const END_LINGER_MS = 4000;
const MAX_MESSAGES_PER_SECOND = 300;
const MAX_PLAYER_MESSAGE_BYTES = 2048;
// Only this many open matches are sent to each player.
const MAX_LISTED_ROOMS = 50;

function loadNameFilter() {
    try {
        return createNameFilter(fs.readFileSync(new URL('../assets/inappropriate_words', import.meta.url), 'utf8'));
    } catch (error) {
        console.warn(`Name filter disabled, could not read assets/inappropriate_words: ${error.message}`);
        return () => false;
    }
}
const isNameBlocked = loadNameFilter();

const randomId = (bytes = 6) => crypto.randomBytes(bytes).toString('hex');

function sendJson(ws, message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function resolveMap(choice) {
    if (choice !== 'RANDOM') return choice;
    const maps = MAP_CHOICES.filter(map => map !== 'RANDOM');
    return maps[Math.floor(Math.random() * maps.length)];
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
            state: 'idle', // idle | queued (hosting an open match) | match
            match: null,
            // The match that just ended, still shown behind the results screen.
            watching: null,
            slot: null,
            messageCount: 0,
            messageWindow: Date.now(),
            chatLimiter: new QuickChatLimiter(CHAT_LATENCY_SLACK_MS)
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
            this.sendRooms(client);
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
            case 'join':
                client.watching = null;
                this.join(client, message);
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
            case 'chat':
                this.forwardChat(client, message);
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

    // ---- open matches ----
    // this.queue holds the players hosting an open match; the match's id is the host's id.

    // Reads the player's name and fighter from a host/join message. False if it's invalid.
    readChoice(client, message) {
        const character = String(message.character ?? '');
        const variant = String(message.variant ?? '');
        if (!isValidSelection(character, variant)) {
            sendJson(client.ws, { t: 'error', msg: 'That fighter does not exist on this server. Refresh the page.' });
            return false;
        }
        const name = cleanName(message.name);
        if (isNameBlocked(name)) {
            sendJson(client.ws, { t: 'error', msg: 'That name is not allowed. Pick a different one.' });
            return false;
        }
        client.name = name;
        client.choice = {
            character,
            variant,
            map: MAP_CHOICES.includes(message.map) ? message.map : 'RANDOM'
        };
        return true;
    }

    enqueue(client, message) {
        if (client.state !== 'idle') return;
        if (!this.readChoice(client, message)) return;
        client.state = 'queued';
        this.queue.push(client);
        this.log(`${client.name} (${client.choice.character} ${client.choice.variant}) is hosting on ${client.choice.map}`);
        sendJson(client.ws, { t: 'queued', room: client.id });
        this.roomsChanged();
    }

    join(client, message) {
        if (client.state === 'match') return;
        const host = this.queue.find(other => other.id === message.room);
        if (!host || host === client) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'That match is no longer open.' });
            return;
        }
        if (this.matches.size >= this.maxMatches) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'All arenas on this server are busy, try again in a moment.' });
            return;
        }
        if (!this.readChoice(client, message)) return;
        // Joining someone else closes your own open match.
        this.dequeue(client);
        this.queue.splice(this.queue.indexOf(host), 1);
        this.createMatch(host, client);
        this.roomsChanged();
    }

    dequeue(client) {
        const index = this.queue.indexOf(client);
        if (index === -1) return;
        this.queue.splice(index, 1);
        client.state = 'idle';
        this.roomsChanged();
    }

    getRooms() {
        return this.queue.slice(0, MAX_LISTED_ROOMS).map(host => ({
            id: host.id,
            name: host.name,
            character: host.choice.character,
            variant: host.choice.variant,
            map: host.choice.map,
            players: 1,
            max: 2
        }));
    }

    sendRooms(client) {
        sendJson(client.ws, { t: 'rooms', rooms: this.getRooms() });
    }

    roomsChanged() {
        const message = { t: 'rooms', rooms: this.getRooms() };
        for (const client of this.clients.values()) {
            if (client.greeted && client.state !== 'match') sendJson(client.ws, message);
        }
        this.broadcastStatus();
    }

    // ---- matches ----

    createMatch(p1, p2) {
        const match = {
            id: randomId(),
            key: randomId(16),
            players: { p1, p2 },
            // The host's map; whoever joins agreed to it from the list.
            map: resolveMap(p1.choice.map),
            state: 'booting', // booting | running | ended
            authority: null,
            authorityReady: false,
            tab: null,
            loaded: new Set(),
            createdAt: Date.now(),
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
                // Say who we were still waiting on, so it's clear what to fix.
                const waitingOn = [];
                if (!match.authority) waitingOn.push('the game host never connected (hidden Chrome tab)');
                else if (!match.authorityReady) waitingOn.push('the game host connected but never got ready');
                for (const [slot, client] of Object.entries(match.players)) {
                    if (!match.loaded.has(slot)) waitingOn.push(`${client.name} (${slot}) was still loading`);
                }
                this.log(`Match ${match.id} took too long to start: ${waitingOn.join(', ')}`);
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
                this.log(`Match ${match.id}: game host ready after ${this.secondsSince(match)}s`);
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
        if (match.loaded.has(client.slot)) return;
        match.loaded.add(client.slot);
        this.log(`Match ${match.id}: ${client.name} loaded after ${this.secondsSince(match)}s`);
        this.tryStart(match);
    }

    secondsSince(match) {
        return ((Date.now() - match.createdAt) / 1000).toFixed(1);
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

    forwardChat(client, message) {
        const match = client.match ?? client.watching;
        if (!match) return;
        const slot = Object.keys(match.players).find(key => match.players[key] === client);
        const phrase = String(message.m ?? '');
        if (!slot || !QUICK_CHAT_PHRASES.has(phrase)) return;
        if (!client.chatLimiter.tryUse(Date.now())) return;
        for (const player of Object.values(match.players)) {
            if (player.match === match || player.watching === match) {
                sendJson(player.ws, { t: 'chat', s: slot, m: phrase });
            }
        }
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
            this.sendRooms(client);
        }

        // Keep the arena up a moment after a KO so the final frames reach players.
        const linger = reason === END_REASONS.KO ? END_LINGER_MS : 0;
        setTimeout(() => {
            this.matches.delete(match.id);
            match.authority?.close();
            this.closeAuthority(match);
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
