// Android's webview inflates rendered text (font auto-sizing / system font
// scale) without resizing em/rem-based elements, so the header icon buttons end
// up tiny next to the note text — and no static CSS unit can match, because text
// and layout are on different scaling tracks. We can't disable the inflation
// from CSS (text-size-adjust doesn't reach it here), so instead we *measure* how
// much text is actually inflated and expose it as the --text-scale variable; the
// header buttons multiply their size by it to match. Resolves to 1 where there's
// no inflation (desktop, browser), so it's a no-op there.

export function measureTextScale(): number {
  const SIZE = 16;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  // line-height:1 makes the box height equal the *rendered* font size, so the
  // ratio to SIZE is exactly the inflation factor. width:100% so it sits in a
  // realistic block (font auto-sizing is width-dependent).
  probe.style.cssText =
    'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;' +
    'margin:0;padding:0;border:0;white-space:nowrap;line-height:1;font-size:' + SIZE + 'px;';
  probe.textContent = 'GraphWrite 0123456789 quick brown fox';
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();
  const factor = measured / SIZE;
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

export function applyTextScale(): void {
  document.documentElement.style.setProperty('--text-scale', String(measureTextScale()));
}
