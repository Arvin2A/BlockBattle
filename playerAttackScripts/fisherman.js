function basicAttack(api, scene, attacker, victim) {
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatk');
}

const neutralSpecial = () => {};
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
        hook.setTint(0x8b5a2b);
        hook.body.setMass(0);

        hook.setScale(2);
        hook.body.allowGravity = true;
        hook.body.gravity.y = 700;
        scene.objs.add(hook);
        scene.objs.add(rope);

        // initial launch speed
        hook.setVelocity(
            player.lastDir.x * 1000,
            -250
        );

        scene.sound.play('whoosh');

        let cleanedUp = false;
        let pullingToPlatform = false;
        let removeRopeUpdate = () => {};
        let timeoutEvent = null;
        const colliders = [];
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            removeRopeUpdate();
            timeoutEvent?.remove(false);
            colliders.forEach(collider => collider.destroy());
            scene.events.off('shutdown', cleanup);
            scene.physics.world.off('worldbounds', cleanupAtWorldBounds);
            hook.destroy();
            rope.destroy();
            if (player.activeHookCleanup === cleanup) {
                player.activeHookCleanup = null;
                player.isUsingSideSpecial = false;
                player.isAttacking = false;
            }
        };
        player.activeHookCleanup = cleanup;
        scene.events.once('shutdown', cleanup);
        hook.setCollideWorldBounds(true);
        hook.body.onWorldBounds = true;
        const cleanupAtWorldBounds = body => {
            if (body === hook.body) cleanup();
        };
        scene.physics.world.on('worldbounds', cleanupAtWorldBounds);

        const latchToPlatform = () => {
            if (cleanedUp || pullingToPlatform) return;
            pullingToPlatform = true;
            hook.setVelocity(0, 0);
            hook.body.enable = false;
        };
        const pullPlayerToHook = () => {
            if (cleanedUp || !pullingToPlatform) return;
            if (!player.active) {
                cleanup();
                return;
            }
            const dx = hook.x - player.x;
            const dy = hook.y - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= 50) {
                cleanup();
                return;
            }
            player.setVelocity((dx / distance) * 900, (dy / distance) * 900);
        };

        colliders.push(
            scene.physics.add.overlap(hook, target, () => {
                if (cleanedUp || player.hasHitSideSpecial || pullingToPlatform || api.isInvincible(target)) return;
                player.hasHitSideSpecial = true;

                target.hitstunUntil = 550 + scene.time.now;

                const dx = player.x - target.x;
                const dy = player.y - target.y;

                const dist = Math.hypot(dx, dy) || 1;

                const pullStrength = 900;

                api.applyKnockback(
                    scene,
                    target,
                    (dx / dist) * pullStrength,
                    (dy / dist) * pullStrength
                );

                scene.sound.play('anyhit');
                target.KBmultiplier += 0.22 * api.getAttackDamageScale(player);
                scene.time.delayedCall(550, () => {
                    if (target.active) target.hitstun = false;
                });
                cleanup();
            }),

            scene.physics.add.overlap(
                hook,
                api.platformsWithoutStandingPlatform(scene, player),
                latchToPlatform
            ),
            scene.physics.add.overlap(hook, scene.planks, latchToPlatform)
        );

        removeRopeUpdate = api.addSceneUpdateListener(scene, () => {
            if (cleanedUp || !hook.active || !rope.active) return;
            if (pullingToPlatform) pullPlayerToHook();

            rope.clear();
            rope.lineStyle(3, 0x8b5a2b);
            rope.beginPath();
            rope.moveTo(player.x, player.y);
            rope.lineTo(hook.x, hook.y);
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
    handleAttack: basicAttack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        tryPull(api, scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { ANGLER: neutralSpecial },
    handleHorizantalTilt: basicAttack,
    handleDownTilt: basicAttack,
    handleUpTilt: basicAttack
};