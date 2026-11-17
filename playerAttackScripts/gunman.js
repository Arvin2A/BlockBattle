// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const MINI_DAMAGE = 0.007;
const MINI_FALL_SPEED = 60;
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

function createBeam(api, scene, attacker, candidates, sprite = attacker.atk, shotDir) {
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
    const ray = { directionX, directionY, startX: rayOriginX, startY: rayOriginY };
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
        2,
        0xffff00
    ).setRotation(Math.atan2(directionY, directionX)).setDepth(8);
    scene.objs.add(beam);
    scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 120,
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

    if (distanceAlongBeam < 0 || distanceFromBeam > perpendicularExtent + 1) return null;
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
    const shotDir = options.isSpecial
        ? { x: victim?.active ? (victim.x >= attacker.x ? 1 : -1) : (attacker.lastDir.x || 1), y: 0 }
        : attacker.lastDir;
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
    if (hitCount > 0 && !deflected && !api.blocksHit(scene, victim, attacker, shotDamage * hitCount, { ranged: true, shieldCost })) {
        victim.flash();
        const damageScale = api.getAttackDamageScale(attacker);
        victim.KBmultiplier += shotDamage * damageScale * hitCount;
        const hitstunDuration = options.hitstunDuration ?? (isExplosion ? 300 : -1);
        victim.hitstunUntil = scene.time.now + hitstunDuration * victim.KBmultiplier;
        if (options.freezeDuration !== undefined) {
            victim.freezeUntil = scene.time.now + options.freezeDuration;
        }
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
function handleGunmanSpecial(api, scene, attacker, direction, currentTime, victim) {
    const dtapDelay = 250;
    const gunCD = attacker.dirSpecialCooldown;

    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;

    if (currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot) {
        if (!victim || !attacker.active || attacker.gunmanSpecialActive) return;

        attacker.isUsingSideSpecial = true;
        attacker.isAttacking = true;
        attacker.hasHitSideSpecial = false;

        attacker.isUsingSideSpecial = false;
        attacker.atk.setVisible(false);

        startSideSpecialCooldown(attacker, currentTime, gunCD);

        const specialSprite = scene.add.sprite(attacker.x, attacker.y + 20, 'gunmanspecial')
            .setVisible(false)
            .setDepth(attacker.atk.depth);
        scene.objs.add(specialSprite);
        attacker.gunmanSpecialActive = true;

        const fireBullet = () => {
            if (!attacker.active) return;

            if (attacker.lastDir.y === 0 && victim.active) {
                attacker.lastDir.x = victim.x >= attacker.x ? 1 : -1;
            }

            attacker.lastDir.y = 0;

            handleShot(api, scene, attacker, victim, {
                damageIncrement: MINI_DAMAGE,
                hitstunDuration: 100,
                freezeDuration: 50,
                attackerFallSpeed: MINI_FALL_SPEED,
                ignoreCooldown: true,
                ignoreCombo: true,
                sprite: specialSprite,
                animation: 'gunmanspecial',
                animationDelay: 35,
                isSpecial: true
            });
        };

        fireBullet();
        const firingEvent = scene.time.addEvent({ delay: 35, loop: true, callback: fireBullet });
        scene.time.delayedCall(1500, () => {
            firingEvent.remove(false);
            scene.sound.play('gunspecialend', {volume: 0.75})
            specialSprite.destroy();
            attacker.gunmanSpecialActive = false;
            attacker.isAttacking = false;
            attacker.idleWeaponTexture = 'gunmanspecial';
            if (!attacker.active) return;
            attacker.atk.stop().setTexture('gunmanspecial', 2).setVisible(true);
        });
    }
    attacker.lastTap[direction] = currentTime;
}

const SHOTGUN = {
    shells: 2,
    reloadMs: 1200,
    gapMs: 250,
    range: 200,
    minDot: 0.75,
    recoil: 260,
    sound: 'gunshot',
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
            ...SHOTGUN.hit,
            direction: aim,
            knockback: ({ kb, damageScale }) => ({
                x: aim.x * SHOTGUN.knockback * kb * damageScale,
                y: aim.y === 0 ? -SHOTGUN.lift * kb : aim.y * SHOTGUN.knockback * kb * damageScale
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
    handleDirSpecial: handleGunmanSpecial,
    handleNeutralSpecial: shotgun,
    variantNeutralSpecials: { CRAZER: shotgun },
    handleHorizantalTilt: handleShot,
    handleDownTilt: handleShot,
    handleUpTilt: handleShot
};
