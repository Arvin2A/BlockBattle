// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { applyKnockback, hitFreeze, isInvincible } from '../../combat/knockback.js';
import { scheduleDecelerate } from '../../combat/blueprints.js';
import { spawnDirtBurst, triggerScreenShake } from '../../combat/effects.js';
import { isAlive } from '../../combat/targets.js';
import { blocksHit, deflects, trackDeflectable } from '../../combat/block.js';
import { PLAYER_COLORS } from '../../matchModes.js';

const BASE = { x: 1910, y: 490 };
const PIVOT = { x: 1940, y: 472, originX: 0.8, originY: 0.32 };
const MUZZLE = { x: -64, y: -4 };
const AIM_MIN = Phaser.Math.DegToRad(-10);
const AIM_MAX = Phaser.Math.DegToRad(19);
const AIM_NEAR = 300;
const AIM_FAR = 1800;

const TRACK_MS = 3000;
const FIRE_FRAME_RATE = 16;
const SHOT_DELAYS = [125, 625];
const FLIGHT_MS = 1000;
const EARLY_HIT_MS = 200;
const START_SIZE = 15;
const END_SIZE = 70;
const ARC_HEIGHT = 180;
const FALL_SPEED = 1.6;
const RICOCHET_SPEED_SCALE = 0.25;
const RICOCHET_POP = -0.5;
const RICOCHET_GRAVITY = 0.004;
const LODGED_MS = 5000;
const LODGED = { surfaceOffset: 22, radius: 32, offsetX: 8, offsetY: 13 };

const MARK_LEAD_FOLLOW = 0.3;
const VELOCITY_SMOOTHING = 0.15;
const LEAD_FACTOR = 0.9;
const SLOW_SPIN = Math.PI / 2;
const FAST_SPIN = Math.PI * 5;
const TRAIL_EVERY_MS = 45;
const TRAIL_FADE_MS = 260;

const DAMAGE = 0.15;
const SHIELD_COST = 1;
const DEFLECT_SPEED_SCALE = 3;
const MIN_DEFLECT_BASE_SPEED = 1;
const DEFLECT_STEP = 20;
const OUT_OF_PLAY = { left: -300, right: 2300, top: -500, bottom: 1400 };
const HITSTUN = 600;
const LAUNCH = { x: 450, y: -420 };

const ballSize = t => 1 / ((1 - t) / START_SIZE + t / END_SIZE);

function insertBelowFighters(scene, object) {
    const indexes = scene.gameState.players.map(fighter => scene.objs.getIndex(fighter)).filter(index => index >= 0);
    if (indexes.length) scene.objs.addAt(object, Math.min(...indexes));
    else scene.objs.add(object);
    return object;
}

function addOnTop(scene, object) {
    scene.objs.add(object);
    return object;
}

function groundTop(scene) {
    const ground = scene.gameState.map.ground;
    return { top: ground.body.top, left: ground.body.left, right: ground.body.right };
}

function aimFor(target) {
    const distance = Phaser.Math.Distance.Between(PIVOT.x, PIVOT.y, target.x, target.y);
    const t = Phaser.Math.Clamp((distance - AIM_NEAR) / (AIM_FAR - AIM_NEAR), 0, 1);
    return Phaser.Math.Linear(AIM_MIN, AIM_MAX, t);
}

function muzzlePoint(head) {
    const cos = Math.cos(head.rotation);
    const sin = Math.sin(head.rotation);
    return {
        x: head.x + MUZZLE.x * cos - MUZZLE.y * sin,
        y: head.y + MUZZLE.x * sin + MUZZLE.y * cos
    };
}

