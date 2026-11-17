// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { isGrounded, pinTarget, slamImpact } from '../combat/pin.js';
import {
    findPryCorner,
    announceWedge,
    tryNotch,
    notchesFaded,
    clearNotches,
    launchPlatform,
    updateFlight,
    abandonFlight
} from './superPry.js';

const ANCHORED = { speedScale: 0.6, jumpScale: 0.8 };
const BUSY_SPEED_SCALE = 0.3;

const TAPE = {
    shoulder: { x: 6, y: 4 },
    armLength: 50,
    caseOrigins: [{ x: 1 / 75, y: 33 / 60 }, { x: 1 / 75, y: 28 / 60 }],
    stripLength: 700,
    stripHeight: 3,
    punchSpeed: 4200,
    hitReach: 34,
    latchWindow: 70,
    cancelEndlagMs: 150,
    extendRate: 1.6,
    ratchetVolume: 0.5,
    snapRate: 2.4
};

const PUNCH = {
    length: 350,
    endlagMs: 500,
    cooldownMs: 1500,
    retractMs: 250,
    recoil: { push: 650, lift: 200, lockMs: 250 },
    hit: {
        damage: 0.06,
        plankDamage: 0.08,
        hitstun: 450,
        hitFreeze: 80,
        sound: 'light',
        knockback: { x: 700, y: 520 },
        decelerateAfter: 700
    }
};

const TILT = {
    outMs: 60,
    holdMs: 50,
    inMs: 110,
    cooldownMs: 200,
    damage: 0.035,
    hitFreeze: 80,
    lineReach: 32,
    kinds: {
        up: { length: 230, dir: () => ({ x: 0, y: -1 }), kbTime: 300, knockback: { x: 0, y: 440 } },
        down: { length: 170, dir: facing => ({ x: facing, y: 0.12 }), kbTime: 300, knockback: { x: 150, y: -380 }, popUp: true },
        side: { length: 210, dir: facing => ({ x: facing, y: 0 }), kbTime: 600, knockback: { x: 600, y: 500 } }
    }
};

const ZIP = { speed: 1500, arriveDistance: 45, timeoutMs: 700, keepVelocity: 0.25, latchRadius: 50, gripHeight: 50 };

const CROWBAR = {
    origin: { x: 3 / 100, y: 23 / 50 },
    sink: 10,
    plantOffset: 28,
    plantTilt: 0.12,
    backOffset: { x: -30, y: -20 },
    plantMs: 180,
    pickupMs: 250,
    busyMs: 300,
    pickupReach: { x: 55, y: 80 },
    returnSpeed: 1600,
    returnSpin: 0.025,
    catchDistance: 30,
    clangRate: 1.8,
    wedgeClangRate: 1.1
};

const SLAM = {
    origin: { x: 65 / 200, y: 125 / 150 },
    frames: [
        [0, 1], [500, 2], [1000, 3], [1500, 4], [2000, 5], [2500, 6], [3000, 7], [3050, 8],
        [3400, 9], [3500, 10], [3600, 11], [3700, 12], [3780, 13], [3835, 14], [3890, 15], [3945, 16]
    ],
    soundAtMs: 2750,
    swingAtMs: 2500,
    impactMs: 3000,
    totalMs: 4000,
    reach: { front: 175, back: 10, up: 120, down: 70 },
    dirtOffset: 120,
    damage: 0.20,
    plankDamage: 0.15,
    groundPinMs: 2000,
    airPinMs: 3000,
    crashSpeed: 2200,
    crashTimeoutMs: 1500
};

const DEPTH = { planted: 1.8, back: 1.9, slam: 2.2, strip: 2.3, fist: 2.4, case: 2.5 };

function lerp(min, max, t) {
    return min + (max - min) * t;
}

