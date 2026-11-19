// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { encaseInIce } from './blizzardIce.js';

export const INFINITE_SPAN = 268435455;

function applyWeatherDamage(scene, amount) {
    Object.values(scene.gameState.players).forEach(player => {
        player.KBmultiplier += amount;
        player.flash();
    });
}

function addWeatherSprite(scene, key, alpha = 0.72) {
    const sprite = scene.add.sprite(500, 300, key)
        .setDisplaySize(1000, 600)
        .setDepth(10000)
        .setAlpha(alpha);
    scene.hud.add(sprite);
    sprite.play(key);
    return sprite;
}

function startWeatherOverlay(scene, key) {
    const sprite = addWeatherSprite(scene, key);
    const sound = scene.sound.add('storm', { volume: 0.80, loop: true });
    sound.play();
    return { sprite, sound };
}

function stopWeatherOverlay(state) {
    state.sprite.destroy();
    state.sound.stop();
}

const RAINSTORM = {
    alpha: 0.6,
    volume: 0.8,
    fadeOutMs: 600,
    lightFadeMs: 1500,
    playerEffects: { tint: 0xb3e0ff, speedScale: 0.8, damageScale: 0.5, traction: 0.4 },
    flytrapScale: 2
};

function startRainstorm(scene) {
    const sprite = addWeatherSprite(scene, 'rainstorm', 0);
    scene.tweens.add({ targets: sprite, alpha: RAINSTORM.alpha, duration: 1000 });
    scene.gameState.map.fadeLighting(0, RAINSTORM.lightFadeMs);
    const fadeIn = scene.sound.add('rainfadein', { volume: RAINSTORM.volume });
    const loop = scene.sound.add('rainloop', { volume: RAINSTORM.volume, loop: true });
    fadeIn.play();
    const loopTimer = scene.time.delayedCall(fadeIn.duration * 1000, () => loop.play());
    return {
        sprite,
        fadeIn,
        loop,
        loopTimer,
        playerEffects: RAINSTORM.playerEffects,
        flytrapScale: RAINSTORM.flytrapScale
    };
}

function stopRainstorm(scene, state) {
    state.loopTimer.remove();
    state.fadeIn.stop();
    state.fadeIn.destroy();
    const { sprite, loop } = state;
    scene.tweens.add({ targets: sprite, alpha: 0, duration: RAINSTORM.fadeOutMs, onComplete: () => sprite.destroy() });
    scene.gameState.map.fadeLighting(1, RAINSTORM.lightFadeMs);
    scene.tweens.addCounter({
        from: loop.volume,
        to: 0,
        duration: RAINSTORM.fadeOutMs,
        onUpdate: tween => loop.setVolume(tween.getValue()),
        onComplete: () => {
            loop.stop();
            loop.destroy();
        }
    });
}

const DESERT_MAP = {
    id: 'DESERT',
    name: 'DESERT ARENA',
    preview: 'desertpreview',
    maxZoom: 1.4,
    background: 'background',
    groundVisual: 'betterground',
    groundVisualPosition: { x: 1000, y: 1385 },
    mainGround: {
        x: 1000,
        y: 880,
        texture: 'thickgroundhitbox',
        width: 1000,
        height: 10,
        visible: false
    },
    platforms: [
        {
            x: 1225,
            y: 770,
            texture: 'groundhitbox',
            width: 500,
            height: 0
        },
        {
            x: 775,
            y: 637,
            texture: 'groundhitbox',
            width: 500,
            height: 0
        }
    ],
    platformVisuals: [
        { x: 1225, y: 725, texture: 'platform1', scale: 0.5 },
        { x: 775, y: 725, texture: 'platform', scale: 0.5 }
    ],
    platformDepthOrder: ['main', 0, 1],
    // Fighters start just above where they come to rest (a 52px body: feet at
    // y + 27). Starting inside the floor can drop a fighter straight through it.
    playerSpawns: [
        { x: 550, y: 847 },
        { x: 1300, y: 742 },
        { x: 775, y: 609 },
        { x: 1200, y: 847 }
    ],
    tint: '#8d5c00',
    mapEvent: 'DESERT_HEAT_RAY',

    hazard: {
        chance: 0.5,
        checkInterval: 5000,
        duration: 5000,
        start(scene) {
            return {
                ...startWeatherOverlay(scene, 'sandstorm'),
                nextDamageAt: scene.time.now + 1000
            };
        },
        update(scene, state, now) {
            Object.values(scene.gameState.players).forEach(player => {
                const resisting = scene.playerInputs[player.id === 1 ? 'p1' : 'p2'].right;
                const pushStrength = resisting ? 3 : 8;
                player.setVelocityX(player.body.velocity.x - pushStrength);
            });

            if (now >= state.nextDamageAt) {
                applyWeatherDamage(scene, 0.10);
                state.nextDamageAt += 1000;
            }
        },
        end(scene, state) {
            stopWeatherOverlay(state);
        }
    }
};

