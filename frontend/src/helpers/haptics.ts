// Fire a vibration of `ms` milliseconds. In Tauri the WebView's
// navigator.vibrate is unreliable (user-activation gating / unsupported), so use
// the native haptics plugin (registered on mobile; a harmless no-op error on
// desktop). On the web fall back to navigator.vibrate.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function vibrate(ms: number): Promise<void> {
  if (!ms || ms <= 0) return;
  if (isTauri) {
    try {
      const haptics = await import('@tauri-apps/plugin-haptics');
      await haptics.vibrate(ms);
    } catch (e) {
      // Plugin not registered (e.g. desktop) — log for diagnosis on mobile.
      console.warn('haptics vibrate failed:', e);
    }
  } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}
