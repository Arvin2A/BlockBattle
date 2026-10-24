// Attack blueprints. Every melee hit in the game is one of these with different
// numbers, so a new move is a spec object, not another copy of the hit code.
//
//   strike(scene, attacker, target, spec)  checks range/facing, then lands the hit
//   landHit(scene, attacker, target, spec) lands a hit that's already confirmed
//                                          (projectiles, overlaps, explosions)
//
// Two kinds of hit come out of the same spec:
//   stun hit:      give it `stun`. Both fighters freeze in place and the target
//                  barely moves. Combo starters (attack(), the dagger jabs).
//   knockback hit: no `stun`. The target is launched by `knockback` and can't act
//                  for `hitstun`. Combo enders, tilts and specials; these KO.
//
// Spec fields (all optional):
//   range, bypass       passed to attackIsElligible (strike only)
//   direction           aim, defaults to attacker.lastDir
//   damage              KB added to the target, times the attacker's damage scale
//                       (0.07 = +7%)
//   plankDamage         defaults to damage. strike() applies it when the swing
//                       resolves, hit or miss, so windups hit planks on time.
//   hitstun             ms the target can't act. With hitstunGrowth (default on)
//                       it's multiplied by the target's KB, so launches get longer
//                       as well as faster. Speed x time is what actually KOs.
//   stun                { target, attacker } ms each fighter is frozen
//   knockback           { x, y, ...see resolveLaunch } or a function returning {x, y}
//   hitFreeze           ms of hitstop
//   sound               a sound key, an array of keys, or 'light'/'finisher' for
//                       the attacker's hitSounds
//   decelerateAfter     ms (or target => ms) until the target slows down again
//   resetCombo          default true
//   noDeathRay          for pulls and the like
//   onHit(scene)        runs after damage, before the launch

import { attackIsElligible } from './eligibility.js';
import { applyKnockback, hitFreeze } from './knockback.js';
import { addSceneUpdateListener } from './effects.js';
import { damagePlanksInAttack } from './planks.js';
import { hideAttackSprite } from './attackSprite.js';
import { getAttackDamageScale, getHitSound } from './characterStats.js';

// A plunged target (Slateman's mark) takes this much extra horizontal knockback.
const PLUNGE_KNOCKBACK_BONUS = 1.0;

export function clearQueuedStunTimers(scene, attacker, target) {
    if (attacker.revokeAggressorStun) {
        scene.time.removeEvent(attacker.revokeAggressorStun);
        attacker.revokeAggressorStun = null;
    }
    if (target.revokeVictimStun) {
        scene.time.removeEvent(target.revokeVictimStun);
        target.revokeVictimStun = null;
    }
}

export function queueStunRelease(scene, attacker, target, attackerDelay = 400, victimDelay = 650) {
    clearQueuedStunTimers(scene, attacker, target);
    const stunToken = (target.stunToken || 0) + 1;
    target.stunToken = stunToken;
    attacker.revokeAggressorStun = scene.time.delayedCall(attackerDelay, () => {
        attacker.canAttack = true;
        attacker.freeze = false;
        attacker.willDecelerate = true;
        attacker.revokeAggressorStun = null;
    });
    target.revokeVictimStun = scene.time.delayedCall(victimDelay, () => {
        if (target.stunToken !== stunToken) return;
        target.hitstun = false;
        target.freeze = false;
        target.willDecelerate = true;
        target.revokeVictimStun = null;
    });
}

// Only the latest hit decides when the target slows down, so an old hit's timer
// can't cut a newer launch short.
export function scheduleDecelerate(scene, target, delay) {
    target.decelerateEvent?.remove(false);
    target.decelerateEvent = scene.time.delayedCall(delay, () => {
        target.decelerateEvent = null;
        if (target.active) target.willDecelerate = true;
    });
}

// The usual end of a swing: locked out of attacking for `recovery` ms and the
// weapon hidden after `hideAfter` ms (null keeps it out).
export function recoverAfterAttack(scene, attacker, { hideAfter = 250, recovery = 400 } = {}) {
    attacker.canAttack = false;
    if (hideAfter !== null) scene.time.delayedCall(hideAfter, () => hideAttackSprite(attacker));
    scene.time.delayedCall(recovery, () => {
        attacker.canAttack = true;
    });
}

// Runs onRelease after a windup. With interruptible, getting hit during the
// windup cancels it and runs onInterrupt instead.
export function afterWindup(scene, attacker, delay, onRelease, { interruptible = false, onInterrupt = null } = {}) {
    const windup = { interrupted: false };
    const removeCheck = interruptible
        ? addSceneUpdateListener(scene, () => {
            if (attacker.hitstun) windup.interrupted = true;
        })
        : () => { };
    scene.time.delayedCall(delay, () => {
        removeCheck();
        if (windup.interrupted) onInterrupt?.();
        else onRelease();
    });
    return windup;
}

export function playHitSound(scene, attacker, sound) {
    const key = sound === 'light' || sound === 'finisher'
        ? getHitSound(attacker, sound)
        : Array.isArray(sound) ? Phaser.Utils.Array.GetRandom(sound) : sound;
    if (key) scene.sound.play(key);
}

