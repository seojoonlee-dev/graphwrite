import { EditorView, keymap, type Panel, type ViewUpdate } from '@codemirror/view';
import { EditorSelection, type Extension } from '@codemirror/state';
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  search,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search';

// Find within the note (Ctrl/Cmd+F). @codemirror/search does the matching and
// highlighting; the panel is our own, trimmed to a text field, a match counter
// and previous/next/close. Searches are literal and case-insensitive; a search
// term selected in the note is picked up when the panel opens.

// Match counting stops here so a huge note with a one-letter query can't stall
// the UI; the counter shows "1000+" past it.
const MAX_COUNT = 1000;

// Select the first match at or after `from`, wrapping to the top. Searching
// from the selection start (not its end) means refining the query keeps the
// current match selected as long as it still matches.
function selectMatchFrom(view: EditorView, query: SearchQuery, from: number): void {
  let match = query.getCursor(view.state.doc, from).next();
  if (match.done) match = query.getCursor(view.state.doc).next();
  if (match.done) return;
  view.dispatch({
    selection: EditorSelection.single(match.value.from, match.value.to),
    scrollIntoView: true,
    userEvent: 'select.search',
  });
}

function createFindPanel(view: EditorView): Panel {
  const dom = document.createElement('div');
  dom.className = 'cm-find';

  const input = document.createElement('input');
  input.className = 'cm-find-input';
  input.type = 'text';
  input.placeholder = 'Find in note';
  input.spellcheck = false;
  input.autocomplete = 'off';
  // openSearchPanel focuses the element carrying this attribute.
  input.setAttribute('main-field', 'true');

  const count = document.createElement('span');
  count.className = 'cm-find-count';

  const button = (label: string, title: string, run: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cm-find-btn';
    b.textContent = label;
    b.title = title;
    // Keep the focus (and the caret) in the text field across clicks.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', run);
    return b;
  };
  const prev = button('↑', 'Previous match (Shift+Enter)', () => findPrevious(view));
  const next = button('↓', 'Next match (Enter)', () => findNext(view));
  const close = button('×', 'Close (Esc)', () => {
    closeSearchPanel(view);
    view.focus();
  });

  dom.append(input, count, prev, next, close);

  const refresh = () => {
    const query = getSearchQuery(view.state);
    if (!query.search) {
      count.textContent = '';
      dom.classList.remove('cm-find-none');
      return;
    }
    const sel = view.state.selection.main;
    let total = 0;
    let index = 0;
    const cursor = query.getCursor(view.state.doc);
    for (let m = cursor.next(); !m.done && total < MAX_COUNT; m = cursor.next()) {
      total++;
      if (m.value.from === sel.from && m.value.to === sel.to) index = total;
    }
    const totalText = total >= MAX_COUNT ? `${MAX_COUNT}+` : String(total);
    count.textContent = total === 0 ? 'No matches' : `${index || '–'} / ${totalText}`;
    dom.classList.toggle('cm-find-none', total === 0);
  };

  input.addEventListener('input', () => {
    const query = new SearchQuery({ search: input.value, caseSensitive: false, literal: true });
    view.dispatch({ effects: setSearchQuery.of(query) });
    if (query.search) selectMatchFrom(view, query, view.state.selection.main.from);
    refresh();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrevious(view);
      else findNext(view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    }
  });

  return {
    dom,
    mount() {
      input.value = getSearchQuery(view.state).search;
      input.focus();
      input.select();
      refresh();
    },
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) refresh();
    },
  };
}

// Editor-focused keys. Ctrl/Cmd+F is also caught at the document level by the
// editor component, so it works while the focus is in the sidebar or title.
const findKeymap = keymap.of([
  { key: 'Mod-f', run: openSearchPanel, scope: 'editor search-panel' },
  { key: 'F3', run: findNext, shift: findPrevious, scope: 'editor search-panel', preventDefault: true },
  { key: 'Mod-g', run: findNext, shift: findPrevious, scope: 'editor search-panel', preventDefault: true },
  { key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' },
]);

export const findInNote: Extension = [search({ createPanel: createFindPanel }), findKeymap];

// True when the key event is the platform's find shortcut (Ctrl+F / Cmd+F).
export const isFindShortcut = (e: KeyboardEvent): boolean =>
  (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f';

export { openSearchPanel as openFindPanel };
