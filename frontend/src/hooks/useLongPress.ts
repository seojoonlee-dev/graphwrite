import { useRef, useCallback } from 'react';

type LongPressHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
};

// Builds touch handlers that fire `onLongPress` after a press-and-hold.
// Touch events only fire from touch input, so this lives alongside the
// existing onContextMenu (mouse right-click) without conflicting.
export function useLongPress(ms = 500) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number, y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return useCallback((onLongPress: (x: number, y: number) => void): LongPressHandlers => ({
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = window.setTimeout(() => {
        onLongPress(start.current!.x, start.current!.y);
        timer.current = null;
      }, ms);
    },
    // cancel if the finger moves (i.e. the user is scrolling/panning)
    onTouchMove: (e) => {
      if (!start.current) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 10) {
        clear();
      }
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
  }), [ms, clear]);
}
