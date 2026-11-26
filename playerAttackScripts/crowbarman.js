// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import demolitionist from './demolitionist.js';
import { applySkin } from '../combat/skins.js';
import { SIDE_SPECIAL_POWER } from '../gameSettings.js';
import { kickSquash, SQUASH } from '../combat/squash.js';
import { overAnyPlatform } from '../combat/universalMoves.js';

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'crowbaratk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const VAULT = {
    plantMs: 140,
    tipMs: 94,
    plantAhead: 30,
    sink: 4,
    scale: 1.3,
    originY: 12.5 / 18,
    plantAngle: Math.PI / 3,
    tipAngle: 0.62 * Math.PI,
    launch: 680,
    forward: 160,
    returnOut: { x: 650, y: 300 },
    curveMs: 400,
    homing: 6,
    returnSpeed: 1500,
    returnSpin: 0.03,
    catchDistance: 30,
    catchAfterMs: 250,
    depthOffset: 1
};
const SPIKE = {
    recoil: { push: 200, lift: 300 },
    voidRecoilScale: 0.5,
    aim: { x: 0.35, y: 1 },
    speed: 1400,
    spawn: 20,
    scale: 1.3,
    spriteAngle: 0,
    returnAfterMs: 1000,
    returnSpeed: 900,
    returnAccel: 3000,
    returnMaxSpeed: 1800,
    returnSpin: Math.PI * 6,
    catchDistance: 45,
    burst: { count: 10, minSize: 3, maxSize: 6, colors: [0x6b4423, 0x8b5a2b, 0xa66a35] },
    out: { left: -200, right: 2200, bottom: 1400 },
    hitPad: 10,
    hit: { damage: 0.03, hitstun: 300, hitFreeze: 60, knockback: { x: 600, y: 100 } }
}

