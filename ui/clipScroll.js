// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

function clipTexture(obj, bounds, top, bottom, saved) {
    const visibleTop = Math.max(bounds.top, top);
    const visibleBottom = Math.min(bounds.bottom, bottom);
    saved.push({ obj, visible: obj.visible, cropped: obj.isCropped });
    if (visibleBottom <= visibleTop) {
        obj.setVisible(false);
        return;
    }
    if (bounds.top >= top && bounds.bottom <= bottom) return;
    const ratio = obj.frame.height / bounds.height;
    obj.setCrop(0, (visibleTop - bounds.top) * ratio, obj.frame.width, (visibleBottom - visibleTop) * ratio);
}

function clipShape(obj, bounds, top, bottom, saved) {
    const visibleTop = Math.max(bounds.top, top);
    const visibleBottom = Math.min(bounds.bottom, bottom);
    saved.push({ obj, visible: obj.visible, y: obj.y, width: obj.width, height: obj.height });
    if (visibleBottom <= visibleTop) {
        obj.setVisible(false);
        return;
    }
    if (bounds.top >= top && bounds.bottom <= bottom) return;
    const height = (visibleBottom - visibleTop) / obj.scaleY;
    obj.setSize(obj.width, height);
    obj.y = visibleTop + obj.originY * height * obj.scaleY;
}

function restore(saved) {
    for (const entry of saved) {
        const { obj } = entry;
        if (!obj.active) continue;
        if ('cropped' in entry) {
            if (!entry.cropped) obj.setCrop();
        } else {
            obj.setSize(entry.width, entry.height);
            obj.y = entry.y;
        }
        obj.setVisible(entry.visible);
    }
}

export function clipScrollablePanel(scene, panel, { inset = 0 } = {}) {
    let saved = [];
    const apply = () => {
        saved = [];
        if (!panel.active || !panel.visible) return;
        const window = panel.getElement('background').getBounds();
        const top = window.top + inset;
        const bottom = window.bottom - inset;
        for (const obj of panel.getElement('panel').getAllChildren()) {
            if (!obj.active || !obj.visible || !obj.getBounds) continue;
            const bounds = obj.getBounds();
            if (obj.frame && obj.setCrop) clipTexture(obj, bounds, top, bottom, saved);
            else if (obj.isFilled !== undefined || obj.isStroked !== undefined) clipShape(obj, bounds, top, bottom, saved);
        }
    };
    const undo = () => {
        restore(saved);
        saved = [];
    };
    const events = scene.game.events;
    events.on('prerender', apply);
    events.on('postrender', undo);
    const detach = () => {
        undo();
        events.off('prerender', apply);
        events.off('postrender', undo);
    };
    panel.once('destroy', detach);
    scene.events.once('shutdown', detach);
    return detach;
}
