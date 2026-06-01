const finalplungeMultiplier = 1.0;
export function attackIsElligible(attacker, target, range = 100) {
    if (!attacker.canAttack || attacker.hitstun) return false;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return false; // Too far away
    target.flash();
    console.log("IN RANGE");

    const dirToTargetX = dx / distance;
    const dirToTargetY = dy / distance;

    const dot = dirToTargetX * attacker.lastDir.x + dirToTargetY * attacker.lastDir.y;
    //dot product checks if the attacker is facing the target, which is the general rule for attacks in this game
    //However, to add some depth and counterplay, I added two custom rules for fun
    const isFacingUp = attacker.lastDir.y < -0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    const isFacingDown = attacker.lastDir.y > 0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    //technically, decimal values are useless, because the values are only 0, 1, or -1
    //but this just adds a bit of leniency just in case we add mobile or controller support later where the input might not be perfectly digital
    const isTargetAbove = dy < -25;
    const isAttackerAbove = dy > 25;
    const una = isAttackerAbove && isFacingUp; // CUSTOM RULE: Prevent attacking upwards and pulling the player under the attacker
    const una2 = isFacingDown && isTargetAbove; // SECOND CUSTOM RULE: Prevent attacking downwards if the target is above also to avoid pinning
    if (una) return false;
    if (una2) return false;
    //if (dot > 0.7 || isFacingUp || isTargetAbove) target.flash();
    return dot > 0.7 || isFacingUp || isTargetAbove; // Attack range and facing target
}
function hitFreeze(scene, ms = 50) {
    scene.physics.world.pause();
    if (ms >= 200) {
        scene.baseZoom = 1.4;
    }  
    if (ms >= 100) {
        const flash = scene.add.rectangle(
            500,
            300,
            1000,
            600,
            0xff0000,
            0.25
        );
        scene.hud.add(flash);

        flash.setDepth(9999);
        scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: ms,
            onComplete: () => flash.destroy()
        });
    }
    scene.time.delayedCall(ms, () => {
        scene.physics.world.resume();
        scene.baseZoom = 1
    });
}
export function setAttackSprite(attacker, animKey) {
    attacker.atk.setVisible(true);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50;

    if (animKey == "scytheatktilt") {
        attacker.atk.setFlipX(attacker.lastDir.x < 0);

    } else {
        attacker.atk.setFlipX(-attacker.lastDir.x < 0);
    }
    

    if (attacker.lastDir.y < 0) {
        attacker.atk.setAngle(90);
    } else if (attacker.lastDir.y > 0) {
        attacker.atk.setAngle(-90);
    } else {
        attacker.atk.setAngle(0);
    }
    //animation

    attacker.atk.setFrame(0);
    attacker.atk.play(animKey, true);
}
export function attack(scene, attacker, target, animKey) {
    //the core attack function that is used as of now
    if (!attacker.canAttack || attacker.hitstun) return;

    setAttackSprite(attacker, animKey);

    let hit = false;


    if (attackIsElligible(attacker, target)) {
        hit = true;

        target.hitstun = true;
        target.freeze = true;
        attacker.freeze = true;
        attacker.willDecelerate = false;
        attacker.comboTimer = 600;

        const dirX = attacker.lastDir.x;
        const dirY = attacker.lastDir.y;
        scene.time.delayedCall(50, () => {
            console.log(dirX, dirY);
            target.setVelocityX(100 * dirX);
            target.setVelocityY(100 * dirY);
        });

    }

    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
        target.setVelocityX(0);
        target.setVelocityY(0);
        attacker.setVelocityX(0);
        attacker.setVelocityY(0);
        scene.sound.play('anyhit');
        target.KBmultiplier += 0.03 * attacker.baseDamageScale; // Increase KB multiplier for third hit
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }

    if (attacker.combo >= 3) {
        attacker.combo = 0;
    }

    attacker.canAttack = false;

    scene.time.delayedCall(150, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    attacker.revokeAggressorStun = scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
        attacker.freeze = false;
        attacker.willDecelerate = true;
    });
    target.revokeVictimStun = scene.time.delayedCall(500, () => {
        target.hitstun = false;
        target.freeze = false;
        target.willDecelerate = true;
    });
    return hit;
}
export function superSwing(scene, attacker, target, animKey) {
    setAttackSprite(attacker, animKey);
    if (attackIsElligible(attacker, target, 150)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.32* attacker.baseDamageScale;
        hitFreeze(scene, 250);
        scene.time.delayedCall(50, () => {
            scene.sound.play('axethirdhitsfx');
        });
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5;

        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((600 * target.KBmultiplier * attacker.baseDamageScale) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier * attacker.baseDamageScale);
        } else {
            target.setVelocityX((700 * target.KBmultiplier * attacker.baseDamageScale) * dirX);
            target.setVelocityY((500 * target.KBmultiplier * attacker.baseDamageScale) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0; 
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    scene.time.delayedCall(1500, () => {
        //super swing is OP, so you wont be able to attack for a long time if missed or even after landing it
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(510 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function pushAttack(scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    setAttackSprite(attacker, animKey);
    let hit = false;
    if (attackIsElligible(attacker, target, 125)) {
        hit = true;
        
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.05* attacker.baseDamageScale;
        hitFreeze(scene, 50);
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
        const plungeMultiplier = target.plunged ? finalplungeMultiplier : 0;
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((325 * target.KBmultiplier * (attacker.baseDamageScale + plungeMultiplier)) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((400 * target.KBmultiplier * (attacker.baseDamageScale + plungeMultiplier)) * dirX );
            target.setVelocityY((500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
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
    return hit;
}
export function hardSwing(scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    setAttackSprite(attacker, animKey);
    if (attackIsElligible(attacker, target, 100)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.075* attacker.baseDamageScale;
        hitFreeze(scene, 100);
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
            target.setVelocityX((375 * target.KBmultiplier) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((350 * target.KBmultiplier * attacker.baseDamageScale) * dirX);
            target.setVelocityY((500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(400 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function lungePush(scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    setAttackSprite(attacker, animKey);
    if (attackIsElligible(attacker, target, 155)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        //fix for lunge
        attacker.hasHitSideSpecial = true;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.30* attacker.baseDamageScale;
        hitFreeze(scene);
        scene.sound.play('anyhit');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((275 * target.KBmultiplier * attacker.baseDamageScale) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((250 * target.KBmultiplier * attacker.baseDamageScale) * dirX);
            target.setVelocityY((500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
        
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
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
        target.willDecelerate = true;
    });

}
export function thirdAttack(scene, attacker, target, animKey) {
    //The third attack launching the target away
    setAttackSprite(attacker, animKey);
    console.log("Third Attack!");
    if (attackIsElligible(attacker, target)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.07* attacker.baseDamageScale;
        if (attacker.name == "SWORDMAN") {
            scene.sound.play('swordthirdhitsfx');
        } else if (attacker.name === "AXEMAN") {
            scene.sound.play('axethirdhitsfx');
        } else if (attacker.name === "FISHERMAN") {
            scene.sound.play('rodthirdhitsfx');
        } else if (attacker.name === "SLATEMAN") {
            scene.sound.play('slatepunch');
        }
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        const plungeMultiplier = target.plunged ? finalplungeMultiplier : 0;
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((400 * target.KBmultiplier) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((500 * target.KBmultiplier * (attacker.baseDamageScale + plungeMultiplier)) * dirX);
            target.setVelocityY((500 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(500 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function slamThirdAttack(scene, attacker, target, animKey) {
    //The third attack launching the target away
    setAttackSprite(attacker, animKey);
    console.log("Third Attack!");
    if (attackIsElligible(attacker, target)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.07* attacker.baseDamageScale;
        if (attacker.name == "SWORDMAN") {
            scene.sound.play('swordthirdhitsfx');
        } else if (attacker.name == "AXEMAN") {
            scene.sound.play('axethirdhitsfx');
        } else if (attacker.name == "FISHERMAN") {
            scene.sound.play('rodthirdhitsfx');
        } else if (attacker.name == "SCYTHEMAN") {
            scene.sound.play('scythethirdhitsfx');
        }
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((400 * target.KBmultiplier) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((350 * target.KBmultiplier * attacker.baseDamageScale) * dirX);
            target.setVelocityY((700 * target.KBmultiplier) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    scene.time.delayedCall(400, () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(500 * target.KBmultiplier, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function tiltAttack(scene, attacker, target, {
    animKey,
    kb = 0.1,
    xMul = 1,
    yMul = 0,
    range = 100,
    freeze = 80,
    sfx = 'anyhit',
    kbTime = 200,
    onHit = null,
    onUse = null
}) {
    //they aren't really tilt attacks
    if (!attacker.canAttack || attacker.hitstun) return;
    setAttackSprite(attacker, animKey);
    if (onUse) {
        onUse(scene);
    }
    if (attackIsElligible(attacker, target, range)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += kb* attacker.baseDamageScale;
        if (onHit) {
            onHit(scene);
        }
        hitFreeze(scene, freeze);
        scene.sound.play(sfx);
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        const plungeMultiplier = target.plunged ? finalplungeMultiplier : 0;
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX(325 * (target.KBmultiplier/2 * (attacker.baseDamageScale + plungeMultiplier)) * randDir);
            target.setVelocityY(-200 * (target.KBmultiplier/2));
        } else {
            target.setVelocityX((500 * xMul * (attacker.baseDamageScale + plungeMultiplier)) * dirX);
            target.setVelocityY((500 * yMul) * dirY);
        }
        attacker.combo = 0;
        attacker.comboTimer = 0;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    attacker.canAttack = false;
    scene.time.delayedCall(250, () => {
        attacker.atk.stop();
        attacker.atk.setVisible(false);
    });
    scene.time.delayedCall(300, () => {
        attacker.canAttack = true;
    });
    if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
    if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
    scene.time.delayedCall(kbTime, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(kbTime + 150, () => {
        target.willDecelerate = true;
    });

}
export function tryAttack(scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        thirdAttack(scene, attacker, target, thirdAnimKey);
    } else {
        if (Math.abs(attacker.body.velocity.x) >= 200) {
            pushAttack(scene, attacker, target, animKey);
        } else {
            attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
export function tryAttack2(scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        slamThirdAttack(scene, attacker, target, thirdAnimKey);
    } else {
        if (Math.abs(attacker.body.velocity.x) >= 200) {
            pushAttack(scene, attacker, target, animKey);
        } else {
            attack(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
export function tryAttack3(scene, attacker, target, animKey, thirdAnimKey) {
    //handles some other stuff before calling either attack functions
    //such as checking if the attack is on cooldown, and whether to use the third attack or not
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    if (attacker.combo >= 2) {
        hardSwing(scene, attacker, target, thirdAnimKey);
    } else {
        if (Math.abs(attacker.body.velocity.x) >= 200) {
            hardSwing(scene, attacker, target, animKey);
        } else {
            hardSwing(scene, attacker, target, animKey);
        }
    }
    attacker.nextAttackTime = scene.time.now + 400; // Attack cooldown
}
export function tryLunge(scene, player, direction, currentTime, animKey = 'swordatk') {
    //LUNGE: exclusive for the swordsman, this is performed by double tapping left or right
    // It launches the player forward in the direction they are lunging in
    //Why do this? Using arrow keys and right shift is harder than using WASD and E
    //Basically it balances out the controls.
    const dtapDelay = 250;
    const lungecd = 4000;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    //animation

    player.atk.setFrame(0);
    player.atk.play(animKey, true);
    if (currentTime - player.lastTap[direction] < dtapDelay) {
        player.atk.setVisible(true);
        player.atk.x = player.x + player.lastDir.x * 50;
        player.atk.y = player.y + player.lastDir.y * 50;

        player.atk.setFlipX(-player.lastDir.x < 0);
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

        player.nextSideSpecialTime = currentTime + lungecd;
        scene.sound.play('lunge');

        scene.time.delayedCall(500, () => {
            player.isUsingSideSpecial = false;
            player.afterimage = false;
        });

        scene.time.delayedCall(400, () => {
            player.atk.stop();
            player.atk.setVisible(false);
        });
    }
    player.lastTap[direction] = currentTime;

}
export function tryCleave(scene, player, direction, currentTime) {
    const dtapDelay = 250;
    const cleaveCD = 3000;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay) {

        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        const speed = 400;
        player.afterimage = true;


        if (direction === 'left') {
            player.setVelocityX(-speed);
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.setVelocityX(speed);
            player.lastDir = { x: 1, y: 0 };
        }

        // Use third attack animation (hard to hit, so discarded)
        //thirdAttack(scene, player, players.player2, 'axeatkthird');

        scene.time.delayedCall(200, () => {
            player.isUsingSideSpecial = false;
            player.afterimage = false;
        });

        player.nextSideSpecialTime = currentTime + cleaveCD;
    }

    player.lastTap[direction] = currentTime;
}
export function tryMow(scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const mowCD = 3500;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay) {
        //summon a mowing scythe
        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        const fakescythe = scene.add.image(player.x, player.y, 'whitescythe');
        fakescythe.setScale(2);

        console.log("GO");

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
        scene.physics.add.overlap(fakescythe, target, () => {
            if (player.hasHitSideSpecial) return;
            if (!canhit) return;
            target.freeze = true;
            target.hitstun = true;
            const slash = scene.add.image(target.x, target.y, 'slasheffect');
            slash.setScale(2);
            scene.tweens.add({
                targets: slash,
                alpha: 0, 
                duration: 100,
                onComplete: () => slash.destroy()
            });
            canhit = false;
            console.log("tuch")
            scene.time.delayedCall(40, () => {
                canhit = true;
            });  
            scene.time.delayedCall(1350, () => {
                player.hasHitSideSpecial = true;
                target.freeze = false;
                target.hitstun = false;
            });   

            scene.sound.play('slash');
            target.KBmultiplier += 0.055* player.baseDamageScale;
            target.flash();

        });
        const scytheUpdate = () => {

            if (!fakescythe.active) return;

            fakescythe.rotation += spinSpeed;

            // boomerang return
            if (returning) {
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

                    scene.events.off('update', scytheUpdate);

                    fakescythe.destroy();

                    player.isUsingSideSpecial = false;

                    mowsound.stop();
                }
            }
        };

        scene.events.on('update', scytheUpdate);

        // emergency cleanup
        scene.time.delayedCall(3000, () => {

            if (fakescythe.active) {

                scene.events.off('update', scytheUpdate);

                fakescythe.destroy();

                player.isUsingSideSpecial = false;
            }
        });

        player.nextSideSpecialTime = currentTime + mowCD;

    }

    player.lastTap[direction] = currentTime;

}
export function tryRepair(scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const repairCD = 3500;
    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay) {

        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        // face direction
        player.atk.setVisible(true);
        player.atk.x = player.x + player.lastDir.x * 50;
        player.atk.y = player.y + player.lastDir.y * 50;

        player.atk.setFlipX(-player.lastDir.x < 0);

        scene.sound.play("repair");

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

        
        const hasAttacked = pushAttack(scene, player, target, "hammeratk");
        if (hasAttacked) {
            spawnRepairBox();
            player.KBmultiplier -= 0.1;
        }
        player.isUsingSideSpecial = false;

        scene.time.delayedCall(250, () => {
            scene.sound.play("repair");

            
            const hasAttacked1 = pushAttack(scene, player, target, "hammeratk");
            if (hasAttacked1) {
                player.KBmultiplier -= 0.1;
                spawnRepairBox();
            }

            scene.time.delayedCall(250, () => {
                scene.sound.play("repair");

                
                const hasAttacked2 = pushAttack(scene, player, target, "hammeratk");
                if (hasAttacked2) {
                    spawnRepairBox();
                    player.KBmultiplier -= 0.1;
                }
                player.atk.setVisible(true);

            });
        });
        player.nextSideSpecialTime = currentTime + repairCD;
    }

    player.lastTap[direction] = currentTime;
}
export function markPlunge(scene, attacker, target, dir) {
    //Marks attack for plunge
    let hit = false;
    if (attackIsElligible(attacker, target, 150)) {
        hit = true;
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.075* attacker.baseDamageScale;
        target.plunged = true;
        hitFreeze(scene, 50);
        scene.sound.play('plunge');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((325 * target.KBmultiplier * attacker.baseDamageScale) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((300 * target.KBmultiplier * attacker.baseDamageScale) * dir);
            target.setVelocityY((500 * target.KBmultiplier) * dirY);
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
export function tryPlunge(scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = 3500;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay) {

        let currentLastDir = player.lastDir.x;

        const dagger = scene.physics.add.sprite(player.x + (currentLastDir * 25) , player.y, 'slateplunge');
        dagger.setOrigin(0.5, 0.5);
        dagger.setFrame(0);
        dagger.setFlipX(-player.lastDir.x < 0);
        scene.objs.add(dagger);
        let plungeCanceled = false;
        let globcurrentFrame = 0;
        const daggerTrack = () => {
            dagger.x = player.x + (currentLastDir * 25);
            dagger.y = player.y;
        };
        scene.events.on('update', daggerTrack);
        dagger.play('slateplunge');
        
        dagger.on('animationcomplete-slateplunge', () => {
            scene.events.off('update', daggerTrack);
            dagger.destroy(); 
            
        });
        
        
        dagger.on('animationupdate', (animation, frame) => {
            const currentFrame = frame.index; 
            globcurrentFrame = currentFrame;
            if (plungeCanceled) return;
            
            if (currentFrame >= 6 && currentFrame <= 10) {
                let plungeResult = markPlunge(scene, player, target, currentLastDir);
                if (plungeResult) {
                    plungeCanceled = true;
                }
                if (!plungeResult && currentFrame === 10) {
                    scene.sound.play('miss');
                }
            }
        });

        player.nextSideSpecialTime = currentTime + pullCD;
    }

    player.lastTap[direction] = currentTime;
}
export function tryPull(scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = 3500;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay) {

        player.isUsingSideSpecial = true;
        player.hasHitSideSpecial = false;

        // face direction
        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        // GRAPHICS FOR ROPE
        const rope = scene.add.graphics();

        // HOOK PROJECTILE
        const hook = scene.physics.add.sprite(
            player.x + player.lastDir.x * 60,
            player.y,
            'hook' // make a small hook sprite
        );
        hook.setTint(0x8b5a2b);
        hook.body.setMass(0);

        hook.setScale(2);
        hook.body.allowGravity = true;
        hook.body.gravity.y = 700;
        scene.objs.add(hook);
        scene.objs.add(rope);

        // initial launch speed
        hook.setVelocity(
            player.lastDir.x * 1000,
            -250
        );

        scene.sound.play('whoosh');

        // collision
        scene.physics.add.overlap(hook, target, () => {

            if (player.hasHitSideSpecial) return;

            player.hasHitSideSpecial = true;

            console.log("hit!")
            target.hitstun = true;

            // pull target toward player
            const dx = player.x - target.x;
            const dy = player.y - target.y;

            const dist = Math.hypot(dx, dy);

            const pullStrength = 900;

            target.setVelocity(
                (dx / dist) * pullStrength,
                (dy / dist) * pullStrength
            );

            scene.sound.play('anyhit');
            target.KBmultiplier += 0.22* player.baseDamageScale;

            scene.events.off('update', ropeUpdate);

            rope.destroy();
            hook.destroy();

            player.isUsingSideSpecial = false;
            scene.time.delayedCall(350, () => {
                target.hitstun = false;
            });

        });

        // DRAW CURVED ROPE
        const ropeUpdate = () => {

            // prevent crashes after destroy
            if (!hook.active || !hook.body || !rope.active) {
                return;
            }

            rope.clear();

            rope.lineStyle(3, 0x8b5a2b);

            const startX = player.x;
            const startY = player.y;

            const endX = hook.x;
            const endY = hook.y;

            rope.beginPath();

            rope.moveTo(startX, startY);

            // draw straight rope
            rope.lineTo(endX, endY);

            rope.strokePath();

            // artificial drag
            hook.body.velocity.x *= 0.985;
            hook.body.velocity.y *= 0.992;
        };

        scene.events.on('update', ropeUpdate);

        // cleanup
        scene.time.delayedCall(1000, () => {
            if (!player.isUsingSideSpecial) {
                return;
            }
            scene.events.off('update', ropeUpdate);

            rope.destroy();
            hook.destroy();

            player.isUsingSideSpecial = false;

        });

        player.nextSideSpecialTime = currentTime + pullCD;
    }

    player.lastTap[direction] = currentTime;
}
export function handleAttack(scene, attacker, victim) {
    if (attacker.name === "SWORDMAN") {
        tryAttack(scene, attacker, victim ,'swordatk', 'swordatkthird');
    } else if (attacker.name === "AXEMAN") {
        tryAttack(scene, attacker, victim ,'axeatk', 'axeatkthird');
    } else if (attacker.name === "FISHERMAN") {
        tryAttack(scene, attacker, victim ,'rodatk', 'rodatk');
    } else if (attacker.name === "SCYTHEMAN") {
        tryAttack2(scene, attacker, victim ,'scytheatk', 'scytheatk');
    } else if (attacker.name === "HAMMERMAN") {
        tryAttack3(scene, attacker, victim ,'hammeratk', 'hammeratk');
    } else if (attacker.name === "SLATEMAN") {
        tryAttack(scene, attacker, victim ,'slateatk', 'slateatkthird');
    }
}
export function handleDirSpecial(scene, attacker, direction, currentTime, victim) {
    if (attacker.name === "SWORDMAN") {
        tryLunge(scene, attacker, direction, currentTime);
    } else if (attacker.name === "AXEMAN") {
        tryCleave(scene, attacker, direction, currentTime);
    } else if (attacker.name === "FISHERMAN") {
        tryPull(scene, attacker, victim, direction, currentTime);
    } else if (attacker.name === "SCYTHEMAN") {
        tryMow(scene, attacker, victim, direction, currentTime);
    } else if (attacker.name === "HAMMERMAN") {
        tryRepair(scene, attacker, victim ,direction, currentTime);
    } else if (attacker.name === "SLATEMAN") {
        tryPlunge(scene, attacker, victim ,direction, currentTime);
    }

}
export function handleDirSpecialAttack(scene, attacker, victim) {
    if (attacker.name === "SWORDMAN") {
        lungePush(scene, attacker, victim, 'swordatkthird');
    } else if (attacker.name === "AXEMAN") {
        superSwing(scene, attacker, victim, 'axeatkthird');
    }
}
export function handleHorizantalTilt(scene, attacker, victim, direction) {
    if (attacker.name === "SWORDMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'swordatktilt',
            kb: 0.035,
            xMul: 0.9,
            yMul: 0.2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            }
        );
    } else if (attacker.name === "AXEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'axeatktilt',
            kb: 0.035,
            xMul: 0.9,
            yMul: 0.2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
        });
    } else if (attacker.name === "FISHERMAN") {
        tryAttack(scene, attacker, victim ,'rodatk', 'rodatk');
    } else if (attacker.name === "SCYTHEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'scytheatktilt',
            kb: 0.035,
            xMul: 0.9,
            yMul: 0.2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            
        });
    } else if (attacker.name === "HAMMERMAN") {
        tryAttack3(scene, attacker, victim ,'hammeratk', 'hammeratk');
    } else if (attacker.name === "SLATEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'slateatktilt',
            kb: 0.035,
            xMul: 0.9,
            yMul: 0.2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
        });
    }
}
export function handleDownTilt(scene, attacker, victim) {
    if (attacker.name === "SWORDMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'swordatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 2,
            range: 150,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            }
        );
    } else if (attacker.name === "AXEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'axeatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 2,
            range: 150,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            }
        );
    } else if (attacker.name === "FISHERMAN") {
        tryAttack(scene, attacker, victim ,'rodatk', 'rodatk');
    } else if (attacker.name === "SCYTHEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'scytheatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            
        });
    } else if (attacker.name === "HAMMERMAN") {
        tryAttack3(scene, attacker, victim ,'hammeratk', 'hammeratk');
    } else if (attacker.name === "SLATEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'slateatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 2,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300
        });
    }
}
export function handleUpTilt(scene, attacker, victim) {
    if (attacker.name === "SWORDMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'swordatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 0.88,
            range: 150,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
            }
        );
    } else if (attacker.name === "AXEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'axeatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 0.88,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
        });
    } else if (attacker.name === "FISHERMAN") {
        tryAttack(scene, attacker, victim ,'rodatk', 'rodatk');
    } else if (attacker.name === "SCYTHEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'scytheatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 0.88,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
        });
    } else if (attacker.name === "HAMMERMAN") {
        tryAttack3(scene, attacker, victim ,'hammeratk', 'hammeratk');
    } else if (attacker.name === "SLATEMAN") {
        tiltAttack(scene, attacker, victim, {
            animKey: 'slateatktilt',
            kb: 0.035,
            xMul: 0,
            yMul: 0.88,
            range: 125,
            freeze: 80,
            sfx: 'swosh',
            kbTime: 300,
        });
    }
}
