// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.


import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocket } from 'ws';
import { createNameFilter } from '../mp/nameFilter.js';
import { ALL_BUTTONS_MASK } from '../input.js';
import { isValidSelection } from '../characterRoster.js';
import { cleanName, cleanDeviceId, END_REASONS, MAP_CHOICES, MAX_LOBBY_NAME_LENGTH, PROTOCOL_VERSION } from '../mp/protocol.js';
import { MATCH_MODES, SLOTS, buildRoster, isValidMode } from '../matchModes.js';
import { sanitizeOnlineModifiers } from '../modifiers.js';
import { QUICK_CHAT_PHRASES, QuickChatLimiter } from '../mp/quickChat.js';

const CHAT_LATENCY_SLACK_MS = 300;

const BOOT_TIMEOUT_MS = 45000;
const END_LINGER_MS = 4000;
const MAX_MESSAGES_PER_SECOND = 300;
const MAX_PLAYER_MESSAGE_BYTES = 4096;
const MAX_LISTED_ROOMS = 50;
const MAX_LISTED_PLAYERS = 100;
const INVITE_GAP_MS = 3000;
const MAX_RTC_SIGNALS_PER_MATCH = 64;
const MAX_RTC_SIGNAL_BYTES = 16384;
const BUSY_ARENAS_MESSAGE = 'All arenas on this server are busy, try again in a moment.';
const SAME_DEVICE_MESSAGE = 'You are already hosting or playing in another tab. Only one match per device at a time.';

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
const randomTag = () => String(crypto.randomInt(1000, 10000));

function isSmallSignal(data) {
    if (!data || typeof data !== 'object') return false;
    try {
        return JSON.stringify(data).length <= MAX_RTC_SIGNAL_BYTES;
    } catch {
        return false;
    }
}

