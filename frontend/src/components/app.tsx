import { useState, useEffect, useCallback, useMemo, memo, useRef, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, HashRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import '../style/app.css';
import { TintedImage } from './tintedImage';
import { ContextMenu } from './contextMenu';
import { toDirPath, nameOf, validateRename } from '../helpers/paths';
import { useNotes } from '../hooks/useNotes';
import { useLongPress } from '../hooks/useLongPress';
import { useZoom } from '../hooks/useZoom';
import { StartScreen } from './startScreen';
import { pushRecent } from '../helpers/recents';
import { applyTextScale } from '../helpers/textScale';
import { useAutoHideTitle } from '../hooks/useAutoHideTitle';
// Editor + Settings stay lazy (heavy CodeMirror deps; rarely-first views) so the
// initial bundle stays light. Each is wrapped in <Suspense> at its render site.
const Editor = lazy(() => import('./editor'));
const Settings = lazy(() => import('./settings').then((m) => ({ default: m.Settings })));
// GraphView is imported eagerly: lazy-loading it added a measurable delay when
// switching to the graph, even with prefetching.
import { GraphView } from './graphView';
import { getStartupNote, getAutoHideTitle, subscribe } from '../helpers/settings';

const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';
// True when running inside the Tauri desktop shell (currently Linux/WebKitGTK only).
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Sidebar resize bounds (px). Below the minimum, file names ellipsis-truncate
// rather than the sidebar refusing to shrink.
const MIN_SIDEBAR_WIDTH = 150;
const MAX_SIDEBAR_WIDTH = 600;

const FileList = memo(({ files, onCreate, onDelete, onRename, onNavigate }: { files: string[], onCreate: (path:string) => void, onDelete: (path:string) => void, onRename: (path:string, newTitle:string) => void, onNavigate?: () => void }) => {
  const { '*': parsedFilePath } = useParams();

  // Collapsed folders, persisted so the tree reopens the same way on reload. Only
  // collapsed dirs are stored (expanding deletes the key) to keep the map compact.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('collapsedDirs');
    return saved ? JSON.parse(saved) : {};
  });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string, value: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('collapsedDirs', JSON.stringify(collapsed));
  }, [collapsed]);

  const toggleCollapsed = useCallback((dirPath: string) => {
    setCollapsed(prev => {
      const next = { ...prev };
      if (next[dirPath]) delete next[dirPath];
      else next[dirPath] = true;
      return next;
    });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);
  const longPress = useLongPress();

  const commitRename = () => {
    if (!renaming) return;
    const newTitle = validateRename(renaming.path, renaming.value);
    if (newTitle) {
      onRename(renaming.path, newTitle);
    }
    setRenaming(null);
  };

  const parsedList = useMemo(() => {
    const parsed = files.map((fullPath) => {
      const parts = fullPath.split('/');
      return {
        dirPath: toDirPath(fullPath),
        name: parts[parts.length - 1].replace(/\.md$/, ''),
        depth: Math.max(0, parts.length - 2),
        segments: parts.slice(0, -1),
      };
    });

    const hasChildSet = new Set<string>();
    parsed.forEach(({ dirPath }) => {
      let current = dirPath;
      while (current.includes('/')) {
        current = current.substring(0, current.lastIndexOf('/'));
        hasChildSet.add(current);
      }
    });

    return parsed.sort((a, b) => {
      const minLen = Math.min(a.segments.length, b.segments.length);
      
      for (let i = 0; i < minLen; i++) {
        const segA = a.segments[i];
        const segB = b.segments[i];
        
        if (segA.toLowerCase() !== segB.toLowerCase()) {
          return segA.localeCompare(segB);
        }
      }
      return a.segments.length - b.segments.length;
    }).map(item => ({
      ...item,
      hasChildren: hasChildSet.has(item.dirPath)
    }));
  }, [files]);

  const visibleList = parsedList.filter(item => 
    !Object.keys(collapsed).some(p => collapsed[p] && item.dirPath.startsWith(p + '/'))
  );

  return (
    <div className="file-tree">
      {visibleList.map(({ dirPath, name, depth, hasChildren }) => (
        <div 
          key={dirPath} 
          style={{ paddingLeft: depth * 10 }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, path: dirPath });
          }}
          {...longPress((x, y) => setContextMenu({ x, y, path: dirPath }))}
        >
          <div className={`file-tree-node ${parsedFilePath === dirPath ? 'is-active' : ''}`}>
            {hasChildren ? (
              <button
                onClick={() => toggleCollapsed(dirPath)}
                className="btn-expand"
              >
                <span className={`icon-arrow ${collapsed[dirPath] ? 'is-collapsed' : ''}`}>
                  ❯
                </span>
              </button>
            ) : <p className="file-tree-spacer">T</p>}
            {renaming?.path === dirPath ? (
              <input
                className="file-tree-rename"
                value={renaming.value}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => setRenaming({ path: dirPath, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={commitRename}
              />
            ) : (
              <Link to={`/${dirPath}`} className="file-tree-link" onClick={onNavigate} draggable={false}>
                <button className="btn-link">{name}</button>
              </Link>
            )}
            <button onClick={() => onCreate(dirPath)} className="btn-add">+</button> 
          </div>
        </div>
      ))}
      <button onClick={() => onCreate('')} className="btn-create">+</button>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={closeMenu}
          onRename={(path) => setRenaming({ path, value: nameOf(path) })}
          onDelete={onDelete}
        />
      )}
    </div>
  );
});

