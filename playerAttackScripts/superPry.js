// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { COLORS, FONTS, HEX } from '../ui/theme.js';

const CORNER = { reach: 40, rowAbove: 8, groundSlack: 40, outside: 6, lean: 0.3 };

const NOTCH = {
    count: 3,
    fadeMs: 4000,
    tiltPerNotch: 0.35,
    tiltMs: 120,
    relaxMs: 250,
    slamReach: 14,
    sounds: ['rip1', 'rip2', 'rip3'],
    shake: { distance: 4, ms: 45, repeats: 3 },
    crack: { color: 0x1a1008, width: 3, segments: 4, length: 38, spread: 0.6 }
};

const BAR = { length: 92, thickness: 18, segment: 20 };

const FLIGHT = {
    riseMs: 600,
    riseHeight: 1600,
    columnAtMs: 1400,
    dropAtMs: 2150,
    landAtMs: 2500,
    dropHeight: 1400,
    homing: 4,
    offStageSpeed: 2000,
    offStageLimit: 2600,
    tilt: 0.17,
    riseSpin: 3 * Math.PI,
    fallSpin: Math.PI,
    stepRise: 2.5,
    column: { width: 150, height: 2600, alpha: 0.45 },
    mark: { size: 120, offsetY: 150, blinkMs: 80 },
    hit: {
        damage: 0.85,
        knockback: { x: 877.5, y: 742.5 }
    },
    blockShieldCost: 2,
    deflect: {
        speed: 2200,
        lift: 350,
        gravity: 900,
        spin: 4 * Math.PI,
        shake: 12,
        bounds: { left: -800, right: 2800, bottom: 2600 },
        hitbox: 0.8,
        hit: { damage: 0.3, knockback: { x: 421.875, y: 257.8125 } }
    },
    landShake: 14,
    explosion: { flingScale: 2.5, crashScale: 3.5, height: 200, sinkPerScale: 30 },
    shakeMs: 350
};

const alphaCache = new Map();

function visualTop(visual) {
    return visual.y - visual.displayHeight * visual.originY;
}

function visualBottom(pryable) {
    const { visual } = pryable;
    return pryable.bottom ?? visual.y + visual.displayHeight * (1 - visual.originY);
}

function opaqueEdges(scene, visual, row) {
    const key = `${visual.texture.key}:${row}`;
    if (alphaCache.has(key)) return alphaCache.get(key);
    let left = null;
    let right = null;
    for (let column = 0; column < visual.width; column++) {
        if (scene.textures.getPixelAlpha(column, row, visual.texture.key) > 0) {
            if (left === null) left = column;
            right = column;
        }
    }
    const edges = left === null ? null : { left, right };
    alphaCache.set(key, edges);
    return edges;
}

function worldX(visual, column) {
    return visual.x + (column - visual.width * visual.originX) * visual.scaleX;
}

export function pryCornersAt(scene, groundY) {
    const corners = [];
    for (const pryable of scene.gameState.map.pryables ?? []) {
        if (pryable.pried || !pryable.platform.body?.enable) continue;
        const { visual } = pryable;
        if (Math.abs(visualBottom(pryable) - groundY) > CORNER.groundSlack) continue;
        const rowY = groundY - CORNER.rowAbove;
        const row = Math.floor((rowY - visualTop(visual)) / visual.scaleY);
        if (row < 0 || row >= visual.height) continue;
        const edges = opaqueEdges(scene, visual, row);
        if (!edges) continue;
        corners.push({ pryable, side: -1, x: worldX(visual, edges.left) });
        corners.push({ pryable, side: 1, x: worldX(visual, edges.right + 1) });
    }
    return corners;
}

export function findPryCorner(scene, x, groundY) {
    let best = null;
    for (const corner of pryCornersAt(scene, groundY)) {
        const distance = Math.abs(x - corner.x);
        if (distance <= CORNER.reach && (!best || distance < best.distance)) {
            best = { pryable: corner.pryable, side: corner.side, cornerX: corner.x, distance };
        }
    }
    return best && {
        pryable: best.pryable,
        side: best.side,
        x: best.cornerX + best.side * CORNER.outside,
        rotation: -Math.PI / 2 - best.side * CORNER.lean
    };
}

