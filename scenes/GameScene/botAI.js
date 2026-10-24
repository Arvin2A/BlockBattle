// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { Commands } from "../../commands.js";
import { executeStateCommand } from "../../commands.js";
import { handleAttack } from "../../attacks.js";
import { handleDirSpecial } from "../../attacks.js";
import { handleDirSpecialAttack } from "../../attacks.js";
import { toggleChainsawMode } from "../../attacks.js";
import { isInvincible, attackIsElligible } from "../../attacks.js";

const MAX_CHAINSAW_WOOD = 225;
const PLANK_WOOD_COST = 15;
// CHAINSAW keeps one plank's worth for a clutch under himself; walls only spend the rest.
const CLUTCH_WOOD_RESERVE = PLANK_WOOD_COST;
const WALL_WOOD_NEEDED = PLANK_WOOD_COST + CLUTCH_WOOD_RESERVE;
// CHAINSAW: the saw has the same reach as a basic attack.
const SAW_CONTACT_RANGE = 92;
const SAW_ENGAGE_RANGE = 320;
const SAW_SPINUP_RANGE = 170;

// Basic attacks land within this distance (attackIsElligible); DAGGER's are shorter.
const LIGHT_RANGE = 100;
const DAGGER_RANGE = 85;
// Attacking while moving uses pushAttack, same reach as a jab.
const PUSH_RANGE = 100;
// Swing a little inside the real range so hits don't miss on its edge.
const RANGE_MARGIN = 8;
const CHASE_DEADZONE = 12;
// How far from a drop the bot will walk.
const LEDGE_MARGIN = 30;
// From this KB on, a launch back toward the stage is wasted, so launch upward instead.
const KILL_KB = 1.6;
// Rough horizontal reach of the dash specials, used to avoid dashing off the stage.
const DASH_REACH = {
    LONGSWORD: 300,
    DAGGER: 180,
    LUMBERER: 150
};

function send(scene, bot, type) {
    executeStateCommand(scene, scene.gameState.players, {
        playerID: bot.id,
        type
    });
}

function isGrounded(player) {
    return player.body.blocked.down || player.body.touching.down;
}

// Every platform as a plain box. The main ground is solid from below too.
function getSurfaces(scene) {
    const { platforms, topPlatforms, ground } = scene.gameState.map;
    return [...platforms.getChildren(), ...topPlatforms.getChildren()]
        .filter(platform => platform.active && platform.body?.enable)
        .map(platform => ({
            left: platform.body.left,
            right: platform.body.right,
            top: platform.body.top,
            solid: platform === ground
        }));
}

// The highest surface under (x, feetY), or null if it's a drop to the blast zone.
function surfaceBelow(surfaces, x, feetY) {
    let best = null;
    for (const surface of surfaces) {
        if (x < surface.left || x > surface.right || surface.top < feetY - 4) continue;
        if (!best || surface.top < best.top) best = surface;
    }
    return best;
}

function isOffStage(player, surfaces) {
    return !isGrounded(player) && !surfaceBelow(surfaces, player.x, player.body.bottom);
}

// The real attackIsElligible check aimed along dir, with no side effects.
// Invincibility is ignored so the bot still lines up hits on a respawning target.
function wouldHit(attacker, target, dir, range) {
    if (target.x === attacker.x && target.y === attacker.y) return false;
    return attackIsElligible(attacker, target, range, {
        direction: dir,
        ignoreCanAttack: true,
        ignoreInvincibility: true,
        silent: true
    });
}

// Which way to face for a basic attack that lands, or null if none would.
function chooseAttackDir(bot, target, range, stageCenter) {
    const side = Math.sign(target.x - bot.x) || bot.lastDir.x || 1;
    const horizontal = { x: side, y: 0 };
    const up = { x: 0, y: -1 };
    const down = { x: 0, y: 1 };
    const options = [horizontal, up, down];

    // The combo's third hit launches. Late in a stock, sending them back over
    // the stage wastes it, so launch them upward when that's the only choice.
    const launchesInward = (side > 0) === (target.x < stageCenter);
    if (bot.combo >= 2 && target.KBmultiplier >= KILL_KB && launchesInward) {
        options.unshift(up);
    }
    return options.find(dir => wouldHit(bot, target, dir, range)) ?? null;
}

