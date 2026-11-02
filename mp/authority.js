// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/authority.js
// The "authority" is the real game running in a hidden Chrome tab on the LAN server.
// It is the only place online game logic runs: hits, knockback, KOs, cooldowns, wins.
// Players' browsers just send button presses here and draw what the mirror sends back.
//
// The server opens  /BlockBattle/?authority=<matchId>&key=<secret>  for each match.

import { MirrorCapture } from './mirror.js';
import { getServerSocketUrl, PROTOCOL_VERSION } from './protocol.js';
import { decodeButtons, INPUT_BUTTONS, ALL_BUTTONS_MASK } from '../input.js';
import { AuthorityFastPeer } from './rtc.js';
import { setSelectedCharacters } from '../scenes/CharacterSelectScreen.js';
import { resetMapAndModifierSelection, setSelectedMap } from '../scenes/MapAndModifierSelect.js';
import { getMap } from '../scenes/GameScene/MapDefinitions.js';
import { changeBotMode } from '../gameSettings.js';

function readAuthorityParams() {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const matchId = params.get('authority');
    if (!matchId) return null;
    return {
        matchId,
        key: params.get('key') ?? '',
        // ?render=1 draws the match so you can watch it while debugging.
        render: params.get('render') === '1'
    };
}

export const authorityParams = readAuthorityParams();

export function isAuthority() {
    return authorityParams !== null;
}

let socket = null;
let matchConfig = null;
let capture = null;
let endReported = false;
let matchStarted = false;
const INPUT_SEQ_MEMORY = 256;
const netInputs = {
    p1: { held: decodeButtons(0), pressed: decodeButtons(0), lastSeq: -1, seenSeqs: new Set() },
    p2: { held: decodeButtons(0), pressed: decodeButtons(0), lastSeq: -1, seenSeqs: new Set() }
};
const fastPeers = {};

function send(message) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function startFastPeers(ice) {
    closeFastPeers();
    if (!ice) return;
    for (const slot of Object.keys(netInputs)) {
        fastPeers[slot] = new AuthorityFastPeer(
            ice,
            data => send({ t: 'rtc', s: slot, d: data }),
            text => receiveFastInput(slot, text)
        );
    }
}

function closeFastPeers() {
    for (const slot of Object.keys(fastPeers)) {
        fastPeers[slot].close();
        delete fastPeers[slot];
    }
}

function receiveFastInput(slot, text) {
    if (!matchStarted) return;
    let message;
    try {
        message = JSON.parse(text);
    } catch {
        return;
    }
    if (message?.t !== 'in') return;
    const { h, p, q } = message;
    if (!Number.isInteger(h) || !Number.isInteger(p) || !Number.isSafeInteger(q)) return;
    receiveInput(slot, h & ALL_BUTTONS_MASK, p & ALL_BUTTONS_MASK, q);
}

function isNewInput(input, seq) {
    if (!Number.isSafeInteger(seq)) return true;
    if (input.seenSeqs.has(seq)) return false;
    input.seenSeqs.add(seq);
    if (input.seenSeqs.size > INPUT_SEQ_MEMORY) {
        input.seenSeqs.delete(input.seenSeqs.values().next().value);
    }
    return true;
}

function receiveInput(slot, heldMask, pressedMask, seq) {
    const input = netInputs[slot];
    if (!input || !isNewInput(input, seq)) return;
    const newest = !Number.isSafeInteger(seq) || seq > input.lastSeq;
    if (Number.isSafeInteger(seq) && newest) input.lastSeq = seq;
    if (newest) input.held = decodeButtons(heldMask);
    // Presses add up until the game reads them, so quick taps between frames still count.
    const pressed = decodeButtons(pressedMask);
    for (const button of INPUT_BUTTONS) {
        if (pressed[button]) input.pressed[button] = true;
    }
}

// Called by GameScene's update for each player instead of reading the keyboard.
export function pollNetworkInput(slot) {
    const input = netInputs[slot];
    const pressed = input.pressed;
    input.pressed = decodeButtons(0);
    return { held: input.held, pressed };
}

