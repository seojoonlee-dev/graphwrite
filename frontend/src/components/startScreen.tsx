import { useState } from 'react';
import { TintedImage } from './tintedImage';
import { nameOf, toDirPath } from '../helpers/paths';
import { clearRecents, getRecents } from '../helpers/recents';
import '../style/startScreen.css';

interface StartScreenProps {
  files: string[];
  onCreate: () => void;
  onOpenNote: (dirPath: string) => void;
  onOpenGraph: () => void;
  onOpenSettings: () => void;
}

// Shown at "/" when no note is selected, in place of the editor. Gives the
// landing screen some purpose: a primary "new note" action, shortcuts, and a
// list of recently opened notes.
export function StartScreen({ files, onCreate, onOpenNote, onOpenGraph, onOpenSettings }: StartScreenProps) {
  // Recomputed each render so the list reflects `files` once it loads (it's
  // empty on the first render while notes are still being fetched). Keep only
  // recents that still exist (notes may have been renamed/deleted).
  const [cleared, setCleared] = useState(false);
  const validDirs = new Set(files.map(toDirPath));
  const recents = cleared ? [] : getRecents().filter((p) => validDirs.has(p)).slice(0, 6);

  const handleClearRecents = () => {
    clearRecents();
    setCleared(true);
  };

  return (
    <div className="start-screen">
      <div className="start-inner">
        <header className="start-header">
          <h1 className="start-title">GraphWrite</h1>
          <p className="start-subtitle">Pick up where you left off, or create something new.</p>
        </header>

        <div className="start-actions">
          <button className="start-action start-action-primary" onClick={onCreate}>
            <span className="start-action-icon" aria-hidden="true">+</span>
            <span className="start-action-text">
              <strong>New note</strong>
              <small>Create a blank note</small>
            </span>
          </button>
          <button className="start-action" onClick={onOpenGraph}>
            <span className="start-action-icon">
              <TintedImage src="/graph.svg" alt="" />
            </span>
            <span className="start-action-text">
              <strong>Graph view</strong>
              <small>See how notes connect</small>
            </span>
          </button>
          <button className="start-action" onClick={onOpenSettings}>
            <span className="start-action-icon">
              <TintedImage src="/settings.svg" alt="" />
            </span>
            <span className="start-action-text">
              <strong>Settings</strong>
              <small>Theme, font, zoom, etc.</small>
            </span>
          </button>
        </div>

        <section className="start-recents">
          <div className="start-section-header">
            <h2 className="start-section-title">Recent notes</h2>
            {recents.length > 0 && (
              <button
                className="start-clear-recents"
                onClick={handleClearRecents}
                title="Clear note history"
                aria-label="Clear note history"
              >
                <TintedImage src="/reset.svg" alt="" />
              </button>
            )}
          </div>
          {recents.length > 0 ? (
            <ul className="start-recent-list">
              {recents.map((dirPath) => (
                <li key={dirPath}>
                  <button className="start-recent" onClick={() => onOpenNote(dirPath)}>
                    <span className="start-recent-name">{nameOf(dirPath)}</span>
                    <span className="start-recent-path">/{dirPath}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="start-empty">No notes opened yet. Create your first note to get started.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default StartScreen;