function shakeVisual(scene, visual) {
    const baseX = visual.getData('pryBaseX') ?? visual.x;
    visual.setData('pryBaseX', baseX);
    scene.tweens.killTweensOf(visual);
    visual.x = baseX;
    scene.tweens.add({
        targets: visual,
        x: baseX + NOTCH.shake.distance,
        duration: NOTCH.shake.ms,
        yoyo: true,
        repeat: NOTCH.shake.repeats,
        onComplete: () => { visual.x = baseX; }
    });
}

export function announceWedge(scene, wedge, groundY, spawnDust) {
    shakeVisual(scene, wedge.pryable.visual);
    spawnDust(wedge.x - wedge.side * CORNER.outside, groundY);
}

function drawCracks(scene, pry) {
    const { crack } = NOTCH;
    const graphics = pry.cracks ?? scene.add.graphics();
    if (!pry.cracks) {
        scene.objs.add(graphics);
        pry.cracks = graphics;
    }
    graphics.setDepth(pry.wedge.pryable.visual.depth + 0.5);
    const base = { x: pry.wedge.x - pry.wedge.side * CORNER.outside, y: pry.groundY - CORNER.rowAbove };
    graphics.lineStyle(crack.width, crack.color, 1);
    const reach = crack.length * pry.notches;
    for (let line = 0; line < pry.notches; line++) {
        let point = { ...base };
        const angle = -Math.PI / 2 - pry.wedge.side * (0.3 + line * crack.spread);
        graphics.beginPath();
        graphics.moveTo(point.x, point.y);
        for (let step = 0; step < crack.segments; step++) {
            const wobble = angle + (Math.random() - 0.5) * 0.9;
            const length = reach / crack.segments;
            point = { x: point.x + Math.cos(wobble) * length, y: point.y + Math.sin(wobble) * length };
            graphics.lineTo(point.x, point.y);
        }
        graphics.strokePath();
    }
}

export function clearNotches(pry) {
    if (!pry) return;
    pry.cracks?.destroy();
    pry.cracks = null;
    pry.notches = 0;
}

function crowbarBars(scene) {
    const map = scene.gameState.map;
    if (!map.crowbarBars) {
        map.crowbarBars = scene.physics.add.staticGroup();
        scene.physics.add.collider(scene.gameState.players, map.crowbarBars, null,
            (fighter, block) => !(block.getData('owner') === fighter && fighter.demolition?.tape.phase === 'zip'));
    }
    return map.crowbarBars;
}

export function wedgeRotation(pry) {
    return pry.wedge.rotation + pry.wedge.side * NOTCH.tiltPerNotch * pry.notches;
}

export function hookFlipped(wedge) {
    return wedge.side < 0;
}

function barPoint(pry, distance) {
    const rotation = wedgeRotation(pry);
    return { x: pry.base.x + Math.cos(rotation) * distance, y: pry.base.y + Math.sin(rotation) * distance };
}

export function barTop(pry) {
    return barPoint(pry, BAR.length);
}

export function buildBar(scene, player, pry) {
    releaseBar(pry);
    const group = crowbarBars(scene);
    const count = Math.ceil(BAR.length / BAR.segment);
    pry.bar = [];
    for (let index = 0; index < count; index++) {
        const center = barPoint(pry, BAR.segment * (index + 0.5));
        const block = group.create(center.x, center.y, 'groundhitbox');
        block.setDisplaySize(BAR.thickness, BAR.segment).setVisible(false).setData('owner', player);
        block.refreshBody();
        block.body.checkCollision.down = false;
        block.body.checkCollision.left = false;
        block.body.checkCollision.right = false;
        scene.objs.add(block);
        pry.bar.push(block);
    }
}

export function releaseBar(pry) {
    if (!pry?.bar) return;
    for (const block of pry.bar) block.destroy();
    pry.bar = null;
}

function standsOnBar(player, pry) {
    const body = player.body;
    return (pry.bar ?? []).some(block => Math.abs(body.bottom - block.body.top) <= NOTCH.slamReach &&
        body.right > block.body.left && body.left < block.body.right);
}

function tiltCrowbar(scene, player, pry, crowbarImage, duration) {
    scene.tweens.killTweensOf(crowbarImage);
    scene.tweens.add({ targets: crowbarImage, rotation: wedgeRotation(pry), duration, ease: 'Quad.easeOut' });
    buildBar(scene, player, pry);
}

