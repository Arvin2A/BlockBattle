# Changelog

## 2026-11-20

### Added
- AIR DODGE: pressing block in the air does an upward dodge instead of blocking. It pushes at 450 speed, straight up or diagonally up toward the direction held (or the way the fighter is already moving), and gives 0.25s of invincibility. One per time in the air; it recharges on landing or grabbing a ledge. It doesn't need or use shield, can't be used in hitstun, and normal movement can't cancel the push for 0.2s. Bots use it when they'd block in the air.

### Changed
- Blocking only works on the ground. Leaving the ground while blocking drops the shield.
- SLEDGEHAMMER's big swing and QUICKSLAM's second hit cost 1.2 of a shield when blocked, so they break any shield in one hit (LONGSWORD's included).
- SLEDGEHAMMER's attacks go through his own THICK STEEL PLANK again, and his bot waits behind its wall and attacks through it like MALLET's.
- CROWBARMAN's GRAB (HOOKER included) can't be blocked.
- CROWBARMAN moves at half speed while holding someone with his GRAB.
- The name filter catches more kinds of bad names.

### Fixed
- CROWBARMAN could spam his air neutral special to fly while falling back in after a KO.
- Players whose connection silently died stayed connected to the server and counted as online. The server now drops them.

## 2026-11-18

### HOOKER REWORK + NEUTRAL SPECIAL
- HOOKER's neutral special is CROWBAR VAULT. On the ground he plants a little crowbar in front of him, tips it over, and gets launched about twice as high as a normal jump with a little forward push. Letting go of jump doesn't cut the vault short, and he keeps his double jump. The crowbar flies off spinning, swings out ahead of him and curves back into his hand; he can't vault again until he catches it. Getting hit while it's planted cancels the launch. It does nothing in the air for now.
- HOOKER's GRAB has a new spin throw. Pressing attack while holding someone swings them all the way around him on the end of the crowbar (passing behind him on the back half of the spin) before flinging them on the last frame of the spin, with a slowed-down whoosh. The spin moves in choppy steps that match its 7 frames.
- HOOKER's GRAB fling is a real hit now: it deals 0.04 damage and its knockback grows with damage (1000 sideways and 600 up at its base, instead of a flat 1000/200 push). It goes the way you're holding, or the side they were grabbed on.
- After pressing attack to start the spin throw, HOOKER can't attack or tilt for 2 seconds.

### Added
- HIT PARTICLES setting (ON by default) in the settings panel. Turning it off hides the white hit pixels, both offline and online; online, each player's choice only affects their own screen.
- A new STRONG knockback level at 60%. It only adds hit freeze: a launch from a fast enough hit freezes 1.25x as long.
- SLEDGEHAMMER dashes into QUICKSLAM: a quick 0.112s dash at 1000 speed (about the same distance as AXEMAN's side special, 1.25x faster) while holding the new rising frame, then the slam plays from there. Getting hit mid-dash cancels the slam.
- SLEDGEHAMMER's THICK STEEL PLANK deflects SNOWY ARENA cannonballs like LONGSWORD does: the ball fires back at 3x speed at the nearest other fighter, credited to SLEDGEHAMMER. Each wall deflects a given ball once, and his own deflected balls pass through his wall.
- The main menu checks the online server every 10 seconds, so the ONLINE count, WAITING count and SERVER OFFLINE status stay current while you sit on the menu.

- SNOWY ARENA's blizzard is easier to read: when its 35% damage lands, each fighter is encased in a see-through light blue ice copy of themselves, frozen mid-stretch for 0.5s, before the ice shatters with a new ice-breaking sound. Getting hit breaks the ice early.

### Changed
- The blizzard slows fighters to 0.75x instead of 0.5x.
- WEATHER HAZARDS is now an orange modifier instead of red.
- Every attack that hits downward (aim more than 0.7 down) into a grounded fighter now launches them a fixed 500 sideways (away from the attacker) and 200 up, with no growth, whether the attacker is grounded or airborne. This replaces each attack's own spike values and stops weak downward hits like LAWNMOWER's PULLCORD from pinning people into the floor. Moves that deliberately pin a grounded fighter (FISHERMAN's harpoon finisher, GRUELING SLAM) still do.
- HEAVY and VIOLENT launches freeze 1.5x as long, including their existing freeze bonuses.
- Hit particles: half as many (5 per hit), each one lasting 0.45-0.65s and staying fully visible until the last 20% before fading, 2-4px in size, flying in a wider falling arc and moving in slightly choppy steps. Harder hits make them faster, straighter and shorter-lived. HEAVY, VIOLENT and ULTRA hits no longer spawn them at all.
- SUPER PRY's crashing platform has 1.3x the horizontal and 1.8x the vertical knockback (877.5/742.5 instead of 675/412.5). LONGSWORD's batted platform keeps its old knockback.
- DEMOLITIONIST's TAPE PUNCH stops at walls and deals 0.13 damage to them (one punch breaks an AXEMAN plank, four break SLEDGEHAMMER's).
- SNOWY ARENA cannonballs cost 0.4 of a shield to block instead of a full shield, and launch at 85% of their old strength (382.5/357 instead of 450/420).
- SLEDGEHAMMER's QUICKSLAM follow-up uses its own animation and stays facing the slam's direction instead of turning upward when you press up.
- Downslams take a double-tap of down in the air (two presses within 0.3s) instead of holding down. Double-tapping before a fighter's minimum air time queues the downslam for when it's allowed; landing or getting hit cancels it.
- DEMOLITIONIST's TAPE PUNCH has 1.4x the horizontal knockback (560 instead of 400).
- SUPER PRY's crashing platform ignores knockback resistance (SLATEMAN's armor, SCYTHEMAN's grass cuts, heat).
- The wedged SUPER PRY crowbar is a one-way platform: you can jump up through it from below and pass through its sides, and still land on top of it.

### Fixed
- DEMOLITIONIST's TAPE PUNCH went straight through walls without damaging them.
- SLEDGEHAMMER's QUICKSLAM follow-up always dashed to the right when he was facing left.
- A cannonball deflected a second time kept its old speed for the rest of that frame.
- DEMOLITIONIST's tape case always pointed sideways while idle. It now points up or down when he's facing that way, and a punch with no direction held goes the way he's facing, including straight up or down.

## 2026-11-17

### Added
- JUNGLE ARENA's weather hazard, the RAINSTORM. Rain fades in over the whole arena (with its own fade-in and looping rain sounds) and lasts 5 seconds. It deals no damage, but while it's raining every fighter has a light blue tint, moves at 0.8x speed, deals half damage with every attack, and is more slippery on the ground: they speed up and slow down at 0.4x the usual rate, so they slide before stopping. A flytrap that catches someone during the rain holds them twice as long (6 seconds instead of 3) and gulps twice as many times (12 instead of 6).
- The desktop app updates itself. Each time it starts, it checks for the newest version of the game and downloads only the files that changed, showing the progress on a loading screen, then starts the game. If it's offline or the check fails, it starts the version it already has. If an update ever needs a newer app, it asks the player to download the new app from the Releases page or keep playing the version they have.

### Changed
- BLOCK BATTLE!!'s APP ICON has been updated to be less outdated
- JUNGLE ARENA no longer borrows DESERT ARENA's sandstorm (and its damage and wind) as its weather hazard.
- JUNGLE ARENA's light shafts and shadow strips fade out over 1.5 seconds when a RAINSTORM starts and fade back in over 1.5 seconds when it ends.
- When a game is out of date with the online server, the message now also says to restart the desktop app.
- DEMOLITIONIST's TAPE PUNCH reaches 250px instead of 350px and its knockback is much lower (400/220 instead of 700/520, still growing with damage). Each punch now takes exactly 1 second from start to finish (the fist shoots out over 0.3s, then the tape winds back in for the rest of the second) instead of a 1.5 second cooldown. Holding up or down aims it straight up or straight down; when he isn't ANCHORED, a vertical punch recoils him the opposite way.
- When a TAPE PUNCH is countered by a timed block, the tape snaps back in a quarter of its remaining wind-in time and the counter hits DEMOLITIONIST once the tape is back, instead of right away.
- DEMOLITIONIST's tape case no longer kicks back after a punch.
- DEMOLITIONIST's CROWBAR SLAM is 3.6x faster: one continuous swing over about 0.8 seconds, then he slowly puts the crowbar back on over 2 seconds (about 2.8 seconds in total, down from 4). While it winds up he rushes forward at 2.5x his walk speed and can't turn around; once it lands he's at 0.6x his usual speed until the crowbar is back on. It now hits exactly like a SMACK DOWN (25%, but squashed flat and bounced away) instead of 20% and a 2-3 second implant.
- SUPER PRY: the wedged crowbar is solid (anyone can stand on it or bump into it), and the downslams have to land on top of it. Each notch tilts it further out from the platform instead of sinking it, and when the notches fade it leans back to where it started. When the platform tears out, the crowbar gets flung off and a new one flies in onto his back 2 seconds later (no PLANT or CROWBAR SLAM until then) instead of flying straight back.
- SUPER PRY's falling platform launches half as hard (675/412.5 instead of 1350/825), so it's no longer a near-guaranteed KO. Its warning column is wider (150px instead of 90px) and brighter red, the ! is bigger and white, and a new danger alarm plays when it appears.
- The SUPER PRY platform can be blocked; blocking it costs 2 full shields, so it always breaks the shield. LONGSWORD's SWORD GUARD deflects it instead: it flies off sideways, spinning, and hits everyone else in its path once for 30% with 5/8 of the platform's knockback.
- When a hit costs more shield than the blocker has left, the shield-break stun is longer: 1.5s plus another 150% for every full shield of overflow.
- JUNGLE ARENA's flytraps reach 475px instead of 375px.
- CPUs playing DEMOLITIONIST stand next to the wedged crowbar, jump onto it and steer over its top before downslamming for SUPER PRY.

### Fixed
- Replaced or edited images and sounds now update right after a deploy. Every game image and sound is loaded with a version tag taken from its contents, so browsers and hosts can't keep serving an old copy.

## 2026-11-16

### Added
- DEMOLITIONIST, a new CROWBARMAN variant with his own body sprite. He has no combo; his attack is TAPE PUNCH. Each press shoots the metal fist on the end of his tape measure out of the tape case, up to 350px, with a ratchet sound, and it hits the first opponent anywhere along its path, stopping on them, for 6% with real knockback that grows with damage. The tape case stays kicked back for 0.5s while the tape winds in, and there's a 1.5 second cooldown between punches, the longest of any fighter's attack.
- DEMOLITIONIST's tilts: RULER UP (straight up), FLOOR MEASURE (a low poke at the feet that pops them up) and QUICK TAPE (a short straight punch). Each is a fixed-length tape poke for 3.5% with no knockback growth, no recoil and no wind back, with a 0.2s cooldown between tilts.
- DEMOLITIONIST can downslam after only 0.25s in the air instead of the usual full second, so the 3 downslams for SUPER PRY are much quicker to pull off.
- DEMOLITIONIST is ANCHORED while his crowbar is on his back: 0.6x walk speed and 0.8x jump height, and his punches have no recoil. Without the crowbar he moves normally, but every TAPE PUNCH launches him backwards a little.
- DEMOLITIONIST's neutral special, PLANT. On the ground, he slams the crowbar into the ground just in front of him (0.3s). Pressing it again while touching the crowbar straps it back on. A TAPE PUNCH that ends right at the planted crowbar latches on and ZIPs him straight to it.
- DEMOLITIONIST's directional special, CROWBAR SLAM. In one slow, continuous swing over 3 seconds he hauls the crowbar off his back, up and over, and down about 175px in front of him, then puts it back on (4 seconds in total). It hits for 20% and implants them like GRUELING SLAM, but longer (2s on the ground, 3s if they're caught in the air), and they're squashed flat for as long as they're stuck. It runs alongside his attacks, so he can keep punching and walking while it winds up; nothing can interrupt it once it starts, not even getting hit (only getting KO'd stops it). The 3.5s cooldown starts after it ends. While the crowbar is planted, the same input calls the crowbar back from anywhere instead (and starts the cooldown).
- SUPER PRY. Planting the crowbar within 40px of a bottom corner of a platform's image (where it meets the ground he's standing on) wedges it into that corner, with a heavier clang, a dust burst and the platform shaking. Each downslam he lands on the wedged crowbar drives it in a notch, plays a rip sound, cracks the platform a bit more and shakes it. The notches fade after 4 seconds without a new one. On the 3rd notch the platform tears out in a big explosion and flies off the top of the screen spinning while the crowbar flies back onto his back. Anyone standing on it just drops instead of getting carried off. About 1.4s later a red column with a flashing ! locks onto the nearest opponent and follows them, and the platform comes down on them over the last 350ms, still turning, homing in slowly behind the column, timed to land as the falling whistle ends. It crashes down with a slam and an even bigger explosion. It hits for 85% with a huge launch, a real KO move, then stays where it crashed for the rest of the match, tilted, and anyone can stand on it. If there's no ground where it comes down, it falls off the map. Each platform can only be pried once.
- CPUs can play DEMOLITIONIST: they punch as soon as the tape can reach you, use CROWBAR SLAM up close, and block when one of his slams is about to land on them. They also go for SUPER PRY on their own while their opponent is far away (450px+) or off the stage: they walk to the nearest platform corner on their ground, plant the crowbar, then jump and downslam onto it until the platform rips out, giving up if the opponent comes within 220px.
- DAGGER's new directional special, PLUNGE (double-tap left/right), replacing QUICKSTEP there. He dashes forward in 5 short bursts and stabs at each stop: the first four hits deal 5% each with a small push that keeps the opponent in front of him, and the fifth deals 10% with real knockback, 30% in total.
- DAGGER's neutral special, QUICKSTEP. He vanishes in a puff of smoke for 0.18s (invincible while gone), reappears about 150px away in the direction held (up, down, nothing for straight ahead, or up/down plus left/right for diagonals; he stops short of the main stage and walls instead of going into them), then, only if the blink passed through an opponent, darts about 100px straight back at them, hitting for 7.5%. 0.6 second cooldown. Plain special + left/right and double-taps are still PLUNGE.
- A SCREEN SHAKE setting with DEFAULT, REDUCED (40%) and NONE. It's saved with the other settings and also applies in online matches, where the server now sends the shake separately from the camera.
- ANGLER's neutral special, FISH THROW. He winds his arm up with a fish in his hand and flings it forward. The fish flies under normal gravity and never travels more than 200px forward (after that it just drops). It hits the first opponent in its path for 6% with a small push (no knockback growth), then flies off backwards, spinning fast as it falls off the map. If it misses, it lands on the ground and fades away. There's no limit on fish; the windup is what keeps it in check. The three fish colors take turns. LONGSWORD's SWORD GUARD bats it straight back at ANGLER 1.3x faster, hitting him with the fish's hit (credited to LONGSWORD).
- LUMBERER's neutral special, THROW / RECALL. Pressing it throws his axe forward in a spinning arc. It hits the first opponent it touches for 7% with a small push (no knockback growth) and leaves them CHOPPED for 0.5 seconds, then drops; otherwise it sticks into the first platform, ground or plank it lands on (planks take 0.3 damage, and if one breaks the axe keeps going). 1.5 seconds after the throw, or as soon as it reaches the edge of the map, the axe RECALLs itself: it flies straight back to him, speeding up, and hits every opponent it passes through once for 5% (no CHOPPED). There's no manual recall, so the axe can't be spammed back and forth. While the axe is out he can't attack, use tilts or POWER SWING, and he always has it after respawning. LONGSWORD's SWORD GUARD bats it straight back at LUMBERER 1.3x faster, hitting him with the throw's hit (credited to LONGSWORD), and he catches it.
- JUNGLE ARENA's map danger: mud pillars with flytraps. Every so often 1-2 mud pillars rise out of the bottom of the arena at random spots, jittering as they come up, to 300-500px above the bottom. They're solid, and always stay at least 50px from every platform's hitbox (so they can come up under a scaffold top but never block one). A flytrap head sits on top of each pillar's stem. It turns to follow the nearest player (each flytrap picks a different player when it can) for 5 seconds, then lunges out on a green vine at its target if they're within 375px, waiting up to 3 more seconds for them to come in range. A caught player is held in the closed flytrap for 3 seconds, taking 3% every 0.5s (18% total) and can't be hit by anything else, then gets spat out toward the middle of the arena. Then the pillar sinks back down. NO DANGERS turns it off.

### Changed
- Heavy, violent and death-ray launches no longer shake the screen. Instead, the launched fighter jitters in place for the length of the hit freeze (3-6px for heavy, 8px for violent, 12px for the death ray).
- Projectiles LONGSWORD bats back with SWORD GUARD while SHEATHED now deal 1.2x their normal damage: GUNMAN's shots, the SNOWY cannonball, TRAPPER's harpoon, LAWNMOWER's EJECT, LUMBERER's axe and ANGLER's fish.

### Fixed
- ANGLER's GRAPPLE no longer bounces the reeled-in opponent back out. Being yanked in at high speed counted as a crash into ANGLER, which rebounded them. Players being reeled in by GRAPPLE, and ANGLER himself while GRAPPLE pulls him to a platform, can't crash-rebound for the length of the pull.

## 2026-11-15

### Added
- An alpha desktop app of BLOCK BATTLE!! for Windows (installer and portable .exe), macOS (universal .dmg) and Linux (.AppImage), built with Electron and published on the GitHub Releases page by a new release workflow. The website is still the recommended way to play during the alpha. Press F11 in the app for fullscreen.
- GUNMAN's new neutral special, SHOTGUN, replacing the grenade (CHUCK). A close-range blast that hits every opponent in a cone in front of him (up to 200px, roughly 40 degrees either side of where he aims) with the grenade's old hit: 8%, 0.5s hitstun and the same knockback. Each shot kicks him back a little. He has 2 shells; after the second, they reload together in 1.2s.
- GUNMAN always shows the last gun he used (pistol, MINI or shotgun) instead of hiding it between shots. He starts holding the pistol.
- LONGSWORD's neutral special, SHEATHE. Pressing it puts the sword away with a light shove (range 100, 2%, no knockback growth). While sheathed he moves 1.25x faster. His next attack, basic or tilt, becomes a QUICK DRAW: he's rooted for a ~0.27s windup, then slashes for 12% with strong knockback that grows with damage (range 150), with its own QUICK DRAW sound. He can block while sheathed with SWORD GUARD as normal (counter and deflect included), but his shield drains twice as fast while held. When a hit actually lands on that block (and his shield survives), he QUICK DRAWs straight into the attacker: no windup, the draw animation and sound, and the same 12% slash on top of the counter. The QUICK DRAW slash can't trigger the death ray. A hit during the windup cancels it and leaves the sword drawn. Pressing neutral again while sheathed does the QUICK DRAW right away (windup and slash included), and LUNGE draws it too. He's always drawn after respawning.
- SLATEMAN's neutral special, BRACE. On the ground, pressing it turns him to stone with a rock-break sound and locks him in place: he heals 10% KB once every second (down to 0%) with MALLET's green heal flash, and he's locked in for at least 1 second. After that, pressing special again or any other button (move, jump, attack, block) ends it, and that button goes through right away. Leaving the ground ends it at any time. A hit also ends it, but that hit deals 1.5x less damage (2/3). Burning in the DESERT heat ray doesn't break it. Touch buttons other than S grey out for that first second.
- SLATEMAN's air neutral special, ROCKFALL. He turns to stone and drops straight down fast, invincible for the whole fall, hitting anyone right below him once for 4% with a small push, then lands with a dirt burst and goes straight into BRACE. Pressing special again mid-fall cancels it.
- JUNGLE ARENA lighting. Soft shafts of sunlight slant down from the canopy gap at the top right and slowly shimmer, with sharp see-through shadow strips falling between them at the same angle.
- Fighters cast the same simple slanted shadow on JUNGLE ARENA that they do on SNOWY ARENA.
- JUNGLE ARENA's scaffolds cast a sharp slanted shadow just under each top bar.

### Changed
- JUNGLE ARENA's layout was reworked so no scaffold overlaps another. There's now a tower on each side (left lower, right higher) with a smaller tower stacked on each, and a small tower standing on the middle of the main stage. Stacked towers end where they sit instead of running down behind the one below.
- JUNGLE ARENA's light shafts reach all the way down past the stage and fade out gradually instead of stopping short.
- New JUNGLE ARENA preview on map select showing the new layout and lighting.
- Blocking or deflecting LAWNMOWER's EJECT now costs 0.45 shield instead of 0.67, so LONGSWORD no longer always shatters his shield batting it back (he takes about two-thirds of a full shield). The eject's hit damage is unchanged at 0.40.
- JUNGLE ARENA runs smoother. Its scaffold images were trimmed down to just the scaffolds, so the game no longer draws huge empty areas around each tower.
- DESERT ARENA's heat ray has a new look: a wide white core with thin yellow edges, both see-through, instead of a narrow white strip down a wide orange beam.

### Fixed
- LAWNMOWER's EJECT now explodes the moment it reaches the edge of the map instead of sitting there until it runs out of time.

### Removed
- GUNMAN's grenade (CHUCK). The SHOTGUN replaces it.

## 2026-11-14

### Added
- NO DANGERS modifier (yellow). It turns off map dangers (what used to be called map hazards): the SNOWY cannon and the DESERT heat ray. The cannon still shows on the cliff but never fires. Weather isn't affected; that's still WEATHER HAZARDS / NO MERCY.
- A new character select screen. All fighters sit in one large grid at the top, and below it each side has its own card showing the fighter holding their weapon and cycling through their attacks, plus the name, variant, CPU difficulty (for CPUs) and a P1 / P2 / CPU badge.
  - WASD / arrows move, Q / `/` switch variants, E / SHIFT lock in and R / `.` unlock. Controllers use the D-pad, A to lock in, B to unlock and the shoulder buttons for variants. Clicking a fighter picks for P1 (right-click for P2), and each card has a full-width READY / UNREADY button at the bottom, with a P1 / P2 / CPU tab on the card's top edge.
  - When both sides are locked in, a READY TO FIGHT bar slides in. Click it or press E / SHIFT / ENTER to start.
  - On touchscreens each card has its own D-pad with an OK button.
- Press I during a match to pause and open ADVANCED INFO on your fighter. Press I or Esc again to close it and keep playing.
- An info button in the pause menu that opens ADVANCED INFO.
- A FIGHTER INFO row in the settings menu with a VIEW button that opens ADVANCED INFO, on every menu screen and in offline matches. Closing it goes back to settings.
- Press I on the character select screen to open ADVANCED INFO on P1's current fighter and variant.

### Changed
- DESERT ARENA's heat ray comes back 7 seconds after it fades instead of 5, and each burn tick while you're standing in it deals 1% instead of 2%. The afterburn and NO MERCY timing are unchanged.
- LAWNMOWER's PLOW only grinds opponents in a narrow strip straight in front of the mower: they have to be roughly level with it (at most 30px above or 35px below) and close to straight ahead (within about 37 degrees). It can no longer hit people above you.
- HOOKER CROWBARMAN's crowbar now turns to point at the player he's grabbed for the whole grab, instead of only leaning toward them a little.
- ADVANCED INFO isn't on the character select screen anymore. Open it in a match or from the online menu.
- The in-match play, restart, settings, home and info buttons are tinted to match SNOWY ARENA, JUNGLE and INFINITE BRIDGE. DESERT ARENA keeps the original sandy colors. The settings gear on map select and character select switches to the highlighted map's tint right away.

### Fixed
- TRAPPER's net no longer passes through a wall when thrown right next to it. If a wall is in the way when the net leaves his hands, it stops against that wall and drops down on his side.

## 2026-11-13

### Added
- A VIEW MODIFIERS button in online lobbies, next to the modifier count. It opens a scrollable list of every modifier the host picked, with its setting and description. The lobby's mode, arena, modifier count and the button are centered together as a group.
- An ADVANCED INFO panel for fighters, replacing the BASIC VIEW / ADVANCED VIEW toggle. Open it from the character select screen or the online menu. It shows the fighter's name and a big icon, the arrows flip through every fighter and variant, the text scrolls when it's long, and X (or Esc) closes it. The text types itself out when the panel opens.
- Moves that weren't written down are now in each fighter's info: TRAPPER's harpoons and harpoon throw, CHAINSAW's dig and build, LONGSWORD's block, LUMBERER's CHOPPED, GUNMAN's explosive 5th shot, and SIPHONING REPAIR's heal numbers.
- A separate count of players waiting in QUICK 1V1, on the QUICK 1V1 button, in the search screen and in the online status bar.

### Changed
- The online fighter box is slimmer, so the lobby panel next to it is much wider.
- TRAPPER's net can't be blocked or parried anymore, and it traps for 2 seconds instead of 3.
- TRAPPER's net stops at walls (platform sides, steel planks, lodged cannonballs). Hitting one from the side makes it crash straight down; landing on top makes it lie there, and it falls again if that wall goes away.
- MALLET HAMMERMAN's SIPHONING REPAIR heals 5% per strike that misses instead of 7.5%. Strikes that land still heal 25%.
- CHOPPED slows you to 35% speed on the ground and 75% in the air instead of a flat 50%. It still halves your damage.
- GUNMAN's shots, including MINI, hit whoever is first in the line of fire instead of only his main target.
- A cannonball LONGSWORD bats into someone pops off them and arcs down with some of its sideways speed instead of dropping straight down.
- Players who tabbed away still show up in the invite list, marked AWAY, and can be invited.

### Fixed
- Players who left the online menu and came back sometimes didn't show up in the invite list until a refresh.

## 2026-11-12

### Added
- SNOWY ARENA's cannon hazard. A cannon sits on the cliff behind the bridge, and every 15 seconds of a match it picks a random player.
  - A red mark follows that player for 3 seconds while the cannon slowly turns to aim.
  - Then the mark spins fast and jumps ahead to where the cannon predicts the player will be, and a second mark appears where the player was standing. The cannon fires one cannonball at each mark.
  - A cannonball launches anyone in its path for the last 0.2 seconds before it reaches its mark, or anyone it lands on. It launches them hard (it can KO at high damage), then drops through the platforms, still launching anyone it falls on, and lodges in the bridge as a solid, round obstacle for 5 seconds.
  - Blocking a cannonball stops the launch, but it always shatters your shield.
  - Map hazards like the cannon are always on. The WEATHER HAZARDS modifier still controls the blizzard and sandstorm.
  - The cannon doesn't appear on INFINITE BRIDGE.
- DESERT ARENA's heat ray. A wide, blazing ray slams down at an angle toward a random player, then sways a little for 3 seconds (it doesn't follow anyone). The next one comes 5 seconds after it fades.
  - Standing in the ray burns you fast. Once you get out you keep burning a bit longer, for 10% more damage in total.
  - SLATEMAN loves it. While he's burning he glows red and gets hotter: 1.3x damage, 10 more range, a 1.3x faster PLUNGE slide and 1.5x movement speed, but he takes a bit more knockback (his resistance drops by a quarter). It lasts until he stops burning.
