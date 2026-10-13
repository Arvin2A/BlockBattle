function attack(api, scene, attacker, victim) {
    const animKey = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammeratk' : 'hammeratk';
    api.tryAttack3(scene, attacker, victim, animKey, animKey);
}

const neutralSpecial = () => {};
function destroyPlank(api, scene, plank) {
    if (!plank.active) return;
    plank.expireEvent?.remove(false);
    scene.planks.remove(plank, false, false);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );
    plank.destroy();
    scene.sound.play('plankbreak');
}


function steelPlank(
    api,
    scene,
    attacker,
    { allowChainsawMode = false } = {}
) {
    if (attacker.hitstun || attacker.freeze ||
        scene.finisherActive) return;

    

    if (!attacker.steelPlanks) {
        attacker.steelPlanks = [];
    }

    attacker.steelPlanks = attacker.steelPlanks.filter(p => p.active);

    const maxPlanks = attacker.variant === 'SLEDGEHAMMER' ? 1 : 2;

    if (attacker.steelPlanks.length >= maxPlanks) return;

    const offset = 60; // Horizontal distance from attacker
    const x = attacker.x + (attacker.lastDir.x >= 0 ? offset : -offset);
    const y = attacker.y - 75;

    const rotated = true;

    const createAnimation = attacker.variant === 'SLEDGEHAMMER' ? 'sledgehammerquickslam1' : 'hammeratk';
    api.setAttackSprite(attacker, createAnimation);

    const plankTexture = attacker.variant === 'SLEDGEHAMMER'
        ? 'strongsteel'
        : 'lightsteel';

    const plank = scene.physics.add.image(x, y, plankTexture);

    const plankSound = attacker.variant === 'SLEDGEHAMMER'
        ? 'thicksteelplank'
        : 'steelplank';

    scene.sound.play(plankSound);

    plank.setOrigin(0.5);
    plank.setAngle(90);
    plank.setDepth(3);


    plank.body.allowGravity = false;
    plank.setImmovable(true);

    plank.body.setSize(10, 200);
    plank.body.setOffset(95, 0);

    plank.health = attacker.variant === 'SLEDGEHAMMER' ? 0.50 : 0.13;
    plank.maxHealth = plank.health;

    scene.objs.add(plank);
    scene.planks.add(plank);
    attacker.steelPlanks.push(plank);
    api.spawnDirtBurst(
        scene,
        plank.x,
        plank.y,
        12,
        3,
        7,
        1.3,
        [0xFFFFFF, 0xF0F0F0, 0xDCDCDC],
        180,
        320,
        false
    );

    const plankDeletionTime = attacker.variant === 'SLEDGEHAMMER' ? 20000 : 10000;
    plank.expireEvent = scene.time.delayedCall(plankDeletionTime, () => {
        destroyPlank(api, scene, plank);
    });
}

export default {
    handleAttack: attack,
    handleDirSpecial: (api, scene, attacker, direction, currentTime, victim) =>
        attacker.variant === 'SLEDGEHAMMER'
            ? api.tryQuickslam(scene, attacker, victim, direction, currentTime)
            : api.tryRepair(scene, attacker, victim, direction, currentTime),
    handleNeutralSpecial: neutralSpecial,
    variantNeutralSpecials: {
        MALLET: steelPlank,
        SLEDGEHAMMER: steelPlank
    },
    handleHorizantalTilt: attack,
    handleDownTilt: attack,
    handleUpTilt: attack
};