export function tryNotch(api, scene, player, pry, crowbarImage) {
    if (!pry || !standsOnBar(player, pry)) return false;
    pry.notches += 1;
    pry.lastNotchAt = scene.time.now;
    scene.sound.play(NOTCH.sounds[Math.min(pry.notches, NOTCH.sounds.length) - 1]);
    drawCracks(scene, pry);
    shakeVisual(scene, pry.wedge.pryable.visual);
    api.triggerScreenShake(scene, 4 + pry.notches * 2, 150);
    if (pry.notches >= NOTCH.count) return true;
    tiltCrowbar(scene, player, pry, crowbarImage, NOTCH.tiltMs);
    return false;
}

export function notchesFaded(scene, pry) {
    return pry && pry.notches > 0 && scene.time.now - pry.lastNotchAt >= NOTCH.fadeMs;
}

export function relaxNotches(scene, player, pry, crowbarImage) {
    clearNotches(pry);
    tiltCrowbar(scene, player, pry, crowbarImage, NOTCH.relaxMs);
}

export function launchPlatform(api, scene, player, pry) {
    const { pryable } = pry.wedge;
    const { visual, platform } = pryable;
    pryable.pried = true;
    scene.tweens.killTweensOf(visual);
    visual.x = visual.getData('pryBaseX') ?? visual.x;
    clearNotches(pry);
    dropRiders(scene, platform);
    scene.physics.world.disable(platform);
    scene.sound.play('ripfling');
    scene.sound.play('falling');
    scene.sound.play('explosion');
    spawnBlast(api, scene, visual.x, pry.groundY, FLIGHT.explosion.flingScale);
    api.spawnDirtBurst(scene, pry.wedge.x, pry.groundY, 24, 8, 14, 2);
    api.triggerScreenShake(scene, 12, 300);
    return {
        pryable,
        start: scene.time.now,
        startY: visual.y,
        contactOffset: pry.groundY - visual.y,
        topOffset: platform.body.top - visual.y,
        topCenterOffset: platform.body.center.x - visual.x,
        topWidth: platform.body.width,
        target: null,
        column: null,
        mark: null,
        hitDone: false,
        landed: false,
        offStage: false,
        spinDir: -pry.wedge.side
    };
}

function dropRiders(scene, platform) {
    for (const fighter of scene.gameState.players) {
        if (fighter.currentPlatform === platform) fighter.currentPlatform = null;
    }
}

function mainGroundTopAt(scene, x) {
    const ground = scene.gameState.map.ground;
    if (!ground?.body?.enable || x < ground.body.left || x > ground.body.right) return null;
    return ground.body.top;
}

function nearestFoe(api, scene, player, x, y) {
    let best = null;
    for (const foe of api.getEnemies(scene, player)) {
        const distance = Math.hypot(foe.x - x, foe.y - y);
        if (!best || distance < best.distance) best = { foe, distance };
    }
    return best?.foe ?? null;
}

function showColumn(scene, flight) {
    const { column, mark } = FLIGHT;
    flight.column = scene.add.rectangle(flight.target.x, flight.target.y, column.width, column.height, HEX.danger, column.alpha)
        .setDepth(50);
    flight.mark = scene.add.text(flight.target.x, flight.target.y - mark.offsetY, '!', {
        fontFamily: FONTS.title,
        fontSize: `${mark.size}px`,
        color: COLORS.text
    }).setOrigin(0.5).setDepth(51);
    scene.objs.add(flight.column);
    scene.objs.add(flight.mark);
    scene.sound.play('danger');
}

function hideColumn(flight) {
    flight.column?.destroy();
    flight.mark?.destroy();
    flight.column = null;
    flight.mark = null;
}

function trackColumn(scene, flight) {
    if (!flight.column || !flight.target?.active) return;
    flight.column.setPosition(flight.target.x, flight.target.y);
    flight.mark.setPosition(flight.target.x, flight.target.y - FLIGHT.mark.offsetY);
    flight.mark.setVisible(Math.floor(scene.time.now / FLIGHT.mark.blinkMs) % 2 === 0);
}

function deflectFlight(api, scene, flight, blocker) {
    const { visual } = flight.pryable;
    const dir = Math.sign(blocker.lastDir?.x) || Math.sign(visual.x - blocker.x) || 1;
    hideColumn(flight);
    flight.deflected = { dir, by: blocker, hit: new Set([blocker]), vx: dir * FLIGHT.deflect.speed, vy: -FLIGHT.deflect.lift };
    api.triggerScreenShake(scene, FLIGHT.deflect.shake, FLIGHT.shakeMs);
    scene.sound.play('whoosh');
}

