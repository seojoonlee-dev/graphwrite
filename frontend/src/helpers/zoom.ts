// Shared screen-zoom state for the desktop/mobile (Tauri) app. The webview's
// native zoom is driven by us (instead of Tauri's zoomHotkeysEnabled polyfill)
// so the level can be saved/restored — the polyfill resets to 100% on launch.
// Both the keyboard shortcut hook and the settings dropdown go through here so
// they stay in sync. No-op in browsers, which already zoom natively.
import type { Webview } from '@tauri-apps/api/webview';

const KEY = 'zoom';
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

export const isTauri = () => '__TAURI_INTERNALS__' in window;

export const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

export const getZoom = () => clampZoom(parseFloat(localStorage.getItem(KEY) || '1') || 1);

let webviewPromise: Promise<Webview> | undefined;
const getWebview = () => {
  if (!webviewPromise) {
    webviewPromise = import('@tauri-apps/api/webview').then((m) => m.getCurrentWebview());
  }
  return webviewPromise;
};

// Apply the saved zoom to the webview (call once on startup).
export async function applyZoom() {
  if (!isTauri()) return;
  (await getWebview()).setZoom(getZoom());
}

// Persist and apply a new zoom level; returns the clamped value actually used.
export function setZoom(zoom: number) {
  const z = clampZoom(zoom);
  localStorage.setItem(KEY, String(z));
  if (isTauri()) void getWebview().then((w) => w.setZoom(z));
  return z;
}
