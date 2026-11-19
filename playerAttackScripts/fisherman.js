// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';

function basicAttack(api, scene, attacker, victim) {
    if (attacker.variant === 'TRAPPER') return harpoonAttack(api, scene, attacker, victim);
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatkthird');
}

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    const trapperSheet = harpoonsLeft(attacker) > 0 ? 'harpoonatk' : 'harpoonlessatk';
    api.tiltAttack(scene, attacker, victim, {
        animKey: attacker.variant === 'TRAPPER' ? trapperSheet : 'rodatk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};



const FISH_THROW = {
    types: 3,
    durationMs: 450,
    frameSize: 300,
    releaseFrame: 12,
    windupSpeed: 1.5,
    hands: [
        [138, 157], [139, 155], [140, 150], [146, 142], [136, 138], [132, 130],
        [120, 133], [112, 132], [105, 136], [102, 137], [110, 131], [128, 129],
        [138, 141], [140, 152], [138, 156], [138, 156], [138, 156], [138, 156]
    ],
    shoulders: [
        [82, 153], [82, 154], [84, 158], [86, 163], [89, 170], [92, 177],
        [95, 183], [97, 189], [99, 193], [100, 194], [98, 190], [93, 180],
        [88, 167], [83, 157], [82, 153], [82, 153], [82, 153], [82, 153]
    ],
    tail: { x: 4 / 30, y: 27 / 30 },
    axis: Phaser.Math.DegToRad(47.5),
    launch: { x: 470, y: -300 },
    gravity: 1500,
    maxTravel: 200,
    hitPad: 12,
    landFadeMs: 300,
    fling: { x: 320, y: -480, spin: Math.PI * 10 },
    reflectSpeedScale: 1.3,
    outSides: { left: -200, right: 2200, top: -300 },
    outBottom: 1400
};
const FISH_HIT = {
    ranged: true,
    damage: 0.06,
    plankDamage: 0,
    hitstun: 380,
    hitstunGrowth: false,
    hitFreeze: 60,
    sound: 'hammerhit',
    knockback: { x: 520, y: 380, growth: false, scaleWithDamage: false },
    noDeathRay: true,
    decelerateAfter: 650,
    resetCombo: false
};

const FISH_AMMO = {
    max: 5,
    regenMs: 3000,
    scale: 0.8,
    inset: 3,
    top: -16,
    gap: 8,
    outAngle: 180,
    fan: 15,
    tail: { x: 26 / 30, y: 4 / 30 }
};

function fishLeft(player) {
    return player.fish ?? FISH_AMMO.max;
}

function createFishRack(scene, player) {
    const behindPlayer = scene.objs.getIndex(player);
    player.fishRack = [];
    for (let i = 0; i < FISH_AMMO.max; i++) {
        const fish = scene.add.image(player.x, player.y, 'fish1').setScale(FISH_AMMO.scale);
        scene.objs.addAt(fish, behindPlayer);
        player.fishRack.push(fish);
    }
}

function updateFishRack(scene, player) {
    if (!player.fishRack) createFishRack(scene, player);
    const now = scene.time.now;
    if (player.nextFishAt && now >= player.nextFishAt) {
        player.fish = Math.min(FISH_AMMO.max, fishLeft(player) + 1);
        player.nextFishAt = player.fish < FISH_AMMO.max ? now + FISH_AMMO.regenMs : 0;
    }
    const count = fishLeft(player);
    const facing = player.fishFacing ?? 1;
    const flip = facing < 0;
    const middle = (FISH_AMMO.max - 1) / 2;
    const backX = player.x - facing * (player.displayWidth / 2 - FISH_AMMO.inset);
    player.fishRack.forEach((fish, i) => {
        fish.setVisible(i < count && player.visible);
        if (i >= count) return;
        const upcoming = count - 1 - i;
        fish.setTexture(`fish${((player.fishType ?? 0) + upcoming) % FISH_THROW.types + 1}`);
        const out = FISH_AMMO.outAngle + (middle - i) * FISH_AMMO.fan;
        const angle = flip ? 180 - out : out;
        fish.setFlipX(flip);
        fish.setOrigin(flip ? 1 - FISH_AMMO.tail.x : FISH_AMMO.tail.x, FISH_AMMO.tail.y);
        fish.setRotation(Phaser.Math.DegToRad(angle - (flip ? 45 : 135)));
        fish.setPosition(backX, player.y + FISH_AMMO.top + i * FISH_AMMO.gap);
    });
}

function nextFishTexture(player) {
    player.fishType = (player.fishType ?? 0) % FISH_THROW.types + 1;
    return `fish${player.fishType}`;
}

function handPose(atk, frame) {
    const index = Phaser.Math.Clamp(frame, 0, FISH_THROW.hands.length - 1);
    const [hx, hy] = FISH_THROW.hands[index];
    const [sx, sy] = FISH_THROW.shoulders[index];
    const half = FISH_THROW.frameSize / 2;
    const mirror = atk.flipX ? -1 : 1;
    const scale = Math.abs(atk.scaleX);
    const local = { x: (hx - half) * scale * mirror, y: (hy - half) * scale };
    const cos = Math.cos(atk.rotation);
    const sin = Math.sin(atk.rotation);
    const armAngle = Math.atan2(hy - sy, (hx - sx) * mirror);
    return {
        x: atk.x + local.x * cos - local.y * sin,
        y: atk.y + local.x * sin + local.y * cos,
        angle: armAngle + atk.rotation
    };
}

function poseFish(fish, pose, facing) {
    fish.setFlipX(facing < 0);
    fish.setOrigin(facing < 0 ? 1 - FISH_THROW.tail.x : FISH_THROW.tail.x, FISH_THROW.tail.y);
    fish.setPosition(pose.x, pose.y);
    fish.setRotation(pose.angle + facing * FISH_THROW.axis);
}

function fishThrow(api, scene, attacker) {
    const now = scene.time.now;
    if (attacker.hitstun || attacker.freeze || attacker.heldFish) return;
    if (now < (attacker.fishThrowReadyAt ?? 0) || fishLeft(attacker) <= 0) return;
    if (attacker.isAttacking && attacker.atk.anims.isPlaying && attacker.atk.texture.key !== 'fishslap') return;
    attacker.fishThrowReadyAt = now + FISH_THROW.durationMs;
    attacker.fish = fishLeft(attacker) - 1;
    attacker.nextFishAt ||= now + FISH_AMMO.regenMs;
    const facing = attacker.lastDir.x || attacker.fishFacing || 1;
    attacker.lastDir = { x: facing, y: 0 };
    const fish = scene.add.image(attacker.x, attacker.y, nextFishTexture(attacker));
    scene.objs.add(fish);
    attacker.heldFish = { sprite: fish, facing };
    api.setAttackSprite(attacker, 'fishslap');
    attacker.atk.anims.timeScale = FISH_THROW.windupSpeed;
    scene.sound.play('swosh');
}

function releaseFish(scene, player, pose) {
    const held = player.heldFish;
    player.heldFish = null;
    const sprite = held.sprite;
    player.thrownFish ??= [];
    player.thrownFish.push({
        sprite,
        facing: held.facing,
        startX: pose.x,
        vx: held.facing * FISH_THROW.launch.x,
        vy: FISH_THROW.launch.y,
        phase: 'flying'
    });
    scene.sound.play('whoosh', { volume: 0.6 });
}

function flingFish(fish) {
    fish.phase = 'flung';
    fish.vx = -fish.facing * FISH_THROW.fling.x;
    fish.vy = FISH_THROW.fling.y;
}

function landFish(scene, fish, top) {
    fish.phase = 'landed';
    fish.sprite.setY(top - 6);
    scene.tweens.add({
        targets: fish.sprite,
        alpha: 0,
        angle: fish.sprite.angle + fish.facing * 25,
        duration: FISH_THROW.landFadeMs,
        onComplete: () => fish.sprite.destroy()
    });
}

function reflectFish(fish, sender, deflector, scale) {
    const sprite = fish.sprite;
    const dx = sender.x - sprite.x;
    const dy = sender.y - sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = Math.max(Math.hypot(fish.vx, fish.vy), FISH_THROW.launch.x) * FISH_THROW.reflectSpeedScale;
    fish.phase = 'reflected';
    fish.owner = deflector;
    fish.damageScale = (fish.damageScale ?? 1) * scale;
    fish.vx = dx / distance * speed;
    fish.vy = dy / distance * speed;
    fish.facing = Math.sign(dx) || 1;
    sprite.setFlipX(fish.facing < 0);
}

function updateFishFlight(api, scene, player, fish, seconds) {
    const sprite = fish.sprite;
    const from = { x: sprite.x, y: sprite.y };
    const reflected = fish.phase === 'reflected';
    if (!reflected) fish.vy += FISH_THROW.gravity * seconds;
    let toX = from.x + fish.vx * seconds;
    const toY = from.y + fish.vy * seconds;
    if (fish.phase === 'flung') {
        sprite.setPosition(toX, toY);
        sprite.rotation += -fish.facing * FISH_THROW.fling.spin * seconds;
        if (toY > FISH_THROW.outBottom) {
            sprite.destroy();
            fish.phase = 'gone';
        }
        return;
    }
    const limit = fish.startX + fish.facing * FISH_THROW.maxTravel;
    if (!reflected && (toX - limit) * fish.facing >= 0) {
        toX = limit;
        fish.vx = 0;
    }
    sprite.setPosition(toX, toY);
    sprite.setRotation(Math.atan2(fish.vy, fish.vx || fish.facing * 1e-3) + fish.facing * FISH_THROW.axis);
    const path = new Phaser.Geom.Line(from.x, from.y, toX, toY);
    const owner = fish.owner ?? player;
    const damage = FISH_HIT.damage * (fish.damageScale ?? 1);
    for (const foe of api.getEnemies(scene, owner)) {
        const body = foe.body;
        if (!body?.enable || api.isInvincible(foe)) continue;
        const pad = FISH_THROW.hitPad;
        const reach = new Phaser.Geom.Rectangle(body.x - pad, body.y - pad, body.width + pad * 2, body.height + pad * 2);
        if (!Phaser.Geom.Intersects.LineToRectangle(path, reach)) continue;
        const scale = api.deflects(scene, foe, owner, damage);
        if (scale) {
            reflectFish(fish, owner, foe, scale);
            return;
        }
        foe.flash?.();
        api.landHit(scene, owner, foe, { ...FISH_HIT, damage, direction: { x: fish.facing, y: 0 } });
        flingFish(fish);
        return;
    }
    if (reflected) {
        const out = FISH_THROW.outSides;
        if (toX < out.left || toX > out.right || toY < out.top || toY > FISH_THROW.outBottom) {
            sprite.destroy();
            fish.phase = 'gone';
        }
        return;
    }
    if (fish.vy <= 0) return;
    for (const platform of api.getMapPlatforms(scene)) {
        const top = platform.body.top;
        if (toX < platform.body.left || toX > platform.body.right) continue;
        if (from.y <= top && toY >= top) {
            landFish(scene, fish, top);
            return;
        }
    }
    if (toY > FISH_THROW.outBottom) {
        sprite.destroy();
        fish.phase = 'gone';
    }
}

function updateAngler(api, scene, player) {
    if (player.variant !== 'ANGLER') return;
    if (player.lastDir.x) player.fishFacing = player.lastDir.x;
    const now = scene.time.now;
    if (player.respawnFalling) {
        player.fishThrowReadyAt = 0;
        player.heldFish?.sprite.destroy();
        player.heldFish = null;
    }
    const held = player.heldFish;
    if (held) {
        const atk = player.atk;
        const slapping = atk.texture.key === 'fishslap' && atk.visible;
        if (!slapping || player.hitstun) {
            held.sprite.destroy();
            player.heldFish = null;
        } else {
            const frame = Number(atk.frame.name) || 0;
            const pose = handPose(atk, frame);
            if (frame >= FISH_THROW.releaseFrame) releaseFish(scene, player, pose);
            else poseFish(held.sprite, pose, held.facing);
        }
    }
    if (!player.heldFish && player.atk.anims.timeScale !== 1) player.atk.anims.timeScale = 1;
    updateFishRack(scene, player);
    if (!player.thrownFish?.length) return;
    const delta = scene.hitFreezeUntil > now ? 0 : scene.game.loop.delta;
    for (const fish of player.thrownFish) {
        if (!fish.sprite.active) fish.phase = 'gone';
        if (fish.phase === 'flying' || fish.phase === 'flung' || fish.phase === 'reflected') updateFishFlight(api, scene, player, fish, delta / 1000);
    }
    player.thrownFish = player.thrownFish.filter(fish => fish.phase !== 'gone' && fish.sprite.active);
}

const HARPOON_REACH = 120;
// Harpoons are limited, so the armed swings hit harder than a normal jab/finisher.
const HARPOON_DAMAGE = 0.05;
const HARPOON_FINISHER_DAMAGE = 0.10;

const MAX_HARPOONS = 5;
const HARPOON_REGEN_MS = 3000;
const HARPOON_TIP = 27;
const STUCK_HARPOON_MS = 5000;
const STUCK_HARPOON_FADE_MS = 1000;
const MAX_STUCK_HARPOONS = 3;

const HARPOON_LEFT_AT = { harpoonatk: 8, harpoonatkthird: 28 };

const PIN_MS = 1000;
const PIN_SPIKE_SPEED = 1400;

const PIN_IMMUNITY_MS = 1500;
const PIN_SHIFT = 150;
const PIN_SHIFT_MS = 120;


const PIN_FLOOR_REACH = 40;

function isOnFloor(api, scene, player) {
    const body = player.body;
    if (body.blocked.down || body.touching.down) return true;
    return api.getMapPlatforms(scene).some(platform => {
        const gap = platform.body.top - body.bottom;
        return body.right > platform.body.left && body.left < platform.body.right &&
            gap >= -4 && gap <= PIN_FLOOR_REACH;
    });
}

function harpoonsLeft(player) {
    return player.harpoons ?? MAX_HARPOONS;
}

function useHarpoon(scene, player) {
    player.harpoons = harpoonsLeft(player) - 1;
    player.nextHarpoonAt ||= scene.time.now + HARPOON_REGEN_MS;
}

const EMPTY_HANDED_FINISHER = {
    hitstun: 250,
    sound: 'slatelight1',
    knockback: { x: 250, y: 250 },
    noDeathRay: true,
    decelerateAfter: 400
};

function harpoonAttack(api, scene, attacker, victim) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    const armed = harpoonsLeft(attacker) > 0;
    const sheet = armed ? 'harpoonatk' : 'harpoonlessatk';
    const range = armed ? HARPOON_REACH : api.STANDARD_HITS.jab.range;
    const damage = armed ? { damage: HARPOON_DAMAGE } : {};

    if (attacker.combo >= 2 && !armed) {
        api.thirdAttack(scene, attacker, victim, 'harpoonlessatkthird', { ...EMPTY_HANDED_FINISHER, range });
    } else if (attacker.combo >= 2) {
        const pinned = harpoonPin(api, scene, attacker, victim, 'harpoonatkthird', range);
        if (pinned !== null) {
            useHarpoon(scene, attacker);
            leaveHarpoonBehind(scene, attacker, 'harpoonatkthird', () =>
                stickHarpoon(api, scene, victim, pinnedHarpoonAngle(attacker), pinned));
        }
    } else {
        const hit = attacker.horizontalMovementActive
            ? api.pushAttack(scene, attacker, victim, sheet, { range, sound: 'axeslash2', ...damage })
            : api.attack(scene, attacker, victim, sheet, { range, ...damage });
        if (armed && hit) {
            useHarpoon(scene, attacker);
            leaveHarpoonBehind(scene, attacker, 'harpoonatk', () =>
                stickHarpoon(api, scene, victim, Math.atan2(victim.y - attacker.y, victim.x - attacker.x), false));
        }
    }
    attacker.nextAttackTime = scene.time.now + api.getAttackCooldown(attacker);
}

// Returns null on a miss, otherwise whether the foe got pinned.
function harpoonPin(api, scene, attacker, target, animKey, range) {
    const now = scene.time.now;
    const canPin = now >= (target.pinImmuneUntil ?? 0);
    const grounded = isOnFloor(api, scene, target);
    const hit = api.thirdAttack(scene, attacker, target, animKey, {
        range,
        damage: HARPOON_FINISHER_DAMAGE,
        hitstun: canPin ? PIN_MS : 300,
        hitstunGrowth: false,
        noDeathRay: true,
        // Never a launch: held to the floor on the ground, driven straight down in the air.
        knockback: () => ({ x: 0, y: canPin && !grounded ? PIN_SPIKE_SPEED : 0 }),
        onHit: () => {
            if (!canPin) return;
            target.pinImmuneUntil = now + PIN_MS + PIN_IMMUNITY_MS;
            if (grounded) target.freezeUntil = now + PIN_MS;
            shiftPinned(scene, attacker, target);
        }
    });
    return hit ? canPin : null;
}

function shiftPinned(scene, attacker, target) {
    const facing = attacker.atk.flipX ? -1 : 1;
    scene.tweens.add({
        targets: target,
        x: target.x + facing * PIN_SHIFT,
        duration: PIN_SHIFT_MS,
        ease: 'Cubic.easeOut'
    });
}

function pinnedHarpoonAngle(attacker) {
    const facing = attacker.atk.flipX ? -1 : 1;
    return Math.atan2(1, facing * 0.45);
}

function leaveHarpoonBehind(scene, attacker, animKey, onLeave) {
    const atk = attacker.atk;
    const sequence = attacker.attackSequence;
    let left = false;
    const swap = (anim, frame) => {
        if (attacker.attackSequence !== sequence || anim.key !== animKey) {
            atk.off('animationupdate', swap);
            return;
        }
        if (frame.textureFrame < HARPOON_LEFT_AT[animKey]) return;
        atk.setTexture('harpoonlessatk', frame.textureFrame);
        if (!left) {
            left = true;
            onLeave();
        }
    };
    atk.on('animationupdate', swap);
}

function stickHarpoon(api, scene, target, angle, pinned) {
    if (!target.active) return;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const tipY = pinned ? target.body.bottom + 4 : target.y + dirY * 10;
    const tipX = pinned ? target.x + (tipY - target.y) * (dirX / dirY) : target.x + dirX * 10;
    const offsetX = tipX - dirX * HARPOON_TIP - target.x;
    const offsetY = tipY - dirY * HARPOON_TIP - target.y;
    const harpoon = scene.add.image(target.x + offsetX, target.y + offsetY, 'harpoon')
        .setRotation(angle)
        .setFlipY(dirX < 0);
    scene.objs.add(harpoon);

    let removeFollow = () => {};
    const remove = () => {
        removeFollow();
        scene.tweens.killTweensOf(harpoon);
        harpoon.destroy();
    };
    removeFollow = api.addSceneUpdateListener(scene, () => {
        if (!target.active || target.outOfBounds) {
            remove();
            return;
        }
        harpoon.setPosition(target.x + offsetX, target.y + offsetY);
    });
    scene.tweens.add({
        targets: harpoon,
        alpha: 0,
        delay: STUCK_HARPOON_MS - STUCK_HARPOON_FADE_MS,
        duration: STUCK_HARPOON_FADE_MS,
        onComplete: remove
    });

    target.stuckHarpoons = (target.stuckHarpoons ?? []).filter(stuck => stuck.harpoon.active);
    target.stuckHarpoons.push({ harpoon, remove });
    if (target.stuckHarpoons.length > MAX_STUCK_HARPOONS) target.stuckHarpoons.shift().remove();
}

const HARPOON_THROW_COOLDOWN = 500;
const HARPOON_THROW_SPEED = 950;
const HARPOON_THROW_SINK = 120;
const THROWN_HARPOON_MS = 2500;
// Thrown harpoons pierce walls they break, losing a bit of plank damage per wall.
const HARPOON_PLANK_DAMAGE = 0.13;
const HARPOON_PIERCE_FALLOFF = 0.02;
const THROWN_HARPOON_HIT = {
    ranged: true,
    damage: 0.06,
    plankDamage: 0,
    hitstun: 450,
    hitstunGrowth: false,
    hitFreeze: 60,
    sound: 'anyhit',
    knockback: { x: 650, y: 450, growth: false, scaleWithDamage: false },
    noDeathRay: true,
    decelerateAfter: 800,
    resetCombo: false
};

function throwHarpoon(api, scene, attacker, target) {
    const now = scene.time.now;
    if (attacker.hitstun || attacker.freeze) return;
    if (now < (attacker.nextHarpoonThrowTime ?? 0) || harpoonsLeft(attacker) <= 0) return;
    attacker.nextHarpoonThrowTime = now + HARPOON_THROW_COOLDOWN;
    useHarpoon(scene, attacker);

    const direction = { ...attacker.lastDir };
    api.setAttackSprite(attacker, 'harpoonlessatk');
    scene.sound.play('swosh');

    const harpoon = scene.physics.add.sprite(
        attacker.x + direction.x * 30,
        attacker.y - 8 + direction.y * 30,
        'harpoon'
    );
    harpoon.body.allowGravity = false;
    harpoon.setVelocity(direction.x * HARPOON_THROW_SPEED, direction.y * HARPOON_THROW_SPEED);
    harpoon.setAccelerationY(HARPOON_THROW_SINK);
    harpoon.setRotation(Math.atan2(direction.y, direction.x));
    scene.objs.add(harpoon);
    api.trackDeflectable(scene, harpoon, attacker);

    const platforms = api.platformsWithoutStandingPlatform(scene, attacker);
    let owner = attacker;
    let foe = target;
    let damageScale = 1;
    let plankDamage = HARPOON_PLANK_DAMAGE;
    const pierced = new Set();
    let lastTip = {
        x: harpoon.x + Math.cos(harpoon.rotation) * HARPOON_TIP,
        y: harpoon.y + Math.sin(harpoon.rotation) * HARPOON_TIP
    };
    let done = false;
    let removeUpdate = () => {};
    const fadeOut = (delay = 0) => {
        if (done) return;
        done = true;
        removeUpdate();
        expireEvent.remove(false);
        harpoon.body.enable = false;
        scene.tweens.add({
            targets: harpoon,
            alpha: 0,
            delay,
            duration: 400,
            onComplete: () => harpoon.destroy()
        });
    };
    const expireEvent = scene.time.delayedCall(THROWN_HARPOON_MS, () => fadeOut());

    removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (done || !harpoon.active) return;
        const { x: vx, y: vy } = harpoon.body.velocity;
        harpoon.setRotation(Math.atan2(vy, vx));
        harpoon.setFlipY(vx < 0);
        const tipX = harpoon.x + Math.cos(harpoon.rotation) * HARPOON_TIP;
        const tipY = harpoon.y + Math.sin(harpoon.rotation) * HARPOON_TIP;

        // Walls are thinner than a frame of travel, so sweep the tip's whole path.
        const path = new Phaser.Geom.Line(lastTip.x, lastTip.y, tipX, tipY);
        lastTip = { x: tipX, y: tipY };
        const walls = scene.planks?.getChildren().filter(plank =>
            plank.active && plank.body?.enable && plank.owner !== owner && !pierced.has(plank) &&
            Phaser.Geom.Intersects.LineToRectangle(path, plank.body)) ?? [];
        for (const wall of walls) {
            pierced.add(wall);
            api.damagePlank(scene, wall, plankDamage);
            if (wall.active) {
                // Not enough to break it: the harpoon sticks with its tip in the wall's face.
                const { x, y, width, height } = wall.body;
                const face = new Phaser.Geom.Rectangle(x, y, width, height);
                const entry = Phaser.Geom.Intersects.GetLineToRectangle(path, face)
                    .sort((a, b) => Phaser.Math.Distance.Between(path.x1, path.y1, a.x, a.y) -
                        Phaser.Math.Distance.Between(path.x1, path.y1, b.x, b.y))[0];
                if (entry) {
                    harpoon.x += entry.x - tipX;
                    harpoon.y += entry.y - tipY;
                }
                harpoon.setVelocity(0, 0);
                harpoon.setAcceleration(0, 0);
                fadeOut(600);
                return;
            }
            plankDamage = Math.max(0, +(plankDamage - HARPOON_PIERCE_FALLOFF).toFixed(2));
        }

        const body = foe.body;
        if (foe.active && body && !api.isInvincible(foe) &&
            tipX > body.left - 6 && tipX < body.right + 6 &&
            tipY > body.top - 6 && tipY < body.bottom + 6) {
            const deflectScale = api.deflects(scene, foe, owner, THROWN_HARPOON_HIT.damage * damageScale);
            if (deflectScale) {
                damageScale *= deflectScale;
                harpoon.setVelocity(-vx, -vy);
                direction.x = -direction.x;
                direction.y = -direction.y;
                [owner, foe] = [foe, owner];
                harpoon.deflectOwner = owner;
                lastTip = { x: harpoon.x, y: harpoon.y };
                return;
            }
            foe.flash();
            api.landHit(scene, owner, foe, { ...THROWN_HARPOON_HIT, damage: THROWN_HARPOON_HIT.damage * damageScale, direction });
            harpoon.destroy();
            done = true;
            removeUpdate();
            expireEvent.remove(false);
            return;
        }

        const stuckIn = platforms.find(platform => platform.active &&
            tipX > platform.body.left && tipX < platform.body.right &&
            tipY > platform.body.top && tipY < platform.body.bottom);
        if (stuckIn) {
            harpoon.setVelocity(0, 0);
            fadeOut(600);
        }
    });
}

