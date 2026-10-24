function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'crowbaratk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
const GRAB_WINDUP_MS = 250;
function tryGrab(api, scene, attacker, target, direction, currentTime, animKey = 'crowbargrab') {
    //Exclusive to the crowbarman, this attack initiates a grab on the target
    //When the target is grabbed, they are unable to move or attack, they will be hooked on the crowbar for 3 seconds before released
    //However, if the attacker presses the attack button again, they will swing the target away with a strong knockback
    //Longest range but weakest attack in the game, however it can easily turn the tides of a match.
    const dtapDelay = 250;
    const grabCD = attacker.dirSpecialCooldown;
    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;

    if (currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot) {

        api.setAttackSprite(attacker, animKey);
        attacker.isUsingSideSpecial = true
        attacker.isUsingSideSpecial = false;
        api.startSideSpecialCooldown(attacker, currentTime, grabCD);
        attacker.canAttack = false;

        let interrupted = false;
        const removeInterruptCheck = api.addSceneUpdateListener(scene, () => {
            if (attacker.hitstun) interrupted = true;
        });
        scene.time.delayedCall(GRAB_WINDUP_MS + 400, () => {
            attacker.canAttack = true;
        });
        scene.time.delayedCall(GRAB_WINDUP_MS, () => {
            removeInterruptCheck();
            if (interrupted) {
                api.hideAttackSprite(attacker);
                return;
            }
            const grabAnimPlaying = attacker.atk.anims.isPlaying && attacker.atk.anims.currentAnim?.key === animKey;

            //canAttack is already off for the windup, so skip that check; the interrupt check covers hitstun.
            const grabLands = api.attackIsElligible(attacker, target, 200, { ignoreCanAttack: true });
            attacker.attackBypassesHitstun = false;
            api.damagePlanksInAttack(attacker, 0.03 * api.getAttackDamageScale(attacker));
            if (grabLands) {
                const grabOffset = {
                    x: Math.sign(target.x - attacker.x) * 150,
                    y: Math.min(target.y - attacker.y, 0)
                };
                target.hitstunUntil = 3000 + scene.time.now;
                target.hitstun = true;
                target.willDecelerate = false;
                target.freezeUntil = scene.time.now - 1;
                attacker.freezeUntil = scene.time.now - 1;
                attacker.willDecelerate = true;
                attacker.comboTimer = 600;
                target.KBmultiplier += 0.03 * api.getAttackDamageScale(attacker);
                //weak damage, but the target is grabbed and unable to move or attack for 3 seconds
                scene.sound.play('grab');
                target.body.allowGravity = false;
                target.setVelocity(0, 0);
                target.grabbedBy = attacker;
                attacker.activeGrab = {
                    target,
                    offset: grabOffset,
                    atkOffset: {
                        x: attacker.atk.x - attacker.x,
                        y: attacker.atk.y - attacker.y
                    },
                    atkFlipX: attacker.atk.flipX,
                    atkAngle: attacker.atk.angle,
                    releaseEvent: scene.time.delayedCall(3000, () => releaseGrab(api, scene, attacker, scene.time.now, false))
                };
                const holdGrabPose = () => {
                    if (attacker.activeGrab && attacker.activeGrab.target === target) {
                        attacker.atk.setVisible(true);
                        attacker.atk.setFrame(6);
                        attacker.atk.stop();
                    }
                };
                if (grabAnimPlaying) {
                    attacker.atk.once(`animationcomplete-${animKey}`, holdGrabPose);
                } else {
                    holdGrabPose();
                }

                attacker.combo = 0;
                attacker.comboTimer = 0;
            } else {
                const missGrab = () => {
                    scene.sound.play('miss');
                    scene.time.delayedCall(300, () => {
                        api.hideAttackSprite(attacker);
                    });
                };
                if (grabAnimPlaying) {
                    attacker.atk.once(`animationcomplete-${animKey}`, missGrab);
                } else {
                    missGrab();
                }
            }

            if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
            if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
            scene.time.delayedCall(500 * target.KBmultiplier, () => {
                if (!target.grabbedBy) target.hitstun = false;
            });
            scene.time.delayedCall(1000, () => {
                if (!target.grabbedBy) target.willDecelerate = true;
            });
        });
    }
    attacker.lastTap[direction] = currentTime;

}
function releaseGrab(api, scene, attacker, currentTime, fling = true) {
    const grab = attacker.activeGrab;
    if (!grab) return false;

    const target = grab.target;
    if (grab.releaseEvent) grab.releaseEvent.remove(false);
    attacker.activeGrab = null;
    target.grabbedBy = null;
    target.body.allowGravity = true;
    target.hitstun = false;
    target.hitstunUntil = 0;
    target.freezeUntil = 0;
    target.willDecelerate = true;
    api.hideAttackSprite(attacker);

    api.startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);



    if (fling) {
        const flingDirection = attacker.lastDir.x || (Math.random() < 0.5 ? -1 : 1);
        target.hitstunUntil = 500 * target.KBmultiplier + scene.time.now;
        api.applyKnockback(scene, target, 1000 * flingDirection, -200);
    } else {
        target.setVelocity(0, 0);
    }
    return true;


}

export default {
    hitSounds: {
        light: ['crowbarclang1', 'crowbarclang2'],
        finisher: 'crowbarhit'
    },
    handleAttack: (api, scene, attacker, victim) => {
        if (attacker.activeGrab) {
            releaseGrab(api, scene, attacker, scene.time.now, true);
        } else {
            api.tryAttack(scene, attacker, victim, 'crowbaratk', 'crowbaratk');
        }
    },
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryGrab(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { HOOKER: neutralSpecial },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};