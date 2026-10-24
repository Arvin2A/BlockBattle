const finalplungeMultiplier = 1.0;
import { LEFT } from 'phaser';
import { CHARACTER_ATTACK_SCRIPTS } from './playerAttackScripts/index.js';
import { damagePlank as damageAxemanPlank } from './playerAttackScripts/axeman.js';

// Shared damage scaling and grass effects.
function startSideSpecialCooldown(player, currentTime, duration) {
    player.hasUsedSideSpecial = true;
    player.sideSpecialCooldownDuration = duration;
    player.nextSideSpecialTime = currentTime + duration;
}

function addSceneUpdateListener(scene, listener) {
    const removeListener = () => {
        scene.events.off('update', listener);
        scene.events.off('shutdown', removeListener);
    };

    scene.events.on('update', listener);
    scene.events.once('shutdown', removeListener);
    return removeListener;
}

function damagePlanksInAttack(attacker, pardamage = 0.05) {
    const scene = attacker.scene;
    if (!scene?.planks || !attacker.atk?.active) return;
    var damage = pardamage
    console.log(pardamage);
    if (attacker.name === "AXEMAN") {
        damage = 0.15
    }
    if (attacker.name == "SWORDMAN" && attacker.variant == "DAGGER") {
        damage = 0.02
    }

    const attackSequence = attacker.attackSequence ?? 0;
    if (attacker.lastPlankDamageSequence === attackSequence) return;
    const attackBounds = attacker.atk.getBounds();
    const intersectingPlanks = scene.planks.getChildren().filter(plank =>
        plank.active && plank.body?.enable &&
        Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, plank.body)
    );
    if (intersectingPlanks.length === 0) return;

    attacker.lastPlankDamageSequence = attackSequence;
    intersectingPlanks.forEach(plank =>
        damageAxemanPlank(sharedAttackHelpers, scene, plank, damage)
    );
}

function getMapPlatforms(scene) {
    return [
        ...scene.gameState.map.platforms.getChildren(),
        ...scene.gameState.map.topPlatforms.getChildren()
    ].filter(platform => platform.active && platform.body?.enable);
}
function platformsWithoutStandingPlatform(scene, player) {
    const platforms = getMapPlatforms(scene);

    return platforms.filter(platform => platform !== player.currentPlatform);
}

function getGroundedPlatform(scene, attacker, platforms = getMapPlatforms(scene)) {
    const playerBody = attacker.body;

    if (!playerBody?.blocked.down && !playerBody?.touching.down) return null;

    return platforms
        .filter(platform =>
            playerBody.right > platform.body.left &&
            playerBody.left < platform.body.right &&
            Math.abs(playerBody.bottom - platform.body.top) <= 4
        )
        .sort((first, second) =>
            Math.abs(playerBody.bottom - first.body.top) -
            Math.abs(playerBody.bottom - second.body.top)
        )[0];
}

function getProjectileBlockingPlatforms(scene, attacker) {
    const platforms = getMapPlatforms(scene);
    const supportingPlatform = getGroundedPlatform(scene, attacker, platforms);

    if (!supportingPlatform) return platforms;
    return platforms.filter(platform =>
        platform.body.top >= supportingPlatform.body.top - 1
    );
}

function addProjectilePlatformColliders(scene, projectile, attacker) {
    const platforms = getMapPlatforms(scene);
    if (!getGroundedPlatform(scene, attacker, platforms)) return () => { };

    const colliders = getProjectileBlockingPlatforms(scene, attacker)
        .map(platform => scene.physics.add.collider(projectile, platform));

    return () => colliders.forEach(collider => collider.destroy());
}

function getAttackCooldown(attacker) {
    if (attacker.name === "FISHERMAN") return 275;
    if (attacker.name === "SWORDMAN" && attacker.variant === "DAGGER") return 100;
    return 400;
}

function getAttackDamageScale(attacker) {
    const baseDamageScale = Number.isFinite(attacker.baseDamageScale)
        ? attacker.baseDamageScale
        : 1;
    const externalDamageScale = Number.isFinite(attacker.externalDamageScale)
        ? attacker.externalDamageScale
        : 1;

    const grassDamageScale = attacker.inGrass && attacker.name !== 'SCYTHEMAN'
        ? 0.75
        : 1;
    const scytheGrassCutScale = attacker.name === 'SCYTHEMAN'
        ? 1 + (attacker.grassCutCount || 0) * 0.001
        : 1;

    return baseDamageScale * externalDamageScale * grassDamageScale * scytheGrassCutScale;
}

