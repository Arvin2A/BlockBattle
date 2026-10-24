import Phaser from 'phaser';
import {handleAttack, handleDirSpecial, handleNeutralSpecial, handleDirSpecialAttack, handleHorizantalTilt, handleDownTilt, handleUpTilt, downslamAttack, updateScythemanGrass, updateChainsawWood, toggleChainsawMode, tryQuickslamJump, positionAttackSprite, hasIdleAttackSprite, getAttackSpriteOffset, getAttackSpriteAngle, getAttackSpriteFlipX, triggerScreenShake, spawnDirtBurst, spawnExplosion} from './attacks.js';
import { COLORS, FONTS, makePanel, playerColor, playerHex, textStyle } from './ui/theme.js';
import { addTouchAssist } from './ui/touchAssist.js';
import { MAX_WOOD_COUNT } from './playerAttackScripts/axeman.js';
import { initiatePlayers, updateCombo } from './players.js';
import { Commands, executeStateCommand} from './commands.js';
import { MenuScene } from './scenes/MenuScene.js';
import { fadeOutTo } from './scenes/transitions.js';
import { player1Character, player2Character, player1Variant, player2Variant, CharacterSelectScene } from './scenes/CharacterSelectScreen.js';
import { MapAndModifierSelectScene, getMatchMapDefinition, resetMapAndModifierSelection } from './scenes/MapAndModifierSelect.js';
import { preload } from './scenes/GameScene/preload.js';
import { createGameAnimations } from './scenes/GameScene/animations.js';
import { runBotAI } from './scenes/GameScene/botAI.js';
import { runBotAI as runLegacyBotAI } from './scenes/GameScene/botAILegacy.js'; // BENCHMARK-TEMP
import { Map } from './scenes/GameScene/Map.js';
import { modifierOptions } from './scenes/MapAndModifierSelect.js';
import UIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import unmuteAudio from 'unmute-ios-audio';
import { botMode, simulationMode, changeBotMode } from './gameSettings.js';
import { createInputState, applyInputFrame, consumePress, emptyControllerInput } from './input.js';
import { isAuthority, beginAuthorityCapture, attachAuthority, createAuthorityGame, getOnlinePlayerNames, pollNetworkInput, reportMatchEnd } from './mp/authority.js';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene.js';
import { OnlineGameScene, OnlineOverlayScene } from './scenes/OnlineGameScene.js';
import { ControllerSetupScene, controllerInputs } from './scenes/ControllerSetupScene.js';

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
//WASD and arrow keys control the players; E/SHIFT attack, Q / FORWARD SLASH use special and LEFT ALT / RIGHT ALT switch chainsaw mode.

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

// The match itself. Its create/update still live below as functions over this
// file's match state; moving them onto the class is the next step.
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        preload.call(this);
    }

    create() {
        create.call(this);
    }

    update() {
        update.call(this);
    }
}

if ('audioSession' in navigator) {
    navigator.audioSession.type = 'playback';
}
export var config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    parent: 'game',
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
    scene: [ControllerSetupScene, MenuScene, MapAndModifierSelectScene, CharacterSelectScene, GameScene, OnlineLobbyScene, OnlineGameScene, OnlineOverlayScene]
};

var game;

loadFont().then(() => {
    // The LAN server opens the game with ?authority=... to run an online match.
    game = isAuthority()
        ? createAuthorityGame(Phaser, config, GameScene)
        : new Phaser.Game(config);
    if (!isAuthority()) game.events.once('ready', () => addButtonHoverSounds(game));
});

// Every interactive object in these scenes is UI, so hovering any of them plays
// buttonhover. A scene's input listeners are cleared on shutdown, so this is
// re-added each time the scene is created.
function addButtonHoverSounds(game) {
    const listen = scene => scene.input.on('gameobjectover', () => {
        if (scene.cache.audio.exists('buttonhover')) scene.sound.play('buttonhover');
    });
    for (const scene of game.scene.scenes) {
        // The first scene may already be created by the time the game is ready.
        if (scene.sys.settings.status === Phaser.Scenes.RUNNING) listen(scene);
        scene.events.on('create', () => listen(scene));
    }
}

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
        attackPressed: false,
        special: false,
        specialPressed: false
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
        attackPressed: false,
        special: false,
        specialPressed: false
    }
};

var winBar;
var restartBtn;
// The win-screen buttons are drawn square; this squashes them to be shorter.
const WIN_BUTTON_SCALE_Y = 0.24;
var restartBtnPressed;

var homeBtn;
var homeBtnPressed;

