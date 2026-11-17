// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { applyKnockback, isInvincible } from '../../combat/knockback.js';
import { scheduleDecelerate } from '../../combat/blueprints.js';
import { triggerScreenShake } from '../../combat/effects.js';
import { isAlive } from '../../combat/targets.js';
import { getMapPlatforms } from '../../attacks.js';

const AREA = { width: 2000, bottom: 1200, center: { x: 1000, y: 600 } };
const PILLAR = {
    width: 55,
    mudTop: 37,
    body: { width: 47, offsetX: 4 },
    stemTip: { x: 0, y: 14 },
    heightMin: 300,
    heightMax: 500,
    hiddenY: 1300,
    platformGap: 50,
    edgeGap: 10,
    tries: 60
};
const COUNT = { min: 1, max: 2 };
const RISE_MS = 1300;
const SINK_MS = 1000;
const JITTER = 2.5;

const HEAD = { key: 'flytraphead', scale: 2, frameSize: 30, closed: 0, open: 1, box: 2 };
const VINE = { color: 0x2f9a3a, thickness: 5 };
const TRACK_MS = 5000;
const WAIT_FOR_RANGE_MS = 3000;
const TURN_RATE = 0.12;
const REACH = 375;
const LUNGE_MS = { base: 110, perPixel: 0.5 };
const HOLD_OPEN_MS = 120;
const RETRACT_MS = 260;
const CAUGHT_RETRACT_MS = 320;

const TRAP_MS = 3000;
const TICK_MS = 500;
const TICK_DAMAGE = 0.03;
const SPIT = { speed: 950, lift: 260, hitstun: 450 };
const AFTER_MS = 600;

function insertBelowFighters(scene, object) {
    const indexes = scene.gameState.players.map(fighter => scene.objs.getIndex(fighter)).filter(index => index >= 0);
    if (indexes.length) scene.objs.addAt(object, Math.min(...indexes));
    else scene.objs.add(object);
    return object;
}

function pillarGroup(scene) {
    const map = scene.gameState.map;
    if (!map.mudPillars) {
        map.mudPillars = scene.physics.add.staticGroup();
        scene.physics.add.collider(scene.gameState.players, map.mudPillars);
    }
    return map.mudPillars;
}

function rectGap(a, b) {
    const dx = Math.max(0, a.left - b.right, b.left - a.right);
    const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
    return Math.hypot(dx, dy);
}

function pillarRect(x, top) {
    return { left: x - PILLAR.width / 2, right: x + PILLAR.width / 2, top, bottom: AREA.bottom };
}

function pickSpots(scene, count) {
    const platforms = getMapPlatforms(scene).map(platform => platform.body);
    const main = scene.gameState.map.ground.body;
    const spots = [];
    const min = PILLAR.width / 2 + PILLAR.edgeGap;
    for (let attempt = 0; attempt < PILLAR.tries && spots.length < count; attempt++) {
        const x = Phaser.Math.Between(min, AREA.width - min);
        const top = AREA.bottom - Phaser.Math.Between(PILLAR.heightMin, PILLAR.heightMax);
        const rect = pillarRect(x, top);
        const others = spots.map(spot => pillarRect(spot.x, spot.top));
        const clearOfMain = Math.max(main.left - rect.right, rect.left - main.right) >= PILLAR.platformGap;
        const clear = clearOfMain && [...platforms, ...others].every(body => rectGap(rect, body) >= PILLAR.platformGap);
        if (clear) spots.push({ x, top });
    }
    return spots;
}

function stemTip(trap) {
    return { x: trap.pillar.x + PILLAR.stemTip.x, y: trap.pillar.y + PILLAR.stemTip.y };
}

function placePillar(trap, y, jitter = 0) {
    trap.pillar.setPosition(trap.x + jitter, y);
    trap.pillar.body.reset();
}

