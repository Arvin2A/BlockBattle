// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { DEFAULT_MAP, INFINITE_SPAN } from './MapDefinitions.js';
import { getMapEvent } from './mapEvents.js';

export class Map {
    constructor(scene, definition = DEFAULT_MAP) {
        this.scene = scene;
        this.definition = definition;
        this.platforms = scene.physics.add.staticGroup();
        this.topPlatforms = scene.physics.add.staticGroup();
        this.createBackground();
        this.createGeometry();
        this.createLighting();
        if (definition.infinite) this.createInfiniteParts();
        getMapEvent(definition.mapEvent)?.setup?.(scene, this);
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
            if (platformDefinition.bottom !== undefined) {
                const top = platformDefinition.y - platform.height * platformDefinition.scale / 2;
                platform.setCrop(0, 0, platform.width, (platformDefinition.bottom - top) / platformDefinition.scale);
            }
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
        this.pryables = definition.platformVisuals
            .map((platformDefinition, index) => ({
                visual: visuals[index],
                platform: this[`platform${index + 1}`],
                bottom: platformDefinition.bottom ?? null,
                pried: false
            }))
            .filter(pryable => pryable.visual && pryable.platform);
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

    createLighting() {
        this.lightLevel = 1;
        const lighting = this.definition.lighting;
        if (!lighting) return;
        const { scene } = this;
        const { source } = lighting;
        const beam = (x, make) => {
            const dx = x - source.x;
            const dy = lighting.rayEndY - source.y;
            const object = make(Math.hypot(dx, dy))
                .setOrigin(0.5, 0)
                .setRotation(Math.atan2(dy, dx) - Math.PI / 2);
            scene.objs.add(object);
            return object;
        };
        const platformShadow = lighting.platformShadow;
        if (platformShadow) {
            const bands = [
                ...this.definition.platformVisuals.map(visual => ({ x: visual.x, ...visual.shadow })),
                { x: this.definition.groundVisualPosition.x, ...this.definition.groundShadow }
            ].filter(band => band.width);
            this.platformShadows = bands.map(band => {
                const half = band.width / 2;
                const shadow = scene.add.graphics({ x: band.x, y: band.y });
                shadow.fillStyle(lighting.shadowColor, platformShadow.alpha);
                shadow.fillPoints([
                    { x: -half, y: 0 },
                    { x: half, y: 0 },
                    { x: half - platformShadow.skew, y: band.height },
                    { x: -half - platformShadow.skew, y: band.height }
                ], true);
                scene.objs.add(shadow);
                return shadow;
            });
        }
        this.castShadows = (lighting.shadows ?? []).map(shadow => beam(shadow.x, length =>
            scene.add.rectangle(source.x, source.y, shadow.width, length, lighting.shadowColor, shadow.alpha)));
        this.lightRays = (lighting.rays ?? []).map((ray, index) => {
            const image = beam(ray.x, length => scene.add.image(source.x, source.y, lighting.rayTexture)
                .setDisplaySize(ray.width, length)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setTint(lighting.rayTint)
                .setAlpha(ray.alpha));
            image.baseAlpha = ray.alpha;
            image.pulse = 1;
            scene.tweens.add({
                targets: image,
                pulse: 0.4,
                duration: 2400 + index * 650,
                delay: index * 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                onUpdate: () => this.applyRayAlpha(image)
            });
            return image;
        });
    }

    applyRayAlpha(image) {
        image.setAlpha(image.baseAlpha * image.pulse * this.lightLevel);
    }

    applyLightLevel() {
        this.lightRays?.forEach(image => this.applyRayAlpha(image));
        this.castShadows?.forEach(shadow => shadow.setAlpha(this.lightLevel));
    }

    fadeLighting(level, duration) {
        if (!this.lightRays?.length && !this.castShadows?.length) return;
        this.lightingTween?.remove();
        this.lightingTween = this.scene.tweens.addCounter({
            from: this.lightLevel,
            to: level,
            duration,
            onUpdate: tween => {
                this.lightLevel = tween.getValue();
                this.applyLightLevel();
            }
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
        const { scene } = this;
        this.ground.body.setSize(INFINITE_SPAN * 2, this.ground.body.height);
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
