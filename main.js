import { attack, pushAttack, lungePush, thirdAttack, superSwing, tryAttack, attackIsElligible, tryLunge, tryCleave, handleAttack, handleDirSpecial, handleDirSpecialAttack} from './attacks.js';
import { initiatePlayers, updateCombo } from './players.js';
//UPDATE: HUGE REFACTOR OF CODE!! THIS IS FOR CLEANLINESS AND FOR THE FURTHER DEVELOPMENT OF THIS WEB APP
//3 NEW SCRIPTS: main.js (current), players.js, attacks.js


//TESTER CREDITS:
//Thank you all testers for this game, including several students in my grade
//The most impactful testers I'd wish to mention are:
//Aidan Z, Deyu Z, Luke Ch, Augustus L, Jaylen L, Presley F, Giovanni M, Jeffrey C, Mr. Primm
//While they might have told others about the game, those are who I know about who have played and tested the game
//Not only did they play the game, but I was also able to work up to some of their suggestions.
//The ones impactful are the ones I've also observed mistakes in the game from, whether stating it to me or watching them play, so I can add fixes to the code

// This is a 2D platform fighter game made using Phaser and Javascript. Requires a keyboard to play
//ENTIRE script is made by zamanarvin. Some assets were made by Jeffrey C, others by me 
//NOTE: mohsina007 and arvin2a are the same person, ARVIN ZAMAN
// its just that mohsina007 is the account that was hard-set as the account for VSCode, the application I used to make this game.
// and the sound effects were taken from various games as listed in the preload function.
//WASD controls the first player , arrow keys control the second player.
//E is the player1 attack, SHIFT is the player2 attack.
//You can double tap each player's corresponding side buttons (A + D), or (LEFT ARROW + RIGHT ARROW KEY) to do a special attack.

//We will still continue to work on this project, its really fun.


//UPDATE: ADDED 3 NEW CHARACTERS: FISHERMAN, SCYTHEMAN, AND HAMMERMAN
//FUTURE UPDATES: ADD VFX AND POLISH
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    //was meant to be used, but was succeeded later after the discovery of scene.time.delayedCall
}
async function loadFont() {
    const font = new FontFace('GameFont', 'url(assets/fonts/GameFont.otf)');
    await font.load();
    document.fonts.add(font);
    const font2 = new FontFace('VCROSD', 'url(assets/fonts/VCROSD.ttf)')
    await font2.load();
    document.fonts.add(font2)
    //load the gamefont that is very kool
}