function createSpecialMeters(scene) {
    scene.specialMeters = {};
    const meterWidth = 160;
    const meterHeight = 18;
    const p2MeterColor = scene.botMode ? 0x808080 : 0x00aaff;
    const meters = [
        { key: 'p1', player: scene.gameState.players.player, x: 205, color: 0xf54242, label: 'P1 ABILITY' },
        { key: 'p2', player: scene.gameState.players.player2, x: 795, color: p2MeterColor, label: 'P2 ABILITY' }
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
        scene.specialMeters[meter.key] = {
            key: meter.key,
            player: meter.player,
            fill,
            status,
            meterWidth
        };
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
            const woodFill = scene.add.rectangle(meter.x - meterWidth / 2, woodMeterY, meterWidth, meterHeight, 0x8B4513)
                .setOrigin(0, 0.5)
                .setDisplaySize(0, meterHeight);
            const woodStatus = scene.add.text(meter.x, woodMeterY + 22, `0 / ${MAX_WOOD_COUNT}`, {
                fontFamily: 'GameFont',
                fontSize: '12px',
                fill: '#ffffff'
            }).setOrigin(0.5);

            scene.hud.add(woodLabel);
            scene.hud.add(woodBackground);
            scene.hud.add(woodFill);
            scene.hud.add(woodStatus);
            
            const specialMeter = scene.specialMeters[meter.key];
            specialMeter.woodFill = woodFill;
            specialMeter.woodStatus = woodStatus;
            specialMeter.woodMaxValue = MAX_WOOD_COUNT;
        }
    });
    scene.specialPrompt = scene.add.text(500, 180, 'DOUBLE TAP OR SPECIAL + LEFT/RIGHT TO USE ABILITY', {
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
        if (meter.woodFill) {
            const woodAmount = player.woodCount ?? 0;
            const woodProgress = Phaser.Math.Clamp(
                woodAmount / meter.woodMaxValue,
                0,
                1
            );
            meter.woodFill.setDisplaySize(meterWidth * woodProgress, 18);
            meter.woodStatus.setText(`${Math.floor(woodAmount)} / ${meter.woodMaxValue}`);
        }

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
        !scene.simulationMode &&
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

// Reads this computer's keyboard, touch buttons and controller for one player.
// Online, the authority uses pollNetworkInput instead (see readPlayerInputs).
function pollLocalInput(scene, slot) {
    const isP1 = slot === 'p1';
    const keys = isP1 ? wasd : cursors;
    const attackKey = isP1 ? attackKey1 : attackKey2;
    const modeKey = isP1 ? chainsawModeKey1 : chainsawModeKey2;
    const mobile = mobileControls[slot];
    const pad = !isP1 && botMode ? emptyControllerInput() : controllerInputs[slot];
    const altDown = isP1 ? scene.p1LeftAltDown : scene.p2RightAltDown;
    const altPressed = isP1 ? scene.p1LeftAltPressed : scene.p2RightAltPressed;
    const JustDown = Phaser.Input.Keyboard.JustDown;

    const touch = {
        left: mobile.leftPressed,
        right: mobile.rightPressed,
        up: mobile.upPressed,
        down: mobile.downPressed,
        attack: mobile.attackPressed,
        special: mobile.specialPressed,
        misc: false
    };
    const frame = {
        held: {
            left: keys.left.isDown || mobile.left || pad.left,
            right: keys.right.isDown || mobile.right || pad.right,
            up: keys.up.isDown || mobile.up || pad.up,
            down: keys.down.isDown || mobile.down || pad.down,
            attack: attackKey.isDown || mobile.attack || pad.attack,
            special: modeKey.isDown || mobile.special || pad.special,
            misc: altDown || pad.misc
        },
        pressed: {
            left: JustDown(keys.left) || touch.left || pad.leftPressed,
            right: JustDown(keys.right) || touch.right || pad.rightPressed,
            up: JustDown(keys.up) || touch.up || pad.upPressed,
            down: JustDown(keys.down) || touch.down || pad.downPressed,
            attack: JustDown(attackKey) || touch.attack || pad.attackPressed,
            special: JustDown(modeKey) || touch.special || pad.specialPressed,
            misc: altPressed || pad.miscPressed
        },
        touch
    };
    for (const button of Object.keys(touch)) mobile[button + 'Pressed'] = false;
    return frame;
}

function readPlayerInputs(scene) {
    for (const slot of ['p1', 'p2']) {
        const frame = scene.online ? pollNetworkInput(slot) : pollLocalInput(scene, slot);
        applyInputFrame(scene.playerInputs[slot], frame);
    }
    scene.p1LeftAltPressed = false;
    scene.p2RightAltPressed = false;
}

function updateMapHazard(scene) {
    const hazard = scene.mapHazard;
    if (!hazard) return;

    const now = scene.time.now;
    const active = scene.activeHazard;

    if (active) {
        if (now >= active.endsAt) {
            hazard.end?.(scene, active.state);
            scene.activeHazard = null;
        } else {
            hazard.update?.(scene, active.state, now);
        }
        return;
    }

    if (scene.matchStartTime !== null && now >= scene.nextHazardCheckAt) {
        scene.nextHazardCheckAt = now + (hazard.checkInterval ?? 5000);
        if (Math.random() < (hazard.chance ?? 0.5)) {
            scene.activeHazard = {
                state: hazard.start?.(scene) ?? {},
                endsAt: now + (hazard.duration ?? 5000)
            };
        }
    }
}

function releaseMobileControls() {
    for (const controls of Object.values(mobileControls)) {
        for (const key of Object.keys(controls)) {
            controls[key] = false;
        }
    }
}

function create() {
    // online = this scene is the authority for a LAN match (inputs come from the network).
    this.online = isAuthority();
    if (this.online) beginAuthorityCapture(this);
    this.playerInputs = { p1: createInputState(), p2: createInputState() };
    this.gamePaused = false;
    this.time.paused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.sound.resumeAll();
    fiveframecount = 0;
    releaseMobileControls();
    inputMode.p1 = 'touch';
    inputMode.p2 = 'touch';

    // iOS can swallow a touch's end (system gesture, notification, app switch),
    // which would leave an on-screen button held forever.
    this.game.events.on('blur', releaseMobileControls);
    this.game.events.on('hidden', releaseMobileControls);
    this.events.once('shutdown', () => {
        this.gamePaused = false;
        fiveframecount = 0;
        releaseMobileControls();
        this.game.events.off('blur', releaseMobileControls);
        this.game.events.off('hidden', releaseMobileControls);
    });

    this.gameEnded = false;
    this.winCooldown = false;
    this.shake = null;
    this.shakeOffset = { x: 0, y: 0 };
    this.matchStartTime = null;
    this.mapHazard = null;
    this.activeHazard = null;
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
    this.simulationMode = simulationMode;
    this.input.addPointer(5);
    this.baseZoom = 1;
    this.hitFreezeUntil = 0;
    this.hitFreezeUltra = false;
    this.deathRayAttackLockUntil = 0;
    this.hitFocus = null;
    this.hud = this.add.container(0, 0);
    this.objs = this.add.container(0,0);
    this.objcam = this.cameras.add(0,0,1000,600, false, "hudCam");
    this.mobileButtons = {
        p1: [],
        p2: []
    }
    const mapDefinition = getMatchMapDefinition();
    this.gameState.map = new Map(this, mapDefinition);
    if (modifierOptions.MAP_HAZARDS.enabled) {
        this.mapHazard = mapDefinition.hazard ?? null;
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
    restartBtn.setScale(0.25);
    restartBtn.setVisible(false);
    this.hud.add(restartBtn);

    restartBtnPressed = this.add.image(425,450, 'restartBtnPressed');
    restartBtnPressed.setScale(0.25);
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
            fadeOutTo(this, () => {
                this.sound.stopAll();
                this.scene.restart();
            });
        });
    });

    homeBtn = this.add.image(600,450, 'gohomeBtn');
    homeBtn.setScale(0.25);
    homeBtn.setVisible(false);
    this.hud.add(homeBtn);

    homeBtnPressed = this.add.image(600,450, 'gohomeBtnPressed');
    homeBtnPressed.setScale(0.25);
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
            fadeOutTo(this, () => {
                this.sound.stopAll();
                resetMapAndModifierSelection();
                this.scene.start('MenuScene');
            });
        });
    });




    const plr1StatImage = this.add.image(300, 65, 'redstat');
    plr1StatImage.setScale(0.65);
    const plr2StatID  = botMode ? 'botstat' : 'bluestat';
    const plr2StatImage = this.add.image(700, 65, plr2StatID);
    plr2StatImage.setScale(0.65);
    this.hud.add(plr1StatImage);
    this.hud.add(plr2StatImage);

    const p1guide = this.add.image(450, 65, 'p1guide');
    p1guide.setAlpha(0.65);
    this.hud.add(p1guide);
    const p2guide = this.add.image(850, 65, 'p2guide');
    p2guide.setAlpha(0.65);
    this.hud.add(p2guide);
    if (this.online || simulationMode) {
        // Online players can use either key layout, so these hints would just confuse.
        // In a simulation nobody is playing, so there's nothing to show.
        p1guide.setVisible(false);
        p2guide.setVisible(false);
    }

    //platform.refreshBody();

    createGameAnimations(this);

    //mobile support:
    const isMobile = this.sys.game.device.input.touch;

    // Every touch button, so a near-miss tap can press the closest one (ui/touchAssist.js).
    const touchButtons = [];
    if (isMobile) {
        addTouchAssist(this, touchButtons);

        function makeButton(scene, x, y, text, keyRef) {

            const btn = scene.add.circle(x, y, 45, 0x000000, 0.45)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive();

            const label = scene.add.text(x, y, text, {
                fontSize: '48px',
                color: '#ffffff',
                fontFamily: FONTS.body
            })
            .setOrigin(0.5)
            .setAlpha(0.5)
            .setScrollFactor(0)
            .setDepth(1000);

            btn.activePointerID = null;

            const press = (pointer) => {
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
                btn.setFillStyle(0xFFFFFF, 0.5);
            };
            const release = (pointer) => {
                if (pointer.id === btn.activePointerID) {
                    keyRef.obj[keyRef.key] = false;
                    btn.activePointerID = null;
                    btn.setFillStyle(0x000000, 0.5);
                }
            };

            btn.on('pointerdown', press);
            btn.on('pointerup', release);
            btn.on('pointerout', release);
            btn.on('pointerupoutside', release);
            touchButtons.push({ circle: btn, press, release });

            scene.hud.add(btn);
            scene.hud.add(label);
            return btn;
        }

        const p1 = mobileControls.p1;
        const p2 = mobileControls.p2;

        const p1Buttons = botMode ? [
            [60, 420, '←', p1, 'left'],
            [240, 420, '→', p1, 'right'],
            [150, 330, '↑', p1, 'up'],
            [150, 420, '↓', p1, 'down'],
            [850, 420, 'A', p1, 'attack'],
            [940, 330, 'S', p1, 'special']
        ] : [
            [60, 420, '←', p1, 'left'],
            [240, 420, '→', p1, 'right'],
            [150, 330, '↑', p1, 'up'],
            [150, 420, '↓', p1, 'down'],
            [240, 330, 'A', p1, 'attack'],
            [60, 330, 'S', p1, 'special']
        ];

        //P2
        const p2Buttons = [
            [740, 420, '←', p2, 'left'],
            [920, 420, '→', p2, 'right'],
            [830, 330, '↑', p2, 'up'],
            [830, 420, '↓', p2, 'down'],
            [740, 330, 'A', p2, 'attack'],
            [920, 330, 'S', p2, 'special']
        ];

        // CPUs don't get buttons at all: a hidden circle would still leave its label behind.
        if (!simulationMode) p1Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            });
            this.mobileButtons.p1.push(butn);
        });

        if (!botMode) p2Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            });
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
            if (botMode && player.id === 2) continue;
            if (simulationMode) continue;

            const x = player.id === 1 ? (botMode ? 760 : 330) : 650;
            const button = this.add.circle(x, 420, botMode ? 45 : 34, 0x000000, 0.55)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive();
            const label = this.add.text(x, 420, 'ALT', {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: 'VCROSD'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            const toggleMode = () => {
                inputMode[player.id === 1 ? 'p1' : 'p2'] = 'touch';
                toggleChainsawMode(this, player);
            };
            button.on('pointerdown', toggleMode);
            touchButtons.push({ circle: button, press: toggleMode, release: () => {} });
            this.hud.add(button);
            this.hud.add(label);
            player.modeSwitchButton = button;
        }
    }
    createSpecialMeters(this);
    startCharacterIntros(this);

    if (this.online) {
        const names = getOnlinePlayerNames();
        for (const [slot, player] of [['p1', this.gameState.players.player], ['p2', this.gameState.players.player2]]) {
            player.header.setText(names?.[slot] ?? slot.toUpperCase());
            player.header.setOrigin(0.5, 0);
        }
    }

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

        player.slot = key === 'player' ? 'p1' : 'p2';
        player.stats = { kos: 0, maxKB: player.KBmultiplier, damageDealt: 0 };
        player.statsLastKB = player.KBmultiplier;
        player.wasGrounded = true;
        player.launchTrail = this.add.particles(player.x, player.y, '__WHITE', {
            x: { min: -6, max: 6 },
            y: { min: -6, max: 6 },
            speed: { min: 10, max: 40 },
            scale: { start: 3.5, end: 0 },
            alpha: { start: 0.55, end: 0 },
            tint: [0xffffff, 0xdddddd, 0xaaaaaa],
            lifespan: 450,
            frequency: 20,
            quantity: 2,
            emitting: false
        });
        this.objs.addAt(player.launchTrail, this.objs.getIndex(player));
        player.violentTrail = this.add.particles(player.x, player.y, '__WHITE', {
            x: { min: -8, max: 8 },
            y: { min: -8, max: 8 },
            speed: { min: 20, max: 70 },
            scale: { start: 4.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xff2020, 0xb00000, 0xff6060],
            lifespan: 550,
            frequency: 12,
            quantity: 3,
            emitting: false
        });
        this.objs.addAt(player.violentTrail, this.objs.getIndex(player));
        player.ultraTrail = this.add.particles(player.x, player.y, '__WHITE', {
            x: { min: -10, max: 10 },
            y: { min: -10, max: 10 },
            speed: { min: 30, max: 110 },
            scale: { start: 5.5, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: [0x9b30ff, 0xc58bff, 0xffffff],
            lifespan: 650,
            frequency: 8,
            quantity: 4,
            emitting: false
        });
        this.objs.addAt(player.ultraTrail, this.objs.getIndex(player));
    }

    const keys = Object.keys(this.gameState.players);

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const playerA = this.gameState.players[keys[i]];
            const playerB = this.gameState.players[keys[j]];
            // Players block each other unless one is dashing through (QUICKSTEP).
            this.playerCollisionCollider = this.physics.add.collider(playerA, playerB, null,
                (a, b) => !a.clipThroughPlayers && !b.clipThroughPlayers);
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
    

    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    chainsawModeKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    chainsawModeKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH);

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.p1LeftAltDown = false;
    this.p1LeftAltPressed = false;
    this.p2RightAltDown = false;
    this.p2RightAltPressed = false;
    this.onP1LeftAltDown = event => {
        if (event.code !== 'AltLeft') return;
        if (!this.p1LeftAltDown) this.p1LeftAltPressed = true;
        this.p1LeftAltDown = true;
    };
    this.onP1LeftAltUp = event => {
        if (event.code === 'AltLeft') this.p1LeftAltDown = false;
    };
    this.onP2RightAltDown = event => {
        if (event.code !== 'AltRight') return;
        if (!this.p2RightAltDown) this.p2RightAltPressed = true;
        this.p2RightAltDown = true;
    };
    this.onP2RightAltUp = event => {
        if (event.code === 'AltRight') this.p2RightAltDown = false;
    };
    this.input.keyboard.on('keydown', this.onP1LeftAltDown);
    this.input.keyboard.on('keyup', this.onP1LeftAltUp);
    this.input.keyboard.on('keydown', this.onP2RightAltDown);
    this.input.keyboard.on('keyup', this.onP2RightAltUp);
    this.events.once('shutdown', () => {
        this.input.keyboard.off('keydown', this.onP1LeftAltDown);
        this.input.keyboard.off('keyup', this.onP1LeftAltUp);
        this.input.keyboard.off('keydown', this.onP2RightAltDown);
        this.input.keyboard.off('keyup', this.onP2RightAltUp);
    });

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
                    endCharacterIntros(this);
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
        fadeOutTo(this, () => {
            this.sound.stopAll();
            resetMapAndModifierSelection();
            this.scene.start('MenuScene');
        });
    });

    if (this.online) {
        // Nobody can pause a match that two people are playing.
        this.pauseButton.setVisible(false).disableInteractive();
        attachAuthority(this);
    }
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
    player.activeHookCleanup?.();
    player.setPosition(1000, 0);
    player.setVelocityY(0);
    player.setVelocityX(0);
}
const accelFactor = 20;