// Walks toward dirX unless that step would leave nothing to land on.
function walk(scene, bot, dirX, surfaces) {
    const aheadX = bot.x + dirX * LEDGE_MARGIN;
    if (!surfaceBelow(surfaces, aheadX, bot.body.bottom)) {
        send(scene, bot, Commands.NONE);
        return false;
    }
    bot.lastDir = { x: dirX, y: 0 };
    send(scene, bot, dirX < 0 ? Commands.LEFT : Commands.RIGHT);
    return true;
}

function walkTo(scene, bot, x, surfaces, deadzone = CHASE_DEADZONE) {
    const dx = x - bot.x;
    if (Math.abs(dx) <= deadzone) {
        send(scene, bot, Commands.NONE);
        return true;
    }
    walk(scene, bot, Math.sign(dx), surfaces);
    return false;
}

function tryDoubleJump(scene, bot) {
    if (bot.hasDoubleJumped) return false;
    bot.lastDir = { x: 0, y: -1 };
    send(scene, bot, Commands.DOUBLE_UP);
    return true;
}

function useDirSpecial(scene, bot, target, dirX) {
    if (scene.time.now < bot.nextSideSpecialTime) return false;
    bot.lastDir = { x: dirX, y: 0 };
    bot.lastDirSpecial = scene.time.now;
    handleDirSpecial(scene, bot, dirX < 0 ? 'left' : 'right', scene.time.now, target);
    return true;
}

// Off-stage: head for the nearest surface, keep the double jump until falling
// near its level, then fall back on a recovery special.
function recover(scene, bot, target, surfaces) {
    const feet = bot.body.bottom;
    let goal = null;
    let goalScore = Infinity;
    for (const surface of surfaces) {
        const gap = bot.x < surface.left
            ? surface.left - bot.x
            : bot.x > surface.right ? bot.x - surface.right : 0;
        const climb = Math.max(0, feet - surface.top);
        const score = gap + climb * 1.5 - (surface.solid ? 40 : 0);
        if (score < goalScore) {
            goal = { ...surface, gap };
            goalScore = score;
        }
    }
    if (!goal) return;

    // Under a solid stage: get out from under it before jumping.
    let aimX;
    if (goal.gap === 0 && goal.solid) {
        aimX = bot.x - goal.left < goal.right - bot.x ? goal.left - 50 : goal.right + 50;
    } else {
        aimX = Math.min(Math.max(bot.x, goal.left + 40), goal.right - 40);
    }
    const dirX = Math.sign(aimX - bot.x) || 1;
    bot.lastDir = { x: dirX, y: 0 };
    send(scene, bot, dirX < 0 ? Commands.LEFT : Commands.RIGHT);

    const underSolid = goal.gap === 0 && goal.solid;
    // On a plank off the stage: jump off it first, keeping the double jump.
    if (isGrounded(bot) && !underSolid && scene.time.now - bot.lastJump > 400) {
        bot.lastJump = scene.time.now;
        send(scene, bot, Commands.UP);
        return;
    }
    const falling = bot.body.velocity.y > -60;
    const nearLevel = feet > goal.top - 40;
    if (underSolid || !falling) return;

    if (!bot.hasDoubleJumped && (nearLevel || goal.gap > 250)) {
        tryDoubleJump(scene, bot);
        return;
    }
    if (!nearLevel || goal.gap < 20) return;

    const recoveryTowardStage = Math.sign(aimX - bot.x);
    if (bot.name === 'FISHERMAN' && goal.gap < 550 && feet - goal.top < 250) {
        useDirSpecial(scene, bot, target, recoveryTowardStage);
    } else if (bot.hasDoubleJumped && DASH_REACH[bot.variant]) {
        useDirSpecial(scene, bot, target, recoveryTowardStage);
    }
}

// The target is off-stage: wait at the ledge nearest to them and hit them as they come back.
function edgeguard(scene, bot, target, surfaces, stageCenter) {
    let ledgeX = null;
    let best = Infinity;
    for (const surface of surfaces) {
        for (const edge of [surface.left + LEDGE_MARGIN + 5, surface.right - LEDGE_MARGIN - 5]) {
            const distance = Math.hypot(edge - target.x, surface.top - target.y);
            if (distance < best) {
                best = distance;
                ledgeX = edge;
            }
        }
    }
    if (ledgeX === null) return false;
    walkTo(scene, bot, ledgeX, surfaces, 15);
    if (Math.abs(target.x - bot.x) > 20) {
        bot.lastDir = { x: Math.sign(target.x - bot.x), y: 0 };
    }
    return true;
}

