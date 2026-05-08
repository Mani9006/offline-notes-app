/**
 * SearchBar component with real-time search, suggestions, and filter indicators.
 */

import React, { useCallback, useRef, useEffect } from 'react';

/**
 * @param {Object} props
 * @param {string} props.query
 * @param {Function} props.onQueryChange
 * @param {Function} props.onClear
 * @param {Object} props.inputRef
 * @param {boolean} props.isSearching
 * @param {number} props.totalMatches
 * @param {Array<string>} props.suggestions
 */
export function SearchBar({
  query,
  onQueryChange,
  onClear,
  inputRef,
  isSearching,
  totalMatches,
  suggestions
}) {
  const containerRef = useRef(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = useCallback((e) => {
    onQueryChange(e.target.value);
    setShowSuggestions(true);
  }, [onQueryChange]);

  const handleClear = useCallback(() => {
    onClear();
    setShowSuggestions(false);
  }, [onClear]);

  const handleSuggestionClick = useCallback((suggestion) => {
    onQueryChange(suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onQueryChange, inputRef]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      if (query) {
        handleClear();
      }
    }
  }, [query, handleClear]);

  return (
    <div className="search-bar" ref={containerRef}>
      <div className={`search-input-wrapper ${isSearching ? 'searching' : ''}`}>
        <svg
          className="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search notes... (try: tag:work, folder:projects)"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search notes"
          autoComplete="off"
          spellCheck={false}
        />

        {isSearching && (
          <div className="search-spinner" aria-hidden="true" />
        )}

        {query && (
          <button
            className="search-clear"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Results count */}
      {query && (
        <span className="search-results-count" aria-live="polite">
          {totalMatches} {totalMatches === 1 ? 'result' : 'results'}
        </span>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
          <div className="suggestions-label">Suggestions</div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
