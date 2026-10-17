function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'swordatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

const neutralSpecial = () => {};

export function NeutralPoke() {
    
}

function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'DAGGER' ? 'daggeratk' : 'swordatk';
    if (animKey == 'daggeratk') {
        api.tryDaggerAttack(scene, attacker, victim, animKey, animKey);
    } else {
        // Second hit of the combo swings back with swordatksecond.
        const comboAnimKey = attacker.combo === 1 ? 'swordatksecond' : animKey;
        api.tryAttack(scene, attacker, victim, comboAnimKey, 'swordatkthird');
    }
}
export default {
    // Nudges the attack sprite: x along the facing direction, y down the screen.
    variantAttackSpriteOffsets: { LONGSWORD: { x: 0, y: 8 } },
    handleAttack: (api, scene, attacker, victim) =>
        attack(api, scene, attacker, victim),
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) => {
        if (attacker.variant === 'DAGGER') {
            api.tryQuickstep(scene, attacker, direction, victim, currentTime);
        } else {
            api.tryLunge(scene, attacker, direction, currentTime);
        }
    },
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { LONGSWORD: neutralSpecial },
    handleDirSpecialAttack: (api, scene, attacker, victim) => {
        if (api.distanceBetween(attacker, victim) > 150) return;
        if (attacker.variant === 'DAGGER') {
            api.quickstepAttack(scene, attacker, victim, 'daggeratk');
        } else {
            api.lungePush(scene, attacker, victim, 'swordatkthird');
        }
    },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};