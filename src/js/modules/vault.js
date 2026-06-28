/* -------------------------------------------------------------
   MY LOOM // DOCUMENT VAULT VIEW MODULE
   ------------------------------------------------------------- */

import { getDocuments, addDocument, deleteDocument, storeFileBlob, getFileBlob, getFileUrl, subscribe, getFolders, addFolder, updateFolder, deleteFolder, getDocumentsByFolder } from '../store.js';
import { writeTerminal } from '../app.js';
import { showDialog, showPrompt } from '../components/dialog.js';

let storeUnsubscribe = null;
let containerRef = null;
let activeTagFilter = 'ALL';
let activeFolderId = 'root';
let currentVaultViewMode = localStorage.getItem('myloom_vault_view') || 'grid';

// Track active Object URLs to revoke them when closing the modal
let activeObjectUrl = null;

export const VaultView = {
  render(container) {
    containerRef = container;
    
    // 1. Build Layout structure (added PDF Viewer Modal)
    container.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Document Vault</h1>
      </header>

      <!-- Drag & Drop Upload Zone -->
      <div class="dropzone" id="file-dropzone" style="position: relative;">
        <span class="dropzone-icon">⏏</span>
        <div class="dropzone-text">Drag & drop files here or click to transmit</div>
        <div class="progress-bar-container" id="upload-progress-container" style="display: none; max-width: 320px; margin: 1.25rem auto 0 auto;">
          <div class="progress-bar" id="upload-progress-bar" style="width: 0%;"></div>
        </div>
        <div id="upload-status-text" class="monospace" style="display: none; font-size: 0.75rem; color: var(--accent); margin-top: 0.5rem; font-weight: bold;">TRANSMITTING... 0%</div>
        <input type="file" id="file-input" style="display: none;" multiple>
      </div>

      <!-- Breadcrumbs and Folders directories -->
      <div class="vault-breadcrumbs" id="vault-breadcrumbs"></div>
      <div class="vault-folders-grid" id="vault-folders-grid"></div>

      <!-- Filters & Tags Panel -->
      <div class="toolbar">
        <div class="actions-group" style="flex: 1; align-items: center; gap: 0.75rem;">
          <input type="text" id="vault-search" class="form-control search-input" placeholder="Search filenames...">
          <button class="btn" id="btn-add-folder">+ Folder</button>
        </div>
        <div class="actions-group view-toggles" style="background: rgba(0,0,0,0.2); padding: 0.2rem; border-radius: 8px; border: 1px solid var(--border-color); margin: 0 1rem;">
          <button class="btn btn-icon vault-view-toggle-btn ${currentVaultViewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View" style="padding: 0.3rem 0.5rem; border-radius: 6px;">⊞</button>
          <button class="btn btn-icon vault-view-toggle-btn ${currentVaultViewMode === 'compact' ? 'active' : ''}" data-view="compact" title="Compact Grid" style="padding: 0.3rem 0.5rem; border-radius: 6px;">⊟</button>
          <button class="btn btn-icon vault-view-toggle-btn ${currentVaultViewMode === 'minimal' ? 'active' : ''}" data-view="minimal" title="Minimal List" style="padding: 0.3rem 0.5rem; border-radius: 6px;">≡</button>
        </div>
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">
          Filter tag: <span id="current-tag-indicator" class="tag">ALL</span>
        </div>
      </div>

      <!-- Tag Quick Links Bar -->
      <div id="vault-tags-cloud" class="select-none" style="margin-bottom: 2rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <!-- Dynamic Tags List -->
      </div>

      <!-- Document Log Table -->
      <div class="widget">
        <h2 class="widget-title">Vault Catalog</h2>
        <div class="widget-content" id="vault-catalog-container" style="padding-top: 1rem;">
          <!-- Dynamically populated based on view mode -->
        </div>
      </div>

      <!-- PDF Modal Document Viewer Overlay -->
      <div class="overlay" id="pdf-viewer-overlay">
        <div class="modal" style="max-width: 850px; width: 90%; height: auto;">
          <div class="modal-header">
            <h3 class="modal-title monospace" id="pdf-viewer-title">[File Viewer]</h3>
            <button class="modal-close" id="pdf-modal-close-btn">&times;</button>
          </div>
          <div class="modal-body" style="padding: 1.5rem;">
            <iframe class="pdf-viewer-frame" id="pdf-viewer-iframe"></iframe>
            <div class="pdf-viewer-actions">
              <button class="btn" id="pdf-btn-open-tab">Open in New Tab</button>
              <button class="btn btn-primary" id="pdf-btn-open-app">Download / Open on Device</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 2. Bind DOM events
    bindEvents();

    // 3. Render initial views
    renderBreadcrumbs();
    renderFoldersGrid();
    renderTagsCloud();
    renderVaultList();

    // 4. Subscribe to changes
    storeUnsubscribe = subscribe((event) => {
      if (event !== 'undo_redo' || activeFolderId) {
        renderBreadcrumbs();
        renderFoldersGrid();
        renderTagsCloud();
        renderVaultList();
      }
    });

    // 5. Check sessionStorage flag to trigger upload input dialog
    if (sessionStorage.getItem('trigger-file-upload') === 'true') {
      sessionStorage.removeItem('trigger-file-upload');
      setTimeout(() => {
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.click();
      }, 150);
    }
  },

  destroy() {
    if (storeUnsubscribe) {
      storeUnsubscribe();
      storeUnsubscribe = null;
    }
    revokeActiveUrl();
    containerRef = null;
  }
};

function revokeActiveUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function bindEvents() {
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const searchInput = document.getElementById('vault-search');
  const pdfCloseBtn = document.getElementById('pdf-modal-close-btn');
  const pdfOverlay = document.getElementById('pdf-viewer-overlay');
  const addFolderBtn = document.getElementById('btn-add-folder');

  // Add custom folder click
  const folderOverlay = document.getElementById('add-folder-overlay');
  const folderForm = document.getElementById('add-folder-form');
  const folderCloseBtn = document.getElementById('folder-modal-close-btn');
  const folderCancelBtn = document.getElementById('folder-modal-cancel-btn');
  const folderInput = document.getElementById('folder-name-input');

  const showFolderModal = () => {
    if (folderOverlay) {
      folderOverlay.classList.add('active');
      if (folderInput) {
        setTimeout(() => folderInput.focus(), 50);
      }
    }
  };

  const hideFolderModal = () => {
    if (folderOverlay) {
      folderOverlay.classList.remove('active');
      if (folderForm) folderForm.reset();
    }
  };

  if (addFolderBtn) {
    addFolderBtn.addEventListener('click', () => {
      showFolderModal();
    });
  }

  if (folderCloseBtn) folderCloseBtn.addEventListener('click', hideFolderModal);
  if (folderCancelBtn) folderCancelBtn.addEventListener('click', hideFolderModal);
  if (folderOverlay) {
    folderOverlay.addEventListener('click', (e) => {
      if (e.target === folderOverlay) hideFolderModal();
    });
  }

  if (folderForm) {
    folderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!window.validateFormFields(folderForm)) return;
      const name = folderInput ? folderInput.value.trim() : '';
      if (name) {
        // Prevent duplicate folder names
        const existingFolders = getFolders();
        const isDuplicate = existingFolders.some(f => f.name.toLowerCase() === name.toLowerCase() && f.parentId === activeFolderId);
        if (isDuplicate) {
          showDialog('A folder with this name already exists here.');
          return;
        }

        // Close modal first
        hideFolderModal();
        const newFolder = await addFolder({ name, parentId: activeFolderId });
        if (newFolder) writeTerminal(`Created folder: "${name}" inside current directory`, 'VAULT');
      }
    });
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderVaultList(searchInput.value, activeTagFilter);
    });
  }

  // View Mode Toggles
  document.querySelectorAll('.vault-view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.getAttribute('data-view');
      currentVaultViewMode = mode;
      localStorage.setItem('myloom_vault_view', mode);
      document.querySelectorAll('.vault-view-toggle-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const searchVal = document.getElementById('vault-search')?.value || '';
      renderVaultList(searchVal, activeTagFilter);
    });
  });

  // Clicking dropzone opens file picker
  if (dropzone) {
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });
  }

  // Drag-and-drop styles toggling
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    // Catch dropped files
    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      handleFileUploads(files);
    });
  }

  // Catch file input changes
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      handleFileUploads(files);
    });
  }

  // Close PDF Modal
  const closePDFModal = () => {
    pdfOverlay.classList.remove('active');
    const iframe = document.getElementById('pdf-viewer-iframe');
    if (iframe) iframe.src = '';
    revokeActiveUrl();
  };

  if (pdfCloseBtn) {
    pdfCloseBtn.addEventListener('click', closePDFModal);
  }

  // Close modal when clicking overlay background
  if (pdfOverlay) {
    pdfOverlay.addEventListener('click', (e) => {
      if (e.target === pdfOverlay) {
        closePDFModal();
      }
    });
  }
}

