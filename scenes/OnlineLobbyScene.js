// Online lobby: pick a fighter, a name and a map, then join the 1v1 queue on the
// LAN server. When the server pairs you with someone it sends "matchFound" and
// we move to OnlineGameScene.

import Phaser from 'phaser';
import { preloadMenu, preloadCharacterSelection } from './GameScene/preload.js';
import { fadeOutTo } from './transitions.js';
import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { getConnectedControllers, getMenuGamepadInput } from '../navigation.js';
import { net } from '../mp/client.js';
import { cleanName, MAP_CHOICES, MAX_NAME_LENGTH } from '../mp/protocol.js';
import { getOnlineServerHost, isOnlineAvailable, usesRemoteServer } from '../mp/serverConfig.js';

const SETTINGS_KEY = 'blockBattleOnline';
const MAP_LABELS = { DESERT: 'DESERT', SNOWY: 'SNOWY', RANDOM: 'RANDOM' };

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
        // Settings just won't be remembered.
    }
}

function makeButton(scene, x, y, width, height, label, onClick, fontSize = 24) {
    const box = scene.add.rectangle(x, y, width, height, 0x171717)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, {
        fontFamily: 'VCROSD',
        fontSize: `${fontSize}px`,
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);
    box.on('pointerover', () => box.setFillStyle(0x444444));
    box.on('pointerout', () => box.setFillStyle(0x171717));
    box.on('pointerdown', () => {
        scene.sound.play('hover');
        onClick();
    });
    return { box, text };
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
        scene.sound.play('hover');
        onClick();
    });
    return arrow;
}

export class OnlineLobbyScene extends Phaser.Scene {
    constructor() {
        super('OnlineLobbyScene');
    }

    preload() {
        preloadMenu.call(this);
        preloadCharacterSelection.call(this);
    }

