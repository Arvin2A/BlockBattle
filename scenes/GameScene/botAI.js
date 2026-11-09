// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { Commands } from "../../commands.js";
import { executeStateCommand } from "../../commands.js";
import { handleAttack, handleMisc, tryExtraJump, canExtraJump } from "../../attacks.js";
import { handleDirSpecial } from "../../attacks.js";
import { handleDirSpecialAttack } from "../../attacks.js";
import { toggleChainsawMode } from "../../attacks.js";
import { isInvincible, attackIsElligible } from "../../attacks.js";
import { handleNeutralSpecial, tryQuickslamJump } from "../../attacks.js";
import { isBlockedByWall } from "../../combat/planks.js";
import { botDifficulty } from "../../gameSettings.js";
import { isUniversalBusy, tryLedgeGrab, ledgeClimb, smackDown, canSmackDown } from "../../combat/universalMoves.js";

// How each difficulty holds back. VERY HARD is the bot at full strength.
//  thinkMs:       time between decisions; movement is held in between.
//  attackDelayMs: extra wait on top of the attack cooldown after each swing.
//  hesitate:      chance to pass on an open attack or special, and for how long.
//  edgeguard / dodgeSpecials / downslam / smack / ledge: whether it does these at all.
const DIFFICULTY = {
    EASY: {
        thinkMs: 320, attackDelayMs: 450, hesitateChance: 0.55, hesitateMs: 500,
        edgeguard: false, dodgeSpecials: false, downslam: false,
        smack: false, ledge: true, blockChance: 0, dodgeMinigun: false
    },
    NORMAL: {
        thinkMs: 140, attackDelayMs: 150, hesitateChance: 0.25, hesitateMs: 300,
        edgeguard: true, dodgeSpecials: false, downslam: true,
        smack: true, ledge: true, blockChance: 0.25, dodgeMinigun: false
    },
    HARD: {
        thinkMs: 0, attackDelayMs: 0, hesitateChance: 0, hesitateMs: 0,
        edgeguard: false, dodgeSpecials: true, downslam: true,
        smack: false, ledge: false, blockChance: 0.5, dodgeMinigun: true, predictBlock: false
    },
    'VERY HARD': {
        thinkMs: 0, attackDelayMs: 0, hesitateChance: 0, hesitateMs: 0,
        edgeguard: true, dodgeSpecials: true, downslam: true,
        smack: true, ledge: true, blockChance: 0.5, dodgeMinigun: true, predictBlock: true
    }
};

const SPECIAL_REACH = {
    LONGSWORD: 330,
    DAGGER: 200,
    LUMBERER: 170,
    METAMORPHIC: 150,
    LANDSCAPER: 170,
    MALLET: 110,
    SLEDGEHAMMER: 260,
    HOOKER: 220
};
const SPECIAL_BLOCK_MS = 600;
const SPECIAL_WATCH_RANGE = 450;
const GUARD_ROLL_MS = 500;
const GUARD_CHANCE = 0.3;
const GUARD_MS = 350;
const GUARD_MIN_SHIELD = 0.6;
const FINISHER_GUARD_RANGE = 130;
const FINISHER_GUARD_MS = 300;
const AFTER_SMACK_BLOCK_MS = 600;
const SPECIAL_DODGE_MS = 450;

const MINI_LANE_HALF = 45;
const MINI_ESCAPE_MS = 900;
const MINI_LEVEL_GAP = 60;
const MINI_MAX_CLIMB = 300;

const QUICKSLAM_FOLLOW_DELAY = 400;
const QUICKSLAM_JUMP_WINDOW = 1000;
const MALLET_HEAL_KB = 1.35;
const MALLET_SAFE_HEAL_RANGE = 260;
const WALL_RANGE = { min: 110, max: 320 };
const WALL_BREAK_HEALTH = 0.15;
const OWN_WALL_HOLD_RANGE = 300;
const WALL_JUMP_GAP = 90;
const OWN_WALL_SETTLE_MS = 1500;
const HAMMER_SWINGS = {
    MALLET: { range: 110, windupMs: 150 },
    SLEDGEHAMMER: { range: 150, windupMs: 800 }
};
const HAMMER_SPACING_MARGIN = 15;
const SLEDGE_TOO_CLOSE = 95;
const QUICKSLAM_REACH = 240;
const QUICKSLAM_MAX_DY = 60;

