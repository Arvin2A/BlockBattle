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
        sprite.setFrame(0);
        sprite.setVisible(true);
        sprite.play(animation, true);
        if (hideAfter !== null) {
            scene.time.delayedCall(hideAfter, () => {
                if (attacker.active && !attacker.activeGrab) sprite.setVisible(false);
            });
        }
    };

    if (delay > 0) scene.time.delayedCall(delay, play);
    else play();
}

function createBeam(api, scene, attacker, victim, sprite = attacker.atk) {
    const aimLength = Math.hypot(attacker.lastDir.x, attacker.lastDir.y) || 1;
    const directionX = attacker.lastDir.x / aimLength;
    const directionY = attacker.lastDir.y / aimLength;
    const rayOriginX = attacker.x;
    const rayOriginY = attacker.y;
    const visualOffsetX = sprite.x - rayOriginX;
    const visualOffsetY = sprite.y - 10 - rayOriginY;
    const visualStartDistance = Math.max(
        0,
        visualOffsetX * directionX + visualOffsetY * directionY
    );
    const contactDistance = getBeamContactDistance(victim, {
        directionX,
        directionY,
        startX: rayOriginX,
        startY: rayOriginY
    });
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

    return {
        hit: contactDistance !== null &&
            (obstacleDistance === null || contactDistance < obstacleDistance),
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


function handleShot(api, scene, attacker, victim, options = {}) {
    if ((!options.ignoreCooldown &&
        (scene.time.now < attacker.nextAttackTime || !attacker.canAttack)) || attacker.hitstun) return;
    if (!options.isSpecial && attacker.gunmanSpecialActive) return;
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
    const beams = [createBeam(api, scene, attacker, victim, options.sprite)];
    beams.forEach(beam => {
        if (beam.blockedPlank) api.damagePlank(scene, beam.blockedPlank);
    });
    scene.sound.play('gunshot');
    if (isExplosion) scene.sound.play('reload');

    const hitCount = scene.finisherActive
        ? 0
        : beams.filter(beam => beam.hit).length;
    if (hitCount > 0) {
        victim.flash();
        const damageScale = api.getAttackDamageScale(attacker);
        victim.KBmultiplier += (options.damageIncrement ?? (isExplosion ? 0.10 : 0.02)) * damageScale * hitCount;
        const hitstunDuration = options.hitstunDuration ?? (isExplosion ? 750 : -1);
        victim.hitstunUntil = scene.time.now + hitstunDuration * victim.KBmultiplier;
        if (options.freezeDuration !== undefined) {
            victim.freezeUntil = scene.time.now + options.freezeDuration;
        }
        victim.willDecelerate = false;
        const knockback = (isExplosion ? 600 : 0) * victim.KBmultiplier * damageScale;
        const verticalKick = attacker.lastDir.y === 0
            ? (isExplosion ? -220 : 0)
            : attacker.lastDir.y * knockback;
        api.applyKnockback(scene, victim, attacker.lastDir.x * knockback, verticalKick);
        if (isExplosion) scene.sound.play('explosion');
        scene.time.delayedCall(isExplosion ? 550 : 350, () => {
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
            if (attacker.active) attacker.canAttack = true;
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

        startSideSpecialCooldown(attacker, currentTime, gunCD);

        const specialSprite = scene.add.sprite(attacker.x, attacker.y + 20, 'gunmanspecial')
            .setVisible(false)
            .setDepth(attacker.atk.depth);
        scene.objs.add(specialSprite);
        attacker.gunmanSpecialActive = true;

        const fireBullet = () => {
            if (!attacker.active || !victim.active) return;
            handleShot(api, scene, attacker, victim, {
                damageIncrement: 0.015,
                hitstunDuration: 100,
                freezeDuration: 50,
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
            if (!attacker.active) return;
            const reloadCooldown = 2000;
            attacker.canAttack = false;
            attacker.nextAttackTime = scene.time.now + reloadCooldown;
            scene.time.delayedCall(reloadCooldown, () => {
                if (attacker.active) attacker.canAttack = true;
            });
        });
    }
    attacker.lastTap[direction] = currentTime;
}

function chuck(api, scene, attacker, victim) {
    if (attacker.hitstun || attacker.freeze || scene.finisherActive ||
        attacker.activeGrenade) return;

    const direction = attacker.lastDir;
    const grenade = scene.physics.add.image(
        attacker.x + direction.x * 50,
        attacker.y + direction.y * 50 - 20,
        'grenade'
    );
    attacker.activeGrenade = grenade;
    grenade.setDepth(7);
    grenade.body.setAllowGravity(true);
    grenade.setCollideWorldBounds(true);
    grenade.body.onWorldBounds = true;
    grenade.setVelocity(direction.x * 500, direction.y);
    scene.objs.add(grenade);

    let detonated = false;
    const colliders = [];
    const removeColliders = () => {
        colliders.forEach(collider => collider.destroy());
        grenade.off('worldbounds', detonateAtWorldBounds);
        scene.events.off('update', detonateIfBelow);
    };
    const detonate = (hitVictim = false) => {
        if (detonated || !grenade.active) return;
        detonated = true;

        if (hitVictim && victim.active && !scene.finisherActive) {
            const damageScale = api.getAttackDamageScale(attacker);
            victim.KBmultiplier += 0.18 * damageScale;
            victim.willDecelerate = false;
            const knockback = 400 * victim.KBmultiplier * damageScale;
            const verticalKick = direction.y === 0
                ? -200 * victim.KBmultiplier
                : direction.y * knockback;
            api.applyKnockback(
                scene,
                victim,
                direction.x * knockback,
                verticalKick
            );
            scene.time.delayedCall(300, () => {
                if (victim.active) victim.willDecelerate = true;
            });
        }

        api.spawnExplosion(scene, grenade);
        scene.sound.play('explosion');
        if (attacker.activeGrenade === grenade) attacker.activeGrenade = null;
        removeColliders();
        grenade.destroy();
    };
    const detonateAtWorldBounds = () => detonate();
    const detonateIfBelow = () => {
        if (grenade.y > 1000) detonate();
    };

    colliders.push(
        scene.physics.add.collider(grenade, victim, () => detonate(true)),
        ...api.getProjectileBlockingPlatforms(scene, attacker).map(platform =>
            scene.physics.add.collider(grenade, platform, () => detonate())
        ),
        scene.physics.add.collider(grenade, scene.planks, (projectile, plank) => {
            if (plank.health > 0) api.damagePlank(scene, plank, plank.health);
            detonate();
        })
    );
    grenade.on('worldbounds', detonateAtWorldBounds);
    scene.events.on('update', detonateIfBelow);
}

export default {
    handleAttack: handleShot,
    handleDirSpecial: handleGunmanSpecial,
    handleNeutralSpecial: chuck,
    variantNeutralSpecials: { GRUNT: chuck },
    handleHorizantalTilt: handleShot,
    handleDownTilt: handleShot,
    handleUpTilt: handleShot
};
