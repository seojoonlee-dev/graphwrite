import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, RangeSet, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { ARROWS, ARROW_RE } from './arrows';
import { type BuildRanges, viewportCachedDecorations } from '../helpers/decorationCache';

// Live Preview: hide the markdown syntax markers and let syntaxHighlighting
// render the formatting inline. Markers on the line(s) the cursor/selection
// touches are revealed so they stay editable, the core Obsidian behavior.
// Links and wikilinks additionally get a clickable mark carrying their target;
// the click handler lives in the editor (see editor.tsx).

const hidden = Decoration.replace({});

class RuleWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-hr';
    return el;
  }
  eq() {
    return true;
  }
}
const ruleDeco = Decoration.replace({ widget: new RuleWidget() });

class BulletWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-bullet';
    el.textContent = '•';
    return el;
  }
  eq() {
    return true;
  }
}
const bulletDeco = Decoration.replace({ widget: new BulletWidget() });

// Header that replaces the opening ```lang fence: language label on the left,
// a copy button on the right. The code text is captured so copy is self-contained.
class CodeHeaderWidget extends WidgetType {
  lang: string;
  code: string;
  constructor(lang: string, code: string) {
    super();
    this.lang = lang;
    this.code = code;
  }
  eq(other: CodeHeaderWidget) {
    return other.lang === this.lang && other.code === this.code;
  }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-code-header';

    const lang = document.createElement('span');
    lang.className = 'cm-code-lang';
    lang.textContent = this.lang || 'text';

    const copy = document.createElement('button');
    copy.className = 'cm-code-copy';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('mousedown', (e) => e.preventDefault());
    copy.addEventListener('click', (e) => {
      e.preventDefault();
      void navigator.clipboard?.writeText(this.code);
      copy.textContent = 'Copied';
      window.setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1200);
    });

    wrap.append(lang, copy);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

// GFM table rendering.
// A markdown table (parsed by the GFM extension as a `Table` node) is replaced
// by a real, GitHub-style <table> when the cursor isn't inside it. Put the
// cursor on any of its lines and the raw pipe source comes back for editing.

// Undo the backslash escapes markdown allows inside cell text.
const unescapeCell = (s: string): string => s.replace(/\\([\\`*_~|[\]()])/g, '$1');

// Minimal inline markdown -> DOM, covering what shows up in table cells. Built
// with real nodes (no innerHTML) so cell content can't inject markup. Links and
// wikilinks reuse the editor's existing .cm-link/.cm-wikilink click handling.
const inlineRules: { re: RegExp; build: (m: RegExpExecArray) => Node }[] = [
  {
    re: /`([^`]+)`/,
    build: (m) => {
      const e = document.createElement('code');
      e.className = 'cm-inline-code';
      e.textContent = m[1];
      return e;
    },
  },
  {
    re: /\*\*([^*]+?)\*\*|__([^_]+?)__/,
    build: (m) => {
      const e = document.createElement('strong');
      appendInline(e, m[1] ?? m[2]);
      return e;
    },
  },
  {
    re: /~~([^~]+?)~~/,
    build: (m) => {
      const e = document.createElement('del');
      appendInline(e, m[1]);
      return e;
    },
  },
  {
    re: /\*([^*]+?)\*|_([^_]+?)_/,
    build: (m) => {
      const e = document.createElement('em');
      appendInline(e, m[1] ?? m[2]);
      return e;
    },
  },
  {
    re: /\[\[([^\]]+?)\]\]/,
    build: (m) => {
      const e = document.createElement('span');
      e.className = 'cm-wikilink';
      e.setAttribute('data-wikilink', m[1]);
      e.textContent = m[1];
      return e;
    },
  },
  {
    re: /\[([^\]]+?)\]\(([^)]+?)\)/,
    build: (m) => {
      const e = document.createElement('span');
      e.className = 'cm-link';
      e.setAttribute('data-href', m[2]);
      e.textContent = m[1];
      return e;
    },
  },
  // Arrows render in table cells too, matching the arrows extension. Inline code
  // still wins: a code span starts before any arrow inside it, and the earliest
  // match is picked.
  {
    re: new RegExp(ARROW_RE.source),
    build: (m) => document.createTextNode(ARROWS[m[0]]),
  },
];

