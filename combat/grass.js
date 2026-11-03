// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { spawnDirtBurst } from './effects.js';
import { isInvincible } from './knockback.js';

export function removeGrass(scene, grass, cutter) {
    if (!grass || !grass.active) return;
    const index = scene.scytheGrass.indexOf(grass);
    if (index !== -1) scene.scytheGrass.splice(index, 1);
    if (cutter && cutter === grass.owner) {
        cutter.grassCutCount += 1;
        cutter.onGrassCut?.();
    }
    spawnDirtBurst(scene, grass.x, grass.y);
    grass.destroy();
    scene.sound.play('harvest');
}

export function cutNearbyGrass(scene, x, y, range, cutter) {
    for (const grass of [...scene.scytheGrass]) {
        if (Phaser.Math.Distance.Between(x, y, grass.x, grass.y) <= range) {
            removeGrass(scene, grass, cutter);
        }
    }
}

export function cutGrassInSwing(attacker, range = 100, cutter = attacker) {
    const scene = attacker.scene;
    if (!scene || !scene.scytheGrass) return;

    const reach = Math.min(range, 130);
    const facingX = attacker.lastDir?.x ?? 0;
    for (const grass of [...scene.scytheGrass]) {
        const dx = grass.x - attacker.x;
        if (facingX !== 0 && dx * facingX < -25) continue;
        if (Phaser.Math.Distance.Between(attacker.x, attacker.y + 20, grass.x, grass.y) <= reach) {
            removeGrass(scene, grass, cutter);
        }
    }
}

export function getGrassPlatform(scene, x, feetY) {
    const platforms = [
        ...scene.gameState.map.platforms.getChildren(),
        ...scene.gameState.map.topPlatforms.getChildren()
    ];
    return platforms.find(platform =>
        platform.active && platform.body?.enable &&
        x >= platform.body.left && x <= platform.body.right &&
        Math.abs(platform.body.top - feetY) <= 8
    ) ?? null;
}

export function plantGrass(scene, owner, x, y) {
    if (!scene.scytheGrass) scene.scytheGrass = [];
    const grass = scene.add.sprite(x, y, 'upgrassGrow');
    grass.setDepth(3);
    grass.grassStage = 0;
    grass.owner = owner;
    grass.on('animationupdate', (animation, frame) => {
        grass.grassStage = frame.index;
    });
    grass.play('upgrassGrow');
    scene.objs.add(grass);
    scene.scytheGrass.push(grass);
    return grass;
}

export function hasOwnGrassNear(scene, owner, x, y, distance) {
    return (scene.scytheGrass ?? []).some(grass =>
        grass.active && grass.owner === owner &&
        Phaser.Math.Distance.Between(x, y, grass.x, grass.y) < distance
    );
}

export function updateScythemanGrass(scene, players) {
    if (!scene.scytheGrass) scene.scytheGrass = [];

    for (const key in players) {
        const player = players[key];
        player.inGrass = scene.scytheGrass.some(grass =>
            grass.active && grass.getBounds().contains(player.x, player.y + 20)
        );
        if (player.inGrass && player.name !== 'SCYTHEMAN' && !isInvincible(player) &&
            scene.time.now >= player.nextGrassDamageTime) {
            player.KBmultiplier += 0.025;
            player.nextGrassDamageTime = scene.time.now + 450;
            player.flash();
        }
    }

    for (const key in players) {
        const scytheman = players[key];
        if (scytheman.name !== 'SCYTHEMAN' || scytheman.noGrassTrail || !scytheman.body.blocked.down) continue;

        if (!getGrassPlatform(scene, scytheman.x, scytheman.body.bottom)) continue;
        if (hasOwnGrassNear(scene, scytheman, scytheman.x, scytheman.y, 45)) continue;
        if (scytheman.grassTrailX !== null && Phaser.Math.Distance.Between(
            scytheman.x, scytheman.y, scytheman.grassTrailX, scytheman.grassTrailY
        ) < 45) continue;

        plantGrass(scene, scytheman, scytheman.x, scytheman.y);
        scytheman.grassTrailX = scytheman.x;
        scytheman.grassTrailY = scytheman.y;
    }
}