const baseZoom = 1;
const minZoom = 0.6;
const HIT_FOCUS_ZOOM = 2.4;
const defaultMaxZoom = 1.4;

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

    if (player.heavyLaunch) {
        const ghostTint = player.ultraLaunch ? 0x9b30ff : player.violentLaunch ? 0xff2020 : 0xffffff;
        ghost.setTint(ghostTint).setTintMode(Phaser.TintModes.FILL);
        ghost.setAlpha(0.7);
    } else {
        ghost.setAlpha(0.5);
    }

    ghost.setDepth(player.depth - 1);
    scene.objs.add(ghost);
    scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 100,
        onComplete: () => ghost.destroy()
    });
}

const DANGER_KB = 2.0;
const DUST_COLORS = [0xffffff, 0xdddddd, 0xbbbbbb];

function updateLaunchEffects(scene, player) {
    const { x: vx, y: vy } = player.body.velocity;
    const speed = Math.hypot(vx, vy);
    const grounded = player.body.blocked.down || player.body.touching.down;

    if (player.heavyLaunch && scene.time.now - player.heavyLaunchAt > 150 &&
        (speed < 500 || grounded)) {
        player.heavyLaunch = false;
        player.violentLaunch = false;
        player.ultraLaunch = false;
        if (!player.downslamming && !player.isUsingSideSpecial) player.afterimage = false;
    }

    const trailing = player.heavyLaunch && speed > 20;
    for (const [trail, active] of [
        [player.launchTrail, trailing && !player.violentLaunch],
        [player.violentTrail, trailing && player.violentLaunch && !player.ultraLaunch],
        [player.ultraTrail, trailing && player.ultraLaunch]
    ]) {
        if (active) {
            trail.setPosition(player.x - (vx / speed) * 15, player.y - (vy / speed) * 15);
            if (!trail.emitting) trail.start();
        } else if (trail.emitting) {
            trail.stop();
        }
    }

    if (grounded && !player.wasGrounded && (player.lastFallSpeed ?? 0) > 250) {
        spawnDirtBurst(scene, player.x, player.body.bottom, 8, 3, 6,
            Math.min(1.6, player.lastFallSpeed / 500), DUST_COLORS, 160, 260);
    }
    player.wasGrounded = grounded;
    player.lastFallSpeed = vy;
}