const NET_RELEASE_MS = 100;
const NET_LAUNCH = { x: 420, y: -250 };
const NET_STUN = 2000;
const NET_HUNT_SPEED = 1.8;
const NET_BUMP = {
    ranged: true,
    damage: 0.02,
    plankDamage: 0,
    hitstun: 350,
    hitstunGrowth: false,
    sound: 'anyhit',
    knockback: { x: 700, y: 500, lift: -0.7, growth: false, scaleWithDamage: false },
    resetCombo: false,
    noDeathRay: true,
    unblockable: true
};
const NET_AIR_MS = 3000;
const NET_GROUND_MS = 6000;
const NET_GROUND_ORIGIN_Y = 31 / 50;
const NET_GROUND_HALF_WIDTH = 128;
const NET_AIR_BODY = { width: 180, height: 30, offsetX: 10, offsetY: 20 };

function netFoe(api, scene, owner, target, duration, holdInPlace) {
    const now = scene.time.now;
    api.landHit(scene, owner, target, {
        ranged: true,
        damage: 0.02,
        plankDamage: 0,
        hitstun: duration,
        hitstunGrowth: false,
        sound: 'grab',
        resetCombo: false,
        noDeathRay: true,
        unblockable: true,
        knockback: () => ({ x: 0, y: Math.max(0, target.body.velocity.y) }),
        onHit: () => {
            target.nettedUntil = now + duration;
            target.nettedBy = owner;
            target.netImmuneUntil = now + duration + api.NET_IMMUNITY_MS;
            if (holdInPlace) target.freezeUntil = now + duration;
        }
    });
}