function appendInline(parent: HTMLElement, text: string): void {
  let rest = text;
  while (rest.length) {
    let best: { idx: number; len: number; node: Node } | null = null;
    for (const rule of inlineRules) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) {
        best = { idx: m.index, len: m[0].length, node: rule.build(m) };
      }
    }
    if (!best) {
      parent.appendChild(document.createTextNode(unescapeCell(rest)));
      return;
    }
    if (best.idx > 0) parent.appendChild(document.createTextNode(unescapeCell(rest.slice(0, best.idx))));
    parent.appendChild(best.node);
    rest = rest.slice(best.idx + best.len);
  }
}

// Split one table row into trimmed cell strings, honoring escaped pipes (\|)
// and ignoring the optional leading/trailing border pipes.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      cur += ch + s[i + 1];
      i++;
    } else if (ch === '|') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// Column alignment from a delimiter cell: :--- left, :--: center, ---: right.
function alignOf(cell: string): '' | 'left' | 'center' | 'right' {
  const c = cell.trim();
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

function buildTable(raw: string): HTMLElement {
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  const table = document.createElement('table');
  table.className = 'cm-md-table';
  if (lines.length === 0) return table;

  const headers = splitRow(lines[0]);
  const aligns = lines.length > 1 ? splitRow(lines[1]).map(alignOf) : [];

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  headers.forEach((cell, i) => {
    const th = document.createElement('th');
    if (aligns[i]) th.style.textAlign = aligns[i];
    appendInline(th, cell);
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r = 2; r < lines.length; r++) {
    const cells = splitRow(lines[r]);
    const tr = document.createElement('tr');
    for (let i = 0; i < headers.length; i++) {
      const td = document.createElement('td');
      if (aligns[i]) td.style.textAlign = aligns[i];
      appendInline(td, cells[i] ?? '');
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

class TableWidget extends WidgetType {
  raw: string;
  from: number;
  constructor(raw: string, from: number) {
    super();
    this.raw = raw;
    this.from = from;
  }
  eq(other: TableWidget) {
    return other.raw === this.raw && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';
    wrap.appendChild(buildTable(this.raw));
    // Click anywhere but a link drops the cursor into the source so the table
    // reveals as raw markdown for editing.
    wrap.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.cm-link') || target.closest('.cm-wikilink')) return;
      e.preventDefault();
      view.dispatch({ selection: { anchor: this.from } });
      view.focus();
    });
    return wrap;
  }
}

// Block decorations (the rendered table replaces a run of lines, changing the
// document's vertical layout) may not come from a view plugin: CodeMirror only
// accepts them from a state field that feeds the decorations facet directly. So
// tables live in their own field, separate from the inline live-preview plugin.
//
// A field sees only EditorState, which has no focus flag, yet the reveal-on-edit
// behavior must match the plugin: when the editor is blurred, render everything
// as preview (no table is held open just because the saved selection sits in it).
// We mirror focus into state with an effect dispatched on DOM focus/blur.
const setFocused = StateEffect.define<boolean>();

const focusedField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFocused)) value = e.value;
    return value;
  },
});

const focusWatcher = EditorView.domEventHandlers({
  focus: (_e, view) => {
    view.dispatch({ effects: setFocused.of(true) });
    return false;
  },
  blur: (_e, view) => {
    view.dispatch({ effects: setFocused.of(false) });
    return false;
  },
});