const SNOWY_MAP = {
    id: 'SNOWY',
    name: 'SNOWY ARENA',
    preview: 'snowypreview',
    maxZoom: 0.8,
    background: 'snowy_background',
    groundVisual: 'snowy_betterground',
    groundVisualPosition: { x: 1000, y: 1200 },
    mainGround: {
        x: 1000,
        y: 835,
        texture: 'thickgroundhitbox',
        width: 1750,
        height: 55,
        visible: false
    },
    platforms: [
        {
            x: 1000,
            y: 550,
            texture: 'groundhitbox',
            width: 520,
            height: 0
        },
        {
            x: 1300,
            y: 660,
            texture: 'groundhitbox',
            width: 520,
            height: 0
        }
    ],
    platformVisuals: [
        { x: 1000, y: 575, texture: 'snowplatform1', scale: 0.75 },
        { x: 1300, y: 575, texture: 'snowplatform2', scale: 0.75 }
    ],

    platformDepthOrder: ['main', 0, 1],
    playerSpawns: [
        { x: 550, y: 780 },
        { x: 1300, y: 780 },
        { x: 1000, y: 522 },
        { x: 925, y: 780 }
    ],
    tint: '#2b6335',
    buttonTint: 0x3a6190,
    playerShadow: { skew: 6, alpha: 0.4 },
    mapEvent: 'SNOWY_CANNON',

    hazard: {
        chance: 0.5,
        checkInterval: 5000,
        duration: 5000,
        start(scene) {
            const originalSpeeds = new Map();
            Object.values(scene.gameState.players).forEach(player => {
                originalSpeeds.set(player, player.baseMovementSpeed);
                player.baseMovementSpeed *= 0.75;
            });
            applyWeatherDamage(scene, 0.35);
            Object.values(scene.gameState.players).forEach(player => encaseInIce(scene, player));
            return { ...startWeatherOverlay(scene, 'blizzard'), originalSpeeds };
        },
        end(scene, state) {
            state.originalSpeeds.forEach((speed, player) => {
                player.baseMovementSpeed = speed;
            });
            stopWeatherOverlay(state);
        }
    }
};
const JUNGLE_TOWER_SURFACE = 585;
const JUNGLE_TOWER_WIDTH = 360;

const JUNGLE_TOWER_BAR = { below: 21, height: 30, width: 350 };
const JUNGLE_TOWER_ART_SHIFT = -4.5;

function jungleTowerTop(x, top, scale) {
    return { x, y: top, texture: 'groundhitbox', width: JUNGLE_TOWER_WIDTH * scale, height: 0 };
}

function jungleTower(x, top, scale, bottom) {
    return {
        x: x + JUNGLE_TOWER_ART_SHIFT * scale,
        y: top + JUNGLE_TOWER_SURFACE * scale,
        texture: 'jungle_platform',
        scale,
        bottom,
        shadow: {
            y: top + JUNGLE_TOWER_BAR.below * scale,
            width: JUNGLE_TOWER_BAR.width * scale,
            height: JUNGLE_TOWER_BAR.height * scale
        }
    };
}

