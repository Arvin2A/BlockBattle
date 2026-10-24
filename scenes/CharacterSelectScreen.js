import { botMode, simulationMode } from "../gameSettings.js";
import { preloadCharacterSelection } from "./GameScene/preload.js";
import { getCharacterTexture } from "../characterTextures.js";
import { fadeOutTo } from "./transitions.js";
import { CHARACTER_ROSTER } from "../characterRoster.js";
import {
    getConnectedControllers,
    getMenuGamepadInput
} from "../navigation.js";

export var player1Character = '';
export var player2Character = '';
export var player1Variant = '';
export var player2Variant = '';

// Online matches pick characters in the lobby instead of on this screen.
export function setSelectedCharacters(p1Character, p1Variant, p2Character, p2Variant) {
    player1Character = p1Character;
    player1Variant = p1Variant;
    player2Character = p2Character;
    player2Variant = p2Variant;
}

export const CharacterSelectScene = {

    key: 'CharacterSelectScene',

    preload: preloadCharacterSelection,
    create: function () {
        this.cameras.main.fadeIn(200, 0, 0, 0);

        // -----------------------------
        // DATA
        // -----------------------------

        this.characters = CHARACTER_ROSTER.map(({ key }) => ({ key }));
        this.characterData = CHARACTER_ROSTER;

        const getCharacterIcon = (characterIndex, variantIndex = 0) => {
            const character = this.characters[characterIndex];
            const variant = this.characterData[characterIndex].variants[variantIndex];
            return getCharacterTexture(character.key, variant.name);
        };

        this.p1Index = 1;
        this.p2Index = botMode
            ? Phaser.Math.Between(0, this.characters.length - 1)
            : 0;
        this.p1VariantIndex = 0;
        this.p2VariantIndex = 0;

        // background
        this.cameras.main.setBackgroundColor('#1b1b1b');

        this.add.image(500, 300, 'desertpreview');
        const overlay = this.add.rectangle(
            500,
            300,
            1000,
            600,
            0x1b1b1b,
            0.90
        );

        

        this.p1IsReady = false;
        this.p2IsReady = false;

        this.controllerPreviousInput = [{}, {}];

        // -----------------------------
        // TITLE
        // -----------------------------

        this.add.text(
            500,
            50,
            simulationMode
                ? 'SELECT BOTH CPUS'
                : botMode
                    ? 'SELECT PLAYER AND CPU'
                    : 'SELECT YOUR CHARACTER',
            {
                fontFamily: 'VCROSD',
                fontSize: '35px',
                fill: '#ffffff',
                stroke: '#000000',
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
        ).setStrokeStyle(4, botMode ? 0x686868 : 0x00aaff);

        // CHARACTER LIST

        this.characterIcons = [];
        const isTouchDevice = this.sys.game.device.input.touch;
        // Touch devices show a one-column wheel instead of the grid, so up/down
        // (from a keyboard or controller) step one character instead of a row.
        this.verticalStep = isTouchDevice ? 1 : 4;
        this.input.mouse?.disableContextMenu();

        const spacingX = 75;
        const spacingY = 75;

        const rows = Math.ceil(this.characters.length / 4);
        const columns = Math.min(4, this.characters.length);

        const gridWidth = (columns - 1) * spacingX;
        const gridHeight = (rows - 1) * spacingY;

        const startX = 500 - gridWidth / 2;
        const startY = 200 - gridHeight / 2;

        for (let i = 0; i < this.characters.length; i++) {

            const row = Math.floor(i / 4);
            const col = i % 4;

            const icon = this.add.image(
                startX + col * spacingX,
                startY + row * spacingY,
                this.characters[i].key
            )
                .setScale(1)
                .setInteractive({ useHandCursor: true });

            icon.characterIndex = i;
            // Left click picks for P1, right click for P2.
            icon.on('pointerdown', pointer => {
                const player = pointer.rightButtonDown() ? 2 : 1;
                if (player === 1 && this.p1IsReady) return;
                if (player === 2 && this.p2IsReady) return;
                this.sound.play('hover');
                if (player === 1) this.p1Index = i;
                else this.p2Index = i;
                this.updateCharacterDescriptions();
            });

            this.characterIcons.push(icon);
        }

        if (isTouchDevice) {
            this.characterIcons.forEach(icon => icon.setVisible(false));
            this.p1SelectBox.setVisible(false);
            this.p2SelectBox.setVisible(false);
        }



        //DESCRIPTIONS:
        const DESCBOX1 = this.add.rectangle(
            130,
            300,
            225,
            400,
            0x171717
        );
        const DESCBOX2 = this.add.rectangle(
            870,
            300,
            225,
            400,
            0x171717
        );

        
        this.p1NameText = this.add.text(130, 150, '', {
            fontFamily: 'GameFont',
            fontSize: '26px',
            fill: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        this.p1DescText = this.add.text(130, 340, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 200 }
        }).setOrigin(0.5);

        this.p2NameText = this.add.text(870, 150, '', {
            fontFamily: 'GameFont',
            fontSize: '26px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.p1VariantText = this.add.text(130, 180, '', {
            fontFamily: 'VCROSD',
            fontSize: '16px',
            fill: '#686868'
        }).setOrigin(0.5);

        this.p2VariantText = this.add.text(870, 180, '', {
            fontFamily: 'VCROSD',
            fontSize: '16px',
            fill: '#686868'
        }).setOrigin(0.5);


        const createVariantButton = (x, player, direction) => {
            const button = this.add.text(x, 180, direction < 0 ? '<' : '>', {
                fontFamily: 'VCROSD',
                fontSize: '30px',
                fill: '#686868'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            const variantText = player === 1 ? this.p1VariantText : this.p2VariantText;

            button.on('pointerover', () => button.setColor('#ffffff'));
            button.on('pointerout', () => button.setColor('#686868'));
            button.on('pointerdown', () => {
                if (player === 1 && this.p1IsReady) return;
                if (player === 2 && this.p2IsReady) return;

                const characterIndex = player === 1 ? this.p1Index : this.p2Index;
                const variants = this.characterData[characterIndex].variants;
                if (variants.length === 1) {
                    this.sound.play('deny');
                    return;
                }
                const variantIndex = player === 1 ? this.p1VariantIndex : this.p2VariantIndex;
               
                const nextVariantIndex = (variantIndex + direction + variants.length) % variants.length;

                this.lastSelectedIconPlayer = player;
                if (player === 1) {
                    this.p1VariantIndex = nextVariantIndex;
                } else {
                    this.p2VariantIndex = nextVariantIndex;
                }

                

                this.sound.play('hover2');
                this.updateCharacterDescriptions();
            });

            return button;
        };

        this.p1VariantButtons = [
            createVariantButton(60, 1, -1),
            createVariantButton(200, 1, 1)
        ];
        this.p2VariantButtons = [
            createVariantButton(800, 2, -1),
            createVariantButton(940, 2, 1)
        ];

        this.p2DescText = this.add.text(870, 340, '', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 200 }
        }).setOrigin(0.5);

        const p1BoxSelectedOverlay = this.add.image(
            0,
            0,
            'selectedoverlay'
        ).setAlpha(0).setDepth(50);

        const p2BoxSelectedOverlay = this.add.image(
            0,
            0,
            'selectedoverlay'
        ).setAlpha(0).setDepth(50);

        let previousP1Index = null;
        let previousP2Index = null;
        this.lastSelectedIconPlayer = 2;

        this.updateCharacterDescriptions = function (
            p1Direction = 0,
            p2Direction = 0
        ) {
            const p1 = this.characterData[this.p1Index];
            const p2 = this.characterData[this.p2Index];

            if (this.p1Index !== previousP1Index) {
                this.p1VariantIndex = 0;
                previousP1Index = this.p1Index;
                this.lastSelectedIconPlayer = 1;
            }
            if (this.p2Index !== previousP2Index) {
                this.p2VariantIndex = 0;
                previousP2Index = this.p2Index;
                this.lastSelectedIconPlayer = 2;
            }

            const p1Variant = p1.variants[this.p1VariantIndex];
            const p2Variant = p2.variants[this.p2VariantIndex];
            this.characterIcons.forEach((icon, index) => {
                icon.setTexture(this.characters[index].key);
            });
            if (this.p1Index === this.p2Index) {
                const selectedVariantIndex = this.lastSelectedIconPlayer === 1
                    ? this.p1VariantIndex
                    : this.p2VariantIndex;
                this.characterIcons[this.p1Index].setTexture(
                    getCharacterIcon(this.p1Index, selectedVariantIndex)
                );
            } else {
                this.characterIcons[this.p1Index].setTexture(
                    getCharacterIcon(this.p1Index, this.p1VariantIndex)
                );
                this.characterIcons[this.p2Index].setTexture(
                    getCharacterIcon(this.p2Index, this.p2VariantIndex)
                );
            }
            const p1HasMultipleVariants = p1.variants.length > 1;
            const p2HasMultipleVariants = p2.variants.length > 1;

            this.p1VariantText.setVisible(p1HasMultipleVariants);
            this.p1VariantButtons.forEach(button => button.setVisible(p1HasMultipleVariants));
            this.p2VariantText.setVisible(p2HasMultipleVariants);
            this.p2VariantButtons.forEach(button => button.setVisible(p2HasMultipleVariants));

            this.p1NameText.setText(p1.name);
            this.p1NameText.setColor(p1Variant.color);
            this.p1VariantText.setText(p1Variant.name);
            this.p1VariantText.setColor(p1Variant.color);

            this.p1DescText.setText(p1Variant.desc);
            if (p1Variant.fontSize) {
                this.p1DescText.setFontSize(p1Variant.fontSize);
            } else {
                this.p1DescText.setFontSize(20);
            }

            this.p2NameText.setText(p2.name);
            this.p2NameText.setColor(p2Variant.color);
            this.p2VariantText.setText(p2Variant.name);
            this.p2VariantText.setColor(p2Variant.color);

            const p1Icon = this.characterIcons[this.p1Index];
            const p2Icon = this.characterIcons[this.p2Index];

            if (p1Icon === p2Icon) {
                this.p2SelectBox.setStrokeStyle(4, 0xc300ff);
            } else {
                this.p2SelectBox.setStrokeStyle(4, botMode ? 0x686868 : 0x00aaff);
            }


            if (this.p1BoxTween) this.p1BoxTween = null;
            this.p1BoxTween = this.tweens.add({
                targets: this.p1SelectBox, p1BoxSelectedOverlay,
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
            if (!isTouchDevice) {
                p1BoxSelectedOverlay.setPosition(p1Icon.x, p1Icon.y);
                p2BoxSelectedOverlay.setPosition(p2Icon.x, p2Icon.y);
            }


            this.p2DescText.setText(p2Variant.desc);
            if (p2Variant.fontSize) {
                this.p2DescText.setFontSize(p2Variant.fontSize);
            } else {
                this.p2DescText.setFontSize(20);
            }

            if (this.mobileWheels) {
                this.mobileWheels.p1.refresh(this.p1Index, p1Direction);
                this.mobileWheels.p2.refresh(this.p2Index, p2Direction);
            }
        };

        
        
        const createCharacterWheel = (x, player, color) => {
            const wheelIcons = [-1, 0, 1].map(offset =>
                this.add.image(
                    x,
                    320 + offset * 65,
                    this.characters[0].key
                ).setScale(offset === 0 ? 1 : 0.65)
            );

            let isAnimating = false;

            const getIndex = () =>
                player === 1 ? this.p1Index : this.p2Index;

            const getVariantIndex = () =>
                player === 1 ? this.p1VariantIndex : this.p2VariantIndex;

            const selectedOverlay = player === 1
                ? p1BoxSelectedOverlay
                : p2BoxSelectedOverlay;

            const drawIcons = index => {
                [-1, 0, 1].forEach((offset, i) => {
                    const characterIndex =
                        (index + offset + this.characters.length) %
                        this.characters.length;

                    wheelIcons[i].setTexture(
                        getCharacterIcon(
                            characterIndex,
                            offset === 0 ? getVariantIndex() : 0
                        )
                    );

                    wheelIcons[i]
                        .setPosition(x, 320 + offset * 65)
                        .setAlpha(offset === 0 ? 1 : 0.45)
                        .setScale(offset === 0 ? 1 : 0.65);
                });

                selectedOverlay.setPosition(x, 320);
            };

            const refresh = (index, direction = 0) => {
                if (isAnimating) return;

                if (direction === 0) {
                    drawIcons(index);
                    return;
                }

                isAnimating = true;

                const oldTextures = wheelIcons.map(icon => icon.texture.key);
                const oldAlphas = wheelIcons.map(icon => icon.alpha);
                const oldScales = wheelIcons.map(icon => icon.scaleX);

                const newIcons = [-1, 0, 1].map(offset => {
                    const characterIndex =
                        (index + offset + this.characters.length) %
                        this.characters.length;

                    const icon = this.add.image(
                        x,
                        320 + offset * 65 + direction * 65,
                        getCharacterIcon(
                            characterIndex,
                            offset === 0 ? getVariantIndex() : 0
                        )
                    );

                    return icon
                        .setScale(offset === 0 ? 1 : 0.65)
                        .setAlpha(0);
                });

                // Keep the old icons intact while they slide away.
                wheelIcons.forEach((icon, i) => {
                    this.tweens.add({
                        targets: icon,
                        y: icon.y - direction * 65,
                        alpha: 0,
                        duration: 300,
                        ease: 'Sine.easeInOut'
                    });
                });

                // Slide the new icons into the wheel.
                newIcons.forEach((icon, i) => {
                    const offset = i - 1;

                    this.tweens.add({
                        targets: icon,
                        y: 320 + offset * 65,
                        alpha: offset === 0 ? 1 : 0.45,
                        duration: 300,
                        ease: 'Sine.easeInOut'
                    });
                });

                this.tweens.add({
                    targets: selectedOverlay,
                    x,
                    y: 320,
                    duration: 300,
                    ease: 'Sine.easeInOut'
                });

                this.time.delayedCall(120, () => {
                    wheelIcons.forEach(icon => icon.destroy());
                    newIcons.forEach((icon, i) => {
                        wheelIcons[i] = icon;
                    });

                    isAnimating = false;
                });
            };

            const createWheelButton = (y, label, direction) => {
                const button = this.add.rectangle(x, y, 70, 45, color)
                    .setStrokeStyle(3, 0xffffff)
                    .setInteractive({ useHandCursor: true });

                this.add.text(x, y, label, {
                    fontFamily: 'VCROSD',
                    fontSize: '30px',
                    fill: '#ffffff'
                }).setOrigin(0.5);

                button.on('pointerover', () => button.setAlpha(0.8));
                button.on('pointerout', () => button.setAlpha(1));

                button.on('pointerdown', () => {
                    if (isAnimating) return;
                    if (player === 1 && this.p1IsReady) return;
                    if (player === 2 && this.p2IsReady) return;

                    this.sound.play('hover');

                    if (player === 1) {
                        this.p1Index = (
                            this.p1Index + direction + this.characters.length
                        ) % this.characters.length;
                    } else {
                        this.p2Index = (
                            this.p2Index + direction + this.characters.length
                        ) % this.characters.length;
                    }

                    this.updateCharacterDescriptions(
                        player === 1 ? direction : 0,
                        player === 2 ? direction : 0
                    );
                });
            };

            createWheelButton(200, '^', -1);
            createWheelButton(440, 'v', 1);

            drawIcons(getIndex());

            return { refresh };
        };



        this.mobileWheels = isTouchDevice
            ? {
                p1: createCharacterWheel(300, 1, 0xf54242),
                p2: createCharacterWheel(700, 2, botMode ? 0x686868 : 0x00aaff)
            }
            : null;

        // START GAME ON CLICK

        //changing it so that both players must click their ready button, then the play button will be activated.
        const playBox = this.add.rectangle(
            500,
            520,
            220,
            70,
            0x228B22
        ).setAlpha(0);

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
        ).setOrigin(0.5).setAlpha(0);

        

        const DESCOVERLAY1 = this.add.rectangle(
            130,
            300,
            225,
            400,
            0x171717
        ).setAlpha(0);
        const DESCOVERLAY2 = this.add.rectangle(
            870,
            300,
            225,
            400,
            0x171717
        ).setAlpha(0);

        const DESCIMAGE1 = this.add.image(
            130,
            300,
            'ready'
        ).setAlpha(0);
        const DESCIMAGE2 = this.add.image(
            870,
            300,
            'ready'
        ).setAlpha(0);


        const p1ReadyButton = this.add.rectangle(
            130,
            550,
            150,
            50,
            0xf54242
        ).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });

        const p1ReadyText = this.add.text(
            130,
            550,
            'READY',
            {
                fontFamily: 'VCROSD',
                fontSize: '24px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        p1ReadyButton.on('pointerdown', () => {
            this.sound.play('hover2');
            p1ReadyButton.setFillStyle(0x686868);
            p1ReadyButton.disableInteractive();
            DESCOVERLAY1.setAlpha(0.5);
            DESCIMAGE1.setAlpha(1);
            p1BoxSelectedOverlay.setAlpha(1);
            this.p1IsReady = true;
            if (this.p2IsReady) {
                playBox.setAlpha(1);
                playText.setAlpha(1);
            }
        });

        p1ReadyButton.on('pointerover', () => {
            p1ReadyButton.setFillStyle(0xff6666);
        });

        p1ReadyButton.on('pointerout', () => {
            p1ReadyButton.setFillStyle(0xf54242);
        });

        const p2ReadyButton = this.add.rectangle(
            870,
            550,
            150,
            50,
            botMode ? 0x686868 : 0x00aaff
        ).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });

        const p2ReadyText = this.add.text(
            870,
            550,
            'READY',
            {
                fontFamily: 'VCROSD',
                fontSize: '24px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        p2ReadyButton.on('pointerdown', () => {
            this.sound.play('hover2');
            p2ReadyButton.setFillStyle(0x686868);
            p2ReadyButton.disableInteractive();
            p2BoxSelectedOverlay.setAlpha(1);
            DESCOVERLAY2.setAlpha(0.5);
            DESCIMAGE2.setAlpha(1);
            this.p2IsReady = true;
            if (this.p1IsReady) {
                playBox.setAlpha(1);
                playText.setAlpha(1);
            }
        });

        p2ReadyButton.on('pointerover', () => {
            p2ReadyButton.setFillStyle(0x48c2ff);
        });

        p2ReadyButton.on('pointerout', () => {
            p2ReadyButton.setFillStyle(0x00aaff);
        });


        

        

        

        playBox.setInteractive({ useHandCursor: true });

        playBox.on('pointerover', () => {
            playBox.setFillStyle(0x2ecc71);
        });

        playBox.on('pointerout', () => {
            playBox.setFillStyle(0x228B22);
        });

        playBox.on('pointerdown', () => {
            fadeOutTo(this, () => {
                this.scene.start('GameScene', {
                    player1Character: this.characters[this.p1Index].key,
                    player2Character: this.characters[this.p2Index].key,
                    player1Variant: this.characterData[this.p1Index].variants[this.p1VariantIndex].name,
                    player2Variant: this.characterData[this.p2Index].variants[this.p2VariantIndex].name
                });
            });
            player1Character = this.characters[this.p1Index].key;
            player2Character = this.characters[this.p2Index].key;
            player1Variant = this.characterData[this.p1Index].variants[this.p1VariantIndex].name;
            player2Variant = this.characterData[this.p2Index].variants[this.p2VariantIndex].name;

        });

        const backBox = this.add.rectangle(
            500,
            580,
            150,
            35,
            0x686868
        ).setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });

        this.add.text(500, 580, 'BACK', {
            fontFamily: 'VCROSD',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        backBox.on('pointerover', () => backBox.setFillStyle(0x888888));
        backBox.on('pointerout', () => backBox.setFillStyle(0x686868));
        backBox.on('pointerdown', () => {
            fadeOutTo(this, () => this.scene.start('MapAndModifierSelectScene'));
        });

        // -----------------------------
        // INPUT
        // -----------------------------

        this.moveSelection = (player, delta) => {
            if (delta === 0) return;

            const length = this.characters.length;

            if (player === 1) {
                this.p1Index = (this.p1Index + delta + length) % length;
            } else {
                this.p2Index = (this.p2Index + delta + length) % length;
            }

            this.sound.play("hover");

            const wheelDirection = Math.sign(delta);

            this.updateCharacterDescriptions(
                player === 1 ? wheelDirection : 0,
                player === 2 ? wheelDirection : 0
            );
        };

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


        /*this.input.on('pointerdown', (pointer) => {
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
        });*/

    },

    update: function () {

        const justDown = key => Phaser.Input.Keyboard.JustDown(this.keys[key]);
        const keyboardDelta = (left, right, up, down) => {
            if (justDown(left)) return -1;
            if (justDown(right)) return 1;
            if (justDown(up)) return -this.verticalStep;
            if (justDown(down)) return this.verticalStep;
            return 0;
        };

        // P1 uses WASD, P2 uses the arrow keys. Both are polled every frame
        // so a key pressed while ready isn't remembered for later.
        const p1KeyDelta = keyboardDelta('a', 'd', 'w', 's');
        const p2KeyDelta = keyboardDelta('left', 'right', 'up', 'down');
        if (!this.p1IsReady) this.moveSelection(1, p1KeyDelta);
        if (!this.p2IsReady) this.moveSelection(2, p2KeyDelta);

        const controllers = getConnectedControllers(this);

        for (let slot = 0; slot < 2; slot++) {
            const pad = controllers[slot];
            const previous = this.controllerPreviousInput[slot];

            if (!pad) {
                this.controllerPreviousInput[slot] = {};
                continue;
            }

            const input = getMenuGamepadInput(pad);

            const justPressed = key =>
                input[key] && !previous[key];

            // Save the current state for edge detection.
            this.controllerPreviousInput[slot] = { ...input };

            // Controller 1 = Player 1; Controller 2 = Player 2.
            const player = slot + 1;

            if (player === 1 && this.p1IsReady) continue;
            if (player === 2 && this.p2IsReady) continue;

            let delta = 0;

            if (justPressed("left")) {
                delta = -1;
            } else if (justPressed("right")) {
                delta = 1;
            } else if (justPressed("up")) {
                delta = -this.verticalStep;
            } else if (justPressed("down")) {
                delta = this.verticalStep;
            }

            this.moveSelection(player, delta);
        }

    }
};