const BOT_BLOCK_MS = 350;
const BOT_BLOCK_RANGE = 160;
const BOT_BLOCK_MIN_SHIELD = 0.35;

function dodgesInsteadOfBlocking(target) {
    return target.name === 'FISHERMAN' || (target.name === 'GUNMAN' && target.gunmanSpecialActive);
}

function specialJustStarted(bot, target) {
    const cooldownEnd = target.nextSideSpecialTime ?? 0;
    const started = bot.botSeenSpecialEnd !== undefined && cooldownEnd > bot.botSeenSpecialEnd;
    bot.botSeenSpecialEnd = cooldownEnd;
    return started;
}

function blockFor(bot, now, ms) {
    bot.botBlockUntil = Math.max(bot.botBlockUntil ?? 0, now + ms);
}

function predictBlocks(bot, target, distance, now, specialStarted) {
    if (bot.smackedBy || bot.smackArc || bot.flatSquash) bot.botBlockAfterSmack = true;
    if (bot.botBlockAfterSmack && !bot.hitstun && !bot.smackedBy) {
        bot.botBlockAfterSmack = false;
        blockFor(bot, now, AFTER_SMACK_BLOCK_MS);
    }
    if (dodgesInsteadOfBlocking(target)) return;

    if (specialStarted && distance < SPECIAL_WATCH_RANGE) blockFor(bot, now, SPECIAL_BLOCK_MS);

    const reach = SPECIAL_REACH[target.variant];
    const facingBot = Math.sign(bot.x - target.x) === Math.sign(target.lastDir?.x ?? 0);
    const specialReady = now >= (target.nextSideSpecialTime ?? 0);
    if (reach && specialReady && facingBot && distance <= reach && Math.abs(bot.y - target.y) < 80 &&
        (bot.shield ?? 1) > GUARD_MIN_SHIELD && now >= (bot.botNextGuardRoll ?? 0)) {
        bot.botNextGuardRoll = now + GUARD_ROLL_MS;
        if (Math.random() < GUARD_CHANCE) blockFor(bot, now, GUARD_MS);
    }

    const finisherNext = (target.combo ?? 0) >= 2 && distance < FINISHER_GUARD_RANGE;
    if (finisherNext && !bot.botFinisherGuarded && now >= (target.nextAttackTime ?? 0) - 100) {
        bot.botFinisherGuarded = true;
        blockFor(bot, now, FINISHER_GUARD_MS);
    } else if (!finisherNext) {
        bot.botFinisherGuarded = false;
    }
}

function updateBotBlock(bot, target, distance, difficulty, now) {
    const specialStarted = specialJustStarted(bot, target);
    if (specialStarted && difficulty.dodgeSpecials && target.name === 'FISHERMAN' &&
        distance < SPECIAL_WATCH_RANGE) {
        bot.botDodgeUntil = now + SPECIAL_DODGE_MS;
    }
    if (difficulty.predictBlock) predictBlocks(bot, target, distance, now, specialStarted);

    const threat = (target.isAttacking || target.isUsingSideSpecial) && distance < BOT_BLOCK_RANGE &&
        !dodgesInsteadOfBlocking(target);
    if (threat && !bot.botThreatSeen) {
        bot.botThreatSeen = true;
        if (Math.random() < difficulty.blockChance) blockFor(bot, now, BOT_BLOCK_MS);
    } else if (!threat) {
        bot.botThreatSeen = false;
    }
    bot.botWantsBlock = now < (bot.botBlockUntil ?? 0) && (bot.shield ?? 1) > BOT_BLOCK_MIN_SHIELD;
}