function updateDangerGlow(scene, player) {
    const rampaging = scene.time.now < (player.rampageUntil ?? 0);
    if (player.KBmultiplier >= DANGER_KB && !rampaging) {
        const rate = 0.008 + (player.KBmultiplier - DANGER_KB) * 0.004;
        const pulse = (Math.sin(scene.time.now * rate) + 1) / 2;
        const gb = Math.round(255 - pulse * 150);
        player.setTint((0xff << 16) | (gb << 8) | gb);
        player.dangerTinted = true;
    } else if (player.dangerTinted) {
        player.dangerTinted = false;
        if (!rampaging) player.clearTint();
    }
}

function updateMatchStats(player, opponent) {
    const gained = player.KBmultiplier - player.statsLastKB;
    if (gained > 0) opponent.stats.damageDealt += gained * 100;
    player.stats.maxKB = Math.max(player.stats.maxKB, player.KBmultiplier);
    player.statsLastKB = player.KBmultiplier;
}

// A beam in the scorer's color fired back into the arena from where the loser left it.
function spawnKOBlast(scene, loser, scorer) {
    const view = scene.cameras.main.worldView;
    const edgeX = Phaser.Math.Clamp(loser.x, view.x, view.right);
    const edgeY = Phaser.Math.Clamp(loser.y, view.y, view.bottom);
    const angle = Math.atan2(view.centerY - edgeY, view.centerX - edgeX);
    const length = Math.hypot(view.width, view.height);

    const beam = scene.add.rectangle(edgeX, edgeY, length, 120, playerHex(scorer.slot))
        .setOrigin(0, 0.5).setRotation(angle).setDepth(50).setScale(0.2, 1);
    const core = scene.add.rectangle(edgeX, edgeY, length, 40, 0xffffff)
        .setOrigin(0, 0.5).setRotation(angle).setDepth(51).setScale(0.2, 1);
    scene.objs.add(beam);
    scene.objs.add(core);
    scene.tweens.add({ targets: [beam, core], scaleX: 1, duration: 120, ease: 'Cubic.easeOut' });
    scene.tweens.add({
        targets: [beam, core],
        scaleY: 0,
        alpha: 0,
        delay: 150,
        duration: 450,
        ease: 'Cubic.easeIn',
        onComplete: () => {
            beam.destroy();
            core.destroy();
        }
    });
    spawnExplosion(scene, { x: edgeX, y: edgeY }, 1.2);
    triggerScreenShake(scene, 12, 400);
    scene.sound.play('explosion');
}

function playRespawn(scene, player) {
    const column = scene.add.rectangle(player.x, 0, 70, 1200, 0xffffff, 0.8)
        .setOrigin(0.5, 0).setDepth(50);
    scene.objs.add(column);
    scene.tweens.add({
        targets: column,
        scaleX: 0,
        alpha: 0,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => column.destroy()
    });
    player.respawnTween?.stop();
    player.setAlpha(1);
    player.respawnTween = scene.tweens.add({
        targets: player,
        alpha: 0.25,
        duration: 125,
        yoyo: true,
        repeat: 5,
        onComplete: () => player.setAlpha(1)
    });
}

