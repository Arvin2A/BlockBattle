// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';
import { addSettingsButton } from '../ui/settings.js';
import { showAchievementToasts } from '../ui/achievementsMenu.js';
import { takeUnlocksReachedOnLoad } from '../achievements.js';

import { changeBotMode, simulationMode } from "../gameSettings.js";
import { preloadMenu } from "./GameScene/preload.js";
import { fadeOutTo, slideInFromSides } from "./transitions.js";
import { fetchServerStatus, getServerName, isOnlineConfigured } from "../mp/serverConfig.js";
import { FONTS, COLORS } from "../ui/theme.js";
import { clipScrollablePanel } from "../ui/clipScroll.js";
import { getNavigationBounds, wrapIndex, moveSelection, createNavigationBox, moveNavigationBox, getConnectedControllers, getMenuGamepadInput} from "../navigation.js"
var currentControllers = [];
var primaryController = null;
var navBox = null;
var layout = []
var selectedIndex = 0;
var previousInput = {};
const CHANGELOG_VERSION = "2026-11-23-3";
const ONLINE_STATUS_REFRESH_MS = 10000;
const MIN_VERSION_COLOR_BRIGHTNESS = 170;

function getVersionColor(version) {
    const [year, month, day, update] = version.split("-").map(Number);

    const hash =
        day * 73856093 ^
        update * 19349663 ^
        month * 83492791 ^
        year * 2654435761;

    // Mix the hash into RGB channels.
    let h = hash >>> 0;

    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;

    const r = (h >>> 16) & 0xFF;
    const g = (h >>> 8) & 0xFF;
    const b = h & 0xFF;

    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const lift = brightness < MIN_VERSION_COLOR_BRIGHTNESS
        ? (MIN_VERSION_COLOR_BRIGHTNESS - brightness) / (255 - brightness)
        : 0;

    return `#${[r, g, b]
        .map(v => Math.round(v + (255 - v) * lift).toString(16).padStart(2, "0"))
        .join("")}`;
}

const changelogColor = getVersionColor(CHANGELOG_VERSION);const CHANGELOG_STORAGE_KEY = "blockBattleSeenChangelog";

function bulletParagraphs(text) {
    return text.split("\n").map((line, index) => {
        const trimmed = line.trimStart();
        if (index === 0 || trimmed === line || trimmed.startsWith("-")) return line;
        return `- ${trimmed}`;
    }).join("\n");
}

