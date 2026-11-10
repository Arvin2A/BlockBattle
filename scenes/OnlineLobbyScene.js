// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { preload as preloadMatch, preloadMenu, preloadCharacterSelection } from './GameScene/preload.js';
import { fadeOutTo } from './transitions.js';
import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { getConnectedControllers, getMenuGamepadInput } from '../navigation.js';
import { net } from '../mp/client.js';
import { cleanName, MAP_CHOICES, MAX_LOBBY_NAME_LENGTH, MAX_NAME_LENGTH } from '../mp/protocol.js';
import { MAPS } from './GameScene/MapDefinitions.js';
import { MATCH_MODES, MODE_TOGGLE_ORDER, PLAYER_COLORS } from '../matchModes.js';
import { formatModifierValue, modifierOptions } from '../modifiers.js';
import { createNameFilter } from '../mp/nameFilter.js';
import inappropriateWords from '../assets/inappropriate_words?raw';
import { getOnlineServerHost, getServerName, isOnlineConfigured } from '../mp/serverConfig.js';
import { CHAOS_TIERS, COLORS, HEX, makeButton } from '../ui/theme.js';

const SETTINGS_KEY = 'blockBattleOnline';
const ROOMS_PER_PAGE = 4;
const MODIFIERS_PER_PAGE = 6;
const PANEL = { x: 710, y: 330, width: 400, height: 330 };
const STAGE_CARD = { width: 204, height: 108, nameOffset: 38 };
const SUB_SCREENS = ['create', 'stage', 'modifiers', 'browse'];
const mapLabel = map => MAPS[map]?.name ?? map;
const isNameBlocked = createNameFilter(inappropriateWords);
const randomPlayerName = () => `Player${Math.floor(Math.random() * 900 + 100)}`;

function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
    }
}

function openNameBox(current, onDone, getError = () => null, { title = 'CHANGE YOUR NAME', maxLength = MAX_NAME_LENGTH } = {}) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;' +
        'justify-content:center;background:rgba(0,0,0,0.6);padding:16px;box-sizing:border-box;';
    const panel = document.createElement('form');
    panel.style.cssText = 'background:#171717;border:3px solid #fff;padding:20px;width:100%;max-width:340px;' +
        'display:flex;flex-direction:column;gap:12px;font-family:VCROSD,monospace;color:#fff;';
    const label = document.createElement('label');
    label.textContent = title;
    label.style.cssText = 'font-size:22px;text-align:center;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = maxLength;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = 'font:inherit;font-size:22px;padding:8px;background:#000;color:#fff;border:2px solid #888;';
    const hint = document.createElement('div');
    const hintText = `Up to ${maxLength} letters/numbers. Enter to save, Esc to cancel.`;
    hint.textContent = hintText;
    hint.style.cssText = 'font-size:14px;color:#999;text-align:center;';
    const showError = message => {
        panel.style.borderColor = COLORS.error;
        input.style.borderColor = COLORS.error;
        hint.style.color = COLORS.error;
        hint.textContent = message;
        panel.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-12px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-8px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(0)' }
        ], { duration: 350, easing: 'ease-out' });
    };
    const clearError = () => {
        panel.style.borderColor = '#fff';
        input.style.borderColor = '#888';
        hint.style.color = '#999';
        hint.textContent = hintText;
    };
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:12px;';
    const makeDomButton = (text, type) => {
        const button = document.createElement('button');
        button.type = type;
        button.textContent = text;
        button.style.cssText = 'flex:1;font:inherit;font-size:20px;padding:8px;background:#333;color:#fff;' +
            'border:2px solid #fff;cursor:pointer;';
        buttons.appendChild(button);
        return button;
    };
    makeDomButton('SAVE', 'submit');
    const cancel = makeDomButton('CANCEL', 'button');
    panel.append(label, input, hint, buttons);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let finished = false;
    const finish = value => {
        if (finished) return;
        finished = true;
        overlay.remove();
        onDone(value);
    };
    overlay.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') finish(null);
    });
    overlay.addEventListener('keyup', event => event.stopPropagation());
    overlay.addEventListener('pointerdown', event => {
        if (event.target === overlay) finish(null);
    });
    panel.addEventListener('submit', event => {
        event.preventDefault();
        const error = getError(input.value);
        if (error) {
            showError(error);
            input.focus();
            return;
        }
        finish(input.value);
    });
    input.addEventListener('input', clearError);
    cancel.addEventListener('click', () => finish(null));
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
    return () => finish(null);
}

