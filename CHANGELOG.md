# Changelog

## 2026-11-04

### Added
- LAWNMOWER, a new SCYTHEMAN variant built for ramming. His mower can be used three ways:
  - Attack: PLOW. Push the mower into your opponent to grind them down. After about 2 seconds of contact it explodes.
  - ALT: RIDE. Hop on for a big speed boost. Driving into someone bumps them up and away, but you can't attack while riding, and getting hit knocks you off.
  - Double-tap a direction: EJECT. The mower launches by itself, speeds up to cross the whole screen in about half a second, flies straight through the air and explodes on whatever it hits, harder than PLOW.
  - After the mower blows up, LAWNMOWER is stuck with a PULL CORD for 6 seconds: a long-reach shove with strong fixed knockback to keep people off you. Cutting grass shortens the wait.
  - Neutral special: CLIPPINGS. Every grass you cut gives you a clipping; spray them back as chip damage. Each hit slows your opponent to about a third of their speed and stops them from double jumping for 1.2 seconds. Hold the button to keep spraying.
  - Cutting grass also gives a short speed burst while riding. Unlike LANDSCAPER, cutting grass doesn't make him harder to launch.

### Changed
- CHAINSAW AXEMAN collects wood twice as fast while digging.

### Fixed
- Getting hit by push attacks and several other moves no longer leaves you sliding across the floor once the hit wears off.
- The changelog and modifier lists should no longer flash white or flicker on some devices while scrolling.
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

