// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron');
const { GameFiles } = require('./updater.cjs');
const { DiscordPresence } = require('./discord.cjs');

const SCHEME = 'app';
const HOST = 'blockbattle';
const GAME_ROOT = path.join(__dirname, '..', 'dist');
const GAME_URL = `${SCHEME}://${HOST}/index.html`;
const WINDOW = { width: 1200, height: 720, minWidth: 640, minHeight: 384, background: '#000000' };
const RELEASES_URL = 'https://github.com/Arvin2A/BlockBattle/releases';
const CRASH_RELOAD_DELAY_MS = 1000;
const SPLASH_URL = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>BLOCK BATTLE!!</title><style>
html,body{margin:0;height:100%;background:#000;color:#fff;font:bold 20px system-ui,sans-serif;letter-spacing:1px}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
h1{margin:0;font-size:44px}#status{opacity:.75}
</style></head><body><h1>BLOCK BATTLE!!</h1><div id="status">CHECKING FOR UPDATES...</div></body></html>`);

protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

function serveGameFile(gameFiles, request) {
    const { pathname } = new URL(request.url);
    const file = gameFiles.resolve(decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
}

async function setStatus(window, text) {
    if (window.isDestroyed()) return;
    try {
        await window.webContents.executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(text)}`);
    } catch {
    }
}

async function askForNewApp(window) {
    const { response } = await dialog.showMessageBox(window, {
        type: 'info',
        title: 'BLOCK BATTLE!!',
        message: 'A new version of the BLOCK BATTLE!! app is out.',
        detail: 'This update needs the newest app, so it can\'t download by itself. Grab it from the releases page, or keep playing the version you have (online play may not connect until you update).',
        buttons: ['DOWNLOAD NEW APP', 'PLAY ANYWAY'],
        defaultId: 0,
        cancelId: 1
    });
    if (response === 0) shell.openExternal(RELEASES_URL);
}

async function updateGame(window, gameFiles) {
    try {
        await window.loadURL(SPLASH_URL);
        const plan = await gameFiles.check();
        if (!plan || window.isDestroyed()) return;
        if (plan.needsNewApp) {
            await askForNewApp(window);
            return;
        }
        await gameFiles.download(plan, (done, total) => {
            const percent = total > 0 ? Math.floor((done / total) * 100) : 100;
            setStatus(window, `DOWNLOADING UPDATE... ${percent}%`);
        });
    } catch (error) {
        console.error('Game update skipped:', error);
    }
}

function logCrash(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    console.error(line.trim());
    try {
        fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), line);
    } catch {
    }
}

app.on('child-process-gone', (event, details) => {
    logCrash(`${details.type} process stopped: ${details.reason} (exit code ${details.exitCode})`);
});

function openOutside(url) {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
}

function createWindow() {
    const window = new BrowserWindow({
        width: WINDOW.width,
        height: WINDOW.height,
        minWidth: WINDOW.minWidth,
        minHeight: WINDOW.minHeight,
        backgroundColor: WINDOW.background,
        title: 'BLOCK BATTLE!!',
        icon: path.join(__dirname, 'build', 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
        openOutside(url);
        return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith(`${SCHEME}://${HOST}/`)) return;
        event.preventDefault();
        openOutside(url);
    });
    window.webContents.on('render-process-gone', (event, details) => {
        logCrash(`game page stopped: ${details.reason} (exit code ${details.exitCode})`);
        if (details.reason === 'clean-exit' || window.isDestroyed()) return;
        setTimeout(() => {
            if (!window.isDestroyed()) window.loadURL(GAME_URL);
        }, CRASH_RELOAD_DELAY_MS);
    });
    window.webContents.on('unresponsive', () => logCrash('game page stopped responding'));
    window.webContents.on('responsive', () => logCrash('game page is responding again'));
    window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            window.setFullScreen(!window.isFullScreen());
            event.preventDefault();
        }
    });
    return window;
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const [window] = BrowserWindow.getAllWindows();
        if (!window) return;
        if (window.isMinimized()) window.restore();
        window.focus();
    });
    app.whenReady().then(() => {
        Menu.setApplicationMenu(null);
        const presence = new DiscordPresence();
        presence.start();
        ipcMain.on('discord-status', (event, status) => {
            if (!event.senderFrame?.url?.startsWith(`${SCHEME}://${HOST}/`)) return;
            presence.setActivity(status);
        });
        app.on('before-quit', () => presence.stop());
        const gameFiles = new GameFiles(GAME_ROOT);
        protocol.handle(SCHEME, request => serveGameFile(gameFiles, request));
        const window = createWindow();
        updateGame(window, gameFiles).then(() => {
            if (!window.isDestroyed()) window.loadURL(GAME_URL);
        });
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow().loadURL(GAME_URL);
        });
    });
    app.on('window-all-closed', () => app.quit());
}
