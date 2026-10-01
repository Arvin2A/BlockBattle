import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'infinityfree' ? '/' : '/BlockBattle/',
}))