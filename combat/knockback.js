import {
    addSceneUpdateListener,
    spawnHitParticles,
    triggerScreenShake,
    DEATH_RAY_COLOR
} from './effects.js';

export const HEAVY_KB_PERCENT = 100;
export const VIOLENT_KB_PERCENT = 150;
export const ULTRA_KB_PERCENT = 200;
const ULTRA_FREEZE_BONUS = 300;
// Attacks stay locked through the death ray freeze and this long after it.
const DEATH_RAY_ATTACK_LOCK_MS = 150;
const ULTRA_MIN_SPEED = 400;

export function isInvincible(player) {
    return player.scene.time.now < (player.invincibleUntil ?? 0);
}

function isFighter(scene, target) {
    const players = scene.gameState?.players;
    return Boolean(players) && (players.player === target || players.player2 === target);
}

function getFighters(scene) {
    const players = scene.gameState?.players;
    return players ? [players.player, players.player2].filter(Boolean) : [];
}

export function hitFreeze(scene, ms = 50) {
    const now = scene.time.now;
    scene.lastHitFreeze = { at: now, ms };
    // A 200%+ launch earlier this frame stretches this attack's freeze.
    const bonus = scene.ultraHitAt === now ? ULTRA_FREEZE_BONUS : 0;
    freezeUntil(scene, now + ms + bonus);
}

function freezeUntil(scene, until, ultra = false) {
    if (ultra) scene.hitFreezeUltra = true;
    if (until <= (scene.hitFreezeUntil ?? 0)) return;
    if (!(scene.hitFreezeUntil > scene.time.now)) scene.hitFreezeStartedAt = scene.time.now;
    scene.hitFreezeUntil = until;
    scene.physics.world.pause();
    scene.anims.pauseAll();
    scene.tweens.pauseAll();
    scene.baseZoom = 2;
    scene.hitFreezeEnd?.remove(false);
    scene.hitFreezeEnd = scene.time.delayedCall(until - scene.time.now, () => {
        refundFrozenHitstun(scene, scene.hitFreezeStartedAt, scene.time.now - scene.hitFreezeStartedAt);
        scene.hitFreezeUntil = 0;
        scene.hitFreezeEnd = null;
        scene.hitFocus = null;
        scene.physics.world.resume();
        scene.anims.resumeAll();
        scene.tweens.resumeAll();
        scene.baseZoom = 1;
        if (scene.hitFreezeUltra) {
            scene.sound.play('superexplosion');
            scene.deathRayAttackLockUntil = scene.time.now + DEATH_RAY_ATTACK_LOCK_MS;
        }
        scene.hitFreezeUltra = false;
    });
}

// A hit freeze pauses physics but not scene.time, and hitstun runs on scene.time.
// Without this, a launch's hitstun ticks away while the victim hangs in the air,
// and they can steer out of it the moment the world resumes. The death ray's
// 300ms freeze ate most of the chainsaw explosion's flat 500ms this way.
function refundFrozenHitstun(scene, frozenAt, frozenFor) {
    if (!(frozenFor > 0)) return;
    for (const fighter of getFighters(scene)) {
        if (fighter.hitstunUntil > frozenAt) fighter.hitstunUntil += frozenFor;
    }
}

function launchDeathRay(scene, target, vx, vy) {
    const now = scene.time.now;
    scene.ultraHitAt = now;
    scene.hitFocus = target;
    const last = scene.lastHitFreeze;
    const attackFreeze = last?.at === now ? last.ms : 0;
    freezeUntil(scene, now + attackFreeze + ULTRA_FREEZE_BONUS, true);

    const angle = Math.atan2(vy, vx);
    const length = 6000;
    const layers = [
        scene.add.rectangle(target.x, target.y, length, 300, DEATH_RAY_COLOR, 0.35),
        scene.add.rectangle(target.x, target.y, length, 190, DEATH_RAY_COLOR),
        scene.add.rectangle(target.x, target.y, length, 65, 0xffffff)
    ];
    const { player, player2 } = scene.gameState.players;
    const behindFighters = Math.min(scene.objs.getIndex(player), scene.objs.getIndex(player2));
    layers.forEach((layer, index) => {
        layer.setOrigin(0.5, 0.5).setRotation(angle).setScale(0.15, 1);
        scene.objs.addAt(layer, behindFighters + index);
    });
    const baseAlpha = layers.map(layer => layer.alpha);

    const GROW_MS = 120;
    const FADE_MS = 450;
    const removeUpdate = addSceneUpdateListener(scene, () => {
        const elapsed = scene.time.now - now;
        const holdUntil = Math.max(now + GROW_MS + 60, scene.hitFreezeUntil || 0);
        const fade = (scene.time.now - holdUntil) / FADE_MS;
        if (fade >= 1) {
            removeUpdate();
            layers.forEach(layer => layer.destroy());
            return;
        }
        const grow = Math.min(1, elapsed / GROW_MS);
        const scaleX = 0.15 + 0.85 * (1 - Math.pow(1 - grow, 3));
        const pulse = 1 + Math.sin(elapsed / 25) * 0.08;
        const shrink = fade > 0 ? 1 - fade * fade : 1;
        layers.forEach((layer, index) => {
            layer.setScale(scaleX, pulse * shrink);
            layer.setAlpha(baseAlpha[index] * shrink);
        });
    });
}

export function deathRayAttackLocked(scene) {
    return scene.hitFreezeUltra || scene.time.now < (scene.deathRayAttackLockUntil ?? 0);
}

// Pass { noDeathRay: true } for hits that shouldn't ever fire the death ray,
// like pulls and explosions.
export function applyKnockback(scene, target, vx, vy, { noDeathRay = false } = {}) {
    const resistance = Number.isFinite(target.playerKBresistance) && target.playerKBresistance > 0
        ? target.playerKBresistance
        : 1;
    const resistantVx = vx / resistance;
    const resistantVy = vy / resistance;
    target.setVelocity(resistantVx, resistantVy);

    const speed = Math.hypot(resistantVx, resistantVy);
    if (isFighter(scene, target)) {
        const kbPercent = (target.KBmultiplier * 100) - 100;
        const heavy = kbPercent >= HEAVY_KB_PERCENT;
        const violent = kbPercent >= VIOLENT_KB_PERCENT;
        const ultra = !noDeathRay && kbPercent >= ULTRA_KB_PERCENT && speed >= ULTRA_MIN_SPEED;
        spawnHitParticles(scene, target, resistantVx, resistantVy, heavy, violent, ultra);
        if (heavy) {
            target.heavyLaunch = true;
            target.violentLaunch = violent;
            target.ultraLaunch = ultra;
            target.heavyLaunchAt = scene.time.now;
            target.afterimage = true;
            if (ultra) {
                triggerScreenShake(scene, 40, 900);
                launchDeathRay(scene, target, resistantVx, resistantVy);
            } else if (violent) {
                triggerScreenShake(scene, 26, 600);
            } else {
                triggerScreenShake(scene, Phaser.Math.Clamp(6 + (kbPercent - HEAVY_KB_PERCENT) / 16, 6, 12));
            }
        }
    }

    return speed;
}
