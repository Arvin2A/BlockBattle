import { attack, pushAttack, thirdAttack, superSwing, tryAttack, attackIsElligible, tryLunge, tryCleave } from './attacks.js';
import { initiatePlayers, updateCombo } from './players.js';
//UPDATE: HUGE REFACTOR OF CODE!! THIS IS FOR CLEANLINESS AND FOR THE FURTHER DEVELOPMENT OF THIS WEB APP
//3 NEW SCRIPTS: main.js (current), players.js, attacks.js

//FUTURE UPDATES: More controls to the game. Working on blocking attacks and parrying.

//BALANCE CHANGES: 
// 1. Charging towards the opponent as fast as possible will perform a PUSH attack.
//    This is to kinda discourage spamming and rather strategy
// 2. Axe cleave: Bigger range, was near impossible to land and wasn't worth it.
// 3. Sword lunge: Can now deal damage, isn't just a mobility tool.
// 4. DOUBLE JUMP: Both players can perform a double jump, adding more maneuverability to the game.

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
//WASD controls the red axeman, arrow keys contrl the blue swordman.
//E is the axe attack, SHIFT is the sword attack.
//The swordman also has a lunge move that can be performed by double tapping left or right.
//I believe comments are necessary for this not only to explain the code but also to show my thought process and design decisions
// they are a big part of game development, and it shows my credibility for this.
// Phaser was definetely hard to learn in the span of a few days because of its really big documentary and complex object structures.

