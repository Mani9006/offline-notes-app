/**
 * Sidebar component with folder tree, tags, and quick filters.
 */

import React, { useState, useCallback } from 'react';
import { FolderTree } from './FolderTree';
import { TagManager } from './TagManager';

/**
 * @param {Object} props
 */
export function Sidebar({
  folders,
  tags,
  stats,
  activeFilters,
  onFilterChange,
  onClearFilters,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onCreateNote,
  onCloseMobile,
  theme
}) {
  const [collapsedSections, setCollapsedSections] = useState({});
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const toggleSection = useCallback((section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      await onCreateFolder(name);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (err) {
      alert(`Failed to create folder: ${err.message}`);
    }
  }, [newFolderName, onCreateFolder]);

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== undefined);

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="currentColor" opacity="0.9" />
              <rect x="25" y="20" width="50" height="60" rx="6" fill="white" />
              <rect x="35" y="35" width="30" height="4" rx="2" fill="currentColor" />
              <rect x="35" y="45" width="30" height="4" rx="2" fill="currentColor" />
              <rect x="35" y="55" width="20" height="4" rx="2" fill="currentColor" />
            </svg>
          </div>
          <h1 className="brand-title">Notes</h1>
        </div>
        <button
          className="sidebar-close-btn"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* New Note button */}
      <button
        className="sidebar-new-btn"
        onClick={onCreateNote}
        aria-label="Create new note"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New Note</span>
      </button>

      {/* Quick filters */}
      <nav className="sidebar-section">
        <button
          className="section-header"
          onClick={() => toggleSection('quick')}
          aria-expanded={!collapsedSections.quick}
        >
          <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Quick Access</span>
        </button>

        {!collapsedSections.quick && (
          <div className="quick-filters">
            <button
              className={`filter-btn ${!hasActiveFilters && !activeFilters.favorite ? 'active' : ''}`}
              onClick={onClearFilters}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>All Notes</span>
              <span className="filter-count">{stats?.noteCount || 0}</span>
            </button>

            <button
              className={`filter-btn ${activeFilters.favorite ? 'active' : ''}`}
              onClick={() => onFilterChange('favorite', true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Favorites</span>
            </button>

            <button
              className={`filter-btn ${activeFilters.pinned ? 'active' : ''}`}
              onClick={() => onFilterChange('pinned', true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-2H5v2z" />
                <path d="M12 2L8.5 9h7L12 2z" />
              </svg>
              <span>Pinned</span>
            </button>
          </div>
        )}
      </nav>

      {/* Folders */}
      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => toggleSection('folders')}
          aria-expanded={!collapsedSections.folders}
        >
          <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Folders</span>
          <button
            className="section-action"
            onClick={(e) => {
              e.stopPropagation();
              setShowNewFolder(!showNewFolder);
            }}
            aria-label="New folder"
            title="New folder"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </button>

        {showNewFolder && (
          <div className="new-folder-form">
            <input
              type="text"
              className="new-folder-input"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolder(false);
              }}
              autoFocus
              maxLength={100}
            />
            <div className="new-folder-actions">
              <button className="btn btn-sm" onClick={() => setShowNewFolder(false)}>
                Cancel
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleCreateFolder}>
                Create
              </button>
            </div>
          </div>
        )}

        {!collapsedSections.folders && (
          <FolderTree
            folders={folders}
            activeFolderId={activeFilters.folderId}
            onSelect={(folderId) => onFilterChange('folderId', folderId)}
            onDelete={onDeleteFolder}
            onRename={onRenameFolder}
          />
        )}
      </div>

      {/* Tags */}
      <div className="sidebar-section sidebar-section-tags">
        <button
          className="section-header"
          onClick={() => toggleSection('tags')}
          aria-expanded={!collapsedSections.tags}
        >
          <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Tags</span>
        </button>

        {!collapsedSections.tags && (
          <TagManager
            tags={tags}
            activeTag={activeFilters.tag}
            onSelect={(tag) => onFilterChange('tag', tag)}
            noteTags={[]}
            onAddTag={() => {}}
            onRemoveTag={() => {}}
            readOnly
          />
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="sidebar-section sidebar-section-stats">
          <button
            className="section-header"
            onClick={() => toggleSection('stats')}
            aria-expanded={!collapsedSections.stats}
          >
            <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>Storage</span>
          </button>

          {!collapsedSections.stats && (
            <div className="storage-stats">
              <div className="stat-item">
                <span className="stat-label">Notes</span>
                <span className="stat-value">{stats.noteCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Folders</span>
                <span className="stat-value">{stats.folderCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Tags</span>
                <span className="stat-value">{stats.tagCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Size</span>
                <span className="stat-value">{stats.totalSizeKB} KB</span>
              </div>
              {stats.lastModified && (
                <div className="stat-item">
                  <span className="stat-label">Modified</span>
                  <span className="stat-value stat-date">
                    {new Date(stats.lastModified).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