- CPUs in online lobbies. The host can press ADD CPU on an open slot to fill it with a CPU on a random fighter (HARD difficulty), and REMOVE to take it back out. One CPU per lobby, and not in 1V1 lobbies.
- NO MERCY modifier (red). Weather hazards never stop, and map hazards get a lot more dangerous: the SNOWY cannon fires twice as often and the DESERT heat ray comes back after just 1 second. It turns on weather by itself, so WEATHER HAZARDS doesn't need to be on too.

### Changed
- LONGSWORD has its own block now.
  - Blocking a melee hit (jabs, tilts, the smack down and so on) knocks the attacker back in a short hop like the smack down and puts them in hitstun instead of freezing them, so a good block sets up a combo.
  - That hitstun lasts up to 1.1 seconds when you block right as the hit lands, dropping to 0.5 seconds the longer you've held block.
  - It deflects projectiles back at whoever threw them: TRAPPER's harpoons, GUNMAN's grenades and LAWNMOWER's eject. GUNMAN's shots get sent back at him too. TRAPPER's net still goes through.
  - He can deflect SNOWY cannonballs too, which shatters his shield. The ball turns the color of the nearest other player and rockets at them 3 times faster.
  - The trade-off: LONGSWORD's shield only has 2/3 the health of a normal block, so hits and holding block wear it down faster. It does refill 1.5 times faster.
  - It has its own parry sound.
  - He raises his sword into his third-hit swing pose while he blocks, and a successful block flashes a sword-shaped cue in his player color instead of the usual shield.
  - CPUs know about it. A LONGSWORD CPU blocks more often, bats projectiles and GUNMAN shots back (more reliably on harder difficulties) and drops its block to punish right after a counter. It holds its block through a GUNMAN's whole round and knows how to bat SNOWY cannonballs away. HARD and VERY HARD CPUs back off instead of swinging into a LONGSWORD's raised block.
