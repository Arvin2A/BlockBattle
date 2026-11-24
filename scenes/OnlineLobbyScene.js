// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { addSettingsButton } from '../ui/settings.js';
import { preload as preloadMatch, preloadMenu, preloadCharacterSelection, preloadMapSelection } from './GameScene/preload.js';
import { fadeOutTo } from './transitions.js';
import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { getConnectedControllers, getMenuGamepadInput } from '../navigation.js';
import { net } from '../mp/client.js';
import { cleanName, MAP_CHOICES, MAX_LOBBY_NAME_LENGTH, MAX_NAME_LENGTH } from '../mp/protocol.js';
import { MAPS } from './GameScene/MapDefinitions.js';
import { MATCH_MODES, MODE_TOGGLE_ORDER, PLAYER_COLORS } from '../matchModes.js';
import { formatModifierValue, modifierOptions } from '../modifiers.js';
import { MODIFIER_ACHIEVEMENT_WARNING, warnModifiersOnce } from '../ui/modifierWarning.js';
import { createNameFilter } from '../mp/nameFilter.js';
import inappropriateWords from '../assets/inappropriate_words?raw';
import { getOnlineServerHost, getServerName, isOnlineConfigured, makeInviteLink } from '../mp/serverConfig.js';
import { CHAOS_TIERS, COLORS, HEX, makeButton, makePanel } from '../ui/theme.js';
import { openAdvancedInfo } from '../ui/advancedInfo.js';
import { openFighterPicker } from '../ui/fighterPicker.js';
import { isVariantUnlocked } from '../achievements.js';
import { clipScrollablePanel } from '../ui/clipScroll.js';

