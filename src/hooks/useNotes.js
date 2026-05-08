/**
 * Core notes management hook.
 * Handles CRUD operations, conflict resolution, and caching.
 *
 * @module useNotes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveNote,
  getNote,
  getAllNotes,
  deleteNote,
  resolveConflict,
  saveFolder,
  getAllFolders,
  deleteFolder,
  saveTag,
  getAllTags,
  getStorageStats,
  clearAllData
} from '../utils/storage';

/**
 * Generate a unique ID.
 * @returns {string}
 */
function generateId() {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [stats, setStats] = useState(null);

  // Track pending operations for sync indicator
  const [pendingSync, setPendingSync] = useState(0);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const [notesData, foldersData, tagsData, statsData] = await Promise.all([
          getAllNotes(),
          getAllFolders(),
          getAllTags(),
          getStorageStats().catch(() => ({
            noteCount: 0,
            folderCount: 0,
            tagCount: 0,
            totalSizeKB: 0,
            lastModified: null
          }))
        ]);

        if (!isMounted) return;

        setNotes(notesData || []);
        setFolders(foldersData || []);
        setTags(tagsData || []);
        setStats(statsData);

        // Count pending sync items
        const pending = (notesData || []).filter(n => n.syncStatus === 'pending').length;
        setPendingSync(pending);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load notes');
          console.error('useNotes: Load error:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, []);

  // Refresh stats periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newStats = await getStorageStats();
        setStats(newStats);
      } catch (e) {
        // Silently fail
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // ===================== NOTE CRUD =====================

  const createNote = useCallback(async (initialData = {}) => {
    try {
      const now = new Date().toISOString();
      const newNote = {
        id: generateId(),
        title: initialData.title || 'Untitled Note',
        content: initialData.content || '',
        folderId: initialData.folderId || null,
        tags: initialData.tags || [],
        pinned: false,
        favorite: false,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        ...initialData
      };

      const saved = await saveNote(newNote);
      setNotes(prev => [saved, ...prev]);
      setActiveNoteId(saved.id);
      setPendingSync(p => p + 1);

      // Update stats
      setStats(s => s ? {
        ...s,
        noteCount: s.noteCount + 1,
        lastModified: now
      } : null);

      return saved;
    } catch (err) {
      setError(err.message || 'Failed to create note');
      throw err;
    }
  }, []);

  const updateNote = useCallback(async (id, updates) => {
    if (!id) throw new Error('Note ID is required');

    try {
      const existing = notesRef.current.find(n => n.id === id);
      if (!existing) {
        throw new Error(`Note not found: ${id}`);
      }

      const updated = await saveNote({
        ...existing,
        ...updates,
        id // Ensure ID doesn't change
      });

      setNotes(prev => prev.map(n => n.id === id ? updated : n));

      if (updated.syncStatus === 'pending') {
        setPendingSync(p => p + 1);
      }

      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update note');
      throw err;
    }
  }, []);

  const removeNote = useCallback(async (id) => {
    if (!id) return false;

    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));

      if (activeNoteId === id) {
        setActiveNoteId(null);
      }

      setStats(s => s ? { ...s, noteCount: Math.max(0, s.noteCount - 1) } : null);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to delete note');
      throw err;
    }
  }, [activeNoteId]);

  const getNoteById = useCallback(async (id) => {
    if (!id) return null;

    // Check local state first
    const fromState = notesRef.current.find(n => n.id === id);
    if (fromState) return fromState;

    // Fallback to storage
    try {
      return await getNote(id);
    } catch (err) {
      console.error('Failed to get note:', err);
      return null;
    }
  }, []);

  // ===================== ACTIONS =====================

  const togglePin = useCallback(async (id) => {
    const note = notesRef.current.find(n => n.id === id);
    if (!note) return;
    return updateNote(id, { pinned: !note.pinned });
  }, [updateNote]);

  const toggleFavorite = useCallback(async (id) => {
    const note = notesRef.current.find(n => n.id === id);
    if (!note) return;
    return updateNote(id, { favorite: !note.favorite });
  }, [updateNote]);

  const addTag = useCallback(async (noteId, tag) => {
    if (!tag || typeof tag !== 'string') return;
    const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    if (!cleanTag) return;

    const note = notesRef.current.find(n => n.id === noteId);
    if (!note) return;

    const currentTags = note.tags || [];
    if (currentTags.includes(cleanTag)) return;

    return updateNote(noteId, { tags: [...currentTags, cleanTag] });
  }, [updateNote]);

  const removeTag = useCallback(async (noteId, tag) => {
    const note = notesRef.current.find(n => n.id === noteId);
    if (!note) return;

    return updateNote(noteId, {
      tags: (note.tags || []).filter(t => t !== tag)
    });
  }, [updateNote]);

  // ===================== FOLDERS =====================

  const createFolder = useCallback(async (name, parentId = null) => {
    if (!name || typeof name !== 'string') {
      throw new Error('Folder name is required');
    }

    const cleanName = name.trim();
    if (!cleanName) throw new Error('Folder name cannot be empty');
    if (cleanName.length > 100) throw new Error('Folder name too long (max 100 chars)');

    const now = new Date().toISOString();
    const folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cleanName,
      parentId,
      createdAt: now,
      updatedAt: now
    };

    const saved = await saveFolder(folder);
    setFolders(prev => [...prev, saved]);
    setStats(s => s ? { ...s, folderCount: s.folderCount + 1 } : null);
    return saved;
  }, []);

  const removeFolder = useCallback(async (folderId, deleteNotes = false) => {
    await deleteFolder(folderId, deleteNotes);
    setFolders(prev => prev.filter(f => f.id !== folderId));

    if (deleteNotes) {
      setNotes(prev => prev.filter(n => n.folderId !== folderId));
    } else {
      setNotes(prev => prev.map(n =>
        n.folderId === folderId ? { ...n, folderId: null } : n
      ));
    }

    setStats(s => s ? { ...s, folderCount: Math.max(0, s.folderCount - 1) } : null);
  }, []);

  const renameFolder = useCallback(async (folderId, newName) => {
    if (!newName || !newName.trim()) throw new Error('New name is required');

    const folder = folders.find(f => f.id === folderId);
    if (!folder) throw new Error('Folder not found');

    const updated = await saveFolder({
      ...folder,
      name: newName.trim().substring(0, 100),
      updatedAt: new Date().toISOString()
    });

    setFolders(prev => prev.map(f => f.id === folderId ? updated : f));
  }, [folders]);

  // ===================== TAGS =====================

  const createTag = useCallback(async (name) => {
    if (!name || typeof name !== 'string') return;

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    if (!cleanName) return;

    // Check if tag already exists
    if (tags.find(t => t.id === cleanName)) return;

    const tag = {
      id: cleanName,
      name: cleanName,
      createdAt: new Date().toISOString()
    };

    const saved = await saveTag(tag);
    setTags(prev => [...prev, saved]);
    return saved;
  }, [tags]);

  // ===================== CONFLICT RESOLUTION =====================

  const handleConflict = useCallback(async (serverVersion, strategy = 'last-write-wins') => {
    if (!serverVersion || !serverVersion.id) {
      throw new Error('Server version is required for conflict resolution');
    }

    const result = await resolveConflict(serverVersion.id, serverVersion, strategy);

    if (result && result.conflict) {
      setConflict(result);
      return result;
    }

    // Conflict resolved, update state
    setNotes(prev => prev.map(n =>
      n.id === result.id ? result : n
    ));
    setConflict(null);
    return result;
  }, []);

  const resolveConflictManually = useCallback(async (noteId, winner) => {
    if (!noteId || !winner) return;

    const resolved = await saveNote({
      ...winner,
      id: noteId,
      syncStatus: 'synced',
      conflictResolved: true,
      updatedAt: new Date().toISOString()
    });

    setNotes(prev => prev.map(n => n.id === noteId ? resolved : n));
    setConflict(null);
    return resolved;
  }, []);

  // ===================== EXPORT/IMPORT =====================

  const exportData = useCallback(async () => {
    const { exportAllData } = await import('../utils/storage');
    return exportAllData();
  }, []);

  const importData = useCallback(async (data, mergeStrategy = 'merge') => {
    const { importAllData } = await import('../utils/storage');
    const result = await importAllData(data, mergeStrategy);

    // Refresh all data
    const [newNotes, newFolders, newTags] = await Promise.all([
      getAllNotes(),
      getAllFolders(),
      getAllTags()
    ]);

    setNotes(newNotes || []);
    setFolders(newFolders || []);
    setTags(newTags || []);

    const newStats = await getStorageStats();
    setStats(newStats);

    return result;
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllData();
    setNotes([]);
    setFolders([]);
    setTags([]);
    setActiveNoteId(null);
    setStats({
      noteCount: 0,
      folderCount: 0,
      tagCount: 0,
      totalSizeKB: 0,
      lastModified: null
    });
  }, []);

  // ===================== DERIVED STATE =====================

  const activeNote = notes.find(n => n.id === activeNoteId) || null;
  const pinnedNotes = notes.filter(n => n.pinned);
  const favoriteNotes = notes.filter(n => n.favorite);
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 10);

  return {
    // State
    notes,
    folders,
    tags,
    activeNoteId,
    activeNote,
    loading,
    error,
    conflict,
    stats,
    pendingSync,

    // Derived
    pinnedNotes,
    favoriteNotes,
    recentNotes,

    // Note CRUD
    createNote,
    updateNote,
    removeNote,
    getNoteById,

    // Actions
    togglePin,
    toggleFavorite,
    addTag,
    removeTag,
    setActiveNoteId,
    setError,

    // Folders
    createFolder,
    removeFolder,
    renameFolder,

    // Tags
    createTag,

    // Conflict
    handleConflict,
    resolveConflictManually,

    // Import/Export
    exportData,
    importData,
    clearAll
  };
}