function isGrounded(player) {
    return player.body.touching.down || player.body.blocked.down;
}
function crowbarOut(player) {
    return player.vault || player.spike;
}
function cancelSpike(player) {
    if (player.spike?.sprite.active) player.spike.sprite.destroy();
    player.spike = null;
}
function spikeCrowbar(api, scene, player) {
    if (crowbarOut(player)) return;
    if (player.hitstun || player.freeze || player.activeGrab || player.grabbedBy || player.isUsingSideSpecial) return;
    const facing = player.lastDir.x || (player.flipX ? -1 : 1);
    const length = Math.hypot(SPIKE.aim.x, SPIKE.aim.y);
    const dir  = { x: facing * SPIKE.aim.x / length, y: SPIKE.aim.y / length };
    const sprite = scene.add.image(player.x + dir.x * SPIKE.spawn, player.y + dir.y * SPIKE.spawn, 'lilcrowbar') .setScale(SPIKE.scale).setRotation(Math.atan2(dir.y, dir.x) + SPIKE.spriteAngle);
    applySkin(sprite, player.skin);
    scene.objs.add(sprite);
    player.spike = { 
        sprite,
        phase: 'flying',
        vx: dir.x * SPIKE.speed,
        vy: dir.y * SPIKE.speed,
        speed: 0,
        outFor: 0,
        hasHit: false,
        facing
    };
    
    const recoilScale = isGrounded(player) || overAnyPlatform(scene, player) ? 1 : SPIKE.voidRecoilScale;
    player.setVelocityX(-dir.x * SPIKE.recoil.push * recoilScale);
    player.setVelocityY(Math.min(player.body.velocity.y, -dir.y * SPIKE.recoil.lift * recoilScale));
    player.ignoreJumpRelease = true;
    scene.sound.play('swosh');
}
function recallSpike(scene, spike) {
    spike.phase = 'returning';
    spike.speed = SPIKE.returnSpeed;
    scene.sound.play('whoosh');
}
function updateFlyingCrowbar(api, scene, player, spike, seconds) {
    const sprite = spike.sprite;
    const from = { x: sprite.x, y: sprite.y };
    const to = { x: from.x + spike.vx * seconds, y: from.y + spike.vy * seconds };
    if (!spike.hasHit) {
        const path = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
        for (const foe of api.getEnemies(scene, player)) {
            const body = foe.body;
            if (!body?.enable || api.isInvincible(foe)) continue;
            const pad = SPIKE.hitPad;
            const reach = new Phaser.Geom.Rectangle(body.x - pad, body.y - pad, body.width + pad * 2, body.height + pad * 2);
            if (!Phaser.Geom.Intersects.LineToRectangle(path, reach)) continue;
            spike.hasHit = true;
            if (api.deflects(scene, foe, player, SPIKE.hit.damage)) {
                recallSpike(scene, spike);
                return;
            }
            foe.flash?.();
            api.landHit(scene, player, foe, { special: true, ...SPIKE.hit, direction: { x: spike.facing, y: 1 } });
            break;
        }
    }
    for (const platform of api.getMapPlatforms(scene)) {
        const body = platform.body;
        const overX = to.x >= body.left && to.x <= body.right;
        if (overX && from.y <= body.top && to.y >= body.top) {
            sprite.setPosition(to.x, body.top);
            spike.phase = 'stuck';
            const burst = SPIKE.burst;
            api.spawnDirtBurst(scene, to.x, body.top, burst.count, burst.minSize, burst.maxSize, 1, burst.colors);
            scene.sound.play('spikeimpact');
            return;
        }
    }
    sprite.setPosition(to.x, to.y);
    const out = SPIKE.out;
    if (to.x < out.left || to.x > out.right || to.y > out.bottom) recallSpike(scene, spike);
}
function updateReturningCrowbar(player, spike, seconds) {
    const sprite = spike.sprite;
    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    spike.speed = Math.min(SPIKE.returnMaxSpeed, spike.speed + SPIKE.returnAccel * seconds);
    const step = spike.speed * seconds;
    if (distance <= Math.max(SPIKE.catchDistance, step)) {
        cancelSpike(player);
        return;
    }
    sprite.setPosition(sprite.x + dx / distance * step, sprite.y + dy / distance * step);
    sprite.rotation += SPIKE.returnSpin * seconds;
}
function updateSpike(api, scene, player) {
    const spike = player.spike;
    if (!spike) return;
    if (!spike.sprite.active) {
        cancelSpike(player);
        return;
    }
    const change = scene.hitFreezeUntil > scene.time.now ? 0 : scene.game.loop.delta;
    const seconds = change / 1000;
    spike.outFor += change;
    if (spike.phase !== 'returning' && spike.outFor >= SPIKE.returnAfterMs) recallSpike(scene, spike);
    if (spike.phase === 'flying') {
        updateFlyingCrowbar(api, scene, player, spike, seconds);
    } else if (spike.phase === 'stuck') {
        const distance = Math.hypot(player.x - spike.sprite.x, player.y - spike.sprite.y);
        if (distance <= SPIKE.catchDistance) cancelSpike(player);
    } else if (spike.phase === 'returning') {
        updateReturningCrowbar(player, spike, seconds);
    }
}    
function neutralSpecial(api, scene, player) {
    
    if (player.hitstun || player.freeze || player.activeGrab || player.grabbedBy || player.isUsingSideSpecial) return;
    if (!isGrounded(player)) {
        spikeCrowbar(api, scene, player);
        return;
    }
    if (crowbarOut(player)) return;
    const facing = player.lastDir.x || (player.flipX ? -1 : 1);
    const base = { x: player.x + facing * VAULT.plantAhead, y: player.body.bottom + VAULT.sink };
    const pole = scene.add.image(base.x, base.y, 'lilcrowbar')
        .setScale(VAULT.scale)
        .setFlipX(facing < 0)
        .setOrigin(facing > 0 ? 1 : 0, VAULT.originY)
        .setRotation(facing * VAULT.plantAngle)
        .setDepth((player.depth ?? 5) + VAULT.depthOffset);
    applySkin(pole, player.skin);
    scene.objs.add(pole);
    player.vault = { phase: 'plant', start: scene.time.now, facing, pole };
    player.moveSpeedScale = 0;
    player.canAttack = false;
    player.setVelocityX(0);
    scene.sound.play('swosh');
    api.spawnDirtBurst(scene, base.x, player.body.bottom, 8, 3, 6, 1);
}

function freeVaulter(player) {
    player.moveSpeedScale = 1;
    player.canAttack = true;
}

function releasePole(vault) {
    const { pole } = vault;
    const center = pole.getCenter();
    pole.setOrigin(0.5).setPosition(center.x, center.y);
    vault.phase = 'return';
    vault.releasedAt = pole.scene.time.now;
    vault.velocity = { x: vault.facing * VAULT.returnOut.x, y: -VAULT.returnOut.y };
}

