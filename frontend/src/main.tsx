import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/app'
import { applySettings } from './helpers/settings'

// Apply saved font + theme before first paint so there's no flash of defaults.
applySettings()

// Tag the document for Tauri-only styling (e.g. a thinner scrollbar). Done
// before render so it applies on first paint.
if ('__TAURI_INTERNALS__' in window) {
  document.documentElement.classList.add('tauri')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
