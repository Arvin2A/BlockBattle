// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const CHANNEL_LABEL = 'fast';
const CHANNEL_OPTIONS = { ordered: false, maxRetransmits: 0 };
const MAX_CHANNEL_MESSAGE = 64000;
const MAX_CHANNEL_BUFFERED = 256 * 1024;

export const MAX_FAST_INPUT_LENGTH = 200;

function peerConfig(ice) {
    return {
        iceServers: ice?.servers ?? [],
        iceTransportPolicy: ice?.relayOnly ? 'relay' : 'all'
    };
}

function canUseWebRtc() {
    return typeof RTCPeerConnection === 'function';
}

class FastPeer {
    constructor(sendSignal) {
        this.sendSignal = sendSignal;
        this.pc = null;
        this.channel = null;
        this.chain = Promise.resolve();
    }

    queue(step) {
        this.chain = this.chain.then(step).catch(() => {});
    }

    watchChannel(channel, onMessage) {
        channel.onopen = () => {
            this.channel = channel;
        };
        channel.onclose = () => {
            if (this.channel === channel) this.channel = null;
        };
        channel.onmessage = event => {
            if (typeof event.data === 'string') onMessage(event.data);
        };
    }

    startPeer(ice) {
        this.close();
        const pc = new RTCPeerConnection(peerConfig(ice));
        pc.onicecandidate = event => {
            if (event.candidate && this.pc === pc) this.sendSignal({ c: event.candidate.toJSON() });
        };
        this.pc = pc;
        return pc;
    }

    addCandidate(candidate) {
        const pc = this.pc;
        if (!pc || !candidate) return;
        this.queue(() => pc.addIceCandidate(candidate));
    }

    get open() {
        return this.channel?.readyState === 'open';
    }

    send(text) {
        if (!this.open || text.length > MAX_CHANNEL_MESSAGE) return false;
        if (this.channel.bufferedAmount > MAX_CHANNEL_BUFFERED) return false;
        try {
            this.channel.send(text);
            return true;
        } catch {
            return false;
        }
    }

    close() {
        this.channel = null;
        this.pc?.close();
        this.pc = null;
        this.chain = Promise.resolve();
    }
}

export class AuthorityFastPeer extends FastPeer {
    constructor(ice, sendSignal, onMessage) {
        super(sendSignal);
        if (!canUseWebRtc()) return;
        const pc = this.startPeer(ice);
        this.watchChannel(pc.createDataChannel(CHANNEL_LABEL, CHANNEL_OPTIONS), text => {
            if (text.length <= MAX_FAST_INPUT_LENGTH) onMessage(text);
        });
        this.queue(async () => {
            await pc.setLocalDescription(await pc.createOffer());
            if (this.pc === pc) this.sendSignal({ sdp: pc.localDescription.toJSON(), ice });
        });
    }

    signal(data) {
        if (data?.sdp?.type === 'answer' && this.pc) {
            const pc = this.pc;
            this.queue(() => pc.setRemoteDescription(data.sdp));
        } else if (data?.c) {
            this.addCandidate(data.c);
        }
    }
}

export class PlayerFastPeer extends FastPeer {
    constructor(sendSignal, onMessage) {
        super(sendSignal);
        this.onMessage = onMessage;
    }

    signal(data) {
        if (!canUseWebRtc()) return;
        if (data?.sdp?.type === 'offer') {
            const pc = this.startPeer(data.ice);
            pc.ondatachannel = event => this.watchChannel(event.channel, this.onMessage);
            this.queue(async () => {
                await pc.setRemoteDescription(data.sdp);
                await pc.setLocalDescription(await pc.createAnswer());
                if (this.pc === pc) this.sendSignal({ sdp: pc.localDescription.toJSON() });
            });
        } else if (data?.c) {
            this.addCandidate(data.c);
        }
    }
}