function stateOf(scene, player) {
    if (player.demolition) return player.demolition;
    const add = object => {
        scene.objs.add(object);
        return object;
    };
    const parts = {
        slam: add(scene.add.sprite(player.x, player.y, 'bigcrowbarslam', 0).setDepth(DEPTH.back)),
        strip: add(scene.add.image(player.x, player.y, 'tapestrip').setOrigin(1, 0.5).setDepth(DEPTH.strip).setVisible(false)),
        fist: add(scene.add.image(player.x, player.y, 'tapefist').setDepth(DEPTH.fist).setVisible(false)),
        tapeCase: add(scene.add.sprite(player.x, player.y, 'tapecast', 0).setDepth(DEPTH.case)),
        crowbar: add(scene.add.image(player.x, player.y, 'bigcrowbar')
            .setOrigin(CROWBAR.origin.x, CROWBAR.origin.y).setDepth(DEPTH.planted).setVisible(false))
    };
    player.attachedWeapons = [parts.slam, parts.strip, parts.fist, parts.tapeCase];
    player.demolition = {
        parts,
        facing: player.lastDir.x || 1,
        anchored: true,
        busyUntil: 0,
        lockMoveUntil: 0,
        ownsSideSpecial: false,
        respawnSeen: false,
        kickUntil: 0,
        tape: { phase: 'idle', readyAt: 0, nextTiltAt: 0, dir: { x: 1, y: 0 }, length: 0 },
        slam: null,
        crowbar: { state: 'back', x: 0, y: 0 },
        pry: null,
        flight: null,
        snap: scene.sound.add('ratchet', { loop: true, volume: TAPE.ratchetVolume, rate: TAPE.snapRate })
    };
    return player.demolition;
}

function setLooping(sound, on) {
    if (on && !sound.isPlaying) sound.play();
    else if (!on && sound.isPlaying) sound.stop();
}

function shoulderOf(player, facing) {
    return { x: player.x + facing * TAPE.shoulder.x, y: player.y + TAPE.shoulder.y };
}

function mouthOf(player, d, dir) {
    const shoulder = shoulderOf(player, d.facing);
    return { x: shoulder.x + dir.x * TAPE.armLength, y: shoulder.y + dir.y * TAPE.armLength };
}

function normalize(dir) {
    const length = Math.hypot(dir.x, dir.y) || 1;
    return { x: dir.x / length, y: dir.y / length };
}

function distanceToSegment(point, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Phaser.Math.Clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq, 0, 1);
    return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

function drawTape(scene, player, d) {
    const { tapeCase, strip, fist } = d.parts;
    const tape = d.tape;
    const dir = tape.phase === 'idle' ? { x: d.facing, y: 0 } : tape.dir;
    const flip = dir.x < 0 || (dir.x === 0 && d.facing < 0);
    const angle = Math.atan2(dir.y, dir.x);
    const turn = flip ? angle - Math.PI : angle;
    const kick = scene.time.now < d.kickUntil ? 1 : 0;
    const origin = TAPE.caseOrigins[kick];
    const shoulder = shoulderOf(player, d.facing);

    tapeCase.setFrame(kick).setFlipX(flip).setOrigin(flip ? 1 - origin.x : origin.x, origin.y)
        .setPosition(shoulder.x, shoulder.y).setRotation(turn).setVisible(true);

    const length = Math.min(tape.length, TAPE.stripLength);
    if (tape.phase === 'idle' || length < 1) {
        strip.setVisible(false);
        fist.setVisible(false);
        return;
    }
    const mouth = mouthOf(player, d, dir);
    const tip = { x: mouth.x + dir.x * length, y: mouth.y + dir.y * length };
    strip.setVisible(true).setPosition(tip.x, tip.y).setRotation(angle)
        .setCrop(TAPE.stripLength - length, 0, length, TAPE.stripHeight);
    fist.setVisible(true).setPosition(tip.x, tip.y).setFlipX(flip).setRotation(turn);
}

function slamFrame(elapsed) {
    let frame = 0;
    for (const [at, index] of SLAM.frames) {
        if (elapsed >= at) frame = index;
    }
    return elapsed >= SLAM.totalMs ? 0 : frame;
}

function drawSlam(scene, player, d) {
    const sprite = d.parts.slam;
    if (!d.anchored) {
        sprite.setVisible(false);
        return;
    }
    const facing = d.slam ? d.slam.facing : d.facing;
    const frame = d.slam ? slamFrame(scene.time.now - d.slam.start) : 0;
    sprite.setVisible(true).setFrame(frame).setFlipX(facing < 0)
        .setOrigin(facing < 0 ? 1 - SLAM.origin.x : SLAM.origin.x, SLAM.origin.y)
        .setPosition(player.x, player.y)
        .setDepth(frame === 0 ? DEPTH.back : DEPTH.slam);
}