export function getOnlinePlayerNames() {
    return matchConfig
        ? { p1: matchConfig.p1.name, p2: matchConfig.p2.name }
        : null;
}

// Boot scene: loads every game asset, tells the server it's ready, waits for "start".
function createAuthorityBootScene(preload) {
    return {
        key: 'AuthorityBootScene',
        preload,
        create() {
            const url = `${getServerSocketUrl()}?role=authority&match=${encodeURIComponent(authorityParams.matchId)}&key=${encodeURIComponent(authorityParams.key)}`;
            socket = new WebSocket(url);

            socket.addEventListener('open', () => {
                send({ t: 'hello', v: PROTOCOL_VERSION });
            });

            socket.addEventListener('message', event => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                switch (message.t) {
                    case 'in':
                        receiveInput(message.s, message.h, message.p, message.q);
                        break;
                    case 'rtc':
                        fastPeers[message.s]?.signal(message.d);
                        break;
                    case 'config':
                        matchConfig = message;
                        changeBotMode(false);
                        resetMapAndModifierSelection();
                        setSelectedMap(getMap(message.map));
                        setSelectedCharacters(
                            message.p1.character, message.p1.variant,
                            message.p2.character, message.p2.variant
                        );
                        startFastPeers(message.ice);
                        send({ t: 'ready' });
                        break;
                    case 'start':
                        matchStarted = true;
                        this.scene.start('GameScene');
                        break;
                }
            });

            // The server closes this tab when the match is over, but if it goes away
            // first there is nothing left to do here.
            socket.addEventListener('close', () => {
                closeFastPeers();
                this.game.loop.stop();
            });
        }
    };
}

// Starts recording at the top of GameScene.create(), so sounds made while
// the scene is being built (like the chainsaw loop) reach the players too.
export function beginAuthorityCapture(scene) {
    endReported = false;
    capture = new MirrorCapture(scene);
}

// Hooks the mirror into a freshly created GameScene.
export function attachAuthority(scene) {
    const players = scene.gameState.players;
    const camera = scene.cameras.main;

    // postupdate runs after physics has moved everything for this frame.
    scene.events.on('postupdate', () => {
        // Headless Phaser never renders, so clamp the camera like a render would.
        camera.preRender();
        const message = capture.capture();
        if (!message) return;
        message.ts = Math.round(performance.now() * 10) / 10;
        if (message.f === 0) {
            message.meta = {
                players: {
                    p1: capture.idOf(players.player),
                    p2: capture.idOf(players.player2)
                }
            };
        }
        if (socket?.readyState !== WebSocket.OPEN) return;
        const text = JSON.stringify(message);
        socket.send(text);
        for (const peer of Object.values(fastPeers)) peer.send(text);
    });
}

export function reportMatchEnd(winnerSlot) {
    if (endReported) return;
    endReported = true;
    send({ t: 'end', winner: winnerSlot });
}

export function createAuthorityGame(Phaser, baseConfig, gameScene) {
    const config = {
        ...baseConfig,
        type: authorityParams.render ? Phaser.AUTO : Phaser.HEADLESS,
        scene: [createAuthorityBootScene(gameScene.prototype.preload), gameScene],
        // Hidden tabs pause requestAnimationFrame, so drive the game with timers
        // instead. Only one tab at a time is "in front" when several matches run.
        fps: { target: 60, forceSetTimeOut: !authorityParams.render },
        disableContextMenu: true
    };
    // Phaser normally pauses when its tab is hidden or loses focus. A match host
    // is never "looked at", so it must ignore all of that.
    class AuthorityGame extends Phaser.Game {
        onHidden() {}
        onVisible() {}
        onBlur() {}
        onFocus() {}
    }
    const game = new AuthorityGame(config);
    game.events.once('ready', () => {
        game.sound.pauseOnBlur = false;
    });
    return game;
}
