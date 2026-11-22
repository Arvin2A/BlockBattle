// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const BUTTON = { x: 968, y: 86, scale: 0.12 };

export function openAchievements(scene, { onClose = null } = {}) {
    if (scene.settingsPanel || scene.scene.isActive('AchievementsScene')) return;
    const release = () => {
        if (scene.settingsPanel === handle) scene.settingsPanel = null;
        scene.events.off('shutdown', handle.close);
    };
    const handle = {
        close: () => {
            release();
            scene.scene.stop('AchievementsScene');
        }
    };
    scene.settingsPanel = handle;
    scene.events.once('shutdown', handle.close);
    scene.sound.play('hover2');
    scene.scene.launch('AchievementsScene', {
        onClose: () => {
            release();
            onClose?.();
        }
    });
    scene.scene.bringToTop('AchievementsScene');
    if (scene.scene.isActive('AchievementToastScene')) scene.scene.bringToTop('AchievementToastScene');
}

export function setAchievementsButtonTint(scene, button, tint) {
    const grey = tint !== null && scene.textures.exists('achievementsButtonGrey');
    button.setTexture(grey ? 'achievementsButtonGrey' : 'achievementsButton');
    if (grey) button.setTint(tint);
    else button.clearTint();
    return button;
}

export function addAchievementsButton(scene, { x = BUTTON.x, y = BUTTON.y, scale = BUTTON.scale, depth = 3000, container = null, onPress = null } = {}) {
    const button = scene.add.image(x, y, 'achievementsButton')
        .setScale(scale)
        .setScrollFactor(0)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true });
    container?.add(button);
    const lift = () => button.setScale(scale);
    button.on('pointerdown', () => {
        button.setScale(scale * 0.92);
        (onPress ?? (() => openAchievements(scene)))();
    });
    button.on('pointerout', lift);
    scene.input.on('pointerup', lift);
    button.once('destroy', () => scene.input.off('pointerup', lift));
    return button;
}
