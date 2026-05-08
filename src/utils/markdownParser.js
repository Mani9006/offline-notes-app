/**
 * Markdown parser with syntax highlighting support.
 * Converts Markdown to HTML safely using marked and DOMPurify.
 *
 * @module markdownParser
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  headerPrefix: 'heading-',
  mangle: false,
  sanitize: false, // We use DOMPurify instead
  smartLists: true,
  smartypants: true,
  xhtml: false,
  highlight: function(code, lang) {
    if (lang && typeof window !== 'undefined' && window.hljs) {
      try {
        return window.hljs.highlight(code, { language: lang }).value;
      } catch (e) {
        return escapeHtml(code);
      }
    }
    return escapeHtml(code);
  }
});

/**
 * Parse Markdown string to sanitized HTML.
 * @param {string} markdown
 * @returns {string} Sanitized HTML
 */
export function parseMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Parse markdown to HTML
    const rawHtml = marked.parse(markdown);
    // Sanitize to prevent XSS
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 'del', 's', 'strike',
        'a', 'img',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'input', // For task lists
        'mark', 'span', 'div'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'src', 'alt', 'class',
        'id', 'target', 'rel', 'checked', 'disabled',
        'width', 'height', 'style'
      ],
      ALLOW_DATA_ATTR: false
    });
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return `<p class="parse-error">Error parsing content: ${escapeHtml(error.message)}</p>`;
  }
}

/**
 * Extract plain text from Markdown for previews.
 * @param {string} markdown
 * @param {number} maxLength
 * @returns {string}
 */
export function extractPlainText(markdown, maxLength = 200) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  const plain = markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' [code] ')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove links, keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove task list markers
    .replace(/^\s*[-*+]\s*\[.\]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse whitespace
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength && plain.length > maxLength) {
    return plain.substring(0, maxLength).trim() + '...';
  }

  return plain;
}

/**
 * Extract headings from Markdown for table of contents.
 * @param {string} markdown
 * @returns {Array<{level: number, text: string, id: string}>}
 */
export function extractHeadings(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const headings = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/\*\*/g, '').replace(/\*/g, '');
      const id = `heading-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${headings.length}`;
      headings.push({ level, text, id });
    }
  }

  return headings;
}

/**
 * Check if content contains task lists.
 * @param {string} markdown
 * @returns {boolean}
 */
export function hasTaskLists(markdown) {
  if (!markdown) return false;
  return /^\s*[-*+]\s*\[[xX\s]\]/m.test(markdown);
}

/**
 * Get task list items from content.
 * @param {string} markdown
 * @returns {Array<{text: string, completed: boolean}>}
 */
export function getTaskListItems(markdown) {
  if (!markdown) return [];

  const items = [];
  const regex = /^\s*[-*+]\s*\[([xX\s])\]\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    items.push({
      text: match[2].trim(),
      completed: match[1].toLowerCase() === 'x'
    });
  }

  return items;
}

/**
 * Insert Markdown formatting at cursor position.
 * @param {string} text - Full text
 * @param {number} start - Selection start
 * @param {number} end - Selection end
 * @param {string} format - Format type
 * @returns {{text: string, cursorStart: number, cursorEnd: number}}
 */
export function insertMarkdownFormat(text, start, end, format) {
  if (typeof text !== 'string' || start < 0 || end < 0) {
    return { text: text || '', cursorStart: start, cursorEnd: end };
  }

  const before = text.substring(0, start);
  const selected = text.substring(start, end);
  const after = text.substring(end);

  const formats = {
    bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
    italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
    strikethrough: { prefix: '~~', suffix: '~~', placeholder: 'deleted text' },
    code: { prefix: '`', suffix: '`', placeholder: 'code' },
    codeBlock: { prefix: '\n```\n', suffix: '\n```\n', placeholder: 'code block' },
    heading: { prefix: '## ', suffix: '\n', placeholder: 'Heading' },
    quote: { prefix: '> ', suffix: '\n', placeholder: 'Quote' },
    link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
    image: { prefix: '![', suffix: '](image-url)', placeholder: 'alt text' },
    unorderedList: { prefix: '- ', suffix: '\n', placeholder: 'List item' },
    orderedList: { prefix: '1. ', suffix: '\n', placeholder: 'List item' },
    taskList: { prefix: '- [ ] ', suffix: '\n', placeholder: 'Task item' },
    horizontalRule: { prefix: '\n---\n', suffix: '', placeholder: '' }
  };

  const fmt = formats[format];
  if (!fmt) {
    return { text, cursorStart: start, cursorEnd: end };
  }

  // If no selection, insert with placeholder
  const content = selected || fmt.placeholder;
  const newText = before + fmt.prefix + content + fmt.suffix + after;
  const newStart = start + fmt.prefix.length;
  const newEnd = newStart + content.length;

  return { text: newText, cursorStart: newStart, cursorEnd: newEnd };
}

/**
 * Validate Markdown content.
 * @param {string} markdown
 * @returns {{valid: boolean, issues: string[]}}
 */
export function validateMarkdown(markdown) {
  const issues = [];

  if (!markdown || typeof markdown !== 'string') {
    return { valid: false, issues: ['Content must be a non-empty string'] };
  }

  // Check for unclosed code blocks
  const codeBlockMatches = (markdown.match(/```/g) || []).length;
  if (codeBlockMatches % 2 !== 0) {
    issues.push('Unclosed code block (odd number of ```)');
  }

  // Check for unclosed emphasis
  const boldStars = (markdown.match(/\*\*/g) || []).length;
  if (boldStars % 2 !== 0) {
    issues.push('Unclosed bold markers (**)');
  }

  // Check for potential broken links
  const linkMatches = markdown.match(/\[([^\]]*)\]\(([^)]*)\)/g) || [];
  for (const link of linkMatches) {
    const urlMatch = link.match(/\[([^\]]*)\]\(([^)]*)\)/);
    if (urlMatch && (!urlMatch[2] || urlMatch[2].trim() === '')) {
      issues.push(`Empty URL in link: ${link}`);
    }
  }

  // Check for potential broken images
  const imgMatches = markdown.match(/!\[([^\]]*)\]\(([^)]*)\)/g) || [];
  for (const img of imgMatches) {
    const urlMatch = img.match(/!\[([^\]]*)\]\(([^)]*)\)/);
    if (urlMatch && (!urlMatch[2] || urlMatch[2].trim() === '')) {
      issues.push(`Empty URL in image: ${img}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Escape HTML special characters.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
