import { fiveframecount } from "../../main.js";
import { Commands } from "../../commands.js";
import { executeStateCommand } from "../../commands.js";
import { handleAttack } from "../../attacks.js";
import { handleDirSpecial } from "../../attacks.js";
import { handleDirSpecialAttack } from "../../attacks.js";
import { toggleChainsawMode } from "../../attacks.js";

const MAX_CHAINSAW_WOOD = 225;
const PLANK_WOOD_COST = 15;

function placeBotPlank(scene, bot, target, x, y, direction) {
    bot.lastDir = direction;
    bot.plankGhost.setPosition(x, y);
    bot.plankGhost.setAngle(direction.y === 0 ? 90 : 0);
    handleAttack(scene, bot, target);
}

function finishAirPlankSequence(scene, bot) {
    bot.airPlankSequence = false;
    if (bot.active && !bot.chainsawMode) {
        bot.plankModeReturnAt = scene.time.now + 350;
    }
}

export function runBotAI(scene, bot, target) {
    //let the ai make the ai 🔥
    bot.horizontalMovementActive = false;
    const ground = scene.gameState.map.ground;

    const groundLeft = ground.x - ground.displayWidth / 2;
    const groundRight = ground.x + ground.displayWidth / 2;

    const edgeBuffer = 25;
    const recoveryMargin = 50;
    const deadzone = 0; //REALLY LOW

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    // ======================
    // DISABLED STATES
    // ======================

    if (!bot.hitstun && !bot.freeze && !bot.hasHitSideSpecial &&
        bot.isUsingSideSpecial && fiveframecount === 5) {
        handleDirSpecialAttack(scene, bot, target);
    }

    if (bot.hitstun || bot.freeze || bot.isUsingSideSpecial) {
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.NONE
        });
        return;
    }

    if (bot.plankModeReturnAt && scene.time.now >= bot.plankModeReturnAt &&
        !bot.airPlankSequence && !bot.chainsawMode) {
        toggleChainsawMode(scene, bot);
        bot.plankModeReturnAt = 0;
    }

    const isChainsawAxeman =
        bot.name === 'AXEMAN' && bot.variant === 'CHAINSAW';
    if (isChainsawAxeman) {
        if (bot.body.blocked.down || bot.body.touching.down) {
            bot.airPlankUsed = false;
        } else if (bot.airTime > 1850 && !bot.airPlankUsed &&
            !bot.airPlankSequence && bot.woodCount >= PLANK_WOOD_COST * 3 &&
            bot.chainsawMode) {
            bot.airPlankUsed = true;
            bot.airPlankSequence = true;
            toggleChainsawMode(scene, bot);

            const down = { x: 0, y: 1 };
            placeBotPlank(scene, bot, target, bot.x, bot.y + 100, down);

            scene.time.delayedCall(50 + Math.random() * 50, () => {
                if (!bot.active) {
                    bot.airPlankSequence = false;
                    return;
                }
                if (bot.chainsawMode || bot.hitstun || bot.freeze ||
                    bot.woodCount < PLANK_WOOD_COST * 2) {
                    finishAirPlankSequence(scene, bot);
                    return;
                }
                placeBotPlank(
                    scene, bot, target, bot.x - 200, bot.y + 100, down
                );

                scene.time.delayedCall(50 + Math.random() * 50, () => {
                    if (!bot.active) {
                        bot.airPlankSequence = false;
                        return;
                    }
                    if (bot.chainsawMode || bot.hitstun || bot.freeze ||
                        bot.woodCount < PLANK_WOOD_COST) {
                        finishAirPlankSequence(scene, bot);
                        return;
                    }
                    placeBotPlank(
                        scene, bot, target, bot.x + 200, bot.y + 100, down
                    );
                    finishAirPlankSequence(scene, bot);
                });
            });
        }
    }

    if (bot.airPlankSequence) {
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.NONE
        });
        return;
    }

    // ======================
    // RECOVERY
    // ======================

    const offLeft = bot.x < groundLeft - recoveryMargin;
    const offRight = bot.x > groundRight + recoveryMargin;

    if (offLeft || offRight || bot.y > ground.y + 50) {

        // move toward stage


        if (offLeft) {
            bot.lastDir = { x: 1, y: 0 };
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.RIGHT
            });
        }

        if (offRight) {
            bot.lastDir = { x: -1, y: 0 };
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.LEFT
            });
        }

        if (bot.body.blocked.down) {
            console.log("GROUNDED");
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.UP
            });
            bot.hasDoubleJumped = false;
            return;
        }

        if (!bot.hasDoubleJumped) {
            bot.lastDir = { x: 0, y: -1 };
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.DOUBLE_UP
            });
            return;
        }

        return;
    }

    // ======================
    // STAGE SAFETY
    // ======================

    if (bot.x <= groundLeft + edgeBuffer) {

        bot.lastDir = { x: 1, y: 0 };
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.RIGHT
        });

        return;
    }

    if (bot.x >= groundRight - edgeBuffer) {

        bot.lastDir = { x: -1, y: 0 };
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.LEFT
        });

        return;
    }

    if (!bot.body.blocked.down && bot.airTime >= 1000 && dy > 0 &&
        Math.hypot(dx, dy) <= 125 &&
        scene.time.now >= (bot.nextDownslamTime || 0)) {
        bot.nextDownslamTime = scene.time.now + 1000;
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.DOWNSLAM
        });
        return;
    }

    const targetIsAttacking = !target.canAttack || target.isUsingSideSpecial;
    if (targetIsAttacking && !bot.targetWasAttacking &&
        Math.hypot(dx, dy) < 120 && Math.random() < 0.2) {
        bot.attackEvadeUntil = scene.time.now + 160;
    }
    bot.targetWasAttacking = targetIsAttacking;

    if (target.nextSideSpecialTime > 0 &&
        scene.time.now >= target.nextSideSpecialTime &&
        target.nextSideSpecialTime !== bot.lastTargetSpecialReadyTime) {
        bot.lastTargetSpecialReadyTime = target.nextSideSpecialTime;
        if (Math.hypot(dx, dy) < 160 && Math.random() < 0.2) {
            bot.specialReadyEvadeUntil = scene.time.now + 220;
        }
    }

    if (scene.time.now < (bot.specialReadyEvadeUntil || 0) ||
        scene.time.now < (bot.attackEvadeUntil || 0)) {
        let evadeDirection = dx > 0 ? -1 : 1;
        const roomToEvade = evadeDirection < 0
            ? bot.x - groundLeft
            : groundRight - bot.x;
        if (roomToEvade < edgeBuffer + 80) evadeDirection *= -1;

        bot.lastDir = { x: evadeDirection, y: 0 };
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: evadeDirection < 0 ? Commands.LEFT : Commands.RIGHT
        });
        return;
    }

    if (bot.name === "GUNMAN") {
        const horizontalLane = Math.abs(dy + 10) <= target.body.height / 2 + 1;
        const verticalLane = Math.abs(dx) <= target.body.width / 2 + 1;
        const canShootHorizontally = horizontalLane && Math.abs(dx) > 50;
        const canShootVertically = verticalLane && (dy <= -35 || dy >= 15);
        const specialHorizontal = canShootHorizontally && Math.abs(dx) <= 1000;
        const specialVertical = canShootVertically && Math.abs(dy) <= 1000;

        if ((specialHorizontal || specialVertical) && !bot.gunmanSpecialActive &&
            scene.time.now >= bot.nextSideSpecialTime) {
            bot.lastDir = specialHorizontal
                ? { x: Math.sign(dx), y: 0 }
                : { x: 0, y: Math.sign(dy) };
            const specialDirection = bot.lastDir.x < 0 ? 'left' : 'right';
            handleDirSpecial(scene, bot, specialDirection, scene.time.now, target);
        }

        if (canShootHorizontally || canShootVertically) {
            bot.lastDir = canShootHorizontally
                ? { x: Math.sign(dx), y: 0 }
                : { x: 0, y: Math.sign(dy) };

            if (scene.time.now >= bot.nextAttackTime && bot.canAttack) {
                handleAttack(scene, bot, target);
            }
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });
            return;
        }

        if (horizontalLane && Math.abs(dx) <= 50) {
            bot.lastDir = { x: dx >= 0 ? 1 : -1, y: 0 };
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: dx >= 0 ? Commands.LEFT : Commands.RIGHT
            });
            return;
        }
    }

    if (isChainsawAxeman && !bot.airPlankSequence &&
        scene.time.now >= (bot.plankModeReturnAt || 0)) {
        const targetDistance = Math.hypot(dx, dy);
        const grounded = bot.body.blocked.down || bot.body.touching.down;
        const now = scene.time.now;

        bot.nextWoodGatherTime ??= now + 1500 + Math.random() * 1500;
        bot.nextPlankTime ??= now + 2500 + Math.random() * 2000;

        if (bot.chainsawGathering) {
            if (targetDistance <= 230 || bot.woodCount >= MAX_CHAINSAW_WOOD || !grounded) {
                bot.chainsawGathering = false;
                bot.nextWoodGatherTime = now + 2500 + Math.random() * 2500;
                bot.lastDir = { x: Math.sign(dx) || 1, y: 0 };
                if (bot.chainsawActive) handleAttack(scene, bot, target);
            } else {
                if (!bot.chainsawMode) toggleChainsawMode(scene, bot);
                bot.lastDir = { x: 0, y: 1 };
                if (!bot.chainsawActive &&
                    now >= (bot.chainsawCooldownUntil ?? 0)) {
                    handleAttack(scene, bot, target);
                }
                executeStateCommand(scene, scene.gameState.players, {
                    playerID: bot.id,
                    type: Commands.NONE
                });
                return;
            }
        }

        if (grounded && targetDistance > 230 && bot.woodCount < MAX_CHAINSAW_WOOD &&
            now >= bot.nextWoodGatherTime) {
            bot.chainsawGathering = true;
            if (!bot.chainsawMode) toggleChainsawMode(scene, bot);
            bot.lastDir = { x: 0, y: 1 };
            if (!bot.chainsawActive &&
                now >= (bot.chainsawCooldownUntil ?? 0)) {
                handleAttack(scene, bot, target);
            }
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });
            return;
        }

        if (targetDistance >= 200 && bot.woodCount >= PLANK_WOOD_COST &&
            now >= bot.nextPlankTime) {
            if (bot.chainsawMode) toggleChainsawMode(scene, bot);
            const direction = { x: Math.sign(dx) || 1, y: 0 };
            placeBotPlank(
                scene,
                bot,
                target,
                bot.x + direction.x * 200,
                bot.y - 50,
                direction
            );
            bot.plankModeReturnAt = now + 350;
            bot.nextPlankTime = now + 3500 + Math.random() * 2500;
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });
            return;
        }

        if (targetDistance <= 145 && now >= bot.nextSideSpecialTime &&
            now >= (bot.chainsawCooldownUntil ?? 0) && !bot.isUsingSideSpecial) {
            const direction = dx < 0 ? 'left' : 'right';
            bot.lastDir = { x: dx < 0 ? -1 : 1, y: 0 };
            handleDirSpecial(scene, bot, direction, now, target);
            handleDirSpecial(scene, bot, direction, now, target);
        }
    }

    // ======================
    // JUMP TO TARGET
    // ======================

    if (
        dy < -120 &&
        scene.time.now - bot.lastJump > 500
    ) {
       if (dy < -120) {
            // grounded -> normal jump
            if (bot.body.blocked.down) {
                bot.lastJump = scene.time.now;
                bot.lastDir = { x: 0, y: -1 };
                executeStateCommand(scene, scene.gameState.players, {
                    playerID: bot.id,
                    type: Commands.UP
                });

                return;
            }

            // target is REALLY high above us
            if (
                dy < -25 &&
                !bot.body.blocked.down &&
                !bot.hasDoubleJumped
            ) {
                console.log("HIGH UP!")
                executeStateCommand(scene, scene.gameState.players, {
                    playerID: bot.id,
                    type: Commands.DOUBLE_UP
                });

                return;
            }
        }
    }
    if (bot.body.blocked.down) {
        bot.hasDoubleJumped = false;
    }

    // ======================
    // ATTACK
    // ======================

    if (dy > 50  && Math.abs(dy) < 100 && Math.abs(dx) < 36) {
        bot.lastDir = { x: 0, y: 1 };
    }
    const attackRange = 65 + 55;

    const chainsawDistance = Math.hypot(target.x - bot.atk.x, target.y - bot.atk.y);
    if (bot.name === 'AXEMAN' && bot.variant === 'CHAINSAW' &&
        bot.chainsawMode && !bot.airPlankSequence &&
        scene.time.now >= (bot.plankModeReturnAt || 0) &&
        chainsawDistance <= 85) {
        if (!bot.chainsawActive && scene.time.now - bot.lastAttack > 500) {
            bot.lastAttack = scene.time.now;
            handleAttack(scene, bot, target);
        }

        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.NONE
        });
        return;
    }
    
    if (bot.name !== "GUNMAN" &&
        !(bot.name === 'AXEMAN' && bot.variant === 'CHAINSAW') &&
        Math.abs(dx) < attackRange && Math.abs(dy) < attackRange+50) {

        if (scene.time.now - bot.lastAttack > 100) {

            bot.lastAttack = scene.time.now;

            handleAttack(scene, bot, target);
        }

        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.NONE
        });

        return;
    }

    // ======================
    // CHASE
    // ======================

    if (dx > deadzone) {

        bot.lastDir = { x: 1, y: 0 };

        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.RIGHT
        });

    } else if (dx < -deadzone) {

        bot.lastDir = { x: -1, y: 0 };

        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.LEFT
        });

    } else {
        executeStateCommand(scene, scene.gameState.players, {
            playerID: bot.id,
            type: Commands.NONE
        });
    }
    
    const specDirection = (bot.lastDir.x > 0 && bot.lastDir.x !== 0) ? "right" : "left";
    //CHARACTER-SPECIFIC SPECIAL ATTACK INTERACTIONS:
    if (bot.name === "AXEMAN" && bot.variant !== 'CHAINSAW') {
        const attackRange = 150;

        if (Math.abs(dx) < attackRange && Math.abs(dy) < 50) {

            if (scene.time.now - bot.lastDirSpecial > 500) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "SWORDMAN") {
        const attackRange = 350;
        if (Math.abs(dx) < attackRange && Math.abs(dx) > attackRange-100) {

            if (scene.time.now - bot.lastDirSpecial > 500) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "FISHERMAN") {
        const attackRange = 400;

        if (Math.abs(dx) < attackRange && Math.abs(dx) > attackRange-100) {

            if (scene.time.now - bot.lastDirSpecial > 500) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "SCYTHEMAN") {
        const attackRange = 300;

        if (Math.abs(dx) < attackRange && Math.abs(dy) < 125) {

            if (scene.time.now - bot.lastDirSpecial > 500) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "HAMMERMAN") {
        const attackRange = 80;

        if (Math.abs(dx) < attackRange) {

            if (scene.time.now - bot.lastDirSpecial > 500 && Math.abs(dy) < 100) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "SLATEMAN") {
        const attackRange = 130;

        if (Math.abs(dx) < attackRange) {

            if (scene.time.now - bot.lastDirSpecial > 500 && Math.abs(dy) < 50) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    } else if (bot.name === "CROWBARMAN") {
        const attackRange = 200;

        if (Math.abs(dx) < attackRange) {

            if (scene.time.now - bot.lastDirSpecial > 500 && Math.abs(dy) < 50) {

                bot.lastDirSpecial = scene.time.now;

                handleDirSpecial(scene, bot, specDirection, scene.time.now, target);
            }

            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.NONE
            });

            return;
        }
    }
    
    
}