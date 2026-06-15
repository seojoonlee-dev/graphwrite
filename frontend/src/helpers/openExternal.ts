// Open an external URL in the system browser. In the Tauri apps window.open
// would load the page inside our webview, so use the opener plugin there; on the
// web, a normal new tab is what we want.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function openExternal(url: string): void {
  if (isTauri) {
    import('@tauri-apps/plugin-opener')
      .then((m) => m.openUrl(url))
      .catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