function showMatchEnd(scene, winner, loser) {
    for (const player of [winner, loser]) {
        player.launchTrail.stop();
        player.violentTrail.stop();
        player.ultraTrail.stop();
        player.heavyLaunch = false;
        player.violentLaunch = false;
        player.ultraLaunch = false;
        player.afterimage = false;
        if (player.dangerTinted) {
            player.dangerTinted = false;
            player.clearTint();
        }
    }

    scene.tweens.killTweensOf(scene.specialPrompt);
    scene.specialPrompt.setVisible(false);

    const flash = scene.add.rectangle(500, 300, 1000, 600, 0xffffff, 1);
    const topBar = scene.add.rectangle(500, -35, 1000, 70, 0x000000);
    const bottomBar = scene.add.rectangle(500, 635, 1000, 70, 0x000000);
    const stamp = scene.add.text(500, 270, 'GAME!', textStyle('title', {
        fontSize: '96px',
        strokeThickness: 10
    })).setOrigin(0.5).setScale(3).setAlpha(0);
    scene.hud.add([topBar, bottomBar, stamp, flash]);

    scene.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    scene.tweens.add({ targets: topBar, y: 35, duration: 300, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: bottomBar, y: 565, duration: 300, ease: 'Cubic.easeOut' });
    scene.tweens.add({
        targets: stamp,
        scale: 1,
        alpha: 1,
        delay: 150,
        duration: 350,
        ease: 'Back.easeOut',
        onComplete: () => {
            triggerScreenShake(scene, 14, 400);
            scene.sound.play('slamimpact');
        }
    });

    // Online players get their results from the overlay scene instead.
    if (scene.online) return;

    scene.time.delayedCall(1400, () => {
        scene.tweens.add({ targets: stamp, alpha: 0, scale: 0.6, duration: 250, onComplete: () => stamp.destroy() });
        showResultsPanel(scene, winner);
    });
}

function showResultsPanel(scene, winner) {
    const p1 = scene.gameState.players.player;
    const p2 = scene.gameState.players.player2;
    const formatKB = multiplier => `${((multiplier * 100) - 100).toFixed(1)}%`;
    const rows = [
        ['KOS', p => `${p.stats.kos}`],
        ['MAX KB', p => formatKB(p.stats.maxKB)],
        ['DAMAGE', p => `${p.stats.damageDealt.toFixed(1)}%`]
    ];

    const backdrop = scene.add.rectangle(500, 300, 1000, 600, 0x000000, 0.45).setAlpha(0);
    // Each text is typed out in this order once the panel lands.
    const typed = [
        [scene.add.text(500, 145, '', textStyle('title', {
            fontSize: '40px',
            fill: playerColor(winner.slot)
        })).setOrigin(0.5), `${winner.name} WINS!`],
        [scene.add.text(390, 195, '', textStyle('title', { fontSize: '18px', fill: COLORS.p1, strokeThickness: 3 })).setOrigin(0.5), p1.name],
        [scene.add.text(610, 195, '', textStyle('title', { fontSize: '18px', fill: COLORS.p2, strokeThickness: 3 })).setOrigin(0.5), p2.name]
    ];
    rows.forEach(([label, value], index) => {
        const y = 240 + index * 40;
        typed.push(
            [scene.add.text(390, y, '', textStyle('body', { fill: p1 === winner ? COLORS.accent : COLORS.text })).setOrigin(0.5), value(p1)],
            [scene.add.text(500, y, '', textStyle('body', { fontSize: '18px', fill: COLORS.muted })).setOrigin(0.5), label],
            [scene.add.text(610, y, '', textStyle('body', { fill: p2 === winner ? COLORS.accent : COLORS.text })).setOrigin(0.5), value(p2)]
        );
    });

    const panel = scene.add.container(0, -450, [
        makePanel(scene, 500, 245, 620, 270),
        ...typed.map(([text]) => text)
    ]);
    scene.hud.add([backdrop, panel]);
    scene.tweens.add({ targets: backdrop, alpha: 1, duration: 300 });
    scene.tweens.add({
        targets: panel,
        y: 0,
        duration: 650,
        ease: 'Bounce.easeOut',
        onComplete: () => typewrite(scene, typed)
    });

    const buttons = [restartBtn, homeBtn];
    for (const button of [restartBtn, restartBtnPressed, homeBtn, homeBtnPressed]) {
        scene.hud.bringToTop(button);
    }
    buttons.forEach((button, index) => {
        const restingY = button.y;
        button.setY(-100).setVisible(true);
        scene.tweens.add({
            targets: button,
            y: restingY,
            delay: 450 + index * 120,
            duration: 650,
            ease: 'Bounce.easeOut'
        });
    });
}

// Types each [textObject, fullText] pair out one letter at a time, in order.
function typewrite(scene, queue, letterMs = 35) {
    let item = 0;
    let letters = 0;
    const event = scene.time.addEvent({
        delay: letterMs,
        loop: true,
        callback: () => {
            // A slow frame can fire this more than once after the last letter.
            if (item >= queue.length) return;
            const [text, full] = queue[item];
            letters += 1;
            text.setText(full.slice(0, letters));
            if (full[letters - 1] !== ' ') scene.sound.play('hover', { volume: 0.25 });
            if (letters >= full.length) {
                item += 1;
                letters = 0;
                if (item >= queue.length) event.remove();
            }
        }
    });
}

const SWORD_THIRD_HOLD_MS = 250;

// Shifts each intro frame (drawn facing right) so it lines up with the player.
// The swordman intro draws the fighter off-centre so the weapon has room; the
// mallet intro only draws the mallet, matched to where the idle mallet sits.
// The fisherman intro draws his arms centred in the frame instead of off to the
// left like rodatk, so its last frame is matched to where the idle rod sits.
const INTRO_OFFSETS = {
    swordman: { x: 31, y: 0 },
    hammerman: { x: 20, y: -2 },
    fisherman: { x: 0, y: 1 }
};

const INTRO_SCALES = {
    fisherman: 0.6
};

const INTRO_SOUNDS = {
    hammerman: { frame: 11, key: 'glassbreak' }
};


function startCharacterIntros(scene) {
    for (const player of Object.values(scene.gameState.players)) {
        const key = `${player.texture.key}intro`;
        if (!scene.anims.exists(key)) continue;
        const intro = scene.add.sprite(player.x, player.y, key)
            .setDepth(player.depth)
            .setFlipX(player.lastDir.x < 0)
            .setScale(INTRO_SCALES[player.texture.key] ?? 1);
        scene.objs.add(intro);
        const introSound = INTRO_SOUNDS[player.texture.key];
        if (introSound) {
            intro.on('animationupdate', (anim, frame) => {
                if (frame.textureFrame === introSound.frame) scene.sound.play(introSound.key);
            });
        }
        intro.play(key);
        player.introSprite = intro;
        player.atk.setVisible(false);
        updateCharacterIntro(player);
    }
}

function updateCharacterIntro(player) {
    const intro = player.introSprite;
    if (!intro) return;
    const facing = player.lastDir.x < 0 ? -1 : 1;
    const offset = INTRO_OFFSETS[player.texture.key] ?? { x: 0, y: 0 };
    intro.setPosition(player.x + offset.x * facing, player.y + offset.y);
    // The idle weapon pose is re-shown every frame; keep it hidden under the intro.
    player.atk.setVisible(false);
}

function endCharacterIntros(scene) {
    for (const player of Object.values(scene.gameState.players)) {
        if (!player.introSprite) continue;
        player.introSprite.destroy();
        player.introSprite = null;
        player.atk.setVisible(hasIdleAttackSprite(player));
    }
}

