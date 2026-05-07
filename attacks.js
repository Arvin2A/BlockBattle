export function attackIsElligible(attacker, target, range = 100) {
    if (!attacker.canAttack || attacker.hitstun) return false;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return false; // Too far away

    const dirToTargetX = dx / distance;
    const dirToTargetY = dy / distance;

    const dot = dirToTargetX * attacker.lastDir.x + dirToTargetY * attacker.lastDir.y;
    //dot product checks if the attacker is facing the target, which is the general rule for attacks in this game
    //However, to add some depth and counterplay, I added two custom rules for fun
    const isFacingUp = attacker.lastDir.y < -0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    const isFacingDown = attacker.lastDir.y > 0.9 && Math.abs(attacker.lastDir.x) < 0.2;
    //technically, decimal values are useless, because the values are only 0, 1, or -1
    //but this just adds a bit of leniency just in case we add mobile or controller support later where the input might not be perfectly digital
    const isTargetAbove = dy < -10;
    const isAttackerAbove = dy > 10;
    const una = isAttackerAbove && isFacingUp; // CUSTOM RULE: Prevent attacking upwards and pulling the player under the attacker
    const una2 = isFacingDown && isTargetAbove; // SECOND CUSTOM RULE: Prevent attacking downwards if the target is above also to avoid pinning
    if (una) return false;
    if (una2) return false;
    return dot > 0.7 || isFacingUp || isTargetAbove; // Attack range and facing target
}
export function attack(scene, attacker, target, animKey) {
    //the core attack function that is used as of now
    if (!attacker.canAttack || attacker.hitstun) return;

    attacker.atk.setVisible(true);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50;

    attacker.atk.setFlipX(-attacker.lastDir.x < 0);

    if (attacker.lastDir.y < 0) {
        attacker.atk.setAngle(90);
    } else if (attacker.lastDir.y > 0) {
        attacker.atk.setAngle(-90);
    } else {
        attacker.atk.setAngle(0);
    }

    attacker.atk.setFrame(0);
    attacker.atk.play(animKey, true);
    if (attacker.body.touching.down) {
        attacker.freeze = true;
    }

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
            target.setVelocityX((300 * target.KBmultiplier) * dirX);
            target.setVelocityY((300 * target.KBmultiplier) * dirY);
        });

    }

    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
        target.setVelocityX(0);
        target.setVelocityY(0);
        attacker.setVelocityX(0);
        attacker.setVelocityY(0);
        scene.sound.play('anyhit');
        target.KBmultiplier += 0.03; // Increase KB multiplier for third hit
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

}
export function superSwing(scene, attacker, target, animKey) {
    //The third attack launching the target away
    attacker.atk.setVisible(true);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50;

    attacker.atk.setFlipX(-attacker.lastDir.x < 0);

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
    console.log("Third Attack!");
    if (attackIsElligible(attacker, target, 200)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.07;
        scene.sound.play(animKey === 'swordatkthird' ? 'swordthirdhitsfx' : 'axethirdhitsfx');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((600 * target.KBmultiplier) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((700 * target.KBmultiplier) * dirX);
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
    scene.time.delayedCall(600, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function pushAttack(scene, attacker, target, animKey) {
    //Push attacks happen if the player is at maximum velocity
    attacker.atk.setVisible(true);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50;

    attacker.atk.setFlipX(-attacker.lastDir.x < 0);

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
    console.log("push!");
    if (attackIsElligible(attacker, target)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.05;
        scene.sound.play('anyhit');
        const dirX = attacker.lastDir.x;

        let dirY = attacker.lastDir.y;
        if (dirY === 0) dirY = -0.5; //always launch upwards if on same level

        //very stronk knockback
        //launch to the side if the target is pinned against the ground, otherwise launch in the direction of the attack
        if (target.body.touching.down && dirY > 0.7) {
            const randDir = Math.random() < 0.5 ? -1 : 1;
            target.setVelocityX((275 * target.KBmultiplier) * randDir);
            target.setVelocityY(-200 * target.KBmultiplier);
        } else {
            target.setVelocityX((250 * target.KBmultiplier) * dirX);
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
    scene.time.delayedCall(600, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
        target.willDecelerate = true;
    });

}
export function thirdAttack(scene, attacker, target, animKey) {
    //The third attack launching the target away
    attacker.atk.setVisible(true);
    attacker.atk.x = attacker.x + attacker.lastDir.x * 50;
    attacker.atk.y = attacker.y + attacker.lastDir.y * 50;

    attacker.atk.setFlipX(-attacker.lastDir.x < 0);

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
    console.log("Third Attack!");
    if (attackIsElligible(attacker, target)) {
        target.hitstun = true;
        target.willDecelerate = false;
        target.freeze = false;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.comboTimer = 600;
        target.KBmultiplier += 0.07;
        scene.sound.play(animKey === 'swordatkthird' ? 'swordthirdhitsfx' : 'axethirdhitsfx');
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
            target.setVelocityX((500 * target.KBmultiplier) * dirX);
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
    scene.time.delayedCall(600, () => {
        target.hitstun = false;
    });
    scene.time.delayedCall(1000, () => {
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
        });

        player.nextSideSpecialTime = currentTime + cleaveCD;
    }

    player.lastTap[direction] = currentTime;
}
