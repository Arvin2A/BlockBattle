function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'scytheatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
// The standard finisher with a steeper, harder launch and no hitstop.
const SLAM_FINISHER = {
    hitFreeze: 0,
    knockback: { x: 350, y: 700, onDown: 'popUp' }
};
function slamThirdAttack(api, scene, attacker, target, animKey) {
    api.thirdAttack(scene, attacker, target, animKey, SLAM_FINISHER);
}
function tryAttack2(api, scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        slamThirdAttack(api, scene, attacker, target, thirdAnimKey);
    } else {
        if (attacker.horizontalMovementActive) {
            api.pushAttack(scene, attacker, target, animKey);
        } else {
            api.attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
function tryMow(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const mowCD = player.dirSpecialCooldown;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.isUsingSideSpecial = true;
        player.lastDir = direction === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
        api.setAttackSprite(player, 'scytheatktilt');
        player.atk.setScale(3);

        // Mowing through grass doubles the hit.
        const inGrass = player.inGrass || target.inGrass;
        const knockbackScale = inGrass ? 2 : 1;
        api.strike(scene, player, target, {
            range: 250,
            damage: 0.15 * knockbackScale,
            plankDamage: 0.15,
            hitstun: 450,
            hitstunGrowth: false,
            hitFreeze: 70,
            sound: 'slice',
            knockback: () => ({ x: 850 * knockbackScale * player.lastDir.x, y: -150 * knockbackScale }),
            decelerateAfter: 450,
            resetCombo: false,
            onHit: () => target.flash(),
            missSound: 'miss'
        });

        api.cutNearbyGrass(scene, player.x, player.y + 20, 180, player);
        api.startSideSpecialCooldown(player, currentTime, mowCD);
        player.canAttack = false;
        scene.time.delayedCall(350, () => {
            player.canAttack = true;
            player.isUsingSideSpecial = false;
            player.atk.setScale(1);
            api.hideAttackSprite(player);
        });
    }
    player.lastTap[direction] = currentTime;
}
function tryMowLegacy(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const mowCD = player.dirSpecialCooldown;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        //summon a mowing scythe
        player.isUsingSideSpecial = true;
        player.isAttacking = true;
        player.hasHitSideSpecial = false;

        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        const fakescythe = scene.add.image(player.x, player.y, 'whitescythe');
        fakescythe.setScale(2);


        scene.physics.add.existing(fakescythe);

        const speed = 1500;

        //set speed
        fakescythe.body.setVelocity(
            player.lastDir.x * speed,
            -100
        );
        //most w thing here
        fakescythe.body.allowGravity = false;
        scene.objs.add(fakescythe);
        const removePlatformColliders = api.addProjectilePlatformColliders(
            scene,
            fakescythe,
            player
        );

        // spin
        const spinSpeed =
            player.lastDir.x > 0 ? 0.45 : -0.45;

        let returning = false;

        scene.time.delayedCall(550, () => {
            returning = true;
        });
        let canhit = true;
        let mowsound = scene.sound.add('twirl', {
            loop: true
        });
        mowsound.play();
        player.isUsingSideSpecial = false;
        let dir = (direction === 'left') ? -1 : 1
        scene.physics.add.overlap(fakescythe, target, () => {
            if (player.hasHitSideSpecial) return;
            if (!canhit) return;
            target.hitstunUntil = 100 + scene.time.now;
            const slash = scene.add.image(target.x, target.y, 'slasheffect');
            slash.setScale(1.5);
            scene.tweens.add({
                targets: slash,
                alpha: 0,
                duration: 100,
                onComplete: () => slash.destroy()
            });
            canhit = false;
            scene.time.delayedCall(40, () => {
                canhit = true;
            });
            if (target.revokeMowStun) {
                scene.time.removeEvent(target.revokeMowStun);
            }

            const mowStunToken = ++target.mowStunToken;
            const mowStunDuration = 1000;

            target.revokeMowStun = scene.time.delayedCall(mowStunDuration, () => {
                if (target.mowStunToken !== mowStunToken) return;
                player.hasHitSideSpecial = true;
                target.willDecelerate = true;
                target.revokeMowStun = null;
            });



            scene.sound.play('slash');
            target.KBmultiplier += 0.08 * api.getAttackDamageScale(player);
            api.applyKnockback(scene, target, 500 * dir, 300);
            target.flash();

        });
        const scytheUpdate = () => {

            if (!fakescythe.active) return;

            fakescythe.rotation += spinSpeed;

            // boomerang return
            if (returning) {
                dir = dir * -1;
                //nearest distance calculation to the player
                const dx = player.x - fakescythe.x;
                const dy = player.y - fakescythe.y;

                const dist = Math.hypot(dx, dy);

                // home toward player
                fakescythe.body.setVelocity(
                    (dx / dist) * 1500,
                    (dy / dist) * 1500
                );

                // reached player
                if (dist < 60) {

                    removeScytheUpdate();
                    removePlatformColliders();

                    fakescythe.destroy();

                    player.isUsingSideSpecial = false;
                    player.isAttacking = false;

                    mowsound.stop();
                }
            }
        };

        const removeScytheUpdate = api.addSceneUpdateListener(scene, scytheUpdate);

        // emergency cleanup
        scene.time.delayedCall(3000, () => {

            if (fakescythe.active) {

                removeScytheUpdate();
                removePlatformColliders();

                fakescythe.destroy();

                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
        });

        api.startSideSpecialCooldown(player, currentTime, mowCD);

    }

    player.lastTap[direction] = currentTime;

}

export default {
    hitSounds: {
        light: ['axeslash1', 'axeslash2'],
        finisher: 'scythethirdhitsfx'
    },
    handleAttack: (api, scene, attacker, victim) =>
        tryAttack2(api, scene, attacker, victim, 'scytheatk', 'scytheatk'),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryMow(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { LANDSCAPER: neutralSpecial },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};