function touchesVisual(visual, fighter) {
    const body = fighter.body;
    if (!body) return false;
    const scale = FLIGHT.deflect.hitbox;
    const width = visual.displayWidth * scale;
    const height = visual.displayHeight * scale;
    return Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(visual.x - width / 2, visual.y - height / 2, width, height),
        new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height)
    );
}

function hitWhileDeflected(api, scene, flight) {
    const { visual } = flight.pryable;
    const motion = flight.deflected;
    const { damage, knockback } = FLIGHT.deflect.hit;
    for (const fighter of scene.gameState.players) {
        if (motion.hit.has(fighter) || !fighter.active || fighter.eliminated || api.isInvincible(fighter)) continue;
        if (!touchesVisual(visual, fighter)) continue;
        motion.hit.add(fighter);
        api.landHit(scene, motion.by, fighter, {
            special: true,
            damage,
            hitstun: 700,
            hitFreeze: 100,
            sound: 'slamimpact',
            ranged: true,
            shieldCost: FLIGHT.blockShieldCost,
            direction: { x: motion.dir, y: 0 },
            knockback: ({ kb }) => ({
                x: motion.dir * knockback.x * kb,
                y: -knockback.y * kb
            }),
            decelerateAfter: 900
        });
    }
}

function updateDeflected(api, scene, flight, dt) {
    const { visual } = flight.pryable;
    const motion = flight.deflected;
    const { gravity, spin, bounds } = FLIGHT.deflect;
    motion.vy += gravity * dt;
    visual.x += motion.vx * dt;
    visual.y += motion.vy * dt;
    visual.setRotation(visual.rotation + motion.dir * spin * dt);
    hitWhileDeflected(api, scene, flight);
    if (visual.x < bounds.left || visual.x > bounds.right || visual.y > bounds.bottom) {
        visual.destroy();
        return true;
    }
    return false;
}

function blockFall(api, scene, player, flight, foe) {
    flight.blockedBy ??= new Set();
    flight.blockedBy.add(foe);
    const options = { shieldCost: FLIGHT.blockShieldCost };
    if (api.deflects(scene, foe, player, FLIGHT.hit.damage, options)) {
        deflectFlight(api, scene, flight, foe);
        return;
    }
    api.blocksHit(scene, foe, player, FLIGHT.hit.damage, { ...options, ranged: true, special: true });
}

function hitUnderneath(api, scene, player, flight, contactY) {
    if (flight.hitDone) return;
    const { visual } = flight.pryable;
    const halfWidth = visual.displayWidth / 2;
    for (const foe of api.getEnemies(scene, player)) {
        if (Math.abs(foe.x - visual.x) > halfWidth || contactY < foe.body.top || api.isInvincible(foe)) continue;
        if (flight.blockedBy?.has(foe)) continue;
        if (foe.blocking) {
            blockFall(api, scene, player, flight, foe);
            if (flight.deflected) return;
            continue;
        }
        const side = Math.sign(foe.x - visual.x) || (Math.random() < 0.5 ? -1 : 1);
        const hit = api.landHit(scene, player, foe, {
            special: true,
            damage: FLIGHT.hit.damage,
            hitstun: 700,
            hitFreeze: 140,
            sound: 'slamimpact',
            ranged: true,
            ignoreResistance: true,
            direction: { x: side, y: 0 },
            knockback: ({ kb }) => ({ x: side * FLIGHT.hit.knockback.x * kb, y: -FLIGHT.hit.knockback.y * kb }),
            decelerateAfter: 900
        });
        if (hit) flight.hitDone = true;
    }
}

