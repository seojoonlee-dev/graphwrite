import { useNavigate } from 'react-router-dom';
import { TintedImage } from './tintedImage';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  FONTS,
  TABLE_TOKEN_KEYS,
  TOKEN_LABELS,
  type ThemeName,
  type ThemeTokens,
  type VibrationLevel,
  effectiveColors,
  getAutoHideTitle,
  getCenterEditor,
  getFont,
  getStartupNote,
  getTableRounded,
  getTheme,
  getVibration,
  getVibrationMs,
  resetColors,
  saveSettings,
  setAutoHideTitle,
  setCenterEditor,
  setColor,
  setFont,
  setStartupNote,
  setTableRounded,
  setTheme,
  setVibration,
} from '../helpers/settings';
import { getZoom, isTauri, setZoom, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../helpers/zoom';
import { clearRecents } from '../helpers/recents';
import { vibrate } from '../helpers/haptics';
import '../style/settings.css';

// The demo stores notes in the browser (IndexedDB) and has no backend, so the
// server address setting is irrelevant there.
const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

// Vibration only applies to touch devices, so the setting is hidden elsewhere.
// The Vibration setting drives the native haptics plugin, which only exists in
// mobile Tauri builds and only does anything on devices with a vibration motor:
// Android (phones/tablets) and iPhone — not iPad, not desktop Tauri, and never
// the web build. iPad's WebView reports "iPad" (or masquerades as desktop), so
// the iPhone-only check leaves it out either way.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const supportsVibration = isTauri() && (/android/i.test(ua) || /iphone/i.test(ua));

// Phones are too narrow for the fixed-width centered column to make sense, so the
// "Align editor to the center" toggle is hidden there (matches the app's phone
// breakpoint elsewhere).
const isPhone = window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches;

const isTauriEnv = isTauri();

// --- Section registry -----------------------------------------------------
// Single source of truth for both the sidebar nav and the global search. Each
// settings block is a `<Section id>`; the matching entry here supplies its
// title (rendered as the heading + the sidebar label), the keywords search
// looks through, and whether it's available on this device/build at all.
type Group = 'General' | 'Appearance' | 'Misc' | 'Demo';
const GROUP_ORDER: Group[] = ['General', 'Appearance', 'Misc', 'Demo'];

interface SectionMeta {
  id: string;
  group: Group;
  title: string;
  keywords: string;
  show: boolean;
}

const SECTIONS: SectionMeta[] = [
  { id: 'startup-note', group: 'General', title: 'Startup note', keywords: 'open default note home launch start', show: true },
  { id: 'note-history', group: 'General', title: 'Note history', keywords: 'recent clear reset list', show: true },
  { id: 'server', group: 'General', title: 'Server', keywords: 'ip address port host connection url', show: true },
  { id: 'theme', group: 'Appearance', title: 'Theme', keywords: 'dark light black amoled custom preset colors color accent background text border palette table', show: true },
  { id: 'zoom', group: 'Appearance', title: 'Screen zoom', keywords: 'scale interface size magnify zoom', show: isTauriEnv },
  { id: 'font', group: 'Appearance', title: 'Font', keywords: 'typeface family serif sans text', show: true },
  { id: 'center-editor', group: 'Appearance', title: 'Align editor to the center', keywords: 'center column width layout', show: !isPhone },
  { id: 'table-corners', group: 'Appearance', title: 'Rounded table corners', keywords: 'table round corners border radius', show: true },
  { id: 'auto-hide-title', group: 'Appearance', title: 'Auto-hide title', keywords: 'title bar hide scroll header auto sticky', show: true },
  { id: 'vibration', group: 'Misc', title: 'Vibration', keywords: 'haptic feedback touch buzz', show: supportsVibration },
  { id: 'reset-demo', group: 'Demo', title: 'Reset demo', keywords: 'reset delete clear notes demo restore', show: isDemo },
];
const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

const TOKEN_KEYS = Object.keys(TOKEN_LABELS) as (keyof ThemeTokens)[];
// General color tokens listed separately from the dedicated "Table" group.
const GENERAL_TOKEN_KEYS = TOKEN_KEYS.filter((k) => !TABLE_TOKEN_KEYS.includes(k));

// Zoom presets offered in the dropdown, derived from the zoom bounds so they
// stay in sync with ZOOM_MIN/ZOOM_MAX (currently 50% → 500% in 10% steps).
const ZOOM_LEVELS = Array.from(
  { length: Math.round((ZOOM_MAX - ZOOM_MIN) / ZOOM_STEP) + 1 },
  (_, i) => Math.round((ZOOM_MIN + i * ZOOM_STEP) * 100) / 100,
);

// Provided by the page: returns whether a section should currently render (it's
// available on this device AND matches the active search query).
const SearchContext = createContext<(id: string) => boolean>(() => true);

// Wraps one settings block. Renders its heading from the registry and hides
// itself when filtered out, so search and the sidebar stay in lockstep without
// each block having to know about the query.
function Section({ id, children }: { id: string; children: ReactNode }) {
  const matches = useContext(SearchContext);
  if (!matches(id)) return null;
  const meta = SECTION_BY_ID.get(id);
  return (
    <section className='settings-view' id={id}>
      <h3>{meta?.title}</h3>
      {children}
    </section>
  );
}

function General() {
  const serverIp = localStorage.getItem('serverIp') ? localStorage.getItem('serverIp') : 'http://localhost:3001';
  const [value, setTitle] = useState(serverIp);
  const [startup, setStartup] = useState(getStartupNote());
  const [historyCleared, setHistoryCleared] = useState(false);

  const handleClearHistory = () => {
    clearRecents();
    setHistoryCleared(true);
  };

  const saveServer = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);
  };

  const changeServer = () => {
    if (value) {
      const trimmedValue = value.trim();
      localStorage.setItem('serverIp', trimmedValue);
    }
  };

  const changeStartup = () => setStartupNote(startup);

  return (
    <>
      <Section id='startup-note'>
        <p>Note to open automatically when the app loads. Leave empty to start on the home screen.</p>
        <div className='startup-input'>
          <span className='startup-slash'>/</span>
          <input
            type='text'
            name='startup'
            value={startup}
            placeholder='Note, Note/Tasks ...'
            onChange={(e) => setStartup(e.target.value.replace(/^\/+/, ''))}
            onBlur={changeStartup}
          />
        </div>
      </Section>
      <Section id='note-history'>
        <p>Resets the "Recent notes" list shown on the start screen.</p>
        <button className='btn-secondary btn-fixed' onClick={handleClearHistory} disabled={historyCleared}>
          {historyCleared ? 'Cleared' : 'Clear note history'}
        </button>
      </Section>
      <Section id='server'>
        {!isDemo ? (
          <>
            <p>Enter server IP address and port (example: http://192.168.0.1:3001): </p>
            <input type='text' name='server' defaultValue={serverIp!} onChange={saveServer} onBlur={changeServer}></input>
          </>
        ) : (
          <p>This is a demo. Your notes are saved locally in this browser.</p>
        )}
      </Section>
    </>
  );
}