// Ingest real files and save them in IndexedDB
function handleFileUploads(files) {
  if (files.length === 0) return;

  const dropzone = document.getElementById('file-dropzone');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const statusText = document.getElementById('upload-status-text');

  // Lock dropzone interactions during uploads
  if (dropzone) dropzone.style.pointerEvents = 'none';
  if (progressContainer) progressContainer.style.display = 'block';
  if (statusText) statusText.style.display = 'block';

  let currentFileIndex = 0;
  
  const uploadNextFile = () => {
    if (currentFileIndex >= files.length) {
      setTimeout(() => {
        if (dropzone) dropzone.style.pointerEvents = 'auto';
        if (progressContainer) progressContainer.style.display = 'none';
        if (statusText) statusText.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        writeTerminal(`Ingested ${files.length} document(s) in IndexedDB.`, 'VAULT');
      }, 500);
      return;
    }

    const file = files[currentFileIndex];
    let progress = 0;
    
    // Simulate upload ticking progress
    const interval = setInterval(async () => {
      progress += Math.floor(Math.random() * 25) + 15;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        const nameParts = file.name.split('.');
        const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : 'bin';
        
        let tags = ['user'];
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) tags.push('image');
        else if (['pdf', 'doc', 'docx'].includes(ext)) tags.push('document');
        else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) tags.push('archive');
        else if (['txt', 'md', 'json', 'csv'].includes(ext)) tags.push('text');

        // 1. Create document metadata record in store (assigning to activeFolderId!)
        const newDoc = await addDocument({
          name: file.name,
          size: file.size,
          folderId: activeFolderId,
          type: ext,
          tags: tags,
          hasRealBlob: true
        });

        // 2. Store binary data blob inside IndexedDB
        if (newDoc) await storeFileBlob(newDoc.id, file);

        currentFileIndex++;
        uploadNextFile();
      }

      if (progressBar) progressBar.style.width = `${progress}%`;
      if (statusText) statusText.textContent = `TRANSMITTING: ${file.name.substring(0, 20)}... (${progress}%)`;
    }, 120);
  };

  uploadNextFile();
}

