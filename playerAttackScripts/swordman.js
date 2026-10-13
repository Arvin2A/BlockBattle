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
        api.tryAttack(scene, attacker, victim, animKey, 'swordatkthird');
    }
}
export default {
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
        if (api.distanceBetween(attacker, victim) <= 150) {
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