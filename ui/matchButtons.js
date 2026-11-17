// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const GREY_TEXTURES = {
    resumeBtn: 'resumeBtnGrey',
    restartBtn: 'restartBtnGrey',
    restartBtnPressed: 'restartBtnPressedGrey',
    gohomeBtn: 'gohomeBtnGrey',
    gohomeBtnPressed: 'gohomeBtnPressedGrey',
    settingsBtn: 'settingsBtnGrey',
    pressedSettingsBtn: 'pressedSettingsBtnGrey',
    characterInfoBtn: 'characterInfoBtnGrey'
};

export function getButtonTint(scene) {
    return scene.gameState?.map?.definition?.buttonTint ?? null;
}

export function buttonTexture(scene, key) {
    const tint = getButtonTint(scene);
    const grey = GREY_TEXTURES[key];
    return tint !== null && grey && scene.textures.exists(grey) ? grey : key;
}

export function skinButton(scene, image) {
    const tint = getButtonTint(scene);
    image.setTexture(buttonTexture(scene, image.texture.key));
    if (tint !== null) image.setTint(tint);
    return image;
}