function makeArrow(scene, x, y, label, onClick) {
    const arrow = scene.add.text(x, y, label, {
        fontFamily: 'GameFont',
        fontSize: '32px',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    arrow.on('pointerover', () => arrow.setColor('#ffd34d'));
    arrow.on('pointerout', () => arrow.setColor('#ffffff'));
    arrow.on('pointerdown', () => {
        scene.sound.play('hover2');
        onClick();
    });
    return arrow;
}


function text(scene, x, y, value, style = {}) {
    return scene.add.text(x, y, value, {
        fontFamily: 'GameFont',
        fontSize: '14px',
        fill: '#ffffff',
        ...style
    });
}

function onlineModifierKeys() {
    return Object.keys(modifierOptions)
        .map((key, order) => ({ key, order }))
        .filter(({ key }) => modifierOptions[key].onlineAllowed !== false)
        .sort((a, b) => (CHAOS_TIERS[modifierOptions[a.key].tier].rank - CHAOS_TIERS[modifierOptions[b.key].tier].rank) || (a.order - b.order))
        .map(({ key }) => key);
}

function defaultModifierSettings(saved = {}) {
    return Object.fromEntries(onlineModifierKeys().map(key => {
        const modifier = modifierOptions[key];
        const entry = saved[key] ?? {};
        return [key, {
            enabled: Boolean(entry.enabled),
            value: entry.value ?? modifier.clicker?.step,
            collisions: Boolean(entry.collisions)
        }];
    }));
}

export class OnlineLobbyScene extends Phaser.Scene {
    constructor() {
        super('OnlineLobbyScene');
    }

    preload() {
        preloadMenu.call(this);
        preloadCharacterSelection.call(this);
        preloadMatch.call(this);
        const loadingText = this.add.text(500, 300, 'LOADING GAME FILES... 0%', {
            fontFamily: 'GameFont',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.load.on('progress', value => loadingText.setText(`LOADING GAME FILES... ${Math.floor(value * 100)}%`));
        this.load.once('complete', () => loadingText.destroy());
    }

    init(data) {
        this.autoQueue = Boolean(data?.autoQueue);
        this.leavingToMenu = false;
    }

    create() {
        this.cameras.main.fadeIn(200, 0, 0, 0);
        this.add.image(500, 300, 'menuBackground').setDisplaySize(1000, 600);
        this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.7);

        this.add.text(500, 52, 'ONLINE', {
            fontFamily: 'VCROSD',
            fontSize: '48px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(500, 92, `SERVER: ${getServerName()}`, {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffd34d'
        }).setOrigin(0.5);

        this.statusText = this.add.text(500, 118, '', {
            fontFamily: 'GameFont',
            fontSize: '13px',
            fill: '#bbbbbb',
            align: 'center'
        }).setOrigin(0.5);

        makeButton(this, 500, 568, 150, 40, 'BACK', () => this.goToMenu(), 20);
        this.input.keyboard.on('keydown-ESC', () => this.goBack());

        this.cleanups = [];
        this.events.once('shutdown', () => {
            this.cleanups.forEach(cleanup => cleanup());
            this.cleanups = [];
        });

        if (!isOnlineConfigured()) {
            this.showHostingHelp();
            return;
        }

        const saved = loadSettings();
        const characterIndex = Math.max(0, CHARACTER_ROSTER.findIndex(c => c.key === saved.character));
        this.selection = {
            characterIndex,
            variantIndex: Math.max(0, CHARACTER_ROSTER[characterIndex].variants.findIndex(v => v.name === saved.variant)),
            mapIndex: Math.max(0, MAP_CHOICES.indexOf(saved.map)),
            name: cleanName(saved.name ?? randomPlayerName())
        };
        if (isNameBlocked(this.selection.name)) this.selection.name = randomPlayerName();
        const savedLobby = saved.lobby ?? {};
        this.lobbySettings = {
            name: savedLobby.name ? cleanName(savedLobby.name, MAX_LOBBY_NAME_LENGTH) : null,
            mode: MODE_TOGGLE_ORDER.includes(savedLobby.mode) ? savedLobby.mode : '1v1',
            mapIndex: Math.max(0, MAP_CHOICES.indexOf(savedLobby.map)),
            modifiers: defaultModifierSettings(savedLobby.modifiers)
        };
        this.queueState = 'idle';
        this.queueStartedAt = 0;
        this.rooms = [];
        this.roomPage = 0;
        this.modifierPage = 0;
        this.lobby = null;
        this.previousPad = {};
        this.closeNameBox = null;
        this.cleanups.push(() => this.closeNameBox?.());

        this.buildFighterPanel();
        this.buildMatchPanel();
        this.refreshSelection();
        this.showScreen('home');
        this.bindLobbyKeys();
        this.connectToServer();
    }

    showHostingHelp() {
        this.add.rectangle(500, 320, 760, 330, 0x171717, 0.95).setStrokeStyle(3, 0xffffff);
        this.add.text(500, 200, "ONLINE ISN'T SET UP FOR THIS WEBSITE", {
            fontFamily: 'VCROSD',
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.add.text(500, 330, [
            'This copy of the game was built without an online server address,',
            'so it has nowhere to connect.',
            '',
            'Play online from the official BlockBattle website instead.'
        ].join('\n'), {
            fontFamily: 'GameFont',
            fontSize: '15px',
            fill: '#dddddd',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);
    }

    buildFighterPanel() {
        this.nameButton = makeButton(this, 250, 146, 460, 30, '', () => this.editName(), 17);
        this.add.rectangle(250, 330, 460, 330, 0x171717, 0.92).setStrokeStyle(3, 0xffffff);
        this.add.text(140, 185, 'YOUR FIGHTER', {
            fontFamily: 'GameFont',
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.fighterIcon = this.add.image(140, 275, 'axeman').setDisplaySize(120, 120);
        makeArrow(this, 50, 275, '<', () => this.changeCharacter(-1));
        makeArrow(this, 230, 275, '>', () => this.changeCharacter(1));

        this.fighterName = this.add.text(140, 370, '', {
            fontFamily: 'GameFont',
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.variantText = this.add.text(140, 402, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.variantButton = makeButton(this, 140, 450, 190, 36, 'SWITCH VARIANT', () => this.changeVariant(1), 18);

        this.add.rectangle(265, 330, 2, 290, 0x686868);
        this.fighterDesc = this.add.text(372, 330, '', {
            fontFamily: 'VCROSD',
            fontSize: '15px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 190 }
        }).setOrigin(0.5);
    }

    buildMatchPanel() {
        this.add.rectangle(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 0x171717, 0.92).setStrokeStyle(3, 0xffffff);
        this.screens = {};
        this.buildHomeScreen();
        this.buildQuickScreen();
        this.buildCreateScreen();
        this.buildStageScreen();
        this.buildModifierScreen();
        this.buildBrowseScreen();
        this.buildLobbyScreen();
        const panelBack = makeButton(this, 560, 146, 100, 30, '< BACK', () => this.goBack(), 17);
        SUB_SCREENS.forEach(screen => this.addToScreen(screen, panelBack));

        this.queueText = this.add.text(PANEL.x, 484, '', {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#ffd34d',
            align: 'center'
        }).setOrigin(0.5);
        this.keyHint = this.add.text(500, 528, '', {
            fontFamily: 'GameFont',
            fontSize: '11px',
            fill: '#999999'
        }).setOrigin(0.5);
    }

    addToScreen(name, ...objects) {
        this.screens[name] ??= [];
        for (const object of objects) {
            if (object?.box) this.screens[name].push(object.box, object.text);
            else this.screens[name].push(object);
        }
        return objects[0];
    }

    screenTitle(name, label) {
        return this.addToScreen(name, text(this, PANEL.x, 188, label, { fontFamily: 'VCROSD', fontSize: '24px' }).setOrigin(0.5));
    }

    showScreen(name) {
        this.screen = name;
        const shown = new Set(this.screens[name] ?? []);
        Object.values(this.screens).flat().forEach(object => object.setVisible(shown.has(object)));
        this.queueText.setText('');
        const hints = {
            home: '< > FIGHTER   ^ v VARIANT   N NAME   ENTER QUICK 1V1   ESC BACK',
            quick: '< > FIGHTER   ^ v VARIANT   ENTER CANCEL   ESC BACK',
            create: '< > FIGHTER   ^ v VARIANT   N NAME   ENTER CREATE   ESC BACK',
            stage: '^ v BROWSE STAGES   ENTER DONE   ESC BACK',
            modifiers: 'CLICK A CARD TO TOGGLE IT, CLICK ITS BOX TO CHANGE IT   ESC BACK',
            browse: '< > FIGHTER   ^ v VARIANT   1-4 JOIN   ESC BACK',
            lobby: 'ENTER START (HOST)   ESC LEAVE'
        };
        this.keyHint.setText(hints[name] ?? '');
        if (name === 'browse') this.refreshRooms();
        if (name === 'create') this.refreshCreate();
        if (name === 'stage') this.refreshStage(false);
        if (name === 'modifiers') this.refreshModifiers();
        if (name === 'lobby') this.refreshLobby();
        if (name === 'quick') this.refreshQueue();
    }

    buildHomeScreen() {
        this.screenTitle('home', 'PLAY ONLINE');
        this.addToScreen('home',
            makeButton(this, PANEL.x, 250, 320, 48, 'CREATE LOBBY', () => this.showScreen('create'), 24),
            makeButton(this, PANEL.x, 318, 320, 48, 'QUICK 1V1', () => this.startQuick(), 24),
            makeButton(this, PANEL.x, 418, 320, 48, 'BROWSE LOBBIES', () => this.showScreen('browse'), 24)
        );
        this.addToScreen('home', text(this, 560, 362, 'QUICK 1V1 STAGE', { fontSize: '11px', fill: '#bbbbbb' }).setOrigin(0, 0.5));
        this.quickMapText = this.addToScreen('home', text(this, 775, 362, '', { fontFamily: 'VCROSD', fontSize: '16px' }).setOrigin(0.5));
        this.addToScreen('home',
            makeArrow(this, 695, 362, '<', () => this.changeQuickMap(-1)).setFontSize(20),
            makeArrow(this, 855, 362, '>', () => this.changeQuickMap(1)).setFontSize(20)
        );
    }

    buildQuickScreen() {
        this.screenTitle('quick', 'QUICK 1V1');
        this.quickStatus = this.addToScreen('quick', text(this, PANEL.x, 285, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            align: 'center'
        }).setOrigin(0.5));
        this.addToScreen('quick', text(this, PANEL.x, 335, 'You get paired with whoever has been\nwaiting the longest.', {
            fontSize: '12px',
            fill: '#999999',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5));
        this.quickCancel = this.addToScreen('quick', makeButton(this, PANEL.x, 420, 240, 44, 'CANCEL', () => this.cancelQuick(), 22));
    }

    makeRow(screen, y, height, label, onClick) {
        const box = this.add.rectangle(PANEL.x, y, 360, height, 0x262626).setStrokeStyle(2, 0x686868);
        if (onClick) {
            box.setInteractive({ useHandCursor: true });
            box.on('pointerdown', () => {
                this.sound.play('hover2');
                onClick();
            });
        }
        const title = text(this, 545, y - (height > 44 ? 10 : 0), label, { fontFamily: 'VCROSD', fontSize: '20px' }).setOrigin(0, 0.5);
        this.addToScreen(screen, box, title);
        return box;
    }

    makeValueBox(screen, x, y, width, onClick) {
        const box = this.add.rectangle(x, y, width, 30, HEX.panel).setStrokeStyle(2, HEX.border)
            .setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => {
            this.sound.play('hover');
            onClick();
        });
        const label = text(this, x, y, '', { fontFamily: 'VCROSD', fontSize: '18px' }).setOrigin(0.5);
        this.addToScreen(screen, box, label);
        return label;
    }

    buildCreateScreen() {
        this.screenTitle('create', 'LOBBY CREATION');
        this.lobbyNameButton = this.addToScreen('create', makeButton(this, PANEL.x, 224, 360, 32, '', () => this.editLobbyName(), 17));
        this.makeRow('create', 270, 44, 'GAMEMODE');
        this.modeLabel = this.makeValueBox('create', 815, 270, 130, () => this.cycleMode());
        this.makeRow('create', 326, 56, 'MODIFIERS', () => this.showScreen('modifiers'));
        this.modifierSummary = this.addToScreen('create', text(this, 545, 338, '', { fontSize: '11px', fill: '#bbbbbb' }).setOrigin(0, 0.5));
        this.addToScreen('create', text(this, 855, 326, '>', { fontFamily: 'VCROSD', fontSize: '26px' }).setOrigin(0.5));
        this.makeRow('create', 382, 44, 'STAGE', () => this.showScreen('stage'));
        this.stageLabel = this.addToScreen('create', text(this, 840, 382, '', { fontFamily: 'VCROSD', fontSize: '18px', fill: '#ffd34d' }).setOrigin(1, 0.5));
        this.addToScreen('create', text(this, 855, 382, '>', { fontFamily: 'VCROSD', fontSize: '26px' }).setOrigin(0.5));
        this.addToScreen('create', makeButton(this, PANEL.x, 446, 300, 42, 'CREATE LOBBY', () => this.createLobby(), 22));
    }

    buildStageScreen() {
        this.screenTitle('stage', 'SELECT STAGE');
        this.stageCards = MAP_CHOICES.map(map => {
            const card = this.add.rectangle(PANEL.x, 330, STAGE_CARD.width + 8, STAGE_CARD.height + 8, 0x262626).setStrokeStyle(3, 0x686868)
                .setInteractive({ useHandCursor: true });
            const preview = this.add.image(PANEL.x, 330, MAPS[map]?.preview ?? 'randompreview')
                .setDisplaySize(STAGE_CARD.width, STAGE_CARD.height);
            const name = text(this, PANEL.x, 330, mapLabel(map), {
                fontFamily: 'VCROSD',
                fontSize: '20px',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 5
            }).setOrigin(0.5);
            card.on('pointerdown', () => this.pickStage(MAP_CHOICES.indexOf(map)));
            this.addToScreen('stage', card, preview, name);
            return { card, preview, name, previewScale: { x: preview.scaleX, y: preview.scaleY } };
        });
        this.addToScreen('stage', makeButton(this, PANEL.x, 462, 200, 36, 'DONE', () => this.showScreen('create'), 20));
        this.input.on('wheel', (_pointer, _objects, _deltaX, deltaY) => {
            if (this.screen === 'stage' && deltaY !== 0) this.pickStage(this.lobbySettings.mapIndex + Math.sign(deltaY));
        });
    }

    buildModifierScreen() {
        this.modifierTitle = this.screenTitle('modifiers', 'MODIFIERS');
        this.modifierKeys = onlineModifierKeys();
        this.modifierRows = [];
        for (let index = 0; index < MODIFIERS_PER_PAGE; index++) {
            const y = 222 + index * 38;
            const row = { key: null };
            row.box = this.add.rectangle(PANEL.x, y, 370, 32, HEX.panel).setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            row.box.on('pointerdown', () => this.toggleModifier(row.key));
            row.name = text(this, 532, y, '', { fontFamily: 'VCROSD', fontSize: '17px' }).setOrigin(0, 0.5);
            row.valueBox = this.add.rectangle(845, y, 110, 24, HEX.panel).setStrokeStyle(2, HEX.border)
                .setInteractive({ useHandCursor: true });
            row.valueBox.on('pointerdown', () => this.cycleModifierValue(row.key));
            row.value = text(this, 845, y, '', { fontFamily: 'VCROSD', fontSize: '15px' }).setOrigin(0.5);
            this.addToScreen('modifiers', row.box, row.name, row.valueBox, row.value);
            this.modifierRows.push(row);
        }
        this.addToScreen('modifiers',
            makeArrow(this, 560, 462, '<', () => this.changeModifierPage(-1)),
            makeArrow(this, 860, 462, '>', () => this.changeModifierPage(1)),
            makeButton(this, PANEL.x, 462, 180, 34, 'DONE', () => this.showScreen('create'), 20)
        );
    }

    buildBrowseScreen() {
        this.roomsHeader = this.screenTitle('browse', '');
        this.roomsHeader.setFontSize(20);
        this.pageArrows = [
            makeArrow(this, 540, 188, '<', () => this.changeRoomPage(-1)),
            makeArrow(this, 880, 188, '>', () => this.changeRoomPage(1))
        ];
        this.pageArrows.forEach(arrow => arrow.setFontSize(22));
        this.addToScreen('browse', ...this.pageArrows);

        this.roomRows = [];
        for (let i = 0; i < ROOMS_PER_PAGE; i++) {
            const y = 238 + i * 54;
            const row = { room: null };
            row.box = this.add.rectangle(PANEL.x, y, 380, 48, 0x262626).setStrokeStyle(2, 0x555555);
            row.name = text(this, 522, y - 11, '', { fontFamily: 'VCROSD', fontSize: '18px' }).setOrigin(0, 0.5);
            row.details = text(this, 522, y + 11, '', { fontSize: '10px', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            row.count = text(this, 800, y, '', { fontFamily: 'VCROSD', fontSize: '18px' }).setOrigin(0.5);
            row.join = makeButton(this, 862, y, 70, 30, 'JOIN', () => this.joinRoom(row.room), 16);
            this.addToScreen('browse', row.box, row.name, row.details, row.count, row.join);
            this.roomRows.push(row);
        }
        this.emptyRoomsText = this.addToScreen('browse', text(this, PANEL.x, 316, 'No lobbies are open right now.\nCreate one and it shows up here\nfor everyone online.', {
            fontSize: '13px',
            fill: '#999999',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5));
    }

    buildLobbyScreen() {
        this.lobbyTitle = this.screenTitle('lobby', '');
        this.lobbyInfo = this.addToScreen('lobby', text(this, PANEL.x, 214, '', { fontSize: '11px', fill: '#bbbbbb', align: 'center' }).setOrigin(0.5));
        this.memberRows = [];
        for (let i = 0; i < 4; i++) {
            const y = 252 + i * 42;
            const row = {};
            row.box = this.add.rectangle(PANEL.x, y, 370, 36, 0x262626).setStrokeStyle(2, 0x555555);
            row.swatch = this.add.rectangle(540, y, 18, 18, 0xffffff);
            row.name = text(this, 558, y - 7, '', { fontFamily: 'VCROSD', fontSize: '17px' }).setOrigin(0, 0.5);
            row.fighter = text(this, 558, y + 9, '', { fontSize: '10px', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            row.tag = text(this, 880, y, '', { fontFamily: 'VCROSD', fontSize: '15px', fill: '#ffd34d' }).setOrigin(1, 0.5);
            this.addToScreen('lobby', row.box, row.swatch, row.name, row.fighter, row.tag);
            this.memberRows.push(row);
        }
        this.startButton = this.addToScreen('lobby', makeButton(this, 615, 446, 170, 40, 'START', () => this.startLobby(), 22));
        this.leaveButton = makeButton(this, 805, 446, 170, 40, 'LEAVE', () => this.leaveLobby(), 22);
        this.addToScreen('lobby', this.leaveButton);
        this.lobbyWaitText = this.addToScreen('lobby', text(this, 615, 446, 'WAITING FOR\nTHE HOST', { fontSize: '11px', fill: '#bbbbbb', align: 'center' }).setOrigin(0.5));
    }

    bindLobbyKeys() {
        const keyboard = this.input.keyboard;
        const bind = (keys, action) => keys.forEach(key => keyboard.on(`keydown-${key}`, action));
        bind(['LEFT', 'A'], () => this.changeCharacter(-1));
        bind(['RIGHT', 'D'], () => this.changeCharacter(1));
        bind(['UP', 'W'], () => this.screen === 'stage' ? this.pickStage(this.lobbySettings.mapIndex - 1) : this.changeVariant(-1));
        bind(['DOWN', 'S'], () => this.screen === 'stage' ? this.pickStage(this.lobbySettings.mapIndex + 1) : this.changeVariant(1));
        bind(['N'], () => this.editName());
        bind(['ENTER', 'SPACE'], () => this.confirm());
        ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, index) => {
            bind([key], () => {
                if (this.screen === 'browse') this.joinRoom(this.roomRows[index].room);
            });
        });
    }

    confirm() {
        if (this.screen === 'home' || this.screen === 'quick') this.toggleQuick();
        else if (this.screen === 'create') this.createLobby();
        else if (this.screen === 'stage' || this.screen === 'modifiers') this.showScreen('create');
        else if (this.screen === 'lobby') this.startLobby();
    }

    connectToServer() {
        this.setStatus('Connecting to the server...');
        const listen = (type, handler) => this.cleanups.push(net.on(type, handler));

        listen('status', message => {
            if (this.queueState !== 'found') {
                this.setStatus(`Connected to ${getOnlineServerHost()}   |   ${message.online} online   |   ${message.waiting ?? message.online} waiting   |   ${message.queued} open   |   ${message.matches} playing`);
            }
        });
        listen('queued', () => {
            this.queueState = 'queued';
            this.queueStartedAt = this.time.now;
            this.showScreen('quick');
        });
        listen('left', () => {
            this.queueState = 'idle';
            this.lobby = null;
            this.refreshQueue();
        });
        listen('rooms', message => {
            this.rooms = Array.isArray(message.rooms) ? message.rooms : [];
            this.refreshRooms();
        });
        listen('lobby', message => {
            this.queueState = 'lobby';
            this.lobby = message.lobby;
            if (this.screen !== 'lobby') this.showScreen('lobby');
            else this.refreshLobby();
        });
        listen('joinFailed', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'joining') this.queueState = 'idle';
        });
        listen('matchFound', message => this.startMatch(message));
        listen('error', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'queued' || this.queueState === 'joining' || this.queueState === 'creating') {
                this.queueState = 'idle';
                if (this.screen === 'quick') this.showScreen('home');
            }
        });
        listen('disconnected', () => {
            this.queueState = 'idle';
            this.lobby = null;
            this.rooms = [];
            this.showScreen('home');
            this.setStatus('Lost connection to the server. Is it still running?', '#ff6b6b');
        });

        net.connect()
            .then(() => {
                if (!this.statusText?.active) return;
                this.setStatus(`Connected to ${getOnlineServerHost()}`);
                if (this.autoQueue) this.startQuick();
            })
            .catch(error => {
                this.setStatus(`${error.message} It may be down right now, try again later.`, '#ff6b6b');
            });
    }

    setStatus(value, color = '#bbbbbb') {
        if (!this.statusText?.active) return;
        this.statusText.setText(value).setColor(color);
    }

    update(time) {
        if (!this.selection) return;
        if (this.queueState === 'queued') this.refreshQueue(time);
        this.pollController();
    }

    pollController() {
        const pad = getConnectedControllers(this)[0];
        if (!pad) return;
        const input = getMenuGamepadInput(pad);
        const pressed = key => input[key] && !this.previousPad[key];
        if (pressed('left')) this.changeCharacter(-1);
        if (pressed('right')) this.changeCharacter(1);
        if (pressed('up')) this.changeVariant(-1);
        if (pressed('down')) this.changeVariant(1);
        if (pressed('a')) this.confirm();
        this.previousPad = input;
    }

    get locked() {
        return this.queueState !== 'idle';
    }

    changeCharacter(direction) {
        if (!this.selection || this.locked) return;
        const count = CHARACTER_ROSTER.length;
        this.selection.characterIndex = (this.selection.characterIndex + direction + count) % count;
        this.selection.variantIndex = 0;
        this.refreshSelection();
    }

    changeVariant(direction) {
        if (!this.selection || this.locked) return;
        const variants = CHARACTER_ROSTER[this.selection.characterIndex].variants;
        this.selection.variantIndex = (this.selection.variantIndex + direction + variants.length) % variants.length;
        this.refreshSelection();
    }

    changeQuickMap(direction) {
        if (!this.selection || this.locked) return;
        const count = MAP_CHOICES.length;
        this.selection.mapIndex = (this.selection.mapIndex + direction + count) % count;
        this.refreshSelection();
    }

    editName() {
        if (!this.selection || this.locked || this.closeNameBox) return;
        this.input.keyboard.enabled = false;
        this.closeNameBox = openNameBox(this.selection.name, entered => {
            this.closeNameBox = null;
            if (!this.sys.isActive()) return;
            this.input.keyboard.enabled = true;
            if (entered === null) return;
            this.selection.name = cleanName(entered);
            this.refreshSelection();
        }, entered => isNameBlocked(cleanName(entered)) || isNameBlocked(entered)
            ? 'That name is not allowed. Pick a different one.'
            : null);
    }

    editLobbyName() {
        if (this.closeNameBox) return;
        this.input.keyboard.enabled = false;
        this.closeNameBox = openNameBox(this.getLobbyName(), entered => {
            this.closeNameBox = null;
            if (!this.sys.isActive()) return;
            this.input.keyboard.enabled = true;
            if (entered === null) return;
            this.lobbySettings.name = cleanName(entered, MAX_LOBBY_NAME_LENGTH);
            this.refreshCreate();
        }, entered => isNameBlocked(cleanName(entered, MAX_LOBBY_NAME_LENGTH)) || isNameBlocked(entered)
            ? 'That lobby name is not allowed. Pick a different one.'
            : null, { title: 'LOBBY NAME', maxLength: MAX_LOBBY_NAME_LENGTH });
    }

    getLobbyName() {
        return this.lobbySettings.name ?? cleanName(`${this.selection.name}'s Lobby`, MAX_LOBBY_NAME_LENGTH);
    }

    cycleMode() {
        const order = MODE_TOGGLE_ORDER;
        this.lobbySettings.mode = order[(order.indexOf(this.lobbySettings.mode) + 1) % order.length];
        this.refreshCreate();
    }

    pickStage(index) {
        const count = MAP_CHOICES.length;
        this.lobbySettings.mapIndex = (index + count) % count;
        this.sound.play('revolveselect');
        this.refreshStage(true);
        this.saveAll();
    }

    toggleModifier(key) {
        const entry = this.lobbySettings.modifiers[key];
        if (!entry) return;
        entry.enabled = !entry.enabled;
        const rival = { NO_VERTICAL_KILLZONE: 'NO_HORIZONTAL_KILLZONE', NO_HORIZONTAL_KILLZONE: 'NO_VERTICAL_KILLZONE' }[key];
        if (entry.enabled && rival) this.lobbySettings.modifiers[rival].enabled = false;
        this.sound.play('hover');
        this.refreshModifiers();
    }

    cycleModifierValue(key) {
        const modifier = modifierOptions[key];
        const entry = this.lobbySettings.modifiers[key];
        if (!modifier || !entry) return;
        if (modifier.collisionToggle) {
            entry.collisions = !entry.collisions;
        } else if (modifier.clicker) {
            const { step, steps } = modifier.clicker;
            const next = Math.round((entry.value + step) * 10) / 10;
            entry.value = next > step * steps + 0.001 ? step : next;
        }
        this.refreshModifiers();
    }

    changeModifierPage(direction) {
        const pages = Math.ceil(this.modifierKeys.length / MODIFIERS_PER_PAGE);
        this.modifierPage = (this.modifierPage + direction + pages) % pages;
        this.refreshModifiers();
    }

    getModifierSelection() {
        return Object.entries(this.lobbySettings.modifiers)
            .filter(([, entry]) => entry.enabled)
            .map(([key, entry]) => {
                const modifier = modifierOptions[key];
                const item = { key };
                if (modifier.clicker) item.value = entry.value;
                if (modifier.collisionToggle) item.collisions = entry.collisions;
                return item;
            });
    }

    refreshCreate() {
        const settings = this.lobbySettings;
        this.lobbyNameButton.text.setText(`LOBBY NAME: ${this.getLobbyName()}`);
        this.modeLabel.setText(settings.mode.toUpperCase());
        const active = this.getModifierSelection();
        this.modifierSummary.setText(active.length === 0
            ? 'ACTIVE: NONE'
            : `ACTIVE: ${active.length} ON`);
        this.stageLabel.setText(mapLabel(MAP_CHOICES[settings.mapIndex]));
        this.saveAll();
    }

    refreshStage(animate) {
        const count = MAP_CHOICES.length;
        this.stageCards.forEach(({ card, preview, name, previewScale }, index) => {
            let offset = (index - this.lobbySettings.mapIndex + count) % count;
            if (offset > count / 2) offset -= count;
            const shown = Math.abs(offset) <= 1;
            const selected = offset === 0;
            const y = 318 + offset * 92;
            const scale = selected ? 1 : 0.5;
            const alpha = selected ? 1 : shown ? 0.5 : 0;
            card.setStrokeStyle(3, selected ? 0xffffff : 0x686868);
            card.input.enabled = shown && this.screen === 'stage';
            const visible = this.screen === 'stage' && shown;
            const targets = [
                { object: card, y, scaleX: scale, scaleY: scale },
                { object: preview, y, scaleX: previewScale.x * scale, scaleY: previewScale.y * scale },
                { object: name, y: y + STAGE_CARD.nameOffset * scale, scaleX: scale, scaleY: scale }
            ];
            for (const { object, ...target } of targets) {
                object.setVisible(visible);
                this.tweens.killTweensOf(object);
                if (animate) {
                    this.tweens.add({ targets: object, ...target, alpha, duration: 220, ease: 'Cubic.Out' });
                } else {
                    object.setY(target.y).setScale(target.scaleX, target.scaleY).setAlpha(alpha);
                }
            }
        });
    }

    refreshModifiers() {
        const pages = Math.ceil(this.modifierKeys.length / MODIFIERS_PER_PAGE);
        this.modifierPage = Math.min(this.modifierPage, pages - 1);
        const active = this.getModifierSelection().length;
        this.modifierTitle.setText(`MODIFIERS (${active} ON)   ${this.modifierPage + 1}/${pages}`).setFontSize(20);
        const shown = this.modifierKeys.slice(this.modifierPage * MODIFIERS_PER_PAGE, (this.modifierPage + 1) * MODIFIERS_PER_PAGE);
        const visible = this.screen === 'modifiers';
        this.modifierRows.forEach((row, index) => {
            const key = shown[index] ?? null;
            row.key = key;
            const modifier = key ? modifierOptions[key] : null;
            const entry = key ? this.lobbySettings.modifiers[key] : null;
            const hasValue = Boolean(modifier?.clicker || modifier?.collisionToggle);
            [row.box, row.name].forEach(object => object.setVisible(visible && Boolean(key)));
            [row.valueBox, row.value].forEach(object => object.setVisible(visible && hasValue));
            if (!key) return;
            const tier = CHAOS_TIERS[modifier.tier];
            row.box.setFillStyle(entry.enabled ? tier.hex : HEX.panel, entry.enabled ? 0.25 : 1)
                .setStrokeStyle(entry.enabled ? 3 : 2, tier.hex, entry.enabled ? 1 : 0.45);
            row.name.setText(modifier.name).setColor(tier.css).setAlpha(entry.enabled ? 1 : 0.6);
            if (modifier.collisionToggle) {
                row.value.setText(entry.collisions ? 'COLLIDE ON' : 'COLLIDE OFF').setFontSize(13);
            } else if (modifier.clicker) {
                row.value.setText(formatModifierValue({ ...modifier, value: entry.value })).setFontSize(15);
            }
        });
        this.saveAll();
    }

    changeRoomPage(direction) {
        const pages = Math.max(1, Math.ceil(this.rooms.length / ROOMS_PER_PAGE));
        this.roomPage = (this.roomPage + direction + pages) % pages;
        this.refreshRooms();
    }

    refreshRooms() {
        if (!this.roomRows) return;
        const visible = this.screen === 'browse';
        const pages = Math.max(1, Math.ceil(this.rooms.length / ROOMS_PER_PAGE));
        this.roomPage = Math.min(this.roomPage, pages - 1);
        const pageText = pages > 1 ? `   ${this.roomPage + 1}/${pages}` : '';
        this.roomsHeader.setText(`OPEN LOBBIES (${this.rooms.length})${pageText}`);
        this.pageArrows.forEach(arrow => arrow.setVisible(visible && pages > 1));
        this.emptyRoomsText.setVisible(visible && this.rooms.length === 0);

        const shown = this.rooms.slice(this.roomPage * ROOMS_PER_PAGE, (this.roomPage + 1) * ROOMS_PER_PAGE);
        this.roomRows.forEach((row, index) => {
            const room = shown[index] ?? null;
            row.room = room;
            [row.box, row.name, row.details, row.count, row.join.box, row.join.text]
                .forEach(part => part.setVisible(visible && Boolean(room)));
            if (!room) return;
            const mods = room.modifiers ? `   ${room.modifiers} MODIFIER${room.modifiers === 1 ? '' : 'S'}` : '';
            row.name.setText(`${index + 1}. ${room.name}`);
            row.details.setText(`${room.mode.toUpperCase()}   ${mapLabel(room.map)}   HOST ${room.host}${mods}`.toUpperCase());
            row.count.setText(`${room.players}/${room.max}`);
        });
    }

    refreshLobby() {
        const lobby = this.lobby;
        if (!lobby || !this.memberRows) return;
        const visible = this.screen === 'lobby';
        this.lobbyTitle.setText(lobby.name).setFontSize(lobby.name.length > 16 ? 18 : 24);
        const mods = lobby.modifiers.length ? `   ${lobby.modifiers.length} MODIFIER${lobby.modifiers.length === 1 ? '' : 'S'}` : '   NO MODIFIERS';
        this.lobbyInfo.setText(`${lobby.mode.toUpperCase()}   ${mapLabel(lobby.map)}${mods}`.toUpperCase());
        const mode = MATCH_MODES[lobby.mode];
        this.memberRows.forEach((row, index) => {
            const member = lobby.members[index];
            const used = index < mode.players;
            [row.box, row.swatch, row.name, row.fighter, row.tag].forEach(part => part.setVisible(visible && used));
            if (!used) return;
            const color = PLAYER_COLORS[mode.colors[index]];
            row.swatch.setFillStyle(color.hex, member ? 1 : 0.3);
            row.box.setStrokeStyle(2, member?.you ? 0xffd34d : 0x555555);
            if (!member) {
                row.name.setText('OPEN SLOT').setColor('#777777');
                row.fighter.setText(mode.teams ? `TEAM ${color.label}` : color.label);
                row.tag.setText('');
                return;
            }
            const character = CHARACTER_ROSTER.find(entry => entry.key === member.character);
            row.name.setText(member.name).setColor(color.css);
            row.fighter.setText(`${character?.name ?? member.character} - ${member.variant}${mode.teams ? `   TEAM ${color.label}` : ''}`.toUpperCase());
            row.tag.setText([index === 0 ? 'HOST' : '', member.you ? 'YOU' : ''].filter(Boolean).join(' / '));
        });
        const full = lobby.members.length >= mode.players;
        this.startButton.box.setVisible(visible && lobby.host);
        this.startButton.text.setVisible(visible && lobby.host).setAlpha(full ? 1 : 0.4);
        this.startButton.box.setAlpha(full ? 1 : 0.5);
        this.lobbyWaitText.setVisible(visible && !lobby.host);
        this.queueText.setText(full ? (lobby.host ? 'EVERYONE IS HERE. PRESS START!' : 'EVERYONE IS HERE') : `WAITING FOR PLAYERS (${lobby.members.length}/${mode.players})`);
    }

    getChoice() {
        const character = CHARACTER_ROSTER[this.selection.characterIndex];
        const variant = character.variants[this.selection.variantIndex];
        return { character, variant, map: MAP_CHOICES[this.selection.mapIndex] };
    }

    saveAll() {
        const { character, variant, map } = this.getChoice();
        const settings = this.lobbySettings;
        saveSettings({
            character: character.key,
            variant: variant.name,
            map,
            name: this.selection.name,
            lobby: {
                name: settings.name,
                mode: settings.mode,
                map: MAP_CHOICES[settings.mapIndex],
                modifiers: settings.modifiers
            }
        });
    }

    refreshSelection() {
        const { character, variant, map } = this.getChoice();
        this.fighterIcon.setTexture(getCharacterTexture(character.key, variant.name)).setDisplaySize(120, 120);
        this.fighterName.setText(character.name);
        this.variantText.setText(variant.name).setColor(variant.color ?? '#ffffff');
        this.fighterDesc.setFontSize(15).setText([variant.desc, variant.abilities].filter(Boolean).join(' \n\n'));
        for (let size = 14; size >= 10 && this.fighterDesc.height > 280; size--) {
            this.fighterDesc.setFontSize(size);
        }
        const hasVariants = character.variants.length > 1;
        this.variantButton.box.setVisible(hasVariants);
        this.variantButton.text.setVisible(hasVariants);
        this.nameButton.text.setText(`NAME: ${this.selection.name}   (CHANGE)`);
        this.quickMapText.setText(mapLabel(map));
        if (this.screen === 'create') this.refreshCreate();
        this.saveAll();
    }

    refreshQueue(time = this.time.now) {
        if (this.screen !== 'quick') return;
        if (this.queueState === 'queued') {
            const seconds = Math.floor((time - this.queueStartedAt) / 1000);
            const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
            const dots = '.'.repeat(1 + Math.floor(time / 400) % 3);
            this.quickStatus.setText(`LOOKING FOR AN OPPONENT${dots}\n${clock}`);
        } else if (this.queueState === 'found') {
            this.quickStatus.setText('MATCH FOUND!');
        } else {
            this.quickStatus.setText('');
        }
    }

    sendChoice(type, extra = {}) {
        const { character, variant } = this.getChoice();
        net.send({ t: type, name: this.selection.name, character: character.key, variant: variant.name, ...extra });
    }

    startQuick() {
        if (!this.selection || !net.connected || this.queueState !== 'idle') return;
        const { map } = this.getChoice();
        this.sendChoice('queue', { map });
        this.queueState = 'queued';
        this.queueStartedAt = this.time.now;
        this.showScreen('quick');
    }

    cancelQuick() {
        if (this.queueState === 'queued') net.send({ t: 'leave' });
        if (this.queueState !== 'found') this.queueState = 'idle';
        this.showScreen('home');
    }

    toggleQuick() {
        if (this.queueState === 'queued') this.cancelQuick();
        else this.startQuick();
    }

    createLobby() {
        if (!this.selection || !net.connected || this.queueState !== 'idle') return;
        const settings = this.lobbySettings;
        this.sendChoice('createLobby', {
            lobbyName: this.getLobbyName(),
            mode: settings.mode,
            map: MAP_CHOICES[settings.mapIndex],
            modifiers: this.getModifierSelection()
        });
        this.queueState = 'creating';
        this.queueText.setText('CREATING LOBBY...');
    }

    joinRoom(room) {
        if (!room || !this.selection || !net.connected || this.queueState !== 'idle') return;
        this.sendChoice('joinLobby', { room: room.id });
        this.queueState = 'joining';
        this.queueText.setText('JOINING...');
    }

    startLobby() {
        if (!this.lobby?.host) return;
        if (this.lobby.members.length < MATCH_MODES[this.lobby.mode].players) {
            this.queueText.setText('THE LOBBY NEEDS TO BE FULL TO START');
            return;
        }
        net.send({ t: 'startLobby' });
    }

    leaveLobby() {
        if (this.queueState !== 'lobby') return;
        net.send({ t: 'leave' });
        this.queueState = 'idle';
        this.lobby = null;
        this.showScreen('browse');
    }

    startMatch(match) {
        this.queueState = 'found';
        if (this.screen === 'quick') this.refreshQueue();
        const others = match.roster.filter(entry => entry.slot !== match.slot);
        this.queueText.setText(others.length === 1
            ? `VS ${others[0].name}  (${others[0].character.toUpperCase()})`
            : `${match.mode.toUpperCase()} STARTING!`);
        this.sound.play('hover2');
        this.time.delayedCall(600, () => {
            const { character, variant } = this.getChoice();
            const self = { character: character.key, variant: variant.name };
            this.scene.start('OnlineGameScene', { match: { ...match, self } });
        });
    }

    goBack() {
        if (this.queueState === 'found' || this.closeNameBox) return;
        const parents = { stage: 'create', modifiers: 'create', create: 'home', browse: 'home' };
        if (this.screen === 'quick') {
            this.cancelQuick();
            return;
        }
        if (this.screen === 'lobby') {
            this.leaveLobby();
            return;
        }
        if (parents[this.screen]) {
            this.showScreen(parents[this.screen]);
            return;
        }
        this.goToMenu();
    }

    goToMenu() {
        if (this.queueState === 'found' || this.closeNameBox || this.leavingToMenu) return;
        this.leavingToMenu = true;
        fadeOutTo(this, () => {
            net.disconnect();
            this.scene.start('MenuScene');
        });
    }
}