function sendJson(ws, message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function resolveMap(choice) {
    if (choice !== 'RANDOM') return choice;
    const maps = MAP_CHOICES.filter(map => map !== 'RANDOM');
    return maps[Math.floor(Math.random() * maps.length)];
}

export class Lobby {
    constructor({ launchAuthority, closeAuthority, maxMatches, log, getIce }) {
        this.getIce = getIce ?? (async () => null);
        this.launchAuthority = launchAuthority;
        this.closeAuthority = closeAuthority;
        this.maxMatches = maxMatches;
        this.log = log;
        this.clients = new Map();
        this.queue = [];
        this.lobbies = new Map();
        this.matches = new Map();
        this.statusTimer = setInterval(() => this.broadcastStatus(), 2000);
    }

    // ---- players ----

    addClient(ws, address) {
        const client = {
            id: randomId(4),
            tag: this.uniqueTag(),
            ws,
            address,
            greeted: false,
            name: 'Player',
            choice: null,
            state: 'idle',
            lobby: null,
            away: false,
            match: null,
            // The match that just ended, still shown behind the results screen.
            watching: null,
            slot: null,
            watchingPlayers: false,
            invitesSent: new Map(),
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

    uniqueTag() {
        const taken = new Set([...this.clients.values()].map(client => client.tag));
        for (let attempt = 0; attempt < 50; attempt++) {
            const tag = randomTag();
            if (!taken.has(tag)) return tag;
        }
        return randomId(3).toUpperCase();
    }

    setName(client, raw) {
        const name = cleanName(raw);
        if (isNameBlocked(name) || isNameBlocked(String(raw ?? ''))) return false;
        if (name === client.name) return true;
        client.name = name;
        if (client.lobby) this.lobbyChanged(client.lobby);
        else this.broadcastStatus();
        return true;
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
            client.deviceId = cleanDeviceId(message.d);
            if (message.n !== undefined) this.setName(client, message.n);
            sendJson(client.ws, { t: 'welcome', id: client.id, tag: client.tag });
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
            case 'createLobby':
                client.watching = null;
                this.createLobby(client, message);
                break;
            case 'joinLobby':
                client.watching = null;
                this.joinLobby(client, message);
                break;
            case 'startLobby':
                this.startLobby(client);
                break;
            case 'name':
                this.setName(client, message.name);
                break;
            case 'watchPlayers':
                client.watchingPlayers = Boolean(message.on);
                if (client.watchingPlayers) this.sendPlayers(client);
                break;
            case 'invite':
                this.invite(client, message);
                break;
            case 'away':
                if (client.away !== Boolean(message.a)) {
                    client.away = Boolean(message.a);
                    this.broadcastStatus();
                }
                break;
            case 'leave':
                client.watching = null;
                this.dequeue(client);
                this.leaveLobby(client);
                sendJson(client.ws, { t: 'left' });
                break;
            case 'loaded':
                if (client.match) this.markLoaded(client.match, client);
                break;
            case 'in':
                this.forwardInput(client, message);
                break;
            case 'rtc':
                this.forwardSignalToAuthority(client, message);
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
        this.leaveLobby(client);
        if (client.match) this.forfeit(client.match, client.slot, END_REASONS.DISCONNECT);
        this.broadcastStatus();
    }

    readChoice(client, message) {
        const character = String(message.character ?? '');
        const variant = String(message.variant ?? '');
        if (!isValidSelection(character, variant)) {
            sendJson(client.ws, { t: 'error', msg: 'That fighter does not exist on this server. Refresh the page.' });
            return false;
        }
        const name = cleanName(message.name);
        if (isNameBlocked(name) || isNameBlocked(String(message.name ?? ''))) {
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

    deviceBusy(client) {
        if (!client.deviceId) return false;
        for (const other of this.clients.values()) {
            if (other !== client && other.deviceId === client.deviceId && other.state !== 'idle') return true;
        }
        return false;
    }

    enqueue(client, message) {
        if (client.state !== 'idle') return;
        if (this.deviceBusy(client)) {
            sendJson(client.ws, { t: 'error', msg: SAME_DEVICE_MESSAGE });
            return;
        }
        if (!this.readChoice(client, message)) return;
        const partner = this.queue.find(waiting => !waiting.deviceId || waiting.deviceId !== client.deviceId);
        if (partner) {
            if (this.matches.size >= this.maxMatches) {
                sendJson(client.ws, { t: 'error', msg: BUSY_ARENAS_MESSAGE });
                return;
            }
            this.queue.splice(this.queue.indexOf(partner), 1);
            this.createMatch({ mode: '1v1', clients: [partner, client], map: partner.choice.map, modifiers: [], quick: true });
            this.roomsChanged();
            return;
        }
        client.state = 'queued';
        this.queue.push(client);
        this.log(`${client.name} (${client.choice.character} ${client.choice.variant}) is looking for a Quick 1v1`);
        sendJson(client.ws, { t: 'queued' });
        this.roomsChanged();
    }

    dequeue(client) {
        const index = this.queue.indexOf(client);
        if (index === -1) return;
        this.queue.splice(index, 1);
        client.state = 'idle';
        this.roomsChanged();
    }

    // ---- lobbies ----

    createLobby(client, message) {
        if (client.state !== 'idle') return;
        if (this.deviceBusy(client)) {
            sendJson(client.ws, { t: 'error', msg: SAME_DEVICE_MESSAGE });
            return;
        }
        if (!this.readChoice(client, message)) return;
        const modifiers = sanitizeOnlineModifiers(message.modifiers ?? []);
        if (!isValidMode(message.mode) || !modifiers) {
            sendJson(client.ws, { t: 'error', msg: 'Those lobby settings are not allowed on this server. Refresh the page.' });
            return;
        }
        const name = cleanName(message.lobbyName ?? `${client.name}'s Lobby`, MAX_LOBBY_NAME_LENGTH);
        if (isNameBlocked(name) || isNameBlocked(String(message.lobbyName ?? ''))) {
            sendJson(client.ws, { t: 'error', msg: 'That lobby name is not allowed. Pick a different one.' });
            return;
        }
        const lobby = {
            id: client.id,
            name,
            mode: message.mode,
            map: client.choice.map,
            modifiers,
            members: [client],
            private: Boolean(message.private),
            invited: new Set()
        };
        this.lobbies.set(lobby.id, lobby);
        client.invitesSent.clear();
        client.state = 'lobby';
        client.lobby = lobby;
        this.log(`${client.name} opened ${lobby.private ? 'private ' : ''}lobby "${name}" (${lobby.mode} on ${lobby.map})`);
        this.lobbyChanged(lobby);
    }

    joinLobby(client, message) {
        if (client.state === 'match' || client.state === 'lobby') return;
        const lobby = this.lobbies.get(message.room);
        if (!lobby || lobby.members.length >= MATCH_MODES[lobby.mode].players) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'That lobby is full or no longer open.' });
            return;
        }
        if (lobby.private && !lobby.invited.has(client.id)) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'That lobby is private. You need an invite to join.' });
            return;
        }
        if (this.deviceBusy(client)) {
            sendJson(client.ws, { t: 'joinFailed', msg: SAME_DEVICE_MESSAGE });
            return;
        }
        if (!this.readChoice(client, message)) return;
        this.dequeue(client);
        lobby.members.push(client);
        client.state = 'lobby';
        client.lobby = lobby;
        this.lobbyChanged(lobby);
    }

    leaveLobby(client) {
        const lobby = client.lobby;
        if (!lobby) return;
        client.lobby = null;
        if (client.state === 'lobby') client.state = 'idle';
        lobby.members = lobby.members.filter(member => member !== client);
        if (lobby.members.length === 0) {
            this.lobbies.delete(lobby.id);
            this.roomsChanged();
            return;
        }
        this.lobbyChanged(lobby);
    }

    startLobby(client) {
        const lobby = client.lobby;
        if (!lobby || lobby.members[0] !== client) return;
        if (lobby.members.length < MATCH_MODES[lobby.mode].players) {
            sendJson(client.ws, { t: 'error', msg: 'The lobby needs to be full to start.' });
            return;
        }
        if (this.matches.size >= this.maxMatches) {
            sendJson(client.ws, { t: 'error', msg: BUSY_ARENAS_MESSAGE });
            return;
        }
        this.lobbies.delete(lobby.id);
        for (const member of lobby.members) member.lobby = null;
        this.createMatch({ mode: lobby.mode, clients: lobby.members, map: lobby.map, modifiers: lobby.modifiers, quick: false });
        this.roomsChanged();
    }

    describeLobby(lobby, viewer) {
        const roster = buildRoster(lobby.mode, lobby.members.map(member => ({
            name: member.name,
            character: member.choice.character,
            variant: member.choice.variant,
            tag: member.tag,
            you: member === viewer
        })));
        return {
            id: lobby.id,
            name: lobby.name,
            mode: lobby.mode,
            map: lobby.map,
            modifiers: lobby.modifiers,
            max: MATCH_MODES[lobby.mode].players,
            private: lobby.private,
            host: lobby.members[0] === viewer,
            members: roster
        };
    }

    lobbyChanged(lobby) {
        for (const member of lobby.members) {
            sendJson(member.ws, { t: 'lobby', lobby: this.describeLobby(lobby, member) });
        }
        this.roomsChanged();
    }

    getRooms() {
        return [...this.lobbies.values()]
            .filter(lobby => !lobby.private && lobby.members.length < MATCH_MODES[lobby.mode].players)
            .slice(0, MAX_LISTED_ROOMS)
            .map(lobby => ({
                id: lobby.id,
                name: lobby.name,
                host: lobby.members[0].name,
                hostTag: lobby.members[0].tag,
                mode: lobby.mode,
                map: lobby.map,
                modifiers: lobby.modifiers.length,
                players: lobby.members.length,
                max: MATCH_MODES[lobby.mode].players
            }));
    }

    isWaiting(client) {
        return client.greeted && client.state !== 'match' && !client.away;
    }

    getPlayers(viewer) {
        return [...this.clients.values()]
            .filter(client => client !== viewer && this.isWaiting(client))
            .slice(0, MAX_LISTED_PLAYERS)
            .map(client => ({
                tag: client.tag,
                name: client.name,
                busy: client.state === 'lobby' && client.lobby !== viewer.lobby,
                inLobby: Boolean(viewer.lobby) && client.lobby === viewer.lobby
            }));
    }

    sendPlayers(client) {
        sendJson(client.ws, { t: 'players', players: this.getPlayers(client) });
    }

    invite(client, message) {
        const lobby = client.lobby;
        if (!lobby || lobby.members[0] !== client || !lobby.private) return;
        const fail = msg => sendJson(client.ws, { t: 'inviteFailed', tag: String(message.tag ?? ''), msg });
        if (lobby.members.length >= MATCH_MODES[lobby.mode].players) {
            fail('Your lobby is already full.');
            return;
        }
        const target = [...this.clients.values()].find(other => other.tag === String(message.tag ?? ''));
        if (!target || target === client || !this.isWaiting(target)) {
            fail('That player is not waiting anymore.');
            return;
        }
        if (target.state === 'lobby') {
            fail(`${target.name} is already in a lobby.`);
            return;
        }
        const now = Date.now();
        if (now - (client.invitesSent.get(target.id) ?? 0) < INVITE_GAP_MS) return;
        client.invitesSent.set(target.id, now);
        lobby.invited.add(target.id);
        sendJson(target.ws, {
            t: 'invited',
            room: lobby.id,
            name: lobby.name,
            mode: lobby.mode,
            map: lobby.map,
            modifiers: lobby.modifiers.length,
            host: client.name,
            hostTag: client.tag
        });
        sendJson(client.ws, { t: 'inviteSent', tag: target.tag, name: target.name });
        this.log(`${client.name} invited ${target.name} to "${lobby.name}"`);
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

    createMatch({ mode, clients, map, modifiers, quick }) {
        const roster = buildRoster(mode, clients.map(client => ({ name: client.name, ...client.choice })));
        const match = {
            id: randomId(),
            key: randomId(16),
            mode,
            quick,
            modifiers,
            roster,
            players: Object.fromEntries(clients.map((client, index) => [SLOTS[index], client])),
            left: new Set(),
            map: resolveMap(map),
            state: 'booting',
            authority: null,
            authorityReady: false,
            tab: null,
            loaded: new Set(),
            createdAt: Date.now(),
            bootTimer: null
        };
        this.matches.set(match.id, match);

        const publicRoster = roster.map(({ slot, name, character, variant, color, team }) => ({ slot, name, character, variant, color, team }));
        for (const [slot, client] of Object.entries(match.players)) {
            const opponent = publicRoster.find(entry => entry.slot !== slot);
            client.state = 'match';
            client.watchingPlayers = false;
            client.match = match;
            client.slot = slot;
            client.rtcSignals = 0;
            sendJson(client.ws, {
                t: 'matchFound',
                matchId: match.id,
                slot,
                map: match.map,
                mode,
                quick,
                roster: publicRoster,
                opponent
            });
        }
        this.log(`Match ${match.id}: ${mode} ${roster.map(entry => entry.name).join(' vs ')} on ${match.map}`);

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
                this.getIce().then(ice => {
                    if (match.state === 'ended') return;
                    sendJson(ws, {
                        t: 'config',
                        map: match.map,
                        mode: match.mode,
                        roster: match.roster.map(({ slot, name, character, variant }) => ({ slot, name, character, variant })),
                        modifiers: match.modifiers,
                        ice
                    });
                    for (const slot of match.left) sendJson(ws, { t: 'playerLeft', s: slot });
                });
            } else if (message.t === 'rtc') {
                this.forwardSignalToPlayer(match, message);
            } else if (message.t === 'ready') {
                match.authorityReady = true;
                this.log(`Match ${match.id}: game host ready after ${this.secondsSince(match)}s`);
                this.tryStart(match);
            } else if (message.t === 'end' && Array.isArray(message.winners) &&
                message.winners.length > 0 && message.winners.every(slot => Object.hasOwn(match.players, slot))) {
                this.endMatch(match, message.winners, END_REASONS.KO);
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
        const needed = Object.keys(match.players).filter(slot => !match.left.has(slot));
        if (match.state !== 'booting' || !match.authorityReady || needed.some(slot => !match.loaded.has(slot))) return;
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
            p: pressed & ALL_BUTTONS_MASK,
            q: Number.isSafeInteger(message.q) ? message.q : undefined
        });
    }

    forwardSignalToAuthority(client, message) {
        const match = client.match;
        if (!match || match.state === 'ended' || !match.authority) return;
        if (!isSmallSignal(message.d)) return;
        client.rtcSignals = (client.rtcSignals ?? 0) + 1;
        if (client.rtcSignals > MAX_RTC_SIGNALS_PER_MATCH) return;
        sendJson(match.authority, { t: 'rtc', s: client.slot, d: message.d });
    }

    forwardSignalToPlayer(match, message) {
        const player = match.players[message.s];
        if (!player || player.match !== match || !isSmallSignal(message.d)) return;
        sendJson(player.ws, { t: 'rtc', d: message.d });
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
        if (match.state === 'ended' || match.left.has(leavingSlot)) return;
        match.left.add(leavingSlot);
        const staying = match.roster.filter(entry => !match.left.has(entry.slot));
        const teams = new Set(staying.map(entry => entry.team));
        if (teams.size <= 1) {
            const winners = staying.map(entry => entry.slot);
            this.endMatch(match, winners.length ? winners : null, reason);
            return;
        }
        const client = match.players[leavingSlot];
        sendJson(match.authority, { t: 'playerLeft', s: leavingSlot });
        if (client.match === match) {
            client.match = null;
            client.slot = null;
            client.state = 'idle';
            this.sendRooms(client);
        }
        this.log(`Match ${match.id}: ${client.name} (${leavingSlot}) left, the match goes on`);
        this.tryStart(match);
    }

    endMatch(match, winners, reason) {
        if (match.state === 'ended') return;
        match.state = 'ended';
        clearTimeout(match.bootTimer);
        const winnerNames = (winners ?? []).map(slot => match.players[slot].name).join(' + ');
        this.log(`Match ${match.id} ended: ${reason}${winnerNames ? `, ${winnerNames} won` : ''}`);

        for (const client of Object.values(match.players)) {
            if (client.match !== match) continue;
            sendJson(client.ws, { t: 'matchEnd', winners, reason });
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
        const greeted = [...this.clients.values()].filter(client => client.greeted);
        return {
            online: greeted.length,
            // In the online lobby (browsing or hosting), not in a match.
            waiting: greeted.filter(client => this.isWaiting(client)).length,
            queued: this.queue.length + this.lobbies.size,
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
            if (client.watchingPlayers && client.state !== 'match') this.sendPlayers(client);
        }
    }

    shutdown() {
        clearInterval(this.statusTimer);
        for (const match of this.matches.values()) {
            this.endMatch(match, null, END_REASONS.SERVER_ERROR);
        }
    }
}
