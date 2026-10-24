// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { spawnDirtBurst } from './effects.js';
import { isInvincible } from './knockback.js';

export function removeGrass(scene, grass, cutter) {
    if (!grass || !grass.active) return;
    const index = scene.scytheGrass.indexOf(grass);
    if (index !== -1) scene.scytheGrass.splice(index, 1);
    if (cutter && cutter.name === 'SCYTHEMAN') {
        cutter.grassCutCount += 1;
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

export function cutGrassBeforeMaturity(attacker) {
    const scene = attacker.scene;
    if (!scene || !scene.scytheGrass) return;

    for (const grass of [...scene.scytheGrass]) {
        if (grass.grassStage < 2 && Phaser.Math.Distance.Between(
            attacker.x,
            attacker.y + 20,
            grass.x,
            grass.y
        ) <= 90) {
            removeGrass(scene, grass, attacker);
        }
    }
}

// Scytheman grass tracking.
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
        if (scytheman.name !== 'SCYTHEMAN' || !scytheman.body.blocked.down) continue;

        const grassTooClose = scene.scytheGrass.some(grass =>
            grass.active && grass.owner === scytheman &&
            Phaser.Math.Distance.Between(
                scytheman.x,
                scytheman.y,
                grass.x,
                grass.y
            ) < 45
        );

        if (grassTooClose) continue;
        if (scytheman.grassTrailX !== null && Phaser.Math.Distance.Between(
            scytheman.x, scytheman.y, scytheman.grassTrailX, scytheman.grassTrailY
        ) < 45) continue;

        const grass = scene.add.sprite(scytheman.x, scytheman.y, 'upgrassGrow');
        grass.setDepth(3);
        grass.grassStage = 0;
        grass.owner = scytheman;
        grass.on('animationupdate', (animation, frame) => {
            grass.grassStage = frame.index;
        });
        grass.play('upgrassGrow');
        scene.objs.add(grass);
        scene.scytheGrass.push(grass);
        scytheman.grassTrailX = scytheman.x;
        scytheman.grassTrailY = scytheman.y;
    }
}
