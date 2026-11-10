// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { DEFAULT_MAP, MAP_LIST, SECRET_MAPS, getRandomMap } from './GameScene/MapDefinitions.js';
import { preloadMapSelection } from './GameScene/preload.js';
import { fadeOutTo } from './transitions.js';
import { clipScrollablePanel } from '../ui/clipScroll.js';
import { CHAOS_TIERS, FONTS, COLORS, HEX, textStyle } from '../ui/theme.js';
import { formatModifierValue, getEnabledCustomValues, modifierOptions } from '../modifiers.js';

export { getEnabledCustomValues, modifierOptions };
import { moveSelection, createNavigationBox, moveNavigationBox, getConnectedControllers, getMenuGamepadInput } from "../navigation.js"


export let selectedMapDefinition = DEFAULT_MAP;
export let selectedMapIsRandom = false;
export function setSelectedMap(definition) {
	selectedMapDefinition = definition;
	selectedMapIsRandom = false;
}

export function getMatchMapDefinition() {
	if (modifierOptions.INFINITE_BRIDGE.enabled) return SECRET_MAPS.BRIDGE;
	return selectedMapIsRandom ? getRandomMap() : selectedMapDefinition;
}

export function getActiveKillZones(map) {
	const vertical = modifierOptions.NO_VERTICAL_KILLZONE;
	const horizontal = modifierOptions.NO_HORIZONTAL_KILLZONE;
	return {
		vertical: !vertical.enabled,
		horizontal: !map.infinite && !horizontal.enabled,
		verticalWall: vertical.enabled && vertical.collisions,
		horizontalWall: !map.infinite && horizontal.enabled && horizontal.collisions
	};
}

export function getSelectedMapPreview() {
	if (modifierOptions.INFINITE_BRIDGE.enabled) return SECRET_MAPS.BRIDGE.preview;
	return selectedMapIsRandom ? 'randompreview' : selectedMapDefinition.preview;
}

export function addMapBackdrop(scene, textureKey) {
	const images = [0, 1].map(() => scene.add.image(500, 300, textureKey)
		.setDisplaySize(1000, 600)
		.setScrollFactor(0)
		.setDepth(BACKDROP_DEPTH)
		.setAlpha(0));
	images[0].setAlpha(1);
	scene.add.rectangle(500, 300, 1000, 600, 0x1b1b1b, BACKDROP_FADE)
		.setScrollFactor(0)
		.setDepth(BACKDROP_DEPTH + 1);
	let front = 0;
	return textureKey => {
		if (images[front].texture.key === textureKey) return;
		const outgoing = images[front];
		front = 1 - front;
		const incoming = images[front];
		incoming.setTexture(textureKey).setDisplaySize(1000, 600);
		scene.tweens.killTweensOf([outgoing, incoming]);
		scene.tweens.add({ targets: incoming, alpha: 1, duration: BACKDROP_FADE_MS });
		scene.tweens.add({ targets: outgoing, alpha: 0, duration: BACKDROP_FADE_MS });
	};
}

export function resetMapAndModifierSelection() {
	selectedMapDefinition = DEFAULT_MAP;
	selectedMapIsRandom = false;
	Object.values(modifierOptions).forEach(modifier => {
		modifier.enabled = false;
	});
}

const WHEEL = {
	x: 590,
	y: 265,
	cardWidth: 420,
	cardHeight: 230,
	previewWidth: 404,
	previewHeight: 214,
	spacing: 200,
	neighborScale: 0.45,
	neighborAlpha: 0.55,
	hiddenOffset: 330
};
const PAGE_HEIGHT = 600;
const BACKDROP_DEPTH = -20;
const BACKDROP_FADE = 0.9;
const BACKDROP_FADE_MS = 250;
const BUTTON_DEPTH = 10;
const BACK_X = 385;
const NEXT_X = 615;
const SWIPE_MS = 450;
const INFO_X = Math.round((WHEEL.x - WHEEL.cardWidth / 2) / 2);
const MODIFIER_PANEL = { x: 500, y: PAGE_HEIGHT + 315, width: 700, height: 400, cardWidth: 650, cardHeight: 66 };
const CUSTOM_FIELD = { width: 110, height: 32 };
const COLLISION_FIELD_WIDTH = 190;

var currentControllers = [];
var primaryController = null;
var navBox = null;
var layout = [];
var selectedIndex = 0;
var previousInput = {};
var panel;

export class MapAndModifierSelectScene extends Phaser.Scene {
	constructor() {
		super({ key: 'MapAndModifierSelectScene' });
	}

