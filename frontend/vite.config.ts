import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Storage backend for the notes API, selected at build time:
//   http (default) → talks to the self-hosted Express backend (api.http.ts)
//   indexeddb      → standalone browser storage for the web demo (api.indexeddb.ts)
const storage = process.env.VITE_STORAGE ?? 'http'
const isDemo = storage === 'indexeddb'

// Set by `tauri android/ios dev --host`: the LAN IP the device uses to reach
// this dev server. We point the HMR websocket at it so hot reload works on a
// physical phone. Unset for desktop/web dev, where the defaults are fine.
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  // Served at the site root by default; the hosted demo sets VITE_BASE=/demo/
  // so it can live under graphwrite.app/demo as a sub-path.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    // Give the hosted demo its own <title>, description and canonical URL
    // (so Google indexes graphwrite.app/demo/ as a distinct page and can show
    // it as a sitelink) without touching the shared index.html the
    // desktop/mobile apps use.
    {
      name: 'demo-head',
      transformIndexHtml: (html: string) =>
        isDemo
          ? {
              html: html.replace('<title>GraphWrite</title>', '<title>GraphWrite Demo</title>'),
              tags: [
                {
                  tag: 'meta',
                  attrs: {
                    name: 'description',
                    content:
                      'Try GraphWrite in your browser: branching markdown notes with an interactive graph view. Runs entirely in your browser, nothing is uploaded.',
                  },
                  injectTo: 'head',
                },
                { tag: 'link', attrs: { rel: 'canonical', href: 'https://graphwrite.app/demo/' }, injectTo: 'head' },
              ],
            }
          : html,
    },
  ],
  // Don't clear the screen so Tauri's CLI output stays visible during dev.
  clearScreen: false,
  resolve: {
    alias: {
      '@notesApi': fileURLToPath(new URL(`./src/helpers/api.${storage}.ts`, import.meta.url)),
    },
  },
  build: {
    license: {
      fileName: "THIRD-PARTY-LICENSES.md",
    },
  },
  server: {
    allowedHosts: true,
    // Fixed port so Tauri's devUrl (http://localhost:5173) always matches.
    port: 5173,
    strictPort: true,
    // On-device HMR: connect the websocket back to the host machine over the LAN
    // (port 1421, Tauri's convention). Without this the page loads but live
    // reload never connects. Falls back to Vite's default for desktop/web.
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
  },
})
