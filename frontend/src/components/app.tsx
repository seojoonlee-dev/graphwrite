import { useState, useEffect, useCallback, useMemo, memo, useRef, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom';
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
// Editor + Settings stay lazy (heavy CodeMirror deps; rarely-first views) so the
// initial bundle stays light. Each is wrapped in <Suspense> at its render site.
const Editor = lazy(() => import('./editor'));
const Settings = lazy(() => import('./settings').then((m) => ({ default: m.Settings })));
// GraphView is imported eagerly: lazy-loading it added a measurable delay when
// switching to the graph, even with prefetching.
import { GraphView } from './graphView';
import { getStartupNote } from '../helpers/settings';

const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';
// True when running inside the Tauri desktop shell (currently Linux/WebKitGTK only).
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const FileList = memo(({ files, onCreate, onDelete, onRename, onNavigate }: { files: string[], onCreate: (path:string) => void, onDelete: (path:string) => void, onRename: (path:string, newTitle:string) => void, onNavigate?: () => void }) => {
  const { '*': parsedFilePath } = useParams();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string, value: string } | null>(null);
  
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
                onClick={() => setCollapsed(prev => ({ ...prev, [dirPath]: !prev[dirPath] }))}
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
    updateContent,
    saveCurrentFile,
    renameFile,
    createFile,
    deleteFile,
  } = useNotes();

  const [popupOpen, setPopupOpen] = useState(false);
  // Auto-hiding editor title (phones): collapses on scroll-down, returns on
  // scroll-up — like a mobile browser's URL bar.
  const [titleHidden, setTitleHidden] = useState(false);
  const titleHiddenRef = useRef(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  // Only react to scrolls from a user gesture (a real drag, plus the momentum
  // window after release). This ignores programmatic scrolls — the keyboard's
  // viewport resize, cursor moves on tap, and the title's own reflow.
  const draggingRef = useRef(false);
  const touchStartY = useRef(0);
  const momentumUntil = useRef(0);
  // After a toggle the title's collapse/expand reflows the editor and fires more
  // scroll events; ignore them until this timestamp so they can't bounce it back.
  const scrollLockUntil = useRef(0);
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

  // sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 200;
  }); 

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  // Lower bound for the drag, so the sidebar can't shrink below its content.
  const minSidebarWidth = useRef(150);

  // Measures the content's natural width by briefly sizing it to max-content.
  // scrollWidth alone can't tell us this — it only exceeds the box once already
  // overflowing, so it can't reveal headroom while the content still fits.
  const measureMinWidth = () => {
    const content = sidebarRef.current?.querySelector('.sidebar-content') as HTMLElement | null;
    if (!content) return;
    const prev = content.style.width;
    content.style.width = 'max-content';
    minSidebarWidth.current = Math.max(150, content.offsetWidth);
    content.style.width = prev;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !sidebarRef.current) return;

    const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
    const rawWidth = e.clientX - sidebarLeft;
    const newWidth = Math.max(minSidebarWidth.current, Math.min(rawWidth, 800));
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
      updateShowGraph(false);
      // Reveal the title again when switching views.
      setTitleHidden(false);
      titleHiddenRef.current = false;
      lastScrollTop.current = 0;
      scrollLockUntil.current = 0;
    }
  }, [location, updateShowGraph]);

  // Auto-hide the editor title on scroll-down / reveal on scroll-up, but only in
  // response to a real finger drag — so programmatic scrolls (the keyboard's
  // viewport resize, cursor moves on tap, the title's own reflow) are ignored.
  // Listens in the capture phase to catch the (descendant) editor scroller, which
  // doesn't bubble scroll events. CSS gates the visual effect to phones.
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const apply = (hidden: boolean) => {
      if (titleHiddenRef.current === hidden) return;
      titleHiddenRef.current = hidden;
      setTitleHidden(hidden);
      // Ignore the scroll events caused by the resulting reflow.
      scrollLockUntil.current = performance.now() + 350;
    };
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.scrollTop !== 'number') return;
      const max = target.scrollHeight - target.clientHeight;
      // Clamp out overscroll/bounce so it can't flip the direction at the edges.
      const top = Math.max(0, Math.min(target.scrollTop, max));
      // Honor scrolls only from a user gesture (active drag or its momentum), and
      // skip the title's own reflow.
      const userScrolling = draggingRef.current || performance.now() < momentumUntil.current;
      if (!userScrolling || performance.now() < scrollLockUntil.current) {
        lastScrollTop.current = top;
        return;
      }
      const last = lastScrollTop.current;
      if (top <= 8) apply(false);                 // at top → show
      else if (top >= max - 8) apply(true);       // at bottom → stay hidden
      else if (top > last + 6) apply(true);       // scrolling down
      else if (top < last - 6) apply(false);      // scrolling up
      lastScrollTop.current = top;
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? 0;
      draggingRef.current = false; // not a drag until the finger actually moves
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (Math.abs(y - touchStartY.current) > 10) draggingRef.current = true;
    };
    const onTouchEnd = () => {
      // Keep honoring scroll events through the post-release momentum (flicks do
      // most of their scrolling there).
      if (draggingRef.current) momentumUntil.current = performance.now() + 600;
      draggingRef.current = false;
    };

    const opts = { capture: true, passive: true } as const;
    el.addEventListener('scroll', onScroll, opts);
    window.addEventListener('touchstart', onTouchStart, opts);
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onTouchEnd, opts);
    window.addEventListener('touchcancel', onTouchEnd, opts);
    return () => {
      el.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, []);

  // Remember opened notes so the Start screen can list recents.
  useEffect(() => {
    if (parsedFilePath && !notFound) pushRecent(parsedFilePath);
  }, [parsedFilePath, notFound]);

  // popup
  useEffect(() => {
    if (popupOpen) {
      const timer = setTimeout(() => setPopupOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [popupOpen]);

  // save shortcut
  const handleSave = useCallback(async () => {
    if (await saveCurrentFile()) {
      setPopupOpen(true);
    }
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
      <div className={`l-app ${titleHidden ? 'title-hidden' : ''}`}>
        <div className="l-header">
          <button className="btn-header" onClick={() => {toggleSideBar(!sideBarOpen); localStorage.setItem("sideBarOpen", JSON.stringify(!sideBarOpen))}}>
            <TintedImage src='/menu.svg' alt="Toggle Sidebar" />
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
            {error && <p className="sidebar-error">{error}</p>}
            
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
              measureMinWidth();
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
            onNodeDelete={deleteFile}
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
          />
        )}
        </Suspense>
      </div>
      </div>
      <div className={`popup ${popupOpen ? 'is-open' : ''}`}>
        <div className="popup-content">
          <p>Saved!</p>
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
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/settings/*" element={<Settings to={'/'} />} />
          <Route path="/*" element={<MainWorkspace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}