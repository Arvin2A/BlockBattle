// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { sayLine } from '../combat/dialogue.js';

const MINI_DAMAGE = 0.007;
const MINI_FALL_SPEED = 60;
const MINI_CHIP_KNOCKBACK_X = 15;
const MINI_SUPPRESS_MS = 150;
const MINI_DURATION_MS = 1000;

const SHOT_SHIELD_COST = 0.05;
const EXPLOSION_SHIELD_COST = 0.4;

function playShotAnimation(
    scene,
    attacker,
    sprite = attacker.atk,
    delay = 0,
    animation = 'gunmanatk',
    hideAfter = 180
) {
    const verticalOffset = sprite === attacker.atk ? 0 : -5;
    sprite.setPosition(
        attacker.x + attacker.lastDir.x * 50,
        attacker.y + attacker.lastDir.y * 50 + verticalOffset
    );
    sprite.setFlipX(attacker.lastDir.x < 0);
    sprite.setAngle(attacker.lastDir.y < 0 ? -90 : attacker.lastDir.y > 0 ? 90 : 0);

    const play = () => {
        if (!attacker.active || !sprite.active) return;
        if (sprite === attacker.atk) {
            attacker.idleWeaponTexture = attacker.scene.anims.get(animation)?.frames[0]?.textureKey ?? animation;
            if (sprite.texture.key !== attacker.idleWeaponTexture) sprite.setTexture(attacker.idleWeaponTexture);
        }
        sprite.setFrame(0);
        sprite.setVisible(true);
        sprite.play(animation, true);
        if (hideAfter !== null && sprite !== attacker.atk) {
            scene.time.delayedCall(hideAfter, () => {
                if (attacker.active && !attacker.activeGrab) sprite.setVisible(false);
            });
        }
    };

    if (delay > 0) scene.time.delayedCall(delay, play);
    else play();
}

function createBeam(api, scene, attacker, candidates, sprite = attacker.atk, shotDir, look = {}) {
    const { thickness = 2, color = 0xffff00, fadeMs = 120 } = look;
    const aimLength = Math.hypot(shotDir.x, shotDir.y) || 1;
    const directionX = shotDir.x / aimLength;
    const directionY = shotDir.y / aimLength;
    const rayOriginX = attacker.x;
    const rayOriginY = attacker.y;
    const visualOffsetX = sprite.x - rayOriginX;
    const visualOffsetY = sprite.y - 10 - rayOriginY;
    const visualStartDistance = Math.max(
        0,
        visualOffsetX * directionX + visualOffsetY * directionY
    );
    const ray = { directionX, directionY, startX: rayOriginX, startY: rayOriginY, halfThickness: thickness / 2 };
    let contactDistance = null;
    let target = null;
    for (const candidate of candidates) {
        if (!candidate?.active || !candidate.body || api.isInvincible(candidate)) continue;
        const distance = getBeamContactDistance(candidate, ray);
        if (distance !== null && (contactDistance === null || distance < contactDistance)) {
            contactDistance = distance;
            target = candidate;
        }
    }
    const obstacleHit = getBeamObstacleDistance(scene, {
        directionX,
        directionY,
        startX: rayOriginX,
        startY: rayOriginY
    }, api.getProjectileBlockingPlatforms(scene, attacker));
    const obstacleDistance = obstacleHit?.distance ?? null;
    const impactDistance = Math.min(
        contactDistance ?? 10000,
        obstacleDistance ?? 10000
    );
    const beamLength = Math.max(0, impactDistance - visualStartDistance);
    const startX = rayOriginX + directionX * visualStartDistance;
    const startY = rayOriginY + directionY * visualStartDistance;
    const beam = scene.add.rectangle(
        startX + directionX * beamLength / 2,
        startY + directionY * beamLength / 2,
        beamLength,
        thickness,
        color
    ).setRotation(Math.atan2(directionY, directionX)).setDepth(8);
    scene.objs.add(beam);
    scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: fadeMs,
        onComplete: () => beam.destroy()
    });

    const hit = contactDistance !== null &&
        (obstacleDistance === null || contactDistance < obstacleDistance);
    return {
        hit,
        target: hit ? target : null,
        blockedPlank: obstacleHit?.obstacle?.health !== undefined &&
            (contactDistance === null || obstacleDistance <= contactDistance)
            ? obstacleHit.obstacle
            : null
    };
}

