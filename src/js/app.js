/* -------------------------------------------------------------
   MY LOOM // MAIN ROUTER & APP COORDINATOR
   ------------------------------------------------------------- */

import { DashboardView } from './modules/dashboard.js';
import { TasksView } from './modules/tasks.js';
import { VaultView } from './modules/vault.js';
import { LibraryView } from './modules/library.js';
import { InternshipView } from './modules/internships.js';

import { initCanvasGrid } from './canvas-grid.js';
import { initCursorAndParallax } from './cursor-parallax.js';
import { addTask, addInternship, getTaskCategories, subscribe, undo, redo, canUndo, canRedo, getSyncCategories, saveSyncCategories, initializeStore, getBookmarkCategories } from './store.js';
import { supabase } from './db.js';
import { showDialog, showPrompt } from './components/dialog.js';

// Global UI Interceptor
window.alert = function(message) {
  showDialog(message);
};
window.confirm = function(message) {
  console.warn("Synchronous window.confirm is deprecated. Using showDialog instead, but it's asynchronous and won't return a boolean.");
  showDialog(message);
  return false;
};
window.prompt = function(message, defaultVal) {
  console.warn("Synchronous window.prompt is deprecated. Using showPrompt instead, but it's asynchronous and won't return a value synchronously.");
  showPrompt(message, defaultVal || '', () => {});
  return null;
};

// Route Map
const routes = {
  '#/dashboard': DashboardView,
  '#/tasks': TasksView,
  '#/vault': VaultView,
  '#/library': LibraryView,
  '#/internships': InternshipView
};

let currentView = null;

// Terminal Log History Buffer
const terminalLogs = [
  'Initialize Loom OS Kernel... Done.',
  'Loading local state store... Syncing complete.',
  'Connected to client session: user@rudra',
  'All systems nominal. Operational parameters loaded.',
  'Awaiting directive...'
];

export function writeTerminal(message, type = 'INFO') {
  const timestamp = new Date().toTimeString().split(' ')[0];
  const formattedMsg = `[${timestamp}] [${type}] ${message}`;
  
  terminalLogs.push(formattedMsg);
  
  if (terminalLogs.length > 50) {
    terminalLogs.shift();
  }

  const terminalEl = document.getElementById('terminal-log');
  if (terminalEl) {
    terminalEl.innerHTML += `\n${formattedMsg}`;
    terminalEl.scrollTop = terminalEl.scrollHeight;
  }
}

export function getTerminalLogs() {
  return terminalLogs.join('\n');
}

// Router function
function router() {
  const hash = window.location.hash || '#/dashboard';
  
  // 1. Update footer status bar route
  const routeStatus = document.getElementById('status-route');
  if (routeStatus) {
    routeStatus.innerHTML = `<span>ROUTE: ${hash}</span>`;
  }
  
  // 2. Update sidebar nav links active states
  const sidebarLinks = document.querySelectorAll('.nav-link');
  sidebarLinks.forEach(link => {
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 3. Match Route
  const ViewModule = routes[hash] || DashboardView;

  // 4. Destroy previous view lifecycle
  if (currentView && typeof currentView.destroy === 'function') {
    currentView.destroy();
  }

  // 5. Render new view and trigger smooth reveal
  const container = document.getElementById('app-container');
  if (container) {
    currentView = ViewModule;
    currentView.render(container);
    triggerViewReveal();
  }
}

// Micro-interaction: View Scroll Reveal
function triggerViewReveal() {
  const container = document.getElementById('app-container');
  if (container) {
    container.classList.remove('visible');
    // Allow layout reflow before triggering fade-in and slide-up animation
    setTimeout(() => {
      container.classList.add('visible');
    }, 50);
  }
}

// Telemetry Tickers
let uptimeSecs = 0;
let simulationInterval = null;

function initTickers() {
  // 1. Uptime clock
  setInterval(() => {
    uptimeSecs++;
    const hrs = String(Math.floor(uptimeSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((uptimeSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(uptimeSecs % 60).padStart(2, '0');
    const uptimeEl = document.getElementById('status-uptime');
    if (uptimeEl) {
      uptimeEl.innerHTML = `<span>UPTIME: ${hrs}:${mins}:${secs}</span>`;
    }
  }, 1000);

  // 2. Local system clock
  setInterval(() => {
    const timeEl = document.getElementById('status-time');
    if (timeEl) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];
      timeEl.innerHTML = `<span>TIME: ${dateStr} ${timeStr}</span>`;
    }
  }, 1000);

  // 3. Simulated system activity log updates
  simulationInterval = setInterval(() => {
    const alerts = [
      'Performing health checks on storage blocks...',
      'Garbage collection executed on database cache.',
      'Incoming ping from sub-orbital node: OPTIMAL.',
      'Refreshing encrypted security keys.',
      'Checking file catalog integrity... 100% OK.',
      'Recalibrating UI coordinates for desktop interface.'
    ];
    if (Math.random() < 0.25) {
      const msg = alerts[Math.floor(Math.random() * alerts.length)];
      writeTerminal(msg, 'SYS');
    }
  }, 12000);
}

// Dark/Light Theme Switcher Manager (Icon-only)
function initThemeSwitcher() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  const savedTheme = localStorage.getItem('loom_theme') || 'dark';

  // Apply default state
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if (themeIcon) themeIcon.textContent = '🌙';
  } else {
    document.body.classList.remove('light-mode');
    if (themeIcon) themeIcon.textContent = '🔆';
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('loom_theme', isLight ? 'light' : 'dark');
      
      if (isLight) {
        if (themeIcon) themeIcon.textContent = '🌙';
        writeTerminal('Theme switched to LIGHT OS console mode.', 'SYS');
      } else {
        if (themeIcon) themeIcon.textContent = '🔆';
        writeTerminal('Theme switched to DARK OS console mode.', 'SYS');
      }
    });
  }
}

