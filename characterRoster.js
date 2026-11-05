// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Every playable character and its variants, in character-select order.
// Shared by the character select screen, the online lobby and the online server
// (which uses it to reject made-up characters), so add new variants here.
export const CHARACTER_ROSTER = [
    {
        key: 'swordman',
        name: 'SWORDMAN',
        variants: [
            {
                name: 'LONGSWORD',
                desc: 'Beware of the slashing sword.',
                abilities: 'DIR SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential.',
                color: '#0080ff'
            },
            {
                name: 'DAGGER',
                desc: 'Wow, you can stab faster now isn\'t that cool.',
                abilities: 'DIR SPECIAL: QUICKSTEP \n\n Use it to phase through your opponent.',
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
                desc: 'Beware of the chopping axe.',
                abilities: 'DIR SPECIAL: POWER SWING \n\n Deal a 34% KB medium knockback strike, weakens your opponent for a bit!',
                color: '#ff4444'
            },
            {
                name: 'CHAINSAW',
                desc: 'Whats better than brutally grinding down your opponent? Building.',
                abilities: 'ALT: BUILD MODE \n\n Switch between build and chainsaw mode. Gain wood by digging down. \n\nDIR SPECIAL: RAMPAGE \n\n Doubles your damage output for 1 second.',
                color: '#ffae00'
            }
        ]
    },
    {
        key: 'fisherman',
        name: 'FISHERMAN',
        variants: [
            {
                name: 'ANGLER',
                desc: 'Using a fishing rod as a whip??',
                abilities: 'DIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in.',
                color: '#00318d'
            },
            {
                name: 'TRAPPER',
                desc: 'Why catch one fish when you can catch them all? Your third stab pins them to the floor.',
                abilities: 'DIR SPECIAL: THROW NET \n\n Stuns for 3 seconds, whether it lands on them or they walk into it on the ground.',
                color: '#e0661b'
            }
        ]
    },
    {
        key: 'scytheman',
        name: 'SCYTHEMAN',
        variants: [
            {
                name: 'LANDSCAPER',
                desc: 'Built for my exact purpose, cutting them grass. Grass grows wherever you walk, and each cut of your grass makes you harder to launch.',
                abilities: 'NEUTRAL SPECIAL: SOW \n\n Toss out 7 seeds that grow grass where they land. Spam it as fast as you like. \n\nDIR SPECIAL: GRUELING SLAM \n\n A giant scythe crash that pins them down.',
                color: '#686868'
            },
            {
                name: 'LAWNMOWER',
                desc: 'Mow them down. Push it, ride it or launch it, and cut grass to keep it running.',
                abilities: 'ATTACK: PLOW \n\n Push your mower into them and grind until it blows up. Then you only have a PULL CORD for 8 seconds. \n\nALT: RIDE \n\n Hop on for a big speed boost. \n\nNEUTRAL SPECIAL: CLIPPINGS \n\n Spray the grass you cut back at them. Anyone hit is slowed way down and can\'t double jump for a moment. Hold it to keep spraying. \n\nDIR SPECIAL: EJECT \n\n Launch the mower, faster and faster, until it explodes on whatever it hits. \n\nTRIPLE JUMP \n\n Jump a third time by ditching your mower. It crashes down and explodes on whatever it lands on.',
                color: '#7d9474'
            }
        ]
    },
    {
        key: 'hammerman',
        name: 'HAMMERMAN',
        variants: [
            {
                name: 'MALLET',
                desc: 'EVERY hit is a knockback attack.',
                abilities: 'NEUTRAL SPECIAL: STEEL PLANK \n\n Put up a steel wall in front of you, up to 2 at a time. Your swings go right through your own walls. \n\nDIR SPECIAL: SIPHONING REPAIR \n\n Let out a flurry of 3 strikes that siphon KB from your foe!',
                color: '#3da115'
            },
            {
                name: 'SLEDGEHAMMER',
                desc: 'Now its hammer is REALLY heavy, KILLER damage output, at the cost of speed and attack speed.',
                abilities: 'NEUTRAL SPECIAL: THICK STEEL PLANK \n\n One extra tough wall at a time. It blocks your swings too. \n\nDIR SPECIAL: QUICKSLAM \n\n A powerful slam attack that sends the opponent flying up. Jumping immediately after will perform a follow-up attack.',
                color: '#a5a5a5'
            }
        ]
    },
    {
        key: 'slateman',
        name: 'SLATEMAN',
        variants: [
            {
                name: 'METAMORPHIC',
                desc: 'Start with extra resistance to attacks. The more damage you take the faster you get, but deal less damage.',
                abilities: 'DIR SPECIAL: SLIDE \n\n Apply PLUNGED to your opponent, which makes the foe take 100% more knockback for the next hits within 2.5 seconds!',
                color: '#ffffff'
            }
        ]

    },
    {
        key: 'crowbarman',
        name: 'CROWBARMAN',
        variants: [{
            name: 'HOOKER',
            desc: 'Not for cutting weeds bro.',
            abilities: 'DIR SPECIAL: GRAB \n\n Grab your opponent and hold them in place for 3 seconds. Press attack again to fling them away. Has a stupidly long range.',
            color: '#68b96b'
        }]
    },
    {
        key: 'gunman',
        name: 'GUNMAN',
        variants: [{
            name: 'CRAZER',
            desc: 'Modern conflicts need modern solutions, just use a gun!',
            abilities: 'NEUTRAL SPECIAL: CHUCK \n\n Lob a grenade that explodes when it hits. \n\nDIR SPECIAL: MINI \n\n This absolute beast shreds down your opponents.',
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
