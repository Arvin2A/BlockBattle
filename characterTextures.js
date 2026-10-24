// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export const CHARACTER_VARIANT_TEXTURES = {
    axeman: {
        LUMBERER: 'axeman',
        CHAINSAW: 'chainsawman'
    },
    swordman: {
        LONGSWORD: 'swordman',
        DAGGER: 'daggerman'
    },
    hammerman: {
        MALLET: 'hammerman',
        SLEDGEHAMMER: 'sledgehammerman'
    }
};

export function getCharacterTexture(character, variant = '') {
    const characterKey = character.toLowerCase();
    return CHARACTER_VARIANT_TEXTURES[characterKey]?.[variant.toUpperCase()] ?? characterKey;
}