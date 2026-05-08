/**
 * NotePreview component - renders a note as formatted HTML.
 * Used for the preview panel in 3-column layout.
 */

import React, { useMemo } from 'react';
import { parseMarkdown, extractHeadings } from '../utils/markdownParser';
import { estimateReadingTime } from '../utils/readingTime';
import { exportAsMarkdown, exportAsHtml, exportAsPdf, downloadFile, shareNote } from '../utils/exporters';

const EXPORT_TYPES = {
  MARKDOWN: 'md',
  HTML: 'html',
  PDF: 'pdf'
};

/**
 * @param {Object} props
 * @param {Object} props.note
 * @param {Function} props.onClose
 * @param {Function} props.onEdit
 */
export function NotePreview({ note, onClose, onEdit }) {
  const [showExport, setShowExport] = React.useState(false);
  const [showToc, setShowToc] = React.useState(false);
  const exportRef = React.useRef(null);

  // Close export menu on outside click
  React.useEffect(() => {
    if (!showExport) return;
    const handleClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExport]);

  const htmlContent = useMemo(() => {
    if (!note || !note.content) return '';
    return parseMarkdown(note.content);
  }, [note.content]);

  const headings = useMemo(() => {
    if (!note || !note.content) return [];
    return extractHeadings(note.content);
  }, [note.content]);

  const reading = useMemo(() => {
    return estimateReadingTime(note.content || '');
  }, [note.content]);

  const formatDate = (iso) => {
    if (!iso) return 'Unknown';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const handleExport = (type) => {
    try {
      let file;
      switch (type) {
        case EXPORT_TYPES.MARKDOWN:
          file = exportAsMarkdown(note);
          break;
        case EXPORT_TYPES.HTML:
          file = exportAsHtml(note);
          break;
        case EXPORT_TYPES.PDF:
          file = exportAsPdf(note);
          break;
        default:
          return;
      }
      downloadFile(file);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setShowExport(false);
  };

  const handleShare = async () => {
    const result = await shareNote(note);
    if (result === true) {
      // Shared successfully
    } else if (result === 'clipboard') {
      // Copied to clipboard
    }
  };

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!note) return null;

  return (
    <div className="note-preview">
      {/* Preview header */}
      <div className="preview-header">
        <div className="preview-actions">
          <button
            className="preview-action-btn"
            onClick={onClose}
            aria-label="Close preview"
            title="Close preview"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            className="preview-action-btn"
            onClick={onEdit}
            aria-label="Edit note"
            title="Edit note"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {headings.length > 0 && (
            <button
              className={`preview-action-btn ${showToc ? 'active' : ''}`}
              onClick={() => setShowToc(!showToc)}
              aria-label="Table of contents"
              title="Table of contents"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          )}

          <div className="export-menu-wrapper" ref={exportRef}>
            <button
              className="preview-action-btn"
              onClick={() => setShowExport(!showExport)}
              aria-label="Export note"
              title="Export note"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showExport && (
              <div className="export-dropdown">
                <button onClick={() => handleExport(EXPORT_TYPES.MARKDOWN)}>
                  Export as Markdown
                </button>
                <button onClick={() => handleExport(EXPORT_TYPES.HTML)}>
                  Export as HTML
                </button>
                <button onClick={() => handleExport(EXPORT_TYPES.PDF)}>
                  Export as Print/PDF
                </button>
                <hr />
                <button onClick={handleShare}>
                  Share...
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      {showToc && headings.length > 0 && (
        <nav className="preview-toc">
          <h4>Contents</h4>
          <ul>
            {headings.map((h, i) => (
              <li key={i} className={`toc-level-${h.level}`}>
                <button onClick={() => scrollToHeading(h.id)}>
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Preview meta */}
      <div className="preview-meta">
        <h1 className="preview-title">{note.title || 'Untitled'}</h1>
        <div className="preview-meta-details">
          <span>Created: {formatDate(note.createdAt)}</span>
          <span>Updated: {formatDate(note.updatedAt)}</span>
          <span>{reading.formatted}</span>
        </div>
        {note.tags && note.tags.length > 0 && (
          <div className="preview-tags">
            {note.tags.map(tag => (
              <span key={tag} className="preview-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Rendered content */}
      <article
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