export class MenuScene extends Phaser.Scene {
    //load the menu scene which is just a cool background image we made
    //its also has the start button, initiating the game when clicked
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        preloadMenu.call(this);
    }

    create() {
        this.cameras.main.fadeIn(200, 0, 0, 0);
        addSettingsButton(this);
        showAchievementToasts(this, takeUnlocksReachedOnLoad(), { delay: 600 });
        const bg = this.add.image(500, 300, 'menuBackground');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        // Create menu UI elements here
        const fade = this.add.image(500, 300, 'uifade');
        fade.setDisplaySize(this.scale.width, this.scale.height);
        currentControllers = getConnectedControllers(this);
        primaryController = currentControllers[0] ?? null;


        navBox = null;
        layout = [];
        selectedIndex = 0;
        previousInput = {};
        this.input.topOnly = false;

        const changelogUpdates = [
            {
                name: "ACHIEVEMENTS 1ST PATCH",
                date: "11/23/26",
                entries: [
                    {
                        title: "ONLINE MENU REWORK",
                        body: "Picking your fighter online isn't squeezed into a tiny side panel anymore. The panel just shows your name, your fighter and a big SELECT CHARACTER button, which opens a full character picker with every fighter, a live preview swinging their weapon, variants and their info. You can also open it with C.\n Press I in the online menu to pull up ADVANCED INFO for your fighter, and ADVANCED INFO now shows each fighter's little one-liner too."
                    },
                    {
                        title: "CHARACTER SELECT TWEAKS",
                        body: "The READY TO FIGHT bar has more room so it doesn't crowd the fighters and cards, and it reacts when you hover or click it. In VS CPU, the BOT MASTER progress sits above the CPU's fighter name so it stays clear of the READY button."
                    },
                    {
                        title: "AIR DODGE BUFF",
                        body: "Air dodge keeps you invincible a little longer, 0.45 seconds instead of 0.35. While you're invincible you also pass right through other players, so you can dodge through someone instead of bumping into them."
                    },
                    {
                        title: "LOWER SIDE LAUNCHES",
                        body: "Getting hit from the side can't pop you up very high anymore, no matter how much KB you have. You still fly sideways just as far, so side hits go for the edge instead of the top. This goes for GUNMAN's shotgun too."
                    },
                    {
                        title: "MODIFIER WARNING",
                        body: "The modifiers page now says right under the title that matches with modifiers don't count toward achievements, and the first time you turn one on you get a heads up about it. Online, hosts see it on the modifiers page and everyone sees it in the lobby's modifier list."
                    },
                    {
                        title: "TOUCH CONTROLS FIX ATTEMPT",
                        body: "On phones and iPads, the buttons and thumbstick could suddenly stop working mid-match until you switched tabs and came back. This is an attempt to fix that: lifting your finger should always let go of the button now, even when your device swallows the touch. Let us know if it still happens."
                    },
                    {
                        title: "EASIER CHAINSAW",
                        body: "CHAINSAW only takes one win as LUMBERER without getting KO'd now. If you were already halfway there, it unlocks the next time you open the game and you get the notification for it."
                    },
                    {
                        title: "ONLINE ACHIEVEMENTS",
                        body: "You only need to deal 30% damage in an online match for it to count, no matter how many players are in the lobby. Going idle for 10 seconds doesn't cost you your progress anymore, but 20 seconds still gets you kicked, and if anyone is AFK or gone for half the match it still doesn't count for anybody."
                    },
                    {
                        title: "HOOKER CHANGES",
                        body: "HOOKER's GRAB fling grows with damage again, just a lot slower than a normal hit: it goes 1.5x as far on someone at 100% KB. His air crowbar throw only pushes him half as hard when there's nothing under him, so you can't keep flying with it anymore."
                    },
                    {
                        title: "CHILLER NORMAL BOTS",
                        body: "NORMAL bots react slower, wait longer between swings and pass on more openings. They don't grab ledges or use SMACKDOWN anymore either."
                    }
                ]
            },
            {
                name: "ACHIEVEMENTS UPDATE",
                date: "11/22/26",
                entries: [
                    {
                        title: "ACHIEVEMENTS",
                        body: "There's a new ribbon button under settings on every menu, and in the settings while you're in a match. It opens your ACHIEVEMENTS: what each one asks for, how close you are, and what you get for it. After a match, notifications pop in from the bottom right to show what you made progress on, with a big yellow flash when you finish one.\n They only count with no modifiers, either online or against a NORMAL CPU or harder. BOT MASTER I to IV are the exception: beat every fighter and every variant as a CPU on each difficulty, EASY included. WHAT A DAMN BLOCKHEAD! wants 500 blocked hits. Online, you also have to deal at least 100% damage in the match for it to count, or 75% with 3 players and 50% with 4. If anyone sits AFK or leaves for half the match, nobody gets progress from it, so no farming off a second account. Your progress saves in your browser. To move it somewhere else, get a transfer code: it works once and only for 10 minutes."
                    },
                    {
                        title: "VARIANT UNLOCKS",
                        body: "Every fighter's second variant is locked now. You unlock it by doing an achievement with their first one, like winning twice as LUMBERER without getting KO'd once for CHAINSAW, or KOing someone with a GRAB fling as HOOKER for DEMOLITIONIST. They're meant to be quick, one or two matches each. Until you unlock one, you can't pick it for a CPU either."
                    },
                    {
                        title: "HOOKER CHANGES",
                        body: "HOOKER's GRAB fling launches the same distance no matter how much damage they have, so it sets up KOs instead of being one. His CROWBAR VAULT tips over 1.7x faster, so you get in the air sooner."
                    },
                    {
                        title: "NO AFK ONLINE",
                        body: "Stop pressing buttons online for 10 seconds in total (not counting time you're stunned) and you won't get achievement progress that match. Hit 20 seconds and you get kicked."
                    },
                    {
                        title: "QUICK RESTART",
                        body: "There's a restart button right under the settings button during a match now. It asks if you're sure first, so you won't restart by accident."
                    },
                    {
                        title: "CHAINSAW RAMPAGE",
                        body: "CHAINSAW's RAMPAGE fires his chainsaw out on a cord now, then reels it back in. It still cuts twice as fast, but now it can catch people way outside his normal reach."
                    },
                    {
                        title: "LAWNMOWER CHANGES",
                        body: "Lose your mower as LAWNMOWER and the PULL CORD takes 13 seconds now instead of 8. Every grass you cut in the match shaves a bit off, down to half at 100 cuts. A clock flashes over him every time he cuts grass, getting bluer the closer he gets to 100.\n His CLIPPINGS don't chip your shield anymore when you block them, and his PULL CORD swing reaches a bit further."
                    },
                    {
                        title: "AIR DODGE FIX",
                        body: "AIR DODGE can't rocket you way up anymore when you use it at the top of a jump. It gives you about one jump's worth of height now, and still pushes you sideways just as far."
                    },
                    {
                        title: "SMARTER BOTS",
                        body: "HOOKER bots on HARD and up carry you toward the edge before flinging you. HOOKER bots also VAULT up to you when you're high above them, TRAPPER bots throw harpoons from a distance, and every bot uses its AIR DODGE to get back to the stage."
                    }
                ]
            },
            {
                name: "MAPS & MORE 4TH PATCH",
                date: "11/21/26",
                entries: [
                    {
                        title: "OFF-SCREEN ARROWS",
                        body: "Get knocked off the screen and you won't lose track of yourself anymore. An arrow in your color sits on the edge of the screen pointing right at you, and it gets smaller the farther out you are."
                    },
                    {
                        title: "WALL CHANGES",
                        body: "MALLET's heavy swing doesn't one-shot SLEDGEHAMMER's THICK STEEL PLANK anymore. It takes a bunch of swings to break it now.\n SNOWY cannonballs that hit SLEDGEHAMMER's wall just bounce back off it and fall instead of homing in on someone. They can still smack anyone who's in the way on the way down."
                    },
                    {
                        title: "CROWBARMAN GRAB",
                        body: "CROWBARMAN's GRAB takes a little longer to come out and he almost stops moving while he winds it up, so you can see it coming. If it misses, the crowbar snaps back quickly."
                    },
                    {
                        title: "SMARTER BOTS",
                        body: "NORMAL and HARD bots don't block instantly anymore, so you can actually get hits in, and HARD bots don't run from LONGSWORD's counter the moment it's up. Bots back off from a CROWBARMAN GRAB they see coming, and SLATEMAN bots actually use their slide and steer it without flying off the stage."
                    },
                    {
                        title: "SOUNDS + FIXES",
                        body: "The SNOWY cannon has new firing and impact sounds, the character and map select hover sound got reworked, and the match countdown is a bit faster. SNOWY's ground is narrower and got a touch-up.\n Fixed SCYTHEMAN's GRUELING SLAM missing if he got hit right as it landed."
                    }
                ]
            },
            {
                name: "MAPS & MORE 3RD PATCH",
                date: "11/20/26",
                entries: [
                    {
                        title: "AIR DODGE",
                        body: "You can't block in the air anymore. Pressing block in the air does an AIR DODGE instead: a quick hop upward, angled whichever way you're moving, and you can't be hit for a split second. You get one per trip through the air, and it comes back when you land or grab a ledge. It doesn't use your shield, but you can't dodge while you're getting comboed.\n Walking or getting knocked off a ledge while you're blocking drops your shield too."
                    },
                    {
                        title: "SLEDGEHAMMER SHATTERS SHIELDS",
                        body: "SLEDGEHAMMER's big swing and the second hit of QUICKSLAM break any shield in one hit, LONGSWORD's included, so blocking him is a bad idea. He can swing straight through his own THICK STEEL PLANK again too, so he can hide behind it and hit you through it."
                    },
                    {
                        title: "CROWBARMAN GRAB",
                        body: "CROWBARMAN's GRAB can't be blocked anymore, but he moves half as fast while he's holding someone.\n Fixed CROWBARMAN being able to spam his neutral special and fly while falling back in after getting KO'd."
                    },
                    {
                        title: "FIXES",
                        body: "The name filter catches more bad names. Players whose connection silently died get dropped from the server, so they stop showing up in the online count."
                    }
                ]
            },
            {
                name: "MAPS & MORE 2ND PATCH",
                date: "11/18/26",
                entries: [
                    {
                        title: "HOOKER REWORK + NEUTRAL SPECIAL",
                        body: "HOOKER finally has a neutral special! On the ground he plants a little crowbar, tips it over and vaults WAY up into the air, about twice as high as a normal jump, and he still has his double jump after. The crowbar spins out ahead of him and curves back into his hand, and he can vault again as soon as he catches it. Get hit while it's planted and the vault's cancelled.\n His GRAB finally throws people properly too. Press attack while you're holding someone and you'll swing them all the way around you on your crowbar before flinging them. The throw gets stronger the more damage they have, but you can't attack for 2 seconds after."
                    },
                    {
                        title: "BLIZZARD ICE",
                        body: "SNOWY's blizzard freezes everyone in a block of ice for a moment when it hits, so you can actually tell it got you, and it doesn't slow you down as much anymore."
                    },
                    {
                        title: "NO MORE FLOOR PINS",
                        body: "Hitting someone downward while they're standing on something always pops them out the same way now, a little up and away from you, no matter who's attacking or how much damage they have. That means no more getting stuck in the floor by weak hits like LAWNMOWER's PULLCORD while your damage climbs. Hit them from the air and you can bring them right back up into a combo. Real pins like FISHERMAN's harpoon and GRUELING SLAM still pin.\n SNOWY's cannonballs are a lot less brutal too: blocking one only takes a chunk of your shield instead of breaking it, and they launch a bit less."
                    },
                    {
                        title: "SLEDGEHAMMER DASH",
                        body: "SLEDGEHAMMER's QUICKSLAM starts with a quick dash now, so it actually reaches people. The follow-up has its own swing and stays facing the right way when you jump up into it.\n His THICK STEEL PLANK bats SNOWY cannonballs right back at your opponent, just like LONGSWORD."
                    },
                    {
                        title: "HITS FEEL HEAVIER",
                        body: "There's a new STRONG knockback level at 60%, and launches at STRONG, HEAVY and VIOLENT freeze the screen longer. Hit particles got a makeover too: fewer of them, a bit choppy, flying out in an arc, and they skip the really heavy hits. Don't like them? Turn them off with the new HIT PARTICLES setting.\n SUPER PRY's falling platform launches a lot higher now, DEMOLITIONIST's TAPE PUNCH can break walls, and the main menu keeps the online count up to date."
                    },
                    {
                        title: "DOUBLE-TAP DOWNSLAM",
                        body: "Downslams are a double-tap of down in the air now instead of holding it, so no more slamming by accident. Tap it early and the slam goes off as soon as you're allowed to.\n DEMOLITIONIST's TAPE PUNCH sends people further sideways, and his tape points up or down when he's facing that way, so a punch goes where it's aimed. You can jump up through his SUPER PRY crowbar from underneath now, and the falling platform launches tanky fighters just as far as everyone else."
                    }
                ]
            },
            {
                name: "MAPS & MORE 1ST PATCH",
                date: "11/17/26",
                entries: [
                    {
                        title: "JUNGLE RAINSTORM",
                        body: "JUNGLE ARENA finally has its own weather: a RAINSTORM. No more borrowing DESERT's sandstorm.\n It doesn't hurt, but everyone gets soaked and turns a little blue. While it's pouring you move slower, your hits only deal half damage, and the ground gets slippery, so you take a moment to get going and slide before you stop. The sunlight and shadows fade away while it rains and come back once it clears up.\n The flytraps love the rain. Get caught by one during a storm and it holds on twice as long and gulps you down twice as many times, so stay away from those mud pillars when the clouds open up."
                    },
                    {
                        title: "DESKTOP AUTO UPDATES",
                        body: "The desktop app updates itself now! Every time you open it, it grabs the newest version of the game, and only the parts that changed, so most updates take seconds instead of a whole new download.\n If you're offline it just starts the version you already have. Once in a while an update will need a brand new app, and it'll tell you when that happens. If online play ever says you're out of date, just restart the app."
                    },
                    {
                        title: "DEMOLITIONIST TUNE-UP",
                        body: "DEMOLITIONIST was a bit much, so he got a big round of changes.\n TAPE PUNCH reaches 250px instead of 350px and doesn't launch nearly as far, but it's quicker to use again: each punch takes exactly one second from start to finish instead of a second and a half. The fist flies out a little slower so you can see it coming, and you can hold up or down to punch straight up or straight down. Block a punch with a well-timed block and the tape snaps right back, then he gets countered as soon as it's in.\n CROWBAR SLAM is a totally different move now. Instead of a REALLY slow 20% slam that buried you in the ground, it's a quick overhead swing that SMACKS DOWN whoever it hits, dealing 25% damage. While it winds up he charges forward fast and can't turn around, and he's slowed down until the crowbar is back on.\n SUPER PRY changed too. The wedged crowbar is solid now, so you can stand on it or bump into it. Land your downslams on top of it and it leans further out with every notch, and leans back if you wait too long. When the platform rips out, the crowbar goes flying and a new one shows up 2 seconds later.\n The falling platform still hits for 85%, but the launch is half as strong, so it's not a guaranteed KO anymore. You can block it too, though it'll shatter your shield, and LONGSWORD can bat it away sideways into anyone in its path. Its warning is easier to spot: a wider, brighter red column, a white !, and a new alarm sound."
                    },
                    {
                        title: "BALANCE",
                        body: " -- JUNGLE's flytraps reach 100px further.\n -- A hit that costs more than your whole shield to block now leaves you stunned longer after it breaks, the more it overshot."
                    },
                    {
                        title: "FIXES",
                        body: " -- Changed or replaced pictures and sounds show up right after an update on every site now, instead of sometimes staying old no matter how many times you refresh."
                    }
                ]
            },
            {
                name: "MAPS & MORE",
                date: "11/17/26",
                entries: [
                    {
                        title: "DEMOLITIONIST",
                        body: "CROWBARMAN has a brand new variant: DEMOLITIONIST, a demolition worker with a tape measure that punches and a HUGE crowbar strapped to his back.\n He has no combo, just one big punch: the fist on the end of the tape shoots out up to 350px and sends the first person in its way flying. The catch is a second and a half between punches. His tilts are quick short pokes with no wind back at all.\n With the crowbar on his back he's slow and jumps low, but his punches don't push him around. Plant it in the ground with neutral special and he's quick again, but every punch shoves him backwards. Punch the planted crowbar to ZIP straight to it.\n His double-tap is CROWBAR SLAM, one REALLY slow swing that flattens whoever it hits into the ground for 20%. You can keep punching while it winds up, so herd them into it.\n And the big one: plant the crowbar right at a bottom corner of a platform and it wedges in. Downslam onto it three times (he can downslam way sooner after jumping than anyone else) and you'll hear it rip a little more each time, then the whole platform explodes out, spins up into the sky and comes crashing down on your opponent for a massive 85% and a launch that'll probably end their stock. A red column shows where it's coming. It stays where it crashes for the rest of the match, tilted, and anyone can stand on it.\n CPUs know how to pull it off too, so don't wander too far from a DEMOLITIONIST.\n And don't worry, HOOKER isn't forgotten. His rework and redesign are coming tomorrow!"
                    },
                    {
                        title: "MAP DANGERS",
                        body: "Every arena fights back now. We call these map dangers.\n SNOWY ARENA has a cannon up on the cliff. Every 15 seconds it picks someone and a red mark follows them for 3 seconds. When the mark spins fast it's locked on: one cannonball goes where it thinks you're headed and a second lands where you were standing. They launch anything in their path, stay dangerous on the way down, and stick in the bridge as solid lumps for 5 seconds. Blocking one saves you from the launch but always shatters your shield.\n DESERT ARENA has a heat ray. Every so often a huge beam slams down at an angle on a random player and sways for 3 seconds. Stand in it and you burn, and you keep burning for a bit after you get out. SLATEMAN loves it: burning makes him glow red, hit harder, reach further, slide faster and run way faster, but he goes flying a bit easier too.\n JUNGLE ARENA has mud pillars. Every so often one or two burst up out of the ground, shaking as they rise, and you can stand on them or get blocked by them. Each one has a flytrap on top that turns to follow the closest player for 5 seconds, then snaps out on a vine at anyone within reach. If it gets you, you're stuck in its mouth for 3 seconds taking 3% every half second, but nothing else can hit you in there. Then it spits you out toward the middle of the stage and the pillar sinks back down.\n Map dangers are always on unless you pick the new yellow NO DANGERS modifier. The new red NO MERCY modifier is the opposite: the weather never stops and the dangers get a lot nastier."
                    },
                    {
                        title: "NEUTRAL SPECIALS",
                        body: "Some fighters never had a neutral special. They're getting them now.\n SLATEMAN can BRACE: on the ground he turns to stone, locks in place and heals 10% every second until you move again or get hit. In the air it's ROCKFALL, an untouchable drop straight down that smacks anyone below.\n LONGSWORD can SHEATHE his sword with a little shove. Sheathed he runs faster, and his next attack is a QUICK DRAW: a quick windup into a slash that hits way harder than anything else he has. Pressing it again while sheathed goes straight into a QUICK DRAW. He can still block while sheathed, but his shield drains twice as fast, and catching a hit that way pulls off a QUICK DRAW straight into whoever swung. Projectiles he bats back while sheathed hit 1.2x harder, and a thrown axe or fish he bats back flies straight at whoever threw it, even faster.\n GUNMAN traded his grenade for a SHOTGUN: a close-range blast that hits everyone in front of him as hard as the grenade did, with a little kick back. Two shells, then a quick reload. He also keeps his last-used gun out now, so you can always see what he's holding.\n LUMBERER can THROW his axe now. It spins out in an arc, leaves anyone it hits CHOPPED for a moment and sticks into whatever it lands on. A moment later it RECALLs itself, flying back to you and hitting everyone in its way. Just remember you can't swing until it's back in your hands.\n DAGGER's QUICKSTEP is his neutral special now: he vanishes in a puff of smoke, pops back up a short way off in any direction, and if he slipped past you on the way, darts right back at you. His double-tap is a brand new move, PLUNGE: five quick stabbing dashes in a row, ending with a 10% finisher that sends them flying, 30% in total.\n ANGLER can FISH THROW: he winds up and flings a fish a short way in front of him. It smacks whoever it hits and goes flying off spinning. The windup is the only limit, he never runs out of fish."
                    },
                    {
                        title: "JUNGLE MAKEOVER",
                        body: "JUNGLE ARENA's scaffolds don't pile on top of each other anymore. Every tower has its own spot now: a tall tower on each side with a smaller one stacked on top, and a little tower standing on the middle of the main stage.\n Sunlight pours in through the gap in the canopy now, with shafts of light and sharp shadows falling across the stage. The scaffolds cast shadows under their top bars, fighters cast shadows like they do on SNOWY, and the map select preview shows the new look."
                    },
                    {
                        title: "DESKTOP APP (ALPHA)",
                        body: "BLOCK BATTLE!! has a desktop app now, for Windows, macOS and Linux. Grab it from the Releases page on GitHub.\n It's an early alpha, so the website is still the best way to play: it always has the newest version, and the app doesn't update itself yet."
                    },
                    {
                        title: "SCREEN SHAKE",
                        body: "There's a new SCREEN SHAKE setting: DEFAULT, REDUCED or NONE. It works in online matches too.\n Big launches don't shake the whole screen anymore. Instead, whoever got launched shakes in place while the hit freezes, so you can see exactly who just got sent flying."
                    },
                    {
                        title: "NEW CHARACTER SELECT",
                        body: "Character select got a full makeover. Every fighter sits in one big grid up top, and below it each side gets its own card with a live look at the fighter, weapon out, cycling through their attacks.\n Move around with WASD or the arrows, switch variants with Q or /, and lock in with E, SHIFT or the big READY button on your card. Once both sides are locked, a READY TO FIGHT bar slides in, so hit it to start. On phones, each card has its own little DPAD with an OK button.\n Picking a CPU? Its difficulty is right on its card."
                    },
                    {
                        title: "INFO IN MATCHES",
                        body: "Forgot what your fighter does? Press I in the middle of a match to pause and pull up their ADVANCED INFO. There's also a new info button in the pause menu, so phones can get to it too, and a FIGHTER INFO button in the settings menu on every screen. On character select, I opens it on whoever P1 has picked.\n The pause menu buttons now match the arena you're on instead of always being sandy, and the settings gear switches colors the moment you pick a map."
                    },
                    {
                        title: "ADVANCED INFO",
                        body: "Fighter details have their own panel now. Press I in a match, hit the info button in the pause menu, or open it from the online menu to see everything a fighter can do, with a big look at their icon. Use the arrows to flip through every fighter, scroll if there's a lot to read, and hit X to close it.\n Moves that were never written down are in there now too, like TRAPPER's harpoons, CHAINSAW's digging and building and LONGSWORD's block.\n The online fighter box got slimmer, so the lobby side has a lot more room."
                    },
                    {
                        title: "LONGSWORD BLOCK",
                        body: "LONGSWORD was falling behind, so his block does a lot more now. Block a melee hit and the attacker gets knocked back in a little hop and stunned instead of just frozen, for up to 1.1 seconds if your timing is good. That's a free combo starter.\n He also sends projectiles back where they came from: harpoons, LAWNMOWER's eject, even GUNMAN's bullets. Just not TRAPPER's net. He can even smack a SNOWY cannonball at whoever's closest, painted their color, three times as fast, but it shatters his shield.\n The catch is his shield breaks faster than everyone else's, though it refills quicker too.\n CPUs know all of this too. A LONGSWORD CPU will happily send your stuff back, and the harder CPUs won't swing into his block."
                    },
                    {
                        title: "NEW BLOCK LOOKS",
                        body: "LONGSWORD actually raises his sword when he blocks now, swinging it up into his big third-hit pose and holding it there. When he catches a hit, a sword-shaped flash in your color pops out instead of the usual shield.\n Broken shields got a touch-up too. The crack mark that shows up when anyone's shield shatters is now your player color, whatever color you are."
                    },
                    {
                        title: "TRAPPER NETS",
                        body: "TRAPPER's net stops at walls now. Fly it into the side of a platform or a steel wall and it crashes straight down. Land it on top of one and it lays there, and it falls again if the wall goes away."
                    },
                    {
                        title: "ONLINE CPUS",
                        body: "Short a player online? The host can now fill an open slot with a CPU. It picks a random fighter and plays on HARD.\n You get one CPU per lobby, and it only works in 3 and 4 player lobbies. 1V1s are still people only."
                    },
                    {
                        title: "VIEW MODIFIERS",
                        body: "Lobbies used to just tell you how many modifiers were on. Now there's a VIEW MODIFIERS button right next to that count that opens a list of every modifier the host picked, with their settings and what they do. Scroll through it and hit X when you're done."
                    },
                    {
                        title: "QUICK 1V1 COUNT",
                        body: "You can see how many people are waiting in QUICK 1V1 now, right on the button and while you're searching. It's counted separately from open lobbies.\n Players who tabbed away still show up in the invite list, marked AWAY, so you can invite them."
                    },
                    {
                        title: "BALANCE",
                        body: " -- MALLET's SIPHONING REPAIR heals 5% per missed strike instead of 7.5%. Landed strikes still heal 25%.\n -- CHOPPED slows you to 35% speed on the ground and 75% in the air instead of a flat 50%.\n -- GUNMAN's shots, MINI included, hit whoever is first in the line of fire, and chip blocks less.\n -- LAWNMOWER's PLOW reaches further and its explosion hits way harder, but it only hits people right in front of the mower at about mower height, and blocking it blows the mower up right away for a small push.\n -- LAWNMOWER's EJECT hits for 40% instead of 25%. Blocking or batting it back costs 45% of a shield.\n -- TRAPPER's net can't be blocked or parried, and traps you for 2 seconds instead of 3.\n -- DESERT's heat ray comes back 7 seconds after it fades instead of 5, and burns 1% per tick instead of 2%.\n -- The SNOWY cannon doesn't launch you as high.\n -- After a SMACK DOWN, your specials come back a little sooner than your attacks.\n -- The death ray needs a much stronger sideways launch, and even more if you're also launched high."
                    },
                    {
                        title: "FIXES",
                        body: " -- ANGLER's GRAPPLE reels people all the way in again. The fast pull used to make them crash into him and bounce right back out.\n -- HOOKER points his crowbar right at whoever he's holding, even at an angle.\n -- TRAPPER's net can't skip past a wall when you throw it right next to one.\n -- LAWNMOWER's EJECT explodes the moment it reaches the edge of the map.\n -- A SNOWY cannonball that LONGSWORD bats into someone pops off them and arcs down instead of dropping straight down.\n -- Players who left the online menu and came back show up in the invite list again without a refresh."
                    }
                ]
            },
            {
                date: "11/10/26",
                entries: [
                    {
                        title: "SETTINGS",
                        body: "There's a gear in the top right of every screen now. Tap it to change the master volume, the volume of sounds in matches, and on touchscreens, whether you play with the DPAD or the THUMBSTICK.\n In a match the gear pauses the game like the home button used to, and the pause menu has a settings button right in the middle."
                    },
                    {
                        title: "BETTER PHONE CONTROLS",
                        body: "Double jumps and SMACK DOWNs on phones were a pain, so the thumbstick only moves you left and right now. Jump and downslam with the new up and down buttons on the right, next to B, S, A and ALT.\n We also blocked a bunch more nasty names online, including sneaky misspellings."
                    },
                    {
                        title: "PRIVATE LOBBIES",
                        body: "Want to play with just your friends? Turn on PRIVATE when you create a lobby and it won't show up in BROWSE LOBBIES. Hit INVITE to see everyone waiting in the online menu and send them an invite.\n They get a popup to ACCEPT or DECLINE, and nobody gets in without one."
                    },
                    {
                        title: "TIMED BLOCKS",
                        body: "Blocking is all about timing now. Put your block up right as the hit lands and whoever swung at you is stuck for way longer. Hold it the whole time and they barely freeze.\n MALLET HAMMERMAN's swing hits harder and stuns longer, LAWNMOWER's plow barely chips your shield anymore, and you need to be near a ledge to grab it again."
                    },
                    {
                        title: "LIVES ON THE SCOREBOARD",
                        body: "The score that pops up after a KO now shows how many lives everyone has left, no matter how many players are in the match. 1v1s used to show KOs instead.\n The numbers are colored to match each player too, so you can tell at a glance who's who."
                    },
                    {
                        title: "FORFEIT BUTTON",
                        body: "Playing online on your phone? There's a FORFEIT button in the top right now. Tap it twice to leave the match, but it counts as a loss.\n The online menu got some love too: map previews in the stage picker, a red fighter panel while your fighter is locked in, and a separate BACK button for getting around."
                    },
                    {
                        title: "MORE SQUISH",
                        body: "Squash and stretch hit 1.5x harder now, and afterimages stretch along with you. The home button in matches is smaller and the pause menu is centered.\n The main menu buttons line up with the shadow and slide in faster, and a bunch of names of infamous people are now blocked online."
                    }
                ]
            },
            {
                date: "11/9/26",
                entries: [
                    {
                        title: "ONLINE LOBBIES",
                        body: "Online got a big upgrade! Hit ONLINE and pick CREATE LOBBY, QUICK 1V1 or BROWSE LOBBIES. Make your own lobby with a name, a gamemode, a stage and any modifiers you want, then start it once everyone's in.\n QUICK 1V1 just pairs you with whoever has been waiting the longest. INFINITE BRIDGE stays offline, and you can't turn off both killzones online, so matches always end."
                    },
                    {
                        title: "1V1V1, 2V2 AND 1V1V1V1",
                        body: "Up to 4 players can fight online now! Everyone gets 3 lives. In free for all the last one standing wins, and in 2v2 the last team standing wins, with no friendly fire.\n 1v1v1 is red, green and blue, 1v1v1v1 adds yellow, and 2v2 is red vs blue. Every stage has room for 4 fighters too."
                    },
                    {
                        title: "MODIFIER INTRO",
                        body: "Matches with modifiers now kick off by sliding in a card for each one, so everyone knows what they're getting into. Modifiers that get cancelled by another one flash red and drop out."
                    },
                    {
                        title: "PULL CORD + SPEED",
                        body: "LAWNMOWER can't cut grass or fire CLIPPINGS with his PULL CORD anymore, and his clippings reset when he loses the mower.\n The speed limit went way up, the camera locks onto you at crazy speeds, name tags and weapons keep up with you, and you can ledge grab from anywhere off the map."
                    }
                ]
            },
            {
                date: "11/8/26",
                entries: [
                    {
                        title: "CUSTOM DAMAGE + SPEED",
                        body: "Pick your own numbers! CUSTOM DAMAGE and CUSTOM SPEED each come in three sizes: S, A and R. Click the box on the card to raise the amount, and it loops back around after the max.\n CUSTOM DAMAGE S goes all the way to 50x, A goes to 10x, and R is for the tiny 0.1x to 1x range. CUSTOM SPEED S goes up to +5000%, A to +500% and R to +100%. Turn on more than one and they stack."
                    },
                    {
                        title: "NO GRAVITY + FRICTION",
                        body: "Remember the hitstun bugs? They're a feature now. Nothing pulls you down and nothing slows you down, so you just keep going.\n Pressing the way you're already moving keeps your speed, and pressing against it instantly flips you the other way at full speed. Downslam is your only ticket back to the floor."
                    },
                    {
                        title: "NO KILLZONES",
                        body: "NO VERTICAL KILLZONE and NO HORIZONTAL KILLZONE get rid of the kill zones on those sides, and the camera will follow you out into the void.\n Click COLLISION on the card and those edges become solid walls instead. Turn both modifiers on and nobody can get KO'd at all, so good luck ending that match."
                    },
                    {
                        title: "HIGH-SPEED CRASHES",
                        body: "Going really fast now looks and feels like it. Fighters stretch out as they speed up, and if you slam sideways into something above 12 blocks per second you squish, bounce back the way you came and get stunned for a moment. Floors and ceilings just squish you.\n Downslams, directional specials, grabs and SMACK DOWN are safe."
                    },
                    {
                        title: "REAL SPEEDOMETERS + FAST",
                        body: "The INFINITE BRIDGE speedometers now show your real speed. Those crazy 2000+ blocks per second readings were never real: they only showed up during hit freeze, before you actually moved. Best speeds start over from 0, but your best distances are safe. The camera also keeps up at extreme speeds now, so you won't vanish off screen.\n HYPERACTIVE is now called FAST, and the old FAST is gone."
                    }
                ]
            },
            {
                date: "11/5/26",
                entries: [
                    {
                        title: "INFINITE BRIDGE",
                        body: "New modifier! Turn on INFINITE BRIDGE and you fight on a snowy bridge that never ends. No platforms, no side blast zones, just road. Speedometers show how fast you're going in blocks per second, plus your top speed, average, distance and your best ever run with each fighter. Press V or click VIEW to switch the camera between P1, P2 and both.\n Map select also got a makeover: maps scroll on a vertical wheel with big cards, and pressing NEXT swipes down to a bigger, easier to read modifier page. Modifiers are now sorted and colored by how chaotic they are, and MAP HAZARDS is now WEATHER HAZARDS."
                    }
                ]
            },
            {
                date: "11/4/26",
                entries: [
                    {
                        title: "LAWNMOWER SCYTHEMAN",
                        body: "SCYTHEMAN's new variant is here, and he's here to run you over. Press attack to shove his mower into you and grind until it blows up, hit ALT to ride it around way faster, or double-tap a direction to EJECT it, sending it off on its own, speeding up until it explodes on whatever it hits.\n Once it blows up he's stuck with a PULL CORD for 8 seconds, so mow some grass to get it back sooner. Every bit of grass he cuts also turns into CLIPPINGS you can spray back with neutral special."
                    },
                    {
                        title: "BLOCK",
                        body: "Every fighter can block now. Hold R (P1) or Period (P2), the shoulder buttons on a controller, or the new B button on phones. A shield in your color pops up and eats every hit, with a big shield flash and a clang so you know it worked. Whoever you blocked freezes for a split second and has to wait a moment before swinging again, so hit back.\n It shrinks the longer you hold it and every hit takes a chunk out of it, so don't turtle forever. If it runs out it shatters, a cracked shield shows up on you, and you're stunned for a second and a half."
                    },
                    {
                        title: "SMACK DOWN",
                        body: "Tap down on the ground when your opponent is close and you'll grab them and slam them into the floor. They get squashed flat and float up and away from you, and you need a second to recover, so chase them down for the follow-up. Blocking stops it, though."
                    },
                    {
                        title: "LEDGE GRAB",
                        body: "Knocked off the stage? Press attack near a platform's edge to hang on. Hanging is risky since you can still get hit off, but press any button (except down) to climb up and dash forward, and nothing can stop that climb and dash. It shoves whoever's camping the edge out of your way. Press down to let go."
                    },
                    {
                        title: "SMARTER CPUS",
                        body: "The CPU knows how to block now too, and on the new VERY HARD it reads your specials and combos and blocks them before they land. VERY HARD is the old full-strength CPU with everything turned on. HARD got a little easier: it blocks, but skips SMACK DOWN and LEDGE GRAB and won't chase you off the stage. HARD and VERY HARD CPUs also know to jump out of GUNMAN's MINI now.\n HAMMERMAN CPUs finally use walls, heal from a safe spot and time their swings properly."
                    },
                    {
                        title: "MORE CHANGES",
                        body: "MALLET's swing reaches a little further, and SLEDGEHAMMER's QUICKSLAM follow-up chases the target now so it stops whiffing. Big launches at 100%+ and 150%+ freeze the screen for a moment on hit, so they feel way heavier, and the DEATH RAY needs a harder launch to fire. GRUELING SLAM's air pin is down to 2 seconds.\n Friends on the same wifi can play each other online again, since the one-match limit is per device now instead of per connection. Online chat lets you stack up to 3 messages at once. TRAPPER's netted victims can't be shoved across the floor anymore, and big spikes don't send you through platforms."
                    }
                ]
            },
            {
                date: "11/2/26",
                entries: [
                    {
                        title: "THUMBSTICK + TUNING",
                        body: "Phones get a real thumbstick now instead of the four arrow buttons, both online and against the CPU. Attack and special stay right where they were.\n Getting launched has a slight upward curve while you're in hitstun now, so it doesn't look like you're gliding in a straight line anymore. GUNMAN's MINI does 0.7% a bullet and he barely falls while it's landing. CHUCK hits way harder, stuns for a moment, and comes back twice as fast. SLEDGEHAMMER can't swing through his own steel wall anymore, and the downslam afterimage stops the moment you attack or get hit."
                    },
                    {
                        title: "GRUNT IS NOW CRAZER",
                        body: "GUNMAN's one and only variant has a new name: GRUNT is now CRAZER. Same gun, same MINI, same chaos, just a name that fits him better."
                    },
                    {
                        title: "CHAT KEYBINDS",
                        body: "You can bind quick chat messages to number keys now. Open chat, hover any message and press 0-9 to bind it, then press that number mid-match to send it instantly. Your key shows up next to the message so you don't forget, and only you can see it. Press the same number on it again to unbind. Your binds are saved, so they're still there next time.\n Online is a bit tighter too: only one player per connection can host or play at a time, and if you tab out you stop counting as WAITING. LAN play is gone for now, so online always uses the public server. The server also got lighter, so it can run more matches at once."
                    }
                ]
            },
            {
                date: "11/1/26",
                entries: [
                    {
                        title: "SMOOTHER ONLINE",
                        body: "Online matches don't microfreeze anymore every time your connection hiccups. Your game now keeps a tiny buffer of what the server sends and plays it back at a steady pace, so things stay smooth instead of stopping and then jumping ahead.\n There's also a brand new fast connection running next to the old one. When a bit of data gets lost, the game just skips past it instead of freezing until it shows up again, and the old connection quietly fills in the gaps. Your button presses use both too. It all goes through a relay, so nobody sees anyone's IP.\n Leaving a match for the main menu also disconnects you properly now, so you don't count as online after you've left."
                    },
                    {
                        title: "LIGHTER + NAME FILTER",
                        body: "The game uses a good chunk less memory, which helps on phones and older laptops. The sandstorm wind and AXEMAN's chainsaw are short seamless loops now, and a bunch of sounds that were stereo for no reason are mono. You won't hear a difference.\n FISHERMAN's match intro is gone. It didn't look great and it was the single biggest image in the game. He still slams down onto his spawn like everyone else.\n The name filter now catches names that swap the first letters of two words, and it stops blocking normal words like DICKENS, COCKTAIL and PEACOCK."
                    },
                    {
                        title: "PLUNGE IS NOW SLIDE",
                        body: "SLATEMAN's PLUNGE got reworked and renamed to SLIDE. His arm twists around, pulls out a dagger, then tucks it back in, and the whole thing lasts about 3 and a half seconds.\n The dagger only hurts (and still applies PLUNGED) while it's actually out, and holding left or right then sends him off at 1.5x speed. He doesn't move on his own anymore, so you steer the whole thing. Once he starts putting it away he slows back down.\n Pulling the dagger out and putting it back are little slashes of their own, so anyone who tries to punish him on either end gets swatted away. He can't do anything else until the whole SLIDE is over."
                    },
                    {
                        title: "CONTROL FIXES",
                        body: "Phone controls could suddenly stop responding until you switched tabs and came back. That's fixed, no tab hopping needed. Your thumb drifting off a button also doesn't drop the input anymore, and you can slide between buttons without lifting.\n Every now and then a fighter would just stop being able to attack for the rest of the match. That's fixed too, and as a safety net nobody can get locked out of attacking for more than a few seconds unless they're actually stunned.\n You can aim each hit of a combo again, so your ender or tilt goes wherever you're holding instead of where the combo started."
                    },
                    {
                        title: "NAME FILTER FIXES",
                        body: "Swapping a vowel for a random number, symbol, dot or space doesn't get a bad name past the filter anymore, and neither does just leaving the vowel out or spelling it how it sounds. Keep it clean out there.\n If your name gets turned down, the name box now shakes and turns red instead of flashing a message you'd probably miss."
                    },
                    {
                        title: "COMBO FIXES",
                        body: "Push attacks can't fire the DEATH RAY anymore. Running into someone and swinging was never supposed to be a KO move.\n You also can't swap your launch direction mid-combo anymore. Once your jab stuns someone, the rest of the combo sends them the way it started instead of wherever you turn to at the last second. This was behind a lot of nasty combos, especially from the HARD CPU.\n SLATEMAN's rock now audibly breaks every time he cracks into a new phase, so you can hear when he's getting fragile. He also used to stay fragile after losing a stock. Now he's back to full toughness every respawn. His arms also come straight out of his body when he punches up or down instead of floating off to the side."
                    },
                    {
                        title: "DASH FIXES",
                        body: "AXEMAN's CLEAVE could sometimes hit twice in one dash. It only ever hits once now.\n LUNGE and QUICKSTEP were shredding through walls. If your opponent was hiding behind a plank, every dash would chew through it way faster than it should. Now a dash only damages a wall once."
                    },
                    {
                        title: "CPU DIFFICULTY",
                        body: "CPUs have difficulty levels now: EASY, NORMAL and HARD. Pick one above the CPU's box on character select (SIMULATION gets one for each CPU). EASY and NORMAL react slower, let some openings go, and don't edgeguard as hard. HARD is the same CPU you've been fighting.\n SIMULATION looks different too. Both CPUs are grey in the match, and on character select CPU 1 is black and CPU 2 is white so you can keep track of who's who.\n GUNMAN CPU stopped trying to point its minigun up and down. It only fires sideways, so now it waits until you're level with it."
                    },
                    {
                        title: "SCYTHEMAN REWORK",
                        body: "MOW is gone. SCYTHEMAN's DIR SPECIAL is now GRUELING SLAM: a giant white scythe rises over his head and whips down in front of him tip first, fast enough to actually connect. Land it and they take 20% and get PINNED to the ground for 1 second. Catch them in the air and they get slammed down way faster than a downslam first, then pinned for a whole 3 seconds. Hit them while they're pinned and they're free, so pick your moment.\n SOW is back as his NEUTRAL SPECIAL, and it's way better: every toss throws 7 seeds instead of 3, and you can throw them back to back as fast as you can press it. Every seed that lands on the ground or a platform grows grass right there.\n Grass cuts don't make him hit harder anymore. Instead every cut makes him 1% harder to launch, all the way up to twice as tough at 100 cuts, and a shield flashes on him that gets bluer the tougher he gets. Grass only grows on the ground and platforms now, and every normal swing cuts it, grown or not. Your opponent can mow your lawn too, but only your own cuts count for you."
                    },
                    {
                        title: "DROP-IN STARTS",
                        body: "Nobody just stands around at the start of a match anymore. Both fighters downslam in from above and crash right through any platforms in the way, then do their intro."
                    }
                ]
            },
            {
                date: "10/30/26",
                entries: [
                    {
                        title: "COMBAT + NAME FIXES",
                        body: "No more trading hits forever! Fighters could hit back the exact moment they got hit, so two fighters (bots especially) would stun each other over and over. Getting hit also sometimes ended your stun early, which is how people were breaking out of 3-hit combos. Both are fixed.\n Specials with a delayed hit, like PLUNGE and the QUICKSLAM follow-up, get cancelled if you're hit before they land.\n P1 can't fall through the floor at the start on DESERT ARENA anymore.\n Online names are plain English letters and numbers only now, and the name filter is a lot harder to sneak past."
                    },
                    {
                        title: "SLATEMAN UPDATE",
                        body: "SLATEMAN got new, better arms! He punches with one fist, then the other, and finishes the combo with a big overhead slam.\n His \"the more hurt, the faster\" thing never actually worked. Now it does: he starts a bit slow, hits normal speed around 50% KB and keeps speeding up from there (while hitting softer).\n PLUNGE now carries him forward at normal speed. Hold left or right during it and his KB speed kicks in on top, so a hurt SLATEMAN plunges way faster.\n SLEDGEHAMMER's QUICKSLAM follow-up now always spikes toward the side you quickslammed, and its stun doesn't grow with KB anymore."
                    },
                    {
                        title: "TRAPPER FISHERMAN",
                        body: "The TRAPPER variant of FISHERMAN is here! He stabs with a harpoon, and when a stab lands the harpoon stays stuck in your opponent for a few seconds.\n He only carries 3 harpoons (the ones on his back are your spares), and every one he sticks in someone or throws is gone until it grows back, one every 3 seconds. Run out and he's down to his fists, and his third hit is just a weak shove instead of a pin.\n His third stab doesn't launch, it PINS them to the floor for 1 second. Pin someone in the air and they get slammed down faster than a downslam.\n Pressing the SPECIAL key throws harpoons like javelins, one every half second. They hit hard, but the knockback never grows, so they won't KO on their own.\n His DIR SPECIAL throws a NET. Catch someone with it and they're NETTED for 3 seconds. If it misses and lands on the ground it stays there, and whoever walks into it gets NETTED for 3 seconds too."
                    },
                    {
                        title: "BALANCE + FIXES",
                        body: "ANGLER and MALLET finally have real tilts instead of repeating their basic attack.\n Combo enders always have the full recovery now, so fast fighters can't mash straight into the next combo.\n Red VIOLENT launches start at 150% now, and at 200%+ launches fire a purple DEATH RAY. You can't attack during the death ray freeze anymore, and pulls and explosions can't trigger it."
                    }
                ]
            },
            {
                date: "10/22/26",
                entries: [
                    {
                        title: "FISHERMAN REWORK",
                        body: "FISHERMAN has arms now and has been redesigned, with a thinner fishing line and an intro animation where he spins his rod.\n The hook isn't absurdly huge anymore. Instead it snaps to a player in its hit range, and the line curves more. If the hook falls below the platform it's hooking onto, it curves upward a bit.\n The line now reels in instead of instantly disappearing, and reeling/pulling it in has its own quick animation of lifting the rod up.\n Overall the ability is much more concise and easier to use, and FISHERMAN attacks faster (not as fast as DAGGER though)."
                    },
                    {
                        title: "BETTER GAME EFFECTS + MENU INTRO",
                        body: "An attempt to add better game effects and a menu intro animation.\n Hits now spray tiny white particles from the side that got hit. At 100% KB and up, getting launched leaves a white ghost trail and smoke and shakes the screen. At 200% and up it gets VIOLENT: a red ghost trail and a severe screen shake.\n Fighters at 100%+ pulse red, landings and double jumps kick up dust, KOs fire a beam back into the arena, and respawns flash in.\n Winning now shows a GAME! screen and a results panel with KOs, max KB and damage dealt.\n The menu slides in from the sides, and the UI uses the same colors and fonts everywhere."
                    }
                ]
            },
            {
                date: "10/18/26",
                entries: [
                    {
                        title: "HAMMERMAN REDESIGN!",
                        body: "MALLET HAMMERMAN has been redesigned with more detailed animations and an intro animation, just like swordman."
                    }
                ]
            },
            {
                date: "10/16/26",
                entries: [
                    {
                        title: "QUICK CHAT + NAME FILTER",
                        body: "Limited selection of messages are now present when playing online multiplayer, inappropriate usernames have been filtered."
                    },
                    {
                        title: "SWORDMAN REDESIGN!",
                        body: "Later, all characters will recieve a redesign, right now swordman has more detailed animations and an intro animation."
                    }
                ]
            },
            {
                date: "10/14/26",
                entries: [
                    {
                        title: "KEYBINDS HAVE BEEN CHANGED!",
                        body: "THE SPECIAL KEY IS NO LONGER RIGHT/LEFT ALT, IT IS NOW Q and /, CHAINSAW'S BUILDMODE IS NOW USING ALT INSTEAD."
                    },
                    {
                        title: "THE JUNGLE",
                        body: "The jungle map has finally released! First one with 3 platforms"
                    },
                    {
                        title: "MUTLIPLAYER",
                        body: "YOU CAN FINALLY PLAY ONLINE???? Yes and a server has been made in NY, and if you're willing to make one for your own better connectivity, read SERVER_SETUP.md in https://github.com/Arvin2A/BlockBattle/blob/main/SERVER_SETUP.md."
                    }
                ]
            },
            {
                date: "10/12/26",
                entries: [
                    {
                        title: "DAGGER SWORDMAN",
                        body: "The DAGGER variant of SWORDMAN has been added to the game."
                    },
                    {
                        title: "MALLET AND SLEDGEHAMMER WALL",
                        body: "Pressing the SPECIAL key (Q / '/' for keyboard) for hammerman can now place strong vertical walls. "
                    },
                    {
                        title: "CROWBARMAN's GRAB",
                        body: "CROWBARMAN can NO LONGER GRAB ON OBJECTS."
                    },
                    {
                        title: "SFX",
                        body: "UI selection SFX and plank placement SFX has been revamped."
                    },
                    {
                        title: "LIGHT HITS",
                        body: "If you've NEVER noticed, you can perform light hits by moving a bit then attacking in quick sucession.\n This form of attack has been buffed, and now stuns for longer meaning they are ACTUALLY GOOD NOW?"
                    },
                    {
                        title: "OTHER",
                        body: "PLEASE contact me at zamanarvin@sewanhakschools.org or zamanarvin711@gmail.com for suggestions, I really need to get things going now. And bugs too."
                    }
                ]
            }
        ];

        const upcomingEntries = [
            {
                title: "Animated map backgrounds",
                body: "Map backgrounds will be animated, and will have a more depth to it. It will foreshadow future updates and events..."
            },
            {
                title: "3D Map Platforms",
                body: "So far, only the SNOWY arena has 3D platforms/main ground, this will be expanded to other maps."
            },
            {
                title: "LUMBERER + DAGGER REDESIGNS",
                body: "AXEMAN's LUMBERER and SWORDMAN's DAGGER are getting redesigned."
            },
            {
                title: "HOOKER REWORK + REDESIGN",
                body: "CROWBARMAN's HOOKER is getting reworked and redesigned, and it's coming tomorrow!"
            },

            {
                title: "NEW GUNMAN VARIANT",
                body: "GUNMAN is getting a new variant, and a redesign too."
            }
        ];

        const changelogBox = this.add.rectangle(
            190, 300, 340, 450, 0x111111, 0.88
        ).setStrokeStyle(3, 0x686868);

        const changelogBlurbTitle = this.add.text(
            40, 135, "LATEST UPDATE", {
                fontFamily: "VCROSD",
                fontSize: "24px",
                fill: changelogColor,
                stroke: "#000000",
                strokeThickness: 5
            }
        );

        const changelogBlurb = this.add.text(
            40, 180,
            "Picking your fighter online now has its own full character picker, and air dodge lasts longer and phases through players. Plus lower side launches, a touch controls fix attempt and an easier CHAINSAW.",
            {
                fontFamily: "VCROSD",
                fontSize: "16px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
                lineSpacing: 8,
                wordWrap: { width: 300 }
            }
        );

        const openChangelogText = this.add.text(
            190, 505, "[ VIEW FULL CHANGELOG ]", {
                fontFamily: "VCROSD",
                fontSize: "13px",
                fill: "#aaaaaa"
            }
        ).setOrigin(0.5).setInteractive({ useHandCursor: true });

        let changelogOpen = false;
        let changelogModalObjects = [];
        let changelogPanel = null;

        const openChangelog = () => {
            if (changelogOpen) return;
            changelogOpen = true;

            const dim = this.add.rectangle(
                500, 300, 2000, 1200, 0x000000, 0.78
            ).setDepth(2000).setInteractive();

            const modalBackground = this.add.rectangle(
                500, 300, 850, 520, 0x151515, 1
            ).setStrokeStyle(4, 0x686868).setDepth(2001);

            const modalTitle = this.add.text(
                500, 65, "BLOCK BATTLE!! -- CHANGELOG", {
                    fontFamily: "VCROSD",
                    fontSize: "30px",
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 5
                }
            ).setOrigin(0.5).setDepth(2002);

            const tabs = [
                { label: "LATEST UPDATE", updates: changelogUpdates, x: 395 },
                { label: "UPCOMING", entries: upcomingEntries, x: 605 }
            ];

            const tabObjects = tabs.map(tab => {
                const box = this.add.rectangle(
                    tab.x, 100, 190, 34, 0x202020
                ).setStrokeStyle(2, 0x444444)
                    .setDepth(2002)
                    .setInteractive({ useHandCursor: true });

                const text = this.add.text(
                    tab.x, 100, tab.label, {
                        fontFamily: "VCROSD",
                        fontSize: "16px",
                        fill: "#aaaaaa"
                    }
                ).setOrigin(0.5).setDepth(2003);

                return { tab, box, text };
            });

            let activeTab = null;
            let updateIndex = 0;

            const updateLabel = update => update.name ? `${update.name} (${update.date})` : `UPDATE ${update.date}`;

            const selectorText = this.add.text(
                500, 140, "", {
                    fontFamily: "VCROSD",
                    fontSize: "20px",
                    fill: changelogColor,
                    stroke: "#000000",
                    strokeThickness: 3
                }
            ).setOrigin(0.5).setDepth(2003);

            const makeArrow = (x, label, step) => {
                const box = this.add.rectangle(x, 140, 44, 30, 0x202020)
                    .setStrokeStyle(2, 0x444444)
                    .setDepth(2002)
                    .setInteractive({ useHandCursor: true });
                const text = this.add.text(x, 140, label, {
                    fontFamily: "VCROSD",
                    fontSize: "22px",
                    fill: "#ffffff"
                }).setOrigin(0.5).setDepth(2003);
                box.on("pointerover", () => box.setFillStyle(0x333333));
                box.on("pointerout", () => box.setFillStyle(0x202020));
                box.on("pointerdown", () => showUpdate(updateIndex + step));
                return { box, text };
            };

            const buildPanel = (entries) => {
                const content = this.rexUI.add.sizer({
                    orientation: "y",
                    width: 740,
                    space: {
                        item: 20
                    }
                });

                for (const entry of entries) {
                    const card = this.rexUI.add.sizer({
                        orientation: "y",
                        width: 720,
                        height: 110,
                        space: {
                            left: 10,
                            right: 10,
                            top: 5,
                            bottom: 5,
                            item: 8
                        }
                    });

                    const title = this.add.text(0, 0, entry.title, {
                        fontFamily: "VCROSD",
                        fontSize: "22px",
                        fill: changelogColor,
                        stroke: "#000000",
                        strokeThickness: 3
                    }).setDepth(5000);

                    const body = this.add.text(0, 0, bulletParagraphs(entry.body), {
                        fontFamily: "VCROSD",
                        fontSize: "16px",
                        fill: "#ffffff",
                        lineSpacing: 8,
                        wordWrap: { width: 690 }
                    }).setDepth(5000);

                    card.add(title, {
                        proportion: 0,
                        align: "left"
                    });

                    card.add(body, {
                        proportion: 1,
                        expand: true,
                        align: "left"
                    });


                    card.layout();

                    content.add(card, {
                        expand: true
                    });
                    console.log(
                        entry.title,
                        "card:", card.width, card.height,
                        "title:", title.width, title.height,
                        "body:", body.width, body.height
                    );

                }


                content.layout();

                changelogPanel = this.rexUI.add.scrollablePanel({
                    x: 500,
                    y: 340,
                    width: 790,
                    height: 330,

                    scrollMode: 0,
                    scrollDetectionMode: 1,

                    background: this.add.rectangle(
                        0, 0, 790, 330, 0x202020
                    ).setStrokeStyle(2, 0x444444),

                    panel: {
                        child: content,
                        mask: false
                    },

                    sliderY: {
                        track: this.add.rectangle(
                            0, 0, 12, 0, 0x444444
                        ),
                        thumb: this.add.rectangle(
                            0, 0, 12, 55, 0xaaaaaa
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
                    }
                });

                changelogPanel.layout();
                clipScrollablePanel(this, changelogPanel, { inset: 4 });
                changelogPanel.setDepth(2002);
            };

            const olderArrow = makeArrow(150, "<", 1);
            const newerArrow = makeArrow(850, ">", -1);
            const selectorObjects = [selectorText, olderArrow.box, olderArrow.text, newerArrow.box, newerArrow.text];

            const refreshSelector = () => {
                const updates = tabs[activeTab].updates;
                selectorObjects.forEach(object => object.setVisible(Boolean(updates)));
                if (!updates) return;
                selectorText.setText(updateLabel(updates[updateIndex]));
                [olderArrow.box, olderArrow.text].forEach(object => object.setAlpha(updateIndex < updates.length - 1 ? 1 : 0.3));
                [newerArrow.box, newerArrow.text].forEach(object => object.setAlpha(updateIndex > 0 ? 1 : 0.3));
            };

            const showUpdate = index => {
                const updates = tabs[activeTab].updates;
                if (!updates || index < 0 || index >= updates.length || index === updateIndex) return;
                updateIndex = index;
                this.sound.play('hover2');
                refreshSelector();
                changelogPanel?.destroy();
                buildPanel(updates[updateIndex].entries);
            };

            const selectTab = (index) => {
                if (activeTab === index) return;
                activeTab = index;
                updateIndex = 0;

                tabObjects.forEach((tabObject, i) => {
                    const active = i === index;
                    tabObject.box.setFillStyle(active ? 0x333333 : 0x202020);
                    tabObject.box.setStrokeStyle(2, active ? 0xaaaaaa : 0x444444);
                    tabObject.text.setColor(active ? changelogColor : "#aaaaaa");
                });

                changelogPanel?.destroy();
                refreshSelector();
                buildPanel(tabs[index].updates ? tabs[index].updates[0].entries : tabs[index].entries);
            };

            tabObjects.forEach((tabObject, i) => {
                tabObject.box.on("pointerdown", () => {
                    if (activeTab !== i) this.sound.play('hover2');
                    selectTab(i);
                });
            });

            selectTab(0);
            


            const closeBox = this.add.rectangle(
                900, 65, 55, 45, 0x771c1c
            ).setStrokeStyle(2, 0xffffff)
                .setDepth(2004)
                .setInteractive({ useHandCursor: true });

            const closeText = this.add.text(
                900, 65, "X", {
                    fontFamily: "VCROSD",
                    fontSize: "26px",
                    fill: "#ffffff"
                }
            ).setOrigin(0.5).setDepth(2005)
                .setInteractive({ useHandCursor: true });

            closeBox.on("pointerover", () => {
                closeBox.setFillStyle(0xc0392b);
            });

            closeBox.on("pointerout", () => {
                closeBox.setFillStyle(0x771c1c);
            });

            const modalObjects = [
                dim,
                modalBackground,
                modalTitle,
                ...tabObjects.flatMap(tabObject => [tabObject.box, tabObject.text]),
                ...selectorObjects,
                closeBox,
                closeText
            ];

            changelogModalObjects = modalObjects;

            const closeChangelog = () => {
                if (!changelogOpen) return;

                changelogOpen = false;
                console.log("Panel size:", changelogPanel.width, changelogPanel.height);
                console.log("Entry count:", changelogUpdates[0].entries.length);
                

                this.sound.play('hover2');
                // Remember that this browser has seen this version.
                try {
                    localStorage.setItem(
                        CHANGELOG_STORAGE_KEY,
                        CHANGELOG_VERSION
                    );
                } catch (error) {
                    console.warn(
                        "Could not save changelog version:",
                        error
                    );
                }

                changelogPanel?.destroy();
                changelogPanel = null;

                modalObjects.forEach(object => object.destroy());
                changelogModalObjects = [];
                for (const entry of modalLayoutEntries) {
                    const index = layout.indexOf(entry);
                    if (index !== -1) layout.splice(index, 1);
                }

                if (selectedIndex >= layout.length) {
                    selectedIndex = Math.max(0, layout.length - 1);
                }
            };

            
            closeBox.on("pointerdown", closeChangelog);
            closeText.on("pointerdown", closeChangelog);

            const closeLayoutEntry = {
                button: closeBox,
                action: closeChangelog
            };

            const modalLayoutEntries = [
                closeLayoutEntry,
                ...tabObjects.map((tabObject, i) => ({
                    button: tabObject.box,
                    action: () => selectTab(i)
                }))
            ];

            layout.push(...modalLayoutEntries);

            this.closeChangelog = closeChangelog;
        };

        openChangelogText.on("pointerover", () => {
            openChangelogText.setColor("#ffffff");
        });

        openChangelogText.on("pointerout", () => {
            openChangelogText.setColor("#aaaaaa");
        });

        openChangelogText.on("pointerdown", openChangelog);

        let shouldShowChangelog = true;

        try {
            shouldShowChangelog =
                localStorage.getItem(CHANGELOG_STORAGE_KEY)
                !== CHANGELOG_VERSION;
        } catch (error) {
            // If storage is unavailable, show the changelog normally.
            console.warn("Could not read changelog version:", error);
        }

        if (shouldShowChangelog) {
            openChangelog();
        }


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
            if ('audioSession' in navigator) {
                navigator.audioSession.type = 'playback';
            }
            fadeOutTo(this, () => this.scene.start('MapAndModifierSelectScene'));
        }, this);
        const botBox = this.add.rectangle(
            882,
            420,
            186,
            70,
            0x111111
        );
        botBox.setStrokeStyle(4, 0x000000);

        // The arrow beside this button flips it between VS CPU and SIMULATION
        // (bot vs bot). The choice stays until the page is reloaded.
        let simulationSelected = simulationMode;
        const botText = this.add.text(
            882,
            420,
            simulationSelected ? 'SIMULATION' : 'PLAY VS CPU',
            {
                fontFamily: 'VCROSD',
                fontSize: '26px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);
        botText.setInteractive();

        const startBotMatch = () => {
            changeBotMode(true, simulationSelected);
            fadeOutTo(this, () => this.scene.start('MapAndModifierSelectScene'));
        };
        botText.on('pointerdown', startBotMatch);

        const modeArrowBox = this.add.rectangle(770, 420, 20, 70, 0x111111);
        modeArrowBox.setStrokeStyle(4, 0x000000);
        modeArrowBox.setInteractive({ useHandCursor: true });
        const modeArrow = this.add.triangle(
            770, 420,
            9, 0,
            9, 18,
            0, 9,
            0xffffff
        ); 
       const showBotMode = () => {
            botText.setText(simulationSelected ? 'SIMULATION' : 'PLAY VS CPU');
            modeArrow.setScale(simulationSelected ? -1 : 1, 1);
        };
        showBotMode();
        const toggleBotMode = () => {
            simulationSelected = !simulationSelected;
            this.sound.play('hover2');
            showBotMode();
        };
        modeArrowBox.on('pointerdown', toggleBotMode);
        modeArrowBox.on('pointerover', () => {
            modeArrowBox.setFillStyle(0xffffff);
            modeArrowBox.setStrokeStyle(4, 0xbbbbbb);
            modeArrow.setFillStyle(0x111111);
        });
        modeArrowBox.on('pointerout', () => {
            modeArrowBox.setFillStyle(0x111111);
            modeArrowBox.setStrokeStyle(4, 0x000000);
            modeArrow.setFillStyle(0xffffff);
        });
        botText.on('pointerover', function () {
            botBox.setFillStyle(0xffffff);
            botBox.setStrokeStyle(4, 0xbbbbbb);
        });

        botText.on('pointerout', function () {
            botBox.setFillStyle(0x111111);
            botBox.setStrokeStyle(4, 0x000000);
        });

        // ONLINE is always shown. The line under it says whether the server can be
        // played on right now (see mp/serverConfig.js).
        const onlineBox = this.add.rectangle(
            885,
            340,
            180,
            70,
            0x111111
        );
        onlineBox.setStrokeStyle(4, 0x000000);

        const onlineText = this.add.text(
            885,
            330,
            'ONLINE',
            {
                fontFamily: 'VCROSD',
                fontSize: '28px',
                fill: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 6
            }
        ).setOrigin(0.5);
        const onlineStatus = this.add.text(885, 359, '', {
            fontFamily: 'GameFont',
            fontSize: '11px',
            fill: '#bbbbbb',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        onlineBox.setInteractive({ useHandCursor: true });
        // Everyone connected, in a match or not. The button itself shows who's waiting.
        const onlineCount = this.add.text(885, 285, '', {
            fontFamily: FONTS.title,
            fontSize: '14px',
            fill: '#7dff8a',
            stroke: COLORS.stroke,
            strokeThickness: 4
        }).setOrigin(0.5);

        let onlineReady = false;
        const setOnlineState = (ready, label, color) => {
            onlineReady = ready;
            onlineStatus.setText(label).setColor(color);
            onlineText.setAlpha(ready ? 1 : 0.4);
            onlineBox.setAlpha(ready ? 1 : 0.6);
            onlineBox.input.cursor = ready ? 'pointer' : 'default';
        };

        const openOnline = () => {
            if (!onlineReady) {
                this.sound.play('deny');
                return;
            }
            changeBotMode(false);
            fadeOutTo(this, () => this.scene.start('OnlineLobbyScene'));
        };
        onlineBox.on('pointerdown', openOnline);
        onlineBox.on('pointerover', function () {
            if (!onlineReady) return;
            onlineBox.setFillStyle(0xffffff);
            onlineBox.setStrokeStyle(4, 0xbbbbbb);
        });
        onlineBox.on('pointerout', function () {
            onlineBox.setFillStyle(0x111111);
            onlineBox.setStrokeStyle(4, 0x000000);
        });
        layout.push({button: onlineBox, action: openOnline});

        if (!isOnlineConfigured()) {
            setOnlineState(false, 'NOT AVAILABLE', '#999999');
        } else {
            setOnlineState(false, 'CHECKING...', '#bbbbbb');
            const menuVisit = this.menuVisit = (this.menuVisit ?? 0) + 1;
            let checking = false;
            const refreshStatus = () => {
                if (checking) return;
                checking = true;
                fetchServerStatus().then(status => {
                    checking = false;
                    if (menuVisit !== this.menuVisit || !this.sys.isActive()) return;
                    if (!status) {
                        setOnlineState(false, 'SERVER OFFLINE', '#ff6b6b');
                        onlineCount.setText('');
                        return;
                    }
                    setOnlineState(true, `${getServerName()} - ${status.waiting ?? status.online} WAITING`, '#7dff8a');
                    onlineCount.setText(`${status.online} ONLINE`);
                });
            };
            refreshStatus();
            this.time.addEvent({ delay: ONLINE_STATUS_REFRESH_MS, loop: true, callback: refreshStatus });
        }
        layout.push({button: modeArrowBox, action: toggleBotMode});
        layout.push({button: botBox, action: startBotMatch});
        layout.push({button: startBox, action: () => {
            changeBotMode(false);
            if ('audioSession' in navigator) {
                navigator.audioSession.type = 'playback';
            }
            fadeOutTo(this, () => this.scene.start('MapAndModifierSelectScene'));
        }}); 

        const introLength = slideInFromSides(this, [
            [changelogBox, changelogBlurbTitle, changelogBlurb, openChangelogText],
            { objects: [onlineBox, onlineText, onlineStatus, onlineCount], ease: 'Cubic.easeOut', duration: 275 },
            { objects: [botBox, botText, modeArrowBox, modeArrow], ease: 'Cubic.easeOut', duration: 275 },
            { objects: [startBox, startText], ease: 'Cubic.easeOut', duration: 275 }
        ]);
        this.menuIntroUntil = this.time.now + introLength;
    }

    update() {
        currentControllers = getConnectedControllers(this);
        primaryController = currentControllers[0] ?? null;

        if (!primaryController) {
            return;
        }

        // Wait for the buttons to finish sliding in so the box lands on them.
        if (this.time.now < this.menuIntroUntil) return;

        if (!navBox) {
            navBox = createNavigationBox(this, {
                color: 0xffffff,
                lineWidth: 3,
                padding: 8,
                duration: 150,
                depth: 1000
            });

            if (layout.length > 0) {
                moveNavigationBox(
                    this,
                    navBox,
                    layout[selectedIndex].button
                );
            }
        }

        if (!layout.length) return;

        const input = getMenuGamepadInput(primaryController);

        const justPressed = key =>
            input[key] && !previousInput[key];

        let direction = 0;

        if (justPressed("up") || justPressed("left")) {
            direction = -1;
        } else if (justPressed("down") || justPressed("right")) {
            direction = 1;
        }

        if (direction !== 0) {
            selectedIndex = moveSelection(
                selectedIndex,
                direction,
                layout.length
            );

            moveNavigationBox(
                this,
                navBox,
                layout[selectedIndex].button
            );
        }

        if (justPressed("a")) {
            layout[selectedIndex].action();
        }

        previousInput = { ...input};
    }
}
