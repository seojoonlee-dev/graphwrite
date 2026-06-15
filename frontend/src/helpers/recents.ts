// Tracks recently opened notes (by dirPath, e.g. "Note/tasks") so the Start
// screen can offer quick links back into them. Stored in localStorage,
// most-recent first, capped to keep the list tidy.
const KEY = 'recentNotes';
const MAX = 8;

export function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecent(dirPath: string) {
  if (!dirPath) return;
  const next = [dirPath, ...getRecents().filter((p) => p !== dirPath)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}
