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
    if (attacker.hitstun || attacker.freeze) return;

    

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

    plank.owner = attacker;
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

const MALLET_SWING = {
    range: 100,
    damage: 0.13,
    plankDamage: 0.5,
    hitstun: 600,
    hitFreeze: 100,
    sound: 'hammerhit',
    knockback: { x: 450, y: 300, spike: { x: 375, y: -200 } },
    decelerateAfter: 1000,
    missSound: 'miss'
};
const SLEDGEHAMMER_SWING = {
    range: 150,
    damage: 0.30,
    plankDamage: 0.30,
    hitstun: 400,
    hitFreeze: 100,
    sound: 'sledgehammerhit',
    knockback: { x: 1050, y: 500, spike: { x: 850, y: -200 } },
    decelerateAfter: 1000
};

function hardSwing(api, scene, attacker, target, animKey) {
    api.setAttackSprite(attacker, animKey);
    //short windup before the mallet connects, like veryhardSwing but much quicker.
    api.afterWindup(scene, attacker, 150, () => {
        if (!api.strike(scene, attacker, target, MALLET_SWING)) attacker.combo = 0;
        attacker.canAttack = false;
        api.clearQueuedStunTimers(scene, attacker, target);
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
    const windup = api.afterWindup(scene, attacker, 800, () => {
        //the delay makes slegdehammer man telegraphable and punishable, but also makes it feel like a big swing.
        const hit = attacker.variant === "SLEDGEHAMMER" &&
            api.strike(scene, attacker, target, SLEDGEHAMMER_SWING);
        if (!hit) attacker.combo = 0;
        attacker.canAttack = false;
        api.clearQueuedStunTimers(scene, attacker, target);
    }, {
        interruptible: true,
        onInterrupt: () => { attacker.combo = 0; }
    });
    scene.time.delayedCall(1500, () => {
        //obviously its a longer delay, its a sledgehammer. the player should be punished for using it.
        attacker.canAttack = true;
    });
    scene.time.delayedCall(750, () => {
        if (attacker.canAttack && !windup.interrupted) {
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
// Quickslam's first hit pops the target straight up for the follow-up jump.
function quickslamLaunchUp({ attacker, kb, damageScale, grounded, side }) {
    const dirY = attacker.lastDir.y === 0 ? -1 : attacker.lastDir.y; //always launch upwards if on same level
    if (grounded && dirY > 0.7) return { x: 50 * kb * side, y: -1500 * kb };
    return { x: 50 * kb * damageScale * attacker.lastDir.x, y: -1000 };
}
// The aerial follow-up spikes them back down.
function quickslamSpikeDown({ attacker, kb, damageScale, grounded, side }) {
    const dirY = attacker.lastDir.y === 0 ? 1 : attacker.lastDir.y; //special case
    if (grounded && dirY > 0.7) return { x: 200 * kb * side, y: -1500 * kb };
    return { x: 500 * kb * damageScale * attacker.lastDir.x, y: 1000 };
}

function quickslam1(api, scene, attacker, target, animKey = 'sledgehammerquickslam1') {
    attacker.quickslamJumpUntil = 0;
    attacker.quickslamJumpTarget = null;
    api.setAttackSprite(attacker, animKey);
    //quickslam is a special attack that does less knockback and damage then the normal attack.
    //This is only for sledgehammer.
    //Used as a quick move that contrast's sledgehammer's slow, telegraphed, and easily punishable attacks.
    const hit = attacker.variant === "SLEDGEHAMMER" && api.strike(scene, attacker, target, {
        range: 250,
        bypass: { ignoreCanAttack: true },
        damage: 0.25,
        hitstun: 400,
        hitFreeze: 100,
        knockback: quickslamLaunchUp,
        decelerateAfter: 1000,
        onHit: () => {
            attacker.quickslamJumpUntil = scene.time.now + 1000;
            attacker.quickslamJumpTarget = target;
            target.canAttack = false;
            scene.time.delayedCall(800, () => {
                target.canAttack = true;
            });
        }
    });
    if (!hit) attacker.combo = 0;
    api.clearQueuedStunTimers(scene, attacker, target);

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
    //The second quickslam is the aerial version, instead of sending the target flying up, it sends them flying down.
    scene.time.delayedCall(50, () => {
        const hit = api.strike(scene, attacker, target, {
            range: 200,
            bypass: { ignoreCanAttack: true, allowTargetBelow: true },
            damage: 0.25,
            hitstun: 400,
            hitFreeze: 100,
            sound: 'sledgehammerquickslam',
            knockback: quickslamSpikeDown,
            decelerateAfter: 1000,
            onHit: () => scene.sound.play('damn', { volume: 2 })
        });
        if (!hit) attacker.combo = 0;
        attacker.canAttack = true;
        api.clearQueuedStunTimers(scene, attacker, target);
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
    hitSounds: { light: 'hammerhit' },
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