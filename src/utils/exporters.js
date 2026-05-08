/**
 * Export utilities for notes.
 * Supports Markdown, HTML, and PDF simulation exports.
 *
 * @module exporters
 */

import { parseMarkdown } from './markdownParser';
import { extractPlainText } from './markdownParser';
import { estimateReadingTime } from './readingTime';

/**
 * Export a single note as Markdown.
 * @param {Object} note
 * @returns {{filename: string, content: string, mimeType: string}}
 */
export function exportAsMarkdown(note) {
  if (!note || typeof note !== 'object') {
    throw new TypeError('Note must be a valid object');
  }

  const title = note.title || 'Untitled';
  const tags = (note.tags || []).map(t => `#${t}`).join(' ');
  const reading = estimateReadingTime(note.content || '');

  const content = `# ${title}

> **Created:** ${formatDate(note.createdAt)}
> **Updated:** ${formatDate(note.updatedAt)}
> **Reading time:** ${reading.formatted}
${tags ? `> **Tags:** ${tags}` : ''}

---

${note.content || ''}
`;

  return {
    filename: `${sanitizeFilename(title)}.md`,
    content,
    mimeType: 'text/markdown; charset=utf-8'
  };
}

/**
 * Export multiple notes as a single Markdown document.
 * @param {Array} notes
 * @returns {{filename: string, content: string, mimeType: string}}
 */
export function exportAsMarkdownBundle(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    throw new TypeError('Notes must be a non-empty array');
  }

  const now = new Date().toISOString();
  const totalReading = estimateReadingTime(
    notes.map(n => n.content || '').join('\n\n')
  );

  let content = `# Notes Export

> **Export date:** ${formatDate(now)}
> **Total notes:** ${notes.length}
> **Total reading time:** ${totalReading.formatted}

---

`;

  notes.forEach((note, index) => {
    const tags = (note.tags || []).map(t => `#${t}`).join(' ');
    content += `## ${index + 1}. ${note.title || 'Untitled'}

> Updated: ${formatDate(note.updatedAt)}${tags ? ` | Tags: ${tags}` : ''}

${note.content || ''}

---

`;
  });

  return {
    filename: `notes-export-${formatDateShort(now)}.md`,
    content,
    mimeType: 'text/markdown; charset=utf-8'
  };
}

/**
 * Export a note as HTML.
 * @param {Object} note
 * @param {Object} options
 * @returns {{filename: string, content: string, mimeType: string}}
 */
