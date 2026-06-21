import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { livePreview } from '../extensions/livePreview';
import { WikiLink } from '../extensions/wikiLink';
import { effectiveColors, subscribe } from '../helpers/settings';
import { openExternal } from '../helpers/openExternal';
import '../style/editor.css';

interface EditorProps {
  rawContent: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => Promise<boolean>;
  // Invoked when a [[wikilink]] is clicked: creates the note (or navigates to it
  // if it already exists), matching the previous behavior.
  createFile: (value?: string) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
}

// Relative "when" for the save indicator, e.g. "saved just now", "saved 3m ago".
function savedLabel(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 10) return 'saved just now';
  if (secs < 60) return `saved ${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `saved ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `saved ${hrs}h ago`;
}

// Markdown chrome styling — theme-independent. The CodeMirror document IS the
// markdown, so there is no lossy round-trip; what you type is what gets saved.
const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.5em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.3em', fontWeight: 'bold' },
  { tag: t.heading4, fontSize: '1.2em', fontWeight: 'bold' },
  { tag: t.heading5, fontSize: '1.1em', fontWeight: 'bold' },
  { tag: t.heading6, fontSize: '1em', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: "'Fira Code', 'Courier New', monospace" },
  { tag: [t.link, t.url], color: '#7aa2f7', textDecoration: 'underline' },
  { tag: t.quote, color: '#9aaab0', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta], color: '#6f6f6f' },
]);

// Code-token colors, swapped by code-block background brightness (see below).
const codeHighlightDark = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#c586c0' },
  { tag: [t.string, t.special(t.string)], color: '#ce9178' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955', fontStyle: 'italic' },
  { tag: [t.number, t.integer, t.float], color: '#b5cea8' },
  { tag: [t.bool, t.null, t.atom], color: '#569cd6' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
  { tag: [t.typeName, t.className, t.namespace], color: '#4ec9b0' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.variableName)], color: '#9cdcfe' },
  { tag: [t.operator], color: '#d4d4d4' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: [t.punctuation, t.bracket, t.escape], color: '#d4d4d4' },
  { tag: t.monospace, color: '#e0c9a6' },
]);

// Light-optimized (VS Code Light+ inspired) for a light code background.
const codeHighlightLight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#0000ff' },
  { tag: [t.string, t.special(t.string)], color: '#a31515' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#008000', fontStyle: 'italic' },
  { tag: [t.number, t.integer, t.float], color: '#098658' },
  { tag: [t.bool, t.null, t.atom], color: '#0000ff' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#795e26' },
  { tag: [t.typeName, t.className, t.namespace], color: '#267f99' },
  { tag: [t.propertyName, t.attributeName, t.definition(t.variableName)], color: '#001080' },
  { tag: [t.operator], color: '#444444' },
  { tag: t.regexp, color: '#811f3f' },
  { tag: t.tagName, color: '#800000' },
  { tag: [t.punctuation, t.bracket, t.escape], color: '#444444' },
  { tag: t.monospace, color: '#a31515' },
]);

// Perceived-brightness check on the (possibly customized) code-block bg, used to
// pick the matching syntax theme automatically.
const isLightHex = (hex: string): boolean => {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
};

const codeHighlight = () =>
  syntaxHighlighting(isLightHex(effectiveColors().codeBg) ? codeHighlightLight : codeHighlightDark);

