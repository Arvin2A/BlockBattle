// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import Phaser from 'phaser';

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
const CHANGELOG_VERSION = "2026-11-04-1";

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

    return `#${[r, g, b]
        .map(v => v.toString(16).padStart(2, "0"))
        .join("")}`;
}

const changelogColor = getVersionColor(CHANGELOG_VERSION);const CHANGELOG_STORAGE_KEY = "blockBattleSeenChangelog";
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

        const changelogEntries = [
            {
                title: "LAWNMOWER SCYTHEMAN",
                body: "SCYTHEMAN's new variant is here, and he's here to run you over. Press attack to shove his mower into you and grind until it blows up, hit ALT to ride it around way faster, or double-tap a direction to EJECT it, sending it off on its own, speeding up until it explodes on whatever it hits.\n Once it blows up he's stuck with a PULL CORD for 6 seconds, so mow some grass to get it back sooner. Every bit of grass he cuts also turns into CLIPPINGS you can spray back with neutral special."
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
            },
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
            },
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
            },
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
            },
            {
                title: "FISHERMAN REWORK",
                body: "FISHERMAN has arms now and has been redesigned, with a thinner fishing line and an intro animation where he spins his rod.\n The hook isn't absurdly huge anymore. Instead it snaps to a player in its hit range, and the line curves more. If the hook falls below the platform it's hooking onto, it curves upward a bit.\n The line now reels in instead of instantly disappearing, and reeling/pulling it in has its own quick animation of lifting the rod up.\n Overall the ability is much more concise and easier to use, and FISHERMAN attacks faster (not as fast as DAGGER though)."
            },
            {
                title: "BETTER GAME EFFECTS + MENU INTRO",
                body: "An attempt to add better game effects and a menu intro animation.\n Hits now spray tiny white particles from the side that got hit. At 100% KB and up, getting launched leaves a white ghost trail and smoke and shakes the screen. At 200% and up it gets VIOLENT: a red ghost trail and a severe screen shake.\n Fighters at 100%+ pulse red, landings and double jumps kick up dust, KOs fire a beam back into the arena, and respawns flash in.\n Winning now shows a GAME! screen and a results panel with KOs, max KB and damage dealt.\n The menu slides in from the sides, and the UI uses the same colors and fonts everywhere."
            },
            {
                title: "HAMMERMAN REDESIGN!",
                body: "MALLET HAMMERMAN has been redesigned with more detailed animations and an intro animation, just like swordman."
            },
            {
                title: "QUICK CHAT + NAME FILTER",
                body: "Limited selection of messages are now present when playing online multiplayer, inappropriate usernames have been filtered."
            },
            {
                title: "SWORDMAN REDESIGN!",
                body: "Later, all characters will recieve a redesign, right now swordman has more detailed animations and an intro animation."
            },
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
            },
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
        ];

        const upcomingEntries = [
            {
                title: "HOOKER REWORK",
                body: "CROWBARMAN's HOOKER is getting reworked and redesigned."
            },
            {
                title: "DEMOLITIONIST CROWBARMAN",
                body: "A brand new CROWBARMAN variant: DEMOLITIONIST."
            },
            {
                title: "LUMBERER + DAGGER REDESIGNS",
                body: "AXEMAN's LUMBERER and SWORDMAN's DAGGER are getting redesigned."
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
            "LAWNMOWER SCYTHEMAN is out: plow, ride or EJECT his mower. Every fighter can also BLOCK, SMACK DOWN and LEDGE GRAB now. Check the full changelog for more!",
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
                { label: "LATEST UPDATE", entries: changelogEntries, x: 395 },
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

                    const body = this.add.text(0, 0, entry.body, {
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
                    y: 315,
                    width: 790,
                    height: 350,

                    scrollMode: 0,
                    scrollDetectionMode: 1,

                    background: this.add.rectangle(
                        0, 0, 790, 350, 0x202020
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

            const selectTab = (index) => {
                if (activeTab === index) return;
                activeTab = index;

                tabObjects.forEach((tabObject, i) => {
                    const active = i === index;
                    tabObject.box.setFillStyle(active ? 0x333333 : 0x202020);
                    tabObject.box.setStrokeStyle(2, active ? 0xaaaaaa : 0x444444);
                    tabObject.text.setColor(active ? changelogColor : "#aaaaaa");
                });

                changelogPanel?.destroy();
                buildPanel(tabs[index].entries);
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
                closeBox,
                closeText
            ];

            changelogModalObjects = modalObjects;

            const closeChangelog = () => {
                if (!changelogOpen) return;

                changelogOpen = false;
                console.log("Panel size:", changelogPanel.width, changelogPanel.height);
                console.log("Entry count:", changelogEntries.length);
                

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
            875,
            420,
            200,
            70,
            0x111111
        );
        botBox.setStrokeStyle(4, 0x000000);

        // The arrow beside this button flips it between VS CPU and SIMULATION
        // (bot vs bot). The choice stays until the page is reloaded.
        let simulationSelected = simulationMode;
        const botText = this.add.text(
            875,
            420,
            simulationSelected ? 'SIMULATION' : 'PLAY VS CPU',
            {
                fontFamily: 'VCROSD',
                fontSize: '28px',
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

        const modeArrowBox = this.add.rectangle(755, 420, 20, 70, 0x111111);
        modeArrowBox.setStrokeStyle(4, 0x000000);
        modeArrowBox.setInteractive({ useHandCursor: true });
        const modeArrow = this.add.triangle(
            755, 420,
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
            875,
            340,
            200,
            70,
            0x111111
        );
        onlineBox.setStrokeStyle(4, 0x000000);

        const onlineText = this.add.text(
            875,
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
        const onlineStatus = this.add.text(875, 359, '', {
            fontFamily: 'GameFont',
            fontSize: '11px',
            fill: '#bbbbbb',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        onlineBox.setInteractive({ useHandCursor: true });
        // Everyone connected, in a match or not. The button itself shows who's waiting.
        const onlineCount = this.add.text(875, 285, '', {
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
            fetchServerStatus().then(status => {
                if (menuVisit !== this.menuVisit || !this.sys.isActive()) return;
                if (!status) {
                    setOnlineState(false, 'SERVER OFFLINE', '#ff6b6b');
                    return;
                }
                // Older servers don't send waiting yet.
                setOnlineState(true, `${getServerName()} - ${status.waiting ?? status.online} WAITING`, '#7dff8a');
                onlineCount.setText(`${status.online} ONLINE`);
            });
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
            [onlineBox, onlineText, onlineStatus, onlineCount],
            [botBox, botText, modeArrowBox, modeArrow],
            [startBox, startText]
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
