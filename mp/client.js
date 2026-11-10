// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/client.js
// The player's connection to the online server. One connection is shared by the
// lobby and the online game scenes, so it lives here instead of in a scene.

import { PROTOCOL_VERSION, DEVICE_ID_STORAGE_KEY, cleanDeviceId } from './protocol.js';

function getDeviceId() {
    try {
        const saved = cleanDeviceId(localStorage.getItem(DEVICE_ID_STORAGE_KEY));
        if (saved) return saved;
        const id = crypto.randomUUID?.() ??
            Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
        return id;
    } catch {
        return null;
    }
}
import { getOnlineServerUrl } from './serverConfig.js';
import { PlayerFastPeer } from './rtc.js';

class NetClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.clientId = null;
        this.tag = null;
        this.name = null;
        this.handlers = new Map();
        this.connectPromise = null;
        this.ping = null;
        this.pingTimer = null;
        // Mirror frames that arrive while the game scene is still loading.
        // Frames are only accepted between matchFound and leaving that match.
        this.acceptFrames = false;
        this.frameBuffer = [];
        this.frameHandler = null;
        this.away = null;
        this.sendAway = () => {
            const away = document.hidden || !document.hasFocus();
            if (away === this.away) return;
            this.away = away;
            this.send({ t: 'away', a: away });
        };
        this.fastPeer = new PlayerFastPeer(
            data => this.send({ t: 'rtc', d: data }),
            text => this.receiveFastMessage(text)
        );
    }

    on(type, handler) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(handler);
        return () => this.handlers.get(type)?.delete(handler);
    }

    emit(type, message) {
        for (const handler of this.handlers.get(type) ?? []) handler(message);
    }

    connect() {
        if (this.connected) return Promise.resolve();
        if (this.connectPromise) return this.connectPromise;

        this.connectPromise = new Promise((resolve, reject) => {
            let socket;
            try {
                socket = new WebSocket(getOnlineServerUrl());
            } catch (error) {
                this.connectPromise = null;
                reject(error);
                return;
            }
            this.socket = socket;
            let welcomed = false;

            const timeout = setTimeout(() => {
                if (!welcomed) socket.close();
            }, 5000);

            socket.addEventListener('open', () => {
                this.sendNow({ t: 'hello', v: PROTOCOL_VERSION, d: getDeviceId(), n: this.name ?? undefined });
            });

            socket.addEventListener('message', event => {
                if (this.socket !== socket) return;
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (message.t === 'm') {
                    this.receiveFrame(message, false);
                    return;
                }
                if (message.t === 'rtc') {
                    if (this.acceptFrames) this.fastPeer.signal(message.d);
                    return;
                }
                if (message.t === 'matchFound') {
                    this.clearFrames();
                    this.acceptFrames = true;
                }
                if (message.t === 'welcome') {
                    welcomed = true;
                    clearTimeout(timeout);
                    this.connected = true;
                    this.clientId = message.id;
                    this.tag = message.tag ?? null;
                    this.startPing();
                    this.watchAway();
                    resolve();
                } else if (message.t === 'pong') {
                    this.ping = Math.round(performance.now() - message.c);
                } else if (message.t === 'error' && !welcomed) {
                    clearTimeout(timeout);
                    this.connectPromise = null;
                    reject(new Error(message.msg));
                }
                this.emit(message.t, message);
            });

            socket.addEventListener('close', () => {
                clearTimeout(timeout);
                if (!welcomed) reject(new Error('Could not reach the online server.'));
                if (this.socket !== socket) return;
                const wasConnected = this.connected;
                this.connected = false;
                this.socket = null;
                this.connectPromise = null;
                this.stopPing();
                this.unwatchAway();
                this.fastPeer.close();
                if (wasConnected) this.emit('disconnected', {});
            });
        });
        return this.connectPromise;
    }

    disconnect() {
        const socket = this.socket;
        if (!socket) return;
        this.socket = null;
        this.connected = false;
        this.connectPromise = null;
        this.clientId = null;
        this.tag = null;
        this.stopPing();
        this.unwatchAway();
        this.fastPeer.close();
        socket.close();
    }

    setName(name) {
        if (name === this.name) return;
        this.name = name;
        this.send({ t: 'name', name });
    }

    watchAway() {
        this.away = null;
        this.sendAway();
        document.addEventListener('visibilitychange', this.sendAway);
        window.addEventListener('focus', this.sendAway);
        window.addEventListener('blur', this.sendAway);
    }

    unwatchAway() {
        document.removeEventListener('visibilitychange', this.sendAway);
        window.removeEventListener('focus', this.sendAway);
        window.removeEventListener('blur', this.sendAway);
    }

    sendInput(message) {
        this.send(message);
        if (this.connected) this.fastPeer.send(JSON.stringify(message));
    }

    get fastConnected() {
        return this.fastPeer.open;
    }

    sendNow(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    send(message) {
        if (this.connected) this.sendNow(message);
    }

    startPing() {
        this.stopPing();
        const ping = () => this.send({ t: 'ping', c: performance.now() });
        ping();
        this.pingTimer = setInterval(ping, 2000);
    }

    stopPing() {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
    }

    // ---- mirror frames ----

    receiveFastMessage(text) {
        let message;
        try {
            message = JSON.parse(text);
        } catch {
            return;
        }
        if (message?.t === 'm') this.receiveFrame(message, true);
    }

    receiveFrame(message, fast) {
        if (!this.acceptFrames) return;
        if (this.frameHandler) {
            this.frameHandler(message, fast);
        } else {
            this.frameBuffer.push([message, fast]);
        }
    }

    // The game scene calls this once it can draw; buffered frames are replayed first.
    setFrameHandler(handler) {
        this.frameHandler = handler;
        if (!handler) return;
        const buffered = this.frameBuffer;
        this.frameBuffer = [];
        for (const [message, fast] of buffered) handler(message, fast);
    }

    clearFrames() {
        this.acceptFrames = false;
        this.frameBuffer = [];
        this.frameHandler = null;
        this.fastPeer.close();
    }
}

export const net = new NetClient();
