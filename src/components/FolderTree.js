/**
 * FolderTree component - renders a hierarchical folder structure.
 */

import React, { useState, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {Array} props.folders
 * @param {string|null} props.activeFolderId
 * @param {Function} props.onSelect
 * @param {Function} props.onDelete
 * @param {Function} props.onRename
 */
export function FolderTree({
  folders,
  activeFolderId,
  onSelect,
  onDelete,
  onRename
}) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const toggleExpand = useCallback((folderId, e) => {
    e?.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  }, []);

  const startRename = useCallback((folder, e) => {
    e?.stopPropagation();
    setEditingId(folder.id);
    setEditName(folder.name);
    setContextMenu(null);
  }, []);

  const confirmRename = useCallback(async (folderId) => {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }

    try {
      await onRename(folderId, name);
    } catch (err) {
      console.error('Rename failed:', err);
    }
    setEditingId(null);
  }, [editName, onRename]);

  const handleDelete = useCallback(async (folderId, e) => {
    e?.stopPropagation();
    if (window.confirm('Delete this folder? Notes will be moved to root.')) {
      try {
        await onDelete(folderId);
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
    setContextMenu(null);
  }, [onDelete]);

  const handleContextMenu = useCallback((folder, e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      folderId: folder.id,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  // Close context menu on outside click
  React.useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Build folder hierarchy
  const folderMap = new Map(folders.map(f => [f.id, { ...f, children: [] }]));
  const rootFolders = [];

  for (const folder of folderMap.values()) {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId).children.push(folder);
    } else {
      rootFolders.push(folder);
    }
  }

  const renderFolder = (folder, depth = 0) => {
    const isActive = activeFolderId === folder.id;
    const isExpanded = !!expandedFolders[folder.id];
    const isEditing = editingId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          className={`folder-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelect(folder.id)}
          onContextMenu={(e) => handleContextMenu(folder, e)}
          role="treeitem"
          aria-selected={isActive}
          aria-expanded={hasChildren ? isExpanded : undefined}
        >
          {hasChildren ? (
            <button
              className={`folder-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => toggleExpand(folder.id, e)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <span className="folder-toggle-placeholder" />
          )}

          <svg className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>

          {isEditing ? (
            <input
              className="folder-rename-input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => confirmRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename(folder.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              autoFocus
              maxLength={100}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="folder-name">{folder.name}</span>
          )}
        </div>

        {/* Context menu */}
        {contextMenu?.folderId === folder.id && (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y
            }}
          >
            <button onClick={(e) => startRename(folder, e)}>
              Rename
            </button>
            <button
              className="context-menu-danger"
              onClick={(e) => handleDelete(folder.id, e)}
            >
              Delete
            </button>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="folder-children" role="group">
            {folder.children.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="folder-tree" role="tree">
      {/* Root option */}
      <div
        className={`folder-item folder-root ${activeFolderId === null ? 'active' : ''}`}
        onClick={() => onSelect(null)}
        role="treeitem"
        aria-selected={activeFolderId === null}
      >
        <span className="folder-toggle-placeholder" />
        <svg className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="folder-name">All Notes</span>
      </div>

      {rootFolders.map(folder => renderFolder(folder))}

      {folders.length === 0 && (
        <div className="folder-empty">
          <p>No folders yet</p>
          <p className="folder-empty-hint">Create folders to organize your notes</p>
        </div>
      )}
    </div>
  );
}
