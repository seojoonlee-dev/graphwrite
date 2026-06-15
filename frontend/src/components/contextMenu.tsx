import { useEffect } from 'react';
import { getCssZoomScale } from '../helpers/zoom';

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function ContextMenu({ x, y, path, onClose, onRename, onDelete }: ContextMenuProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('click', onClose);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', onClose);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // The menu is fixed inside .l-app, which is scaled by a CSS transform on
  // touch devices. Its coordinates live in the pre-scale space, so divide the
  // viewport click position by the scale to land it under the cursor/finger.
  const scale = getCssZoomScale();

  return (
    <div className="context-menu" style={{ top: y / scale, left: x / scale }}>
      <button
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          onRename(path);
          onClose();
        }}
      >
        Rename File
      </button>
      <button
        className="context-menu-item is-danger"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(path);
          onClose();
        }}
      >
        Delete File
      </button>
    </div>
  );
}
