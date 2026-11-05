// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { DEFAULT_MAP } from './MapDefinitions.js';

export class Map {
    constructor(scene, definition = DEFAULT_MAP) {
        this.scene = scene;
        this.definition = definition;
        this.platforms = scene.physics.add.staticGroup();
        this.topPlatforms = scene.physics.add.staticGroup();
        this.createBackground();
        this.createGeometry();
        if (definition.infinite) this.createInfiniteParts();
    }

    createBackground() {
        const background = this.scene.add.image(1000, 600, this.definition.background);
        background.setDisplaySize(this.scene.scale.width * 2, this.scene.scale.height * 2);
        background.setDepth(-1);
        this.scene.objs.add(background);
        this.background = background;
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

        this.groundVisual = groundVisual;
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

    get infinite() {
        return Boolean(this.definition.infinite);
    }

    getRespawnX(scorer) {
        return this.infinite && scorer?.active ? scorer.x : 1000;
    }

    cloneBelow(source, count) {
        const objs = this.scene.objs;
        return Array.from({ length: count }, () => {
            const copy = this.scene.add.image(source.x, source.y, source.texture.key)
                .setDisplaySize(source.displayWidth, source.displayHeight)
                .setDepth(source.depth);
            objs.addAt(copy, objs.getIndex(source));
            return copy;
        });
    }

    createInfiniteParts() {
        const { scene, definition } = this;
        const extraGround = this.platforms.create(this.ground.x, this.ground.y, definition.mainGround.texture);
        extraGround.setDisplaySize(definition.mainGround.width, definition.mainGround.height);
        extraGround.setVisible(false);
        extraGround.refreshBody();
        scene.objs.add(extraGround);
        this.followGrounds = [this.ground, extraGround];
        this.backgroundTiles = [this.background, ...this.cloneBelow(this.background, 2)];
        this.bridgeTiles = [this.groundVisual, ...this.cloneBelow(this.groundVisual, 2)];
        this.markers = Array.from({ length: 3 }, () => {
            const marker = scene.add.text(0, this.definition.infinite.markerY, '', {
                fontFamily: 'VCROSD',
                fontSize: '22px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5, 1).setAlpha(0.8);
            scene.objs.add(marker);
            return marker;
        });
    }

    update() {
        if (!this.infinite) return;
        const settings = this.definition.infinite;
        const camera = this.scene.cameras.main;
        const centerX = camera.scrollX + camera.width / 2;
        const players = this.scene.gameState.players ?? {};
        [players.player, players.player2].forEach((player, index) => {
            const ground = this.followGrounds[index];
            if (!player?.active || !ground) return;
            if (Math.abs(player.x - ground.x) > settings.recenterDistance) {
                ground.x = player.x;
                ground.refreshBody();
            }
        });

        const origin = this.definition.groundVisualPosition.x;
        const isOdd = k => ((k % 2) + 2) % 2 === 1;
        const bridgeStart = Math.round((centerX - origin) / settings.segmentWidth) - 1;
        this.bridgeTiles.forEach((tile, index) => {
            const k = bridgeStart + index;
            tile.setX(origin + k * settings.segmentWidth).setFlipX(isOdd(k));
        });

        const backgroundWidth = this.background.displayWidth;
        const drift = centerX * settings.parallax;
        const backgroundStart = Math.round((centerX - drift - origin) / backgroundWidth) - 1;
        this.backgroundTiles.forEach((tile, index) => {
            const k = backgroundStart + index;
            tile.setX(drift + origin + k * backgroundWidth).setFlipX(isOdd(k));
        });

        const markerStart = Math.round((centerX - origin) / settings.markerSpacing) - 1;
        this.markers.forEach((marker, index) => {
            const k = markerStart + index;
            const blocks = Math.round(k * settings.markerSpacing / settings.blockSize);
            marker.setX(origin + k * settings.markerSpacing).setText(`${blocks} blocks`);
        });
    }
}
