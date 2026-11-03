// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const CONTACT_GRAVITY_SCALE = 0.3;
const CONTACT_MAX_FALL_SPEED = 120;

export function setGrindFloat(scene, attacker, floating) {
    if (!attacker.body) return;
    const worldGravity = scene.physics.world.gravity.y;
    attacker.body.gravity.y = floating ? -worldGravity * (1 - CONTACT_GRAVITY_SCALE) : 0;
    if (floating && attacker.body.velocity.y > CONTACT_MAX_FALL_SPEED) {
        attacker.setVelocityY(CONTACT_MAX_FALL_SPEED);
    }
}

export function grindTick(api, scene, attacker, victim, lastContactAt, {
    range = api.STANDARD_HITS.jab.range,
    chipDamage = 0.01,
    hitstun = 150,
    freeze = 60
} = {}) {
    const inReach = victim.active && api.attackIsElligible(
        attacker, victim, range, { ignoreCanAttack: true, silent: true }
    );
    if (!inReach) {
        setGrindFloat(scene, attacker, false);
        return null;
    }
    setGrindFloat(scene, attacker, true);

    const now = scene.time.now;
    victim.KBmultiplier += chipDamage * api.getAttackDamageScale(attacker);
    victim.hitstunUntil = now + hitstun;
    victim.freezeUntil = now + freeze;
    victim.willDecelerate = false;
    victim.flash();
    scene.sound.play('anyhit');
    scene.time.delayedCall(hitstun, () => {
        if (victim.active && scene.time.now >= victim.hitstunUntil) {
            victim.willDecelerate = true;
        }
    });
    return lastContactAt > 0 ? now - lastContactAt : 0;
}

export function grindExplosion(api, scene, attacker, victim, {
    damage = 0.25,
    force = 450,
    hitstun = 400,
    hitFreeze = 60,
    explosionScale = 0.7,
    noDeathRay = false,
    direction = null
} = {}) {
    api.landHit(scene, attacker, victim, {
        direction,
        damage,
        plankDamage: 0,
        hitstun,
        hitFreeze,
        sound: 'explosion',
        knockback: { x: force, y: force, lift: -0.25, spike: { x: force * 0.9, y: -force * 0.55 } },
        decelerateAfter: target => hitstun * target.KBmultiplier,
        resetCombo: false,
        noDeathRay
    });
    victim.flash();
    api.spawnExplosion(scene, victim, explosionScale * victim.KBmultiplier);
}