function setupCannon(scene, map) {
    if (!scene.anims.exists('cannonFire')) {
        scene.anims.create({
            key: 'cannonFire',
            frames: scene.anims.generateFrameNumbers('snowycannonshothead', { start: 1, end: 8 }),
            frameRate: FIRE_FRAME_RATE,
            repeat: SHOT_DELAYS.length - 1
        });
    }
    const base = scene.add.image(BASE.x, BASE.y, 'cannon_headless');
    const head = scene.add.sprite(PIVOT.x, PIVOT.y, 'snowycannonshothead', 0)
        .setOrigin(PIVOT.originX, PIVOT.originY);
    const after = scene.objs.getIndex(map.background) + 1;
    scene.objs.addAt(head, after);
    scene.objs.addAt(base, after);
    head.on('animationcomplete-cannonFire', () => head.setFrame(0));
    map.snowyCannon = { base, head };
}

function pickTarget(scene) {
    const living = scene.gameState.players.filter(isAlive);
    return living.length ? Phaser.Utils.Array.GetRandom(living) : null;
}

function spawnTrail(scene, mark) {
    const ghost = addOnTop(scene, scene.add.image(mark.x, mark.y, 'dangermark')
        .setRotation(mark.rotation)
        .setAlpha(0.45)
        .setTint(0x9fd4ff));
    scene.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 0.8,
        duration: TRAIL_FADE_MS,
        onComplete: () => ghost.destroy()
    });
}

function launchBall(scene, state, shot) {
    const start = muzzlePoint(state.cannon.head);
    const end = { x: shot.aim.x, y: shot.aim.y };
    const control = {
        x: (start.x + end.x) / 2,
        y: Math.min(start.y, end.y) - ARC_HEIGHT
    };
    const ball = scene.add.circle(start.x, start.y, START_SIZE / 2, 0x161a22)
        .setStrokeStyle(2, 0x3a4252);
    scene.objs.add(ball);
    trackDeflectable(scene, ball, null);
    Object.assign(shot, { ball, start, control, end, elapsed: 0, phase: 'flying' });
    scene.sound.play('slamimpact', { volume: 0.6 });
    triggerScreenShake(scene, 3, 120);
}

function blast(scene, player, x, owner = null, damageScale = 1) {
    if (!isAlive(player) || player.uninterruptible || isInvincible(player)) return false;
    const now = scene.time.now;
    if (owner?.team !== undefined) player.lastHitBy = owner;
    player.KBmultiplier += DAMAGE * damageScale;
    const kb = player.KBmultiplier;
    player.lastHitAt = now;
    player.hitstunUntil = now + HITSTUN * kb;
    player.freezeUntil = now - 1;
    player.willDecelerate = false;
    const side = player.x === x ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(player.x - x);
    applyKnockback(scene, player, LAUNCH.x * kb * side, LAUNCH.y * kb);
    scheduleDecelerate(scene, player, player.hitstunUntil - now);
    player.flash?.();
    hitFreeze(scene, 90);
    scene.sound.play('sledgehammerhit');
    return true;
}

function ballTouches(player, x, y, size) {
    const body = player.body;
    if (!body) return false;
    const circle = new Phaser.Geom.Circle(x, y, size / 2);
    return Phaser.Geom.Intersects.CircleToRectangle(circle, new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height));
}

function lodgedBalls(scene) {
    const map = scene.gameState.map;
    if (!map.lodgedBalls) {
        map.lodgedBalls = scene.physics.add.staticGroup();
        scene.physics.add.collider(scene.gameState.players, map.lodgedBalls);
    }
    return map.lodgedBalls;
}

function lodge(scene, shot, top) {
    const lodged = lodgedBalls(scene).create(shot.ball.x, top - LODGED.surfaceOffset, 'cannonball_impact');
    lodged.body.setCircle(LODGED.radius, LODGED.offsetX, LODGED.offsetY);
    insertBelowFighters(scene, lodged);
    shot.ball.destroy();
    shot.phase = 'done';
    spawnDirtBurst(scene, lodged.x, top, 14, 4, 8, 1.6, [0xe8f0ff, 0xb9c8e0, 0x6d7a90], 220, 380, true);
    triggerScreenShake(scene, 10, 260);
    scene.sound.play('rockbreak');
    scene.time.delayedCall(LODGED_MS, () => {
        if (!lodged.active) return;
        lodged.body.enable = false;
        scene.tweens.add({ targets: lodged, alpha: 0, duration: 500, onComplete: () => lodged.destroy() });
    });
}

