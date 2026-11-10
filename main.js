// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import {handleAttack, handleMatchEnd, tryExtraJump, handleDirSpecial, handleNeutralSpecial, handleDirSpecialAttack, handleHorizantalTilt, handleDownTilt, handleUpTilt, downslamAttack, updateScythemanGrass, updateChainsawWood, updateCharacter, handleMisc, hasMiscButton, usesToggleAttack, getSpecialMeter, tryQuickslamJump, positionAttackSprite, hasIdleAttackSprite, getAttackSpriteOffset, getAttackSpriteAngle, getAttackSpriteFlipX, triggerScreenShake, spawnDirtBurst, spawnExplosion} from './attacks.js';
import { COLORS, FONTS, HEX, makePanel, textStyle } from './ui/theme.js';
import { MATCH_LIVES, PLAYER_COLORS, buildRoster, isTeamMode } from './matchModes.js';
import { isAlive, nearestEnemy } from './combat/targets.js';
import { addTouchAssist, isPhoneScreen } from './ui/touchAssist.js';
import { addThumbstick } from './ui/touchJoystick.js';
import { createSpeedometers, updateSpeedometers } from './ui/speedometer.js';
import { playModifierIntro } from './ui/modifierIntro.js';
import { getActiveModifierCards } from './modifiers.js';
import { createPerspectiveSwitch, updatePerspective } from './ui/perspective.js';
import { MAX_WOOD_COUNT } from './playerAttackScripts/axeman.js';
import { initiatePlayers, updateCombo } from './players.js';
import { Commands, executeStateCommand} from './commands.js';
import { applySquash, cancelDownslamFx, restoreSquash, squashOnLanding } from './combat/squash.js';
import { updateCrashes } from './combat/crash.js';
import { KILLZONE, attachKillzoneWalls } from './combat/borders.js';
import { INFINITE_SPAN } from './scenes/GameScene/MapDefinitions.js';
import { updateUniversalMoves, isUniversalBusy, tryLedgeGrab, hideWeaponsForUniversalMoves, restoreHiddenWeapons } from './combat/universalMoves.js';
import { updateLaunchArc, isInvincible } from './combat/knockback.js';
import { MenuScene } from './scenes/MenuScene.js';
import { fadeOutTo } from './scenes/transitions.js';
import { player1Character, player2Character, player1Variant, player2Variant, CharacterSelectScene } from './scenes/CharacterSelectScreen.js';
import { MapAndModifierSelectScene, getMatchMapDefinition, resetMapAndModifierSelection } from './scenes/MapAndModifierSelect.js';
import { preload } from './scenes/GameScene/preload.js';
import { createGameAnimations } from './scenes/GameScene/animations.js';
import { runBotAI } from './scenes/GameScene/botAI.js';
import { runBotAI as runLegacyBotAI } from './scenes/GameScene/botAILegacy.js'; // BENCHMARK-TEMP
import { Map } from './scenes/GameScene/Map.js';
import { getActiveKillZones, modifierOptions } from './scenes/MapAndModifierSelect.js';
import UIPlugin from 'phaser4-rex-plugins/templates/ui/ui-plugin.js';
import unmuteAudio from 'unmute-ios-audio';
import { botMode, simulationMode, changeBotMode } from './gameSettings.js';
import { createInputState, applyInputFrame, consumePress, emptyControllerInput } from './input.js';
import { isAuthority, beginAuthorityCapture, attachAuthority, consumeLeftPlayers, createAuthorityGame, getOnlineMatchSettings, pollNetworkInput, reportMatchEnd } from './mp/authority.js';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene.js';
import { OnlineGameScene, OnlineOverlayScene } from './scenes/OnlineGameScene.js';
import { ControllerSetupScene, controllerInputs } from './scenes/ControllerSetupScene.js';

window.Phaser = Phaser;
unmuteAudio();



//TESTER CREDITS - MAY 5, 2026
//w testers for this game, including several students in my grade
//The most impactful testers I'd wish to mention are:
//Aidan Z, Deyu Z, Luke Ch, Augustus L, Jaylen L, Presley F, Giovanni M, Jeffrey C, Kenneth L, Abrar A , Mr. Primm
//While they might have told others about the game, those are who I know about who have played and tested the game
//Not only did they play the game, but I was also able to work up to some of their suggestions.
//The ones impactful are the ones I've also observed mistakes in the game from, whether stating it to me or watching them play, so I can add fixes to the code

//UPDATED INFO - OCTOBER 31st 2026

//Testers now have been expanded to around 30+ people, if only by our discord server.
//However many more dont have discord meaning there are around 50 people that play this game and send feedback to me
//At the time, this game was way more localized, and it still is but little expansion is necessary to keep the game in development
//True public release is not even close, expecting early 2027 for 
//the game is to be split into LITE (website/current playable game), then a paid full version with much more content.
//Lite will continue to stay open source