// Turns a knockback spec into a velocity.
//   x, y            launch speed along the aim
//   growth          multiply by the target's KB (default true). Without it the
//                   move never gets stronger, so it can't KO on its own.
//   scaleWithDamage multiply x by the attacker's damage scale (default true)
//   maxDamageScale  cap on that damage scale
//   lift            aim y used for a sideways hit (default -0.5, a little upward)
//   onDown          'straight' (default) or 'popUp': aimed straight down, the
//                   target pops up and away from the attacker instead
//   spike           { x, y } used when aiming down at a grounded target, which
//                   would otherwise be driven into the floor. Goes a random way.
//   delay           ms before the launch; the target is stopped dead until then
function resolveLaunch(attacker, target, knockback, direction, damageScale) {
    const kb = target.KBmultiplier;
    const grounded = target.body.touching.down;
    const side = Math.random() < 0.5 ? -1 : 1;
    if (typeof knockback === 'function') {
        return knockback({ attacker, target, direction, kb, damageScale, grounded, side });
    }

    const {
        x = 0,
        y = 0,
        growth = true,
        scaleWithDamage = true,
        maxDamageScale = Infinity,
        lift = -0.5,
        onDown = 'straight',
        spike = null
    } = knockback;
    const growthScale = growth ? kb : 1;
    const plungeBonus = target.plunged ? PLUNGE_KNOCKBACK_BONUS : 0;
    const xScale = scaleWithDamage ? Math.min(damageScale, maxDamageScale) + plungeBonus : 1;

    let dirX = direction.x;
    let dirY = direction.y;
    if (dirY === 0) {
        dirY = lift;
    } else if (dirY === 1 && onDown === 'popUp') {
        dirX = attacker.x <= target.x ? 0.75 : -0.75;
        dirY = -1;
    }

    if (spike && dirY > 0.7 && grounded) {
        return { x: spike.x * growthScale * xScale * side, y: spike.y * growthScale };
    }
    return { x: x * growthScale * xScale * dirX, y: y * growthScale * dirY };
}

export function landHit(scene, attacker, target, spec = {}) {
    const {
        damage = 0,
        plankDamage = damage,
        hitstun = 0,
        hitstunGrowth = true,
        stun = null,
        knockback = null,
        hitFreeze: hitFreezeMs = 0,
        sound = null,
        decelerateAfter = null,
        resetCombo = true,
        noDeathRay = false,
        onHit = null
    } = spec;
    const direction = spec.direction ?? attacker.lastDir;
    const now = scene.time.now;
    const damageScale = getAttackDamageScale(attacker);

    clearQueuedStunTimers(scene, attacker, target);
    target.hitstunUntil = now + hitstun * (hitstunGrowth ? target.KBmultiplier : 1);
    if (stun) {
        target.freezeUntil = now + (stun.target ?? 0);
        attacker.freezeUntil = now + (stun.attacker ?? 0);
        attacker.willDecelerate = false;
        attacker.setVelocity(0, 0);
    } else {
        target.freezeUntil = now - 1;
        attacker.freezeUntil = now - 1;
        attacker.willDecelerate = true;
        target.willDecelerate = false;
    }
    attacker.comboTimer = 600;

    target.KBmultiplier += damage * damageScale;
    damagePlanksInAttack(attacker, plankDamage * damageScale);

    const launch = knockback && resolveLaunch(attacker, target, knockback, direction, damageScale);
    onHit?.(scene);
    if (hitFreezeMs > 0) hitFreeze(scene, hitFreezeMs);
    playHitSound(scene, attacker, sound);

    if (launch) {
        const launchDelay = typeof knockback === 'object' ? knockback.delay ?? 0 : 0;
        if (launchDelay > 0) {
            applyKnockback(scene, target, 0, 0, { noDeathRay });
            scene.time.delayedCall(launchDelay, () => {
                applyKnockback(scene, target, launch.x, launch.y, { noDeathRay });
            });
        } else {
            applyKnockback(scene, target, launch.x, launch.y, { noDeathRay });
        }
    }

    if (decelerateAfter !== null) {
        const delay = typeof decelerateAfter === 'function' ? decelerateAfter(target) : decelerateAfter;
        scheduleDecelerate(scene, target, delay);
    }
    if (resetCombo) {
        attacker.combo = 0;
        attacker.comboTimer = 0;
    }
}

// Checks the hit, then lands it. Planks in the swing are damaged either way.
// A miss plays spec.missSound if there is one. Returns whether it hit.
export function strike(scene, attacker, target, spec = {}) {
    const { range = 100, bypass = {}, direction = null, missSound = null } = spec;
    const plankDamage = spec.plankDamage ?? spec.damage ?? 0;
    damagePlanksInAttack(attacker, plankDamage * getAttackDamageScale(attacker));
    const eligible = attackIsElligible(attacker, target, range, {
        ...bypass,
        direction: direction ?? bypass.direction ?? null
    });
    if (!eligible) {
        if (missSound) scene.sound.play(missSound);
        return false;
    }
    landHit(scene, attacker, target, spec);
    return true;
}
