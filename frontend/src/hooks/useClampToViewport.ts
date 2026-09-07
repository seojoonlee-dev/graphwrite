import { useLayoutEffect, type RefObject } from 'react';

// Distance (px) a popup keeps from the viewport edges.
const MARGIN = 8;

// Keeps a fixed-position popup (context menu) fully on screen. The popup is
// first rendered at the requested point, then measured before paint and pushed
// left/up as far as needed so its right/bottom edges don't run past the window.
// Writes the corrected position straight onto the element rather than through
// state, so the correction never triggers a re-render or a visible jump.
export function useClampToViewport(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
  enabled = true,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN));
    const top = Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [ref, x, y, enabled]);
}
