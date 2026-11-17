// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { isAlive } from '../../combat/targets.js';
import { scorch } from '../../combat/heat.js';
import { triggerScreenShake } from '../../combat/effects.js';

const ORIGIN_Y = -500;
const ORIGIN_OFFSET = { min: 350, max: 750 };
const LENGTH = 2800;
const EDGE_BEAM = { width: 170, color: 0xffe94d, alpha: 0.62 };
const CORE_BEAM = { width: 136, color: 0xfffbe6, alpha: 0.85 };
const HIT_HALF_WIDTH = 80;
const EXTEND_MS = 350;
const ACTIVE_MS = 3000;
const FADE_MS = 250;
const SWAY = Phaser.Math.DegToRad(4);
const SWAY_PERIOD_MS = 5000;

function pickTarget(scene) {
    const living = scene.gameState.players.filter(isAlive);
    return living.length ? Phaser.Utils.Array.GetRandom(living) : null;
}

function insertBelowFighters(scene, object) {
    const indexes = scene.gameState.players.map(fighter => scene.objs.getIndex(fighter)).filter(index => index >= 0);
    if (indexes.length) scene.objs.addAt(object, Math.min(...indexes));
    else scene.objs.add(object);
    return object;
}

function makeBeam(scene, origin, { width, color, alpha }) {
    const beam = scene.add.rectangle(origin.x, origin.y, width, LENGTH, color, alpha)
        .setOrigin(0.5, 0)
        .setScale(1, 0);
    return insertBelowFighters(scene, beam);
}

function setAngle(state, angle) {
    state.angle = angle;
    const rotation = angle - Math.PI / 2;
    state.beams.forEach(beam => beam.setRotation(rotation));
}

function reach(state) {
    return LENGTH * state.beams[0].scaleY;
}

function inBeam(state, player) {
    const { origin, angle } = state;
    const dx = player.x - origin.x;
    const dy = player.y - origin.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > reach(state)) return false;
    const across = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    const halfBody = (player.body?.width ?? 40) / 2;
    return across <= HIT_HALF_WIDTH + halfBody;
}

function start(scene) {
    const target = pickTarget(scene);
    if (!target) return null;
    const side = Math.random() < 0.5 ? -1 : 1;
    const origin = {
        x: target.x + side * Phaser.Math.Between(ORIGIN_OFFSET.min, ORIGIN_OFFSET.max),
        y: ORIGIN_Y
    };
    const state = {
        origin,
        baseAngle: Math.atan2(target.y - origin.y, target.x - origin.x),
        phase: Math.random() * Math.PI * 2,
        elapsed: 0,
        fading: false,
        beams: [makeBeam(scene, origin, EDGE_BEAM), makeBeam(scene, origin, CORE_BEAM)]
    };
    setAngle(state, state.baseAngle);
    scene.tweens.add({ targets: state.beams, scaleY: 1, duration: EXTEND_MS, ease: 'Quad.In' });
    triggerScreenShake(scene, 4, 300);
    return state;
}

function update(scene, state, delta) {
    state.elapsed += delta;
    const sway = Math.sin(state.phase + state.elapsed / SWAY_PERIOD_MS * Math.PI * 2) * SWAY;
    setAngle(state, state.baseAngle + sway);
    if (state.elapsed >= ACTIVE_MS) {
        if (!state.fading) {
            state.fading = true;
            scene.tweens.add({ targets: state.beams, alpha: 0, scaleX: 0.2, duration: FADE_MS });
        }
        return state.elapsed >= ACTIVE_MS + FADE_MS;
    }
    for (const player of scene.gameState.players) {
        if (isAlive(player) && inBeam(state, player)) scorch(scene, player);
    }
    return false;
}

function end(scene, state) {
    if (!state) return;
    scene.tweens.killTweensOf(state.beams);
    state.beams.forEach(beam => beam.destroy());
}

export const DESERT_HEAT_RAY = {
    interval: 7000,
    noMercyInterval: 1000,
    intervalFromEnd: true,
    start,
    update,
    end
};
