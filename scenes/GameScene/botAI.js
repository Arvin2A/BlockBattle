import { fiveframecount } from "../../main.js";
export function runBotAI(scene, bot, target) {
    //let the ai make the ai 🔥
    const ground = scene.mainGround;

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

    if (!bot.escapeUntil) {
        bot.escapeUntil = 0;
    }

    if (bot.hitstun || bot.freeze || bot.isUsingSideSpecial) {
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
    if (
        Math.abs(dx) < 25 &&
        dy > 150 &&
        scene.time.now > bot.escapeUntil
    ) {
        bot.escapeUntil = scene.time.now + 1500;
    
        // move away from where the target is
        bot.escapeDirection = dx >= 0 ? -1 : 1;
    
        // if almost perfectly centered, randomize
        if (Math.abs(dx) < 5) {
            bot.escapeDirection = Math.random() < 0.5 ? -1 : 1;
        }
    }
    if (scene.time.now < bot.escapeUntil) {

        if (bot.escapeDirection > 0) {
            bot.lastDir = { x: 1, y: 0 };
    
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.RIGHT
            });
        } else if (bot.escapeDirection < 0) {
            bot.lastDir = { x: -1, y: 0 };
    
            executeStateCommand(scene, scene.gameState.players, {
                playerID: bot.id,
                type: Commands.LEFT
            });
        }
    
        return;
    }

    const attackRange = 65;
    
    if (Math.abs(dx) < attackRange && Math.abs(dy) < attackRange+50) {

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
    if (!bot.hasHitSideSpecial && bot.isUsingSideSpecial && fiveframecount === 5) {
        handleDirSpecialAttack(scene, bot, target);
    }
    if (bot.name === "AXEMAN") {
        const attackRange = 80;

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
        const attackRange = 500;

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
    }
    
}