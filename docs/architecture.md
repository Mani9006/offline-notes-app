# Notes App - Architecture Documentation

## Overview

This is an offline-first, PWA-ready note-taking application built with React. It uses IndexedDB as the primary storage mechanism with localStorage as a fallback, ensuring notes are always accessible even when the browser's IndexedDB is unavailable.

## Architecture Diagram

```
+------------------+     +------------------+     +------------------+
|   Presentation   |     |   Business Logic  |     |     Storage      |
|   Layer (React)  | --> |   Layer (Hooks)   | --> |     Layer        |
+------------------+     +------------------+     +------------------+
       |                         |                         |
       | Components              | Custom Hooks            | IndexedDB
       | - App                   | - useNotes              | - Notes Store
       | - NoteEditor            | - useSearch             | - Folders Store
       | - NoteList              | - useTheme              | - Tags Store
       | - NotePreview           | - useLocalStorage       | localStorage
       | - Sidebar               |                         | - Fallback
       | - SearchBar             |                         | - Backups
       | - FolderTree            |                         |
       | - TagManager            |                         |
       | - ThemeToggle           |                         |
       | - KeyboardShortcuts     |                         |
+------------------+     +------------------+     +------------------+
       |                         |                         |
       v                         v                         v
  +---------+              +----------+              +-----------+
  |  CSS    |              |  Utils   |              |  Service  |
  | Themes  |              | - storage|              |  Worker   |
  | Mobile  |              | - search |              | (PWA)     |
  | Desktop |              | - export |              |           |
  +---------+              | - parser |              | Cache API |
                           | - reading|              |           |
                           +----------+              +-----------+
```

## Data Flow

```
User Action
    |
    v
React Component (onClick, onChange)
    |
    v
Custom Hook (useNotes, useSearch)
    |
    v
Storage Utility (IndexedDB / localStorage)
    |
    v
State Update -> Component Re-render
```

## Layer Details

### 1. Presentation Layer

The UI is organized into modular components:

- **App.js** - Root component, orchestrates layout and manages view state
- **NoteEditor.js** - Full-featured markdown editor with toolbar and live preview
- **NoteList.js** - Scrollable list of note cards with search highlighting
- **NotePreview.js** - Read-only rendered markdown view with export options
- **Sidebar.js** - Navigation sidebar with folders, tags, and quick filters
- **SearchBar.js** - Real-time search with suggestions and operators
- **FolderTree.js** - Hierarchical folder navigation with CRUD operations
- **TagManager.js** - Tag display and management (read-only and editable modes)
- **ThemeToggle.js** - Dark/light theme switcher
- **KeyboardShortcuts.js** - Global keyboard shortcut handler and help modal

### 2. Business Logic Layer

**Custom Hooks:**

#### useNotes
Manages all note-related state and operations:
- CRUD operations for notes, folders, and tags
- Auto-save with debouncing
- Conflict resolution strategies
- Memory caching for performance
- Import/export data operations

#### useSearch
Provides full-text search functionality:
- Debounced query input (150ms)
- Multi-term and phrase matching
- Search operators (tag:, folder:, -exclusion)
- Result ranking and highlighting
- Suggestion generation

#### useTheme
Manages application theme:
- localStorage persistence
- System preference detection
- Smooth CSS transitions
- Meta theme-color updates

#### useLocalStorage
Generic localStorage synchronization:
- useState-like API
- Cross-tab synchronization via storage events
- Quota exceeded handling

### 3. Storage Layer

**Primary: IndexedDB**

Database: `NotesAppDB` (version 1)

Object Stores:
| Store | Key Path | Indexes |
|-------|----------|---------|
| notes | id | folderId, pinned, favorite, updatedAt, tags |
| folders | id | - |
| tags | id | - |

**Fallback: localStorage**
Used when IndexedDB is unavailable:
- `notes-data` - Notes array
- `notes-folders` - Folders array
- `notes-tags` - Tags array
- `notes-backup` - Per-note backups

**Conflict Resolution Strategies:**
1. `last-write-wins` (default) - Compares timestamps
2. `server-wins` - Always uses server version
3. `local-wins` - Always preserves local changes
4. `manual` - Returns both versions for user choice

### 4. Utility Layer

| Module | Purpose |
|--------|---------|
| storage.js | IndexedDB wrapper, CRUD operations, conflict resolution |
| searchEngine.js | Full-text search, indexing, scoring, highlighting |
| markdownParser.js | Markdown to HTML, text extraction, formatting helpers |
| exporters.js | Export to Markdown, HTML, PDF; Web Share API |
| readingTime.js | Word count, character count, reading time estimation |

### 5. PWA Layer

**Service Worker (`public/sw.js`):**
- Cache-first strategy for static assets
- Network-first for navigation requests
- Stale-while-revalidate for other requests
- Background sync support
- Push notification handling

**Manifest (`public/manifest.json`):**
- App metadata and icons
- Shortcuts for "New Note" and "Search"
- Share target for receiving content

## State Management

State is managed through React hooks with a unidirectional data flow:

```
App (coordinates state)
  |-- useNotes (notes, folders, tags, active note)
  |-- useSearch (search query, filters, results)
  |-- useTheme (current theme)
  |-- local component state (UI visibility flags)
```

No external state management library is needed due to the focused scope of the application.

## Performance Considerations

1. **Memory Caching** - Recently accessed notes are cached in memory
2. **Debounced Search** - Search queries are debounced at 150ms
3. **Debounced Auto-save** - Notes auto-save 1 second after typing stops
4. **Lazy Loading** - Components load only when needed
5. **Virtual Scrolling** - Note list renders efficiently for large collections
6. **IndexedDB Indexes** - Database indexes enable fast filtering queries

## Security

1. **XSS Prevention** - All user-generated content is sanitized via DOMPurify
2. **CSP Ready** - Content Security Policy compatible code structure
3. **Input Validation** - All user inputs are validated before storage
4. **No External Dependencies for Core** - Core functionality uses browser APIs only

## Future Improvements

1. **Cloud Sync** - Add backend API for cross-device synchronization
2. **Collaboration** - Real-time collaborative editing with CRDTs
3. **Plugin System** - Extensible plugin architecture for custom features
4. **Mobile App** - React Native or Capacitor wrapper
5. **End-to-End Encryption** - Encrypt notes before storage
6. **Full-Text Index** - WebWorker-based search index for large note collections
