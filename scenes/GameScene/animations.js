export function createGameAnimations(scene) {
    // Attacks
    scene.anims.create({
        key: 'axeatk',
        frames: scene.anims.generateFrameNumbers('axeatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'axeatktilt',
        frames: scene.anims.generateFrameNumbers('axeatktilt', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'swordatk',
        frames: scene.anims.generateFrameNumbers('swordatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'swordatkthird',
        frames: scene.anims.generateFrameNumbers('swordatkthird', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'swordatktilt',
        frames: scene.anims.generateFrameNumbers('swordatktilt', { start: 0, end: 4 }),
        frameRate: 28,
        repeat: 0
    });
    scene.anims.create({
        key: 'axeatkthird',
        frames: scene.anims.generateFrameNumbers('axeatkthird', { start: 0, end: 6 }),
        frameRate: 42,
        repeat: 0
    });
    scene.anims.create({
        key: 'rodatk',
        frames: scene.anims.generateFrameNumbers('rodatk', { start: 0, end: 3 }),
        frameRate: 28,
        repeat: 0
    });
    scene.anims.create({
        key: 'scytheatk',
        frames: scene.anims.generateFrameNumbers('scytheatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'scytheatktilt',
        frames: scene.anims.generateFrameNumbers('scytheatktilt', { start: 0, end: 4 }),
        frameRate: 48,
        repeat: 0
    });
    scene.anims.create({
        key: 'hammeratk',
        frames: scene.anims.generateFrameNumbers('hammeratk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'sledgehammeratk',
        frames: scene.anims.generateFrameNumbers('sledgehammeratk', { start: 0, end: 17 }),
        frameRate: 16,
        repeat: 0
    });
    scene.anims.create({
        key: 'sledgehammerquickslam1',
        frames: scene.anims.generateFrameNumbers('sledgehammerquickslam1', { start: 0, end: 4 }),
        frameRate: 24,
        repeat: 0
    });
    scene.anims.create({
        key: 'sledgehammerquickslam2',
        frames: scene.anims.generateFrameNumbers('sledgehammerquickslam1', { start: 0, end: 4 }),
        frameRate: 24,
        repeat: 0
    });
    scene.anims.create({
        key: 'sledge_walk',
        frames: scene.anims.generateFrameNumbers('sledge_walk', { start: 0, end: 1 }),
        frameRate: 8,
        repeat: -1
    });
    scene.anims.create({
        key: 'slateatk',
        frames: scene.anims.generateFrameNumbers('slateatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'slateatktilt',
        frames: scene.anims.generateFrameNumbers('slateatktilt', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'slateatkthird',
        frames: scene.anims.generateFrameNumbers('slateatkthird', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'slateplunge',
        frames: scene.anims.generateFrameNumbers('slateplunge', { start: 0, end: 10 }),
        frameRate: 12,
        repeat: 0
    });
    scene.anims.create({
        key: 'crowbargrab',
        frames: scene.anims.generateFrameNumbers('crowbargrab', { start: 0, end: 6 }),
        frameRate: 48,
        repeat: 0
    });
    scene.anims.create({
        key: 'crowbaratk',
        frames: scene.anims.generateFrameNumbers('crowbaratk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    scene.anims.create({
        key: 'gunmanatk',
        frames: scene.anims.generateFrameNumbers('gunmanatk', { start: 0, end: 2 }),
        frameRate: 50,
        repeat: 0
    });
    scene.anims.create({
        key: 'explosion',
        frames: scene.anims.generateFrameNumbers('explosion', { start: 0, end: 14 }),
        frameRate: 24,
        repeat: 0
    });

    // Miscellaneous
    scene.anims.create({
        key: 'upbambooGrow',
        frames: scene.anims.generateFrameNumbers('upbambooGrow', { start: 0, end: 3 }),
        frameRate: 18,
        repeat: 0
    });
    scene.anims.create({
        key: 'blizzard',
        frames: scene.anims.generateFrameNumbers('blizzard', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: -1
    });
    scene.anims.create({
        key: 'sandstorm',
        frames: scene.anims.generateFrameNumbers('sandstorm', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: -1
    });
    scene.anims.create({
        key: 'upgrassGrow',
        frames: scene.anims.generateFrameNumbers('upgrassGrow', { start: 0, end: 2 }),
        frameRate: 0.75,
        repeat: 0
    });
}