function canBeNetted(scene, api, target) {
    return !api.isInvincible(target) && !target.hitstun &&
        scene.time.now >= (target.netImmuneUntil ?? 0);
}

function throwNet(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.activeNetCleanup?.();

        const facing = direction === 'left' ? -1 : 1;
        player.lastDir = { x: facing, y: 0 };
        api.setAttackSprite(player, 'netthrow');
        scene.sound.play('whoosh');

        // Starts bundled up in his hands, spread out the way he's throwing.
        const heldOffsetX = 40 + NET_GROUND_HALF_WIDTH;
        const net = scene.physics.add.sprite(player.x + facing * heldOffsetX, player.y - 25, 'netonground');
        net.body.enable = false;
        net.setFlipX(facing < 0);
        scene.objs.add(net);

        let state = 'held';
        let floorY = 0;
        let expireEvent = null;
        let removeUpdate = () => {};
        const colliders = [];
        const removeColliders = () => {
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
        };
        const removeNet = () => {
            if (state === 'gone') return;
            state = 'gone';
            removeUpdate();
            removeColliders();
            expireEvent?.remove(false);
            scene.events.off('shutdown', removeNet);
            scene.tweens.killTweensOf(net);
            net.destroy();
            if (player.activeNetCleanup === removeNet) player.activeNetCleanup = null;
        };
        const fadeOut = () => {
            if (state === 'gone' || state === 'fading') return;
            state = 'fading';
            removeColliders();
            net.body.enable = false;
            scene.tweens.add({ targets: net, alpha: 0, duration: 400, onComplete: removeNet });
        };
        player.activeNetCleanup = removeNet;
        scene.events.once('shutdown', removeNet);

        let crashed = false;
        let support = null;
        const landsFromAbove = (other) =>
            net.body.velocity.y >= 0 && net.body.prev.y + net.body.height <= other.body.top + 8;
        const hitsSide = (other) => {
            const { prev, width } = net.body;
            return prev.x + width <= other.body.left + 4 || prev.x >= other.body.right - 4;
        };
        const touchSurface = (_net, other) => {
            if (landsFromAbove(other)) support = other;
            else crashed = true;
        };
        const solidFromAboveOrSide = (_net, other) => landsFromAbove(other) || hitsSide(other);

        const fly = (velocityX, velocityY) => {
            state = 'air';
            support = null;
            crashed = velocityX === 0;
            net.setTexture('netinair');
            net.body.enable = true;
            net.body.setSize(NET_AIR_BODY.width, NET_AIR_BODY.height).setOffset(NET_AIR_BODY.offsetX, NET_AIR_BODY.offsetY);
            net.setVelocity(velocityX, velocityY);
            colliders.push(
                scene.physics.add.collider(net, api.getMapPlatforms(scene), touchSurface, solidFromAboveOrSide),
                ...[scene.planks, scene.gameState.map.lodgedBalls].filter(Boolean)
                    .map(walls => scene.physics.add.collider(net, walls, touchSurface)),
                ...api.overlapEnemies(scene, net, player, target => {
                    if (state !== 'air' || api.isInvincible(target)) return;
                    if (canBeNetted(scene, api, target)) netFoe(api, scene, player, target, NET_STUN, false);
                    else api.landHit(scene, player, target, { ...NET_BUMP, direction: { x: facing, y: 0 } });
                    removeNet();
                })
            );
        };
        const nearestWallAhead = () => {
            const { top, bottom, left, right } = net.body;
            const solids = [
                ...api.getMapPlatforms(scene),
                ...[scene.planks, scene.gameState.map.lodgedBalls].filter(Boolean).flatMap(group => group.getChildren())
            ];
            let nearest = null;
            for (const solid of solids) {
                const body = solid.body;
                if (!solid.active || !body?.enable) continue;
                if (body.top >= bottom || body.bottom <= top) continue;
                const near = facing > 0 ? body.left : body.right;
                const ahead = facing > 0 ? near >= player.x && near < right : near <= player.x && near > left;
                if (ahead && (nearest === null || Math.abs(near - player.x) < Math.abs(nearest - player.x))) nearest = near;
            }
            return nearest;
        };
        const release = () => {
            if (state !== 'held') return;
            fly(facing * NET_LAUNCH.x, NET_LAUNCH.y);
            net.body.reset(net.x, net.y);
            const wall = nearestWallAhead();
            if (wall === null) {
                net.setVelocity(facing * NET_LAUNCH.x, NET_LAUNCH.y);
            } else {
                net.x += wall - (facing > 0 ? net.body.right : net.body.left);
                net.body.reset(net.x, net.y);
                crashed = true;
            }
            expireEvent = scene.time.delayedCall(NET_AIR_MS, fadeOut);
        };
        const fallAgain = () => {
            removeColliders();
            net.setOrigin(0.5, 0.5);
            net.setPosition(net.x, floorY - NET_AIR_BODY.offsetY - NET_AIR_BODY.height + net.height / 2);
            fly(0, 0);
            expireEvent?.remove(false);
            expireEvent = scene.time.delayedCall(NET_AIR_MS, fadeOut);
        };
        const layOnGround = () => {
            state = 'ground';
            removeColliders();
            floorY = net.body.bottom;
            net.body.enable = false;
            net.setVelocity(0, 0);
            net.setTexture('netonground');
            net.setOrigin(0.5, NET_GROUND_ORIGIN_Y);
            net.setPosition(net.x, floorY);
            expireEvent?.remove(false);
            expireEvent = scene.time.delayedCall(NET_GROUND_MS, fadeOut);
        };

        api.afterWindup(scene, player, NET_RELEASE_MS, release, {
            interruptible: true,
            onInterrupt: removeNet
        });

        removeUpdate = api.addSceneUpdateListener(scene, () => {
            if (!net.active) return;
            if (state === 'held') {
                net.setPosition(player.x + facing * heldOffsetX, player.y - 25);
            } else if (state === 'air' && (net.body.blocked.down || net.body.touching.down)) {
                layOnGround();
            } else if (state === 'air' && (crashed || net.body.blocked.left || net.body.blocked.right ||
                net.body.touching.left || net.body.touching.right)) {
                crashed = true;
                net.setVelocityX(0);
            } else if (state === 'ground' && support && !(support.active && support.body?.enable)) {
                fallAgain();
            } else if (state === 'ground' && target.active && canBeNetted(scene, api, target)) {
                const body = target.body;
                const steppedIn = body.right > net.x - NET_GROUND_HALF_WIDTH &&
                    body.left < net.x + NET_GROUND_HALF_WIDTH &&
                    body.bottom > floorY - 12 && body.bottom < floorY + 8;
                if (steppedIn) {
                    netFoe(api, scene, player, target, NET_STUN, true);
                    removeNet();
                }
            }
        });

        api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    }

    player.lastTap[direction] = currentTime;
}

