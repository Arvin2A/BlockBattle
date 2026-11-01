// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Checks player names against assets/inappropriate_words (one word or phrase
// per line). The browser and the server each load that file and pass its text
// to createNameFilter, so both sides block the same names.
// A line starting with * is caught anywhere in a name, however short it is.

// Words at least this long are also caught inside longer names ("xxWORDxx").
// Shorter ones only count as a whole word, so names like "glass" or "classic"
// aren't caught by a short word hiding inside them.
const MIN_HIDDEN_WORD_LENGTH = 6;

// Ordinary words that happen to contain a listed word ("therapist").
// They're removed from a name before looking for hidden words.
const SAFE_WORDS = [
    'therapist', 'scraping', 'draping', 'trimming', 'brimming', 'thumping',
    'socialis', 'specialis', 'commercialis', 'provincialis', 'sclerotic', 'snigger',
    'scunthorpe', 'shiitake', 'shitake'
];

// Letters from other alphabets that look like English ones (an iota for an i).
// Names are folded to plain English letters with these, and anything else that
// isn't English is dropped (see toAsciiName).
const CONFUSABLES = {
    // Greek
    'α': 'a', 'β': 'b', 'γ': 'y', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'μ': 'u', 'ν': 'v',
    'ο': 'o', 'ρ': 'p', 'σ': 'o', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ω': 'w', 'ϲ': 'c',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
    'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
    // Cyrillic
    'а': 'a', 'в': 'b', 'г': 'r', 'д': 'd', 'е': 'e', 'з': '3', 'и': 'u', 'к': 'k', 'м': 'm',
    'н': 'h', 'о': 'o', 'п': 'n', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'ь': 'b',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ӏ': 'l', 'ԛ': 'q', 'ԝ': 'w',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C',
    'Т': 'T', 'У': 'Y', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S', 'Ԁ': 'D', 'Ӏ': 'l',
    // Latin letters that don't lose their mark when accents are stripped
    'ı': 'i', 'ł': 'l', 'Ł': 'L', 'ø': 'o', 'Ø': 'O', 'đ': 'd', 'Đ': 'D', 'ħ': 'h', 'ŧ': 't',
    '¡': 'i', 'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE', 'ɡ': 'g', 'ǀ': 'l', 'ɪ': 'i'
};

// Plain English letters, digits and spaces only. Accents and fullwidth letters
// become normal ones, lookalikes from other alphabets become the English letter,
// and everything else (other scripts, emoji, invisible characters) is dropped.
export function toAsciiName(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\x00-\x7f]/g, char => CONFUSABLES[char] ?? '');
}

// Digits and symbols people swap in for letters. 1, l and | can each stand for
// an i or an l, so names are checked both ways.
const LOOKALIKES = {
    '0': 'o', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
    '@': 'a', '$': 's', '!': 'i', '+': 't'
};
const I_OR_L = /[1l|]/g;

function normalize(text, iOrL) {
    return toAsciiName(text)
        .toLowerCase()
        .replace(/[02-9@$!+]/g, char => LOOKALIKES[char])
        .replace(I_OR_L, iOrL);
}

const squash = text => text.replace(/[^a-z0-9]/g, '');

const WILD = '#';

function normalizeWild(text) {
    return toAsciiName(text)
        .toLowerCase()
        .replace(/[0-9*@$!+#%&|^~]/g, WILD)
        .replace(/[^a-z#]/g, ' ');
}

const squashWild = text => text.replace(/ /g, '');

function runPattern(text, wild) {
    return text.replace(/(.)\1*/g, run => {
        const count = `{${run.length},}`;
        if (!'aeiou'.includes(run[0])) return run[0] + count;
        return (wild ? `[${run[0]}${WILD}]` : run[0]) + count + 'h*';
    });
}

function parseEntry(text) {
    return text.split(/(\{[^}]*\})/).filter(Boolean).map(piece => piece.startsWith('{')
        ? piece.slice(1, -1).split('|').map(alt => squash(normalize(alt, '$&')))
        : [squash(normalize(piece, '$&'))]);
}

function entryPattern(pieces, wild) {
    return pieces.map(alts => alts.length === 1
        ? runPattern(alts[0], wild)
        : `(?:${alts.map(alt => runPattern(alt, wild)).join('|')})`).join('');
}

export function createNameFilter(wordListText) {
    const wholeWords = [];
    const hiddenWords = [];
    const wildWholeWords = [];
    const wildHiddenWords = [];
    for (const line of String(wordListText ?? '').split(/\r?\n/)) {
        const anywhere = line.startsWith('*');
        const wholeOnly = line.startsWith('=');
        const pieces = parseEntry(anywhere || wholeOnly ? line.slice(1) : line);
        const word = pieces.map(alts => alts[0]).join('');
        if (!word) continue;
        const hidden = !wholeOnly && (anywhere || word.length >= MIN_HIDDEN_WORD_LENGTH);
        const pattern = entryPattern(pieces, false);
        // A plural s on the end still counts as the whole word.
        wholeWords.push(new RegExp(`^${pattern}s*$`));
        if (hidden) hiddenWords.push(new RegExp(pattern));
        if (!pieces.some(alts => alts.some(alt => /[aeiou]/.test(alt)))) continue;
        const wild = entryPattern(pieces, true);
        wildWholeWords.push(new RegExp(`^${wild}s*$`));
        if (hidden) wildHiddenWords.push(new RegExp(wild));
    }

    function hasWildWord(name) {
        const normalized = normalizeWild(name);
        const parts = normalized.split(/\s+/).filter(Boolean);
        const candidates = [squashWild(normalized), ...parts];
        for (let i = 0; i + 1 < parts.length; i++) {
            if (parts[i].length > 1 || parts[i + 1].length > 1) {
                candidates.push(parts[i] + WILD + parts[i + 1]);
                candidates.push(parts.slice(0, i + 1).join('') + WILD + parts.slice(i + 1).join(''));
            }
        }
        return candidates.some(candidate => {
            if (!candidate.includes(WILD)) return false;
            if (wildWholeWords.some(word => word.test(candidate))) return true;
            const unsafe = SAFE_WORDS.reduce((text, safe) => text.replaceAll(safe, ' '), candidate);
            return wildHiddenWords.some(word => word.test(unsafe));
        });
    }

    return function isNameBlocked(name) {
        if (hasWildWord(name)) return true;
        return ['i', 'l'].some(iOrL => {
            const normalized = normalize(name, iOrL);
            const whole = squash(normalized);
            if (!whole) return false;
            const parts = normalized.split(/[^a-z0-9]+/).filter(Boolean);
            if ([whole, ...parts].some(candidate => wholeWords.some(word => word.test(candidate)))) return true;
            const unsafe = SAFE_WORDS.reduce((text, safe) => text.replaceAll(safe, ' '), whole);
            return hiddenWords.some(word => word.test(unsafe));
        });
    };
}