function fadeMark(scene, mark) {
    if (!mark.active || mark.fading) return;
    mark.fading = true;
    scene.tweens.add({ targets: mark, alpha: 0, scale: 0.4, duration: 250, onComplete: () => mark.destroy() });
}

function nearestOther(scene, from, x, y) {
    let nearest = null;
    let best = Infinity;
    for (const player of scene.gameState.players) {
        if (player === from || !isAlive(player)) continue;
        const distance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
        if (distance < best) {
            best = distance;
            nearest = player;
        }
    }
    return nearest;
}

function deflectBall(scene, shot, deflector) {
    const { ball } = shot;
    const target = nearestOther(scene, deflector, ball.x, ball.y);
    const away = Math.sign(ball.x - deflector.x) || -(deflector.lastDir?.x ?? 1);
    const aim = target ?? { x: ball.x + away * 1000, y: ball.y };
    const dx = aim.x - ball.x;
    const dy = aim.y - ball.y;
    const length = Math.hypot(dx, dy) || 1;
    const speed = DEFLECT_SPEED_SCALE * Math.max(shot.speed ?? 0, MIN_DEFLECT_BASE_SPEED);
    shot.velocity = { x: dx / length * speed, y: dy / length * speed };
    shot.owner = deflector;
    ball.deflectOwner = deflector;
    ball.deflectVelocity = { x: shot.velocity.x * 1000, y: shot.velocity.y * 1000 };
    shot.hit = new Set([deflector]);
    shot.phase = 'deflected';
    const colors = target ? PLAYER_COLORS[target.color] : null;
    ball.setRadius(END_SIZE / 2);
    if (colors) ball.setFillStyle(colors.hex).setStrokeStyle(2, colors.shieldStroke);
    fadeMark(scene, shot.mark);
    triggerScreenShake(scene, 8, 200);
}

function ballSource(shot, x, y) {
    const dirX = Math.sign(shot.velocity?.x ?? 0);
    return { x: x - dirX, y, lastDir: { x: dirX, y: 0 } };
}

function hitPlayersAt(scene, shot, x, y, size = END_SIZE) {
    shot.hit ??= new Set();
    for (const player of scene.gameState.players) {
        if (shot.hit.has(player) || !ballTouches(player, x, y, size)) continue;
        if (!isAlive(player) || player.uninterruptible || isInvincible(player)) continue;
        const source = ballSource(shot, x, y);
        const deflectScale = deflects(scene, player, source, DAMAGE * (shot.damageScale ?? 1), { shieldCost: SHIELD_COST });
        if (deflectScale) {
            shot.damageScale = (shot.damageScale ?? 1) * deflectScale;
            deflectBall(scene, shot, player);
            return;
        }
        shot.hit.add(player);
        if (blocksHit(scene, player, source, DAMAGE, { ranged: true, shieldCost: SHIELD_COST })) continue;
        blast(scene, player, source.x, shot.owner, shot.damageScale ?? 1);
        if (shot.phase === 'deflected') ricochet(shot);
    }
}

function ricochet(shot) {
    shot.phase = 'falling';
    shot.fallVelocity = {
        x: shot.velocity.x * RICOCHET_SPEED_SCALE,
        y: Math.min(shot.velocity.y * RICOCHET_SPEED_SCALE, RICOCHET_POP)
    };
}

function updateDeflected(scene, shot, delta) {
    const { ball, velocity } = shot;
    const ground = groundTop(scene);
    const steps = Math.max(1, Math.ceil(Math.hypot(velocity.x, velocity.y) * delta / DEFLECT_STEP));
    for (let i = 0; i < steps; i++) {
        const prevY = ball.y;
        ball.setPosition(ball.x + velocity.x * delta / steps, ball.y + velocity.y * delta / steps);
        const overGround = ball.x >= ground.left && ball.x <= ground.right;
        if (overGround && prevY <= ground.top && ball.y >= ground.top) {
            lodge(scene, shot, ground.top);
            return;
        }
        hitPlayersAt(scene, shot, ball.x, ball.y);
        if (shot.phase !== 'deflected') return;
    }
    if (ball.x < OUT_OF_PLAY.left || ball.x > OUT_OF_PLAY.right || ball.y < OUT_OF_PLAY.top || ball.y > OUT_OF_PLAY.bottom) {
        ball.destroy();
        shot.phase = 'done';
    }
}

