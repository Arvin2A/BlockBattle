# Changelog

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

