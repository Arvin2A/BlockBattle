function applyWeatherDamage(scene, amount) {
    Object.values(scene.gameState.players).forEach(player => {
        player.KBmultiplier += amount;
        player.flash();
    });
}

function startWeatherOverlay(scene, key) {
    const sprite = scene.add.sprite(500, 300, key)
        .setDisplaySize(1000, 600)
        .setDepth(10000)
        .setAlpha(0.72);
    scene.hud.add(sprite);
    sprite.play(key);

    const sound = scene.sound.add('storm', { volume: 0.80, loop: true });
    sound.play();
    return { sprite, sound };
}

function stopWeatherOverlay(state) {
    state.sprite.destroy();
    state.sound.stop();
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
    playerSpawns: [
        { x: 550, y: 855 },
        { x: 1300, y: 750 }
    ],
    tint: '#8d5c00',

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
        { x: 550, y: 788},
        { x: 1300, y: 788}
    ],
    tint: '#2b6335',

    hazard: {
        chance: 0.5,
        checkInterval: 5000,
        duration: 5000,
        start(scene) {
            const originalSpeeds = new Map();
            Object.values(scene.gameState.players).forEach(player => {
                originalSpeeds.set(player, player.baseMovementSpeed);
                player.baseMovementSpeed *= 0.5;
            });
            applyWeatherDamage(scene, 0.35);
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
const JUNGLE_MAP = {
    id: 'JUNGLE',
    name: 'JUNGLE ARENA',
    preview: 'jungle_preview',
    maxZoom: 0.8,
    background: 'jungle_background',
    groundVisual: 'jungle_betterground',
    groundVisualPosition: { x: 1000, y: 1250 },
    mainGround: {
        x: 1000,
        y: 830,
        texture: 'thickgroundhitbox',
        width: 660,
        height: 30,
        visible: false
    },
    platforms: [
        {
            x: 500,
            y: 690,
            texture: 'groundhitbox',
            width: 360,
            height: 0
        },
        {
            x: 1375,
            y: 490,
            texture: 'groundhitbox',
            width: 360,
            height: 0
        },
        {
            x: 600,
            y: 370,
            texture: 'groundhitbox',
            width: 360,
            height: 0
        },
        // Smaller middle platform over the main ground. The visual's surface
        // sits 585px above its centre at scale 1, so that offset scales too.
        {
            x: 1000,
            y: 670,
            texture: 'groundhitbox',
            width: 216,
            height: 0
        },
        {
            x: 1000,
            y: 525,
            texture: 'groundhitbox',
            width: 216,
            height: 0
        }
    ],
    platformVisuals: [
        { x: 500, y: 1275, texture: 'jungle_platform', scale: 1 },
        { x: 1375, y: 1075, texture: 'jungle_platform', scale: 1 },
        { x: 600, y: 955, texture: 'jungle_platform', scale: 1 },
        { x: 1000, y: 670 + 585 * 0.6, texture: 'jungle_platform', scale: 0.6 },
        { x: 1000, y: 525 + 585 * 0.6, texture: 'jungle_platform', scale: 0.6 }

    ],

    platformDepthOrder: [4, 3, 2, 1, 0, 'main'],
    playerSpawns: [
        { x: 750, y: 792},
        { x: 1300, y: 460}
    ],
    tint: '#2b4363',

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
