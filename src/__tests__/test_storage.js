/**
 * Tests for storage utility module.
 * Tests IndexedDB wrapper with localStorage fallback.
 */

import {
  saveNote,
  getNote,
  getAllNotes,
  deleteNote,
  resolveConflict,
  exportAllData,
  getStorageStats
} from '../src/utils/storage';

// Mock IndexedDB
const mockDB = {
  transaction: jest.fn(),
  objectStoreNames: { contains: jest.fn(() => true) }
};

const createMockRequest = (result) => ({
  onsuccess: null,
  onerror: null,
  result,
  set onsuccess(fn) { fn({ target: { result } }); },
  set onerror(fn) { /* no-op */ }
});

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDB.transaction.mockClear();
  });

  describe('saveNote', () => {
    test('validates note parameter', async () => {
      await expect(saveNote(null)).rejects.toThrow(TypeError);
      await expect(saveNote(undefined)).rejects.toThrow(TypeError);
      await expect(saveNote('string')).rejects.toThrow(TypeError);
    });

    test('requires note id', async () => {
      await expect(saveNote({ title: 'Test' })).rejects.toThrow('Note must have an id');
    });

    test('saves note with timestamp and version', async () => {
      const note = { id: 'test_1', title: 'Hello', content: 'World' };
      const result = await saveNote(note);

      expect(result.id).toBe('test_1');
      expect(result.title).toBe('Hello');
      expect(result.content).toBe('World');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.syncStatus).toBe('pending');
    });

    test('increments version on update', async () => {
      const note = { id: 'test_2', title: 'First', content: 'v1', version: 1 };
      const result = await saveNote(note);
      expect(result.version).toBe(2);
    });

    test('falls back to localStorage on IndexedDB error', async () => {
      const note = { id: 'test_ls_1', title: 'Fallback', content: 'Test' };
      // Mock IndexedDB failure by making indexedDB undefined
      const originalIDB = window.indexedDB;
      window.indexedDB = undefined;

      const result = await saveNote(note);
      expect(result.title).toBe('Fallback');

      // Verify it was saved to localStorage
      const stored = JSON.parse(localStorage.getItem('notes-data') || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].title).toBe('Fallback');

      window.indexedDB = originalIDB;
    });
  });

  describe('getNote', () => {
    test('returns null for empty id', async () => {
      const result = await getNote('');
      expect(result).toBeNull();
    });

    test('returns null for missing note', async () => {
      const result = await getNote('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('resolveConflict', () => {
    test('throws for missing parameters', async () => {
      await expect(resolveConflict()).rejects.toThrow('Conflict resolution requires note ID');
      await expect(resolveConflict('id')).rejects.toThrow('Conflict resolution requires note ID');
    });

    test('uses last-write-wins strategy by default', async () => {
      const now = new Date().toISOString();
      const past = new Date(Date.now() - 10000).toISOString();

      const localNote = {
        id: 'conflict_1',
        title: 'Local',
        content: 'local content',
        updatedAt: now,
        createdAt: now
      };
      await saveNote(localNote);

      const serverNote = {
        id: 'conflict_1',
        title: 'Server',
        content: 'server content',
        updatedAt: past,
        createdAt: now
      };

      const result = await resolveConflict('conflict_1', serverNote, 'last-write-wins');
      expect(result.conflictResolved).toBe(true);
    });

    test('server-wins strategy returns server version', async () => {
      const now = new Date().toISOString();
      const localNote = {
        id: 'conflict_2',
        title: 'Local',
        content: 'local',
        updatedAt: now,
        createdAt: now
      };
      await saveNote(localNote);

      const serverNote = {
        id: 'conflict_2',
        title: 'Server Wins',
        content: 'server content',
        updatedAt: now,
        createdAt: now
      };

      const result = await resolveConflict('conflict_2', serverNote, 'server-wins');
      expect(result.title).toBe('Server Wins');
    });

    test('local-wins strategy preserves local data', async () => {
      const now = new Date().toISOString();
      const localNote = {
        id: 'conflict_3',
        title: 'Local Wins',
        content: 'local data',
        updatedAt: now,
        createdAt: now
      };
      await saveNote(localNote);

      const serverNote = {
        id: 'conflict_3',
        title: 'Server',
        content: 'server data',
        updatedAt: now,
        createdAt: now
      };

      const result = await resolveConflict('conflict_3', serverNote, 'local-wins');
      expect(result.title).toBe('Local Wins');
      expect(result.content).toBe('local data');
    });

    test('manual strategy returns conflict info', async () => {
      const now = new Date().toISOString();
      const localNote = {
        id: 'conflict_4',
        title: 'Local',
        content: 'local',
        updatedAt: now,
        createdAt: now
      };
      await saveNote(localNote);

      const serverNote = {
        id: 'conflict_4',
        title: 'Server',
        content: 'server',
        updatedAt: now,
        createdAt: now
      };

      const result = await resolveConflict('conflict_4', serverNote, 'manual');
      expect(result.conflict).toBe(true);
      expect(result.local).toBeDefined();
      expect(result.server).toBeDefined();
      expect(result.id).toBe('conflict_4');
    });

    test('restores from server when local was deleted', async () => {
      const serverNote = {
        id: 'deleted_local',
        title: 'Restored',
        content: 'from server',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const result = await resolveConflict('deleted_local', serverNote, 'server-wins');
      expect(result.title).toBe('Restored');
    });
  });

  describe('getStorageStats', () => {
    test('returns zero stats for empty database', async () => {
      const stats = await getStorageStats();
      expect(stats.noteCount).toBe(0);
      expect(stats.folderCount).toBe(0);
      expect(stats.tagCount).toBe(0);
      expect(stats.totalSizeKB).toBe(0);
      expect(stats.lastModified).toBeNull();
    });

    test('calculates aggregate stats correctly', async () => {
      await saveNote({ id: 'stat_1', title: 'Note 1', content: 'Content 1' });
      await saveNote({ id: 'stat_2', title: 'Note 2', content: 'Content 2' });

      const stats = await getStorageStats();
      expect(stats.noteCount).toBe(2);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.totalSizeKB).toBeGreaterThanOrEqual(0);
    });
  });
});
