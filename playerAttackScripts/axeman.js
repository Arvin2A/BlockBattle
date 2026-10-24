// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export const MAX_WOOD_COUNT = 225;

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'axeatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}
// While the saw is cutting someone, the chainsaw axeman floats instead of
// freezing in the air like other fighters do: gravity drops to a fraction and his
// fall speed is capped, but he can still move, so he can keep building platforms.
const SAW_CONTACT_GRAVITY_SCALE = 0.3;
const SAW_CONTACT_MAX_FALL_SPEED = 120;

function setSawFloat(scene, attacker, floating) {
    if (!attacker.body) return;
    const worldGravity = scene.physics.world.gravity.y;
    attacker.body.gravity.y = floating ? -worldGravity * (1 - SAW_CONTACT_GRAVITY_SCALE) : 0;
    if (floating && attacker.body.velocity.y > SAW_CONTACT_MAX_FALL_SPEED) {
        attacker.setVelocityY(SAW_CONTACT_MAX_FALL_SPEED);
    }
}

function deactivateChainsaw(scene, attacker) {
    if (!attacker.chainsawActive) return false;
    setSawFloat(scene, attacker, false);
    attacker.chainsawSFX.stop();
    attacker.clearTint();
    attacker.chainsawSFX.setRate(1);
    attacker.rampageUntil = 0;
    attacker.rampageEvent?.remove(false);
    attacker.rampageEvent = null;
    scene.sound.play('deactivatechainsaw');
    attacker.chainsawActive = false;
    attacker.chainsawActiveTime = 0;
    attacker.chainsawContactDuration = 0;
    attacker.chainsawLastContactTime = 0;
    attacker.chainsawHasExploded = false;
    attacker.chainsawHitEvent?.remove(false);
    attacker.chainsawHitEvent = null;
    attacker.chainsawTarget = null;
    if (attacker.atk.active) {
        attacker.atk.stop();
        attacker.atk.setTexture('inactivechainsaw').setFrame(0).setVisible(true);
    }
    return true;
}

function startChainsawHitEvent(api, scene, attacker, victim, options) {
    attacker.chainsawHitEvent?.remove(false);
    attacker.chainsawHitEvent = scene.time.addEvent({
        delay: attacker.chainsawHitInterval,
        loop: true,
        callback: () => updateChainsaw(api, scene, attacker, victim, options)
    });
}

function activateChainsaw(api, scene, attacker, victim, options = {}) {
    if (attacker.chainsawActive) return;
    attacker.chainsawSFX.play();
    attacker.chainsawActive = true;
    attacker.chainsawActiveTime = scene.time.now;
    attacker.chainsawContactDuration = 0;
    attacker.chainsawLastContactTime = 0;
    attacker.chainsawHasExploded = false;
    attacker.chainsawHitInterval = options.hitInterval ?? 50;
    api.positionAttackSprite(attacker, 'activechainsaw');
    attacker.atk.play('activechainsaw', true);
    startChainsawHitEvent(api, scene, attacker, victim, options);
}

// RAMPAGE: for 1s the saw cuts twice as fast, contact counts double toward the
// explosion (a full rampage in contact detonates in ~1s instead of 2s), and an
// explosion set off during it hits harder. Contact only starts counting on the
// first chip hit, so the harder explosion gets a short grace past the rampage.
const RAMPAGE_EXPLOSION_DAMAGE_SCALE = 1.4;
const RAMPAGE_EXPLOSION_KNOCKBACK_SCALE = 1.25;
const RAMPAGE_EXPLOSION_GRACE_MS = 300;

function isRampaging(scene, attacker) {
    return scene.time.now < (attacker.rampageUntil ?? 0);
}

