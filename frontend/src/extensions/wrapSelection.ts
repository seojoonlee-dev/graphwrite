import { EditorView } from '@codemirror/view';
import { EditorSelection, type Extension } from '@codemirror/state';

// Typing an opening bracket over a selection wraps it instead of replacing it:
// select "note", press [ and get [note], with "note" still selected so a
// second [ makes the [[note]] wikilink. With nothing selected, typing is
// untouched. Handled as an input handler (not a keymap) so it also covers
// virtual keyboards and IME input, which don't always emit a matching keydown.
const PAIRS: Record<string, string> = { '[': ']' };

export const wrapSelection: Extension = EditorView.inputHandler.of((view, _from, _to, text) => {
  const close = PAIRS[text];
  if (!close) return false;
  const { state } = view;
  if (state.selection.ranges.every((r) => r.empty)) return false;

  const spec = state.changeByRange((range) => {
    // A mix of empty and non-empty ranges: empty ones just get the character.
    if (range.empty) {
      return {
        changes: { from: range.from, insert: text },
        range: EditorSelection.cursor(range.from + text.length),
      };
    }
    return {
      changes: [
        { from: range.from, insert: text },
        { from: range.to, insert: close },
      ],
      range: EditorSelection.range(range.anchor + text.length, range.head + text.length),
    };
  });
  view.dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input.type' }));
  return true;
});
