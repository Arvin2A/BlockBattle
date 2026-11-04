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
const PLUNGE_FRAMES = { bladeOut: 15, bladeIn: 33 };
const PLUNGE_BLADE_SPEED_BOOST = 1.5;
const PLUNGE_ARM_OFFSET = 38;
const PLUNGE_DRAW_HIT = {
    range: 150,
    damage: 0.035,
    hitstun: 900,
    hitstunGrowth: false,
    hitFreeze: 80,
    sound: 'swosh',
    knockback: { x: 600, y: 500, growth: false, maxDamageScale: 2, spike: { x: 325, y: -100 } },
    decelerateAfter: 600
};
const PLUNGE_BLADE_HIT = {
    range: 150,
    damage: 0.075,
    plankDamage: 0.08,
    hitstun: 450,
    hitFreeze: 50,
    sound: 'plunge',
    knockback: { x: 300, y: 500, spike: { x: 325, y: -200 } },
    decelerateAfter: 600
};

function plungeHit(api, scene, attacker, target, dirX, spec) {
    const bypass = { ignoreCanAttack: true, direction: { x: dirX, y: 0 } };
    if (!api.attackIsElligible(attacker, target, spec.range, { ...bypass, silent: true })) return false;
    return api.strike(scene, attacker, target, { ...spec, bypass, direction: bypass.direction });
}

function markPlunged(scene, target) {
    target.plunged = true;
    target.plungeEvent?.remove(false);
    target.plungeEvent = scene.time.delayedCall(2500, () => {
        target.plunged = false;
        target.plungeEvent = null;
    });
}

function updatePlungeMovement(api, scene, player) {
    if (!player.isPlunging || player.hitstun || player.freeze || !player.horizontalMovementActive) return;
    const boost = player.plungeBladeOut ? PLUNGE_BLADE_SPEED_BOOST : 1;
    player.movementSpeed = player.baseMovementSpeed * (1 + player.playerSpeedScaling) * boost;
}

function tryPlunge(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = player.dirSpecialCooldown;

    if (player.isPlunging || player.hitstun || player.freeze) return;
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
    player.attackSequence = (player.attackSequence ?? 0) + 1;

    const dirX = direction === 'left' ? -1 : 1;
    const arm = scene.physics.add.sprite(player.x + dirX * PLUNGE_ARM_OFFSET, player.y, 'slateplunge');
    arm.body.setAllowGravity(false);
    arm.setFrame(0);
    arm.setFlipX(dirX < 0);
    scene.objs.add(arm);

    player.atk.stop();
    player.atk.setVisible(false);

    const hits = { drawOut: false, blade: false, drawIn: false };
    let missPlayed = false;

    const plungeUpdate = () => {
        if (!arm.active || !arm.anims) {
            finishPlunge();
            return;
        }
        arm.setPosition(player.x + dirX * PLUNGE_ARM_OFFSET, player.y);
        player.atk.setVisible(false);
        const frame = arm.anims.currentFrame?.index - 1;
        if (!(frame >= 0)) return;

        player.plungeBladeOut = frame >= PLUNGE_FRAMES.bladeOut && frame < PLUNGE_FRAMES.bladeIn;

        if (frame < PLUNGE_FRAMES.bladeOut) {
            if (!hits.drawOut) hits.drawOut = plungeHit(api, scene, player, target, dirX, PLUNGE_DRAW_HIT);
        } else if (player.plungeBladeOut) {
            if (!hits.blade && plungeHit(api, scene, player, target, dirX, PLUNGE_BLADE_HIT)) {
                hits.blade = true;
                markPlunged(scene, target);
                api.clearQueuedStunTimers(scene, player, target);
            }
        } else {
            if (!hits.blade && !missPlayed) {
                missPlayed = true;
                player.combo = 0;
                scene.sound.play('miss');
            }
            if (!hits.blade && !hits.drawIn) hits.drawIn = plungeHit(api, scene, player, target, dirX, PLUNGE_DRAW_HIT);
        }
    };

    const removePlungeUpdate = api.addSceneUpdateListener(scene, plungeUpdate);

    arm.play('slateplunge');
    player.afterimage = true;
    player.isPlunging = true;
    player.plungeBladeOut = false;

    let finished = false;
    const finishPlunge = () => {
        if (finished) return;
        finished = true;
        removePlungeUpdate();
        player.afterimage = false;
        player.isPlunging = false;
        player.plungeBladeOut = false;
        player.isAttacking = false;
        player.attackBypassesHitstun = false;
        api.hideAttackSprite(player);
        if (arm.active) arm.destroy();
    };
    arm.once('animationcomplete-slateplunge', finishPlunge);

    player.lastTap[direction] = currentTime;
}

const unlessPlunging = handler => (api, scene, attacker, ...args) => {
    if (attacker.isPlunging) return;
    return handler(api, scene, attacker, ...args);
};

export default {
    armColor: 0x2c2d31,
    hitSounds: {
        light: ['slatelight1', 'slatelight2'],
        finisher: 'slatepunch'
    },
    // His arms are drawn facing right.
    rightFacingAttackSprites: ['slateatk1'],
    textureAttackSpriteOffsets: {
        slateatk1: { x: 5, y: -10, up: { x: 28, y: 15 }, down: { x: -28, y: 15 } }
    },
    // Second hit of the combo punches with the other arm, like SWORDMAN's back swing.
    handleAttack: unlessPlunging((api, scene, attacker, victim) =>
        api.tryAttack(scene, attacker, victim,
            attacker.combo === 1 ? 'slateatksecond' : 'slateatk', 'slateatkthird')),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPlunge(api, scene, attacker, victim, direction, currentTime),
    update: updatePlungeMovement,
    handleNeutralSpecial: unlessPlunging(neutralSpecial),
    variantNeutralSpecials: { METAMORPHIC: unlessPlunging(neutralSpecial) },
    handleHorizantalTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600)),
    handleDownTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300)),
    handleUpTilt: unlessPlunging((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300))
};