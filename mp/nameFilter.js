// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Checks player names against assets/inappropriate_words (one word or phrase
// per line). The browser and the server each load that file and pass its text
// to createNameFilter, so both sides block the same names.

// Words at least this long are also caught inside longer names ("xxWORDxx").
// Shorter ones only count as a whole word, so names like "glass" or "classic"
// aren't caught by a short word hiding inside them.
const MIN_HIDDEN_WORD_LENGTH = 6;

// Ordinary words that happen to contain a listed word ("therapist").
// They're removed from a name before looking for hidden words.
const SAFE_WORDS = [
    'therapist', 'scraping', 'draping', 'trimming', 'brimming', 'thumping',
    'socialis', 'specialis', 'commercialis', 'provincialis', 'sclerotic', 'snigger'
];

const LOOKALIKES = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '$': 's', '!': 'i', '|': 'l'
};

function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[0-9@$!|]/g, char => LOOKALIKES[char] ?? char);
}

const squash = text => text.replace(/[^\p{L}\p{N}]/gu, '');

export function createNameFilter(wordListText) {
    const words = new Set();
    const hiddenWords = [];
    for (const line of String(wordListText ?? '').split(/\r?\n/)) {
        const word = squash(normalize(line));
        if (!word) continue;
        words.add(word);
        if (word.length >= MIN_HIDDEN_WORD_LENGTH) hiddenWords.push(word);
    }

    return function isNameBlocked(name) {
        const normalized = normalize(name);
        const parts = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const whole = squash(normalized);
        if (!whole) return false;
        const candidates = [whole, ...parts];
        for (const candidate of candidates) {
            if (words.has(candidate)) return true;
            if (candidate.endsWith('s') && words.has(candidate.slice(0, -1))) return true;
        }
        const unsafe = SAFE_WORDS.reduce((text, safe) => text.replaceAll(safe, ' '), whole);
        return hiddenWords.some(word => unsafe.includes(word));
    };
}
