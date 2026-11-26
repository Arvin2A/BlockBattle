// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.


import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocket } from 'ws';
import { createNameFilter } from '../mp/nameFilter.js';
import { ALL_BUTTONS_MASK } from '../input.js';
import { CHARACTER_ROSTER, isValidSelection } from '../characterRoster.js';
import { cleanName, cleanDeviceId, cleanInviteCode, cleanMatchResult, cleanMatchStats, END_REASONS, INVITE_CODE_LENGTH, INVITE_CODE_LETTERS, MAP_CHOICES, MAX_LOBBY_NAME_LENGTH, PROTOCOL_VERSION, RECONNECT_GRACE_MS } from '../mp/protocol.js';
import { MATCH_MODES, SLOTS, buildRoster, isValidMode } from '../matchModes.js';
import { sanitizeOnlineModifiers } from '../modifiers.js';
import { QUICK_CHAT_PHRASES, QuickChatLimiter } from '../mp/quickChat.js';
import { createDiscordNotifier } from './discord.js';

const CHAT_LATENCY_SLACK_MS = 300;

const BOOT_TIMEOUT_MS = 45000;
const END_LINGER_MS = 4000;
const RESULT_WAIT_MS = 3000;
const MAX_MESSAGES_PER_SECOND = 300;
const MAX_PLAYER_MESSAGE_BYTES = 4096;
const MAX_LISTED_ROOMS = 50;
const MAX_LISTED_PLAYERS = 100;
const INVITE_GAP_MS = 3000;
const BAD_INVITE_CODE_WINDOW_MS = 60 * 1000;
const MAX_BAD_INVITE_CODES = 10;
const BOT_NAME = 'CPU';
const BOT_DIFFICULTY = 'HARD';
const MODES_WITH_BOTS = new Set(Object.keys(MATCH_MODES).filter(mode => mode !== '1v1'));
const MAX_RTC_SIGNALS_PER_MATCH = 64;
const MAX_RTC_SIGNAL_BYTES = 16384;
const BUSY_ARENAS_MESSAGE = 'All arenas on this server are busy, try again in a moment.';
const SILENT_LIMIT_MS = 15000;
const SILENT_AWAY_LIMIT_MS = 90000;
const SILENCE_CHECK_MS = 5000;
const SAME_DEVICE_MESSAGE = 'You are already hosting or playing in another tab. Only one match per device at a time.';
const TOURNAMENT = { players: 2, spectators: 4, matchCost: 2, maxCodeLength: 64 };
const TOURNAMENT_NAME_SUFFIX = "'s Tournament Match";

function loadNameFilter() {
    try {
        return createNameFilter(fs.readFileSync(new URL('../assets/inappropriate_words', import.meta.url), 'utf8'));
    } catch (error) {
        console.warn(`Name filter disabled, could not read assets/inappropriate_words: ${error.message}`);
        return () => false;
    }
}
const isNameBlocked = loadNameFilter();

