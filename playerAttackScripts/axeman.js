function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'axeatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}
function deactivateChainsaw(scene, attacker) {
    if (!attacker.chainsawActive) return false;
    attacker.chainsawSFX.stop();
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

function explodeChainsaw(api, scene, attacker, victim, options = {}) {
    if (attacker.chainsawHasExploded || !victim.active || scene.finisherActive) return;

    attacker.chainsawHasExploded = true;
    attacker.chainsawCooldownUntil = scene.time.now + 5000;
    const damageScale = api.getAttackDamageScale(attacker);
    const hitstunDuration = options.explosionHitstun ?? 500;
    const knockback = (options.explosionKnockback ?? 650) * damageScale;
    victim.KBmultiplier += (options.explosionDamage ?? 0.25) * damageScale;
    victim.freezeUntil = scene.time.now - 1;
    victim.hitstunUntil = scene.time.now + hitstunDuration;
    victim.willDecelerate = false;
    victim.flash();
    api.spawnExplosion(scene, victim);
    scene.sound.play('explosion');
    api.applyKnockback(
        scene,
        victim,
        attacker.lastDir.x * knockback,
        attacker.lastDir.y * knockback - 200
    );
    api.hitFreeze(scene, options.hitFreezeDuration ?? 60);
    scene.time.delayedCall(hitstunDuration, () => {
        if (victim.active) victim.willDecelerate = true;
    });
    deactivateChainsaw(scene, attacker);
}

function updateChainsaw(api, scene, attacker, victim, options = {}) {
    if (!attacker.active || attacker.hitstun || attacker.freeze || scene.finisherActive) {
        deactivateChainsaw(scene, attacker);
        return;
    }
    api.positionAttackSprite(attacker, 'activechainsaw');
    if (!victim.active || api.distanceBetween(attacker.atk, victim) > (options.range ?? 75)) {
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

function toggleChainsaw(api, scene, attacker, victim, options = {}) {
    if (attacker.hitstun || attacker.freeze || scene.finisherActive) return;
    if (attacker.chainsawActive || scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) {
        deactivateChainsaw(scene, attacker);
        return;
    }
    attacker.chainsawSFX.play();
    if (scene.time.now < (attacker.chainsawCooldownUntil ?? 0)) return;

    attacker.chainsawActive = true;
    attacker.chainsawActiveTime = scene.time.now;
    attacker.chainsawContactDuration = 0;
    attacker.chainsawLastContactTime = 0;
    attacker.chainsawHasExploded = false;
    api.positionAttackSprite(attacker, 'activechainsaw');
    attacker.atk.play('activechainsaw', true);
    attacker.chainsawHitEvent = scene.time.addEvent({
        delay: options.hitInterval ?? 50,
        loop: true,
        callback: () => updateChainsaw(api, scene, attacker, victim, options)
    });
}

function handleAttack(api, scene, attacker, victim) {
    if (attacker.variant !== 'CHAINSAW') {
        return api.tryAttack(scene, attacker, victim, 'axeatk', 'axeatkthird');
    }
    return toggleChainsaw(api, scene, attacker, victim);
}

function handleDirSpecial(api, scene, attacker, direction, currentTime) {
    if (attacker.variant === 'CHAINSAW') return;
    return api.tryCleave(scene, attacker, direction, currentTime);
}
export default {
    handleAttack,
    handleDirSpecial,
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