function trackSpeed(shot, delta) {
    const { x, y } = shot.ball;
    if (shot.lastPos && delta > 0) {
        shot.speed = Phaser.Math.Distance.Between(shot.lastPos.x, shot.lastPos.y, x, y) / delta;
        shot.ball.deflectVelocity = { x: (x - shot.lastPos.x) / delta * 1000, y: (y - shot.lastPos.y) / delta * 1000 };
    }
    shot.lastPos = { x, y };
}

function updateBall(scene, shot, delta) {
    shot.elapsed += delta;
    if (shot.phase === 'flying') {
        const t = Math.min(shot.elapsed / FLIGHT_MS, 1);
        const size = ballSize(t);
        const u = (size - START_SIZE) / (END_SIZE - START_SIZE);
        shot.ball.setPosition(
            Phaser.Math.Interpolation.QuadraticBezier(u, shot.start.x, shot.control.x, shot.end.x),
            Phaser.Math.Interpolation.QuadraticBezier(u, shot.start.y, shot.control.y, shot.end.y)
        );
        shot.ball.setRadius(size / 2);
        trackSpeed(shot, delta);
        if (t < 1) {
            if (shot.elapsed >= FLIGHT_MS - EARLY_HIT_MS) hitPlayersAt(scene, shot, shot.ball.x, shot.ball.y, size);
            return;
        }
        hitPlayersAt(scene, shot, shot.end.x, shot.end.y);
        if (shot.phase === 'deflected') return;
        fadeMark(scene, shot.mark);
        shot.phase = 'falling';
        return;
    }
    if (shot.phase === 'deflected') {
        updateDeflected(scene, shot, delta);
        return;
    }
    if (shot.phase !== 'falling') return;
    const ground = groundTop(scene);
    const overGround = shot.ball.x >= ground.left && shot.ball.x <= ground.right;
    const fall = shot.fallVelocity;
    if (fall) fall.y = Math.min(FALL_SPEED, fall.y + RICOCHET_GRAVITY * delta);
    const nextX = shot.ball.x + (fall ? fall.x * delta : 0);
    const nextY = shot.ball.y + (fall ? fall.y : FALL_SPEED) * delta;
    if (overGround && shot.ball.y <= ground.top && nextY >= ground.top) {
        lodge(scene, shot, ground.top);
        return;
    }
    shot.ball.setPosition(nextX, nextY);
    trackSpeed(shot, delta);
    hitPlayersAt(scene, shot, nextX, nextY);
    if (shot.phase !== 'falling') return;
    if (nextY > 1400 || nextX < OUT_OF_PLAY.left || nextX > OUT_OF_PLAY.right) {
        shot.ball.destroy();
        shot.phase = 'done';
    }
}

function predictLanding(scene, state) {
    const { target, velocity } = state;
    const lead = (SHOT_DELAYS[0] + FLIGHT_MS) / 1000 * LEAD_FACTOR;
    const ground = groundTop(scene);
    const x = Phaser.Math.Clamp(target.x + velocity.x * lead, 0, 2000);
    const body = target.body;
    const grounded = body && (body.blocked.down || body.touching.down);
    if (grounded) return { x, y: target.y };
    const gravity = scene.physics.world.gravity.y + (body?.gravity.y ?? 0);
    let y = target.y + velocity.y * lead + 0.5 * gravity * lead * lead;
    const standingY = ground.top - (body?.height ?? 0) / 2;
    if (x >= ground.left && x <= ground.right && target.y <= standingY) y = Math.min(y, standingY);
    return { x, y };
}