function settleWreck(api, scene, flight, groundTop) {
    const { visual } = flight.pryable;
    const tilt = Math.sign(visual.x - flight.dropX) * FLIGHT.tilt || FLIGHT.tilt;
    const pivot = { x: visual.x, y: groundTop };
    const frameHeight = visual.height;
    const originY = (flight.contactOffset / visual.scaleY + frameHeight * visual.originY) / frameHeight;
    visual.setOrigin(visual.originX, originY).setPosition(pivot.x, pivot.y).setRotation(tilt);

    const map = scene.gameState.map;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const relY = flight.topOffset - flight.contactOffset;
    const steps = Math.max(1, Math.ceil(flight.topWidth * Math.abs(sin) / FLIGHT.stepRise));
    const stepWidth = flight.topWidth / steps;
    flight.wreckSteps = [];
    for (let index = 0; index < steps; index++) {
        const relX = flight.topCenterOffset - flight.topWidth / 2 + stepWidth * (index + 0.5);
        const x = pivot.x + relX * cos - relY * sin;
        const y = pivot.y + relX * sin + relY * cos;
        const step = map.topPlatforms.create(x, y, 'groundhitbox');
        step.setDisplaySize(stepWidth * cos + 2, 0);
        step.refreshBody();
        step.body.checkCollision.down = false;
        step.body.checkCollision.left = false;
        step.body.checkCollision.right = false;
        scene.objs.add(step);
        flight.wreckSteps.push(step);
    }
    api.spawnDirtBurst(scene, pivot.x, groundTop, 30, 10, 16, 2.5);
    api.triggerScreenShake(scene, FLIGHT.landShake, FLIGHT.shakeMs);
    scene.sound.play('sledgehammerquickslam');
    scene.sound.play('explosion');
    spawnBlast(api, scene, pivot.x, groundTop, FLIGHT.explosion.crashScale);
}

function spawnBlast(api, scene, x, groundY, scale) {
    const { height, sinkPerScale } = FLIGHT.explosion;
    api.spawnExplosion(scene, { x, y: groundY - height * scale / 2 + sinkPerScale * scale }, scale);
}

export function updateFlight(api, scene, player, flight) {
    const { visual } = flight.pryable;
    const elapsed = scene.time.now - flight.start;
    const dt = scene.game.loop.delta / 1000;
    if (flight.deflected) return updateDeflected(api, scene, flight, dt);

    if (elapsed < FLIGHT.riseMs) {
        const t = elapsed / FLIGHT.riseMs;
        visual.y = flight.startY - t * t * FLIGHT.riseHeight;
        visual.setRotation(flight.spinDir * FLIGHT.riseSpin * t * t);
        return false;
    }
    if (elapsed < FLIGHT.columnAtMs) {
        visual.setVisible(false);
        return false;
    }
    if (!flight.target) {
        flight.target = nearestFoe(api, scene, player, player.x, player.y);
        if (!flight.target) {
            visual.destroy();
            return true;
        }
        showColumn(scene, flight);
    }
    trackColumn(scene, flight);
    if (elapsed < FLIGHT.dropAtMs) return false;

    if (flight.landY === undefined) {
        flight.dropX = flight.target.x;
        visual.setVisible(true).setX(flight.dropX);
        flight.landY = mainGroundTopAt(scene, flight.target.x);
        flight.fallFromY = (flight.landY ?? flight.target.body.bottom) - FLIGHT.dropHeight;
    }
    visual.x += (flight.target.x - visual.x) * Math.min(1, FLIGHT.homing * dt);

    if (flight.offStage) {
        visual.y += FLIGHT.offStageSpeed * dt;
        visual.setRotation(visual.rotation + flight.spinDir * FLIGHT.fallSpin * dt);
        if (visual.y > FLIGHT.offStageLimit) {
            visual.destroy();
            return true;
        }
        return false;
    }

    const t = Math.min(1, (elapsed - FLIGHT.dropAtMs) / (FLIGHT.landAtMs - FLIGHT.dropAtMs));
    const finalContact = flight.landY ?? flight.target.body.bottom;
    const contactY = flight.fallFromY + (finalContact - flight.fallFromY) * t * t;
    visual.y = contactY - flight.contactOffset;
    visual.setRotation(flight.spinDir * FLIGHT.fallSpin * (1 - t));
    hitUnderneath(api, scene, player, flight, contactY);
    if (flight.deflected) return false;
    if (t < 1) return false;

    hideColumn(flight);
    const groundTop = mainGroundTopAt(scene, visual.x);
    if (groundTop === null) {
        flight.offStage = true;
        return false;
    }
    visual.y = groundTop - flight.contactOffset;
    settleWreck(api, scene, flight, groundTop);
    return true;
}

export function abandonFlight(flight) {
    if (!flight) return;
    hideColumn(flight);
    if (flight.deflected) flight.pryable.visual.destroy();
}
