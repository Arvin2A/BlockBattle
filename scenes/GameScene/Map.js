export const DEFAULT_MAP = {
    background: 'background',
    groundVisual: 'betterground',
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

export class Map {
    constructor(scene, definition = DEFAULT_MAP) {
        this.scene = scene;
        this.definition = definition;
        this.platforms = scene.physics.add.staticGroup();
        this.topPlatforms = scene.physics.add.staticGroup();
        this.createBackground();
        this.createGeometry();
    }

    createBackground() {
        const background = this.scene.add.image(1000, 600, this.definition.background);
        background.setDisplaySize(this.scene.scale.width * 2, this.scene.scale.height * 2);
        background.setDepth(-1);
        this.scene.objs.add(background);
    }

    createGeometry() {
        const { scene, definition } = this;
        const groundVisual = scene.add.image(1000, 1385, definition.groundVisual);
        groundVisual.setDisplaySize(scene.scale.width, 1200);
        groundVisual.setDepth(1);
        scene.objs.add(groundVisual);

        this.ground = this.platforms.create(
            definition.mainGround.x,
            definition.mainGround.y,
            definition.mainGround.texture
        );
        this.ground.setDisplaySize(definition.mainGround.width, definition.mainGround.height);
        this.ground.setVisible(definition.mainGround.visible);
        this.ground.refreshBody();
        scene.objs.add(this.ground);

        definition.platformVisuals.forEach(platformDefinition => {
            const platform = scene.add.image(
                platformDefinition.x,
                platformDefinition.y,
                platformDefinition.texture
            );
            platform.setScale(platformDefinition.scale);
            scene.objs.add(platform);
        });

        definition.platforms.forEach((platformDefinition, index) => {
            const platform = this.topPlatforms.create(
                platformDefinition.x,
                platformDefinition.y,
                platformDefinition.texture
            );
            platform.setDisplaySize(platformDefinition.width, platformDefinition.height);
            platform.setVisible(true);
            platform.refreshBody();
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;
            scene.objs.add(platform);
            this[`platform${index + 1}`] = platform;
        });
    }

    getSpawn(playerNumber) {
        return this.definition.playerSpawns[playerNumber - 1];
    }
}
