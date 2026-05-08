/**
 * Tests for markdown parser utility.
 */

import {
  extractPlainText,
  extractHeadings,
  hasTaskLists,
  getTaskListItems,
  insertMarkdownFormat,
  validateMarkdown
} from '../src/utils/markdownParser';

describe('markdownParser', () => {
  describe('extractPlainText', () => {
    test('returns empty string for null/undefined', () => {
      expect(extractPlainText(null)).toBe('');
      expect(extractPlainText(undefined)).toBe('');
      expect(extractPlainText('')).toBe('');
    });

    test('strips headers', () => {
      const md = '# Hello World\nSome text';
      expect(extractPlainText(md)).toBe('Hello World Some text');
    });

    test('strips bold and italic', () => {
      const md = 'This is **bold** and *italic* text';
      expect(extractPlainText(md)).toBe('This is bold and italic text');
    });

    test('strips code blocks', () => {
      const md = 'Some text\n```\ncode here\n```\nMore text';
      const result = extractPlainText(md);
      expect(result).toContain('Some text');
      expect(result).toContain('More text');
      expect(result).not.toContain('```');
    });

    test('strips inline code', () => {
      const md = 'Use `console.log()` for debugging';
      expect(extractPlainText(md)).toBe('Use console.log() for debugging');
    });

    test('strips links but keeps text', () => {
      const md = 'Visit [Google](https://google.com) now';
      expect(extractPlainText(md)).toBe('Visit Google now');
    });

    test('strips images', () => {
      const md = 'Text ![alt](image.png) more text';
      expect(extractPlainText(md)).toBe('Text more text');
    });

    test('strips blockquotes', () => {
      const md = '> This is a quote\nNormal text';
      expect(extractPlainText(md)).toContain('This is a quote');
      expect(extractPlainText(md)).not.toContain('>');
    });

    test('respects maxLength and adds ellipsis', () => {
      const md = 'This is a very long text that exceeds the limit';
      const result = extractPlainText(md, 20);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    test('strips horizontal rules', () => {
      const md = 'Before\n---\nAfter';
      expect(extractPlainText(md)).toBe('Before After');
    });
  });

  describe('extractHeadings', () => {
    test('returns empty array for empty content', () => {
      expect(extractHeadings('')).toEqual([]);
      expect(extractHeadings(null)).toEqual([]);
    });

    test('extracts headings with levels', () => {
      const md = '# H1\n## H2\n### H3\nNo heading\n#### H4';
      const headings = extractHeadings(md);
      expect(headings.length).toBe(4);
      expect(headings[0]).toMatchObject({ level: 1, text: 'H1' });
      expect(headings[1]).toMatchObject({ level: 2, text: 'H2' });
      expect(headings[2]).toMatchObject({ level: 3, text: 'H3' });
      expect(headings[3]).toMatchObject({ level: 4, text: 'H4' });
    });

    test('generates unique IDs', () => {
      const md = '# Test\n# Test';
      const headings = extractHeadings(md);
      expect(headings[0].id).not.toBe(headings[1].id);
    });

    test('strips formatting from heading text', () => {
      const md = '## **Bold** Title';
      const headings = extractHeadings(md);
      expect(headings[0].text).toBe('Bold Title');
    });
  });

  describe('hasTaskLists', () => {
    test('returns false for empty content', () => {
      expect(hasTaskLists('')).toBe(false);
      expect(hasTaskLists(null)).toBe(false);
    });

    test('detects task list items', () => {
      expect(hasTaskLists('- [ ] unchecked')).toBe(true);
      expect(hasTaskLists('- [x] checked')).toBe(true);
      expect(hasTaskLists('* [ ] star list')).toBe(true);
      expect(hasTaskLists('+ [ ] plus list')).toBe(true);
    });

    test('returns false for regular lists', () => {
      expect(hasTaskLists('- item')).toBe(false);
      expect(hasTaskLists('* item')).toBe(false);
      expect(hasTaskLists('1. item')).toBe(false);
    });
  });

  describe('getTaskListItems', () => {
    test('returns empty array for empty content', () => {
      expect(getTaskListItems('')).toEqual([]);
      expect(getTaskListItems(null)).toEqual([]);
    });

    test('extracts task items with completion status', () => {
      const md = '- [ ] First task\n- [x] Second task\n- [X] Third task';
      const items = getTaskListItems(md);
      expect(items.length).toBe(3);
      expect(items[0]).toEqual({ text: 'First task', completed: false });
      expect(items[1]).toEqual({ text: 'Second task', completed: true });
      expect(items[2]).toEqual({ text: 'Third task', completed: true });
    });
  });

  describe('insertMarkdownFormat', () => {
    test('returns original for invalid input', () => {
      expect(insertMarkdownFormat(null, 0, 0, 'bold').text).toBe('');
      expect(insertMarkdownFormat(undefined, 0, 0, 'bold').text).toBe('');
    });

    test('inserts bold format', () => {
      const result = insertMarkdownFormat('text', 0, 4, 'bold');
      expect(result.text).toBe('**text**');
      expect(result.cursorStart).toBe(2);
      expect(result.cursorEnd).toBe(6);
    });

    test('inserts italic format', () => {
      const result = insertMarkdownFormat('text', 0, 4, 'italic');
      expect(result.text).toBe('*text*');
    });

    test('inserts code format', () => {
      const result = insertMarkdownFormat('text', 0, 4, 'code');
      expect(result.text).toBe('`text`');
    });

    test('inserts link format', () => {
      const result = insertMarkdownFormat('link text', 0, 9, 'link');
      expect(result.text).toBe('[link text](url)');
    });

    test('inserts heading format', () => {
      const result = insertMarkdownFormat('Heading', 0, 7, 'heading');
      expect(result.text).toBe('## Heading\n');
    });

    test('uses placeholder when no selection', () => {
      const result = insertMarkdownFormat('', 0, 0, 'bold');
      expect(result.text).toBe('**bold text**');
      expect(result.cursorStart).toBe(2);
      expect(result.cursorEnd).toBe(10);
    });

    test('returns original for unknown format', () => {
      const result = insertMarkdownFormat('text', 0, 4, 'unknown');
      expect(result.text).toBe('text');
    });
  });

  describe('validateMarkdown', () => {
    test('validates null/undefined', () => {
      const result = validateMarkdown(null);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('returns valid for well-formed markdown', () => {
      const md = '# Title\n\nSome **bold** text.\n\n```\ncode\n```';
      const result = validateMarkdown(md);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    test('detects unclosed code blocks', () => {
      const md = '```\ncode without closing';
      const result = validateMarkdown(md);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('code block'))).toBe(true);
    });

    test('detects unclosed bold markers', () => {
      const md = '**unclosed bold';
      const result = validateMarkdown(md);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('bold'))).toBe(true);
    });

    test('detects empty URLs in links', () => {
      const md = '[text]()';
      const result = validateMarkdown(md);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Empty URL'))).toBe(true);
    });

    test('detects empty URLs in images', () => {
      const md = '![alt]()';
      const result = validateMarkdown(md);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Empty URL'))).toBe(true);
    });
  });
});
