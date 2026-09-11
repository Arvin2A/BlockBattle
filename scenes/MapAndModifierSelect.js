import { DEFAULT_MAP, SNOWY_MAP } from './GameScene/MapDefinitions.js';
import { preload as bigPreload } from './GameScene/preload.js';
import { config } from '../main.js';

export let selectedMapDefinition = DEFAULT_MAP;
export const modifierOptions = {
    SUDDEN_DEATH: {
        name: 'SUDDEN DEATH',
        description: 'Players start off with 300% damage.',
        enabled: false
    },
	MAP_HAZARDS: {
        name: 'MAP HAZARDS',
        description: 'Maps now have a chance for disasters to occur!.',
        enabled: false
    },
	NO_ABILITY_COOLDOWN: {
        name: 'NO ABILITY COOLDOWNS',
        description: 'spam spam spam spam spams spam sapm.',
        enabled: false
    },
    DOUBLE_DAMAGE: {
        name: 'DOUBLE DAMAGE',
        description: 'Players deal 200% more damage.',
        enabled: false
    },
	FAST: {
        name: 'FAST',
        description: 'Players have 150% Movement Speed.',
        enabled: false
    },
    HYPERACTIVE: {
        name: 'HYPERACTIVE',
        description: '200% Movement Speed and Halved Cooldowns.',
        enabled: false
    },
    SLUGGISH: {
        name: 'SLUGGISH',
        description: 'Players have 50% Movement Speed.',
        enabled: false
    },
    SUPER_SLUGGISH: {
        name: 'SUPER SLUGGISH',
        description: 'Players have 25% Movement Speed. Why bro??',
        enabled: false
    }

};

export function resetMapAndModifierSelection() {
	selectedMapDefinition = DEFAULT_MAP;
	Object.values(modifierOptions).forEach(modifier => {
		modifier.enabled = false;
	});
}

