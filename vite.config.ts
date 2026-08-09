/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Injects the iOS launch-image link tags.
 *
 * Safari needs one apple-touch-startup-image per device size with an exact
 * media query, which is 36 tags. They are generated alongside the PNGs by
 * scripts/generate-pwa-icons.py and injected here rather than pasted into
 * index.html, so the tags cannot drift away from the images they point at and
 * index.html stays readable.
 */
function iosSplashScreens(): Plugin {
  const fragment = path.resolve(__dirname, 'scripts/pwa-splash-link-tags.html')

  return {
    name: 'rallyhub-ios-splash',
    transformIndexHtml(html: string) {
      if (!fs.existsSync(fragment)) return html
      const tags = fs.readFileSync(fragment, 'utf8')
      return html.replace('</head>', `${tags}  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), iosSplashScreens()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Default environment stays 'node' (unchanged) for the existing pure-logic
    // test suite, so `typeof window === 'undefined'` branches elsewhere keep
    // testing their node-environment behavior exactly as before. Component
    // tests that need DOM globals opt in per-file with a
    // `// @vitest-environment jsdom` docblock instead of a global switch.
    setupFiles: ['./vitest.setup.ts'],
  },
})