function startRampage(api, scene, attacker, victim) {
    if (!attacker.chainsawMode || attacker.hitstun || attacker.freeze ||
        scene.time.now < (attacker.rampageCooldownUntil ?? 0) ||
        scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) return;

    if (!attacker.chainsawActive) {
        activateChainsaw(api, scene, attacker, victim);
    }

    attacker.rampageEvent?.remove(false);
    attacker.rampageUntil = scene.time.now + 1000;
    attacker.rampageExplosionUntil = attacker.rampageUntil + RAMPAGE_EXPLOSION_GRACE_MS;
    attacker.rampageCooldownUntil = attacker.rampageUntil;
    attacker.chainsawHitInterval = 25;
    attacker.chainsawSFX.setRate(1.2);
    attacker.setTint(0xff3333);
    startChainsawHitEvent(api, scene, attacker, victim, {});
    attacker.rampageEvent = scene.time.delayedCall(1000, () => {
        attacker.rampageEvent = null;
        attacker.rampageUntil = 0;
        attacker.clearTint();
        attacker.chainsawSFX.setRate(1);
        if (!attacker.chainsawActive) return;
        attacker.chainsawHitInterval = 50;
        startChainsawHitEvent(api, scene, attacker, victim, {});
    });

}

// The explosion follows the same curve as a combo finisher: speed and hitstun
// both grow with KB, so it starts KOing around where a 3-hit combo does. It used
// to square the target's KB for speed but keep a flat 500ms of hitstun, which
// the death ray's freeze mostly used up, so 250% launches were recoverable.
function explodeChainsaw(api, scene, attacker, victim, options = {}) {
    if (attacker.chainsawHasExploded || !victim.active || api.isInvincible(victim)) return;

    attacker.chainsawHasExploded = true;
    attacker.chainsawCooldownUntil = scene.time.now + 5000;
    const rampaging = scene.time.now < (attacker.rampageExplosionUntil ?? 0);
    attacker.rampageExplosionUntil = 0;
    const force = (options.explosionKnockback ?? 450) *
        (rampaging ? RAMPAGE_EXPLOSION_KNOCKBACK_SCALE : 1);
    api.landHit(scene, attacker, victim, {
        damage: (options.explosionDamage ?? 0.25) * (rampaging ? RAMPAGE_EXPLOSION_DAMAGE_SCALE : 1),
        plankDamage: 0,
        hitstun: options.explosionHitstun ?? 400,
        hitFreeze: options.hitFreezeDuration ?? 60,
        sound: 'explosion',
        // Harvesting points the saw down, so a grounded victim gets thrown
        // sideways instead of being pushed into the floor.
        knockback: { x: force, y: force, lift: -0.25, spike: { x: force * 0.9, y: -force * 0.55 } },
        decelerateAfter: victim => (options.explosionHitstun ?? 400) * victim.KBmultiplier,
        resetCombo: false
    });
    victim.flash();
    api.spawnExplosion(scene, victim, (rampaging ? 0.9 : 0.7) * victim.KBmultiplier);
    deactivateChainsaw(scene, attacker);
}

function destroyPlank(api, scene, plank) {
    if (!plank.active) return;
    plank.expireEvent?.remove(false);
    scene.planks.remove(plank, false, false);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0x6b4423, 0x8b5a2b, 0xa66a35],
        180,
        320,
        false
    );
    plank.destroy();
    scene.sound.play('plankbreak');
}

export function damagePlank(api, scene, plank, damage = 0.02) {
    if (!plank.active || !Number.isFinite(damage) || damage <= 0) return;

    plank.health = Math.max(0, plank.health - damage);

    const healthRatio = plank.health / plank.maxHealth;

    if (healthRatio > 0.75) {
        plank.setAlpha(1);
    } else if (healthRatio > 0.50) {
        plank.setAlpha(0.75);
    } else if (healthRatio > 0.25) {
        plank.setAlpha(0.5);
    } else {
        plank.setAlpha(0.25);
    }

    scene.sound.play('axeslash1');

    if (plank.health <= 0) destroyPlank(api, scene, plank);
}

function breakPlanksWithChainsaw(api, scene, attacker) {
    const attackBounds = attacker.atk.getBounds();

    for (const plank of [...scene.planks.getChildren()]) {
        if (
            !plank.active ||
            !plank.body?.enable ||
            !Phaser.Geom.Intersects.RectangleToRectangle(
                attackBounds,
                plank.body
            )
        ) {
            continue;
        }

        // Steel planks resist chainsaws.
        if (
            plank.texture.key === 'strongsteel' ||
            plank.texture.key === 'lightsteel'
        ) {
            damagePlank(api, scene, plank, 0.01);
        } else {
            // Regular wooden planks are destroyed instantly.
            destroyPlank(api, scene, plank);
        }
    }
}