function getBeamObstacleDistance(scene, beam, blockingPlatforms) {
    const obstacles = [
        ...blockingPlatforms,
        ...scene.planks.getChildren()
    ];
    let nearestDistance = null;
    let nearestObstacle = null;

    for (const obstacle of obstacles) {
        if (!obstacle.active || !obstacle.body?.enable) continue;
        const distance = getRayRectangleDistance(
            beam.startX,
            beam.startY,
            beam.directionX,
            beam.directionY,
            obstacle.body
        );
        if (distance !== null &&
            (nearestDistance === null || distance < nearestDistance)) {
            nearestDistance = distance;
            nearestObstacle = obstacle;
        }
    }

    return nearestDistance === null
        ? null
        : { distance: nearestDistance, obstacle: nearestObstacle };
}

function getRayRectangleDistance(originX, originY, directionX, directionY, rectangle) {
    let minimumDistance = 0;
    let maximumDistance = Infinity;

    for (const [origin, direction, minimum, maximum] of [
        [originX, directionX, rectangle.left, rectangle.right],
        [originY, directionY, rectangle.top, rectangle.bottom]
    ]) {
        if (Math.abs(direction) < 1e-8) {
            if (origin < minimum || origin > maximum) return null;
            continue;
        }

        const firstIntersection = (minimum - origin) / direction;
        const secondIntersection = (maximum - origin) / direction;
        minimumDistance = Math.max(
            minimumDistance,
            Math.min(firstIntersection, secondIntersection)
        );
        maximumDistance = Math.min(
            maximumDistance,
            Math.max(firstIntersection, secondIntersection)
        );
        if (maximumDistance < minimumDistance) return null;
    }

    return maximumDistance < 0 ? null : minimumDistance;
}

function getBeamContactDistance(victim, beam) {
    const offsetX = victim.x - beam.startX;
    const offsetY = victim.y - beam.startY;
    const distanceAlongBeam = offsetX * beam.directionX + offsetY * beam.directionY;
    const distanceFromBeam = Math.abs(
        offsetX * beam.directionY - offsetY * beam.directionX
    );
    const victimHalfWidth = victim.body.width / 2;
    const victimHalfHeight = victim.body.height / 2;
    const perpendicularExtent =
        Math.abs(beam.directionY) * victimHalfWidth +
        Math.abs(beam.directionX) * victimHalfHeight;
    const extentAlongBeam =
        Math.abs(beam.directionX) * victimHalfWidth +
        Math.abs(beam.directionY) * victimHalfHeight;

    if (distanceAlongBeam < 0 || distanceFromBeam > perpendicularExtent + (beam.halfThickness ?? 0) + 1) return null;
    return Math.max(0, distanceAlongBeam - extentAlongBeam);
}


function reflectShot(api, scene, gunman, reflector, damage, isExplosion) {
    if (!gunman.active || api.isInvincible(gunman)) return;
    const back = { x: gunman.x - reflector.x, y: gunman.y - reflector.y };
    const muzzle = { x: reflector.x, y: reflector.y + 10 };
    if (!createBeam(api, scene, reflector, [gunman], muzzle, back).hit) return;
    const length = Math.hypot(back.x, back.y) || 1;
    const direction = { x: Math.sign(back.x) || 1, y: Math.abs(back.y / length) > 0.7 ? Math.sign(back.y) : 0 };
    gunman.flash();
    api.landHit(scene, reflector, gunman, {
        direction,
        ranged: true,
        damage,
        plankDamage: 0,
        hitstun: isExplosion ? 300 : 0,
        sound: isExplosion ? 'explosion' : null,
        knockback: isExplosion
            ? ({ kb, damageScale }) => ({ x: direction.x * 600 * kb * damageScale, y: direction.y === 0 ? -220 : direction.y * 600 * kb * damageScale })
            : null,
        decelerateAfter: isExplosion ? 800 : null,
        resetCombo: false,
        noDeathRay: true
    });
    if (isExplosion) api.spawnExplosion(scene, gunman);
}

