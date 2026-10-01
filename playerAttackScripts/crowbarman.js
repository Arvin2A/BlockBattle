function tilt(api, scene, attacker, victim, xMul, yMul, kbTime) {
    api.tiltAttack(scene, attacker, victim, {
        animKey: 'crowbaratk', kb: 0.035, xMul, yMul,
        range: 150, freeze: 80, sfx: 'swosh', kbTime
    });
}

export default {
    handleAttack: (api, scene, attacker, victim) => {
        if (attacker.activeGrab) {
            api.releaseGrab(scene, attacker, scene.time.now, true);
        } else {
            api.tryAttack(scene, attacker, victim, 'crowbaratk', 'crowbaratk');
        }
    },
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        api.tryGrab(scene, attacker, victim, direction, currentTime),
    handleHorizantalTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0.6, 1, 600),
    handleDownTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 2, 300),
    handleUpTilt: (api, scene, attacker, victim) =>
        tilt(api, scene, attacker, victim, 0, 0.88, 300)
};