// This is a 2D platform fighter game made using Phaser and Javascript. Requires a keyboard to play
//ENTIRE script is made by zamanarvin. Before, some assets were made by jeffrey, now only one which is the website icon. I dont own/made any audio in this game however.
//NOTE: mohsina007 and arvin2a are the same person
// its just that mohsina007 is the account that was hard-set as the account for VSCode, the application I used to make this game.
// and the sound effects were taken from various games as listed in the preload function.
//WASD and arrow keys control the players; E/SHIFT attack, Q / FORWARD SLASH use special, R / PERIOD block and LEFT ALT / RIGHT ALT switch chainsaw mode.


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
        const fighters = () => Object.values(this.gameState.players ?? {});
        const restore = () => {
            restoreSquash(fighters());
            restoreHiddenWeapons(fighters());
        };
        this.events.on('preupdate', restore);
        this.events.once('shutdown', () => this.events.off('preupdate', restore));
    }

    update() {
        syncFightersToPhysics(Object.values(this.gameState.players ?? {}));
        update.call(this);
        settleNoGravity(this);
        updateCrashes(this, Object.values(this.gameState.players ?? {}));
        applySquash(this, Object.values(this.gameState.players ?? {}));
        hideWeaponsForUniversalMoves(Object.values(this.gameState.players ?? {}));
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

for (const Manager of [Phaser.Sound.WebAudioSoundManager, Phaser.Sound.HTML5AudioSoundManager]) {
    const addSound = Manager.prototype.add;
    Manager.prototype.add = function (key, config) {
        if (!this.game.cache.audio.exists(key)) return new Phaser.Sound.NoAudioSound(this, key, config);
        return addSound.call(this, key, config);
    };
}

var game;

loadFont().then(() => {
    game = isAuthority()
        ? createAuthorityGame(Phaser, config, GameScene)
        : new Phaser.Game(config);
    if (!isAuthority()) game.events.once('ready', () => addButtonHoverSounds(game));
});

// Every interactive object in these scenes is UI, so hovering any of them plays
// buttonhover. A scene's input listeners are cleared on shutdown, so this is
// re-added each time the scene is created.
function addButtonHoverSounds(game) {
    const listen = scene => scene.input.on('gameobjectover', (_pointer, gameObject) => {
        if (gameObject?.getData?.('silentHover')) return;
        if (scene.cache.audio.exists('buttonhover')) scene.sound.play('buttonhover');
    });
    for (const scene of game.scene.scenes) {
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
var blockKey1;
var blockKey2;
var lastWinScores = '';
var inputMode = {};
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
        specialPressed: false,
        block: false,
        blockPressed: false
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
        specialPressed: false,
        block: false,
        blockPressed: false
    }
};

var winBar;
var restartBtn;
// The win-screen buttons are drawn square; this squashes them to be shorter.
const WIN_BUTTON_SCALE_Y = 0.24;
var restartBtnPressed;

var homeBtn;
var homeBtnPressed;

const KO_LOCK_MS = 1500;
const STAT_BLOCK = { y: 65, width: 195, imageScale: 0.65, minGap: 44 };

function getStatLayout(count) {
    if (count === 2) return { xs: [300, 700], scale: 1 };
    const scale = Math.min(1, (1000 - (count + 1) * STAT_BLOCK.minGap) / (count * STAT_BLOCK.width));
    const width = STAT_BLOCK.width * scale;
    const gap = (1000 - count * width) / (count + 1);
    return { xs: Array.from({ length: count }, (_, index) => gap + width / 2 + index * (width + gap)), scale };
}

function getMatchSettings() {
    if (isAuthority()) return getOnlineMatchSettings();
    return {
        mode: '1v1',
        players: buildRoster('1v1', [
            { character: player1Character, variant: player1Variant },
            { character: player2Character, variant: player2Variant }
        ])
    };
}

function isCpuIndex(scene, index) {
    return scene.simulationMode || (scene.botMode && index === 1);
}

function createSpecialMeters(scene) {
    scene.specialMeters = {};
    const meterWidth = 160;
    const meterHeight = 18;
    const fighters = scene.gameState.players;
    const meterXs = fighters.length === 2 ? [205, 795] : getStatLayout(fighters.length).xs;
    const meters = fighters.map((player, index) => ({
        key: player.slot,
        player,
        x: meterXs[index],
        color: player.isCpu ? 0x808080 : PLAYER_COLORS[player.color].meter,
        label: `${player.slot.toUpperCase()} ABILITY`
    }));

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
            meterWidth,
            color: meter.color
        };
    });
    meters.forEach(meter => {
        if (meter.player.name === 'AXEMAN' && meter.player.variant === 'CHAINSAW') {
            const woodMeterY = 145 + 65;
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
        if (player.eliminated) {
            fill.setDisplaySize(0, 18);
            status.setText('OUT');
            status.setColor('#bbbbbb');
            return;
        }
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

        const customMeter = getSpecialMeter(scene, player);
        if (customMeter) {
            fill.setDisplaySize(meterWidth * Phaser.Math.Clamp(customMeter.progress, 0, 1), 18);
            fill.setFillStyle(customMeter.color);
            status.setText(customMeter.text);
            status.setColor(customMeter.textColor);
            return;
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
                : meter.color
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
        players.some(player => !player.hasUsedSideSpecial)
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


function pollLocalInput(scene, slot) {
    const isP1 = slot === 'p1';
    const keys = isP1 ? wasd : cursors;
    const attackKey = isP1 ? attackKey1 : attackKey2;
    const modeKey = isP1 ? chainsawModeKey1 : chainsawModeKey2;
    const blockKey = isP1 ? blockKey1 : blockKey2;
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
        misc: false,
        block: mobile.blockPressed
    };
    const frame = {
        held: {
            left: keys.left.isDown || mobile.left || pad.left,
            right: keys.right.isDown || mobile.right || pad.right,
            up: keys.up.isDown || mobile.up || pad.up,
            down: keys.down.isDown || mobile.down || pad.down,
            attack: attackKey.isDown || mobile.attack || pad.attack,
            special: modeKey.isDown || mobile.special || pad.special,
            misc: altDown || pad.misc,
            block: blockKey.isDown || mobile.block || pad.block
        },
        pressed: {
            left: JustDown(keys.left) || touch.left || pad.leftPressed,
            right: JustDown(keys.right) || touch.right || pad.rightPressed,
            up: JustDown(keys.up) || touch.up || pad.upPressed,
            down: JustDown(keys.down) || touch.down || pad.downPressed,
            attack: JustDown(attackKey) || touch.attack || pad.attackPressed,
            special: JustDown(modeKey) || touch.special || pad.specialPressed,
            misc: altPressed || pad.miscPressed,
            block: JustDown(blockKey) || touch.block || pad.blockPressed
        },
        touch
    };
    for (const button of Object.keys(touch)) mobile[button + 'Pressed'] = false;
    return frame;
}

function readPlayerInputs(scene) {
    for (const { slot } of scene.matchSettings.players) {
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
    this.online = isAuthority();
    if (this.online) beginAuthorityCapture(this);
    this.matchSettings = getMatchSettings();
    this.playerInputs = Object.fromEntries(this.matchSettings.players.map(({ slot }) => [slot, createInputState()]));
    this.gamePaused = false;
    this.time.paused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.sound.resumeAll();
    fiveframecount = 0;
    releaseMobileControls();
    inputMode = Object.fromEntries(this.matchSettings.players.map(({ slot }) => [slot, 'touch']));

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

    lastWinScores = '';
    this.matchChampion = null;
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
    this.mobileButtons = Object.fromEntries(this.matchSettings.players.map(({ slot }) => [slot, []]));
    const mapDefinition = getMatchMapDefinition();
    this.gameState.map = new Map(this, mapDefinition);
    if (modifierOptions.MAP_HAZARDS.enabled) {
        this.mapHazard = mapDefinition.hazard ?? null;
    }
    this.nextHazardCheckAt = this.time.now + 5000;
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




    const statLayout = getStatLayout(this.matchSettings.players.length);
    this.statBackgrounds = this.matchSettings.players.map((entry, index) => {
        const key = isCpuIndex(this, index) ? 'botstat' : PLAYER_COLORS[entry.color].stat;
        const image = this.add.image(statLayout.xs[index], STAT_BLOCK.y, key).setScale(STAT_BLOCK.imageScale * statLayout.scale);
        this.hud.add(image);
        return image;
    });

    const p1guide = this.add.image(450, 65, 'p1guide');
    p1guide.setAlpha(0.65);
    this.hud.add(p1guide);
    const p2guide = this.add.image(850, 65, 'p2guide');
    p2guide.setAlpha(0.65);
    this.hud.add(p2guide);
    if (this.online || simulationMode) {
        p1guide.setVisible(false);
        p2guide.setVisible(false);
    }


    createGameAnimations(this);

    const isMobile = this.sys.game.device.input.touch;

    const touchButtons = [];
    if (isMobile) {
        addTouchAssist(this, touchButtons);

        function makeButton(scene, x, y, text, keyRef, radius = 45) {

            const btn = scene.add.circle(x, y, radius, 0x000000, 0.45)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive()
                .setData('silentHover', true);

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
            btn.on('pointerupoutside', release);
            touchButtons.push({ circle: btn, press, release });

            scene.hud.add(btn);
            scene.hud.add(label);
            return btn;
        }

        const p1 = mobileControls.p1;
        const p2 = mobileControls.p2;

        const p1Thumbstick = botMode && !simulationMode && isPhoneScreen();
        const p1Buttons = botMode ? (p1Thumbstick ? [
            [940, 420, 'A', p1, 'attack'],
            [940, 330, 'S', p1, 'special'],
            [850, 420, 'B', p1, 'block']
        ] : [
            [60, 420, '←', p1, 'left'],
            [240, 420, '→', p1, 'right'],
            [150, 330, '↑', p1, 'up'],
            [150, 420, '↓', p1, 'down'],
            [850, 420, 'A', p1, 'attack'],
            [940, 330, 'S', p1, 'special'],
            [940, 240, 'B', p1, 'block']
        ]) : [
            [60, 420, '←', p1, 'left'],
            [240, 420, '→', p1, 'right'],
            [150, 330, '↑', p1, 'up'],
            [150, 420, '↓', p1, 'down'],
            [240, 330, 'A', p1, 'attack'],
            [60, 330, 'S', p1, 'special'],
            [330, 330, 'B', p1, 'block', 34]
        ];

        const p2Buttons = [
            [740, 420, '←', p2, 'left'],
            [920, 420, '→', p2, 'right'],
            [830, 330, '↑', p2, 'up'],
            [830, 420, '↓', p2, 'down'],
            [740, 330, 'A', p2, 'attack'],
            [920, 330, 'S', p2, 'special'],
            [650, 330, 'B', p2, 'block', 34]
        ];

        if (!simulationMode) p1Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            }, btn[5]);
            this.mobileButtons.p1.push(butn);
        });

        if (p1Thumbstick) {
            const stick = addThumbstick(this, {
                x: 130,
                y: 400,
                container: this.hud,
                onChange: (button, down) => {
                    p1[button] = down;
                    if (!down) return;
                    p1[button + 'Pressed'] = true;
                    inputMode.p1 = 'touch';
                    this.mobileButtons.p1.forEach(obj => obj.setAlpha(1));
                }
            });
            touchButtons.push(stick);
            this.mobileButtons.p1.push(stick.circle, stick.knob);
        }

        if (!botMode) p2Buttons.forEach(btn => {
            const butn = makeButton(this, btn[0], btn[1], btn[2], {
                obj: btn[3],
                key: btn[4]
            }, btn[5]);
            this.mobileButtons.p2.push(butn);
        });

    }

    this.gameState.players = initiatePlayers(this, this.matchSettings);
    if (isMobile) {
        for (const player of Object.values(this.gameState.players)) {
            if (!hasMiscButton(player.name, player.variant)) continue;
            if (botMode && player.id === 2) continue;
            if (simulationMode) continue;

            const x = player.id === 1 ? (botMode ? 760 : 330) : 650;
            const button = this.add.circle(x, 420, botMode ? 45 : 34, 0x000000, 0.55)
                .setScrollFactor(0)
                .setDepth(999)
                .setInteractive()
                .setData('silentHover', true);
            const label = this.add.text(x, 420, 'ALT', {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: 'VCROSD'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
            const toggleMode = () => {
                inputMode[player.slot] = 'touch';
                handleMisc(this, player, nearestEnemy(this, player));
            };
            button.on('pointerdown', toggleMode);
            touchButtons.push({ circle: button, press: toggleMode, release: () => {} });
            this.hud.add(button);
            this.hud.add(label);
            player.modeSwitchButton = button;
        }
    }
    createSpecialMeters(this);

    if (this.online) {
        this.matchSettings.players.forEach((entry, index) => {
            const { header } = this.gameState.players[index];
            header.setText(entry.name ?? entry.slot.toUpperCase());
            header.setOrigin(0.5, 0);
        });
    }

    this.killZones = getActiveKillZones(this.gameState.map);
    attachKillzoneWalls(this);
    if (this.gameState.map.infinite) {
        this.physics.world.setBounds(-INFINITE_SPAN, 0, INFINITE_SPAN * 2, 1200);
        this.speedometers = createSpeedometers(this, this.gameState.players);
    } else {
        this.physics.world.setBounds(0, 0, 2000, 1200);
    }
    const { horizontal, vertical } = this.killZones;
    this.cameras.main.setBounds(
        horizontal ? 0 : -INFINITE_SPAN,
        vertical ? 0 : -INFINITE_SPAN,
        horizontal ? 2000 : INFINITE_SPAN * 2,
        vertical ? 1200 : INFINITE_SPAN * 2
    );
    this.noGravityPending = modifierOptions.NO_GRAVITY_FRICTION.enabled;
    this.cameras.main.ignore(this.hud);
    this.objcam.ignore(this.objs);


    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];
        this.physics.add.collider(player, this.gameState.map.platforms);
        this.physics.add.collider(player, this.gameState.map.topPlatforms);
        this.physics.add.collider(player, this.planks);

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
    prepareEntranceSlams(this);

    const fighters = this.gameState.players;
    for (let i = 0; i < fighters.length; i++) {
        for (let j = i + 1; j < fighters.length; j++) {
            this.physics.add.collider(fighters[i], fighters[j], null,
                (a, b) => !a.clipThroughPlayers && !b.clipThroughPlayers && a.team !== b.team);
        }
    }

    fighters.forEach((player, index) => {
        const x = statLayout.xs[index];
        const { scale } = statLayout;
        player.statBackground = this.statBackgrounds[index];
        player.statIcon = this.add.image(x - 50 * scale, STAT_BLOCK.y, player.icon).setScale(scale);
        const nameText = this.add.text(x - 20 * scale, 47, player.name, { fontFamily: 'GameFont', fontSize: '16px', fill: '#FFFFFF' }).setScale(scale);
        nameText.setStroke('#000000', 3);
        createKBText(this, player, x - 15 * scale, STAT_BLOCK.y);
        player.KBText.setScale(scale);
        player.KBFlashText.setScale(scale);
        this.hud.add([player.statIcon, nameText, player.KBText, player.KBFlashText]);
    });

    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    chainsawModeKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    chainsawModeKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FORWARD_SLASH);
    blockKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    blockKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD);

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

    

    startMatchSequence(this);

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
    this.perspective = !this.online && this.gameState.map.infinite ? createPerspectiveSwitch(this) : null;

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
        this.pauseButton.setVisible(false).disableInteractive();
        attachAuthority(this);
    }
}
function getRoundScore(scene, player) {
    return scene.gameState.players.length === 2 ? player.stats.kos : player.lives;
}