function backPosition(player, d) {
    return { x: player.x + d.facing * CROWBAR.backOffset.x, y: player.y + CROWBAR.backOffset.y };
}

function crowbarGrip(d) {
    return { x: d.crowbar.x, y: d.crowbar.y - ZIP.gripHeight };
}

function enemiesOf(api, scene, player) {
    return api.getEnemies(scene, player).filter(foe => foe.active && !foe.eliminated);
}

function handleAttack(api, scene, player) {
    const d = stateOf(scene, player);
    const now = scene.time.now;
    if (player.hitstun || now < d.busyUntil || now < d.tape.readyAt) return;
    if (now < player.nextAttackTime || isTapeBusy(player)) return;
    const dir = { x: d.facing, y: 0 };
    player.nextAttackTime = now + PUNCH.cooldownMs;
    d.kickUntil = now + PUNCH.endlagMs;
    scene.sound.play('ratchet', { rate: TAPE.extendRate, volume: TAPE.ratchetVolume });
    scene.sound.play('whoosh', { volume: 0.7 });
    if (!d.anchored) {
        player.setVelocityX(-dir.x * PUNCH.recoil.push);
        player.setVelocityY(Math.min(player.body.velocity.y, -PUNCH.recoil.lift));
        player.afterimage = true;
        d.lockMoveUntil = now + PUNCH.recoil.lockMs;
    }
    d.tape = { ...d.tape, phase: 'punch', aim: PUNCH.length, dir, length: 0, readyAt: now + PUNCH.endlagMs };
}

function lineContact(mouth, dir, point, radius, reach) {
    const offsetX = point.x - mouth.x;
    const offsetY = point.y - mouth.y;
    const along = offsetX * dir.x + offsetY * dir.y;
    const side = Math.abs(offsetX * dir.y - offsetY * dir.x);
    if (side > radius || along < -radius || along > reach + radius) return null;
    return Phaser.Math.Clamp(along, 0, reach);
}

function firstContact(api, scene, player, d, mouth, reach) {
    const tape = d.tape;
    let best = null;
    for (const foe of enemiesOf(api, scene, player)) {
        const at = lineContact(mouth, tape.dir, foe, TAPE.hitReach, reach);
        if (at === null || (best && at >= best.at)) continue;
        if (!api.attackIsElligible(player, foe, TAPE_REACH + TAPE.hitReach,
            { ignoreCanAttack: true, ignoreFacing: true, silent: true })) continue;
        best = { at, foe };
    }
    if (d.crowbar.state === 'planted') {
        const at = lineContact(mouth, tape.dir, crowbarGrip(d), ZIP.latchRadius, reach);
        if (at !== null && tape.aim - at <= TAPE.latchWindow && (!best || at < best.at)) {
            best = { at, grip: crowbarGrip(d) };
        }
    }
    return best;
}

function updatePunch(api, scene, player, d) {
    const tape = d.tape;
    if (player.hitstun) {
        startRetract(scene, player, d, TAPE.cancelEndlagMs);
        return;
    }
    const reach = Math.min(tape.aim, tape.length + TAPE.punchSpeed * scene.game.loop.delta / 1000);
    const contact = firstContact(api, scene, player, d, mouthOf(player, d, tape.dir), reach);
    if (contact?.grip) {
        tape.length = contact.at;
        startZip(scene, player, d, contact.grip);
        return;
    }
    if (contact) {
        tape.length = contact.at;
        const hit = punchFoe(api, scene, player, contact.foe, tape.dir);
        finishPunch(scene, player, d, hit);
        return;
    }
    tape.length = reach;
    if (reach >= tape.aim) finishPunch(scene, player, d, false);
}

function finishPunch(scene, player, d, hit) {
    if (!hit) scene.sound.play('miss');
    const readyAt = d.tape.readyAt;
    startRetract(scene, player, d, PUNCH.retractMs);
    d.tape.readyAt = Math.max(readyAt, d.tape.readyAt);
}

function punchFoe(api, scene, player, foe, dir) {
    if (!api.attackIsElligible(player, foe, TAPE_REACH + TAPE.hitReach,
        { ignoreCanAttack: true, ignoreFacing: true })) return false;
    return api.landHit(scene, player, foe, { ...PUNCH.hit, direction: dir });
}