function buildTableDecorations(state: EditorState, focused: boolean): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = state;

  // Lines (1-based) the selection touches. A table covering any of them shows
  // its raw source for editing. Empty when blurred, so nothing stays open.
  const active = new Set<number>();
  if (focused) {
    for (const range of state.selection.ranges) {
      const first = doc.lineAt(range.from).number;
      const last = doc.lineAt(range.to).number;
      for (let n = first; n <= last; n++) active.add(n);
    }
  }

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return;
      const startLine = doc.lineAt(node.from).number;
      const endLine = doc.lineAt(Math.max(node.from, node.to - 1)).number;
      for (let ln = startLine; ln <= endLine; ln++) {
        if (active.has(ln)) return false; // cursor inside: leave raw source
      }
      const first = doc.line(startLine);
      const last = doc.line(endLine);
      const raw = doc.sliceString(first.from, last.to);
      builder.add(
        first.from,
        last.to,
        Decoration.replace({ widget: new TableWidget(raw, first.from), block: true }),
      );
      return false;
    },
  });
  return builder.finish();
}

const tableField = StateField.define<DecorationSet>({
  create: (state) => buildTableDecorations(state, false),
  update(value, tr) {
    const focused = tr.state.field(focusedField);
    // Recompute when the text, selection, focus, or (incremental) parse changes.
    const focusChanged = tr.effects.some((e) => e.is(setFocused));
    if (tr.docChanged || tr.selection || focusChanged || syntaxTree(tr.startState) != syntaxTree(tr.state)) {
      return buildTableDecorations(tr.state, focused);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Lines (1-based) touched by any selection range, where markers stay visible.
// When the editor isn't focused there is no active line, so everything renders
// as preview (no stray markers on reload or after clicking away).
function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  const { doc } = view.state;
  for (const range of view.state.selection.ranges) {
    const first = doc.lineAt(range.from).number;
    const last = doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function childrenByName(node: SyntaxNode) {
  const out: Record<string, SyntaxNode[]> = {};
  for (let c = node.firstChild; c; c = c.nextSibling) {
    (out[c.name] ??= []).push(c);
  }
  return out;
}

const rawLinkMark = Decoration.mark({ class: 'cm-link-raw' });

// Strip the optional <angle brackets> around a link destination.
const linkHref = (s: string): string => (s.startsWith('<') && s.endsWith('>') ? s.slice(1, -1) : s);

// CommonMark label matching: case-insensitive, with runs of whitespace collapsed.
const normalizeLabel = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Block containers a [label]: url definition can sit inside. Anything else is
// skipped without descending, so this walk stays cheap on a long document.
const DEFINITION_CONTAINERS = new Set(['Document', 'Blockquote', 'BulletList', 'OrderedList', 'ListItem']);

// Every [label]: url definition in the document, keyed by normalized label. The
// first definition of a label wins, as in CommonMark. Collected from the whole
// tree (not just the build range) so a link resolves against a definition
// anywhere in the note, and rebuilt with the decorations, which already refresh
// as the incremental parse advances.
function collectLinkDefinitions(state: EditorState): Map<string, string> {
  const defs = new Map<string, string>();
  const { doc } = state;
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'LinkReference') {
        const kids = childrenByName(node.node);
        const label = kids.LinkLabel?.[0];
        const url = kids.URL?.[0];
        if (label && url) {
          const key = normalizeLabel(doc.sliceString(label.from + 1, label.to - 1));
          if (!defs.has(key)) defs.set(key, linkHref(doc.sliceString(url.from, url.to)));
        }
        return false;
      }
      return DEFINITION_CONTAINERS.has(node.name);
    },
  });
  return defs;
}

function buildDecorations(view: EditorView, ranges: BuildRanges): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const active = activeLines(view);
  const { doc } = view.state;
  const defs = collectLinkDefinitions(view.state);
  // Line decorations for [label]: url definitions. Kept in their own builder
  // because a definition inside a list item or blockquote starts after that
  // line's marker decoration, so adding at line start would be out of order.
  const refLines = new RangeSetBuilder<Decoration>();

  for (const { from, to } of ranges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const onActiveLine = active.has(doc.lineAt(node.from).number);

        // Link: inline [text](url), or a reference form ([text], [text][] and
        // [text][label]) that resolves through a [label]: url definition. Shows
        // "text" only, clickable. A reference that doesn't resolve is plain text,
        // exactly as CommonMark renders it, so a bare [text] or a half-typed
        // [[wikilink] never looks like a link.
        if (node.name === 'Link') {
          const kids = childrenByName(node.node);
          const marks = kids.LinkMark ?? [];
          const open = marks[0];
          const close = marks[1];
          if (!open || !close || open.to >= close.from) return false;

          let href: string | undefined;
          const url = kids.URL?.[0];
          if (url) {
            href = linkHref(doc.sliceString(url.from, url.to));
          } else {
            // Full form carries its label in [label]; collapsed ([]) and shortcut
            // forms use the link text itself.
            const label = kids.LinkLabel?.[0];
            const key = label && label.to - label.from > 2
              ? doc.sliceString(label.from + 1, label.to - 1)
              : doc.sliceString(open.to, close.from);
            href = defs.get(normalizeLabel(key));
          }
          if (href === undefined) return false;

          if (onActiveLine) {
            // Raw source stays visible; style it as a link but don't make the
            // whole span clickable, or editing it would open the URL.
            builder.add(node.from, node.to, rawLinkMark);
            return false;
          }
          builder.add(open.from, open.to, hidden);
          builder.add(
            open.to,
            close.from,
            Decoration.mark({ class: 'cm-link', attributes: { 'data-href': href } }),
          );
          builder.add(close.from, node.to, hidden);
          return false;
        }

        // Wikilink: [[Note]] -> show "Note" only, clickable.
        if (node.name === 'WikiLink') {
          if (!onActiveLine) {
            const marks = childrenByName(node.node).WikiLinkMark ?? [];
            const open = marks[0];
            const close = marks[1];
            if (open && close && open.to < close.from) {
              const name = doc.sliceString(open.to, close.from);
              builder.add(open.from, open.to, hidden);
              builder.add(
                open.to,
                close.from,
                Decoration.mark({ class: 'cm-wikilink', attributes: { 'data-wikilink': name } }),
              );
              builder.add(close.from, close.to, hidden);
            }
          }
          return false;
        }

        // GFM table: the rendered <table> is a block-level replace decoration,
        // which CodeMirror forbids from a view plugin (it changes vertical
        // layout). It's produced by `tableField` instead; here we only skip the
        // node so its cells don't get inline markers applied underneath.
        if (node.name === 'Table') {
          return false;
        }

        // [label]: url definition. Rendered markdown never shows these, so the
        // line is dimmed (see .cm-link-ref) but left editable in place.
        if (node.name === 'LinkReference') {
          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(Math.max(node.from, node.to - 1)).number;
          for (let ln = startLine; ln <= endLine; ln++) {
            const line = doc.line(ln);
            refLines.add(line.from, line.from, Decoration.line({ class: 'cm-link-ref' }));
          }
          return false;
        }

        // Fenced code: background box on every line (always on). The opening
        // ```lang line becomes a header (language + copy); the closing ``` is
        // hidden. Both reveal as raw when the cursor is on that line. Syntax
        // highlighting itself is handled by the embedded language parser.
        if (node.name === 'FencedCode') {
          const kids = childrenByName(node.node);
          const marks = kids.CodeMark ?? [];
          const info = kids.CodeInfo?.[0];
          const codeText = kids.CodeText?.[0];
          const openMark = marks[0];
          const closeMark = marks.length > 1 ? marks[marks.length - 1] : undefined;
          const code = codeText ? doc.sliceString(codeText.from, codeText.to) : '';

          const startLine = doc.lineAt(node.from).number;
          const endLine = doc.lineAt(Math.max(node.from, node.to - 1)).number;
          const openLine = openMark ? doc.lineAt(openMark.from).number : -1;
          const closeLine = closeMark ? doc.lineAt(closeMark.from).number : -1;

          for (let ln = startLine; ln <= endLine; ln++) {
            const line = doc.line(ln);
            const cls =
              'cm-code-block' +
              (ln === startLine ? ' cm-code-block-first' : '') +
              (ln === endLine ? ' cm-code-block-last' : '');
            builder.add(line.from, line.from, Decoration.line({ class: cls }));

            if (active.has(ln)) continue; // editing this fence line: show it raw

            if (openMark && ln === openLine) {
              const lang = info ? doc.sliceString(info.from, info.to) : '';
              const headerTo = info ? info.to : openMark.to;
              builder.add(openMark.from, headerTo, Decoration.replace({ widget: new CodeHeaderWidget(lang, code) }));
            }
            if (closeMark && ln === closeLine) {
              builder.add(closeMark.from, closeMark.to, hidden);
            }
          }
          return false;
        }

        // Inline code: hide the backticks and give the content a chip background.
        if (node.name === 'InlineCode') {
          if (!onActiveLine) {
            const marks = childrenByName(node.node).CodeMark ?? [];
            const open = marks[0];
            const close = marks[marks.length - 1];
            if (open && close && open.to <= close.from) {
              builder.add(open.from, open.to, hidden);
              if (open.to < close.from) {
                builder.add(open.to, close.from, Decoration.mark({ class: 'cm-inline-code' }));
              }
              builder.add(close.from, close.to, hidden);
            }
          }
          return false;
        }

        // Nested list items get extra left indent (per level) so the hierarchy
        // reads more clearly than the source whitespace alone conveys.
        if (node.name === 'ListItem') {
          let depth = 0;
          for (let p = node.node.parent; p; p = p.parent) {
            if (p.name === 'BulletList' || p.name === 'OrderedList') depth++;
          }
          if (depth >= 2) {
            const line = doc.lineAt(node.from);
            builder.add(
              line.from,
              line.from,
              Decoration.line({ attributes: { style: `margin-left: ${(depth - 1) * 0.8}em` } }),
            );
          }
          return;
        }

        if (node.name === 'HorizontalRule') {
          if (!onActiveLine) builder.add(node.from, node.to, ruleDeco);
          return;
        }

        if (onActiveLine) return;

        switch (node.name) {
          case 'HeaderMark':
          case 'QuoteMark': {
            // Swallow the single space after the marker so text isn't indented.
            let end = node.to;
            if (doc.sliceString(end, end + 1) === ' ') end += 1;
            builder.add(node.from, end, hidden);
            break;
          }
          case 'EmphasisMark':
          case 'StrikethroughMark':
            builder.add(node.from, node.to, hidden);
            break;
          case 'ListMark':
            // Render bullet-list markers as a bullet; ordered lists keep numbers.
            if (node.node.parent?.parent?.name === 'BulletList') {
              builder.add(node.from, node.to, bulletDeco);
            }
            break;
        }
      },
    });
  }
  return RangeSet.join([builder.finish(), refLines.finish()]);
}

