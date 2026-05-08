/**
 * NoteList component - displays a scrollable list of note cards.
 */

import React, { useMemo } from 'react';
import { extractPlainText } from '../utils/markdownParser';
import { estimateReadingTime } from '../utils/readingTime';

/**
 * @param {Object} props
 */
export function NoteList({
  notes,
  activeNoteId,
  onSelectNote,
  onDeleteNote,
  onTogglePin,
  onToggleFavorite,
  onPreview,
  searchQuery,
  searchResults,
  folders,
  onCreateNote
}) {
  const folderMap = useMemo(() => {
    const map = {};
    for (const f of folders) {
      map[f.id] = f.name;
    }
    return map;
  }, [folders]);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  if (notes.length === 0) {
    return (
      <div className="note-list-empty">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h3>No notes found</h3>
          <p>Create your first note to get started</p>
          <button className="btn btn-primary" onClick={onCreateNote}>
            Create Note
          </button>
        </div>
      </div>
    );
  }

  // Use search results for highlighting when available
  const highlightedMap = useMemo(() => {
    const map = {};
    for (const result of (searchResults || [])) {
      if (result.note && result.note.id) {
        map[result.note.id] = {
          highlightedTitle: result.highlightedTitle,
          highlightedContent: result.highlightedContent
        };
      }
    }
    return map;
  }, [searchResults]);

  return (
    <div className="note-list">
      {/* List header */}
      <div className="note-list-header">
        <span className="note-list-count">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
        {searchQuery && (
          <span className="note-list-searching">
            for &ldquo;{searchQuery}&rdquo;
          </span>
        )}
      </div>

      {/* Note cards */}
      <div className="note-list-items" role="listbox" aria-label="Notes">
        {notes.map(note => {
          const isActive = note.id === activeNoteId;
          const preview = extractPlainText(note.content || '', 120);
          const reading = estimateReadingTime(note.content || '');
          const highlights = highlightedMap[note.id];
          const folderName = note.folderId ? folderMap[note.folderId] : null;

          return (
            <div
              key={note.id}
              className={`note-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectNote(note.id)}
              role="option"
              aria-selected={isActive}
            >
              {/* Card actions */}
              <div className="note-card-actions">
                <button
                  className={`card-action ${note.pinned ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(note.id);
                  }}
                  aria-label={note.pinned ? 'Unpin' : 'Pin'}
                  title={note.pinned ? 'Unpin' : 'Pin'}
                >
                  <svg viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <path d="M5 17h14v-2H5v2z" />
                    <path d="M12 2L8.5 9h7L12 2z" />
                  </svg>
                </button>
                <button
                  className={`card-action ${note.favorite ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(note.id);
                  }}
                  aria-label={note.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  title={note.favorite ? 'Unfavorite' : 'Favorite'}
                >
                  <svg viewBox="0 0 24 24" fill={note.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              </div>

              {/* Title */}
              <h3
                className="note-card-title"
                dangerouslySetInnerHTML={{
                  __html: highlights?.highlightedTitle || (note.title || 'Untitled')
                }}
              />

              {/* Preview */}
              {preview && (
                <p
                  className="note-card-preview"
                  dangerouslySetInnerHTML={{
                    __html: highlights?.highlightedContent || preview
                  }}
                />
              )}

              {/* Meta */}
              <div className="note-card-meta">
                <div className="note-card-info">
                  {folderName && (
                    <span className="note-folder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      {folderName}
                    </span>
                  )}
                  <span className="note-date">{formatDate(note.updatedAt)}</span>
                  <span className="note-reading">{reading.formatted}</span>
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="note-card-tags">
                    {note.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="note-card-tag">#{tag}</span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="note-card-tag note-tag-more">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