export function spawnDirtBurst(
    scene,
    x,
    y,
    particleCount = 8,
    minSize = 3,
    maxSize = 6,
    burstScale = 1,
    colors = [0x6b4423, 0x8b5a2b, 0xa66a35],
    minDuration = 180,
    maxDuration = 280,
    fallingCurve = false
) {
    //afraid to use phaser's current particle system. so ill use this manual one from chatgpt instead.

    for (let index = 0; index < particleCount; index += 1) {
        const startX = x + Phaser.Math.Between(-12, 12) * burstScale;
        const startY = y + Phaser.Math.Between(-4, 4) * burstScale;
        const pixel = scene.add.rectangle(
            startX,
            startY,
            Phaser.Math.Between(minSize, maxSize),
            Phaser.Math.Between(minSize, maxSize),
            Phaser.Utils.Array.GetRandom(colors)
        );
        pixel.setDepth(4);
        pixel.setAlpha(1);
        scene.objs.add(pixel);

        if (fallingCurve) {
            const controlX = startX + Phaser.Math.Between(-35, 35) * burstScale;
            const controlY = startY - Phaser.Math.Between(90, 130) * burstScale;
            const endX = startX + Phaser.Math.Between(-55, 55) * burstScale;
            const endY = startY + Phaser.Math.Between(10, 30) * burstScale;
            const motion = { progress: 0 };
            scene.tweens.add({
                targets: motion,
                progress: 1,
                duration: Phaser.Math.Between(minDuration, maxDuration),
                ease: 'Cubic.easeOut',
                onUpdate: () => {
                    const inverseProgress = 1 - motion.progress;
                    pixel.setPosition(
                        inverseProgress ** 2 * startX +
                        2 * inverseProgress * motion.progress * controlX +
                        motion.progress ** 2 * endX,
                        inverseProgress ** 2 * startY +
                        2 * inverseProgress * motion.progress * controlY +
                        motion.progress ** 2 * endY
                    );
                    pixel.setAlpha(inverseProgress);
                },
                onComplete: () => pixel.destroy()
            });
            continue;
        }

        const angle = Phaser.Math.FloatBetween(Math.PI * 1.1, Math.PI * 1.9);
        const distance = Phaser.Math.Between(18, 38) * burstScale;
        scene.tweens.add({
            targets: pixel,
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance - Phaser.Math.Between(8, 18) * burstScale,
            alpha: 0,
            duration: Phaser.Math.Between(minDuration, maxDuration),
            ease: 'Cubic.easeOut',
            onComplete: () => pixel.destroy()
        });
    }
}

function spawnCrater(scene, x, y, duration) {
    const tint = Phaser.Display.Color.HexStringToColor(
        scene.gameState.map.definition.tint
    ).color;
    const crater = scene.add.image(x, y, 'impactcrater');
    crater.setTint(tint);
    crater.setDepth(1.5);
    crater.setScale(1.5);
    scene.objs.add(crater);

    scene.tweens.add({
        targets: crater,
        alpha: 0,
        delay: duration,
        duration: 350,
        ease: 'Linear',
        onComplete: () => crater.destroy()
    });
}

// Fighters whose weapon stays on screen between attacks.
export function hasIdleAttackSprite(player) {
    return player.variant === 'SLEDGEHAMMER' ||
        player.variant === 'MALLET' ||
        player.variant === 'ANGLER' ||
        (player.name === 'SWORDMAN' && player.variant !== 'DAGGER');
}

function hideAttackSprite(attacker) {
    if (attacker.isAttacking) return;
    attacker.atk.stop();
    attacker.atk.setVisible(hasIdleAttackSprite(attacker));
}

function removeGrass(scene, grass, cutter) {
    if (!grass || !grass.active) return;
    const index = scene.scytheGrass.indexOf(grass);
    if (index !== -1) scene.scytheGrass.splice(index, 1);
    if (cutter && cutter.name === 'SCYTHEMAN') {
        cutter.grassCutCount += 1;
    }
    spawnDirtBurst(scene, grass.x, grass.y);
    grass.destroy();
    scene.sound.play('harvest');
}

function cutNearbyGrass(scene, x, y, range, cutter) {
    for (const grass of [...scene.scytheGrass]) {
        if (Phaser.Math.Distance.Between(x, y, grass.x, grass.y) <= range) {
            removeGrass(scene, grass, cutter);
        }
    }
}

function cutGrassBeforeMaturity(attacker) {
    const scene = attacker.scene;
    if (!scene || !scene.scytheGrass) return;

    for (const grass of [...scene.scytheGrass]) {
        if (grass.grassStage < 2 && Phaser.Math.Distance.Between(
            attacker.x,
            attacker.y + 20,
            grass.x,
            grass.y
        ) <= 90) {
            removeGrass(scene, grass, attacker);
        }
    }
}

