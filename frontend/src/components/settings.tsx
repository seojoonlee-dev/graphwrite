import { useNavigate } from 'react-router-dom';
import { TintedImage } from './tintedImage';
import { Link, useParams } from 'react-router-dom';
import { useState, type ChangeEvent } from 'react';
import {
  FONTS,
  TOKEN_LABELS,
  type ThemeName,
  type ThemeTokens,
  effectiveColors,
  getFont,
  getStartupNote,
  getTheme,
  resetColors,
  saveSettings,
  setColor,
  setFont,
  setStartupNote,
  setTheme,
} from '../helpers/settings';
import { getZoom, isTauri, setZoom } from '../helpers/zoom';
import { clearRecents } from '../helpers/recents';
import '../style/settings.css';

// The demo stores notes in the browser (IndexedDB) and has no backend, so the
// server address setting is irrelevant there.
const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

function General() {
  const serverIp = localStorage.getItem('serverIp') ? localStorage.getItem('serverIp') : "http://localhost:3001";
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
      <div className='settings-view'>
        <h3>Startup note</h3>
        <p>Note to open automatically when the app loads. Leave empty to start on the home screen.</p>
        <div className='startup-input'>
          <span className='startup-slash'>/</span>
          <input
            type='text'
            name='startup'
            value={startup}
            placeholder='(leave blank to start in start screen)'
            onChange={(e) => setStartup(e.target.value.replace(/^\/+/, ''))}
            onBlur={changeStartup}
          />
        </div>
      </div>
      <div className='settings-view'>
        <h3>Note history</h3>
        <p>Resets the "Recent notes" list shown on the start screen.</p>
        <button className='btn-secondary' onClick={handleClearHistory} disabled={historyCleared}>
          {historyCleared ? 'Cleared' : 'Clear note history'}
        </button>
      </div>
      <div className='settings-view'>
        <h3>Server</h3>
          {
            !isDemo ? (
              <>
                <p>Enter server IP address and port (example: http://192.168.0.1:3001): </p>
                <input type='text' name='server' defaultValue={serverIp!} onChange={saveServer} onBlur={changeServer}></input>
              </>
            ) : (
              <p>This is a demo. Your notes are saved locally in this browser.</p>
            )
          }
      </div>
    </>
  )
}

const TOKEN_KEYS = Object.keys(TOKEN_LABELS) as (keyof ThemeTokens)[];

// Zoom presets offered in the dropdown (mirrors a browser's zoom menu).
const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function Appearance() {
  const [font, setFontState] = useState(getFont());
  const [theme, setThemeState] = useState<ThemeName>(getTheme());
  const [colors, setColors] = useState<ThemeTokens>(effectiveColors());
  const [zoom, setZoomState] = useState(getZoom());

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

  // Always include the current level so a value set via keyboard still shows.
  const zoomLevels = ZOOM_LEVELS.includes(zoom)
    ? ZOOM_LEVELS
    : [...ZOOM_LEVELS, zoom].sort((a, b) => a - b);

  return (
    <>
      <div className='settings-view'>
        <h3>Theme</h3>
        <p>Pick a preset, or choose Custom to set every color yourself.</p>
        <select className='font-select' value={theme} onChange={changePreset}>
          <option value='dark'>Dark (default)</option>
          <option value='black'>Black (AMOLED)</option>
          <option value='light'>Light</option>
          <option value='custom'>Custom</option>
        </select>
      </div>

      {theme === 'custom' && (
        <div className='settings-view'>
          <h3>Colors</h3>
          <p>Customize individual colors. Code blocks keep their own syntax colors.</p>
          <div className='color-list'>
            {TOKEN_KEYS.map((key) => (
              <label key={key} className='color-row'>
                <input type='color' value={colors[key]} onChange={changeColor(key)} />
                <span>{TOKEN_LABELS[key]}</span>
              </label>
            ))}
          </div>
          <button className='btn-secondary' onClick={handleResetColors}>
            Reset colors
          </button>
        </div>
      )}

      {isTauri() && (
        <div className='settings-view'>
          <h3>Screen zoom</h3>
          <p>Scale the whole interface. Handy on touch devices where the keyboard zoom shortcuts aren't available.</p>
          <select className='font-select' value={zoom} onChange={changeZoom}>
            {zoomLevels.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%{z === 1 ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className='settings-view'>
        <h3>Font</h3>
        <p>Font used throughout the app (code blocks stay monospaced).</p>
        <select className='font-select' value={font} onChange={changeFont}>
          {FONTS.map((f) => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>
              {f.name === "Domine" ? `${f.name} (default)` : f.name}
            </option>
          ))}
        </select>
      </div>
    </>
  )
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
    <div className='settings-view'>
      <h3>Reset demo</h3>
      <p>Delete all notes and settings saved in this browser and restore the default note.</p>
      <button className='btn-reset' onClick={handleReset} disabled={resetting}>
        {resetting ? 'Resetting…' : 'Reset demo'}
      </button>
    </div>
  );
}


interface SettingsProps {
  to:string;
}


export function Settings({to}: SettingsProps) {
  const { '*': setting } = useParams();
  const navigate = useNavigate();

  function capitalizeFirstLetter(text?: string): string {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  return (
    <>
      <div className="l-app l-settings">
        <div className="l-header">
          <button className="btn-header" onClick={() => {navigate(to); console.log(to);}}>
            <TintedImage src='/back.svg' alt="Toggle Sidebar" />
          </button>
          <h2 className='header-title'>Settings</h2>
        </div>
      <div>
      <div className='settings-tabbar'>
          <Link to={`/settings/general`} className={`settings-link ${setting === "general" ? 'is-active': ''}`}>
            <button className="btn-tabbar">General</button>
          </Link>
          <Link to={`/settings/appearance`} className={`settings-link ${setting === "appearance" ? 'is-active': ''}`}>
            <button className="btn-tabbar">Appearance</button>
          </Link>
          {isDemo && (
            <Link to={`/settings/demo`} className={`settings-link ${setting === "demo" ? 'is-active': ''}`}>
              <button className="btn-tabbar">Demo</button>
            </Link>
          )}
        </div>
      </div>
        <div className='settings-main'>
          <h1 className='settings-title'>{capitalizeFirstLetter(setting)}</h1>
          {setting === "general" ? <General /> : setting === "demo" && isDemo ? <Demo /> : <Appearance />}
        </div>
      </div>
    </>
  );
}