// Cached (see decorationCache): rebuilt when the doc/parse/selection/focus
// changes or the viewport escapes the padded build range, NOT on the
// geometry-only viewport updates that fire every frame of a sidebar resize.
const livePreviewPlugin = viewportCachedDecorations(buildDecorations, { selection: true, focus: true });

// Blockquote lines get an accent bar down the side (styled by .cm-quote). It's a
// line decoration that shows whether or not the cursor is on the line, so it
// lives in its own plugin to keep clear of the inline builder's ordering.
function buildQuoteDecorations(view: EditorView, ranges: BuildRanges): DecorationSet {
  const { doc } = view.state;
  const quoteLines = new Set<number>();
  for (const { from, to } of ranges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'Blockquote') return;
        const start = doc.lineAt(node.from).number;
        const end = doc.lineAt(Math.max(node.from, node.to - 1)).number;
        for (let ln = start; ln <= end; ln++) quoteLines.add(ln);
      },
    });
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const ln of [...quoteLines].sort((a, b) => a - b)) {
    const line = doc.line(ln);
    builder.add(line.from, line.from, Decoration.line({ class: 'cm-quote' }));
  }
  return builder.finish();
}

// Cached like the live-preview plugin above; quote bars don't depend on the
// selection or focus, so only doc/parse/viewport changes rebuild them.
const quoteLinePlugin = viewportCachedDecorations(buildQuoteDecorations);

// `focusedField` is listed before `tableField` so that, within a transaction,
// `tableField.update` reads the already-updated focus value.
export const livePreview: Extension = [focusedField, tableField, focusWatcher, livePreviewPlugin, quoteLinePlugin];