export const MapAndModifierSelectScene = {
	key: 'MapAndModifierSelectScene',
	preload: bigPreload,
	create: function () {
		const maps = [
			{ definition: DEFAULT_MAP, preview: 'desertpreview', name: 'DESERT ARENA' },
			{ definition: SNOWY_MAP, preview: 'snowypreview', name: 'SNOWY ARENA' }
		];


		this.cameras.main.setBackgroundColor('#1b1b1b');
		this.add.text(500, 50, 'SELECT MAP', {
			fontFamily: 'VCROSD',
			fontSize: '38px',
			fill: '#ffffff',
			stroke: '#000000',
			strokeThickness: 6
		}).setOrigin(0.5);

		this.add.text(500, 105, 'CHOOSE YOUR ARENA', {
			fontFamily: 'GameFont',
			fontSize: '20px',
			fill: '#bbbbbb'
		}).setOrigin(0.5);

		//this.add.rectangle(820, 330, 300, 400, 0x171717).setStrokeStyle(3, 0x686868);

		const content = this.rexUI.add.sizer({
			orientation: 'y',
			width: 280,
			space: {
				item: 10
			}
		});

		const panel = this.rexUI.add.scrollablePanel({
			x: 820,
			y: 380,
			width: 300,
			height: 330,

			scrollMode: 0,

			background: this.add.rectangle(
				0, 0, 300, 400, 0x171717
			).setStrokeStyle(3, 0x686868),

			panel: {
				child: content,
				mask: {
					padding: 0
				}
			},

			sliderY: {
				track: this.add.rectangle(
					0, 0, 12, 0, 0x555555
				),
				thumb: this.add.rectangle(
					0, 0, 12, 50, 0xaaaaaa
				)
			},

			scroller: {
				rectBoundsInteractive: true,
				threshold: 5,
				slidingDeceleration: 5000,
				backDeceleration: 2000
			},

			space: {
				left: 10,
				right: 10,
				top: 10,
				bottom: 10,
				panel: 10
			},
			mouseWheelScroller: {
				focus: 2,
				speed: 0.1
			},
		});

		this.add.text(820, 170, 'MODIFIERS', {
			fontFamily: 'VCROSD',
			fontSize: '28px',
			fill: '#ffffff'
		}).setOrigin(0.5);
        this.add.text(820, 200, 'SOME MODIFIERS MAY OVERRIDE OTHERS', {
			fontFamily: 'VCROSD',
			fontSize: '12px',
			fill: '#c50000'
		}).setOrigin(0.5);
		

		this.mapCards = maps.map((map, index) => {
			const x = 255 + index * 275;
			const preview = this.add.image(x, 320, map.preview)
				.setDisplaySize(240, 200)
				.setInteractive({ useHandCursor: true });
			const card = this.add.rectangle(x, 320, 250, 320, 0x000000, 0)
				.setStrokeStyle(4, 0x686868)
				.setInteractive({ useHandCursor: true });
			const name = this.add.text(x, 510, map.name, {
				fontFamily: 'VCROSD',
				fontSize: '21px',
				fill: '#ffffff'
			}).setOrigin(0.5);

			const select = () => {
				selectedMapDefinition = map.definition;
				this.selectedMapIndex = index;
				this.updateMapSelection();
				this.sound.play('hover');
			};


			preview.on('pointerdown', select);
			card.on('pointerdown', select);
			preview.on('pointerover', () => card.setAlpha(0.8));
			preview.on('pointerout', () => card.setAlpha(1));

			return { card, preview, name };
		});

        this.modifierCards = Object.keys(modifierOptions).map((modifierKey, index) => {
            const modifier = modifierOptions[modifierKey];

			const card = this.rexUI.add.sizer({
				orientation: 'y',
				width: 280,
				height: 50,
				space: {
					left: 10,
					right: 10,
					top: 5,
					bottom: 5,
					item: 1
				}
			});
			const background = this.add.rectangle(0, 0, 280, 50, 0x000000, 0)
				.setStrokeStyle(3, 0x686868);
			card.addBackground(background);

			const name = this.add.text(0, 0, modifier.name, {
                fontFamily: 'VCROSD',
                fontSize: '18px',
                fill: '#ffffff'
			});
			const description = this.add.text(0, 0, modifier.description, {
                fontFamily: 'GameFont',
                fontSize: '8px',
                fill: '#bbbbbb'
			});

			card.add(name, { expand: true });
			card.add(description, { expand: true });
			card.layout();
			card.setInteractive({ useHandCursor: true });

            const toggleModifier = () => {
                modifier.enabled = !modifier.enabled;
                this.updateModifierSelection();
                this.sound.play('hover');
            };

			content.add(card, { expand: true });

            card.on('pointerdown', toggleModifier);
            card.on('pointerover', () => card.setAlpha(0.8));
            card.on('pointerout', () => card.setAlpha(1));

			return { card, background, name, description, modifierKey };
        });

		panel.layout();

		this.selectedMapIndex = maps.findIndex(map => map.definition === selectedMapDefinition);
		if (this.selectedMapIndex < 0) this.selectedMapIndex = 0;
		selectedMapDefinition = maps[this.selectedMapIndex].definition;

		this.updateMapSelection = () => {
			this.mapCards.forEach((mapCard, index) => {
				const selected = index === this.selectedMapIndex;
				mapCard.card.setStrokeStyle(4, selected ? 0xffffff : 0x686868);
				mapCard.preview.setAlpha(selected ? 1 : 0.65);
				mapCard.name.setColor(selected ? '#ffffff' : '#888888');
			});
		};
		this.updateMapSelection();

        this.updateModifierSelection = () => {
            this.modifierCards.forEach(modifierCard => {
                const modifier = modifierOptions[modifierCard.modifierKey];
                const selected = modifier.enabled;
				modifierCard.background.setStrokeStyle(3, selected ? 0xffffff : 0x686868);
                modifierCard.name.setColor(selected ? '#ffffff' : '#888888');
                modifierCard.description.setColor(selected ? '#ffffff' : '#888888');
            });
        }

		const playButton = this.add.rectangle(500, 555, 220, 45, 0x228b22)
			.setStrokeStyle(3, 0xffffff)
			.setInteractive({ useHandCursor: true });
		this.add.text(500, 555, 'NEXT', {
			fontFamily: 'GameFont',
			fontSize: '28px',
			fill: '#ffffff'
		}).setOrigin(0.5);
		playButton.on('pointerover', () => playButton.setFillStyle(0x2ecc71));
		playButton.on('pointerout', () => playButton.setFillStyle(0x228b22));
		playButton.on('pointerdown', () => this.scene.start('CharacterSelectScene'));
	}
};
