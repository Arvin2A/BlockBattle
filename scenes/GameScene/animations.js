// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export function createGameAnimations(scene) {
    const frames = (key, config) => scene.textures.exists(key) ? scene.anims.generateFrameNumbers(key, config) : [];
    const create = config => {
        if (scene.anims.exists(config.key) || !config.frames.length) return;
        scene.anims.create(config);
    };
    // Attacks
    create({
        key: 'axeatk',
        frames: frames('axeatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'axeatktilt',
        frames: frames('axeatktilt', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'swordatk',
        frames: frames('swordatk', { start: 0, end: 7 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'daggeratk',
        frames: frames('daggeratk', { start: 0, end: 2 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'swordatksecond',
        frames: frames('swordatksecond', { start: 0, end: 4 }),
        frameRate: 24,
        repeat: 0
    });
    create({
        key: 'swordatkthird',
        frames: frames('swordatkthird', { start: 0, end: 5 }),
        frameRate: 32,
        repeat: 0
    });
    // Match intros are keyed `<character texture>intro` (see startCharacterIntros).
    create({
        key: 'swordmanintro',
        frames: frames('swordmanintro', { start: 0, end: 30 }),
        frameRate: 20,
        repeat: 0
    });
    // Frame 41 of the 42-frame sheet is blank, so stop on 40 to keep the mallet shown.
    create({
        key: 'hammermanintro',
        frames: frames('hammermanintro', { start: 0, end: 40 }),
        frameRate: 20,
        repeat: 0
    });
    create({
        key: 'sheathe',
        frames: frames('sheathe', { start: 0, end: 15 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'sheathedraw',
        frames: frames('sheatheatk', { start: 0, end: 5 }),
        frameRate: 30,
        repeat: 0
    });
    create({
        key: 'sheatheatkwindup',
        frames: frames('sheatheatk', { start: 0, end: 1 }),
        frameRate: 7.5,
        repeat: 0
    });
    create({
        key: 'sheatheatk',
        frames: frames('sheatheatk', { start: 2, end: 8 }),
        frameRate: 28,
        repeat: 0
    });
    create({
        key: 'swordatktilt',
        frames: frames('swordatktilt', { start: 0, end: 4 }),
        frameRate: 28,
        repeat: 0
    });
    create({
        key: 'axeatkthird',
        frames: frames('axeatkthird', { start: 0, end: 6 }),
        frameRate: 42,
        repeat: 0
    });
    create({
        key: 'activechainsaw',
        frames: frames('activechainsaw', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: -1
    });
    create({
        key: 'inactivechainsaw',
        frames: frames('inactivechainsaw', { start: 0, end: 0 }),
        frameRate: 1,
        repeat: 0
    });
    create({
        key: 'rodatk',
        frames: frames('rodatk', { start: 0, end: 17 }),
        frameRate: 66,
        repeat: 0
    });
    // Plays once when the hook latches or reels back, then holds its last frame until the rope is gone.
    create({
        key: 'fishslap',
        frames: frames('fishslap', { start: 0, end: 17 }),
        frameRate: 40,
        repeat: 0
    });
    create({
        key: 'reelin',
        frames: frames('reelin', { start: 0, end: 10 }),
        frameRate: 24,
        repeat: 0
    });
    // The finishing cast plays the whole sheet; regular swings stop after frame 17.
    create({
        key: 'rodatkthird',
        frames: frames('rodatk', { start: 0, end: 30 }),
        frameRate: 60,
        repeat: 0
    });
    // TRAPPER's stab is frames 0-15; the pinning stab is 20 to the end of the sheet.
    for (const sheet of ['harpoonatk', 'harpoonlessatk']) {
        create({
            key: sheet,
            frames: frames(sheet, { start: 0, end: 15 }),
            frameRate: 60,
            repeat: 0
        });
        create({
            key: `${sheet}third`,
            frames: frames(sheet, { start: 20, end: 36 }),
            frameRate: 50,
            repeat: 0
        });
    }
    create({
        key: 'netthrow',
        frames: frames('netthrow', { start: 0, end: 5 }),
        frameRate: 30,
        repeat: 0
    });
    create({
        key: 'scytheatk',
        frames: frames('scytheatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'scytheatktilt',
        frames: frames('scytheatktilt', { start: 0, end: 4 }),
        frameRate: 48,
        repeat: 0
    });
    create({
        key: 'hammeratk',
        frames: frames('hammeratk', { start: 0, end: 8 }),
        frameRate: 48,
        repeat: 0
    });
    create({
        key: 'hammerdash',
        frames: frames('hammerdash', { start: 0, end: 12 }),
        frameRate: 40,
        repeat: 0
    });
    create({
        key: 'hammeratkheal',
        frames: frames('hammeratkheal', { start: 0, end: 32 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'sledgehammeratk',
        frames: frames('sledgehammeratk', { start: 0, end: 17 }),
        frameRate: 16,
        repeat: 0
    });
    create({
        key: 'whirlwind',
        frames: frames('whirlwind', { frames: [1, 2, 3, 4, 5, 6, 7, 0] }),
        frameRate: 1.5 * 1000 / 67.1,
        repeat: -1
    });
    create({
        key: 'sledgehammerquickslam1',
        frames: frames('sledgehammerquickslam1', { start: 0, end: 5 }),
        frameRate: 24,
        repeat: 0
    });
    create({
        key: 'sledgehammerquickslam2',
        frames: frames('sledgehammerquickslam2', { start: 5, end: 9 }),
        frameRate: 24,
        repeat: 0
    });
    create({
        key: 'sledge_walk',
        frames: frames('sledge_walk', { start: 0, end: 1 }),
        frameRate: 8,
        repeat: -1
    });
    create({
        key: 'slateatk',
        frames: frames('slateatk1', { start: 0, end: 15 }),
        frameRate: 60,
        repeat: 0
    });
    create({
        key: 'slateatksecond',
        frames: frames('slateatk1', { start: 15, end: 30 }),
        frameRate: 60,
        repeat: 0
    });
    create({
        key: 'slateatktilt',
        frames: frames('slateatktilt', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'slateatkthird',
        frames: frames('slateatk1', { start: 30, end: 48 }),
        frameRate: 60,
        repeat: 0
    });
    create({
        key: 'slateplunge',
        frames: frames('slateplunge', { start: 0, end: 42 }),
        duration: 2000,
        repeat: 0
    });
    create({
        key: 'slateplungedash',
        frames: frames('slateplunge', { start: 15, end: 33 }),
        duration: 196,
        repeat: 0
    });
    create({
        key: 'crowbargrab',
        frames: frames('crowbargrab', { start: 0, end: 6 }),
        duration: 375,
        repeat: 0
    });
    create({
        key: 'crowbargrabspin',
        frames: frames('grabspin', { start: 0, end: 6 }),
        frameRate: 20,
        repeat: 0
    });
    create({
        key: 'crowbarslam',
        frames: frames('bigcrowbarslam', { start: 0, end: 16 }),
        frameRate: 12,
        repeat: 0
    });
    create({
        key: 'crowbaratk',
        frames: frames('crowbaratk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    create({
        key: 'gunmanatk',
        frames: frames('gunmanatk', { start: 0, end: 2 }),
        frameRate: 50,
        repeat: 0
    });
    create({
        key: 'gunmanspecial',
        frames: frames('gunmanspecial', { start: 0, end: 2 }),
        frameRate: 50,
        repeat: 0
    });
    create({
        key: 'shotgunfire',
        frames: frames('shotgunfire', { start: 0, end: 9 }),
        frameRate: 20,
        repeat: 0
    });
    create({
        key: 'explosion',
        frames: frames('explosion', { start: 0, end: 14 }),
        frameRate: 24,
        repeat: 0
    });

    // Miscellaneous
    create({
        key: 'upbambooGrow',
        frames: frames('upbambooGrow', { start: 0, end: 3 }),
        frameRate: 18,
        repeat: 0
    });
    create({
        key: 'blizzard',
        frames: frames('blizzard', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: -1
    });
    create({
        key: 'rainstorm',
        frames: frames('rainstorm', { start: 0, end: 1 }),
        frameRate: 12,
        repeat: -1
    });
    create({
        key: 'sandstorm',
        frames: frames('sandstorm', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: -1
    });
    create({
        key: 'upgrassGrow',
        frames: frames('upgrassGrow', { start: 0, end: 2 }),
        frameRate: 0.25,
        repeat: 0
    });
    create({
        key: 'woodcollect',
        frames: frames('woodcollect', { start: 0, end: 7 }),
        frameRate: 35,
        repeat: -1
    });
    create({
        key: 'uni-ledgehang',
        frames: frames('uni-ledgepull', { start: 0, end: 0 }),
        frameRate: 1,
        repeat: 0
    });
    create({
        key: 'uni-ledgepull',
        frames: frames('uni-ledgepull', { start: 0, end: 15 }),
        frameRate: 40,
        repeat: 0
    });
    create({
        key: 'uni-slam',
        frames: frames('uni-slam', { start: 0, end: 10 }),
        frameRate: 36,
        repeat: 0
    });
    create({
        key: 'lawnmowerrun',
        frames: frames('lawnmowerrun', { start: 0, end: 1 }),
        frameRate: 18,
        repeat: -1
    });
    create({
        key: 'pullcord',
        frames: frames('pullcord', { start: 0, end: 5 }),
        frameRate: 30,
        repeat: 0
    });
}