function launchVault(scene, player, vault) {
    freeVaulter(player);
    player.setVelocity(vault.facing * VAULT.forward, -VAULT.launch);
    player.ignoreJumpRelease = true;
    kickSquash(player, SQUASH.jump);
    scene.sound.play('swosh');
    releasePole(vault);
}

function endVault(player) {
    player.vault?.pole.destroy();
    player.vault = null;
}

function updateVault(scene, player) {
    if (player.ignoreJumpRelease && (player.body.velocity.y >= 0 || player.hitstun)) player.ignoreJumpRelease = false;
    const vault = player.vault;
    if (!vault) return;
    if (!player.active || player.eliminated) {
        endVault(player);
        return;
    }
    const elapsed = scene.time.now - vault.start;
    if (vault.phase !== 'return') {
        if (player.hitstun || player.grabbedBy) {
            freeVaulter(player);
            releasePole(vault);
            return;
        }
        player.setVelocityX(0);
        if (elapsed >= VAULT.plantMs) {
            const t = Math.min(1, (elapsed - VAULT.plantMs) / VAULT.tipMs);
            const angle = VAULT.plantAngle + (VAULT.tipAngle - VAULT.plantAngle) * t * t;
            vault.pole.setRotation(vault.facing * angle);
            vault.phase = 'tip';
            if (t >= 1) launchVault(scene, player, vault);
        }
        return;
    }
    const dt = scene.game.loop.delta / 1000;
    const pole = vault.pole;
    const dx = player.x - pole.x;
    const dy = player.y - pole.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance <= VAULT.catchDistance && scene.time.now - vault.releasedAt >= VAULT.catchAfterMs) {
        endVault(player);
        return;
    }
    const steer = Math.min(1, (scene.time.now - vault.releasedAt) / VAULT.curveMs);
    const pull = Math.min(1, VAULT.homing * steer * steer * dt);
    vault.velocity.x += (dx / distance * VAULT.returnSpeed - vault.velocity.x) * pull;
    vault.velocity.y += (dy / distance * VAULT.returnSpeed - vault.velocity.y) * pull;
    pole.setPosition(pole.x + vault.velocity.x * dt, pole.y + vault.velocity.y * dt);
    pole.setRotation(pole.rotation - vault.facing * VAULT.returnSpin * scene.game.loop.delta);
}
const GRAB_WINDUP_MS = 375;
const GRAB_ATTACK_LOCK_MS = GRAB_WINDUP_MS + 600;
const GRAB_RETRACT_MS = 120;
const GRAB_MOVE_SPEED_SCALE = 0.5;
const GRAB_WINDUP_SPEED_SCALE = 0.15;
const GRAB_AIM = { originX: 62 / 200, originY: 98 / 200, tip: { x: -42, y: -3 } };
function tryGrab(api, scene, attacker, target, direction, currentTime, animKey = 'crowbargrab') {
    //Exclusive to the crowbarman, this attack initiates a grab on the target
    //When the target is grabbed, they are unable to move or attack, they will be hooked on the crowbar for 3 seconds before released
    //However, if the attacker presses the attack button again, they will swing the target away with a strong knockback
    //Longest range but weakest attack in the game, however it can easily turn the tides of a match.
    const dtapDelay = 250;
    const grabCD = attacker.dirSpecialCooldown;
    if (attacker.hitstun || attacker.freeze) return;
    if (currentTime < attacker.nextSideSpecialTime) return;

    if (currentTime - attacker.lastTap[direction] < dtapDelay || attacker.isBot) {
        const mode = direction === 'up' || direction === 'down' ? direction : 'side';
        const facing = mode === 'side' ? (direction === 'left' ? -1 : 1) : (attacker.lastDir.x || attacker.facingX || 1);
        const reach = GRAB_REACH[mode];

        api.setAttackSprite(attacker, animKey);
        if (mode !== 'side') {
            attacker.atkAngleOverride = reach.spriteAngle * facing;
            attacker.atk.setAngle(attacker.atkAngleOverride);
        }
        attacker.isUsingSideSpecial = true
        attacker.isUsingSideSpecial = false;
        api.startSideSpecialCooldown(attacker, currentTime, grabCD);
        attacker.canAttack = false;
        attacker.grabWindingUp = true;
        if (isGrounded(attacker)) attacker.setVelocityX(attacker.body.velocity.x * GRAB_WINDUP_SPEED_SCALE);

        let interrupted = false;
        const removeInterruptCheck = api.addSceneUpdateListener(scene, () => {
            if (attacker.hitstun) interrupted = true;
        });
        scene.time.delayedCall(GRAB_ATTACK_LOCK_MS, () => {
            attacker.canAttack = true;
        });
        scene.time.delayedCall(GRAB_WINDUP_MS, () => {
            attacker.grabWindingUp = false;
            removeInterruptCheck();
            if (interrupted) {
                attacker.atkAngleOverride = null;
                api.hideAttackSprite(attacker);
                return;
            }
            const grabAnimPlaying = attacker.atk.anims.isPlaying && attacker.atk.anims.currentAnim?.key === animKey;

            //canAttack is already off for the windup, so skip that check; the interrupt check covers hitstun.
            const grabLands = api.attackIsElligible(attacker, target, 200, { ignoreCanAttack: true, ...reach.bypass });
            attacker.attackBypassesHitstun = false;
            api.damagePlanksInAttack(attacker, 0.03 * api.getAttackDamageScale(attacker));
            if (grabLands) {
                const side = Math.sign(target.x - attacker.x) || facing;
                const grabOffset = mode === 'side'
                    ? { x: side * 150, y: Math.min(target.y - attacker.y, 0) }
                    : { x: side * reach.hold.x, y: reach.hold.y };
                target.hitstunUntil = 3000 + scene.time.now;
                target.willDecelerate = false;
                target.freezeUntil = scene.time.now - 1;
                attacker.freezeUntil = scene.time.now - 1;
                attacker.willDecelerate = true;
                attacker.comboTimer = 600;
                target.KBmultiplier += 0.03 * api.getAttackDamageScale(attacker) * SIDE_SPECIAL_POWER;
                //weak damage, but the target is grabbed and unable to move or attack for 3 seconds
                scene.sound.play('grab');
                target.body.allowGravity = false;
                target.setVelocity(0, 0);
                target.grabbedBy = attacker;
                attacker.activeGrab = {
                    target,
                    offset: grabOffset,
                    atkOffset: {
                        x: attacker.atk.x - attacker.x,
                        y: attacker.atk.y - attacker.y
                    },
                    direction: facing,
                    mode,
                    atkFlipX: attacker.atk.flipX,
                    atkAngle: attacker.atk.angle,
                    aim: GRAB_AIM,
                    releaseEvent: scene.time.delayedCall(3000, () => releaseGrab(api, scene, attacker, scene.time.now, false))
                };
                attacker.atkAngleOverride = null;
                const holdGrabPose = () => {
                    if (attacker.activeGrab && attacker.activeGrab.target === target) {
                        attacker.atk.setVisible(true);
                        attacker.atk.setFrame(6);
                        attacker.atk.stop();
                    }
                };
                if (grabAnimPlaying) {
                    attacker.atk.once(`animationcomplete-${animKey}`, holdGrabPose);
                } else {
                    holdGrabPose();
                }

                attacker.combo = 0;
                attacker.comboTimer = 0;
            } else {
                const sequence = attacker.attackSequence;
                const missGrab = () => {
                    scene.sound.play('miss');
                    if (attacker.attackSequence !== sequence) {
                        attacker.atkAngleOverride = null;
                        return;
                    }
                    attacker.atk.once(`animationcomplete-${animKey}`, () => {
                        attacker.atkAngleOverride = null;
                        if (attacker.attackSequence === sequence) api.hideAttackSprite(attacker);
                    });
                    attacker.atk.playReverse({ key: animKey, duration: GRAB_RETRACT_MS });
                };
                if (grabAnimPlaying) {
                    attacker.atk.once(`animationcomplete-${animKey}`, missGrab);
                } else {
                    missGrab();
                }
            }

            if (attacker.revokeAggressorStun) scene.time.removeEvent(attacker.revokeAggressorStun);
            if (target.revokeVictimStun) scene.time.removeEvent(target.revokeVictimStun);
            scene.time.delayedCall(1000, () => {
                if (!target.grabbedBy) target.willDecelerate = true;
            });
        });
    }
    attacker.lastTap[direction] = currentTime;

}
const GRAB_REACH = {
    side: { bypass: {} },
    up: { spriteAngle: -60, bypass: { direction: { x: 0, y: -1 }, minDot: 0.3 }, hold: { x: 50, y: -140 } },
    down: { spriteAngle: 60, bypass: { direction: { x: 0, y: 1 }, minDot: 0.3, allowTargetBelow: true }, hold: { x: 70, y: 110 } }
};

