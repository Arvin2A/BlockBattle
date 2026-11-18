// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

function assetVersions() {
  const versions = {}
  for (const dir of ['assets', 'audio']) {
    for (const entry of readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const file = path.join(entry.parentPath ?? entry.path, entry.name)
      const key = path.relative(root, file).split(path.sep).join('/')
      versions[key] = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)
    }
  }
  return versions
}

export default defineConfig(({ mode }) => ({
  define: {
    __ASSET_VERSIONS__: JSON.stringify(assetVersions())
  },
  base: mode === 'desktop' || process.env.INFINITYFREE === 'true' ? '/' : '/BlockBattle/',
  build: {
    outDir: process.env.BUILD_DIR || 'dist',
    emptyOutDir: true
  },
  server: {
    // Lets "npm run dev" talk to a local server started with "npm run server".
    proxy: {
      '/mp': { target: 'ws://localhost:8080', ws: true }
    }
  }
}))
