/**
 * IndexedDB wrapper with localStorage fallback
 * Provides offline-first storage for notes, folders, and tags.
 *
 * @module storage
 */

const DB_NAME = 'NotesAppDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const FOLDERS_STORE = 'folders';
const TAGS_STORE = 'tags';

// In-memory cache for performance
const memoryCache = new Map();

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Notes store with indexes for search
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        notesStore.createIndex('folderId', 'folderId', { unique: false });
        notesStore.createIndex('pinned', 'pinned', { unique: false });
        notesStore.createIndex('favorite', 'favorite', { unique: false });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }

      // Folders store
      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        db.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
      }

      // Tags store
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        db.createObjectStore(TAGS_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Execute a transaction on the database.
 */
async function withStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const transaction = db.transaction([storeName], mode);
  return transaction.objectStore(storeName);
}

// ===================== NOTES =====================

/**
 * Save (create or update) a note.
 * @param {Object} note
 * @returns {Promise<Object>}
 */
export async function saveNote(note) {
  if (!note || typeof note !== 'object') {
    throw new TypeError('Note must be a valid object');
  }
  if (!note.id) {
    throw new Error('Note must have an id');
  }

  const now = new Date().toISOString();
  const noteToSave = {
    ...note,
    updatedAt: now,
    createdAt: note.createdAt || now,
    syncStatus: 'pending', // pending | synced | conflict
    version: (note.version || 0) + 1
  };

  try {
    const store = await withStore(NOTES_STORE, 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(noteToSave);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    memoryCache.set(note.id, noteToSave);
    // Backup to localStorage for extra safety
    backupToLocalStorage(noteToSave);
    return noteToSave;
  } catch (err) {
    console.warn('IndexedDB failed, falling back to localStorage:', err);
    return saveNoteToLocalStorage(noteToSave);
  }
}

/**
 * Get a single note by ID.
 */
export async function getNote(id) {
  if (!id) return null;

  // Check memory cache first
  if (memoryCache.has(id)) {
    return memoryCache.get(id);
  }

  try {
    const store = await withStore(NOTES_STORE, 'readonly');
    const note = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (note) memoryCache.set(id, note);
    return note;
  } catch (err) {
    return getNoteFromLocalStorage(id);
  }
}

/**
 * Get all notes with optional filters.
 */
export async function getAllNotes(filters = {}) {
  try {
    const store = await withStore(NOTES_STORE, 'readonly');
    const notes = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return applyFilters(notes, filters);
  } catch (err) {
    return getAllNotesFromLocalStorage(filters);
  }
}

/**
 * Delete a note.
 */
export async function deleteNote(id) {
  if (!id) return false;

  try {
    const store = await withStore(NOTES_STORE, 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    memoryCache.delete(id);
    removeFromLocalStorageBackup(id);
    return true;
  } catch (err) {
    return deleteNoteFromLocalStorage(id);
  }
}

/**
 * Resolve sync conflict using last-write-wins with version check.
 * @param {string} id - Note ID
 * @param {Object} serverVersion - Server-side note
 * @param {string} strategy - 'last-write-wins' | 'manual' | 'server-wins' | 'local-wins'
 */
export async function resolveConflict(id, serverVersion, strategy = 'last-write-wins') {
  if (!id || !serverVersion) {
    throw new Error('Conflict resolution requires note ID and server version');
  }

  const localVersion = await getNote(id);

  if (!localVersion) {
    // Local was deleted, restore from server
    return saveNote(serverVersion);
  }

  switch (strategy) {
    case 'server-wins':
      return saveNote(serverVersion);

    case 'local-wins':
      return saveNote({ ...localVersion, syncStatus: 'pending' });

    case 'manual':
      return {
        conflict: true,
        local: localVersion,
        server: serverVersion,
        id
      };

    case 'last-write-wins':
    default: {
      const localTime = new Date(localVersion.updatedAt).getTime();
      const serverTime = new Date(serverVersion.updatedAt).getTime();
      const winner = localTime >= serverTime ? localVersion : serverVersion;
      return saveNote({ ...winner, syncStatus: 'synced', conflictResolved: true });
    }
  }
}

// ===================== FOLDERS =====================

/**
 * Save a folder.
 */
export async function saveFolder(folder) {
  if (!folder || !folder.id) {
    throw new TypeError('Folder must have an id');
  }

  const now = new Date().toISOString();
  const folderToSave = {
    ...folder,
    updatedAt: now,
    createdAt: folder.createdAt || now
  };

  try {
    const store = await withStore(FOLDERS_STORE, 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(folderToSave);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return folderToSave;
  } catch (err) {
    const folders = JSON.parse(localStorage.getItem('notes-folders') || '[]');
    const idx = folders.findIndex(f => f.id === folder.id);
    if (idx >= 0) folders[idx] = folderToSave;
    else folders.push(folderToSave);
    localStorage.setItem('notes-folders', JSON.stringify(folders));
    return folderToSave;
  }
}

/**
 * Get all folders.
 */
export async function getAllFolders() {
  try {
    const store = await withStore(FOLDERS_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return JSON.parse(localStorage.getItem('notes-folders') || '[]');
  }
}

/**
 * Delete a folder and optionally its notes.
 */
export async function deleteFolder(folderId, deleteNotes = false) {
  if (!folderId) return false;

  try {
    const store = await withStore(FOLDERS_STORE, 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.delete(folderId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });

    if (deleteNotes) {
      const notes = await getAllNotes({ folderId });
      await Promise.all(notes.map(n => deleteNote(n.id)));
    } else {
      // Move notes to root (no folder)
      const notes = await getAllNotes({ folderId });
      await Promise.all(notes.map(n => saveNote({ ...n, folderId: null })));
    }

    const folders = JSON.parse(localStorage.getItem('notes-folders') || '[]');
    localStorage.setItem('notes-folders', JSON.stringify(folders.filter(f => f.id !== folderId)));
    return true;
  } catch (err) {
    const folders = JSON.parse(localStorage.getItem('notes-folders') || '[]');
    localStorage.setItem('notes-folders', JSON.stringify(folders.filter(f => f.id !== folderId)));
    return false;
  }
}

// ===================== TAGS =====================

/**
 * Save a tag.
 */
export async function saveTag(tag) {
  if (!tag || !tag.id) {
    throw new TypeError('Tag must have an id');
  }

  try {
    const store = await withStore(TAGS_STORE, 'readwrite');
    await new Promise((resolve, reject) => {
      const request = store.put(tag);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return tag;
  } catch (err) {
    const tags = JSON.parse(localStorage.getItem('notes-tags') || '[]');
    const idx = tags.findIndex(t => t.id === tag.id);
    if (idx >= 0) tags[idx] = tag;
    else tags.push(tag);
    localStorage.setItem('notes-tags', JSON.stringify(tags));
    return tag;
  }
}

/**
 * Get all tags.
 */
export async function getAllTags() {
  try {
    const store = await withStore(TAGS_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return JSON.parse(localStorage.getItem('notes-tags') || '[]');
  }
}

// ===================== IMPORT/EXPORT =====================

/**
 * Export all data as JSON.
 */
export async function exportAllData() {
  const [notes, folders, tags] = await Promise.all([
    getAllNotes(),
    getAllFolders(),
    getAllTags()
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    folders,
    tags,
    meta: {
      noteCount: notes.length,
      folderCount: folders.length,
      tagCount: tags.length
    }
  };
}

/**
 * Import data from JSON object.
 * @param {Object} data - The data to import
 * @param {string} mergeStrategy - 'merge' | 'overwrite'
 */
export async function importAllData(data, mergeStrategy = 'merge') {
  if (!data || typeof data !== 'object') {
    throw new TypeError('Invalid import data');
  }

  if (mergeStrategy === 'overwrite') {
    // Clear existing data
    const db = await openDB();
    await Promise.all([
      clearStore(db, NOTES_STORE),
      clearStore(db, FOLDERS_STORE),
      clearStore(db, TAGS_STORE)
    ]);
  }

  const results = { notes: 0, folders: 0, tags: 0, errors: [] };

  if (data.folders && Array.isArray(data.folders)) {
    for (const folder of data.folders) {
      try {
        await saveFolder(folder);
        results.folders++;
      } catch (e) {
        results.errors.push({ type: 'folder', id: folder.id, error: e.message });
      }
    }
  }

  if (data.tags && Array.isArray(data.tags)) {
    for (const tag of data.tags) {
      try {
        await saveTag(tag);
        results.tags++;
      } catch (e) {
        results.errors.push({ type: 'tag', id: tag.id, error: e.message });
      }
    }
  }

  if (data.notes && Array.isArray(data.notes)) {
    for (const note of data.notes) {
      try {
        await saveNote(note);
        results.notes++;
      } catch (e) {
        results.errors.push({ type: 'note', id: note.id, error: e.message });
      }
    }
  }

  return results;
}

// ===================== LOCAL STORAGE FALLBACK =====================

const LS_NOTES_KEY = 'notes-data';

function saveNoteToLocalStorage(note) {
  const notes = JSON.parse(localStorage.getItem(LS_NOTES_KEY) || '[]');
  const idx = notes.findIndex(n => n.id === note.id);
  if (idx >= 0) notes[idx] = note;
  else notes.push(note);
  localStorage.setItem(LS_NOTES_KEY, JSON.stringify(notes));
  return note;
}

function getNoteFromLocalStorage(id) {
  const notes = JSON.parse(localStorage.getItem(LS_NOTES_KEY) || '[]');
  return notes.find(n => n.id === id) || null;
}

function getAllNotesFromLocalStorage(filters = {}) {
  const notes = JSON.parse(localStorage.getItem(LS_NOTES_KEY) || '[]');
  return applyFilters(notes, filters);
}

function deleteNoteFromLocalStorage(id) {
  const notes = JSON.parse(localStorage.getItem(LS_NOTES_KEY) || '[]');
  localStorage.setItem(LS_NOTES_KEY, JSON.stringify(notes.filter(n => n.id !== id)));
  return true;
}

function backupToLocalStorage(note) {
  try {
    const backups = JSON.parse(localStorage.getItem('notes-backup') || '{}');
    backups[note.id] = { ...note, _backedUpAt: new Date().toISOString() };
    localStorage.setItem('notes-backup', JSON.stringify(backups));
  } catch (e) {
    // Storage might be full
    console.warn('Backup to localStorage failed:', e);
  }
}

function removeFromLocalStorageBackup(id) {
  const backups = JSON.parse(localStorage.getItem('notes-backup') || '{}');
  delete backups[id];
  localStorage.setItem('notes-backup', JSON.stringify(backups));
}

// ===================== HELPERS =====================

function applyFilters(notes, filters) {
  let result = [...notes];

  if (filters.folderId !== undefined) {
    result = result.filter(n => n.folderId === filters.folderId);
  }
  if (filters.pinned === true) {
    result = result.filter(n => n.pinned);
  }
  if (filters.favorite === true) {
    result = result.filter(n => n.favorite);
  }
  if (filters.tag) {
    result = result.filter(n => n.tags && n.tags.includes(filters.tag));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  }

  // Sort: pinned first, then by updatedAt desc
  result.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return result;
}

async function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get storage statistics.
 */
export async function getStorageStats() {
  const notes = await getAllNotes();
  const folders = await getAllFolders();
  const tags = await getAllTags();

  const totalSize = new Blob([
    JSON.stringify(notes),
    JSON.stringify(folders),
    JSON.stringify(tags)
  ]).size;

  return {
    noteCount: notes.length,
    folderCount: folders.length,
    tagCount: tags.length,
    totalSizeBytes: totalSize,
    totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
    oldestNote: notes.length > 0
      ? notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
      : null,
    lastModified: notes.length > 0
      ? notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0].updatedAt
      : null
  };
}

/**
 * Clear all data.
 */
export async function clearAllData() {
  memoryCache.clear();
  try {
    const db = await openDB();
    await Promise.all([
      clearStore(db, NOTES_STORE),
      clearStore(db, FOLDERS_STORE),
      clearStore(db, TAGS_STORE)
    ]);
  } catch (e) {
    // Ignore
  }
  localStorage.removeItem(LS_NOTES_KEY);
  localStorage.removeItem('notes-folders');
  localStorage.removeItem('notes-tags');
  localStorage.removeItem('notes-backup');
}