function handleShot(api, scene, attacker, victim, options = {}) {
    if ((!options.ignoreCooldown &&
        (scene.time.now < attacker.nextAttackTime || !attacker.canAttack)) || attacker.hitstun) return;
    if (!options.isSpecial && attacker.gunmanSpecialActive) return;
    const shotDir = options.shotDir ?? (options.isSpecial
        ? { x: victim?.active ? (victim.x >= attacker.x ? 1 : -1) : (attacker.lastDir.x || 1), y: 0 }
        : attacker.lastDir);
    const isExplosion = options.damageIncrement === undefined && attacker.combo >= 4;
    if (options.isSpecial) {
        playShotAnimation(
            scene,
            attacker,
            options.sprite,
            options.animationDelay,
            options.animation,
            null
        );
    } else {
        playShotAnimation(scene, attacker);
    }
    if (!options.isSpecial && options.delayedSprite) {
        playShotAnimation(scene, attacker, options.delayedSprite, options.animationDelay);
    }
    const beams = [createBeam(
        api,
        scene,
        attacker,
        api.getEnemies(scene, attacker),
        options.sprite,
        shotDir
    )];
    victim = beams.find(beam => beam.target)?.target ?? null;
    beams.forEach(beam => {
        if (beam.blockedPlank && options.isSpecial) {
            api.damagePlank(scene, beam.blockedPlank, 0.005);
            
        } else if (beam.blockedPlank && !options.isSpecial) {
            api.damagePlank(scene, beam.blockedPlank);
        }
    });
    scene.sound.play('gunshot');
    if (isExplosion) scene.sound.play('reload');

    const hitCount = victim ? beams.filter(beam => beam.target === victim).length : 0;
    const shotDamage = options.damageIncrement ?? (isExplosion ? 0.10 : 0.02);
    const shieldCost = options.isSpecial ? null : (isExplosion ? EXPLOSION_SHIELD_COST : SHOT_SHIELD_COST) * hitCount;
    const deflected = hitCount > 0 && api.deflects(scene, victim, attacker, shotDamage * hitCount, { shieldCost });
    if (deflected) reflectShot(api, scene, attacker, victim, shotDamage * hitCount * deflected, isExplosion);
    if (hitCount > 0 && !deflected && !api.blocksHit(scene, victim, attacker, shotDamage * hitCount, { ranged: true, shieldCost, special: Boolean(options.isSpecial) })) {
        victim.flash();
        const damageScale = api.getAttackDamageScale(attacker);
        victim.KBmultiplier += shotDamage * damageScale * hitCount;
        const hitstunDuration = options.hitstunDuration ?? (isExplosion ? 300 : -1);
        victim.hitstunUntil = scene.time.now + hitstunDuration * victim.KBmultiplier;
        if (options.freezeDuration !== undefined) {
            victim.freezeUntil = scene.time.now + options.freezeDuration;
        }
        if (options.suppressMs !== undefined) {
            victim.suppressedUntil = Math.max(victim.suppressedUntil ?? 0, scene.time.now + options.suppressMs);
        }
        if (options.chipKnockbackX !== undefined) {
            const side = shotDir.x || Math.sign(victim.x - attacker.x) || 1;
            api.applyKnockback(scene, victim, side * options.chipKnockbackX, victim.body.velocity.y);
        } else {
            const knockback = (isExplosion ? 600 : 0) * victim.KBmultiplier * damageScale;
            const verticalKick = shotDir.y === 0
                ? (isExplosion ? -220 : 0)
                : shotDir.y * knockback;

            api.applyKnockback(
                scene,
                victim,
                shotDir.x * knockback,
                verticalKick
            );
        }
        if (options.attackerFallSpeed !== undefined) {
            attacker.setVelocityY(Math.min(attacker.body.velocity.y, options.attackerFallSpeed));
        }
        if (isExplosion) scene.sound.play('explosion');
        scene.time.delayedCall(isExplosion ? 800 : 0, () => {
            if (victim.active) victim.willDecelerate = true;
        });

        if (!options.ignoreCombo) {
            if (isExplosion) {
                api.spawnExplosion(scene, victim);
                attacker.combo = 0;
                attacker.comboTimer = 0;
            } else {
                attacker.combo += 1;
                attacker.comboTimer = 0;
            }
        }
    } else if (!options.ignoreCombo) {
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }

    if (!options.ignoreCooldown) {
        const cooldown = isExplosion ? 2550 : 100;
        attacker.canAttack = false;
        attacker.nextAttackTime = scene.time.now + cooldown;
        scene.time.delayedCall(cooldown, () => {
            attacker.canAttack = true;
        });
    }
}

