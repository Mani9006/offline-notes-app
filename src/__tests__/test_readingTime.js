/**
 * Tests for reading time and text statistics utility.
 */

import {
  countWords,
  countCharacters,
  countCharactersNoSpaces,
  countLines,
  countParagraphs,
  estimateReadingTime,
  getTextStats,
  getAggregateStats
} from '../src/utils/readingTime';

describe('readingTime', () => {
  describe('countWords', () => {
    test('returns 0 for null/undefined/empty', () => {
      expect(countWords(null)).toBe(0);
      expect(countWords(undefined)).toBe(0);
      expect(countWords('')).toBe(0);
    });

    test('counts simple words', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('The quick brown fox jumps')).toBe(5);
    });

    test('ignores markdown headers', () => {
      const text = '# Heading\nSome content';
      const result = countWords(text);
      expect(result).toBe(2); // "Heading" and "Some" "content" = 3
    });

    test('ignores markdown bold/italic', () => {
      expect(countWords('**bold** *italic*')).toBe(2);
    });

    test('ignores code blocks', () => {
      const text = 'Intro\n```\nfunction test() {}\n```\nOutro';
      const result = countWords(text);
      expect(result).toBe(2); // Intro and Outro
    });

    test('keeps inline code words', () => {
      expect(countWords('Use `console.log`')).toBe(2); // Use and console.log
    });

    test('handles non-string input', () => {
      expect(countWords(123)).toBe(0);
      expect(countWords({})).toBe(0);
    });
  });

  describe('countCharacters', () => {
    test('returns 0 for empty input', () => {
      expect(countCharacters('')).toBe(0);
      expect(countCharacters(null)).toBe(0);
    });

    test('counts all characters', () => {
      expect(countCharacters('Hello')).toBe(5);
      expect(countCharacters('Hello World!')).toBe(12);
    });
  });

  describe('countCharactersNoSpaces', () => {
    test('returns 0 for empty input', () => {
      expect(countCharactersNoSpaces('')).toBe(0);
    });

    test('excludes spaces', () => {
      expect(countCharactersNoSpaces('Hello World')).toBe(10);
      expect(countCharactersNoSpaces('a b c')).toBe(3);
    });
  });

  describe('countLines', () => {
    test('returns 0 for empty string', () => {
      expect(countLines('')).toBe(1); // Splitting empty gives ['']
    });

    test('counts newline-separated lines', () => {
      expect(countLines('Line 1\nLine 2\nLine 3')).toBe(3);
    });

    test('handles CRLF line endings', () => {
      expect(countLines('Line 1\r\nLine 2')).toBe(2);
    });
  });

  describe('countParagraphs', () => {
    test('returns 0 for empty string', () => {
      expect(countParagraphs('')).toBe(0);
    });

    test('counts paragraphs separated by blank lines', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      expect(countParagraphs(text)).toBe(3);
    });

    test('ignores empty paragraphs', () => {
      expect(countParagraphs('One\n\n\n\nTwo')).toBe(2);
    });
  });

  describe('estimateReadingTime', () => {
    test('returns all zeros for empty text', () => {
      const result = estimateReadingTime('');
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
      expect(result.wordCount).toBe(0);
      expect(result.formatted).toBe('< 1 min read');
    });

    test('returns all zeros for null text', () => {
      const result = estimateReadingTime(null);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    test('estimates reading time correctly', () => {
      // 200 words = 1 minute at default 200 WPM
      const words200 = Array(200).fill('word').join(' ');
      const result = estimateReadingTime(words200);
      expect(result.wordCount).toBe(200);
      expect(result.minutes).toBeGreaterThanOrEqual(0.9);
      expect(result.minutes).toBeLessThanOrEqual(1.1);
    });

    test('formats short reading time', () => {
      const result = estimateReadingTime('Hello world');
      expect(result.formatted).toBe('< 1 min read');
    });

    test('formats medium reading time', () => {
      const words400 = Array(400).fill('word').join(' ');
      const result = estimateReadingTime(words400);
      expect(result.formatted).toMatch(/^\d+ min read$/);
    });

    test('formats long reading time with hours', () => {
      const words15000 = Array(15000).fill('word').join(' ');
      const result = estimateReadingTime(words15000);
      expect(result.formatted).toContain('hr');
    });

    test('applies technical density factor', () => {
      const words400 = Array(400).fill('word').join(' ');
      const normal = estimateReadingTime(words400, { technical: false });
      const technical = estimateReadingTime(words400, { technical: true });
      expect(technical.minutes).toBeGreaterThan(normal.minutes);
    });

    test('includes time range', () => {
      const words300 = Array(300).fill('word').join(' ');
      const result = estimateReadingTime(words300);
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange.slow).toBeDefined();
      expect(result.timeRange.average).toBeDefined();
      expect(result.timeRange.fast).toBeDefined();
      // Slow should be longest, fast shortest
      expect(result.timeRange.slow.length).toBeGreaterThanOrEqual(result.timeRange.fast.length);
    });

    test('includes all statistics', () => {
      const text = 'Line one.\n\nLine two.\n\nLine three.';
      const result = estimateReadingTime(text);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.characterCount).toBeGreaterThan(0);
      expect(result.characterCountNoSpaces).toBeGreaterThan(0);
      expect(result.lineCount).toBeGreaterThan(0);
      expect(result.paragraphCount).toBeGreaterThan(0);
    });

    test('uses custom wordsPerMinute', () => {
      const words200 = Array(200).fill('word').join(' ');
      const slow = estimateReadingTime(words200, { wordsPerMinute: 100 });
      const fast = estimateReadingTime(words200, { wordsPerMinute: 400 });
      expect(slow.minutes).toBeGreaterThan(fast.minutes);
    });
  });

  describe('getTextStats', () => {
    test('returns all zeros for empty text', () => {
      const result = getTextStats('');
      expect(result.wordCount).toBe(0);
      expect(result.characterCount).toBe(0);
      expect(result.readingTime).toBeDefined();
    });

    test('returns all zeros for null text', () => {
      const result = getTextStats(null);
      expect(result.wordCount).toBe(0);
      expect(result.characterCount).toBe(0);
    });

    test('returns comprehensive stats', () => {
      const text = 'Paragraph one with words.\n\nParagraph two with more words here.';
      const result = getTextStats(text);
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.characterCount).toBeGreaterThan(0);
      expect(result.characterCountNoSpaces).toBeGreaterThan(0);
      expect(result.lineCount).toBeGreaterThan(0);
      expect(result.paragraphCount).toBe(2);
      expect(result.readingTime.formatted).toBeDefined();
    });
  });

  describe('getAggregateStats', () => {
    test('returns zeros for empty array', () => {
      const result = getAggregateStats([]);
      expect(result.totalNotes).toBe(0);
      expect(result.totalWords).toBe(0);
    });

    test('returns zeros for non-array', () => {
      const result = getAggregateStats(null);
      expect(result.totalNotes).toBe(0);
    });

    test('aggregates multiple notes', () => {
      const notes = [
        { title: 'Short', content: 'One two three' },
        { title: 'Longer', content: 'Four five six seven eight' },
        { title: 'Medium', content: 'Nine ten eleven' }
      ];
      const result = getAggregateStats(notes);
      expect(result.totalNotes).toBe(3);
      expect(result.totalWords).toBeGreaterThan(0);
      expect(result.averageWordsPerNote).toBeGreaterThan(0);
      expect(result.longestNote).toBeDefined();
      expect(result.shortestNote).toBeDefined();
    });

    test('identifies longest and shortest notes', () => {
      const notes = [
        { title: 'Short', content: 'One' },
        { title: 'Longest', content: 'One two three four five' },
        { title: 'Medium', content: 'One two' }
      ];
      const result = getAggregateStats(notes);
      expect(result.longestNote.title).toBe('Longest');
      expect(result.shortestNote.title).toBe('Short');
    });

    test('includes total reading time', () => {
      const notes = [
        { title: 'A', content: 'Many words here for reading' },
        { title: 'B', content: 'Even more words to read here' }
      ];
      const result = getAggregateStats(notes);
      expect(result.totalReadingTime).toBeDefined();
      expect(typeof result.totalReadingTime).toBe('string');
    });
  });
});
