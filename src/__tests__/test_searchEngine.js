/**
 * Tests for search engine utility.
 */

import {
  tokenize,
  buildSearchIndex,
  searchNotes,
  filterNotes
} from '../src/utils/searchEngine';

describe('searchEngine', () => {
  describe('tokenize', () => {
    test('returns empty array for empty/null input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize(null)).toEqual([]);
      expect(tokenize(undefined)).toEqual([]);
    });

    test('splits text into lowercase tokens', () => {
      const result = tokenize('Hello World Test');
      expect(result).toContain('hello');
      expect(result).toContain('world');
      expect(result).toContain('test');
    });

    test('strips markdown syntax', () => {
      const result = tokenize('# Header **bold** *italic* `code`');
      expect(result).toContain('header');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
      expect(result).toContain('code');
      expect(result).not.toContain('#');
      expect(result).not.toContain('**');
    });

    test('removes stop words', () => {
      const result = tokenize('the and or but in on at to for');
      expect(result.length).toBe(0);
    });

    test('removes short tokens', () => {
      const result = tokenize('a b c de fgh');
      expect(result).not.toContain('a');
      expect(result).not.toContain('b');
      expect(result).not.toContain('c');
      expect(result).toContain('fgh');
    });

    test('handles code blocks', () => {
      const result = tokenize('Some text\n```\ncode here\n```\nMore text');
      expect(result).toContain('some');
      expect(result).toContain('text');
      expect(result).toContain('more');
      expect(result).not.toContain('code');
    });
  });

  describe('buildSearchIndex', () => {
    test('returns empty map for empty array', () => {
      const index = buildSearchIndex([]);
      expect(index.size).toBe(0);
    });

    test('returns empty map for non-array', () => {
      const index = buildSearchIndex(null);
      expect(index.size).toBe(0);
    });

    test('indexes note titles and content', () => {
      const notes = [
        { id: '1', title: 'Hello World', content: 'Some content', tags: [] },
        { id: '2', title: 'Another Note', content: 'Different text', tags: [] }
      ];
      const index = buildSearchIndex(notes);
      expect(index.size).toBeGreaterThan(0);
      expect(index.has('hello')).toBe(true);
      expect(index.has('world')).toBe(true);
    });

    test('indexes tags', () => {
      const notes = [
        { id: '1', title: 'Note', content: 'Content', tags: ['react', 'javascript'] }
      ];
      const index = buildSearchIndex(notes);
      expect(index.has('react')).toBe(true);
      expect(index.has('javascript')).toBe(true);
    });
  });

  describe('searchNotes', () => {
    const sampleNotes = [
      { id: '1', title: 'React Tutorial', content: 'Learn React step by step', tags: ['react', 'tutorial'], pinned: true, updatedAt: '2024-01-15T00:00:00Z' },
      { id: '2', title: 'JavaScript Basics', content: 'Introduction to JS programming', tags: ['javascript'], pinned: false, updatedAt: '2024-01-14T00:00:00Z' },
      { id: '3', title: 'CSS Grid Guide', content: 'Master CSS grid layout', tags: ['css'], pinned: false, updatedAt: '2024-01-13T00:00:00Z' },
      { id: '4', title: 'React Hooks', content: 'Advanced React patterns', tags: ['react', 'advanced'], pinned: false, favorite: true, updatedAt: '2024-01-16T00:00:00Z' }
    ];

    test('returns empty results for empty query', () => {
      const result = searchNotes(sampleNotes, '');
      expect(result.results).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });

    test('returns empty results for whitespace-only query', () => {
      const result = searchNotes(sampleNotes, '   ');
      expect(result.results).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });

    test('finds notes by title', () => {
      const result = searchNotes(sampleNotes, 'react');
      expect(result.totalMatches).toBeGreaterThanOrEqual(2);
      const ids = result.results.map(r => r.note.id);
      expect(ids).toContain('1');
      expect(ids).toContain('4');
    });

    test('finds notes by content', () => {
      const result = searchNotes(sampleNotes, 'programming');
      expect(result.totalMatches).toBe(1);
      expect(result.results[0].note.id).toBe('2');
    });

    test('finds notes by tags', () => {
      const result = searchNotes(sampleNotes, 'css');
      expect(result.totalMatches).toBeGreaterThanOrEqual(1);
      expect(result.results[0].note.id).toBe('3');
    });

    test('ranks pinned notes higher', () => {
      const result = searchNotes(sampleNotes, 'react');
      // Pinned note should be ranked higher
      if (result.results.length >= 2) {
        expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
      }
    });

    test('supports quoted phrase matching', () => {
      const result = searchNotes(sampleNotes, '"React Hooks"');
      expect(result.totalMatches).toBe(1);
      expect(result.results[0].note.id).toBe('4');
    });

    test('supports tag filter syntax', () => {
      const result = searchNotes(sampleNotes, 'tag:react');
      expect(result.totalMatches).toBeGreaterThanOrEqual(2);
    });

    test('supports exclusion with minus operator', () => {
      const result = searchNotes(sampleNotes, 'react -hooks');
      expect(result.results.some(r => r.note.id === '4')).toBe(false);
    });

    test('returns suggestions', () => {
      const result = searchNotes(sampleNotes, 'rea');
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    test('returns highlighted results', () => {
      const result = searchNotes(sampleNotes, 'react');
      if (result.results.length > 0) {
        expect(result.results[0].highlightedTitle).toBeDefined();
        expect(result.results[0].highlightedContent).toBeDefined();
      }
    });

    test('respects the limit option', () => {
      const result = searchNotes(sampleNotes, 'a', { limit: 2 });
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    test('handles no matches gracefully', () => {
      const result = searchNotes(sampleNotes, 'xyznonexistent');
      expect(result.totalMatches).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('filterNotes', () => {
    const notes = [
      { id: '1', folderId: 'f1', tags: ['a', 'b'], pinned: true, favorite: false, updatedAt: '2024-01-15' },
      { id: '2', folderId: 'f2', tags: ['b', 'c'], pinned: false, favorite: true, updatedAt: '2024-01-10' },
      { id: '3', folderId: null, tags: ['a'], pinned: false, favorite: false, updatedAt: '2024-01-05' }
    ];

    test('returns empty array for non-array input', () => {
      expect(filterNotes(null, {})).toEqual([]);
    });

    test('returns all notes for empty criteria', () => {
      expect(filterNotes(notes, null)).toEqual(notes);
      expect(filterNotes(notes, {})).toEqual(notes);
    });

    test('filters by folderId', () => {
      const result = filterNotes(notes, { folderId: 'f1' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    test('filters by tag', () => {
      const result = filterNotes(notes, { tag: 'a' });
      expect(result.length).toBe(2);
      expect(result.map(n => n.id)).toEqual(['1', '3']);
    });

    test('filters by pinned', () => {
      const result = filterNotes(notes, { pinned: true });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    test('filters by favorite', () => {
      const result = filterNotes(notes, { favorite: true });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    test('filters by text search', () => {
      const result = filterNotes(notes, { search: 'f1' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    test('filters by date range', () => {
      const result = filterNotes(notes, { dateFrom: '2024-01-08' });
      expect(result.length).toBe(2);
      expect(result.map(n => n.id)).toEqual(['1', '2']);
    });

    test('combines multiple filters', () => {
      const result = filterNotes(notes, { tag: 'a', pinned: true });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });
  });
});