// Mobile Responsive Collapsible Menu Handler
function initMobileNavigation() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const sidebarLinks = document.querySelectorAll('.nav-link');

  // Create backdrop element dynamically
  let backdrop = document.getElementById('sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  function toggleMenu(forceClose = false) {
    if (forceClose) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    } else {
      sidebar.classList.toggle('open');
      if (sidebar.classList.contains('open')) {
        backdrop.classList.add('active');
      } else {
        backdrop.classList.remove('active');
      }
    }
  }

  if (menuToggle && sidebar) {
    // Open/Close menu click
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Close menu when navigation happens
    sidebarLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          toggleMenu(true);
        }
      });
    });

    // Close sidebar when clicking outside
    backdrop.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        toggleMenu(true);
      }
    });
  }
}

function initAuth() {
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const guestBtn = document.getElementById('btn-guest-login');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const passInput = document.getElementById('login-password');

  // Ensure login is required if not authenticated
  if (!localStorage.getItem('loom_auth')) {
    loginOverlay.classList.add('active');
  }

  // Toggle password visibility
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
      } else {
        passInput.type = 'password';
        togglePassBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      }
    });
  }

  if (!loginOverlay || !loginForm) return;

  const currentSession = localStorage.getItem('loom_session');

  // Trigger initialization flow
  const completeAuth = async (sessionUser) => {
    localStorage.setItem('loom_session', sessionUser);
    loginOverlay.classList.remove('active');
    writeTerminal(`Session authorized for user: ${sessionUser}`, 'AUTH');
    
    // Initialize Supabase store data after authentication
    writeTerminal('Connecting to Supabase cloud instance...', 'SYS');
    await initializeStore();
    writeTerminal('Cloud database sync established.', 'SYS');
    
    // Subscribe to store events — only hydrate dropdowns, never call router()
    // Calling router() here would destroy the DOM on every state change!
    subscribe((eventType) => {
      if (eventType === 'categories' || eventType === 'bookmark_categories' || eventType === 'render') {
        hydrateDropdowns();
      }
    });

    // Trigger routing
    if (!window.location.hash || window.location.hash === '#/') {
      window.location.hash = '#/dashboard';
    } else {
      router();
    }
  };

  if (currentSession) {
    completeAuth(currentSession);
  } else {
    loginOverlay.classList.add('active');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

      if (email && password) {
        writeTerminal(`Initiating credentials check for ${email}...`, 'AUTH');
        // Simulating authentication placeholder
        await completeAuth(email);
      }
  });

  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      await completeAuth('rudra');
    });
  }
}

