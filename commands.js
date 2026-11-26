// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { spawnDirtBurst } from './attacks.js';
import { SQUASH, kickSquash } from './combat/squash.js';
import { isAirDodging } from './combat/block.js';
import { isSuppressed } from './combat/characterStats.js';
export const Commands = {
    LEFT: 0,
    RIGHT: 1,
    NONE: 2,
    UP: 3,
    DOUBLE_UP: 4,
    DOWNSLAM: 5,
    UP_CANCEL: 6,
};
const deccelFactor = 0.9;
const accelFactor = 20;
const JUMP_SPEED = 400;
const DOWNSLAM_SPEED = 800;
function getPlayer(players, id) {
    return players[id - 1];
}
function groundTraction(player) {
    return player.body.blocked.down ? (player.traction ?? 1) : 1;
}

function decelerate(player) {
    if (player.isUsingSideSpecial) return;
    let vx = player.body.velocity.x;

    if (Math.abs(vx) > 10) {
        if (player.body.blocked.down) {
            if (player.hitstun) {
                player.setVelocityX(vx * player.hitstunGroundDeceleration);
            } else {
                player.setVelocityX(vx * (1 - (1 - deccelFactor) * groundTraction(player)));
            }
        } else {
            player.setVelocityX(vx * 0.95);
        } 
        
        
    } else {
        player.setVelocityX(0);
    }
}
function move(player, direction) {
    if (player.moveDirLock && player.moveDirLock !== direction) {
        player.horizontalMovementActive = false;
        if (player.willDecelerate) decelerate(player);
        return;
    }
    player.horizontalMovementActive = true;
    if (!player.isUsingSideSpecial && !isAirDodging(player)) steer(player, direction);
}

function steer(player, direction) {
    const vx = player.body.velocity.x;
    const speed = player.movementSpeed;
    if (!player.keepsMomentum) {
        player.setVelocityX(Phaser.Math.Clamp(vx + direction * accelFactor * groundTraction(player), -speed, speed));
        return;
    }
    if (vx * direction >= speed) return;
    if (vx * direction < 0) {
        player.setVelocityX(-vx);
        return;
    }
    player.setVelocityX(direction * Math.min((vx + direction * accelFactor * groundTraction(player)) * direction, speed));
}

function jumpVelocity(player) {
    const speed = JUMP_SPEED * (player.jumpScale ?? 1);
    return player.keepsMomentum ? Math.min(player.body.velocity.y, -speed) : -speed;
}

export function executeStateCommand(scene, players, command) {
    const attacker = getPlayer(players, command.playerID);

    switch (command.type) {
        case Commands.LEFT:
            move(attacker, -1);
            break;

        case Commands.RIGHT:
            move(attacker, 1);
            break;

        case Commands.UP:
            if (isSuppressed(attacker)) break;
            attacker.setVelocityY(jumpVelocity(attacker));
            kickSquash(attacker, SQUASH.jump);
            
            break;

        case Commands.DOUBLE_UP:
            if (isSuppressed(attacker)) break;
            attacker.setVelocityY(jumpVelocity(attacker));
            attacker.doubleJumpEffect.setAlpha(1);
            attacker.hasDoubleJumped = true;
            kickSquash(attacker, SQUASH.jump);
            scene.tweens.add({targets: attacker.doubleJumpEffect,alpha: 0,duration: 200,ease: 'Cubic.easeOut'});
            spawnDirtBurst(scene, attacker.x, attacker.body.bottom, 6, 3, 5, 0.8, [0xffffff, 0xdddddd, 0xbbbbbb], 150, 230);
            
            break;

        case Commands.DOWNSLAM:
            attacker.downslamming = true;
            attacker.downslamFx = true;
            attacker.afterimage = true;
            attacker.setVelocityY(attacker.keepsMomentum ? Math.max(attacker.body.velocity.y, DOWNSLAM_SPEED) : DOWNSLAM_SPEED);
            break;
        case Commands.NONE:
            attacker.horizontalMovementActive = false;
            if (attacker.willDecelerate) {
                decelerate(attacker);
            }
            break;
        case Commands.UP_CANCEL:
            if (!attacker.keepsMomentum) attacker.setVelocityY(attacker.body.velocity.y / 2);
           
            break;
    }
}