function startSideSpecialCooldown(player, currentTime, duration) {
    player.hasUsedSideSpecial = true;
    player.sideSpecialCooldownDuration = duration;
    player.nextSideSpecialTime = currentTime + duration;
}
const RECOIL = {
    chargeMs: 800,
    shake: 3,
    holdFrame: 1,
    holdFallSpeed: 60,
    holdSlow: 0.85,
    muzzle: 50,
    beam: { thickness: 12, color: 0xfff27a, fadeMs: 220 },
    plankDamage: 0.3,
    damage: { side: 0.25, up: 0.4, down: 0.25 },
    knockbackScale: { side: 0.65, up: 1, down: 0.65 },
    hit: {
        ranged: true,
        special: true,
        plankDamage: 0,
        hitstun: 500,
        hitFreeze: 120,
        knockback: { x: 900, y: 900 },
        decelerateAfter: target => 500 * target.KBmultiplier,
        resetCombo: false
    },
    push: { speed: 1540, ms: 220, endSlowdown: 3 },
    ring: { from: 55, to: 10, lineWidth: 3, color: 0xfff27a, alpha: { from: 0.35, to: 0.95 } },
    shakeScreen: { intensity: 7, ms: 220 }
};

function recoilAim(kind, direction) {
    if (kind === 'up') return { x: 0, y: 1 };
    if (kind === 'down') return { x: 0, y: -1 };
    return { x: direction === 'left' ? 1 : -1, y: 0 };
}

function placeRecoilGun(gun, attacker, aim, facing, jitter) {
    const flip = aim.x < 0 || (aim.x === 0 && facing < 0);
    const angle = flip ? -Math.atan2(aim.y, -aim.x) : Math.atan2(aim.y, aim.x);
    gun.setFlipX(flip)
        .setRotation(angle)
        .setPosition(
            attacker.x + aim.x * RECOIL.muzzle + Phaser.Math.FloatBetween(-jitter, jitter),
            attacker.y + aim.y * RECOIL.muzzle + Phaser.Math.FloatBetween(-jitter, jitter)
        );
}

function handleGunmanSpecial(api, scene, attacker, direction, currentTime, victim) {
    const dtapDelay = 250;
    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;
    const doubleTap = currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot;
    attacker.lastTap[direction] = currentTime;
    if (!doubleTap || !attacker.active || attacker.gunmanSpecialActive) return;
    if (attacker.recoilJammed) {
        startMini(api, scene, attacker, direction, currentTime, victim);
        return;
    }
    startRecoilBlast(api, scene, attacker, direction, currentTime, victim);
}