- LAWNMOWER's eject hits harder (0.40 instead of 0.25). Blocking it costs a big chunk of shield, enough to break LONGSWORD's shield in one go, even when he deflects it.
- LAWNMOWER's PLOW reaches further (150 instead of 110) and its explosion hits much harder: 0.60 instead of 0.25, with a stronger launch and longer hitstun.
- Blocking LAWNMOWER's PLOW now wrecks it right away. The mower still blows up, but it only pushes the blocker a bit sideways with almost no lift and adds no damage, and LAWNMOWER is stuck with the PULL CORD like after any PLOW explosion.
- The SNOWY cannon launches you less high.
- GUNMAN's normal shots take less off a block (0.05 instead of 0.08), so a block can survive a full round of shots plus the explosion shot.
- After a smack down, specials (neutral and directional) come back 0.15 seconds before normal attacks do.
- The broken-shield mark is now tinted to each player's color (CPU color for CPUs) instead of only red or blue.
- The death ray (the purple KO launch) needs a stronger sideways launch now: at least 1000 speed sideways instead of 800 in any direction. Launches that also send you high up need even more, since those are easier to recover from. Spikes downward don't need extra.

## 2026-11-10

### Added
- A SETTINGS button (the gear) in the top right of every screen. It has MASTER VOLUME, IN GAME VOLUME (sounds during matches) and, on touchscreens, TOUCH CONTROLS to switch between DPAD and THUMBSTICK. Settings are saved on your device.
  - In a match the gear replaces the home icon and opens the pause menu, which now has RESUME, SETTINGS and HOME.
  - Online, the gear opens settings straight away (it sits next to FORFEIT on phones).
  - TOUCH CONTROLS defaults to THUMBSTICK on phones and DPAD on bigger touchscreens.
