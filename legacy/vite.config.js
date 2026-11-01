// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

const root = fileURLToPath(new URL('..', import.meta.url))

const SHIMS = `<script>
if (typeof window.AbortController !== 'function') {
    window.AbortController = function () {
        this.signal = { aborted: false, addEventListener: function () { }, removeEventListener: function () { } };
    };
    window.AbortController.prototype.abort = function () { this.signal.aborted = true; };
}
</script>`

const GESTURE_BLOCK = /for \(const name of (\[[^\]]+\])\) \{\s*document\.addEventListener\(name, event => event\.preventDefault\(\), \{ passive: false \}\);\s*\}/

function legacyHtml() {
  return {
    name: 'blockbattle-legacy-html',
    transformIndexHtml(html) {
      if (!GESTURE_BLOCK.test(html)) throw new Error('legacy build: the gesture script in index.html changed, update legacy/vite.config.js')
      return html
        .replace('<head>', '<head>\n' + SHIMS)
        .replace(GESTURE_BLOCK, (_, names) => `${names}.forEach(function (name) {
        document.addEventListener(name, function (event) { event.preventDefault(); }, { passive: false });
    });`)
    }
  }
}

export default defineConfig(() => ({
  root,
  plugins: [
    legacyHtml(),
    legacy({
      targets: ['chrome >= 49', 'firefox >= 48'],
      renderModernChunks: false
    })
  ],
  base: './',
  build: {
    outDir: fileURLToPath(new URL('../dist-legacy', import.meta.url)),
    emptyOutDir: true
  }
}))
