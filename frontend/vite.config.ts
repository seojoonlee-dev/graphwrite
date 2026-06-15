import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Storage backend for the notes API, selected at build time:
//   http (default) → talks to the self-hosted Express backend (api.http.ts)
//   indexeddb      → standalone browser storage for the web demo (api.indexeddb.ts)
const storage = process.env.VITE_STORAGE ?? 'http'

// Set by `tauri android/ios dev --host`: the LAN IP the device uses to reach
// this dev server. We point the HMR websocket at it so hot reload works on a
// physical phone. Unset for desktop/web dev, where the defaults are fine.
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