const SETTINGS_KEY = 'blockBattleOnline';
const ROOMS_PER_PAGE = 4;
const MODIFIERS_PER_PAGE = 6;
const PLAYERS_PER_PAGE = 5;
const INVITE_RESEND_MS = 3000;
const INVITE_POPUP_MS = 30000;
const FIGHTER = { x: 145, y: 330, width: 250, height: 330 };
const FIGHTER_ICON = 110;
const PANEL = { x: 635, y: 330, width: 690, height: 330 };
const PANEL_LEFT = PANEL.x - PANEL.width / 2;
const PANEL_RIGHT = PANEL.x + PANEL.width / 2;
const ROW_WIDTH = PANEL.width - 50;
const ROW_LEFT = PANEL.x - ROW_WIDTH / 2;
const ROW_RIGHT = PANEL.x + ROW_WIDTH / 2;
const STAGE_CARD = { width: 204, height: 108, nameOffset: 38 };
const LOBBY_INFO = { y: 214, gap: 14, buttonWidth: 130, buttonHeight: 20 };
const MEMBER_STATUS = {
    active: { label: 'ACTIVE', color: COLORS.ready },
    afk: { label: 'AFK', color: COLORS.accent },
    reconnecting: { label: 'RECONNECTING', color: COLORS.error }
};
const MEMBER_STATUS_GAP = 10;
const COPY_LINK = { x: PANEL.x, y: 146, width: PANEL.width, height: 30, copiedMs: 1500 };
const MODIFIER_LIST = { width: 520, height: 440, listHeight: 330, cardWidth: 440 };
const SUB_SCREENS = ['create', 'stage', 'modifiers', 'browse', 'invite'];
const SHAKE_OFFSETS = [0, -12, 10, -8, 6, -3, 0];
const SHAKE_MS = 350;
const START_ERROR_MS = 1500;
const LOBBY_BUTTON = { y: 446, width: 150, height: 40 };
const HOST_BUTTON_X = { ready: -175, start: 0, leave: 175 };
const GUEST_BUTTON_X = { ready: -95, leave: 95 };
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
        preloadMapSelection.call(this);
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
        this.autoJoin = data?.autoJoin ?? null;
        this.notice = data?.notice ?? null;
        this.joiningFromInvite = false;
        this.leavingToMenu = false;
    }

    create() {
        this.cameras.main.fadeIn(200, 0, 0, 0);
        addSettingsButton(this);
        this.add.image(500, 300, 'menuBackground').setDisplaySize(1000, 600);
        this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.7);

        this.add.text(500, 42, 'ONLINE', {
            fontFamily: 'VCROSD',
            fontSize: '48px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(500, 82, `SERVER: ${getServerName()}`, {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffd34d'
        }).setOrigin(0.5);

        this.statusText = this.add.text(500, 108, '', {
            fontFamily: 'GameFont',
            fontSize: '13px',
            fill: '#bbbbbb',
            align: 'center'
        }).setOrigin(0.5);

        makeButton(this, 500, 568, 150, 40, 'BACK', () => this.goToMenu(), 20);
        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.modalOpen) this.goBack();
        });

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
            variantIndex: Math.max(0, CHARACTER_ROSTER[characterIndex].variants.findIndex(v =>
                v.name === saved.variant && isVariantUnlocked(CHARACTER_ROSTER[characterIndex].key, v.name))),
            mapIndex: Math.max(0, MAP_CHOICES.indexOf(saved.map)),
            name: cleanName(saved.name ?? randomPlayerName())
        };
        if (isNameBlocked(this.selection.name)) this.selection.name = randomPlayerName();
        const savedLobby = saved.lobby ?? {};
        this.lobbySettings = {
            name: savedLobby.name ? cleanName(savedLobby.name, MAX_LOBBY_NAME_LENGTH) : null,
            mode: MODE_TOGGLE_ORDER.includes(savedLobby.mode) ? savedLobby.mode : '1v1',
            mapIndex: Math.max(0, MAP_CHOICES.indexOf(savedLobby.map)),
            modifiers: defaultModifierSettings(savedLobby.modifiers),
            private: Boolean(savedLobby.private)
        };
        this.queueState = 'idle';
        this.queueStartedAt = 0;
        this.rooms = [];
        this.roomPage = 0;
        this.modifierPage = 0;
        this.lobby = null;
        this.waitingPlayers = [];
        this.quickWaiting = 0;
        this.playerPage = 0;
        this.invitesSent = new Map();
        this.invitePopup = null;
        this.previousPad = {};
        this.closeNameBox = null;
        this.cleanups.push(() => this.closeNameBox?.());
        this.cleanups.push(() => this.closeInvitePopup());
        this.cleanups.push(() => this.closeModifierList());
        this.modifierList = null;

        this.buildFighterPanel();
        this.buildMatchPanel();
        this.refreshSelection();
        this.screen = null;
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
        this.nameButton = makeButton(this, FIGHTER.x, 146, FIGHTER.width, 30, '', () => this.editName(), 15);
        this.fighterPanel = this.add.rectangle(FIGHTER.x, FIGHTER.y, FIGHTER.width, FIGHTER.height, HEX.panel, 0.92).setStrokeStyle(3, HEX.border);
        this.add.text(FIGHTER.x, 190, 'YOUR FIGHTER', {
            fontFamily: 'GameFont',
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.fighterIcon = this.add.image(FIGHTER.x, 264, 'axeman').setDisplaySize(FIGHTER_ICON, FIGHTER_ICON);

        this.fighterName = this.add.text(FIGHTER.x, 340, '', {
            fontFamily: 'GameFont',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.variantText = this.add.text(FIGHTER.x, 366, '', {
            fontFamily: 'VCROSD',
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.selectButton = makeButton(this, FIGHTER.x, 440, 214, 74, 'SELECT\nCHARACTER', () => this.openPicker(), 22);
    }

    get modalOpen() {
        return Boolean(this.advancedInfo || this.modifierList || this.modifierWarning || this.fighterPicker);
    }

    openModifierList() {
        const modifiers = this.lobby?.modifiers ?? [];
        if (!modifiers.length || this.modalOpen || this.invitePopup || this.closeNameBox) return;
        const parts = [];
        const add = (object, depth = 0) => {
            parts.push(object.setDepth(2000 + depth));
            return object;
        };
        const top = 300 - MODIFIER_LIST.height / 2;
        add(this.add.rectangle(500, 300, 2000, 1200, 0x000000, 0.78).setInteractive());
        add(makePanel(this, 500, 300, MODIFIER_LIST.width, MODIFIER_LIST.height, 1), 1);
        add(text(this, 500, top + 36, 'LOBBY MODIFIERS', { fontFamily: 'VCROSD', fontSize: '28px', stroke: COLORS.stroke, strokeThickness: 5 }).setOrigin(0.5), 2);
        add(text(this, 500, top + 62, `${modifiers.length} SELECTED BY THE HOST`, { fontSize: '11px', fill: COLORS.muted }).setOrigin(0.5), 2);
        add(text(this, 500, top + 77, MODIFIER_ACHIEVEMENT_WARNING, { fontFamily: 'VCROSD', fontSize: '14px', fill: COLORS.error }).setOrigin(0.5), 2);
        const closeX = 500 + MODIFIER_LIST.width / 2 - 34;
        const closeBox = add(this.add.rectangle(closeX, top + 34, 48, 40, 0x771c1c).setStrokeStyle(2, HEX.border)
            .setInteractive({ useHandCursor: true }), 3);
        add(text(this, closeX, top + 34, 'X', { fontFamily: 'VCROSD', fontSize: '26px' }).setOrigin(0.5), 4);
        closeBox.on('pointerover', () => closeBox.setFillStyle(0xc0392b));
        closeBox.on('pointerout', () => closeBox.setFillStyle(0x771c1c));
        closeBox.on('pointerdown', () => this.closeModifierList(true));

        const content = this.rexUI.add.sizer({ orientation: 'y', space: { item: 10 } });
        for (const entry of modifiers) {
            const modifier = modifierOptions[entry.key];
            if (!modifier) continue;
            const tier = CHAOS_TIERS[modifier.tier];
            const card = this.rexUI.add.sizer({
                orientation: 'y',
                width: MODIFIER_LIST.cardWidth,
                space: { left: 12, right: 12, top: 8, bottom: 8, item: 4 }
            });
            card.addBackground(this.add.rectangle(0, 0, MODIFIER_LIST.cardWidth, 10, tier.hex, 0.15).setStrokeStyle(2, tier.hex));
            let setting = '';
            if (modifier.clicker && entry.value !== undefined) setting = `   ${formatModifierValue({ ...modifier, value: entry.value })}`;
            if (modifier.collisionToggle) setting = `   ${entry.collisions ? 'COLLIDE ON' : 'COLLIDE OFF'}`;
            card.add(text(this, 0, 0, `${modifier.name}${setting}`, { fontFamily: 'VCROSD', fontSize: '20px', fill: tier.css }), { align: 'left' });
            card.add(text(this, 0, 0, modifier.description ?? '', {
                fontFamily: 'VCROSD',
                fontSize: '15px',
                fill: COLORS.text,
                wordWrap: { width: MODIFIER_LIST.cardWidth - 24 }
            }), { align: 'left' });
            content.add(card, { expand: true });
        }
        const listWidth = MODIFIER_LIST.width - 40;
        const panel = this.rexUI.add.scrollablePanel({
            x: 500,
            y: top + 88 + MODIFIER_LIST.listHeight / 2,
            width: listWidth,
            height: MODIFIER_LIST.listHeight,
            scrollMode: 0,
            background: this.add.rectangle(0, 0, listWidth, MODIFIER_LIST.listHeight, 0x202020).setStrokeStyle(2, 0x444444),
            panel: { child: content, mask: false },
            sliderY: {
                track: this.add.rectangle(0, 0, 12, 0, 0x444444),
                thumb: this.add.rectangle(0, 0, 12, 50, 0xaaaaaa)
            },
            scroller: { rectBoundsInteractive: true, threshold: 5, slidingDeceleration: 5000, backDeceleration: 2000 },
            space: { left: 10, right: 10, top: 10, bottom: 10, panel: 10 },
            mouseWheelScroller: { focus: 2, speed: 0.1 }
        }).layout();
        panel.setDepth(2002);
        panel.getElement('background').setDepth(2002);
        content.getAllChildren().forEach(child => child.setDepth?.(2003));
        panel.getElement('slider')?.getAllChildren?.().forEach(child => child.setDepth?.(2004));
        clipScrollablePanel(this, panel, { inset: 4 });
        parts.push(panel);
        const onEsc = () => this.closeModifierList(true);
        this.time.delayedCall(0, () => {
            if (this.modifierList?.parts === parts) this.input.keyboard.on('keydown-ESC', onEsc);
        });
        this.modifierList = { parts, onEsc };
    }

    closeModifierList(withSound = false) {
        const list = this.modifierList;
        if (!list) return;
        this.modifierList = null;
        this.input.keyboard.off('keydown-ESC', list.onEsc);
        list.parts.forEach(part => part.destroy());
        if (withSound) this.sound.play('hover2');
    }

    openInfo() {
        if (!this.selection || this.modalOpen || this.invitePopup || this.closeNameBox) return;
        this.openCharacterInfo();
    }

    openPicker() {
        if (!this.selection || this.locked || this.modalOpen || this.invitePopup || this.closeNameBox) return;
        openFighterPicker(this, {
            getSelection: () => this.selection,
            changeCharacter: direction => this.changeCharacter(direction),
            changeVariant: direction => this.changeVariant(direction),
            openInfo: () => this.openCharacterInfo()
        });
    }

    openCharacterInfo(afterClose) {
        openAdvancedInfo(this, {
            characterIndex: this.selection?.characterIndex ?? 0,
            variantIndex: this.selection?.variantIndex ?? 0,
            onClose: afterClose
        });
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
        this.buildInviteScreen();
        const panelBack = makeButton(this, PANEL_LEFT + 50, 146, 100, 30, '< BACK', () => this.goBack(), 17);
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
        if (this.screen === 'invite' && name !== 'invite') net.send({ t: 'watchPlayers', on: false });
        if (name === 'invite' && this.screen !== 'invite') net.send({ t: 'watchPlayers', on: true });
        this.screen = name;
        const shown = new Set(this.screens[name] ?? []);
        Object.values(this.screens).flat().forEach(object => object.setVisible(shown.has(object)));
        this.queueText.setText('').setColor(COLORS.accent);
        const hints = {
            home: '< > FIGHTER   ^ v VARIANT   N NAME   ENTER QUICK 1V1   ESC BACK',
            quick: '< > FIGHTER   ^ v VARIANT   ENTER CANCEL   ESC BACK',
            create: '< > FIGHTER   ^ v VARIANT   N NAME   ENTER CREATE   ESC BACK',
            stage: '^ v BROWSE STAGES   ENTER DONE   ESC BACK',
            modifiers: 'CLICK A CARD TO TOGGLE IT, CLICK ITS BOX TO CHANGE IT   ESC BACK',
            browse: '< > FIGHTER   ^ v VARIANT   1-4 JOIN   ESC BACK',
            lobby: '< > FIGHTER   ^ v VARIANT   ENTER READY / START   ESC LEAVE',
            invite: 'CLICK INVITE NEXT TO A PLAYER   ESC BACK TO LOBBY'
        };
        this.keyHint.setText(hints[name] ?? '');
        if (name === 'browse') this.refreshRooms();
        if (name === 'create') this.refreshCreate();
        if (name === 'stage') this.refreshStage(false);
        if (name === 'modifiers') this.refreshModifiers();
        if (name === 'lobby') this.refreshLobby();
        if (name === 'quick') this.refreshQueue();
        if (name === 'quick' || name === 'home') this.refreshQuickCount();
        if (name === 'invite') this.refreshInvite();
    }

    buildHomeScreen() {
        this.screenTitle('home', 'PLAY ONLINE');
        this.quickButton = makeButton(this, PANEL.x, 318, 360, 48, 'QUICK 1V1', () => this.startQuick(), 24);
        this.addToScreen('home',
            makeButton(this, PANEL.x, 250, 360, 48, 'CREATE LOBBY', () => this.showScreen('create'), 24),
            this.quickButton,
            makeButton(this, PANEL.x, 418, 360, 48, 'BROWSE LOBBIES', () => this.showScreen('browse'), 24)
        );
        this.addToScreen('home', text(this, PANEL.x - 170, 362, 'QUICK 1V1 STAGE', { fontSize: '11px', fill: '#bbbbbb' }).setOrigin(0, 0.5));
        this.quickMapText = this.addToScreen('home', text(this, PANEL.x + 75, 362, '', { fontFamily: 'VCROSD', fontSize: '16px' }).setOrigin(0.5));
        this.addToScreen('home',
            makeArrow(this, PANEL.x - 10, 362, '<', () => this.changeQuickMap(-1)).setFontSize(20),
            makeArrow(this, PANEL.x + 160, 362, '>', () => this.changeQuickMap(1)).setFontSize(20)
        );
    }

    buildQuickScreen() {
        this.screenTitle('quick', 'QUICK 1V1');
        this.quickCountText = this.addToScreen('quick', text(this, PANEL.x, 228, '', { fontSize: '12px', fill: COLORS.accent }).setOrigin(0.5));
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
        const box = this.add.rectangle(PANEL.x, y, ROW_WIDTH, height, HEX.panel).setStrokeStyle(2, HEX.border);
        if (onClick) {
            box.setInteractive({ useHandCursor: true });
            box.on('pointerdown', () => {
                this.sound.play('hover2');
                onClick();
            });
        }
        const title = text(this, ROW_LEFT + 15, y - (height > 44 ? 10 : 0), label, { fontFamily: 'VCROSD', fontSize: '20px' }).setOrigin(0, 0.5);
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
        return { box, label };
    }

    buildCreateScreen() {
        this.screenTitle('create', 'LOBBY CREATION');
        this.lobbyNameButton = this.addToScreen('create', makeButton(this, PANEL.x, 222, ROW_WIDTH, 30, '', () => this.editLobbyName(), 17));
        this.makeRow('create', 264, 40, 'GAMEMODE');
        this.modeLabel = this.makeValueBox('create', ROW_RIGHT - 80, 264, 130, () => this.cycleMode()).label;
        this.makeRow('create', 314, 50, 'MODIFIERS', () => this.showScreen('modifiers'));
        this.modifierSummary = this.addToScreen('create', text(this, ROW_LEFT + 15, 326, '', { fontSize: '11px', fill: COLORS.muted }).setOrigin(0, 0.5));
        this.addToScreen('create', text(this, ROW_RIGHT - 20, 314, '>', { fontFamily: 'VCROSD', fontSize: '26px' }).setOrigin(0.5));
        this.makeRow('create', 362, 40, 'STAGE', () => this.showScreen('stage'));
        this.stageLabel = this.addToScreen('create', text(this, ROW_RIGHT - 40, 362, '', { fontFamily: 'VCROSD', fontSize: '18px', fill: COLORS.accent }).setOrigin(1, 0.5));
        this.addToScreen('create', text(this, ROW_RIGHT - 20, 362, '>', { fontFamily: 'VCROSD', fontSize: '26px' }).setOrigin(0.5));
        this.makeRow('create', 406, 40, 'PRIVATE', () => this.togglePrivate());
        this.privateToggle = this.makeValueBox('create', ROW_RIGHT - 80, 406, 130, () => this.togglePrivate());
        this.addToScreen('create', makeButton(this, PANEL.x, 454, 300, 38, 'CREATE LOBBY', () => this.createLobby(), 22));
    }

    buildStageScreen() {
        this.screenTitle('stage', 'SELECT STAGE');
        this.stageCards = MAP_CHOICES.map(map => {
            const card = this.add.rectangle(PANEL.x, 330, STAGE_CARD.width + 8, STAGE_CARD.height + 8, HEX.panel).setStrokeStyle(3, 0x686868)
                .setInteractive({ useHandCursor: true })
                .setData('silentHover', true);
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
            if (this.screen === 'stage' && deltaY !== 0 && !this.modalOpen) this.pickStage(this.lobbySettings.mapIndex + Math.sign(deltaY));
        });
    }

    buildModifierScreen() {
        this.modifierTitle = this.screenTitle('modifiers', 'MODIFIERS').setY(182);
        this.addToScreen('modifiers', text(this, PANEL.x, 204, MODIFIER_ACHIEVEMENT_WARNING, { fontFamily: 'VCROSD', fontSize: '15px', fill: COLORS.error }).setOrigin(0.5));
        this.modifierKeys = onlineModifierKeys();
        this.modifierRows = [];
        for (let index = 0; index < MODIFIERS_PER_PAGE; index++) {
            const y = 228 + index * 38;
            const row = { key: null };
            row.box = this.add.rectangle(PANEL.x, y, ROW_WIDTH, 32, HEX.panel).setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true })
                .setData('silentHover', true);
            row.box.on('pointerdown', () => this.toggleModifier(row.key));
            row.name = text(this, ROW_LEFT + 12, y, '', { fontFamily: 'VCROSD', fontSize: '17px' }).setOrigin(0, 0.5);
            row.valueBox = this.add.rectangle(ROW_RIGHT - 65, y, 110, 24, HEX.panel).setStrokeStyle(2, HEX.border)
                .setInteractive({ useHandCursor: true });
            row.valueBox.on('pointerdown', () => this.cycleModifierValue(row.key));
            row.value = text(this, ROW_RIGHT - 65, y, '', { fontFamily: 'VCROSD', fontSize: '15px' }).setOrigin(0.5);
            this.addToScreen('modifiers', row.box, row.name, row.valueBox, row.value);
            this.modifierRows.push(row);
        }
        this.addToScreen('modifiers',
            makeArrow(this, PANEL.x - 150, 462, '<', () => this.changeModifierPage(-1)),
            makeArrow(this, PANEL.x + 150, 462, '>', () => this.changeModifierPage(1)),
            makeButton(this, PANEL.x, 462, 180, 34, 'DONE', () => this.showScreen('create'), 20)
        );
    }

    buildBrowseScreen() {
        this.roomsHeader = this.screenTitle('browse', '');
        this.roomsHeader.setFontSize(20);
        this.pageArrows = [
            makeArrow(this, PANEL.x - 200, 188, '<', () => this.changeRoomPage(-1)),
            makeArrow(this, PANEL.x + 200, 188, '>', () => this.changeRoomPage(1))
        ];
        this.pageArrows.forEach(arrow => arrow.setFontSize(22));
        this.addToScreen('browse', ...this.pageArrows);

        this.roomRows = [];
        for (let i = 0; i < ROOMS_PER_PAGE; i++) {
            const y = 238 + i * 54;
            const row = { room: null };
            row.box = this.add.rectangle(PANEL.x, y, ROW_WIDTH, 48, HEX.panel).setStrokeStyle(2, HEX.border);
            row.name = text(this, ROW_LEFT + 12, y - 11, '', { fontFamily: 'VCROSD', fontSize: '18px' }).setOrigin(0, 0.5);
            row.details = text(this, ROW_LEFT + 12, y + 11, '', { fontSize: '10px', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            row.count = text(this, ROW_RIGHT - 105, y, '', { fontFamily: 'VCROSD', fontSize: '18px' }).setOrigin(0.5);
            row.join = makeButton(this, ROW_RIGHT - 42, y, 70, 30, 'JOIN', () => this.joinRoom(row.room), 16);
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
        this.lobbyInfo = this.addToScreen('lobby', text(this, PANEL.x, LOBBY_INFO.y, '', { fontSize: '11px', fill: '#bbbbbb' }).setOrigin(0, 0.5));
        this.viewModifiersButton = makeButton(this, PANEL.x, LOBBY_INFO.y, LOBBY_INFO.buttonWidth, LOBBY_INFO.buttonHeight,
            'VIEW MODIFIERS', () => this.openModifierList(), 12);
        this.viewModifiersButton.text.setColor(COLORS.accent);
        this.addToScreen('lobby', this.viewModifiersButton);
        this.copyLinkButton = makeButton(this, COPY_LINK.x, COPY_LINK.y, COPY_LINK.width, COPY_LINK.height,
            'COPY INVITE LINK', () => this.copyInviteLink(), 17);
        this.copyLinkButton.text.setColor(COLORS.accent);
        this.addToScreen('lobby', this.copyLinkButton);
        this.memberRows = [];
        for (let i = 0; i < 4; i++) {
            const y = 252 + i * 42;
            const row = {};
            row.box = this.add.rectangle(PANEL.x, y, ROW_WIDTH, 36, HEX.panel).setStrokeStyle(2, HEX.border);
            row.swatch = this.add.rectangle(ROW_LEFT + 18, y, 18, 18, 0xffffff);
            row.name = text(this, ROW_LEFT + 36, y - 7, '', { fontFamily: 'VCROSD', fontSize: '17px' }).setOrigin(0, 0.5);
            row.fighter = text(this, ROW_LEFT + 36, y + 9, '', { fontSize: '10px', fill: '#aaaaaa' }).setOrigin(0, 0.5);
            row.tag = text(this, ROW_RIGHT - 15, y, '', { fontFamily: 'VCROSD', fontSize: '15px', fill: '#ffd34d' }).setOrigin(1, 0.5);
            row.invite = makeButton(this, ROW_RIGHT - 55, y, 90, 26, 'INVITE', () => this.showScreen('invite'), 15);
            row.addCpu = makeButton(this, ROW_RIGHT - 150, y, 90, 26, 'ADD CPU', () => net.send({ t: 'addBot' }), 15);
            row.removeCpu = makeButton(this, ROW_RIGHT - 55, y, 90, 26, 'REMOVE', () => net.send({ t: 'removeBot' }), 15);
            row.status = text(this, ROW_LEFT + 36, y - 7, '', { fontFamily: 'VCROSD', fontSize: '13px' }).setOrigin(0, 0.5);
            row.readyShade = this.add.rectangle(PANEL.x, y, ROW_WIDTH, 36, 0x000000, 0.6);
            row.readyText = text(this, PANEL.x, y, 'READY!', {
                fontFamily: 'VCROSD',
                fontSize: '24px',
                fill: COLORS.ready,
                stroke: COLORS.stroke,
                strokeThickness: 4
            }).setOrigin(0.5);
            this.addToScreen('lobby', row.box, row.swatch, row.name, row.fighter, row.tag, row.invite, row.addCpu, row.removeCpu, row.readyShade, row.readyText, row.status);
            this.memberRows.push(row);
        }
        this.startButton = this.addToScreen('lobby', makeButton(this, PANEL.x, LOBBY_BUTTON.y, LOBBY_BUTTON.width, LOBBY_BUTTON.height, 'START', () => this.startLobby(), 22));
        this.leaveButton = makeButton(this, PANEL.x, LOBBY_BUTTON.y, LOBBY_BUTTON.width, LOBBY_BUTTON.height, 'LEAVE', () => this.leaveLobby(), 22);
        this.addToScreen('lobby', this.leaveButton);
        this.readyButton = this.addToScreen('lobby', makeButton(this, PANEL.x, LOBBY_BUTTON.y, LOBBY_BUTTON.width, LOBBY_BUTTON.height, 'READY', () => this.toggleReady(), 22));
    }

    buildInviteScreen() {
        this.inviteTitle = this.screenTitle('invite', 'INVITE PLAYERS');
        this.playerRows = [];
        for (let i = 0; i < PLAYERS_PER_PAGE; i++) {
            const y = 230 + i * 42;
            const row = { player: null };
            row.box = this.add.rectangle(PANEL.x, y, ROW_WIDTH, 36, HEX.panel).setStrokeStyle(2, HEX.border);
            row.name = text(this, ROW_LEFT + 15, y - 7, '', { fontFamily: 'VCROSD', fontSize: '17px' }).setOrigin(0, 0.5);
            row.tag = text(this, ROW_LEFT + 15, y + 9, '', { fontSize: '10px', fill: COLORS.muted }).setOrigin(0, 0.5);
            row.button = makeButton(this, ROW_RIGHT - 60, y, 100, 26, 'INVITE', () => this.sendInvite(row.player), 15);
            this.addToScreen('invite', row.box, row.name, row.tag, row.button);
            this.playerRows.push(row);
        }
        this.playerArrows = [
            makeArrow(this, PANEL.x - 150, 452, '<', () => this.changePlayerPage(-1)),
            makeArrow(this, PANEL.x + 150, 452, '>', () => this.changePlayerPage(1))
        ];
        this.addToScreen('invite', ...this.playerArrows,
            makeButton(this, PANEL.x, 452, 220, 36, 'BACK TO LOBBY', () => this.showScreen('lobby'), 18));
        this.emptyPlayersText = this.addToScreen('invite', text(this, PANEL.x, 310, "No one else is waiting right now.\nPlayers show up here while they're\nin the online menu.", {
            fontSize: '13px',
            fill: '#999999',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5));
    }

    changePlayerPage(direction) {
        const pages = Math.max(1, Math.ceil(this.waitingPlayers.length / PLAYERS_PER_PAGE));
        this.playerPage = (this.playerPage + direction + pages) % pages;
        this.refreshInvite();
    }

    inviteState(player) {
        if (player.inLobby) return 'IN LOBBY';
        if (player.busy) return 'BUSY';
        if (this.time.now - (this.invitesSent.get(player.tag) ?? -Infinity) < INVITE_RESEND_MS) return 'SENT';
        if (this.invitesSent.has(player.tag)) return 'AGAIN';
        return 'INVITE';
    }

    refreshInvite() {
        if (!this.playerRows) return;
        const visible = this.screen === 'invite';
        const players = this.waitingPlayers;
        const pages = Math.max(1, Math.ceil(players.length / PLAYERS_PER_PAGE));
        this.playerPage = Math.min(this.playerPage, pages - 1);
        const pageText = pages > 1 ? `   ${this.playerPage + 1}/${pages}` : '';
        this.inviteTitle.setText(`WAITING PLAYERS (${players.length})${pageText}`).setFontSize(20);
        this.playerArrows.forEach(arrow => arrow.setVisible(visible && pages > 1));
        this.emptyPlayersText.setVisible(visible && players.length === 0);
        const shown = players.slice(this.playerPage * PLAYERS_PER_PAGE, (this.playerPage + 1) * PLAYERS_PER_PAGE);
        this.playerRows.forEach((row, index) => {
            const player = shown[index] ?? null;
            row.player = player;
            [row.box, row.name, row.tag, row.button.box, row.button.text].forEach(part => part.setVisible(visible && Boolean(player)));
            if (!player) return;
            const state = this.inviteState(player);
            const usable = state === 'INVITE' || state === 'AGAIN';
            row.name.setText(player.name);
            row.tag.setText(player.away ? `#${player.tag}   AFK` : `#${player.tag}`);
            row.button.text.setText(state).setColor(state === 'SENT' ? COLORS.accent : COLORS.text);
            row.button.box.setAlpha(usable ? 1 : 0.5);
            row.button.text.setAlpha(usable ? 1 : 0.6);
        });
        if (visible && this.lobby) {
            const open = MATCH_MODES[this.lobby.mode].players - this.lobby.members.length;
            this.queueText.setText(`${open} OPEN SLOT${open === 1 ? '' : 'S'} LEFT`);
        }
    }

    sendInvite(player) {
        if (!player || !this.lobby?.host) return;
        const state = this.inviteState(player);
        if (state !== 'INVITE' && state !== 'AGAIN') return;
        net.send({ t: 'invite', tag: player.tag });
        this.invitesSent.set(player.tag, this.time.now);
        this.refreshInvite();
        this.time.delayedCall(INVITE_RESEND_MS + 50, () => this.refreshInvite());
    }

    showInvitePopup(invite) {
        if (this.queueState !== 'idle' && this.queueState !== 'queued') return;
        this.closeInvitePopup();
        const parts = [];
        const add = object => {
            parts.push(object.setDepth(100));
            return object;
        };
        add(this.add.rectangle(500, 300, 1000, 600, 0x000000, 0.55).setInteractive());
        add(makePanel(this, 500, 300, 480, 230));
        add(text(this, 500, 215, 'LOBBY INVITE', { fontFamily: 'VCROSD', fontSize: '28px' }).setOrigin(0.5));
        add(text(this, 500, 262, `${invite.host} #${invite.hostTag} invited you to`, { fontSize: '13px', fill: COLORS.muted }).setOrigin(0.5));
        add(text(this, 500, 290, String(invite.name), { fontFamily: 'VCROSD', fontSize: '22px', fill: COLORS.accent }).setOrigin(0.5));
        const mods = invite.modifiers ? `   ${invite.modifiers} MODIFIER${invite.modifiers === 1 ? '' : 'S'}` : '';
        add(text(this, 500, 318, `${String(invite.mode).toUpperCase()}   ${mapLabel(invite.map)}${mods}`.toUpperCase(), { fontSize: '11px', fill: COLORS.muted }).setOrigin(0.5));
        const accept = makeButton(this, 410, 370, 160, 40, 'ACCEPT', () => this.acceptInvite(), 20);
        const decline = makeButton(this, 590, 370, 160, 40, 'DECLINE', () => this.closeInvitePopup(), 20);
        [accept.box, accept.text, decline.box, decline.text].forEach(add);
        const timer = this.time.delayedCall(INVITE_POPUP_MS, () => this.closeInvitePopup());
        this.invitePopup = { invite, parts, timer };
        this.sound.play('hover2');
    }

    closeInvitePopup() {
        const popup = this.invitePopup;
        if (!popup) return;
        this.invitePopup = null;
        popup.timer.remove(false);
        popup.parts.forEach(part => part.destroy());
    }

    acceptInvite() {
        const invite = this.invitePopup?.invite;
        this.closeInvitePopup();
        if (!invite || !this.selection || !net.connected) return;
        if (this.queueState !== 'idle' && this.queueState !== 'queued') return;
        this.sendChoice('joinLobby', { room: invite.room });
        this.queueState = 'joining';
        if (this.screen === 'quick') this.showScreen('home');
        this.queueText.setText('JOINING...');
    }

    bindLobbyKeys() {
        const keyboard = this.input.keyboard;
        const bind = (keys, action) => keys.forEach(key => keyboard.on(`keydown-${key}`, () => {
            if (!this.modalOpen) action();
        }));
        bind(['LEFT', 'A'], () => this.changeCharacter(-1));
        bind(['RIGHT', 'D'], () => this.changeCharacter(1));
        bind(['UP', 'W'], () => this.screen === 'stage' ? this.pickStage(this.lobbySettings.mapIndex - 1) : this.changeVariant(-1));
        bind(['DOWN', 'S'], () => this.screen === 'stage' ? this.pickStage(this.lobbySettings.mapIndex + 1) : this.changeVariant(1));
        bind(['N'], () => this.editName());
        bind(['I'], () => this.openInfo());
        bind(['C'], () => this.openPicker());
        bind(['ENTER', 'SPACE'], () => this.confirm());
        ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, index) => {
            bind([key], () => {
                if (this.screen === 'browse') this.joinRoom(this.roomRows[index].room);
            });
        });
    }

    confirm() {
        if (this.invitePopup) {
            this.acceptInvite();
            return;
        }
        if (this.screen === 'home' || this.screen === 'quick') this.toggleQuick();
        else if (this.screen === 'create') this.createLobby();
        else if (this.screen === 'stage' || this.screen === 'modifiers') this.showScreen('create');
        else if (this.screen === 'lobby') {
            if (this.lobby?.host && this.isReady) this.startLobby();
            else this.toggleReady();
        }
    }

    connectToServer() {
        this.setStatus('Connecting to the server...');
        const listen = (type, handler) => this.cleanups.push(net.on(type, handler));

        listen('status', message => {
            if (this.queueState !== 'found') {
                this.setStatus(`Connected to ${getOnlineServerHost()}   |   ${message.online} online   |   ${message.waiting ?? message.online} waiting   |   ${message.quick ?? 0} in quick 1v1   |   ${message.lobbies ?? message.queued} open   |   ${message.matches} playing`);
            }
            this.quickWaiting = message.quick ?? 0;
            this.refreshQuickCount();
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
            this.joiningFromInvite = false;
            this.queueState = 'lobby';
            this.closeInvitePopup();
            this.lobby = message.lobby;
            this.refreshLockTint();
            const full = this.lobby.members.length >= MATCH_MODES[this.lobby.mode].players;
            const canInvite = this.lobby.private && this.lobby.host && !full;
            if (this.screen === 'invite' && canInvite) this.refreshInvite();
            else if (this.screen !== 'lobby') this.showScreen('lobby');
            else this.refreshLobby();
        });
        listen('players', message => {
            this.waitingPlayers = Array.isArray(message.players) ? message.players : [];
            this.refreshInvite();
        });
        listen('inviteFailed', message => {
            this.invitesSent.delete(message.tag);
            this.setStatus(message.msg, COLORS.error);
            this.refreshInvite();
        });
        listen('inviteSent', message => this.setStatus(`Invite sent to ${message.name} #${message.tag}.`, COLORS.accent));
        listen('invited', message => this.showInvitePopup(message));
        listen('joinFailed', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'joining') this.queueState = 'idle';
            if (this.screen === 'home' || this.screen === 'browse') this.queueText.setText('');
            if (this.joiningFromInvite) {
                this.joiningFromInvite = false;
                this.showScreen('browse');
                this.queueText.setText(String(message.msg ?? '').toUpperCase()).setColor(COLORS.error);
            }
        });
        listen('matchFound', message => this.startMatch(message));
        listen('error', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.screen === 'lobby' && this.lobby?.host) this.rejectStart(String(message.msg ?? '').toUpperCase());
            if (this.queueState === 'queued' || this.queueState === 'joining' || this.queueState === 'creating') {
                this.queueState = 'idle';
                if (this.screen === 'quick') this.showScreen('home');
            }
        });
        listen('reconnecting', () => {
            this.setStatus('Connection lost. Reconnecting...', COLORS.accent);
        });
        listen('resumed', () => {
            this.setStatus(`Reconnected to ${getOnlineServerHost()}`, COLORS.accent);
            this.refreshSelection();
        });
        listen('disconnected', message => {
            const hadSpot = this.queueState !== 'idle' || Boolean(this.lobby);
            this.closeModifierList();
            this.queueState = 'idle';
            this.lobby = null;
            this.rooms = [];
            this.waitingPlayers = [];
            this.closeInvitePopup();
            if (message?.reconnected && !hadSpot) {
                this.setStatus(`Reconnected to ${getOnlineServerHost()}`, COLORS.accent);
                this.refreshSelection();
                if (this.screen === 'quick' || this.screen === 'lobby' || this.screen === 'invite') this.showScreen('home');
                return;
            }
            this.showScreen('home');
            if (message?.reconnected) {
                this.setStatus('You were away too long and lost your spot.', COLORS.error);
                this.refreshSelection();
            } else {
                this.setStatus('Lost connection to the server. Is it still running?', COLORS.error);
            }
        });

        net.connect()
            .then(() => {
                if (!this.statusText?.active) return;
                this.setStatus(`Connected to ${getOnlineServerHost()}`);
                this.refreshSelection();
                if (this.autoQueue) this.startQuick();
                else if (this.autoJoin) this.joinByCode(this.autoJoin);
                else if (this.notice) this.showNotice();
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
        if (this.fighterPicker) {
            this.fighterPicker.handlePad(key => input[key] && !this.previousPad[key]);
            this.previousPad = input;
            return;
        }
        if (this.modalOpen) {
            this.previousPad = input;
            return;
        }
        const pressed = key => input[key] && !this.previousPad[key];
        if (pressed('left')) this.changeCharacter(-1);
        if (pressed('right')) this.changeCharacter(1);
        if (pressed('up')) this.changeVariant(-1);
        if (pressed('down')) this.changeVariant(1);
        if (pressed('a')) this.confirm();
        this.previousPad = input;
    }

    get locked() {
        if (this.queueState === 'lobby') return this.isReady;
        return this.queueState !== 'idle';
    }

    get isReady() {
        return Boolean(this.lobby?.members.find(member => member.you)?.ready);
    }

    get everyoneReady() {
        return Boolean(this.lobby?.members.every(member => member.ready));
    }

    get queueState() {
        return this.currentQueueState;
    }

    set queueState(value) {
        this.currentQueueState = value;
        this.refreshLockTint();
    }

    refreshLockTint() {
        if (!this.fighterPanel?.active) return;
        const locked = this.locked;
        this.fighterPanel.setFillStyle(locked ? HEX.lockedPanel : HEX.panel, 0.92)
            .setStrokeStyle(3, locked ? HEX.error : HEX.border);
        this.nameButton.box.setStrokeStyle(3, locked ? HEX.error : HEX.border);
        this.nameButton.text.setColor(locked ? COLORS.error : COLORS.text);
        this.fighterIcon.setTint(locked ? HEX.lockedTint : 0xffffff);
        [this.selectButton.box, this.selectButton.text].forEach(part => part.setAlpha(locked ? 0.4 : 1));
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
        const character = CHARACTER_ROSTER[this.selection.characterIndex];
        const count = character.variants.length;
        let next = this.selection.variantIndex;
        do {
            next = (next + direction + count) % count;
        } while (next !== this.selection.variantIndex && !isVariantUnlocked(character.key, character.variants[next].name));
        if (next === this.selection.variantIndex) {
            this.sound.play('deny');
            return;
        }
        this.selection.variantIndex = next;
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

    togglePrivate() {
        this.lobbySettings.private = !this.lobbySettings.private;
        this.refreshCreate();
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
        if (entry.enabled) warnModifiersOnce(this);
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
        this.privateToggle.label.setText(settings.private ? 'ON' : 'OFF').setColor(settings.private ? COLORS.accent : COLORS.text);
        this.privateToggle.box.setStrokeStyle(2, settings.private ? HEX.accent : HEX.border);
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
            const hostTag = room.hostTag ? ` #${room.hostTag}` : '';
            row.details.setText(`${room.mode.toUpperCase()}   ${mapLabel(room.map)}   HOST ${room.host}${hostTag}${mods}`.toUpperCase());
            row.count.setText(`${room.players}/${room.max}`);
        });
    }

    refreshLobby() {
        const lobby = this.lobby;
        if (!lobby || !this.memberRows) return;
        const visible = this.screen === 'lobby';
        this.lobbyTitle.setText(lobby.name).setFontSize(lobby.name.length > 16 ? 18 : 24);
        const mods = lobby.modifiers.length ? `   ${lobby.modifiers.length} MODIFIER${lobby.modifiers.length === 1 ? '' : 'S'}` : '   NO MODIFIERS';
        this.lobbyInfo.setText(`${lobby.private ? 'PRIVATE   ' : ''}${lobby.mode.toUpperCase()}   ${mapLabel(lobby.map)}${mods}`.toUpperCase());
        const hasModifiers = lobby.modifiers.length > 0;
        const buttonSpace = hasModifiers ? LOBBY_INFO.gap + LOBBY_INFO.buttonWidth : 0;
        const infoLeft = PANEL.x - (this.lobbyInfo.width + buttonSpace) / 2;
        this.lobbyInfo.setX(infoLeft);
        const buttonX = infoLeft + this.lobbyInfo.width + LOBBY_INFO.gap + LOBBY_INFO.buttonWidth / 2;
        this.viewModifiersButton.box.setX(buttonX).setVisible(visible && hasModifiers);
        this.viewModifiersButton.text.setX(buttonX).setVisible(visible && hasModifiers);
        if (visible && hasModifiers && !this.modalOpen) warnModifiersOnce(this);
        const mode = MATCH_MODES[lobby.mode];
        const canCopyLink = Boolean(lobby.inviteCode) && lobby.members.length < mode.players && (lobby.host || !lobby.private);
        [this.copyLinkButton.box, this.copyLinkButton.text].forEach(part => part.setVisible(visible && canCopyLink));
        const canAddCpu = lobby.host && lobby.mode !== '1v1' && !lobby.members.some(member => member.bot);
        this.memberRows.forEach((row, index) => {
            const member = lobby.members[index];
            const used = index < mode.players;
            [row.box, row.swatch, row.name, row.fighter, row.tag].forEach(part => part.setVisible(visible && used));
            const status = member && !member.bot ? MEMBER_STATUS[member.status] ?? MEMBER_STATUS.active : null;
            row.status.setVisible(visible && used && Boolean(status));
            const canInvite = visible && used && !member && lobby.private && lobby.host;
            [row.invite.box, row.invite.text].forEach(part => part.setVisible(canInvite));
            const addCpuHere = visible && used && canAddCpu && index === lobby.members.length;
            [row.addCpu.box, row.addCpu.text].forEach(part => part.setVisible(addCpuHere));
            const removeCpuHere = visible && lobby.host && Boolean(member?.bot);
            [row.removeCpu.box, row.removeCpu.text].forEach(part => part.setVisible(removeCpuHere));
            const showReady = visible && used && Boolean(member?.ready) && !member.bot;
            [row.readyShade, row.readyText].forEach(part => part.setVisible(showReady));
            if (!used) return;
            const color = PLAYER_COLORS[mode.colors[index]];
            row.swatch.setFillStyle(color.hex, member ? 1 : 0.3);
            row.box.setStrokeStyle(2, member?.you ? HEX.accent : HEX.border);
            if (!member) {
                row.name.setText(lobby.private ? 'INVITE ONLY' : 'OPEN SLOT').setColor('#777777');
                row.fighter.setText(mode.teams ? `TEAM ${color.label}` : color.label);
                row.tag.setText('');
                return;
            }
            const character = CHARACTER_ROSTER.find(entry => entry.key === member.character);
            row.name.setText(member.name).setColor(color.css);
            if (status) row.status.setText(status.label).setColor(status.color).setX(row.name.x + row.name.width + MEMBER_STATUS_GAP);
            const tag = member.tag ? `#${member.tag}   ` : '';
            row.fighter.setText(`${tag}${character?.name ?? member.character} - ${member.variant}${mode.teams ? `   TEAM ${color.label}` : ''}`.toUpperCase());
            const labels = [index === 0 ? 'HOST' : '', member.ready ? 'READY' : 'NOT READY', member.you ? 'YOU' : ''];
            row.tag.setText(member.bot ? (lobby.host ? '' : 'CPU') : labels.filter(Boolean).join(' / '))
                .setColor(member.ready ? COLORS.accent : COLORS.error);
        });
        const full = lobby.members.length >= mode.players;
        const canStart = full && this.everyoneReady;
        const rejected = Boolean(this.startErrorTimer);
        this.startButton.box.setVisible(visible && lobby.host).setAlpha(canStart || rejected ? 1 : 0.5)
            .setStrokeStyle(3, rejected ? HEX.error : HEX.border);
        this.startButton.text.setVisible(visible && lobby.host).setAlpha(canStart || rejected ? 1 : 0.4)
            .setColor(rejected ? COLORS.error : COLORS.text);
        const ready = this.isReady;
        this.readyButton.box.setVisible(visible).setStrokeStyle(3, ready ? HEX.accent : HEX.border);
        this.readyButton.text.setVisible(visible).setText(ready ? 'UNREADY' : 'READY')
            .setColor(ready ? COLORS.accent : COLORS.text);
        const layout = lobby.host ? HOST_BUTTON_X : GUEST_BUTTON_X;
        this.placeLobbyButton(this.readyButton, layout.ready);
        this.placeLobbyButton(this.leaveButton, layout.leave);
        if (lobby.host) this.placeLobbyButton(this.startButton, layout.start);
        const waiting = lobby.private && lobby.host ? 'INVITE PLAYERS TO FILL THE SLOTS' : 'WAITING FOR PLAYERS';
        let status;
        if (!ready) status = 'PICK YOUR FIGHTER, THEN PRESS READY';
        else if (!lobby.host) status = 'YOU ARE READY. WAITING FOR THE HOST';
        else if (!full) status = `${waiting} (${lobby.members.length}/${mode.players})`;
        else status = this.everyoneReady ? 'EVERYONE IS READY. PRESS START!' : 'WAITING FOR EVERYONE TO READY UP';
        if (rejected) this.queueText.setText(this.startError).setColor(COLORS.error);
        else this.queueText.setText(status).setColor(COLORS.accent);
    }

    placeLobbyButton(button, offset) {
        button.box.baseX = PANEL.x + offset;
        if (button === this.startButton && this.startShake?.isPlaying()) return;
        button.box.setX(button.box.baseX);
        button.text.setX(button.box.baseX);
    }

    rejectStart(message) {
        this.sound.play('deny');
        this.startError = message;
        this.startErrorTimer?.remove();
        this.startErrorTimer = this.time.delayedCall(START_ERROR_MS, () => {
            this.startErrorTimer = null;
            this.refreshLobby();
        });
        this.refreshLobby();
        const { box, text: label } = this.startButton;
        this.startShake?.stop();
        const moveTo = x => [box, label].forEach(part => part.setX(x));
        this.startShake = this.tweens.addCounter({
            from: 0,
            to: SHAKE_OFFSETS.length - 1,
            duration: SHAKE_MS,
            ease: 'Sine.Out',
            onUpdate: tween => {
                const position = tween.getValue();
                const index = Math.min(Math.floor(position), SHAKE_OFFSETS.length - 2);
                moveTo(box.baseX + Phaser.Math.Linear(SHAKE_OFFSETS[index], SHAKE_OFFSETS[index + 1], position - index));
            },
            onComplete: () => moveTo(box.baseX),
            onStop: () => moveTo(box.baseX)
        });
    }

    sendLobbyPick() {
        if (this.queueState !== 'lobby' || this.isReady) return;
        const self = this.lobby?.members.find(member => member.you);
        const { character, variant } = this.getChoice();
        if (self && self.character === character.key && self.variant === variant.name) return;
        net.send({ t: 'pick', character: character.key, variant: variant.name });
    }

    toggleReady() {
        if (this.queueState !== 'lobby' || !this.lobby) return;
        if (!this.isReady) this.sendLobbyPick();
        net.send({ t: 'ready', r: !this.isReady });
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
                modifiers: settings.modifiers,
                private: settings.private
            }
        });
    }

    refreshSelection() {
        const { character, variant, map } = this.getChoice();
        this.fighterIcon.setTexture(getCharacterTexture(character.key, variant.name)).setDisplaySize(FIGHTER_ICON, FIGHTER_ICON);
        this.fighterName.setText(character.name);
        this.variantText.setText(variant.name).setColor(variant.color ?? '#ffffff');
        this.fighterPicker?.refresh();
        this.nameButton.text.setFontSize(15).setText(`NAME: ${this.selection.name}${net.tag ? ` #${net.tag}` : ''}`);
        for (let size = 14; size >= 10 && this.nameButton.text.width > FIGHTER.width - 16; size--) {
            this.nameButton.text.setFontSize(size);
        }
        net.setName(this.selection.name);
        this.sendLobbyPick();
        this.quickMapText.setText(mapLabel(map));
        if (this.screen === 'create') this.refreshCreate();
        this.saveAll();
    }

    refreshQuickCount() {
        if (!this.quickButton?.text.active) return;
        const others = Math.max(0, this.quickWaiting - (this.queueState === 'queued' ? 1 : 0));
        this.quickButton.text.setText(this.quickWaiting > 0 ? `QUICK 1V1 (${this.quickWaiting} WAITING)` : 'QUICK 1V1');
        this.quickCountText.setText(others > 0
            ? `${others} OTHER PLAYER${others === 1 ? ' IS' : 'S ARE'} WAITING IN QUICK 1V1`
            : 'NO ONE ELSE IS WAITING IN QUICK 1V1 YET');
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
            modifiers: this.getModifierSelection(),
            private: settings.private
        });
        this.invitesSent.clear();
        this.queueState = 'creating';
        this.queueText.setText('CREATING LOBBY...');
    }

    joinByCode(code) {
        this.autoJoin = null;
        if (!this.selection || !net.connected || this.queueState !== 'idle') return;
        this.sendChoice('joinLobby', { code });
        this.queueState = 'joining';
        this.joiningFromInvite = true;
        this.queueText.setText('JOINING FROM INVITE...');
    }

    showNotice() {
        if (this.screen === 'home') this.queueText.setText(this.notice.toUpperCase()).setColor(COLORS.error);
        this.notice = null;
    }

    copyInviteLink() {
        const code = this.lobby?.inviteCode;
        if (!code) return;
        const link = makeInviteLink(code);
        const copied = () => {
            this.copyLinkButton.text.setText('COPIED');
            this.time.delayedCall(COPY_LINK.copiedMs, () => {
                if (this.copyLinkButton.text.active) this.copyLinkButton.text.setText('COPY INVITE LINK');
            });
            this.setStatus('Invite link copied. Send it to a friend.', COLORS.accent);
        };
        const failed = () => this.setStatus(`Couldn't copy the link. Invite code: ${code}`, COLORS.accent);
        if (!navigator.clipboard?.writeText) {
            failed();
            return;
        }
        navigator.clipboard.writeText(link).then(copied, failed);
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
            this.rejectStart('THE LOBBY NEEDS TO BE FULL TO START');
            return;
        }
        if (!this.everyoneReady) {
            this.rejectStart('EVERYONE NEEDS TO BE READY TO START');
            return;
        }
        net.send({ t: 'startLobby' });
    }

    leaveLobby() {
        if (this.queueState !== 'lobby') return;
        this.closeModifierList();
        net.send({ t: 'leave' });
        this.queueState = 'idle';
        this.lobby = null;
        this.invitesSent.clear();
        this.showScreen('browse');
    }

    startMatch(match) {
        this.closeModifierList();
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
        if (this.invitePopup) {
            this.closeInvitePopup();
            return;
        }
        const parents = { stage: 'create', modifiers: 'create', create: 'home', browse: 'home', invite: 'lobby' };
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
