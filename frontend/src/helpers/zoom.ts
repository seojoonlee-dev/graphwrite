// Shared screen-zoom state for the desktop/mobile (Tauri) app. The webview's
// native zoom is driven by us (instead of Tauri's zoomHotkeysEnabled polyfill)
// so the level can be saved/restored — the polyfill resets to 100% on launch.
// Both the keyboard shortcut hook and the settings dropdown go through here so
// they stay in sync. No-op in browsers, which already zoom natively.
import type { Webview } from '@tauri-apps/api/webview';

const KEY = 'zoom';
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.1;

export const isTauri = () => '__TAURI_INTERNALS__' in window;

// The Android webview ignores the native setZoom API, and the CSS `zoom`
// property gets cancelled out by the webview's font auto-sizing (text rescales
// to compensate, so nothing visibly changes). Instead we expose the level as a
// `--zoom` CSS variable and let the phone stylesheet apply a transform: scale()
// on the app root — a transform scales the rendered output wholesale, so
// auto-sizing can't fight it. Desktop (WebKitGTK) keeps native setZoom.
const isAndroid = () => isTauri() && /android/i.test(navigator.userAgent);

export const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

export const getZoom = () => clampZoom(parseFloat(localStorage.getItem(KEY) || '1') || 1);

// The scale currently applied to the app via CSS transform (Android phones +
// tablets). 1 everywhere the transform isn't active — desktop drives the
// webview's own zoom, and the browser zooms natively, so neither needs this.
// Used to convert viewport coordinates into the transformed coordinate space.
export const getCssZoomScale = () => (isAndroid() ? getZoom() : 1);

let webviewPromise: Promise<Webview> | undefined;
const getWebview = () => {
  if (!webviewPromise) {
    webviewPromise = import('@tauri-apps/api/webview').then((m) => m.getCurrentWebview());
  }
  return webviewPromise;
};

const applyCssZoom = (z: number) =>
  document.documentElement.style.setProperty('--zoom', String(z));

// Apply the saved zoom (call once on startup).
export async function applyZoom() {
  const z = getZoom();
  if (isAndroid()) {
    applyCssZoom(z);
    return;
  }
  if (!isTauri()) return;
  (await getWebview()).setZoom(z);
}

// Persist and apply a new zoom level; returns the clamped value actually used.
export function setZoom(zoom: number) {
  const z = clampZoom(zoom);
  localStorage.setItem(KEY, String(z));
  if (isAndroid()) applyCssZoom(z);
  else if (isTauri()) void getWebview().then((w) => w.setZoom(z));
  return z;
}