// Editor chrome only — references the same semantic tokens so it follows the
// theme. Syntax-highlight colors above are deliberately left untouched.
const editorTheme = EditorView.theme({
  '&': { color: 'var(--text)', backgroundColor: 'transparent', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.5', overflow: 'auto', overscrollBehavior: 'none', paddingBottom: '50vh' },
  '.cm-content': { caretColor: 'var(--text)', paddingRight: '10px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--bg-tertiary)',
  },
  '.cm-placeholder': { color: 'var(--text-muted)' },
});

function Editor({ rawContent, onChange, placeholder = 'Start typing your note here...', title, onTitleChange, createFile, saveState, lastSavedAt }: EditorProps) {
  const { '*': parsedFilePath } = useParams();

  // Re-render on a timer so the relative "saved … ago" label keeps current.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const saveText =
    saveState === 'saving' ? 'saving…'
    : saveState === 'error' ? 'save failed'
    : saveState === 'saved' ? (lastSavedAt ? savedLabel(lastSavedAt) : 'saved')
    : '';

  const prevFilePath = useRef(parsedFilePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Keep the latest callbacks without recreating the editor, and suppress the
  // change event we fire ourselves when syncing external content in.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const createFileRef = useRef(createFile);
  createFileRef.current = createFile;
  const settingExternal = useRef(false);
  const awaitingLoad = useRef(false);
  // Holds the code-syntax highlight style so it can be swapped on theme change.
  const codeHlRef = useRef(new Compartment());

  const invalidChars = /[\\/:*?"<>|]/;

  const [value, setTitle] = useState(title);
  const [showTitleError, toggleTitleError] = useState(false);

  const titleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);
    toggleTitleError(invalidChars.test(inputValue));
  };

  const titleChangeSave = async () => {
    const trimmedValue = value.trim();

    if (invalidChars.test(trimmedValue)) {
      setTitle(title);
      toggleTitleError(false);
      return;
    }

    if (trimmedValue && title !== trimmedValue) {
      const renamed = await onTitleChange(trimmedValue);
      if (!renamed) setTitle(title);
    } else {
      setTitle(title);
    }
  };

  useEffect(() => {
    setTitle(title);
  }, [title]);

  // Create the editor once.
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: rawContent,
        extensions: [
          history(),
          keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [WikiLink] }),
          syntaxHighlighting(markdownHighlight),
          codeHlRef.current.of(codeHighlight()),
          livePreview,
          EditorView.lineWrapping,
          cmPlaceholder(placeholder),
          editorTheme,
          // Click a rendered link to open it / a wikilink to create-or-open the note.
          EditorView.domEventHandlers({
            mousedown: (event) => {
              const target = event.target as HTMLElement | null;
              if (!target) return false;

              const linkEl = target.closest('.cm-link');
              if (linkEl) {
                const href = linkEl.getAttribute('data-href') || '';
                if (/^(https?:|mailto:)/i.test(href)) {
                  event.preventDefault();
                  openExternal(href);
                  return true;
                }
                return false;
              }

              const wikiEl = target.closest('.cm-wikilink');
              if (wikiEl) {
                const name = wikiEl.getAttribute('data-wikilink') || '';
                if (name) {
                  event.preventDefault();
                  createFileRef.current(name);
                  return true;
                }
              }
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !settingExternal.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Created once; content/file syncing is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-pick code syntax highlighting (dark vs light) when settings change.
  useEffect(
    () =>
      subscribe(() => {
        viewRef.current?.dispatch({ effects: codeHlRef.current.reconfigure(codeHighlight()) });
      }),
    [],
  );

  // Sync external content changes (file switches, loads, autosave restores)
  // into the editor without clobbering what the user is actively typing.
  //
  // A file switch updates the URL one render before the new content arrives, so
  // we latch `awaitingLoad` on the change and keep applying until the content
  // actually differs from the editor. This matters when the navigation came
  // from inside the editor (e.g. clicking a wikilink to create a note), where it
  // stays focused — the focus guard below would otherwise skip the load.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (prevFilePath.current !== parsedFilePath) {
      prevFilePath.current = parsedFilePath;
      awaitingLoad.current = true;
    }

    const current = view.state.doc.toString();
    if (!awaitingLoad.current && (view.hasFocus || rawContent === current)) return;

    if (rawContent !== current) {
      settingExternal.current = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: rawContent } });
      settingExternal.current = false;
      awaitingLoad.current = false;
    }
  }, [rawContent, parsedFilePath]);

  return (
    <div>
      <div className="editor">
        <div className="editor-title">
          <input
            type="text"
            value={value}
            onChange={titleChange}
            onBlur={titleChangeSave}
            className="editor-title-input"
          />
          <div className="editor-meta">
            <span className="editor-path">{parsedFilePath ? `/notes/${parsedFilePath}` : '/notes'}</span>
            {saveText && <span className={`editor-save editor-save--${saveState}`}>{saveText}</span>}
          </div>
        </div>
        <hr />
        <div className="cm-host" ref={containerRef} />
      </div>
      <p className={`editor-error ${showTitleError ? 'is-visible' : ''}`}>
        File names can't contain \, /, :, *, ?, ", &lt;, &gt;, and |.
      </p>
    </div>
  );
}

export default Editor;
