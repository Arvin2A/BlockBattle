function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammeratk' : 'hammeratk';
    api.tryAttack3(scene, attacker, victim, animKey, animKey);
}

const neutralSpecial = () => {};
export default {
    handleAttack: attack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        attacker.variant === 'SLEDGEHAMMER'
            ? api.tryQuickslam(scene, attacker, victim, direction, currentTime)
            : api.tryRepair(scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: {
        MALLET: neutralSpecial,
        SLEDGEHAMMER: neutralSpecial
    },
    handleHorizantalTilt: attack,
    handleDownTilt: attack,
    handleUpTilt: attack
};