function makeTrap(scene, spot) {
    const pillar = pillarGroup(scene).create(spot.x, PILLAR.hiddenY, 'mudpillar').setOrigin(0.5, 0);
    pillar.body.setSize(PILLAR.body.width, pillar.height - PILLAR.mudTop, false);
    pillar.body.setOffset(PILLAR.body.offsetX, PILLAR.mudTop);
    insertBelowFighters(scene, pillar);
    const vine = insertBelowFighters(scene, scene.add.rectangle(0, 0, 0, VINE.thickness, VINE.color)
        .setOrigin(0, 0.5)
        .setVisible(false));
    const head = insertBelowFighters(scene, scene.add.sprite(0, 0, HEAD.key, HEAD.closed)
        .setOrigin(0, 0.5)
        .setScale(HEAD.scale));
    const trap = {
        x: spot.x,
        restY: spot.top - PILLAR.mudTop,
        pillar,
        vine,
        head,
        aim: Math.random() < 0.5 ? 0 : Math.PI,
        reach: 0,
        phase: 'rising',
        elapsed: 0,
        target: null,
        caught: null
    };
    placePillar(trap, PILLAR.hiddenY);
    updateHead(trap);
    return trap;
}

function updateHead(trap) {
    const tip = stemTip(trap);
    const cos = Math.cos(trap.aim);
    const sin = Math.sin(trap.aim);
    trap.head.setPosition(tip.x + cos * trap.reach, tip.y + sin * trap.reach)
        .setRotation(trap.aim)
        .setFlipY(cos < 0);
    trap.vine.setPosition(tip.x, tip.y)
        .setRotation(trap.aim)
        .setVisible(trap.reach > 1);
    trap.vine.setSize(trap.reach, VINE.thickness);
}

function mouthCenter(trap) {
    const tip = stemTip(trap);
    const out = trap.reach + HEAD.frameSize * HEAD.scale / 2;
    return { x: tip.x + Math.cos(trap.aim) * out, y: tip.y + Math.sin(trap.aim) * out };
}

function catchable(player) {
    return isAlive(player) && player.body?.enable && !isInvincible(player) && !player.uninterruptible &&
        !player.grabbedBy && !player.activeGrab && !player.smackedBy && !player.smack && !player.ledge &&
        !player.isUsingSideSpecial;
}

function touches(player, point, radius) {
    const body = player.body;
    if (!body) return false;
    return Phaser.Geom.Intersects.CircleToRectangle(
        new Phaser.Geom.Circle(point.x, point.y, radius),
        new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height)
    );
}

function distanceTo(trap, player) {
    const tip = stemTip(trap);
    return Phaser.Math.Distance.Between(tip.x, tip.y, player.x, player.y);
}

function pickTarget(scene, state, trap) {
    const taken = new Set(state.traps.filter(other => other !== trap && other.target).map(other => other.target));
    const living = scene.gameState.players.filter(isAlive);
    const byDistance = list => list.sort((a, b) => distanceTo(trap, a) - distanceTo(trap, b))[0] ?? null;
    return byDistance(living.filter(player => !taken.has(player))) ?? byDistance(living);
}

function turnToward(trap, player, rate = TURN_RATE) {
    const tip = stemTip(trap);
    const goal = Math.atan2(player.y - tip.y, player.x - tip.x);
    trap.aim = Phaser.Math.Angle.RotateTo(trap.aim, goal, Math.PI * rate);
}

function hold(trap) {
    const player = trap.caught;
    const center = mouthCenter(trap);
    player.setPosition(center.x, center.y);
    player.setVelocity(0, 0);
    player.body.allowGravity = false;
}

function trapPlayer(scene, trap, player) {
    const now = scene.time.now;
    trap.caught = player;
    trap.phase = 'caught';
    trap.elapsed = 0;
    trap.ticks = 0;
    trap.head.setFrame(HEAD.box).setFlipY(false);
    scene.objs.bringToTop(trap.vine);
    scene.objs.bringToTop(trap.head);
    player.grabbedBy = trap;
    player.isAttacking = false;
    player.willDecelerate = false;
    player.freezeUntil = now - 1;
    player.hitstunUntil = now + TRAP_MS + CAUGHT_RETRACT_MS;
    player.invincibleUntil = now + TRAP_MS + CAUGHT_RETRACT_MS;
    player.lastHitAt = now;
    hold(trap);
    triggerScreenShake(scene, 6, 200);
    scene.sound.play('grab');
}