// Window DOM Load Listeners
window.addEventListener('DOMContentLoaded', () => {
  initDBCompatibility();
  
  // Initialize dynamic themes, canvas grid background, cursors, mobile toggle listeners, and clocks
  initThemeSwitcher();
  initMobileNavigation();
  initCanvasGrid();
  initCursorAndParallax();
  initTickers();
  initQuickAddModal();
  initUndoRedoHeader();
  initSyncSettingsModal();
  initGlobalFormValidation();
  
  // Setup authentication and UI setup
  initAuth();

  // Accessibility: Trap focus when modals are active
  const observer = new MutationObserver(() => {
    const isAnyModalOpen = document.querySelectorAll('.overlay.active').length > 0;
    const appContainer = document.getElementById('app-container');
    const sidebar = document.querySelector('.sidebar');
    const topNavbar = document.querySelector('.top-navbar');
    
    if (isAnyModalOpen) {
      if(appContainer) appContainer.setAttribute('inert', 'true');
      if(sidebar) sidebar.setAttribute('inert', 'true');
      if(topNavbar) topNavbar.setAttribute('inert', 'true');
    } else {
      if(appContainer) appContainer.removeAttribute('inert');
      if(sidebar) sidebar.removeAttribute('inert');
      if(topNavbar) topNavbar.removeAttribute('inert');
    }
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
});

// -------------------------------------------------------------
// GLOBAL QUICK ADD MODAL & DATE PICKER HELPERS
// -------------------------------------------------------------
function initQuickAddModal() {
  const overlay = document.getElementById('quick-add-overlay');
  const form = document.getElementById('quick-add-form');
  const typeSelect = document.getElementById('quick-add-type');
  const taskFields = document.getElementById('quick-add-task-fields');
  const internshipFields = document.getElementById('quick-add-internship-fields');
  const taskCategorySelect = document.getElementById('quick-task-category');
  const dateInput = document.getElementById('quick-add-date');
  const closeBtn = document.getElementById('quick-add-close-btn');
  const cancelBtn = document.getElementById('quick-add-cancel-btn');

  const rollingCheckbox = document.getElementById('quick-intern-deadline-na');
  const deadlineInput = document.getElementById('quick-intern-deadline');

  if (!overlay || !form) return;

  // Toggle visible form sections dynamically based on chosen Event Type
  typeSelect.addEventListener('change', () => {
    const val = typeSelect.value;
    if (val === 'task') {
      taskFields.style.display = 'block';
      internshipFields.style.display = 'none';
      document.getElementById('quick-task-title').setAttribute('required', 'true');
      document.getElementById('quick-intern-company').removeAttribute('required');
      document.getElementById('quick-intern-company').value = '';
      document.getElementById('quick-intern-role').removeAttribute('required');
      document.getElementById('quick-intern-role').value = '';
      document.getElementById('quick-intern-start-date').value = '';
      if (deadlineInput) {
        deadlineInput.value = '';
        deadlineInput.disabled = false;
      }
      if (rollingCheckbox) rollingCheckbox.checked = false;
    } else {
      taskFields.style.display = 'none';
      internshipFields.style.display = 'block';
      document.getElementById('quick-task-title').removeAttribute('required');
      document.getElementById('quick-task-title').value = '';
      document.getElementById('quick-task-priority').value = 'NONE';
      document.getElementById('quick-intern-company').setAttribute('required', 'true');
      document.getElementById('quick-intern-role').setAttribute('required', 'true');
    }
  });

  // Rolling admissions checkbox logic in Quick Add
  if (rollingCheckbox && deadlineInput) {
    rollingCheckbox.addEventListener('change', () => {
      if (rollingCheckbox.checked) {
        deadlineInput.value = '';
        deadlineInput.disabled = true;
      } else {
        deadlineInput.disabled = false;
      }
    });
  }

  const hideModal = () => {
    overlay.classList.remove('active');
    form.reset();
    if (deadlineInput) {
      deadlineInput.disabled = false;
    }
  };

  closeBtn.addEventListener('click', hideModal);
  cancelBtn.addEventListener('click', hideModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideModal();
    }
  });

  // Process Quick Add submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const type = typeSelect.value;
    const date = dateInput.value;
    const notes = document.getElementById('quick-add-notes').value.trim();

    if (type === 'task') {
      const title = document.getElementById('quick-task-title').value.trim();
      const category = taskCategorySelect ? taskCategorySelect.value : 'Daily Tasks';
      const priority = document.getElementById('quick-task-priority').value;
      if (title) {
        hideModal();
        const newTask = await addTask({
          title,
          description: notes,
          category,
          priority,
          status: 'Todo',
          dueDate: date
        });
        if (newTask) writeTerminal(`Quick Created task: "${newTask.title}" inside "${newTask.category}"`, 'TASK');
      }
    } else {
      const company = document.getElementById('quick-intern-company').value.trim();
      const role = document.getElementById('quick-intern-role').value.trim();
      const status = document.getElementById('quick-intern-status').value;
      const startDate = document.getElementById('quick-intern-start-date').value || date;
      const isRolling = rollingCheckbox ? rollingCheckbox.checked : false;
      const deadline = isRolling ? 'N/A' : (deadlineInput ? deadlineInput.value || 'N/A' : 'N/A');

      if (company && role) {
        hideModal();
        const newApp = await addInternship({
          company,
          role,
          status,
          date,
          startDate,
          deadline,
          notes
        });
        if (newApp) writeTerminal(`Quick Registered internship: "${newApp.role}" at ${newApp.company}`, 'INTERN');
      }
    }
  });

  // Expose opener globally
  window.openQuickAddModal = function(dateStr, defaultType = 'task') {
    dateInput.value = dateStr;
    typeSelect.value = defaultType;
    typeSelect.dispatchEvent(new Event('change'));

    // Render task categories option list dynamically
    const categories = getTaskCategories();
    if (taskCategorySelect) {
      if (categories.length === 0) {
        taskCategorySelect.innerHTML = '<option value="Daily Tasks">Daily Tasks</option>';
      } else {
        taskCategorySelect.innerHTML = categories.map(cat => `
          <option value="${cat}">${cat}</option>
        `).join('');
      }
    }

    if (defaultType === 'internship') {
      const startDInput = document.getElementById('quick-intern-start-date');
      if (startDInput) startDInput.value = dateStr;
    }

    overlay.classList.add('active');

    setTimeout(() => {
      if (defaultType === 'task') {
        const titleInput = document.getElementById('quick-task-title');
        if (titleInput) titleInput.focus();
      } else {
        const compInput = document.getElementById('quick-intern-company');
        if (compInput) compInput.focus();
      }
    }, 50);
  };
}

