function basicAttack(api, scene, attacker, victim) {
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatk');
}

export default {
    handleAttack: basicAttack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        api.tryPull(scene, attacker, victim, direction, currentTime),
    handleHorizantalTilt: basicAttack,
    handleDownTilt: basicAttack,
    handleUpTilt: basicAttack
};