FileList.displayName = 'FileList';

function MainWorkspace() {
  const navigate = useNavigate();
  const {
    files,
    loading,
    error,
    parsedFilePath,
    fileName,
    content,
    notFound,
    saveState,
    lastSavedAt,
    updateContent,
    saveCurrentFile,
    renameFile,
    moveFile,
    createFile,
    deleteFile,
  } = useNotes();

  // Auto-hiding editor title (see useAutoHideTitle for the model). The controller
  // is input-agnostic; `autoHideTitle` (the user setting) is the single switch
  // that turns it on, across phone/desktop/web alike. We mirror it into state and
  // re-read on any settings change so the toggle takes effect live.
  const lAppRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [autoHideTitle, setAutoHideTitleState] = useState(getAutoHideTitle);
  useEffect(() => subscribe(() => setAutoHideTitleState(getAutoHideTitle())), []);

  const [sideBarOpen, toggleSideBar] = useState(() => {
    // Phones get a full-screen sidebar overlay, so always start closed there
    // regardless of the saved preference.
    if (window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches) return false;
    const saved = localStorage.getItem("sideBarOpen");
    return saved ? JSON.parse(saved) : true;
  })

  const location = useLocation();
  const prevLocationRef = useRef(location);

  // On load, redirect to the configured startup note (only when landing on the
  // home screen, so deep links and in-app navigation are left alone).
  useEffect(() => {
    if (window.location.pathname !== '/') return;
    const target = getStartupNote();
    if (!target) return;
    let cancelled = false;
    (async () => {
      // In the demo the note may still need seeding before we navigate to it.
      if (isDemo) {
        const { seedIfNeeded } = await import('../helpers/demoStore');
        await seedIfNeeded();
      }
      if (!cancelled) navigate('/' + target, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount (a fresh page load); in-app nav keeps this mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask the on-screen keyboard to overlay the content rather than resize the
  // viewport. This is what exposes env(keyboard-inset-height) to CSS, which the
  // .l-app height uses to lift non-editor views (graph/settings/start) above the
  // keyboard while the editor (.editor-active) keeps full height and ignores it.
  useEffect(() => {
    const vk = (navigator as unknown as { virtualKeyboard?: { overlaysContent: boolean } }).virtualKeyboard;
    if (vk) vk.overlaysContent = true;
  }, []);

  // sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    if (!saved) return MIN_SIDEBAR_WIDTH;
    // Clamp legacy values saved before the 200px floor existed.
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parseInt(saved, 10)));
  });

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !sidebarRef.current) return;

    const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
    const rawWidth = e.clientX - sidebarLeft;
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(rawWidth, MAX_SIDEBAR_WIDTH));
    setSidebarWidth(newWidth);
  };

  const [showGraph, setShowGraph] = useState(() => localStorage.getItem('showGraph') === 'true');

  const updateShowGraph = useCallback((value: boolean) => {
    setShowGraph(value);
    localStorage.setItem('showGraph', String(value));
  }, []);

  const withViewTransition = useCallback((update: () => void) => {
    // WebKitGTK (Tauri on Linux) ships startViewTransition but crashes during the
    // transition snapshot, so skip it there. Browser/iOS WebKit keep the animation.
    if (!document.startViewTransition || isTauri) {
      update();
      return;
    }
    document.startViewTransition(() => flushSync(update));
  }, []);

  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      // Navigations normally drop out of the graph back to the note view, but a
      // delete made from the graph asks (via router state) to stay in the graph.
      if (!(location.state as { keepGraph?: boolean } | null)?.keepGraph) {
        updateShowGraph(false);
      }
    }
  }, [location, updateShowGraph]);

  // Auto-hide the editor title on scroll. The hook re-pins the title whenever the
  // route changes (resetKey), so switching views always starts revealed.
  useAutoHideTitle(mainScrollRef, lAppRef, { enabled: autoHideTitle, resetKey: location.key });

  // Remember opened notes so the Start screen can list recents.
  useEffect(() => {
    if (parsedFilePath && !notFound) pushRecent(parsedFilePath);
  }, [parsedFilePath, notFound]);

  // save shortcut
  const handleSave = useCallback(async () => {
    await saveCurrentFile();
  }, [saveCurrentFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // On phones the sidebar is a full-screen overlay, so close it after opening a
  // note to reveal the editor. No-op on larger screens (matches the CSS phone
  // breakpoint).
  const closeSidebarOnPhone = useCallback(() => {
    if (window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches) {
      toggleSideBar(false);
      localStorage.setItem('sideBarOpen', JSON.stringify(false));
    }
  }, []);

  return (
    <>
      <div
        ref={lAppRef}
        className={`l-app ${!showGraph && !notFound && parsedFilePath ? 'editor-active' : ''} ${autoHideTitle ? 'title-autohide' : ''}`}
      >
        <div className="l-header">
          <button className="btn-header" onClick={() => {toggleSideBar(!sideBarOpen); localStorage.setItem("sideBarOpen", JSON.stringify(!sideBarOpen))}}>
            <TintedImage src='/menu.svg' alt="Toggle Sidebar" />
          </button>
          <button className="btn-header" onClick={() => { closeSidebarOnPhone(); navigate("/"); }}>
            <TintedImage src='/home.svg' alt="Home" />
          </button>
          <button className="btn-header" onClick={() => navigate("/settings/general")}>
            <TintedImage src='/settings.svg' alt="Settings" />
          </button>
          <div className="spacer" />
          <button className="btn-header" onClick={() => { closeSidebarOnPhone(); withViewTransition(() => updateShowGraph(!showGraph)); }}>
            {showGraph ?
              <TintedImage src='/editor.svg' alt="editor" /> :
              <TintedImage src='/graph.svg' alt="graph" />
            }
          </button>
        </div>
        <div 
          className={`l-sidebar ${sideBarOpen ? 'is-open' : ''}`}
          ref={sidebarRef} 
          style={{ 
            width: sideBarOpen ? `${sidebarWidth}px` : '0px',
            opacity: sideBarOpen ? 1 : 0
          }}
        >
          <div className="sidebar-content">
            {loading && <p>Loading files...</p>}
            {error && (
              <div className="sidebar-notice" role="status">
                <span className="sidebar-notice-title">Backend connection error</span>
                <span className="sidebar-notice-text">{error}</span>
              </div>
            )}
            
            {!loading && !error && files.length === 0 && (
                <p>No notes found. Create a new note!</p>
            )}

            {!loading && !error && (
              <FileList files={files} onCreate={createFile} onDelete={deleteFile} onRename={renameFile} onNavigate={closeSidebarOnPhone} />
            )}
          </div>
          <div
            className="drag-handle"
            onPointerDown={(e) => {
              isDragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);

              if (sidebarRef.current) {
                sidebarRef.current.style.transition = 'none';
              }

              document.body.style.userSelect = "none";
              document.body.style.setProperty('-webkit-user-select', 'none');
            }}
            onPointerUp={(e) => {
              isDragging.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);

              if (sidebarRef.current) {
                sidebarRef.current.style.transition = '';
              }

              document.body.style.userSelect = "";
              document.body.style.removeProperty('-webkit-user-select');

              localStorage.setItem("sidebarWidth", sidebarWidth.toString());
            }}
            onPointerCancel={(e) => {
              isDragging.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);

              if (sidebarRef.current) {
                sidebarRef.current.style.transition = '';
              }

              document.body.style.userSelect = "";
              document.body.style.removeProperty('-webkit-user-select');
            }}
            onPointerMove={handlePointerMove}
          />
        </div>
        <div className="l-main" ref={mainScrollRef}>
        <Suspense fallback={null}>
        {showGraph ? (
          <GraphView
            files={files}
            onNodeClick={(path) => {
              const dirPath = toDirPath(path);
              withViewTransition(() => {
                navigate(`/${dirPath}`);
                updateShowGraph(false);
              });
            }}
            onNodeRename={renameFile}
            onNodeMove={moveFile}
            onNodeCreate={(path, position) => createFile(path, undefined, { keepView: true, position })}
            onNodeDelete={(path) => deleteFile(path, { keepView: true })}
          />
        ) : notFound ? (
          <div className="not-found">
            <h2>Note not found</h2>
            <p>"/{parsedFilePath}" doesn't exist or may have been deleted.</p>
            <Link to="/">Go back</Link>
          </div>
        ) : !parsedFilePath ? (
          <StartScreen
            files={files}
            onCreate={() => createFile('')}
            onOpenNote={(dirPath) => navigate(`/${dirPath}`)}
            onOpenGraph={() => withViewTransition(() => updateShowGraph(true))}
            onOpenSettings={() => navigate('/settings/general')}
          />
        ) : (
          <Editor
            rawContent={content}
            onChange={updateContent}
            title={fileName ? fileName : "Select or create a file"}
            onTitleChange={(newTitle) => renameFile(parsedFilePath, newTitle)}
            createFile={(filename) => createFile(parsedFilePath ?? '', filename)}
            saveState={saveState}
            lastSavedAt={lastSavedAt}
          />
        )}
        </Suspense>
      </div>
      </div>
    </>
  );
}

export default function App() {
  useZoom();

  // Measure the webview's text-inflation factor into --text-scale so the header
  // buttons can match the (Android-inflated) text size. Re-measure on resize /
  // orientation change, since font auto-sizing is width-dependent.
  useEffect(() => {
    applyTextScale();
    window.addEventListener('resize', applyTextScale);
    return () => window.removeEventListener('resize', applyTextScale);
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/settings/*" element={<Settings to={'/'} />} />
          <Route path="/*" element={<MainWorkspace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}