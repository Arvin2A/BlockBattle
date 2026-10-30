// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

function basicAttack(api, scene, attacker, victim) {
    if (attacker.variant === 'TRAPPER') return harpoonAttack(api, scene, attacker, victim);
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatkthird');
}

function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    const trapperSheet = harpoonsLeft(attacker) > 0 ? 'harpoonatk' : 'harpoonlessatk';
    api.tiltAttack(scene, attacker, victim, {
        animKey: attacker.variant === 'TRAPPER' ? trapperSheet : 'rodatk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};



const HARPOON_REACH = 120;

const MAX_HARPOONS = 3;
const HARPOON_REGEN_MS = 3000;
const HARPOON_TIP = 27;
const STUCK_HARPOON_MS = 5000;
const STUCK_HARPOON_FADE_MS = 1000;
const MAX_STUCK_HARPOONS = 3;

const HARPOON_LEFT_AT = { harpoonatk: 8, harpoonatkthird: 28 };

const PIN_MS = 1000;
const PIN_SPIKE_SPEED = 1400;

const PIN_IMMUNITY_MS = 1500;


const PIN_FLOOR_REACH = 40;

function isOnFloor(api, scene, player) {
    const body = player.body;
    if (body.blocked.down || body.touching.down) return true;
    return api.getMapPlatforms(scene).some(platform => {
        const gap = platform.body.top - body.bottom;
        return body.right > platform.body.left && body.left < platform.body.right &&
            gap >= -4 && gap <= PIN_FLOOR_REACH;
    });
}

function harpoonsLeft(player) {
    return player.harpoons ?? MAX_HARPOONS;
}

function useHarpoon(scene, player) {
    player.harpoons = harpoonsLeft(player) - 1;
    player.nextHarpoonAt ||= scene.time.now + HARPOON_REGEN_MS;
}

// Out of harpoons the third hit is just a punch: a short, weak shove that's the
// same at any KB% and never stuns.
const EMPTY_HANDED_FINISHER = {
    hitstun: 250,
    hitstunGrowth: false,
    sound: 'slatelight1',
    knockback: { x: 250, y: 250, growth: false, scaleWithDamage: false },
    noDeathRay: true,
    decelerateAfter: 400
};

// Hits 1-2 and the running push are normal hits; the third one pins instead of launching.
// Out of harpoons he fights with his fists: jab reach, nothing sticks and nothing pins.
function harpoonAttack(api, scene, attacker, victim) {
    if (scene.time.now < attacker.nextAttackTime) return;
    if (!attacker.canAttack || attacker.hitstun) return;

    const armed = harpoonsLeft(attacker) > 0;
    const sheet = armed ? 'harpoonatk' : 'harpoonlessatk';
    const range = armed ? HARPOON_REACH : api.STANDARD_HITS.jab.range;

    if (attacker.combo >= 2 && !armed) {
        api.thirdAttack(scene, attacker, victim, 'harpoonlessatkthird', { ...EMPTY_HANDED_FINISHER, range });
    } else if (attacker.combo >= 2) {
        const pinned = harpoonPin(api, scene, attacker, victim, 'harpoonatkthird', range);
        if (pinned !== null) {
            useHarpoon(scene, attacker);
            leaveHarpoonBehind(scene, attacker, 'harpoonatkthird', () =>
                stickHarpoon(api, scene, victim, pinnedHarpoonAngle(attacker), pinned));
        }
    } else {
        const hit = attacker.horizontalMovementActive
            ? api.pushAttack(scene, attacker, victim, sheet, { range, sound: 'axeslash2' })
            : api.attack(scene, attacker, victim, sheet, { range });
        if (armed && hit) {
            useHarpoon(scene, attacker);
            leaveHarpoonBehind(scene, attacker, 'harpoonatk', () =>
                stickHarpoon(api, scene, victim, Math.atan2(victim.y - attacker.y, victim.x - attacker.x), false));
        }
    }
    attacker.nextAttackTime = scene.time.now + api.getAttackCooldown(attacker);
}

// Returns null on a miss, otherwise whether the foe got pinned.
function harpoonPin(api, scene, attacker, target, animKey, range) {
    const now = scene.time.now;
    const canPin = now >= (target.pinImmuneUntil ?? 0);
    const grounded = isOnFloor(api, scene, target);
    const hit = api.thirdAttack(scene, attacker, target, animKey, {
        range,
        hitstun: canPin ? PIN_MS : 300,
        hitstunGrowth: false,
        noDeathRay: true,
        // Never a launch: held to the floor on the ground, driven straight down in the air.
        knockback: () => ({ x: 0, y: canPin && !grounded ? PIN_SPIKE_SPEED : 0 }),
        onHit: () => {
            if (!canPin) return;
            target.pinImmuneUntil = now + PIN_MS + PIN_IMMUNITY_MS;
            if (grounded) target.freezeUntil = now + PIN_MS;
        }
    });
    return hit ? canPin : null;
}

function pinnedHarpoonAngle(attacker) {
    const facing = attacker.atk.flipX ? -1 : 1;
    return Math.atan2(1, facing * 0.45);
}

function leaveHarpoonBehind(scene, attacker, animKey, onLeave) {
    const atk = attacker.atk;
    const sequence = attacker.attackSequence;
    let left = false;
    const swap = (anim, frame) => {
        if (attacker.attackSequence !== sequence || anim.key !== animKey) {
            atk.off('animationupdate', swap);
            return;
        }
        if (frame.textureFrame < HARPOON_LEFT_AT[animKey]) return;
        atk.setTexture('harpoonlessatk', frame.textureFrame);
        if (!left) {
            left = true;
            onLeave();
        }
    };
    atk.on('animationupdate', swap);
}

function stickHarpoon(api, scene, target, angle, pinned) {
    if (!target.active) return;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const tipY = pinned ? target.body.bottom + 4 : target.y + dirY * 10;
    const tipX = pinned ? target.x + (tipY - target.y) * (dirX / dirY) : target.x + dirX * 10;
    const offsetX = tipX - dirX * HARPOON_TIP - target.x;
    const offsetY = tipY - dirY * HARPOON_TIP - target.y;
    const harpoon = scene.add.image(target.x + offsetX, target.y + offsetY, 'harpoon')
        .setRotation(angle)
        .setFlipY(dirX < 0);
    scene.objs.add(harpoon);

    let removeFollow = () => {};
    const remove = () => {
        removeFollow();
        scene.tweens.killTweensOf(harpoon);
        harpoon.destroy();
    };
    removeFollow = api.addSceneUpdateListener(scene, () => {
        if (!target.active || target.outOfBounds) {
            remove();
            return;
        }
        harpoon.setPosition(target.x + offsetX, target.y + offsetY);
    });
    scene.tweens.add({
        targets: harpoon,
        alpha: 0,
        delay: STUCK_HARPOON_MS - STUCK_HARPOON_FADE_MS,
        duration: STUCK_HARPOON_FADE_MS,
        onComplete: remove
    });

    target.stuckHarpoons = (target.stuckHarpoons ?? []).filter(stuck => stuck.harpoon.active);
    target.stuckHarpoons.push({ harpoon, remove });
    if (target.stuckHarpoons.length > MAX_STUCK_HARPOONS) target.stuckHarpoons.shift().remove();
}

const HARPOON_THROW_COOLDOWN = 500;
const HARPOON_THROW_SPEED = 950;
const HARPOON_THROW_SINK = 120;
const THROWN_HARPOON_MS = 2500;
const THROWN_HARPOON_HIT = {
    damage: 0.06,
    plankDamage: 0,
    hitstun: 450,
    hitstunGrowth: false,
    hitFreeze: 60,
    sound: 'anyhit',
    knockback: { x: 650, y: 450, growth: false, scaleWithDamage: false },
    noDeathRay: true,
    decelerateAfter: 800,
    resetCombo: false
};

function throwHarpoon(api, scene, attacker, target) {
    const now = scene.time.now;
    if (attacker.hitstun || attacker.freeze) return;
    if (now < (attacker.nextHarpoonThrowTime ?? 0) || harpoonsLeft(attacker) <= 0) return;
    attacker.nextHarpoonThrowTime = now + HARPOON_THROW_COOLDOWN;
    useHarpoon(scene, attacker);

    const direction = { ...attacker.lastDir };
    // An empty-handed stab: the harpoon is what flies.
    api.setAttackSprite(attacker, 'harpoonlessatk');
    scene.sound.play('swosh');

    const harpoon = scene.physics.add.sprite(
        attacker.x + direction.x * 30,
        attacker.y - 8 + direction.y * 30,
        'harpoon'
    );
    harpoon.body.allowGravity = false;
    harpoon.setVelocity(direction.x * HARPOON_THROW_SPEED, direction.y * HARPOON_THROW_SPEED);
    harpoon.setAccelerationY(HARPOON_THROW_SINK);
    harpoon.setRotation(Math.atan2(direction.y, direction.x));
    scene.objs.add(harpoon);

    const platforms = api.platformsWithoutStandingPlatform(scene, attacker);
    let done = false;
    let removeUpdate = () => {};
    const fadeOut = (delay = 0) => {
        if (done) return;
        done = true;
        removeUpdate();
        expireEvent.remove(false);
        harpoon.body.enable = false;
        scene.tweens.add({
            targets: harpoon,
            alpha: 0,
            delay,
            duration: 400,
            onComplete: () => harpoon.destroy()
        });
    };
    const expireEvent = scene.time.delayedCall(THROWN_HARPOON_MS, () => fadeOut());

    removeUpdate = api.addSceneUpdateListener(scene, () => {
        if (done || !harpoon.active) return;
        const { x: vx, y: vy } = harpoon.body.velocity;
        harpoon.setRotation(Math.atan2(vy, vx));
        harpoon.setFlipY(vx < 0);
        const tipX = harpoon.x + Math.cos(harpoon.rotation) * HARPOON_TIP;
        const tipY = harpoon.y + Math.sin(harpoon.rotation) * HARPOON_TIP;

        const body = target.body;
        if (target.active && !api.isInvincible(target) &&
            tipX > body.left - 6 && tipX < body.right + 6 &&
            tipY > body.top - 6 && tipY < body.bottom + 6) {
            target.flash();
            api.landHit(scene, attacker, target, { ...THROWN_HARPOON_HIT, direction });
            harpoon.destroy();
            done = true;
            removeUpdate();
            expireEvent.remove(false);
            return;
        }

        const stuckIn = platforms.find(platform => platform.active &&
            tipX > platform.body.left && tipX < platform.body.right &&
            tipY > platform.body.top && tipY < platform.body.bottom);
        if (stuckIn) {
            harpoon.setVelocity(0, 0);
            fadeOut(600);
        }
    });
}

// DIR SPECIAL: THROW NET. Only one net per player; throwing again takes the old one away.
const NET_RELEASE_MS = 100;
const NET_LAUNCH = { x: 420, y: -250 };
const NET_STUN = 3000;
const NET_AIR_MS = 3000;
const NET_GROUND_MS = 6000;
const NET_GROUND_ORIGIN_Y = 31 / 50;
const NET_GROUND_HALF_WIDTH = 128;

function netFoe(api, scene, owner, target, duration, holdInPlace) {
    const now = scene.time.now;
    api.landHit(scene, owner, target, {
        damage: 0.02,
        plankDamage: 0,
        hitstun: duration,
        hitstunGrowth: false,
        sound: 'grab',
        resetCombo: false,
        noDeathRay: true,
        knockback: () => ({ x: 0, y: Math.max(0, target.body.velocity.y) }),
        onHit: () => {
            target.nettedUntil = now + duration;
            if (holdInPlace) target.freezeUntil = now + duration;
        }
    });
}

function throwNet(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.activeNetCleanup?.();

        const facing = direction === 'left' ? -1 : 1;
        player.lastDir = { x: facing, y: 0 };
        api.setAttackSprite(player, 'netthrow');
        scene.sound.play('whoosh');

        // Starts bundled up in his hands, spread out the way he's throwing.
        const heldOffsetX = 40 + NET_GROUND_HALF_WIDTH;
        const net = scene.physics.add.sprite(player.x + facing * heldOffsetX, player.y - 25, 'netonground');
        net.body.enable = false;
        net.setFlipX(facing < 0);
        scene.objs.add(net);

        let state = 'held';
        let floorY = 0;
        let expireEvent = null;
        let removeUpdate = () => {};
        const colliders = [];
        const removeColliders = () => {
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
        };
        const removeNet = () => {
            if (state === 'gone') return;
            state = 'gone';
            removeUpdate();
            removeColliders();
            expireEvent?.remove(false);
            scene.events.off('shutdown', removeNet);
            scene.tweens.killTweensOf(net);
            net.destroy();
            if (player.activeNetCleanup === removeNet) player.activeNetCleanup = null;
        };
        const fadeOut = () => {
            if (state === 'gone' || state === 'fading') return;
            state = 'fading';
            removeColliders();
            net.body.enable = false;
            scene.tweens.add({ targets: net, alpha: 0, duration: 400, onComplete: removeNet });
        };
        player.activeNetCleanup = removeNet;
        scene.events.once('shutdown', removeNet);

        // Lands on top of platforms only, so it can fly up through them.
        const landsFromAbove = (_net, platform) =>
            net.body.velocity.y >= 0 && net.body.prev.y + net.body.height <= platform.body.top + 8;

        const release = () => {
            if (state !== 'held') return;
            state = 'air';
            net.setTexture('netinair');
            net.body.enable = true;
            net.body.setSize(180, 30).setOffset(10, 20);
            net.setVelocity(facing * NET_LAUNCH.x, NET_LAUNCH.y);
            colliders.push(
                scene.physics.add.collider(net, api.getMapPlatforms(scene), null, landsFromAbove),
                scene.physics.add.overlap(net, target, () => {
                    if (state !== 'air' || api.isInvincible(target)) return;
                    netFoe(api, scene, player, target, NET_STUN, false);
                    removeNet();
                })
            );
            expireEvent = scene.time.delayedCall(NET_AIR_MS, fadeOut);
        };
        const layOnGround = () => {
            state = 'ground';
            removeColliders();
            floorY = net.body.bottom;
            net.body.enable = false;
            net.setVelocity(0, 0);
            net.setTexture('netonground');
            net.setOrigin(0.5, NET_GROUND_ORIGIN_Y);
            net.setPosition(net.x, floorY);
            expireEvent?.remove(false);
            expireEvent = scene.time.delayedCall(NET_GROUND_MS, fadeOut);
        };

        api.afterWindup(scene, player, NET_RELEASE_MS, release, {
            interruptible: true,
            onInterrupt: removeNet
        });

        removeUpdate = api.addSceneUpdateListener(scene, () => {
            if (!net.active) return;
            if (state === 'held') {
                net.setPosition(player.x + facing * heldOffsetX, player.y - 25);
            } else if (state === 'air' && (net.body.blocked.down || net.body.touching.down)) {
                layOnGround();
            } else if (state === 'ground' && target.active && !api.isInvincible(target)) {
                const body = target.body;
                const steppedIn = body.right > net.x - NET_GROUND_HALF_WIDTH &&
                    body.left < net.x + NET_GROUND_HALF_WIDTH &&
                    body.bottom > floorY - 12 && body.bottom < floorY + 8;
                if (steppedIn) {
                    netFoe(api, scene, player, target, NET_STUN, true);
                    removeNet();
                }
            }
        });

        api.startSideSpecialCooldown(player, currentTime, player.dirSpecialCooldown);
    }

    player.lastTap[direction] = currentTime;
}

// Where the rod tip sits in each 300x300 frame (facing right). rodatk swings
// use their frame 0 tip; reelin's tip moves as the rod is pulled back.
const ROD_TIPS = {
    rodatk: [{ x: 174, y: 111 }],
    linelessrod: [{ x: 174, y: 111 }],
    reelin: [
        { x: 173, y: 111 }, { x: 172, y: 108 }, { x: 167, y: 100 }, { x: 158, y: 89 },
        { x: 145, y: 79 }, { x: 128, y: 71 }, { x: 109, y: 66 }, { x: 91, y: 64 },
        { x: 76, y: 66 }, { x: 66, y: 68 }, { x: 62, y: 69 }
    ]
};
const ROD_SWING_ANIMS = ['rodatk', 'rodatkthird'];
const SHEET_LINE_WIDTH = 3;
const REEL_SPEED = 1600;
const PULL_SPEED = 900;

const SWING_MS = 500;
const SWING_SPEED = 900;
const SWING_PULL = 250;


function getRodTip(player) {
    const rod = player.atk;
    const tips = ROD_TIPS[rod?.texture.key];
    if (!rod?.visible || !tips) return { x: player.x, y: player.y };
    const rodTip = tips[rod.frame.name] ?? tips[0];
    const facing = rod.flipX ? -1 : 1;
    const localX = (rodTip.x - rod.width / 2) * rod.scaleX * facing;
    const localY = (rodTip.y - rod.height / 2) * rod.scaleY;
    const cos = Math.cos(rod.rotation);
    const sin = Math.sin(rod.rotation);
    return {
        x: rod.x + localX * cos - localY * sin,
        y: rod.y + localX * sin + localY * cos
    };
}
function tryPull(api, scene, player, target, direction, currentTime) {
    const dtapDelay = 250;
    const pullCD = player.dirSpecialCooldown;

    if (player.hitstun || player.freeze) return;
    if (currentTime < player.nextSideSpecialTime) return;

    if (currentTime - player.lastTap[direction] < dtapDelay || player.isBot) {
        player.activeHookCleanup?.();

        player.isUsingSideSpecial = true;
        player.isAttacking = true;
        player.hasHitSideSpecial = false;

        // face direction
        if (direction === 'left') {
            player.lastDir = { x: -1, y: 0 };
        } else {
            player.lastDir = { x: 1, y: 0 };
        }

        // GRAPHICS FOR ROPE
        const rope = scene.add.graphics();

        // HOOK PROJECTILE
        const hook = scene.physics.add.sprite(
            player.x + player.lastDir.x * 60,
            player.y,
            'hook' // make a small hook sprite
        );
        hook.body.setMass(0);

        hook.setScale(0.8);
        hook.body.allowGravity = true;
        hook.body.gravity.y = 700;
        scene.objs.add(hook);
        scene.objs.add(rope);

        // initial launch speed
        hook.setVelocity(
            player.lastDir.x * 1000,
            -250
        );

        scene.sound.play('reel');
        scene.sound.play('whoosh');

        let cleanedUp = false;
        let reelingIn = false;
        let pullingToPlatform = false;
        let swingUntil = 0;
        // How far above the hook the pull aims, so he ends up standing on the surface.
        let pullLift = 0;
        let latchedTarget = null;
        const castTime = scene.time.now;
        let removeRopeUpdate = () => {};
        let timeoutEvent = null;
        const colliders = [];
        // Removes the hook and rope at once (new cast, respawn, scene end).
        const removeHook = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            removeRopeUpdate();
            timeoutEvent?.remove(false);
            colliders.forEach(collider => collider.destroy());
            scene.events.off('shutdown', removeHook);
            scene.physics.world.off('worldbounds', cleanupAtWorldBounds);
            hook.destroy();
            rope.destroy();
            if (player.activeHookCleanup === removeHook) {
                player.activeHookCleanup = null;
                player.idleWeaponTexture = null;
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
        };
        // Ends the cast: the player is free again while the hook reels back to the rod tip.
        const cleanup = () => {
            if (cleanedUp || reelingIn) return;
            reelingIn = true;
            pullingToPlatform = false;
            latchedTarget = null;
            timeoutEvent?.remove(false);
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
            scene.physics.world.off('worldbounds', cleanupAtWorldBounds);
            if (hook.body) {
                hook.setVelocity(0, 0);
                hook.body.enable = false;
            }
            if (player.activeHookCleanup === removeHook) {
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
            timeoutEvent = scene.time.delayedCall(1500, removeHook);
            startReelAnim();
        };
        // Latching or reeling back switches the held rod from linelessrod to reelin.
        // A swing in progress is left to finish so its isAttacking release still fires.
        let reelAnimStarted = false;
        const startReelAnim = () => {
            if (reelAnimStarted) return;
            reelAnimStarted = true;
            player.idleWeaponTexture = 'reelin';
            const rod = player.atk;
            if (!ROD_SWING_ANIMS.includes(rod.anims.currentAnim?.key) || !rod.anims.isPlaying) {
                rod.play('reelin');
            }
        };
        const reelHookIn = tip => {
            const dx = tip.x - hook.x;
            const dy = tip.y - hook.y;
            const distance = Math.hypot(dx, dy);
            const step = REEL_SPEED * scene.game.loop.delta / 1000;
            if (distance <= step) {
                removeHook();
                return false;
            }
            hook.setPosition(hook.x + (dx / distance) * step, hook.y + (dy / distance) * step);
            return true;
        };
        player.activeHookCleanup = removeHook;
        player.idleWeaponTexture = 'linelessrod';
        scene.events.once('shutdown', removeHook);
        hook.setCollideWorldBounds(true);
        hook.body.onWorldBounds = true;
        const cleanupAtWorldBounds = body => {
            if (body === hook.body) cleanup();
        };
        scene.physics.world.on('worldbounds', cleanupAtWorldBounds);

        const latchToPlatform = (_hook, platform) => {
            if (cleanedUp || pullingToPlatform) return;
            pullingToPlatform = true;
            hook.setVelocity(0, 0);
            hook.body.enable = false;

            if (platform?.body && hook.y > platform.body.top) {
                hook.y = platform.body.top;
                pullLift = player.body.height / 2 + 10;
            }
            if (player.y > hook.y) swingUntil = scene.time.now + SWING_MS;
            startReelAnim();
        };
        const latchToTarget = () => {
            latchedTarget = target;
            colliders.forEach(collider => collider.destroy());
            colliders.length = 0;
            timeoutEvent?.remove(false);
            hook.setVelocity(0, 0);
            hook.body.enable = false;
            hook.setPosition(target.x, target.y);
            if (player.activeHookCleanup === removeHook) {
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
            timeoutEvent = scene.time.delayedCall(750, cleanup);
            startReelAnim();
        };
        const pullPlayerToHook = () => {
            if (cleanedUp || !pullingToPlatform) return;
            if (!player.active) {
                cleanup();
                return;
            }
            const dx = hook.x - player.x;
            const dy = hook.y - pullLift - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 50) {
                cleanup();
                return;
            }
            const towardX = dx / distance;
            const towardY = dy / distance;
            // Stops swinging early once he has come up level with the hook.
            if (scene.time.now < swingUntil && player.y > hook.y) {
                // Of the two directions perpendicular to the rope, take the one going up.
                // Straight below the hook both are level, so swing the way he is facing.
                let swingX = -towardY;
                let swingY = towardX;
                if (swingY > 0 || (swingY === 0 && swingX * player.lastDir.x < 0)) {
                    swingX = -swingX;
                    swingY = -swingY;
                }
                player.setVelocity(
                    swingX * SWING_SPEED + towardX * SWING_PULL,
                    swingY * SWING_SPEED + towardY * SWING_PULL
                );
                return;
            }
            player.setVelocity(towardX * PULL_SPEED, towardY * PULL_SPEED);
        };

        colliders.push(
            scene.physics.add.overlap(hook, target, () => {
                if (cleanedUp || player.hasHitSideSpecial || pullingToPlatform || api.isInvincible(target)) return;
                player.hasHitSideSpecial = true;

                const dx = player.x - target.x;
                const dy = player.y - target.y;
                const dist = Math.hypot(dx, dy) || 1;
                const pullStrength = 900;

                api.landHit(scene, player, target, {
                    damage: 0.22,
                    plankDamage: 0,
                    hitstun: 550,
                    hitstunGrowth: false,
                    sound: 'anyhit',
                    knockback: () => ({ x: (dx / dist) * pullStrength, y: (dy / dist) * pullStrength }),
                    noDeathRay: true,
                    decelerateAfter: 550,
                    resetCombo: false
                });
                latchToTarget();
            }),

            scene.physics.add.overlap(
                hook,
                api.platformsWithoutStandingPlatform(scene, player),
                latchToPlatform
            ),
            scene.physics.add.overlap(hook, scene.planks, () => latchToPlatform())
        );

        removeRopeUpdate = api.addSceneUpdateListener(scene, () => {
            if (cleanedUp || !hook.active || !rope.active) return;
            if (!player.active) {
                removeHook();
                return;
            }
            // Between swings the rod is held without its drawn line, since the rope is the line.
            const rod = player.atk;
            if (!rod.anims.isPlaying && rod.texture.key === 'rodatk') rod.setTexture(player.idleWeaponTexture, 0);
            if (pullingToPlatform) pullPlayerToHook();
            if (latchedTarget) {
                if (!latchedTarget.active) {
                    cleanup();
                    return;
                }
                hook.setPosition(latchedTarget.x, latchedTarget.y);
            }

            const tip = getRodTip(player);
            if (reelingIn && !reelHookIn(tip)) return;
            rope.clear();
            rope.lineStyle(SHEET_LINE_WIDTH * rod.scaleX, 0x000000);
            rope.beginPath();
            rope.moveTo(tip.x, tip.y);
            const midX = (tip.x + hook.x) / 2;
            const midY = (tip.y + hook.y) / 2;
            const ropeLength = Math.hypot(hook.x - tip.x, hook.y - tip.y);
            const straightenTime = 400;
            const bendLeft = Math.max(0, 1 - (scene.time.now - castTime) / straightenTime);
            const ropeBend = Math.min(60, ropeLength * 0.2) * bendLeft;
            const ctrlX = midX;
            const ctrlY = midY - ropeBend * 2;
            const segments = 12;
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const u = 1 - t;
                rope.lineTo(
                    u * u * tip.x + 2 * u * t * ctrlX + t * t * hook.x,
                    u * u * tip.y + 2 * u * t * ctrlY + t * t * hook.y
                );
            }
            rope.strokePath();

            if (hook.body?.enable) {
                hook.body.velocity.x *= 0.985;
                hook.body.velocity.y *= 0.992;
            }
        });
        timeoutEvent = scene.time.delayedCall(3000, cleanup);

        api.startSideSpecialCooldown(player, currentTime, pullCD);
    }

    player.lastTap[direction] = currentTime;
}

const BACK_HARPOON_SPACING = 8;
const BACK_HARPOON_LIFT = 20;

function createHarpoonRack(scene, player) {
    const behindPlayer = scene.objs.getIndex(player);
    player.harpoonRack = [];
    for (let i = 0; i < MAX_HARPOONS - 1; i++) {
        const harpoon = scene.add.image(player.x, player.y, 'harpoon');
        scene.objs.addAt(harpoon, behindPlayer);
        player.harpoonRack.push(harpoon);
    }
}

function updateTrapper(api, scene, player) {
    if (player.variant !== 'TRAPPER') return;
    if (!player.harpoonRack) createHarpoonRack(scene, player);

    const now = scene.time.now;
    if (player.nextHarpoonAt && now >= player.nextHarpoonAt) {
        player.harpoons = Math.min(MAX_HARPOONS, harpoonsLeft(player) + 1);
        player.nextHarpoonAt = player.harpoons < MAX_HARPOONS ? now + HARPOON_REGEN_MS : 0;
    }
    const harpoons = harpoonsLeft(player);
    // With none left he holds out an empty hand.
    player.idleWeaponTexture = harpoons > 0 ? null : 'harpoonlessatk';

    if (player.lastDir.x !== 0) player.rackFacing = player.lastDir.x;
    const facing = player.rackFacing ?? 1;
    // Tips up, leaning back over the shoulder.
    const angle = Phaser.Math.DegToRad(-90 - facing * 25);
    player.harpoonRack.forEach((harpoon, i) => {
        harpoon.setVisible(i < harpoons - 1);
        harpoon.setRotation(angle);
        harpoon.setPosition(player.x - facing * (12 + i * BACK_HARPOON_SPACING), player.y - BACK_HARPOON_LIFT);
    });
}

export default {
    attackCooldown: 275,
    hitSounds: { finisher: 'rodthirdhitsfx' },
    variantStats: {
        TRAPPER: { hitSounds: { light: 'axeslash1', finisher: 'slash' } }
    },
    // The rod and harpoon sheets are drawn facing right with the arms on the left of each frame.
    rightFacingAttackSprites: ['rodatk', 'linelessrod', 'reelin', 'harpoonatk', 'harpoonlessatk', 'netthrow'],
    textureAttackSpriteOffsets: {
        rodatk: { x: -13, y: 17 },
        linelessrod: { x: -13, y: 17 },
        reelin: { x: -13, y: 17 },
        harpoonatk: { x: 0, y: 12 },
        harpoonlessatk: { x: 0, y: 12 },
        netthrow: { x: 0, y: 12 }
    },
    handleAttack: basicAttack,
    update: updateTrapper,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        attacker.variant === 'TRAPPER'
            ? throwNet(api, scene, attacker, victim, direction, currentTime)
            : tryPull(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { ANGLER: neutralSpecial, TRAPPER: throwHarpoon },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};