function startRetract(scene, player, d, duration) {
    const now = scene.time.now;
    d.tape = {
        ...d.tape,
        phase: d.tape.length > 0 ? 'retract' : 'idle',
        from: d.tape.length,
        retractStart: now,
        retractMs: duration,
        readyAt: now + duration
    };
}

function updateRetract(scene, d) {
    const tape = d.tape;
    const t = Phaser.Math.Clamp((scene.time.now - tape.retractStart) / tape.retractMs, 0, 1);
    tape.length = tape.from * (1 - t * t);
    setLooping(d.snap, t < 1);
    if (t >= 1) {
        tape.phase = 'idle';
        tape.length = 0;
    }
}

function startZip(scene, player, d, grip) {
    scene.sound.play('grab');
    d.tape.phase = 'zip';
    d.tape.zipUntil = scene.time.now + ZIP.timeoutMs;
    d.tape.zipTarget = grip;
    player.body.allowGravity = false;
}

function endZip(scene, player, d) {
    player.body.allowGravity = true;
    player.setVelocity(player.body.velocity.x * ZIP.keepVelocity, player.body.velocity.y * ZIP.keepVelocity);
    startRetract(scene, player, d, TAPE.cancelEndlagMs);
}

function updateZip(scene, player, d) {
    const tape = d.tape;
    const target = tape.zipTarget;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (player.hitstun || distance <= ZIP.arriveDistance + 2 || scene.time.now >= tape.zipUntil ||
        d.crowbar.state !== 'planted') {
        endZip(scene, player, d);
        return;
    }
    const frameSeconds = Math.max(scene.game.loop.delta, 1) / 1000;
    const speed = Math.min(ZIP.speed, (distance - ZIP.arriveDistance) / frameSeconds);
    player.setVelocity(dx / distance * speed, dy / distance * speed);
    const mouth = mouthOf(player, d, tape.dir);
    tape.dir = normalize({ x: target.x - mouth.x, y: target.y - mouth.y });
    tape.length = Math.hypot(target.x - mouth.x, target.y - mouth.y);
    setLooping(d.snap, true);
}

function tilt(api, scene, player, kindName) {
    const d = stateOf(scene, player);
    const now = scene.time.now;
    if (player.hitstun || player.freeze || now < d.busyUntil || now < d.tape.readyAt || now < d.tape.nextTiltAt) return;
    if (isTapeBusy(player)) return;
    const kind = TILT.kinds[kindName];
    const dir = normalize(kind.dir(d.facing));
    d.tape = {
        ...d.tape,
        phase: 'tilt',
        kind: kindName,
        startedAt: now,
        dir,
        length: 0,
        landed: false,
        readyAt: now + TILT.outMs + TILT.holdMs,
        nextTiltAt: now + TILT.cooldownMs
    };
    scene.sound.play('swosh');
}

function updateTilt(api, scene, player, d) {
    const tape = d.tape;
    const kind = TILT.kinds[tape.kind];
    const t = scene.time.now - tape.startedAt;
    if (t < TILT.outMs) {
        tape.length = kind.length * t / TILT.outMs;
    } else if (t < TILT.outMs + TILT.holdMs) {
        tape.length = kind.length;
    } else {
        tape.length = kind.length * Math.max(0, 1 - (t - TILT.outMs - TILT.holdMs) / TILT.inMs);
    }
    if (!tape.landed && t >= TILT.outMs) {
        tape.landed = true;
        landTilt(api, scene, player, d, kind);
    }
    if (t >= TILT.outMs + TILT.holdMs + TILT.inMs) {
        tape.phase = 'idle';
        tape.length = 0;
    }
}

