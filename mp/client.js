// mp/client.js
// The player's connection to the LAN server. One connection is shared by the
// lobby and the online game scenes, so it lives here instead of in a scene.

import { PROTOCOL_VERSION } from './protocol.js';
import { getOnlineServerUrl } from './serverConfig.js';

class NetClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.clientId = null;
        this.handlers = new Map();
        this.connectPromise = null;
        this.ping = null;
        this.pingTimer = null;
        // Mirror frames that arrive while the game scene is still loading.
        // Frames are only accepted between matchFound and leaving that match.
        this.acceptFrames = false;
        this.frameBuffer = [];
        this.frameHandler = null;
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
                this.sendNow({ t: 'hello', v: PROTOCOL_VERSION });
            });

            socket.addEventListener('message', event => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (message.t === 'm') {
                    this.receiveFrame(message);
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
                    this.startPing();
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
                const wasConnected = this.connected;
                this.connected = false;
                this.socket = null;
                this.connectPromise = null;
                this.stopPing();
                if (!welcomed) reject(new Error('Could not reach the online server.'));
                if (wasConnected) this.emit('disconnected', {});
            });
        });
        return this.connectPromise;
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

    receiveFrame(message) {
        if (!this.acceptFrames) return;
        if (this.frameHandler) {
            this.frameHandler(message);
        } else {
            this.frameBuffer.push(message);
        }
    }

    // The game scene calls this once it can draw; buffered frames are replayed first.
    setFrameHandler(handler) {
        this.frameHandler = handler;
        if (!handler) return;
        const buffered = this.frameBuffer;
        this.frameBuffer = [];
        for (const message of buffered) handler(message);
    }

    clearFrames() {
        this.acceptFrames = false;
        this.frameBuffer = [];
        this.frameHandler = null;
    }
}

export const net = new NetClient();
