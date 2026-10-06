export const CHARACTER_VARIANT_TEXTURES = {
    axeman: {
        LUMBERER: 'axeman',
        CHAINSAW: 'chainsawman'
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