- Private lobbies. Turn on PRIVATE in CREATE LOBBY and your lobby stays out of BROWSE LOBBIES. Empty slots show INVITE ONLY, and the host gets an INVITE button that lists everyone waiting in the online menu.
  - Invited players get a popup with ACCEPT and DECLINE. It goes away on its own after 30 seconds.
  - Only invited players can join a private lobby.

### Changed
- The score that pops up after a KO now shows each player's lives left in every mode, including 1v1 (it used to show KOs in 1v1).
- Those score numbers are now colored to match each player (gray for CPUs) instead of white.
- The thumbstick only moves you left and right now. Jumping and downslamming use new up and down buttons on the right, laid out as B, up, S on top and ALT, down, A below.
- More offensive names are blocked online: misspellings and letter swaps of slurs and infamous names, hate codes, Diddy and 9/11 jokes, and phrases aimed at someone's race, religion or sexuality (like "ur ___").
- Blocking rewards timing. Block right as a hit lands and the attacker freezes for much longer (up to 0.8 seconds). The longer you've been holding block, the shorter the freeze, down to a small minimum.
- MALLET HAMMERMAN's swing hits harder (0.13 to 0.20 damage) and stuns longer.
- LAWNMOWER's plow does a lot less chip damage, barely dents shields, and no longer builds toward its explosion while you're blocking it.
- Ledge grabbing from anywhere off the map is gone. You need to be near a ledge to grab it again.

