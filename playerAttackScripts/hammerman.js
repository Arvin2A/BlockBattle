function attack(api, scene, attacker, victim) {
    api.tryAttack3(scene, attacker, victim, 'hammeratk', 'hammeratk');
}

export default {
    handleAttack: attack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        api.tryRepair(scene, attacker, victim, direction, currentTime),
    handleHorizantalTilt: attack,
    handleDownTilt: attack,
    handleUpTilt: attack
};