const GRAB_SPIN = {
    hooks: [[13, 98], [64, 143], [157, 135], [190, 98], [141, 65], [52, 61], [13, 98]],
    behindFrames: [4, 5],
    launchFrame: 6,
    maxMs: 800,
    hit: {
        damage: 0.04,
        hitstun: 500,
        hitFreeze: 60,
        knockback: { x: 1000, y: 600, growth: false },
        unblockable: true
    },
    verticalKnockback: { x: 300, y: 950, growth: false },
    growthAt100: 0.5,
    whoosh: { key: 'whoosh', rate: 0.6 },
    attackLockMs: 2000
};

function dropGrab(api, scene, attacker, currentTime, hide = true) {
    const grab = attacker.activeGrab;
    const target = grab.target;
    if (grab.releaseEvent) grab.releaseEvent.remove(false);
    grab.cleanup?.();
    attacker.activeGrab = null;
    target.grabbedBy = null;
    target.body.allowGravity = true;
    target.hitstunUntil = 0;
    target.freezeUntil = 0;
    target.willDecelerate = true;
    if (hide) api.hideAttackSprite(attacker);
    api.startSideSpecialCooldown(attacker, currentTime, attacker.dirSpecialCooldown);
    return target;
}

function releaseGrab(api, scene, attacker, currentTime, fling = true) {
    const grab = attacker.activeGrab;
    if (!grab || grab.spin) return false;
    if (fling) {
        startGrabSpin(api, scene, attacker);
        return true;
    }
    dropGrab(api, scene, attacker, currentTime).setVelocity(0, 0);
    return true;
}

