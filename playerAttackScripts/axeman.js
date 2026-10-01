function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'axeatktilt', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

export default {
    handleAttack: (api, scene, attacker, victim) =>
        api.tryAttack(scene, attacker, victim, 'axeatk', 'axeatkthird'),
    handleDirSpecial: (api, scene, attacker, direction, currentTime) =>
        api.tryCleave(scene, attacker, direction, currentTime),
    handleDirSpecialAttack: (api, scene, attacker, victim) => {
        if (api.distanceBetween(attacker, victim) <= 150) {
            api.superSwing(scene, attacker, victim, 'axeatkthird');
        }
    },
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};