function updateWins(scene, matchOver) {
    const fighters = scene.gameState.players;
    const scores = fighters.map(player => getRoundScore(scene, player)).join();
    if (scores === lastWinScores) return;
    lastWinScores = scores;

    winBar.setVisible(!matchOver);
    scene.tweens.add({
        targets: winBar,
        scaleY: 1,
        duration: 300,
        ease: 'Cubic.easeOut'
    });
    scene.time.delayedCall(1000, () => {
        fighters.forEach(player => player.winText.setVisible(false));
        scene.tweens.add({
            targets: winBar,
            scaleY: 0,
            duration: 300,
            ease: 'Cubic.easeOut'
        });
    });

    for (const player of fighters) {
        player.winText.setText(getRoundScore(scene, player));
        player.winText.setVisible(!matchOver);
    }
}

function waitForModifierIntro(scene, onDone) {
    playModifierIntro(scene, getActiveModifierCards(scene.gameState.map.definition), onDone);
}

function runCountdown(scene) {
    const fighters = scene.gameState.players;
    scene.time.delayedCall(50, () => {
        for (const player of fighters) {
            player.freezeUntil = 4200 + scene.time.now;
            player.hitstunUntil = 4200 + scene.time.now;
        }
    });
    ['countdown1', 'countdown2', 'countdown3', 'countdown4'].forEach((texture, index) => {
        scene.time.delayedCall(1000 * (index + 1), () => {
            const counter = scene.add.image(500, 300, texture);
            scene.hud.add(counter);
            if (index === 0) scene.sound.play('countdown');
            scene.tweens.add({
                targets: counter,
                alpha: 0,
                duration: 500,
                onComplete: () => counter.destroy()
            });
            if (index < 3) return;
            for (const player of fighters) {
                player.freezeUntil = 0;
                player.hitstunUntil = 0;
            }
            endCharacterIntros(scene);
            scene.matchStartTime = scene.time.now;
        });
    });
}