	preload() {
		preloadMapSelection.call(this);
	}

	create(data = {}) {
		this.cameras.main.fadeIn(200, 0, 0, 0);
		this.cameras.main.setBackgroundColor('#1b1b1b');
		this.page = data.page === 'modifiers' ? 'modifiers' : 'maps';

		currentControllers = getConnectedControllers(this);
		primaryController = currentControllers[0] ?? null;
		navBox = null;
		layout = [];
		selectedIndex = 0;
		previousInput = {};
		panel = null;

		this.setBackdrop = addMapBackdrop(this, getSelectedMapPreview());
		this.layouts = {
			maps: this.createMapPage(this.createButtons(0)),
			modifiers: this.createModifierPage(this.createButtons(PAGE_HEIGHT))
		};
		this.cameras.main.setBounds(0, 0, 1000, PAGE_HEIGHT * 2);
		this.cameras.main.scrollY = this.page === 'modifiers' ? PAGE_HEIGHT : 0;
		layout = this.layouts[this.page];
	}

	swipeTo(page) {
		if (this.page === page || this.swiping) return;
		this.page = page;
		this.swiping = true;
		layout = this.layouts[page];
		selectedIndex = 0;
		if (navBox) moveNavigationBox(this, navBox, layout[0].button);
		this.sound.play('hover2');
		this.tweens.add({
			targets: this.cameras.main,
			scrollY: page === 'modifiers' ? PAGE_HEIGHT : 0,
			duration: SWIPE_MS,
			ease: 'Cubic.InOut',
			onComplete: () => { this.swiping = false; }
		});
	}

	goTo(sceneKey, data) {
		fadeOutTo(this, () => this.scene.start(sceneKey, data));
	}

	goBack() {
		if (this.swiping) return;
		if (this.page === 'modifiers') this.swipeTo('maps');
		else this.goTo('MenuScene');
	}

	goNext() {
		if (this.swiping) return;
		if (this.page === 'maps') this.swipeTo('modifiers');
		else this.goTo('CharacterSelectScene');
	}

	createButtons(offsetY) {
		const nextButton = this.add.rectangle(NEXT_X, offsetY + 555, 220, 45, 0x228b22)
			.setDepth(BUTTON_DEPTH)
			.setStrokeStyle(3, 0xffffff)
			.setInteractive({ useHandCursor: true });
		this.add.text(NEXT_X, offsetY + 555, 'NEXT', {
			fontFamily: 'GameFont',
			fontSize: '28px',
			fill: '#ffffff'
		}).setOrigin(0.5).setDepth(BUTTON_DEPTH);
		nextButton.on('pointerover', () => nextButton.setFillStyle(0x2ecc71));
		nextButton.on('pointerout', () => nextButton.setFillStyle(0x228b22));
		nextButton.on('pointerdown', () => this.goNext());

		const backButton = this.add.rectangle(BACK_X, offsetY + 555, 220, 45, 0x686868)
			.setDepth(BUTTON_DEPTH)
			.setStrokeStyle(3, 0xffffff)
			.setInteractive({ useHandCursor: true });
		this.add.text(BACK_X, offsetY + 555, 'BACK', {
			fontFamily: 'GameFont',
			fontSize: '28px',
			fill: '#ffffff'
		}).setOrigin(0.5).setDepth(BUTTON_DEPTH);
		backButton.on('pointerover', () => backButton.setFillStyle(0x888888));
		backButton.on('pointerout', () => backButton.setFillStyle(0x686868));
		backButton.on('pointerdown', () => this.goBack());

		return { backButton, nextButton };
	}

