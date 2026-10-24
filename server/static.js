// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// Serves the built game (dist/) so everyone on the LAN can open it in a browser.

import fs from 'node:fs';
import path from 'node:path';
import { SERVER_PAGE_MARKER } from '../mp/protocol.js';

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// basePath matches vite.config.js (the game is built for /BlockBattle/).
export function createStaticHandler(distDir, basePath) {
    const root = path.resolve(distDir);

    return function serveStatic(request, response) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
            return;
        }

        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/' || url.pathname === basePath.slice(0, -1)) {
            response.writeHead(302, { Location: basePath }).end();
            return;
        }
        if (!url.pathname.startsWith(basePath)) {
            response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
            return;
        }

        let relative;
        try {
            relative = decodeURIComponent(url.pathname.slice(basePath.length));
        } catch {
            response.writeHead(400).end();
            return;
        }
        let filePath = path.resolve(root, relative || 'index.html');
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            response.writeHead(403).end();
            return;
        }

        fs.stat(filePath, (statError, stats) => {
            if (!statError && stats.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            }
            fs.stat(filePath, (error, fileStats) => {
                if (error || !fileStats.isFile()) {
                    if (!fs.existsSync(path.join(root, 'index.html'))) {
                        response.writeHead(503, { 'Content-Type': 'text/plain' })
                            .end('The game has not been built yet. Run "npm run build" (or start with "npm run lan").');
                        return;
                    }
                    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
                    return;
                }
                const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
                if (path.basename(filePath) === 'index.html') {
                    servePage(filePath, request, response);
                    return;
                }
                response.writeHead(200, {
                    'Content-Type': type,
                    'Content-Length': fileStats.size,
                    // Hashed build files never change; everything else is re-checked.
                    'Cache-Control': relative.startsWith('assets/index-') ? 'public, max-age=31536000, immutable' : 'no-cache'
                });
                if (request.method === 'HEAD') {
                    response.end();
                    return;
                }
                fs.createReadStream(filePath).pipe(response);
            });
        });
    };
}

// Tags the page so the game knows it can play online here (see mp/serverConfig.js).
function servePage(filePath, request, response) {
    fs.readFile(filePath, 'utf8', (error, html) => {
        if (error) {
            response.writeHead(500).end();
            return;
        }
        const body = Buffer.from(html.replace('<head>', `<head>\n    ${SERVER_PAGE_MARKER}`));
        response.writeHead(200, {
            'Content-Type': CONTENT_TYPES['.html'],
            'Content-Length': body.length,
            'Cache-Control': 'no-cache'
        });
        response.end(request.method === 'HEAD' ? undefined : body);
    });
}