function startMatchSequence(scene) {
    for (const player of scene.gameState.players) {
        player.freezeUntil = Number.MAX_SAFE_INTEGER;
        player.hitstunUntil = Number.MAX_SAFE_INTEGER;
    }
    waitForModifierIntro(scene, () => {
        launchEntranceSlams(scene);
        runCountdown(scene);
    });
}

function teleportBackToArena(player, x = 1000) {
    player.activeHookCleanup?.();
    player.nettedUntil = 0;
    player.setPosition(x, 0);
    player.setVelocityY(modifierOptions.NO_GRAVITY_FRICTION.enabled ? NO_GRAVITY_RESPAWN_DRIFT : 0);
    player.setVelocityX(0);
    player.respawnFalling = true;
    player.invincibleUntil = player.scene.time.now + RESPAWN_MAX_IMMUNITY_MS;
}

const RESPAWN_MAX_IMMUNITY_MS = 4000;
const RESPAWN_LAND_GRACE_MS = 300;
const IMMUNITY_FLASH_GAP_MS = 120;

function updateImmunity(scene, player) {
    const now = scene.time.now;
    if (player.respawnFalling && (player.body.blocked.down || player.body.touching.down)) {
        player.respawnFalling = false;
        player.invincibleUntil = now + RESPAWN_LAND_GRACE_MS;
    }
    const netImmune = now >= (player.nettedUntil ?? 0) && now < (player.netImmuneUntil ?? 0);
    if (!isInvincible(player) && !netImmune) return;
    if (now < (player.nextImmunityFlashAt ?? 0)) return;
    player.nextImmunityFlashAt = now + IMMUNITY_FLASH_GAP_MS;
    player.flash();
}
const accelFactor = 20;

const baseZoom = 1;
const minZoom = 0.6;
const HIT_FOCUS_ZOOM = 2.4;
const CAMERA_MAX_LAG_OF_HALF_VIEW = 0.5;
const CAMERA_SNAP_SPEED = 10000;

function cameraFollowRate(scene, baseRate, velocity, viewSize) {
    const step = Math.abs(velocity) * Math.min(scene.game.loop.delta, 50) / 1000;
    const maxLag = viewSize / 2 / scene.cameras.main.zoom * CAMERA_MAX_LAG_OF_HALF_VIEW;
    return Math.max(baseRate, step / (step + maxLag));
}
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
    scene.objs.addAt(ghost, Math.min(...scene.gameState.players.map(fighter => scene.objs.getIndex(fighter))));
    scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 100,
        onComplete: () => ghost.destroy()
    });
}

const MAX_ATTACK_LOCK_MS = 3000;
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
        if (!player.downslamFx && !player.isUsingSideSpecial) player.afterimage = false;
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