function startGrabSpin(api, scene, attacker) {
    const grab = attacker.activeGrab;
    const target = grab.target;
    if (grab.releaseEvent) grab.releaseEvent.remove(false);
    grab.releaseEvent = null;
    const flip = target.x > attacker.x;
    const depth = target.depth;
    grab.spin = { flip, startedAt: scene.time.now, lastHitAt: attacker.lastHitAt };
    target.hitstunUntil = scene.time.now + GRAB_SPIN.maxMs + 100;
    attacker.attackLockedUntil = scene.time.now + GRAB_SPIN.attackLockMs;
    attacker.isAttacking = true;
    attacker.canAttack = false;
    grab.cleanup = () => {
        target.setDepth(depth);
        attacker.isAttacking = false;
        attacker.canAttack = true;
    };
    attacker.atk.setOrigin(0.5).setAngle(0).setScale(1).setFlipX(flip).setVisible(true);
    attacker.atk.play('crowbargrabspin', true);
    grab.follow = () => followGrabSpin(api, scene, attacker);
    grab.follow();
}

function followGrabSpin(api, scene, attacker) {
    const grab = attacker.activeGrab;
    const { target, spin } = grab;
    const now = scene.time.now;
    if (attacker.lastHitAt !== spin.lastHitAt) {
        dropGrab(api, scene, attacker, now);
        return;
    }
    const atk = attacker.atk;
    atk.setPosition(attacker.x, attacker.y);
    const frame = Phaser.Math.Clamp(Number(atk.frame.name) || 0, 0, GRAB_SPIN.hooks.length - 1);
    const [hookX, hookY] = GRAB_SPIN.hooks[frame];
    const offsetX = (spin.flip ? 200 - hookX : hookX) - 100;
    target.setPosition(attacker.x + offsetX, attacker.y + hookY - 100);
    target.setVelocity(0, 0);
    target.body.allowGravity = false;
    target.setDepth(attacker.depth + (GRAB_SPIN.behindFrames.includes(frame) ? -0.01 : 0.01));
    if (frame >= GRAB_SPIN.launchFrame || now - spin.startedAt > GRAB_SPIN.maxMs) launchFromSpin(api, scene, attacker);
}

