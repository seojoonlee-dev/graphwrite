import { type Viewport } from '@xyflow/react';

const POSITIONS_KEY = 'graphNodePositions';
const VIEWPORT_KEY = 'graphViewport';

export type NodePositions = Record<string, { x: number; y: number }>;

export function loadSavedViewport(): Viewport | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveViewport(viewport: Viewport) {
  localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
}

export function loadSavedPositions(): NodePositions {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePositions(positions: NodePositions) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

export function clearPositions() {
  localStorage.removeItem(POSITIONS_KEY);
}

export function migrateSavedPositions(oldDirPath: string, newDirPath: string) {
  const saved = loadSavedPositions();
  const migrated: NodePositions = {};
  let changed = false;

  Object.entries(saved).forEach(([id, position]) => {
    if (id === oldDirPath) {
      migrated[newDirPath] = position;
      changed = true;
    } else if (id.startsWith(oldDirPath + '/')) {
      migrated[newDirPath + id.slice(oldDirPath.length)] = position;
      changed = true;
    } else {
      migrated[id] = position;
    }
  });

  if (changed) {
    savePositions(migrated);
  }
}
