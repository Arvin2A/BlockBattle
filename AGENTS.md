# AGENTS.md

Rules for any coding agent working in this repo. The hard rules aren't optional.

## Project

BLOCK BATTLE!! is a 2D platform fighter built with Phaser 3 and Vite. Online play is server-authoritative: matches run in headless Chrome on the server, and clients only send inputs.

| Path | What's there |
| --- | --- |
| `characterRoster.js` | Every fighter and variant (`CHARACTER_ROSTER`). The LAN server validates against it. |
| `playerAttackScripts/*.js` | Per-character attacks, specials and tuning. |
| `attacks.js`, `combat/` | Shared hit specs (`STANDARD_HITS`), blueprints, eligibility, knockback. |
| `scenes/` | Phaser scenes. The menu changelog is in `scenes/MenuScene.js`. |
| `scenes/GameScene/preload.js` | Where image assets are loaded. |
| `assets/sprites/<character>/` | Fighter sprites. |
| `ui/theme.js` | Shared fonts, colors, `makePanel` / `makeButton`. |
| `mp/`, `server/` | Online multiplayer: client, mirror, protocol, lobby server. |

Commands:
- `npm run dev`: Vite dev server
- `npm run build`: production build into `dist/`
- `npm run lan`: build, then run the LAN server (`npm run server` runs it without building)

## Hard rules

- **Never `git add`, `git commit`, `git push`**, and never run any other git command that changes history or the index (`reset`, `stash`, `checkout -- <file>`, `rebase`, etc.). The owner does all of this. Read-only git (`status`, `diff`, `log`, `show`) is fine. Leave your work as uncommitted changes.
- Don't bring back the removed finisher code in `attacks.js` or the `impact1` / `impact2` hit sprites. They were removed for good.
- Ask before changing:
  - knockback growth on tilts, Cleave, mow or push. They have none on purpose, so they can't KO.
  - the main menu and map-select button styles.

## Changelog workflow

### When to update the changelog

Check `git status` / `git diff` at the start and end of every task. Update the changelog if **either** of these appears, whether you made the change or it was already uncommitted:

1. A new character or variant in `CHARACTER_ROSTER` (`characterRoster.js`).
2. New image files under `assets/` that the game actually loads (referenced in `scenes/GameScene/preload.js` or elsewhere).

Bug fixes and balance changes on their own do **not** get a changelog entry. When rule 1 or 2 fires, include every bug fix and balance change made since the last entry.

### What to update (both, every time)

1. **`CHANGELOG.md`**
   - Add a `## YYYY-MM-DD` section for today at the top. If today's section already exists, add to it.
   - Group bullets under `### Added`, `### Changed`, `### Fixed` and `### Removed`, using only the ones you need.

2. **`scenes/MenuScene.js`**
   - Add `{ title, body }` objects to the **front** of `changelogEntries`.
   - If the item you shipped is listed in `upcomingEntries` (e.g. TRAPPER FISHERMAN), remove it from there.
   - Bump `CHANGELOG_VERSION` (format `YYYY-MM-DD-N`). For a new date use today with `-1`. If it's already today's date, add 1 to `N`. This changes the version color, and players see the changelog as new again (`blockBattleSeenChangelog`).

### Style

- Write fighter and variant names in CAPS: FISHERMAN, DAGGER, MALLET HAMMERMAN.
- Menu `title`s are short and in CAPS. `body` is casual prose, with `\n ` between paragraphs. Match the voice of the existing entries.
- Describe what a player will notice, not implementation details.

## Code conventions

### Online compatibility
- Gameplay code reads input from `scene.playerInputs`, never from the keyboard directly.
- New fighters and variants must be added to `characterRoster.js`.
- Any new kind of game object must be handled in `mp/mirror.js` (serialize and create).
- Protocol changes mean bumping `PROTOCOL_VERSION` in `mp/protocol.js`, then updating client and server together.

### New fighters / variants
- Visible arms in the sprites.
- A real neutral special: little to no cooldown, limited by objects or ammo (like the steel planks) rather than a long cooldown, and never game-changing like a directional special. Existing ones are in `variantNeutralSpecials` in each attack script.

### Attacks
- Build hits as blueprint specs passed to `api.strike` / `api.landHit` (`combat/blueprints.js`), and reuse `STANDARD_HITS` from `attacks.js` where one fits. Don't hand-roll hit code.
- Use `attackIsElligible(attacker, target, range, bypassOptions)` with options from `DEFAULT_BYPASS_OPTIONS` (`combat/eligibility.js`).
- Per-character tuning lives in script fields (`hitSounds`, `attackCooldown`, `plankDamageScale`, `variantStats`), not in if-chains on the character name.

### UI
- New HUD or menu pieces import fonts, colors and `makePanel` / `makeButton` from `ui/theme.js`. Don't hard-code colors and fonts.

### Audio
- Sound effects come from a licensed reuse library. Code comments saying they were "taken from various games" are outdated.