function Appearance() {
  const [font, setFontState] = useState(getFont());
  const [theme, setThemeState] = useState<ThemeName>(getTheme());
  const [colors, setColors] = useState<ThemeTokens>(effectiveColors());
  const [zoom, setZoomState] = useState(getZoom());
  const [centerEditor, setCenterEditorState] = useState(getCenterEditor());
  const [tableRounded, setTableRoundedState] = useState(getTableRounded());
  const [autoHideTitle, setAutoHideTitleState] = useState(getAutoHideTitle());

  const changeFont = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    setFontState(next);
    setFont(next);
  };

  const changePreset = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as ThemeName;
    setThemeState(next);
    if (next === 'custom') {
      // Seed the custom palette from whatever is currently displayed.
      saveSettings({ theme: 'custom', colors: effectiveColors() });
    } else {
      setTheme(next); // presets ignore custom colors; clear them for tidiness
      resetColors();
    }
    setColors(effectiveColors());
  };

  const changeColor = (token: keyof ThemeTokens) => (event: ChangeEvent<HTMLInputElement>) => {
    setColor(token, event.target.value);
    setColors(effectiveColors());
  };

  const handleResetColors = () => {
    resetColors();
    setColors(effectiveColors());
  };

  const changeZoom = (event: ChangeEvent<HTMLSelectElement>) => {
    setZoomState(setZoom(parseFloat(event.target.value)));
  };

  const changeCenterEditor = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setCenterEditorState(next);
    setCenterEditor(next);
  };

  const changeTableRounded = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setTableRoundedState(next);
    setTableRounded(next);
  };

  const changeAutoHideTitle = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setAutoHideTitleState(next);
    setAutoHideTitle(next);
  };

  // Always include the current level so a value set via keyboard still shows.
  const zoomLevels = ZOOM_LEVELS.includes(zoom)
    ? ZOOM_LEVELS
    : [...ZOOM_LEVELS, zoom].sort((a, b) => a - b);

  return (
    <>
      <Section id='theme'>
        <p>Pick a preset, or choose Custom to set every color yourself.</p>
        <select className='font-select' value={theme} onChange={changePreset}>
          <option value='dark'>Dark (default)</option>
          <option value='black'>Black (AMOLED)</option>
          <option value='light'>Light</option>
          <option value='custom'>Custom</option>
        </select>

        {theme === 'custom' && (
          <div className='custom-colors'>
            <h4 className='color-group-title'>Colors</h4>
            <p>Customize individual colors. Code blocks keep their own syntax colors.</p>
            <div className='color-list'>
              {GENERAL_TOKEN_KEYS.map((key) => (
                <label key={key} className='color-row'>
                  <input type='color' value={colors[key]} onChange={changeColor(key)} />
                  <span>{TOKEN_LABELS[key]}</span>
                </label>
              ))}
            </div>

            <h4 className='color-group-title'>Table</h4>
            <p>Background and text colors for table headers, rows, and alternating rows.</p>
            <div className='color-list'>
              {TABLE_TOKEN_KEYS.map((key) => (
                <label key={key} className='color-row'>
                  <input type='color' value={colors[key]} onChange={changeColor(key)} />
                  <span>{TOKEN_LABELS[key]}</span>
                </label>
              ))}
            </div>

            <button className='btn-secondary btn-fixed' onClick={handleResetColors}>
              Reset colors
            </button>
          </div>
        )}
      </Section>

      <Section id='zoom'>
        <p>Scale the whole interface. Handy on touch devices where the keyboard zoom shortcuts aren't available.</p>
        <select className='font-select' value={zoom} onChange={changeZoom}>
          {zoomLevels.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%{z === 1 ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </Section>

      <Section id='font'>
        <p>Font used throughout the app (code blocks stay monospaced).</p>
        <select className='font-select' value={font} onChange={changeFont}>
          {FONTS.map((f) => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>
              {f.name === 'Domine' ? `${f.name} (default)` : f.name}
            </option>
          ))}
        </select>
      </Section>

      <Section id='center-editor'>
        <p>Center the editor in a fixed-width column instead of spanning the full width.</p>
        <label className='settings-checkbox'>
          <input type='checkbox' checked={centerEditor} onChange={changeCenterEditor} />
          <span>Enabled</span>
        </label>
      </Section>

      <Section id='table-corners'>
        <p>Round the corners of rendered tables in the editor.</p>
        <label className='settings-checkbox'>
          <input type='checkbox' checked={tableRounded} onChange={changeTableRounded} />
          <span>Enabled</span>
        </label>
      </Section>

      <Section id='auto-hide-title'>
        <p>Slide the note title out of view as you scroll down, and reveal it again when you scroll up.</p>
        <label className='settings-checkbox'>
          <input type='checkbox' checked={autoHideTitle} onChange={changeAutoHideTitle} />
          <span>Enabled</span>
        </label>
      </Section>
    </>
  );
}

