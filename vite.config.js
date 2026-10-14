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