function renderBreadcrumbs() {
  const breadcrumbsContainer = document.getElementById('vault-breadcrumbs');
  if (!breadcrumbsContainer) return;

  const folders = getFolders();
  const path = [];
  let current = folders.find(f => f.id === activeFolderId);
  
  while (current) {
    path.unshift(current);
    current = folders.find(f => f.id === current.parentId);
  }
  
  if (activeFolderId !== 'root' && !path.find(p => p.id === 'root')) {
    const rootFolder = folders.find(f => f.id === 'root') || { id: 'root', name: 'Home' };
    path.unshift(rootFolder);
  }

  breadcrumbsContainer.innerHTML = path.map((p, idx) => {
    const isLast = idx === path.length - 1;
    return `<span class="vault-breadcrumb-item ${isLast ? 'active' : ''}" data-id="${p.id}">${escapeHTML(p.name)}</span>` + (isLast ? '' : ' &gt; ');
  }).join('');

  breadcrumbsContainer.querySelectorAll('.vault-breadcrumb-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      if (id && id !== activeFolderId) {
        activeFolderId = id;
        renderBreadcrumbs();
        renderFoldersGrid();
        renderVaultList();
      }
    });
  });
}

function renderFoldersGrid() {
  const grid = document.getElementById('vault-folders-grid');
  if (!grid) return;

  const folders = getFolders();
  const children = folders.filter(f => f.parentId === activeFolderId && f.id !== 'root');

  if (children.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    return;
  }

  grid.style.display = 'grid';
  grid.innerHTML = children.map(f => `
    <div class="folder-card" data-id="${f.id}" title="Double click to open">
      <div class="folder-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      </div>
      <div class="folder-name">${escapeHTML(f.name)}</div>
      <div class="folder-actions" style="display: flex; gap: 4px;">
        <button class="btn btn-icon btn-rename-folder" data-id="${f.id}" style="padding: 0.35rem; display: flex; align-items: center; justify-content: center;" title="Rename Folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn btn-icon btn-delete-folder" data-id="${f.id}" style="padding: 0.35rem; display: flex; align-items: center; justify-content: center; color: var(--danger);" title="Delete Folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.folder-card').forEach(card => {
    card.addEventListener('dblclick', () => {
      const id = card.getAttribute('data-id');
      if (id) {
        activeFolderId = id;
        renderBreadcrumbs();
        renderFoldersGrid();
        renderVaultList();
      }
    });
  });

  // Rename folder binding
  grid.querySelectorAll('.btn-rename-folder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const folders = getFolders();
      const f = folders.find(folder => folder.id === id);
      if (f) {
        showPrompt('Enter new name for folder:', f.name, (newName) => {
          if (newName && newName.trim() !== '') {
            updateFolder(id, { name: newName.trim() });
            writeTerminal(`Renamed folder "${f.name}" to "${newName.trim()}"`, 'VAULT');
          }
        });
      }
    });
  });

  // Delete folder binding
  grid.querySelectorAll('.btn-delete-folder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const folders = getFolders();
      const f = folders.find(folder => folder.id === id);
      if (f) {
        showDialog(`Are you sure you want to delete folder "${f.name}" and all of its subfolders and files?`, () => {
          deleteFolder(id);
          writeTerminal(`Deleted folder "${f.name}"`, 'WARN');
        });
      }
    });
  });
}

function renderTagsCloud() {
  if (!containerRef) return;
  const cloud = document.getElementById('vault-tags-cloud');
  if (!cloud) return;

  const docs = getDocumentsByFolder(activeFolderId);
  const tagsSet = new Set();
  docs.forEach(doc => {
    if (doc.tags && Array.isArray(doc.tags)) {
      doc.tags.forEach(t => tagsSet.add(t));
    }
  });

  const uniqueTags = ['ALL', ...Array.from(tagsSet)];
  
  cloud.innerHTML = uniqueTags.map(tag => {
    const isSelected = activeTagFilter === tag;
    return `
      <span class="tag tag-btn" data-tag="${tag}" style="cursor: pointer; ${isSelected ? 'background-color: var(--accent); color: white; border-color: var(--accent)' : ''}">
        ${tag.toUpperCase()}
      </span>
    `;
  }).join('');

  // Click tag to filter
  cloud.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.getAttribute('data-tag');
      const searchInput = document.getElementById('vault-search');
      const query = searchInput ? searchInput.value : '';
      
      const indicator = document.getElementById('current-tag-indicator');
      if (indicator) indicator.textContent = activeTagFilter.toUpperCase();

      renderTagsCloud();
      renderVaultList(query, activeTagFilter);
    });
  });
}

function getDocIcon(type) {
  if (type === 'pdf') return '<span style="color: var(--accent); font-size: 1.25em; font-weight: bold;" title="Terracotta PDF">📄</span>';
  if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(type)) return '🖼';
  if (['zip', 'rar', 'tar', 'gz'].includes(type)) return '🗀';
  if (['txt', 'md', 'json', 'csv'].includes(type)) return '🖺';
  return '🗋';
}

function renderVaultList(searchQuery = '', filterTag = 'ALL') {
  if (!containerRef) return;
  const container = document.getElementById('vault-catalog-container');
  if (!container) return;

  let docs = getDocumentsByFolder(activeFolderId);

  // Search filter
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    docs = docs.filter(d => d.name.toLowerCase().includes(query));
  }

  // Tag filter
  if (filterTag !== 'ALL') {
    docs = docs.filter(d => d.tags && d.tags.includes(filterTag));
  }

  if (docs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px;">
        No files in this directory matching the criteria.
      </div>
    `;
    return;
  }

  if (currentVaultViewMode === 'minimal') {
    let html = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Type</th>
              <th>File Name</th>
              <th style="width: 120px;">File Size</th>
              <th class="col-date" style="width: 130px;">Ingest Date</th>
              <th>Metadata Tags</th>
              <th style="width: 130px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="vault-table-body">
    `;

    html += docs.map(doc => {
      const sizeString = formatBytes(doc.size);
      const dateString = new Date(doc.uploadDate).toLocaleDateString();
      let icon = getDocIcon(doc.type);

      return `
        <tr>
          <td style="font-size: 1.25rem; text-align: center;">${icon}</td>
          <td>
            <span class="vault-filename-link" data-id="${doc.id}" style="font-weight: 700; color: var(--text-primary); cursor: pointer;" title="Open in themed viewer">
              ${escapeHTML(doc.name)}
            </span>
          </td>
          <td>${sizeString}</td>
          <td class="monospace" style="font-size: 0.85rem;">${dateString}</td>
          <td>
            ${doc.tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ')}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <button class="btn btn-icon btn-view-file" data-id="${doc.id}" style="background: transparent; border: none; opacity: 0.6; padding: 0.2rem; display: flex; align-items: center; justify-content: center;" title="Open Viewer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button class="btn btn-icon btn-delete-file" data-id="${doc.id}" style="background: transparent; border: none; color: var(--danger); opacity: 0.6; padding: 0.2rem; display: flex; align-items: center; justify-content: center;" title="Purge File">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    html += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  } else {
    // Render Grid/Compact/Minimal using .cards-grid
    const viewClass = currentVaultViewMode === 'grid' ? '' : 'view-mode-' + currentVaultViewMode;
    let html = `<div class="cards-grid ${viewClass}" style="margin-top: 0;">`;
    
    html += docs.map(doc => {
      const sizeString = formatBytes(doc.size);
      const dateString = new Date(doc.uploadDate).toLocaleDateString();
      let icon = getDocIcon(doc.type);

      return `
        <div class="card">
          <div class="card-thumbnail" style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 12px; font-size: 3rem; margin-bottom: 1rem; color: var(--accent);">
            ${icon}
          </div>
          <div class="card-header">
            <div class="card-title vault-filename-link" data-id="${doc.id}" style="cursor: pointer;" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</div>
            <div class="card-actions" style="display: flex; gap: 8px;">
              <button class="btn btn-icon btn-view-file" data-id="${doc.id}" style="background: transparent; border: none; opacity: 0.6; padding: 0.2rem; display: flex; align-items: center; justify-content: center;" title="Open Viewer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button class="btn btn-icon btn-delete-file" data-id="${doc.id}" style="background: transparent; border: none; color: var(--danger); opacity: 0.6; padding: 0.2rem; display: flex; align-items: center; justify-content: center;" title="Purge File">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
          <div class="card-body">
            <div style="color: var(--text-muted); margin-bottom: 0.5rem;">Size: ${sizeString}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Ingested: ${dateString}</div>
          </div>
          <div class="card-footer">
            ${doc.tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ')}
          </div>
        </div>
      `;
    }).join('');

    html += `</div>`;
    container.innerHTML = html;
  }

  // Bind clicks dynamically inside container
  container.querySelectorAll('.vault-filename-link').forEach(link => {
    link.addEventListener('click', () => {
      openPDFViewer(link.getAttribute('data-id'));
    });
  });

  container.querySelectorAll('.btn-view-file').forEach(btn => {
    btn.addEventListener('click', () => {
      openPDFViewer(btn.getAttribute('data-id'));
    });
  });

  container.querySelectorAll('.btn-delete-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      showDialog('Are you sure you want to permanently delete this document?', () => {
        deleteDocument(id);
        writeTerminal('Deleted document from indexed vault', 'WARN');
      });
    });
  });
}