// Scytheman grass tracking and shared hit checks.
export function updateScythemanGrass(scene, players) {
    if (!scene.scytheGrass) scene.scytheGrass = [];

    for (const key in players) {
        const player = players[key];
        player.inGrass = scene.scytheGrass.some(grass =>
            grass.active && grass.getBounds().contains(player.x, player.y + 20)
        );
        if (player.inGrass && player.name !== 'SCYTHEMAN' && !isInvincible(player) &&
            scene.time.now >= player.nextGrassDamageTime) {
            player.KBmultiplier += 0.025;
            player.nextGrassDamageTime = scene.time.now + 450;
            player.flash();
        }
    }

    for (const key in players) {
        const scytheman = players[key];
        if (scytheman.name !== 'SCYTHEMAN' || !scytheman.body.blocked.down) continue;

        const grassTooClose = scene.scytheGrass.some(grass =>
            grass.active && grass.owner === scytheman &&
            Phaser.Math.Distance.Between(
                scytheman.x,
                scytheman.y,
                grass.x,
                grass.y
            ) < 45
        );

        if (grassTooClose) continue;
        if (scytheman.grassTrailX !== null && Phaser.Math.Distance.Between(
            scytheman.x, scytheman.y, scytheman.grassTrailX, scytheman.grassTrailY
        ) < 45) continue;

        const grass = scene.add.sprite(scytheman.x, scytheman.y, 'upgrassGrow');
        grass.setDepth(3);
        grass.grassStage = 0;
        grass.owner = scytheman;
        grass.on('animationupdate', (animation, frame) => {
            grass.grassStage = frame.index;
        });
        grass.play('upgrassGrow');
        scene.objs.add(grass);
        scene.scytheGrass.push(grass);
        scytheman.grassTrailX = scytheman.x;
        scytheman.grassTrailY = scytheman.y;
    }
}

export function isInvincible(player) {
    return player.scene.time.now < (player.invincibleUntil ?? 0);
}

export function attackIsElligible(
    attacker,
    target,
    range = 100,
    onlyOnCanAttack = true,
    allowTargetBelow = false
) {
    if (onlyOnCanAttack && (!attacker.canAttack || attacker.hitstun)) return false;
    if (isInvincible(target)) return false;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return false;
    target.flash();
    const dot = (dx / distance) * attacker.lastDir.x + (dy / distance) * attacker.lastDir.y;
    const isFacingUp = attacker.lastDir.y < -0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    const isFacingDown = attacker.lastDir.y > 0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    const isTargetAbove = dy < (isFacingUp || isFacingDown ? -25 : -10) && Math.abs(dy) <= 135;
    const isTargetBelow = dy > 25;
    if ((!allowTargetBelow && isTargetBelow && isFacingUp) ||
        (isFacingDown && isTargetAbove)) return false;
    const eligible = (allowTargetBelow && isTargetBelow) ||
        dot > 0.7 || isFacingUp || isTargetAbove;
    if (eligible && !onlyOnCanAttack) attacker.attackBypassesHitstun = true;
    if (eligible) {
        cutGrassBeforeMaturity(attacker);
        //damagePlanksInAttack(attacker);
    }
    return eligible;
}

// Shared hit feedback, stun timing, and attack sprites.
function hitFreeze(scene, ms = 50) {
    const now = scene.time.now;
    scene.lastHitFreeze = { at: now, ms };
    // A 200%+ launch earlier this frame stretches this attack's freeze.
    const bonus = scene.ultraHitAt === now ? ULTRA_FREEZE_BONUS : 0;
    freezeUntil(scene, now + ms + bonus);
}

function freezeUntil(scene, until, ultra = false) {
    if (ultra) scene.hitFreezeUltra = true;
    if (until <= (scene.hitFreezeUntil ?? 0)) return;
    scene.hitFreezeUntil = until;
    scene.physics.world.pause();
    scene.anims.pauseAll();
    scene.tweens.pauseAll();
    scene.baseZoom = 2;
    scene.hitFreezeEnd?.remove(false);
    scene.hitFreezeEnd = scene.time.delayedCall(until - scene.time.now, () => {
        scene.hitFreezeUntil = 0;
        scene.hitFreezeEnd = null;
        scene.hitFocus = null;
        scene.physics.world.resume();
        scene.anims.resumeAll();
        scene.tweens.resumeAll();
        scene.baseZoom = 1;
        if (scene.hitFreezeUltra) {
            scene.sound.play('superexplosion');
            scene.deathRayAttackLockUntil = scene.time.now + DEATH_RAY_ATTACK_LOCK_MS;
        }
        scene.hitFreezeUltra = false;
    });
}

function missCombo(attacker) {
    if (attacker.name === 'SWORDMAN') {
        attacker.combo = (attacker.combo || 0) + 1;
        attacker.comboTimer = 600;
    } else {
        attacker.combo = 0;
    }
}

