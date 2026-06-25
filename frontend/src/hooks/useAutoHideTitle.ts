import { useEffect, useRef, type RefObject } from 'react';

// Base height (px, before text-inflation) of the editor title / the reserved top
// region the editor content pads for it. MUST match the `.cm-content` padding-top
// base in editor.css (calc(80px * var(--text-scale))).
const TITLE_ZONE_PX = 80;

// Net scroll distance (px) in one direction before the title toggles. Deltas are
// accumulated, so a smooth scroll built from many tiny sub-threshold events still
// trips it — that fragmentation (browsers emit far more, far smaller scroll events
// than Android's WebView) was why the old fixed per-event comparison missed.
const HIDE_AFTER = 12;
const SHOW_AFTER = 12;

// A scroll counts as user-driven if a real input device (wheel / touch) acted
// within this window OR the scroll is part of a continuous stream (see below).
// Programmatic one-offs — the cursor scrolled into view while typing, a
// scroll-into-view on navigation — get neither, so they never flip the title.
const INPUT_WINDOW_MS = 700;

// Touch inertia fires NO touch events, so the input window above can't be relied
// on to span it (mobile momentum easily outlasts a second). Instead we treat an
// uninterrupted run of scroll events as user-driven: momentum emits a frame every
// ~16ms, while a programmatic scroll lands as an isolated event with a long gap
// before it. If consecutive scrolls are closer than this, the run continues.
const SCROLL_GAP_MS = 200;

interface Options {
  /** Master switch — when false the controller detaches and the title is pinned. */
  enabled: boolean;
  /** Changes on view/route change; resets the controller and re-pins the title. */
  resetKey: string;
}

/**
 * Drives the auto-hiding editor title: it scrolls away with the content near the
 * top, then becomes an overlay that hides on scroll-down and peeks in on
 * scroll-up. Position is pushed imperatively onto the app element via the
 * `--title-shift` / `--title-transition` CSS vars, so per-scroll updates never
 * re-render React. Those are inline vars (not React-managed props), so they
 * survive re-renders; the `.title-autohide` class that gates the styling is owned
 * by React (rendered from the same `enabled` state) precisely so a re-render can't
 * strip it.
 *
 * Input-agnostic by design: direction is read from scroll deltas and gated by a
 * recent-input timestamp, so it works identically for touch, mouse wheel and
 * trackpad — and is ready to be switched on for desktop/web behind a setting.
 */
