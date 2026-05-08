/**
 * Main App component.
 * Orchestrates all sub-components and manages layout.
 */

import React, { useState, useCallback } from 'react';
import { useNotes } from '../hooks/useNotes';
import { useTheme } from '../hooks/useTheme';
import { useSearch } from '../hooks/useSearch';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import { NotePreview } from './NotePreview';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import '../styles/app.css';

const VIEW_LIST = 'list';
const VIEW_EDITOR = 'editor';
const VIEW_PREVIEW = 'preview';

export default function App() {
  const notesManager = useNotes();
  const themeManager = useTheme();
  const [mobileView, setMobileView] = useState(VIEW_LIST); // For mobile navigation
  const [showSidebar, setShowSidebar] = useState(true);
  const [previewNote, setPreviewNote] = useState(null);
  const [toast, setToast] = useState(null);

  const {
    notes,
    folders,
    tags,
    activeNoteId,
    activeNote,
    loading,
    error,
    stats,
    createNote,
    updateNote,
    removeNote,
    togglePin,
    toggleFavorite,
    addTag,
    removeTag,
    setActiveNoteId,
    createFolder,
    removeFolder,
    renameFolder
  } = notesManager;

  const search = useSearch({ notes, debounceMs: 150 });
  const { theme, toggleTheme } = themeManager;

  // Show toast notification
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ message, type });
    if (duration > 0) {
      setTimeout(() => setToast(null), duration);
    }
  }, []);

  // Handle note selection
  const handleSelectNote = useCallback((noteId) => {
    setActiveNoteId(noteId);
    setPreviewNote(null);
    if (window.innerWidth < 768) {
      setMobileView(VIEW_EDITOR);
    }
  }, [setActiveNoteId]);

  // Handle creating new note
  const handleCreateNote = useCallback(async () => {
    try {
      const note = await createNote({
        title: '',
        content: '',
        folderId: search.activeFilters.folderId || null
      });
      showToast('New note created', 'success');
      if (window.innerWidth < 768) {
        setMobileView(VIEW_EDITOR);
      }
      return note;
    } catch (err) {
      showToast(`Failed to create note: ${err.message}`, 'error');
      throw err;
    }
  }, [createNote, search.activeFilters.folderId, showToast]);

  // Handle delete note
  const handleDeleteNote = useCallback(async (noteId) => {
    try {
      await removeNote(noteId);
      showToast('Note deleted', 'info');
      if (window.innerWidth < 768) {
        setMobileView(VIEW_LIST);
      }
    } catch (err) {
      showToast(`Failed to delete note: ${err.message}`, 'error');
    }
  }, [removeNote, showToast]);

  // Handle preview
  const handlePreview = useCallback((note) => {
    setPreviewNote(note);
    if (window.innerWidth < 768) {
      setMobileView(VIEW_PREVIEW);
    }
  }, []);

  // Mobile navigation
  const handleBackToList = useCallback(() => {
    setMobileView(VIEW_LIST);
    setActiveNoteId(null);
    setPreviewNote(null);
  }, [setActiveNoteId]);

  // Dismiss toast
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    notesManager.setError(null);
  }, [notesManager]);

  // Determine which notes to display
  const displayNotes = search.focusedNotes.length > 0 || search.query
    ? search.focusedNotes
    : notes;

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner-large"></div>
        <p>Loading your notes...</p>
      </div>
    );
  }

  return (
    <div className={`app ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      {/* Keyboard shortcuts */}
      <KeyboardShortcuts
        onNewNote={handleCreateNote}
        onSearchFocus={() => {
          if (search.searchInputRef.current) {
            search.searchInputRef.current.focus();
          }
        }}
        onToggleSidebar={() => setShowSidebar(s => !s)}
      />

      {/* Toast notifications */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          onClick={dismissToast}
          role="alert"
          aria-live="polite"
        >
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={dismissToast} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            &times;
          </button>
        </div>
      )}

      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setShowSidebar(s => !s)}
          aria-label="Toggle sidebar"
        >
          <span className="hamburger"></span>
        </button>
        <h1 className="mobile-title">Notes</h1>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} compact />
      </header>

      <div className="app-layout">
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar
            folders={folders}
            tags={tags}
            stats={stats}
            activeFilters={search.activeFilters}
            onFilterChange={search.setFilter}
            onClearFilters={search.clearFilters}
            onCreateFolder={createFolder}
            onDeleteFolder={removeFolder}
            onRenameFolder={renameFolder}
            onCreateNote={handleCreateNote}
            onCloseMobile={() => setShowSidebar(false)}
            theme={theme}
          />
        )}

        {/* Main content area */}
        <main className="main-content">
          {/* Search bar */}
          <div className="top-bar">
            <SearchBar
              query={search.query}
              onQueryChange={search.setQuery}
              onClear={search.clearQuery}
              inputRef={search.searchInputRef}
              isSearching={search.isSearching}
              totalMatches={search.totalMatches}
              suggestions={search.suggestions}
            />
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>

          {/* View container */}
          <div className="view-container">
            {/* Note List */}
            {(mobileView === VIEW_LIST || window.innerWidth >= 768) && (
              <div className={`panel panel-list ${mobileView === VIEW_LIST ? 'panel-active' : ''}`}>
                <NoteList
                  notes={displayNotes}
                  activeNoteId={activeNoteId}
                  onSelectNote={handleSelectNote}
                  onDeleteNote={handleDeleteNote}
                  onTogglePin={togglePin}
                  onToggleFavorite={toggleFavorite}
                  onPreview={handlePreview}
                  searchQuery={search.debouncedQuery}
                  searchResults={search.searchResults.results}
                  folders={folders}
                  onCreateNote={handleCreateNote}
                />
              </div>
            )}

            {/* Note Editor */}
            {(mobileView === VIEW_EDITOR || window.innerWidth >= 768) && (
              <div className={`panel panel-editor ${mobileView === VIEW_EDITOR ? 'panel-active' : ''}`}>
                {activeNote ? (
                  <NoteEditor
                    note={activeNote}
                    onUpdate={updateNote}
                    onDelete={() => handleDeleteNote(activeNote.id)}
                    onBack={handleBackToList}
                    folders={folders}
                    allTags={tags}
                    onAddTag={(tag) => addTag(activeNote.id, tag)}
                    onRemoveTag={(tag) => removeTag(activeNote.id, tag)}
                    showToast={showToast}
                    isMobile={window.innerWidth < 768}
                  />
                ) : (
                  <div className="editor-empty">
                    <div className="editor-empty-icon">&#9998;</div>
                    <h2>Select a note to edit</h2>
                    <p>Or create a new note to get started</p>
                    <button
                      className="btn btn-primary"
                      onClick={handleCreateNote}
                    >
                      Create Note
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Note Preview */}
            {previewNote && (mobileView === VIEW_PREVIEW || window.innerWidth >= 1024) && (
              <div className={`panel panel-preview ${mobileView === VIEW_PREVIEW ? 'panel-active' : ''}`}>
                <NotePreview
                  note={previewNote}
                  onClose={() => {
                    setPreviewNote(null);
                    if (window.innerWidth < 768) {
                      setMobileView(VIEW_LIST);
                    }
                  }}
                  onEdit={() => {
                    setActiveNoteId(previewNote.id);
                    setPreviewNote(null);
                    if (window.innerWidth < 768) {
                      setMobileView(VIEW_EDITOR);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
