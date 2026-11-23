// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const net = require('node:net');
const path = require('node:path');

const DISCORD_CLIENT_ID = '1574228164157382758';
const RETRY_MS = 15000;
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function socketPaths() {
    if (process.platform === 'win32') {
        return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
    }
    const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
    const dirs = [base, path.join(base, 'app', 'com.discordapp.Discord'), path.join(base, 'snap.discord'), path.join(base, '.flatpak', 'com.discordapp.Discord', 'xdg-run')];
    const paths = [];
    for (const dir of dirs) {
        for (let i = 0; i < 10; i++) paths.push(path.join(dir, `discord-ipc-${i}`));
    }
    return paths;
}

function encode(op, data) {
    const json = Buffer.from(JSON.stringify(data));
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(json.length, 4);
    return Buffer.concat([header, json]);
}

function tryConnect(paths, index = 0) {
    return new Promise(resolve => {
        if (index >= paths.length) return resolve(null);
        const socket = net.createConnection(paths[index]);
        socket.once('connect', () => resolve(socket));
        socket.once('error', () => {
            socket.destroy();
            resolve(tryConnect(paths, index + 1));
        });
    });
}

class DiscordPresence {
    constructor() {
        this.socket = null;
        this.ready = false;
        this.activity = null;
        this.buffer = Buffer.alloc(0);
        this.nonce = 0;
        this.retryTimer = null;
        this.stopped = false;
    }

    start() {
        if (!DISCORD_CLIENT_ID) return;
        this.connect();
    }

    async connect() {
        if (this.stopped || this.socket) return;
        const socket = await tryConnect(socketPaths());
        if (!socket || this.stopped) {
            socket?.destroy();
            this.scheduleRetry();
            return;
        }
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        socket.on('data', chunk => this.onData(chunk));
        socket.on('close', () => this.onClose());
        socket.on('error', () => socket.destroy());
        socket.write(encode(OP.HANDSHAKE, { v: 1, client_id: DISCORD_CLIENT_ID }));
    }

    scheduleRetry() {
        if (this.stopped || this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.connect();
        }, RETRY_MS);
    }

    onClose() {
        this.socket = null;
        this.ready = false;
        this.scheduleRetry();
    }

    onData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 8) {
            const op = this.buffer.readInt32LE(0);
            const length = this.buffer.readInt32LE(4);
            if (this.buffer.length < 8 + length) return;
            const body = this.buffer.subarray(8, 8 + length).toString();
            this.buffer = this.buffer.subarray(8 + length);
            let message = null;
            try {
                message = JSON.parse(body);
            } catch {
            }
            if (op === OP.PING) {
                this.socket?.write(encode(OP.PONG, message));
            } else if (op === OP.CLOSE) {
                this.socket?.destroy();
            } else if (message?.evt === 'READY') {
                this.ready = true;
                this.send();
            }
        }
    }

    send() {
        if (!this.ready || !this.socket) return;
        this.socket.write(encode(OP.FRAME, {
            cmd: 'SET_ACTIVITY',
            args: { pid: process.pid, activity: this.activity },
            nonce: String(++this.nonce)
        }));
    }

    setActivity(status) {
        if (!status || typeof status !== 'object') {
            this.activity = null;
        } else {
            const text = value => typeof value === 'string' && value.length >= 2 ? value.slice(0, 128) : undefined;
            this.activity = {
                details: text(status.details),
                state: text(status.state),
                timestamps: Number.isFinite(status.startTimestamp) ? { start: Math.floor(status.startTimestamp) } : undefined,
                assets: { large_image: 'icon', large_text: 'BLOCK BATTLE!!' },
                instance: false
            };
        }
        this.send();
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.retryTimer);
        this.socket?.destroy();
    }
}

module.exports = { DiscordPresence };
