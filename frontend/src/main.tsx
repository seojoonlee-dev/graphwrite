import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/app'
import { applySettings } from './helpers/settings'

// Apply saved font + theme before first paint so there's no flash of defaults.
applySettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