function landTilt(api, scene, player, d, kind) {
    if (player.hitstun) return;
    const dir = d.tape.dir;
    const mouth = mouthOf(player, d, dir);
    const tip = { x: mouth.x + dir.x * kind.length, y: mouth.y + dir.y * kind.length };
    const facing = d.facing;
    let hitAny = false;
    for (const foe of enemiesOf(api, scene, player)) {
        if (distanceToSegment(foe, mouth, tip) > TILT.lineReach + 20) continue;
        if (!api.attackIsElligible(player, foe, kind.length + TAPE.armLength + TILT.lineReach,
            { ignoreCanAttack: true, ignoreFacing: true })) continue;
        const knockback = kind.popUp
            ? () => ({ x: facing * kind.knockback.x, y: kind.knockback.y })
            : { x: kind.knockback.x, y: kind.knockback.y, growth: false, maxDamageScale: 2 };
        const hit = api.landHit(scene, player, foe, {
            damage: TILT.damage,
            hitstun: kind.kbTime + 300,
            hitstunGrowth: false,
            hitFreeze: TILT.hitFreeze,
            sound: 'anyhit',
            direction: dir,
            knockback,
            decelerateAfter: kind.kbTime
        });
        if (hit) hitAny = true;
    }
    if (!hitAny) scene.sound.play('miss');
}

function neutral(api, scene, player) {
    const d = stateOf(scene, player);
    const now = scene.time.now;
    if (player.hitstun || player.freeze || now < d.busyUntil || d.slam) return;
    if (isTapeBusy(player)) return;
    if (d.anchored && d.crowbar.state === 'back') {
        if (isGrounded(player)) plantCrowbar(api, scene, player, d);
        return;
    }
    if (d.crowbar.state !== 'planted') return;
    const near = Math.abs(d.crowbar.x - player.x) <= CROWBAR.pickupReach.x &&
        Math.abs(d.crowbar.y - player.body.bottom) <= CROWBAR.pickupReach.y;
    if (near) pickUpCrowbar(scene, player, d);
}

function plantCrowbar(api, scene, player, d) {
    const now = scene.time.now;
    const image = d.parts.crowbar;
    const from = backPosition(player, d);
    const groundY = player.body.bottom;
    const spot = { x: player.x + d.facing * CROWBAR.plantOffset, y: groundY + CROWBAR.sink };
    const wedge = findPryCorner(scene, spot.x, groundY) ?? findPryCorner(scene, player.x, groundY);
    if (wedge) spot.x = wedge.x;
    const rotation = wedge ? wedge.rotation : -Math.PI / 2 + d.facing * CROWBAR.plantTilt;
    d.pry = wedge ? { wedge, groundY, notches: 0, lastNotchAt: 0, cracks: null } : null;
    d.anchored = false;
    d.busyUntil = now + CROWBAR.busyMs;
    d.crowbar = { state: 'planting', x: spot.x, y: spot.y };
    scene.tweens.killTweensOf(image);
    image.setVisible(true).setPosition(from.x, from.y).setRotation(-Math.PI / 2);
    scene.sound.play('swosh');
    scene.tweens.add({
        targets: image,
        x: spot.x,
        y: spot.y,
        rotation,
        duration: CROWBAR.plantMs,
        ease: 'Quad.easeIn',
        onComplete: () => {
            if (d.crowbar.state !== 'planting') return;
            d.crowbar.state = 'planted';
            api.spawnDirtBurst(scene, spot.x, groundY, 10, 4, 8, 1.2);
            api.triggerScreenShake(scene, 3, 120);
            if (!d.pry) {
                scene.sound.play('ripfling', { rate: CROWBAR.clangRate });
                return;
            }
            scene.sound.play('ripfling', { rate: CROWBAR.wedgeClangRate });
            announceWedge(scene, d.pry.wedge, groundY,
                (x, y) => api.spawnDirtBurst(scene, x, y, 18, 6, 10, 1.6));
        }
    });
}

function pickUpCrowbar(scene, player, d) {
    const image = d.parts.crowbar;
    d.busyUntil = scene.time.now + CROWBAR.busyMs;
    d.crowbar.state = 'pickup';
    dropPry(d);
    scene.sound.play('grab');
    scene.tweens.killTweensOf(image);
    const target = backPosition(player, d);
    scene.tweens.add({
        targets: image,
        x: target.x,
        y: target.y,
        rotation: -Math.PI / 2,
        duration: CROWBAR.pickupMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
            if (d.crowbar.state === 'pickup') strapOn(d);
        }
    });
}

function dropPry(d) {
    clearNotches(d.pry);
    d.pry = null;
}

function strapOn(d) {
    dropPry(d);
    d.anchored = true;
    d.crowbar.state = 'back';
    d.parts.crowbar.setVisible(false);
}