function updateMatchStats(scene, player) {
    const gained = player.KBmultiplier - player.statsLastKB;
    const dealer = player.lastHitBy ?? nearestEnemy(scene, player);
    if (gained > 0 && dealer) dealer.stats.damageDealt += gained * 100;
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

    const beamColor = !scorer ? 0xffffff : scorer.isCpu ? HEX.cpu : PLAYER_COLORS[scorer.color].hex;
    const beam = scene.add.rectangle(edgeX, edgeY, length, 120, beamColor)
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

function showMatchEnd(scene, winners) {
    for (const player of scene.gameState.players) {
        if (player.eliminated) continue;
        handleMatchEnd(scene, player);
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

    if (scene.online) return;

    scene.time.delayedCall(1400, () => {
        scene.tweens.add({ targets: stamp, alpha: 0, scale: 0.6, duration: 250, onComplete: () => stamp.destroy() });
        showResultsPanel(scene, winners);
    });
}

function getWinnerTitle(scene, winners) {
    if (isTeamMode(scene.matchSettings.mode)) return `${PLAYER_COLORS[winners[0].color].label} TEAM WINS!`;
    return `${winners[0].name} WINS!`;
}

function showResultsPanel(scene, winners) {
    const fighters = scene.gameState.players;
    const twoPlayers = fighters.length === 2;
    const columns = twoPlayers
        ? [390, 610]
        : fighters.map((_, index) => 350 + index * (420 / (fighters.length - 1)));
    const labelX = twoPlayers ? 500 : 250;
    const colorOf = player => player.isCpu ? COLORS.cpu : PLAYER_COLORS[player.color].css;
    const formatKB = multiplier => `${((multiplier * 100) - 100).toFixed(1)}%`;
    const rows = [
        ['KOS', p => `${p.stats.kos}`],
        ['MAX KB', p => formatKB(p.stats.maxKB)],
        ['DAMAGE', p => `${p.stats.damageDealt.toFixed(1)}%`]
    ];

    const backdrop = scene.add.rectangle(500, 300, 1000, 600, 0x000000, 0.45).setAlpha(0);
    const typed = [
        [scene.add.text(500, 145, '', textStyle('title', {
            fontSize: '40px',
            fill: colorOf(winners[0])
        })).setOrigin(0.5), getWinnerTitle(scene, winners)],
        ...fighters.map((player, index) => [
            scene.add.text(columns[index], 195, '', textStyle('title', {
                fontSize: twoPlayers ? '18px' : '13px',
                fill: colorOf(player),
                strokeThickness: 3
            })).setOrigin(0.5),
            player.name
        ])
    ];
    rows.forEach(([label, value], index) => {
        const y = 240 + index * 40;
        typed.push(
            [scene.add.text(labelX, y, '', textStyle('body', { fontSize: '18px', fill: COLORS.muted })).setOrigin(0.5), label],
            ...fighters.map((player, column) => [
                scene.add.text(columns[column], y, '', textStyle('body', {
                    fill: winners.includes(player) ? COLORS.accent : COLORS.text,
                    fontSize: twoPlayers ? '24px' : '18px'
                })).setOrigin(0.5),
                value(player)
            ])
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
const INTRO_OFFSETS = {
    swordman: { x: 31, y: 0 },
    hammerman: { x: 20, y: -2 }
};

const INTRO_SOUNDS = {
    hammerman: { frame: 11, key: 'glassbreak' }
};


// Fighters downslam onto their spawns at the start of a match, straight through
// any platforms in the way, and play their intro once they land.
const ENTRANCE = { height: 700, firstDelay: 300, stagger: 120, duration: 380 };

function prepareEntranceSlams(scene) {
    for (const fighter of scene.gameState.players) {
        fighter.entranceSpawn = { x: fighter.x, y: fighter.y };
        fighter.body.enable = false;
        fighter.setPosition(fighter.x, fighter.y - ENTRANCE.height);
        [fighter, fighter.header, fighter.atk].forEach(object => object.setAlpha(0));
    }
}

function launchEntranceSlams(scene) {
    scene.gameState.players.forEach((fighter, index) => {
        const spawn = fighter.entranceSpawn;
        scene.time.delayedCall(ENTRANCE.firstDelay + index * ENTRANCE.stagger, () => {
            [fighter, fighter.header, fighter.atk].forEach(object => object.setAlpha(1));
            fighter.afterimage = true;
            scene.tweens.add({
                targets: fighter,
                y: spawn.y,
                duration: ENTRANCE.duration,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    fighter.afterimage = false;
                    fighter.body.enable = true;
                    fighter.body.reset(spawn.x, spawn.y);
                    spawnDirtBurst(scene, fighter.x, fighter.body.bottom, 16, 6, 10, 1.5);
                    triggerScreenShake(scene, 8, 200);
                    scene.sound.play('slamimpact');
                    startCharacterIntro(scene, fighter);
                }
            });
        });
    });
}

function startCharacterIntro(scene, player) {
    const key = `${player.texture.key}intro`;
    if (!scene.anims.exists(key)) return;
    const intro = scene.add.sprite(player.x, player.y, key)
        .setDepth(player.depth)
        .setFlipX(player.lastDir.x < 0);
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

function updateCharacterIntro(player) {
    const intro = player.introSprite;
    if (!intro) return;
    const facing = player.lastDir.x < 0 ? -1 : 1;
    const offset = INTRO_OFFSETS[player.texture.key] ?? { x: 0, y: 0 };
    intro.setPosition(player.x + offset.x * facing, player.y + offset.y);
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
    sprite.setFlipX(-player.lastDir.x < 0);
    if (player.lastDir.y < 0) sprite.setAngle(90);
    else if (player.lastDir.y > 0) sprite.setAngle(-90);
    else sprite.setAngle(0);
}

// MALLET HAMMERMAN, ANGLER and TRAPPER FISHERMAN hold their weapon out on the first
// frame of their swing whenever they aren't attacking, like the LONGSWORD idle above.
const IDLE_WEAPON_TEXTURES = {
    MALLET: 'hammeratk',
    ANGLER: 'rodatk',
    TRAPPER: 'harpoonatk',
    METAMORPHIC: 'slateatk1'
};

function updateWeaponIdle(player) {
    const idleTexture = player.idleWeaponTexture ?? IDLE_WEAPON_TEXTURES[player.variant];
    if (!idleTexture || player.isAttacking || player.isPlunging || player.activeGrab) return;
    const sprite = player.atk;

    if (!player.idleWeaponTexture || sprite.texture.key !== idleTexture) {
        if (sprite.anims.isPlaying) sprite.stop();
        if (sprite.texture.key !== idleTexture) sprite.setTexture(idleTexture);
        sprite.setFrame(0);
    }
    sprite.setVisible(true);
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

// SLATEMAN's speed at 0% KB, and how much faster each 100% KB makes him.
const SLATEMAN_START_SPEED = 0.75;
const SLATEMAN_SPEED_PER_KB = 0.5;
const SLATEMAN_PHASES = [
    { minKB: -Infinity, texture: 'slateman', resistance: 2 },
    { minKB: 1.50, texture: 'slatemanphase1', resistance: 1.5 },
    { minKB: 2.00, texture: 'slatemanphase2', resistance: 1 },
    { minKB: 2.50, texture: 'slatemanphase3', resistance: 0.5 }
];

const CLIPPED_SPEED_SCALE = 0.35;

function updateClippedStatus(scene, player, clipped) {
    if (clipped && !player.hasDoubleJumped) {
        player.hasDoubleJumped = true;
        player.doubleJumpClipped = true;
    } else if (!clipped && player.doubleJumpClipped) {
        player.hasDoubleJumped = false;
        player.doubleJumpClipped = false;
    }
    if (!player.clippedShed && clipped) {
        player.clippedShed = scene.add.particles(player.x, player.y, '__WHITE', {
            x: { min: -18, max: 18 },
            y: { min: -18, max: 18 },
            speedY: { min: 20, max: 70 },
            speedX: { min: -25, max: 25 },
            gravityY: 300,
            scale: { start: 2.2, end: 0.6 },
            alpha: { start: 0.9, end: 0 },
            tint: [0x2f7d1f, 0x3f9a2a, 0x255f18],
            lifespan: 450,
            frequency: 45,
            quantity: 1,
            emitting: false
        });
        scene.objs.add(player.clippedShed);
    }
    const shed = player.clippedShed;
    if (!shed) return;
    shed.setPosition(player.x, player.y);
    if (clipped && !shed.emitting) shed.start();
    else if (!clipped && shed.emitting) shed.stop();
}

function updateKB(scene) {
    for (const player of scene.gameState.players) {
        if (player.eliminated) continue;
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

        if (player.plunged) {

            if (!player.lastPlungeTick) {
                player.lastPlungeTick = scene.time.now;
            }
            player.plungeAura.visible = true;

            if (scene.time.now - player.lastPlungeTick >= 450) {
                player.KBmultiplier += 0.025;
                player.flash();
                scene.sound.play('anyhit');
                player.lastPlungeTick = scene.time.now;
            }
        } else {
            player.plungeAura.visible = false;
            player.lastPlungeTick = null;
        }

        let speedScaling = 1;
        let damageScale = 1;
        if (player.name === "SLATEMAN") {
            speedScaling = SLATEMAN_START_SPEED + (player.KBmultiplier - 1) * SLATEMAN_SPEED_PER_KB;
            damageScale = Math.max(0.1, 1 - (player.KBmultiplier - 1) * 0.35);
        }
        if (player.chopped) {
            speedScaling *= 0.5;
            damageScale *= 0.5;
        }
        const clipped = scene.time.now < (player.clippedUntil ?? 0);
        if (clipped) speedScaling *= CLIPPED_SPEED_SCALE;
        updateClippedStatus(scene, player, clipped);
        player.playerSpeedScaling = speedScaling;
        player.baseDamageScale = damageScale;
        player.choppedMark.visible = player.chopped;
        player.nettedMark.visible = player.netted;

        if (player.lastKBmultiplier !== player.KBmultiplier) {

            if (player.name === "SLATEMAN") {
                const phase = SLATEMAN_PHASES.filter(({ minKB }) => player.KBmultiplier >= minKB).length - 1;
                const { texture, resistance } = SLATEMAN_PHASES[phase];
                player.setTexture(texture);
                player.playerKBresistance = resistance;
                if (phase > (player.slatePhase ?? 0)) scene.sound.play('rockbreak');
                player.slatePhase = phase;
            }
        }
        player.plungeAura.setPosition(player.x, player.y);
        player.choppedMark.setPosition(player.x, player.y);
        player.nettedMark.setPosition(player.x, player.y);
        if (player.shadow) updateGroundShadow(scene, player);

        if (player.slateTrail) {
            const { x: vx, y: vy } = player.body.velocity;
            const speed = Math.hypot(vx, vy);
            if (speed > 20) {
                player.slateTrail.setPosition(player.x - (vx / speed) * 20, player.y - (vy / speed) * 20 + 25);
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
const STALE_FLOAT_MS = 200;
const NO_GRAVITY_FLOOR_GRIP = 1;
const NO_GRAVITY_RESPAWN_DRIFT = 250;

function syncFightersToPhysics(fighters) {
    for (const fighter of fighters) {
        const body = fighter?.body;
        if (!body?.enable || !body.moves) continue;
        fighter.x += body.position.x - body.prevFrame.x;
        fighter.y += body.position.y - body.prevFrame.y;
        body.prevFrame.copy(body.position);
    }
}

function settleNoGravity(scene) {
    if (!scene.noGravityPending) return;
    const fighters = Object.values(scene.gameState.players ?? {});
    if (!fighters.every(fighter => (fighter.noGravitySettled ||= fighter.body?.touching.down))) return;
    scene.noGravityPending = false;
    scene.physics.world.gravity.y = NO_GRAVITY_FLOOR_GRIP;
}

function gravityHeldOff(player) {
    return Boolean(player.ledge || player.smackedBy || player.grabbedBy ||
        player.isUsingSideSpecial || !player.body.enable);
}

function restoreGroundFriction(player) {
    if (player.willDecelerate || player.hitstun || player.freeze) return;
    if (!(player.body.blocked.down || player.body.touching.down)) return;
    if (player.isUsingSideSpecial || player.ledgeSlide || player.smackArc ||
        player.activeGrab || player.grabbedBy || player.smackedBy) return;
    player.willDecelerate = true;
}

const TUNNEL_LAND_SLOP = 2;
const TUNNEL_MAX_FRAME_DROP = 600;

function catchPlatformTunneling(scene, player) {
    const body = player.body;
    const previousBottom = player.lastFrameBottom;
    const previousLeft = player.lastFrameLeft;
    player.lastFrameBottom = body?.bottom;
    player.lastFrameLeft = body?.left;
    if (!body?.enable || body.checkCollision.none || previousBottom === undefined || previousLeft === undefined) return;
    if (player.ledge || player.smackedBy || player.grabbedBy) return;
    const drop = body.bottom - previousBottom;
    if (drop <= 0 || drop > Math.max(TUNNEL_MAX_FRAME_DROP, body.maxVelocity.y / 30)) return;

    let landing = null;
    for (const platform of getMapPlatforms(scene)) {
        const top = platform.body.top;
        const crossed = previousBottom <= top + TUNNEL_LAND_SLOP && body.bottom > top + TUNNEL_LAND_SLOP;
        if (!crossed) continue;
        const left = previousLeft + (body.left - previousLeft) * Phaser.Math.Clamp((top - previousBottom) / drop, 0, 1);
        const overlapsX = left + body.width > platform.body.left && left < platform.body.right;
        if (overlapsX && (!landing || top < landing.top)) landing = { top, left };
    }
    if (landing === null) return;

    const velocityX = body.velocity.x;
    body.reset(
        landing.left + (player.displayOriginX - body.offset.x) * Math.abs(player.scaleX),
        landing.top - body.height + (player.displayOriginY - body.offset.y) * Math.abs(player.scaleY)
    );
    player.setVelocity(velocityX, 0);
    player.lastFrameBottom = body.bottom;
    player.lastFrameLeft = body.left;
    player.tunnelCaught = true;
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

function updateCamera(scene, living) {
    const camera = scene.cameras.main;
    const champion = scene.matchChampion;
    const group = living.length ? living : scene.gameState.players;
    const xs = group.map(fighter => fighter.x);
    const ys = group.map(fighter => fighter.y);
    let midX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    let midY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
    let distX = Math.max(...xs) - Math.min(...xs);
    let distY = Math.max(...ys) - Math.min(...ys);

    if (champion) {
        midX = champion.x;
        midY = champion.y;
        scene.baseZoom = 1.4;
        distX = Math.abs(champion.x);
        distY = Math.abs(champion.y);
    }

    let distance = Math.max(distX, distY);
    const perspectiveFocus = scene.perspective && !scene.gameEnded
        ? updatePerspective(scene, scene.perspective)
        : null;
    if (perspectiveFocus) {
        midX = perspectiveFocus.x;
        midY = perspectiveFocus.y;
        distance = 0;
    }

    let zoom = scene.baseZoom - (distance / 2000);

    const maxZoom = scene.gameState.map.definition.maxZoom ?? defaultMaxZoom;
    zoom = Phaser.Math.Clamp(zoom, minZoom, maxZoom);

    const focus = scene.hitFocus?.active ? scene.hitFocus : null;
    if (focus) {
        midX = focus.x;
        midY = focus.y;
        zoom = HIT_FOCUS_ZOOM;
    }
    const baseFollowRate = focus ? 0.35 : 0.12;
    const zoomRate = focus ? 0.3 : 0.05;
    const followed = focus ?? perspectiveFocus;
    const followVelocity = axis => followed?.body
        ? followed.body.velocity[axis]
        : group.reduce((sum, fighter) => sum + fighter.body.velocity[axis], 0) / group.length;
    const snapCamera = Math.hypot(followVelocity('x'), followVelocity('y')) > CAMERA_SNAP_SPEED;
    const followRateX = snapCamera ? 1 : cameraFollowRate(scene, baseFollowRate, followVelocity('x'), camera.width);
    const followRateY = snapCamera ? 1 : cameraFollowRate(scene, baseFollowRate, followVelocity('y'), camera.height);

    camera.scrollX -= scene.shakeOffset.x;
    camera.scrollY -= scene.shakeOffset.y;

    camera.scrollX += (midX - camera.width / 2 - camera.scrollX) * followRateX;
    camera.scrollY += (midY - camera.height / 2 - camera.scrollY) * followRateY;

    scene.shakeOffset.x = 0;
    scene.shakeOffset.y = 0;
    if (scene.shake && scene.time.now < scene.shake.until) {
        const left = (scene.shake.until - scene.time.now) / (scene.shake.until - scene.shake.start);
        const strength = scene.shake.intensity * left / camera.zoom;
        scene.shakeOffset.x = Phaser.Math.FloatBetween(-strength, strength);
        scene.shakeOffset.y = Phaser.Math.FloatBetween(-strength, strength);
    }
    camera.scrollX += scene.shakeOffset.x;
    camera.scrollY += scene.shakeOffset.y;

    camera.zoom += (zoom - camera.zoom) * zoomRate;
}

function dimMobileButtons(scene, slot) {
    scene.mobileButtons[slot]?.forEach(object => {
        if (object) object.setAlpha(0.25);
    });
}

function markKeyboardInput(scene, slot) {
    if (inputMode[slot] === 'keyboard') return;
    dimMobileButtons(scene, slot);
    inputMode[slot] = 'keyboard';
}

function handleAttackInput(scene, player, input, victim) {
    if (player.isBot) return;
    const toggleAttack = usesToggleAttack(player);
    const attackPressed = toggleAttack ? input.attackPressed : input.attack || input.attackPressed;
    const ledgeGrab = input.attackPressed && tryLedgeGrab(scene, player, victim);
    if (!attackPressed || ledgeGrab || isUniversalBusy(player) || (player.hitstun && !player.activeGrab)) return;
    const now = scene.time.now;
    if (inputMode[player.slot] !== 'keyboard' && !mobileControls[player.slot]?.attack) {
        dimMobileButtons(scene, player.slot);
    }
    if (toggleAttack) {
        handleAttack(scene, player, victim);
    } else if (now - player.lastInput.up < tiltThreshold) {
        handleUpTilt(scene, player, victim);
    } else if (now - player.lastInput.down < tiltThreshold) {
        handleDownTilt(scene, player, victim);
    } else if (now - player.lastInput.left < tiltThreshold) {
        handleHorizantalTilt(scene, player, victim, 'left');
    } else if (now - player.lastInput.right < tiltThreshold) {
        handleHorizantalTilt(scene, player, victim, 'right');
    } else {
        handleAttack(scene, player, victim);
    }
}

function updateFighterBookkeeping(scene, player) {
    catchPlatformTunneling(scene, player);

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
        if (player.airTime > 0) squashOnLanding(player, player.fallSpeed ?? 0);
        if (player.downslamming && player.airTime > 0) {
            downslamAttack(scene, player);
            player.downslamming = false;
            player.downslamFx = false;
        }
        player.airTime = 0;
        player.fallSpeed = 0;
    } else {
        player.airTime += scene.game.loop.delta;
        player.fallSpeed = Math.max(0, player.body.velocity.y);
    }
    player.flashObject.setPosition(player.x, player.y);

    if (player.hitstun && player.isAttacking && !player.activeGrab &&
        !player.attackBypassesHitstun) {
        player.isAttacking = false;
    }

    player.freeze = scene.time.now < player.freezeUntil;
    restoreGroundFriction(player);
    updateImmunity(scene, player);
    if (player.isAttacking || player.hitstun || player.freeze) cancelDownslamFx(player);
    updateLaunchArc(player);
    if (player.canAttack || player.hitstun || player.freeze || player.activeGrab || player.grabbedBy) {
        player.attackLockedFor = 0;
    } else {
        player.attackLockedFor = (player.attackLockedFor || 0) + scene.game.loop.delta;
        if (player.attackLockedFor > MAX_ATTACK_LOCK_MS) {
            player.canAttack = true;
            player.attackLockedFor = 0;
        }
    }
    player.chopped = scene.time.now < player.choppedUntil;
    player.netted = player.hitstun && scene.time.now < player.nettedUntil;
    player.body.pushable = !player.netted;
    if (player.netted && (player.body.blocked.down || player.body.touching.down)) {
        player.setVelocityX(Math.abs(player.body.velocity.x) > 10 ? player.body.velocity.x * 0.8 : 0);
    }

    if (!player.body.touching.down) player.currentPlatform = null;
    getMapPlatforms(scene).forEach(platform => {
        handlePlatformCollide(player, platform);
    });
}

function updateFacing(player, input) {
    if (input.left) player.lastDir = { x: -1, y: 0 };
    else if (input.right) player.lastDir = { x: 1, y: 0 };
    else if (input.up) player.lastDir = { x: 0, y: -1 };
    else if (input.down) player.lastDir = { x: 0, y: 1 };
    if (player.lastDir.y === 0) player.atk.setAngle(getAttackSpriteAngle(player));
}

function positionAttachments(scene, player) {
    if (!player.activeGrab) {
        const offset = getAttackSpriteOffset(player);
        player.atk.x = player.x + (player.lastDir.x * player.atkXOffset) + offset.x;
        player.atk.y = player.y + (player.lastDir.y * player.atkYOffset) - 15 + offset.y;
    }
    if (player.name === 'AXEMAN' && player.variant === 'CHAINSAW') {
        positionAttackSprite(player, 'activechainsaw');
        player.atk.setAlpha(player.chainsawMode && player.chainsawCooldownUntil > scene.time.now ? 0 : 1);
    }
}

function positionLabels(scene, player) {
    player.doubleJumpEffect.x = player.x;
    player.doubleJumpEffect.y = player.y + 40;
    player.header.x = scene.online ? player.x : player.x - 10;
    player.header.y = player.y - 50;
    if (player.grassCutText) {
        player.grassCutText.setPosition(player.x, player.y - 75);
        if (player.grassCutTextValue !== player.grassCutCount) {
            player.grassCutText.setText(`Grass cuts: ${player.grassCutCount}`);
            player.grassCutTextValue = player.grassCutCount;
        }
    }
}

function handleMovementInput(scene, player, input, victim) {
    if (player.hitstun || player.isBot || isUniversalBusy(player)) return;
    const { slot } = player;
    const now = scene.time.now;
    const leftPressed = input.leftPressed;
    const rightPressed = input.rightPressed;
    const specialPressed = input.specialPressed;
    const specialHeld = input.special;
    const specialDirection = input.left ? 'left' : input.right ? 'right' : null;
    const command = type => executeStateCommand(scene, scene.gameState.players, { playerID: player.id, type });

    if (leftPressed) {
        player.lastInput.left = now;
        if (!consumePress(input, 'left')) markKeyboardInput(scene, slot);
        handleDirSpecial(scene, player, 'left', now, victim, specialHeld || specialPressed);
    }
    if (rightPressed) {
        player.lastInput.right = now;
        if (!consumePress(input, 'right')) markKeyboardInput(scene, slot);
        handleDirSpecial(scene, player, 'right', now, victim, specialHeld || specialPressed);
    }
    if (specialPressed) {
        if (!consumePress(input, 'special')) markKeyboardInput(scene, slot);
        if (specialDirection && !leftPressed && !rightPressed) {
            handleDirSpecial(scene, player, specialDirection, now, victim, true);
        } else if (!specialDirection) {
            handleNeutralSpecial(scene, player, victim);
        }
    }
    if (!player.hasHitSideSpecial && player.isUsingSideSpecial && fiveframecount === 5) {
        handleDirSpecialAttack(scene, player, victim);
    }
    if (input.left) command(Commands.LEFT);
    else if (input.right) command(Commands.RIGHT);
    else command(Commands.NONE);

    if (input.up && player.body.touching.down) command(Commands.UP);
    if (player.body.touching.down) player.hasDoubleJumped = false;
    if (player.body.blocked.down && player.isUsingSideSpecial === false) player.afterimage = false;

    if (input.upPressed) {
        player.lastInput.up = now;
        if (!consumePress(input, 'up')) markKeyboardInput(scene, slot);
        const quickslamJumped = tryQuickslamJump(scene, player, now);
        if (!quickslamJumped && !player.body.touching.down && !player.hasDoubleJumped) {
            command(Commands.DOUBLE_UP);
        } else if (!quickslamJumped && !player.body.touching.down) {
            tryExtraJump(scene, player, victim);
        }
    }
    if (input.downPressed) {
        player.lastInput.down = now;
        if (!consumePress(input, 'down')) markKeyboardInput(scene, slot);
    }

    if (!input.up && player.body.velocity.y < 0 && !player.hasDoubleJumped) command(Commands.UP_CANCEL);
    if (input.down && player.airTime >= 1000) command(Commands.DOWNSLAM);
}

function applyFreezeGravity(scene, player) {
    if (player.freeze) {
        player.freezeGravity = true;
        player.body.allowGravity = false;
        player.setVelocity(0, -1);
    } else if (player.freezeGravity) {
        player.freezeGravity = null;
        player.body.allowGravity = !gravityHeldOff(player);
    } else if (!player.body.allowGravity && !gravityHeldOff(player)) {
        player.body.allowGravity = true;
    }
    if (player.body.gravity.y < 0 && scene.time.now - (player.grindFloatAt || -Infinity) > STALE_FLOAT_MS) {
        player.body.gravity.y = 0;
    }
}

function teamsStillIn(scene) {
    return new Set(scene.gameState.players.filter(fighter => fighter.lives > 0).map(fighter => fighter.team));
}

function endMatchIfDecided(scene) {
    if (scene.gameEnded) return;
    const teams = teamsStillIn(scene);
    if (teams.size > 1) return;
    scene.gameEnded = true;
    const fighters = scene.gameState.players;
    const winners = teams.size === 1
        ? fighters.filter(fighter => fighter.team === [...teams][0])
        : fighters;
    scene.matchChampion = winners.find(fighter => fighter.lives > 0) ?? winners[0];
    showMatchEnd(scene, winners);
    if (scene.online) reportMatchEnd(winners.map(fighter => fighter.slot));
}

function releaseHoldsOn(scene, player) {
    for (const other of scene.gameState.players) {
        if (other.activeGrab?.target === player) other.activeGrab = null;
    }
    if (player.activeGrab) {
        player.activeGrab.target.grabbedBy = null;
        player.activeGrab = null;
    }
    if (player.smack) {
        player.smack.target.smackedBy = null;
        player.smack = null;
    }
}

const KEEP_VISIBLE_WHEN_OUT = ['statBackground', 'statIcon', 'KBText', 'KBFlashText', 'winText'];

function hideFighter(scene, player) {
    const fighters = scene.gameState.players;
    const kept = new Set(KEEP_VISIBLE_WHEN_OUT.map(key => player[key]));
    const hide = value => {
        if (!(value instanceof Phaser.GameObjects.GameObject) || !value.setVisible) return;
        if (fighters.includes(value) || kept.has(value) || value instanceof Phaser.GameObjects.Container) return;
        if (getMapPlatforms(scene).includes(value)) return;
        value.setVisible(false);
    };
    for (const value of Object.values(player)) {
        if (Array.isArray(value)) value.forEach(hide);
        else hide(value);
    }
    player.launchTrail.stop();
    player.violentTrail.stop();
    player.ultraTrail.stop();
    player.slateTrail?.stop();
    player.setVisible(false);
}

function eliminateFighter(scene, player) {
    player.eliminated = true;
    releaseHoldsOn(scene, player);
    handleMatchEnd(scene, player);
    hideFighter(scene, player);
    player.afterimage = false;
    player.body.enable = false;
    for (const key of ['statBackground', 'statIcon', 'KBText']) player[key].setAlpha(0.35);
}

function creditScorer(scene, loser) {
    const fighters = scene.gameState.players;
    const scorer = loser.lastHitBy ?? (fighters.length === 2 ? fighters.find(fighter => fighter !== loser) : null);
    loser.lastHitBy = null;
    return scorer;
}

function knockOut(scene, loser) {
    loser.koLockedUntil = scene.time.now + KO_LOCK_MS;
    loser.lives -= 1;
    loser.KBmultiplier = modifierOptions.SUDDEN_DEATH.enabled ? 4.00 : 1.00;
    loser.statsLastKB = loser.KBmultiplier;

    const scorer = creditScorer(scene, loser);
    if (scorer) scorer.stats.kos += 1;

    const matchOver = teamsStillIn(scene).size <= 1;
    updateWins(scene, matchOver);
    spawnKOBlast(scene, loser, scorer);
    if (loser.lives > 0 || matchOver) {
        teleportBackToArena(loser, scene.gameState.map.getRespawnX(scorer));
        if (!matchOver) playRespawn(scene, loser);
    } else {
        eliminateFighter(scene, loser);
    }
    endMatchIfDecided(scene);
}

function removePlayersWhoLeft(scene) {
    if (!scene.online) return;
    for (const slot of consumeLeftPlayers()) {
        const fighter = scene.gameState.players.find(player => player.slot === slot);
        if (!fighter || fighter.eliminated) continue;
        fighter.lives = 0;
        const matchOver = teamsStillIn(scene).size <= 1;
        if (!matchOver) eliminateFighter(scene, fighter);
        endMatchIfDecided(scene);
    }
}

function update() {
    readPlayerInputs(this);
    if (this.gamePaused) return;

    fiveframecount += 1;
    removePlayersWhoLeft(this);

    const fighters = this.gameState.players;
    const living = fighters.filter(isAlive);
    const inputOf = player => this.playerInputs[player.slot];
    const victimOf = player => nearestEnemy(this, player);
    updateSpecialMeters(this);
    updateCamera(this, living);

    this.gameState.map.update();
    if (this.speedometers) updateSpeedometers(this, this.speedometers);
    if (this.gameEnded) {
        for (const player of fighters) player.setVelocity(0, 0);
        return;
    }

    for (const player of living) {
        updateUniversalMoves(this, player, victimOf(player), player.isBot ? null : inputOf(player));
    }
    const busy = new Set(living.filter(player => isUniversalBusy(player)));
    for (const player of living) {
        if (!busy.has(player)) continue;
        for (const button of ['left', 'right', 'up', 'down']) consumePress(inputOf(player), button);
    }

    for (const player of living) {
        if (inputOf(player).miscPressed && !player.isBot && !busy.has(player)) {
            handleMisc(this, player, victimOf(player));
        }
    }

    for (const player of living) {
        const input = inputOf(player);
        player.horizontalMovementActive = !player.isBot && !busy.has(player) && (input.left || input.right);
    }

    for (const player of living) handleAttackInput(this, player, inputOf(player), victimOf(player));

    const isOutOfBounds = player => (this.killZones.vertical && (player.y > KILLZONE.bottom || player.y < KILLZONE.top)) ||
        (this.killZones.horizontal && (player.x < KILLZONE.left || player.x > KILLZONE.right));
    for (const player of living) player.outOfBounds = isOutOfBounds(player);

    for (const player of living) updateFighterBookkeeping(this, player);
    updateScythemanGrass(this, living);
    for (const player of living) {
        updateCombo(player, this.game.loop.delta);
        updateFacing(player, inputOf(player));
    }
    for (const player of living) positionAttachments(this, player);
    for (const player of living) updateChainsawWood(this, player, victimOf(player));
    for (const player of living) updateCharacter(this, player, victimOf(player));
    for (const player of living) positionLabels(this, player);

    for (const player of living) {
        if (player.KBmultiplier < 0.7) player.KBmultiplier = 0.70;
        updateKBText(this, player, player.KBmultiplier);
    }
    for (const player of living) updateMatchStats(this, player);
    for (const player of living) {
        updateLaunchEffects(this, player);
        updateDangerGlow(this, player);
    }

    for (const player of living) {
        if (player.afterimage && this.time.now > player.afterimageTimer) {
            spawnAfterimage(this, player);
            player.afterimageTimer = this.time.now + (player.ultraLaunch ? 12 : player.violentLaunch ? 20 : 40);
        }
    }

    for (const player of living) handleMovementInput(this, player, inputOf(player), victimOf(player));
    for (const player of living) applyFreezeGravity(this, player);

    for (const player of living) {
        updateSledgehammerAnimation(player);
        updateSwordmanIdle(player);
        updateWeaponIdle(player);
        updateCharacterIntro(player);
    }

    for (const player of living) {
        if (this.gameEnded) break;
        if (player.outOfBounds && this.time.now >= (player.koLockedUntil ?? 0)) knockOut(this, player);
    }

    const pickAI = slot => window.__legacySlot === slot ? runLegacyBotAI : runBotAI;
    for (const player of [...fighters].reverse()) {
        if (player.isBot && isAlive(player)) pickAI(player.slot)(this, player, victimOf(player), fiveframecount);
    }
    updateKB(this);
    updateMapHazard(this);
    if (fiveframecount >= 5) {
        fiveframecount = 0;
    }
}
