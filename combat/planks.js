// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { damagePlank as damageAxemanPlank } from '../playerAttackScripts/axeman.js';
import { spawnDirtBurst } from './effects.js';
import { getCharacterStat } from './characterStats.js';

// The plank scripts only need spawnDirtBurst from the shared api.
const plankApi = { spawnDirtBurst };

// True when a wall stands between attacker and target. Fighters hit through
// the walls they placed themselves, never through anyone else's.
export function isBlockedByWall(attacker, target) {
    const planks = attacker.scene?.planks;
    if (!planks) return false;
    const line = new Phaser.Geom.Line(attacker.x, attacker.y, target.x, target.y);
    return planks.getChildren().some(plank =>
        plank.active && plank.body?.enable && plank.owner !== attacker &&
        Phaser.Geom.Intersects.LineToRectangle(line, plank.body)
    );
}

export function damagePlank(scene, plank, damage) {
    damageAxemanPlank(plankApi, scene, plank, damage);
}

// Damages every plank the attack sprite overlaps. Call it when the swing
// actually connects (after any windup), not when it starts. A character's
// plankDamageScale stat multiplies the attack's own value.
// Each swing (attackSequence) damages a plank at most once.
export function damagePlanksInAttack(attacker, damage) {
    const scene = attacker.scene;
    if (!scene?.planks || !attacker.atk?.active || !(damage > 0)) return;
    damage *= getCharacterStat(attacker, 'plankDamageScale', 1);

    const attackSequence = attacker.attackSequence ?? 0;
    if (attacker.lastPlankDamageSequence === attackSequence) return;
    const attackBounds = attacker.atk.getBounds();
    const intersectingPlanks = scene.planks.getChildren().filter(plank =>
        plank.active && plank.body?.enable &&
        Phaser.Geom.Intersects.RectangleToRectangle(attackBounds, plank.body)
    );
    if (intersectingPlanks.length === 0) return;

    attacker.lastPlankDamageSequence = attackSequence;
    intersectingPlanks.forEach(plank => damagePlank(scene, plank, damage));
}
