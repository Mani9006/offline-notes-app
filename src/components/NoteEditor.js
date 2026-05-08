/**
 * NoteEditor component - full-featured markdown editor with preview, toolbar, and stats.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TagManager } from './TagManager';
import { insertMarkdownFormat } from '../utils/markdownParser';
import { estimateReadingTime } from '../utils/readingTime';
import { exportAsMarkdown, exportAsHtml, exportAsPdf, downloadFile } from '../utils/exporters';

const EXPORT_TYPES = {
  MARKDOWN: 'md',
  HTML: 'html',
  PDF: 'pdf'
};

/**
 * @param {Object} props
 */
export function NoteEditor({
  note,
  onUpdate,
  onDelete,
  onBack,
  folders,
  allTags,
  onAddTag,
  onRemoveTag,
  showToast,
  isMobile
}) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [showPreview, setShowPreview] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(note.updatedAt);
  const textareaRef = useRef(null);
  const exportMenuRef = useRef(null);
  const saveTimerRef = useRef(null);

  // Sync with note prop changes
  useEffect(() => {
    setTitle(note.title || '');
    setContent(note.content || '');
    setLastSaved(note.updatedAt);
  }, [note.id, note.title, note.content, note.updatedAt]);

  // Auto-save with debounce
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const originalTitle = note.title || '';
      const originalContent = note.content || '';

      if (title !== originalTitle || content !== originalContent) {
        try {
          setSaving(true);
          await onUpdate(note.id, { title, content });
          setLastSaved(new Date().toISOString());
        } catch (err) {
          showToast?.(`Auto-save failed: ${err.message}`, 'error');
        } finally {
          setSaving(false);
        }
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, note.id, note.title, note.content, onUpdate, showToast]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  const handleTitleChange = useCallback((e) => {
    setTitle(e.target.value);
  }, []);

  const handleContentChange = useCallback((e) => {
    setContent(e.target.value);
  }, []);

  const handleManualSave = useCallback(async () => {
    try {
      setSaving(true);
      await onUpdate(note.id, { title, content });
      setLastSaved(new Date().toISOString());
      showToast?.('Note saved', 'success');
    } catch (err) {
      showToast?.(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [note.id, title, content, onUpdate, showToast]);

  const handleFormat = useCallback((format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const result = insertMarkdownFormat(content, start, end, format);
    setContent(result.text);

    // Restore cursor position after re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.cursorStart, result.cursorEnd);
    });
  }, [content]);

  const handleExport = useCallback((type) => {
    try {
      const noteToExport = { ...note, title, content };
      let file;

      switch (type) {
        case EXPORT_TYPES.MARKDOWN:
          file = exportAsMarkdown(noteToExport);
          break;
        case EXPORT_TYPES.HTML:
          file = exportAsHtml(noteToExport);
          break;
        case EXPORT_TYPES.PDF:
          file = exportAsPdf(noteToExport);
          break;
        default:
          return;
      }

      downloadFile(file);
      showToast?.(`Exported as ${type.toUpperCase()}`, 'success');
    } catch (err) {
      showToast?.(`Export failed: ${err.message}`, 'error');
    }
    setShowExportMenu(false);
  }, [note, title, content, showToast]);

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this note? This cannot be undone.')) {
      onDelete();
    }
  }, [onDelete]);

  const handleKeyDown = useCallback((e) => {
    // Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Outdent
        const before = content.substring(0, start);
        const after = content.substring(end);
        const lines = before.split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.startsWith('  ')) {
          lines[lines.length - 1] = lastLine.substring(2);
          const newBefore = lines.join('\n');
          setContent(newBefore + after);
          requestAnimationFrame(() => {
            textarea.setSelectionRange(start - 2, end - 2);
          });
        } else if (lastLine.startsWith('\t')) {
          lines[lines.length - 1] = lastLine.substring(1);
          const newBefore = lines.join('\n');
          setContent(newBefore + after);
          requestAnimationFrame(() => {
            textarea.setSelectionRange(start - 1, end - 1);
          });
        }
      } else {
        // Indent
        const before = content.substring(0, start);
        const after = content.substring(end);
        setContent(before + '  ' + after);
        requestAnimationFrame(() => {
          textarea.setSelectionRange(start + 2, end + 2);
        });
      }
    }
  }, [content]);

  const readingStats = estimateReadingTime(content);
  const isDirty = title !== (note.title || '') || content !== (note.content || '');

  return (
    <div className="note-editor">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          {isMobile && (
            <button
              className="toolbar-btn"
              onClick={onBack}
              aria-label="Back to list"
              title="Back to list"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          )}

          <button className="toolbar-btn" onClick={() => handleFormat('bold')} title="Bold (Ctrl+B)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('italic')} title="Italic (Ctrl+I)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="4" x2="10" y2="4" />
              <line x1="14" y1="20" x2="5" y2="20" />
              <line x1="15" y1="4" x2="9" y2="20" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('code')} title="Inline Code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('codeBlock')} title="Code Block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <polyline points="7 8 7 16" />
              <polyline points="12 11 12 16" />
              <polyline points="17 8 17 16" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('heading')} title="Heading">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h8M4 18V6M12 18V6M17 12h3m0 0v6m0-6l-4-3.5" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('unorderedList')} title="Bullet List">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('link')} title="Link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <button className="toolbar-btn" onClick={() => handleFormat('quote')} title="Quote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
            </svg>
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          <div className="export-menu-wrapper" ref={exportMenuRef}>
            <button
              className="toolbar-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button onClick={() => handleExport(EXPORT_TYPES.MARKDOWN)}>
                  <span>Markdown (.md)</span>
                </button>
                <button onClick={() => handleExport(EXPORT_TYPES.HTML)}>
                  <span>HTML (.html)</span>
                </button>
                <button onClick={() => handleExport(EXPORT_TYPES.PDF)}>
                  <span>Print/PDF (.html)</span>
                </button>
              </div>
            )}
          </div>

          <button className="toolbar-btn" onClick={handleDelete} title="Delete note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        className="editor-title"
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={handleTitleChange}
        aria-label="Note title"
        maxLength={200}
      />

      {/* Tags */}
      <div className="editor-tags">
        <TagManager
          tags={allTags}
          noteTags={note.tags || []}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          readOnly={false}
        />
      </div>

      {/* Content editor area */}
      <div className={`editor-body ${showPreview ? 'editor-split' : ''}`}>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          placeholder="Write your note in Markdown..."
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          aria-label="Note content"
          spellCheck={true}
        />

        {showPreview && (
          <NotePreviewPane content={content} />
        )}
      </div>

      {/* Bottom status bar */}
      <div className="editor-status-bar">
        <div className="status-left">
          <span className="status-item" title="Word count">
            {readingStats.wordCount} words
          </span>
          <span className="status-item" title="Character count">
            {readingStats.characterCount} chars
          </span>
          <span className="status-item" title="Reading time">
            {readingStats.formatted}
          </span>
          <span className="status-item" title="Lines">
            {readingStats.lineCount} lines
          </span>
        </div>
        <div className="status-right">
          {saving && (
            <span className="status-saving">
              <span className="spinner-sm"></span>
              Saving...
            </span>
          )}
          {!saving && !isDirty && (
            <span className="status-saved">
              Saved
            </span>
          )}
          {!saving && isDirty && (
            <span className="status-unsaved">
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline preview pane for the editor.
 */
function NotePreviewPane({ content }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;
    const renderPreview = async () => {
      try {
        const { parseMarkdown } = await import('../utils/markdownParser');
        const result = parseMarkdown(content);
        if (!cancelled) setHtml(result);
      } catch {
        if (!cancelled) setHtml('<p>Error rendering preview</p>');
      }
    };
    renderPreview();
    return () => { cancelled = true; };
  }, [content]);

  return (
    <div
      className="editor-preview-pane"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
