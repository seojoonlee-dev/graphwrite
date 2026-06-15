import { useEffect } from 'react';
import { applyZoom, getZoom, isTauri, setZoom, ZOOM_STEP } from '../helpers/zoom';

// Ctrl/Cmd + '='/'-' zoom for the desktop (Tauri) app, persisted across
// restarts. Shares state with the settings Screen-zoom dropdown via
// helpers/zoom. No-op in browsers, which already zoom natively.
export function useZoom() {
  useEffect(() => {
    if (!isTauri()) return;

    void applyZoom();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') setZoom(getZoom() + ZOOM_STEP);
      else if (e.key === '-' || e.key === '_') setZoom(getZoom() - ZOOM_STEP);
      else if (e.key === '0') setZoom(1);
      else return;
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
