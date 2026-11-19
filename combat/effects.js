// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { nearestEnemy } from './targets.js';
import { hitParticlesEnabled } from '../ui/settings.js';
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

export function spawnHealFlash(scene, player, duration = 100) {
    const flash = scene.add.rectangle(player.x, player.y, 50, 50, 0x00ff00);
    scene.objs.add(flash);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration,
        onComplete: () => flash.destroy()
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

const HIT_PARTICLE = {
    count: 5,
    color: 0xffffff,
    minSize: 2,
    maxSize: 4,
    minSpeed: 90,
    maxSpeed: 200,
    lift: 110,
    drag: 1.8,
    gravity: 380,
    minMs: 450,
    maxMs: 650,
    fadeFrom: 0.8,
    chopMs: 30,
    power: { minLaunch: 300, maxLaunch: 1500, speedBonus: 1.5, gravityCut: 0.75, lifeCut: 0.5 }
};

function launchPower(vx, vy) {
    const { minLaunch, maxLaunch } = HIT_PARTICLE.power;
    return Phaser.Math.Clamp((Math.hypot(vx, vy) - minLaunch) / (maxLaunch - minLaunch), 0, 1);
}

export function spawnHitParticles(scene, target, vx = 0, vy = 0) {
    if (!hitParticlesEnabled() || scene.time.now - (target.lastHitParticlesAt ?? 0) < 80) return;
    target.lastHitParticlesAt = scene.time.now;

    let dirX = -vx;
    let dirY = -vy;
    if (Math.hypot(dirX, dirY) < 1) {
        const opponent = nearestEnemy(scene, target);
        dirX = opponent ? opponent.x - target.x : 0;
        dirY = opponent ? opponent.y - target.y : -1;
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

    const power = launchPower(vx, vy);
    const { speedBonus, gravityCut, lifeCut } = HIT_PARTICLE.power;
    const { drag, fadeFrom, chopMs } = HIT_PARTICLE;
    const gravity = HIT_PARTICLE.gravity * (1 - gravityCut * power);
    for (let index = 0; index < HIT_PARTICLE.count; index += 1) {
        const size = Phaser.Math.Between(HIT_PARTICLE.minSize, HIT_PARTICLE.maxSize);
        const pixel = scene.add.rectangle(edgeX, edgeY, size, size, HIT_PARTICLE.color).setDepth(8);
        pixel.hitParticle = true;
        scene.objs.add(pixel);
        const angle = baseAngle + Phaser.Math.FloatBetween(-0.9, 0.9);
        const speed = Phaser.Math.Between(HIT_PARTICLE.minSpeed, HIT_PARTICLE.maxSpeed) * (1 + speedBonus * power);
        const startVx = Math.cos(angle) * speed;
        const startVy = Math.sin(angle) * speed - HIT_PARTICLE.lift * (1 - power);
        const duration = Phaser.Math.Between(HIT_PARTICLE.minMs, HIT_PARTICLE.maxMs) * (1 - lifeCut * power);
        scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration,
            onUpdate: tween => {
                const elapsed = Math.floor(tween.getValue() * duration / chopMs) * chopMs;
                const progress = elapsed / duration;
                const seconds = elapsed / 1000;
                const glide = (1 - Math.exp(-drag * seconds)) / drag;
                pixel.setPosition(edgeX + startVx * glide, edgeY + startVy * glide + 0.5 * gravity * seconds * seconds);
                pixel.setAlpha(progress < fadeFrom ? 1 : 1 - (progress - fadeFrom) / (1 - fadeFrom));
            },
            onComplete: () => pixel.destroy()
        });
    }
}
