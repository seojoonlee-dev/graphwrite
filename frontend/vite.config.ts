import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Storage backend for the notes API, selected at build time:
//   http (default) → talks to the self-hosted Express backend (api.http.ts)
//   indexeddb      → standalone browser storage for the web demo (api.indexeddb.ts)
const storage = process.env.VITE_STORAGE ?? 'http'

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
  },
})
