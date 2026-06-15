import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nameOf } from '../helpers/paths';
import { getVibrationMs } from '../helpers/settings';
import { vibrate } from '../helpers/haptics';

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function ContextMenu({ x, y, path, onClose, onRename, onDelete }: ContextMenuProps) {
  // On phones the menu is a bottom sheet over a dark scrim (positioned by CSS);
  // elsewhere it's a popup at the cursor.
  const isMobile = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches;

  // Play an exit animation (mobile) before actually unmounting.
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    if (!isMobile) { onClose(); return; }
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 190);
  }, [isMobile, onClose]);

  // Short haptic tick when the sheet appears on mobile (length per the setting).
  useEffect(() => {
    if (isMobile) void vibrate(getVibrationMs());
    // Fires once when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKeyDown);
    // Desktop closes on any outside click; mobile closes via the scrim (so a tap
    // on the sheet itself doesn't dismiss it).
    if (!isMobile) window.addEventListener('click', close);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!isMobile) window.removeEventListener('click', close);
    };
  }, [close, isMobile]);

  const cls = (base: string) => `${base}${closing ? ' is-closing' : ''}`;

  // Portaled to <body> so the scrim/sheet sit above everything (the sidebar's
  // stacking context would otherwise trap them below the header on mobile).
  return createPortal(
    <>
      <div className={cls('context-menu-backdrop')} onClick={close} />
      <div
        className={cls('context-menu')}
        style={isMobile ? undefined : { top: y, left: x }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="context-menu-header">
          <span className="context-menu-name">{nameOf(path)}</span>
          <span className="context-menu-path">/{path}</span>
        </div>
        <button
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onRename(path);
            close();
          }}
        >
          Rename File
        </button>
        <button
          className="context-menu-item is-danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(path);
            close();
          }}
        >
          Delete File
        </button>
      </div>
    </>,
    document.body,
  );
}
