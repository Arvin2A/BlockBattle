// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// input.js
// Every player's controls end up in one "input state" object, no matter if they
// come from this keyboard, a touch screen, a controller, or (online) the network.
// The game only ever reads these states, so it doesn't care where inputs came from.

export const INPUT_BUTTONS = ['left', 'right', 'up', 'down', 'attack', 'special', 'misc'];

// Movement presses stay saved until the game uses them (same as Phaser's JustDown),
// so a tap during hitstun still counts once hitstun ends.
const SAVED_PRESSES = ['left', 'right', 'up', 'down'];
// Attack/special/misc presses only count on the frame they happen.
const FRAME_PRESSES = ['attack', 'special', 'misc'];

export function createInputState() {
    const state = { touchPressed: {} };
    for (const button of INPUT_BUTTONS) {
        state[button] = false;
        state[button + 'Pressed'] = false;
        state.touchPressed[button] = false;
    }
    return state;
}

// held/pressed/touch are { button: bool } maps for this frame.
export function applyInputFrame(state, { held, pressed, touch = {} }) {
    for (const button of INPUT_BUTTONS) {
        state[button] = Boolean(held[button]);
    }
    for (const button of SAVED_PRESSES) {
        if (!pressed[button]) continue;
        state[button + 'Pressed'] = true;
        state.touchPressed[button] = state.touchPressed[button] || Boolean(touch[button]);
    }
    for (const button of FRAME_PRESSES) {
        state[button + 'Pressed'] = Boolean(pressed[button]);
        state.touchPressed[button] = Boolean(pressed[button] && touch[button]);
    }
}

// Marks a saved press as used. Returns true if it came from a touch button.
export function consumePress(state, button) {
    const fromTouch = state.touchPressed[button];
    state[button + 'Pressed'] = false;
    state.touchPressed[button] = false;
    return fromTouch;
}

// Buttons <-> bitmask, used to send inputs over the network in a few bytes.
export function encodeButtons(flags) {
    let mask = 0;
    INPUT_BUTTONS.forEach((button, index) => {
        if (flags[button]) mask |= 1 << index;
    });
    return mask;
}

export function decodeButtons(mask) {
    const flags = {};
    INPUT_BUTTONS.forEach((button, index) => {
        flags[button] = (mask & (1 << index)) !== 0;
    });
    return flags;
}

export const ALL_BUTTONS_MASK = (1 << INPUT_BUTTONS.length) - 1;

// ---- controllers ----

export function emptyControllerInput() {
    return {
        left: false,
        right: false,
        up: false,
        down: false,
        leftPressed: false,
        rightPressed: false,
        upPressed: false,
        downPressed: false,
        attack: false,
        attackPressed: false,
        special: false,
        specialPressed: false,
        misc: false,
        miscPressed: false,
        pausePressed: false
    };
}

export function controllerButtonPressed(pad, index) {
    const button = pad.buttons[index];
    return Boolean(button && (button.pressed || button.value > 0.5));
}

export function readControllerInput(pad, previous) {
    const dpadLeft = controllerButtonPressed(pad, 14);
    const dpadRight = controllerButtonPressed(pad, 15);
    const dpadUp = controllerButtonPressed(pad, 12);
    const dpadDown = controllerButtonPressed(pad, 13);
    const left = dpadLeft || Math.round(pad.axes[0] ?? 0) < 0;
    const right = dpadRight || Math.round(pad.axes[0] ?? 0) > 0;
    const up = dpadUp || controllerButtonPressed(pad, 3);
    const down = dpadDown || Math.round(pad.axes[1] ?? 0) > 0;
    const attack = controllerButtonPressed(pad, 0);
    const special = controllerButtonPressed(pad, 1);
    const misc = controllerButtonPressed(pad, 2);

    return {
        left,
        right,
        up,
        down,
        leftPressed: left && !previous.left,
        rightPressed: right && !previous.right,
        upPressed: up && !previous.up,
        downPressed: down && !previous.down,
        attack,
        attackPressed: attack && !previous.attack,
        special,
        specialPressed: special && !previous.special,
        misc,
        miscPressed: misc && !previous.misc
    };
}
