import Phaser from 'phaser';
import {handleAttack, handleDirSpecial, handleDirSpecialAttack, handleHorizantalTilt, handleDownTilt, handleUpTilt, downslamAttack, updateScythemanGrass, updateChainsawWood, toggleChainsawMode, tryQuickslamJump, positionAttackSprite} from './attacks.js';
import { initiatePlayers, updateCombo } from './players.js';
import { Commands, executeStateCommand} from './commands.js';
import { MenuScene } from './scenes/MenuScene.js';
import { player1Character, player2Character, player1Variant, player2Variant, CharacterSelectScene } from './scenes/CharacterSelectScreen.js';
import { MapAndModifierSelectScene, selectedMapDefinition, resetMapAndModifierSelection } from './scenes/MapAndModifierSelect.js';
import { preload } from './scenes/GameScene/preload.js';
import { createGameAnimations } from './scenes/GameScene/animations.js';
import { runBotAI } from './scenes/GameScene/botAI.js';
import { DEFAULT_MAP, Map, SNOWY_MAP } from './scenes/GameScene/Map.js';
import { modifierOptions } from './scenes/MapAndModifierSelect.js';
import UIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import unmuteAudio from 'unmute-ios-audio';

window.Phaser = Phaser;
unmuteAudio();



//TESTER CREDITS:
//w testers for this game, including several students in my grade
//The most impactful testers I'd wish to mention are:
//Aidan Z, Deyu Z, Luke Ch, Augustus L, Jaylen L, Presley F, Giovanni M, Jeffrey C, Kenneth L, Abrar A , Mr. Primm
//While they might have told others about the game, those are who I know about who have played and tested the game
//Not only did they play the game, but I was also able to work up to some of their suggestions.
//The ones impactful are the ones I've also observed mistakes in the game from, whether stating it to me or watching them play, so I can add fixes to the code

// This is a 2D platform fighter game made using Phaser and Javascript. Requires a keyboard to play
//ENTIRE script is made by zamanarvin. Before, some assets were made by jeffrey, now only one which is the website icon. I dont own/made any audio in this game however.
//NOTE: mohsina007 and arvin2a are the same person
// its just that mohsina007 is the account that was hard-set as the account for VSCode, the application I used to make this game.
// and the sound effects were taken from various games as listed in the preload function.
//WASD controls the first player , arrow keys control the second player.
//E is the player1 attack, SHIFT is the player2 attack.

