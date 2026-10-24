// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { defineConfig } from 'vite'

export default defineConfig(() => ({
  base: process.env.INFINITYFREE === 'true' ? '/' : '/BlockBattle/',
  server: {
    // Lets "npm run dev" talk to a LAN server started with "npm run server".
    proxy: {
      '/mp': { target: 'ws://localhost:8080', ws: true }
    }
  }
}))