export function runBotAI(scene, bot, target, fiveframecount) {
    //let the ai make the ai 🔥
    bot.horizontalMovementActive = false;
    const now = scene.time.now;
    const ground = scene.gameState.map.ground;
    const stageCenter = ground.x;
    const surfaces = getSurfaces(scene);
    const grounded = isGrounded(bot);
    if (grounded) bot.hasDoubleJumped = false;

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    const side = Math.sign(dx) || 1;
    const targetHittable = target.active && !isInvincible(target);
    const targetOffStage = isOffStage(target, surfaces);
    // ======================
    // DISABLED STATES
    // ======================

    if (!bot.hitstun && !bot.freeze && !bot.hasHitSideSpecial &&
        bot.isUsingSideSpecial && fiveframecount === 5) {
        handleDirSpecialAttack(scene, bot, target);
    }

    // CROWBARMAN's grab: fling them toward the closer side of the stage right away.
    if (bot.activeGrab) {
        bot.lastDir = { x: target.x < stageCenter ? -1 : 1, y: 0 };
        handleAttack(scene, bot, target);
        send(scene, bot, Commands.NONE);
        return;
    }

    if (bot.hitstun || bot.freeze || bot.isUsingSideSpecial) {
        send(scene, bot, Commands.NONE);
        return;
    }

    if (bot.plankModeReturnAt && now >= bot.plankModeReturnAt &&
        !bot.airPlankSequence && !bot.chainsawMode) {
        toggleChainsawMode(scene, bot);
        bot.plankModeReturnAt = 0;
    }

    const isChainsawAxeman =
        bot.name === 'AXEMAN' && bot.variant === 'CHAINSAW';
    if (isChainsawAxeman) {
        if (grounded) {
            bot.airPlankUsed = false;
        } else if (!bot.airPlankUsed && !bot.airPlankSequence && !bot.hitstun && !bot.freeze &&
            bot.woodCount >= PLANK_WOOD_COST && bot.body.velocity.y > 50 &&
            ((isOffStage(bot, surfaces) && bot.hasDoubleJumped) || bot.airTime > 1850)) {
            // CLUTCH: one plank right under his feet, paid for with the reserve.
            if (bot.chainsawMode) toggleChainsawMode(scene, bot);
            if (!bot.chainsawMode) {
                bot.airPlankUsed = true;
                bot.airPlankSequence = true;
                placeBotPlank(scene, bot, target, bot.x, bot.y + 70, { x: 0, y: 1 });
                finishAirPlankSequence(scene, bot);
            }
        }
    }

    if (bot.airPlankSequence) {
        send(scene, bot, Commands.NONE);
        return;
    }

    // ======================
    // RECOVERY
    // ======================

    // Standing on a plank with no stage under it (CHAINSAW's clutch) counts too.
    const onPlankOffStage = grounded && !surfaceBelow(surfaces, bot.x, bot.body.bottom);
    if (isOffStage(bot, surfaces) || onPlankOffStage) {
        recover(scene, bot, target, surfaces);
        return;
    }

    // ======================
    // DOWNSLAM (only over the stage)
    // ======================

    if (!grounded && bot.airTime >= 1000 && dy > 0 && distance <= 125 &&
        targetHittable && now >= (bot.nextDownslamTime || 0)) {
        bot.nextDownslamTime = now + 1000;
        send(scene, bot, Commands.DOWNSLAM);
        return;
    }

    // Back off from a dir special that's already coming at us.
    if (target.isUsingSideSpecial && distance < 200 && !targetOffStage) {
        if (!walk(scene, bot, -side, surfaces) && grounded &&
            now - bot.lastJump > 500) {
            bot.lastJump = now;
            send(scene, bot, Commands.UP);
        }
        return;
    }

    if (bot.name === "GUNMAN") {
        const horizontalLane = Math.abs(dy + 10) <= target.body.height / 2 + 1;
        const verticalLane = Math.abs(dx) <= target.body.width / 2 + 1;
        const canShootHorizontally = horizontalLane && Math.abs(dx) > 50;
        const canShootVertically = verticalLane && (dy <= -35 || dy >= 15);
        const specialHorizontal = canShootHorizontally && Math.abs(dx) <= 1000;
        const specialVertical = canShootVertically && Math.abs(dy) <= 1000;

        if (targetHittable && (specialHorizontal || specialVertical) &&
            !bot.gunmanSpecialActive && now >= bot.nextSideSpecialTime) {
            bot.lastDir = specialHorizontal
                ? { x: Math.sign(dx), y: 0 }
                : { x: 0, y: Math.sign(dy) };
            const specialDirection = bot.lastDir.x < 0 ? 'left' : 'right';
            handleDirSpecial(scene, bot, specialDirection, now, target);
        }

        if (canShootHorizontally || canShootVertically) {
            bot.lastDir = canShootHorizontally
                ? { x: Math.sign(dx), y: 0 }
                : { x: 0, y: Math.sign(dy) };

            if (targetHittable && now >= bot.nextAttackTime && bot.canAttack) {
                handleAttack(scene, bot, target);
            }
            send(scene, bot, Commands.NONE);
            return;
        }

        // Too close to shoot: step back to get a clean line.
        if (horizontalLane && Math.abs(dx) <= 50) {
            if (!walk(scene, bot, -side, surfaces)) bot.lastDir = { x: side, y: 0 };
            return;
        }
    }

    if (isChainsawAxeman && !bot.airPlankSequence &&
        now >= (bot.plankModeReturnAt || 0)) {
        const targetDistance = distance;

        bot.nextWoodGatherTime ??= now + 1500 + Math.random() * 1500;
        bot.nextPlankTime ??= now + 2500 + Math.random() * 2000;
        // Farming needs a running saw, and the saw won't start for 5s after an explosion.
        const sawReady = now >= (bot.chainsawCooldownUntil ?? 0);

        if (bot.chainsawGathering) {
            if (targetDistance <= 230 || bot.woodCount >= MAX_CHAINSAW_WOOD || !grounded || !sawReady) {
                bot.chainsawGathering = false;
                bot.nextWoodGatherTime = now + 2500 + Math.random() * 2500;
                bot.lastDir = { x: side, y: 0 };
                if (bot.chainsawActive) handleAttack(scene, bot, target);
            } else {
                if (!bot.chainsawMode) toggleChainsawMode(scene, bot);
                bot.lastDir = { x: 0, y: 1 };
                if (!bot.chainsawActive &&
                    now >= (bot.chainsawCooldownUntil ?? 0)) {
                    handleAttack(scene, bot, target);
                }
                send(scene, bot, Commands.NONE);
                return;
            }
        }

        if (grounded && sawReady && targetDistance > 230 && bot.woodCount < MAX_CHAINSAW_WOOD &&
            now >= bot.nextWoodGatherTime) {
            bot.chainsawGathering = true;
            if (!bot.chainsawMode) toggleChainsawMode(scene, bot);
            bot.lastDir = { x: 0, y: 1 };
            if (!bot.chainsawActive &&
                now >= (bot.chainsawCooldownUntil ?? 0)) {
                handleAttack(scene, bot, target);
            }
            send(scene, bot, Commands.NONE);
            return;
        }

        // Wall them off: on a timer from range, or right away while the saw is
        // cooling down and they're coming in close. A close wall goes halfway
        // between them so it actually lands in their way.
        const wallOff = !sawReady && targetDistance < 200 && targetDistance > 90 &&
            now >= (bot.nextCooldownWallTime ?? 0);
        const wantsWall = bot.woodCount >= WALL_WOOD_NEEDED &&
            ((targetDistance >= 200 && now >= bot.nextPlankTime) || wallOff);
        if (wantsWall && bot.chainsawMode) toggleChainsawMode(scene, bot);
        if (wantsWall && !bot.chainsawMode) {
            if (wallOff) bot.nextCooldownWallTime = now + 1800;
            const direction = { x: side, y: 0 };
            const wallGap = wallOff ? Phaser.Math.Clamp(Math.abs(dx) / 2, 45, 100) : 200;
            placeBotPlank(
                scene,
                bot,
                target,
                bot.x + direction.x * wallGap,
                bot.y - 50,
                direction
            );
            bot.plankModeReturnAt = now + 350;
            bot.nextPlankTime = now + 3500 + Math.random() * 2500;
            send(scene, bot, Commands.NONE);
            return;
        }

        if (targetHittable && targetDistance <= SAW_ENGAGE_RANGE &&
            fightWithSaw(scene, bot, target, surfaces, grounded)) {
            return;
        }
    }

    // ======================
    // ATTACK
    // ======================

    const usesBasicCombo = bot.name !== "GUNMAN" && !isChainsawAxeman;
    const readyToAttack = bot.canAttack && now >= bot.nextAttackTime;
    if (usesBasicCombo && targetHittable && readyToAttack) {
        const isDagger = bot.name === 'SWORDMAN' && bot.variant === 'DAGGER';
        const lightRange = (isDagger ? DAGGER_RANGE : LIGHT_RANGE) - RANGE_MARGIN;
        const attackDir = chooseAttackDir(bot, target, lightRange, stageCenter);
        if (attackDir) {
            bot.lastDir = attackDir;
            bot.lastAttack = now;
            // Standing still keeps tryAttack on the combo instead of pushAttack.
            send(scene, bot, Commands.NONE);
            handleAttack(scene, bot, target);
            return;
        }

        // Running in from just outside combo range: the moving attack reaches further.
        const runningIn = Math.sign(bot.body.velocity.x) === side &&
            Math.abs(bot.body.velocity.x) > 40;
        if (bot.combo === 0 && runningIn && Math.abs(dy) < 60 &&
            wouldHit(bot, target, { x: side, y: 0 }, PUSH_RANGE - RANGE_MARGIN)) {
            bot.lastAttack = now;
            if (walk(scene, bot, side, surfaces)) {
                handleAttack(scene, bot, target);
                return;
            }
        }
    }

    // ======================
    // EDGEGUARD
    // ======================

    if (targetOffStage && usesBasicCombo) {
        edgeguard(scene, bot, target, surfaces, stageCenter);
        return;
    }

    // ======================
    // CHARACTER SPECIALS
    // ======================

    if (targetHittable && !targetOffStage && now >= bot.nextSideSpecialTime &&
        now - bot.lastDirSpecial > 500 && specialFits(bot, dx, dy, grounded)) {
        // Don't dash off the end of the stage.
        const reach = DASH_REACH[bot.variant] ?? 0;
        if (!reach || surfaceBelow(surfaces, bot.x + side * reach, bot.body.bottom)) {
            useDirSpecial(scene, bot, target, side);
            send(scene, bot, Commands.NONE);
            return;
        }
    }

    // ======================
    // MOVEMENT
    // ======================

    // Target above: jump, and save the double jump for the top of the first one.
    if (dy < -90 && Math.abs(dx) < 300) {
        if (grounded && now - bot.lastJump > 400) {
            bot.lastJump = now;
            send(scene, bot, Commands.UP);
        } else if (!grounded && bot.body.velocity.y > -80 && dy < -60) {
            tryDoubleJump(scene, bot);
        }
    }

    // Target below while on a platform: walk off its nearer edge (the top
    // platforms can't be dropped through).
    const platform = bot.currentPlatform;
    if (dy > 80 && grounded && platform && platform !== ground &&
        Math.abs(dx) < platform.body.width / 2) {
        const toLeft = bot.x - platform.body.left;
        const toRight = platform.body.right - bot.x;
        const leftOpen = surfaceBelow(surfaces, platform.body.left - LEDGE_MARGIN, bot.body.bottom + 1);
        const exitDir = (toLeft < toRight && leftOpen) || !surfaceBelow(surfaces, platform.body.right + LEDGE_MARGIN, bot.body.bottom + 1)
            ? -1
            : 1;
        bot.lastDir = { x: exitDir, y: 0 };
        send(scene, bot, exitDir < 0 ? Commands.LEFT : Commands.RIGHT);
        return;
    }

    if (Math.abs(dx) > CHASE_DEADZONE) {
        walk(scene, bot, side, surfaces);
    } else {
        send(scene, bot, Commands.NONE);
    }
}

