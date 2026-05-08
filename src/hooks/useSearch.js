/**
 * Search hook with debouncing and advanced filtering.
 *
 * @module useSearch
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { searchNotes, filterNotes } from '../utils/searchEngine';

/**
 * Debounce function.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * @param {Object} options
 * @param {Array} options.notes - Notes to search
 * @param {number} options.debounceMs - Debounce delay (default: 150)
 * @param {number} options.minLength - Minimum query length (default: 1)
 * @returns {Object}
 */
export function useSearch({ notes, debounceMs = 150, minLength = 1 }) {
  if (!Array.isArray(notes)) {
    throw new TypeError('notes must be an array');
  }

  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    folderId: undefined,
    tag: undefined,
    pinned: undefined,
    favorite: undefined
  });
  const [isSearching, setIsSearching] = useState(false);

  const searchInputRef = useRef(null);

  // Debounced query update
  const debouncedUpdate = useMemo(
    () => debounce((val) => {
      setDebouncedQuery(val);
      setIsSearching(false);
    }, debounceMs),
    [debounceMs]
  );

  const setQuery = useCallback((value) => {
    if (typeof value !== 'string') return;
    setRawQuery(value);
    setIsSearching(!!value.trim());
    debouncedUpdate(value);
  }, [debouncedUpdate]);

  const clearQuery = useCallback(() => {
    setRawQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Apply filters
  const setFilter = useCallback((key, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value === prev[key] ? undefined : value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({
      folderId: undefined,
      tag: undefined,
      pinned: undefined,
      favorite: undefined
    });
  }, []);

  // Perform search
  const searchResults = useMemo(() => {
    // First apply static filters
    let candidates = notes;

    if (Object.values(activeFilters).some(v => v !== undefined)) {
      candidates = filterNotes(notes, activeFilters);
    }

    // Then perform text search if query is valid
    if (debouncedQuery.trim().length >= minLength) {
      const result = searchNotes(candidates, debouncedQuery);
      return result;
    }

    // No search query: return filtered notes
    return {
      results: candidates.map(note => ({
        note,
        score: 0,
        highlightedTitle: note.title || 'Untitled',
        highlightedContent: (note.content || '').substring(0, 200)
      })),
      query: '',
      totalMatches: candidates.length,
      suggestions: []
    };
  }, [notes, debouncedQuery, activeFilters, minLength]);

  const focusedNotes = useMemo(() => {
    return searchResults.results.map(r => r.note);
  }, [searchResults]);

  return {
    query: rawQuery,
    debouncedQuery,
    setQuery,
    clearQuery,
    isSearching,
    searchInputRef,
    activeFilters,
    setFilter,
    clearFilters,
    searchResults,
    focusedNotes,
    totalMatches: searchResults.totalMatches,
    suggestions: searchResults.suggestions
  };
}
