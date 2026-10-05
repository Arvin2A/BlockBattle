function playShotAnimation(scene, attacker) {
    attacker.atk.setPosition(
        attacker.x + attacker.lastDir.x * 50,
        attacker.y + attacker.lastDir.y * 50
    );
    attacker.atk.setFlipX(attacker.lastDir.x < 0);
    attacker.atk.setAngle(attacker.lastDir.y < 0 ? -90 : attacker.lastDir.y > 0 ? 90 : 0);
    attacker.atk.setFrame(0);
    attacker.atk.setVisible(true);
    attacker.atk.play('gunmanatk', true);
    scene.time.delayedCall(180, () => {
        if (attacker.active && !attacker.activeGrab) attacker.atk.setVisible(false);
    });
}

function createBeam(scene, attacker, victim) {
    const aimLength = Math.hypot(attacker.lastDir.x, attacker.lastDir.y) || 1;
    const directionX = attacker.lastDir.x / aimLength;
    const directionY = attacker.lastDir.y / aimLength;
    const startX = attacker.x + directionX * 50;
    const startY = attacker.y + directionY * 25 -10;
    const contactDistance = getBeamContactDistance(victim, {
        directionX,
        directionY,
        startX,
        startY
    });
    const beamLength = contactDistance === null ? 10000 : contactDistance;
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

    return { hit: contactDistance !== null };
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

function spawnExplosion(scene, victim) {
    const explosion = scene.add.sprite(victim.x, victim.y, 'explosion')
        .setDepth(8)
        .setScale(0.7);
    scene.objs.add(explosion);
    explosion.play('explosion');
    explosion.once('animationcomplete-explosion', () => explosion.destroy());
}

function handleShot(api, scene, attacker, victim) {
    if (scene.time.now < attacker.nextAttackTime || !attacker.canAttack || attacker.hitstun) return;

    const isExplosion = attacker.combo >= 4;
    const beam = createBeam(scene, attacker, victim);
    playShotAnimation(scene, attacker);
    scene.sound.play('gunshot');
    if (isExplosion) scene.sound.play('reload');

    const hit = beam.hit && !scene.finisherActive;
    if (hit) {
        victim.flash();
        const damageScale = api.getAttackDamageScale(attacker);
        victim.KBmultiplier += (isExplosion ? 0.10 : 0.01) * damageScale;
        victim.hitstunUntil = scene.time.now + (isExplosion ? 750 : 350) * victim.KBmultiplier;
        victim.willDecelerate = false;
        const knockback = (isExplosion ? 500 : 50) * victim.KBmultiplier * damageScale;
        const verticalKick = attacker.lastDir.y === 0
            ? (isExplosion ? -220 : -40)
            : attacker.lastDir.y * knockback;
        api.applyKnockback(scene, victim, attacker.lastDir.x * knockback, verticalKick);
        if (isExplosion) scene.sound.play('explosion');
        scene.time.delayedCall(isExplosion ? 750 : 350, () => {
            if (victim.active) victim.willDecelerate = true;
        });

        if (isExplosion) {
            spawnExplosion(scene, victim);
            attacker.combo = 0;
            attacker.comboTimer = 0;
        } else {
            attacker.combo += 1;
            attacker.comboTimer = 0;
        }
    } else {
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }

    const cooldown = isExplosion ? 2000 : 100;
    attacker.canAttack = false;
    attacker.nextAttackTime = scene.time.now + cooldown;
    scene.time.delayedCall(cooldown, () => {
        if (attacker.active) attacker.canAttack = true;
    });
}

export default {
    handleAttack: handleShot,
    handleDirSpecial: () => {},
    handleHorizantalTilt: handleShot,
    handleDownTilt: handleShot,
    handleUpTilt: handleShot
};