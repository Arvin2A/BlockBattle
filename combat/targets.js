// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export function getFighters(scene) {
    return scene.gameState?.players ?? [];
}

export function isAlive(fighter) {
    return Boolean(fighter?.active) && !fighter.eliminated;
}

export function isTeammate(first, second) {
    return first !== second && first.team !== undefined && first.team === second.team;
}

export function isEnemy(first, second) {
    return first !== second && first.team !== second.team;
}

export function getEnemies(scene, fighter) {
    return getFighters(scene).filter(other => isAlive(other) && isEnemy(fighter, other));
}

export function nearestEnemy(scene, fighter) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const enemy of getEnemies(scene, fighter)) {
        const distance = Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y);
        if (distance < nearestDistance) {
            nearest = enemy;
            nearestDistance = distance;
        }
    }
    return nearest;
}

export function overlapEnemies(scene, object, attacker, onOverlap) {
    return getEnemies(scene, attacker).map(enemy =>
        scene.physics.add.overlap(object, enemy, () => onOverlap(enemy))
    );
}
