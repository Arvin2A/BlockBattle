import {handleAttack, handleDirSpecial, handleDirSpecialAttack, handleHorizantalTilt, handleDownTilt, handleUpTilt} from './attacks.js';
import { initiatePlayers, updateCombo } from './players.js';
//UPDATE: HUGE REFACTOR OF CODE!! THIS IS FOR CLEANLINESS AND FOR THE FURTHER DEVELOPMENT OF THIS WEB APP
//3 NEW SCRIPTS: main.js (current), players.js, attacks.js


//TESTER CREDITS:
//w testers for this game, including several students in my grade
//The most impactful testers I'd wish to mention are:
//Aidan Z, Deyu Z, Luke Ch, Augustus L, Jaylen L, Presley F, Giovanni M, Jeffrey C, Kenneth L, Abrar A , Mr. Primm
//While they might have told others about the game, those are who I know about who have played and tested the game
//Not only did they play the game, but I was also able to work up to some of their suggestions.
//The ones impactful are the ones I've also observed mistakes in the game from, whether stating it to me or watching them play, so I can add fixes to the code

// This is a 2D platform fighter game made using Phaser and Javascript. Requires a keyboard to play
//ENTIRE script is made by zamanarvin. Some assets were made by Jeffrey C, others by me 
//NOTE: mohsina007 and arvin2a are the same person
// its just that mohsina007 is the account that was hard-set as the account for VSCode, the application I used to make this game.
// and the sound effects were taken from various games as listed in the preload function.
//WASD controls the first player , arrow keys control the second player.
//E is the player1 attack, SHIFT is the player2 attack.
//You can double tap each player's corresponding side buttons (A + D), or (LEFT ARROW + RIGHT ARROW KEY) to do a special attack.
//NEW UPDATE - LIGHT ATTACKS: Press a movement key, then quickly press the attack key to do a light attack. This can be helpful for comboing

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
            400,
            70,
            0x228B22
        );
        startBox.setStrokeStyle(3, 0x154a17);

        var startText = this.add.text(500, 500, 'Start Game', { fontFamily: 'GameFont', fontSize: '28px', fill: '#FFFFFF', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
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
        this.load.audio('hover', 'audio/hover.wav');
        this.load.image('arenapreview', 'assets/arenapreview.png');
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
            'hammerman',
            'slateman'
        ];

        this.characterData = [
            { name: 'SWORDMAN', desc: 'Beware of the slashing sword. \n\nDIR SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential.', color: '#0080ff' },
            { name: 'AXEMAN', desc: 'Beware of the chopping axe. \n\nDIR SPECIAL: POWER SWING \n\n The most knockback you can ever do in this entire game, send your foes across the galaxy!', color: '#ff4444' },
            { name: 'FISHERMAN', desc: 'Using a fishing rod as a whip?? \n\nDIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in.', color: '#00318d' },
            { name: 'SCYTHEMAN', desc: 'Its third neutral hit goes slightly higher. \n\nDIR SPECIAL: MOW \n\n Throw a scythe t like a boomerang that deals crazy damage.', color: '#686868' },
            { name: 'HAMMERMAN', desc: 'EVERY hit is a knockback attack. \n\nDIR SPECIAL: SIPHONING REPAIR \n\n Let out a flurry of 3 strikes that siphon KB from your foe!.', color: '#3da115' },
            { name: 'SLATEMAN', desc: 'Start with extra resistance to attacks. The more damage you take the faster you get, but deal less damage. \n\nDIR SPECIAL: PLUNGE \n\n Apply PLUNGED to your opponent, which makes the foe take 100% more knockback for the next hits within 2.5 seconds!', color: '#ffffff', fontSize: 17}

        ];

        this.p1Index = 1;
        this.p2Index = 0;

        // background
        this.cameras.main.setBackgroundColor('#1b1b1b');

        this.add.image(500, 300, 'arenapreview');
        const overlay = this.add.rectangle(
            500,
            300,
            1000,
            600,
            0x1b1b1b,
            0.90
        );

        // -----------------------------
        // TITLE
        // -----------------------------

        this.add.text(
            500,
            50,
            'SELECT YOUR CHARACTER',
            {
                fontFamily: 'VCROSD',
                fontSize: '35px',
                fill: '#f691ff',
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
            if (p1.fontSize) {
                this.p1DescText.setFontSize(p1.fontSize);
            } else {
                this.p1DescText.setFontSize(20);
            }

            this.p2NameText.setText(p2.name);
            this.p2NameText.setColor(p2.color);

            this.p2DescText.setText(p2.desc);
            if (p2.fontSize) {
                this.p2DescText.setFontSize(p2.fontSize);
            } else {
                this.p2DescText.setFontSize(20);
            }
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
            this.cameras.main.fadeOut(200, 0, 0, 0);
            this.time.delayedCall(200, () => {
                this.scene.start('GameScene');
            });
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


        this.input.on('pointerdown', (pointer) => {
            // Ignore clicks on the PLAY button area
            if (
                pointer.x >= 390 &&
                pointer.x <= 610 &&
                pointer.y >= 485 &&
                pointer.y <= 555
            ) {
                return;
            }

            // Character list starts at y=180 and each row is 50px apart
            const index = Math.round((pointer.y - 180) / 50);

            if (index < 0 || index >= this.characters.length) {
                return;
            }

            this.sound.play('hover');

            if (pointer.x < 500) {
                // P1 selection
                this.p1Index = index;
            } else {
                // P2 selection
                this.p2Index = index;
            }

            this.updateCharacterDescriptions();
        });
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
    //chars - SLATEMAN + PHASES
    this.load.image('slateman', 'assets/slateman1.png');
    this.load.image('slatemanphase1', 'assets/slateman2.png');
    this.load.image('slatemanphase2', 'assets/slateman3.png');
    this.load.image('slatemanphase3', 'assets/slateman4.png');
    
    //other
    this.load.image('groundhitbox', 'assets/groundhitbox.png');
    this.load.image('thickgroundhitbox', 'assets/groundhitbox2.png');
    this.load.image('redstat', 'assets/KBstatBG1.png');
    this.load.image('bluestat', 'assets/KBstatBG2.png');
    this.load.image('p1guide', 'assets/p1guide.png');
    this.load.image('p2guide', 'assets/p2guide.png');

    this.load.image('winbar', 'assets/WINbar.png');
    this.load.image('doublejump', 'assets/DoubleJump.png');
    this.load.image('restartBtn', 'assets/restartBtn.png');
    this.load.image('restartBtnPressed', 'assets/pressedRestart.png');
    this.load.image('hook', 'assets/hook.png');
    this.load.image('whitescythe', 'assets/whitescythe.png');
    this.load.image('slasheffect', 'assets/slasheffect.png');
    this.load.image('plungedAura', 'assets/plungedAura.png');

    for (let i = 1; i < 5; i++) {
        this.load.image('countdown'+i, 'assets/countdown'+i+'.png')
    }

    //attacks
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
    this.load.spritesheet('swordatktilt', 'assets/swordatk3.png', {
        frameWidth: 75,
        frameHeight: 75
    });
    this.load.spritesheet('axeatktilt', 'assets/axetilt.png', {
        frameWidth: 75,
        frameHeight: 75
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
    this.load.spritesheet('scytheatktilt', 'assets/scythelightatk.png', {
        frameWidth: 75,
        frameHeight: 75
    });
    this.load.spritesheet('hammeratk', 'assets/hammeratk1.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('slateatk', 'assets/slateatk.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('slateatkthird', 'assets/slateatkthird.png', {
        frameWidth: 50,
        frameHeight: 50
    });
    this.load.spritesheet('slateatktilt', 'assets/slateatktilt.png', {
        frameWidth: 75,
        frameHeight: 75
    });
    this.load.spritesheet('slateplunge', 'assets/slateplunge.png', {
        frameWidth: 100,
        frameHeight: 50
    });

    //misc
    this.load.spritesheet('upbambooGrow', 'assets/upBamboo.png', {
        frameWidth: 50,
        frameHeight: 50
    });

    //AUDIO
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
    this.load.audio('bamboo', 'audio/snd_spearrise.wav');
    this.load.audio('swosh', 'audio/swosh.wav');
    this.load.audio('plunge', 'audio/plunge.ogg');  
    this.load.audio('slatepunch', 'audio/slatepunch.wav');
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
        attack: false
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
        attack: false
    }
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
    this.input.addPointer(5);
    this.baseZoom = 1;
    this.hud = this.add.container(0, 0);
    this.objs = this.add.container(0,0);
    this.objcam = this.cameras.add(0,0,1000,600, false, "hudCam");
    this.mobileButtons = {
        p1: [],
        p2: []
    }
    platforms = this.physics.add.staticGroup();
    topPlatforms = this.physics.add.staticGroup();
    //Making the background, platforms, and the KB stat display
    const bg = this.add.image(1000, 600, 'background');
    bg.setDisplaySize(this.scale.width*2, this.scale.height*2);
    bg.setDepth(-1);
    this.objs.add(bg);
    this.cameras.main.fadeIn(500, 0, 0, 0);

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
    p1guide.setAlpha(0.65);
    this.hud.add(p1guide);
    const p2guide = this.add.image(850, 65, 'p2guide');
    p2guide.setAlpha(0.65);
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
    const ground = platforms.create(xOff+ 500, yOff+575, 'thickgroundhitbox');
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

    //attacks
    this.anims.create({
        key: 'axeatk',
        frames: this.anims.generateFrameNumbers('axeatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'axeatktilt',
        frames: this.anims.generateFrameNumbers('axeatktilt', { start: 0, end: 3 }),
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
        key: 'swordatktilt',
        frames: this.anims.generateFrameNumbers('swordatktilt', { start: 0, end: 3 }),
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
        key: 'scytheatktilt',
        frames: this.anims.generateFrameNumbers('scytheatktilt', { start: 0, end: 4 }),
        frameRate: 48,
        repeat: 0
    });
    this.anims.create({
        key: 'hammeratk',
        frames: this.anims.generateFrameNumbers('hammeratk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'slateatk',
        frames: this.anims.generateFrameNumbers('slateatk', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'slateatktilt',
        frames: this.anims.generateFrameNumbers('slateatktilt', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'slateatkthird',
        frames: this.anims.generateFrameNumbers('slateatkthird', { start: 0, end: 3 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'slateplunge',
        frames: this.anims.generateFrameNumbers('slateplunge', { start: 0, end: 10 }),
        frameRate: 24,
        repeat: 0
    });

    //misc
    this.anims.create({
        key: 'upbambooGrow',
        frames: this.anims.generateFrameNumbers('upbambooGrow', { start: 0, end: 3 }),
        frameRate: 18,
        repeat: 0
    });




    //mobile support:
    const isMobile = this.sys.game.device.input.touch;

    if (true) {

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
            this.mobileButtons.p2.push(butn);
        });

    }

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
function updateKB(scene) {
    for (const key in players) {
        const player = players[key];
        const spawnBox = () => {
            const box = scene.add.rectangle(
                player.x,
                player.y,
                50,
                50,
                0xffbf00
            );
            scene.objs.add(box);
            scene.tweens.add({
                targets: box,
                alpha: 0,
                duration: 100,
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

        if (player.lastKBmultiplier !== player.KBmultiplier) {
            // KB multiplier changed

            if (player.name === "SLATEMAN") {
                if (player.KBmultiplier < 1.50) player.setTexture('slateman');
                if (player.KBmultiplier >= 1.50) player.setTexture('slatemanphase1');
                if (player.KBmultiplier >= 2.00) player.setTexture('slatemanphase2');
                if (player.KBmultiplier >= 2.50) player.setTexture('slatemanphase3');

                player.movementSpeed = 250 + ((player.KBmultiplier - 1) * 150);

                player.baseDamageScale =
                    1 - ((player.KBmultiplier - 1) * 0.35);

                player.baseDamageScale =
                    Math.max(0.1, player.baseDamageScale);
            }
        }
        player.plungeAura.x = player.x;
        player.plungeAura.y = player.y;
        player.lastKBmultiplier = player.KBmultiplier;
        if (scene.time.now > player.nextSideSpecialTime && scene.time.now - player.nextSideSpeciaTime < 100) {
            spawnBox();
        }
    }
}
function update() {

    

    const p1 = players.player;
    const p2 = players.player2;

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

    // distance between players
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

    if (gameEnded) {
        p1.setVelocity(0, 0);
        p2.setVelocity(0, 0);
        return;
    }
    
    if ((attackKey1.isDown || mobileControls.p1.attack) && !p1.hitstun) {
        const now = this.time.now;
        if (inputMode.p1 !== "keyboard" && !mobileControls.p1.attack) {
            this.mobileButtons.p1.forEach(obj => {
                obj.setAlpha(0.25);
            });
        }        
        if (now - p1.lastInput.up < tiltThreshold) {
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
    if ((attackKey2.isDown || mobileControls.p2.attack) && !p2.hitstun) {
        const now = this.time.now;
        if (inputMode.p2 !== "keyboard" && !mobileControls.p2.attack) {
            this.mobileButtons.p2.forEach(obj => {
                obj.setAlpha(0.25);
            });
        }
        if (now - p2.lastInput.up < tiltThreshold) {
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

    for (const key in players) {
        const player = players[key];

        if (player.body.touching.down) {
            player.airTime = 0;
        } else {
            player.airTime += this.game.loop.delta;
        }
        player.flashObject.setPosition(player.x, player.y);
    };
    const cal1 = ((p1.KBmultiplier * 100) - 100);
    const cal2 = ((p2.KBmultiplier * 100) - 100);
    p1.KBText.setText(`KB: ${cal1.toFixed(1)}%`);
    p2.KBText.setText(`KB: ${cal2.toFixed(1)}%`);
    updateCombo(p1, this.game.loop.delta);
    updateCombo(p2, this.game.loop.delta);
    if (wasd.left.isDown || mobileControls.p1.left) p1.lastDir = { x: -1, y: 0 };
    else if (wasd.right.isDown || mobileControls.p1.right) p1.lastDir = { x: 1, y: 0 };
    else if (wasd.up.isDown || mobileControls.p1.up) p1.lastDir = { x: 0, y: -1 };
    else if (wasd.down.isDown || mobileControls.p1.down) p1.lastDir = { x: 0, y: 1 };


    // PLAYER 2 (arrows)
    if (cursors.left.isDown || mobileControls.p2.left) p2.lastDir = { x: -1, y: 0 };
    else if (cursors.right.isDown || mobileControls.p2.right) p2.lastDir = { x: 1, y: 0 };
    else if (cursors.up.isDown || mobileControls.p2.up) p2.lastDir = { x: 0, y: -1 };
    else if (cursors.down.isDown || mobileControls.p2.down) p2.lastDir = { x: 0, y: 1 };

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
    p1.atk.x = p1.x + (p1.lastDir.x * 50);
    p1.atk.y = p1.y + (p1.lastDir.y * 50);

    p2.atk.x = p2.x + (p2.lastDir.x * 50);
    p2.atk.y = p2.y + (p2.lastDir.y * 50);

    p1.doubleJumpEffect.x = p1.x;
    p1.doubleJumpEffect.y = p1.y + 40;

    p2.doubleJumpEffect.x = p2.x;
    p2.doubleJumpEffect.y = p2.y + 40;

    p1.header.x = p1.x - 10;
    p1.header.y = p1.y - 50;

    p2.header.x = p2.x - 10;
    p2.header.y = p2.y - 50;

    if (p1.KBmultiplier < 0.7) {
        p1.KBmultiplier = 0.70;
    }
    if (p2.KBmultiplier < 0.7) {
        p2.KBmultiplier = 0.70;
    }
    if (p1.KBmultiplier < 1) {
        p1.KBText.setColor("#ff0000");
    } else {
        p1.KBText.setColor("#ffffff");
    }
    if (p2.KBmultiplier < 1) {
        p2.KBText.setColor("#ff0000");
    } else {
        p2.KBText.setColor("#ffffff");
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
        if (!p1.hasHitSideSpecial && p1.isUsingSideSpecial) {
            handleDirSpecialAttack(this, p1, p2);
        }
        if (wasd.left.isDown || mobileControls.p1.left) {
            if (!p1.isUsingSideSpecial) {
                p1.setVelocityX(Phaser.Math.Clamp(p1.body.velocity.x - accelFactor, -p1.movementSpeed, p1.movementSpeed));
            }
        } else if (wasd.right.isDown || mobileControls.p1.right) {
            if (!p1.isUsingSideSpecial) {
                p1.setVelocityX(Phaser.Math.Clamp(p1.body.velocity.x + accelFactor, -p1.movementSpeed, p1.movementSpeed));
            }
        } else {
            if (p1.willDecelerate) {
                decelerate(p1);
            }
        }
        if ((wasd.up.isDown || mobileControls.p1.up) && p1.body.touching.down) {
            p1.setVelocityY(-400);
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
            if (!p1.body.touching.down && !p1.hasDoubleJumped) {
                p1.setVelocityY(-400);
                p1.doubleJumpEffect.setAlpha(1);
                p1.hasDoubleJumped = true;
                this.tweens.add({targets: p1.doubleJumpEffect,alpha: 0,duration: 200,ease: 'Cubic.easeOut'});
                
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

        if (jumpReleased && p1.body.velocity.y < 0) {
            p1.setVelocityY(p1.body.velocity.y / 2);
        }

        if ((wasd.down.isDown || mobileControls.p1.down) && p1.airTime > 600) {
            p1.setVelocityY(800);
            p1.afterimage = true;
        }

    }


    if (!p2.hitstun) {

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

        if (!p2.hasHitSideSpecial && p2.isUsingSideSpecial) {
            handleDirSpecialAttack(this, p2, p1);
        }

        if (cursors.left.isDown || mobileControls.p2.left) {
            if (!p2.isUsingSideSpecial) {
                p2.setVelocityX(
                    Phaser.Math.Clamp(p2.body.velocity.x - accelFactor, -p2.movementSpeed, p2.movementSpeed)
                );
            }
        }
        else if (cursors.right.isDown || mobileControls.p2.right) {
            if (!p2.isUsingSideSpecial) {
                p2.setVelocityX(
                    Phaser.Math.Clamp(p2.body.velocity.x + accelFactor, -p2.movementSpeed, p2.movementSpeed)
                );
            }
        }
        else {
            if (p2.willDecelerate) {
                decelerate(p2);
            }
        }

        if ((cursors.up.isDown || mobileControls.p2.up) && p2.body.touching.down) {
            p2.setVelocityY(-400);
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
            if (!p2.body.touching.down && !p2.hasDoubleJumped) {
                p2.setVelocityY(-400);
                p2.doubleJumpEffect.setAlpha(1);
                p2.hasDoubleJumped = true;

                this.tweens.add({
                    targets: p2.doubleJumpEffect,
                    alpha: 0,
                    duration: 300,
                    ease: 'Cubic.easeOut'
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

        if (jumpReleased2 && p2.body.velocity.y < 0) {
            p2.setVelocityY(p2.body.velocity.y / 2);
        }
        if ((cursors.down.isDown || mobileControls.p2.down) && p2.airTime > 600) {
            p2.afterimage = true;
            p2.setVelocityY(800);
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
    if (p1.freeze) {
        p1.setVelocityX(0);
        p1.setVelocityY(0);
    }
    if (p2.freeze) {
        p2.setVelocityX(0);
        p2.setVelocityY(0);
    }

    //WIN CONDITION -- DETECT IF PLAYER IS LAUNCHED FAR OFF SCREEN

    if (!gameEnded && !winCooldown) {

        if (p1.outOfBounds) {
            winCooldown = true;
            p2.winNumber = p2.winNumber + 1;
            p1.KBmultiplier = 1.00;
            console.log(p2.winNumber)
            updateWins(this);
            teleportBackToArena(p1);
            
            this.time.delayedCall(1500, () => {
                winCooldown = false;
            });
        } else if (p2.outOfBounds) {
            winCooldown = true;
            p1.winNumber = p1.winNumber + 1;
            p2.KBmultiplier = 1.00;
            updateWins(this);
            teleportBackToArena(p2);
            
            this.time.delayedCall(1500, () => {
                winCooldown = false;
            });
        }

        if (p1.winNumber >= winNumber || p2.winNumber >= winNumber) {
            if (p1.outOfBounds) {
                gameEnded = true;
                const winner = this.add.text(500, 150, p2.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#00008B' }).setOrigin(0.5).setStroke('#000000', 5);
                this.hud.add(winner);
            } else if (p2.outOfBounds) {
                gameEnded = true;
                const winner = this.add.text(500, 150, p1.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#8B0000' }).setOrigin(0.5).setStroke('#000000', 5);
                this.hud.add(winner);
            }
            restartBtn.setVisible(true);
        }
    }
    updateKB(this);
}
