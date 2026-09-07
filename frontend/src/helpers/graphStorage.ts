import { type Viewport } from '@xyflow/react';

const VIEWPORT_KEY = 'graphViewport';
const SEARCH_KEY = 'graphSearch';

export function loadSavedSearch(): string {
  try {
    return localStorage.getItem(SEARCH_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveSearch(search: string) {
  localStorage.setItem(SEARCH_KEY, search);
}

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