// Global click-to-picker trigger for custom date inputs
document.addEventListener('click', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'date') {
    try {
      e.target.showPicker();
    } catch (err) {
      console.warn('showPicker failed or is not supported:', err);
    }
  }
});

window.addEventListener('hashchange', router);

// Ensure localStorage access
function initDBCompatibility() {
  try {
    localStorage.setItem('loom_probe', '1');
    localStorage.removeItem('loom_probe');
  } catch (e) {
    console.error('LocalStorage is blocked. Falling back to session memory store.');
    const memStore = {};
    window.localStorage = {
      getItem: (key) => memStore[key] || null,
      setItem: (key, val) => { memStore[key] = String(val); },
      removeItem: (key) => { delete memStore[key]; },
      clear: () => { for (const k in memStore) delete memStore[k]; }
    };
  }
}

// Global Toast System
export function showToast(header, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  
  const headerEl = document.createElement('div');
  headerEl.className = 'toast-header';
  headerEl.textContent = header;
  
  const bodyEl = document.createElement('div');
  bodyEl.className = 'toast-body';
  bodyEl.textContent = message;
  
  toast.appendChild(headerEl);
  toast.appendChild(bodyEl);
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// Global subscriptions and hotkeys
subscribe((event, data) => {
  if (event === 'undo_redo' && data) {
    showToast(data.action, data.message);
  }
});

document.addEventListener('keydown', (e) => {
  const targetTag = e.target.tagName.toLowerCase();
  if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
    return; // Don't intercept undo/redo inside text inputs
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
});

// Setup Undo/Redo Header Buttons
function initUndoRedoHeader() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');

  if (!undoBtn || !redoBtn) return;

  const updateButtons = () => {
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
  };

  undoBtn.addEventListener('click', () => {
    undo();
  });

  redoBtn.addEventListener('click', () => {
    redo();
  });

  subscribe(updateButtons);
  updateButtons();
}

