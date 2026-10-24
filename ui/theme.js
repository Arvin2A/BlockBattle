// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Shared look for every screen: fonts, colors and the dark-panel button style
// that the online lobby started with.

export const FONTS = {
    title: 'GameFont',
    body: 'VCROSD'
};

export const COLORS = {
    p1: '#ff4343',
    p2: '#3d8bff',
    accent: '#ffd34d',
    text: '#ffffff',
    muted: '#bbbbbb',
    stroke: '#000000'
};

export const HEX = {
    p1: 0xff4343,
    p2: 0x3d8bff,
    accent: 0xffd34d,
    panel: 0x171717,
    panelHover: 0x444444,
    border: 0xffffff
};

export function playerColor(slot) {
    return slot === 'p2' ? COLORS.p2 : COLORS.p1;
}

export function playerHex(slot) {
    return slot === 'p2' ? HEX.p2 : HEX.p1;
}

export function textStyle(kind = 'body', overrides = {}) {
    const base = kind === 'title'
        ? { fontFamily: FONTS.title, fontSize: '32px', fill: COLORS.text, stroke: COLORS.stroke, strokeThickness: 5 }
        : { fontFamily: FONTS.body, fontSize: '24px', fill: COLORS.text };
    return { ...base, ...overrides };
}

export function makePanel(scene, x, y, width, height, alpha = 0.95) {
    return scene.add.rectangle(x, y, width, height, HEX.panel, alpha)
        .setStrokeStyle(3, HEX.border);
}

export function makeButton(scene, x, y, width, height, label, onClick, fontSize = 24) {
    const box = scene.add.rectangle(x, y, width, height, HEX.panel)
        .setStrokeStyle(3, HEX.border)
        .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, textStyle('body', {
        fontSize: `${fontSize}px`,
        align: 'center'
    })).setOrigin(0.5);
    box.on('pointerover', () => box.setFillStyle(HEX.panelHover));
    box.on('pointerout', () => box.setFillStyle(HEX.panel));
    box.on('pointerdown', () => {
        scene.sound.play('hover2');
        onClick();
    });
    return { box, text };
}