export function exportAsHtml(note, options = {}) {
  if (!note || typeof note !== 'object') {
    throw new TypeError('Note must be a valid object');
  }

  const { includeStyles = true } = options;
  const title = note.title || 'Untitled';
  const tags = (note.tags || []).map(t =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join('');
  const reading = estimateReadingTime(note.content || '');
  const bodyHtml = parseMarkdown(note.content || '');

  const styles = includeStyles ? `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.7;
    color: #333;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
    background: #fff;
  }
  h1 { font-size: 2em; margin-bottom: 0.5em; color: #1a1a2e; }
  h2 { font-size: 1.5em; margin: 1em 0 0.5em; color: #1a1a2e; }
  h3 { font-size: 1.2em; margin: 0.8em 0 0.4em; }
  p { margin-bottom: 0.8em; }
  pre {
    background: #f4f4f5;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }
  code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 0.9em;
  }
  pre code { padding: 0; background: none; }
  blockquote {
    border-left: 4px solid #6366f1;
    padding-left: 16px;
    margin: 1em 0;
    color: #666;
  }
  ul, ol { margin: 0.8em 0 0.8em 2em; }
  a { color: #6366f1; text-decoration: none; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  th, td {
    border: 1px solid #e5e7eb;
    padding: 8px 12px;
    text-align: left;
  }
  th { background: #f9fafb; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  .meta {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0 24px;
    font-size: 0.9em;
    color: #666;
  }
  .meta p { margin: 4px 0; }
  .tags { margin-top: 8px; }
  .tag {
    display: inline-block;
    background: #eef2ff;
    color: #6366f1;
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 0.85em;
    margin-right: 6px;
  }
</style>` : '';

  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <p><strong>Created:</strong> ${formatDate(note.createdAt)}</p>
    <p><strong>Updated:</strong> ${formatDate(note.updatedAt)}</p>
    <p><strong>Reading time:</strong> ${reading.formatted}</p>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
  </div>
  <article>${bodyHtml}</article>
</body>
</html>`;

  return {
    filename: `${sanitizeFilename(title)}.html`,
    content,
    mimeType: 'text/html; charset=utf-8'
  };
}

/**
 * Export a note as a simulated PDF (styled HTML that prints well).
 * @param {Object} note
 * @returns {{filename: string, content: string, mimeType: string}}
 */
export function exportAsPdf(note) {
  if (!note || typeof note !== 'object') {
    throw new TypeError('Note must be a valid object');
  }

  const title = note.title || 'Untitled';
  const tags = (note.tags || []).map(t =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join('');
  const reading = estimateReadingTime(note.content || '');
  const bodyHtml = parseMarkdown(note.content || '');

  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      max-width: 100%;
    }
    h1 {
      font-size: 22pt;
      margin-bottom: 12pt;
      color: #000;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      margin: 14pt 0 8pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      margin: 10pt 0 6pt;
      page-break-after: avoid;
    }
    p { margin-bottom: 8pt; }
    pre {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 10pt;
      border-radius: 3pt;
      overflow-x: auto;
      margin: 8pt 0;
      page-break-inside: avoid;
      font-size: 9pt;
    }
    code {
      font-family: 'Courier New', Courier, monospace;
    }
    blockquote {
      border-left: 3pt solid #333;
      padding-left: 12pt;
      margin: 8pt 0;
      font-style: italic;
    }
    ul, ol { margin: 8pt 0 8pt 24pt; }
    li { margin-bottom: 3pt; }
    a { color: #000; text-decoration: underline; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8pt 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 0.5pt solid #333;
      padding: 5pt 8pt;
      text-align: left;
    }
    th { background: #f0f0f0; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    .meta {
      border: 0.5pt solid #999;
      padding: 8pt;
      margin: 10pt 0 16pt;
      font-size: 9pt;
      color: #333;
      page-break-inside: avoid;
    }
    .meta p { margin: 2pt 0; }
    .tag {
      display: inline-block;
      border: 0.5pt solid #666;
      padding: 1pt 6pt;
      border-radius: 10pt;
      font-size: 8pt;
      margin-right: 4pt;
    }
    article { page-break-before: auto; }
    h1, h2, h3, tr, img, pre, blockquote, .meta {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <p><strong>Created:</strong> ${formatDate(note.createdAt)}</p>
    <p><strong>Updated:</strong> ${formatDate(note.updatedAt)}</p>
    <p><strong>Reading time:</strong> ${reading.formatted}</p>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
  </div>
  <article>${bodyHtml}</article>
</body>
</html>`;

  return {
    filename: `${sanitizeFilename(title)}.pdf.html`,
    content,
    mimeType: 'text/html; charset=utf-8'
  };
}

/**
 * Export notes as JSON.
 * @param {Array|Object} data
 * @returns {{filename: string, content: string, mimeType: string}}
 */
export function exportAsJson(data) {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };

  const isArray = Array.isArray(data);
  const count = isArray ? data.length : 1;
  const date = formatDateShort(new Date().toISOString());

  return {
    filename: `notes-data-${count}-${date}.json`,
    content: JSON.stringify(exportData, null, 2),
    mimeType: 'application/json; charset=utf-8'
  };
}

/**
 * Trigger file download in browser.
 * @param {{filename: string, content: string, mimeType: string}} file
 */
export function downloadFile(file) {
  if (!file || !file.content) return;

  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Share a note using the Web Share API (if available).
 * @param {Object} note
 * @returns {Promise<boolean>}
 */
export async function shareNote(note) {
  if (!note) return false;

  const title = note.title || 'Untitled';
  const text = extractPlainText(note.content || '', 500);
  const file = exportAsMarkdown(note);

  if (navigator.share && navigator.canShare) {
    try {
      const shareData = {
        title,
        text: text.substring(0, 200),
      };

      // Try sharing as file if supported
      try {
        const blob = new Blob([file.content], { type: file.mimeType });
        const shareFile = new File([blob], file.filename, { type: file.mimeType });
        shareData.files = [shareFile];
      } catch (e) {
        // File sharing not supported, continue without it
      }

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share failed:', e);
      }
      return false;
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(file.content);
    return 'clipboard';
  } catch (e) {
    console.error('Clipboard fallback failed:', e);
    return false;
  }
}

// ==================== HELPERS ====================

function sanitizeFilename(name) {
  return (name || 'untitled')
    .replace(/[<>\\/:*?"|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100) || 'untitled';
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

function formatDateShort(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
