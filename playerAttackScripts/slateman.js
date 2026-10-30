// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'slateatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
function markPlunge(api, scene, attacker, target, dir) {
    //Marks attack for plunge
    const hit = api.strike(scene, attacker, target, {
        range: 150,
        bypass: { ignoreCanAttack: true },
        direction: { x: dir, y: attacker.lastDir.y },
        damage: 0.075,
        plankDamage: 0.08,
        hitstun: 450,
        hitFreeze: 50,
        sound: 'plunge',
        knockback: { x: 300, y: 500, spike: { x: 325, y: -200 } },
        decelerateAfter: 600
    });
    if (hit) {
        // Marked after the launch, so the mark's own bonus doesn't apply to it.
        target.plunged = true;
        target.plungeEvent?.remove(false);
        target.plungeEvent = scene.time.delayedCall(2500, () => {
            target.plunged = false;
            target.plungeEvent = null;
        });
    } else {
        attacker.combo = 0;
    }
    api.clearQueuedStunTimers(scene, attacker, target);
    api.recoverAfterAttack(scene, attacker, { hideAfter: null });
    return hit;
}
// While plunging he drifts the way he dashed at the normal walking speed. Holding
// left or right instead runs at that speed plus his own damage-scaled speed, so
// the more hurt he is, the faster his plunge gets.
function updatePlungeMovement(api, scene, player) {
    if (!player.isPlunging || player.hitstun || player.freeze) return;
    if (player.horizontalMovementActive) {
        player.movementSpeed = player.baseMovementSpeed * (1 + player.playerSpeedScaling);
    } else {
        // Held every frame, since landing the plunge turns floor slowdown back on.
        player.willDecelerate = false;
        player.setVelocityX(player.plungeDirX * player.baseMovementSpeed);
    }
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

    api.startSideSpecialCooldown(player, currentTime, pullCD);
    player.attackBypassesHitstun = false;
    player.isAttacking = true;
    // A new swing, so the plunge can damage a plank even if the last swing did.
    player.attackSequence = (player.attackSequence ?? 0) + 1;

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
    player.plungeDirX = direction === 'left' ? -1 : 1;
    const wasDecelerating = player.willDecelerate;


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
        // A hit taken mid-plunge already scheduled when he slows down.
        if (!player.decelerateEvent) player.willDecelerate = wasDecelerating;


        dagger.destroy();
    });

    player.lastTap[direction] = currentTime;
}

export default {
    hitSounds: {
        light: ['slatelight1', 'slatelight2'],
        finisher: 'slatepunch'
    },
    // His arms are drawn facing right.
    rightFacingAttackSprites: ['slateatk1'],
    textureAttackSpriteOffsets: { slateatk1: { x: 5, y: -10 } },
    // Second hit of the combo punches with the other arm, like SWORDMAN's back swing.
    handleAttack: (api, scene, attacker, victim) =>
        api.tryAttack(scene, attacker, victim,
            attacker.combo === 1 ? 'slateatksecond' : 'slateatk', 'slateatkthird'),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPlunge(api, scene, attacker, victim, direction, currentTime),
    update: updatePlungeMovement,
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { METAMORPHIC: neutralSpecial },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};