function chomp(scene, trap) {
    const player = trap.caught;
    player.KBmultiplier += TICK_DAMAGE;
    player.lastHitAt = scene.time.now;
    player.flash?.();
    scene.sound.play('flytrapgulp', { volume: 0.6 });
    scene.tweens.add({
        targets: trap.head,
        scaleX: HEAD.scale * 1.15,
        scaleY: HEAD.scale * 0.85,
        duration: 80,
        yoyo: true
    });
    triggerScreenShake(scene, 3, 100);
}

function freePlayer(scene, trap) {
    const player = trap.caught;
    trap.caught = null;
    if (!player) return null;
    player.grabbedBy = null;
    player.body.allowGravity = true;
    player.invincibleUntil = scene.time.now;
    return player;
}

function spit(scene, trap) {
    const player = freePlayer(scene, trap);
    trap.head.setFrame(HEAD.open);
    scene.time.delayedCall(200, () => trap.head.active && trap.head.setFrame(HEAD.closed));
    if (!player || !isAlive(player)) return;
    const now = scene.time.now;
    const dx = AREA.center.x - player.x;
    const dy = AREA.center.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    player.hitstunUntil = now + SPIT.hitstun;
    player.freezeUntil = now - 1;
    player.willDecelerate = false;
    applyKnockback(scene, player, dx / length * SPIT.speed, dy / length * SPIT.speed - SPIT.lift, { noDeathRay: true });
    scheduleDecelerate(scene, player, SPIT.hitstun);
    triggerScreenShake(scene, 8, 220);
    scene.sound.play('rodthirdhitsfx');
}

function startLunge(scene, trap) {
    turnToward(trap, trap.target, 1);
    trap.phase = 'lunging';
    trap.elapsed = 0;
    trap.lungeReach = Math.min(REACH, distanceTo(trap, trap.target));
    trap.head.setFrame(HEAD.open);
    scene.sound.play('whoosh');
}

function tryBite(scene, state, trap) {
    const mouth = mouthCenter(trap);
    const radius = HEAD.frameSize * HEAD.scale / 2;
    const prey = scene.gameState.players.find(player => catchable(player) && touches(player, mouth, radius) &&
        !state.traps.some(other => other.caught === player));
    if (prey) trapPlayer(scene, trap, prey);
}