//We will still continue to work on this project, its really fun.
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
        var startText = this.add.text(500, 500, 'Start Game', { fontFamily: 'GameFont', fontSize: '32px', fill: '#FFFFFF', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        startText.setInteractive();
        startText.on('pointerover', function () {
            startText.setStyle({ fill: '#228B22' });
        });

        startText.on('pointerout', function () {
            startText.setStyle({ fill: '#FFFFFF' });
        });
        startText.on('pointerdown', function () {
            this.scene.start('GameScene');
        }, this);
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
    scene: [MenuScene, GameScene]
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
    this.load.image('ground', 'assets/ground.png')
    this.load.image('platform1', 'assets/platform1.png')
    this.load.image('axeman', 'assets/character1.png')
    this.load.image('swordman', 'assets/character2.png')
    this.load.image('groundhitbox', 'assets/groundhitbox.png')
    this.load.image('redstat', 'assets/KBstatBG1.png')
    this.load.image('bluestat', 'assets/KBstatBG2.png')
    this.load.image('winbar', 'assets/WINbar.png')
    this.load.image('doublejump', 'assets/DoubleJump.png')

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
    this.load.audio('swordthirdhitsfx', 'audio/swordlunge.wav');
    this.load.audio('axethirdhitsfx', 'audio/snd_damage_c.wav');
    this.load.audio('anyhit', 'audio/hit1.ogg');
    this.load.audio('miss', 'audio/swordslash.wav');
    this.load.audio('lunge', 'audio/Dodge3.wav');
}
//important game variables, including player objects, controls, and the platforms group
var platforms;
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


var winBar;
function create() {
    platforms = this.physics.add.staticGroup();
    //Making the background, platforms, and the KB stat display
    const bg = this.add.image(500, 300, 'background');
    bg.setDisplaySize(this.scale.width, this.scale.height);

    winBar = this.add.image(500, 300, 'winbar');
    winBar.setDisplaySize(this.scale.width, 150);
    winBar.setScale(1, 0);
    winBar.setVisible(false);



    const plr1StatImage = this.add.image(300, 65, 'redstat');
    plr1StatImage.setScale(0.65);
    const plr2StatImage = this.add.image(700, 65, 'bluestat');
    plr2StatImage.setScale(0.65);

    const groundVisual = this.add.image(500, 450, 'ground');
    groundVisual.setDisplaySize(this.scale.width, 300);

    // Invisible collision ground, the actual ground
    const ground = platforms.create(500, 575, 'groundhitbox');
    ground.setDisplaySize(this.scale.width, 0);
    ground.setVisible(false);
    ground.refreshBody();

    const ground2 = platforms.create(725, 470, 'groundhitbox');
    ground2.setDisplaySize(this.scale.width / 2, 0);
    ground2.setVisible(true);
    ground2.refreshBody();

    const platform = this.add.image(725, 425, 'platform1');
    platform.setScale(0.5);
    //platform.refreshBody();
    this.anims.create({
        key: 'axeatk',
        frames: this.anims.generateFrameNumbers('axeatk', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });

    this.anims.create({
        key: 'swordatk',
        frames: this.anims.generateFrameNumbers('swordatk', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'swordatkthird',
        frames: this.anims.generateFrameNumbers('swordatkthird', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });
    this.anims.create({
        key: 'axeatkthird',
        frames: this.anims.generateFrameNumbers('axeatkthird', { start: 0, end: 4 }),
        frameRate: 32,
        repeat: 0
    });

    //---PLAYER---\\
    players = initiatePlayers(this);

    for (const key in players) {
        const player = players[key];
        this.physics.add.collider(player, platforms);
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

    const plr1NameText = this.add.text(280, 47, players.player.name, { fontFamily: 'GameFont', fontSize: '10px', fill: '#FFFFFF' });
    const plr2NameText = this.add.text(680, 47, players.player2.name, { fontFamily: 'GameFont', fontSize: '10px', fill: '#FFFFFF' });
    plr1NameText.setStroke('#000000', 3);
    plr2NameText.setStroke('#000000', 3);

    players.player.KBText = this.add.text(285, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '14px', fill: '#FFFFFF' });
    players.player2.KBText = this.add.text(685, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '14px', fill: '#FFFFFF' });
    players.player.KBText.setStroke('#000000', 3);
    players.player2.KBText.setStroke('#000000', 3);

    //---CONTROLS---\\
    //Allows holding for the keys too. Later this will be revamped to allow charge attacks
    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });

    
}
function updateWins(scene) {
    if (players.player.winNumber !== lastWinState.p1 || players.player2.winNumber !== lastWinState.p2) {
        console.log("update!")
        lastWinState.p1 = players.player.winNumber;
        lastWinState.p2 = players.player2.winNumber;

        winBar.setVisible(true);
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

    }
}
function teleportBackToArena(player) {
    player.setPosition(500, 0)
    player.setVelocityY(0)
    player.setVelocityX(0)
}
const accelFactor = 20
function update() {
    //why put these in an update loop?
    //In this game there are a lot of different states and mechanics that need to be updated in real time, 
    // such as player's movement, attacks, acting upon hitstun/freeze, checking for win conditions, and more.
    //---STATE UPDATES---\\
    if (gameEnded) {
        players.player.setVelocityX(0);
        players.player.setVelocityY(0);
        players.player2.setVelocityX(0);
        players.player2.setVelocityY(0);
        return
    }
    if (attackKey1.isDown && !players.player.hitstun) {
        tryAttack(this, players.player, players.player2, 'axeatk', 'axeatkthird');
    }
    if (attackKey2.isDown && !players.player2.hitstun) {
        tryAttack(this, players.player2, players.player, 'swordatk', 'swordatkthird');
    }
    players.player.outOfBounds = players.player.y > 700 || players.player.x < -400 || players.player.x > 1400 || players.player.y < -200;
    players.player2.outOfBounds = players.player2.y > 700 || players.player2.x < -400 || players.player2.x > 1400 || players.player2.y < -200;

    for (const key in players) {
        const player = players[key];

        if (player.body.touching.down) {
            player.airTime = 0;
        } else {
            player.airTime += this.game.loop.delta;
        }
    };
    players.player.KBText.setText('KB: ' + players.player.KBmultiplier.toFixed(2));
    players.player2.KBText.setText('KB: ' + players.player2.KBmultiplier.toFixed(2));
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

    players.player.doubleJumpEffect.x = players.player.x
    players.player.doubleJumpEffect.y = players.player.y + 40

    players.player2.doubleJumpEffect.x = players.player2.x
    players.player2.doubleJumpEffect.y = players.player2.y + 40

    if (!players.player.hitstun) {
        if (Phaser.Input.Keyboard.JustDown(wasd.left)) {
            tryCleave(this, players.player, 'left', this.time.now);
        }
        if (Phaser.Input.Keyboard.JustDown(wasd.right)) {
            tryCleave(this, players.player, 'right', this.time.now);
        }
        if (!players.player.hasHitSideSpecial && players.player.isUsingSideSpecial) {
            superSwing(this, players.player, players.player2, 'axeatkthird');
            players.player.hasHitSideSpecial = true;
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
        }
    }


    if (!players.player2.hitstun) {

        //Player 2 controls
        if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
            tryLunge(this, players.player2, 'left', this.time.now);
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
            tryLunge(this, players.player2, 'right', this.time.now);
        }
        if (!players.player2.hasHitSideSpecial && players.player2.isUsingSideSpecial) {
            pushAttack(this, players.player2, players.player, 'swordatkthird');
            players.player.hasHitSideSpecial = true;
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

    if (!gameEnded) {

        if (players.player.outOfBounds) {
            players.player2.winNumber = players.player2.winNumber + 1;
            console.log(players.player2.winNumber)
            updateWins(this)
            teleportBackToArena(players.player)
        } else if (players.player2.outOfBounds) {
            players.player.winNumber = players.player.winNumber + 1;
            updateWins(this)
            teleportBackToArena(players.player2)
        }

        if (players.player.winNumber >= winNumber || players.player2.winNumber >= winNumber) {
            if (players.player.outOfBounds) {
                gameEnded = true;
                this.add.text(500, 400, players.player2.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#00008B' }).setOrigin(0.5).setStroke('#000000', 5);
            } else if (players.player2.outOfBounds) {
                gameEnded = true;
                this.add.text(500, 400, players.player.name + ' WINS!', { fontFamily: 'GameFont', fontSize: '32px', fill: '#8B0000' }).setOrigin(0.5).setStroke('#000000', 5);
            }
        }
    }
}