export var botMode = false; //Instead of a P2, you can fight an AI instead. (CPU)
export function changeBotMode(newBotMode) {
    botMode = newBotMode;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    //was meant to be used, but was succeeded later after the discovery of scene.time.delayedCall
}
function interpolateColor(startColor, endColor, amount) {
    const start = Phaser.Display.Color.HexStringToColor(startColor);
    const end = Phaser.Display.Color.HexStringToColor(endColor);
    const red = Math.round(start.red + (end.red - start.red) * amount);
    const green = Math.round(start.green + (end.green - start.green) * amount);
    const blue = Math.round(start.blue + (end.blue - start.blue) * amount);
    return `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}
function getKBTextColor(multiplier) {
    if (multiplier <= 1) {
        return interpolateColor('#00a2ff', '#ffffff', (multiplier - 0.7) / 0.3);
    }
    if (multiplier <= 1.2) {
        return interpolateColor('#ffffff', '#fff4a3', (multiplier - 1) / 0.2);
    }
    if (multiplier <= 2.5) {
        return interpolateColor('#fff4a3', '#ff0000', (multiplier - 1.2) / 1.3);
    }
    if (multiplier <= 4) {
        return interpolateColor('#ff0000', '#000000', (multiplier - 2.5) / 1.5);
    }
    return '#000000';
}
function getKBTextStrokeColor(multiplier) {
    if (multiplier <= 2.5) return '#000000';
    if (multiplier <= 4) {
        return interpolateColor('#000000', '#ffffff', (multiplier - 2.5) / 1.5);
    }
    return '#ffffff';
}
function createKBText(scene, player, x, y) {
    const style = { fontFamily: 'GameFont', fontSize: '20px', fill: '#FFFFFF' };
    player.KBText = scene.add.text(x, y, 'KB: 0.0%', style);
    player.KBText.setStroke('#000000', 3);
    player.KBFlashText = scene.add.text(x, y, 'KB: 0.0%', {
        ...style,
        fill: '#FFFFFF'
    });
    player.KBFlashText.setStroke('#000000', 3);
    player.KBFlashText.setAlpha(0);
    player.kbDisplayedValue = null;
}
function updateKBText(scene, player, multiplier) {
    const damagePercent = (multiplier * 100) - 100;
    const nextValue = `KB: ${damagePercent.toFixed(1)}%`;
    if (player.kbTextValue !== nextValue) {
        player.KBText.setText(nextValue);
        player.kbTextValue = nextValue;
    }
    if (player.kbColorMultiplier !== multiplier) {
        player.KBText.setColor(getKBTextColor(multiplier));
        player.KBText.setStroke(getKBTextStrokeColor(multiplier), 3);
        player.kbColorMultiplier = multiplier;
    }

    if (player.kbDisplayedValue !== null && player.kbDisplayedValue !== nextValue) {
        scene.tweens.killTweensOf(player.KBFlashText);
        player.KBFlashText.setText(nextValue);
        player.KBFlashText.setAlpha(0.5);
        scene.tweens.add({
            targets: player.KBFlashText,
            alpha: 0,
            duration: 200
        });
    }
    player.kbDisplayedValue = nextValue;
}
async function loadFont() {
    const fonts = [
        new FontFace('GameFont', 'url(assets/fonts/GameFont.ttf)'),
        new FontFace('VCROSD', 'url(assets/fonts/VCROSD.ttf)')
    ];
    const loadedFonts = await Promise.all(fonts.map(font => font.load()));
    loadedFonts.forEach(font => document.fonts.add(font));
}

var GameScene = {
    //gamescene in the form of a scene object format
    key: 'GameScene',
    preload: preload,
    create: create,
    update: update
};
if ('audioSession' in navigator) {
    navigator.audioSession.type = 'playback';
}
export var config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    scale: {
        //essential for making the game fit for all screens
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    plugins: {
        scene: [{
            key: 'rexUI',
            plugin: UIPlugin,
            mapping: 'rexUI'
        },
        // ...
        ]
    },
    render: {
        antialias: false,
        pixelArt: true
    },
    scene: [MenuScene, MapAndModifierSelectScene, CharacterSelectScene, GameScene]
};

var game;

loadFont().then(() => {
    game = new Phaser.Game(config);
});

//important game variables, including player objects and controls
var players;

var player;
var cursors;

var wasd;
var attackKey1;
var attackKey2;
var chainsawModeKey1;
var chainsawModeKey2;
var winNumber = 3; //number of rounds needed to win as of now
var lastWinState = {
    p1: 0,
    p2: 0
};
var inputMode = {
    p1: "touch",
    p2: "touch",
}
var mobileControls = {
    p1: {
        left: false,
        leftPressed: false,
        right: false,
        rightPressed: false,
        up: false,
        upPressed: false,
        down: false,
        downPressed: false,
        attack: false,
        attackPressed: false
    },
    p2: {
        left: false,
        leftPressed: false,
        right: false,
        rightPressed: false,
        up: false,
        upPressed: false,
        down: false,
        downPressed: false,
        attack: false,
        attackPressed: false
    }
};

var winBar;
var restartBtn;
var restartBtnPressed;

var homeBtn;
var homeBtnPressed;

function createSpecialMeters(scene) {
    scene.specialMeters = {};
    const meterWidth = 160;
    const meterHeight = 18;
    const meters = [
        { key: 'p1', player: scene.gameState.players.player, x: 205, color: 0xf54242, label: 'P1 ABILITY' },
        { key: 'p2', player: scene.gameState.players.player2, x: 795, color: 0x00aaff, label: 'P2 ABILITY' }
    ];

    meters.forEach(meter => {
        const label = scene.add.text(meter.x, 123, meter.label, {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        const background = scene.add.rectangle(meter.x, 145, meterWidth, meterHeight, 0x171717)
            .setStrokeStyle(2, 0xffffff);
        const fill = scene.add.rectangle(meter.x - meterWidth / 2, 145, meterWidth, meterHeight, meter.color)
            .setOrigin(0, 0.5);
        const status = scene.add.text(meter.x, 167, 'READY', {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        scene.hud.add(label);
        scene.hud.add(background);
        scene.hud.add(fill);
        scene.hud.add(status);
        scene.specialMeters[meter.key] = { player: meter.player, fill, status, meterWidth };
    });
    meters.forEach(meter => {
        if (meter.player.name === 'AXEMAN' && meter.player.variant === 'CHAINSAW') {
            const woodMeterY = 145 + 65; // 65 pixels below the ability meter
            const woodLabel = scene.add.text(meter.x, woodMeterY - 22, 'WOOD (ft³)', {
                fontFamily: 'VCROSD',
                fontSize: '15px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            const woodBackground = scene.add.rectangle(meter.x, woodMeterY, meterWidth, meterHeight, 0x171717)
                .setStrokeStyle(2, 0xffffff);
            const woodFill = scene.add.rectangle(meter.x - meterWidth / 2, woodMeterY, 0, meterHeight, 0x8B4513)
                .setOrigin(0, 0.5);
            const woodStatus = scene.add.text(meter.x, woodMeterY + 22, '0 / 300', {
                fontFamily: 'GameFont',
                fontSize: '12px',
                fill: '#ffffff'
            }).setOrigin(0.5);

            scene.hud.add(woodLabel);
            scene.hud.add(woodBackground);
            scene.hud.add(woodFill);
            scene.hud.add(woodStatus);
            
            meter.woodFill = woodFill;
            meter.woodStatus = woodStatus;
            meter.woodMaxValue = 300;
        }
    });
    scene.specialPrompt = scene.add.text(500, 180, 'DOUBLE TAP LEFT OR RIGHT TO USE YOUR ABILITY', {
        fontFamily: 'GameFont',
        fontSize: '18px',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
    }).setOrigin(0.5).setAlpha(0);
    scene.hud.add(scene.specialPrompt);
    scene.specialPromptShown = false;
}

function updateSpecialMeters(scene) {
    if (!scene.specialMeters) return;

    Object.values(scene.specialMeters).forEach(meter => {
        const { player, fill, status, meterWidth } = meter;
        const isChainsawBuildMode =
            player.name === 'AXEMAN' &&
            player.variant === 'CHAINSAW' &&
            !player.chainsawMode;
        if (isChainsawBuildMode) {
            fill.setDisplaySize(0, 18);
            fill.setFillStyle(0x555555);
            status.setText('LOCKED: BUILD MODE');
            status.setColor('#bbbbbb');
            return;
        }

        const chainsawCooldownRemaining =
            player.name === 'AXEMAN' &&
            player.variant === 'CHAINSAW'
                ? Math.max(0, (player.chainsawCooldownUntil ?? 0) - scene.time.now)
                : 0;
        if (chainsawCooldownRemaining > 0) {
            const cooldownDuration = 5000;
            const progress = Phaser.Math.Clamp(
                1 - chainsawCooldownRemaining / cooldownDuration,
                0,
                1
            );
            fill.setDisplaySize(meterWidth * progress, 18);
            fill.setFillStyle(0xff8c00);
            status.setText(`SAW COOLDOWN ${Math.ceil(chainsawCooldownRemaining / 1000)}s`);
            status.setColor('#ffcc80');
            return;
        }
        Object.values(scene.specialMeters).forEach(meter => {
            if (meter.woodFill && meter.player.name === 'AXEMAN' && meter.player.variant === 'CHAINSAW') {
                const woodAmount = meter.player.chainsawWood || 0;
                const maxWood = meter.woodMaxValue;
                const woodProgress = Math.min(woodAmount / maxWood, 1);
                
                meter.woodFill.setDisplaySize(meter.meterWidth * woodProgress, 18);
                meter.woodStatus.setText(`${Math.floor(woodAmount)} / ${maxWood}`);
            }
        });

        const cooldownDuration = Number.isFinite(player.sideSpecialCooldownDuration)
            ? player.sideSpecialCooldownDuration
            : 0;
        const remaining = Math.max(0, player.nextSideSpecialTime - scene.time.now);
        const progress = !player.hasUsedSideSpecial || cooldownDuration <= 0
            ? 1
            : Phaser.Math.Clamp(1 - remaining / cooldownDuration, 0, 1);
        const fillWidth = Math.max(0, meterWidth * progress);

        fill.setDisplaySize(fillWidth, 18);
        fill.setFillStyle(
            player.name === 'AXEMAN' && player.variant === 'CHAINSAW'
                ? 0xff8c00
                : meter.key === 'p1' ? 0xf54242 : 0x00aaff
        );
        status.setText(progress >= 1 ? 'READY' : `RECHARGING ${Math.ceil(remaining / 1000)}s`);
        status.setColor(progress >= 1 ? '#ffffff' : '#bbbbbb');
    });

    const players = scene.gameState.players;
    if (
        !scene.specialPromptShown &&
        scene.matchStartTime !== null &&
        scene.time.now >= scene.matchStartTime + 5000 &&
        (!players.player.hasUsedSideSpecial || !players.player2.hasUsedSideSpecial)
    ) {
        scene.specialPromptShown = true;
        scene.specialPrompt.setAlpha(1);
        scene.tweens.add({
            targets: scene.specialPrompt,
            alpha: 0,
            duration: 250,
            yoyo: true,
            repeat: 5,
            onComplete: () => scene.specialPrompt.setAlpha(0)
        });
    }
}

function applyWeatherDamage(scene, amount) {
    Object.values(scene.gameState.players).forEach(player => {
        player.KBmultiplier += amount;
        player.flash();
    });
}

function startWeatherHazard(scene, type) {
    const key = type === 'blizzard' ? 'blizzard' : 'sandstorm';
    const sprite = scene.add.sprite(500, 300, key)
        .setDisplaySize(1000, 600)
        .setDepth(10000)
        .setAlpha(0.72);
    scene.hud.add(sprite);
    sprite.play(key);

    scene.weatherHazard = {
        type,
        sprite,
        endsAt: scene.time.now + 5000,
        nextDamageAt: scene.time.now + 1000,
        sound: scene.sound.add('storm', { volume: 0.80, loop: true })
    };
    scene.weatherHazard.sound.play();

    if (type === 'blizzard') {
        Object.values(scene.gameState.players).forEach(player => {
            player.weatherOriginalBaseMovementSpeed = player.baseMovementSpeed;
            player.baseMovementSpeed *= 0.5;
        });
        applyWeatherDamage(scene, 0.35);
    }
}

function isResistingSandstorm(scene, player) {
    return player.id === 1
        ? wasd.right.isDown || mobileControls.p1.right
        : cursors.right.isDown || mobileControls.p2.right;
}

function updateWeatherHazard(scene) {
    if (!scene.blizzardEnabled && !scene.sandstormEnabled) return;

    const now = scene.time.now;
    const hazard = scene.weatherHazard;

    if (hazard) {
        if (now >= hazard.endsAt) {
            hazard.sprite.destroy();
            if (hazard.type === 'blizzard') {
                Object.values(scene.gameState.players).forEach(player => {
                    player.baseMovementSpeed = player.weatherOriginalBaseMovementSpeed;
                    player.weatherOriginalBaseMovementSpeed = undefined;
                });
            }
            hazard.sound.stop();
            scene.weatherHazard = null;
        } else {
            Object.values(scene.gameState.players).forEach(player => {
                if (hazard.type === 'sandstorm') {
                    const pushStrength = isResistingSandstorm(scene, player) ? 3 : 8;
                    player.setVelocityX(player.body.velocity.x - pushStrength);
                }
            });

            if (hazard.type === 'sandstorm' && now >= hazard.nextDamageAt) {
                applyWeatherDamage(scene, 0.10);
                hazard.nextDamageAt += 1000;
            }
        }
        return;
    }

    if (scene.matchStartTime !== null && now >= scene.nextHazardCheckAt) {
        scene.nextHazardCheckAt = now + 5000;
        if (Math.random() < 0.5) {
            startWeatherHazard(scene, scene.sandstormEnabled ? 'sandstorm' : 'blizzard');
        }
    }
}

function create() {
    this.gamePaused = false;
    this.time.paused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.sound.resumeAll();
    fiveframecount = 0;
    for (const controls of Object.values(mobileControls)) {
        for (const key of Object.keys(controls)) {
            controls[key] = false;
        }
    }
    inputMode.p1 = 'touch';
    inputMode.p2 = 'touch';

    this.events.once('shutdown', () => {
        this.gamePaused = false;
        fiveframecount = 0;
        for (const controls of Object.values(mobileControls)) {
            for (const key of Object.keys(controls)) {
                controls[key] = false;
            }
        }
    });

    this.gameEnded = false;
    this.winCooldown = false;
    this.finisherActive = false;
    this.matchStartTime = null;
    this.blizzardEnabled = false;
    this.sandstormEnabled = false;
    this.weatherHazard = null;
    this.nextHazardCheckAt = 0;


    this.gameState = {
        players: null,
        map: null
    };
    this.planks = this.physics.add.group({
        allowGravity: false,
        immovable: true
    });

    lastWinState = {
        p1: 0,
        p2: 0
    };
    this.botMode = botMode;
    this.input.addPointer(5);
    this.baseZoom = 1;
    this.hud = this.add.container(0, 0);
    this.objs = this.add.container(0,0);
    this.objcam = this.cameras.add(0,0,1000,600, false, "hudCam");
    this.mobileButtons = {
        p1: [],
        p2: []
    }
    this.gameState.map = new Map(this, selectedMapDefinition);
    if (modifierOptions.MAP_HAZARDS.enabled) {
        if (selectedMapDefinition == SNOWY_MAP) {
            this.blizzardEnabled = true;
        } else if (selectedMapDefinition == DEFAULT_MAP) {
            this.sandstormEnabled = true;
        }
    }
    this.nextHazardCheckAt = this.time.now + 5000;
    //Making the map, platforms, and the KB stat display
    this.cameras.main.fadeIn(500, 0, 0, 0);

    winBar = this.add.image(500 , 300, 'winbar');
    winBar.setDisplaySize(this.scale.width, 150);
    winBar.setScale(1, 0);
    winBar.setVisible(false);
    winBar.setAlpha(0.85);
    this.hud.add(winBar);

    restartBtn = this.add.image(425,450, 'restartBtn');
    restartBtn.setScale(0.35);
    restartBtn.setVisible(false);
    this.hud.add(restartBtn);

    restartBtnPressed = this.add.image(425,450, 'restartBtnPressed');
    restartBtnPressed.setScale(0.35);
    restartBtnPressed.setVisible(false);
    this.hud.add(restartBtnPressed)


    

    restartBtn.setInteractive({ useHandCursor: true });
    restartBtn.on('pointerdown', () => {
        restartBtn.setVisible(false);
        restartBtnPressed.setVisible(true);
        this.time.delayedCall(75, () => {
            restartBtn.setVisible(true);
            restartBtnPressed.setVisible(false);
        });
        this.time.delayedCall(150, () => {
            restartBtn.setVisible(false);
            this.sound.stopAll();
            this.scene.restart();
        });
    });

    homeBtn = this.add.image(600,450, 'gohomeBtn');
    homeBtn.setScale(0.35);
    homeBtn.setVisible(false);
    this.hud.add(homeBtn);

    homeBtnPressed = this.add.image(600,450, 'gohomeBtnPressed');
    homeBtnPressed.setScale(0.35);
    homeBtnPressed.setVisible(false);
    this.hud.add(homeBtnPressed)


    

    homeBtn.setInteractive({ useHandCursor: true });
    homeBtn.on('pointerdown', () => {
        homeBtn.setVisible(false);
        homeBtnPressed.setVisible(true);
        this.time.delayedCall(75, () => {
            homeBtn.setVisible(true);
            homeBtnPressed.setVisible(false);
        });
        this.time.delayedCall(150, () => {
            homeBtn.setVisible(false);
            this.sound.stopAll();
            resetMapAndModifierSelection();
            this.scene.start('MenuScene');
        });
    });




    const plr1StatImage = this.add.image(300, 65, 'redstat');
    plr1StatImage.setScale(0.65);
    const plr2StatImage = this.add.image(700, 65, 'bluestat');
    plr2StatImage.setScale(0.65);
    this.hud.add(plr1StatImage);
    this.hud.add(plr2StatImage);

    const p1guide = this.add.image(450, 65, 'p1guide');
    p1guide.setAlpha(0.65);
    this.hud.add(p1guide);
    const p2guide = this.add.image(850, 65, 'p2guide');
    p2guide.setAlpha(0.65);
    this.hud.add(p2guide);

    //platform.refreshBody();

    createGameAnimations(this);

    //mobile support:
    const isMobile = this.sys.game.device.input.touch;

    if (isMobile) {

        function makeButton(scene, x, y, text, keyRef) {
            
            const btn = scene.add.circle(x, y, 45, 0x000000, 0.45)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive();

            const label = scene.add.text(x, y, text, {
                fontSize: '48px',
                color: '#ffffff',
                fontFamily: 'Arial'
            })
            .setOrigin(0.5)
            .setAlpha(0.5)
            .setScrollFactor(0)
            .setDepth(1000);

            btn.activePointerID = null;

            btn.on('pointerdown', (pointer) => {
                keyRef.obj[keyRef.key] = true;
                keyRef.obj[keyRef.key + "Pressed"] = true;
                if (keyRef.obj === mobileControls.p1) {
                    scene.mobileButtons.p1.forEach(obj => {
                        if (obj) obj.setAlpha(1);  
                    });
                
                    inputMode.p1 = "touch";
                } else if (keyRef.obj === mobileControls.p2) {
                    scene.mobileButtons.p2.forEach(obj => {
                        if (obj) obj.setAlpha(1);  
                    });
                    inputMode.p2 = "touch";
                }
                btn.activePointerID = pointer.id;
            });

            btn.on('pointerup', (pointer) => {
                if (pointer.id === btn.activePointerID) {
                    keyRef.obj[keyRef.key] = false;
                    btn.activePointerID = null;
                }
                
            });
            btn.on('pointerout', (pointer) => {
                if (pointer.id === btn.activePointerID) {
                    keyRef.obj[keyRef.key] = false;
                    btn.activePointerID = null;
                }
                
            });

            btn.on('pointerupoutside', (pointer) => {
                if (pointer.id === btn.activePointerID) {
                    keyRef.obj[keyRef.key] = false;
                    btn.activePointerID = null;
                }
            });

            scene.hud.add(btn);
            scene.hud.add(label);
            return btn;
        }

        const p1 = mobileControls.p1;
        const p2 = mobileControls.p2;

        //P1
        const p1Buttons = [
            [60, 420, '←', p1, 'left'],
            [240, 420, '→', p1, 'right'],
            [150, 330, '↑', p1, 'up'],
            [150, 420, '↓', p1, 'down'],
            [240, 330, 'A', p1, 'attack']
        ];

        //P2
        const p2Buttons = [
            [740, 420, '←', p2, 'left'],
            [920, 420, '→', p2, 'right'],
            [830, 330, '↑', p2, 'up'],
            [830, 420, '↓', p2, 'down'],
            [740, 330, 'A', p2, 'attack']
        ];

        p1Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            });
            this.mobileButtons.p1.push(butn);
        });

        p2Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            });
            if (botMode) butn.visible = false;
            this.mobileButtons.p2.push(butn);
        });

    }

    //---PLAYER---\\
    this.gameState.players = initiatePlayers(
        this,
        player1Character,
        player2Character,
        player1Variant,
        player2Variant
    );
    if (isMobile) {
        for (const player of Object.values(this.gameState.players)) {
            if (player.name !== 'AXEMAN' || player.variant !== 'CHAINSAW') continue;

            const x = player.id === 1 ? 330 : 670;
            const button = this.add.circle(x, 420, 34, 0x000000, 0.55)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive();
            const label = this.add.text(x, 420, 'Q', {
                fontSize: '36px',
                color: '#ffffff',
                fontFamily: 'VCROSD'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            button.on('pointerdown', () => {
                inputMode[player.id === 1 ? 'p1' : 'p2'] = 'touch';
                toggleChainsawMode(this, player);
            });
            this.hud.add(button);
            this.hud.add(label);
            player.modeSwitchButton = button;
        }
    }
    createSpecialMeters(this);

    //a bit of cam intiation:
    this.physics.world.setBounds(0, 0, 2000, 1200);
    this.cameras.main.setBounds(0, 0, 2000, 1200);
    this.cameras.main.ignore(this.hud);
    this.objcam.ignore(this.objs);


    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];
        this.physics.add.collider(player, this.gameState.map.platforms);
        this.physics.add.collider(player, this.gameState.map.topPlatforms);
        this.physics.add.collider(player, this.planks);
    }

    const keys = Object.keys(this.gameState.players);

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const playerA = this.gameState.players[keys[i]];
            const playerB = this.gameState.players[keys[j]];
            this.physics.add.collider(playerA, playerB);
        }
    }

    //load icons for the KB stat display
    const plr1Icon = this.add.image(250, 65, this.gameState.players.player.icon);
    const plr2Icon = this.add.image(650, 65, this.gameState.players.player2.icon);
    this.hud.add(plr1Icon);
    this.hud.add(plr2Icon);

    const plr1NameText = this.add.text(280, 47, this.gameState.players.player.name, { fontFamily: 'GameFont', fontSize: '16px', fill: '#FFFFFF' });
    const plr2NameText = this.add.text(680, 47, this.gameState.players.player2.name, { fontFamily: 'GameFont', fontSize: '16px', fill: '#FFFFFF' });
    plr1NameText.setStroke('#000000', 3);
    plr2NameText.setStroke('#000000', 3);
    this.hud.add(plr1NameText);
    this.hud.add(plr2NameText);
    createKBText(this, this.gameState.players.player, 285, 65);
    createKBText(this, this.gameState.players.player2, 685, 65);
    this.hud.add(this.gameState.players.player.KBText);
    this.hud.add(this.gameState.players.player.KBFlashText);
    this.hud.add(this.gameState.players.player2.KBText);
    this.hud.add(this.gameState.players.player2.KBFlashText);
    

    //---CONTROLS---\\
    //Allows holding for the keys too. Later this will be revamped to allow charge attacks
    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    chainsawModeKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    chainsawModeKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });

    //3-2-1 COUNTDOWN

    

    this.time.delayedCall(50, () => {
        this.gameState.players.player.freezeUntil = 4200 + this.time.now;
        this.gameState.players.player.hitstunUntil = 4200 + this.time.now;
        this.gameState.players.player2.freezeUntil = 4200 + this.time.now;
        this.gameState.players.player2.hitstunUntil = 4200 + this.time.now;
    });
    

    this.time.delayedCall(1000, () => {
        const counter = this.add.image(500, 300, 'countdown1');
        this.hud.add(counter);
        this.sound.play('countdown');
        this.tweens.add({
            targets: counter,
            alpha: 0,
            duration: 500,
            onComplete: () => counter.destroy()
        });
        this.time.delayedCall(1000, () => {
            const counter1 = this.add.image(500, 300, 'countdown2');
            this.hud.add(counter1);
            this.tweens.add({
                targets: counter1,
                alpha: 0,
                duration: 500,
                onComplete: () => counter1.destroy()
            });
            this.time.delayedCall(1000, () => {
                const counter2 = this.add.image(500, 300, 'countdown3');
                this.hud.add(counter2);
                this.tweens.add({
                    targets: counter2,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => counter2.destroy()
                });
                this.time.delayedCall(1000, () => {
                    const counter4 = this.add.image(500, 300, 'countdown4');
                    this.hud.add(counter4);
                    this.tweens.add({
                        targets: counter4,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => counter4.destroy()
                    });
                    this.gameState.players.player.freezeUntil = 0;
                    this.gameState.players.player2.freezeUntil = 0;
                    this.gameState.players.player.hitstunUntil = 0;
                    this.gameState.players.player2.hitstunUntil = 0;
                    this.matchStartTime = this.time.now;

                });   
            });   
        });    
    });    

    this.pauseOverlay = this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.5)
        .setScrollFactor(0)
        .setDepth(2000)
        .setInteractive()
        .setVisible(false);
    this.pauseResumeButton = this.add.image(300, 300, 'resumeBtn')
        .setScale(0.35)
        .setScrollFactor(0)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
    this.pauseMenuButton = this.add.image(600, 300, 'gohomeBtn')
        .setScale(0.35)
        .setScrollFactor(0)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
    this.pauseButton = this.add.image(970, 30, 'gohomeBtn')
        .setScale(0.16)
        .setScrollFactor(0)
        .setDepth(1999)
        .setInteractive({ useHandCursor: true });

    this.hud.add(this.pauseOverlay);
    this.hud.add(this.pauseResumeButton);
    this.hud.add(this.pauseMenuButton);
    this.hud.add(this.pauseButton);

    this.resumeGame = () => {
        if (!this.gamePaused) return;
        this.gamePaused = false;
        this.pauseOverlay.setVisible(false);
        this.pauseResumeButton.setVisible(false);
        this.pauseMenuButton.setVisible(false);
        this.pauseButton.setVisible(true);
        this.physics.world.resume();
        this.time.paused = false;
        this.tweens.resumeAll();
        this.sound.resumeAll();
    };

    this.pauseButton.on('pointerdown', () => {
        if (this.gamePaused || this.gameEnded) return;
        this.gamePaused = true;
        this.pauseButton.setVisible(false);
        this.pauseOverlay.setVisible(true);
        this.pauseResumeButton.setVisible(true);
        this.pauseMenuButton.setVisible(true);
        this.physics.world.pause();
        this.time.paused = true;
        this.tweens.pauseAll();
        this.sound.pauseAll();
    });
    this.pauseResumeButton.on('pointerdown', () => this.resumeGame());
    this.pauseMenuButton.on('pointerdown', () => {
        this.sound.stopAll();
        resetMapAndModifierSelection();
        this.scene.start('MenuScene');
    });

}
function updateWins(scene) {
    if (scene.gameState.players.player.winNumber !== lastWinState.p1 || scene.gameState.players.player2.winNumber !== lastWinState.p2) {
        console.log("update!")
        lastWinState.p1 = scene.gameState.players.player.winNumber;
        lastWinState.p2 = scene.gameState.players.player2.winNumber;

        winBar.setVisible(true);
        if (scene.gameState.players.player.winNumber >= 3 || scene.gameState.players.player2.winNumber >= 3) {
            winBar.setVisible(false);
        }
        scene.tweens.add({
            targets: winBar,
            scaleY: 1, // from 0 → full height
            duration: 300,
            ease: 'Cubic.easeOut'
        });
        scene.time.delayedCall(1000, () => {
            scene.gameState.players.player.winText.setVisible(false);
            scene.gameState.players.player2.winText.setVisible(false);
            scene.tweens.add({
                targets: winBar,
                scaleY: 0, // from 0 → full height
                duration: 300,
                ease: 'Cubic.easeOut'
            });
        });

        scene.gameState.players.player.winText.setText(scene.gameState.players.player.winNumber);
        scene.gameState.players.player2.winText.setText(scene.gameState.players.player2.winNumber);
        scene.gameState.players.player.winText.setVisible(true);
        scene.gameState.players.player2.winText.setVisible(true);
        if (scene.gameState.players.player.winNumber >= 3 || scene.gameState.players.player2.winNumber >= 3) {
            scene.gameState.players.player.winText.setVisible(false);
            scene.gameState.players.player2.winText.setVisible(false);
        }

    }

}
function teleportBackToArena(player) {
    player.setPosition(1000, 0);
    player.setVelocityY(0);
    player.setVelocityX(0);
}
const accelFactor = 20;

const baseZoom = 1;
const minZoom = 0.6;
const defaultMaxZoom = 1.4;
const snowyMaxZoom = 0.8;

const tiltThreshold = 150;

function spawnAfterimage(scene, player) {

    const ghost = scene.add.sprite(
        player.x,
        player.y,
        player.icon
    );

    ghost.setFrame(player.frame.name);
    ghost.setScale(player.scaleX, player.scaleY);
    ghost.setFlipX(player.flipX);

    ghost.setAlpha(0.5);

    ghost.setDepth(player.depth - 1);
    scene.objs.add(ghost);
    scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 100,
        onComplete: () => ghost.destroy()
    });
}

function updateSledgehammerAnimation(player) {
    if (player.variant !== 'SLEDGEHAMMER') return;
    const sprite = player.atk;

    sprite.setPosition(player.x, player.y);
    if (player.lastDir.x !== 0) sprite.setFlipX(-player.lastDir.x < 0);

    if (player.isAttacking) {
        if (sprite.anims.currentAnim?.key === 'sledge_walk') {
            sprite.stop();
            sprite.setTexture('sledge_idle');
        }
        if (player.rockslidingSound.isPlaying) player.rockslidingSound.stop();
        return;
    }

    if (Math.abs(player.body.velocity.x) > 1 && player.body.touching.down) {
        if (sprite.texture.key !== 'sledge_walk' || !sprite.anims.isPlaying) {
            sprite.play('sledge_walk');
        }
        if (!player.rockslidingSound.isPlaying) player.rockslidingSound.play();
    } else if (sprite.texture.key !== 'sledge_idle' || sprite.anims.isPlaying) {
        sprite.stop();
        sprite.setTexture('sledge_idle');
        if (player.rockslidingSound.isPlaying) player.rockslidingSound.stop();
    } else if (player.rockslidingSound.isPlaying) {
        player.rockslidingSound.stop();
    }
}

function updateKB(scene) {
    for (const key in scene.gameState.players) {
        const player = scene.gameState.players[key];
        player.movementSpeed = player.baseMovementSpeed * player.playerSpeedScaling;

        const spawnBox = () => {
            const box = scene.add.rectangle(
                player.x,
                player.y,
                50,
                50,
                0xffbf00,
                0.5
            );
            scene.objs.add(box);
            scene.tweens.add({
                targets: box,
                alpha: 0,
                duration: 100,
                onUpdate: () => {
                    box.setPosition(player.x, player.y);
                },
                onComplete: () => {
                    box.destroy();
                }
            });
        };

        // Plunge DoT
        if (player.plunged) {

            if (!player.lastPlungeTick) {
                player.lastPlungeTick = scene.time.now;
            }
            player.plungeAura.visible = true;

            if (scene.time.now - player.lastPlungeTick >= 450) {
                player.KBmultiplier += 0.025; // 3.5%
                player.flash();
                scene.sound.play('anyhit');
                player.lastPlungeTick = scene.time.now;
            }
        } else {
            player.plungeAura.visible = false;
            player.lastPlungeTick = null;
        }

        if (player.chopped) {
            player.baseDamageScale = 0.5;
            player.playerSpeedScaling = 0.5;
            player.choppedMark.visible = true;
        } else if (!player.chopped) {
            player.baseDamageScale = 1;
            player.playerSpeedScaling = 1;
            player.choppedMark.visible = false;
        }

        if (player.lastKBmultiplier !== player.KBmultiplier) {
            // KB multiplier changed

            if (player.name === "SLATEMAN") {
                if (player.KBmultiplier < 1.50) player.setTexture('slateman');
                if (player.KBmultiplier >= 1.50) player.setTexture('slatemanphase1');
                if (player.KBmultiplier >= 2.00) player.setTexture('slatemanphase2');
                if (player.KBmultiplier >= 2.50) player.setTexture('slatemanphase3');

                player.playerSpeedScaling =
                    (250 + ((player.KBmultiplier - 1) * 150)) / 300;

                player.baseDamageScale =
                    1 - ((player.KBmultiplier - 1) * 0.35);

                player.baseDamageScale =
                    Math.max(0.1, player.baseDamageScale);
            }
        }
        player.plungeAura.setPosition(player.x, player.y);
        player.choppedMark.setPosition(player.x, player.y);

        player.lastKBmultiplier = player.KBmultiplier;
        if (scene.time.now > player.nextSideSpecialTime && scene.time.now - player.nextSideSpecialTime < 100) {
            spawnBox();
        }
    }
}
export var fiveframecount = 0;

function update() {
    if (this.gamePaused) return;

    fiveframecount += 1;
    

    const p1 = this.gameState.players.player;
    const p2 = this.gameState.players.player2;
    updateSpecialMeters(this);

    var midX = (p1.x + p2.x) / 2;
    var midY = (p1.y + p2.y) / 2;
    if (p1.winNumber >= 3) {
        midX = p1.x;
        midY = p1.y;
        this.baseZoom = 1.4;
    } else if (p2.winNumber >= 3) {
        midX = p2.x;
        midY = p2.y;
        this.baseZoom = 1.4;
    }

    // distance between this.gameState.players
    var distX = Math.abs(p1.x - p2.x);
    var distY = Math.abs(p1.y - p2.y);

    if (p1.winNumber >= 3) {
        distX = Math.abs(p1.x);
        distY = Math.abs(p1.y);
    } else if (p2.winNumber >= 3) {
        distX = Math.abs(p2.x);
        distY = Math.abs(p2.y);
    }

    var distance = Math.max(distX, distY);
    

    let zoom = this.baseZoom - (distance / 2000);

    const maxZoom = this.gameState.map.definition === SNOWY_MAP
        ? snowyMaxZoom
        : defaultMaxZoom;
    zoom = Phaser.Math.Clamp(zoom, minZoom, maxZoom);

    this.cameras.main.scrollX += (
        midX - this.cameras.main.width / 2 - this.cameras.main.scrollX
    ) * 0.12;

    this.cameras.main.scrollY += (
        midY - this.cameras.main.height / 2 - this.cameras.main.scrollY
    ) * 0.12;

    this.cameras.main.zoom += (
        zoom - this.cameras.main.zoom
    ) * 0.05;

    if (this.gameEnded) {
        p1.setVelocity(0, 0);
        p2.setVelocity(0, 0);
        return;
    }

    p1.hitstun = this.time.now < p1.hitstunUntil;
    p2.hitstun = this.time.now < p2.hitstunUntil;
    if (Phaser.Input.Keyboard.JustDown(chainsawModeKey1)) {
        toggleChainsawMode(this, p1);
    }
    if (Phaser.Input.Keyboard.JustDown(chainsawModeKey2)) {
        toggleChainsawMode(this, p2);
    }
    
    
    const p1Chainsaw = p1.name === 'AXEMAN' && p1.variant === 'CHAINSAW';
    const p1AttackPressed = p1Chainsaw
        ? Phaser.Input.Keyboard.JustDown(attackKey1) || mobileControls.p1.attackPressed
        : attackKey1.isDown || mobileControls.p1.attack;
    if (p1Chainsaw) mobileControls.p1.attackPressed = false;
    if (p1AttackPressed && (!p1.hitstun || p1.activeGrab)) {
        const now = this.time.now;
        if (inputMode.p1 !== "keyboard" && !mobileControls.p1.attack) {
            this.mobileButtons.p1.forEach(obj => {
                obj.setAlpha(0.25);
            });
        }        
        if (p1Chainsaw) {
            handleAttack(this, p1, p2);
        } else if (now - p1.lastInput.up < tiltThreshold) {
            //placeholder
            handleUpTilt(this, p1, p2);
        } else if (now - p1.lastInput.down < tiltThreshold) {
            //placeholder
            handleDownTilt(this, p1, p2);
        } else if (now - p1.lastInput.left < tiltThreshold) {
            //placeholder
            handleHorizantalTilt(this, p1, p2, "left");
        } else if (now - p1.lastInput.right < tiltThreshold) {
            //placeholder
            handleHorizantalTilt(this, p1, p2, "right");
        } else {
            handleAttack(this, p1, p2);
        }
    }
    p2.hitstun = this.time.now < p2.hitstunUntil;
    const p2Chainsaw = p2.name === 'AXEMAN' && p2.variant === 'CHAINSAW';
    const p2AttackPressed = p2Chainsaw
        ? Phaser.Input.Keyboard.JustDown(attackKey2) || mobileControls.p2.attackPressed
        : attackKey2.isDown || mobileControls.p2.attack;
    if (p2Chainsaw) mobileControls.p2.attackPressed = false;
    if (p2AttackPressed && (!p2.hitstun || p2.activeGrab) && !botMode) {
        const now = this.time.now;
        if (inputMode.p2 !== "keyboard" && !mobileControls.p2.attack) {
            this.mobileButtons.p2.forEach(obj => {
                obj.setAlpha(0.25);
            });
        }
        if (p2Chainsaw) {
            handleAttack(this, p2, p1);
        } else if (now - p2.lastInput.up < tiltThreshold) {
            handleUpTilt(this, p2, p1);
        } else if (now - p2.lastInput.down < tiltThreshold) {
            handleDownTilt(this, p2, p1);
        } else if (now - p2.lastInput.left < tiltThreshold) {
            handleHorizantalTilt(this, p2, p1, "left");
        } else if (now - p2.lastInput.right < tiltThreshold) {
            handleHorizantalTilt(this, p2, p1, "right");
        } else {
            handleAttack(this, p2, p1);
        }
    }
    p1.outOfBounds = p1.y > 1600 || p1.x < -400 || p1.x > 2400 || p1.y < -400;
    p2.outOfBounds = p2.y > 1600 || p2.x < -400 || p2.x > 2400 || p2.y < -400;

    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];

        if (player.activeGrab) {
            const grab = player.activeGrab;
            const target = grab.target;
            target.setPosition(player.x + grab.offset.x, player.y + grab.offset.y);
            target.setVelocity(0, 0);
            target.body.allowGravity = false;
            player.atk.x = player.x + grab.atkOffset.x;
            player.atk.y = player.y + grab.atkOffset.y;
            player.atk.setFlipX(grab.atkFlipX);
            player.atk.setAngle(grab.atkAngle);
            player.atk.setVisible(true);
            player.playerSpeedScaling = 0.5;
        }

        if (player.body.touching.down) {
            if (player.downslamming && player.airTime > 0) {
                const target = key === 'player' ? p2 : p1;
                downslamAttack(this, player, target);
                player.downslamming = false;
            }
            player.airTime = 0;
        } else {
            player.airTime += this.game.loop.delta;
        }
        player.flashObject.setPosition(player.x, player.y);

        player.hitstun =
            this.time.now < player.hitstunUntil;

        if (player.hitstun && player.isAttacking && !player.activeGrab &&
            !player.attackBypassesHitstun) {
            player.isAttacking = false;
        }

        player.freeze =
            this.time.now < player.freezeUntil;
        player.chopped = this.time.now < player.choppedUntil;
        //player.canAttack =
            //this.time.now < player.canAttackUntil;
    };
    updateScythemanGrass(this, this.gameState.players);
    updateCombo(p1, this.game.loop.delta);
    updateCombo(p2, this.game.loop.delta);
    if (wasd.left.isDown || mobileControls.p1.left) p1.lastDir = { x: -1, y: 0 };
    else if (wasd.right.isDown || mobileControls.p1.right) p1.lastDir = { x: 1, y: 0 };
    else if (wasd.up.isDown || mobileControls.p1.up) p1.lastDir = { x: 0, y: -1 };
    else if (wasd.down.isDown || mobileControls.p1.down) p1.lastDir = { x: 0, y: 1 };
    if (p1.lastDir.y === 0) p1.atk.setAngle(0);


    // PLAYER 2 (arrows)
    if (cursors.left.isDown || mobileControls.p2.left) p2.lastDir = { x: -1, y: 0 };
    else if (cursors.right.isDown || mobileControls.p2.right) p2.lastDir = { x: 1, y: 0 };
    else if (cursors.up.isDown || mobileControls.p2.up) p2.lastDir = { x: 0, y: -1 };
    else if (cursors.down.isDown || mobileControls.p2.down) p2.lastDir = { x: 0, y: 1 };
    if (p2.lastDir.y === 0) p2.atk.setAngle(0);
    function decelerate(player) {
        if (player.isUsingSideSpecial) return;
        let vx = player.body.velocity.x;

        if (Math.abs(vx) > 10) {
            player.setVelocityX(vx * 0.9);
        } else {
            player.setVelocityX(0);
        }
    }
    if (!p1.activeGrab) {
        p1.atk.x = p1.x + (p1.lastDir.x * p1.atkXOffset);
        p1.atk.y = p1.y + (p1.lastDir.y * p1.atkYOffset) - 15;
    }

    if (!p2.activeGrab) {
        p2.atk.x = p2.x + (p2.lastDir.x * p2.atkXOffset);
        p2.atk.y = p2.y + (p2.lastDir.y * p2.atkYOffset) - 15;
    }

    if (p1.name === 'AXEMAN' && p1.variant === 'CHAINSAW') {
        positionAttackSprite(p1, 'activechainsaw');
        if (p1.chainsawMode && p1.chainsawCooldownUntil > this.time.now) {
            p1.atk.setAlpha(0);
        } else {
            p1.atk.setAlpha(1);
        }
    }
    if (p2.name === 'AXEMAN' && p2.variant === 'CHAINSAW') {
        positionAttackSprite(p2, 'activechainsaw');
        if (p2.chainsawMode && p2.chainsawCooldownUntil > this.time.now) {
            p2.atk.setAlpha(0);
        } else {
            p2.atk.setAlpha(1);
        }
    }
    updateChainsawWood(this, p1, p2);
    updateChainsawWood(this, p2, p1);
    
 
    p1.doubleJumpEffect.x = p1.x;
    p1.doubleJumpEffect.y = p1.y + 40;

    p2.doubleJumpEffect.x = p2.x;
    p2.doubleJumpEffect.y = p2.y + 40;

    p1.header.x = p1.x - 10;
    p1.header.y = p1.y - 50;

    p2.header.x = p2.x - 10;
    p2.header.y = p2.y - 50;

    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];
        if (player.grassCutText) {
            player.grassCutText.setPosition(player.x, player.y - 75);
            if (player.grassCutTextValue !== player.grassCutCount) {
                player.grassCutText.setText(`Grass cuts: ${player.grassCutCount}`);
                player.grassCutTextValue = player.grassCutCount;
            }
        }
    }

    

    if (p1.KBmultiplier < 0.7) {
        p1.KBmultiplier = 0.70;
    }
    if (p2.KBmultiplier < 0.7) {
        p2.KBmultiplier = 0.70;
    }
    for (const player of [p1, p2]) {
        updateKBText(this, player, player.KBmultiplier);
    }

    if (p1.afterimage) {
        if (this.time.now > p1.afterimageTimer) {

            spawnAfterimage(this, p1);

            p1.afterimageTimer = this.time.now + 40;
        }
    } 
    if (p2.afterimage) {
        if (this.time.now > p2.afterimageTimer) {
            spawnAfterimage(this, p2);

            p2.afterimageTimer = this.time.now + 40;
        }
    }

    p1.hitstun = this.time.now < p1.hitstunUntil;
    if (!p1.hitstun) {
        if (Phaser.Input.Keyboard.JustDown(wasd.left) || mobileControls.p1.leftPressed) {
            p1.lastInput.left = this.time.now;
            if (inputMode.p1 !== "keyboard" && !mobileControls.p1.leftPressed) {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard";
            }
            
            handleDirSpecial(this, p1, 'left', this.time.now,p2);
            mobileControls.p1.leftPressed = false;
        }
        if (Phaser.Input.Keyboard.JustDown(wasd.right) || mobileControls.p1.rightPressed) {
            p1.lastInput.right = this.time.now;
            if (inputMode.p1 !== "keyboard" && !mobileControls.p1.rightPressed) {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard";
            }
            handleDirSpecial(this, p1, 'right', this.time.now,p2);
            mobileControls.p1.rightPressed = false;
        }
        if (!p1.hasHitSideSpecial && p1.isUsingSideSpecial && fiveframecount === 5) {
            handleDirSpecialAttack(this, p1, p2);
        }
        if (wasd.left.isDown || mobileControls.p1.left) {
            //transplant successful!
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.LEFT
            });
        } else if (wasd.right.isDown || mobileControls.p1.right) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.RIGHT
            });
        } else {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.NONE
            });
        }
        if ((wasd.up.isDown || mobileControls.p1.up) && p1.body.touching.down) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.UP
            });
        }
        if (p1.body.blocked.down) {
            p1.hasDoubleJumped = false;
        }
        if (p1.body.blocked.down &&  p1.isUsingSideSpecial === false) {
            p1.afterimage = false;
        }
        
        if ((Phaser.Input.Keyboard.JustDown(wasd.up) || mobileControls.p1.upPressed)) {
            p1.lastInput.up = this.time.now;
            if (inputMode.p1 !== "keyboard" && !mobileControls.p1.upPressed) {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard";
            }
            const quickslamJumped = tryQuickslamJump(this, p1, this.time.now);
            if (!quickslamJumped && !p1.body.touching.down && !p1.hasDoubleJumped) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p1.id,
                    type: Commands.DOUBLE_UP
                });
                
            }
            mobileControls.p1.upPressed = false;
            
        }
        if (Phaser.Input.Keyboard.JustDown(wasd.down) || mobileControls.p1.downPressed) {
            p1.lastInput.down = this.time.now;
            if (inputMode.p1 !== "keyboard" && !mobileControls.p1.downPressed) {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard"; 
            }
            mobileControls.p1.downPressed = false;
        }

        const usingMobile = this.sys.game.device.input.touch;


        const jumpReleased =
            inputMode.p1 === "touch"
                ? !mobileControls.p1.up
                : wasd.up.isUp;

        if (jumpReleased && p1.body.velocity.y < 0 && !p1.hasDoubleJumped) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.UP_CANCEL
            });
        }

        if ((wasd.down.isDown || mobileControls.p1.down) && p1.airTime >= 1000) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.DOWNSLAM
            });
        }

    }


    p2.hitstun = this.time.now < p2.hitstunUntil;
    if (!p2.hitstun && !botMode) {

        // Player 2 controls
        if (Phaser.Input.Keyboard.JustDown(cursors.left) || mobileControls.p2.leftPressed) {
            p2.lastInput.left = this.time.now;
            if (inputMode.p2 !== "keyboard" && !mobileControls.p2.leftPressed) {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            
            handleDirSpecial(this, p2, 'left', this.time.now, p1);
            mobileControls.p2.leftPressed = false;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.right) || mobileControls.p2.rightPressed) {
            p2.lastInput.right = this.time.now;
            if (inputMode.p2 !== "keyboard" && !mobileControls.p2.rightPressed) {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            handleDirSpecial(this, p2, 'right', this.time.now, p1);
            mobileControls.p2.rightPressed = false;
        }

        if (!p2.hasHitSideSpecial && p2.isUsingSideSpecial && fiveframecount === 5) {
            handleDirSpecialAttack(this, p2, p1);
        }

        if (cursors.left.isDown || mobileControls.p2.left) {
            if (!p2.isUsingSideSpecial) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p2.id,
                    type: Commands.LEFT
                });
            }
        }
        else if (cursors.right.isDown || mobileControls.p2.right) {
            if (!p2.isUsingSideSpecial) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p2.id,
                    type: Commands.RIGHT
                });
            }
        }
        else {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.NONE
            });
        }

        if ((cursors.up.isDown || mobileControls.p2.up) && p2.body.touching.down) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.UP
            });
        }

        if (p2.body.touching.down) {
            p2.hasDoubleJumped = false;
        }

        if (p2.body.blocked.down && p2.isUsingSideSpecial === false) {
            p2.afterimage = false;
        }

        if (
            (Phaser.Input.Keyboard.JustDown(cursors.up) || mobileControls.p2.upPressed)
        ) {
            const quickslamJumped = tryQuickslamJump(this, p2, this.time.now);
            if (!quickslamJumped && !p2.body.touching.down && !p2.hasDoubleJumped) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p2.id,
                    type: Commands.DOUBLE_UP
                });
            }
            p2.lastInput.up = this.time.now;
            if (inputMode.p2 !== "keyboard" && !mobileControls.p2.upPressed) {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            mobileControls.p2.upPressed = false;
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.down) || mobileControls.p2.downPressed) {
            p2.lastInput.down = this.time.now;
            if (inputMode.p2 !== "keyboard" && !mobileControls.p2.downPressed) {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            mobileControls.p2.downPressed = false;
        }

        const usingMobile = this.sys.game.device.input.touch;


        const jumpReleased2 =
            inputMode.p2 === "touch"
                ? !mobileControls.p2.up
                : cursors.up.isUp;

        if (jumpReleased2 && p2.body.velocity.y < 0 && !p2.hasDoubleJumped) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.UP_CANCEL
            });
        }
        if ((cursors.down.isDown || mobileControls.p2.down) && p2.airTime >= 1000) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.DOWNSLAM
            });
        }

        //second directional special/tilt attack

        for (const direction in cursors) {
            const key = cursors[direction];
            if (Phaser.Input.Keyboard.JustDown(key)) {
                p2.lastInput[direction] = this.time.now;
            }
        }
    }
    //PRIORITY
    for (const player of [p1, p2]) {
        if (player.freeze) {
            if (player.freezeGravity === null) {
                player.freezeGravity = player.body.allowGravity;
            }
            player.body.allowGravity = false;
            player.setVelocity(0, 0);
        } else if (player.freezeGravity !== null) {
            player.body.allowGravity = player.freezeGravity;
            player.freezeGravity = null;
        }
    }

    updateSledgehammerAnimation(p1);
    updateSledgehammerAnimation(p2);

    //WIN CONDITION -- DETECT IF PLAYER IS LAUNCHED FAR OFF SCREEN

    if (!this.gameEnded && !this.winCooldown) {

        if (p1.outOfBounds) {
            this.winCooldown = true;
            p2.winNumber = p2.winNumber + 1;

            if (modifierOptions.SUDDEN_DEATH.enabled) {
                p1.KBmultiplier = 4.00
            } else {
                p1.KBmultiplier = 1.00;
            }

            console.log(p2.winNumber)
            updateWins(this);
            teleportBackToArena(p1);
            
            this.time.delayedCall(1500, () => {
                this.winCooldown = false;
            });
        } else if (p2.outOfBounds) {
            this.winCooldown = true;
            p1.winNumber = p1.winNumber + 1;
            if (modifierOptions.SUDDEN_DEATH.enabled) {
                p2.KBmultiplier = 4.00
            } else {
                p2.KBmultiplier = 1.00;
            }
            updateWins(this);
            teleportBackToArena(p2);
            
            this.time.delayedCall(1500, () => {
                this.winCooldown = false;
            });
        }

        if (p1.winNumber >= winNumber || p2.winNumber >= winNumber) {
            if (p1.outOfBounds) {
                this.gameEnded = true;
                const winner = this.add.text(500, 150, p2.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#00008B' }).setOrigin(0.5).setStroke('#000000', 5);
                this.hud.add(winner);
            } else if (p2.outOfBounds) {
                this.gameEnded = true;
                const winner = this.add.text(500, 150, p1.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#8B0000' }).setOrigin(0.5).setStroke('#000000', 5);
                this.hud.add(winner);
            }
            restartBtn.setVisible(true);
            homeBtn.setVisible(true);
        }
    }
    updateKB(this);
    if (botMode) {
        runBotAI(this, p2, p1);
    }
    updateWeatherHazard(this);
    if (fiveframecount >= 5) {
        fiveframecount = 0;
    }
}
