// Single source of truth for user settings, stored as one JSON object in
// localStorage. Stored values are merged over DEFAULTS so new settings added
// later just fall back to their default without breaking saved data.
//
// Theming works through CSS custom properties (see :root in app.css). A theme is
// a preset (dark/light) plus optional per-token overrides; applySettings() pushes
// the effective values onto :root. Syntax-highlight colors and code-block
// surfaces are intentionally NOT themed here — they stay dark in every theme.
import '@fontsource/domine/latin-400.css';
import '@fontsource/domine/latin-700.css';

export interface FontOption {
  name: string;
  stack: string;
}

export const FONTS: FontOption[] = [
  { name: 'Times New Roman', stack: `'Times New Roman', Times, serif` },
  { name: 'Georgia', stack: `Georgia, 'Times New Roman', serif` },
  { name: 'Domine', stack: `'Domine', Georgia, serif` },
  { name: 'System Sans', stack: `system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif` },
  { name: 'Arial', stack: `Arial, Helvetica, sans-serif` },
];

export type PresetName = 'dark' | 'light' | 'black';
export type ThemeName = PresetName | 'custom';

export interface ThemeTokens {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textMuted: string;
  border: string;
  scrollbar: string;
  accent: string;
  danger: string;
  icon: string;
  codeBg: string;
  // Live-preview tables: a background + matching text color for the header row,
  // normal rows, and the alternating (striped) rows.
  tableHeaderBg: string;
  tableHeaderText: string;
  tableRowBg: string;
  tableRowText: string;
  tableAltBg: string;
  tableAltText: string;
}

export const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  bg: 'Editor background',
  bgSecondary: 'Secondary background',
  bgTertiary: 'Text slection highlight color',
  text: 'Text',
  textMuted: 'Muted text',
  border: 'Border',
  scrollbar: 'Scrollbar',
  accent: 'Accent',
  danger: 'Danger',
  icon: 'Icons',
  codeBg: 'Code block',
  tableHeaderBg: 'Header background',
  tableHeaderText: 'Header text',
  tableRowBg: 'Row background',
  tableRowText: 'Row text',
  tableAltBg: 'Alternate row background',
  tableAltText: 'Alternate row text',
};

// Color tokens that belong to the "Table" group in the custom-color editor;
// the rest render in the general color list.
export const TABLE_TOKEN_KEYS: (keyof ThemeTokens)[] = [
  'tableHeaderBg',
  'tableHeaderText',
  'tableRowBg',
  'tableRowText',
  'tableAltBg',
  'tableAltText',
];

export const PRESETS: Record<PresetName, ThemeTokens> = {
  dark: {
    bg: '#282828',
    bgSecondary: '#1e1e1e',
    bgTertiary: '#5E5C64',
    text: '#FFF0E3',
    textMuted: '#9a928c',
    border: '#3a3a3a',
    scrollbar: '#696969',
    accent: '#e0a96d',
    danger: '#6e2626',
    icon: '#FFF0E3',
    codeBg: '#1e1e1e',
    tableHeaderBg: '#322f2c',
    tableHeaderText: '#FFF0E3',
    tableRowBg: '#282828',
    tableRowText: '#FFF0E3',
    tableAltBg: '#2e2c2a',
    tableAltText: '#FFF0E3',
  },
  light: {
    bg: '#ffffff',
    bgSecondary: '#F7F6F3',
    bgTertiary: '#e9e4dc',
    text: '#2b2824',
    textMuted: '#6e675f',
    border: '#ddd6cc',
    scrollbar: '#c0c0c0',
    accent: '#e0a96d',
    danger: '#b23b3b',
    icon: '#2b2824',
    codeBg: '#F7F6F3',
    tableHeaderBg: '#efece6',
    tableHeaderText: '#2b2824',
    tableRowBg: '#ffffff',
    tableRowText: '#2b2824',
    tableAltBg: '#f7f6f3',
    tableAltText: '#2b2824',
  },
  black: {
    bg: '#000000',
    bgSecondary: '#000000',
    bgTertiary: '#313133',
    text: '#FFFFFF',
    textMuted: '#9a928c',
    border: '#3a3a3a',
    scrollbar: '#1b1b1b',
    accent: '#e0a96d',
    danger: '#6e2626',
    icon: '#FFF0E3',
    codeBg: '#171717',
    tableHeaderBg: '#161616',
    tableHeaderText: '#FFFFFF',
    tableRowBg: '#000000',
    tableRowText: '#FFFFFF',
    tableAltBg: '#0d0d0d',
    tableAltText: '#FFFFFF',
  },
};