function startMini(api, scene, attacker, direction, currentTime, victim) {
    if (!victim) return;
    attacker.isAttacking = true;
    attacker.atk.setVisible(false);
    startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
    const aimY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const facing = direction === 'left' ? -1 : direction === 'right' ? 1 : (attacker.lastDir.x || attacker.facingX || 1);
    const aim = aimY ? { x: 0, y: aimY } : { x: facing, y: 0 };

    const specialSprite = scene.add.sprite(attacker.x, attacker.y + 20, 'gunmanspecial')
        .setVisible(false)
        .setDepth(attacker.atk.depth);
    api.applySkin(specialSprite, attacker.skin);
    scene.objs.add(specialSprite);
    attacker.gunmanSpecialActive = true;

    const fireBullet = () => {
        if (!attacker.active) return;
        attacker.lastDir = { ...aim };
        handleShot(api, scene, attacker, victim, {
            damageIncrement: MINI_DAMAGE,
            chipKnockbackX: MINI_CHIP_KNOCKBACK_X,
            suppressMs: MINI_SUPPRESS_MS,
            attackerFallSpeed: MINI_FALL_SPEED,
            ignoreCooldown: true,
            ignoreCombo: true,
            sprite: specialSprite,
            animation: 'gunmanspecial',
            animationDelay: 35,
            isSpecial: true,
            shotDir: aim
        });
    };

    fireBullet();
    const firingEvent = scene.time.addEvent({ delay: 35, loop: true, callback: fireBullet });
    scene.time.delayedCall(MINI_DURATION_MS, () => {
        firingEvent.remove(false);
        scene.sound.play('gunspecialend', { volume: 0.75 });
        specialSprite.destroy();
        attacker.gunmanSpecialActive = false;
        attacker.isAttacking = false;
        if (aimY && attacker.lastDir.x === 0) attacker.lastDir = { x: facing, y: 0 };
        attacker.idleWeaponTexture = 'gunmanspecial';
        if (!attacker.active) return;
        attacker.atk.stop().setTexture('gunmanspecial', 2).setVisible(true);
    });
}

const RECOIL_JAM = {
    shots: 10,
    flashMs: 90,
    flashTint: 0xff2a2a,
    selfDamage: 0.1,
    selfLaunch: { x: 250, y: 420 },
    selfHitstunMs: 400,
    line: 'screw it',
    alarmRate: 1.7,
    swap: { shrinkMs: 220, growMs: 260, holdOffset: 40 },
    meterColor: 0xfff27a,
    jammedColor: 0xff8c3a
};

function recoilShotsLeft(attacker) {
    return attacker.recoilShotsLeft ?? RECOIL_JAM.shots;
}

function jamRecoilGun(api, scene, attacker, gun) {
    const now = scene.time.now;
    gun.clearTint();
    api.spawnExplosion(scene, { x: gun.x, y: gun.y }, 0.8);
    api.triggerScreenShake(scene, 8, 250);
    scene.sound.play('explosion');
    attacker.recoilJammed = true;
    attacker.flash();
    attacker.KBmultiplier += RECOIL_JAM.selfDamage;
    attacker.hitstunUntil = now + RECOIL_JAM.selfHitstunMs;
    const facing = attacker.lastDir.x || attacker.facingX || 1;
    api.applyKnockback(scene, attacker, -facing * RECOIL_JAM.selfLaunch.x, -RECOIL_JAM.selfLaunch.y, { noDeathRay: true });
    sayLine(scene, attacker, RECOIL_JAM.line);
}