// Where the rod tip sits in each 300x300 frame (facing right). rodatk swings
// use their frame 0 tip; reelin's tip moves as the rod is pulled back.
const ROD_TIPS = {
    rodatk: [{ x: 174, y: 111 }],
    linelessrod: [{ x: 174, y: 111 }],
    reelin: [
        { x: 173, y: 111 }, { x: 172, y: 108 }, { x: 167, y: 100 }, { x: 158, y: 89 },
        { x: 145, y: 79 }, { x: 128, y: 71 }, { x: 109, y: 66 }, { x: 91, y: 64 },
        { x: 76, y: 66 }, { x: 66, y: 68 }, { x: 62, y: 69 }
    ]
};
const ROD_SWING_ANIMS = ['rodatk', 'rodatkthird'];
const SHEET_LINE_WIDTH = 3;
const REEL_SPEED = 1600;
const REEL_CRASH_IMMUNITY_MS = 200;
const PULL_SPEED = 900;

const SWING_MS = 500;
const SWING_SPEED = 900;
const SWING_PULL = 250;


function getRodTip(player) {
    const rod = player.atk;
    const tips = ROD_TIPS[rod?.texture.key];
    if (!rod?.visible || !tips) return { x: player.x, y: player.y };
    const rodTip = tips[rod.frame.name] ?? tips[0];
    const facing = rod.flipX ? -1 : 1;
    const localX = (rodTip.x - rod.width / 2) * rod.scaleX * facing;
    const localY = (rodTip.y - rod.height / 2) * rod.scaleY;
    const cos = Math.cos(rod.rotation);
    const sin = Math.sin(rod.rotation);
    return {
        x: rod.x + localX * cos - localY * sin,
        y: rod.y + localX * sin + localY * cos
    };
}
function tryPull(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.activeHookCleanup?.();

        player.isUsingSideSpecial = true;
        player.isAttacking = true;
        player.hasHitSideSpecial = false;

        // face direction
        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        // GRAPHICS FOR ROPE
        const rope = scene.add.graphics();

        // HOOK PROJECTILE
        const hook = scene.physics.add.sprite(
            player.x + player.lastDir.x * 60,
            player.y,
            'hook' // make a small hook sprite
        );
        hook.body.setMass(0);

        hook.setScale(0.8);
        hook.body.allowGravity = true;
        hook.body.gravity.y = 700;
        scene.objs.add(hook);
        scene.objs.add(rope);

        // initial launch speed
        hook.setVelocity(
            player.lastDir.x * 1000,
            -250
        );

        scene.sound.play('reel');
        scene.sound.play('whoosh');

        let cleanedUp = false;
        let reelingIn = false;
        let pullingToPlatform = false;
        let swingUntil = 0;
        // How far above the hook the pull aims, so he ends up standing on the surface.
        let pullLift = 0;
        let latchedTarget = null;
        const castTime = scene.time.now;
        let removeRopeUpdate = () => {};
        let timeoutEvent = null;
        const colliders = [];
        // Removes the hook and rope at once (new cast, respawn, scene end).
        const removeHook = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            removeRopeUpdate();
            timeoutEvent?.remove(false);
            colliders.forEach(collider => collider.destroy());
            scene.events.off('shutdown', removeHook);
            scene.physics.world.off('worldbounds', cleanupAtWorldBounds);
            hook.destroy();
            rope.destroy();
            if (player.activeHookCleanup === removeHook) {
                player.activeHookCleanup = null;
                player.idleWeaponTexture = null;
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
        };
        // Ends the cast: the player is free again while the hook reels back to the rod tip.
        const cleanup = () => {
            if (cleanedUp || reelingIn) return;
            reelingIn = true;
            pullingToPlatform = false;
            latchedTarget = null;
            timeoutEvent?.remove(false);
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
            scene.physics.world.off('worldbounds', cleanupAtWorldBounds);
            if (hook.body) {
                hook.setVelocity(0, 0);
                hook.body.enable = false;
            }
            if (player.activeHookCleanup === removeHook) {
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
            timeoutEvent = scene.time.delayedCall(1500, removeHook);
            startReelAnim();
        };
        // Latching or reeling back switches the held rod from linelessrod to reelin.
        // A swing in progress is left to finish so its isAttacking release still fires.
        let reelAnimStarted = false;
        const startReelAnim = () => {
            if (reelAnimStarted) return;
            reelAnimStarted = true;
            player.idleWeaponTexture = 'reelin';
            const rod = player.atk;
            if (!ROD_SWING_ANIMS.includes(rod.anims.currentAnim?.key) || !rod.anims.isPlaying) {
                rod.play('reelin');
            }
        };
        const reelHookIn = tip => {
            const dx = tip.x - hook.x;
            const dy = tip.y - hook.y;
            const distance = Math.hypot(dx, dy);
            const step = REEL_SPEED * scene.game.loop.delta / 1000;
            if (distance <= step) {
                removeHook();
                return false;
            }
            hook.setPosition(hook.x + (dx / distance) * step, hook.y + (dy / distance) * step);
            return true;
        };
        player.activeHookCleanup = removeHook;
        player.idleWeaponTexture = 'linelessrod';
        scene.events.once('shutdown', removeHook);
        hook.setCollideWorldBounds(true);
        hook.body.onWorldBounds = true;
        const cleanupAtWorldBounds = body => {
            if (body === hook.body) cleanup();
        };
        scene.physics.world.on('worldbounds', cleanupAtWorldBounds);

        const latchToPlatform = (_hook, platform) => {
            if (cleanedUp || pullingToPlatform) return;
            pullingToPlatform = true;
            hook.setVelocity(0, 0);
            hook.body.enable = false;

            if (platform?.body && hook.y > platform.body.top) {
                hook.y = platform.body.top;
                pullLift = player.body.height / 2 + 10;
            }
            if (player.y > hook.y) swingUntil = scene.time.now + SWING_MS;
            startReelAnim();
        };
        const latchToTarget = (hitTarget = target) => {
            latchedTarget = hitTarget;
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
            timeoutEvent?.remove(false);
            hook.setVelocity(0, 0);
            hook.body.enable = false;
            hook.setPosition(hitTarget.x, hitTarget.y);
            if (player.activeHookCleanup === removeHook) {
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
            timeoutEvent = scene.time.delayedCall(750, cleanup);
            startReelAnim();
        };
        const pullPlayerToHook = () => {
            if (cleanedUp || !pullingToPlatform) return;
            if (!player.active) {
                cleanup();
                return;
            }
            const dx = hook.x - player.x;
            const dy = hook.y - pullLift - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 50) {
                cleanup();
                return;
            }
            const towardX = dx / distance;
            const towardY = dy / distance;
            player.crashImmuneUntil = scene.time.now + REEL_CRASH_IMMUNITY_MS;
            // Stops swinging early once he has come up level with the hook.
            if (scene.time.now < swingUntil && player.y > hook.y) {
                // Of the two directions perpendicular to the rope, take the one going up.
                // Straight below the hook both are level, so swing the way he is facing.
                let swingX = -towardY;
                let swingY = towardX;
                if (swingY > 0 || (swingY === 0 && swingX * player.lastDir.x < 0)) {
                    swingX = -swingX;
                    swingY = -swingY;
                }
                player.setVelocity(
                    swingX * SWING_SPEED + towardX * SWING_PULL,
                    swingY * SWING_SPEED + towardY * SWING_PULL
                );
                return;
            }
            player.setVelocity(towardX * PULL_SPEED, towardY * PULL_SPEED);
        };

        colliders.push(
            ...api.overlapEnemies(scene, hook, player, target => {
                if (cleanedUp || player.hasHitSideSpecial || pullingToPlatform || api.isInvincible(target)) return;
                player.hasHitSideSpecial = true;

                const dx = player.x - target.x;
                const dy = player.y - target.y;
                const dist = Math.hypot(dx, dy) || 1;
                const pullStrength = 900;

                api.landHit(scene, player, target, {
                    ranged: true,
                    damage: 0.22,
                    plankDamage: 0,
                    hitstun: 550,
                    hitstunGrowth: false,
                    sound: 'anyhit',
                    knockback: () => ({ x: (dx / dist) * pullStrength, y: (dy / dist) * pullStrength }),
                    noDeathRay: true,
                    decelerateAfter: 550,
                    resetCombo: false,
                    onHit: () => {
                        target.crashImmuneUntil = scene.time.now + 550 + REEL_CRASH_IMMUNITY_MS;
                    }
                });
                latchToTarget(target);
            }),

            scene.physics.add.overlap(
                hook,
                api.platformsWithoutStandingPlatform(scene, player),
                latchToPlatform
            ),
            scene.physics.add.overlap(hook, scene.planks, () => latchToPlatform())
        );

        removeRopeUpdate = api.addSceneUpdateListener(scene, () => {
            if (cleanedUp || !hook.active || !rope.active) return;
            if (!player.active) {
                removeHook();
                return;
            }
            // Between swings the rod is held without its drawn line, since the rope is the line.
            const rod = player.atk;
            if (!rod.anims.isPlaying && rod.texture.key === 'rodatk') rod.setTexture(player.idleWeaponTexture, 0);
            if (pullingToPlatform) pullPlayerToHook();
            if (latchedTarget) {
                if (!latchedTarget.active) {
                    cleanup();
                    return;
                }
                hook.setPosition(latchedTarget.x, latchedTarget.y);
            }

            const tip = getRodTip(player);
            if (reelingIn && !reelHookIn(tip)) return;
            rope.clear();
            rope.lineStyle(SHEET_LINE_WIDTH * rod.scaleX, 0x000000);
            rope.beginPath();
            rope.moveTo(tip.x, tip.y);
            const midX = (tip.x + hook.x) / 2;
            const midY = (tip.y + hook.y) / 2;
            const ropeLength = Math.hypot(hook.x - tip.x, hook.y - tip.y);
            const straightenTime = 400;
            const bendLeft = Math.max(0, 1 - (scene.time.now - castTime) / straightenTime);
            const ropeBend = Math.min(60, ropeLength * 0.2) * bendLeft;
            const ctrlX = midX;
            const ctrlY = midY - ropeBend * 2;
            const segments = 12;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const u = 1 - t;
                rope.lineTo(
                    u * u * tip.x + 2 * u * t * ctrlX + t * t * hook.x,
                    u * u * tip.y + 2 * u * t * ctrlY + t * t * hook.y
                );
            }
            rope.strokePath();

            if (hook.body?.enable) {
                hook.body.velocity.x *= 0.985;
                hook.body.velocity.y *= 0.992;
            }
        });
        timeoutEvent = scene.time.delayedCall(3000, cleanup);

        api.startSideSpecialCooldown(player, currentTime, pullCD);
    }

    player.lastTap[direction] = currentTime;
}

