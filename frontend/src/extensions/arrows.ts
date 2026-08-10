import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, RangeSetBuilder } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

// Live Preview arrows: `->`, `<-` and `<->` render as →, ← and ↔. Display-only —
// the plain ASCII stays in the markdown file — and, like the rest of Live
// Preview, the raw characters come back on the line(s) the cursor touches.

// `<->` is listed first so it wins over its own `<-` prefix, which would
// otherwise render as a stray "←>".
export const ARROWS: Record<string, string> = { '<->': '↔', '->': '→', '<-': '←' };
export const ARROW_RE = /<->|->|<-/g;

class ArrowWidget extends WidgetType {
  arrow: string;
  constructor(arrow: string) {
    super();
    this.arrow = arrow;
  }
  eq(other: ArrowWidget) {
    return other.arrow === this.arrow;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-arrow';
    el.textContent = this.arrow;
    return el;
  }
}

const arrowDecos: Record<string, Decoration> = Object.fromEntries(
  Object.entries(ARROWS).map(([src, arrow]) => [src, Decoration.replace({ widget: new ArrowWidget(arrow) })]),
);

// Arrows inside code stay raw: `a->b` in a snippet is code, not prose.
const CODE_NODES = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'CodeText', 'CodeInfo']);

function inCode(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (CODE_NODES.has(node.name)) return true;
  }
  return false;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;

  // Lines the selection touches keep their raw arrows (same reveal rule as the
  // live-preview plugin); when blurred everything renders as preview.
  const active = new Set<number>();
  if (view.hasFocus) {
    for (const range of view.state.selection.ranges) {
      const first = doc.lineAt(range.from).number;
      const last = doc.lineAt(range.to).number;
      for (let n = first; n <= last; n++) active.add(n);
    }
  }

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    ARROW_RE.lastIndex = 0;
    for (let m = ARROW_RE.exec(text); m; m = ARROW_RE.exec(text)) {
      const start = from + m.index;
      if (active.has(doc.lineAt(start).number)) continue;
      if (inCode(view.state, start)) continue;
      builder.add(start, start + m[0].length, arrowDecos[m[0]]);
    }
  }
  return builder.finish();
}

const arrowPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export const arrows: Extension = [arrowPlugin];
