// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getCharacterStat } from './characterStats.js';
import { isInvincible } from './knockback.js';

export const HEAT = {
    tickMs: 250,
    rayTickDamage: 0.01,
    afterburnTotal: 0.1,
    afterburnTicks: 8,
    inRayGraceMs: 60,
    emberColors: [0xffb347, 0xff7a1a, 0xffe08a]
};

export function scorch(scene, player) {
    player.inRayUntil = scene.time.now + HEAT.inRayGraceMs;
}

function spawnEmbers(scene, player, count) {
    for (let i = 0; i < count; i++) {
        const ember = scene.add.rectangle(
            player.x + Phaser.Math.Between(-18, 18),
            player.y + Phaser.Math.Between(-10, 20),
            5,
            5,
            Phaser.Utils.Array.GetRandom(HEAT.emberColors)
        );
        scene.objs.add(ember);
        scene.tweens.add({
            targets: ember,
            y: ember.y - Phaser.Math.Between(30, 60),
            alpha: 0,
            scale: 0.3,
            duration: Phaser.Math.Between(300, 500),
            onComplete: () => ember.destroy()
        });
    }
}

function burnTick(scene, player, damage, embers) {
    player.KBmultiplier += damage;
    player.flash?.();
    spawnEmbers(scene, player, embers);
}

function clearBurn(player) {
    player.inRayUntil = 0;
    player.afterburnLeft = 0;
    player.nextBurnAt = 0;
}

function setHeated(player, heated) {
    const tint = getCharacterStat(player, 'heat', null)?.tint;
    player.heated = Boolean(heated && tint !== undefined);
    if (tint === undefined) return;
    if (player.heated) {
        player.setTint(tint);
        player.atk?.setTint(tint);
    } else if (player.heatTinted) {
        player.clearTint();
        player.atk?.clearTint();
    }
    player.heatTinted = player.heated;
}

export function updateBurn(scene, player) {
    const now = scene.time.now;
    if (!player.active || player.eliminated || isInvincible(player)) {
        clearBurn(player);
        setHeated(player, false);
        return;
    }
    const frozen = scene.gamePaused || scene.hitFreezeUntil > now;
    const inRay = now < (player.inRayUntil ?? 0);
    if (inRay) player.afterburnLeft = HEAT.afterburnTicks;
    if (!frozen && (inRay || player.afterburnLeft > 0) && now >= (player.nextBurnAt ?? 0)) {
        player.nextBurnAt = now + HEAT.tickMs;
        if (inRay) {
            burnTick(scene, player, HEAT.rayTickDamage, 5);
        } else {
            burnTick(scene, player, HEAT.afterburnTotal / HEAT.afterburnTicks, 2);
            player.afterburnLeft -= 1;
        }
    }
    setHeated(player, inRay || player.afterburnLeft > 0);
}