function clearQueuedStunTimers(scene, attacker, target) {
    if (attacker.revokeAggressorStun) {
        scene.time.removeEvent(attacker.revokeAggressorStun);
        attacker.revokeAggressorStun = null;
    }
    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
        target.revokeVictimStun = null;
    }
}

function queueStunRelease(scene, attacker, target, attackerDelay = 400, victimDelay = 650) {
    clearQueuedStunTimers(scene, attacker, target);
    const stunToken = (target.stunToken || 0) + 1;
    target.stunToken = stunToken;
    attacker.revokeAggressorStun = scene.time.delayedCall(attackerDelay, () => {
        attacker.canAttack = true;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.revokeAggressorStun = null;
    });
    target.revokeVictimStun = scene.time.delayedCall(victimDelay, () => {
        if (target.stunToken !== stunToken) return;
        target.hitstun = false;
        target.freeze = false;
        target.willDecelerate = true;
        target.revokeVictimStun = null;
    });
}

export function positionAttackSprite(attacker, animKey = '') {
    attacker.attackBypassesHitstun = false;
    attacker.atk.setVisible(true);
    const textureKey = attacker.scene.anims.get(animKey)?.frames[0]?.textureKey ?? animKey;
    const offset = getAttackSpriteOffset(attacker, textureKey);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50 + offset.x;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50 - 20 + offset.y;
    attacker.atk.setFlipX(animKey === 'scytheatktilt'
        ? attacker.lastDir.x < 0
        : getAttackSpriteFlipX(attacker, textureKey));
    if (attacker.lastDir.y < 0) attacker.atk.setAngle(90);
    else if (attacker.lastDir.y > 0) attacker.atk.setAngle(-90);
    else attacker.atk.setAngle(0);
}

export function setAttackSprite(attacker, animKey) {
    attacker.attackSequence = (attacker.attackSequence ?? 0) + 1;
    positionAttackSprite(attacker, animKey);
    attacker.atk.setFrame(0);
    attacker.isAttacking = true;
    attacker.lastAttackAnim = animKey;
    damagePlanksInAttack(attacker);
    attacker.atk.once(`animationcomplete-${animKey}`, () => {
        attacker.lastAttackEndTime = attacker.scene.time.now;
        attacker.isAttacking = false;
        attacker.attackBypassesHitstun = false;
        if (!attacker.activeGrab) {
            attacker.atk.setVisible(hasIdleAttackSprite(attacker));
        }
    });
    attacker.atk.play(animKey, true);
}

export function spawnExplosion(scene, victim, scale = 0.7) {
    const explosion = scene.add.sprite(victim.x, victim.y, 'explosion')
        .setDepth(8)
        .setScale(scale);
    scene.objs.add(explosion);
    explosion.play('explosion');
    explosion.once('animationcomplete-explosion', () => explosion.destroy());
}

export const HEAVY_KB_PERCENT = 100;
export const VIOLENT_KB_PERCENT = 150;
export const ULTRA_KB_PERCENT = 200;
const ULTRA_FREEZE_BONUS = 300;
// Attacks stay locked through the death ray freeze and this long after it.
const DEATH_RAY_ATTACK_LOCK_MS = 150;
const ULTRA_MIN_SPEED = 400;
const DEATH_RAY_COLOR = 0x9b30ff;


export function triggerScreenShake(scene, intensity, duration = 250) {
    const now = scene.time.now;
    const current = scene.shake;
    if (current && now < current.until && current.intensity > intensity) return;
    scene.shake = { start: now, until: now + duration, intensity };
}


