// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');

const SCHEME = 'app';
const HOST = 'blockbattle';
const GAME_ROOT = path.join(__dirname, '..', 'dist');
const GAME_URL = `${SCHEME}://${HOST}/index.html`;
const WINDOW = { width: 1200, height: 720, minWidth: 640, minHeight: 384, background: '#000000' };

protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

function serveGameFile(request) {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.normalize(path.join(GAME_ROOT, relative));
    if (file !== GAME_ROOT && !file.startsWith(GAME_ROOT + path.sep)) {
        return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
}

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
            sandbox: true
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
    window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            window.setFullScreen(!window.isFullScreen());
            event.preventDefault();
        }
    });
    window.loadURL(GAME_URL);
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
        protocol.handle(SCHEME, serveGameFile);
        createWindow();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
    app.on('window-all-closed', () => app.quit());
}