function getDifficulty(bot) {
    return DIFFICULTY[botDifficulty[bot.id]] ?? DIFFICULTY['VERY HARD'];
}

// Rolls whether the bot passes on an opening; a pass blocks it for hesitateMs
// so it isn't rerolled every frame.
function hesitates(bot, difficulty, now) {
    if (now < (bot.botHesitateUntil ?? 0)) return true;
    if (Math.random() >= difficulty.hesitateChance) return false;
    bot.botHesitateUntil = now + difficulty.hesitateMs;
    return true;
}

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
const FLANK_OFFSET = 70;
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
    // Walking is remembered so a slower bot keeps it up between decisions.
    if (type === Commands.LEFT || type === Commands.RIGHT || type === Commands.NONE) {
        bot.botHeldCommand = type;
    }
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
    const needsLift = feet > goal.top + 20 || goal.gap > 250;
    if (bot.hasDoubleJumped && needsLift && bot.body.velocity.y > 40 && canExtraJump(bot)) {
        tryExtraJump(scene, bot, target);
        return;
    }
    if (!nearLevel || goal.gap < 20) return;

    const recoveryTowardStage = Math.sign(aimX - bot.x);
    if (bot.variant === 'ANGLER' && goal.gap < 550 && feet - goal.top < 250) {
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
    const stageCenter = scene.gameState.map.infinite ? target.x : ground.x;
    const surfaces = getSurfaces(scene);
    const grounded = isGrounded(bot);
    if (grounded) bot.hasDoubleJumped = false;

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    const side = Math.sign(dx) || 1;
    const targetHittable = target.active && !isInvincible(target);
    const targetOffStage = isOffStage(target, surfaces);
    const difficulty = getDifficulty(bot);
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

    updateBotBlock(bot, target, distance, difficulty, now);
    if (bot.hitstun && target.name === 'GUNMAN' && target.gunmanSpecialActive) bot.botMiniHitAt = now;
    if (isUniversalBusy(bot)) {
        if (bot.ledge && !bot.ledge.climbing && now >= (bot.botLedgeClimbAt ?? 0)) ledgeClimb(scene, bot);
        return;
    }

    if (bot.hitstun || bot.freeze || bot.isUsingSideSpecial) {
        send(scene, bot, Commands.NONE);
        return;
    }

    if (bot.quickslamJumpTarget && now < bot.quickslamJumpUntil &&
        now >= bot.quickslamJumpUntil - QUICKSLAM_JUMP_WINDOW + QUICKSLAM_FOLLOW_DELAY &&
        tryQuickslamJump(scene, bot, now)) {
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
        if (difficulty.ledge && tryLedgeGrab(scene, bot, target)) {
            bot.botLedgeClimbAt = now + 100 + Math.random() * 500;
            return;
        }
        recover(scene, bot, target, surfaces);
        return;
    }

    if (dodgeMinigun(scene, bot, target, surfaces, grounded, difficulty, now)) return;

    // Lower difficulties react slower: between decisions they keep walking
    // the way they were.
    if (now < (bot.botNextThinkAt ?? 0)) {
        send(scene, bot, bot.botHeldCommand ?? Commands.NONE);
        return;
    }
    bot.botNextThinkAt = now + difficulty.thinkMs;

    // ======================
    // DOWNSLAM (only over the stage)
    // ======================

    if (difficulty.downslam && !grounded && bot.airTime >= 1000 && dy > 0 && distance <= 125 &&
        targetHittable && now >= (bot.nextDownslamTime || 0)) {
        bot.nextDownslamTime = now + 1000;
        send(scene, bot, Commands.DOWNSLAM);
        return;
    }

    if (difficulty.smack && grounded && !isGrounded(target) && targetHittable &&
        canSmackDown(scene, bot, target) && !hesitates(bot, difficulty, now)) {
        smackDown(scene, bot, target);
        return;
    }

    // Back off from a dir special that's already coming at us.
    if (difficulty.dodgeSpecials && target.isUsingSideSpecial && distance < 200 && !targetOffStage) {
        if (!walk(scene, bot, -side, surfaces) && grounded &&
            now - bot.lastJump > 500) {
            bot.lastJump = now;
            send(scene, bot, Commands.UP);
        }
        return;
    }

    if (bot.name === 'SCYTHEMAN' && bot.variant === 'LAWNMOWER' &&
        runLawnmowerBot(scene, bot, target, surfaces, grounded, difficulty, now)) {
        return;
    }

    if (bot.name === "GUNMAN") {
        const horizontalLane = Math.abs(dy + 10) <= target.body.height / 2 + 1;
        const verticalLane = Math.abs(dx) <= target.body.width / 2 + 1;
        const canShootHorizontally = horizontalLane && Math.abs(dx) > 50;
        // Basic shots are locked out during the minigun, so don't stand and aim
        // up/down at them; let the movement below line the bot back up instead.
        const canShootVertically = verticalLane && (dy <= -35 || dy >= 15) &&
            !bot.gunmanSpecialActive;
        // The minigun only fires sideways, so only start it with a horizontal line.
        const specialHorizontal = canShootHorizontally && Math.abs(dx) <= 1000;

        if (targetHittable && specialHorizontal &&
            !bot.gunmanSpecialActive && now >= bot.nextSideSpecialTime) {
            bot.lastDir = { x: Math.sign(dx), y: 0 };
            handleDirSpecial(scene, bot, dx < 0 ? 'left' : 'right', now, target);
        }

        if (canShootHorizontally || canShootVertically) {
            bot.lastDir = canShootHorizontally
                ? { x: Math.sign(dx), y: 0 }
                : { x: 0, y: Math.sign(dy) };

            if (targetHittable && now >= bot.nextAttackTime && bot.canAttack &&
                now >= (bot.botNextAttackAt ?? 0) && !hesitates(bot, difficulty, now)) {
                bot.botNextAttackAt = now + difficulty.attackDelayMs;
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
    const readyToAttack = bot.canAttack && now >= bot.nextAttackTime &&
        now >= (bot.botNextAttackAt ?? 0);
    const hammerSwing = bot.name === 'HAMMERMAN' ? HAMMER_SWINGS[bot.variant] : null;
    if (hammerSwing && targetHittable &&
        planHammerSwing(scene, bot, target, surfaces, hammerSwing, readyToAttack, difficulty, now)) {
        return;
    }
    if (!hammerSwing && usesBasicCombo && targetHittable && readyToAttack) {
        const isDagger = bot.name === 'SWORDMAN' && bot.variant === 'DAGGER';
        const lightRange = (isDagger ? DAGGER_RANGE : LIGHT_RANGE) - RANGE_MARGIN;
        const attackDir = chooseAttackDir(bot, target, lightRange, stageCenter);
        if (attackDir && !hesitates(bot, difficulty, now)) {
            bot.lastDir = attackDir;
            bot.lastAttack = now;
            bot.botNextAttackAt = now + difficulty.attackDelayMs;
            // Standing still keeps tryAttack on the combo instead of pushAttack.
            send(scene, bot, Commands.NONE);
            handleAttack(scene, bot, target);
            return;
        }

        // Running in from just outside combo range: the moving attack reaches further.
        const runningIn = Math.sign(bot.body.velocity.x) === side &&
            Math.abs(bot.body.velocity.x) > 40;
        if (bot.combo === 0 && runningIn && Math.abs(dy) < 60 &&
            wouldHit(bot, target, { x: side, y: 0 }, PUSH_RANGE - RANGE_MARGIN) &&
            !hesitates(bot, difficulty, now)) {
            bot.lastAttack = now;
            bot.botNextAttackAt = now + difficulty.attackDelayMs;
            if (walk(scene, bot, side, surfaces)) {
                handleAttack(scene, bot, target);
                return;
            }
        }
    }

    if (tryMalletSafeHeal(scene, bot, target, distance, side, grounded, difficulty, now)) return;
    if (tryPlaceWall(scene, bot, target, surfaces, dx, dy, grounded, targetOffStage, difficulty, now)) return;

    // ======================
    // EDGEGUARD
    // ======================

    if (targetOffStage && usesBasicCombo && difficulty.edgeguard) {
        edgeguard(scene, bot, target, surfaces, stageCenter);
        return;
    }

    // ======================
    // CHARACTER SPECIALS
    // ======================

    if (targetHittable && !targetOffStage && now >= bot.nextSideSpecialTime &&
        now - bot.lastDirSpecial > 500 && specialFits(bot, dx, dy, grounded) &&
        !hesitates(bot, difficulty, now)) {
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

    if (handleWallInWay(scene, bot, target, surfaces, grounded, now)) return;

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

    const flankOffset = hammerSwing ? hammerSwing.range - HAMMER_SPACING_MARGIN : FLANK_OFFSET;
    if (walkTo(scene, bot, flankX(bot, target, stageCenter, surfaces, flankOffset), surfaces)) {
        bot.lastDir = { x: side, y: 0 };
    }
}

function flankX(bot, target, stageCenter, surfaces, offset = FLANK_OFFSET) {
    const onSide = Math.sign(bot.x - target.x) || Math.sign(stageCenter - target.x) || 1;
    const feet = Math.max(bot.body.bottom, target.body.bottom);
    for (const flank of [onSide, -onSide]) {
        const x = target.x + flank * offset;
        if (surfaceBelow(surfaces, x, feet - 4)) return x;
    }
    return target.x + onSide * offset;
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
            // TRAPPER's net is slower and shorter than the hook, but lands on them from above.
            if (bot.variant === 'TRAPPER') return adx > 150 && adx < 400 && ady < 150;
            return adx > 250 && adx < 450 && ady < 80;
        case 'SCYTHEMAN':
            if (bot.variant === 'LAWNMOWER') return false;
            // GRUELING SLAM only reaches about one scythe length in front.
            return adx < 140 && ady < 110;
        case 'HAMMERMAN':
            if (bot.variant === 'SLEDGEHAMMER') return false;
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

function tryMalletSafeHeal(scene, bot, target, distance, side, grounded, difficulty, now) {
    if (bot.name !== 'HAMMERMAN' || bot.variant !== 'MALLET' || !grounded) return false;
    if (bot.KBmultiplier < MALLET_HEAL_KB || now < bot.nextSideSpecialTime) return false;
    const safe = distance > MALLET_SAFE_HEAL_RANGE || isBlockedByWall(target, bot);
    if (!safe || hesitates(bot, difficulty, now)) return false;
    useDirSpecial(scene, bot, target, side);
    send(scene, bot, Commands.NONE);
    return true;
}

function tryPlaceWall(scene, bot, target, surfaces, dx, dy, grounded, targetOffStage, difficulty, now) {
    if (bot.name !== 'HAMMERMAN' || !grounded || now < (bot.botNextWallAt ?? 0)) return false;
    const sledge = bot.variant === 'SLEDGEHAMMER';
    const activeWalls = (bot.steelPlanks ?? []).filter(plank => plank.active).length;
    if (activeWalls >= (sledge ? 1 : 2) || isBlockedByWall(target, bot)) return false;

    const side = Math.sign(dx) || bot.lastDir.x || 1;
    const adx = Math.abs(dx);
    const vx = target.body.velocity.x;
    const approaching = Math.sign(vx) === -side && Math.abs(vx) > 60;
    const threatened = approaching || target.isUsingSideSpecial || target.name === 'GUNMAN';
    const wantsHealCover = !sledge && bot.KBmultiplier >= MALLET_HEAL_KB;
    const blockOff = !targetOffStage && adx > WALL_RANGE.min && adx < WALL_RANGE.max &&
        Math.abs(dy) < 100 && (threatened || wantsHealCover);
    const atLedge = !surfaceBelow(surfaces, bot.x + side * 90, bot.body.bottom);
    const edgeWall = targetOffStage && difficulty.edgeguard && atLedge && adx < 260 && dy > -150;
    if ((!blockOff && !edgeWall) || hesitates(bot, difficulty, now)) return false;

    bot.lastDir = { x: side, y: 0 };
    handleNeutralSpecial(scene, bot, target);
    bot.botNextWallAt = now + (sledge ? 6000 : 2500) + Math.random() * 2000;
    bot.botWallPlacedAt = now;
    send(scene, bot, Commands.NONE);
    return true;
}

function findWallInWay(scene, bot, target) {
    const left = Math.min(bot.x, target.x);
    const right = Math.max(bot.x, target.x);
    const walls = (scene.planks?.getChildren() ?? []).filter(plank =>
        plank.active && plank.body?.enable &&
        plank.body.height > plank.body.width &&
        plank.body.center.x > left && plank.body.center.x < right &&
        plank.body.top < bot.body.bottom - 4 && plank.body.bottom > bot.body.top + 4
    );
    return walls.sort((a, b) => Math.abs(a.body.center.x - bot.x) - Math.abs(b.body.center.x - bot.x))[0] ?? null;
}

function handleWallInWay(scene, bot, target, surfaces, grounded, now) {
    const wall = findWallInWay(scene, bot, target);
    if (!wall) return false;
    const toWall = Math.sign(wall.body.center.x - bot.x) || 1;
    const gap = toWall > 0 ? wall.body.left - bot.body.right : bot.body.left - wall.body.right;

    const ownWall = wall.owner === bot;
    const holdBehind = ownWall && Math.abs(target.x - bot.x) < OWN_WALL_HOLD_RANGE &&
        (!wall.blocksOwner || now - (bot.botWallPlacedAt ?? 0) < OWN_WALL_SETTLE_MS);
    if (holdBehind) {
        bot.lastDir = { x: toWall, y: 0 };
        send(scene, bot, Commands.NONE);
        return true;
    }

    const canBreak = !ownWall && (bot.name === 'HAMMERMAN' || (wall.health ?? Infinity) <= WALL_BREAK_HEALTH);
    if (canBreak && grounded) {
        if (gap > 25) {
            walk(scene, bot, toWall, surfaces);
            return true;
        }
        bot.lastDir = { x: toWall, y: 0 };
        send(scene, bot, Commands.NONE);
        if (bot.canAttack && now >= bot.nextAttackTime && !bot.isAttacking) handleAttack(scene, bot, target);
        return true;
    }

    walk(scene, bot, toWall, surfaces);
    if (grounded && gap < WALL_JUMP_GAP && now - bot.lastJump > 400) {
        bot.lastJump = now;
        send(scene, bot, Commands.UP);
    } else if (!grounded && bot.body.velocity.y > -60 && bot.body.bottom > wall.body.top - 10) {
        tryDoubleJump(scene, bot);
    }
    return true;
}

function predictTarget(target, ms) {
    const t = ms / 1000;
    const airborne = !isGrounded(target);
    const gravity = target.scene.physics.world.gravity.y;
    return {
        x: target.x + target.body.velocity.x * t,
        y: target.y + (airborne ? target.body.velocity.y * t + 0.5 * gravity * t * t : 0)
    };
}

function canQuickslam(bot, target, dx, dy, distance, now) {
    return now >= bot.nextSideSpecialTime && !bot.isAttacking && isGrounded(bot) &&
        distance <= QUICKSLAM_REACH && Math.abs(dy) < QUICKSLAM_MAX_DY && Math.abs(dx) > 20 &&
        !isBlockedByWall(bot, target);
}

function planHammerSwing(scene, bot, target, surfaces, swing, readyToAttack, difficulty, now) {
    const sledge = bot.variant === 'SLEDGEHAMMER';
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const side = Math.sign(dx) || bot.lastDir.x || 1;
    const distance = Math.hypot(dx, dy);

    if (sledge && canQuickslam(bot, target, dx, dy, distance, now) && !hesitates(bot, difficulty, now)) {
        useDirSpecial(scene, bot, target, side);
        send(scene, bot, Commands.NONE);
        return true;
    }

    if (sledge && distance < SLEDGE_TOO_CLOSE && !target.hitstun && readyToAttack) {
        if (walk(scene, bot, -side, surfaces)) {
            bot.lastDir = { x: side, y: 0 };
            return true;
        }
    }
    if (!readyToAttack || isBlockedByWall(bot, target)) return false;

    const reach = swing.range - RANGE_MARGIN;
    const predicted = predictTarget(target, swing.windupMs);
    const pdx = predicted.x - bot.x;
    const pdy = predicted.y - bot.y;
    const predictedDistance = Math.hypot(pdx, pdy);
    const swingSide = Math.sign(pdx) || side;
    let dir = null;
    if (predictedDistance <= reach && Math.abs(pdy) < 90 && Math.abs(pdx) > 20) {
        dir = { x: swingSide, y: 0 };
    } else if (predictedDistance <= reach && pdy < -30 && Math.abs(pdx) < 60) {
        dir = { x: 0, y: -1 };
    }
    if (!dir || hesitates(bot, difficulty, now)) return false;

    bot.lastDir = dir;
    bot.lastAttack = now;
    bot.botNextAttackAt = now + difficulty.attackDelayMs;
    send(scene, bot, Commands.NONE);
    handleAttack(scene, bot, target);
    return true;
}

function pickMinigunEscape(bot, target, surfaces) {
    let best = null;
    for (const surface of surfaces) {
        if (Math.abs(surface.top - target.body.bottom) < MINI_LEVEL_GAP) continue;
        if (surface.top < bot.body.bottom - MINI_MAX_CLIMB) continue;
        const x = Math.min(Math.max(bot.x, surface.left + 40), surface.right - 40);
        const awayBonus = Math.sign(x - target.x) === Math.sign(bot.x - target.x) ? 0 : 150;
        const score = Math.abs(x - bot.x) + Math.abs(surface.top - bot.body.bottom) * 0.5 + awayBonus;
        if (!best || score < best.score) best = { x, top: surface.top, score };
    }
    return best;
}

function dodgeMinigun(scene, bot, target, surfaces, grounded, difficulty, now) {
    const dodgingSpecial = now < (bot.botDodgeUntil ?? 0);
    const firing = difficulty.dodgeMinigun && target.name === 'GUNMAN' && target.gunmanSpecialActive;
    const recovering = difficulty.dodgeMinigun && target.name === 'GUNMAN' &&
        now - (bot.botMiniHitAt ?? -Infinity) < MINI_ESCAPE_MS;
    if (!firing && !recovering && !dodgingSpecial) return false;

    const inLane = Math.abs(bot.y - target.y) < MINI_LANE_HALF;
    const onOtherLevel = grounded && Math.abs(bot.body.bottom - target.body.bottom) >= MINI_LEVEL_GAP;
    if (onOtherLevel && !recovering && !dodgingSpecial) {
        bot.lastDir = { x: Math.sign(target.x - bot.x) || 1, y: 0 };
        send(scene, bot, Commands.NONE);
        return true;
    }

    const escape = pickMinigunEscape(bot, target, surfaces);
    const away = Math.sign(bot.x - target.x) || 1;
    const dirX = escape && Math.abs(escape.x - bot.x) > CHASE_DEADZONE ? Math.sign(escape.x - bot.x) : away;
    if (grounded) {
        walk(scene, bot, dirX, surfaces);
    } else {
        bot.lastDir = { x: dirX, y: 0 };
        send(scene, bot, dirX < 0 ? Commands.LEFT : Commands.RIGHT);
    }

    const needsHeight = inLane || dodgingSpecial || (escape && escape.top < bot.body.bottom - 10);
    if (grounded && needsHeight && now - bot.lastJump > 250) {
        bot.lastJump = now;
        send(scene, bot, Commands.UP);
    } else if (!grounded && needsHeight && bot.body.velocity.y > -60) {
        tryDoubleJump(scene, bot);
    }
    return true;
}

const MOWER_BOT = {
    ejectMin: 250,
    ejectMax: 800,
    ejectMaxDy: 50,
    rideFrom: 450,
    dismountAt: 170,
    plowStop: 55,
    plowMaxDy: 80,
    cordReach: 115,
    cordSpacing: 200,
    clipRange: 380,
    clipMinRange: 120,
    clipMinAmmo: 5,
    clipBurst: 6,
    clipCooldownMs: 2500
};

function lawnmowerClipBurst(scene, bot, target, adx, dy, side, hittable, now) {
    if ((bot.botClipBurst ?? 0) > 0) {
        if (now >= (bot.nextClippingsTime ?? 0)) {
            bot.lastDir = { x: side, y: 0 };
            handleNeutralSpecial(scene, bot, target);
            bot.botClipBurst -= 1;
        }
        return;
    }
    if (hittable && (bot.clippings ?? 0) >= MOWER_BOT.clipMinAmmo && adx > MOWER_BOT.clipMinRange &&
        adx < MOWER_BOT.clipRange && Math.abs(dy) < 60 && now >= (bot.botNextClipAt ?? 0)) {
        bot.botClipBurst = MOWER_BOT.clipBurst;
        bot.botNextClipAt = now + MOWER_BOT.clipCooldownMs;
    }
}

function runLawnmowerBot(scene, bot, target, surfaces, grounded, difficulty, now) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const adx = Math.abs(dx);
    const side = Math.sign(dx) || bot.lastDir.x || 1;
    const state = bot.mowerState ?? 'ready';
    const hittable = target.active && !isInvincible(target);
    const targetOffStage = isOffStage(target, surfaces);
    const lineClear = !isBlockedByWall(bot, target);
    const mowerOut = state === 'ready' || state === 'plow' || state === 'ride';

    if (hittable && lineClear && mowerOut && Math.abs(dy) < MOWER_BOT.ejectMaxDy &&
        adx > MOWER_BOT.ejectMin && adx < MOWER_BOT.ejectMax && now >= bot.nextSideSpecialTime &&
        !hesitates(bot, difficulty, now)) {
        useDirSpecial(scene, bot, target, side);
        send(scene, bot, Commands.NONE);
        return true;
    }

    lawnmowerClipBurst(scene, bot, target, adx, dy, side, hittable, now);

    if (state === 'ride') {
        if (adx < MOWER_BOT.dismountAt || targetOffStage) {
            handleMisc(scene, bot, target);
            return false;
        }
        walk(scene, bot, side, surfaces);
        return true;
    }
    if (mowerOut && grounded && adx > MOWER_BOT.rideFrom && !targetOffStage && !hesitates(bot, difficulty, now)) {
        handleMisc(scene, bot, target);
        walk(scene, bot, side, surfaces);
        return true;
    }

    if (state === 'cord' || state === 'dismounted') {
        if (hittable && adx < MOWER_BOT.cordReach && Math.abs(dy) < 60 &&
            bot.canAttack && now >= bot.nextAttackTime) {
            bot.lastDir = { x: side, y: 0 };
            send(scene, bot, Commands.NONE);
            handleAttack(scene, bot, target);
            return true;
        }
        if (targetOffStage || Math.abs(dy) > MOWER_BOT.plowMaxDy) return false;
        if (adx < MOWER_BOT.cordSpacing - 40) {
            if (!walk(scene, bot, -side, surfaces)) send(scene, bot, Commands.NONE);
        } else if (adx > MOWER_BOT.cordSpacing + 60) {
            walk(scene, bot, side, surfaces);
        } else {
            send(scene, bot, Commands.NONE);
        }
        bot.lastDir = { x: side, y: 0 };
        return true;
    }

    if (targetOffStage || Math.abs(dy) > MOWER_BOT.plowMaxDy) return false;
    if (adx > MOWER_BOT.plowStop) walk(scene, bot, side, surfaces);
    else send(scene, bot, Commands.NONE);
    bot.lastDir = { x: side, y: 0 };
    return true;
}