    init(data) {
        this.autoQueue = Boolean(data?.autoQueue);
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
        this.add.text(500, 92, usesRemoteServer() ? `SERVER: ${getOnlineServerHost()}` : 'LOCAL NETWORK (LAN) ONLY, FOR NOW', {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffd34d'
        }).setOrigin(0.5);

        this.statusText = this.add.text(500, 122, '', {
            fontFamily: 'GameFont',
            fontSize: '13px',
            fill: '#bbbbbb',
            align: 'center'
        }).setOrigin(0.5);

        makeButton(this, 500, 568, 150, 40, 'BACK', () => this.goBack(), 20);
        this.input.keyboard.on('keydown-ESC', () => this.goBack());

        this.cleanups = [];
        this.events.once('shutdown', () => {
            this.cleanups.forEach(cleanup => cleanup());
            this.cleanups = [];
        });

        if (!isOnlineAvailable()) {
            this.showHostingHelp();
            return;
        }

        const saved = loadSettings();
        const characterIndex = Math.max(0, CHARACTER_ROSTER.findIndex(c => c.key === saved.character));
        this.selection = {
            characterIndex,
            variantIndex: Math.max(0, CHARACTER_ROSTER[characterIndex].variants.findIndex(v => v.name === saved.variant)),
            mapIndex: Math.max(0, MAP_CHOICES.indexOf(saved.map)),
            name: cleanName(saved.name ?? `Player${Math.floor(Math.random() * 900 + 100)}`)
        };
        this.queueState = 'idle';
        this.queueStartedAt = 0;
        this.previousPad = {};

        this.buildFighterPanel();
        this.buildMatchPanel();
        this.refreshSelection();
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
            'Online play needs the BlockBattle LAN server, and websites like',
            'GitHub Pages can only hand out files, they cannot run it.',
            '',
            'To play: on one computer, download the game and run',
            'npm install   then   npm run lan',
            '',
            'Then everyone on the same Wi-Fi opens the http:// address it prints.'
        ].join('\n'), {
            fontFamily: 'GameFont',
            fontSize: '15px',
            fill: '#dddddd',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);
    }

    buildFighterPanel() {
        this.add.rectangle(290, 330, 340, 330, 0x171717, 0.92).setStrokeStyle(3, 0xffffff);
        this.add.text(290, 185, 'YOUR FIGHTER', {
            fontFamily: 'GameFont',
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.fighterIcon = this.add.image(290, 275, 'axeman').setDisplaySize(130, 130);
        makeArrow(this, 165, 275, '<', () => this.changeCharacter(-1));
        makeArrow(this, 415, 275, '>', () => this.changeCharacter(1));

        this.fighterName = this.add.text(290, 370, '', {
            fontFamily: 'GameFont',
            fontSize: '26px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.variantText = this.add.text(290, 402, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.variantButton = makeButton(this, 290, 450, 220, 36, 'SWITCH VARIANT', () => this.changeVariant(1), 18);
    }

    buildMatchPanel() {
        this.add.rectangle(710, 330, 400, 330, 0x171717, 0.92).setStrokeStyle(3, 0xffffff);

        this.add.text(710, 185, 'NAME', {
            fontFamily: 'GameFont',
            fontSize: '16px',
            fill: '#bbbbbb'
        }).setOrigin(0.5);
        this.nameButton = makeButton(this, 710, 220, 300, 44, '', () => this.editName(), 24);

        this.add.text(710, 270, 'MAP', {
            fontFamily: 'GameFont',
            fontSize: '16px',
            fill: '#bbbbbb'
        }).setOrigin(0.5);
        this.mapText = this.add.text(710, 305, '', {
            fontFamily: 'VCROSD',
            fontSize: '28px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        makeArrow(this, 590, 305, '<', () => this.changeMap(-1));
        makeArrow(this, 830, 305, '>', () => this.changeMap(1));

        this.queueButton = makeButton(this, 710, 390, 300, 64, 'FIND MATCH', () => this.toggleQueue(), 30);
        this.queueText = this.add.text(710, 448, '', {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#ffd34d',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(500, 528, '< > FIGHTER   ^ v VARIANT   M MAP   N NAME   ENTER FIND MATCH   ESC BACK', {
            fontFamily: 'GameFont',
            fontSize: '11px',
            fill: '#999999'
        }).setOrigin(0.5);
    }

    bindLobbyKeys() {
        const keyboard = this.input.keyboard;
        const bind = (keys, action) => keys.forEach(key => keyboard.on(`keydown-${key}`, action));
        bind(['LEFT', 'A'], () => this.changeCharacter(-1));
        bind(['RIGHT', 'D'], () => this.changeCharacter(1));
        bind(['UP', 'W'], () => this.changeVariant(-1));
        bind(['DOWN', 'S'], () => this.changeVariant(1));
        bind(['M'], () => this.changeMap(1));
        bind(['N'], () => this.editName());
        bind(['ENTER', 'SPACE'], () => this.toggleQueue());
    }

    connectToServer() {
        this.setStatus('Connecting to the server...');
        const listen = (type, handler) => this.cleanups.push(net.on(type, handler));

        listen('status', message => {
            if (this.queueState === 'idle' || this.queueState === 'queued') {
                this.setStatus(`Connected to ${getOnlineServerHost()}   |   ${message.online} online   |   ${message.queued} searching   |   ${message.matches} playing`);
            }
        });
        listen('queued', message => {
            this.queueState = 'queued';
            this.queuePosition = message;
            this.refreshQueue();
        });
        listen('left', () => {
            this.queueState = 'idle';
            this.refreshQueue();
        });
        listen('matchFound', message => this.startMatch(message));
        listen('error', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'queued') {
                this.queueState = 'idle';
                this.refreshQueue();
            }
        });
        listen('disconnected', () => {
            this.queueState = 'idle';
            this.refreshQueue();
            this.setStatus('Lost connection to the server. Is it still running?', '#ff6b6b');
        });

        net.connect()
            .then(() => {
                this.setStatus(`Connected to ${getOnlineServerHost()}`);
                if (this.autoQueue) this.toggleQueue();
            })
            .catch(error => {
                const hint = usesRemoteServer() ? 'It may be down right now, try again later.' : 'Start it with "npm run lan" on the host computer.';
                this.setStatus(`${error.message} ${hint}`, '#ff6b6b');
            });
    }

    setStatus(text, color = '#bbbbbb') {
        this.statusText.setText(text).setColor(color);
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
        if (pressed('a')) this.toggleQueue();
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

    changeMap(direction) {
        if (!this.selection || this.locked) return;
        const count = MAP_CHOICES.length;
        this.selection.mapIndex = (this.selection.mapIndex + direction + count) % count;
        this.refreshSelection();
    }

    editName() {
        if (!this.selection || this.locked) return;
        // A browser prompt is the simplest way to get real text input (works on phones too).
        const entered = window.prompt(`Your name (max ${MAX_NAME_LENGTH} characters):`, this.selection.name);
        if (entered === null) return;
        this.selection.name = cleanName(entered);
        this.refreshSelection();
    }

    getChoice() {
        const character = CHARACTER_ROSTER[this.selection.characterIndex];
        const variant = character.variants[this.selection.variantIndex];
        return { character, variant, map: MAP_CHOICES[this.selection.mapIndex] };
    }

    refreshSelection() {
        const { character, variant, map } = this.getChoice();
        this.fighterIcon.setTexture(getCharacterTexture(character.key, variant.name)).setDisplaySize(130, 130);
        this.fighterName.setText(character.name);
        this.variantText.setText(variant.name).setColor(variant.color ?? '#ffffff');
        const hasVariants = character.variants.length > 1;
        this.variantButton.box.setVisible(hasVariants);
        this.variantButton.text.setVisible(hasVariants);
        this.nameButton.text.setText(this.selection.name);
        this.mapText.setText(MAP_LABELS[map]);
        saveSettings({
            character: character.key,
            variant: variant.name,
            map,
            name: this.selection.name
        });
    }

    refreshQueue(time = this.time.now) {
        if (this.queueState === 'queued') {
            const seconds = Math.floor((time - this.queueStartedAt) / 1000);
            const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
            const dots = '.'.repeat(1 + Math.floor(time / 400) % 3);
            const position = this.queuePosition
                ? `   |   #${this.queuePosition.pos} in line`
                : '';
            this.queueText.setText(`SEARCHING${dots}  ${clock}${position}`);
            this.queueButton.text.setText('CANCEL');
        } else if (this.queueState === 'found') {
            this.queueButton.text.setText('MATCH FOUND!');
        } else {
            this.queueText.setText('');
            this.queueButton.text.setText('FIND MATCH');
        }
    }

    toggleQueue() {
        if (!this.selection || !net.connected || this.queueState === 'found') return;
        if (this.queueState === 'queued') {
            net.send({ t: 'leave' });
            this.queueState = 'idle';
            this.refreshQueue();
            return;
        }
        const { character, variant, map } = this.getChoice();
        net.send({
            t: 'queue',
            name: this.selection.name,
            character: character.key,
            variant: variant.name,
            map
        });
        this.queueState = 'queued';
        this.queuePosition = null;
        this.queueStartedAt = this.time.now;
        this.refreshQueue();
    }

    startMatch(match) {
        this.queueState = 'found';
        this.refreshQueue();
        this.queueText.setText(`VS ${match.opponent.name}  (${match.opponent.character.toUpperCase()})`);
        this.sound.play('hover2');
        this.time.delayedCall(600, () => {
            this.scene.start('OnlineGameScene', { match });
        });
    }

    goBack() {
        if (this.queueState === 'found') return;
        if (this.queueState === 'queued') net.send({ t: 'leave' });
        fadeOutTo(this, () => this.scene.start('MenuScene'));
    }
}