export function spawnHitParticles(scene, target, vx = 0, vy = 0, heavy = false, violent = false, ultra = false) {
    if (scene.time.now - (target.lastHitParticlesAt ?? 0) < 80) return;
    target.lastHitParticlesAt = scene.time.now;

    let dirX = -vx;
    let dirY = -vy;
    if (Math.hypot(dirX, dirY) < 1) {
        const players = scene.gameState.players;
        const opponent = players.player === target ? players.player2 : players.player;
        dirX = opponent.x - target.x;
        dirY = opponent.y - target.y;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    // The sprite's position is current; the physics body only catches up next step.
    const center = { x: target.x, y: target.y };
    const reach = Math.min(
        Math.abs(dirX) > 0.001 ? target.body.halfWidth / Math.abs(dirX) : Infinity,
        Math.abs(dirY) > 0.001 ? target.body.halfHeight / Math.abs(dirY) : Infinity
    );
    const edgeX = center.x + dirX * reach;
    const edgeY = center.y + dirY * reach;
    const baseAngle = Math.atan2(dirY, dirX);

    const count = ultra ? 28 : violent ? 18 : 10;
    for (let index = 0; index < count; index += 1) {
        const size = Phaser.Math.Between(2, ultra ? 4 : 3);
        const color = ultra
            ? (index % 2 ? DEATH_RAY_COLOR : 0xd9b3ff)
            : violent && index % 2 ? 0xff2020 : 0xffffff;
        const pixel = scene.add.rectangle(edgeX, edgeY, size, size, color).setDepth(8);
        scene.objs.add(pixel);
        const angle = baseAngle + Phaser.Math.FloatBetween(-0.9, 0.9);
        const distance = Phaser.Math.Between(10, 24) * (ultra ? 3.4 : violent ? 2.4 : heavy ? 1.6 : 1);
        scene.tweens.add({
            targets: pixel,
            x: edgeX + Math.cos(angle) * distance,
            y: edgeY + Math.sin(angle) * distance,
            alpha: 0,
            duration: Phaser.Math.Between(160, 280),
            ease: 'Cubic.easeOut',
            onComplete: () => pixel.destroy()
        });
    }
}


function launchDeathRay(scene, target, vx, vy) {
    const now = scene.time.now;
    scene.ultraHitAt = now;
    scene.hitFocus = target;
    const last = scene.lastHitFreeze;
    const attackFreeze = last?.at === now ? last.ms : 0;
    freezeUntil(scene, now + attackFreeze + ULTRA_FREEZE_BONUS, true);

    const angle = Math.atan2(vy, vx);
    const length = 6000;
    const layers = [
        scene.add.rectangle(target.x, target.y, length, 300, DEATH_RAY_COLOR, 0.35),
        scene.add.rectangle(target.x, target.y, length, 190, DEATH_RAY_COLOR),
        scene.add.rectangle(target.x, target.y, length, 65, 0xffffff)
    ];
    const { player, player2 } = scene.gameState.players;
    const behindFighters = Math.min(scene.objs.getIndex(player), scene.objs.getIndex(player2));
    layers.forEach((layer, index) => {
        layer.setOrigin(0.5, 0.5).setRotation(angle).setScale(0.15, 1);
        scene.objs.addAt(layer, behindFighters + index);
    });
    const baseAlpha = layers.map(layer => layer.alpha);

    const GROW_MS = 120;
    const FADE_MS = 450;
    const removeUpdate = addSceneUpdateListener(scene, () => {
        const elapsed = scene.time.now - now;
        const holdUntil = Math.max(now + GROW_MS + 60, scene.hitFreezeUntil || 0);
        const fade = (scene.time.now - holdUntil) / FADE_MS;
        if (fade >= 1) {
            removeUpdate();
            layers.forEach(layer => layer.destroy());
            return;
        }
        const grow = Math.min(1, elapsed / GROW_MS);
        const scaleX = 0.15 + 0.85 * (1 - Math.pow(1 - grow, 3));
        const pulse = 1 + Math.sin(elapsed / 25) * 0.08;
        const shrink = fade > 0 ? 1 - fade * fade : 1;
        layers.forEach((layer, index) => {
            layer.setScale(scaleX, pulse * shrink);
            layer.setAlpha(baseAlpha[index] * shrink);
        });
    });
}

function isFighter(scene, target) {
    const players = scene.gameState?.players;
    return Boolean(players) && (players.player === target || players.player2 === target);
}

// Pass { noDeathRay: true } for hits that shouldn't ever fire the death ray,
// like pulls and explosions.
export function applyKnockback(scene, target, vx, vy, { noDeathRay = false } = {}) {
    const resistance = Number.isFinite(target.playerKBresistance) && target.playerKBresistance > 0
        ? target.playerKBresistance
        : 1;
    const resistantVx = vx / resistance;
    const resistantVy = vy / resistance;
    target.setVelocity(resistantVx, resistantVy);

    const speed = Math.hypot(resistantVx, resistantVy);
    if (isFighter(scene, target)) {
        const kbPercent = (target.KBmultiplier * 100) - 100;
        const heavy = kbPercent >= HEAVY_KB_PERCENT;
        const violent = kbPercent >= VIOLENT_KB_PERCENT;
        const ultra = !noDeathRay && kbPercent >= ULTRA_KB_PERCENT && speed >= ULTRA_MIN_SPEED;
        spawnHitParticles(scene, target, resistantVx, resistantVy, heavy, violent, ultra);
        if (heavy) {
            target.heavyLaunch = true;
            target.violentLaunch = violent;
            target.ultraLaunch = ultra;
            target.heavyLaunchAt = scene.time.now;
            target.afterimage = true;
            if (ultra) {
                triggerScreenShake(scene, 40, 900);
                launchDeathRay(scene, target, resistantVx, resistantVy);
            } else if (violent) {
                triggerScreenShake(scene, 26, 600);
            } else {
                triggerScreenShake(scene, Phaser.Math.Clamp(6 + (kbPercent - HEAVY_KB_PERCENT) / 16, 6, 12));
            }
        }
    }

    return speed;
}


export function attack(scene, attacker, target, animKey) {
    //the core attack function that is used as of now
    if (!attacker.canAttack || attacker.hitstun) return;

    setAttackSprite(attacker, animKey);

    let hit = false;


    if (attackIsElligible(attacker, target)) {
        hit = true;

        target.hitstunUntil = 650 + scene.time.now;;
        target.freezeUntil = 650 + scene.time.now;;
        attacker.freezeUntil = 400 + scene.time.now;;
        attacker.willDecelerate = false;
        attacker.comboTimer = 600;

        const dirX = attacker.lastDir.x;
        const dirY = attacker.lastDir.y;
        scene.time.delayedCall(50, () => {
            applyKnockback(scene, target, 100 * dirX, 100 * dirY);
        });

    }

    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
        applyKnockback(scene, target, 0, 0);
        attacker.setVelocityX(0);
        attacker.setVelocityY(0);
        // Attack sound
        if (attacker.name === "SWORDMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'swordslash1' : 'swordslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "AXEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SLATEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'slatelight1' : 'slatelight2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SCYTHEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "CROWBARMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'crowbarclang1' : 'crowbarclang2';
            scene.sound.play(soundID);
        } else {
            scene.sound.play('anyhit');
        }
        target.KBmultiplier += 0.03 * getAttackDamageScale(attacker); // Increase KB multiplier for third hit
        damagePlanksInAttack(attacker, 0.03 * getAttackDamageScale(attacker));


    } else {
        missCombo(attacker);
        scene.sound.play('miss');
    }

    if (attacker.combo >= 3) {
        attacker.combo = 0;
    }

    attacker.canAttack = false;

    scene.time.delayedCall(150, () => {
        hideAttackSprite(attacker);
    });
    queueStunRelease(scene, attacker, target, getAttackCooldown(attacker), 650);
    return hit;
}
// Shared attack types. Character-exclusive moves live in playerAttackScripts/.
export function pushAttack(scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    //No animKey = invisible hit that leaves whatever the atk sprite is doing alone
    if (animKey) {
        setAttackSprite(attacker, animKey);
    } else {
        attacker.attackSequence = (attacker.attackSequence ?? 0) + 1;
        damagePlanksInAttack(attacker);
    }
    let hit = false;
    if (attackIsElligible(attacker, target, 125)) {
        hit = true;

        target.hitstunUntil = 450 + scene.time.now;;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.05 * getAttackDamageScale(attacker);
        damagePlanksInAttack(attacker, 0.03 * getAttackDamageScale(attacker));
        hitFreeze(scene, 50);
        if (attacker.name === "HAMMERMAN") {
            scene.sound.play('hammerhit');
        } else if (attacker.name === "SWORDMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'swordslash1' : 'swordslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "AXEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SCYTHEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SLATEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'slatelight1' : 'slatelight2';
            scene.sound.play(soundID);
        } else if (attacker.name === "CROWBARMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'crowbarclang1' : 'crowbarclang2';
            scene.sound.play(soundID);
        } else {
            scene.sound.play('anyhit');
        }
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        const plungeMultiplier = target.plunged ? finalplungeMultiplier : 0;
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            applyKnockback(scene, target, (325 * target.KBmultiplier * (getAttackDamageScale(attacker) + plungeMultiplier)) * randDir, -200 * target.KBmultiplier);
        } else {
            applyKnockback(scene, target, (400 * target.KBmultiplier * (getAttackDamageScale(attacker) + plungeMultiplier)) * dirX, (500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        missCombo(attacker);
        scene.sound.play('miss');
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        hideAttackSprite(attacker);
    });
    // DAGGER's push keeps the full 400ms recovery; its fast cooldown is too strong here.
    const isDagger = attacker.name === "SWORDMAN" && attacker.variant === "DAGGER";
    scene.time.delayedCall(isDagger ? 400 : getAttackCooldown(attacker), () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(450 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(600, () => {
        target.willDecelerate = true;
    });
    return hit;
}
export function thirdAttack(scene, attacker, target, animKey) {
    // The third attack launches the target away
    setAttackSprite(attacker, animKey);

    if (attackIsElligible(attacker, target)) {
        target.hitstunUntil = 500 * target.KBmultiplier + scene.time.now;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;

        target.KBmultiplier += 0.07 * getAttackDamageScale(attacker);
        damagePlanksInAttack(attacker, 0.10 * getAttackDamageScale(attacker));

        // Attack sound
        if (attacker.name === "SWORDMAN") {
            scene.sound.play('swordthirdhitsfx');
        } else if (attacker.name === "AXEMAN") {
            scene.sound.play('axethirdhitsfx');
        } else if (attacker.name === "FISHERMAN") {
            scene.sound.play('rodthirdhitsfx');
        } else if (attacker.name === "SLATEMAN") {
            scene.sound.play('slatepunch');
        } else if (attacker.name === "CROWBARMAN") {
            scene.sound.play('crowbarhit');
        }

        // Get the direction of the attack
        let dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;

        // If attacking horizontally, give the attack a slight
        // upward launch instead of completely horizontal knockback.
        if (dirY === 0) {
            dirY = -0.5;
        } else if (dirY === 1) {
            dirX = attacker.x <= target.x ? 0.75 : -0.75;
            dirY = -1
        }

        // Third attack has stronger knockback than pushAttack
        const plungeMultiplier = target.plunged
            ? finalplungeMultiplier
            : 0;

        hitFreeze(scene, 100, false);
        if (attacker.name === 'SWORDMAN') scene.anims.get(animKey)?.resume();

        // If the target is grounded and the attack is strongly downward,
        // launch them sideways instead.

        applyKnockback(
            scene,
            target,
            (500 * target.KBmultiplier *
                (getAttackDamageScale(attacker) + plungeMultiplier)) * dirX,
            (500 * target.KBmultiplier) * dirY
        );

        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else if (attacker.name === 'SWORDMAN') {
        scene.sound.play('swordthirdhitsfx');
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }

    attacker.canAttack = false;

    scene.time.delayedCall(250, () => {
        hideAttackSprite(attacker);
    });

    // Combo enders always keep the full 400ms recovery, even for fighters with
    // fast cooldowns, so a mashed combo can't roll straight into the next one.
    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });

    if (attacker.revokeAggressorStun) {
        scene.time.removeEvent(attacker.revokeAggressorStun);
    }

    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
    }

    scene.time.delayedCall(500 * target.KBmultiplier, () => {
        target.hitstun = false;
    });

    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });
}

