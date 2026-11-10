// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { CHAOS_TIERS, FONTS, textStyle } from './theme.js';

const SCREEN = { width: 1000, height: 600 };
const AREA = { top: 40, bottom: 560 };
const CARD_WIDTH = 460;
const MAX_CARD_HEIGHT = 34;
const MAX_SPACING = 12;
const SPACING_RATIO = 0.3;
const SLIDE_MS = 320;
const STAGGER_MS = 90;
const NULLIFY_AFTER_SHARE = 0.75;
const NULLIFY_HOLD_MS = 420;
const NULLIFY_REMOVE_MS = 260;
const HOLD_MS = 900;
const FADE_MS = 300;
const NULLIFIED_TINT = 0xff3030;

function getCardMetrics(count) {
    const available = AREA.bottom - AREA.top;
    const unit = available / (count + (count - 1) * SPACING_RATIO);
    const height = Math.min(MAX_CARD_HEIGHT, unit);
    const spacing = Math.min(MAX_SPACING, height * SPACING_RATIO);
    return { height, spacing };
}

function buildCard(scene, card, y, height) {
    const tier = CHAOS_TIERS[card.tier];
    const fontSize = Math.max(12, Math.round(height * 0.6));
    const startX = SCREEN.width + CARD_WIDTH;
    const background = scene.add.rectangle(startX, y, CARD_WIDTH, height, 0x171717, 0.95)
        .setStrokeStyle(2, tier.hex);
    const name = scene.add.text(startX - CARD_WIDTH / 2 + 14, y, card.name, textStyle('body', {
        fontFamily: FONTS.body,
        fontSize: `${fontSize}px`,
        fill: tier.css
    })).setOrigin(0, 0.5);
    const parts = [background, name];
    if (card.value) {
        parts.push(scene.add.text(startX + CARD_WIDTH / 2 - 14, y, card.value, textStyle('body', {
            fontFamily: FONTS.body,
            fontSize: `${fontSize}px`
        })).setOrigin(1, 0.5));
    }
    scene.hud.add(parts);
    return { card, background, parts, offsets: parts.map(part => part.x - startX) };
}

function moveCard(scene, entry, x, options) {
    entry.parts.forEach((part, index) => {
        scene.tweens.add({ targets: part, x: x + entry.offsets[index], ...options });
    });
}

function removeCard(scene, entry) {
    scene.tweens.add({
        targets: entry.parts,
        alpha: 0,
        duration: NULLIFY_REMOVE_MS,
        onComplete: () => entry.parts.forEach(part => part.destroy())
    });
    entry.removed = true;
}

export function playModifierIntro(scene, cards, onDone) {
    if (cards.length === 0) {
        onDone();
        return;
    }
    const shade = scene.add.rectangle(SCREEN.width / 2, SCREEN.height / 2, SCREEN.width, SCREEN.height, 0x000000, 0);
    scene.hud.add(shade);
    scene.tweens.add({ targets: shade, fillAlpha: 0.72, duration: FADE_MS });

    const { height, spacing } = getCardMetrics(cards.length);
    const totalHeight = cards.length * height + (cards.length - 1) * spacing;
    const firstY = (SCREEN.height - totalHeight) / 2 + height / 2;
    const entries = cards.map((card, index) => buildCard(scene, card, firstY + index * (height + spacing), height));

    entries.forEach((entry, index) => {
        moveCard(scene, entry, SCREEN.width / 2, {
            delay: FADE_MS + index * STAGGER_MS,
            duration: SLIDE_MS,
            ease: 'Cubic.easeOut'
        });
    });

    const allInAt = FADE_MS + (entries.length - 1) * STAGGER_MS + SLIDE_MS;
    const nullifyAt = FADE_MS + Math.ceil((entries.length - 1) * NULLIFY_AFTER_SHARE) * STAGGER_MS + SLIDE_MS;
    const nullified = entries.filter(entry => entry.card.nullified);
    scene.time.delayedCall(nullifyAt, () => {
        for (const entry of nullified) entry.background.setFillStyle(NULLIFIED_TINT, 0.6).setStrokeStyle(2, NULLIFIED_TINT);
    });
    scene.time.delayedCall(nullifyAt + NULLIFY_HOLD_MS, () => {
        for (const entry of nullified) removeCard(scene, entry);
    });

    const endsAt = Math.max(allInAt, nullified.length ? nullifyAt + NULLIFY_HOLD_MS + NULLIFY_REMOVE_MS : 0) + HOLD_MS;
    scene.time.delayedCall(endsAt, () => {
        const remaining = entries.filter(entry => !entry.removed).flatMap(entry => entry.parts);
        scene.tweens.add({
            targets: [...remaining, shade],
            alpha: 0,
            duration: FADE_MS,
            onComplete: () => {
                remaining.forEach(part => part.destroy());
                shade.destroy();
                onDone();
            }
        });
    });
}