## 2026-11-09

### Added
- Online lobbies! The ONLINE screen now opens on three choices: CREATE LOBBY, QUICK 1V1 and BROWSE LOBBIES. Your name moved above your fighter.
  - CREATE LOBBY: name your lobby, click the GAMEMODE box to pick 1v1, 1v1v1, 2v2 or 1v1v1v1, pick a stage from a wheel and turn on modifiers. Your lobby shows up for everyone in BROWSE LOBBIES, and the host presses START once it's full.
  - QUICK 1V1 pairs you with whoever has been waiting the longest, no list needed.
  - Modifiers work online. INFINITE BRIDGE stays local only, and NO VERTICAL KILLZONE and NO HORIZONTAL KILLZONE can't both be on in a lobby, so matches always end.
- 3- and 4-player matches (online only). Everyone gets 3 lives. In 1v1v1 and 1v1v1v1 the last player standing wins; in 2v2 the last team standing wins, and you can't hurt your teammate.
  - Player colors: 1v1v1 is red, green and blue; 1v1v1v1 is red, yellow, green and blue; 2v2 is team red vs team blue.
  - New green and yellow stat backgrounds, with every stat block in a row at the top of the screen.
  - KOs count for whoever hit you last. Knocked-out players disappear and their stat block dims.
  - If someone leaves a 3- or 4-player match, they're knocked out and the match keeps going.
- Every stage has spawns for 4 fighters.
- When modifiers are on, the match now starts by sliding in a card for each one. Modifiers that get cancelled out by another (like SLUGGISH under SUPER SLUGGISH) flash red and get removed.
- INFINITE BRIDGE moved to a new white MISC section at the top of the modifier list.
- A FORFEIT button in the top right corner of online matches on phones and tablets. Tap it twice to leave (it counts as a loss).
- The stage picker in CREATE LOBBY shows a preview picture of each map.
- Your fighter panel in the online menu turns red while you can't change your name or fighter (queued, in a lobby or about to start a match).
- Names of infamous people and hate groups (EPSTEIN, HITLER, DIDDY and others) are now blocked online.

### Changed
- LAWNMOWER's PULL CORD can't cut grass or fire CLIPPINGS anymore, and his clippings drop to 0 as soon as he loses the mower.
- The speed limit for fighters went way up, from 200 blocks per second to over 85 million.
- Ledge grabbing works from anywhere off the map: press attack and you grab the nearest ledge.
- Squash and stretch now move in choppier steps.
- Past 10,000 pixels per second the camera locks onto you so you stay centered.
- Squash and stretch are 1.5x stronger, and afterimages now stretch and squish along with your fighter.
- The in-game home button is smaller and sits a little in from the corner.
- ONLINE and PLAY VS CPU on the main menu are a bit narrower so they line up with the shadow, and the menu buttons slide in twice as fast without the bounce.
- The online menu has its own BACK button for moving between screens. The bottom BACK always takes you to the main menu.
- NEXT and BACK on the map and modifier pages play the normal click sound instead of the wheel sound.
- Hovering over map cards, modifier cards, character icons and phone buttons no longer plays the hover sound.
- Tidied up the online menu: the QUICK 1V1 stage picker is centered and the arrows in CREATE LOBBY no longer touch the edges.

### Fixed
- Name tags and weapons no longer trail behind fighters at very high speeds.
- Fighters can no longer fall through the ground at extreme speeds or on fast diagonal hits.
- INFINITE BRIDGE now shows the map out to about 5.3 million blocks instead of going black at 200,000.
- The pause menu's RESUME and HOME buttons are centered.
- Picking a stage in CREATE LOBBY now plays the wheel sound like it does offline.

## 2026-11-08

