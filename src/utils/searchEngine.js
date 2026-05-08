/**
 * Full-text search engine for notes.
 * Supports multi-term search, phrase matching, tag filtering, and ranking.
 *
 * @module searchEngine
 */

// Common English stop words
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'dare', 'ought', 'used', 'it', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us',
  'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what',
  'which', 'who', 'when', 'where', 'why', 'how'
]);

/**
 * Tokenize text into searchable terms.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .toLowerCase()
    // Remove Markdown syntax
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Extract words
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1 && !STOP_WORDS.has(term));
}

/**
 * Create a search index from notes.
 * @param {Array} notes
 * @returns {Map}
 */
export function buildSearchIndex(notes) {
  const index = new Map();

  if (!Array.isArray(notes)) {
    return index;
  }

  for (const note of notes) {
    if (!note || !note.id) continue;

    const textToIndex = [
      note.title || '',
      note.content || '',
      ...(note.tags || [])
    ].join(' ');

    const tokens = tokenize(textToIndex);
    const tokenSet = new Set(tokens);

    // Store token frequency for this note
    for (const token of tokenSet) {
      if (!index.has(token)) {
        index.set(token, new Map());
      }
      // Count frequency in this note
      const freq = tokens.filter(t => t === token).length;
      index.get(token).set(note.id, {
        frequency: freq,
        title: note.title || 'Untitled',
        updatedAt: note.updatedAt
      });
    }
  }

  return index;
}

/**
 * Search notes with scoring and highlighting.
 *
 * @param {Array} notes - The notes to search
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @returns {Object} - Search results with highlights
 */
export function searchNotes(notes, query, options = {}) {
  if (!query || typeof query !== 'string') {
    return {
      results: [],
      query: '',
      totalMatches: 0,
      suggestions: []
    };
  }

  const {
    limit = 50,
    fuzzy = false,
    caseSensitive = false
  } = options;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { results: [], query: '', totalMatches: 0, suggestions: [] };
  }

  // Detect special search operators
  const searchState = parseSearchQuery(trimmedQuery);

  // Score and filter notes
  const scoredResults = [];

  for (const note of notes) {
    if (!note || !note.id) continue;

    const score = calculateRelevanceScore(note, searchState, {
      fuzzy,
      caseSensitive
    });

    if (score > 0) {
      const highlighted = createHighlights(note, searchState);
      scoredResults.push({
        note,
        score,
        ...highlighted
      });
    }
  }

  // Sort by score (descending)
  scoredResults.sort((a, b) => b.score - a.score);

  // Get unique suggestions
  const suggestions = generateSuggestions(scoredResults, searchState);

  const limited = scoredResults.slice(0, limit);

  return {
    results: limited,
    query: trimmedQuery,
    totalMatches: scoredResults.length,
    suggestions,
    searchState
  };
}

/**
 * Parse search query for operators.
 * @param {string} query
 * @returns {Object}
 */
function parseSearchQuery(query) {
  const terms = [];
  const excludedTerms = [];
  const tagFilters = [];
  const folderFilters = [];
  const phrases = [];

  // Extract quoted phrases
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(query)) !== null) {
    phrases.push(match[1].toLowerCase());
  }

  // Remove phrases from query
  const remainingQuery = query.replace(phraseRegex, ' ');

  // Tokenize remaining
  const tokens = remainingQuery
    .split(/\s+/)
    .filter(t => t.length > 0);

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();

    if (lowerToken.startsWith('-')) {
      excludedTerms.push(lowerToken.slice(1));
    } else if (lowerToken.startsWith('tag:')) {
      tagFilters.push(lowerToken.slice(4));
    } else if (lowerToken.startsWith('folder:')) {
      folderFilters.push(lowerToken.slice(7));
    } else if (lowerToken.startsWith('#')) {
      tagFilters.push(lowerToken.slice(1));
    } else if (lowerToken.length > 1 && !STOP_WORDS.has(lowerToken)) {
      terms.push(lowerToken);
    }
  }

  return { terms, excludedTerms, tagFilters, folderFilters, phrases };
}

/**
 * Calculate relevance score for a note.
 * @param {Object} note
 * @param {Object} searchState
 * @param {Object} options
 * @returns {number}
 */
