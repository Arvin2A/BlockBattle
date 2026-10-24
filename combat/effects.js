// Visual and screen feedback shared by every attack. Nothing here changes game state.

export function addSceneUpdateListener(scene, listener) {
    const removeListener = () => {
        scene.events.off('update', listener);
        scene.events.off('shutdown', removeListener);
    };

    scene.events.on('update', listener);
    scene.events.once('shutdown', removeListener);
    return removeListener;
}

export function spawnDirtBurst(
    scene,
    x,
    y,
    particleCount = 8,
    minSize = 3,
    maxSize = 6,
    burstScale = 1,
    colors = [0x6b4423, 0x8b5a2b, 0xa66a35],
    minDuration = 180,
    maxDuration = 280,
    fallingCurve = false
) {
    //afraid to use phaser's current particle system. so ill use this manual one from chatgpt instead.

    for (let index = 0; index < particleCount; index += 1) {
        const startX = x + Phaser.Math.Between(-12, 12) * burstScale;
        const startY = y + Phaser.Math.Between(-4, 4) * burstScale;
        const pixel = scene.add.rectangle(
            startX,
            startY,
            Phaser.Math.Between(minSize, maxSize),
            Phaser.Math.Between(minSize, maxSize),
            Phaser.Utils.Array.GetRandom(colors)
        );
        pixel.setDepth(4);
        pixel.setAlpha(1);
        scene.objs.add(pixel);

        if (fallingCurve) {
            const controlX = startX + Phaser.Math.Between(-35, 35) * burstScale;
            const controlY = startY - Phaser.Math.Between(90, 130) * burstScale;
            const endX = startX + Phaser.Math.Between(-55, 55) * burstScale;
            const endY = startY + Phaser.Math.Between(10, 30) * burstScale;
            const motion = { progress: 0 };
            scene.tweens.add({
                targets: motion,
                progress: 1,
                duration: Phaser.Math.Between(minDuration, maxDuration),
                ease: 'Cubic.easeOut',
                onUpdate: () => {
                    const inverseProgress = 1 - motion.progress;
                    pixel.setPosition(
                        inverseProgress ** 2 * startX +
                        2 * inverseProgress * motion.progress * controlX +
                        motion.progress ** 2 * endX,
                        inverseProgress ** 2 * startY +
                        2 * inverseProgress * motion.progress * controlY +
                        motion.progress ** 2 * endY
                    );
                    pixel.setAlpha(inverseProgress);
                },
                onComplete: () => pixel.destroy()
            });
            continue;
        }

        const angle = Phaser.Math.FloatBetween(Math.PI * 1.1, Math.PI * 1.9);
        const distance = Phaser.Math.Between(18, 38) * burstScale;
        scene.tweens.add({
            targets: pixel,
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance - Phaser.Math.Between(8, 18) * burstScale,
            alpha: 0,
            duration: Phaser.Math.Between(minDuration, maxDuration),
            ease: 'Cubic.easeOut',
            onComplete: () => pixel.destroy()
        });
    }
}

export function spawnCrater(scene, x, y, duration) {
    const tint = Phaser.Display.Color.HexStringToColor(
        scene.gameState.map.definition.tint
    ).color;
    const crater = scene.add.image(x, y, 'impactcrater');
    crater.setTint(tint);
    crater.setDepth(1.5);
    crater.setScale(1.5);
    scene.objs.add(crater);

    scene.tweens.add({
        targets: crater,
        alpha: 0,
        delay: duration,
        duration: 350,
        ease: 'Linear',
        onComplete: () => crater.destroy()
    });
}

export function spawnExplosion(scene, victim, scale = 0.7) {
    const explosion = scene.add.sprite(victim.x, victim.y, 'explosion')
        .setDepth(8)
        .setScale(scale);
    scene.objs.add(explosion);
    explosion.play('explosion');
    explosion.once('animationcomplete-explosion', () => explosion.destroy());
}

export function triggerScreenShake(scene, intensity, duration = 250) {
    const now = scene.time.now;
    const current = scene.shake;
    if (current && now < current.until && current.intensity > intensity) return;
    scene.shake = { start: now, until: now + duration, intensity };
}

export const DEATH_RAY_COLOR = 0x9b30ff;

export function spawnHitParticles(scene, target, vx = 0, vy = 0, heavy = false, violent = false, ultra = false) {
    if (scene.time.now - (target.lastHitParticlesAt ?? 0) < 80) return;
    target.lastHitParticlesAt = scene.time.now;

    let dirX = -vx;
    let dirY = -vy;
    if (Math.hypot(dirX, dirY) < 1) {
        const players = scene.gameState.players;
        const opponent = players.player === target ? players.player2 : players.player;
        dirX = opponent.x - target.x;
        dirY = opponent.y - target.y;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    // The sprite's position is current; the physics body only catches up next step.
    const center = { x: target.x, y: target.y };
    const reach = Math.min(
        Math.abs(dirX) > 0.001 ? target.body.halfWidth / Math.abs(dirX) : Infinity,
        Math.abs(dirY) > 0.001 ? target.body.halfHeight / Math.abs(dirY) : Infinity
    );
    const edgeX = center.x + dirX * reach;
    const edgeY = center.y + dirY * reach;
    const baseAngle = Math.atan2(dirY, dirX);

    const count = ultra ? 28 : violent ? 18 : 10;
    for (let index = 0; index < count; index += 1) {
        const size = Phaser.Math.Between(2, ultra ? 4 : 3);
        const color = ultra
            ? (index % 2 ? DEATH_RAY_COLOR : 0xd9b3ff)
            : violent && index % 2 ? 0xff2020 : 0xffffff;
        const pixel = scene.add.rectangle(edgeX, edgeY, size, size, color).setDepth(8);
        scene.objs.add(pixel);
        const angle = baseAngle + Phaser.Math.FloatBetween(-0.9, 0.9);
        const distance = Phaser.Math.Between(10, 24) * (ultra ? 3.4 : violent ? 2.4 : heavy ? 1.6 : 1);
        scene.tweens.add({
            targets: pixel,
            x: edgeX + Math.cos(angle) * distance,
            y: edgeY + Math.sin(angle) * distance,
            alpha: 0,
            duration: Phaser.Math.Between(160, 280),
            ease: 'Cubic.easeOut',
            onComplete: () => pixel.destroy()
        });
    }
}