### Added
- High-speed crashes. Slam sideways into a wall, plank or another fighter above 12 blocks per second and you squish, bounce back the way you came, and get a short stun. Hitting a floor or ceiling that fast just squishes you. Downslams, directional specials, ledge moves, grabs and SMACK DOWN don't crash.
- Fighters now stretch in the direction they're moving at high speed, building up to full stretch at 20 blocks per second.
- NO GRAVITY + FRICTION, a new purple modifier. Nothing pulls you down and nothing slows you down. Pressing the way you're already going keeps your speed, pressing against it instantly reverses your direction at full speed, and downslam is your only way back to the floor.
- NO VERTICAL KILLZONE and NO HORIZONTAL KILLZONE, two new purple modifiers that remove the kill zones on those sides. The camera follows you past the edge of the map. Turn both on and nobody can be KO'd. Click COLLISION on the card to turn those edges into solid walls that stop anything going past them.
- CUSTOM DAMAGE S, A and R, new modifiers that multiply all damage. Click the box on the card to change the amount; it loops back after the max.
  - CUSTOM DAMAGE S (purple): 5x to 50x in steps of 5x.
  - CUSTOM DAMAGE A (red): 1x to 10x in steps of 1x.
  - CUSTOM DAMAGE R (yellow): 0.1x to 1x in steps of 0.1x.
- CUSTOM SPEED S, A and R, new modifiers that add movement speed, using the same click box.
  - CUSTOM SPEED S (purple): +500% to +5000% in steps of 500%.
  - CUSTOM SPEED A (red): +50% to +500% in steps of 50%.
  - CUSTOM SPEED R (yellow): +10% to +100% in steps of 10%.

### Changed
- HYPERACTIVE is now called FAST.
- Speedometers on INFINITE BRIDGE now show your real speed. TOP and BEST ignore the moment of hit freeze, where the old reading could show thousands of blocks per second you never actually moved at. Best speeds start over from 0, and best distances are kept.

### Removed
- The old 150% speed FAST modifier. CUSTOM SPEED A and R cover it now.

### Fixed
- The camera keeps up at extreme speeds, so you no longer vanish off screen at around 100 blocks per second.

## 2026-11-05

### Added
- INFINITE BRIDGE, a new modifier. Turn it on and the match takes place on a snowy bridge that never ends, with no platforms and no side blast zones, made for seeing how fast every fighter can go.
  - Speedometers for both fighters in blocks per second (1 block = one fighter wide), with top speed, average speed, distance traveled and your saved best per fighter. RESET RUN starts a fresh run.
  - Distance signs on the bridge every 50 blocks.
  - The camera follows P1 from the start; press V or click VIEW to switch between P1, P2 and both.

### Changed
- Map select got a redesign: maps are now a vertical card wheel with wide cards (scroll, arrow keys or W/S to browse), and modifiers moved to their own page. NEXT swipes down to the modifiers, BACK swipes back up. The faded background behind map select, modifiers and character select now shows the map you picked.
- Modifiers are bigger and easier to read, sorted from most to least chaotic and colored by how chaotic they are: purple, red, orange, then yellow.
- MAP HAZARDS is now called WEATHER HAZARDS.
- You can't be hit while falling back in after a KO, or for a moment after you land.
- Fighters who can't be hit, or who are immune to nets, now flash so you can tell.
- TRAPPER moves 1.8x faster while their net has someone trapped, but hitting a netted fighter breaks the net.
- SMACK DOWN: you can't use specials until the victim's stun is over, same as attacks.
- SMACK DOWN can be blocked during its pull-in, so you have a moment to react instead of needing block up beforehand.
- LAWNMOWER's PULL CORD wait is 8 seconds (up from 6).

### Fixed
- Closed a stunlock with TRAPPER's net and SMACK DOWN: a thrown net that hits someone who's already stunned just knocks them back instead of netting them, and you get 1 second of net immunity after being freed.
- NO ABILITY COOLDOWNS now also applies to CHAINSAW's burnout after its saw explodes and LAWNMOWER's PULL CORD wait and remount delay. Those two keep a short 0.5 second cooldown, since their grinders hold you in place and could otherwise stunlock (or freeze their own user) forever.
- LAWNMOWER's plow now damages walls like CHAINSAW does: it chews through steel walls and wrecks wooden planks instantly.

## 2026-11-04

### Added
- LAWNMOWER, a new SCYTHEMAN variant built for ramming. His mower can be used three ways:
  - Attack: PLOW. Push the mower into your opponent to grind them down. After about 2 seconds of contact it explodes.
  - ALT: RIDE. Hop on for a big speed boost. Driving into someone bumps them up and away, but you can't attack while riding, and getting hit knocks you off.
  - Double-tap a direction: EJECT. The mower launches by itself, speeds up to cross the whole screen in about half a second, flies straight through the air and explodes on whatever it hits, harder than PLOW.
  - After the mower blows up, LAWNMOWER is stuck with a PULL CORD for 8 seconds: a long-reach shove with strong fixed knockback to keep people off you. Cutting grass shortens the wait.
  - Triple jump: jump a third time in the air by ditching the mower. It crashes down and explodes on whatever it hits (or when it falls off the map), and the PULL CORD starts.
  - Neutral special: CLIPPINGS. Every grass you cut gives you 3 clippings (up to 45); spray them back as chip damage. Each hit slows your opponent to about a third of their speed and stops them from double jumping for 1.2 seconds. Hold the button to keep spraying.
  - Cutting grass also gives a short speed burst while riding. Unlike LANDSCAPER, cutting grass doesn't make him harder to launch.

### Changed
- CHAINSAW AXEMAN collects wood twice as fast while digging.

### Fixed
- Getting hit by push attacks and several other moves no longer leaves you sliding across the floor once the hit wears off.
- The changelog and modifier lists should no longer flash white or flicker on some devices while scrolling.
- CPUs now actually get their speed boosts, like riding LAWNMOWER's mower or SLATEMAN's SLIDE. They were always moving at normal speed.
- Fixed fighters sometimes floating in mid-air and walking on nothing, usually after getting hit while hanging on a ledge or while grabbed.

## 2026-11-03

### Added
- BLOCK, a new move for every fighter. Hold R (P1) or Period (P2), LB/RB on a controller, or the new B button on phones. A shield in your player color (red for P1, blue for P2, grey for the CPU) surrounds you and stops all damage and knockback. Every hit it stops flashes a big shield and makes a block sound. It shrinks while you hold it and shrinks more with every hit it takes (bigger hits take more, but no single hit takes more than half of it); let go and it grows back. If it runs out, it breaks and you're stunned for 1.5 seconds, with a cracked shield (in your player color) over your fighter. You can't move or attack while blocking. Blocking an attack gives you a quick opening: a melee attacker freezes for 150 ms and has to wait an extra 150 ms before attacking again, and a blocked dash attack (LUNGE, CLEAVE and the like) stops trying to hit. CPUs on NORMAL, HARD and VERY HARD block sometimes too. VERY HARD also sees attacks coming: it blocks the moment you start a special, guards when your special is ready and it's in range, braces for the third hit of a combo, and blocks right after getting SMACKED DOWN so you can't keep it going. Instead of blocking GUNMAN's MINI or FISHERMAN's hook and net, HARD and VERY HARD CPUs jump out of the way.
- SMACK DOWN, a new move for every fighter. Tap down on the ground with your opponent close by (in the air or on the ground) to grab them and slam them into the floor. It does 3% and leaves them flattened and floating up and away from you for about a second. You need a moment to recover after slamming, so chase them down for the follow-up.
- LEDGE GRAB, a new move for every fighter. When you're off the stage, press attack near a platform's edge to grab on. You can still be hit while hanging, which knocks you off. Press any button except down (or wait 1.5 seconds) to pull yourself up and dash forward, shoving anyone guarding the edge out of the way. The climb and the dash can't be interrupted. Press down to let go. You get one grab per jump.

