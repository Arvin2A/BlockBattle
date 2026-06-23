
import { changeBotMode } from "../main.js";
import { preload as bigPreload} from "./GameScene/preload.js";

export const MenuScene = {
    //load the menu scene which is just a cool background image we made
    //its also has the start button, initiating the game when clicked
    key: 'MenuScene',
    preload: bigPreload,
    create: function () {
        const bg = this.add.image(500, 300, 'menuBackground');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        // Create menu UI elements here
        const fade = this.add.image(500, 300, 'uifade');
        fade.setDisplaySize(this.scale.width, this.scale.height);
        const startBox = this.add.rectangle(
            850,
            500,
            250,
            70,
            0x111111
        );
        startBox.setStrokeStyle(4, 0x000000);

        var startText = this.add.text(850, 500, 'PLAY AS 2 PLAYERS', { fontFamily: 'VCROSD', fontSize: '24px', fill: '#FFFFFF', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        startText.setInteractive();
        startText.on('pointerover', function () {
            startBox.setFillStyle(0xffffff);
            startBox.setStrokeStyle(4, 0xbbbbbb);
        });

        startText.on('pointerout', function () {
            startBox.setFillStyle(0x111111);
            startBox.setStrokeStyle(4, 0x000000);
        });
        startText.on('pointerdown', function () {
            changeBotMode(false);
            this.scene.start('CharacterSelectScene');
        }, this);
        const botBox = this.add.rectangle(
            875,
            420,
            200,
            70,
            0x111111
        );
        botBox.setStrokeStyle(4, 0x000000);

        const botText = this.add.text(
            875,
            420,
            'PLAY VS CPU',
            {
                fontFamily: 'VCROSD',
                fontSize: '28px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);
        botText.setInteractive();
        botText.on('pointerdown', function () {
            changeBotMode(true);
            this.scene.start('CharacterSelectScene');
        }, this);
        botText.on('pointerover', function () {
            botBox.setFillStyle(0xffffff);
            botBox.setStrokeStyle(4, 0xbbbbbb);
        });

        botText.on('pointerout', function () {
            botBox.setFillStyle(0x111111);
            botBox.setStrokeStyle(4, 0x000000);
        });
    }
};