// LONGSWORD SWORDMAN holds his sword out on the first frame of swordatk
// whenever he isn't attacking, so his arms stay visible.
function updateSwordmanIdle(player) {
    if (player.name !== 'SWORDMAN' || !hasIdleAttackSprite(player)) return;
    if (player.isAttacking || player.activeGrab) return;
    const sprite = player.atk;

    if (sprite.anims.isPlaying) sprite.stop();
    // Hold the last frame of the previous swing instead of snapping back to
    // the idle pose: combo swings hold until the combo timer runs out, the
    // finishing swing holds for SWORD_THIRD_HOLD_MS after it ends.
    const lastAnim = player.lastAttackAnim;
    const holdCombo = player.combo > 0 &&
        (lastAnim === 'swordatk' || lastAnim === 'swordatksecond');
    const holdThird = lastAnim === 'swordatkthird' &&
        sprite.scene.time.now < (player.lastAttackEndTime ?? 0) + SWORD_THIRD_HOLD_MS;
    const holdAnim = holdCombo || holdThird ? sprite.scene.anims.get(lastAnim) : null;
    if (holdAnim) {
        const last = holdAnim.getLastFrame();
        if (sprite.texture.key !== last.textureKey) sprite.setTexture(last.textureKey);
        sprite.setFrame(last.textureFrame);
    } else {
        if (sprite.texture.key !== 'swordatk') sprite.setTexture('swordatk');
        sprite.setFrame(0);
    }
    sprite.setVisible(true);
    // Position comes from the per-frame atk placement in update(), so the
    // idle pose lines up with where attacks are drawn.
    sprite.setFlipX(-player.lastDir.x < 0);
    if (player.lastDir.y < 0) sprite.setAngle(90);
    else if (player.lastDir.y > 0) sprite.setAngle(-90);
    else sprite.setAngle(0);
}

// MALLET HAMMERMAN and ANGLER FISHERMAN hold their weapon out on the first
// frame of their swing whenever they aren't attacking, like the LONGSWORD idle above.
const IDLE_WEAPON_TEXTURES = {
    MALLET: 'hammeratk',
    ANGLER: 'rodatk'
};

function updateWeaponIdle(player) {
    // idleWeaponTexture lets a move swap the idle pose, like ANGLER's lineless rod while his hook is out.
    const idleTexture = player.idleWeaponTexture ?? IDLE_WEAPON_TEXTURES[player.variant];
    if (!idleTexture || player.isAttacking || player.activeGrab) return;
    const sprite = player.atk;

    // An overridden idle pose may be animating (ANGLER's reelin), so leave it running.
    if (!player.idleWeaponTexture || sprite.texture.key !== idleTexture) {
        if (sprite.anims.isPlaying) sprite.stop();
        if (sprite.texture.key !== idleTexture) sprite.setTexture(idleTexture);
        sprite.setFrame(0);
    }
    sprite.setVisible(true);
    // Re-placed here since update() placed it using the texture it had then.
    const offset = getAttackSpriteOffset(player, idleTexture);
    sprite.setPosition(
        player.x + player.lastDir.x * player.atkXOffset + offset.x,
        player.y + player.lastDir.y * player.atkYOffset - 15 + offset.y
    );
    sprite.setFlipX(getAttackSpriteFlipX(player, idleTexture));
    if (player.lastDir.y < 0) sprite.setAngle(90);
    else if (player.lastDir.y > 0) sprite.setAngle(-90);
    else sprite.setAngle(0);
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
                if (player.KBmultiplier >= 1.50) {
                    player.setTexture('slatemanphase1');
                    player.playerKBresistance = 1.5
                }
                if (player.KBmultiplier >= 2.00) {
                    player.setTexture('slatemanphase2');
                    player.playerKBresistance = 1
                }
                if (player.KBmultiplier >= 2.50) {
                    player.setTexture('slatemanphase3');
                    player.playerKBresistance = 0.5
                };

                player.playerSpeedScaling =
                    (150 + ((player.KBmultiplier - 1) * 150)) / 300;

                player.baseDamageScale =
                    1 - ((player.KBmultiplier - 1) * 0.35);

                player.baseDamageScale =
                    Math.max(0.1, player.baseDamageScale);
            }
        }
        player.plungeAura.setPosition(player.x, player.y);
        player.choppedMark.setPosition(player.x, player.y);
        if (player.shadow) updateGroundShadow(scene, player);

        if (player.slateTrail) {
            const { x: vx, y: vy } = player.body.velocity;
            const speed = Math.hypot(vx, vy);
            if (speed > 20) {
                player.slateTrail.setPosition(player.x - (vx / speed) * 20, player.y - (vy / speed) * 20 + 25);
                // setFrequency resets the emit timer, so only call it when plunge state flips.
                const plunging = Boolean(player.isPlunging);
                if (player.slateTrailPlunging !== plunging) {
                    player.slateTrailPlunging = plunging;
                    player.slateTrail.setFrequency(plunging ? 15 : 40, plunging ? 4 : 1);
                }
                if (!player.slateTrail.emitting) player.slateTrail.start();
            } else if (player.slateTrail.emitting) {
                player.slateTrail.stop();
            }
        }

        player.lastKBmultiplier = player.KBmultiplier;
        if (scene.time.now > player.nextSideSpecialTime && scene.time.now - player.nextSideSpecialTime < 100) {
            spawnBox();
        }
    }
}

// Puts the shadow on the highest ground/platform under the player's feet, hidden when there is none.
function updateGroundShadow(scene, player) {
    const feetY = player.body.bottom;
    let groundY = null;
    for (const platform of getMapPlatforms(scene)) {
        const { left, right, top } = platform.body;
        if (player.x < left || player.x > right || top < feetY - 2) continue;
        if (groundY === null || top < groundY) groundY = top;
    }
    player.shadow.setVisible(groundY !== null);
    if (groundY !== null) player.shadow.setPosition(player.x, groundY);
}

function getMapPlatforms(scene) {
    return [
        ...scene.gameState.map.platforms.getChildren(),
        ...scene.gameState.map.topPlatforms.getChildren()
    ].filter(platform => platform.active && platform.body?.enable);
}
function processPlatformCollide(player, platform) {
  return true;
}

function handlePlatformCollide(player, platform) {
  if (player.body.touching.down && platform.body.touching.up) {    
    player.currentPlatform = platform;
  }
}
export var fiveframecount = 0;

