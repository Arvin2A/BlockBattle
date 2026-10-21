function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammeratk' : 'hammeratk';
    tryAttack3(api, scene, attacker, victim, animKey, animKey);
}

const neutralSpecial = () => {};
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
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );
    plank.destroy();
    scene.sound.play('plankbreak');
}


function steelPlank(
    api,
    scene,
    attacker,
    { allowChainsawMode = false } = {}
) {
    if (attacker.hitstun || attacker.freeze ||
        scene.finisherActive) return;

    

    if (!attacker.steelPlanks) {
        attacker.steelPlanks = [];
    }

    attacker.steelPlanks = attacker.steelPlanks.filter(p => p.active);

    const maxPlanks = attacker.variant === 'SLEDGEHAMMER' ? 1 : 2;

    if (attacker.steelPlanks.length >= maxPlanks) return;

    const offset = 60; // Horizontal distance from attacker
    const x = attacker.x + (attacker.lastDir.x >= 0 ? offset : -offset);
    const y = attacker.y - 75;

    const rotated = true;

    const createAnimation = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammerquickslam1' : 'hammeratk';
    api.setAttackSprite(attacker, createAnimation);

    const plankTexture = attacker.variant === 'SLEDGEHAMMER'
        ? 'strongsteel'
        : 'lightsteel';

    const plank = scene.physics.add.image(x, y, plankTexture);

    const plankSound = attacker.variant === 'SLEDGEHAMMER'
        ? 'thicksteelplank'
        : 'steelplank';

    scene.sound.play(plankSound);

    plank.setOrigin(0.5);
    plank.setAngle(90);
    plank.setDepth(3);


    plank.body.allowGravity = false;
    plank.setImmovable(true);

    plank.body.setSize(10, 200);
    plank.body.setOffset(95, 0);

    plank.health = attacker.variant === 'SLEDGEHAMMER' ? 0.50 : 0.13;
    plank.maxHealth = plank.health;

    scene.objs.add(plank);
    scene.planks.add(plank);
    attacker.steelPlanks.push(plank);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );

    const plankDeletionTime = attacker.variant === 'SLEDGEHAMMER' ? 20000 : 10000;
    plank.expireEvent = scene.time.delayedCall(plankDeletionTime, () => {
        destroyPlank(api, scene, plank);
    });
}

