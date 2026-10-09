export const MAX_WOOD_COUNT = 225;

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'axeatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}
function deactivateChainsaw(scene, attacker) {
    if (!attacker.chainsawActive) return false;
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

function startRampage(api, scene, attacker, victim) {
    if (!attacker.chainsawMode || attacker.hitstun || attacker.freeze ||
        scene.finisherActive ||
        scene.time.now < (attacker.rampageCooldownUntil ?? 0) ||
        scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) return;

    if (!attacker.chainsawActive) {
        activateChainsaw(api, scene, attacker, victim);
    }

    attacker.rampageEvent?.remove(false);
    attacker.rampageUntil = scene.time.now + 1000;
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

function explodeChainsaw(api, scene, attacker, victim, options = {}) {
    if (attacker.chainsawHasExploded || !victim.active || scene.finisherActive) return;

    attacker.chainsawHasExploded = true;
    attacker.chainsawCooldownUntil = scene.time.now + 5000;
    const damageScale = api.getAttackDamageScale(attacker);
    const hitstunDuration = options.explosionHitstun ?? 500;
    victim.KBmultiplier += (options.explosionDamage ?? 0.25) * damageScale;
    const knockback = (options.explosionKnockback ?? 550) *
        damageScale *
        victim.KBmultiplier * 0.5;
    victim.freezeUntil = scene.time.now - 1;
    victim.hitstunUntil = scene.time.now + hitstunDuration;
    victim.willDecelerate = false;
    victim.flash();
    api.spawnExplosion(scene, victim, 0.7 * victim.KBmultiplier);
    scene.sound.play('explosion');
    api.applyKnockback(
        scene,
        victim,
        attacker.lastDir.x * knockback * victim.KBmultiplier * 0.85,
        attacker.lastDir.y * knockback - 200 * victim.KBmultiplier/2
    );
    api.hitFreeze(scene, options.hitFreezeDuration ?? 60);
    scene.time.delayedCall(hitstunDuration, () => {
        if (victim.active) victim.willDecelerate = true;
    });
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
}

export function damagePlank(api, scene, plank, damage = 0.02) {
    if (!plank.active || !Number.isFinite(damage) || damage <= 0) return;

    plank.health = Math.max(0, plank.health - damage);
    plank.setAlpha(plank.health / plank.maxHealth);
    if (plank.health <= 0) destroyPlank(api, scene, plank);
}

function breakPlanksWithChainsaw(api, scene, attacker) {
    const attackBounds = attacker.atk.getBounds();
    for (const plank of [...scene.planks.getChildren()]) {
        if (plank.active && Phaser.Geom.Intersects.RectangleToRectangle(
            attackBounds,
            plank.body
        )) {
            destroyPlank(api, scene, plank);
        }
    }
}

function updateChainsaw(api, scene, attacker, victim, options = {}) {
    if (!attacker.active || attacker.hitstun || attacker.freeze || scene.finisherActive) {
        deactivateChainsaw(scene, attacker);
        return;
    }
    api.positionAttackSprite(attacker, 'activechainsaw');
    breakPlanksWithChainsaw(api, scene, attacker);
    if (!victim.active || api.distanceBetween(attacker.atk, victim) > (options.range ?? 50)) {
        attacker.chainsawLastContactTime = 0;
        return;
    }

    const now = scene.time.now;
    if (attacker.chainsawLastContactTime > 0) {
        attacker.chainsawContactDuration += now - attacker.chainsawLastContactTime;
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
        attacker.atk.angle === -90 &&
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
        scene.finisherActive || attacker.woodCount < 15) return;

    const plank = scene.physics.add.image(
        x,
        y,
        'plank'
    );
    plank.setOrigin(0.5);
    plank.setAngle(rotated ? 90 : 0);
    plank.setDepth(3);
    plank.body.allowGravity = false;
    plank.setImmovable(true);
    plank.body.setSize(rotated ? 10 : 200, rotated ? 200 : 10);
    plank.body.setOffset(rotated ? 95 : 0, rotated ? 0 : 95);
    plank.health = 0.10;
    plank.maxHealth = plank.health;
    scene.objs.add(plank);
    scene.planks.add(plank);

    attacker.woodCount -= 15;
    attacker.woodText.setText(`Wood: ${attacker.woodCount} ft³`);
    scene.sound.play('axeslash1');
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
        attacker.hitstun || attacker.freeze || scene.finisherActive) return;
    setChainsawMode(scene, attacker, !attacker.chainsawMode);
}

function toggleChainsaw(api, scene, attacker, victim, options = {}) {
    if (!attacker.chainsawMode || attacker.hitstun || attacker.freeze || scene.finisherActive) return;
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
            scene.finisherActive ||
            currentTime < (attacker.chainsawCooldownUntil ?? 0)) return;

        const doubleTap = currentTime - attacker.lastTap[direction] < 250;
        attacker.lastTap[direction] = currentTime;
        if (!doubleTap || currentTime < (attacker.nextSideSpecialTime ?? 0)) return;
        api.startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
        startRampage(api, scene, attacker, victim);
        return;
    }
    return api.tryCleave(scene, attacker, direction, currentTime);
}
function neutralPlaceAndHarvest(api, scene, attacker, victim) {
    if (attacker.body.blocked.down || attacker.body.touching.down) {
        attacker.lastDir = { x: 0, y: 1 };
        if (!attacker.chainsawMode) toggleChainsawMode(scene, attacker);
        if (!attacker.chainsawActive) activateChainsaw(api, scene, attacker, victim);
        api.positionAttackSprite(attacker, 'activechainsaw');
        return;
    }

    placePlank(api, scene, attacker, {
        x: attacker.x,
        y: attacker.y + 100,
        rotated: false,
        allowChainsawMode: true
    });
}
const neutralSpecial = () => {};
export default {
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
            api.superSwing(scene, attacker, victim, 'axeatkthird');
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