function updateChainsaw(api, scene, attacker, victim, options = {}) {
    if (!attacker.active || attacker.hitstun || attacker.freeze) {
        deactivateChainsaw(scene, attacker);
        return;
    }
    api.positionAttackSprite(attacker, 'activechainsaw');
    breakPlanksWithChainsaw(api, scene, attacker);
    // Same reach as everyone's basic attack: range and facing from the body,
    // blocked by walls. silent, because chip hits flash the victim themselves.
    const inReach = victim.active && api.attackIsElligible(
        attacker, victim, options.range ?? api.STANDARD_HITS.jab.range,
        { ignoreCanAttack: true, silent: true }
    );
    if (!inReach) {
        attacker.chainsawLastContactTime = 0;
        setSawFloat(scene, attacker, false);
        return;
    }
    setSawFloat(scene, attacker, true);

    const now = scene.time.now;
    if (attacker.chainsawLastContactTime > 0) {
        const contactRate = isRampaging(scene, attacker) ? 2 : 1;
        attacker.chainsawContactDuration += (now - attacker.chainsawLastContactTime) * contactRate;
    }
    attacker.chainsawLastContactTime = now;

    const damageScale = api.getAttackDamageScale(attacker);
    victim.KBmultiplier += (options.chipDamage ?? 0.01) * damageScale;
    const hitstunDuration = options.hitstunDuration ?? 150;
    victim.hitstunUntil = now + hitstunDuration;
    victim.freezeUntil = now + (options.freezeDuration ?? 60);
    victim.willDecelerate = false;
    victim.flash();
    scene.sound.play('anyhit');
    scene.time.delayedCall(hitstunDuration, () => {
        if (victim.active && scene.time.now >= victim.hitstunUntil) {
            victim.willDecelerate = true;
        }
    });

    if (!attacker.chainsawHasExploded &&
        attacker.chainsawContactDuration >= (options.duration ?? 2000)) {
        explodeChainsaw(api, scene, attacker, victim, options);
        return;
    }
}

function updateChainsawWood(scene, attacker, victim) {
    if (attacker.name !== 'AXEMAN' || attacker.variant !== 'CHAINSAW') return;

    const isRotated = attacker.lastDir.y === 0;
    const intendedX = attacker.x + attacker.lastDir.x * 200;
    let intendedY = attacker.y + attacker.lastDir.y * 200 - 50;
    if (attacker.lastDir.y === 1) intendedY = attacker.y + attacker.lastDir.y * 100;
    attacker.plankGhost.setPosition(intendedX, intendedY);
    attacker.plankGhost.setAngle(isRotated ? 90 : 0);
    attacker.plankGhost.setVisible(!attacker.chainsawMode);
    attacker.plankGhost.setTint(0x000080);
    attacker.plankGhost.setAlpha(attacker.woodCount >= 15 ? 0.45 : 0.2);

    const standingOnVictim = attacker.body.touching.down &&
        victim?.body?.touching?.up &&
        attacker.body.right > victim.body.left &&
        attacker.body.left < victim.body.right;
    const canCollect = attacker.chainsawMode &&
        attacker.chainsawActive &&
        (attacker.body.blocked.down || attacker.body.touching.down) &&
        attacker.lastDir.y > 0 &&
        !standingOnVictim;

    attacker.woodText.setPosition(attacker.x, attacker.y - 75);
    attacker.woodCollectSprite.setPosition(attacker.atk.x, attacker.atk.y);

    if (!canCollect) {
        attacker.woodCollectionLastTick = null;
        attacker.woodCollecting = false;
        if (attacker.woodCollectSprite.visible || attacker.woodCollectSprite.anims.isPlaying) {
            attacker.woodCollectSprite.stop();
            attacker.woodCollectSprite.setVisible(false);
        }
        return;
    }

    const now = scene.time.now;
    if (attacker.woodCollectionLastTick === null) {
        attacker.woodCollectionLastTick = now;
    } else {
        const collectionInterval = 100;
        const collectionTicks = Math.floor(
            (now - attacker.woodCollectionLastTick) / collectionInterval
        );
        if (collectionTicks > 0) {
            const nextWoodCount = Math.min(
                attacker.woodCount + collectionTicks * 5,
                MAX_WOOD_COUNT
            );
            if (nextWoodCount > attacker.woodCount) {
                attacker.woodCount = nextWoodCount;
                scene.sound.play('collectwood');
            }
            attacker.woodCollectionLastTick += collectionTicks * collectionInterval;
            attacker.woodText.setText(`Wood: ${attacker.woodCount} ft³`);
        }
    }

    attacker.woodCollectionLastTick ??= now;
    attacker.woodCollecting = true;
    attacker.woodCollectSprite.setVisible(true);
    if (!attacker.woodCollectSprite.anims.isPlaying) {
        attacker.woodCollectSprite.play('woodcollect');
    }
}

