# BlockBattle
BLOCK BATTLE GAME: for Intro to Coding and App Design
it says mohsina007 for the edits, but its just me, idk how to change it anymore.

EDIT: This game while originally for a class project, is now developing as a passion project. 
100% OPEN SOURCE GAME IN DEVELOPMENT!

## Online multiplayer

Two players on the **same network** (same Wi-Fi/router) can fight each other from their own devices.
One computer hosts, and everyone (the host included) plays in the browser.

### Hosting
You need [Node.js](https://nodejs.org) 18+ and Google Chrome (or Chromium / Microsoft Edge) on the host computer.

```
npm install
npm run lan
```

It prints addresses like `http://192.168.1.23:8080/BlockBattle/`. Everyone opens that address, clicks **ONLINE**, picks a fighter and presses **FIND MATCH**. The first two people searching get matched 1v1, and the next two get their own match.

If nobody else can connect:
- Allow Node.js through the host computer's firewall (Windows asks the first time you run it).
- Make sure everyone is on the same network. Some school and public Wi-Fi networks block devices from talking to each other, and LAN play can't work there.

Settings, as environment variables: `PORT` (default 8080), `BB_MAX_MATCHES` (default 4; each match uses about 400 MB of RAM), `CHROME_PATH` (if Chrome isn't found).

### How it works
- `server/` is a small Node server. It serves the game, runs the 1v1 queue, and starts every match in a hidden Chrome tab running the real game code (`mp/authority.js`).
- Players' browsers only send button presses. All hits, knockback, KOs and wins are decided on the server, so a player can't edit their own copy of the game to cheat.
- `mp/mirror.js` sends what the server's game looks like (only what changed each frame, around 0.2 KB) and the players' screens redraw it, sounds included.

### Online on GitHub Pages / InfinityFree
Those sites only serve files and can't run the server, so their ONLINE button says **NOT AVAILABLE** until a server is configured.
To get online on them, run the server on a 24/7 machine with HTTPS (see **[SERVER_SETUP.md](SERVER_SETUP.md)**) and set the `MP_SERVER_URL` repository variable (e.g. `wss://play.example.com/mp`). Optionally set `MP_SERVER_NAME` (e.g. `NEW YORK`) for the name players see. The deploy workflow builds both into the sites. The menu then shows `NEW YORK - 3 ONLINE` while the server is up, or `SERVER OFFLINE` (greyed out) while it's down.

### Developing online features
Run `npm run server` in one terminal and `npm run dev` in another. Vite forwards `/mp` to the server. To make the hidden match tabs use your dev build too, start the server with `BB_GAME_URL=http://127.0.0.1:5173/BlockBattle/ npm run server`.
Add `&render=1` to an authority URL (printed when you start the server with `BB_AUTHORITY=manual`) to watch a match host in a normal browser window.