const lobbyCount = lobby => lobby.members.length + (lobby.bot ? 1 : 0);
const lobbyIsFull = lobby => lobbyCount(lobby) >= MATCH_MODES[lobby.mode].players;
const isLobbyHost = (lobby, client) => lobby.tournament ? lobby.host === client : lobby.members[0] === client;
const roomClients = lobby => lobby.tournament ? [lobby.host, ...lobby.members, ...lobby.spectators] : lobby.members;
const tournamentIsFull = lobby => lobby.members.length >= TOURNAMENT.players && lobby.spectators.length >= TOURNAMENT.spectators;
const bothBanned = lobby => lobby.members.length === TOURNAMENT.players && lobby.members.every(member => lobby.bans.has(member.id));
const isBanned = (lobby, character, variant) => [...lobby.bans.values()].some(ban => ban.character === character && ban.variant === variant);
const hashCode = code => crypto.createHash('sha256').update(String(code)).digest();
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
    constructor({ launchAuthority, closeAuthority, maxMatches, log, getIce, discord, tournamentCodes = [] }) {
        this.tournamentCodes = [...new Set(tournamentCodes.map(code => String(code).trim()).filter(Boolean))];
        this.discord = discord ?? createDiscordNotifier({}, log);
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
        this.silenceTimer = setInterval(() => this.dropSilentClients(), SILENCE_CHECK_MS);
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
            badInviteCodes: [],
            resumeKey: randomId(16),
            detached: false,
            resumeTimer: null,
            missedMessages: [],
            messageCount: 0,
            messageWindow: Date.now(),
            lastSeen: Date.now(),
            chatLimiter: new QuickChatLimiter(CHAT_LATENCY_SLACK_MS)
        };
        this.clients.set(client.id, client);
        ws.owner = client;

        ws.on('message', (data, isBinary) => {
            const owner = ws.owner;
            if (!owner) return;
            owner.lastSeen = Date.now();
            if (isBinary || data.length > MAX_PLAYER_MESSAGE_BYTES) return;
            if (!this.withinRateLimit(owner)) return;
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch {
                return;
            }
            if (message && typeof message === 'object') this.handleClientMessage(owner, message);
        });
        ws.on('close', () => this.socketClosed(ws.owner, ws));
        ws.on('error', () => {});
    }

    graceFor(client) {
        if (!client.greeted) return 0;
        if (client.match) return RECONNECT_GRACE_MS.match;
        if (client.lobby) return RECONNECT_GRACE_MS.lobby;
        return RECONNECT_GRACE_MS.menu;
    }

    socketClosed(client, ws) {
        if (!client || client.ws !== ws) return;
        const grace = this.graceFor(client);
        if (!grace) {
            this.removeClient(client);
            return;
        }
        client.ws = null;
        client.detached = true;
        client.watchingPlayers = false;
        client.resumeTimer = setTimeout(() => this.removeClient(client), grace);
        const match = client.match;
        if (match && match.state !== 'ended') {
            sendJson(match.authority, { t: 'in', s: client.slot, h: 0, p: 0 });
            sendJson(match.authority, { t: 'reconnecting', s: client.slot, on: true });
        }
        if (client.lobby) this.lobbyChanged(client.lobby);
        this.log(`${client.name} lost connection, holding their spot for ${grace / 1000}s`);
        this.broadcastStatus();
    }

    findResumable(client, key) {
        if (typeof key !== 'string' || key.length !== 32) return null;
        for (const other of this.clients.values()) {
            if (other === client || !other.greeted || other.deviceId !== client.deviceId) continue;
            const expected = Buffer.from(other.resumeKey);
            const given = Buffer.from(key);
            if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return other;
        }
        return null;
    }

    dropStaleSpots(client) {
        if (!client.deviceId) return;
        for (const other of [...this.clients.values()]) {
            if (other !== client && other.detached && other.deviceId === client.deviceId) this.removeClient(other);
        }
    }

    resumeClient(held, fresh) {
        this.clients.delete(fresh.id);
        const previous = held.ws;
        held.ws = fresh.ws;
        fresh.ws.owner = held;
        if (previous && previous !== fresh.ws) {
            previous.owner = null;
            previous.terminate();
        }
        clearTimeout(held.resumeTimer);
        held.resumeTimer = null;
        held.detached = false;
        held.dropped = false;
        held.away = false;
        held.lastSeen = Date.now();
        sendJson(held.ws, { t: 'welcome', id: held.id, tag: held.tag, resume: held.resumeKey, resumed: true });
        this.log(`${held.name} reconnected`);
        if (held.state !== 'match') this.sendRooms(held);
        if (held.lobby) this.lobbyChanged(held.lobby);
        else if (held.state === 'queued') sendJson(held.ws, { t: 'queued' });
        if (held.match) this.resumeInMatch(held);
        for (const message of held.missedMessages) sendJson(held.ws, message);
        held.missedMessages = [];
        this.broadcastStatus();
    }

    resumeInMatch(client) {
        const match = client.match;
        if (!match.loaded.has(client.slot) && client.matchFound) sendJson(client.ws, client.matchFound);
        if (match.state === 'ended') return;
        client.rtcSignals = 0;
        sendJson(match.authority, { t: 'reconnecting', s: client.slot, on: false });
        if (match.state === 'running') sendJson(match.authority, { t: 'resync', s: client.slot });
    }

    sendToPlayer(client, message) {
        if (client.detached) client.missedMessages.push(message);
        else sendJson(client.ws, message);
    }

    dropSilentClients() {
        const now = Date.now();
        for (const client of this.clients.values()) {
            const limit = client.away ? SILENT_AWAY_LIMIT_MS : SILENT_LIMIT_MS;
            if (client.dropped || !client.ws || now - client.lastSeen < limit) continue;
            client.dropped = true;
            this.log(`Dropping ${client.name ?? client.tag} (${client.address}): silent for ${Math.round((now - client.lastSeen) / 1000)}s`);
            client.ws.terminate();
        }
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
                sendJson(client.ws, { t: 'error', msg: 'Your game is out of date with the server. Refresh the page, or restart the desktop app.' });
                client.ws.close();
                return;
            }
            client.deviceId = cleanDeviceId(message.d);
            const held = this.findResumable(client, message.r);
            if (held) {
                this.resumeClient(held, client);
                return;
            }
            client.greeted = true;
            this.dropStaleSpots(client);
            if (message.n !== undefined) this.setName(client, message.n);
            sendJson(client.ws, { t: 'welcome', id: client.id, tag: client.tag, resume: client.resumeKey });
            this.sendRooms(client);
            this.broadcastStatus();
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
            case 'addBot':
                this.addBot(client);
                break;
            case 'removeBot':
                this.removeBot(client);
                break;
            case 'ready':
                this.setReady(client, message);
                break;
            case 'pick':
                this.pickFighter(client, message);
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
                    if (client.lobby) this.lobbyChanged(client.lobby);
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
                else if (client.spectating) this.viewerLoaded(client.spectating, client);
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
            case 'sync':
                this.syncClient(client);
                break;
            case 'createTournament':
                client.watching = null;
                this.createTournament(client, message);
                break;
            case 'ban':
                this.banFighter(client, message);
                break;
            case 'kick':
                this.kickFromRoom(client, message);
                break;
            case 'swapRole':
                this.swapRole(client, message);
                break;
            case 'mapPicker':
                this.setMapPicker(client, message);
                break;
            case 'pickMap':
                this.pickRoomMap(client, message);
                break;
            case 'resetBans':
                this.resetBans(client);
                break;
            case 'watch':
                this.watchRoomMatch(client);
                break;
            case 'stopWatching':
                this.stopWatching(client);
                break;
        }
    }

    removeClient(client) {
        if (this.clients.get(client.id) !== client) return;
        clearTimeout(client.resumeTimer);
        client.resumeTimer = null;
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
            sendJson(client.ws, { t: 'error', msg: 'That fighter does not exist on this server. Refresh the page, or restart the desktop app.' });
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
        const partner = this.queue.find(waiting => !waiting.detached && (!waiting.deviceId || waiting.deviceId !== client.deviceId));
        if (partner) {
            if (!this.hasRoomFor(1)) {
                sendJson(client.ws, { t: 'error', msg: BUSY_ARENAS_MESSAGE });
                return;
            }
            this.queue.splice(this.queue.indexOf(partner), 1);
            this.discord.queueEnded(partner, 'matched');
            this.createMatch({ mode: '1v1', clients: [partner, client], map: partner.choice.map, modifiers: [], quick: true });
            this.roomsChanged();
            return;
        }
        client.state = 'queued';
        this.queue.push(client);
        this.log(`${client.name} (${client.choice.character} ${client.choice.variant}) is looking for a Quick 1v1`);
        sendJson(client.ws, { t: 'queued' });
        this.discord.queueWaiting(client, () => this.queue.includes(client));
        this.roomsChanged();
    }

    dequeue(client) {
        const index = this.queue.indexOf(client);
        if (index === -1) return;
        this.queue.splice(index, 1);
        this.discord.queueEnded(client);
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
            sendJson(client.ws, { t: 'error', msg: 'Those lobby settings are not allowed on this server. Refresh the page, or restart the desktop app.' });
            return;
        }
        const name = cleanName(message.lobbyName ?? `${client.name}'s Lobby`, MAX_LOBBY_NAME_LENGTH);
        if (isNameBlocked(name) || isNameBlocked(String(message.lobbyName ?? ''))) {
            sendJson(client.ws, { t: 'error', msg: 'That lobby name is not allowed. Pick a different one.' });
            return;
        }
        const lobby = {
            id: client.id,
            inviteCode: this.uniqueInviteCode(),
            name,
            mode: message.mode,
            map: client.choice.map,
            modifiers,
            members: [client],
            bot: null,
            private: Boolean(message.private),
            invited: new Set()
        };
        this.lobbies.set(lobby.id, lobby);
        client.invitesSent.clear();
        client.ready = false;
        client.state = 'lobby';
        client.lobby = lobby;
        this.log(`${client.name} opened ${lobby.private ? 'private ' : ''}lobby "${name}" (${lobby.mode} on ${lobby.map})`);
        if (!lobby.private) {
            this.discord.lobbyOpened(
                lobby,
                () => this.lobbies.get(lobby.id) === lobby && !lobbyIsFull(lobby),
                () => ({ host: lobby.members[0].name, players: lobbyCount(lobby), max: MATCH_MODES[lobby.mode].players })
            );
        }
        this.lobbyChanged(lobby);
    }

    uniqueInviteCode() {
        const taken = new Set([...this.lobbies.values()].map(lobby => lobby.inviteCode));
        for (;;) {
            const code = Array.from({ length: INVITE_CODE_LENGTH },
                () => INVITE_CODE_LETTERS[crypto.randomInt(INVITE_CODE_LETTERS.length)]).join('');
            if (!taken.has(code)) return code;
        }
    }

    tooManyBadCodes(client) {
        const now = Date.now();
        client.badInviteCodes = client.badInviteCodes.filter(at => now - at < BAD_INVITE_CODE_WINDOW_MS);
        return client.badInviteCodes.length >= MAX_BAD_INVITE_CODES;
    }

    findLobbyForJoin(client, message) {
        if (message.code === undefined) return this.lobbies.get(message.room);
        if (this.tooManyBadCodes(client)) return null;
        const code = cleanInviteCode(message.code);
        const lobby = code ? [...this.lobbies.values()].find(each => each.inviteCode === code) : null;
        if (!lobby) client.badInviteCodes.push(Date.now());
        return lobby;
    }

    joinLobby(client, message) {
        if (client.state === 'match' || client.state === 'lobby') return;
        const byCode = message.code !== undefined;
        const lobby = this.findLobbyForJoin(client, message);
        if (lobby?.tournament) {
            this.joinTournament(client, lobby, message, byCode);
            return;
        }
        if (!lobby || lobbyCount(lobby) >= MATCH_MODES[lobby.mode].players) {
            sendJson(client.ws, {
                t: 'joinFailed',
                msg: byCode ? 'That invite has expired, or the lobby is full.' : 'That lobby is full or no longer open.'
            });
            return;
        }
        if (lobby.private && !byCode && !lobby.invited.has(client.id)) {
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
        client.ready = false;
        client.state = 'lobby';
        client.lobby = lobby;
        this.lobbyChanged(lobby);
    }

    leaveLobby(client) {
        const lobby = client.lobby;
        if (!lobby) return;
        if (lobby.tournament) {
            this.leaveTournament(client, lobby);
            return;
        }
        client.lobby = null;
        client.ready = false;
        if (client.state === 'lobby') client.state = 'idle';
        lobby.members = lobby.members.filter(member => member !== client);
        if (lobby.members.length === 0) {
            this.lobbies.delete(lobby.id);
            this.discord.lobbyEnded(lobby);
            this.roomsChanged();
            return;
        }
        this.lobbyChanged(lobby);
    }

    startLobby(client) {
        const lobby = client.lobby;
        if (!lobby || !isLobbyHost(lobby, client)) return;
        if (lobby.tournament) {
            this.startTournamentMatch(client, lobby);
            return;
        }
        if (lobbyCount(lobby) < MATCH_MODES[lobby.mode].players) {
            sendJson(client.ws, { t: 'error', msg: 'The lobby needs to be full to start.' });
            return;
        }
        if (lobby.members.some(member => !member.ready)) {
            sendJson(client.ws, { t: 'error', msg: 'Everyone needs to be ready to start.' });
            return;
        }
        if (lobby.members.some(member => member.detached)) {
            sendJson(client.ws, { t: 'error', msg: 'Wait for everyone to reconnect.' });
            return;
        }
        if (!this.hasRoomFor(1)) {
            sendJson(client.ws, { t: 'error', msg: BUSY_ARENAS_MESSAGE });
            return;
        }
        this.lobbies.delete(lobby.id);
        this.discord.lobbyEnded(lobby, 'matched');
        for (const member of lobby.members) member.lobby = null;
        this.createMatch({ mode: lobby.mode, clients: lobby.members, bot: lobby.bot, map: lobby.map, modifiers: lobby.modifiers, quick: false });
        this.roomsChanged();
    }

    setReady(client, message) {
        const lobby = client.lobby;
        if (!lobby || client.state !== 'lobby') return;
        const ready = Boolean(message.r);
        if (client.ready === ready) return;
        if (lobby.tournament) {
            if (!lobby.members.includes(client) || lobby.match) return;
            if (ready && !bothBanned(lobby)) {
                sendJson(client.ws, { t: 'error', msg: 'Both players need to ban a fighter first.' });
                return;
            }
            if (ready && isBanned(lobby, client.choice.character, client.choice.variant)) {
                sendJson(client.ws, { t: 'error', msg: 'That fighter is banned. Pick a different one.' });
                return;
            }
        }
        client.ready = ready;
        this.lobbyChanged(lobby);
    }

    pickFighter(client, message) {
        const lobby = client.lobby;
        if (!lobby || client.state !== 'lobby' || client.ready) return;
        const character = String(message.character ?? '');
        const variant = String(message.variant ?? '');
        if (!isValidSelection(character, variant)) return;
        if (client.choice.character === character && client.choice.variant === variant) return;
        if (lobby.tournament && isBanned(lobby, character, variant)) return;
        client.choice = { ...client.choice, character, variant };
        this.lobbyChanged(lobby);
    }

    addBot(client) {
        const lobby = client.lobby;
        if (!lobby || lobby.tournament || lobby.members[0] !== client || lobby.bot || !MODES_WITH_BOTS.has(lobby.mode)) return;
        if (lobbyCount(lobby) >= MATCH_MODES[lobby.mode].players) return;
        const character = CHARACTER_ROSTER[crypto.randomInt(CHARACTER_ROSTER.length)];
        const variant = character.variants[crypto.randomInt(character.variants.length)];
        lobby.bot = { name: BOT_NAME, character: character.key, variant: variant.name, bot: true, difficulty: BOT_DIFFICULTY };
        this.lobbyChanged(lobby);
    }

    removeBot(client) {
        const lobby = client.lobby;
        if (!lobby || lobby.tournament || lobby.members[0] !== client || !lobby.bot) return;
        lobby.bot = null;
        this.lobbyChanged(lobby);
    }

    describeLobby(lobby, viewer) {
        if (lobby.tournament) return this.describeTournament(lobby, viewer);
        const roster = buildRoster(lobby.mode, [
            ...lobby.members.map(member => ({
                name: member.name,
                character: member.choice.character,
                variant: member.choice.variant,
                tag: member.tag,
                you: member === viewer,
                ready: Boolean(member.ready),
                status: member.detached ? 'reconnecting' : member.away ? 'afk' : 'active'
            })),
            ...(lobby.bot ? [{ name: lobby.bot.name, character: lobby.bot.character, variant: lobby.bot.variant, bot: true, ready: true }] : [])
        ]);
        return {
            id: lobby.id,
            name: lobby.name,
            mode: lobby.mode,
            map: lobby.map,
            modifiers: lobby.modifiers,
            max: MATCH_MODES[lobby.mode].players,
            private: lobby.private,
            inviteCode: lobby.inviteCode,
            host: lobby.members[0] === viewer,
            members: roster
        };
    }

    lobbyChanged(lobby) {
        if (!lobby.tournament) this.discord.lobbyUpdated(lobby);
        for (const member of roomClients(lobby)) {
            sendJson(member.ws, { t: 'lobby', lobby: this.describeLobby(lobby, member) });
        }
        this.roomsChanged();
    }

    getRooms() {
        const tournaments = [...this.lobbies.values()]
            .filter(lobby => lobby.tournament)
            .map(lobby => ({
                id: lobby.id,
                name: lobby.name,
                tournament: true,
                host: lobby.host.name,
                hostTag: lobby.host.tag,
                mode: '1v1',
                map: lobby.map,
                modifiers: 0,
                fighters: lobby.members.map(member => member.name),
                inMatch: Boolean(lobby.match),
                spectators: lobby.spectators.length,
                maxSpectators: TOURNAMENT.spectators
            }));
        const lobbies = [...this.lobbies.values()]
            .filter(lobby => !lobby.tournament && !lobby.private && lobbyCount(lobby) < MATCH_MODES[lobby.mode].players)
            .map(lobby => ({
                id: lobby.id,
                name: lobby.name,
                host: lobby.members[0].name,
                hostTag: lobby.members[0].tag,
                mode: lobby.mode,
                map: lobby.map,
                modifiers: lobby.modifiers.length,
                players: lobbyCount(lobby),
                max: MATCH_MODES[lobby.mode].players
            }));
        return [...tournaments, ...lobbies].slice(0, MAX_LISTED_ROOMS);
    }

    isInMenu(client) {
        return client.greeted && !client.detached && client.state !== 'match' && !client.spectating;
    }

    isWaiting(client) {
        return this.isInMenu(client) && !client.away;
    }

    getPlayers(viewer) {
        return [...this.clients.values()]
            .filter(client => client !== viewer && this.isInMenu(client))
            .sort((a, b) => Number(a.away) - Number(b.away))
            .slice(0, MAX_LISTED_PLAYERS)
            .map(client => ({
                tag: client.tag,
                name: client.name,
                away: client.away,
                busy: client.state === 'lobby' && client.lobby !== viewer.lobby,
                inLobby: Boolean(viewer.lobby) && client.lobby === viewer.lobby
            }));
    }

    sendPlayers(client) {
        sendJson(client.ws, { t: 'players', players: this.getPlayers(client) });
    }

    invite(client, message) {
        const lobby = client.lobby;
        if (!lobby || !isLobbyHost(lobby, client) || !lobby.private) return;
        const fail = msg => sendJson(client.ws, { t: 'inviteFailed', tag: String(message.tag ?? ''), msg });
        if (lobby.tournament ? tournamentIsFull(lobby) : lobbyCount(lobby) >= MATCH_MODES[lobby.mode].players) {
            fail('Your lobby is already full.');
            return;
        }
        const target = [...this.clients.values()].find(other => other.tag === String(message.tag ?? ''));
        if (!target || target === client || !this.isInMenu(target)) {
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
            tournament: Boolean(lobby.tournament),
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

    createMatch({ mode, clients, bot = null, map, modifiers, quick, room = null }) {
        const roster = buildRoster(mode, [
            ...clients.map(client => ({ name: client.name, ...client.choice })),
            ...(bot ? [bot] : [])
        ]);
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
            bootTimer: null,
            tournament: Boolean(room),
            room,
            viewers: new Set(),
            publicRoster: null
        };
        this.matches.set(match.id, match);

        const publicRoster = roster.map(({ slot, name, character, variant, color, team, bot }) => ({ slot, name, character, variant, color, team, bot: Boolean(bot) }));
        match.publicRoster = publicRoster;
        for (const [slot, client] of Object.entries(match.players)) {
            const opponent = publicRoster.find(entry => entry.slot !== slot);
            client.state = 'match';
            client.watchingPlayers = false;
            client.match = match;
            client.slot = slot;
            client.rtcSignals = 0;
            client.matchFound = {
                t: 'matchFound',
                matchId: match.id,
                slot,
                map: match.map,
                mode,
                quick,
                tournament: match.tournament,
                roster: publicRoster,
                opponent
            };
            sendJson(client.ws, client.matchFound);
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
        return match;
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
                for (const client of [...Object.values(match.players), ...match.viewers]) {
                    const inMatch = client.match === match || client.watching === match || client.spectating === match;
                    if (inMatch && client.ws?.readyState === WebSocket.OPEN) client.ws.send(text);
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
                        roster: match.roster.map(({ slot, name, character, variant, bot, difficulty }) => ({ slot, name, character, variant, bot: Boolean(bot), difficulty })),
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
                message.winners.length > 0 && message.winners.every(slot => match.roster.some(entry => entry.slot === slot))) {
                this.endMatch(match, message.winners, match.pendingEnd?.reason ?? END_REASONS.KO, message.results, message.stats);
            } else if (message.t === 'afk' && typeof message.s === 'string' && match.players[message.s] && !match.left.has(message.s)) {
                const client = match.players[message.s];
                this.log(`Match ${match.id}: ${client.name} (${message.s}) was kicked for being AFK`);
                if (client.match === match) this.sendToPlayer(client, { t: 'matchEnd', winners: null, reason: END_REASONS.AFK });
                this.forfeit(match, message.s, END_REASONS.AFK);
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
            this.sendToPlayer(client, { t: 'matchStart' });
        }
        for (const viewer of match.viewers) {
            if (viewer.spectating === match) this.sendToPlayer(viewer, { t: 'matchStart' });
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
        for (const player of [...Object.values(match.players), ...match.viewers]) {
            if (player.match === match || player.watching === match || player.spectating === match) {
                sendJson(player.ws, { t: 'chat', s: slot, m: phrase });
            }
        }
    }

    forfeit(match, leavingSlot, reason) {
        if (match.state === 'ended' || match.left.has(leavingSlot)) return;
        match.left.add(leavingSlot);
        if (Object.keys(match.players).every(slot => match.left.has(slot))) {
            this.endMatch(match, null, reason);
            return;
        }
        const staying = match.roster.filter(entry => !match.left.has(entry.slot));
        const teams = new Set(staying.map(entry => entry.team));
        const client = match.players[leavingSlot];
        if (teams.size <= 1) {
            const winners = staying.map(entry => entry.slot);
            if (match.state !== 'running' || !match.authority) {
                this.endMatch(match, winners.length ? winners : null, reason);
                return;
            }
            if (reason === END_REASONS.FORFEIT && client.match === match) {
                sendJson(client.ws, { t: 'matchEnd', winners, reason });
            }
            clearTimeout(match.pendingEnd?.timer);
            match.pendingEnd = {
                reason,
                timer: setTimeout(() => this.endMatch(match, winners.length ? winners : null, reason), RESULT_WAIT_MS)
            };
        }
        sendJson(match.authority, { t: 'playerLeft', s: leavingSlot });
        if (client.match === match) this.returnFromMatch(client);
        this.log(`Match ${match.id}: ${client.name} (${leavingSlot}) left${match.pendingEnd ? ', waiting for the final results' : ', the match goes on'}`);
        this.tryStart(match);
    }

    endMatch(match, winners, reason, results = null, rawStats = null) {
        if (match.state === 'ended') return;
        match.state = 'ended';
        clearTimeout(match.bootTimer);
        clearTimeout(match.pendingEnd?.timer);
        const winnerNames = (winners ?? []).map(slot => match.roster.find(entry => entry.slot === slot)?.name).join(' + ');
        this.log(`Match ${match.id} ended: ${reason}${winnerNames ? `, ${winnerNames} won` : ''}`);

        const stats = cleanMatchStats(rawStats, match.roster.map(entry => entry.slot));
        const room = match.room;
        let record = null;
        if (room && room.match === match) {
            for (const slot of winners ?? []) {
                const winner = match.players[slot];
                if (winner && room.members.includes(winner)) room.record.set(winner.id, (room.record.get(winner.id) ?? 0) + 1);
            }
            record = Object.fromEntries(Object.entries(match.players).map(([slot, client]) => [slot, room.record.get(client.id) ?? 0]));
        }
        const summary = { winners, reason, ...(stats ? { stats } : {}), ...(record ? { record } : {}) };
        for (const client of Object.values(match.players)) {
            if (client.match !== match) continue;
            const result = results && typeof results === 'object' && !match.tournament ? cleanMatchResult(results[client.slot]) : null;
            this.sendToPlayer(client, { t: 'matchEnd', ...summary, ...(result ? { result } : {}) });
            client.watching = reason === END_REASONS.KO ? match : null;
            this.returnFromMatch(client);
        }
        for (const viewer of this.matchViewers(match)) {
            this.sendToPlayer(viewer, { t: 'matchEnd', ...summary, spectator: true });
            viewer.watching = reason === END_REASONS.KO ? match : null;
            viewer.spectating = null;
        }
        if (room && room.match === match) {
            room.match = null;
            for (const member of room.members) member.ready = false;
            if (this.lobbies.get(room.id) === room) this.lobbyChanged(room);
        }
        this.broadcastStatus();

        // Keep the arena up a moment after a KO so the final frames reach players.
        const linger = reason === END_REASONS.KO ? END_LINGER_MS : 0;
        setTimeout(() => {
            this.matches.delete(match.id);
            match.authority?.close();
            this.closeAuthority(match);
            this.broadcastStatus();
        }, linger);
    }

    returnFromMatch(client) {
        client.match = null;
        client.slot = null;
        client.ready = false;
        client.state = client.lobby ? 'lobby' : 'idle';
        this.sendRooms(client);
    }

    slotsUsed() {
        let used = 0;
        for (const match of this.matches.values()) used += match.tournament ? TOURNAMENT.matchCost : 1;
        return used;
    }

    hasRoomFor(cost) {
        return this.slotsUsed() + cost <= this.maxMatches;
    }

    syncClient(client) {
        this.sendRooms(client);
        if (client.lobby && this.lobbies.get(client.lobby.id) === client.lobby) {
            sendJson(client.ws, { t: 'lobby', lobby: this.describeLobby(client.lobby, client) });
        }
    }

    findTournamentCode(code) {
        if (typeof code !== 'string' || !code || code.length > TOURNAMENT.maxCodeLength) return null;
        const given = hashCode(code.trim());
        let found = null;
        for (const each of this.tournamentCodes) {
            if (crypto.timingSafeEqual(given, hashCode(each))) found = each;
        }
        return found;
    }

    createTournament(client, message) {
        if (client.state !== 'idle') return;
        const fail = msg => sendJson(client.ws, { t: 'tournamentFailed', msg });
        if (!this.tournamentCodes.length) {
            fail('Tournament matches are not set up on this server.');
            return;
        }
        if (this.tooManyBadCodes(client)) {
            fail('Too many wrong codes. Wait a minute and try again.');
            return;
        }
        const code = this.findTournamentCode(message.code);
        if (!code) {
            client.badInviteCodes.push(Date.now());
            fail('That tournament match code is wrong.');
            return;
        }
        if ([...this.lobbies.values()].some(lobby => lobby.tournament && lobby.tournamentCode === code)) {
            fail('A tournament match is already open with that code.');
            return;
        }
        if (this.deviceBusy(client)) {
            fail(SAME_DEVICE_MESSAGE);
            return;
        }
        if (message.name !== undefined && !this.setName(client, message.name)) {
            fail('That name is not allowed. Pick a different one.');
            return;
        }
        const lobby = {
            id: client.id,
            inviteCode: this.uniqueInviteCode(),
            name: cleanName(`${client.name}${TOURNAMENT_NAME_SUFFIX}`, MAX_LOBBY_NAME_LENGTH + TOURNAMENT_NAME_SUFFIX.length),
            mode: '1v1',
            map: 'RANDOM',
            modifiers: [],
            members: [],
            spectators: [],
            host: client,
            bot: null,
            private: true,
            invited: new Set(),
            tournament: true,
            tournamentCode: code,
            bans: new Map(),
            record: new Map(),
            mapPicker: null,
            kicked: new Set(),
            match: null
        };
        this.lobbies.set(lobby.id, lobby);
        client.invitesSent.clear();
        client.ready = false;
        client.state = 'lobby';
        client.lobby = lobby;
        this.log(`${client.name} opened tournament room "${lobby.name}"`);
        this.lobbyChanged(lobby);
    }

    isKickedFrom(lobby, client) {
        return lobby.kicked.has(client.id) || (client.deviceId && lobby.kicked.has(client.deviceId));
    }

    joinTournament(client, lobby, message, byCode) {
        const watching = message.watch === true;
        if (!watching && !byCode && !lobby.invited.has(client.id)) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'Playing in a tournament match needs an invite. You can still watch it.' });
            return;
        }
        if (this.isKickedFrom(lobby, client)) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'The host removed you from that tournament match.' });
            return;
        }
        const asPlayer = !watching && lobby.members.length < TOURNAMENT.players && !lobby.match;
        if (!asPlayer && lobby.spectators.length >= TOURNAMENT.spectators) {
            sendJson(client.ws, { t: 'joinFailed', msg: 'That tournament match already has the most viewers it can take.' });
            return;
        }
        if (this.deviceBusy(client)) {
            sendJson(client.ws, { t: 'joinFailed', msg: SAME_DEVICE_MESSAGE });
            return;
        }
        if (!this.readChoice(client, message)) return;
        this.dequeue(client);
        client.ready = false;
        client.state = 'lobby';
        client.lobby = lobby;
        if (asPlayer) {
            lobby.members.push(client);
            this.playersChanged(lobby);
        } else {
            lobby.spectators.push(client);
        }
        this.log(`${client.name} joined tournament room "${lobby.name}" as a ${asPlayer ? 'player' : 'spectator'}`);
        this.lobbyChanged(lobby);
        if (!asPlayer && lobby.match && lobby.match.state !== 'ended') this.startSpectating(client, lobby.match);
    }

    playersChanged(lobby, { keepPendingBans = true } = {}) {
        if (keepPendingBans && !lobby.bansLocked) {
            const stillHere = new Set(lobby.members.map(member => member.id));
            for (const id of [...lobby.bans.keys()]) if (!stillHere.has(id)) lobby.bans.delete(id);
        } else {
            lobby.bans.clear();
        }
        lobby.bansLocked = false;
        lobby.record.clear();
        for (const member of lobby.members) member.ready = false;
        if (lobby.mapPicker && !lobby.members.includes(lobby.mapPicker)) lobby.mapPicker = null;
    }

    leaveTournament(client, lobby) {
        this.stopWatching(client, false);
        client.lobby = null;
        client.ready = false;
        if (client.state === 'lobby') client.state = 'idle';
        if (client === lobby.host) {
            this.closeTournament(lobby);
            return;
        }
        if (lobby.members.includes(client)) {
            lobby.members = lobby.members.filter(member => member !== client);
            if (!lobby.match) this.playersChanged(lobby);
        }
        lobby.spectators = lobby.spectators.filter(spectator => spectator !== client);
        this.lobbyChanged(lobby);
    }

    closeTournament(lobby) {
        this.lobbies.delete(lobby.id);
        this.log(`Tournament room "${lobby.name}" closed`);
        for (const client of [...lobby.members, ...lobby.spectators]) {
            client.lobby = null;
            client.ready = false;
            if (client.state === 'lobby') client.state = 'idle';
            if (!client.match && !client.spectating) this.sendToPlayer(client, { t: 'roomClosed', msg: 'The host closed the tournament match.' });
        }
        lobby.members = [];
        lobby.spectators = [];
        this.roomsChanged();
    }

    tournamentTarget(client, message) {
        const lobby = client.lobby;
        if (!lobby?.tournament || lobby.host !== client || lobby.match) return null;
        const tag = String(message.tag ?? '');
        const target = [...lobby.members, ...lobby.spectators].find(each => each.tag === tag);
        return target ? { lobby, target } : null;
    }

    kickFromRoom(client, message) {
        const found = this.tournamentTarget(client, message);
        if (!found) return;
        const { lobby, target } = found;
        lobby.kicked.add(target.id);
        if (target.deviceId) lobby.kicked.add(target.deviceId);
        this.leaveTournament(target, lobby);
        this.sendToPlayer(target, { t: 'kicked', msg: 'The host removed you from the tournament match.' });
        this.log(`${client.name} kicked ${target.name} from tournament room "${lobby.name}"`);
    }

    swapRole(client, message) {
        const found = this.tournamentTarget(client, message);
        if (!found) return;
        const { lobby, target } = found;
        if (lobby.members.includes(target)) {
            if (lobby.spectators.length >= TOURNAMENT.spectators) return;
            lobby.members = lobby.members.filter(member => member !== target);
            lobby.spectators.push(target);
        } else {
            if (lobby.members.length >= TOURNAMENT.players) return;
            lobby.spectators = lobby.spectators.filter(spectator => spectator !== target);
            lobby.members.push(target);
        }
        target.ready = false;
        this.playersChanged(lobby);
        this.lobbyChanged(lobby);
    }

    setMapPicker(client, message) {
        const found = this.tournamentTarget(client, message);
        if (!found || !found.lobby.members.includes(found.target)) return;
        const { lobby, target } = found;
        lobby.mapPicker = lobby.mapPicker === target ? null : target;
        this.lobbyChanged(lobby);
    }

    pickRoomMap(client, message) {
        const lobby = client.lobby;
        if (!lobby?.tournament || lobby.mapPicker !== client || lobby.match) return;
        if (!MAP_CHOICES.includes(message.map) || lobby.map === message.map) return;
        lobby.map = message.map;
        this.lobbyChanged(lobby);
    }

    resetBans(client) {
        const lobby = client.lobby;
        if (!lobby?.tournament || lobby.host !== client || lobby.match) return;
        this.playersChanged(lobby, { keepPendingBans: false });
        this.lobbyChanged(lobby);
    }

    banFighter(client, message) {
        const lobby = client.lobby;
        if (!lobby?.tournament || !lobby.members.includes(client) || lobby.match || bothBanned(lobby)) return;
        const character = String(message.character ?? '');
        const variant = String(message.variant ?? '');
        if (!isValidSelection(character, variant)) return;
        lobby.bans.set(client.id, { character, variant });
        if (bothBanned(lobby)) {
            lobby.bansLocked = true;
            for (const member of lobby.members) {
                if (isBanned(lobby, member.choice.character, member.choice.variant)) member.ready = false;
            }
        }
        this.lobbyChanged(lobby);
    }

    startTournamentMatch(client, lobby) {
        const fail = msg => sendJson(client.ws, { t: 'error', msg });
        if (lobby.match) return;
        if (lobby.members.length < TOURNAMENT.players) {
            fail('The tournament match needs 2 players.');
            return;
        }
        if (!bothBanned(lobby)) {
            fail('Both players need to ban a fighter first.');
            return;
        }
        if (lobby.members.some(member => !member.ready)) {
            fail('Both players need to be ready to start.');
            return;
        }
        if (lobby.members.some(member => isBanned(lobby, member.choice.character, member.choice.variant))) {
            fail('A player picked a banned fighter.');
            return;
        }
        if (lobby.members.some(member => member.detached)) {
            fail('Wait for everyone to reconnect.');
            return;
        }
        if (!this.hasRoomFor(TOURNAMENT.matchCost)) {
            fail(BUSY_ARENAS_MESSAGE);
            return;
        }
        lobby.match = this.createMatch({ mode: '1v1', clients: lobby.members, map: lobby.map, modifiers: [], quick: false, room: lobby });
        if (lobby.match.state === 'ended') {
            lobby.match = null;
            return;
        }
        for (const viewer of [lobby.host, ...lobby.spectators]) this.startSpectating(viewer, lobby.match);
        this.lobbyChanged(lobby);
    }

    startSpectating(client, match) {
        if (match.state === 'ended') return;
        client.spectating = match;
        client.watching = null;
        client.matchFound = {
            t: 'matchFound',
            matchId: match.id,
            slot: null,
            spectator: true,
            host: match.room?.host === client,
            map: match.map,
            mode: match.mode,
            quick: false,
            tournament: true,
            roster: match.publicRoster
        };
        this.sendToPlayer(client, client.matchFound);
    }

    viewerLoaded(match, client) {
        if (match.state === 'ended') return;
        match.viewers.add(client);
        if (match.state !== 'running') return;
        sendJson(match.authority, { t: 'fullFrame' });
        this.sendToPlayer(client, { t: 'matchStart' });
    }

    watchRoomMatch(client) {
        const match = client.lobby?.tournament ? client.lobby.match : null;
        if (!match || client.match || client.spectating === match) return;
        this.startSpectating(client, match);
    }

    stopWatching(client, resync = true) {
        const match = client.spectating;
        if (!match) return;
        match.viewers.delete(client);
        client.spectating = null;
        if (resync) this.syncClient(client);
    }

    matchViewers(match) {
        return [...new Set([...match.viewers, ...(match.room ? [match.room.host, ...match.room.spectators] : [])])]
            .filter(viewer => viewer.spectating === match);
    }

    describeTournament(lobby, viewer) {
        const revealBans = bothBanned(lobby) || viewer === lobby.host;
        const status = client => client.detached ? 'reconnecting' : client.away ? 'afk' : 'active';
        const roster = buildRoster('1v1', lobby.members.map(member => ({
            name: member.name,
            character: member.choice.character,
            variant: member.choice.variant,
            tag: member.tag,
            you: member === viewer,
            ready: Boolean(member.ready),
            status: status(member),
            mapPicker: lobby.mapPicker === member,
            wins: lobby.record.get(member.id) ?? 0,
            banned: lobby.bans.has(member.id),
            ban: revealBans || member === viewer ? lobby.bans.get(member.id) ?? null : null
        })));
        const role = viewer === lobby.host ? 'host' : lobby.members.includes(viewer) ? 'player' : 'spectator';
        return {
            id: lobby.id,
            name: lobby.name,
            mode: '1v1',
            map: lobby.map,
            modifiers: [],
            max: TOURNAMENT.players,
            private: true,
            tournament: true,
            inviteCode: lobby.inviteCode,
            host: viewer === lobby.host,
            role,
            hostName: lobby.host.name,
            hostTag: lobby.host.tag,
            hostStatus: status(lobby.host),
            members: roster,
            spectators: lobby.spectators.map(spectator => ({ name: spectator.name, tag: spectator.tag, you: spectator === viewer, status: status(spectator) })),
            maxSpectators: TOURNAMENT.spectators,
            bansDone: bothBanned(lobby),
            bans: revealBans ? [...lobby.bans.values()] : [],
            inMatch: Boolean(lobby.match),
            watching: Boolean(lobby.match && viewer.spectating === lobby.match)
        };
    }

    // ---- status ----

    getStatus() {
        const greeted = [...this.clients.values()].filter(client => client.greeted);
        return {
            online: greeted.length,
            // In the online lobby (browsing or hosting), not in a match.
            waiting: greeted.filter(client => this.isWaiting(client)).length,
            quick: this.queue.length,
            lobbies: this.lobbies.size,
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
        clearInterval(this.silenceTimer);
        for (const match of this.matches.values()) {
            this.endMatch(match, null, END_REASONS.SERVER_ERROR);
        }
    }
}
