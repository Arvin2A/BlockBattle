import { botMode } from "../main.js";
import { preload as bigPreload} from "./GameScene/preload.js";

export var player1Character = '';
export var player2Character = '';
export const CharacterSelectScene = {

    key: 'CharacterSelectScene',

    preload: bigPreload,
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
            { name: 'FISHERMAN', desc: 'Using a fishing rod as a whip?? \n\n(BUGGED) DIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in.', color: '#00318d' },
            { name: 'SCYTHEMAN', desc: 'Its third neutral hit goes slightly higher. \n\nDIR SPECIAL: MOW \n\n Throw a bigger scythe like a boomerang that stuns the opponent.', color: '#686868' },
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
            botMode
        ? 'SELECT PLAYER AND CPU'
        : 'SELECT YOUR CHARACTER',
            {
                fontFamily: 'VCROSD',
                fontSize: '35px',
                fill: '#f691ff',
                stroke: '#500000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);

        //select boxes!

        this.p1SelectBox = this.add.rectangle(
            0,
            0,
            60,
            60
        ).setStrokeStyle(4, 0xf54242);

        this.p2SelectBox = this.add.rectangle(
            0,
            0,
            60,
            60
        ).setStrokeStyle(4, 0x00aaff);

        // -----------------------------
        // CHARACTER LIST
        // -----------------------------

        this.characterIcons = [];
        
        const spacingX = 75;
        const spacingY = 75;

        const rows = Math.ceil(this.characters.length / 4);
        const columns = Math.min(4, this.characters.length);

        const gridWidth = (columns - 1) * spacingX;
        const gridHeight = (rows - 1) * spacingY;

        const startX = 500 - gridWidth / 2;
        const startY = 300 - gridHeight / 2;

        for (let i = 0; i < this.characters.length; i++) {

            const row = Math.floor(i / 4);
            const col = i % 4;

            const icon = this.add.image(
                startX + col * spacingX,
                startY + row * spacingY,
                this.characters[i]
            )
            .setScale(1)
            .setInteractive({ useHandCursor: true });

            icon.characterIndex = i;

            this.characterIcons.push(icon);
        }
        

        if (botMode) {
            this.p2Cursor.setText('CPU');
        }

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
            fontSize: '26px',
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
            fontSize: '26px',
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

            const p1Icon = this.characterIcons[this.p1Index];
            const p2Icon = this.characterIcons[this.p2Index];

            if (p1Icon === p2Icon) {
                this.p2SelectBox.setStrokeStyle(4,0xc300ff);
            } else {
                this.p2SelectBox.setStrokeStyle(4,0x00aaff);
            }


            if (this.p1BoxTween) this.p1BoxTween = null;
            this.p1BoxTween = this.tweens.add({
                targets: this.p1SelectBox,
                x: p1Icon.x,
                y: p1Icon.y,
                duration: 100,
                ease: 'Quad.easeOut'
            });
            if (this.p2BoxTween) this.p2BoxTween = null;
            this.p2BoxTween = this.tweens.add({
                targets: this.p2SelectBox,
                x: p2Icon.x,
                y: p2Icon.y,
                duration: 100,
                ease: 'Quad.easeOut'
            });


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
                fontSize: '44px',
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
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D,

            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT

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

        if (Phaser.Input.Keyboard.JustDown(this.keys.a)) {
            this.sound.play('hover');
            this.p1Index--;

            if (this.p1Index < 0) {
                this.p1Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.d)) {
            this.sound.play('hover');

            this.p1Index++;

            if (this.p1Index >= this.characters.length) {
                this.p1Index = 0;
            }
            this.updateCharacterDescriptions();
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.s)) {
            this.sound.play('hover');

            this.p1Index = this.p1Index+4;

            if (this.p1Index >= this.characters.length) {
                this.p1Index = 0;
            }
            if (this.p1Index < 0) {
                this.p1Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.w)) {
            this.sound.play('hover');

            this.p1Index = this.p1Index-4;

            if (this.p1Index >= this.characters.length) {
                this.p1Index = 0;
            }
            if (this.p1Index < 0) {
                this.p1Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        // -----------------------------
        // P2 CONTROLS
        // -----------------------------

        if (Phaser.Input.Keyboard.JustDown(this.keys.left)) {
            this.sound.play('hover');
            this.p2Index--;

            if (this.p2Index < 0) {
                this.p2Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.right)) {
            this.sound.play('hover');
            this.p2Index++;

            if (this.p2Index >= this.characters.length) {
                this.p2Index = 0;
            }
            this.updateCharacterDescriptions();
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
            this.sound.play('hover');

            this.p2Index = this.p2Index+4;

            if (this.p2Index >= this.characters.length) {
                this.p2Index = 0;
            }
            if (this.p2Index < 0) {
                this.p2Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
            this.sound.play('hover');

            this.p2Index = this.p2Index-4;

            if (this.p2Index >= this.characters.length) {
                this.p2Index = 0;
            }
            if (this.p2Index < 0) {
                this.p2Index = this.characters.length - 1;
            }
            this.updateCharacterDescriptions();
        }

        // -----------------------------
        // UPDATE CURSOR POSITIONS
        // -----------------------------
    }
};