	createMapPage({ backButton, nextButton }) {
		const maps = [
			...MAP_LIST.map(definition => ({ definition, preview: definition.preview, name: definition.name })),
			{ definition: null, random: true, preview: 'randompreview', name: 'RANDOM' }
		];

		this.add.text(INFO_X, WHEEL.y - 115, 'SELECT MAP', {
			fontFamily: FONTS.body,
			fontSize: '38px',
			fill: COLORS.text
		}).setOrigin(0.5);
		this.add.text(INFO_X, WHEEL.y - 75, 'CHOOSE YOUR ARENA', {
			fontFamily: FONTS.title,
			fontSize: '18px',
			fill: COLORS.muted
		}).setOrigin(0.5);
		this.selectedMapName = this.add.text(INFO_X, WHEEL.y, '', {
			fontFamily: FONTS.body,
			fontSize: '28px',
			fill: COLORS.accent,
			align: 'center',
			wordWrap: { width: 300 }
		}).setOrigin(0.5);
		this.selectedMapCount = this.add.text(INFO_X, WHEEL.y + 38, '', {
			fontFamily: FONTS.body,
			fontSize: '16px',
			fill: COLORS.muted
		}).setOrigin(0.5);
		this.add.text(INFO_X, WHEEL.y + 100, 'SCROLL OR PRESS UP / DOWN\nTO BROWSE MAPS', {
			fontFamily: FONTS.body,
			fontSize: '14px',
			fill: COLORS.muted,
			align: 'center'
		}).setOrigin(0.5);

		const selectMap = (index, playSound = true) => {
			const count = maps.length;
			index = (index + count) % count;
			if (maps[index].random) {
				selectedMapIsRandom = true;
			} else {
				selectedMapIsRandom = false;
				selectedMapDefinition = maps[index].definition;
			}
			this.selectedMapIndex = index;
			this.updateMapSelection(true);
			if (playSound) this.sound.play('revolveselect');
		};
		this.selectMap = selectMap;

		this.mapCards = maps.map((map, index) => {
			const preview = this.add.image(WHEEL.x, WHEEL.y, map.preview)
				.setDisplaySize(WHEEL.previewWidth, WHEEL.previewHeight)
				.setInteractive({ useHandCursor: true })
				.setData('silentHover', true);
			const card = this.add.rectangle(WHEEL.x, WHEEL.y, WHEEL.cardWidth, WHEEL.cardHeight, 0x000000, 0)
				.setStrokeStyle(4, 0x686868)
				.setInteractive({ useHandCursor: true })
				.setData('silentHover', true);
			const name = this.add.text(WHEEL.x, WHEEL.y + WHEEL.cardHeight / 2 + 16, map.name, {
				fontFamily: FONTS.body,
				fontSize: '20px',
				fill: COLORS.text
			}).setOrigin(0.5);
			const select = () => {
				if (index !== this.selectedMapIndex) selectMap(index);
			};
			preview.on('pointerdown', select);
			card.on('pointerdown', select);
			return { card, preview, name, previewScaleX: preview.scaleX, previewScaleY: preview.scaleY };
		});

		this.selectedMapIndex = selectedMapIsRandom
			? maps.findIndex(map => map.random)
			: maps.findIndex(map => map.definition === selectedMapDefinition);
		if (this.selectedMapIndex < 0) {
			this.selectedMapIndex = 0;
			selectedMapIsRandom = false;
			selectedMapDefinition = maps[0].definition;
		}

		this.updateMapSelection = (animate = false) => {
			const count = this.mapCards.length;
			const selectedMap = maps[this.selectedMapIndex];
			this.selectedMapName.setText(selectedMap.name);
			this.setBackdrop?.(selectedMap.preview);
			this.selectedMapCount.setText(`MAP ${this.selectedMapIndex + 1} / ${count}`);
			this.mapCards.forEach((mapCard, index) => {
				let offset = (index - this.selectedMapIndex + count) % count;
				if (offset > count / 2) offset -= count;
				const selected = offset === 0;
				const shown = Math.abs(offset) <= 1;
				const targetY = shown ? WHEEL.y + offset * WHEEL.spacing : WHEEL.y + Math.sign(offset) * WHEEL.hiddenOffset;
				const scale = selected ? 1 : WHEEL.neighborScale;
				const alpha = selected ? 1 : shown ? WHEEL.neighborAlpha : 0;
				const nameY = targetY + (WHEEL.cardHeight / 2 + 16) * scale;

				mapCard.card.setStrokeStyle(4, selected ? 0xffffff : 0x686868);
				mapCard.name.setColor(selected ? COLORS.text : '#888888');
				mapCard.card.input.enabled = shown;
				mapCard.preview.input.enabled = shown;
				const objects = [
					{ gameObject: mapCard.preview, y: targetY, scaleX: mapCard.previewScaleX * scale, scaleY: mapCard.previewScaleY * scale },
					{ gameObject: mapCard.card, y: targetY, scaleX: scale, scaleY: scale },
					{ gameObject: mapCard.name, y: nameY, scaleX: scale, scaleY: scale }
				];
				objects.forEach(({ gameObject, y, scaleX, scaleY }) => {
					gameObject.setDepth(selected ? 2 : shown ? 1 : 0);
					this.tweens.killTweensOf(gameObject);
					if (animate) {
						this.tweens.add({
							targets: gameObject,
							x: WHEEL.x,
							y,
							scaleX,
							scaleY,
							alpha,
							duration: 260,
							ease: 'Cubic.Out'
						});
					} else {
						gameObject.setPosition(WHEEL.x, y).setScale(scaleX, scaleY).setAlpha(alpha);
					}
				});
			});
		};
		this.updateMapSelection();

		this.input.on('wheel', (_pointer, _objects, _deltaX, deltaY) => {
			if (this.page !== 'maps' || this.swiping || deltaY === 0) return;
			selectMap(this.selectedMapIndex + Math.sign(deltaY));
		});
		const keys = this.input.keyboard?.addKeys({ up: 'UP', down: 'DOWN', w: 'W', s: 'S' });
		const step = direction => {
			if (this.page === 'maps' && !this.swiping) selectMap(this.selectedMapIndex + direction);
		};
		if (keys) {
			keys.up.on('down', () => step(-1));
			keys.w.on('down', () => step(-1));
			keys.down.on('down', () => step(1));
			keys.s.on('down', () => step(1));
		}

		return [
			{ type: 'map', button: { x: WHEEL.x, y: WHEEL.y, width: WHEEL.cardWidth, height: WHEEL.cardHeight }, action: () => this.goNext() },
			{ type: 'button', button: backButton, action: () => this.goBack() },
			{ type: 'button', button: nextButton, action: () => this.goNext() }
		];
	}