// Setup Sync Settings Modal
function initSyncSettingsModal() {
  const overlay = document.getElementById('sync-settings-overlay');
  const form = document.getElementById('sync-settings-form');
  const container = document.getElementById('sync-categories-checkboxes');
  const closeBtn = document.getElementById('sync-settings-close-btn');
  const cancelBtn = document.getElementById('sync-settings-cancel-btn');

  if (!overlay || !form || !container) return;

  const hideModal = () => {
    overlay.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const checked = [];
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      if (chk.checked) {
        checked.push(chk.value);
      }
    });
    saveSyncCategories(checked);
    showToast('Sync Preferences', 'Saved sync settings successfully.');
    hideModal();
  });

  window.openSyncSettingsModal = function() {
    const categories = getTaskCategories();
    const synced = getSyncCategories();

    container.innerHTML = categories.map(cat => {
      const isChecked = synced.includes(cat);
      return `
        <label class="select-none" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.25rem;">
          <input type="checkbox" value="${escapeHTML(cat)}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
          ${escapeHTML(cat)}
        </label>
      `;
    }).join('');

    overlay.classList.add('active');
  };
}

// Global form validation installer
function initGlobalFormValidation() {
  window.validateFormFields = function(formEl) {
    if (!formEl) return true;
    const requiredInputs = formEl.querySelectorAll('[required]');
    let isValid = true;
    
    requiredInputs.forEach(input => {
      input.classList.remove('validation-error');
      const existingWarning = input.parentNode.querySelector('.validation-error-text');
      if (existingWarning) {
        existingWarning.remove();
      }
      
      const val = input.value.trim();
      if (!val) {
        isValid = false;
        input.classList.add('validation-error');
        
        const warning = document.createElement('span');
        warning.className = 'validation-error-text';
        warning.textContent = 'This field is required.';
        input.parentNode.appendChild(warning);
        
        const removeError = () => {
          input.classList.remove('validation-error');
          warning.remove();
          input.removeEventListener('input', removeError);
          input.removeEventListener('change', removeError);
        };
        input.addEventListener('input', removeError);
        input.addEventListener('change', removeError);
      }
    });
    
    return isValid;
  };
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// -------------------------------------------------------------
// DROPDOWN HYDRATION — updates ALL known dropdowns across the app
// -------------------------------------------------------------
export function hydrateDropdowns() {
  const taskCats = getTaskCategories();
  const bookmarkCats = getBookmarkCategories();

  // Quick Add modal task category select (lives in index.html)
  const quickTaskCategory = document.getElementById('quick-task-category');
  if (quickTaskCategory) {
    const current = quickTaskCategory.value;
    quickTaskCategory.innerHTML = taskCats.length
      ? taskCats.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('')
      : '<option value="Daily Tasks">Daily Tasks</option>';
    // Restore selection if still valid
    if (taskCats.includes(current)) quickTaskCategory.value = current;
  }

  // Task Thread form category select (lives inside tasks.js rendered HTML)
  const taskFormCategory = document.getElementById('task-category-select');
  if (taskFormCategory) {
    const current = taskFormCategory.value;
    taskFormCategory.innerHTML = taskCats.length
      ? taskCats.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('')
      : '<option value="Daily Tasks">Daily Tasks</option>';
    if (taskCats.includes(current)) taskFormCategory.value = current;
  }

  // Task Thread filter category select
  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    const current = filterCategory.value;
    filterCategory.innerHTML = '<option value="ALL">Category: All</option>' +
      taskCats.map(cat => `<option value="${escapeHTML(cat)}">Category: ${escapeHTML(cat)}</option>`).join('');
    if (current === 'ALL' || taskCats.includes(current)) filterCategory.value = current;
  }

  // Bookmark category datalist
  const bookmarkDatalist = document.getElementById('bookmark-categories-list');
  if (bookmarkDatalist) {
    bookmarkDatalist.innerHTML = bookmarkCats
      .map(cat => `<option value="${escapeHTML(cat)}"></option>`).join('');
  }
}

// Global exposure
window.router = router;
window.writeTerminal = writeTerminal;
window.getTerminalLogs = getTerminalLogs;
window.hydrateDropdowns = hydrateDropdowns;
