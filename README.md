# BlockBattle

> [!WARNING]
> **BLOCK BATTLE!! is in alpha.** Things will break, change or disappear within short amount of time, updates come out very fast in this stage.
>
> Please **don't make any public posts about the game**: no videos, short-form clips, streams, social media posts or anything similar. For now, only share it by word of mouth or private messages.

BLOCK BATTLE GAME: for Intro to Coding and App Design
it says mohsina007 for the edits, but its just me, idk how to change it anymore.

EDIT: This game while originally for a class project, is now developing as a passion project. 

CLAUDE was used for serious changes under very quick succession (like multiplayer setup for what was a singleplayer game in the span of one day) bug fixes, sprite setup and making concepts. Characters, maps, and assets are always made by me, hand drawn and animated.
I have only started using CLAUDE from october 11 2026, the game was made back in april.

## How to play

**During the alpha, the website is the recommended way to play:** https://arvin2a.github.io/BlockBattle/

It always has the newest version, works on phones, and online play always matches the server.

### Desktop app (alpha)

There are also desktop builds of **BLOCK BATTLE!!** for Windows, macOS and Linux on the [Releases](https://github.com/Arvin2A/BlockBattle/releases) page. They're early and less tested than the website. You only download the app once: each time it starts, it grabs the newest game update by itself (just the files that changed). Once in a while an update needs a new app, and it'll tell you when that happens.

| System | Download | Notes |
|---|---|---|
| Windows | `BlockBattle-...-windows-setup.exe` (installer) or `BlockBattle-...-windows-portable.exe` (no install) | Windows may say it "protected your PC". Click **More info**, then **Run anyway**. |
| macOS (Intel and Apple Silicon) | `BlockBattle-...-mac-universal.dmg` | macOS may say the app can't be opened. Right-click the app, choose **Open**, then **Open** again. If it says the app is "damaged", run `xattr -dr com.apple.quarantine "/Applications/BLOCK BATTLE!!.app"` in Terminal. |
| Linux | `BlockBattle-...-linux-x86_64.AppImage` | Make it runnable with `chmod +x`, then run it. |

These warnings show up because the alpha builds aren't code-signed yet. Press **F11** in the app for fullscreen.

### Building the desktop app yourself

- `npm run desktop` builds the game and opens it in the desktop app. Running the app locally needs Node.js 22.12 or newer; the first run may need `npx install-electron` to download Electron.
- `npm run dist:desktop` builds the installer for the system you're on, into `release/`.
- Game updates for the app ship with the website: every push to `main` also builds the desktop game into `desktop/` on GitHub Pages, with a `game-update.json` list of every file and its hash. When the app starts, it compares that list with what it has and downloads only the changed files. If it's offline, it starts with what it already has.
- `desktopShellVersion` in `package.json` is the version of the app itself (`desktop/main.cjs` and `desktop/updater.cjs`). Only raise it when a game update won't work without the new app code. Then make a new release, because older apps will tell players to download it instead of updating.
- Releases are built by GitHub Actions (`.github/workflows/release.yml`) on Windows, macOS and Linux. To make one, set `"version"` in `package.json` to the update's date (for example `2026.11.17`), push a tag with the same version (`v2026.11.17`), then publish the draft release that appears on the Releases page. Online servers are listed in `mp/servers.js`; the `MP_SERVER_URL` repository variable only switches online on for the build, same as the website.

## License

BlockBattle — Copyright (C) 2026 Arvin Zaman

Original source: https://github.com/Arvin2A/BlockBattle

The game's code and the art I drew are licensed under the GNU General Public License, version 3 only. See [LICENSE](LICENSE).

Sound effects in `audio/` are from [Pixabay](https://pixabay.com) and are used under the [Pixabay Content License](https://pixabay.com/service/license-summary/). They are **not** covered by the GPL, and you can't redistribute them on their own.

[Phaser](https://phaser.io) (the `phaser` npm package) is © Phaser Studio Inc. and is used under the MIT License.
