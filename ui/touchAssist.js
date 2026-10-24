// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.


export const TOUCH_ASSIST_RANGE = 75;


export function addTouchAssist(scene, buttons) {
    const onPointerDown = (pointer, over) => {
        if (over.length) return;
        let closest = null;
        let closestGap = TOUCH_ASSIST_RANGE;
        for (const button of buttons) {
            const { circle } = button;
            if (!circle.active || !circle.visible) continue;
            const gap = Math.hypot(pointer.x - circle.x, pointer.y - circle.y) - circle.radius;
            if (gap <= closestGap) {
                closest = button;
                closestGap = gap;
            }
        }
        closest?.press(pointer);
    };
    const onPointerUp = pointer => buttons.forEach(button => button.release(pointer));

    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointerup', onPointerUp);
    scene.input.on('pointerupoutside', onPointerUp);
    scene.events.once('shutdown', () => {
        scene.input.off('pointerdown', onPointerDown);
        scene.input.off('pointerup', onPointerUp);
        scene.input.off('pointerupoutside', onPointerUp);
    });
}