function updateTrap(scene, state, trap, delta) {
    trap.elapsed += delta;
    switch (trap.phase) {
        case 'rising': {
            const t = Math.min(trap.elapsed / RISE_MS, 1);
            const y = Phaser.Math.Linear(PILLAR.hiddenY, trap.restY, Phaser.Math.Easing.Quadratic.Out(t));
            placePillar(trap, y, t < 1 ? Phaser.Math.FloatBetween(-JITTER, JITTER) : 0);
            if (t >= 1) {
                trap.phase = 'tracking';
                trap.elapsed = 0;
                triggerScreenShake(scene, 5, 180);
            }
            break;
        }
        case 'tracking':
        case 'waiting': {
            if (!isAlive(trap.target)) trap.target = pickTarget(scene, state, trap);
            if (trap.target) turnToward(trap, trap.target);
            if (trap.phase === 'tracking' && trap.elapsed >= TRACK_MS) {
                trap.phase = 'waiting';
                trap.elapsed = 0;
            }
            if (trap.phase !== 'waiting') break;
            if (trap.target && catchable(trap.target) && distanceTo(trap, trap.target) <= REACH) {
                startLunge(scene, trap);
            } else if (trap.elapsed >= WAIT_FOR_RANGE_MS) {
                trap.phase = 'done';
                trap.elapsed = 0;
            }
            break;
        }
        case 'lunging': {
            const t = Math.min(trap.elapsed / (LUNGE_MS.base + trap.lungeReach * LUNGE_MS.perPixel), 1);
            trap.reach = trap.lungeReach * Phaser.Math.Easing.Quadratic.Out(t);
            tryBite(scene, state, trap);
            if (trap.phase === 'lunging' && t >= 1) {
                trap.phase = 'open';
                trap.elapsed = 0;
            }
            break;
        }
        case 'open':
            tryBite(scene, state, trap);
            if (trap.phase === 'open' && trap.elapsed >= HOLD_OPEN_MS) {
                trap.phase = 'retracting';
                trap.elapsed = 0;
                trap.retractFrom = trap.reach;
            }
            break;
        case 'retracting': {
            const t = Math.min(trap.elapsed / RETRACT_MS, 1);
            trap.reach = trap.retractFrom * (1 - t);
            if (t >= 1) {
                trap.head.setFrame(HEAD.closed);
                trap.phase = 'done';
                trap.elapsed = 0;
            }
            break;
        }
        case 'caught': {
            if (!trap.retractFrom) trap.retractFrom = trap.reach;
            trap.reach = trap.retractFrom * (1 - Math.min(trap.elapsed / CAUGHT_RETRACT_MS, 1));
            trap.aim = Phaser.Math.Angle.RotateTo(trap.aim, Math.cos(trap.aim) < 0 ? Math.PI : 0, Math.PI * TURN_RATE);
            if (!isAlive(trap.caught)) {
                freePlayer(scene, trap);
                trap.phase = 'done';
                trap.elapsed = 0;
                break;
            }
            hold(trap);
            while (trap.ticks < TRAP_MS / TICK_MS && trap.elapsed >= (trap.ticks + 1) * TICK_MS) {
                trap.ticks += 1;
                chomp(scene, trap);
            }
            if (trap.elapsed >= TRAP_MS) {
                trap.reach = 0;
                spit(scene, trap);
                trap.phase = 'done';
                trap.elapsed = 0;
            }
            break;
        }
        case 'done':
            if (trap.elapsed >= AFTER_MS) {
                trap.phase = 'sinking';
                trap.elapsed = 0;
            }
            break;
        case 'sinking': {
            const t = Math.min(trap.elapsed / SINK_MS, 1);
            const y = Phaser.Math.Linear(trap.restY, PILLAR.hiddenY, Phaser.Math.Easing.Quadratic.In(t));
            placePillar(trap, y, t < 1 ? Phaser.Math.FloatBetween(-JITTER, JITTER) : 0);
            if (t >= 1) {
                removeTrap(scene, trap);
                trap.phase = 'gone';
            }
            break;
        }
    }
    if (trap.phase !== 'gone') updateHead(trap);
}

function removeTrap(scene, trap) {
    freePlayer(scene, trap);
    scene.tweens.killTweensOf(trap.head);
    trap.head.destroy();
    trap.vine.destroy();
    trap.pillar.destroy();
}

function start(scene) {
    const count = Phaser.Math.Between(COUNT.min, COUNT.max);
    const spots = pickSpots(scene, count);
    if (!spots.length) return null;
    const state = { traps: [] };
    state.traps = spots.map(spot => makeTrap(scene, spot));
    state.traps.forEach(trap => {
        trap.target = pickTarget(scene, state, trap);
    });
    triggerScreenShake(scene, 4, RISE_MS);
    state.riseSound = scene.sound.add('rocksliding', { loop: true, volume: 0.7 });
    state.riseSound.play();
    return state;
}

function stopRiseSound(state) {
    if (!state.riseSound) return;
    state.riseSound.stop();
    state.riseSound.destroy();
    state.riseSound = null;
}

function update(scene, state, delta) {
    state.traps.forEach(trap => trap.phase !== 'gone' && updateTrap(scene, state, trap, delta));
    if (state.traps.every(trap => trap.phase !== 'rising')) stopRiseSound(state);
    return state.traps.every(trap => trap.phase === 'gone');
}

function end(scene, state) {
    if (!state) return;
    stopRiseSound(state);
    state.traps.forEach(trap => {
        if (trap.phase === 'gone') return;
        removeTrap(scene, trap);
        trap.phase = 'gone';
    });
}

export const JUNGLE_FLYTRAP = {
    interval: 8000,
    noMercyInterval: 2000,
    intervalFromEnd: true,
    start,
    update,
    end
};
