// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Runs one hidden (headless) Chrome and opens a tab per online match.
// Each tab runs the real game as the match's authority (see mp/authority.js).
// Tabs are opened/closed through Chrome's built-in DevTools HTTP endpoints,
// so no extra npm packages are needed, just Chrome, Chromium or Edge installed.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function candidatePaths() {
    const env = process.env;
    if (process.platform === 'win32') {
        const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
        return roots.flatMap(root => [
            path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(root, 'Chromium', 'Application', 'chrome.exe'),
            path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        ]);
    }
    if (process.platform === 'darwin') {
        return [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ];
    }
    const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
    const dirs = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
    return names.flatMap(name => dirs.map(dir => path.join(dir, name)));
}

export function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    return candidatePaths().find(candidate => {
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }) ?? null;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class HeadlessChrome {
    constructor(executablePath, log = console.log) {
        this.executablePath = executablePath;
        this.log = log;
        this.process = null;
        this.port = null;
        this.profileDir = null;
        this.starting = null;
    }

    async ensureRunning() {
        if (this.process && this.port) return;
        this.starting ??= this.start().finally(() => {
            this.starting = null;
        });
        await this.starting;
    }

    async start() {
        this.profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blockbattle-chrome-'));
        const args = [
            '--headless=new',
            '--remote-debugging-address=127.0.0.1',
            '--remote-debugging-port=0',
            `--user-data-dir=${this.profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-sync',
            // Matches must keep running at full speed even though no one looks at them.
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling',
            // Sounds are mirrored to players; the server itself stays silent.
            '--mute-audio',
            '--autoplay-policy=no-user-gesture-required',
            'about:blank'
        ];
        // Chrome refuses to sandbox as root (e.g. inside Docker).
        if (process.getuid?.() === 0) args.unshift('--no-sandbox');

        const child = spawn(this.executablePath, args, { stdio: 'ignore' });
        this.process = child;
        child.on('exit', code => {
            if (this.process === child) {
                this.log(`Headless Chrome exited (code ${code}). It will restart for the next match.`);
                this.process = null;
                this.port = null;
            }
        });
        child.on('error', error => {
            this.log(`Could not start Chrome at ${this.executablePath}: ${error.message}`);
        });

        // Chrome writes the port it picked into DevToolsActivePort.
        const portFile = path.join(this.profileDir, 'DevToolsActivePort');
        for (let waited = 0; waited < 20000; waited += 100) {
            if (this.process !== child) throw new Error('Chrome closed while starting');
            try {
                const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
                if (port > 0) {
                    this.port = port;
                    return;
                }
            } catch {
                // Not written yet.
            }
            await sleep(100);
        }
        this.stop();
        throw new Error('Chrome did not start within 20 seconds');
    }

    async openTab(url) {
        await this.ensureRunning();
        const response = await fetch(
            `http://127.0.0.1:${this.port}/json/new?${encodeURIComponent(url)}`,
            { method: 'PUT' }
        );
        if (!response.ok) throw new Error(`Chrome refused to open a tab (${response.status})`);
        const tab = await response.json();
        return tab.id;
    }

    async closeTab(id) {
        if (!this.port || !id) return;
        try {
            await fetch(`http://127.0.0.1:${this.port}/json/close/${id}`);
        } catch {
            // Chrome already gone.
        }
    }

    stop() {
        const child = this.process;
        this.process = null;
        this.port = null;
        if (child && child.exitCode === null) child.kill();
        if (this.profileDir) {
            const dir = this.profileDir;
            this.profileDir = null;
            // Give Chrome a moment to let go of its files.
            setTimeout(() => fs.rm(dir, { recursive: true, force: true }, () => {}), 1000).unref();
        }
    }
}