function recallCrowbar(scene, player, d) {
    dropPry(d);
    scene.tweens.killTweensOf(d.parts.crowbar);
    d.crowbar.state = 'returning';
    scene.sound.play('whoosh');
}

function updateCrowbar(scene, player, d) {
    if (d.crowbar.state !== 'returning') return;
    const image = d.parts.crowbar;
    const target = backPosition(player, d);
    const dx = target.x - image.x;
    const dy = target.y - image.y;
    const distance = Math.hypot(dx, dy);
    const step = CROWBAR.returnSpeed * scene.game.loop.delta / 1000;
    if (distance <= Math.max(CROWBAR.catchDistance, step)) {
        scene.sound.play('grab');
        strapOn(d);
        return;
    }
    image.setPosition(image.x + dx / distance * step, image.y + dy / distance * step);
    image.setRotation(image.rotation + CROWBAR.returnSpin * scene.game.loop.delta);
}

function handleDirSpecial(api, scene, player, direction, currentTime) {
    const dtapDelay = 250;
    const d = stateOf(scene, player);
    const doubleTapped = currentTime - player.lastTap[direction] < dtapDelay || player.isBot;
    player.lastTap[direction] = currentTime;
    if (!doubleTapped || player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime || currentTime < d.busyUntil || d.slam) return;

    if (d.crowbar.state === 'planted') {
        recallCrowbar(scene, player, d);
        api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
        return;
    }
    if (!d.anchored || d.crowbar.state !== 'back') return;
    const facing = direction === 'left' ? -1 : 1;
    d.facing = facing;
    player.lastDir = { x: facing, y: 0 };
    d.slam = { start: currentTime, facing, soundPlayed: false, swung: false, landed: false };
    api.startSideSpecialCooldown(player, currentTime, SLAM.totalMs + player.dirSpecialCooldown);
    scene.sound.play('swosh');
}

function updateSlam(api, scene, player, d) {
    const slam = d.slam;
    if (!slam) return;
    const now = scene.time.now;
    const elapsed = now - slam.start;
    if (!slam.landed && player.respawnFalling) {
        d.slam = null;
        api.startSideSpecialCooldown(player, now, player.dirSpecialCooldown);
        return;
    }
    if (!slam.soundPlayed && elapsed >= SLAM.soundAtMs) {
        slam.soundPlayed = true;
        scene.sound.play('crowbarslam');
    }
    if (!slam.swung && elapsed >= SLAM.swingAtMs) {
        slam.swung = true;
        scene.sound.play('whoosh');
    }
    if (!slam.landed && elapsed >= SLAM.impactMs) {
        slam.landed = true;
        landSlam(api, scene, player, slam.facing);
    }
    if (elapsed >= SLAM.totalMs) {
        d.slam = null;
        api.startSideSpecialCooldown(player, now, player.dirSpecialCooldown);
    }
}

function inSlamReach(player, foe, facing) {
    const ahead = (foe.x - player.x) * facing;
    const below = foe.y - player.y;
    return ahead >= -SLAM.reach.back && ahead <= SLAM.reach.front &&
        below >= -SLAM.reach.up && below <= SLAM.reach.down;
}

function landSlam(api, scene, player, facing) {
    api.spawnDirtBurst(scene, player.x + facing * SLAM.dirtOffset, player.body.bottom, 16, 6, 10, 1.5);
    api.triggerScreenShake(scene, 6, 200);
    for (const foe of enemiesOf(api, scene, player)) {
        if (!inSlamReach(player, foe, facing)) continue;
        if (api.isInvincible(foe) || api.isBlockedByWall(player, foe)) continue;
        foe.flash();
        const grounded = isGrounded(foe);
        const hit = api.landHit(scene, player, foe, {
            damage: SLAM.damage,
            plankDamage: SLAM.plankDamage,
            hitstun: grounded ? SLAM.groundPinMs : SLAM.airPinMs + SLAM.crashTimeoutMs,
            hitstunGrowth: false,
            hitFreeze: 90,
            sound: 'slamimpact',
            noDeathRay: true,
            resetCombo: false,
            direction: { x: facing, y: 0 },
            knockback: () => ({ x: 0, y: grounded ? 0 : SLAM.crashSpeed }),
            decelerateAfter: 50
        });
        if (!hit) continue;
        if (grounded) slamImpact(scene, foe);
        pinTarget(scene, player, foe, { ...SLAM, grounded, extendCooldown: false, flatten: true });
    }
}

