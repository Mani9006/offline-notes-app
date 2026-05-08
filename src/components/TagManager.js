/**
 * TagManager component - displays and manages tags.
 * Two modes: readOnly (sidebar) and editable (note editor).
 */

import React, { useState, useCallback, useRef } from 'react';

/**
 * @param {Object} props
 * @param {Array} props.tags - All available tags
 * @param {string|null} props.activeTag - Currently selected tag for filtering
 * @param {Function} props.onSelect - Callback when tag is selected for filtering
 * @param {Array} props.noteTags - Tags on current note (editable mode)
 * @param {Function} props.onAddTag - Add tag to note
 * @param {Function} props.onRemoveTag - Remove tag from note
 * @param {boolean} props.readOnly - If true, shows all tags for filtering only
 */
export function TagManager({
  tags,
  activeTag,
  onSelect,
  noteTags,
  onAddTag,
  onRemoveTag,
  readOnly
}) {
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleAdd = useCallback(() => {
    const value = inputValue.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    if (!value) {
      setShowInput(false);
      setInputValue('');
      return;
    }

    onAddTag(value);
    setInputValue('');
    setShowInput(false);
  }, [inputValue, onAddTag]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
    }
  }, [handleAdd]);

  const handleTagClick = useCallback((tagId) => {
    if (readOnly && onSelect) {
      onSelect(tagId === activeTag ? undefined : tagId);
    }
  }, [readOnly, onSelect, activeTag]);

  // Sidebar mode: show all tags for filtering
  if (readOnly) {
    return (
      <div className="tag-manager tag-manager-readonly">
        {tags.length === 0 ? (
          <p className="tags-empty">No tags yet</p>
        ) : (
          <div className="tags-list">
            {tags.map(tag => (
              <button
                key={tag.id}
                className={`tag-chip tag-selectable ${activeTag === tag.id ? 'active' : ''}`}
                onClick={() => handleTagClick(tag.id)}
                aria-pressed={activeTag === tag.id}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Editable mode: manage note tags
  return (
    <div className="tag-manager tag-manager-editable">
      <div className="tags-list">
        {(noteTags || []).map((tag) => (
          <span key={tag} className="tag-chip tag-removable">
            #{tag}
            <button
              className="tag-remove"
              onClick={() => onRemoveTag(tag)}
              aria-label={`Remove tag ${tag}`}
              title={`Remove ${tag}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}

        {showInput ? (
          <input
            ref={inputRef}
            className="tag-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={handleKeyDown}
            placeholder="tag-name"
            autoFocus
            maxLength={30}
          />
        ) : (
          <button
            className="tag-add-btn"
            onClick={() => {
              setShowInput(true);
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            aria-label="Add tag"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Tag</span>
          </button>
        )}
      </div>

      {/* Available tags hint */}
      {tags.length > 0 && (
        <div className="tags-hint">
          <span>Available:</span>
          {tags
            .filter(t => !(noteTags || []).includes(t.id))
            .slice(0, 8)
            .map(tag => (
              <button
                key={tag.id}
                className="tag-chip tag-suggestion"
                onClick={() => onAddTag(tag.id)}
                title={`Add #${tag.name}`}
              >
                #{tag.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
