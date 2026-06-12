const invalidChars = /[\\/:*?"<>|]/;

export function toFilePath(dirPath?: string): string {
  if (!dirPath) return '';
  return `${dirPath}/${nameOf(dirPath)}.md`;
}

export function toDirPath(filePath: string): string {
  return filePath.substring(0, filePath.lastIndexOf('/'));
}

export function nameOf(path: string): string {
  return path.split('/').pop() || '';
}

export function validateRename(path: string, newTitle: string): string | null {
  const trimmed = newTitle.trim();
  if (!trimmed || trimmed === nameOf(path) || invalidChars.test(trimmed)) {
    return null;
  }
  return trimmed;
}