	createModifierHeader(modifier, name) {
		if (modifier.collisionToggle) {
			return this.createValueBoxRow(
				name,
				COLLISION_FIELD_WIDTH,
				() => `COLLISION ${modifier.collisions ? 'ON' : 'OFF'}`,
				() => { modifier.collisions = !modifier.collisions; }
			);
		}
		if (!modifier.clicker) return name;
		const { step, steps } = modifier.clicker;
		return this.createValueBoxRow(
			name,
			CUSTOM_FIELD.width,
			() => formatModifierValue(modifier),
			() => {
				const next = Math.round((modifier.value + step) * 10) / 10;
				modifier.value = next > step * steps + 0.001 ? step : next;
			}
		);
	}

	createValueBoxRow(name, width, getLabel, onClick) {
		const box = this.add.rectangle(0, 0, width, CUSTOM_FIELD.height, HEX.panel)
			.setStrokeStyle(2, HEX.border)
			.setInteractive({ useHandCursor: true });
		const text = this.add.text(0, 0, '', textStyle('body', { fontSize: '20px', align: 'center' }));
		const field = this.rexUI.add.label({
			width,
			height: CUSTOM_FIELD.height,
			background: box,
			text,
			align: 'center'
		});
		const refresh = () => {
			text.setText(getLabel());
			field.layout();
		};
		box.on('pointerdown', pointer => {
			const view = panel.getElement('background').getBounds();
			if (pointer.worldY <= view.top || pointer.worldY >= view.bottom) return;
			onClick();
			refresh();
			this.sound.play('hover');
		});
		const row = this.rexUI.add.sizer({ orientation: 'x' });
		row.add(name, { proportion: 1, expand: true });
		row.add(field, { proportion: 0, align: 'center' });
		refresh();
		return row;
	}

