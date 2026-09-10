export const DEFAULT_MAP = {
    background: 'background',
    groundVisual: 'betterground',
    groundVisualPosition: { x: 1000, y: 1385 },
    mainGround: {
        x: 1000,
        y: 875,
        texture: 'thickgroundhitbox',
        width: 1000,
        height: 0,
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
    playerSpawns: [
        { x: 550, y: 845 },
        { x: 1300, y: 740 }
    ]
};

export const SNOWY_MAP = {
    background: 'snowy_background',
    groundVisual: 'snowy_betterground',
    groundVisualPosition: { x: 1000, y: 1200 },
    mainGround: {
        x: 1000,
        y: 835,
        texture: 'thickgroundhitbox',
        width: 1750,
        height: 50,
        visible: false
    },
    platforms: [
        {
            x: 1000,
            y: 530,
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
        { x: 1000, y: 555, texture: 'snowplatform1', scale: 0.75 },
        { x: 1300, y: 575, texture: 'snowplatform2', scale: 0.75 }
    ],

    playerSpawns: [
        { x: 550, y: 760},
        { x: 1300, y: 760 }
    ]
};