var MenuScene = {
    //load the menu scene which is just a cool background image we made
    //its also has the start button, initiating the game when clicked
    key: 'MenuScene',
    preload: function () {
        this.load.image('menuBackground', 'assets/Homescreen.png');
    },
    create: function () {
        const bg = this.add.image(500, 300, 'menuBackground');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        // Create menu UI elements here
        const startBox = this.add.rectangle(
            500,
            500,
            500,
            70,
            0x228B22
        );
        startBox.setStrokeStyle(4, 0xffffff);

        var startText = this.add.text(500, 500, 'Start Game', { fontFamily: 'GameFont', fontSize: '32px', fill: '#FFFFFF', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        startText.setInteractive();
        startText.on('pointerover', function () {
            startText.setStyle({ fill: '#0b410b' });
        });

        startText.on('pointerout', function () {
            startText.setStyle({ fill: '#FFFFFF' });
        });
        startText.on('pointerdown', function () {
            this.scene.start('CharacterSelectScene');
        }, this);
    }
};
var player1Character = '';
var player2Character = '';
var CharacterSelectScene = {

    key: 'CharacterSelectScene',

    preload: function () {
        this.load.audio('hover', 'audio/hover.wav')
    },
    create: function () {

        // -----------------------------
        // DATA
        // -----------------------------

        this.characters = [
            'swordman',
            'axeman',
            'fisherman',
            'scytheman',
            'hammerman'
        ];

        this.characterData = [
            { name: 'SWORDMAN', desc: 'Beware of the slashing sword. \n\nDIR SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential.', color: '#0080ff' },
            { name: 'AXEMAN', desc: 'Beware of the chopping axe. \n\nDIR SPECIAL: POWER SWING \n\n The most knockback you can ever do in this entire game, send your foes across the galaxy!', color: '#ff4444' },
            { name: 'FISHERMAN', desc: 'Using a fishing rod as a whip?? \n\nDIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in.', color: '#00318d' },
            { name: 'SCYTHEMAN', desc: 'Its third neutral hit goes slightly higher. \n\nDIR SPECIAL: MOW \n\n Throw a scythe thats 3X your size like a boomerang that deals crazy damage.', color: '#686868' },
            { name: 'HAMMERMAN', desc: 'EVERY hit is a knockback attack. \n\nDIR SPECIAL: REPAIR \n\n 3 strikes that remove 15% KB, while also having attack potential of 5% per strike.', color: '#3da115' }
        ];

        this.p1Index = 1;
        this.p2Index = 0;

        // background
        this.cameras.main.setBackgroundColor('#1b1b1b');

        // -----------------------------
        // TITLE
        // -----------------------------

        this.add.text(
            500,
            50,
            'PRESS W + S TO SELECT WITH P1, \nUP AND DOWN ARROW FOR P2',
            {
                fontFamily: 'GameFont',
                fontSize: '30px',
                fill: '#c300d4',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        // -----------------------------
        // CHARACTER LIST
        // -----------------------------

        this.characterTexts = [];

        for (let i = 0; i < this.characters.length; i++) {

            const txt = this.add.text(
                500,
                180 + i * 50,
                this.characters[i],
                {
                    fontFamily: 'GameFont',
                    fontSize: '24px',
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 5
                }
            ).setOrigin(0.5);

            this.characterTexts.push(txt);
        }

        // -----------------------------
        // PLAYER CURSORS
        // -----------------------------

        this.p1Cursor = this.add.text(
            325,
            180,
            '⚔ P1',
            {
                fontFamily: 'GameFont',
                fontSize: '20px',
                fill: '#ff4444'
            }
        ).setOrigin(0.5);

        this.p2Cursor = this.add.text(
            675,
            270,
            '🪓 P2',
            {
                fontFamily: 'GameFont',
                fontSize: '20px',
                fill: '#00aaff'
            }
        ).setOrigin(0.5);

        //DESCRIPTIONS:
        const DESCBOX1 = this.add.rectangle(
            130,
            350,
            225,
            400,
            0x171717
        );
        const DESCBOX2 = this.add.rectangle(
            870,
            350,
            225,
            400,
            0x171717
        );
        this.p1NameText = this.add.text(130, 200, '', {
            fontFamily: 'GameFont',
            fontSize: '18px',
            fill: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        this.p1DescText = this.add.text(130, 350, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 200 }
        }).setOrigin(0.5);

        this.p2NameText = this.add.text(870, 200, '', {
            fontFamily: 'GameFont',
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.p2DescText = this.add.text(870, 350, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 200 }
        }).setOrigin(0.5);
        
        this.updateCharacterDescriptions = function() {
            const p1 = this.characterData[this.p1Index];
            const p2 = this.characterData[this.p2Index];

            this.p1NameText.setText(p1.name);
            this.p1NameText.setColor(p1.color);

            this.p1DescText.setText(p1.desc);

            this.p2NameText.setText(p2.name);
            this.p2NameText.setColor(p2.color);

            this.p2DescText.setText(p2.desc);
        };

        // -----------------------------
        // PLAY BUTTON
        // -----------------------------

        const playBox = this.add.rectangle(
            500,
            520,
            220,
            70,
            0x228B22
        );

        playBox.setStrokeStyle(4, 0xffffff);

        const playText = this.add.text(
            500,
            520,
            'PLAY',
            {
                fontFamily: 'GameFont',
                fontSize: '38px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        playBox.setInteractive({ useHandCursor: true });

        playBox.on('pointerover', () => {
            playBox.setFillStyle(0x2ecc71);
        });

        playBox.on('pointerout', () => {
            playBox.setFillStyle(0x228B22);
        });

        playBox.on('pointerdown', () => {

            this.scene.start('GameScene');
            player1Character = this.characters[this.p1Index];
            player2Character = this.characters[this.p2Index];

        });

        // -----------------------------
        // INPUT
        // -----------------------------

        this.keys = this.input.keyboard.addKeys({

            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,

            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN

        });

        this.updateCharacterDescriptions();
    },

    update: function () {

        // -----------------------------
        // P1 CONTROLS
        // -----------------------------

        if (Phaser.Input.Keyboard.JustDown(this.keys.w)) {
            this.sound.play('hover');
            this.p1Index--;

            if (this.p1Index < 0) {
                this.p1Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.s)) {
            this.sound.play('hover');

            this.p1Index++;

            if (this.p1Index >= this.characters.length) {
                this.p1Index = 0;
            }
            this.updateCharacterDescriptions();
        }

        // -----------------------------
        // P2 CONTROLS
        // -----------------------------

        if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
            this.sound.play('hover');
            this.p2Index--;

            if (this.p2Index < 0) {
                this.p2Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
            this.sound.play('hover');
            this.p2Index++;

            if (this.p2Index >= this.characters.length) {
                this.p2Index = 0;
            }
            this.updateCharacterDescriptions();
        }

        // -----------------------------
        // UPDATE CURSOR POSITIONS
        // -----------------------------

        this.p1Cursor.y = 180 + this.p1Index * 50;

        this.p2Cursor.y = 180 + this.p2Index * 50;
    }
};
var GameScene = {
    //gamescene in the form of a scene object format
    key: 'GameScene',
    preload: preload,
    create: create,
    update: update
};
var config = {
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
    scene: [MenuScene, CharacterSelectScene, GameScene]
};

var game;

loadFont().then(() => {
    game = new Phaser.Game(config);
});
function preload() {
    //pre load all the assets, including images, spritesheets, and audio
    //AUDIO CREDITS: 
    //sword lunge and slash is from the classic ROBLOX's linked sword sound effect
    //hit1.ogg is from minecraft's hit sound effect
    //Dodge3.wav is a dash sound effect from ULTRAKILL published by New Blood Interactive, used for the swordman's lunge move
    //snd_damage_c.wav is from Undertale by Toby Fox, used for the axe's third hit for that extra 
    //credits to jeffrey for making the app's icon (width_512.ico)
    this.load.image('background', 'assets/background_one.png');
    this.load.image('ground', 'assets/ground.png');
    this.load.image('betterground', 'assets/betterground.png');
    this.load.image('platform1', 'assets/platform1.png');
    this.load.image('platform', 'assets/platform.png');
    //chars
    this.load.image('axeman', 'assets/character1.png');
    this.load.image('swordman', 'assets/character2.png');
    this.load.image('fisherman', 'assets/character3.png');
    this.load.image('scytheman', 'assets/character4.png');
    this.load.image('hammerman', 'assets/character5.png');
    //other
    this.load.image('groundhitbox', 'assets/groundhitbox.png');
    this.load.image('redstat', 'assets/KBstatBG1.png');
    this.load.image('bluestat', 'assets/KBstatBG2.png');
    this.load.image('p1guide', 'assets/p1guide.png');
    this.load.image('p2guide', 'assets/p2guide.png');

    this.load.image('winbar', 'assets/WINbar.png');
    this.load.image('doublejump', 'assets/DoubleJump.png');
    this.load.image('restartBtn', 'assets/restartBtn.png');
    this.load.image('restartBtnPressed', 'assets/pressedRestart.png');
    this.load.image('hook', 'assets/hook.png');
    this.load.image('whitescythe', 'assets/whitescythe.png')
    this.load.image('slasheffect', 'assets/slasheffect.png')

    for (let i = 1; i < 5; i++) {
        this.load.image('countdown'+i, 'assets/countdown'+i+'.png')
    }

    this.load.spritesheet('axeatk', 'assets/axeatk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('swordatk', 'assets/swordatk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('swordatkthird', 'assets/swordatk2.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('axeatkthird', 'assets/axeatk2.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('rodatk', 'assets/rodatk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('scytheatk', 'assets/scytheatk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('hammeratk', 'assets/hammeratk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.audio('swordthirdhitsfx', 'audio/swordlunge.wav');
    this.load.audio('axethirdhitsfx', 'audio/snd_damage_c.wav');
    this.load.audio('rodthirdhitsfx', 'audio/whipcrack.wav')
    this.load.audio('scythethirdhitsfx', 'audio/scythethird.wav');
    this.load.audio('slash', 'audio/slash.ogg');
    this.load.audio('twirl', 'audio/Twirling.ogg')
    this.load.audio('anyhit', 'audio/hit1.ogg');
    this.load.audio('miss', 'audio/swordslash.wav');
    this.load.audio('lunge', 'audio/Dodge3.wav');
    this.load.audio('whoosh', 'audio/hookwhoosh.wav');
    this.load.audio('countdown', 'audio/countdown.wav');
    this.load.audio('hammerhit', 'audio/punch.wav');
    this.load.audio('repair', 'audio/Hitwrench.ogg');
    
}
//important game variables, including player objects, controls, and the platforms group
var platforms;
var topPlatforms;
var players;

var player;
var cursors;

var wasd;
var attackKey1;
var attackKey2;
var winNumber = 3; //number of rounds needed to win as of now
var lastWinState = {
    p1: 0,
    p2: 0
};
var gameEnded = false;
const xOff = 500;
const yOff = 300;


var winBar;
var restartBtn;
var restartBtnPressed;
function create() {
    gameEnded = false;
    gameEnded = false;
    winCooldown = false;

    lastWinState = {
        p1: 0,
        p2: 0
    };
    this.baseZoom = 1;
    this.hud = this.add.container(0, 0);
    this.objs = this.add.container(0,0);
    this.objcam = this.cameras.add(0,0,1000,600, false, "hudCam");
    platforms = this.physics.add.staticGroup();
    topPlatforms = this.physics.add.staticGroup();
    //Making the background, platforms, and the KB stat display
    const bg = this.add.image(1000, 600, 'background');
    bg.setDisplaySize(this.scale.width*2, this.scale.height*2);
    bg.setDepth(-1);
    this.objs.add(bg);

    winBar = this.add.image(500 , 300, 'winbar');
    winBar.setDisplaySize(this.scale.width, 150);
    winBar.setScale(1, 0);
    winBar.setVisible(false);
    winBar.setAlpha(0.85);
    this.hud.add(winBar);

    restartBtn = this.add.image(500,450, 'restartBtn');
    restartBtn.setScale(0.35);
    restartBtn.setVisible(false);
    this.hud.add(restartBtn);

    restartBtnPressed = this.add.image(500,450, 'restartBtnPressed');
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
            this.scene.restart();
        });
    });




    const plr1StatImage = this.add.image(300, 65, 'redstat');
    plr1StatImage.setScale(0.65);
    const plr2StatImage = this.add.image(700, 65, 'bluestat');
    plr2StatImage.setScale(0.65);
    this.hud.add(plr1StatImage);
    this.hud.add(plr2StatImage);

    const p1guide = this.add.image(450, 65, 'p1guide');
    p1guide.setAlpha(0.85);
    this.hud.add(p1guide);
    const p2guide = this.add.image(850, 65, 'p2guide');
    p2guide.setAlpha(0.85);
    this.hud.add(p2guide);

    const platform = this.add.image(xOff+ 725, yOff+425, 'platform1');
    platform.setScale(0.5);
    platform.setDepth(0);
    this.objs.add(platform);

    const secondplatform = this.add.image(xOff+ 275, yOff+425, 'platform');
    secondplatform.setScale(0.5);
    secondplatform.setDepth(0);
    this.objs.add(secondplatform);


    const groundVisual = this.add.image(xOff+ 500, yOff+1085, 'betterground');
    groundVisual.setDisplaySize(this.scale.width, 1200);
    this.objs.add(groundVisual);
    groundVisual.setDepth(1);

    // Invisible collision ground, the actual ground
    const ground = platforms.create(xOff+ 500, yOff+575, 'groundhitbox');
    ground.setDisplaySize(this.scale.width, 0);
    ground.setVisible(false);
    ground.refreshBody();
    this.objs.add(ground);

    const ground2 = topPlatforms.create(xOff+ 725, yOff+470, 'groundhitbox');
    ground2.setDisplaySize(this.scale.width / 2, 0);
    ground2.setVisible(true);
    ground2.refreshBody();
    this.objs.add(ground2);
    ground2.body.checkCollision.down = false

    const ground3 = topPlatforms.create(xOff+ 275, yOff+337, 'groundhitbox');
    ground3.setDisplaySize(this.scale.width / 2, 0);
    ground3.setVisible(true);
    ground3.refreshBody();
    this.objs.add(ground2);
    ground3.body.checkCollision.down = false


    //platform.refreshBody();
    this.anims.create({
        key: 'axeatk',
        frames: this.anims.generateFrameNumbers('axeatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });

    this.anims.create({
        key: 'swordatk',
        frames: this.anims.generateFrameNumbers('swordatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'swordatkthird',
        frames: this.anims.generateFrameNumbers('swordatkthird', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'axeatkthird',
        frames: this.anims.generateFrameNumbers('axeatkthird', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'rodatk',
        frames: this.anims.generateFrameNumbers('rodatk', { start: 0, end: 3 }),
        frameRate: 28,
        repeat: 0
    });
    this.anims.create({
        key: 'scytheatk',
        frames: this.anims.generateFrameNumbers('scytheatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'hammeratk',
        frames: this.anims.generateFrameNumbers('hammeratk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });

    //---PLAYER---\\
    players = initiatePlayers(this, player1Character, player2Character);

    //a bit of cam intiation:
    this.physics.world.setBounds(0, 0, 2000, 1200);
    this.cameras.main.setBounds(0, 0, 2000, 1200);
    this.cameras.main.ignore(this.hud);
    this.objcam.ignore(this.objs);


    for (const key in players) {
        const player = players[key];
        this.physics.add.collider(player, platforms);
        this.physics.add.collider(player, topPlatforms);
    }

    const keys = Object.keys(players);

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const playerA = players[keys[i]];
            const playerB = players[keys[j]];
            this.physics.add.collider(playerA, playerB);
        }
    }

    //load icons for the KB stat display
    const plr1Icon = this.add.image(250, 65, players.player.icon);
    const plr2Icon = this.add.image(650, 65, players.player2.icon);
    this.hud.add(plr1Icon);
    this.hud.add(plr2Icon);

    const plr1NameText = this.add.text(280, 47, players.player.name, { fontFamily: 'GameFont', fontSize: '10px', fill: '#FFFFFF' });
    const plr2NameText = this.add.text(680, 47, players.player2.name, { fontFamily: 'GameFont', fontSize: '10px', fill: '#FFFFFF' });
    plr1NameText.setStroke('#000000', 3);
    plr2NameText.setStroke('#000000', 3);
    this.hud.add(plr1NameText);
    this.hud.add(plr2NameText);
    players.player.KBText = this.add.text(285, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '14px', fill: '#FFFFFF' });
    players.player2.KBText = this.add.text(685, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '14px', fill: '#FFFFFF' });
    players.player.KBText.setStroke('#000000', 3);
    players.player2.KBText.setStroke('#000000', 3);
    this.hud.add(players.player2.KBText);
    this.hud.add(players.player.KBText);
    

    //---CONTROLS---\\
    //Allows holding for the keys too. Later this will be revamped to allow charge attacks
    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });

    //3-2-1 COUNTDOWN

    players.player.freeze = true;
    players.player.hitstun = true;
    players.player2.freeze = true;
    players.player2.hitstun = true;

    

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
                    players.player.freeze = false;
                    players.player2.freeze = false;
                    players.player.hitstun = false;
                    players.player2.hitstun = false;

                });   
            });   
        });    
    });    


}
function updateWins(scene) {
    if (players.player.winNumber !== lastWinState.p1 || players.player2.winNumber !== lastWinState.p2) {
        console.log("update!")
        lastWinState.p1 = players.player.winNumber;
        lastWinState.p2 = players.player2.winNumber;

        winBar.setVisible(true);
        if (players.player.winNumber >= 3 || players.player2.winNumber >= 3) {
            winBar.setVisible(false);
        }
        scene.tweens.add({
            targets: winBar,
            scaleY: 1, // from 0 → full height
            duration: 300,
            ease: 'Cubic.easeOut'
        });
        scene.time.delayedCall(1000, () => {
            players.player.winText.setVisible(false);
            players.player2.winText.setVisible(false);
            scene.tweens.add({
                targets: winBar,
                scaleY: 0, // from 0 → full height
                duration: 300,
                ease: 'Cubic.easeOut'
            });
        });

        players.player.winText.setText(players.player.winNumber);
        players.player2.winText.setText(players.player2.winNumber);
        players.player.winText.setVisible(true);
        players.player2.winText.setVisible(true);
        if (players.player.winNumber >= 3 || players.player2.winNumber >= 3) {
            players.player.winText.setVisible(false);
            players.player2.winText.setVisible(false);
        }

    }

}
function teleportBackToArena(player) {
    player.setPosition(1000, 0);
    player.setVelocityY(0);
    player.setVelocityX(0);
}
const accelFactor = 20;
var winCooldown = false;

const baseZoom = 1;
const minZoom = 0.6;
const maxZoom = 1.4;

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
function update() {

    if (gameEnded) {
        players.player.setVelocity(0, 0);
        players.player2.setVelocity(0, 0);
        return;
    }

    const p1 = players.player;
    const p2 = players.player2;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // distance between players
    const distX = Math.abs(p1.x - p2.x);
    const distY = Math.abs(p1.y - p2.y);

    const distance = Math.max(distX, distY);

    let zoom = this.baseZoom - (distance / 2000);

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


    if (attackKey1.isDown && !players.player.hitstun) {
        handleAttack(this, players.player, players.player2);
    }
    if (attackKey2.isDown && !players.player2.hitstun) {
        handleAttack(this, players.player2, players.player);
    }
    players.player.outOfBounds = players.player.y > 1600 || players.player.x < -400 || players.player.x > 2400 || players.player.y < 0;
    players.player2.outOfBounds = players.player2.y > 1600 || players.player2.x < -400 || players.player2.x > 2400 || players.player2.y < 0;

    for (const key in players) {
        const player = players[key];

        if (player.body.touching.down) {
            player.airTime = 0;
        } else {
            player.airTime += this.game.loop.delta;
        }
    };
    const cal1 = ((players.player.KBmultiplier * 100) - 100);
    const cal2 = ((players.player2.KBmultiplier * 100) - 100);
    players.player.KBText.setText(`KB: ${cal1.toFixed(1)}%`);
    players.player2.KBText.setText(`KB: ${cal2.toFixed(1)}%`);
    updateCombo(players.player, this.game.loop.delta);
    updateCombo(players.player2, this.game.loop.delta);
    if (wasd.left.isDown) players.player.lastDir = { x: -1, y: 0 };
    else if (wasd.right.isDown) players.player.lastDir = { x: 1, y: 0 };
    else if (wasd.up.isDown) players.player.lastDir = { x: 0, y: -1 };
    else if (wasd.down.isDown) players.player.lastDir = { x: 0, y: 1 };

    // PLAYER 2 (arrows)
    if (cursors.left.isDown) players.player2.lastDir = { x: -1, y: 0 };
    else if (cursors.right.isDown) players.player2.lastDir = { x: 1, y: 0 };
    else if (cursors.up.isDown) players.player2.lastDir = { x: 0, y: -1 };
    else if (cursors.down.isDown) players.player2.lastDir = { x: 0, y: 1 };
    function decelerateAll() {
        for (const key in players) {
            const player = players[key];
            let vx = player.body.velocity.x;

            if (Math.abs(vx) > 10) {
                player.setVelocityX(vx * 0.9);
            } else {
                player.setVelocityX(0);
            }
        }
    }
    function decelerate(player) {
        if (player.isUsingSideSpecial) return;
        let vx = player.body.velocity.x;

        if (Math.abs(vx) > 10) {
            player.setVelocityX(vx * 0.9);
        } else {
            player.setVelocityX(0);
        }
    }
    players.player.atk.x = players.player.x + (players.player.lastDir.x * 50);
    players.player.atk.y = players.player.y + (players.player.lastDir.y * 50);

    players.player2.atk.x = players.player2.x + (players.player2.lastDir.x * 50);
    players.player2.atk.y = players.player2.y + (players.player2.lastDir.y * 50);

    players.player.doubleJumpEffect.x = players.player.x;
    players.player.doubleJumpEffect.y = players.player.y + 40;

    players.player2.doubleJumpEffect.x = players.player2.x;
    players.player2.doubleJumpEffect.y = players.player2.y + 40;

    players.player.header.x = players.player.x - 10;
    players.player.header.y = players.player.y - 50;

    players.player2.header.x = players.player2.x - 10;
    players.player2.header.y = players.player2.y - 50;

    if (players.player.KBmultiplier < 0.9) {
        players.player.KBmultiplier = 0.90;
    }
    if (players.player2.KBmultiplier < 0.9) {
        players.player2.KBmultiplier = 0.9;
    }
    if (players.player.KBmultiplier < 1) {
        players.player.KBText.setColor("#ff0000");
    } else {
        players.player.KBText.setColor("#ffffff");
    }
    if (players.player2.KBmultiplier < 1) {
        players.player2.KBText.setColor("#ff0000");
    } else {
        players.player2.KBText.setColor("#ffffff");
    }

    if (players.player.afterimage) {
        if (this.time.now > players.player.afterimageTimer) {

            spawnAfterimage(this, players.player);

            players.player.afterimageTimer = this.time.now + 40;
        }
    } 
    if (players.player2.afterimage) {
        if (this.time.now > players.player2.afterimageTimer) {
            spawnAfterimage(this, players.player2);

            players.player2.afterimageTimer = this.time.now + 40;
        }
    }

    if (!players.player.hitstun) {
        if (Phaser.Input.Keyboard.JustDown(wasd.left)) {
            handleDirSpecial(this, players.player, 'left', this.time.now,players.player2);
        }
        if (Phaser.Input.Keyboard.JustDown(wasd.right)) {
            handleDirSpecial(this, players.player, 'right', this.time.now,players.player2);
        }
        if (!players.player.hasHitSideSpecial && players.player.isUsingSideSpecial) {
            handleDirSpecialAttack(this, players.player, players.player2);
        }
        if (wasd.left.isDown) {
            if (!players.player.isUsingSideSpecial) {
                players.player.setVelocityX(Phaser.Math.Clamp(players.player.body.velocity.x - accelFactor, -250, 250));
            }
        } else if (wasd.right.isDown) {
            if (!players.player.isUsingSideSpecial) {
                players.player.setVelocityX(Phaser.Math.Clamp(players.player.body.velocity.x + accelFactor, -250, 250));
            }
        } else {
            if (players.player.willDecelerate) {
                decelerate(players.player);
            }
        }
        if (wasd.up.isDown && players.player.body.touching.down) {
            players.player.setVelocityY(-400);
        }
        if (players.player.body.blocked.down) {
            players.player.hasDoubleJumped = false;
        }
        if (players.player.body.blocked.down &&  players.player.isUsingSideSpecial === false) {
            players.player.afterimage = false;
        }
        if (Phaser.Input.Keyboard.JustDown(wasd.up) && !players.player.body.touching.down && !players.player.hasDoubleJumped) {
            players.player.setVelocityY(-400);
            players.player.doubleJumpEffect.setAlpha(1);
            players.player.hasDoubleJumped = true;
            this.tweens.add({targets: players.player.doubleJumpEffect,alpha: 0,duration: 200,ease: 'Cubic.easeOut'});
        }
        if (wasd.up.isUp && players.player.body.velocity.y < 0) {
            players.player.setVelocityY(players.player.body.velocity.y / 2);
        }
        if (wasd.down.isDown && players.player.airTime > 600) {
            players.player.setVelocityY(800);
            players.player.afterimage = true;
        }
    }


    if (!players.player2.hitstun) {

        //Player 2 controls
        if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
            handleDirSpecial(this, players.player2, 'left', this.time.now,players.player);
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
            //tryLunge(this, players.player2, 'right', this.time.now);
            handleDirSpecial(this, players.player2, 'right', this.time.now,players.player);
        }
        if (!players.player2.hasHitSideSpecial && players.player2.isUsingSideSpecial) {
            handleDirSpecialAttack(this, players.player2, players.player);
        }
        if (cursors.left.isDown) {
            if (!players.player2.isUsingSideSpecial) {
                players.player2.setVelocityX(Phaser.Math.Clamp(players.player2.body.velocity.x - accelFactor, -250, 250));
            }
        }
        else if (cursors.right.isDown) {
            if (!players.player2.isUsingSideSpecial) {
                players.player2.setVelocityX(Phaser.Math.Clamp(players.player2.body.velocity.x + accelFactor, -250, 250));
            }
        }
        else {
            if (players.player2.willDecelerate) {
                decelerate(players.player2);
            }
        }
        if (cursors.up.isDown && players.player2.body.touching.down) {
            players.player2.setVelocityY(-400);
        }
        if (players.player2.body.touching.down) {
            players.player2.hasDoubleJumped = false;
        }
        if (players.player2.body.blocked.down &&  players.player2.isUsingSideSpecial === false) {
            players.player2.afterimage = false;
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.up) && !players.player2.body.touching.down && !players.player2.hasDoubleJumped) {
            players.player2.setVelocityY(-400);
            players.player2.doubleJumpEffect.setAlpha(1);
            players.player2.hasDoubleJumped = true;
            this.tweens.add({
                targets: players.player2.doubleJumpEffect,
                alpha: 0,
                duration: 300,
                ease: 'Cubic.easeOut'
            });
        }
        if (cursors.up.isUp && players.player2.body.velocity.y < 0) {
            players.player2.setVelocityY(players.player2.body.velocity.y / 2);
        }
        if (cursors.down.isDown && players.player2.airTime > 600) {
            players.player2.afterimage = true;
            players.player2.setVelocityY(800);
        }
    }
    //PRIORITY
    if (players.player.freeze) {
        players.player.setVelocityX(0);
        players.player.setVelocityY(0);
    }
    if (players.player2.freeze) {
        players.player2.setVelocityX(0);
        players.player2.setVelocityY(0);
    }

    //WIN CONDITION -- DETECT IF PLAYER IS LAUNCHED FAR OFF SCREEN

    if (!gameEnded && !winCooldown) {

        if (players.player.outOfBounds) {
            winCooldown = true;
            players.player2.winNumber = players.player2.winNumber + 1;
            console.log(players.player2.winNumber)
            updateWins(this);
            teleportBackToArena(players.player);
            
            this.time.delayedCall(1500, () => {
                winCooldown = false;
            });
        } else if (players.player2.outOfBounds) {
            winCooldown = true;
            players.player.winNumber = players.player.winNumber + 1;
            updateWins(this);
            teleportBackToArena(players.player2);
            
            this.time.delayedCall(1500, () => {
                winCooldown = false;
            });
        }

        if (players.player.winNumber >= winNumber || players.player2.winNumber >= winNumber) {
            if (players.player.outOfBounds) {
                gameEnded = true;
                const winner = this.add.text(500, 300, players.player2.name + ' ( P1 )  WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#00008B' }).setOrigin(0.5).setStroke('#ffffff', 5);
                this.hud.add(winner);
            } else if (players.player2.outOfBounds) {
                gameEnded = true;
                const winner = this.add.text(500, 300, players.player.name + ' ( P2 )  WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#8B0000' }).setOrigin(0.5).setStroke('#ffffff', 5);
                this.hud.add(winner);
            }
            restartBtn.setVisible(true);
        }
    }
}