export type VibrationLevel = 'off' | 'low' | 'medium' | 'high';

export interface Settings {
  font: string;
  startupNote: string;
  theme: ThemeName;
  colors: Partial<ThemeTokens>;
  centerEditor: boolean;
  tableRounded: boolean;
  vibration: VibrationLevel;
}

const KEY = 'graphwrite-settings';

const DEFAULTS: Settings = {
  font: 'Domine',
  // Empty = land on the Start screen (the demo used to auto-open the sample note).
  startupNote: '',
  theme: 'dark',
  colors: {},
  // Default to the original full-width editor layout.
  centerEditor: false,
  tableRounded: true,
  vibration: 'medium',
};

export const loadSettings = (): Settings => {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    stored = {};
  }
  return { ...DEFAULTS, ...stored, colors: { ...(stored.colors ?? {}) } };
};

type Listener = () => void;
const listeners = new Set<Listener>();
// Notified after any settings change so non-React consumers (the CodeMirror
// editor) can react — e.g. re-pick code highlighting when the theme changes.
export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const saveSettings = (patch: Partial<Settings>): Settings => {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  applySettings(next);
  listeners.forEach((listener) => listener());
  return next;
};

export const effectiveColors = (s: Settings = loadSettings()): ThemeTokens => {
  // Presets are fixed; 'custom' is the user's own palette (defaulting to dark
  // for any token they haven't set).
  if (s.theme === 'custom') return { ...PRESETS.dark, ...s.colors };
  return PRESETS[s.theme];
};

const fontStack = (name: string): string =>
  (FONTS.find((f) => f.name === name) ?? FONTS.find((f) => f.name === DEFAULTS.font)!).stack;

const cssVar = (token: string): string => '--' + token.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export const applySettings = (s: Settings = loadSettings()): void => {
  const root = document.documentElement.style;
  root.setProperty('--app-font', fontStack(s.font));
  const colors = effectiveColors(s);
  (Object.keys(colors) as (keyof ThemeTokens)[]).forEach((token) => {
    root.setProperty(cssVar(token), colors[token]);
  });
  // Drives the optional centered editor layout (see editor.css).
  document.documentElement.classList.toggle('center-editor', s.centerEditor);
  // Optional rounded corners on rendered tables (see editor.css).
  document.documentElement.classList.toggle('table-rounded', s.tableRounded);
};

// Convenience accessors for the settings UI.
export const getFont = () => loadSettings().font;
export const setFont = (name: string) => saveSettings({ font: name });

export const getStartupNote = () => loadSettings().startupNote;
export const setStartupNote = (value: string) =>
  saveSettings({ startupNote: value.trim().replace(/^\/+/, '') });

export const getTheme = () => loadSettings().theme;
export const setTheme = (theme: ThemeName) => saveSettings({ theme });

export const getCenterEditor = () => loadSettings().centerEditor;
export const setCenterEditor = (value: boolean) => saveSettings({ centerEditor: value });

export const getTableRounded = () => loadSettings().tableRounded;
export const setTableRounded = (value: boolean) => saveSettings({ tableRounded: value });

// Vibration length (ms) per intensity level; 'off' disables it.
const VIBRATION_MS: Record<VibrationLevel, number> = { off: 0, low: 10, medium: 25, high: 50 };
export const getVibration = () => loadSettings().vibration;
export const setVibration = (value: VibrationLevel) => saveSettings({ vibration: value });
export const getVibrationMs = (level: VibrationLevel = loadSettings().vibration) =>
  VIBRATION_MS[level] ?? 0;

export const setColor = (token: keyof ThemeTokens, value: string) =>
  saveSettings({ colors: { ...loadSettings().colors, [token]: value } });

export const resetColors = () => saveSettings({ colors: {} });
