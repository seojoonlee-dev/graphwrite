import { type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

// The decoration plugins used to rebuild on every viewportChanged update. That
// is correct but wasteful: CodeMirror reports a viewport change for pure
// geometry shifts too — most notably every frame of the sidebar's width
// transition, where line wrapping changes line heights and therefore the
// viewport's document range. Each of those frames re-iterated the syntax tree
// in three plugins, on top of the unavoidable native re-layout, which the
// desktop webview (WebKitGTK) couldn't absorb.
//
// Instead, decorations are built over the viewport plus PAD characters of
// slack on each side and kept until the viewport actually escapes the covered
// range — or the doc, parse, selection or focus genuinely invalidates them.
// Keeping them across geometry-only updates is safe because decoration
// positions only depend on the document, which hasn't changed.

export type BuildRanges = readonly { from: number; to: number }[];

// Characters of slack around the viewport. Big enough that the viewport-range
// drift during the 300ms sidebar resize (lines re-wrap, so the same pixel
// height spans more or fewer characters) and ordinary scrolling stay covered;
// small enough that a build stays proportional to the screen, not the document.
const PAD = 4000;

// visibleRanges, each extended by PAD and clamped to the doc; touching ranges
// are merged so the builders never receive overlapping (unsorted) ranges.
function paddedRanges(view: EditorView): { from: number; to: number }[] {
  const len = view.state.doc.length;
  const out: { from: number; to: number }[] = [];
  for (const r of view.visibleRanges) {
    const from = Math.max(0, r.from - PAD);
    const to = Math.min(len, r.to + PAD);
    const last = out[out.length - 1];
    if (last && from <= last.to) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}

function covered(ranges: BuildRanges, view: EditorView): boolean {
  return view.visibleRanges.every((r) => ranges.some((c) => c.from <= r.from && r.to <= c.to));
}

// Wraps a decoration builder in a view plugin that rebuilds only when needed.
// `selection`/`focus` declare whether the builder's output depends on the
// selection / focus state (the reveal-raw-markdown behavior does; the quote
// bars don't).
export function viewportCachedDecorations(
  build: (view: EditorView, ranges: BuildRanges) => DecorationSet,
  deps: { selection?: boolean; focus?: boolean } = {},
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      ranges: BuildRanges = [];
      constructor(view: EditorView) {
        this.decorations = this.rebuild(view);
      }
      rebuild(view: EditorView): DecorationSet {
        this.ranges = paddedRanges(view);
        return build(view, this.ranges);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          (deps.selection && update.selectionSet) ||
          (deps.focus && update.focusChanged) ||
          // The tree parses incrementally in the background; decorations built
          // from a partial parse must refresh as it advances.
          syntaxTree(update.startState) != syntaxTree(update.state)
        ) {
          this.decorations = this.rebuild(update.view);
        } else if (update.viewportChanged && !covered(this.ranges, update.view)) {
          this.decorations = this.rebuild(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