function onDownslam(api, scene, player) {
    const d = player.demolition;
    if (!d || d.flight || d.crowbar.state !== 'planted' || !d.pry) return;
    if (!tryNotch(api, scene, player, d.pry, d.parts.crowbar)) return;
    d.flight = launchPlatform(api, scene, player, d.pry);
    d.pry = null;
    recallCrowbar(scene, player, d);
}

function updatePry(api, scene, player, d) {
    if (notchesFaded(scene, d.pry)) {
        clearNotches(d.pry);
        d.parts.crowbar.y = d.crowbar.y;
    }
    if (d.flight && updateFlight(api, scene, player, d.flight)) d.flight = null;
}

function resetDemolition(scene, player, d) {
    setLooping(d.snap, false);
    scene.tweens.killTweensOf(d.parts.crowbar);
    if (d.tape.phase === 'zip') player.body.allowGravity = true;
    d.tape = { ...d.tape, phase: 'idle', length: 0, readyAt: 0 };
    d.slam = null;
    d.busyUntil = 0;
    d.lockMoveUntil = 0;
    strapOn(d);
}

function applyMovement(scene, player, d) {
    const now = scene.time.now;
    let speed = d.anchored ? ANCHORED.speedScale : 1;
    if (now < d.busyUntil) speed *= BUSY_SPEED_SCALE;
    player.moveSpeedScale = speed;
    player.jumpScale = d.anchored ? ANCHORED.jumpScale : 1;

    const locked = d.tape.phase === 'zip' || now < d.lockMoveUntil;
    if (locked) {
        player.isUsingSideSpecial = true;
        d.ownsSideSpecial = true;
    } else if (d.ownsSideSpecial) {
        player.isUsingSideSpecial = false;
        d.ownsSideSpecial = false;
    }
}

function update(api, scene, player) {
    const d = stateOf(scene, player);
    if (player.lastDir.x) d.facing = player.lastDir.x;

    if (player.respawnFalling && !d.respawnSeen) resetDemolition(scene, player, d);
    d.respawnSeen = player.respawnFalling;

    updateSlam(api, scene, player, d);
    switch (d.tape.phase) {
        case 'punch': updatePunch(api, scene, player, d); break;
        case 'retract': updateRetract(scene, d); break;
        case 'tilt': updateTilt(api, scene, player, d); break;
        case 'zip': updateZip(scene, player, d); break;
    }
    if (d.tape.phase === 'idle') setLooping(d.snap, false);
    updateCrowbar(scene, player, d);
    updatePry(api, scene, player, d);
    applyMovement(scene, player, d);
    drawSlam(scene, player, d);
    drawTape(scene, player, d);
}

function onMatchEnd(scene, player) {
    const d = player.demolition;
    if (!d) return;
    resetDemolition(scene, player, d);
    abandonFlight(d.flight);
    d.flight = null;
    for (const part of Object.values(d.parts)) part.setVisible(false);
    player.attachedWeapons = [];
}

export const TAPE_REACH = PUNCH.length + TAPE.armLength;

export function slamLandsWithin(player, now, ms) {
    const slam = player.demolition?.slam;
    return Boolean(slam && !slam.landed && slam.start + SLAM.impactMs - now <= ms);
}

export function superPryState(player) {
    const d = player.demolition;
    if (!d) return null;
    return {
        ready: d.anchored && d.crowbar.state === 'back' && !d.slam && !d.flight,
        planted: d.crowbar.state === 'planted',
        wedgeX: d.pry?.wedge.x ?? null,
        flying: Boolean(d.flight)
    };
}

export function isTapeBusy(player) {
    const phase = player.demolition?.tape.phase;
    return phase === 'punch' || phase === 'zip';
}

export default {
    handleAttack,
    handleDirSpecial,
    neutral,
    onDownslam,
    update,
    onMatchEnd,
    upTilt: (api, scene, player) => tilt(api, scene, player, 'up'),
    downTilt: (api, scene, player) => tilt(api, scene, player, 'down'),
    sideTilt: (api, scene, player) => tilt(api, scene, player, 'side')
};