function calculateRelevanceScore(note, searchState, options) {
  const { terms, excludedTerms, tagFilters, folderFilters, phrases } = searchState;
  const { caseSensitive } = options;

  let score = 0;
  const title = caseSensitive ? (note.title || '') : (note.title || '').toLowerCase();
  const content = caseSensitive ? (note.content || '') : (note.content || '').toLowerCase();
  const tags = (note.tags || []).map(t => t.toLowerCase());

  // Check excluded terms
  for (const ex of excludedTerms) {
    if (title.includes(ex) || content.includes(ex)) {
      return 0; // Excluded
    }
  }

  // Check folder filters
  if (folderFilters.length > 0) {
    const noteFolder = (note.folderName || note.folderId || '').toLowerCase();
    if (!folderFilters.some(f => noteFolder.includes(f))) {
      return 0;
    }
  }

  // Check tag filters
  if (tagFilters.length > 0) {
    if (!tagFilters.some(tf => tags.some(t => t.includes(tf)))) {
      return 0;
    }
  }

  // Phrase matching (higher weight)
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    if (title.includes(phraseLower)) {
      score += 15;
    }
    if (content.includes(phraseLower)) {
      const occurrences = (content.match(new RegExp(phraseLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      score += 5 * Math.min(occurrences, 5);
    }
  }

  // Individual term matching
  for (const term of terms) {
    const termLower = term.toLowerCase();

    // Title match (high weight)
    if (title.includes(termLower)) {
      score += 10;
      // Exact title match is even better
      if (title === termLower) score += 5;
      // Word boundary match
      const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (wordBoundaryRegex.test(title)) score += 3;
    }

    // Content match (medium weight)
    if (content.includes(termLower)) {
      const occurrences = (content.match(new RegExp(termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      score += 2 * Math.min(occurrences, 10);
    }

    // Tag match (high weight)
    if (tags.some(t => t.includes(termLower))) {
      score += 8;
    }
  }

  // Boost for pinned and favorite
  if (note.pinned) score *= 1.2;
  if (note.favorite) score *= 1.1;

  // Recency boost
  if (note.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(note.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score *= 1.05;
  }

  return score;
}

/**
 * Create highlighted snippets for search results.
 */
function createHighlights(result, searchState) {
  const { terms, phrases } = searchState;
  const allTerms = [...terms, ...phrases];

  if (allTerms.length === 0) {
    return { highlightedTitle: result.title, highlightedContent: '' };
  }

  // Highlight title
  let highlightedTitle = escapeHtml(result.title || 'Untitled');
  for (const term of allTerms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');
  }

  // Create content snippet around first match
  const content = result.content || '';
  let snippet = '';

  if (content.length > 0) {
    const contentLower = content.toLowerCase();
    let bestIndex = -1;

    for (const term of allTerms) {
      const idx = contentLower.indexOf(term.toLowerCase());
      if (idx !== -1) {
        bestIndex = idx;
        break;
      }
    }

    if (bestIndex !== -1) {
      const start = Math.max(0, bestIndex - 80);
      const end = Math.min(content.length, bestIndex + 200);
      snippet = content.slice(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet += '...';
    } else {
      snippet = content.slice(0, 200);
      if (content.length > 200) snippet += '...';
    }

    // Escape and highlight
    snippet = escapeHtml(snippet);
    for (const term of allTerms) {
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    }
  }

  return { highlightedTitle, highlightedContent: snippet };
}

/**
 * Generate search suggestions from results.
 */
function generateSuggestions(scoredResults, searchState) {
  if (scoredResults.length === 0) return [];

  const titleWords = scoredResults
    .slice(0, 10)
    .flatMap(r => tokenize(r.note.title || ''));

  const frequency = {};
  for (const word of titleWords) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function escapeHtml(text) {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Advanced filter with multiple criteria.
 */
export function filterNotes(notes, criteria) {
  if (!Array.isArray(notes)) return [];
  if (!criteria || typeof criteria !== 'object') return notes;

  return notes.filter(note => {
    if (criteria.folderId !== undefined && note.folderId !== criteria.folderId) {
      return false;
    }
    if (criteria.tag && !(note.tags || []).includes(criteria.tag)) {
      return false;
    }
    if (criteria.pinned === true && !note.pinned) {
      return false;
    }
    if (criteria.favorite === true && !note.favorite) {
      return false;
    }
    if (criteria.dateFrom) {
      const noteDate = new Date(note.updatedAt || note.createdAt);
      if (noteDate < new Date(criteria.dateFrom)) return false;
    }
    if (criteria.dateTo) {
      const noteDate = new Date(note.updatedAt || note.createdAt);
      if (noteDate > new Date(criteria.dateTo)) return false;
    }
    if (criteria.search) {
      const q = criteria.search.toLowerCase();
      const title = (note.title || '').toLowerCase();
      const content = (note.content || '').toLowerCase();
      if (!title.includes(q) && !content.includes(q)) return false;
    }
    return true;
  });
}