function placePlank(
    api,
    scene,
    attacker,
    { x = attacker.plankGhost.x, y = attacker.plankGhost.y,
        rotated = attacker.lastDir.y === 0, allowChainsawMode = false } = {}
) {
    if ((!allowChainsawMode && attacker.chainsawMode) || attacker.hitstun || attacker.freeze ||
        attacker.woodCount < 15) return;

    const plank = scene.physics.add.image(
        x,
        y,
        'plank'
    );
    scene.sound.play('placeplank');
    plank.setOrigin(0.5);
    plank.setAngle(rotated ? 90 : 0);
    plank.setDepth(3);
    plank.body.allowGravity = false;
    plank.setImmovable(true);
    plank.body.setSize(rotated ? 10 : 200, rotated ? 200 : 10);
    plank.body.setOffset(rotated ? 95 : 0, rotated ? 0 : 95);
    plank.health = 0.12;
    plank.maxHealth = plank.health;
    plank.owner = attacker;
    scene.objs.add(plank);
    scene.planks.add(plank);

    attacker.woodCount -= 15;
    attacker.woodText.setText(`Wood: ${attacker.woodCount} ft³`);
    plank.expireEvent = scene.time.delayedCall(10000, () => {
        destroyPlank(api, scene, plank);
    });
}



function setChainsawMode(scene, attacker, enabled) {
    if (!enabled) {
        deactivateChainsaw(scene, attacker);
        attacker.rampageEvent?.remove(false);
        attacker.rampageEvent = null;
        attacker.rampageUntil = 0;
        attacker.chainsawSFX.setRate(1);
        attacker.chainsawMode = false;
        attacker.woodCollectionLastTick = null;
        attacker.woodCollecting = false;
        attacker.woodCollectSprite.stop().setVisible(false);
        attacker.atk.stop();
        attacker.atk.setTexture('clawhammer').setFrame(0).setVisible(true).setAlpha(1);
        attacker.modeSwitchIcon?.setTexture('clawhammer');
        return;
    }

    attacker.chainsawMode = true;
    attacker.atk.stop();
    attacker.atk.setTexture('inactivechainsaw').setFrame(0).setVisible(true).setAlpha(1);
    attacker.rampageEvent?.remove(false);
    attacker.rampageEvent = null;
    attacker.rampageUntil = 0;
    attacker.chainsawSFX.setRate(1);
    attacker.modeSwitchIcon?.setTexture('inactivechainsaw');
}

function toggleChainsawMode(scene, attacker) {
    if (attacker.name !== 'AXEMAN' || attacker.variant !== 'CHAINSAW' ||
        attacker.hitstun || attacker.freeze) return;
    setChainsawMode(scene, attacker, !attacker.chainsawMode);
}

function toggleChainsaw(api, scene, attacker, victim, options = {}) {
    if (!attacker.chainsawMode || attacker.hitstun || attacker.freeze) return;
    if (attacker.chainsawActive || scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) {
        deactivateChainsaw(scene, attacker);
        return;
    }
    if (scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) return;
    activateChainsaw(api, scene, attacker, victim, options);
}

function handleAttack(api, scene, attacker, victim) {
    if (attacker.variant !== 'CHAINSAW') {
        return api.tryAttack(scene, attacker, victim, 'axeatk', 'axeatkthird');
    }
    if (!attacker.chainsawMode) {
        return placePlank(api, scene, attacker);
    }
    return toggleChainsaw(api, scene, attacker, victim);
}

