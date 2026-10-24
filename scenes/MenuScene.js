
import { changeBotMode, simulationMode } from "../gameSettings.js";
import { preloadMenu } from "./GameScene/preload.js";
import { fadeOutTo, slideInFromSides } from "./transitions.js";
import { fetchServerStatus, getServerName, isOnlineConfigured } from "../mp/serverConfig.js";
import { getNavigationBounds, wrapIndex, moveSelection, createNavigationBox, moveNavigationBox, getConnectedControllers, getMenuGamepadInput} from "../navigation.js"
var currentControllers = [];
var primaryController = null;
var navBox = null;
var layout = []
var selectedIndex = 0;
var previousInput = {};
const CHANGELOG_VERSION = "2026-10-22-1";

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
export const MenuScene = {
    //load the menu scene which is just a cool background image we made
    //its also has the start button, initiating the game when clicked
    key: 'MenuScene',
    preload: preloadMenu,
    create: function () {
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
                title: "MOBILE THUMBSTICK FOR MULTIPLAYER",
                body: "A thumbstick for mobile players in online multiplayer."
            },
            {
                title: "TRAPPER FISHERMAN",
                body: "The TRAPPER variant of FISHERMAN."
            },
            {
                title: "SLATEMAN REWORK",
                body: "Slateman will be reworked."
            },
            {
                title: "LAWNMOWER SCYTHEMAN",
                body: "The LAWNMOWER variant of SCYTHEMAN."
            }
        ];

        const changelogBox = this.add.rectangle(
            190, 300, 340, 450, 0x111111, 0.88
        ).setStrokeStyle(3, 0x686868);

        const compactTitle = this.add.text(
            40, 135, "LATEST UPDATE", {
                fontFamily: "VCROSD",
                fontSize: "24px",
                fill: changelogColor,
                stroke: "#000000",
                strokeThickness: 5
            }
        );

        const compactText = this.add.text(
            40, 180,
            "FISHERMAN has been reworked: arms, a smaller hook that snaps to players, a reeling line and faster attacks. Hits, launches, KOs and wins also have new effects, and the menu slides in.",
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
                        mask: { padding: 0 }
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
                setOnlineState(true, `${getServerName()} - ${status.online} ONLINE`, '#7dff8a');
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
            [changelogBox, compactTitle, compactText, openChangelogText],
            [onlineBox, onlineText, onlineStatus],
            [botBox, botText, modeArrowBox, modeArrow],
            [startBox, startText]
        ]);
        this.menuIntroUntil = this.time.now + introLength;
    },
    update: function () {
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

    
};