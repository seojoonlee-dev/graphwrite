import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchFilesList, loadFile, saveFile, saveFileOnUnload, renameFile, createFile, deleteFile } from '../helpers/api';
import { toFilePath, nameOf } from '../helpers/paths';
import { migrateSavedPositions } from '../helpers/graphStorage';

export function useNotes() {
  const { '*': parsedFilePath } = useParams();
  const navigate = useNavigate();
  const filePath = toFilePath(parsedFilePath);

  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const cacheRef = useRef<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ filePath: string; content: string } | null>(null);

  // fetch
  const fetchFiles = useCallback(async () => {
    try {
      const data = await fetchFilesList();
      if (data.success) {
        setFiles(data.files);
      } else {
         setError('Failed to load files from server.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // load
  useEffect(() => {
    const handleLoadFile = async () => {
      setNotFound(false);
      if (!filePath) {
        setContent('');
        setFileName('');
        return;
      }
      setFileName(parsedFilePath ? nameOf(parsedFilePath) : '');

      if (cacheRef.current[filePath] !== undefined) {
        setContent(cacheRef.current[filePath]);
      } else {
        setContent('');
      }

      try {
        const data = await loadFile(filePath);
        if (data.success) {
          if (cacheRef.current[filePath] !== data.content) {
            setContent(data.content);
            cacheRef.current[filePath] = data.content;
          }
        } else if (data.notFound) {
          delete cacheRef.current[filePath];
          setContent('');
          setNotFound(true);
        }
      } catch (error) {
        console.error('Load failed:', error);
      }
    };

    handleLoadFile();
  }, [filePath, parsedFilePath]);

  // autosave
  const flushPendingSave = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) {
      await saveFile(pending.filePath, pending.content);
      cacheRef.current[pending.filePath] = pending.content;
    }
  }, []);

  const discardPendingSave = useCallback((dirPath: string) => {
    const pending = pendingSaveRef.current;
    if (pending && (pending.filePath === toFilePath(dirPath) || pending.filePath.startsWith(dirPath + '/'))) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      pendingSaveRef.current = null;
    }
  }, []);

  const debouncedSave = useCallback((newContent: string) => {
    if (!filePath) return;
    pendingSaveRef.current = { filePath, content: newContent };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushPendingSave().catch(err => console.error('Autosave failed:', err));
    }, 700);
  }, [filePath, flushPendingSave]);

  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    debouncedSave(newContent);
  }, [debouncedSave]);

  // save; returns whether the save happened so the caller can show feedback
  const saveCurrentFile = useCallback(async (): Promise<boolean> => {
    if (!filePath) return false;

    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingSaveRef.current = null;
      await saveFile(filePath, content);
      cacheRef.current[filePath] = content;
      return true;
    } catch (error) {
      alert("Couldn't save: " + error);
      return false;
    }
  }, [filePath, content]);

  // rename
  const handleRenameFile = useCallback(async (dirPath: string | undefined, newTitle: string): Promise<boolean> => {
    if (!dirPath || !newTitle.trim()) return false;
    const targetFilePath = toFilePath(dirPath);

    try {
      await flushPendingSave();
      const data = await renameFile(targetFilePath, newTitle);

      if (data.success) {
        Object.keys(cacheRef.current).forEach((key) => {
          if (key === targetFilePath || key.startsWith(dirPath + '/')) {
            delete cacheRef.current[key];
          }
        });
        if (targetFilePath === filePath) {
          cacheRef.current[toFilePath(data.filePath)] = content;
        }
        migrateSavedPositions(dirPath, data.filePath);
        await fetchFiles();
        if (parsedFilePath === dirPath) {
          navigate(`/${data.filePath}`);
        } else if (parsedFilePath && parsedFilePath.startsWith(dirPath + '/')) {
          navigate(`/${data.filePath}${parsedFilePath.slice(dirPath.length)}`);
        }
        return true;
      }
      return false;
    } catch (error) {
      alert("Couldn't rename: " + (error instanceof Error ? error.message : error));
      return false;
    }
  }, [filePath, content, parsedFilePath, navigate, fetchFiles, flushPendingSave]);

  // create
  const handleCreateFile = useCallback(async (path:string, filename?:string) => {
    try {
      const data = await createFile(path, filename);

      if (data.success) {
        cacheRef.current[data.filePath] = '';
        await fetchFiles();
        navigate(`/${data.filePath}`);
      } else if (data.filePath) {
        navigate(`/${data.filePath}`);
      }
    } catch (error) {
      console.error('Create failed:', error);
    }
  }, [navigate, fetchFiles]);

  // delete
  const handleDeleteFile = useCallback(async (pathToDelete: string) => {
    if (!pathToDelete) return;

    const targetFilePath = toFilePath(pathToDelete);
    const targetFileName = nameOf(pathToDelete) || pathToDelete;

    const confirmDelete = window.confirm(`Are you sure you want to delete "${targetFileName}"?`);
    if (!confirmDelete) return;

    try {
      discardPendingSave(pathToDelete);
      await deleteFile(targetFilePath);
      delete cacheRef.current[targetFilePath];
      await fetchFiles();

      if (targetFilePath === filePath) {
        setContent('');
        navigate('/');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert("Couldn't delete: " + error);
    }
  }, [filePath, navigate, fetchFiles, discardPendingSave]);

  // flush unsaved changes when the tab closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      saveFileOnUnload(pending.filePath, pending.content);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, []);

  return {
    files,
    loading,
    error,
    parsedFilePath,
    fileName,
    content,
    notFound,
    updateContent,
    saveCurrentFile,
    renameFile: handleRenameFile,
    createFile: handleCreateFile,
    deleteFile: handleDeleteFile,
  };
}
