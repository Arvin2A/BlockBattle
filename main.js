import {handleAttack, handleDirSpecial, handleDirSpecialAttack, handleHorizantalTilt, handleDownTilt, handleUpTilt} from './attacks.js';
import { initiatePlayers, updateCombo } from './players.js';
import { Commands, executeStateCommand} from './commands.js';
import { MenuScene } from './scenes/MenuScene.js';
import { player1Character, player2Character, CharacterSelectScene } from './scenes/CharacterSelectScreen.js';
import { preload } from './scenes/GameScene/preload.js';
import { runBotAI } from './scenes/GameScene/botAI.js';
import { Map } from './scenes/GameScene/Map.js';
//3 NEW SCRIPTS: main.js (current), players.js, attacks.js


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

//Mobile controls are added to the game now
//You can double tap each player's corresponding side buttons (A + D), or (LEFT ARROW + RIGHT ARROW KEY) to do a special attack.
//NEW UPDATE - LIGHT ATTACKS: Press a movement key, then quickly press the attack key to do a light attack. This can be helpful for comboing

//We will still continue to work on this project, its really fun.


//UPDATE: ADDED 3 NEW CHARACTERS: FISHERMAN, SCYTHEMAN, AND HAMMERMAN
//FUTURE UPDATES: ADD VFX AND POLISH

export var botMode = false; //Instead of a P2, you can fight an AI instead. (CPU)
export function changeBotMode(newBotMode) {
    botMode = newBotMode;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    //was meant to be used, but was succeeded later after the discovery of scene.time.delayedCall
}
async function loadFont() {
    const font = new FontFace('GameFont', 'url(assets/fonts/GameFont.ttf)');
    await font.load();
    document.fonts.add(font);
    const font2 = new FontFace('VCROSD', 'url(assets/fonts/VCROSD.ttf)')
    await font2.load();
    document.fonts.add(font2)
    //load the gamefont that is very kool
}

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

//important game variables, including player objects and controls
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

var winBar;
var restartBtn;
var restartBtnPressed;
function create() {
    this.gameEnded = false;
    this.winCooldown = false;
    this.finisherActive = false;
    this.gameState = {
        players: null,
        map: null
    };

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
    this.gameState.map = new Map(this);
    //Making the map, platforms, and the KB stat display
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
        frames: this.anims.generateFrameNumbers('swordatktilt', { start: 0, end: 4 }),
        frameRate: 28,
        repeat: 0
    });
    this.anims.create({
        key: 'axeatkthird',
        frames: this.anims.generateFrameNumbers('axeatkthird', { start: 0, end: 6 }),
        frameRate: 42,
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
        frameRate: 12,
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
            if (botMode) butn.visible = false;
            this.mobileButtons.p2.push(butn);
        });

    }

    //---PLAYER---\\
    this.gameState.players = initiatePlayers(this, player1Character, player2Character);

    //a bit of cam intiation:
    this.physics.world.setBounds(0, 0, 2000, 1200);
    this.cameras.main.setBounds(0, 0, 2000, 1200);
    this.cameras.main.ignore(this.hud);
    this.objcam.ignore(this.objs);


    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];
        this.physics.add.collider(player, this.gameState.map.platforms);
        this.physics.add.collider(player, this.gameState.map.topPlatforms);
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
    this.gameState.players.player.KBText = this.add.text(285, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '20px', fill: '#FFFFFF' });
    this.gameState.players.player2.KBText = this.add.text(685, 65, 'KB: 1.00', { fontFamily: 'GameFont', fontSize: '20px', fill: '#FFFFFF' });
    this.gameState.players.player.KBText.setStroke('#000000', 3);
    this.gameState.players.player2.KBText.setStroke('#000000', 3);
    this.hud.add(this.gameState.players.player2.KBText);
    this.hud.add(this.gameState.players.player.KBText);
    

    //---CONTROLS---\\
    //Allows holding for the keys too. Later this will be revamped to allow charge attacks
    attackKey1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    attackKey2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    

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

                });   
            });   
        });    
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
    for (const key in scene.gameState.players) {
        const player = scene.gameState.players[key];
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
        player.plungeAura.setPosition(player.x, player.y);
        player.lastKBmultiplier = player.KBmultiplier;
        if (scene.time.now > player.nextSideSpecialTime && scene.time.now - player.nextSideSpecialTime < 100) {
            spawnBox();
        }
    }
}
export var fiveframecount = 0;

function update() {

    fiveframecount += 1;
    

    const p1 = this.gameState.players.player;
    const p2 = this.gameState.players.player2;

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
    if ((attackKey2.isDown || mobileControls.p2.attack) && !p2.hitstun && !botMode) {
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

    for (const key in this.gameState.players) {
        const player = this.gameState.players[key];

        if (player.body.touching.down) {
            player.airTime = 0;
        } else {
            player.airTime += this.game.loop.delta;
        }
        player.flashObject.setPosition(player.x, player.y);

        player.hitstun =
            this.time.now < player.hitstunUntil;

        player.freeze =
            this.time.now < player.freezeUntil;
        //player.canAttack =
            //this.time.now < player.canAttackUntil;
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
    function decelerate(player) {
        if (player.isUsingSideSpecial) return;
        let vx = player.body.velocity.x;

        if (Math.abs(vx) > 10) {
            player.setVelocityX(vx * 0.9);
        } else {
            player.setVelocityX(0);
        }
    }
    p1.atk.x = p1.x + (p1.lastDir.x * p1.atkXOffset);
    p1.atk.y = p1.y + (p1.lastDir.y * p1.atkYOffset) - 15;

    p2.atk.x = p2.x + (p2.lastDir.x * p2.atkXOffset);
    p2.atk.y = p2.y + (p2.lastDir.y * p2.atkYOffset) - 15;
 
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
            if (!p1.body.touching.down && !p1.hasDoubleJumped) {
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

        if ((wasd.down.isDown || mobileControls.p1.down) && p1.airTime > 600) {
            executeStateCommand(this, this.gameState.players, {
                playerID: p1.id,
                type: Commands.DOWNSLAM
            });
        }

    }


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
            if (!p2.body.touching.down && !p2.hasDoubleJumped) {
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
        if ((cursors.down.isDown || mobileControls.p2.down) && p2.airTime > 600) {
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
    if (p1.freeze) {
        p1.setVelocityX(0);
        p1.setVelocityY(0);
    }
    if (p2.freeze) {
        p2.setVelocityX(0);
        p2.setVelocityY(0);
    }

    //WIN CONDITION -- DETECT IF PLAYER IS LAUNCHED FAR OFF SCREEN

    if (!this.gameEnded && !this.winCooldown) {

        if (p1.outOfBounds) {
            this.winCooldown = true;
            p2.winNumber = p2.winNumber + 1;
            p1.KBmultiplier = 1.00;
            console.log(p2.winNumber)
            updateWins(this);
            teleportBackToArena(p1);
            
            this.time.delayedCall(1500, () => {
                this.winCooldown = false;
            });
        } else if (p2.outOfBounds) {
            this.winCooldown = true;
            p1.winNumber = p1.winNumber + 1;
            p2.KBmultiplier = 1.00;
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
        }
    }
    updateKB(this);
    if (botMode) {
        runBotAI(this, p2, p1);
    }
    if (fiveframecount >= 5) {
        fiveframecount = 0;
    }
}
