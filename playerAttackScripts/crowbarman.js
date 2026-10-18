function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'crowbaratk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};
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


        if (api.attackIsElligible(attacker, target, 200) && !scene.finisherActive) {
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
            api.damagePlanksInAttack(attacker, 0.03 * api.getAttackDamageScale(attacker));
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
            attacker.atk.once(`animationcomplete-${animKey}`, () => {
                if (attacker.activeGrab && attacker.activeGrab.target === target) {
                    attacker.atk.setFrame(6);
                    attacker.atk.stop();
                }
            });

            /*const dirX = attacker.lastDir.x;

            let dirY = attacker.lastDir.y;
            if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

            //very stronk knockback
            //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
            if (target.body.touching.down && dirY > 0.7) {
                const randDir = Math.random() < 0.5 ? -1 : 1;
                api.applyKnockback(scene, target, (400 * target.KBmultiplier) * randDir, -200 * target.KBmultiplier);
            } else {
                api.applyKnockback(scene, target, (350 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (700 * target.KBmultiplier) * dirY);
            }*/ //its a grab, obviously no knockback.



            attacker.combo = 0;
            attacker.comboTimer = 0;
        } else {
            attacker.atk.once(`animationcomplete-${animKey}`, () => {
                scene.sound.play('miss');
                scene.time.delayedCall(300, () => {
                    api.hideAttackSprite(attacker);
                });
            });
        }
        api.startSideSpecialCooldown(attacker, currentTime, grabCD);

        attacker.canAttack = false;

        scene.time.delayedCall(400, () => {
            attacker.canAttack = true;
        });
        if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
        if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
        scene.time.delayedCall(500 * target.KBmultiplier, () => {
            if (!target.grabbedBy) target.hitstun = false;
        });
        scene.time.delayedCall(1000, () => {
            if (!target.grabbedBy && !scene.finisherActive) target.willDecelerate = true;
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