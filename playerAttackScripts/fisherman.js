function basicAttack(api, scene, attacker, victim) {
    api.tryAttack(scene, attacker, victim, 'rodatk', 'rodatk');
}

const neutralSpecial = () => {};
export default {
    handleAttack: basicAttack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        api.tryPull(scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: { ANGLER: neutralSpecial },
    handleHorizantalTilt: basicAttack,
    handleDownTilt: basicAttack,
    handleUpTilt: basicAttack
};