function start(scene) {
    const cannon = scene.gameState.map.snowyCannon;
    const target = pickTarget(scene);
    if (!cannon || !target) return null;
    const mark = addOnTop(scene, scene.add.image(target.x, target.y, 'dangermark'));
    return {
        cannon,
        target,
        mark,
        elapsed: 0,
        trailIn: 0,
        firing: false,
        shotsFired: 0,
        velocity: { x: 0, y: 0 },
        shots: []
    };
}

function lockOn(scene, state) {
    const { target, mark } = state;
    const alive = isAlive(target);
    const here = alive ? { x: target.x, y: target.y } : { x: mark.x, y: mark.y };
    const predicted = alive ? predictLanding(scene, state) : here;
    const secondMark = addOnTop(scene, scene.add.image(here.x, here.y, 'dangermark')
        .setRotation(mark.rotation));
    state.shots = [
        { mark, aim: predicted, phase: 'waiting', trailIn: 0 },
        { mark: secondMark, aim: here, phase: 'waiting', trailIn: 0 }
    ];
}

function updateMarks(scene, state, delta) {
    for (const shot of state.shots) {
        const { mark, aim } = shot;
        if (!mark.active || mark.fading) continue;
        mark.rotation += FAST_SPIN * delta / 1000;
        scene.objs.bringToTop(mark);
        mark.x += (aim.x - mark.x) * MARK_LEAD_FOLLOW;
        mark.y += (aim.y - mark.y) * MARK_LEAD_FOLLOW;
        if (Phaser.Math.Distance.Between(mark.x, mark.y, aim.x, aim.y) <= 4) continue;
        shot.trailIn -= delta;
        if (shot.trailIn <= 0) {
            spawnTrail(scene, mark);
            shot.trailIn = TRAIL_EVERY_MS / 2;
        }
    }
}

function update(scene, state, delta) {
    state.elapsed += delta;
    const { mark, cannon, target } = state;

    if (!state.firing) {
        if (isAlive(target)) {
            mark.setPosition(target.x, target.y);
            const body = target.body;
            if (body) {
                state.velocity.x += (body.velocity.x - state.velocity.x) * VELOCITY_SMOOTHING;
                state.velocity.y += (body.velocity.y - state.velocity.y) * VELOCITY_SMOOTHING;
            }
        }
        mark.rotation += SLOW_SPIN * delta / 1000;
        scene.objs.bringToTop(mark);
        const aim = aimFor(mark);
        cannon.head.rotation += (aim - cannon.head.rotation) * 0.08;
        state.trailIn -= delta;
        if (state.trailIn <= 0) {
            spawnTrail(scene, mark);
            state.trailIn = TRAIL_EVERY_MS;
        }
        if (state.elapsed >= TRACK_MS) {
            state.firing = true;
            state.fireElapsed = 0;
            lockOn(scene, state);
            cannon.head.play('cannonFire');
        }
        return false;
    }

    state.fireElapsed += delta;
    updateMarks(scene, state, delta);
    const next = state.shots[Math.min(state.shotsFired, state.shots.length - 1)];
    const aimGoal = state.shotsFired < state.shots.length ? aimFor(next.aim) : 0;
    cannon.head.rotation += (aimGoal - cannon.head.rotation) * (state.shotsFired < state.shots.length ? 0.3 : 0.08);
    while (state.shotsFired < SHOT_DELAYS.length && state.fireElapsed >= SHOT_DELAYS[state.shotsFired]) {
        launchBall(scene, state, state.shots[state.shotsFired]);
        state.shotsFired += 1;
    }
    state.shots.forEach(shot => shot.ball && updateBall(scene, shot, delta));

    return state.shotsFired === SHOT_DELAYS.length && state.shots.every(shot => shot.phase === 'done');
}

function end(scene, state) {
    if (!state) return;
    state.shots.forEach(shot => {
        if (shot.ball?.active) shot.ball.destroy();
        fadeMark(scene, shot.mark);
    });
    fadeMark(scene, state.mark);
}

export const SNOWY_CANNON = {
    interval: 15000,
    setup: setupCannon,
    start,
    update,
    end
};