export function useAutoHideTitle(
  scrollRef: RefObject<HTMLElement | null>,
  appRef: RefObject<HTMLElement | null>,
  { enabled, resetKey }: Options,
) {
  const shownRef = useRef(true); // is the title currently revealed?
  // Scroll extremes since the last toggle: the highest point reached (lowest
  // scrollTop) and the deepest (highest scrollTop). The title toggles on travel
  // measured from these, not from the previous event — see onScroll.
  const highRef = useRef(0);
  const lowRef = useRef(0);
  const lastInputAt = useRef(0); // timestamp (perf clock) of the last real input

  // Reset internal state and re-pin the title whenever the view changes or the
  // feature is toggled off.
  useEffect(() => {
    shownRef.current = true;
    highRef.current = 0;
    lowRef.current = 0;
    const app = appRef.current;
    if (app) {
      app.style.setProperty('--title-shift', '0px');
      app.style.removeProperty('--title-transition');
    }
  }, [enabled, resetKey, appRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const app = appRef.current;
    if (!enabled || !scrollEl || !app) return;

    // The reserved zone equals the `.cm-content` padding-top, which scales with
    // the webview's text inflation; measure it live so the glued title and that
    // padding stay the same height.
    let zone = TITLE_ZONE_PX;
    const measureZone = () => {
      const scale =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1;
      zone = TITLE_ZONE_PX * scale;
    };
    measureZone();

    // shift = title translateY (px, negative = up); glue = track scroll 1:1 (drop
    // the transition) vs. animate as an overlay. Both are inline CSS vars so a
    // React re-render of .l-app can't clobber them (the title-autohide class is
    // React-owned for the same reason).
    const render = (shift: number, glue: boolean) => {
      app.style.setProperty('--title-shift', `${shift}px`);
      app.style.setProperty('--title-transition', glue ? 'none' : 'transform 0.25s ease');
    };

    const markInput = () => {
      lastInputAt.current = performance.now();
    };

    let lastScrollAt = 0; // perf timestamp of the previous scroll event

    // Listens in the capture phase to catch the (descendant) editor scroller,
    // whose scroll events don't bubble.
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.scrollTop !== 'number') return;
      const max = target.scrollHeight - target.clientHeight;
      // Clamp out overscroll/bounce so it can't flip direction at the edges.
      const top = Math.max(0, Math.min(target.scrollTop, max));

      const now = performance.now();
      // User-driven if a real input fired recently OR this scroll continues an
      // unbroken stream (an active drag or its inertia). The stream test is what
      // covers momentum once the input window lapses — without it, the tail of a
      // long flick was misread as programmatic, collapsing the anchors every frame
      // so the title could never reach its hide threshold mid-scroll.
      const userDriven =
        now - lastInputAt.current < INPUT_WINDOW_MS || now - lastScrollAt < SCROLL_GAP_MS;
      lastScrollAt = now;
      if (userDriven) {
        // Track the extremes, then toggle on travel measured *from the extreme*,
        // not from the previous event. An extreme only moves when the scroll
        // genuinely pushes past it, so the small opposite-direction jitter that
        // accompanies a rapid reversal (and momentum being cancelled) can't reset
        // the progress — it just fails to beat the extreme and is ignored. Deltas
        // still accumulate naturally because the extreme stays put across a stream
        // of tiny same-direction events.
        if (top < highRef.current) highRef.current = top; // pushed higher (scroll up)
        if (top > lowRef.current) lowRef.current = top; // pushed deeper (scroll down)
        if (shownRef.current) {
          if (top - highRef.current >= HIDE_AFTER) {
            shownRef.current = false;
            highRef.current = lowRef.current = top; // collapse anchors at the turn
          }
        } else if (lowRef.current - top >= SHOW_AFTER) {
          shownRef.current = true;
          highRef.current = lowRef.current = top;
        }
      } else {
        // Isolated, programmatic scroll (cursor scrolled into view while typing,
        // a scroll-into-view): re-anchor to here so the next real gesture measures
        // cleanly, but never toggle. Safe to collapse precisely because this is a
        // one-off, not a frame in an ongoing scroll.
        highRef.current = lowRef.current = top;
      }
      if (top <= 0) {
        shownRef.current = true; // at rest at the top: always revealed
        highRef.current = lowRef.current = 0;
      }

      if (top <= zone && !shownRef.current) {
        // Top zone, heading down: glue to the content so the title scrolls away
        // together with the reserved padding (1:1, no transition).
        render(-top, true);
      } else if (top <= zone) {
        // Top zone, revealed / at rest: pin the title at the very top.
        render(0, false);
      } else {
        // Past the zone: pure overlay — peek in on scroll-up, hide on scroll-down.
        render(shownRef.current ? 0 : -zone, false);
      }
    };

    const opts = { capture: true, passive: true } as const;
    scrollEl.addEventListener('scroll', onScroll, opts);
    // Any of these marks the scroll that (briefly) follows as user-driven.
    window.addEventListener('wheel', markInput, opts);
    window.addEventListener('touchstart', markInput, opts);
    window.addEventListener('touchmove', markInput, opts);
    window.addEventListener('touchend', markInput, opts);
    window.addEventListener('resize', measureZone);
    return () => {
      scrollEl.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('wheel', markInput, { capture: true });
      window.removeEventListener('touchstart', markInput, { capture: true });
      window.removeEventListener('touchmove', markInput, { capture: true });
      window.removeEventListener('touchend', markInput, { capture: true });
      window.removeEventListener('resize', measureZone);
    };
  }, [enabled, scrollRef, appRef]);
}