function handleDirSpecial(api, scene, attacker, direction, currentTime, victim) {
    if (attacker.variant === 'CHAINSAW') {
        if (!attacker.chainsawMode || attacker.hitstun || attacker.freeze ||
            currentTime < (attacker.chainsawCooldownUntil ?? 0)) return;

        const doubleTap = currentTime - attacker.lastTap[direction] < 250;
        attacker.lastTap[direction] = currentTime;
        if (!doubleTap || currentTime < (attacker.nextSideSpecialTime ?? 0)) return;
        api.startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
        startRampage(api, scene, attacker, victim);
        return;
    }
    return tryCleave(api, scene, attacker, direction, currentTime);
}
function neutralPlaceAndHarvest(api, scene, attacker, victim) {
    if (attacker.body.blocked.down || attacker.body.touching.down) {
        attacker.lastDir = { x: 0, y: 1 };
        if (!attacker.chainsawMode) toggleChainsawMode(scene, attacker);
        if (!attacker.chainsawActive) activateChainsaw(api, scene, attacker, victim);
        api.positionAttackSprite(attacker, 'activechainsaw');
        return;
    }

    if (attacker.chainsawActive) deactivateChainsaw(scene, attacker);

    placePlank(api, scene, attacker, {
        x: attacker.x,
        y: attacker.y + 100,
        rotated: false,
        allowChainsawMode: true
    });
}
const neutralSpecial = () => {};
// Cleave's hit. Flat knockback (no KB growth) plus the chopped debuff.
const SUPER_SWING = {
    damage: 0.34,
    hitstun: 500,
    hitstunGrowth: false,
    hitFreeze: 50,
    sound: 'axecleavesfx',
    knockback: { x: 800, y: 500, growth: false, spike: { x: 800, y: -200 } },
    decelerateAfter: 800
};
function superSwing(api, scene, attacker, target, animKey) {
    // The axe only swings when it connects.
    const hit = api.attackIsElligible(attacker, target, 150);
    if (hit) {
        api.setAttackSprite(attacker, animKey);
        api.landHit(scene, attacker, target, SUPER_SWING);
        target.choppedUntil = scene.time.now + 3000;
    }
    api.clearQueuedStunTimers(scene, attacker, target);
    attacker.canAttack = false;
    scene.time.delayedCall(400, () => {
        api.hideAttackSprite(attacker);
        attacker.canAttack = true;
    });
    return hit;
}
function tryCleave(api, scene, player, direction, currentTime) {
    const dtapDelay = 250;
    const cleaveCD = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {

        player.isUsingSideSpecial = true;
        player.isAttacking = true;
        player.hasHitSideSpecial = false;

        const speed = 800;
        player.afterimage = true;


        if (direction === 'left') {
            player.setVelocityX(-speed);
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.setVelocityX(speed);
            player.lastDir = { x: 1, y: 0 };
        }

        // Use third attack animation (hard to hit, so discarded)
        //api.thirdAttack(scene, player, players.player2, 'axeatkthird');

        scene.time.delayedCall(140, () => {
            scene.time.delayedCall(350, () => {
                player.isUsingSideSpecial = false;
            });
            player.setVelocityX(player.body.velocity.x / 5);
            player.afterimage = false;
        });

        api.startSideSpecialCooldown(player, currentTime, cleaveCD);
    }

    player.lastTap[direction] = currentTime;
}

export default {
    hitSounds: {
        light: ['axeslash1', 'axeslash2'],
        finisher: 'axethirdhitsfx'
    },
    // Axes are made for chopping wood.
    plankDamageScale: 3,
    handleAttack,
    updateChainsawWood,
    toggleChainsawMode,
    handleDirSpecial,
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: {
        LUMBERER: neutralSpecial,
        CHAINSAW: neutralPlaceAndHarvest
    },
    handleDirSpecialAttack: (api, scene, attacker, victim) => {
        if (attacker.variant === 'CHAINSAW') return;
        if (api.distanceBetween(attacker, victim) <= 150) {
            superSwing(api, scene, attacker, victim, 'axeatkthird');
        }
    },
    handleHorizantalTilt: (api, scene, attacker, victim) => {
        if (attacker.variant !== 'CHAINSAW') tilt(api, scene, attacker, victim, 0.6, 1, 600);
    },
    handleDownTilt: (api, scene, attacker, victim) => {
        if (attacker.variant !== 'CHAINSAW') tilt(api, scene, attacker, victim, 0, 2, 300);
    },
    handleUpTilt: (api, scene, attacker, victim) => {
        if (attacker.variant !== 'CHAINSAW') tilt(api, scene, attacker, victim, 0, 0.88, 300);
    }
};