function swapToMini(api, scene, attacker, pistol, direction, victim) {
    const facing = attacker.lastDir.x || attacker.facingX || 1;
    const hitAt = attacker.lastHitAt;
    const { shrinkMs, growMs, holdOffset } = RECOIL_JAM.swap;
    attacker.gunmanSpecialActive = true;
    attacker.isAttacking = true;
    pistol.clearTint().setRotation(0).setFlipX(facing < 0);
    let held = pistol;
    const follow = api.addSceneUpdateListener(scene, () => {
        if (!held?.active) return;
        attacker.atk.setVisible(false);
        held.setPosition(attacker.x + facing * holdOffset, attacker.y);
    });
    const finish = () => {
        follow();
        if (held?.active) held.destroy();
        attacker.gunmanSpecialActive = false;
        attacker.isAttacking = false;
        if (attacker.active && attacker.lastHitAt === hitAt) {
            const towardVictim = victim?.active && victim.x < attacker.x ? 'left' : 'right';
            const miniDirection = direction === 'up' || direction === 'down' ? direction : towardVictim;
            startMini(api, scene, attacker, miniDirection, scene.time.now, victim);
        }
    };
    scene.tweens.add({
        targets: pistol,
        scale: 0,
        duration: shrinkMs,
        ease: 'Back.easeIn',
        onComplete: () => {
            pistol.destroy();
            const mini = scene.add.sprite(attacker.x + facing * holdOffset, attacker.y, 'gunmanspecial', 0)
                .setFlipX(facing < 0)
                .setScale(0)
                .setDepth(attacker.atk.depth);
            scene.objs.add(mini);
            held = mini;
            scene.tweens.add({ targets: mini, scale: 1, duration: growMs, ease: 'Back.easeOut', onComplete: finish });
        }
    });
}

function recoilMeter(scene, player) {
    const duration = Number.isFinite(player.sideSpecialCooldownDuration) ? player.sideSpecialCooldownDuration : 0;
    const remaining = Math.max(0, player.nextSideSpecialTime - scene.time.now);
    const progress = !player.hasUsedSideSpecial || duration <= 0 ? 1 : Phaser.Math.Clamp(1 - remaining / duration, 0, 1);
    const ready = progress >= 1;
    const status = ready ? 'READY' : `RECHARGING ${Math.ceil(remaining / 1000)}s`;
    if (player.recoilJammed) {
        return {
            progress,
            color: RECOIL_JAM.jammedColor,
            text: `${status}  MINI`,
            textColor: ready ? '#ffffff' : '#bbbbbb'
        };
    }
    const left = recoilShotsLeft(player);
    return {
        progress,
        color: RECOIL_JAM.meterColor,
        text: `${status}  SHOTS ${left}`,
        textColor: left <= 2 ? '#ff6a6a' : ready ? '#ffffff' : '#bbbbbb'
    };
}

function startRecoilBlast(api, scene, attacker, direction, currentTime, victim) {
    const kind = direction === 'up' || direction === 'down' ? direction : 'side';
    const facing = kind === 'side' ? (direction === 'left' ? -1 : 1) : (attacker.lastDir.x || attacker.facingX || 1);
    const aim = recoilAim(kind, direction);
    startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
    attacker.gunmanSpecialActive = true;
    attacker.isAttacking = true;
    attacker.lastDir = { x: facing, y: 0 };
    attacker.atk.setVisible(false);

    const gun = scene.add.sprite(attacker.x, attacker.y, 'gunmanatk', RECOIL.holdFrame).setDepth(attacker.atk.depth);
    scene.objs.add(gun);
    const ring = scene.add.circle(attacker.x, attacker.y, RECOIL.ring.from)
        .setStrokeStyle(RECOIL.ring.lineWidth, RECOIL.ring.color, RECOIL.ring.alpha.from)
        .setDepth(attacker.depth + 1);
    scene.objs.add(ring);
    const startedAt = scene.time.now;

    const jamming = recoilShotsLeft(attacker) <= 0;
    const alarm = jamming ? scene.sound.add('danger', { rate: RECOIL_JAM.alarmRate }) : null;
    alarm?.play();
    const stopAlarm = () => {
        alarm?.stop();
        alarm?.destroy();
    };
    const end = () => {
        removeCharge();
        stopAlarm();
        if (gun.active) gun.destroy();
        if (ring.active) ring.destroy();
        attacker.gunmanSpecialActive = false;
        attacker.isAttacking = false;
    };
    const removeCharge = api.addSceneUpdateListener(scene, () => {
        if (!attacker.active || attacker.hitstun) {
            end();
            return;
        }
        if (jamming) {
            const flashOn = Math.floor((scene.time.now - startedAt) / RECOIL_JAM.flashMs) % 2 === 0;
            if (flashOn) gun.setTint(RECOIL_JAM.flashTint);
            else gun.clearTint();
        }
        attacker.atk.setVisible(false);
        attacker.setVelocity(attacker.body.velocity.x * RECOIL.holdSlow, Math.min(attacker.body.velocity.y, RECOIL.holdFallSpeed));
        placeRecoilGun(gun, attacker, aim, facing, RECOIL.shake);
        const t = Math.min(1, (scene.time.now - startedAt) / RECOIL.chargeMs);
        ring.setPosition(attacker.x, attacker.y)
            .setRadius(RECOIL.ring.from + (RECOIL.ring.to - RECOIL.ring.from) * t)
            .setStrokeStyle(RECOIL.ring.lineWidth, RECOIL.ring.color,
                RECOIL.ring.alpha.from + (RECOIL.ring.alpha.to - RECOIL.ring.alpha.from) * t);
        if (t < 1) return;
        placeRecoilGun(gun, attacker, aim, facing, 0);
        if (jamming) {
            removeCharge();
            stopAlarm();
            ring.destroy();
            jamRecoilGun(api, scene, attacker, gun);
            swapToMini(api, scene, attacker, gun, direction, victim);
            return;
        }
        attacker.recoilShotsLeft = recoilShotsLeft(attacker) - 1;
        fireRecoilBlast(api, scene, attacker, gun, aim, kind);
        end();
        recoilPush(api, scene, attacker, { x: -aim.x, y: -aim.y });
    });
}