### Changed
- The DEATH RAY needs a faster launch to fire (at least 800 speed instead of 400), so slow or short hits at 200%+ no longer trigger it.
- HARD and VERY HARD CPUs now get out of the way of GUNMAN's MINI: they jump out of its line of fire or move to a platform on a different level, and they break away right after getting stunned by it instead of letting GUNMAN follow up.
- GRUELING SLAM pins an airborne target for 2 seconds instead of 3.
- MALLET's swing reaches a bit further (100 → 110).
- SLEDGEHAMMER: the QUICKSLAM follow-up jump now tracks your target while you're flying at them, so it stops whiffing when they're launched high.
- HAMMERMAN CPUs play smarter: MALLET heals from a safe distance or behind its walls, both variants put up walls to block you off (and at the ledge to stop your recovery), SLEDGEHAMMER does the QUICKSLAM follow-up, and both time their swings around their windup instead of swinging at point-blank and getting interrupted. Every CPU now knows how to deal with a wall in its way: hold behind its own, smash it, or jump over it.
- New CPU difficulty: VERY HARD. It's the old HARD CPU at full strength, using BLOCK, SMACK DOWN, LEDGE GRAB and edgeguarding. HARD is now a step below it: same speed and it blocks just as often, but it doesn't use SMACK DOWN or LEDGE GRAB, and it doesn't chase you off the stage.
- Heavy (100%+) and violent (150%+) launches now freeze the game for a split second on hit, like the death ray does, so big hits land harder. Violent ones freeze a bit longer.
- Online: the one-match-at-a-time limit is now per device instead of per internet connection, so people on the same wifi can host and play each other again. You still can't be in two matches at once from two tabs on the same device.
- Online quick chat: up to 3 messages can be on screen at once, stacked above your fighter. You can send 4 messages every 12 seconds.

### Fixed
- Big downward hits (like GRUELING SLAM, or spikes at high damage) no longer make fighters fall through platforms.
- TRAPPER: netted fighters can no longer be shoved around by walking into them, and they don't slide across the floor while stuck in the net.

## 2026-11-02

### Added
- A thumbstick for phones, replacing the four arrow buttons in online and vs CPU matches. Attack and special stay where they were.
- Quick chat keybinds. Open the chat menu, hover any phrase and press a number (0-9) to bind it. Press that number during a match to send the phrase instantly. Your bound key shows next to the phrase in your own menu (your opponent only sees the message). Pressing the same number on a bound phrase unbinds it. Binds are saved in your browser.

### Changed
- GUNMAN's variant GRUNT is now called CRAZER.
- Online: only one player per connection (IP address) can host or play a match at a time.
- Online: players whose tab isn't focused no longer count as WAITING. They still count as online.
- Online: the server uses about a third less memory per match.
- The name filter blocks one more word.
- Getting launched now follows a slight upward curve while you're in hitstun instead of a straight line.
- GUNMAN: MINI does 0.7% per bullet, and GUNMAN falls very slowly while his bullets are landing. CHUCK launches much harder, adds 300 ms of hitstun, and can be thrown again twice as fast after it explodes.

### Fixed
- The downslam afterimage and squash now stop the moment you attack, get hit or get frozen.
- SLEDGEHAMMER can no longer attack through his own thick steel wall.

### Removed
- LAN play. Online now always goes through the public server, and `npm run lan` is gone.

## 2026-11-01

### Changed
- Online matches play back much smoother. Your game now keeps a tiny buffer of what the server sends and plays it at a steady pace, so small network hiccups no longer show up as microfreezes followed by everything jumping ahead. The buffer adapts to your connection: about 33 ms on a good one, up to 100 ms on a shaky one. Each online match also logs a short network report to the browser console when it ends.
- Online matches also use a new fast connection (WebRTC) next to the old one. If a bit of data gets lost on the way, the game skips it and keeps going instead of freezing until it's sent again, and the old connection fills in anything missed a moment later. Your button presses go both ways too. On the public server this traffic goes through Cloudflare's relay, so nobody sees anyone else's IP address. If the fast connection can't be set up, the game quietly uses the old one like before.
- The game uses less memory, so it runs better on phones and older computers. The sandstorm wind and AXEMAN's chainsaw are now short seamless loops instead of long recordings, and sounds that were saved in stereo but sounded the same in both ears are now mono. That's about 22 MB less RAM and a smaller download, with no difference you can hear.
- The online name filter now catches names that swap the first letters of two words to sneak a bad word in, and it no longer blocks normal words like DICKENS, COCKTAIL or PEACOCK.

### Fixed
- Leaving an online match for the main menu now disconnects you from the server, so you no longer show up in the online player count.

### Removed
- FISHERMAN's match intro. He still downslams onto his spawn like everyone else. The intro didn't look good and its animation alone took about 28 MB of memory.

## 2026-10-31

### Added
- Fighters now downslam onto their spawn points at the start of a match, crashing straight through any platforms in the way. Their intro plays once they land.
- SCYTHEMAN:
  - DIR SPECIAL: GRUELING SLAM (replaces MOW). A giant white scythe starts upright over his head and whips down in front of him in a quick swing, blade tip first, with its own slam sound. A hit adds 20% KB and pins the opponent to the ground for 1 second. If they're in the air, they're slammed down much faster than a downslam first, then pinned where they land for 3 seconds. Hitting a pinned opponent frees them, and the cooldown only starts once the pin ends.
  - A blue resistance shield flashes on him whenever his grass cuts go up, getting bluer as he gets closer to max resistance.
- CPU difficulty: EASY, NORMAL or HARD, picked above the CPU's box on character select (one for each CPU in SIMULATION). Lower difficulties react slower, pass on some openings, swing less often, and skip edgeguarding, downslams and dodging specials. HARD is the same bot as before and is the default.

### Changed
- You can change which way each hit of a combo launches again, including the combo ender and tilts after a jab.
- SLATEMAN's PLUNGE is now called SLIDE and was reworked with a new animation: his arm twists around, draws a dagger, then puts it away. The whole SLIDE lasts about 3.5 seconds.
  - SLIDE no longer carries him forward on its own. Hold left or right to move, and while the dagger is out that speed is multiplied by 1.5.
  - The dagger only hits (and applies PLUNGED) while it's out. The boost stops once he starts putting it away.
  - Drawing the dagger and putting it away each work like a tilt: a small slash that knocks away anyone right in front of him.
  - He can't attack, tilt or use another special until the SLIDE ends, and his normal arm is hidden during it.
- SCYTHEMAN's NEUTRAL SPECIAL SOW is back. Each toss throws 7 seeds instead of 3, with only a short delay between tosses, and every seed that lands on the ground or a platform grows grass there.
- SCYTHEMAN's grass cuts make him harder to launch (1% more knockback resistance per cut, so 100 cuts means double resistance) instead of making his hits stronger.
- SCYTHEMAN's grass only grows on the ground and platforms.
- SLATEMAN's rock cracks with a rock-break sound every time he reaches a new phase.
- Picking a name that isn't allowed no longer flashes a message on the lobby screen. The name box stays open, shakes, turns red and tells you the name isn't allowed.
- SIMULATION: both CPUs are grey in the match (name tags, KB boxes, ability meters, KO blasts and the results screen). On character select, CPU 1's select box, arrow buttons and ready button are black and CPU 2's are white so you can tell them apart.

