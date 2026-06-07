/* -------------------------------------------------------------
   MY LOOM // LINK LIBRARY MODULE
   ------------------------------------------------------------- */

import { getBookmarks, addBookmark, deleteBookmark, updateBookmark, subscribe, recordLinkAccess, getBookmarkCategories, addBookmarkCategory, updateBookmarkCategory, deleteBookmarkCategory } from '../store.js';
import { writeTerminal } from '../app.js';
import { showDialog, showPrompt } from '../components/dialog.js';

let storeUnsubscribe = null;
let containerRef = null;
let activeTagFilter = 'ALL';
let editingBookmarkId = null;
let currentViewMode = localStorage.getItem('myloom_library_view') || 'grid';
let collapsedCategories = JSON.parse(localStorage.getItem('myloom_collapsed_cats') || '{}');
let categoryOrder = JSON.parse(localStorage.getItem('myloom_category_order') || '[]');
let draggedCategory = null;

export const LibraryView = {
  render(container) {
    containerRef = container;

    // 1. Build initial layout structure
    container.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Link Library</h1>
      </header>

      <!-- Toolbar with search and creation trigger -->
      <div class="toolbar">
        <div class="actions-group" style="flex: 1;">
          <input type="text" id="library-search" class="form-control search-input" placeholder="Search titles or URLs...">
        </div>
        <div class="actions-group view-toggles" style="background: rgba(0,0,0,0.2); padding: 0.2rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <button class="btn btn-icon view-toggle-btn ${currentViewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View" style="padding: 0.3rem 0.5rem; border-radius: 6px;">⊞</button>
          <button class="btn btn-icon view-toggle-btn ${currentViewMode === 'compact' ? 'active' : ''}" data-view="compact" title="Compact Grid" style="padding: 0.3rem 0.5rem; border-radius: 6px;">⊟</button>
          <button class="btn btn-icon view-toggle-btn ${currentViewMode === 'minimal' ? 'active' : ''}" data-view="minimal" title="Minimal List" style="padding: 0.3rem 0.5rem; border-radius: 6px;">≡</button>
        </div>
        <div class="actions-group" style="margin-left: auto;">
          <button class="btn" id="btn-manage-link-categories" title="Create a link category">+ Category</button>
          <button class="btn btn-primary" id="btn-add-bookmark">+ Register Link</button>
        </div>
      </div>

      <!-- Categories Tags Filter Row -->
      <div id="library-tags-cloud" class="select-none" style="margin-bottom: 2rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <!-- Categories dynamic tags -->
      </div>

      <!-- Bookmarks Card Grid -->
      <div id="bookmarks-cards-container">
        <!-- Cards will load here -->
      </div>

      <!-- Add Bookmark Modal Overlay -->
      <div class="overlay" id="add-bookmark-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="bookmark-modal-title">[Index New Link]</h3>
            <button class="modal-close" id="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="add-bookmark-form">
              <div class="form-group">
                <label class="form-label" for="bookmark-title">Link Title</label>
                <input type="text" id="bookmark-title" class="form-control" required placeholder="e.g. Grafana Dashboard">
              </div>
              <div class="form-group">
                <label class="form-label" for="bookmark-url">URL Address</label>
                <input type="url" id="bookmark-url" class="form-control monospace" required placeholder="https://...">
              </div>
              <div class="form-group">
                <label class="form-label" for="bookmark-category">Category</label>
                <input type="text" id="bookmark-category" list="bookmark-categories-list" class="form-control" required placeholder="e.g. Dev, Ops, Design">
                <datalist id="bookmark-categories-list"></datalist>
              </div>
              <div class="form-group">
                <label class="form-label" for="bookmark-tags">Metadata Tags (comma separated)</label>
                <input type="text" id="bookmark-tags" class="form-control" placeholder="ops, monitoring, team">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-primary" type="submit" form="add-bookmark-form" id="bookmark-submit-btn">Execute Registry</button>
          </div>
        </div>
      </div>
    `;

    // 2. Bind DOM events
    bindEvents();

    // 3. Render lists initial states
    renderTagsCloud();
    renderBookmarksList();

    // 4. Subscribe to data changes
    storeUnsubscribe = subscribe(() => {
      renderTagsCloud();
      renderBookmarksList();
    });

    // 5. Check sessionStorage flag to trigger new link modal
    if (sessionStorage.getItem('open-bookmark-modal') === 'true') {
      sessionStorage.removeItem('open-bookmark-modal');
      setTimeout(() => {
        const overlay = document.getElementById('add-bookmark-overlay');
        if (overlay) {
          editingBookmarkId = null;
          document.getElementById('bookmark-modal-title').textContent = '[Index New Link]';
          document.getElementById('bookmark-submit-btn').textContent = 'Execute Registry';
          populateBookmarkCategoriesDatalist();
          overlay.classList.add('active');
          const titleInput = document.getElementById('bookmark-title');
          if (titleInput) titleInput.focus();
        }
      }, 150);
    }
  },

  destroy() {
    if (storeUnsubscribe) {
      storeUnsubscribe();
      storeUnsubscribe = null;
    }
    containerRef = null;
    // CRITICAL: reset isDelegated so bindEvents() re-attaches on next render
    isDelegated = false;
  }
};

function populateBookmarkCategoriesDatalist() {
  const datalist = document.getElementById('bookmark-categories-list');
  if (!datalist) return;
  const categories = getBookmarkCategories();
  datalist.innerHTML = categories.map(cat => `
    <option value="${escapeHTML(cat)}"></option>
  `).join('');
}

let isDelegated = false;

function bindEvents() {
  if (isDelegated) return;

  document.body.addEventListener('input', (e) => {
    if (e.target.matches('#library-search')) {
      renderBookmarksList(e.target.value, activeTagFilter);
    }
  });

  document.body.addEventListener('submit', async (e) => {
    if (e.target.matches('#add-bookmark-form')) {
      e.preventDefault();
      e.stopPropagation();
      const form = e.target;
      if (!window.validateFormFields(form)) return;

      const title = document.getElementById('bookmark-title').value.trim();
      const url = document.getElementById('bookmark-url').value.trim();
      const category = document.getElementById('bookmark-category').value.trim() || 'General';
      const tagsInput = document.getElementById('bookmark-tags').value.trim();

      if (title && url) {
        const tags = tagsInput 
          ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
          : [];
        if (!tags.includes(category.toLowerCase())) {
          tags.unshift(category.toLowerCase());
        }

        const categories = getBookmarkCategories();
        if (!categories.includes(category)) {
          await addBookmarkCategory(category);
        }

        // Close modal first
        document.getElementById('add-bookmark-overlay').classList.remove('active');
        form.reset();
        const editId = editingBookmarkId;
        editingBookmarkId = null;

        if (editId) {
          await updateBookmark(editId, { title, url, tags, category });
          writeTerminal(`Modified bookmark details: "${title}"`, 'LINK');
        } else {
          const newBookmark = await addBookmark({ title, url, tags, category });
          if (newBookmark) writeTerminal(`Indexed new bookmark: "${newBookmark.title}"`, 'LINK');
        }
      }
    }
  });

  document.body.addEventListener('click', (e) => {
    // Show Modal
    if (e.target.closest('#btn-add-bookmark')) {
      editingBookmarkId = null;
      document.getElementById('bookmark-modal-title').textContent = '[Index New Link]';
      document.getElementById('bookmark-submit-btn').textContent = 'Execute Registry';
      populateBookmarkCategoriesDatalist();
      document.getElementById('add-bookmark-overlay').classList.add('active');
      document.getElementById('bookmark-title').focus();
      return;
    }

    // Hide Modal
    if (e.target.closest('#modal-close-btn') || e.target.closest('#modal-cancel-btn')) {
      document.getElementById('add-bookmark-overlay').classList.remove('active');
      document.getElementById('add-bookmark-form').reset();
      return;
    }

    if (e.target.matches('#add-bookmark-overlay')) {
      e.target.classList.remove('active');
      document.getElementById('add-bookmark-form').reset();
      return;
    }

    // View toggle handler
    const viewBtn = e.target.closest('.view-toggle-btn');
    if (viewBtn) {
      const mode = viewBtn.getAttribute('data-view');
      currentViewMode = mode;
      localStorage.setItem('myloom_library_view', mode);
      document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      viewBtn.classList.add('active');
      const searchInput = document.getElementById('library-search');
      renderBookmarksList(searchInput ? searchInput.value : '', activeTagFilter);
      return;
    }

    // Manage Categories
    if (e.target.closest('#btn-manage-link-categories')) {
      e.preventDefault();
      showPrompt('Enter new link category name:', '', async (name) => {
        if (name && name.trim() !== '') {
          const trimmed = name.trim();
          const result = await addBookmarkCategory(trimmed);
          if (result) {
            writeTerminal(`Created custom link category: "${trimmed}"`, 'LINK');
          } else {
            showDialog('Category already exists or is invalid.');
          }
        }
      });
      return;
    }

    // Copy Link
    const copyBtn = e.target.closest('.btn-copy');
    if (copyBtn) {
      const url = copyBtn.getAttribute('data-url');
      navigator.clipboard.writeText(url).then(() => {
        writeTerminal(`Copied URL: ${url}`, 'SYS');
        const oldText = copyBtn.textContent;
        copyBtn.textContent = '✓';
        copyBtn.style.color = 'var(--success)';
        setTimeout(() => {
          copyBtn.textContent = oldText;
          copyBtn.style.color = '';
        }, 1500);
      }).catch(err => {
        console.error('Failed to copy to clipboard', err);
      });
      return;
    }

    // Delete Link
    const deleteLinkBtn = e.target.closest('.btn-delete-bookmark');
    if (deleteLinkBtn) {
      const id = deleteLinkBtn.getAttribute('data-id');
      const b = getBookmarks().find(x => x.id === id);
      if (b) {
        showDialog(`Are you sure you want to purge: "${b.title}"?`, () => {
          deleteBookmark(id);
          writeTerminal(`Purged link from index: "${b.title}"`, 'WARN');
        });
      }
      return;
    }

    // Visit Link
    const visitBtn = e.target.closest('.btn-visit-library');
    if (visitBtn) {
      const id = visitBtn.getAttribute('data-id');
      recordLinkAccess(id);
      return;
    }

    // Edit Link
    const editBtn = e.target.closest('.btn-edit-bookmark');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const b = getBookmarks().find(x => x.id === id);
      if (b) {
        editingBookmarkId = b.id;
        document.getElementById('bookmark-modal-title').textContent = '[Modify Link Details]';
        document.getElementById('bookmark-submit-btn').textContent = 'Save Changes';
        document.getElementById('bookmark-title').value = b.title;
        document.getElementById('bookmark-url').value = b.url;
        document.getElementById('bookmark-category').value = b.category || b.tags?.[0] || 'General';
        document.getElementById('bookmark-tags').value = b.tags.join(', ');
        populateBookmarkCategoriesDatalist();
        document.getElementById('add-bookmark-overlay').classList.add('active');
        document.getElementById('bookmark-title').focus();
      }
      return;
    }

    // Edit Category
    const editCatBtn = e.target.closest('.btn-edit-cat');
    if (editCatBtn) {
      const oldCat = editCatBtn.getAttribute('data-cat');
      showPrompt(`Rename category "${oldCat}" to:`, oldCat, async (newName) => {
        if (newName && newName.trim() !== '' && newName.trim() !== oldCat) {
          const success = await updateBookmarkCategory(oldCat, newName.trim());
          if (success) {
            if (collapsedCategories.hasOwnProperty(oldCat)) {
              collapsedCategories[newName.trim()] = collapsedCategories[oldCat];
              delete collapsedCategories[oldCat];
              localStorage.setItem('myloom_collapsed_cats', JSON.stringify(collapsedCategories));
            }
            writeTerminal(`Renamed category "${oldCat}" to "${newName.trim()}"`, 'LINK');
            renderBookmarksList(
              document.getElementById('library-search')?.value || '', 
              activeTagFilter
            );
          } else {
            showDialog('Category name exists or invalid.');
          }
        }
      });
      return;
    }

    // Toggle Category
    const toggleHeader = e.target.closest('.category-header');
    if (toggleHeader && !e.target.closest('.btn-icon') && !e.target.closest('.drag-handle')) {
      const catName = toggleHeader.getAttribute('data-toggle-cat');
      const safeId = catName.replace(/\W/g, '');
      const content = document.getElementById(`cat-content-${safeId}`);
      const icon = toggleHeader.querySelector('.cat-toggle-icon');
      
      if (content && icon) {
        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.style.transform = 'rotate(0deg)';
          collapsedCategories[catName] = false;
        } else {
          content.style.display = 'none';
          icon.style.transform = 'rotate(-90deg)';
          collapsedCategories[catName] = true;
        }
        localStorage.setItem('myloom_collapsed_cats', JSON.stringify(collapsedCategories));
      }
      return;
    }

    // Delete Category
    const deleteCatBtn = e.target.closest('.btn-delete-cat');
    if (deleteCatBtn) {
      const cat = deleteCatBtn.getAttribute('data-cat');
      showDialog(`Are you sure you want to delete category "${cat}"? Links inside will move to the first remaining category.`, () => {
        if (deleteBookmarkCategory(cat)) {
          writeTerminal(`Deleted link category "${cat}"`, 'WARN');
        } else {
          showDialog('Failed to delete. At least one category must remain.');
        }
      });
      return;
    }
  });

  isDelegated = true;
}

function renderTagsCloud() {
  if (!containerRef) return;
  const cloud = document.getElementById('library-tags-cloud');
  if (!cloud) return;

  const bookmarks = getBookmarks();
  const tagsSet = new Set();
  bookmarks.forEach(b => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach(t => tagsSet.add(t));
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

  // Add click handlers
  cloud.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.getAttribute('data-tag');
      const searchInput = document.getElementById('library-search');
      const query = searchInput ? searchInput.value : '';

      renderTagsCloud();
      renderBookmarksList(query, activeTagFilter);
    });
  });
}

function renderBookmarksList(searchQuery = '', filterTag = 'ALL') {
  if (!containerRef) return;
  const cardsContainer = document.getElementById('bookmarks-cards-container');
  if (!cardsContainer) return;

  let bookmarks = getBookmarks();

  // Search filter
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    bookmarks = bookmarks.filter(b => 
      b.title.toLowerCase().includes(query) || 
      b.url.toLowerCase().includes(query)
    );
  }

  // Tag filter
  if (filterTag !== 'ALL') {
    bookmarks = bookmarks.filter(b => b.tags && b.tags.includes(filterTag));
  }

  if (bookmarks.length === 0) {
    cardsContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; border: 1px dashed var(--border-color); color: var(--text-muted); border-radius: 24px;">
        No bookmarked links indexed for current filter
      </div>
    `;
    return;
  }

  // Group bookmarks by category
  const categoriesMap = {};
  const allCategories = getBookmarkCategories();
  
  // Initialize map with all created categories to ensure empty ones display
  // ONLY if no search or tag filters are active
  if (searchQuery.trim() === '' && filterTag === 'ALL') {
    allCategories.forEach(cat => {
      categoriesMap[cat] = [];
    });
  }

  bookmarks.forEach(b => {
    const cat = b.category || b.tags?.[0] || 'General';
    const matchingCat = allCategories.find(c => c.toLowerCase() === cat.toLowerCase()) || (cat.charAt(0).toUpperCase() + cat.slice(1));
    if (!categoriesMap[matchingCat]) {
      categoriesMap[matchingCat] = [];
    }
    categoriesMap[matchingCat].push(b);
  });

  // Sort categories by saved order
  const sortedEntries = Object.entries(categoriesMap).sort((a, b) => {
    let indexA = categoryOrder.indexOf(a[0]);
    let indexB = categoryOrder.indexOf(b[0]);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    if (indexA !== indexB) return indexA - indexB;
    return a[0].localeCompare(b[0]);
  });

  let html = '';
  for (const [category, catBookmarks] of sortedEntries) {
    const isCollapsed = collapsedCategories[category] || false;
    const safeCatId = category.replace(/\W/g, '');
    html += `
      <div class="category-section" style="margin-bottom: 2.5rem;" data-category="${escapeHTML(category)}">
        <h2 class="category-header" data-toggle-cat="${escapeHTML(category)}" style="cursor: pointer; user-select: none; font-size: 1.1rem; font-weight: 700; color: var(--accent); border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1.25rem; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="cat-toggle-icon" style="transition: transform 0.2s; transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; display: inline-block;">▼</span>
            <span>${escapeHTML(category)}</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div class="drag-handle" style="cursor: grab; font-size: 1.2rem; color: var(--text-muted); padding: 0 0.5rem; touch-action: none;" title="Drag to reorder">⋮⋮</div>
            <button class="btn btn-icon btn-edit-cat" data-cat="${escapeHTML(category)}" style="font-size: 0.9rem; color: var(--text-secondary);" title="Rename Category">✎</button>
            <button class="btn btn-icon btn-delete-cat" data-cat="${escapeHTML(category)}" style="font-size: 0.9rem; color: var(--text-secondary);" title="Delete Category">🗑️</button>
          </div>
        </h2>
        <div class="category-content" id="cat-content-${safeCatId}" style="display: ${isCollapsed ? 'none' : 'block'};">
          <div class="cards-grid ${currentViewMode !== 'grid' ? 'view-mode-' + currentViewMode : ''}" style="margin-top: 0;">
            ${catBookmarks.length === 0 ? '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">No links in this category.</div>' : ''}
          ${catBookmarks.map(b => {
            let domain = 'unknown';
            try {
              domain = new URL(b.url).hostname;
            } catch(err) {
              domain = b.url;
            }

            const thumbnailHTML = getLinkThumbnailHTML(b.url);

            return `
              <div class="card">
                ${thumbnailHTML}
                <div class="card-header">
                  <div class="card-title" title="${escapeHTML(b.title)}">${escapeHTML(b.title)}</div>
                  <div class="card-actions">
                    <button class="btn btn-icon btn-copy" data-url="${escapeHTML(b.url)}" title="Copy Link">📋</button>
                    <button class="btn btn-icon btn-edit-bookmark" data-id="${b.id}" title="Modify Link">✏️</button>
                    <button class="btn btn-icon btn-delete-bookmark" data-id="${b.id}" style="color: var(--danger); border-color: rgba(239,68,68,0.2)" title="Purge Link">&times;</button>
                  </div>
                </div>
                <div class="card-body">
                  <div style="color: var(--text-muted); margin-bottom: 0.5rem;">Source: ${escapeHTML(domain)}</div>
                  ${b.lastAccessed ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${formatRelativeTime(b.lastAccessed)}</div>` : ''}
                  <a href="${escapeHTML(b.url)}" target="_blank" class="btn btn-primary btn-visit-library" data-id="${b.id}" style="margin-top: 0.25rem; text-decoration: none;">
                    Visit Resource
                  </a>
                </div>
                <div class="card-footer">
                  ${b.tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ')}
                </div>
              </div>
            `;
          }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  cardsContainer.innerHTML = html;
  
  if (window.Sortable) {
    new Sortable(cardsContainer, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function () {
        const newOrder = [];
        document.querySelectorAll('.category-section').forEach(sec => {
          const cat = sec.getAttribute('data-category');
          if (cat) newOrder.push(cat);
        });
        localStorage.setItem('myloom_category_order', JSON.stringify(newOrder));
        categoryOrder = newOrder;
      }
    });
  }
}

function getLinkThumbnailHTML(url) {
  let isYouTube = false;
  let ytId = '';
  
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      isYouTube = true;
      if (urlObj.pathname.includes('/shorts/')) {
        ytId = urlObj.pathname.split('/shorts/')[1].split('/')[0];
      } else if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.get('v')) {
        ytId = urlObj.searchParams.get('v');
      } else if (urlObj.hostname.includes('youtu.be')) {
        ytId = urlObj.pathname.split('/')[1];
      }
    }
    
    if (isYouTube && ytId) {
      // 1. YouTube Video: Direct HD fetch
      return `
        <div class="link-thumbnail-container">
          <img class="link-thumbnail-img" src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" alt="YouTube Thumbnail" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${ytId}/hqdefault.jpg';">
        </div>
      `;
    } else if (isYouTube && !ytId) {
      // 2. YouTube Playlist/Channel: 11ty OpenGraph scrape
      const encodedUrl = encodeURIComponent(url);
      return `
        <div class="link-thumbnail-container">
          <img class="link-thumbnail-img" src="https://v1.opengraph.11ty.dev/${encodedUrl}/medium/" alt="Playlist Thumbnail">
        </div>
      `;
    } else {
      // 3. Generic Links: Website screenshot via WordPress mshots
      const encodedUrl = encodeURIComponent(url);
      return `
        <div class="link-thumbnail-container">
          <img class="link-thumbnail-img" src="https://s.wordpress.com/mshots/v1/${encodedUrl}?w=600" alt="Site Preview">
        </div>
      `;
    }
  } catch (err) {
    return `
      <div class="link-thumbnail-container" style="background-color: var(--bg-surface);">
        <span style="font-size: 2rem; color: var(--accent);">🔗</span>
      </div>
    `;
  }
}

// Helpers
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Relative time formatting helper
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Accessed just now';
  if (diffMins < 60) return `Accessed ${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `Accessed ${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Accessed ${diffDays}d ago`;
}