function Misc() {
  const [vibration, setVibrationState] = useState(getVibration());

  const changeVibration = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as VibrationLevel;
    setVibrationState(next);
    setVibration(next);
    // Preview the chosen strength.
    void vibrate(getVibrationMs(next));
  };

  return (
    <Section id='vibration'>
      <p>Haptic feedback strength for actions like opening the menu.</p>
      <select className='font-select' value={vibration} onChange={changeVibration}>
        <option value='off'>Disabled</option>
        <option value='low'>Low</option>
        <option value='medium'>Medium</option>
        <option value='high'>High</option>
      </select>
    </Section>
  );
}

function Demo() {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!window.confirm('Reset the demo? This deletes all notes and settings in this browser and restores the default note.')) {
      return;
    }
    setResetting(true);
    // Loaded lazily so demo-only code stays out of the self-hosted bundle.
    const { resetDemo } = await import('../helpers/demoStore');
    await resetDemo();
    window.location.href = '/';
  };

  return (
    <Section id='reset-demo'>
      <p>Delete all notes and settings saved in this browser and restore the default note.</p>
      <button className='btn-reset btn-fixed' onClick={handleReset} disabled={resetting}>
        {resetting ? 'Resetting…' : 'Reset demo'}
      </button>
    </Section>
  );
}