const BACK_HARPOON_SPACING = 8;
const BACK_HARPOON_LIFT = 20;

function createHarpoonRack(scene, player) {
    const behindPlayer = scene.objs.getIndex(player);
    player.harpoonRack = [];
    for (let i = 0; i < MAX_HARPOONS - 1; i++) {
        const harpoon = scene.add.image(player.x, player.y, 'harpoon');
        scene.objs.addAt(harpoon, behindPlayer);
        player.harpoonRack.push(harpoon);
    }
}

function updateTrapper(api, scene, player, victim) {
    if (player.variant !== 'TRAPPER') return;
    if (!player.harpoonRack) createHarpoonRack(scene, player);

    const now = scene.time.now;
    if (victim?.nettedBy === player && now < (victim.nettedUntil ?? 0)) {
        player.movementSpeed = player.baseMovementSpeed * player.playerSpeedScaling * NET_HUNT_SPEED;
    }
    if (player.nextHarpoonAt && now >= player.nextHarpoonAt) {
        player.harpoons = Math.min(MAX_HARPOONS, harpoonsLeft(player) + 1);
        player.nextHarpoonAt = player.harpoons < MAX_HARPOONS ? now + HARPOON_REGEN_MS : 0;
    }
    const harpoons = harpoonsLeft(player);
    // With none left he holds out an empty hand.
    player.idleWeaponTexture = harpoons > 0 ? null : 'harpoonlessatk';

    if (player.lastDir.x !== 0) player.rackFacing = player.lastDir.x;
    const facing = player.rackFacing ?? 1;
    // Tips up, leaning back over the shoulder.
    const angle = Phaser.Math.DegToRad(-90 - facing * 25);
    player.harpoonRack.forEach((harpoon, i) => {
        harpoon.setVisible(i < harpoons - 1);
        harpoon.setRotation(angle);
        harpoon.setPosition(player.x - facing * (12 + i * BACK_HARPOON_SPACING), player.y - BACK_HARPOON_LIFT);
    });
}

