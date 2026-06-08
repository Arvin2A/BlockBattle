export const Commands = {
    LEFT: 0,
    RIGHT: 1,
    NONE: 2,
    UP: 3,
    DOUBLE_UP: 4,
    DOWNSLAM: 5,
    UP_CANCEL: 6,
};
const accelFactor = 20;
function getPlayer(players, id) {
    return id === 1 ? players.player : players.player2;
}

function getOpponent(players, id) {
    return id === 1 ? players.player2 : players.player;
}
function decelerate(player) {
    if (player.isUsingSideSpecial) return;
    let vx = player.body.velocity.x;

    if (Math.abs(vx) > 10) {
        player.setVelocityX(vx * 0.9);
    } else {
        player.setVelocityX(0);
    }
}
export function executeStateCommand(scene, players, command) {
    const attacker = getPlayer(players, command.playerID);
    const victim = getOpponent(players, command.playerID);

    switch (command.type) {
        case Commands.LEFT:
            if (!attacker.isUsingSideSpecial) {
                attacker.setVelocityX(Phaser.Math.Clamp(attacker.body.velocity.x - accelFactor, -attacker.movementSpeed, attacker.movementSpeed));
            }
            break;

        case Commands.RIGHT:
            if (!attacker.isUsingSideSpecial) {
                attacker.setVelocityX(Phaser.Math.Clamp(attacker.body.velocity.x + accelFactor, -attacker.movementSpeed, attacker.movementSpeed));
            }
            break;

        case Commands.UP:
            attacker.setVelocityY(-400);
            break;

        case Commands.DOUBLE_UP:
            attacker.setVelocityY(-400);
            attacker.doubleJumpEffect.setAlpha(1);
            attacker.hasDoubleJumped = true;
            scene.tweens.add({targets: attacker.doubleJumpEffect,alpha: 0,duration: 200,ease: 'Cubic.easeOut'});
            break;

        case Commands.DOWNSLAM:
            attacker.afterimage = true;
            attacker.setVelocityY(800);
            break;
        case Commands.NONE:
            if (attacker.willDecelerate) {
                decelerate(attacker);
            }
            break;
        case Commands.UP_CANCEL:
            attacker.setVelocityY(attacker.body.velocity.y / 2);
            break;
    }
}