/**
 * Reading time estimation utilities
 * Calculates word counts, character counts, and estimated reading time.
 *
 * @module readingTime
 */

// Average reading speeds
const WORDS_PER_MINUTE = 200;     // Average adult reading speed
const WORDS_PER_MINUTE_SLOW = 150;  // Careful reading
const WORDS_PER_MINUTE_FAST = 300;  // Skimming
const TECHNICAL_DENSITY_FACTOR = 1.2; // Technical content takes longer

/**
 * Count words in a text string.
 * Handles Markdown content by stripping formatting.
 *
 * @param {string} text - The text to count
 * @returns {number} - Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Remove Markdown syntax
  const cleanText = text
    .replace(/^#{1,6}\s+/gm, '')           // Headers
    .replace(/\*\*(.+?)\*\*/g, '$1')       // Bold
    .replace(/\*(.+?)\*/g, '$1')           // Italic
    .replace(/`(.+?)`/g, '$1')             // Inline code
    .replace(/```[\s\S]*?```/g, '')        // Code blocks
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')    // Links
    .replace(/!\[.*?\]\(.*?\)/g, '')       // Images
    .replace(/>\s+/gm, '')                 // Blockquotes
    .replace(/[-*+]\s+/gm, '')             // List markers
    .replace(/\d+\.\s+/gm, '')             // Numbered lists
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .trim();

  if (!cleanText) return 0;

  // Count words by splitting on whitespace
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Count characters in text.
 * @param {string} text
 * @returns {number}
 */
export function countCharacters(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.length;
}

/**
 * Count characters excluding whitespace.
 * @param {string} text
 * @returns {number}
 */
export function countCharactersNoSpaces(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.replace(/\s/g, '').length;
}

/**
 * Count lines in text.
 * @param {string} text
 * @returns {number}
 */
export function countLines(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  const lines = text.split(/\r?\n/);
  return lines.length;
}

/**
 * Count paragraphs in text.
 * @param {string} text
 * @returns {number}
 */
export function countParagraphs(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.split(/\n\s*\n/)
    .filter(p => p.trim().length > 0)
    .length;
}

/**
 * Estimate reading time for a given text.
 *
 * @param {string} text - The text to analyze
 * @param {Object} options - Configuration options
 * @param {number} options.wordsPerMinute - Reading speed (default: 200)
 * @param {boolean} options.technical - Whether content is technical (default: false)
 * @returns {Object} - Reading time estimate details
 */
export function estimateReadingTime(text, options = {}) {
  const {
    wordsPerMinute = WORDS_PER_MINUTE,
    technical = false
  } = options;

  const wordCount = countWords(text);

  if (wordCount === 0) {
    return {
      minutes: 0,
      seconds: 0,
      formatted: '< 1 min read',
      wordCount: 0,
      characterCount: countCharacters(text || ''),
      characterCountNoSpaces: countCharactersNoSpaces(text || ''),
      lineCount: countLines(text || ''),
      paragraphCount: countParagraphs(text || ''),
      timeRange: {
        slow: '< 1 min',
        average: '< 1 min',
        fast: '< 1 min'
      }
    };
  }

  // Apply technical density factor
  const effectiveWPM = technical
    ? wordsPerMinute / TECHNICAL_DENSITY_FACTOR
    : wordsPerMinute;

  const minutes = wordCount / effectiveWPM;
  const totalSeconds = Math.round(minutes * 60);

  // Calculate time range
  const slowMinutes = wordCount / (WORDS_PER_MINUTE_SLOW / (technical ? TECHNICAL_DENSITY_FACTOR : 1));
  const fastMinutes = wordCount / (WORDS_PER_MINUTE_FAST / (technical ? TECHNICAL_DENSITY_FACTOR : 1));

  // Format the main reading time
  let formatted;
  if (minutes < 1) {
    formatted = '< 1 min read';
  } else if (minutes < 60) {
    formatted = `${Math.round(minutes)} min read`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    formatted = `${hours} hr ${mins > 0 ? mins + ' min' : ''} read`;
  }

  return {
    minutes: Math.round(minutes * 10) / 10,
    seconds: totalSeconds,
    formatted,
    wordCount,
    characterCount: countCharacters(text),
    characterCountNoSpaces: countCharactersNoSpaces(text),
    lineCount: countLines(text),
    paragraphCount: countParagraphs(text),
    timeRange: {
      slow: formatTime(slowMinutes),
      average: formatTime(minutes),
      fast: formatTime(fastMinutes)
    }
  };
}

/**
 * Get a summary of text statistics.
 * @param {string} text
 * @returns {Object}
 */
export function getTextStats(text) {
  if (!text || typeof text !== 'string') {
    return {
      wordCount: 0,
      characterCount: 0,
      characterCountNoSpaces: 0,
      lineCount: 0,
      paragraphCount: 0,
      readingTime: estimateReadingTime('')
    };
  }

  return {
    wordCount: countWords(text),
    characterCount: countCharacters(text),
    characterCountNoSpaces: countCharactersNoSpaces(text),
    lineCount: countLines(text),
    paragraphCount: countParagraphs(text),
    readingTime: estimateReadingTime(text)
  };
}

/**
 * Format a time in minutes for display.
 * @param {number} minutes
 * @returns {string}
 */
function formatTime(minutes) {
  if (minutes < 1) {
    return '< 1 min';
  } else if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} hr${mins > 0 ? ` ${mins} min` : ''}`;
  }
}

/**
 * Count words in an array of notes.
 * @param {Array<Object>} notes
 * @returns {Object}
 */
export function getAggregateStats(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return {
      totalNotes: 0,
      totalWords: 0,
      totalCharacters: 0,
      averageWordsPerNote: 0,
      totalReadingTime: '< 1 min',
      longestNote: null,
      shortestNote: null
    };
  }

  let totalWords = 0;
  let totalChars = 0;
  let longestNote = null;
  let shortestNote = null;
  let maxWords = 0;
  let minWords = Infinity;

  for (const note of notes) {
    const content = note.content || '';
    const words = countWords(content);
    const chars = countCharacters(content);

    totalWords += words;
    totalChars += chars;

    if (words > maxWords) {
      maxWords = words;
      longestNote = note;
    }
    if (words < minWords && words > 0) {
      minWords = words;
      shortestNote = note;
    }
  }

  const avgWords = Math.round(totalWords / notes.length);
  const totalReadingMinutes = totalWords / WORDS_PER_MINUTE;

  return {
    totalNotes: notes.length,
    totalWords,
    totalCharacters: totalChars,
    averageWordsPerNote: avgWords,
    totalReadingTime: formatTime(totalReadingMinutes),
    longestNote: longestNote ? { title: longestNote.title, wordCount: maxWords } : null,
    shortestNote: shortestNote ? { title: shortestNote.title, wordCount: minWords } : null
  };
}
