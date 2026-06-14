import { useEffect } from 'react';
import type { Webview } from '@tauri-apps/api/webview';

// Ctrl/Cmd + '='/'-' zoom for the desktop (Tauri) app, persisted across restarts.
// We drive the webview's native zoom ourselves (instead of Tauri's built-in
// zoomHotkeysEnabled polyfill) so we can save/restore the level — the polyfill
// keeps its level internally and resets to 100% on launch. No-op in browsers,
// which already zoom natively.
const KEY = 'zoom';
const MIN = 0.5;
const MAX = 3;
const STEP = 0.1;

const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

export function useZoom() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let zoom = clamp(parseFloat(localStorage.getItem(KEY) || '1') || 1);
    let webview: Webview | undefined;
    let cancelled = false;

    (async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      if (cancelled) return;
      webview = getCurrentWebview();
      void webview.setZoom(zoom);
    })();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') zoom = clamp(zoom + STEP);
      else if (e.key === '-' || e.key === '_') zoom = clamp(zoom - STEP);
      else if (e.key === '0') zoom = 1;
      else return;
      e.preventDefault();
      localStorage.setItem(KEY, String(zoom));
      void webview?.setZoom(zoom);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