function fireRecoilBlast(api, scene, attacker, gun, aim, kind) {
    scene.sound.play('recoilShot');
    api.triggerScreenShake(scene, RECOIL.shakeScreen.intensity, RECOIL.shakeScreen.ms);
    const beam = createBeam(api, scene, attacker, api.getEnemies(scene, attacker), gun, aim, RECOIL.beam);
    if (beam.blockedPlank) api.damagePlank(scene, beam.blockedPlank, RECOIL.plankDamage);
    if (!beam.target) return;
    const deflectScale = api.deflects(scene, beam.target, attacker, RECOIL.damage[kind]);
    if (deflectScale) {
        deflectRecoilBlast(api, scene, beam.target, kind, deflectScale);
        return;
    }
    landRecoilBlast(api, scene, attacker, beam.target, kind, aim, 1);
}

function landRecoilBlast(api, scene, shooter, target, kind, aim, scale) {
    const knockbackScale = RECOIL.knockbackScale[kind] * scale;
    target.flash();
    api.landHit(scene, shooter, target, {
        ...RECOIL.hit,
        damage: RECOIL.damage[kind] * scale,
        knockback: { x: RECOIL.hit.knockback.x * knockbackScale, y: RECOIL.hit.knockback.y * knockbackScale },
        direction: aim
    });
}

function deflectRecoilBlast(api, scene, reflector, kind, scale) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const aim = { x: Math.cos(angle), y: Math.sin(angle) };
    const muzzle = { x: reflector.x, y: reflector.y + 10 };
    scene.sound.play('recoilShot');
    const beam = createBeam(api, scene, reflector, api.getEnemies(scene, reflector), muzzle, aim, RECOIL.beam);
    if (beam.blockedPlank) api.damagePlank(scene, beam.blockedPlank, RECOIL.plankDamage);
    if (beam.target) landRecoilBlast(api, scene, reflector, beam.target, kind, aim, scale);
}

function recoilPush(api, scene, attacker, dir) {
    if (!attacker.active || attacker.hitstun) return;
    attacker.isUsingSideSpecial = true;
    attacker.hasHitSideSpecial = true;
    attacker.afterimage = true;
    attacker.body.setAllowGravity(false);
    attacker.setVelocity(dir.x * RECOIL.push.speed, dir.y * RECOIL.push.speed);
    api.startDashTrail(attacker, RECOIL.push.ms);
    scene.time.delayedCall(RECOIL.push.ms, () => {
        attacker.body.setAllowGravity(true);
        attacker.isUsingSideSpecial = false;
        attacker.afterimage = false;
        if (attacker.active && !attacker.hitstun) {
            attacker.setVelocity(attacker.body.velocity.x / RECOIL.push.endSlowdown, attacker.body.velocity.y / RECOIL.push.endSlowdown);
        }
    });
}

