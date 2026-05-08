/**
 * KeyboardShortcuts component - handles global keyboard shortcuts.
 * Displays a shortcuts help modal on '?' key.
 */

import React, { useState, useEffect, useCallback } from 'react';

const SHORTCUTS = [
  { key: 'Ctrl+N', description: 'Create new note' },
  { key: 'Ctrl+S', description: 'Save current note' },
  { key: 'Ctrl+F', description: 'Focus search' },
  { key: 'Ctrl+B', description: 'Bold text' },
  { key: 'Ctrl+I', description: 'Italic text' },
  { key: 'Ctrl+K', description: 'Insert link' },
  { key: 'Ctrl+Shift+P', description: 'Toggle preview' },
  { key: 'Ctrl+\\', description: 'Toggle sidebar' },
  { key: 'Ctrl+Shift+D', description: 'Toggle dark mode' },
  { key: 'Escape', description: 'Close modal / clear search' },
  { key: '?', description: 'Show keyboard shortcuts' }
];

/**
 * @param {Object} props
 * @param {Function} props.onNewNote
 * @param {Function} props.onSearchFocus
 * @param {Function} props.onToggleSidebar
 */
export function KeyboardShortcuts({ onNewNote, onSearchFocus, onToggleSidebar }) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e) => {
    // Don't trigger shortcuts when typing in input/textarea
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      document.activeElement?.isContentEditable;

    const isCtrl = e.ctrlKey || e.metaKey;

    // Show help with '?' (not when typing)
    if (e.key === '?' && !isCtrl && !isTyping) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Close help with Escape
    if (e.key === 'Escape' && showHelp) {
      e.preventDefault();
      setShowHelp(false);
      return;
    }

    // Ctrl+N - New note
    if (isCtrl && e.key === 'n') {
      e.preventDefault();
      onNewNote?.();
      return;
    }

    // Ctrl+S - Save (handled by editor, but also here)
    if (isCtrl && e.key === 's') {
      e.preventDefault();
      // The editor auto-saves, but this could trigger immediate save
      return;
    }

    // Ctrl+F - Search focus
    if (isCtrl && e.key === 'f') {
      e.preventDefault();
      onSearchFocus?.();
      return;
    }

    // Ctrl+\ - Toggle sidebar
    if (isCtrl && e.key === '\\') {
      e.preventDefault();
      onToggleSidebar?.();
      return;
    }
  }, [showHelp, onNewNote, onSearchFocus, onToggleSidebar]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) return null;

  return (
    <div
      className="shortcuts-modal-overlay"
      onClick={() => setShowHelp(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <button
            className="shortcuts-close"
            onClick={() => setShowHelp(false)}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="shortcuts-list">
          {SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="shortcut-row">
              <kbd className="shortcut-key">{shortcut.key}</kbd>
              <span className="shortcut-desc">{shortcut.description}</span>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <p>Press <kbd>?</kbd> to toggle this help dialog</p>
          <p>Press <kbd>Escape</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
