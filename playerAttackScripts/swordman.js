function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'swordatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};

export function NeutralPoke() {
    
}

function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'DAGGER' ? 'daggeratk' : 'swordatk';
    if (animKey == 'daggeratk') {
        tryDaggerAttack(api, scene, attacker, victim, animKey, animKey);
    } else {
        // Second hit of the combo swings back with swordatksecond.
        const comboAnimKey = attacker.combo === 1 ? 'swordatksecond' : animKey;
        api.tryAttack(scene, attacker, victim, comboAnimKey, 'swordatkthird');
    }
}
function daggerattack(api, scene, attacker, target, animKey) {
    //the core attack function that is used as of now
    if (!attacker.canAttack || attacker.hitstun || scene.finisherActive) return;

    api.setAttackSprite(attacker, animKey);

    let hit = false;


    if (api.attackIsElligible(attacker, target, 85)) {
        hit = true;

        target.hitstunUntil = 350 + scene.time.now;;
        target.freezeUntil = 350 + scene.time.now;;
        attacker.freezeUntil = 200 + scene.time.now;;
        attacker.willDecelerate = false;
        attacker.comboTimer = 600;

        const dirX = attacker.lastDir.x;
        const dirY = attacker.lastDir.y;
        scene.time.delayedCall(50, () => {
            api.applyKnockback(scene, target, 10 * dirX, 100 * dirY);
        });

    }

    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
        api.applyKnockback(scene, target, 0, 0);
        attacker.setVelocityX(0);
        attacker.setVelocityY(0);
        // Attack sound
        if (attacker.name === "SWORDMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'swordslash1' : 'swordslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "AXEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SLATEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'slatelight1' : 'slatelight2';
            scene.sound.play(soundID);
        } else if (attacker.name === "SCYTHEMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'axeslash1' : 'axeslash2';
            scene.sound.play(soundID);
        } else if (attacker.name === "CROWBARMAN") {
            const randomNumber = Math.round(Math.random());
            const soundID = randomNumber === 0 ? 'crowbarclang1' : 'crowbarclang2';
            scene.sound.play(soundID);
        } else {
            scene.sound.play('anyhit');
        }
        target.KBmultiplier += 0.02 * api.getAttackDamageScale(attacker); // Increase KB multiplier for third hit
        api.damagePlanksInAttack(attacker, 0.02 * api.getAttackDamageScale(attacker));


    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }

    if (attacker.combo >= 6) {
        attacker.combo = 0;
    }

    scene.time.delayedCall(50, () => {
        api.hideAttackSprite(attacker);
    });
    api.queueStunRelease(scene, attacker, target, 0, 350);
    return hit;
}
function tryDaggerAttack(api, scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 5) {
        //three more hits for dagger
        api.thirdAttack(scene, attacker, target, thirdAnimKey);
    } else {
        if (attacker.horizontalMovementActive) {
            api.pushAttack(scene, attacker, target, animKey);
        } else {
            daggerattack(api, scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 100; // Attack cooldown
}
function lungePush(api, scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    api.setAttackSprite(attacker, animKey);
    if (api.attackIsElligible(attacker, target, 155, false) && !scene.finisherActive) {
        target.hitstunUntil = 300 * target.KBmultiplier + scene.time.now;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;
        //fix for lunge
        attacker.hasHitSideSpecial = true;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.30 * api.getAttackDamageScale(attacker);
        api.damagePlanksInAttack(attacker, 0.3 * api.getAttackDamageScale(attacker));
        api.hitFreeze(scene);
        scene.sound.play('swordslash1');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            api.applyKnockback(scene, target, (275 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * randDir, -200 * target.KBmultiplier);
        } else {
            api.applyKnockback(scene, target, (250 * target.KBmultiplier * api.getAttackDamageScale(attacker)) * dirX, (500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;

    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        api.hideAttackSprite(attacker);
    });
    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(300 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        if (!scene.finisherActive) target.willDecelerate = true;
    });

}
function quickstepAttack(api, scene, attacker, target, animKey) {
    // Hits in the direction of the dash.
    api.setAttackSprite(attacker, animKey);

    const attackDirX = Math.sign(attacker.body.velocity.x) || attacker.lastDir.x || 1;

    const originalDirX = attacker.lastDir.x;
    attacker.lastDir.x = attackDirX;

    const eligible = api.attackIsElligible(attacker, target, 150, false);

    attacker.lastDir.x = originalDirX;

    if (eligible && !scene.finisherActive) {
        target.hitstunUntil = 300 * target.KBmultiplier + scene.time.now;
        target.willDecelerate = false;
        target.freezeUntil = scene.time.now - 1;
        attacker.freezeUntil = scene.time.now - 1;

        attacker.hasHitSideSpecial = true;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;

        target.KBmultiplier += 0.15 * api.getAttackDamageScale(attacker);
        api.damagePlanksInAttack(attacker, 0.15 * api.getAttackDamageScale(attacker));

        api.hitFreeze(scene);
        scene.sound.play('swordslash1');

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5;

        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            api.applyKnockback(
                scene,
                target,
                137.5 * target.KBmultiplier * api.getAttackDamageScale(attacker) * randDir,
                -200 * target.KBmultiplier
            );
        } else {
            api.applyKnockback(
                scene,
                target,
                125 * target.KBmultiplier * api.getAttackDamageScale(attacker) * attackDirX,
                200 * target.KBmultiplier * dirY
            );
        }

        attacker.combo = 0;
        attacker.comboTimer = 0;
    }

    attacker.canAttack = false;

    scene.time.delayedCall(250, () => {
        api.hideAttackSprite(attacker);
    });

    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });

    if (attacker.revokeAggressorStun) {
        scene.time.removeEvent(attacker.revokeAggressorStun);
    }
    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
    }

    scene.time.delayedCall(300 * target.KBmultiplier, () => {
        target.hitstun = false;
    });

    scene.time.delayedCall(1000, () => {
        if (!scene.finisherActive) target.willDecelerate = true;
    });
}
function tryQuickstep(api, scene, player, direction, target, currentTime) {
    // QUICKSTEP: DAGGER-exclusive double-tap dash. A shorter LUNGE that passes
    // straight through the other player (see clipThroughPlayers in main.js).

    const dtapDelay = 250;
    const quickstepCd = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;
    if (direction !== 'left' && direction !== 'right') return;

    if (
        currentTime - player.lastTap[direction] < dtapDelay ||
        player.isBot
    ) {
        api.setAttackSprite(player, 'daggeratk');
        player.atk.y = player.y + player.lastDir.y * 50;
        player.atk.setAngle(0);
        player.isUsingSideSpecial = true;
        player.afterimage = true;
        player.hasHitSideSpecial = false;
        player.clipThroughPlayers = true;
        player.invincibleUntil = currentTime + 425;

        // Same speed as LUNGE for half as long.
        const qspeed = 1200;
        player.setVelocityX(direction === 'left' ? -qspeed : qspeed);

        api.startSideSpecialCooldown(player, currentTime, quickstepCd);
        scene.sound.play('teleport');

        scene.time.delayedCall(150, () => {
            player.isUsingSideSpecial = false;
            player.afterimage = false;
            player.clipThroughPlayers = false;
        });

        scene.time.delayedCall(250, () => {
            api.hideAttackSprite(player);
        });
    }

    player.lastTap[direction] = currentTime;
}
function tryLunge(api, scene, player, direction, currentTime, animKey = 'swordatk') {
    //LUNGE: exclusive for the swordsman, this is performed by double tapping left or right
    // It launches the player forward in the direction they are lunging in
    //Why do this? Using arrow keys and right shift is harder than using WASD and E, back when swordman and axeman's player was hardcoded.
    //Basically it balances out the controls.
    const dtapDelay = 250;
    const lungecd = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        api.setAttackSprite(player, animKey);
        player.atk.y = player.y + player.lastDir.y * 50 + api.getAttackSpriteOffset(player).y;
        player.isUsingSideSpecial = true;
        player.afterimage = true;
        player.hasHitSideSpecial = false;

        if (player.lastDir.y < 0) {
            player.atk.setAngle(90);
        } else if (player.lastDir.y > 0) {
            player.atk.setAngle(-90);
        } else {
            player.atk.setAngle(0);
        }
        const lspeed = 600;
        if (direction === 'left') {
            player.setVelocityX(-lspeed);
        } else if (direction === 'right') {
            player.setVelocityX(lspeed);
        }

        api.startSideSpecialCooldown(player, currentTime, lungecd);
        scene.sound.play('lunge');

        scene.time.delayedCall(500, () => {
            player.isUsingSideSpecial = false;
            player.afterimage = false;
        });

        scene.time.delayedCall(400, () => {
            api.hideAttackSprite(player);
        });
    }
    player.lastTap[direction] = currentTime;

}

export default {
    // Nudges the attack sprite: x along the facing direction, y down the screen.
    variantAttackSpriteOffsets: { LONGSWORD: { x: 0, y: 8 } },
    handleAttack: (api, scene, attacker, victim) =>
        attack(api, scene, attacker, victim),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) => {
        if (attacker.variant === 'DAGGER') {
            tryQuickstep(api, scene, attacker, direction, victim, currentTime);
        } else {
            tryLunge(api, scene, attacker, direction, currentTime);
        }
    },
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { LONGSWORD: neutralSpecial },
    handleDirSpecialAttack: (api, scene, attacker, victim) => {
        if (api.distanceBetween(attacker, victim) > 150) return;
        if (attacker.variant === 'DAGGER') {
            quickstepAttack(api, scene, attacker, victim, 'daggeratk');
        } else {
            lungePush(api, scene, attacker, victim, 'swordatkthird');
        }
    },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};