// Open modal PDF / file viewer
async function openPDFViewer(docId) {
  const doc = getDocuments().find(d => d.id === docId);
  if (!doc) return;

  const pdfOverlay = document.getElementById('pdf-viewer-overlay');
  const pdfTitle = document.getElementById('pdf-viewer-title');
  const iframe = document.getElementById('pdf-viewer-iframe');
  
  if (!pdfOverlay || !iframe) return;

  // Set loading state
  pdfOverlay.classList.add('active');
  pdfTitle.textContent = `[Loading...]`;
  iframe.src = 'about:blank';

  revokeActiveUrl();

  if (!doc.hasRealBlob) {
    // Mock seeded file
    const fileBlob = new Blob([
      `MY LOOM SECURE DOCUMENT DECRYPTION SHEET\n========================================\n\n` +
      `File Title:  ${doc.name}\n` +
      `File Size:   ${formatBytes(doc.size)}\n` +
      `Ingest Date: ${new Date(doc.uploadDate).toLocaleString()}\n` +
      `File Format: ${doc.type.toUpperCase()}\n` +
      `Metadata:    ${doc.tags.join(', ')}\n\n` +
      `----------------------------------------\n` +
      `STATUS: Placeholder Decryption Successful.\n\n` +
      `This is a pre-seeded placeholder document. Real files uploaded via drag-and-drop will render completely (PDFs, images, or code sheets) inside this viewer.`
    ], { type: 'text/plain;charset=utf-8' });
    activeObjectUrl = URL.createObjectURL(fileBlob);
    iframe.src = activeObjectUrl;
  } else {
    // Real cloud file
    let fileUrl = getFileUrl(docId);
    
    // For PDFs on mobile, use Google Docs Viewer to render inside iframe
    if (doc.type === 'pdf') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        fileUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
      }
    }
    
    activeObjectUrl = fileUrl; // Ensure open/download buttons use the direct URL
    iframe.src = fileUrl;
  }
  
  pdfTitle.textContent = `[Viewing: ${doc.name}]`;

  // Bind Open in New Tab action
  const tabBtn = document.getElementById('pdf-btn-open-tab');
  tabBtn.onclick = (e) => {
    e.preventDefault();
    window.open(activeObjectUrl, '_blank');
    writeTerminal(`Opened file in new tab: ${doc.name}`, 'SYS');
  };

  // Bind Open in System App action
  // Downloading file natively triggers Samsung Notes / Drive "open with" on mobile devices
  const appBtn = document.getElementById('pdf-btn-open-app');
  appBtn.onclick = (e) => {
    e.preventDefault();
    const a = document.createElement('a');
    a.href = activeObjectUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    writeTerminal(`Downloaded/opened document on device: ${doc.name}`, 'SYS');
  };

}

// Helpers
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