// Whether this character's dir special is worth using from here.
function specialFits(bot, dx, dy, grounded) {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    switch (bot.name) {
        case 'AXEMAN':
            return bot.variant !== 'CHAINSAW' && adx < 150 && ady < 50;
        case 'SWORDMAN':
            // QUICKSTEP passes through the target, so DAGGER keeps it for recovery.
            return bot.variant !== 'DAGGER' && adx > 200 && adx < 350 && ady < 60;
        case 'FISHERMAN':
            return adx > 250 && adx < 450 && ady < 80;
        case 'SCYTHEMAN':
            return adx < 300 && ady < 125;
        case 'HAMMERMAN':
            return adx < 80 && ady < 100;
        case 'SLATEMAN':
            return adx < 130 && ady < 50;
        case 'CROWBARMAN':
            return grounded && adx > 90 && adx < 200 && ady < 50;
        default:
            return false;
    }
}

function ensureSawRunning(scene, bot, target) {
    if (!bot.chainsawMode) toggleChainsawMode(scene, bot);
    const now = scene.time.now;
    if (!bot.chainsawActive && now >= (bot.chainsawCooldownUntil ?? 0) &&
        now - bot.lastAttack > 300) {
        bot.lastAttack = now;
        handleAttack(scene, bot, target);
    }
}