interface SettingsProps {
  to: string;
}

// Categories that have at least one section available on this device/build.
const AVAILABLE_GROUPS = GROUP_ORDER.filter((g) => SECTIONS.some((s) => s.group === g && s.show));

export function Settings({ to }: SettingsProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<Group>(AVAILABLE_GROUPS[0] ?? 'General');
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // A section renders when it's available AND either matches the search (search
  // is global, across every category) or — with no search — belongs to the
  // category currently selected in the sidebar.
  const matches = useCallback(
    (id: string) => {
      const meta = SECTION_BY_ID.get(id);
      if (!meta || !meta.show) return false;
      if (q) return `${meta.title} ${meta.keywords}`.toLowerCase().includes(q);
      return meta.group === activeGroup;
    },
    [q, activeGroup],
  );

  const anyResults = SECTIONS.some((s) => matches(s.id));

  const selectGroup = (group: Group) => {
    setQuery(''); // leave search mode so the chosen category shows on its own
    setActiveGroup(group);
  };

  return (
    <div className='l-app l-settings'>
      <div className='l-header'>
        <button className='btn-header' onClick={() => navigate(to)}>
          <TintedImage src='/back.svg' alt='Back' />
        </button>
        <h2 className='header-title'>Settings</h2>
      </div>

      <div className='settings-body'>
        <aside className='settings-sidebar'>
          <input
            className='settings-search'
            type='text'
            value={query}
            placeholder='Search settings…'
            onChange={(e) => setQuery(e.target.value)}
          />
          <nav className='settings-nav file-tree'>
            {AVAILABLE_GROUPS.map((group) => (
              <div
                key={group}
                className={`file-tree-node ${!searching && group === activeGroup ? 'is-active' : ''}`}
              >
                <button className='btn-link' onClick={() => selectGroup(group)}>
                  {group}
                </button>
              </div>
            ))}
          </nav>
        </aside>

        <main className='settings-content'>
          <h2 className='settings-content-title'>{searching ? 'Search results' : activeGroup}</h2>
          {searching && !anyResults && (
            <p className='settings-no-results'>No settings match "{query}".</p>
          )}
          <SearchContext.Provider value={matches}>
            <General />
            <Appearance />
            <Misc />
            <Demo />
          </SearchContext.Provider>
        </main>
      </div>
    </div>
  );
}
