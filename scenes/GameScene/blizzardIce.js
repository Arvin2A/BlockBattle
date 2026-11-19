// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { addSceneUpdateListener, spawnDirtBurst } from '../../combat/effects.js';

const ICE = {
    holdMs: 500,
    tint: 0xaee6ff,
    alpha: 0.5,
    breakMs: 220,
    breakScale: 1.3,
    breakRise: 12,
    shards: { count: 14, minSize: 3, maxSize: 7, scale: 1.4, colors: [0xffffff, 0xd6f3ff, 0xaee6ff], minMs: 260, maxMs: 420 }
};

function shatter(scene, player, copy) {
    const { shards } = ICE;
    scene.sound.play('icebreak');
    spawnDirtBurst(scene, copy.x, copy.y, shards.count, shards.minSize, shards.maxSize, shards.scale,
        shards.colors, shards.minMs, shards.maxMs, true);
    scene.tweens.add({
        targets: copy,
        alpha: 0,
        scaleX: copy.scaleX * ICE.breakScale,
        scaleY: copy.scaleY * ICE.breakScale,
        y: copy.y - ICE.breakRise,
        duration: ICE.breakMs,
        onComplete: () => copy.destroy()
    });
}

export function encaseInIce(scene, player) {
    if (!player?.active || player.eliminated) return;
    const now = scene.time.now;
    const until = now + ICE.holdMs;
    const visual = player.squash?.visual;
    const copy = scene.add.image(player.x, player.y + (visual?.offsetY ?? 0), player.texture.key, player.frame.name)
        .setScale(player.scaleX * (visual?.scaleX ?? 1), player.scaleY * (visual?.scaleY ?? 1))
        .setFlipX(player.flipX)
        .setTint(ICE.tint)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(ICE.alpha)
        .setDepth((player.depth ?? 5) + 1);
    scene.objs.add(copy);
    player.freezeUntil = Math.max(player.freezeUntil ?? 0, until);
    player.squashHeldUntil = until;
    const hitBefore = player.lastHitAt;
    const stop = addSceneUpdateListener(scene, () => {
        const broken = !player.active || player.eliminated || player.lastHitAt !== hitBefore;
        if (!broken && scene.time.now < until) return;
        stop();
        if (player.squashHeldUntil === until) player.squashHeldUntil = 0;
        if (copy.active) shatter(scene, player, copy);
    });
}