function launchFromSpin(api, scene, attacker) {
    const grab = attacker.activeGrab;
    const side = grab.spin.flip ? 1 : -1;
    const mode = grab.mode ?? 'side';
    const target = dropGrab(api, scene, attacker, scene.time.now, false);
    attacker.atk.once('animationcomplete-crowbargrabspin', () => api.hideAttackSprite(attacker));
    const holdAtPivot = () => {
        if (!attacker.active || attacker.atk.anims.currentAnim?.key !== 'crowbargrabspin' || !attacker.atk.anims.isPlaying) {
            scene.events.off('postupdate', holdAtPivot);
            return;
        }
        attacker.atk.setPosition(attacker.x, attacker.y);
    };
    scene.events.on('postupdate', holdAtPivot);
    scene.events.once('shutdown', () => scene.events.off('postupdate', holdAtPivot));
    scene.sound.play(GRAB_SPIN.whoosh.key, { rate: GRAB_SPIN.whoosh.rate });
    const flingDirection = attacker.lastDir.x || side;
    target.flungAt = scene.time.now;
    const hit = GRAB_SPIN.hit;
    const growth = 1 + GRAB_SPIN.growthAt100 * Math.max(0, target.KBmultiplier - 1);
    const base = mode === 'side' ? hit.knockback : GRAB_SPIN.verticalKnockback;
    const knockback = { ...base, x: base.x * growth, y: base.y * growth };
    const flingY = mode === 'up' ? 1 : mode === 'down' ? -1 : 0;
    api.landHit(scene, attacker, target, {
        special: true,
        ...hit,
        knockback,
        power: mode === 'side' ? SIDE_SPECIAL_POWER : 1,
        direction: { x: flingDirection, y: flingY }
    });
}

const isDemolitionist = player => player.variant === 'DEMOLITIONIST';

function byVariant(hooker, demolitionist) {
    return (api, scene, player, ...rest) => isDemolitionist(player)
        ? demolitionist(api, scene, player, ...rest)
        : hooker(api, scene, player, ...rest);
}

export default {
    variantDemoAnimations: {
        HOOKER: ['crowbaratk', 'crowbargrab'],
        DEMOLITIONIST: ['crowbarslam']
    },
    variantDemoIdle: { DEMOLITIONIST: 'bigcrowbarslam' },
    variantDemoAnchors: { DEMOLITIONIST: { x: 35, y: -50, facesRight: true } },
    armColor: 0x1a1a1a,
    variantStats: { DEMOLITIONIST: { armColor: 0xbe5e00, downslamAirTime: 250 } },
    hitSounds: {
        light: ['crowbarclang1', 'crowbarclang2'],
        finisher: 'crowbarhit'
    },
    handleAttack: byVariant((api, scene, attacker, victim) => {
        if (attacker.activeGrab) {
            releaseGrab(api, scene, attacker, scene.time.now, true);
        } else {
            api.tryAttack(scene, attacker, victim, 'crowbaratk', 'crowbaratk');
        }
    }, demolitionist.handleAttack),
    upSpecialVariants: ['HOOKER', 'DEMOLITIONIST'],
    downSpecialVariants: ['HOOKER', 'DEMOLITIONIST'],
    handleDirSpecial: byVariant((api, scene, attacker, direction, currentTime, victim) =>
        tryGrab(api, scene, attacker, victim, direction, currentTime), demolitionist.handleDirSpecial),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { HOOKER: neutralSpecial, DEMOLITIONIST: demolitionist.neutral },
    update: (api, scene, player) => {
        if (isDemolitionist(player)) demolitionist.update(api, scene, player);
        else {
            if (player.respawnFalling && !player.spikeRespawnSeen) cancelSpike(player);
            player.spikeRespawnSeen = player.respawnFalling;
            if (!player.vault) {
                player.moveSpeedScale = player.grabWindingUp ? GRAB_WINDUP_SPEED_SCALE
                    : player.activeGrab ? GRAB_MOVE_SPEED_SCALE : 1;
            }
            updateVault(scene, player);
            updateSpike(api, scene, player);
        }
    },
    onDownslam: (api, scene, player) => {
        if (isDemolitionist(player)) demolitionist.onDownslam(api, scene, player);
    },
    onMatchEnd: (scene, player) => {
        if (isDemolitionist(player)) demolitionist.onMatchEnd(scene, player);
        else {
            endVault(player);
            cancelSpike(player);
            player.ignoreJumpRelease = false;
        }
    },
    handleHorizantalTilt: byVariant((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600), demolitionist.sideTilt),
    handleDownTilt: byVariant((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300), demolitionist.downTilt),
    handleUpTilt: byVariant((api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300), demolitionist.upTilt)
};
