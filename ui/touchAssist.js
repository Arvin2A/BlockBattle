// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.


export const TOUCH_ASSIST_RANGE = 75;

export function isPhoneScreen() {
    return Math.min(window.screen.width, window.screen.height) < 600;
}

function topInteractive(game, x, y) {
    for (const scene of game.scene.getScenes(true, true)) {
        const input = scene.sys.input;
        if (!input?.enabled) continue;
        const probe = { x, y, worldX: 0, worldY: 0, camera: null };
        const hits = input.hitTestPointer(probe);
        if (hits.length) return input.sortGameObjects(hits, probe)[0];
    }
    return null;
}

export function addTouchAssist(scene, buttons) {
    const game = scene.sys.game;
    const held = new Map();
    const pointerFor = (id, x, y) => ({ id, x, y, isDown: true });

    const buttonAt = (x, y, range) => {
        let closest = null;
        let closestGap = range;
        for (const button of buttons) {
            const { circle } = button;
            if (!circle.active || !circle.visible) continue;
            const gap = Math.hypot(x - circle.x, y - circle.y) - circle.radius;
            if (gap <= closestGap) {
                closest = button;
                closestGap = gap;
            }
        }
        return closest;
    };

    const claim = (x, y) => {
        const top = topInteractive(game, x, y);
        if (top) return buttons.find(button => button.circle === top) ?? null;
        return buttonAt(x, y, TOUCH_ASSIST_RANGE);
    };

    const onGame = target => target === game.canvas || target === document.body ||
        target === document.documentElement || target?.id === 'game';

    const track = (id, x, y, target = game.canvas) => {
        const pointer = pointerFor(id, x, y);
        if (!held.has(id)) {
            const button = onGame(target) ? claim(x, y) : null;
            held.set(id, button);
            button?.press(pointer);
            return;
        }
        const current = held.get(id);
        if (current?.sticky) {
            current.move?.(pointer);
            return;
        }
        const next = buttonAt(x, y, 0);
        if (!next || next === current) return;
        current?.release(pointer);
        next.press(pointer);
        held.set(id, next);
    };

    const drop = id => {
        const button = held.get(id);
        held.delete(id);
        button?.release(pointerFor(id, 0, 0));
    };

    const dropAll = () => {
        for (const id of [...held.keys()]) drop(id);
    };

    const freeStalePointers = identifiers => {
        for (const pointer of scene.input.manager.pointers) {
            if (!pointer.wasTouch || !pointer.active || identifiers.has(pointer.identifier)) continue;
            pointer.active = false;
            pointer.isDown = false;
            pointer.primaryDown = false;
            pointer.buttons = 0;
        }
    };

    const syncTouches = event => {
        const live = new Map();
        for (const touch of event.touches) live.set(`touch${touch.identifier}`, touch);
        for (const id of [...held.keys()]) {
            if (id.startsWith('touch') && !live.has(id)) drop(id);
        }
        for (const [id, touch] of live) {
            track(id, scene.scale.transformX(touch.pageX), scene.scale.transformY(touch.pageY), touch.target);
        }
        if (event.type === 'touchstart') {
            freeStalePointers(new Set(Array.from(event.touches, touch => touch.identifier)));
        }
    };

    const isMouse = pointer => pointer === scene.input.mousePointer;
    const onMouseDown = pointer => {
        if (isMouse(pointer)) track('mouse', pointer.x, pointer.y);
    };
    const onMouseMove = pointer => {
        if (isMouse(pointer) && held.has('mouse')) track('mouse', pointer.x, pointer.y);
    };
    const onMouseUp = pointer => {
        if (isMouse(pointer)) drop('mouse');
    };

    const touchEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    const listenOptions = { capture: true, passive: true };
    for (const name of touchEvents) window.addEventListener(name, syncTouches, listenOptions);
    scene.input.on('pointerdown', onMouseDown);
    scene.input.on('pointermove', onMouseMove);
    scene.input.on('pointerup', onMouseUp);
    scene.input.on('pointerupoutside', onMouseUp);
    game.events.on('blur', dropAll);
    game.events.on('hidden', dropAll);
    scene.events.once('shutdown', () => {
        dropAll();
        for (const name of touchEvents) window.removeEventListener(name, syncTouches, listenOptions);
        scene.input.off('pointerdown', onMouseDown);
        scene.input.off('pointermove', onMouseMove);
        scene.input.off('pointerup', onMouseUp);
        scene.input.off('pointerupoutside', onMouseUp);
        game.events.off('blur', dropAll);
        game.events.off('hidden', dropAll);
    });
}