function update() {
    readPlayerInputs(this);
    if (this.gamePaused) return;

    fiveframecount += 1;
    

    const p1 = this.gameState.players.player;
    const p2 = this.gameState.players.player2;
    const in1 = this.playerInputs.p1;
    const in2 = this.playerInputs.p2;
    const p1LeftDown = in1.left;
    const p1RightDown = in1.right;
    const p1UpDown = in1.up;
    const p1DownDown = in1.down;
    const p2LeftDown = in2.left;
    const p2RightDown = in2.right;
    const p2UpDown = in2.up;
    const p2DownDown = in2.down;
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

    const maxZoom = this.gameState.map.definition.maxZoom ?? defaultMaxZoom;
    zoom = Phaser.Math.Clamp(zoom, minZoom, maxZoom);

    // A 200%+ launch: snap in close on the victim (not the midpoint, since
    // GUNMAN can launch someone from across the map) until the freeze ends.
    const focus = this.hitFocus?.active ? this.hitFocus : null;
    if (focus) {
        midX = focus.x;
        midY = focus.y;
        zoom = HIT_FOCUS_ZOOM;
    }
    const followRate = focus ? 0.35 : 0.12;
    const zoomRate = focus ? 0.3 : 0.05;

    // Take last frame's shake back out so it doesn't build up in the smoothing.
    this.cameras.main.scrollX -= this.shakeOffset.x;
    this.cameras.main.scrollY -= this.shakeOffset.y;

    this.cameras.main.scrollX += (
        midX - this.cameras.main.width / 2 - this.cameras.main.scrollX
    ) * followRate;

    this.cameras.main.scrollY += (
        midY - this.cameras.main.height / 2 - this.cameras.main.scrollY
    ) * followRate;

    this.shakeOffset.x = 0;
    this.shakeOffset.y = 0;
    if (this.shake && this.time.now < this.shake.until) {
        const left = (this.shake.until - this.time.now) / (this.shake.until - this.shake.start);
        const strength = this.shake.intensity * left / this.cameras.main.zoom;
        this.shakeOffset.x = Phaser.Math.FloatBetween(-strength, strength);
        this.shakeOffset.y = Phaser.Math.FloatBetween(-strength, strength);
    }
    this.cameras.main.scrollX += this.shakeOffset.x;
    this.cameras.main.scrollY += this.shakeOffset.y;

    this.cameras.main.zoom += (
        zoom - this.cameras.main.zoom
    ) * zoomRate;

    if (this.gameEnded) {
        p1.setVelocity(0, 0);
        p2.setVelocity(0, 0);
        return;
    }

    p1.hitstun = this.time.now < p1.hitstunUntil;
    p2.hitstun = this.time.now < p2.hitstunUntil;
    if (in1.miscPressed && !simulationMode) {
        toggleChainsawMode(this, p1);
    }
    if (in2.miscPressed) {
        toggleChainsawMode(this, p2);
    }

    p1.horizontalMovementActive = !simulationMode && (p1LeftDown || p1RightDown);
    p2.horizontalMovementActive = !botMode && (
        p2LeftDown || p2RightDown
    );
    
    
    const p1Chainsaw = p1.name === 'AXEMAN' && p1.variant === 'CHAINSAW';
    // attackPressed also catches online taps that start and end between two frames.
    const p1AttackPressed = p1Chainsaw
        ? in1.attackPressed
        : in1.attack || in1.attackPressed;
    if (p1AttackPressed && (!p1.hitstun || p1.activeGrab) && !simulationMode) {
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
        ? in2.attackPressed
        : in2.attack || in2.attackPressed;
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

        // Only the platform being stood on right now; a stale one would stop the
        // fisherman's hook from latching onto it after leaving it (e.g. off-stage).
        if (!player.body.touching.down) player.currentPlatform = null;
        const platforms = getMapPlatforms(this);
        platforms.forEach(platform => {
            handlePlatformCollide(player, platform);
        });
    };
    updateScythemanGrass(this, this.gameState.players);
    updateCombo(p1, this.game.loop.delta);
    updateCombo(p2, this.game.loop.delta);
    if (p1LeftDown) p1.lastDir = { x: -1, y: 0 };
    else if (p1RightDown) p1.lastDir = { x: 1, y: 0 };
    else if (p1UpDown) p1.lastDir = { x: 0, y: -1 };
    else if (p1DownDown) p1.lastDir = { x: 0, y: 1 };
    if (p1.lastDir.y === 0) p1.atk.setAngle(getAttackSpriteAngle(p1));


    // PLAYER 2 (arrows)
    if (p2LeftDown) p2.lastDir = { x: -1, y: 0 };
    else if (p2RightDown) p2.lastDir = { x: 1, y: 0 };
    else if (p2UpDown) p2.lastDir = { x: 0, y: -1 };
    else if (p2DownDown) p2.lastDir = { x: 0, y: 1 };
    if (p2.lastDir.y === 0) p2.atk.setAngle(getAttackSpriteAngle(p2));
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
        const p1AtkOffset = getAttackSpriteOffset(p1);
        p1.atk.x = p1.x + (p1.lastDir.x * p1.atkXOffset) + p1AtkOffset.x;
        p1.atk.y = p1.y + (p1.lastDir.y * p1.atkYOffset) - 15 + p1AtkOffset.y;
    }

    if (!p2.activeGrab) {
        const p2AtkOffset = getAttackSpriteOffset(p2);
        p2.atk.x = p2.x + (p2.lastDir.x * p2.atkXOffset) + p2AtkOffset.x;
        p2.atk.y = p2.y + (p2.lastDir.y * p2.atkYOffset) - 15 + p2AtkOffset.y;
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

    p1.header.x = this.online ? p1.x : p1.x - 10;
    p1.header.y = p1.y - 50;

    p2.header.x = this.online ? p2.x : p2.x - 10;
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
    updateMatchStats(p1, p2);
    updateMatchStats(p2, p1);
    for (const player of [p1, p2]) {
        updateLaunchEffects(this, player);
        updateDangerGlow(this, player);
    }

    if (p1.afterimage) {
        if (this.time.now > p1.afterimageTimer) {

            spawnAfterimage(this, p1);

            p1.afterimageTimer = this.time.now + (p1.ultraLaunch ? 12 : p1.violentLaunch ? 20 : 40);
        }
    } 
    if (p2.afterimage) {
        if (this.time.now > p2.afterimageTimer) {
            spawnAfterimage(this, p2);

            p2.afterimageTimer = this.time.now + (p2.ultraLaunch ? 12 : p2.violentLaunch ? 20 : 40);
        }
    }

    p1.hitstun = this.time.now < p1.hitstunUntil;
    if (!p1.hitstun && !simulationMode) {
        const p1LeftPressed = in1.leftPressed;
        const p1RightPressed = in1.rightPressed;
        const p1SpecialPressed = in1.specialPressed;
        const p1SpecialHeld = in1.special;
        const p1SpecialDirection = p1LeftDown
            ? 'left'
            : p1RightDown
                ? 'right'
                : null;

        if (p1LeftPressed) {
            p1.lastInput.left = this.time.now;
            if (!consumePress(in1, 'left') && inputMode.p1 !== "keyboard") {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard";
            }
            
            handleDirSpecial(this, p1, 'left', this.time.now, p2, p1SpecialHeld || p1SpecialPressed);
        }
        if (p1RightPressed) {
            p1.lastInput.right = this.time.now;
            if (!consumePress(in1, 'right') && inputMode.p1 !== "keyboard") {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard";
            }
            handleDirSpecial(this, p1, 'right', this.time.now, p2, p1SpecialHeld || p1SpecialPressed);
        }
        if (p1SpecialPressed) {
            if (!consumePress(in1, 'special') && inputMode.p1 !== "keyboard") {
                this.mobileButtons.p1.forEach(obj => obj.setAlpha(0.25));
                inputMode.p1 = "keyboard";
            }
            if (p1SpecialDirection && !p1LeftPressed && !p1RightPressed) {
                handleDirSpecial(this, p1, p1SpecialDirection, this.time.now, p2, true);
            } else if (!p1SpecialDirection) {
                handleNeutralSpecial(this, p1, p2);
            }
        }
        if (!p1.hasHitSideSpecial && p1.isUsingSideSpecial && fiveframecount === 5) {
            handleDirSpecialAttack(this, p1, p2);
        }
        if (p1LeftDown) {
            //transplant successful!
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.LEFT
            });
        } else if (p1RightDown) {
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
        if (p1UpDown && p1.body.touching.down) {
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
        
        if (in1.upPressed) {
            p1.lastInput.up = this.time.now;
            if (!consumePress(in1, 'up') && inputMode.p1 !== "keyboard") {
            
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
        }
        if (in1.downPressed) {
            p1.lastInput.down = this.time.now;
            if (!consumePress(in1, 'down') && inputMode.p1 !== "keyboard") {
            
                this.mobileButtons.p1.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p1 = "keyboard"; 
            }
        }

        const usingMobile = this.sys.game.device.input.touch;


        const jumpReleased = !in1.up;

        if (jumpReleased && p1.body.velocity.y < 0 && !p1.hasDoubleJumped) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.UP_CANCEL
            });
        }

        if (p1DownDown && p1.airTime >= 1000) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.DOWNSLAM
            });
        }

    }


    p2.hitstun = this.time.now < p2.hitstunUntil;
    if (!p2.hitstun && !botMode) {

        // Player 2 controls
        const p2LeftPressed = in2.leftPressed;
        const p2RightPressed = in2.rightPressed;
        const p2SpecialPressed = in2.specialPressed;
        const p2SpecialHeld = in2.special;
        const p2SpecialDirection = p2LeftDown
            ? 'left'
            : p2RightDown
                ? 'right'
                : null;

        if (p2LeftPressed) {
            p2.lastInput.left = this.time.now;
            if (!consumePress(in2, 'left') && inputMode.p2 !== "keyboard") {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            
            handleDirSpecial(this, p2, 'left', this.time.now, p1, p2SpecialHeld || p2SpecialPressed);
        }

        if (p2RightPressed) {
            p2.lastInput.right = this.time.now;
            if (!consumePress(in2, 'right') && inputMode.p2 !== "keyboard") {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
            handleDirSpecial(this, p2, 'right', this.time.now, p1, p2SpecialHeld || p2SpecialPressed);
        }
        if (p2SpecialPressed) {
            if (!consumePress(in2, 'special') && inputMode.p2 !== "keyboard") {
                this.mobileButtons.p2.forEach(obj => obj.setAlpha(0.25));
                inputMode.p2 = "keyboard";
            }
            if (p2SpecialDirection && !p2LeftPressed && !p2RightPressed) {
                handleDirSpecial(this, p2, p2SpecialDirection, this.time.now, p1, true);
            } else if (!p2SpecialDirection) {
                handleNeutralSpecial(this, p2, p1);
            }
        }

        if (!p2.hasHitSideSpecial && p2.isUsingSideSpecial && fiveframecount === 5) {
            handleDirSpecialAttack(this, p2, p1);
        }

        if (p2LeftDown) {
            if (!p2.isUsingSideSpecial) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p2.id,
                    type: Commands.LEFT
                });
            }
        }
        else if (p2RightDown) {
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

        if (p2UpDown && p2.body.touching.down) {
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

        if (in2.upPressed) {
            const upFromTouch = consumePress(in2, 'up');
            const quickslamJumped = tryQuickslamJump(this, p2, this.time.now);
            if (!quickslamJumped && !p2.body.touching.down && !p2.hasDoubleJumped) {
                executeStateCommand(this, this.gameState.players, {
                    playerID: p2.id,
                    type: Commands.DOUBLE_UP
                });
            }
            p2.lastInput.up = this.time.now;
            if (!upFromTouch && inputMode.p2 !== "keyboard") {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
        }
        if (in2.downPressed) {
            p2.lastInput.down = this.time.now;
            if (!consumePress(in2, 'down') && inputMode.p2 !== "keyboard") {
            
                this.mobileButtons.p2.forEach(obj => {
                    obj.setAlpha(0.25);
                });
                inputMode.p2 = "keyboard"; 
            }
        }

        const usingMobile = this.sys.game.device.input.touch;


        const jumpReleased2 = !in2.up;

        if (jumpReleased2 && p2.body.velocity.y < 0 && !p2.hasDoubleJumped) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.UP_CANCEL
            });
        }
        if (p2DownDown && p2.airTime >= 1000) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p2.id,
                type: Commands.DOWNSLAM
            });
        }
    }
    //PRIORITY
    for (const player of [p1, p2]) {
        if (player.freeze) {
            if (player.freezeGravity === null) {
                player.freezeGravity = player.body.allowGravity;
            }
            player.body.allowGravity = false;
            player.setVelocity(0, -1);
        } else if (player.freezeGravity !== null) {
            player.body.allowGravity = player.freezeGravity;
            player.freezeGravity = null;
        }
    }

    updateSledgehammerAnimation(p1);
    updateSledgehammerAnimation(p2);
    updateSwordmanIdle(p1);
    updateSwordmanIdle(p2);
    updateWeaponIdle(p1);
    updateWeaponIdle(p2);
    updateCharacterIntro(p1);
    updateCharacterIntro(p2);

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
            p1.statsLastKB = p1.KBmultiplier;
            p2.stats.kos += 1;

            console.log(p2.winNumber)
            updateWins(this);
            spawnKOBlast(this, p1, p2);
            teleportBackToArena(p1);
            if (p2.winNumber < winNumber) playRespawn(this, p1);
            
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
            p2.statsLastKB = p2.KBmultiplier;
            p1.stats.kos += 1;
            updateWins(this);
            spawnKOBlast(this, p2, p1);
            teleportBackToArena(p2);
            if (p1.winNumber < winNumber) playRespawn(this, p2);
            
            this.time.delayedCall(1500, () => {
                this.winCooldown = false;
            });
        }

        if (p1.winNumber >= winNumber || p2.winNumber >= winNumber) {
            if (p1.outOfBounds) {
                this.gameEnded = true;
                showMatchEnd(this, p2, p1);
            } else if (p2.outOfBounds) {
                this.gameEnded = true;
                showMatchEnd(this, p1, p2);
            }
            // Online players get their own rematch/menu buttons from the overlay scene.
            if (this.online && this.gameEnded) reportMatchEnd(p1.outOfBounds ? 'p2' : 'p1');
        }
    }
    updateKB(this);
    const pickAI = slot => window.__legacySlot === slot ? runLegacyBotAI : runBotAI; // BENCHMARK-TEMP
    if (botMode) {
        pickAI('p2')(this, p2, p1, fiveframecount);
    }
    if (simulationMode) {
        pickAI('p1')(this, p1, p2, fiveframecount);
    }
    updateMapHazard(this);
    if (fiveframecount >= 5) {
        fiveframecount = 0;
    }
}
