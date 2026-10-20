function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'slateatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
function markPlunge(api, scene, attacker, target, dir) {
    //Marks attack for plunge
    let hit = false;
    if (api.attackIsElligible(attacker, target, 150, false)) {
        hit = true;
        target.hitstunUntil = 450 * target.KBmultiplier + scene.time.now;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.075 * api.getAttackDamageScale(attacker);
        api.damagePlanksInAttack(attacker, 0.08 * api.getAttackDamageScale(attacker));
        target.plunged = true;
        api.hitFreeze(scene, 50);
        scene.sound.play('plunge');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            api.applyKnockback(scene, target, (325 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * randDir, -200 * target.KBmultiplier);
        } else {
            api.applyKnockback(scene, target, (300 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dir, (500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
    }
    attacker.canAttack = false;
    scene.time.delayedCall(400, () => {
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
    scene.time.delayedCall(2500, () => {
        target.plunged = false;
    });
    return hit;
}
function tryPlunge(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (
        currentTime - player.lastTap[direction] >= dtapDelay &&
        !player.isBot
    ) {
        player.lastTap[direction] = currentTime;
        return;
    }

    const currentSpeed = player.baseMovementSpeed;
    player.baseMovementSpeed = currentSpeed*2;
    api.startSideSpecialCooldown(player, currentTime, pullCD);
    player.attackBypassesHitstun = false;
    player.isAttacking = true;

    const currentLastDir = player.lastDir.x;

    const dagger = scene.physics.add.sprite(
        player.x + currentLastDir * 25,
        player.y,
        'slateplunge'
    );

    dagger.setOrigin(0.5, 0.5);
    dagger.setFrame(0);
    dagger.setFlipX(-currentLastDir < 0);

    scene.objs.add(dagger);

    let plungeCanceled = false;
    let attackActive = false;
    let missPlayed = false;

    const hitTargets = new Set();

    const daggerTrack = () => {
        dagger.x = player.x + currentLastDir * 25;
        dagger.y = player.y;
    };

    const plungeUpdate = () => {
        if (!attackActive || plungeCanceled) return;

        // Prevent multiple hits on same target
        if (hitTargets.has(target.id)) return;

        const plungeResult = markPlunge(api,
            scene,
            player,
            target,
            currentLastDir
        );

        if (plungeResult) {
            plungeCanceled = true;
            hitTargets.add(target.id);
        }
    };

    const removeDaggerTrack = api.addSceneUpdateListener(scene, daggerTrack);
    const removePlungeUpdate = api.addSceneUpdateListener(scene, plungeUpdate);

    dagger.play('slateplunge');
    player.afterimage = true;
    player.isPlunging = true;


    dagger.on('animationupdate', (animation, frame) => {
        const currentFrame = frame.index;

        attackActive = currentFrame >= 6 && currentFrame <= 10;

        if (
            currentFrame > 10 &&
            !plungeCanceled &&
            !missPlayed
        ) {
            missPlayed = true;
            scene.sound.play('miss');
        }
    });

    dagger.on('animationcomplete-slateplunge', () => {
        removeDaggerTrack();
        removePlungeUpdate();
        player.afterimage = false;
        player.isPlunging = false;
        player.isAttacking = false;
        player.attackBypassesHitstun = false;
        player.baseMovementSpeed = currentSpeed;


        dagger.destroy();
    });

    player.lastTap[direction] = currentTime;
}

export default {
    handleAttack: (api, scene, attacker, victim) =>
        api.tryAttack(scene, attacker, victim, 'slateatk', 'slateatkthird'),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPlunge(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { METAMORPHIC: neutralSpecial },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};