const JUNGLE_MAP = {
    id: 'JUNGLE',
    name: 'JUNGLE ARENA',
    preview: 'jungle_preview',
    maxZoom: 0.8,
    background: 'jungle_background',
    groundVisual: 'jungle_betterground',
    groundVisualPosition: { x: 991.5, y: 1326.5 },
    groundShadow: { y: 845, width: 600, height: 34 },
    mainGround: {
        x: 1000,
        y: 830,
        texture: 'thickgroundhitbox',
        width: 660,
        height: 30,
        visible: false
    },
    platforms: [
        jungleTowerTop(470, 690, 0.8),
        jungleTowerTop(1530, 600, 0.8),
        jungleTowerTop(1000, 665, 0.6),
        jungleTowerTop(470, 545, 0.55),
        jungleTowerTop(1530, 450, 0.55)
    ],
    platformVisuals: [
        jungleTower(470, 690, 0.8),
        jungleTower(1530, 600, 0.8),
        jungleTower(1000, 665, 0.6, 812),
        jungleTower(470, 545, 0.55, 694),
        jungleTower(1530, 450, 0.55, 604)
    ],
    platformDepthOrder: [2, 3, 4, 0, 1, 'main'],
    playerSpawns: [
        { x: 800, y: 787 },
        { x: 1200, y: 787 },
        { x: 470, y: 662 },
        { x: 1530, y: 572 }
    ],
    lighting: {
        source: { x: 1250, y: -150 },
        rayTexture: 'jungle_ray',
        rayTint: 0xfff1b8,
        rayEndY: 1700,
        rays: [
            { x: 560, width: 150, alpha: 0.32 },
            { x: 760, width: 110, alpha: 0.4 },
            { x: 930, width: 190, alpha: 0.26 },
            { x: 1120, width: 90, alpha: 0.44 },
            { x: 1330, width: 140, alpha: 0.3 }
        ],
        shadowColor: 0x0a1a0c,
        platformShadow: { alpha: 0.38, skew: 10 },
        shadows: [
            { x: 450, width: 90, alpha: 0.32 },
            { x: 665, width: 60, alpha: 0.3 },
            { x: 845, width: 50, alpha: 0.34 },
            { x: 1025, width: 70, alpha: 0.3 },
            { x: 1225, width: 80, alpha: 0.28 },
            { x: 1500, width: 120, alpha: 0.34 }
        ]
    },
    playerShadow: { skew: 6, alpha: 0.4 },
    tint: '#2b4363',
    buttonTint: 0x40924e,
    mapEvent: 'JUNGLE_FLYTRAP',

    hazard: {
        chance: 0.5,
        checkInterval: 5000,
        duration: 5000,
        start: startRainstorm,
        end: stopRainstorm
    }
};

const BRIDGE_MAP = {
    id: 'BRIDGE',
    name: 'INFINITE BRIDGE',
    preview: 'snowypreview',
    maxZoom: 0.8,
    background: 'snowy_background',
    groundVisual: 'snowy_betterground',
    groundVisualPosition: { x: 1000, y: 1200 },
    mainGround: {
        x: 1000,
        y: 835,
        texture: 'thickgroundhitbox',
        width: 6000,
        height: 55,
        visible: false
    },
    platforms: [],
    platformVisuals: [],
    platformDepthOrder: ['main'],
    playerSpawns: [
        { x: 550, y: 780 },
        { x: 1300, y: 780 }
    ],
    tint: '#2b6335',
    buttonTint: 0xd9d9d9,
    infinite: {
        segmentWidth: 1730,
        parallax: 0.9,
        markerSpacing: 2500,
        blockSize: 50,
        markerY: 760
    }
};

export const SECRET_MAPS = {
    BRIDGE: BRIDGE_MAP
};

export const MAPS = {
    DESERT: DESERT_MAP,
    SNOWY: SNOWY_MAP,
    JUNGLE: JUNGLE_MAP
};

export const MAP_LIST = Object.values(MAPS);
export const DEFAULT_MAP = MAPS.DESERT;

export function getMap(id) {
    return MAPS[id] ?? DEFAULT_MAP;
}

export function getRandomMap() {
    return MAP_LIST[Math.floor(Math.random() * MAP_LIST.length)];
}
