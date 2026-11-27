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
                abilities: 'SIDE SPECIAL: LUNGE \n\n Mediocre knockback on hit, however it has insane clutch potential. \n\n{new@2026-11-27}UP / DOWN SPECIAL: DOUBLE LUNGE \n\n Two quick lunges. The first goes diagonally up or down, and if it catches someone you carry them along on your sword. The second one goes straight left or right (hold either to pick), always hits whoever you\'re carrying and sends them flying.{/new} \n\nBLOCK: SWORD GUARD \n\n Block a melee hit and the attacker gets knocked back into hitstun, longer the closer your timing. Projectiles, GUNMAN shots and even SNOWY cannonballs get batted back at whoever sent them. Your shield is weaker than normal, but refills faster. \n\nNEUTRAL SPECIAL: SHEATHE \n\n Put your sword away with a light shove. Sheathed, you run faster. Your next attack is a QUICK DRAW: a windup, then a huge slash that can\'t be blocked and hits way harder than your normal swings. You can still block while sheathed, but your shield drains twice as fast. Catch a hit and you QUICK DRAW right into them on top of SWORD GUARD\'s counter. Getting hit during the windup cancels it. Press neutral again to QUICK DRAW right away.',
                color: '#0080ff'
            },
            {
                name: 'DAGGER',
                desc: 'Wow, you can stab faster now isn\'t that cool.',
                abilities: 'SIDE SPECIAL: PLUNGE \n\n Dash forward in 5 quick stabs: four 5% hits and a 10% finisher that sends them flying, 30% in total. \n\nNEUTRAL SPECIAL: QUICKSTEP \n\n Vanish in a puff of smoke and reappear a short way off in any direction you hold. Hold up or down with left/right to go diagonally. If you passed through your opponent, you dart right back at them for 7.5%. \n\n{new@2026-11-27}UP / DOWN SPECIAL: DASH \n\n A quick, short dash diagonally up or down. The first person you run into gets shoved away for 20%.{/new}',
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
                abilities: 'SIDE SPECIAL: POWER SWING \n\n Deal a 34% KB medium knockback strike that leaves them CHOPPED for {changed@2026-11-27}2 seconds, only if it isn\'t blocked{/changed}. \n\n{new@2026-11-27}UP / DOWN SPECIAL: POWER SWING \n\n Dash 45° up or down into the same swing. It launches them along that diagonal and still leaves them CHOPPED.{/new} \n\nCHOPPED \n\n They deal half damage and slow down to 35% speed on the ground and 75% in the air. \n\nNEUTRAL SPECIAL: THROW / RECALL \n\n Throw your axe! It hits for 7%, leaves them CHOPPED for half a second and sticks into whatever it lands on. After 1.5 seconds it RECALLs itself, hitting everyone in its way back for 5%. You can\'t swing until it\'s back in your hands.',
                color: '#ff4444'
            },
            {
                name: 'CHAINSAW',
                desc: 'Whats better than brutally grinding down your opponent? Building.',
                abilities: 'ALT: BUILD MODE \n\n Switch between build and chainsaw mode. Gain wood by digging down. \n\nNEUTRAL SPECIAL: DIG AND BUILD \n\n On the ground, rev the chainsaw into the floor to dig up wood. In the air, drop a wooden plank right under you for 15 wood. \n\nSIDE SPECIAL: RAMPAGE \n\n Doubles your damage output for 1 second, and shoots your chainsaw out on a cord for extra reach before reeling it back in. If they block it, you bounce back and your saw shuts off. \n\n{new@2026-11-27}UP / DOWN SPECIAL: RAMPAGE \n\n Hold up to aim it upward: it grinds them for a moment without exploding, shaking them hard, then launches them mostly straight up. Hold down to TEAR DOWN: in the air you grind whoever is under you the same way, then slam them downward. On the ground you rip into the floor, hitting anyone right next to you.{/new}',
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
                abilities: 'SIDE SPECIAL: GRAPPLE \n\n Throw your hook far for the chance to reel your opponent in. \n\n{new@2026-11-27}UP SPECIAL: GRAPPLE UP \n\n Cast the hook almost straight up. Catch a platform and it pulls you up to stand on it. Catch a fighter and you reel them down to you.{/new} \n\n{new@2026-11-27}DOWN SPECIAL: GRAPPLE DOWN \n\n Cast the hook below you and reel whoever it catches straight up to you for 15%. It never grabs platforms.{/new} \n\nNEUTRAL SPECIAL: FISH THROW \n\n Wind up and fling a fish! It flies a short way and smacks whoever it hits for 6%. You carry 5 fish on your back, and you get one back every 3 seconds.',
                color: '#00318d'
            },
            {
                name: 'TRAPPER',
                desc: 'Why catch one fish when you can catch them all? Your third stab pins them to the floor.',
                abilities: '{changed@2026-11-27}HARPOONS \n\n You carry up to 5 harpoons, and get one back every 3 seconds. While you have one, landing a stab leaves the harpoon in them, shoves them forward and dashes you part of the way after them. Stab again to do it again, and your third hit knocks them away a set distance, and they can\'t act until they touch the ground. Each landed stab uses a harpoon, so 3 harpoons is 2 dashing stabs and a finisher. Out of harpoons, you fight with your fists.{/changed} \n\nNEUTRAL SPECIAL: THROW HARPOON \n\n Throw a harpoon where you are aiming. It breaks through steel walls, or sticks in them if it can\'t. \n\nSIDE SPECIAL: THROW NET \n\n Stuns for 1.5 seconds, whether it lands on them or they walk into it on the ground. It can\'t be blocked or parried. It stops at walls, crashing down if it hits one from the side or landing on top. {changed@2026-11-27}It takes two hits to break the net.{/changed} \n\n{new@2026-11-27}UP SPECIAL: SPEARFISH \n\n Shoot up at an angle toward where you face with a harpoon out. The first fighter in your path gets skewered (6%) and carried along, then hit with a flurry of 8 rapid stabs (10% total) and flung off the end (10%), with the harpoon left in them.{/new} \n\n{new@2026-11-27}DOWN SPECIAL: HARPOON DIVE \n\n Air only. Dive harpoon-first steeply down, leaning a little toward where you face. Run into a fighter, or land right next to one, and you hit them with a flurry of 8 rapid stabs (10% total), then launch them down along the dive (12%). If they\'re on the ground, they get launched up instead.{/new} \n\n{new@2026-11-27}SPEARFISH and HARPOON DIVE need a harpoon, and only use it up if they land.{/new}',
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
                abilities: 'NEUTRAL SPECIAL: SOW \n\n Toss out 7 seeds that grow grass where they land. Spam it as fast as you like. \n\n{changed@2026-11-27}SIDE SPECIAL: GRUELING SLAM \n\n A giant scythe crash that pins them down. You get a little hop forward and up at the bottom of the swing, about a jump.{/changed} \n\n{new@2026-11-27}UP SPECIAL: UP REAP \n\n Wind the scythe back, then reap over your head. Anyone above takes 15% and gets slammed down and pinned.{/new} \n\n{new@2026-11-27}DOWN SPECIAL: WHIRL DROP \n\n Air only. Drop fast with the scythe spinning around you. Land on someone for 15% and pin them, then bounce off.{/new}',
                color: '#686868'
            },
            {
                name: 'LAWNMOWER',
                desc: 'Mow them down. Push it, ride it or launch it, and cut grass to keep it running.',
                abilities: 'ATTACK: PLOW \n\n Push your mower into them and grind until it blows up. It only hits people right in front of the mower, about level with it. {changed@2026-11-27}Then you only have a PULL CORD for 10 seconds, getting shorter with every grass you cut until it\'s half that at 150 cuts.{/changed} \n\nALT: RIDE \n\n Hop on for a big speed boost. {changed@2026-11-27}Getting hit while riding blows the mower up under you (8%), and it\'s back a second later.{/changed} \n\nNEUTRAL SPECIAL: CLIPPINGS \n\n Spray the grass you cut back at them. Anyone hit is slowed way down and can\'t double jump for a moment. Hold it to keep spraying. \n\nSIDE SPECIAL: EJECT \n\n Launch the mower, faster and faster, until it explodes on whatever it hits. {changed@2026-11-27}It speeds up even more through grass.{/changed} \n\n{new@2026-11-27}UP SPECIAL: LAUNCH \n\n Tilt the mower up while the engine revs, then it blows up and you headbutt diagonally up for 18% and huge knockback, easing into a fall. Uses up the mower.{/new} \n\n{new@2026-11-27}DOWN SPECIAL: CRASH RIDE \n\n Air only. Ride the mower down sideways like a skateboard. Land on someone to grind them, then it explodes for 20% (uses up the mower). Hit the floor and you bounce back off it.{/new}',
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
                abilities: 'NEUTRAL SPECIAL: STEEL PLANK \n\n Put up a steel wall in front of you, up to 2 at a time. Your swings go right through your own walls. \n\n{changed@2026-11-27}SIDE SPECIAL: SIPHONING REPAIR \n\n Let out a flurry of 3 strikes that siphon KB from your foe! Each strike heals you 3.75% KB, or 18.75% if it lands.{/changed} \n\n{new@2026-11-27}UP / DOWN SPECIAL: TRIPLE DASH \n\n Three short dashes at 45° up or down, swinging the mallet at each stop: forward, backward, forward. The first swing that lands (6%) grabs them and drags them along in front of the mallet, so they take every swing after it, and the last one launches them along the dash (12%).{/new}',
                color: '#3da115'
            },
            {
                name: 'SLEDGEHAMMER',
                desc: 'Now its hammer is REALLY heavy, KILLER damage output, at the cost of speed and attack speed.',
                abilities: 'NEUTRAL SPECIAL: THICK STEEL PLANK \n\n One extra tough wall at a time. It blocks your swings too. {changed@2026-11-27}Even when it breaks, it still stops the attack that broke it, and RECOIL BLAST can\'t pierce it.{/changed} \n\n{changed@2026-11-27}SIDE SPECIAL: QUICKSLAM \n\n A powerful slam attack that sends the opponent flying up, then you automatically leap after them and slam them right back down.{/changed} \n\n{new@2026-11-27}UP SPECIAL: WHIRLWIND \n\n Spin the sledgehammer around you while shooting straight up, hitting three times. Anyone who touches the spin before the last hit gets caught and dragged up with you, and the third hit launches them sideways the way you face.{/new} \n\n{new@2026-11-27}DOWN SPECIAL: DOWN SLAM \n\n A quick downward slam that hits whoever is in front of or below you. Weaker than QUICKSLAM, but it hits harder the more KB they have. In the air it knocks them down; on the ground it pops them up.{/new}',
                color: '#a5a5a5'
            }
        ]
    },
    {
        key: 'rockman',
        name: 'ROCKMAN',
        variants: [
            {
                name: 'SLATE',
                desc: 'Start with extra resistance to attacks. The more damage you take the faster you get, but deal less damage.',
                abilities: 'SIDE SPECIAL: SLIDE \n\n Apply PLUNGED to your opponent, which makes the foe take 100% more knockback for the next hits within {changed@2026-11-27}about 1.7 seconds, only if it isn\'t blocked{/changed}! \n\n{new@2026-11-27}UP / DOWN SPECIAL: PLUNGEDASH \n\n Dash diagonally up or down with your dagger out. Anyone it catches is PLUNGED too.{/new} \n\nNEUTRAL SPECIAL: BRACE \n\n On the ground, press it to turn to stone and lock in place. You heal 10% every second, but you\'re stuck for at least 1 second. After that, press it again or any other button to get out. Getting hit breaks the brace, but that hit only does 2/3 of its damage. \n\nIn the air it\'s ROCKFALL: drop straight down like a rock, invincible on the way down, hitting anyone under you for 4%, then land already braced.',
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
            abilities: 'SIDE SPECIAL: GRAB \n\n Grab your opponent and hold them in place for 3 seconds. Press attack again to fling them away. Has a stupidly long range. \n\n{new@2026-11-27}UP / DOWN SPECIAL: GRAB \n\n Grab someone above or below you instead. Grabbed from above, the fling slams them down. Grabbed from below, it flings them up.{/new} \n\nNEUTRAL SPECIAL: CROWBAR VAULT \n\n On the ground, plant a crowbar and vault way up into the air. You can vault again once it spins back to you.',
            color: '#68b96b'
        },
        {
            name: 'DEMOLITIONIST',
            desc: 'Measure twice, punch once.',
            abilities: 'ATTACK: TAPE PUNCH \n\n No combo, just one big punch with the fist on the end of your tape measure. It reaches 250px and hits the first person in its way, but each punch takes a full second to wind back in. Your tilts are quick fixed-length pokes. \n\nANCHORED \n\n With the crowbar on your back you\'re slow and jump low, but your punches have no recoil. Without it, every punch pushes you back. \n\nSIDE SPECIAL: CROWBAR SLAM \n\n Charge forward fast (no turning around!) into an overhead slam that SMACKS DOWN whoever it hits. You\'re slowed for a moment after it lands. You can keep punching while it winds up. If your crowbar is planted, this calls it back instead. \n\n{new@2026-11-27}UP SPECIAL: POGO SLAM \n\n Shoot the tape measure into the ground to bounce up, then bring the crowbar down left or right, spiking whoever it hits downward (20%).{/new} \n\n{new@2026-11-27}DOWN SPECIAL: SLAM DROP \n\n Air only. Fall fast with the crowbar raised and SMACK DOWN whoever you land next to. If your crowbar is planted, any special direction calls it back instead.{/new} \n\nNEUTRAL SPECIAL: PLANT \n\n Plant your crowbar in the ground, or pick it back up. Punch it with your tape to ZIP straight to it. \n\nSUPER PRY \n\n Plant it at a bottom corner of a platform and downslam onto it 3 times to rip the platform out and drop it on your foe! You can downslam way sooner after jumping than anyone else.',
            color: '#a0522d'
        }]
    },
    {
        key: 'gunman',
        name: 'GUNMAN',
        variants: [{
            name: 'CRAZER',
            desc: 'Modern conflicts need modern solutions, just use a gun!',
            abilities: 'ATTACK: SHOOT \n\n Every 5th shot in a row explodes, followed by a long reload. \n\nNEUTRAL SPECIAL: SHOTGUN \n\n A close-range blast in a cone that hits everyone in front of you and kicks you back a little. 2 shells, then a quick reload. \n\n{changed@2026-11-27}SIDE SPECIAL: RECOIL BLAST \n\n Hold the gun steady for a moment, then fire one huge beam straight behind you. The kick sends you flying the other way, and anyone caught in the beam gets blasted away. The beam pierces walls and fighters, getting weaker with each one it goes through, but a SLEDGEHAMMER wall stops it. Up shoots straight down to rocket you up, down shoots straight up to rocket you down. \n\n The gun only lasts 10 blasts. Push it once more and it blows up in your hands, and you switch to MINI for the rest of the match: a minigun that sprays any direction and pins down whoever it hits.{/changed}',
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
