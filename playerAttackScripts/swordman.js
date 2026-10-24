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
const DAGGER_JAB = {
    range: 85,
    damage: 0.02,
    hitstun: 350,
    hitstunGrowth: false,
    stun: { target: 350, attacker: 200 },
    knockback: { x: 10, y: 100, growth: false, scaleWithDamage: false, lift: 0, delay: 50 },
    sound: 'light',
    resetCombo: false
};

function daggerattack(api, scene, attacker, target, animKey) {
    // DAGGER's jab: weaker and quicker than the standard one, and the combo runs to 6.
    if (!attacker.canAttack || attacker.hitstun) return;

    api.setAttackSprite(attacker, animKey);
    const hit = api.strike(scene, attacker, target, DAGGER_JAB);
    if (hit) {
        attacker.combo = (attacker.combo || 0) + 1;
    } else {
        attacker.combo = 0;
        scene.sound.play('miss');
    }
    if (attacker.combo >= 6) attacker.combo = 0;

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
    attacker.nextAttackTime = scene.time.now + api.getAttackCooldown(attacker); // Attack cooldown
}
function lungePush(api, scene, attacker, target, animKey) {
    api.setAttackSprite(attacker, animKey);
    api.strike(scene, attacker, target, {
        range: 155,
        bypass: { ignoreCanAttack: true },
        damage: 0.30,
        hitstun: 300,
        hitFreeze: 50,
        sound: 'swordslash1',
        knockback: { x: 250, y: 500, spike: { x: 275, y: -200 } },
        decelerateAfter: 1000,
        //fix for lunge
        onHit: () => { attacker.hasHitSideSpecial = true; }
    });
    api.clearQueuedStunTimers(scene, attacker, target);
    api.recoverAfterAttack(scene, attacker);
}
function quickstepAttack(api, scene, attacker, target, animKey) {
    // Hits in the direction of the dash.
    api.setAttackSprite(attacker, animKey);
    const attackDirX = Math.sign(attacker.body.velocity.x) || attacker.lastDir.x || 1;
    api.strike(scene, attacker, target, {
        range: 150,
        bypass: { ignoreCanAttack: true },
        direction: { x: attackDirX, y: attacker.lastDir.y },
        damage: 0.15,
        hitstun: 300,
        hitFreeze: 50,
        sound: 'swordslash1',
        knockback: { x: 125, y: 200, spike: { x: 137.5, y: -200 } },
        decelerateAfter: 1000,
        onHit: () => { attacker.hasHitSideSpecial = true; }
    });
    api.clearQueuedStunTimers(scene, attacker, target);
    api.recoverAfterAttack(scene, attacker);
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
    hitSounds: {
        light: ['swordslash1', 'swordslash2'],
        finisher: 'swordthirdhitsfx',
        // The sword's finisher swing makes its sound even when it whiffs.
        finisherMiss: 'swordthirdhitsfx'
    },
    variantStats: {
        DAGGER: { attackCooldown: 100 }
    },
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
        // Dashing through a plank damages it once per dash, near the victim or not.
        const dashPlankDamage = attacker.variant === 'DAGGER' ? 0.15 : 0.30;
        api.damagePlanksInAttack(attacker, dashPlankDamage * api.getAttackDamageScale(attacker));
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