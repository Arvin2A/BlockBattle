// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { getEnabledCustomValues, modifierOptions } from './scenes/MapAndModifierSelect.js';

const MAX_FIGHTER_VELOCITY = 4294967295;
const MAP_CENTER_X = 1000;
import { getCharacterTexture } from './characterTextures.js';
import { hasIdleAttackSprite } from './attacks.js';
import { COLORS, FONTS } from './ui/theme.js';
import { MATCH_LIVES, PLAYER_COLORS } from './matchModes.js';
export function initiatePlayers(scene, matchSettings) {
    const players = matchSettings.players.map((entry, index) => {
        const spawn = scene.gameState.map.getSpawn(index + 1);
        const fighter = scene.physics.add.sprite(spawn.x, spawn.y, getCharacterTexture(entry.character, entry.variant));
        Object.assign(fighter, {
            variant: entry.variant,
            id: index + 1,
            slot: entry.slot,
            team: entry.team,
            color: entry.color,
            character: entry.character,
            lastDir: { x: spawn.x <= MAP_CENTER_X ? 1 : -1, y: 0 },
            icon: getCharacterTexture(entry.character, entry.variant),
            lives: MATCH_LIVES,
            eliminated: false,
            isCpu: Boolean(scene.simulationMode || (scene.botMode && index === 1))
        });
        return fighter;
    });
    for (const player of Object.values(players)) {
        const scaleX = Math.abs(player.scaleX) || 1;
        const { sourceWidth, sourceHeight, offset } = player.body;
        const offsetX = offset.x;
        const offsetY = offset.y;
        player.body.setSize(
            sourceWidth + 10 / scaleX,
            sourceHeight + 2 / Math.abs(player.scaleY),
            false
        );
        player.body.setOffset(
            offsetX - 5 / scaleX,
            offsetY - 1 / Math.abs(player.scaleY)
        );
    }
    
    for (const key in players) {
        //PLAYER VARIABLES.
        const p = players[key];
        p.setDepth(5);
        // Attack availability and combo state.
        Object.assign(p, {
            canAttack: true,
            isAttacking: false,
            cantAttackUntil: 0,
            nextAttackTime: 0,
            nextTiltTime: 0,
            combo: 0,
            comboTimer: 0,
            playerKBresistance: 1
        });

        // Hitstun, freeze, and grab state.
        Object.assign(p, {
            revokeAggressorStun: null,
            revokeVictimStun: null,
            revokeMowStun: null,
            activeGrab: null,
            grabbedBy: null,
            stunToken: 0,
            mowStunToken: 0,
            hitstunUntil: 0,
            freeze: false,
            freezeUntil: 0,
            freezeGravity: null,
            willDecelerate: true,
            hitstunGroundDeceleration: 0.98
        });
        // Always read straight from hitstunUntil, so a hit counts the moment it
        // lands. A cached flag let the victim swing back in the same frame (both
        // fighters stunned each other forever) and let old timers end a newer
        // stun early. Writing to it does nothing; set hitstunUntil instead.
        Object.defineProperty(p, 'hitstun', {
            get() { return scene.time.now < this.hitstunUntil; },
            set() { },
            configurable: true
        });

        // Arena tracking and damage state.
        Object.assign(p, {
            inGrass: false,
            grassTrailX: null,
            grassTrailY: null,
            grassCutCount: 0,
            nextGrassDamageTime: 0,
            woodCount: 0,
            woodCollectionLastTick: null,
            woodCollecting: false,
            plankGhost: null,
            outOfBounds: false,
            airTime: 0,
            downslamming: false,
            downslamFx: false,
            KBmultiplier: 1.00
        });
        if (modifierOptions.SUDDEN_DEATH.enabled) {
            p.KBmultiplier = 4.00;
        }
        p.lastKBmultiplier = 1.00;
        // Side-special and double-jump state.
        Object.assign(p, {
            nextSideSpecialTime: 0,
            sideSpecialCooldownDuration: 0,
            hasUsedSideSpecial: false,
            lastTap: { left: 0, right: 0 },
            isUsingSideSpecial: false,
            hasHitSideSpecial: false,
            // True while dashing through the other player (DAGGER's QUICKSTEP).
            clipThroughPlayers: false,
            hasDoubleJumped: false
        });
        p.currentPlatform = null;
        p.doubleJumpEffect = scene.add.image(
            p.x,
            p.y + 40, 'doublejump');
        scene.objs.add(p.doubleJumpEffect);
        p.doubleJumpEffect.setAlpha(0);
        if (scene.gameState.map.definition.id === 'SNOWY') {
            const w = p.displayWidth;
            const h = 8;
            const skew = 6;
            p.shadow = scene.add.graphics();
            p.shadow.fillStyle(0x000000, 0.4);
            p.shadow.fillPoints([
                { x: -w / 2 + skew, y: -h / 2 },
                { x: w / 2 + skew, y: -h / 2 },
                { x: w / 2 - skew, y: h / 2 },
                { x: -w / 2 - skew, y: h / 2 }
            ], true);
            p.shadow.setPosition(p.x, p.y + p.displayHeight / 2);
            scene.objs.add(p.shadow);
        }
        scene.objs.add(p);
        p.setDepth(2);
        if (p.variant === 'SLEDGEHAMMER') {
            p.rockslidingSound = scene.sound.add('rocksliding', { volume: 0.25, loop: true });
        }
        // Input history, attack positioning, and afterimage state.
        Object.assign(p, {
            afterimage: false,
            afterimageTimer: 0,
            lastInput: {
                left: 0,
                right: 0,
                up: 0,
                down: 0
            },
            atkXOffset: 45,
            atkYOffset: 50,
            lastAttackTime: 0
        });
        p.flashObject = scene.add.rectangle(p.x, p.y, 50, 50, 0xffffff);
        p.flashObject.setAlpha(0);
        p.flashObject.setDepth(9999);
        scene.objs.add(p.flashObject);
        p.flash = function() {
            scene.tweens.killTweensOf(p.flashObject);
            p.flashObject.setAlpha(0.5);

            scene.tweens.add({
                targets: p.flashObject,
                alpha: 0,
                duration: 200
            });
        }
        // Temporary effects applied by attacks.
        Object.assign(p, {
            plunged: false,
            lastPlungeTick: 0,
            chopped: false,
            choppedUntil: 0,
            netted: false,
            nettedUntil: 0
        });
        p.choppedMark = scene.add.image(p.x, p.y, 'chopped');
        p.choppedMark.visible = false;
        scene.objs.add(p.choppedMark);
        p.nettedMark = scene.add.image(p.x, p.y, 'netted');
        p.nettedMark.visible = false;
        scene.objs.add(p.nettedMark);

        p.plungeMark;

        // Base movement, damage, and ability tuning.
        Object.assign(p, {
            playerSpeedScaling: 1,
            baseMovementSpeed: 300,
            baseDamageScale: 1,
            externalDamageScale: 1,
            dirSpecialCooldown: 3500
        });
        const unmodifiedSpeed = p.baseMovementSpeed;
        if (modifierOptions.SLUGGISH.enabled) {
            p.baseMovementSpeed -= 150;
        }
        if (modifierOptions.SUPER_SLUGGISH.enabled) {
            p.baseMovementSpeed = 75;
        }
        if (modifierOptions.FAST.enabled) {
            p.baseMovementSpeed += 300;
            p.dirSpecialCooldown = 1750;
        }
        for (const percent of getEnabledCustomValues('speed')) {
            p.baseMovementSpeed += unmodifiedSpeed * percent / 100;
        }
        p.noAbilityCooldown = modifierOptions.NO_ABILITY_COOLDOWN.enabled;
        if (p.noAbilityCooldown) {
            p.dirSpecialCooldown = 0;
        }
        p.body.setMaxVelocity(MAX_FIGHTER_VELOCITY, MAX_FIGHTER_VELOCITY);
        p.keepsMomentum = modifierOptions.NO_GRAVITY_FRICTION.enabled;
        if (p.keepsMomentum) {
            Object.defineProperty(p, 'willDecelerate', {
                get() { return false; },
                set() { },
                configurable: true
            });
        }
        if (p.variant === 'SLEDGEHAMMER') {
            p.baseMovementSpeed = p.baseMovementSpeed/2;
        }
        p.movementSpeed = p.baseMovementSpeed * p.playerSpeedScaling;


        
        if (modifierOptions.DOUBLE_DAMAGE.enabled) {
            p.externalDamageScale = 2;
        }
        for (const scale of getEnabledCustomValues('damage')) {
            p.externalDamageScale *= scale;
        }

        p.plungeAura = scene.add.image(p.x, p.y, 'plungedAura');
        p.plungeAura.visible = false;
        p.isBot = false;

        p.chainsawSFX = scene.sound.add('chainsaw', { volume: 1, loop: true });
        scene.objs.add(p.plungeAura);
    }
    

    players.forEach((player, index) => {
        const x = players.length === 2 ? [400, 600][index] : (index + 1) * 1000 / (players.length + 1);
        player.winText = scene.add.text(x, 300, '', {
            fontFamily: 'VCROSD',
            fontSize: '48px',
            fill: '#FFFFFF'
        }).setOrigin(0.5).setStroke('#000000', 4).setVisible(false);
        scene.hud.add(player.winText);
        player.name = player.character.toUpperCase();
    });

    for (const player of Object.values(players)) {
        if (player.name === 'SLATEMAN') {
            player.playerKBresistance = 2;
            player.slateTrail = scene.add.particles(player.x, player.y, '__WHITE', {
                // Spawn spread out, get flung upward, then gravity pulls them
                // back down so each particle traces a parabola.
                x: { min: -12, max: 12 },
                y: { min: -8, max: 8 },
                speed: { min: 80, max: 160 },
                angle: { min: 235, max: 305 },
                gravityY: 600,
                scale: { start: 1.5, end: 0 },
                alpha: { start: 0.8, end: 0 },
                tint: 0x8a8a8a,
                lifespan: 700,
                frequency: 40,
                quantity: 1,
                emitting: false
            });
            // Inserted below the player so the trail renders behind them.
            scene.objs.addAt(player.slateTrail, scene.objs.getIndex(player));
        } else if (player.name === 'HAMMERMAN' && player.variant === 'SLEDGEHAMMER') {
            player.playerKBresistance = 1.5;
        }
    }

    for (const key in players) {
        const p = players[key];
        if (p.variant === 'SLEDGEHAMMER') {
            p.atk = scene.add.sprite(p.x, p.y, 'sledge_idle');
        } else if (p.name === 'AXEMAN' && p.variant === 'CHAINSAW') {
            p.chainsawMode = true;
            p.atk = scene.add.sprite(p.x, p.y, 'inactivechainsaw');
        } else if (p.name === "SWORDMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'swordatk'
            );
        } else if (p.name === "AXEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'axeatk'
            );
        } else if (p.name === "FISHERMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                p.variant === 'TRAPPER' ? 'harpoonatk' : 'rodatk'
            );
            if (p.variant !== 'TRAPPER') p.atk.setScale(0.6);
        } else if (p.name == "SCYTHEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'scytheatk'
            );
        } else if (p.name == "HAMMERMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                p.variant === 'SLEDGEHAMMER' ? 'sledgehammeratk' : 'hammeratk'
            );
            if (p.variant !== 'SLEDGEHAMMER') p.atk.setScale(0.75);
        } else if (p.name == "SLATEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'slateatk1'
            );
        } else if (p.name === "CROWBARMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'crowbargrab'
            );
        } else if (p.name === "GUNMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'gunmanatk'
            );
        } else {
            //fallback to axe sprite
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'axeatk'
            );
        }
        scene.objs.add(p.atk);
    }

    for (const player of players) {
        const label = scene.simulationMode ? `CPU ${player.id}` : player.isCpu ? 'CPU' : player.slot.toUpperCase();
        const fill = player.isCpu ? COLORS.cpu : PLAYER_COLORS[player.color].css;
        player.header = scene.add.text(player.x, player.y - 50, label, { fontFamily: FONTS.title, fontSize: '18px', fill });
        scene.objs.add(player.header);
        player.atk.setVisible(
            hasIdleAttackSprite(player) ||
            (player.name === 'AXEMAN' && player.variant === 'CHAINSAW')
        );
    }

    for (const key in players) {
        const player = players[key];
        if (player.name === 'AXEMAN' && player.variant === 'CHAINSAW') {
            const switchKey = player.id === 1 ? 'LEFT ALT' : 'RIGHT ALT';
            const isLeftSide = player.id % 2 === 1;
            const iconX = isLeftSide ? 34 : 966;
            const labelX = isLeftSide ? 60 : 940;
            const hintY = 300 + Math.floor((player.id - 1) / 2) * 44;
            player.modeSwitchIcon = scene.add.sprite(
                iconX,
                hintY,
                'inactivechainsaw'
            ).setFrame(0).setScale(0.7).setScrollFactor(0);
            player.modeSwitchText = scene.add.text(
                labelX,
                hintY,
                `${switchKey} to switch`,
                { fontFamily: 'GameFont', fontSize: '12px', fill: '#ffffff' }
            ).setOrigin(isLeftSide ? 0 : 1, 0.5)
                .setStroke('#000000', 3)
                .setScrollFactor(0);
            player.woodText = scene.add.text(
                player.x,
                player.y - 75,
                `Wood: ${player.woodCount} ft³`,
                { fontFamily: 'GameFont', fontSize: '14px', fill: '#ffffff' }
            ).setOrigin(0.5).setStroke('#000000', 3);
            player.woodCollectSprite = scene.add.sprite(
                player.atk.x,
                player.atk.y,
                'woodcollect'
            ).setDepth(4).setVisible(false);
            player.plankGhost = scene.add.image(player.x, player.y, 'plank')
                .setOrigin(0.5)
                .setTint(0x000080)
                .setAlpha(0.45)
                .setDepth(2)
                .setVisible(false);
            scene.objs.add(player.woodText);
            scene.objs.add(player.woodCollectSprite);
            scene.objs.add(player.plankGhost);
            scene.hud.add(player.modeSwitchIcon);
            scene.hud.add(player.modeSwitchText);
        }
        if (player.name === 'SCYTHEMAN') {
            player.grassCutText = scene.add.text(
                player.x,
                player.y - 75,
                `Grass cuts: ${player.grassCutCount}`,
                { fontFamily: 'GameFont', fontSize: '14px', fill: '#ffffff' }
            ).setOrigin(0.5).setStroke('#000000', 3);
            scene.objs.add(player.grassCutText);
        }
    }

    const bots = players.filter(player => player.isCpu);
    for (const bot of bots) {
        bot.lastJump = 0;
        bot.lastAttack = 0;
        bot.lastDirSpecial = 0;
        bot.isBot = true;
    }

    
    return players;
}

export function updateCombo(player, dt) {
    if (player.name === 'GUNMAN') return;
    if (player.combo > 0) {
        player.comboTimer -= dt;
        if (player.comboTimer <= 0) {
            player.combo = 0;
            player.comboTimer = 0;
        }
    }
}