// The saw cuts continuously instead of swinging, and only points one of four
// ways. So the bot moves into reach, faces whichever way would cut, and holds
// the saw on the target. Returns false when it has nothing to fight with.
function fightWithSaw(scene, bot, target, surfaces, grounded) {
    const now = scene.time.now;
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const side = Math.sign(dx) || bot.lastDir.x || 1;

    // No saw for a while after an explosion: back off instead of walking in empty-handed.
    if (now < (bot.chainsawCooldownUntil ?? 0)) {
        if (Math.hypot(dx, dy) < 220) {
            walk(scene, bot, -side, surfaces);
        } else {
            send(scene, bot, Commands.NONE);
        }
        bot.lastDir = { x: side, y: 0 };
        return true;
    }

    const cutFacing = [{ x: side, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]
        .find(dir => wouldHit(bot, target, dir, SAW_CONTACT_RANGE));

    if (cutFacing) {
        // Cutting: stay on them as they get pushed around.
        const holdX = cutFacing.y === 0 ? target.x - cutFacing.x * 60 : target.x;
        if (Math.abs(holdX - bot.x) > 10) walk(scene, bot, Math.sign(holdX - bot.x), surfaces);
        else send(scene, bot, Commands.NONE);
        bot.lastDir = cutFacing;
        ensureSawRunning(scene, bot, target);

        // Rampage only pays off once the saw is already on them.
        if (bot.chainsawActive && bot.chainsawContactDuration > 150 &&
            now >= bot.nextSideSpecialTime && now >= (bot.rampageCooldownUntil ?? 0)) {
            const direction = side < 0 ? 'left' : 'right';
            handleDirSpecial(scene, bot, direction, now, target);
            handleDirSpecial(scene, bot, direction, now, target);
        }
        return true;
    }

    // Closing in. Chasing jumps throws the blade off, so:
    //  - target in the air above: get under them with the saw pointed up and let
    //    them fall onto it.
    //  - target standing somewhere higher: jump up to their level.
    //  - otherwise line up beside them, or over them when they're below.
    const targetGrounded = isGrounded(target);
    const above = dy < -45;
    let facing;
    if (above && !targetGrounded && Math.abs(dx) < 160) {
        facing = { x: 0, y: -1 };
        walkTo(scene, bot, target.x, surfaces, 8);
    } else if (Math.abs(dx) < 45 && dy > 60) {
        facing = { x: 0, y: 1 };
        walkTo(scene, bot, target.x, surfaces, 8);
    } else {
        facing = { x: side, y: 0 };
        walkTo(scene, bot, target.x - side * 50, surfaces, 8);
        if (above && targetGrounded && Math.abs(dx) < 220) {
            if (grounded && now - bot.lastJump > 400) {
                bot.lastJump = now;
                send(scene, bot, Commands.UP);
            } else if (!grounded && bot.body.velocity.y > 0) {
                tryDoubleJump(scene, bot);
            }
        }
    }
    bot.lastDir = facing;
    // Start the motor on the way in so the blade is already cutting on contact.
    if (Math.hypot(dx, dy) < SAW_SPINUP_RANGE) ensureSawRunning(scene, bot, target);
    return true;
}

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