function hardSwing(api, scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    api.setAttackSprite(attacker, animKey);
    scene.time.delayedCall(250, () => {
        //short windup before the mallet connects, like veryhardSwing but much quicker.
        if (api.attackIsElligible(attacker, target, 100) && !scene.finisherActive) {
            target.hitstunUntil = 400 * target.KBmultiplier + scene.time.now;
            target.willDecelerate = false;
            target.freezeUntil = scene.time.now - 1;
            attacker.freezeUntil = scene.time.now - 1;
            attacker.willDecelerate = true;
            attacker.comboTimer = 600;
            target.KBmultiplier += 0.13 * api.getAttackDamageScale(attacker);
            api.damagePlanksInAttack(attacker, 0.5 * api.getAttackDamageScale(attacker));

            api.hitFreeze(scene, 100);
            if (attacker.name === "HAMMERMAN") {
                scene.sound.play('hammerhit');
            } else {
                scene.sound.play('anyhit');
            }
            const dirX = attacker.lastDir.x;

            let dirY = attacker.lastDir.y;
            if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

            //very stronk knockback
            //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
            if (target.body.touching.down && dirY > 0.7) {
                const randDir = Math.random() < 0.5 ? -1 : 1;
                api.applyKnockback(scene, target, (375 * target.KBmultiplier) * randDir, -200 * target.KBmultiplier);
            } else {
                api.applyKnockback(scene, target, (450 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (300 * target.KBmultiplier) * dirY);
            }
            attacker.combo = 0;
            attacker.comboTimer = 0;
        } else {
            attacker.combo = 0;
            scene.sound.play('miss');
        }
        attacker.canAttack = false;

        if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
        if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
        scene.time.delayedCall(600 * target.KBmultiplier, () => {
            target.hitstun = false;
        });
        scene.time.delayedCall(1000, () => {
            if (!scene.finisherActive) target.willDecelerate = true;
        });
    });
    scene.time.delayedCall(250, () => {
        api.hideAttackSprite(attacker);
    });
    scene.time.delayedCall(550, () => {
        attacker.canAttack = true;
    });
}
function veryhardSwing(api, scene, attacker, target, animKey) {
    //Hardest swing, only used for the sledgehammer variant of hammerman.
    api.setAttackSprite(attacker, animKey);
    //getting hit during the windup resets the swing animation, so the swing has to be cancelled too
    //otherwise it lands invisibly if the hitstun ends before the windup does.
    let interrupted = false;
    const removeInterruptCheck = api.addSceneUpdateListener(scene, () => {
        if (attacker.hitstun) interrupted = true;
    });
    scene.time.delayedCall(800, () => {
        removeInterruptCheck();
        if (interrupted) {
            attacker.combo = 0;
            return;
        }
        //the delay makes slegdehammer man telegraphable and punishable, but also makes it feel like a big swing.
        if (api.attackIsElligible(attacker, target, 150) && !scene.finisherActive && attacker.variant === "SLEDGEHAMMER") {
            api.damagePlanksInAttack(attacker, 0.30);
            target.hitstunUntil = 400 * target.KBmultiplier + scene.time.now;
            target.willDecelerate = false;
            target.freezeUntil = scene.time.now - 1;
            attacker.freezeUntil = scene.time.now - 1;
            attacker.willDecelerate = true;
            attacker.comboTimer = 600;
            target.KBmultiplier += 0.30 * api.getAttackDamageScale(attacker);
            api.hitFreeze(scene, 100);
            if (attacker.name === "HAMMERMAN" && attacker.variant === "SLEDGEHAMMER") {
                scene.sound.play('sledgehammerhit');
            } else {
                scene.sound.play('anyhit');
            }
            const dirX = attacker.lastDir.x;

            let dirY = attacker.lastDir.y;
            if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

            //very stronk knockback
            //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
            if (target.body.touching.down && dirY > 0.7) {
                const randDir = Math.random() < 0.5 ? -1 : 1;
                api.applyKnockback(scene, target, (850 * target.KBmultiplier) * randDir, -200 * target.KBmultiplier);
            } else {
                api.applyKnockback(scene, target, (1050 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (500 * target.KBmultiplier) * dirY);
            }
            attacker.combo = 0;
            attacker.comboTimer = 0;
        } else {
            attacker.combo = 0;
        }
        attacker.canAttack = false;

        if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
        if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
        scene.time.delayedCall(400 * target.KBmultiplier, () => {
            target.hitstun = false;
        });
        scene.time.delayedCall(1000, () => {
            if (!scene.finisherActive) target.willDecelerate = true;
        });
    });
    scene.time.delayedCall(1500, () => {
        //obviously its a longer delay, its a sledgehammer. the player should be punished for using it.
        attacker.canAttack = true;
    });
    scene.time.delayedCall(750, () => {
        if (attacker.canAttack && !interrupted) {
            scene.sound.play('sledgewhoosh');
        }
    });


}
function tryAttack3(api, scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.variant == 'MALLET') {
        hardSwing(api, scene, attacker, target, animKey);
    } else if (attacker.variant == 'SLEDGEHAMMER') {
        veryhardSwing(api, scene, attacker, target, animKey);
    }


    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
function tryRepair(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const repairCD = player.dirSpecialCooldown;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {

        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        // One heal swing covers all 3 hits; the hits themselves are invisible.
        api.setAttackSprite(player, "hammeratkheal");
        player.isUsingSideSpecial = false;

        const spawnRepairBox = () => {
            const box = scene.add.rectangle(
                player.x,
                player.y,
                50,
                50,
                0x00ff00
            );
            scene.objs.add(box);
            scene.tweens.add({
                targets: box,
                alpha: 0,
                duration: 100,
                onComplete: () => {
                    box.destroy();
                }
            });
        };

        // Windup before the first hit lands.
        scene.time.delayedCall(300, () => {
            scene.sound.play("repair");

            const hasAttacked = api.pushAttack(scene, player, target, null);
            if (hasAttacked) {
                player.KBmultiplier -= 0.25;
            } else {
                player.KBmultiplier -= 0.075;
            }
            spawnRepairBox();

            scene.time.delayedCall(100, () => {
                scene.sound.play("repair");


                const hasAttacked1 = api.pushAttack(scene, player, target, null);
                if (hasAttacked1) {
                    player.KBmultiplier -= 0.25;
                } else {
                    player.KBmultiplier -= 0.075;
                }
                spawnRepairBox();

                scene.time.delayedCall(150, () => {
                    scene.sound.play("repair");


                    const hasAttacked2 = api.pushAttack(scene, player, target, null);
                    if (hasAttacked2) {
                        player.KBmultiplier -= 0.25;
                    } else {
                        player.KBmultiplier -= 0.075;
                    }
                    spawnRepairBox();

                });
            });
        });
        api.startSideSpecialCooldown(player, currentTime, repairCD);
    }

    player.lastTap[direction] = currentTime;
}
function quickslam1(api, scene, attacker, target, animKey = 'sledgehammerquickslam1') {
    attacker.quickslamJumpUntil = 0;
    attacker.quickslamJumpTarget = null;
    api.setAttackSprite(attacker, animKey);
    //quickslam is a special attack that does less knockback and damage then the normal attack.
    //This is only for sledgehammer.
    //Used as a quick move that contrast's sledgehammer's slow, telegraphed, and easily punishable attacks.
    if (api.attackIsElligible(attacker, target, 250, false) && !scene.finisherActive && attacker.variant === "SLEDGEHAMMER") {
        attacker.quickslamJumpUntil = scene.time.now + 1000;
        attacker.quickslamJumpTarget = target;
        target.hitstunUntil = 400 * target.KBmultiplier + scene.time.now;
        target.canAttack = false;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.25 * api.getAttackDamageScale(attacker);
        api.damagePlanksInAttack(attacker, 0.25 * api.getAttackDamageScale(attacker));
        api.hitFreeze(scene, 100);
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -1; //always launch upwards if on same level


        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            api.applyKnockback(scene, target, (50 * target.KBmultiplier) * randDir, -1500 * target.KBmultiplier);
        } else {
            api.applyKnockback(scene, target, (50 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (1000) * -1);
        }
        scene.time.delayedCall(800, () => {
            target.canAttack = true;
        });
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
    }

    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(400 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        if (!scene.finisherActive) target.willDecelerate = true;
    });
    scene.sound.play('sledgewhoosh');
    scene.time.delayedCall(203, () => {
        api.spawnDirtBurst(
            scene,
            attacker.x + (attacker.lastDir.x * 150),
            attacker.y,
            28,
            5,
            6,
            1.5,
            [0xff6a00, 0xff8c00, 0xffb000],
            1000,
            1500,
            true
        );
        scene.sound.play('sledgehammerquickslam');
    });

}
function tryQuickslamJump(api, scene, attacker, currentTime) {
    if (
        attacker.variant !== 'SLEDGEHAMMER' ||
        !attacker.quickslamJumpTarget ||
        currentTime > attacker.quickslamJumpUntil
    ) {
        return false;
    }

    const target = attacker.quickslamJumpTarget;
    attacker.quickslamJumpUntil = 0;
    attacker.quickslamJumpTarget = null;

    attacker.canAttack = true;

    const startX = attacker.x;
    const startY = attacker.y;
    const endX = target.x - (attacker.lastDir.x * 100);
    const endY = target.y - 200;
    const movement = { progress: 0 };
    const originalGravity = attacker.body.allowGravity;
    const wasUsingSideSpecial = attacker.isUsingSideSpecial;
    const wasDecelerating = attacker.willDecelerate;

    attacker.setVelocity(0, 0);
    attacker.body.allowGravity = false;
    attacker.isUsingSideSpecial = true;
    attacker.willDecelerate = false;


    scene.tweens.add({
        targets: movement,
        progress: 1,
        duration: 200,
        ease: 'Linear',
        onUpdate: () => {
            if (!attacker.active) return;
            attacker.setPosition(
                Phaser.Math.Linear(startX, endX, movement.progress),
                Phaser.Math.Linear(startY, endY, movement.progress)
            );
        },
        onComplete: () => {
            if (!attacker.active) return;
            attacker.setPosition(endX, endY);
            attacker.setVelocity(0, 0);
            attacker.body.allowGravity = originalGravity;
            attacker.isUsingSideSpecial = wasUsingSideSpecial;
            attacker.willDecelerate = wasDecelerating;
            quickslam2(api, scene, attacker, target);

        }
    });

    return true;
}
function quickslam2(api, scene, attacker, target, animKey = 'sledgehammerquickslam2') {
    api.setAttackSprite(attacker, animKey);
    //quickslam is a special attack that does less knockback and damage then the normal attack.
    //This is only for sledgehammer.
    //Used as a quick move that contrast's sledgehammer's slow, telegraphed, and easily punishable attacks.
    //The second quickslam is the aerial version, instead of sending the target flying up, it sends them flying down.
    scene.time.delayedCall(50, () => {
        if (api.attackIsElligible(attacker, target, 200, false, true)) {
            target.hitstunUntil = 400 * target.KBmultiplier + scene.time.now;
            target.willDecelerate = false;
            target.freezeUntil = scene.time.now - 1;
            attacker.freezeUntil = scene.time.now - 1;
            attacker.willDecelerate = true;
            attacker.comboTimer = 600;
            target.KBmultiplier += 0.25 * api.getAttackDamageScale(attacker);
            api.damagePlanksInAttack(attacker, 0.25 * api.getAttackDamageScale(attacker));
            scene.sound.play('sledgehammerquickslam');
            scene.sound.play('damn', { volume: 2 });
            api.hitFreeze(scene, 100);
            const dirX = attacker.lastDir.x;

            let dirY = attacker.lastDir.y;
            if (dirY === 0) dirY = 1; //special case

            //very stronk knockback
            //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
            if (target.body.touching.down && dirY > 0.7) {
                const randDir = Math.random() < 0.5 ? -1 : 1;
                api.applyKnockback(scene, target, (200 * target.KBmultiplier) * randDir, -1500 * target.KBmultiplier);
            } else {
                api.applyKnockback(scene, target, (500 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (1000));
            }
            attacker.combo = 0;
            attacker.comboTimer = 0;
        } else {
            attacker.combo = 0;
        }
        attacker.canAttack = true;

        if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
        if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
        scene.time.delayedCall(400 * target.KBmultiplier, () => {
            target.hitstun = false;
        });
        scene.time.delayedCall(1000, () => {
            if (!scene.finisherActive) target.willDecelerate = true;
        });
    });
}
function tryQuickslam(api, scene, attacker, target, direction, currentTime) {
    const dtapDelay = 250;
    const slamCD = attacker.dirSpecialCooldown;

    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;

    if (currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot) {
        quickslam1(api, scene, attacker, target);
        api.startSideSpecialCooldown(attacker, currentTime, slamCD);
    }
    attacker.lastTap[direction] = currentTime;
}

export default {
    // Mallet swing sheets are drawn facing right and need their own nudge so
    // the arm sits behind the body with the handle out the front.
    rightFacingAttackSprites: ['hammeratk', 'hammeratkheal'],
    textureAttackSpriteOffsets: {
        hammeratk: { x: -52, y: 20 },
        hammeratkheal: { x: -6, y: -5 }
    },
    handleAttack: attack,
    tryQuickslamJump,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        attacker.variant === 'SLEDGEHAMMER'
            ? tryQuickslam(api, scene, attacker, victim, direction, currentTime)
            : tryRepair(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: {
        MALLET: steelPlank,
        SLEDGEHAMMER: steelPlank
    },
    handleHorizantalTilt: attack,
    handleDownTilt: attack,
    handleUpTilt: attack
};