	createModifierPage({ backButton, nextButton }) {
		this.add.text(500, PAGE_HEIGHT + 45, 'MODIFIERS', {
			fontFamily: FONTS.body,
			fontSize: '38px',
			fill: COLORS.text
		}).setOrigin(0.5);
		this.add.text(500, PAGE_HEIGHT + 84, 'MOST CHAOTIC ON TOP. SOME MODIFIERS MAY OVERRIDE OTHERS.', {
			fontFamily: FONTS.body,
			fontSize: '16px',
			fill: COLORS.muted
		}).setOrigin(0.5);

		const content = this.rexUI.add.sizer({
			orientation: 'y',
			width: MODIFIER_PANEL.cardWidth,
			space: { item: 10 }
		});

		panel = this.rexUI.add.scrollablePanel({
			x: MODIFIER_PANEL.x,
			y: MODIFIER_PANEL.y,
			width: MODIFIER_PANEL.width,
			height: MODIFIER_PANEL.height,
			scrollMode: 0,
			background: this.add.rectangle(0, 0, MODIFIER_PANEL.width, MODIFIER_PANEL.height, 0x171717)
				.setStrokeStyle(3, 0x686868),
			panel: { child: content, mask: false },
			sliderY: {
				track: this.add.rectangle(0, 0, 12, 0, 0x555555),
				thumb: this.add.rectangle(0, 0, 12, 50, 0xaaaaaa)
			},
			scroller: {
				rectBoundsInteractive: true,
				threshold: 5,
				slidingDeceleration: 5000,
				backDeceleration: 2000
			},
			space: { left: 10, right: 10, top: 10, bottom: 10, panel: 10 },
			mouseWheelScroller: { focus: 2, speed: 0.1 }
		});

		const ordered = Object.keys(modifierOptions)
			.map((modifierKey, order) => ({ modifierKey, order }))
			.sort((a, b) => (CHAOS_TIERS[modifierOptions[a.modifierKey].tier].rank - CHAOS_TIERS[modifierOptions[b.modifierKey].tier].rank) || (a.order - b.order));

		this.modifierCards = ordered.map(({ modifierKey }) => {
			const modifier = modifierOptions[modifierKey];
			const tier = CHAOS_TIERS[modifier.tier];
			const card = this.rexUI.add.sizer({
				orientation: 'y',
				width: MODIFIER_PANEL.cardWidth,
				height: MODIFIER_PANEL.cardHeight,
				space: { left: 16, right: 16, top: 8, bottom: 8, item: 4 }
			});
			const background = this.add.rectangle(0, 0, MODIFIER_PANEL.cardWidth, MODIFIER_PANEL.cardHeight, tier.hex, 0)
				.setStrokeStyle(3, tier.hex);
			card.addBackground(background);
			const name = this.add.text(0, 0, modifier.name, {
				fontFamily: FONTS.body,
				fontSize: '26px',
				fill: tier.css
			});
			const description = this.add.text(0, 0, modifier.description, {
				fontFamily: FONTS.body,
				fontSize: '16px',
				fill: COLORS.muted
			});
			card.add(this.createModifierHeader(modifier, name), { expand: true });
			card.add(description, { expand: true });
			card.layout();
			card.setInteractive({ useHandCursor: true });
			card.setData('silentHover', true);
			const toggle = () => {
				modifier.enabled = !modifier.enabled;
				this.updateModifierSelection();
				this.sound.play('hover');
			};
			card.on('pointerdown', pointer => {
				const window = panel.getElement('background').getBounds();
				if (pointer.worldY > window.top && pointer.worldY < window.bottom) toggle();
			});
			card.on('pointerover', () => card.setAlpha(0.85));
			card.on('pointerout', () => card.setAlpha(1));
			content.add(card, { expand: true });
			return { card, background, name, description, modifierKey, tier, toggle };
		});

		panel.layout();
		clipScrollablePanel(this, panel, { inset: 6 });

		this.updateModifierSelection = () => {
			this.modifierCards.forEach(modifierCard => {
				const enabled = modifierOptions[modifierCard.modifierKey].enabled;
				modifierCard.background
					.setFillStyle(modifierCard.tier.hex, enabled ? 0.22 : 0)
					.setStrokeStyle(enabled ? 4 : 2, modifierCard.tier.hex, enabled ? 1 : 0.45);
				modifierCard.name.setAlpha(enabled ? 1 : 0.6);
				modifierCard.description.setColor(enabled ? COLORS.text : '#888888');
			});
		};
		this.updateModifierSelection();

		return [
			...this.modifierCards.map((modifierCard, index) => ({
				type: 'modifier',
				index,
				button: modifierCard.card,
				action: modifierCard.toggle
			})),
			{ type: 'button', button: backButton, action: () => this.goBack() },
			{ type: 'button', button: nextButton, action: () => this.goNext() }
		];
	}

	update() {
		currentControllers = getConnectedControllers(this);
		primaryController = currentControllers[0] ?? null;
		if (!primaryController || !layout.length) return;

		if (!navBox) {
			navBox = createNavigationBox(this, {
				color: 0xffffff,
				lineWidth: 3,
				padding: 8,
				duration: 150,
				depth: 1000
			});
			moveNavigationBox(this, navBox, layout[selectedIndex].button);
		}

		const input = getMenuGamepadInput(primaryController);
		const justPressed = key => input[key] && !previousInput[key];
		const onMapWheel = layout[selectedIndex].type === 'map';

		if (onMapWheel && (justPressed('up') || justPressed('down'))) {
			this.selectMap(this.selectedMapIndex + (justPressed('up') ? -1 : 1));
		} else {
			let direction = 0;
			if (justPressed('left') || justPressed('up')) direction = -1;
			else if (justPressed('right') || justPressed('down')) direction = 1;
			if (direction !== 0) {
				selectedIndex = moveSelection(selectedIndex, direction, layout.length);
				const selected = layout[selectedIndex];
				if (selected.type === 'modifier') panel?.scrollToChild(this.modifierCards[selected.index].card);
				moveNavigationBox(this, navBox, selected.button);
			}
		}

		if (justPressed('a')) layout[selectedIndex].action();
		previousInput = { ...input };
	}
}
