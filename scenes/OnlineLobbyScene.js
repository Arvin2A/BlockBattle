// Online lobby: pick a fighter and a name, then either host a match on a map of
// your choice or join one from the list of open matches. When the server pairs
// two players it sends "matchFound" and we move to OnlineGameScene.

import Phaser from 'phaser';
import { preload as preloadMatch, preloadMenu, preloadCharacterSelection } from './GameScene/preload.js';
import { fadeOutTo } from './transitions.js';
import { CHARACTER_ROSTER } from '../characterRoster.js';
import { getCharacterTexture } from '../characterTextures.js';
import { getConnectedControllers, getMenuGamepadInput } from '../navigation.js';
import { net } from '../mp/client.js';
import { cleanName, MAP_CHOICES, MAX_NAME_LENGTH } from '../mp/protocol.js';
import { getOnlineServerHost, getServerName, isOnlineConfigured, usesRemoteServer } from '../mp/serverConfig.js';

const SETTINGS_KEY = 'blockBattleOnline';
const MAP_LABELS = { RANDOM: 'RANDOM' };
const ROOMS_PER_PAGE = 4;

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

// A real text box over the game, so typing works with any keyboard (phones too).
// Calls onDone with the new name, or null if cancelled.
function openNameBox(current, onDone) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;' +
        'justify-content:center;background:rgba(0,0,0,0.6);padding:16px;box-sizing:border-box;';
    const panel = document.createElement('form');
    panel.style.cssText = 'background:#171717;border:3px solid #fff;padding:20px;width:100%;max-width:340px;' +
        'display:flex;flex-direction:column;gap:12px;font-family:VCROSD,monospace;color:#fff;';
    const label = document.createElement('label');
    label.textContent = 'CHANGE YOUR NAME';
    label.style.cssText = 'font-size:22px;text-align:center;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.maxLength = MAX_NAME_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = 'font:inherit;font-size:22px;padding:8px;background:#000;color:#fff;border:2px solid #888;';
    const hint = document.createElement('div');
    hint.textContent = `Up to ${MAX_NAME_LENGTH} letters/numbers. Enter to save, Esc to cancel.`;
    hint.style.cssText = 'font-size:14px;color:#999;text-align:center;';
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
    // Keep Phaser from seeing the keys typed into the box.
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
        finish(input.value);
    });
    cancel.addEventListener('click', () => finish(null));
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
    return () => finish(null);
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
        // Download the match files here, before anyone can host or join, so a slow
        // connection can't make the match time out on the server while it loads.
        // Already-loaded files are skipped, so this is instant after the first time.
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
        this.add.text(500, 92, usesRemoteServer() ? `SERVER: ${getServerName()}` : 'LOCAL NETWORK (LAN)', {
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
            name: cleanName(saved.name ?? `Player${Math.floor(Math.random() * 900 + 100)}`)
        };
        this.queueState = 'idle';
        this.queueStartedAt = 0;
        this.myRoomId = null;
        this.rooms = [];
        this.roomPage = 0;
        this.previousPad = {};
        this.closeNameBox = null;
        this.cleanups.push(() => this.closeNameBox?.());

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
        this.add.rectangle(710, 330, 400, 330, 0x171717, 0.92).setStrokeStyle(3, 0xffffff);

        this.nameButton = makeButton(this, 710, 190, 370, 34, '', () => this.editName(), 18);

        this.roomsHeader = this.add.text(710, 226, '', {
            fontFamily: 'GameFont',
            fontSize: '15px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.pageArrows = [
            makeArrow(this, 540, 226, '<', () => this.changeRoomPage(-1)),
            makeArrow(this, 880, 226, '>', () => this.changeRoomPage(1))
        ];
        this.pageArrows.forEach(arrow => arrow.setFontSize(22));

        this.roomRows = [];
        for (let i = 0; i < ROOMS_PER_PAGE; i++) {
            const y = 262 + i * 36;
            const row = { room: null };
            row.box = this.add.rectangle(710, y, 380, 32, 0x262626).setStrokeStyle(2, 0x555555);
            row.name = this.add.text(522, y - 7, '', {
                fontFamily: 'VCROSD',
                fontSize: '17px',
                fill: '#ffffff'
            }).setOrigin(0, 0.5);
            row.fighter = this.add.text(522, y + 8, '', {
                fontFamily: 'GameFont',
                fontSize: '10px',
                fill: '#aaaaaa'
            }).setOrigin(0, 0.5);
            row.map = this.add.text(735, y, '', {
                fontFamily: 'VCROSD',
                fontSize: '17px',
                fill: '#ffd34d'
            }).setOrigin(0.5);
            row.count = this.add.text(797, y, '1/2', {
                fontFamily: 'VCROSD',
                fontSize: '17px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            row.join = makeButton(this, 860, y, 78, 26, 'JOIN', () => this.joinRoom(row.room), 16);
            row.you = this.add.text(860, y, 'YOU', {
                fontFamily: 'VCROSD',
                fontSize: '17px',
                fill: '#ffd34d'
            }).setOrigin(0.5);
            this.roomRows.push(row);
        }
        this.emptyRoomsText = this.add.text(710, 316, 'No one is waiting right now.\nHost a match and it shows up here\nfor everyone in the lobby.', {
            fontFamily: 'GameFont',
            fontSize: '13px',
            fill: '#999999',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        this.add.text(575, 420, 'HOST ON', {
            fontFamily: 'GameFont',
            fontSize: '14px',
            fill: '#bbbbbb'
        }).setOrigin(0.5);
        this.mapText = this.add.text(760, 420, '', {
            fontFamily: 'VCROSD',
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.mapArrows = [
            makeArrow(this, 670, 420, '<', () => this.changeMap(-1)),
            makeArrow(this, 850, 420, '>', () => this.changeMap(1))
        ];

        this.queueButton = makeButton(this, 710, 458, 300, 36, 'HOST MATCH', () => this.toggleQueue(), 24);
        this.queueText = this.add.text(710, 485, '', {
            fontFamily: 'GameFont',
            fontSize: '12px',
            fill: '#ffd34d',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(500, 528, '< > FIGHTER   ^ v VARIANT   M MAP   N NAME   ENTER HOST   1-4 JOIN   ESC BACK', {
            fontFamily: 'GameFont',
            fontSize: '11px',
            fill: '#999999'
        }).setOrigin(0.5);

        this.refreshRooms();
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
        ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, index) => {
            bind([key], () => this.joinRoom(this.roomRows[index].room));
        });
    }

    connectToServer() {
        this.setStatus('Connecting to the server...');
        const listen = (type, handler) => this.cleanups.push(net.on(type, handler));

        listen('status', message => {
            if (this.queueState === 'idle' || this.queueState === 'queued') {
                this.setStatus(`Connected to ${getOnlineServerHost()}   |   ${message.online} online   |   ${message.queued} open matches   |   ${message.matches} playing`);
            }
        });
        listen('queued', message => {
            this.queueState = 'queued';
            this.myRoomId = message.room;
            this.refreshQueue();
            this.refreshRooms();
        });
        listen('left', () => {
            this.queueState = 'idle';
            this.myRoomId = null;
            this.refreshQueue();
            this.refreshRooms();
        });
        listen('rooms', message => {
            this.rooms = Array.isArray(message.rooms) ? message.rooms : [];
            this.refreshRooms();
        });
        listen('joinFailed', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'joining') {
                this.queueState = 'idle';
                this.refreshQueue();
            }
        });
        listen('matchFound', message => this.startMatch(message));
        listen('error', message => {
            this.setStatus(message.msg, '#ff6b6b');
            if (this.queueState === 'queued' || this.queueState === 'joining') {
                this.queueState = 'idle';
                this.myRoomId = null;
                this.refreshQueue();
                this.refreshRooms();
            }
        });
        listen('disconnected', () => {
            this.queueState = 'idle';
            this.myRoomId = null;
            this.rooms = [];
            this.refreshQueue();
            this.refreshRooms();
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
        if (!this.selection || this.locked || this.closeNameBox) return;
        this.input.keyboard.enabled = false;
        this.closeNameBox = openNameBox(this.selection.name, entered => {
            this.closeNameBox = null;
            if (!this.sys.isActive()) return;
            this.input.keyboard.enabled = true;
            if (entered === null) return;
            this.selection.name = cleanName(entered);
            this.refreshSelection();
        });
    }

    changeRoomPage(direction) {
        const pages = Math.max(1, Math.ceil(this.rooms.length / ROOMS_PER_PAGE));
        this.roomPage = (this.roomPage + direction + pages) % pages;
        this.refreshRooms();
    }

    refreshRooms() {
        if (!this.roomRows) return;
        const pages = Math.max(1, Math.ceil(this.rooms.length / ROOMS_PER_PAGE));
        this.roomPage = Math.min(this.roomPage, pages - 1);
        const pageText = pages > 1 ? `   ${this.roomPage + 1}/${pages}` : '';
        this.roomsHeader.setText(`OPEN MATCHES (${this.rooms.length})${pageText}`);
        this.pageArrows.forEach(arrow => arrow.setVisible(pages > 1));
        this.emptyRoomsText.setVisible(this.rooms.length === 0);

        const shown = this.rooms.slice(this.roomPage * ROOMS_PER_PAGE, (this.roomPage + 1) * ROOMS_PER_PAGE);
        this.roomRows.forEach((row, index) => {
            const room = shown[index] ?? null;
            row.room = room;
            const parts = [row.box, row.name, row.fighter, row.map, row.count];
            parts.forEach(part => part.setVisible(Boolean(room)));
            const mine = Boolean(room) && room.id === this.myRoomId;
            row.join.box.setVisible(Boolean(room) && !mine);
            row.join.text.setVisible(Boolean(room) && !mine);
            row.you.setVisible(mine);
            if (!room) return;
            const character = CHARACTER_ROSTER.find(c => c.key === room.character);
            row.box.setStrokeStyle(2, mine ? 0xffd34d : 0x555555);
            row.name.setText(`${index + 1}. ${room.name}`);
            row.fighter.setText(`${character?.name ?? room.character} - ${room.variant}`.toUpperCase());
            row.map.setText(MAP_LABELS[room.map] ?? room.map);
            row.count.setText(`${room.players}/${room.max}`);
        });
    }

    joinRoom(room) {
        if (!room || !this.selection || !net.connected || room.id === this.myRoomId) return;
        if (this.queueState === 'found' || this.queueState === 'joining') return;
        const { character, variant } = this.getChoice();
        // The server closes our own open match, if any, when we join someone else's.
        net.send({
            t: 'join',
            room: room.id,
            name: this.selection.name,
            character: character.key,
            variant: variant.name
        });
        this.queueState = 'joining';
        this.myRoomId = null;
        this.refreshQueue();
        this.refreshRooms();
    }

    getChoice() {
        const character = CHARACTER_ROSTER[this.selection.characterIndex];
        const variant = character.variants[this.selection.variantIndex];
        return { character, variant, map: MAP_CHOICES[this.selection.mapIndex] };
    }

    refreshSelection() {
        const { character, variant, map } = this.getChoice();
        this.fighterIcon.setTexture(getCharacterTexture(character.key, variant.name)).setDisplaySize(120, 120);
        this.fighterName.setText(character.name);
        this.variantText.setText(variant.name).setColor(variant.color ?? '#ffffff');
        this.fighterDesc.setFontSize(15).setText(variant.desc ?? '');
        for (let size = 14; size >= 10 && this.fighterDesc.height > 280; size--) {
            this.fighterDesc.setFontSize(size);
        }
        const hasVariants = character.variants.length > 1;
        this.variantButton.box.setVisible(hasVariants);
        this.variantButton.text.setVisible(hasVariants);
        this.nameButton.text.setText(`NAME: ${this.selection.name}   (CHANGE)`);
        this.mapText.setText(MAP_LABELS[map] ?? map);
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
            this.queueText.setText(`WAITING FOR SOMEONE TO JOIN${dots}  ${clock}`);
            this.queueButton.text.setText('CANCEL');
        } else if (this.queueState === 'joining') {
            this.queueText.setText('JOINING...');
        } else if (this.queueState === 'found') {
            this.queueButton.text.setText('MATCH FOUND!');
        } else {
            this.queueText.setText('');
            this.queueButton.text.setText('HOST MATCH');
        }
    }

    toggleQueue() {
        if (!this.selection || !net.connected || this.queueState === 'found' || this.queueState === 'joining') return;
        if (this.queueState === 'queued') {
            net.send({ t: 'leave' });
            this.queueState = 'idle';
            this.myRoomId = null;
            this.refreshQueue();
            this.refreshRooms();
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
        this.queueStartedAt = this.time.now;
        this.refreshQueue();
    }

    startMatch(match) {
        this.queueState = 'found';
        this.refreshQueue();
        this.queueText.setText(`VS ${match.opponent.name}  (${match.opponent.character.toUpperCase()})`);
        this.sound.play('hover2');
        this.time.delayedCall(600, () => {
            const { character, variant } = this.getChoice();
            const self = { character: character.key, variant: variant.name };
            this.scene.start('OnlineGameScene', { match: { ...match, self } });
        });
    }

    goBack() {
        if (this.queueState === 'found' || this.closeNameBox) return;
        if (this.queueState === 'queued') net.send({ t: 'leave' });
        fadeOutTo(this, () => this.scene.start('MenuScene'));
    }
}
