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
                abilities: 'DIR SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential. \n\nBLOCK: SWORD GUARD \n\n Block a melee hit and the attacker gets knocked back into hitstun, longer the closer your timing. Projectiles, GUNMAN shots and even SNOWY cannonballs get batted back at whoever sent them. Your shield is weaker than normal, but refills faster. \n\nNEUTRAL SPECIAL: SHEATHE \n\n Put your sword away with a light shove. Sheathed, you run faster. Your next attack is a QUICK DRAW: a quick windup, then a huge slash that hits way harder than your normal swings. You can still block while sheathed, but your shield drains twice as fast. Catch a hit and you QUICK DRAW right into them on top of SWORD GUARD\'s counter. Getting hit during the windup cancels it. Press neutral again to QUICK DRAW right away.',
                color: '#0080ff'
            },
            {
                name: 'DAGGER',
                desc: 'Wow, you can stab faster now isn\'t that cool.',
                abilities: 'DIR SPECIAL: PLUNGE \n\n Dash forward in 5 quick stabs: four 5% hits and a 10% finisher that sends them flying, 30% in total. \n\nNEUTRAL SPECIAL: QUICKSTEP \n\n Vanish in a puff of smoke and reappear a short way off in any direction you hold. Hold up or down with left/right to go diagonally. If you passed through your opponent, you dart right back at them for 7.5%.',
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
                abilities: 'DIR SPECIAL: POWER SWING \n\n Deal a 34% KB medium knockback strike that leaves them CHOPPED for 3 seconds. \n\nCHOPPED \n\n They deal half damage and slow down to 35% speed on the ground and 75% in the air. \n\nNEUTRAL SPECIAL: THROW / RECALL \n\n Throw your axe! It hits for 7%, leaves them CHOPPED for half a second and sticks into whatever it lands on. After 1.5 seconds it RECALLs itself, hitting everyone in its way back for 5%. You can\'t swing until it\'s back in your hands.',
                color: '#ff4444'
            },
            {
                name: 'CHAINSAW',
                desc: 'Whats better than brutally grinding down your opponent? Building.',
                abilities: 'ALT: BUILD MODE \n\n Switch between build and chainsaw mode. Gain wood by digging down. \n\nNEUTRAL SPECIAL: DIG AND BUILD \n\n On the ground, rev the chainsaw into the floor to dig up wood. In the air, drop a wooden plank right under you for 15 wood. \n\nDIR SPECIAL: RAMPAGE \n\n Doubles your damage output for 1 second.',
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
                abilities: 'DIR SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in. \n\nNEUTRAL SPECIAL: FISH THROW \n\n Wind up and fling a fish! It flies a short way and smacks whoever it hits for 6%. There\'s always another fish.',
                color: '#00318d'
            },
            {
                name: 'TRAPPER',
                desc: 'Why catch one fish when you can catch them all? Your third stab pins them to the floor.',
                abilities: 'HARPOONS \n\n You carry up to 5 harpoons, and get one back every 3 seconds. Your stabs reach further while you have one. \n\nNEUTRAL SPECIAL: THROW HARPOON \n\n Throw a harpoon where you are aiming. It breaks through steel walls, or sticks in them if it can\'t. \n\nDIR SPECIAL: THROW NET \n\n Stuns for 2 seconds, whether it lands on them or they walk into it on the ground. It can\'t be blocked or parried. It stops at walls, crashing down if it hits one from the side or landing on top. You move 1.8x faster while they\'re trapped, but hitting them breaks the net.',
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
                abilities: 'ATTACK: PLOW \n\n Push your mower into them and grind until it blows up. It only hits people right in front of the mower, about level with it. Then you only have a PULL CORD for 8 seconds. \n\nALT: RIDE \n\n Hop on for a big speed boost. \n\nNEUTRAL SPECIAL: CLIPPINGS \n\n Spray the grass you cut back at them. Anyone hit is slowed way down and can\'t double jump for a moment. Hold it to keep spraying. \n\nDIR SPECIAL: EJECT \n\n Launch the mower, faster and faster, until it explodes on whatever it hits. \n\nTRIPLE JUMP \n\n Jump a third time by ditching your mower. It crashes down and explodes on whatever it lands on.',
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
                abilities: 'NEUTRAL SPECIAL: STEEL PLANK \n\n Put up a steel wall in front of you, up to 2 at a time. Your swings go right through your own walls. \n\nDIR SPECIAL: SIPHONING REPAIR \n\n Let out a flurry of 3 strikes that siphon KB from your foe! Each strike heals you 5% KB, or 25% if it lands.',
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
                abilities: 'DIR SPECIAL: SLIDE \n\n Apply PLUNGED to your opponent, which makes the foe take 100% more knockback for the next hits within 2.5 seconds! \n\nNEUTRAL SPECIAL: BRACE \n\n On the ground, press it to turn to stone and lock in place. You heal 10% every second, but you\'re stuck for at least 1 second. After that, press it again or any other button to get out. Getting hit breaks the brace, but that hit only does 2/3 of its damage. \n\nIn the air it\'s ROCKFALL: drop straight down like a rock, invincible on the way down, hitting anyone under you for 4%, then land already braced.',
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
        },
        {
            name: 'DEMOLITIONIST',
            desc: 'Measure twice, punch once.',
            abilities: 'ATTACK: TAPE PUNCH \n\n No combo, just one big punch with the fist on the end of your tape measure. It reaches 350px and hits the first person in its way, but you have to wait a second and a half between punches. Your tilts are quick fixed-length pokes. \n\nANCHORED \n\n With the crowbar on your back you\'re slow and jump low, but your punches have no recoil. Without it, every punch pushes you back. \n\nDIR SPECIAL: CROWBAR SLAM \n\n A REALLY slow slam that implants them in the ground. You can keep punching while it winds up. If your crowbar is planted, this calls it back instead. \n\nNEUTRAL SPECIAL: PLANT \n\n Plant your crowbar in the ground, or pick it back up. Punch it with your tape to ZIP straight to it. \n\nSUPER PRY \n\n Plant it at a bottom corner of a platform and downslam onto it 3 times to rip the platform out and drop it on your foe! You can downslam way sooner after jumping than anyone else.',
            color: '#a0522d'
        }]
    },
    {
        key: 'gunman',
        name: 'GUNMAN',
        variants: [{
            name: 'CRAZER',
            desc: 'Modern conflicts need modern solutions, just use a gun!',
            abilities: 'ATTACK: SHOOT \n\n Every 5th shot in a row explodes, followed by a long reload. \n\nNEUTRAL SPECIAL: SHOTGUN \n\n A close-range blast in a cone that hits everyone in front of you and kicks you back a little. 2 shells, then a quick reload. \n\nDIR SPECIAL: MINI \n\n This absolute beast shreds down your opponents. Every bullet hits whoever is first in its line of fire, so it sprays through crowds.',
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
