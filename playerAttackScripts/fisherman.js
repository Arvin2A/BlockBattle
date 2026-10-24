function basicAttack(api, scene, attacker, victim) {
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatkthird');
}

const neutralSpecial = () => {};

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
// The line drawn in the rod sheet is 3px thick before the atk sprite is scaled.
const SHEET_LINE_WIDTH = 3;
const REEL_SPEED = 1600;
const PULL_SPEED = 900;
// Hooking a platform above the fisherman swings him up around the hook in a
// circle for SWING_MS before the straight pull takes over.
const SWING_MS = 500;
const SWING_SPEED = 900;
// Small inward pull during the swing so the circle tightens instead of drifting outward.
const SWING_PULL = 250;

// Maps the rod tip through the atk sprite's flip, rotation and scale so the
// rope starts from the end of the rod instead of the fisherman's centre.
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
            // The main ground is solid on every side, so a hook that catches its side
            // would pull him flat into the wall. Anchor on the top surface instead.
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

export default {
    attackCooldown: 275,
    hitSounds: { finisher: 'rodthirdhitsfx' },
    // The rod sheet is drawn facing right with the arms on the left of each frame.
    rightFacingAttackSprites: ['rodatk', 'linelessrod', 'reelin'],
    textureAttackSpriteOffsets: {
        rodatk: { x: -13, y: 17 },
        linelessrod: { x: -13, y: 17 },
        reelin: { x: -13, y: 17 }
    },
    handleAttack: basicAttack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPull(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { ANGLER: neutralSpecial },
    handleHorizantalTilt: basicAttack,
    handleDownTilt: basicAttack,
    handleUpTilt: basicAttack
};