export default {
    variantAttackSpriteScales: { ANGLER: 0.6 },
    variantDemoAnimations: {
        ANGLER: ['rodatk', 'rodatkthird'],
        TRAPPER: ['harpoonatk', 'harpoonatkthird', 'netthrow']
    },
    variantDemoIdle: { ANGLER: 'rodatk', TRAPPER: 'harpoonatk' },
    armColor: 0x0a0a0a,
    attackCooldown: 275,
    hitSounds: { finisher: 'rodthirdhitsfx' },
    variantStats: {
        TRAPPER: { hitSounds: { light: 'axeslash1', finisher: 'slash' }, armColor: 0x4b4d5a }
    },
    // The rod and harpoon sheets are drawn facing right with the arms on the left of each frame.
    rightFacingAttackSprites: ['fishslap', 'rodatk', 'linelessrod', 'reelin', 'harpoonatk', 'harpoonlessatk', 'netthrow'],
    textureAttackSpriteOffsets: {
        rodatk: { x: -13, y: 17 },
        fishslap: { x: -13, y: 17 },
        linelessrod: { x: -13, y: 17 },
        reelin: { x: -13, y: 17 },
        harpoonatk: { x: 0, y: 12 },
        harpoonlessatk: { x: 0, y: 12 },
        netthrow: { x: 0, y: 12 }
    },
    handleAttack: basicAttack,
    update: (api, scene, player, victim) => {
        updateTrapper(api, scene, player, victim);
        updateAngler(api, scene, player);
    },
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        attacker.variant === 'TRAPPER'
            ? throwNet(api, scene, attacker, victim, direction, currentTime)
            : tryPull(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { ANGLER: fishThrow, TRAPPER: throwHarpoon },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};