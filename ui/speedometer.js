// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { FONTS, COLORS, makePanel, makeButton, textStyle } from './theme.js';

const BLOCK_PX = 50;
const MAX_FRAME_STEP_PX = 400;
const FAST_SPEED = 20;
const RECORD_SAVE_GAP_MS = 1000;
const RECORDS_KEY = 'blockBattleBridgeRecords';
const PANEL = { y: 528, width: 250, height: 124 };
const SLOTS = [
    { key: 'player', x: 125, label: 'P1', color: COLORS.p1 },
    { key: 'player2', x: 875, label: 'P2', color: COLORS.p2 }
];

function loadRecords() {
    try {
        return JSON.parse(localStorage.getItem(RECORDS_KEY)) ?? {};
    } catch {
        return {};
    }
}

function saveRecords(records) {
    try {
        localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch {
        return;
    }
}

function createGauge(scene, slot, player) {
    const { x } = slot;
    const top = PANEL.y - PANEL.height / 2;
    const panel = makePanel(scene, x, PANEL.y, PANEL.width, PANEL.height, 0.8);
    const title = scene.add.text(x, top + 14, `${player.isBot ? 'CPU' : slot.label}  ${player.variant}`,
        textStyle('body', { fontSize: '14px', fill: player.isBot ? COLORS.cpu : slot.color })).setOrigin(0.5);
    const speed = scene.add.text(x, top + 40, '', textStyle('title', { fontSize: '22px', strokeThickness: 3 }))
        .setOrigin(0.5);
    const stats = scene.add.text(x, top + 86, '', textStyle('body', {
        fontSize: '13px',
        fill: COLORS.muted,
        align: 'center',
        lineSpacing: 2
    })).setOrigin(0.5);
    scene.hud.add([panel, title, speed, stats]);
    return {
        player,
        speed,
        stats,
        recordKey: `${player.name} ${player.variant}`,
        top: 0,
        distance: 0,
        lastX: player.x,
        lastY: player.y
    };
}

function resetRun(scene, state) {
    state.startedAt = scene.time.now;
    for (const gauge of state.gauges) {
        gauge.top = 0;
        gauge.distance = 0;
        gauge.lastX = gauge.player.x;
        gauge.lastY = gauge.player.y;
    }
}

export function createSpeedometers(scene, players) {
    const state = {
        gauges: SLOTS.filter(slot => players[slot.key]).map(slot => createGauge(scene, slot, players[slot.key])),
        records: loadRecords(),
        startedAt: scene.time.now,
        nextSaveAt: 0,
        recordsDirty: false
    };
    const reset = makeButton(scene, 500, 572, 130, 34, 'RESET RUN', () => resetRun(scene, state), 16);
    reset.text.setFontFamily(FONTS.body);
    scene.hud.add([reset.box, reset.text]);
    return state;
}

function trackRecord(state, gauge, distanceBlocks) {
    const record = state.records[gauge.recordKey] ?? { top: 0, distance: 0 };
    let changed = false;
    if (gauge.top > record.top) {
        record.top = gauge.top;
        changed = true;
    }
    if (distanceBlocks > record.distance) {
        record.distance = distanceBlocks;
        changed = true;
    }
    if (changed) {
        state.records[gauge.recordKey] = record;
        state.recordsDirty = true;
    }
    return record;
}

export function updateSpeedometers(scene, state) {
    const now = scene.time.now;
    const elapsed = Math.max(0.001, (now - state.startedAt) / 1000);
    for (const gauge of state.gauges) {
        const { player } = gauge;
        if (!player.active || !player.body) continue;
        const step = Math.hypot(player.x - gauge.lastX, player.y - gauge.lastY);
        if (step < MAX_FRAME_STEP_PX && !scene.gamePaused) gauge.distance += step;
        gauge.lastX = player.x;
        gauge.lastY = player.y;

        const speed = Math.hypot(player.body.velocity.x, player.body.velocity.y) / BLOCK_PX;
        gauge.top = Math.max(gauge.top, speed);
        const distanceBlocks = Math.floor(gauge.distance / BLOCK_PX);
        const average = distanceBlocks / elapsed;
        const record = trackRecord(state, gauge, distanceBlocks);

        gauge.speed.setText(`${speed.toFixed(1)} blocks/s`)
            .setColor(speed >= FAST_SPEED ? COLORS.accent : COLORS.text);
        gauge.stats.setText(
            `TOP ${gauge.top.toFixed(1)}   AVG ${average.toFixed(1)}\n` +
            `DISTANCE ${distanceBlocks} blocks\n` +
            `BEST ${record.top.toFixed(1)} blocks/s   ${record.distance} blocks`
        );
    }
    if (state.recordsDirty && now >= state.nextSaveAt) {
        saveRecords(state.records);
        state.recordsDirty = false;
        state.nextSaveAt = now + RECORD_SAVE_GAP_MS;
    }
}