### Fixed
- Mobile touch controls could stop responding mid-match until you switched tabs. Touches the browser lost track of are now cleared automatically.
- Sliding your thumb off a touch button dropped the input. The button now stays held until you lift your finger, and sliding onto another button switches to it.
- A fighter could permanently lose the ability to attack if one of their hits landed (a projectile, special or delayed swing) right after a jab. Fighters also can't stay locked out of attacking for more than 3 seconds while they aren't stunned or frozen.
- Push attacks (attacking while moving) could fire the DEATH RAY. They can't anymore.
- SLATEMAN stayed fragile after losing a stock. His first phase now always has 2 knockback resistance, so he's back to full toughness every time his KB resets.
- SLATEMAN's arms stuck out to the side of his body when he faced up or down. They now come straight out of him like they do when he faces sideways.
- Online names could sneak bad words past the filter by swapping a vowel for any number, symbol, dot or space (F7CK, SH8T, F*CK, F.CK) by leaving the vowel out (FCK, SHT), or by spelling a vowel the way it sounds (FUHCK, FOCK, and "-IR" or "-UR" endings). All of these are blocked now.
- AXEMAN's CLEAVE could hit twice in one dash.
- SWORDMAN's LUNGE and QUICKSTEP damaged a wall over and over in one dash when the opponent was right behind it, shredding through walls. A dash now damages a wall only once.
- The CPU's ability meter turned blue as soon as the match started instead of staying grey.
- GUNMAN CPU tried to aim its minigun up and down, even though the minigun only fires sideways. It now only starts the minigun when the opponent is level with it, and it stops standing under or over the opponent while the minigun is firing.
- Grass is cut by any basic attack or tilt swing, grown or not, and the opponent can clear it too. Only grass cut by the SCYTHEMAN who grew it counts toward his grass cuts.
- Character select descriptions: SCYTHEMAN's now explains SOW and that his grass grows as he walks, and GUNMAN's said MINI had a 10 second cooldown (it has the same cooldown as everyone else).

### Removed
- SCYTHEMAN's MOW. It's gone completely, not moved to another button.

## 2026-10-30

### Fixed
- Fighters could hit back in the same moment they got hit. Two fighters (bots especially) could keep stunning each other forever with basic attacks.
- Getting hit could sometimes end your stun too early, letting you break out of a 3-hit combo.
- Specials with a delayed hit (like SLATEMAN's PLUNGE and SLEDGEHAMMER's QUICKSLAM follow-up) still hit even after you got stunned during them. Now getting hit cancels them.
- P1 could fall through the floor at the start of a match on DESERT ARENA. Every map's spawn points are now just above the floor.
- Online names: letters from other alphabets, accents and symbols are turned into plain letters or removed, and the name filter catches numbers or symbols used in place of letters, repeated letters, and bad words hidden inside longer names.

## 2026-10-29

### Added
- TRAPPER FISHERMAN:
  - Stabs with a harpoon. When a stab lands, the harpoon stays stuck in the opponent and fades away after 5 seconds.
  - Carries 3 harpoons: one in hand and the rest on his back. Every harpoon left in an opponent or thrown uses one up, and he gets one back every 3 seconds. With none left he fights with his fists: shorter reach, and the third hit is a weak shove with fixed knockback instead of a pin.
  - The third hit doesn't launch. It pins the opponent to the floor and stuns them for 1 second. In the air, it slams them down faster than a downslam.
  - NEUTRAL SPECIAL: HARPOON THROW. Throws a harpoon like a javelin that sinks slowly and has strong, fixed knockback that doesn't grow with KB. One throw every 0.5 seconds.
  - DIR SPECIAL: THROW NET. It stuns for 3 seconds, whether it hits the opponent directly or they walk into a net lying on the ground. Caught opponents are NETTED. Only one net per player.

### Changed
- SLATEMAN has new, more detailed arms. He punches with one fist, then the other, and the third hit is a big overhead slam.
- SLATEMAN starts a bit slower than everyone else and speeds up as he takes KB (normal speed at 50%, much faster past 100%).
- SLATEMAN's PLUNGE carries him forward at normal speed on its own. Holding left or right during it adds his KB-boosted speed on top, so it gets faster the more hurt he is.
- SLEDGEHAMMER's QUICKSLAM follow-up always spikes toward the side you quickslammed, and its stun no longer grows with KB.
- ANGLER and MALLET have real tilts now instead of repeating their basic attack.
- Combo enders always keep the full recovery, so fighters with fast attacks can't mash straight into the next combo.
- Red VIOLENT launches start at 150% KB instead of 200%. At 200% and up, launches fire a purple DEATH RAY.

### Fixed
- SLATEMAN's speed boost and damage drop from taking KB never actually kicked in.
- Attacks can't land during the death ray freeze.
- Pulls and explosions no longer trigger the death ray.

## 2026-10-22

### Changed
- FISHERMAN REWORK:
  - FISHERMAN has arms now and has been redesigned.
  - Thinner fishing line.
  - The hook isn't absurdly huge anymore. Instead it snaps to a player in its hit range, and its line is more curved.
  - Intro animation (spinning his rod).
  - If the hook is falling below the platform it's hooking onto, it temporarily curves upward a bit.
  - The line now reels in instead of instantly disappearing.
  - Reeling/pulling it in has its own quick animation (lifting the rod up).
  - In general, the ability is much more concise and easier to use.
  - Faster attack speed (not as fast as DAGGER though).

### Added
- Attempt to add better game effects and a menu intro animation:
  - Hits spray tiny white particles from the side of the fighter that got hit.
  - At 100% KB and up, getting launched leaves a white ghost trail and a smoke trail, and shakes the screen.
  - At 200% KB and up it gets violent: a red ghost trail, a red smoke trail and a severe screen shake.
  - Fighters at 100% KB or more pulse red.
  - Dust puffs on hard landings and double jumps.
  - KOs fire a beam in the scorer's color back into the arena from where the fighter went out.
  - Respawning fighters flash in and blink.
  - Winning shows a GAME! screen, then a results panel that drops in and types out KOs, max KB and damage dealt for both players. The restart and home buttons are shorter and drop in too.
  - The main menu slides in from the sides.
  - Fonts and player colors are the same across the game, lobby and online screens.

### Removed
- The old impact sprites on hits.
- Unused finisher code.

## 2026-10-18

### Changed
- MALLET HAMMERMAN has been redesigned: more detailed animations and an intro animation.
- LONGSWORD SWORDMAN has been redesigned: more detailed animations and an intro animation.

## 2026-10-14

### Changed
- ONLINE lobby now lists open matches (host name, fighter, map, 1/2) instead of a blind queue. Host a match on your map or JOIN one from the list.
- Changing your online name now uses a proper text box instead of a browser popup.

## 2026-10-13

### Added
- ONLINE mode (LAN only for now): 1v1 queue on a local server (`npm run lan`). Matches run on the server, players only send inputs.
- Shared input system (`input.js`): keyboard, touch, controller and network inputs all go through the same path.

## 2026-10-05

### Added
- Axeman's CHAINSAW variant has a special now, and build mode.
- Special ability is revamped for gunman.
- DAGGER for Swordman.

## 2026-10-15
- The jungle map + Keybind switch

### Added 

### Planned (most to least priority)
- Mobile thumbstick for multiplayer
- TRAPPER fisherman
- SLATEMAN rework
- LAWNMOWER for scytheman

