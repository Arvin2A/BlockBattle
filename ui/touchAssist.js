// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.


export const TOUCH_ASSIST_RANGE = 75;

export function isPhoneScreen() {
    return Math.min(window.screen.width, window.screen.height) < 600;
}


export function addTouchAssist(scene, buttons) {
    const held = new Map();
    const buttonAt = (pointer, range) => {
        let closest = null;
        let closestGap = range;
        for (const button of buttons) {
            const { circle } = button;
            if (!circle.active || !circle.visible) continue;
            const gap = Math.hypot(pointer.x - circle.x, pointer.y - circle.y) - circle.radius;
            if (gap <= closestGap) {
                closest = button;
                closestGap = gap;
            }
        }
        return closest;
    };
    const releasePointer = pointer => {
        buttons.forEach(button => button.release(pointer));
        held.delete(pointer.id);
    };
    const onPointerDown = (pointer, over) => {
        if (over.length) {
            held.set(pointer.id, buttons.find(button => over.includes(button.circle)) ?? null);
            return;
        }
        const closest = buttonAt(pointer, TOUCH_ASSIST_RANGE);
        closest?.press(pointer);
        held.set(pointer.id, closest);
    };
    const onPointerMove = pointer => {
        if (!pointer.isDown || !held.has(pointer.id)) return;
        const next = buttonAt(pointer, 0);
        const current = held.get(pointer.id);
        if (current?.sticky || !next || next === current) return;
        current?.release(pointer);
        next.press(pointer);
        held.set(pointer.id, next);
    };
    const syncTouches = event => {
        const live = new Set(Array.from(event.touches, touch => touch.identifier));
        for (const pointer of scene.input.manager.pointers) {
            if (!pointer.wasTouch) continue;
            if (pointer.active && live.has(pointer.identifier)) continue;
            if (pointer.active) {
                pointer.active = false;
                pointer.isDown = false;
                pointer.primaryDown = false;
                pointer.buttons = 0;
            }
            releasePointer(pointer);
        }
    };

    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerup', releasePointer);
    scene.input.on('pointerupoutside', releasePointer);
    window.addEventListener('touchstart', syncTouches, true);
    window.addEventListener('touchend', syncTouches);
    window.addEventListener('touchcancel', syncTouches);
    scene.events.once('shutdown', () => {
        scene.input.off('pointerdown', onPointerDown);
        scene.input.off('pointermove', onPointerMove);
        scene.input.off('pointerup', releasePointer);
        scene.input.off('pointerupoutside', releasePointer);
        window.removeEventListener('touchstart', syncTouches, true);
        window.removeEventListener('touchend', syncTouches);
        window.removeEventListener('touchcancel', syncTouches);
    });
}