// Configurable tilt attack shared by character scripts.
export function tiltAttack(scene, attacker, target, {
    animKey,
    kb = 0.1,
    xMul = 1,
    yMul = 0,
    range = 120,
    freeze = 80,
    sfx = 'anyhit',
    kbTime = 200,
    onHit = null,
    onUse = null
}) {
    //they aren't really tilt attacks
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;
    setAttackSprite(attacker, animKey);
    if (onUse) {
        onUse(scene);
    }
    if (attackIsElligible(attacker, target, range)) {
        target.hitstunUntil = kbTime + 300 + scene.time.now;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freeze = scene.time.now - 1;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += kb * getAttackDamageScale(attacker);
        damagePlanksInAttack(attacker, kb * getAttackDamageScale(attacker));
        if (onHit) {
            onHit(scene);
        }
        hitFreeze(scene, freeze);
        scene.sound.play(sfx);
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if same level

        const plungeMultiplier = target.plunged ? finalplungeMultiplier : 0;
        const damageScale = getAttackDamageScale(attacker) > 2 ? 2 : getAttackDamageScale(attacker);
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            applyKnockback(scene, target, 325 * ((getAttackDamageScale(attacker) + plungeMultiplier)) * randDir, -200 * (target.KBmultiplier / 2));
        } else {
            applyKnockback(scene, target, (500 * xMul * (damageScale*2 + plungeMultiplier)) * dirX, (500 * yMul) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        hideAttackSprite(attacker);
    });
    scene.time.delayedCall(300, () => {
        attacker.canAttack = true;
    });
    if (target.hitstunTimer) {
        target.hitstunTimer.remove();
    }

    target.hitstunTimer = scene.time.delayedCall(kbTime, () => {
        target.hitstun = false;
        target.hitstunTimer = null;
    });
    scene.time.delayedCall(kbTime, () => {
        target.willDecelerate = true;
    });
    attacker.nextAttackTime = scene.time.now + 400;
}
// Combo selection and shared attack cooldowns.
export function tryAttack(scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        thirdAttack(scene, attacker, target, thirdAnimKey);
    } else {
        if (attacker.horizontalMovementActive) {
            pushAttack(scene, attacker, target, animKey);
        } else {
            attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + getAttackCooldown(attacker); // Attack cooldown
}

export function downslamAttack(scene, attacker, target) {
    attacker.isAttacking = false;
    spawnDirtBurst(scene, attacker.x, attacker.y, 16, 6, 10, 1.5);
    scene.sound.play('slamimpact');

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    if (Math.hypot(dx, dy) > 125 || isInvincible(target)) return false;

    target.hitstunUntil = scene.time.now + 500;
    target.willDecelerate = false;
    target.KBmultiplier += 0.10 * getAttackDamageScale(attacker);

    const direction = dx === 0 ? (attacker.lastDir.x || 1) : Math.sign(dx);
    applyKnockback(
        scene,
        target,
        100 * target.KBmultiplier * direction,
        -500 * target.KBmultiplier
    );
    target.flash();
    scene.sound.play('anyhit');
    scene.time.delayedCall(200 * target.KBmultiplier, () => {
        target.willDecelerate = true;
    });
    return true;
}
const sharedAttackHelpers = {
    damagePlanksInAttack,
    pushAttack,
    thirdAttack,
    attack,
    addSceneUpdateListener,
    addProjectilePlatformColliders,
    platformsWithoutStandingPlatform,
    getAttackSpriteOffset,
    queueStunRelease,
    applyKnockback,
    getAttackDamageScale,
    getAttackCooldown,
    getProjectileBlockingPlatforms,
    attackIsElligible,
    isInvincible,
    setAttackSprite,
    positionAttackSprite,
    hideAttackSprite,
    hitFreeze,
    startSideSpecialCooldown,
    spawnDirtBurst,
    spawnCrater,
    spawnExplosion,
    damagePlank: (scene, plank, damage) =>
        damageAxemanPlank(sharedAttackHelpers, scene, plank, damage),
    removeGrass,
    cutNearbyGrass,
    tryAttack,
    tiltAttack,
    distanceBetween: (first, second) => Phaser.Math.Distance.Between(
        first.x, first.y, second.x, second.y
    )

};

function getCharacterScript(attacker) {
    return CHARACTER_ATTACK_SCRIPTS[attacker.name];
}

// Extra nudge for a fighter's attack sprite, set in their attack script with
// attackSpriteOffset (or variantAttackSpriteOffsets per variant, or
// textureAttackSpriteOffsets per atk texture, which wins over both).
// x pushes along the facing direction, y pushes down the screen.
export function getAttackSpriteOffset(player, textureKey = player.atk?.texture.key) {
    const script = getCharacterScript(player);
    const offset = script?.textureAttackSpriteOffsets?.[textureKey] ??
        script?.variantAttackSpriteOffsets?.[player.variant] ??
        script?.attackSpriteOffset;
    return {
        x: (offset?.x ?? 0) * player.lastDir.x,
        y: (offset?.y ?? 0) + (offset?.x ?? 0) * player.lastDir.y
    };
}

// Attack art is drawn facing left; textures listed in a script's
// rightFacingAttackSprites are drawn facing right and flip the other way.
export function getAttackSpriteFlipX(player, textureKey = player.atk?.texture.key) {
    const facesRight = getCharacterScript(player)?.rightFacingAttackSprites?.includes(textureKey) ?? false;
    return (-player.lastDir.x < 0) !== facesRight;
}

function deathRayAttackLocked(scene) {
    return scene.hitFreezeUltra || scene.time.now < (scene.deathRayAttackLockUntil ?? 0);
}

// Public input handlers delegate character choices to their own scripts.
export function handleAttack(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleAttack(sharedAttackHelpers, scene, attacker, victim);
}

export function updateChainsawWood(scene, attacker, victim) {
    return getCharacterScript(attacker)?.updateChainsawWood?.(scene, attacker, victim);
}

export function toggleChainsawMode(scene, attacker) {
    return getCharacterScript(attacker)?.toggleChainsawMode?.(scene, attacker);
}

export function tryQuickslamJump(scene, attacker, currentTime) {
    return getCharacterScript(attacker)?.tryQuickslamJump?.(
        sharedAttackHelpers, scene, attacker, currentTime
    ) ?? false;
}

export function handleDirSpecial(scene, attacker, direction, currentTime, victim, force = false) {
    const characterScript = getCharacterScript(attacker);
    if (force) attacker.lastTap[direction] = currentTime - 1;
    return characterScript?.handleDirSpecial(
        sharedAttackHelpers, scene, attacker, direction, currentTime, victim
    );
}

export function handleNeutralSpecial(scene, attacker, victim) {
    const characterScript = getCharacterScript(attacker);
    const variantHandler = characterScript?.variantNeutralSpecials?.[attacker.variant];
    const handler = variantHandler ?? characterScript?.handleNeutralSpecial;
    return handler?.(sharedAttackHelpers, scene, attacker, victim);
}

export function handleDirSpecialAttack(scene, attacker, victim) {
    return getCharacterScript(attacker)?.handleDirSpecialAttack?.(
        sharedAttackHelpers, scene, attacker, victim
    );
}

export function handleHorizantalTilt(scene, attacker, victim, direction) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleHorizantalTilt(
        sharedAttackHelpers, scene, attacker, victim, direction
    );
}

export function handleDownTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleDownTilt(sharedAttackHelpers, scene, attacker, victim);
}

export function handleUpTilt(scene, attacker, victim) {
    if (deathRayAttackLocked(scene)) return;
    return getCharacterScript(attacker)?.handleUpTilt(sharedAttackHelpers, scene, attacker, victim);
}