const SHOTGUN = {
    shells: 2,
    reloadMs: 1200,
    gapMs: 250,
    range: 200,
    minDot: 0.75,
    recoil: 260,
    sound: 'shotgun',
    reloadSound: 'reload',
    hit: {
        damage: 0.08,
        hitstun: 500,
        hitstunGrowth: false,
        decelerateAfter: 300,
        resetCombo: false,
        noDeathRay: true
    },
    knockback: 750,
    lift: 300
};

function shotgun(api, scene, attacker) {
    if (attacker.hitstun || attacker.freeze || attacker.gunmanSpecialActive) return;
    const now = scene.time.now;
    if (now < (attacker.nextShotgunTime ?? 0)) return;
    if ((attacker.shotgunShells ?? SHOTGUN.shells) <= 0 && now < attacker.shotgunReloadAt) return;
    if ((attacker.shotgunShells ?? 0) <= 0) attacker.shotgunShells = SHOTGUN.shells;

    const aim = attacker.lastDir.x || attacker.lastDir.y ? attacker.lastDir : { x: 1, y: 0 };
    playShotAnimation(scene, attacker, attacker.atk, 0, 'shotgunfire');
    scene.sound.play(SHOTGUN.sound);
    for (const enemy of api.getEnemies(scene, attacker)) {
        if (api.isInvincible(enemy)) continue;
        const inCone = api.attackIsElligible(attacker, enemy, SHOTGUN.range, {
            ignoreCanAttack: true,
            silent: true,
            direction: aim,
            minDot: SHOTGUN.minDot
        });
        if (!inCone) continue;
        api.landHit(scene, attacker, enemy, {
            special: true,
            ...SHOTGUN.hit,
            direction: aim,
            knockback: ({ kb, damageScale }) => ({
                x: aim.x * SHOTGUN.knockback * kb * damageScale,
                y: aim.y === 0 ? api.capHorizontalLaunchY(-SHOTGUN.lift * kb) : aim.y * SHOTGUN.knockback * kb * damageScale
            })
        });
    }
    attacker.setVelocity(
        attacker.body.velocity.x - aim.x * SHOTGUN.recoil,
        aim.y > 0 ? Math.min(attacker.body.velocity.y, -aim.y * SHOTGUN.recoil) : attacker.body.velocity.y
    );
    attacker.shotgunShells -= 1;
    attacker.nextShotgunTime = now + SHOTGUN.gapMs;
    if (attacker.shotgunShells <= 0) {
        attacker.shotgunReloadAt = now + SHOTGUN.reloadMs;
        scene.time.delayedCall(SHOTGUN.reloadMs, () => {
            if (attacker.active) scene.sound.play(SHOTGUN.reloadSound);
        });
    }
}

export default {
    demoAnimations: ['gunmanatk', 'gunmanspecial'],
    demoIdle: 'gunmanatk',
    demoAnchor: { x: 50, y: 0, facesRight: true },
    armColor: 0x383838,
    rightFacingAttackSprites: ['gunmanatk', 'gunmanspecial', 'shotgunfire'],
    textureAttackSpriteOffsets: {
        gunmanspecial: { x: 5, y: 10 },
        shotgunfire: { x: 26, y: 10 }
    },
    handleAttack: handleShot,
    specialMeter: recoilMeter,
    upSpecialVariants: ['CRAZER'],
    downSpecialVariants: ['CRAZER'],
    handleDirSpecial: handleGunmanSpecial,
    handleNeutralSpecial: shotgun,
    variantNeutralSpecials: { CRAZER: shotgun },
    handleHorizantalTilt: handleShot,
    handleDownTilt: handleShot,
    handleUpTilt: handleShot
};
