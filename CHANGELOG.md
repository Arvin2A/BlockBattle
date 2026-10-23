# Changelog

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

