import { modifierOptions } from './scenes/MapAndModifierSelect.js';
export function initiatePlayers(scene, p1Select = 'axeman', p2Select = 'swordman', p1Variant = '', p2Variant = '') {
    const isSledgehammer = (character, variant) =>
        character.toUpperCase() === 'HAMMERMAN' && variant === 'SLEDGEHAMMER';
    const getPlayerTexture = (character, variant) =>
        isSledgehammer(character, variant)
            ? 'sledgehammerman'
            : character;
    const players = {
        player: null,
        player2: null
    };
    const p1Spawn = scene.gameState.map.getSpawn(1);
    const p2Spawn = scene.gameState.map.getSpawn(2);
    players.player = scene.physics.add.sprite(p1Spawn.x, p1Spawn.y, getPlayerTexture(p1Select, p1Variant));
    players.player2 = scene.physics.add.sprite(p2Spawn.x, p2Spawn.y, getPlayerTexture(p2Select, p2Variant));
    players.player.variant = p1Variant;
    players.player2.variant = p2Variant;
    players.player.id = 1;
    players.player2.id = 2;
    players.player.lastDir = { x: 1, y: 0 };
    players.player2.lastDir = { x: -1, y: 0 };
    
    for (const key in players) {
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
            hitstun: false,
            hitstunUntil: 0,
            freeze: false,
            freezeUntil: 0,
            willDecelerate: true,
            hitstunGroundDeceleration: 0.98
        });

        // Arena tracking and damage state.
        Object.assign(p, {
            inGrass: false,
            grassTrailX: null,
            grassTrailY: null,
            grassCutCount: 0,
            nextGrassDamageTime: 0,
            winNumber: 0,
            outOfBounds: false,
            airTime: 0,
            downslamming: false,
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
            hasDoubleJumped: false
        });
        p.doubleJumpEffect = scene.add.image(
            p.x,
            p.y + 40, 'doublejump');
        scene.objs.add(p.doubleJumpEffect);
        p.doubleJumpEffect.setAlpha(0);
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
            choppedUntil: 0
        });
        p.choppedMark = scene.add.image(p.x, p.y, 'chopped');
        p.choppedMark.visible = false;
        scene.objs.add(p.choppedMark);

        p.plungeMark;

        // Base movement, damage, and ability tuning.
        Object.assign(p, {
            playerSpeedScaling: 1,
            baseMovementSpeed: 300,
            baseDamageScale: 1,
            externalDamageScale: 1,
            dirSpecialCooldown: 3500
        });
        if (modifierOptions.SLUGGISH.enabled) {
            p.baseMovementSpeed -= 150;
        } 
        if (modifierOptions.SUPER_SLUGGISH.enabled) {
            p.baseMovementSpeed = 75;
        } 
        if (modifierOptions.FAST.enabled) {
            p.baseMovementSpeed += 150;
        }
        if (modifierOptions.HYPERACTIVE.enabled) {
            p.baseMovementSpeed += 300;
        }
        if (modifierOptions.HYPERACTIVE.enabled) {
            p.dirSpecialCooldown = 1750;
        }
        if (modifierOptions.NO_ABILITY_COOLDOWN.enabled) {
            p.dirSpecialCooldown = 0;
        }
        if (p.variant === 'SLEDGEHAMMER') {
            p.baseMovementSpeed = p.baseMovementSpeed/2;
        }
        p.movementSpeed = p.baseMovementSpeed * p.playerSpeedScaling;


        
        if (modifierOptions.DOUBLE_DAMAGE.enabled) {
            p.externalDamageScale = 2;
        }

        p.plungeAura = scene.add.image(p.x, p.y, 'plungedAura');
        p.plungeAura.visible = false;
        p.isBot = false;
        scene.objs.add(p.plungeAura);
    }
    

    players.player.winText = scene.add.text(400, 300, '', {
        fontFamily: 'VCROSD',
        fontSize: '48px',
        fill: '#FFFFFF'
    }).setOrigin(0.5).setStroke('#000000', 4).setVisible(false);

    players.player2.winText = scene.add.text(600, 300, '', {
        fontFamily: 'VCROSD',
        fontSize: '48px',
        fill: '#FFFFFF'
    }).setOrigin(0.5).setStroke('#000000', 4).setVisible(false);
    scene.hud.add(players.player.winText);
    scene.hud.add(players.player2.winText);
    players.player.name = p1Select.toUpperCase();
    players.player2.name = p2Select.toUpperCase();

    for (const player of Object.values(players)) {
        if (player.name === 'SLATEMAN') {
            player.playerKBresistance = 2;
        } else if (player.name === 'HAMMERMAN' && player.variant === 'SLEDGEHAMMER') {
            player.playerKBresistance = 1.5;
        }
    }

    players.player.icon = getPlayerTexture(p1Select, p1Variant);
    players.player2.icon = getPlayerTexture(p2Select, p2Variant);

    for (const key in players) {
        const p = players[key];
        if (p.variant === 'SLEDGEHAMMER') {
            p.atk = scene.add.sprite(p.x, p.y, 'sledge_idle');
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
                'rodatk'
            );
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
        } else if (p.name == "SLATEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'slateatk'
            );
            p.KBmultiplier = 0.70;
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

    players.player.header = scene.add.text(players.player.x, players.player.y - 50, "P1" ,{ fontFamily: 'GameFont', fontSize: '18px', fill: '#ff4343' });
    players.player2.header = scene.add.text(players.player2.x, players.player2.y - 50, scene.botMode ? 'CPU' : 'P2' ,{ fontFamily: 'GameFont', fontSize: '18px', fill: '#0051ff' });
    scene.objs.add(players.player.header);
    scene.objs.add(players.player2.header);

    players.player.atk.setVisible(players.player.variant === 'SLEDGEHAMMER');
    players.player2.atk.setVisible(players.player2.variant === 'SLEDGEHAMMER');

    for (const key in players) {
        const player = players[key];
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

    if (scene.botMode) {
        players.player2.lastJump = 0;
        players.player2.lastAttack = 0;
        players.player2.lastDirSpecial = 0;
        players.player2.isBot = true;
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
