// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Every playable character and its variants, in character-select order.
// Shared by the character select screen, the online lobby and the LAN server
// (which uses it to reject made-up characters), so add new variants here.
export const CHARACTER_ROSTER = [
    {
        key: 'swordman',
        name: 'SWORDMAN',
        variants: [
            {
                name: 'LONGSWORD',
                desc: 'Beware of the slashing sword. \n\nDIR SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential.',
                color: '#0080ff'
            },
            {
                name: 'DAGGER',
                desc: 'Wow, you can stab faster now isn\'t that cool. \n\nDIR SPECIAL: QUICKSTEP \n\n Use it to phase through your opponent',
                color: '#004b95'
            },
        ]
    },
    {
        key: 'axeman',
        name: 'AXEMAN',
        variants: [
            {
                name: 'LUMBERER',
                desc: 'Beware of the chopping axe. \n\nDIR SPECIAL: POWER SWING \n\n Deal a 34% KB medium knockback strike, weakens your opponent for a bit!',
                color: '#ff4444'
            },
            {
                name: 'CHAINSAW',
                desc: 'Whats better than brutally grinding down your opponent? Building. Press ALT to switch between build and chainsaw mode. Gain wood by digging down. \n\n DIR SPECIAL: RAMPAGE \n\n Doubles your damage output for 1 second.',
                color: '#ffae00',
                fontSize: 17
            }
        ]
    },
    {
        key: 'fisherman',
        name: 'FISHERMAN',
        variants: [
            {
                name: 'ANGLER',
                desc: 'Using a fishing rod as a whip?? \n\nDIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in.',
                color: '#00318d'
            },
            {
                name: 'TRAPPER',
                desc: 'Why catch one fish when you can catch them all? Your third stab pins them to the floor. \n\nDIR SPECIAL: THROW NET \n\n Stuns for 3 seconds, whether it lands on them or they walk into it on the ground.',
                color: '#e0661b',
                fontSize: 17
            }
        ]
    },
    {
        key: 'scytheman',
        name: 'SCYTHEMAN',
        variants: [
            {
                name: 'LANDSCAPER',
                desc: 'Built for my exact purpose, cutting them grass, each cut adds to the damage. \n\nDIR SPECIAL: MOW \n\n A quick grass cutting swipe that deals moderate damage. 2x more power when inside a grass patch.',
                color: '#686868'
            }
        ]
    },
    {
        key: 'hammerman',
        name: 'HAMMERMAN',
        variants: [
            {
                name: 'MALLET',
                desc: 'EVERY hit is a knockback attack. \n\nDIR SPECIAL: SIPHONING REPAIR \n\n Let out a flurry of 3 strikes that siphon KB from your foe!.',
                color: '#3da115'
            },
            {
                name: 'SLEDGEHAMMER',
                    desc: "Now its hammer is REALLY heavy, KILLER damage ouput, at the cost of speed and attack speed. \n\nDIR SPECIAL: QUICKSLAM \n\n A powerful slam attack that sends the opponent flying up. Jumping immediately after will perform a follow-up attack.",
                color: '#a5a5a5',
                fontSize: 16
            }
        ]
    },
    {
        key: 'slateman',
        name: 'SLATEMAN',
        variants: [
            {
                name: 'METAMORPHIC',
                desc: 'Start with extra resistance to attacks. The more damage you take the faster you get, but deal less damage. \n\nDIR SPECIAL: PLUNGE \n\n Apply PLUNGED to your opponent, which makes the foe take 100% more knockback for the next hits within 2.5 seconds!',
                color: '#ffffff',
                fontSize: 17
            }
        ]

    },
    {
        key: 'crowbarman',
        name: 'CROWBARMAN',
        variants: [{
            name: 'HOOKER',
            desc: 'Not for cutting weeds bro. \n\nDIR SPECIAL: GRAB \n\n Grab your opponent and hold them in place for 3 seconds. Press attack again to fling them away. Has a stupidly long range.',
            color: '#68b96b'
        }]
    },
    {
        key: 'gunman',
        name: 'GUNMAN',
        variants: [{
            name: 'GRUNT',
            desc: 'Modern conflicts need modern solutions, just use a gun! \n\n DIR SPECIAL: MINI \n\n This absolute beast shreds down your opponents at the cost of a 10 second cooldown.',
            color: '#e2c542'
        }]
    }
];

export function findCharacter(key) {
    return CHARACTER_ROSTER.find(character => character.key === key) ?? null;
}

export function isValidSelection(key, variant) {
    return Boolean(findCharacter(key)?.variants.some(option => option.name === variant));
}
