import { getCharacterScript } from './characterStats.js';
import { attackIsElligible } from './eligibility.js';

// Fighters whose weapon stays on screen between attacks.
export function hasIdleAttackSprite(player) {
    return player.variant === 'SLEDGEHAMMER' ||
        player.variant === 'MALLET' ||
        player.variant === 'ANGLER' ||
        (player.name === 'SWORDMAN' && player.variant !== 'DAGGER');
}

export function hideAttackSprite(attacker) {
    if (attacker.isAttacking) return;
    attacker.atk.stop();
    attacker.atk.setVisible(hasIdleAttackSprite(attacker));
}

// Extra nudge for a fighter's attack sprite, set in their attack script with
// attackSpriteOffset (or variantAttackSpriteOffsets per variant, or
// textureAttackSpriteOffsets per atk texture, which wins over both).
// x pushes along the facing direction, y pushes down the screen.
export function getAttackSpriteOffset(player, textureKey = player.atk?.texture.key) {
    const script = getCharacterScript(player);
    const offset = script?.textureAttackSpriteOffsets?.[textureKey] ??
        script?.variantAttackSpriteOffsets?.[player.variant] ??
        script?.attackSpriteOffset;
    return {
        x: (offset?.x ?? 0) * player.lastDir.x,
        y: (offset?.y ?? 0) + (offset?.x ?? 0) * player.lastDir.y
    };
}

// Attack art is drawn facing left; textures listed in a script's
// rightFacingAttackSprites are drawn facing right and flip the other way.
export function getAttackSpriteFlipX(player, textureKey = player.atk?.texture.key) {
    const facesRight = getCharacterScript(player)?.rightFacingAttackSprites?.includes(textureKey) ?? false;
    return (-player.lastDir.x < 0) !== facesRight;
}

// Swings lean a little toward the opponent: a quarter of the way from the
// facing direction, at most 20 degrees, and only when they're in front and near.
// The chainsaw aims fully instead (getChainsawAim below).
const AIM_INFLUENCE = 0.25;
const AIM_MAX_DEGREES = 20;
const AIM_RANGE = 250;

export function getAttackAimOffset(attacker) {
    if (attacker.name === 'AXEMAN' && attacker.variant === 'CHAINSAW') return 0;
    const players = attacker.scene?.gameState?.players;
    const target = players && (players.player === attacker ? players.player2 : players.player);
    if (!target?.active) return 0;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    if (Math.hypot(dx, dy) > AIM_RANGE) return 0;
    const facing = Math.atan2(attacker.lastDir.y, attacker.lastDir.x);
    const delta = Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - facing));
    if (Math.abs(delta) > 90) return 0;
    return Phaser.Math.Clamp(delta * AIM_INFLUENCE, -AIM_MAX_DEGREES, AIM_MAX_DEGREES);
}

// A running chainsaw points its blade straight at an opponent it can reach
// (the saw uses the jab's 100px reach), up to 50 degrees off its facing.
const CHAINSAW_AIM_RANGE = 100;
const CHAINSAW_AIM_MAX_DEGREES = 50;

function getChainsawAim(attacker) {
    if (!attacker.chainsawActive) return 0;
    const players = attacker.scene?.gameState?.players;
    const target = players && (players.player === attacker ? players.player2 : players.player);
    if (!target?.active || !attackIsElligible(attacker, target, CHAINSAW_AIM_RANGE,
        { ignoreCanAttack: true, silent: true })) return 0;
    const facing = Math.atan2(attacker.lastDir.y, attacker.lastDir.x);
    const toTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    const delta = Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(toTarget - facing));
    return Phaser.Math.Clamp(delta, -CHAINSAW_AIM_MAX_DEGREES, CHAINSAW_AIM_MAX_DEGREES);
}

function getBaseAttackAngle(attacker) {
    if (attacker.lastDir.y < 0) return 90;
    if (attacker.lastDir.y > 0) return -90;
    return 0;
}

// The weapon's angle this frame: its facing, plus the lean while swinging.
export function getAttackSpriteAngle(attacker) {
    return getBaseAttackAngle(attacker) + (attacker.isAttacking ? attacker.atkAimOffset ?? 0 : 0);
}

export function positionAttackSprite(attacker, animKey = '') {
    attacker.attackBypassesHitstun = false;
    attacker.atk.setVisible(true);
    const textureKey = attacker.scene.anims.get(animKey)?.frames[0]?.textureKey ?? animKey;
    const offset = getAttackSpriteOffset(attacker, textureKey);
    const sawAim = animKey === 'activechainsaw' ? getChainsawAim(attacker) : 0;
    // The blade swings around the axeman toward the target instead of only turning.
    const reachAngle = Math.atan2(attacker.lastDir.y, attacker.lastDir.x) + Phaser.Math.DegToRad(sawAim);
    attacker.atk.x = attacker.x + Math.cos(reachAngle) * 50 + offset.x;
    attacker.atk.y = attacker.y + Math.sin(reachAngle) * 50 - 20 + offset.y;
    attacker.atk.setFlipX(animKey === 'scytheatktilt'
        ? attacker.lastDir.x < 0
        : getAttackSpriteFlipX(attacker, textureKey));
    // Rotating the sprite by the lean turns where it points by the same amount,
    // flipped or not, so the lean just adds to the facing angle.
    attacker.atkAimOffset = animKey === 'activechainsaw' ? 0 : getAttackAimOffset(attacker);
    attacker.atk.setAngle(getBaseAttackAngle(attacker) + attacker.atkAimOffset + sawAim);
}

export function setAttackSprite(attacker, animKey) {
    attacker.attackSequence = (attacker.attackSequence ?? 0) + 1;
    positionAttackSprite(attacker, animKey);
    attacker.atk.setFrame(0);
    attacker.isAttacking = true;
    attacker.lastAttackAnim = animKey;
    attacker.atk.once(`animationcomplete-${animKey}`, () => {
        attacker.lastAttackEndTime = attacker.scene.time.now;
        attacker.isAttacking = false;
        attacker.attackBypassesHitstun = false;
        if (attacker.atkAimOffset) {
            attacker.atkAimOffset = 0;
            if (!attacker.activeGrab) attacker.atk.setAngle(getBaseAttackAngle(attacker));
        }
        if (!attacker.activeGrab) {
            attacker.atk.setVisible(hasIdleAttackSprite(attacker));
        }
    });
    attacker.atk.play(animKey, true);
}
