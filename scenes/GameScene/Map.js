import { DEFAULT_MAP } from './MapDefinitions.js';

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
        const groundVisual = scene.add.image(
            definition.groundVisualPosition.x,
            definition.groundVisualPosition.y,
            definition.groundVisual
        );
        groundVisual.setDisplaySize(groundVisual.width, 1200);

        this.ground = this.platforms.create(
            definition.mainGround.x,
            definition.mainGround.y,
            definition.mainGround.texture
        );
        this.ground.setDisplaySize(definition.mainGround.width, definition.mainGround.height);
        this.ground.setVisible(definition.mainGround.visible);
        this.ground.refreshBody();
        scene.objs.add(this.ground);

        const visuals = { main: groundVisual };
        definition.platformVisuals.forEach((platformDefinition, index) => {
            const platform = scene.add.image(
                platformDefinition.x,
                platformDefinition.y,
                platformDefinition.texture
            );
            platform.setScale(platformDefinition.scale);
            visuals[index] = platform;
            if (platformDefinition.name) visuals[platformDefinition.name] = platform;
        });
        this.addVisualsInDepthOrder(visuals);

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

    addVisualsInDepthOrder(visuals) {
        const all = [...new Set(Object.values(visuals))];
        const ordered = [...new Set((this.definition.platformDepthOrder ?? [])
            .map(key => visuals[key])
            .filter(Boolean))];
        const remaining = all.filter(visual => !ordered.includes(visual));
        [...ordered, ...remaining].forEach((visual, index) => {
            visual.setDepth(index + 1);
            this.scene.objs.add(visual);
        });
    }

    getSpawn(playerNumber) {
        return this.definition.playerSpawns[playerNumber - 1];
    }
}
