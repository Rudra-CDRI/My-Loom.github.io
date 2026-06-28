/* -------------------------------------------------------------
   MY LOOM // OPERATIONS DASHBOARD VIEW MODULE
   ------------------------------------------------------------- */

import { getTasks, getInternships, getBookmarks, getDocuments, getCalendarEvents, subscribe, getCategoryColor, updateTask } from '../store.js';
import { writeTerminal } from '../app.js';
import { showDialog } from '../components/dialog.js';

let storeUnsubscribe = null;
let containerRef = null;
let currentCalDate = new Date();
let selectedBacklogTask = null;

export const DashboardView = {
  render(container) {
    containerRef = container;
    
    // Choose initial random backlog task if none selected
    fetchRandomBacklogTask();

    // 1. Scaffold Dashboard widgets layout in a clean Bento Grid configuration
    container.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Operations Dashboard</h1>
      </header>

      <!-- Row 1: Quick Actions (Full width) -->
      <section class="widget" id="widget-quick-actions" style="margin-bottom: 16px;">
        <div class="widget-content" style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; padding: 1.25rem;">
          <button class="btn btn-primary" id="btn-quick-task" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">✚ Create Task</button>
          <button class="btn btn-primary" id="btn-quick-intern" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">✚ Log Internship</button>
          <button class="btn btn-primary" id="btn-quick-link" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">✚ Save Link</button>
          <button class="btn btn-primary" id="btn-quick-doc" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">✚ Upload Document</button>
        </div>
      </section>

      <!-- Bento Grid (2fr Left Column, 1fr Right Column) -->
      <div class="dashboard-bento-grid">
        <!-- Left Column (2fr) -->
        <div class="dashboard-left-column" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Immediate Focus Widget -->
          <section class="widget focus-widget" id="widget-focus">
            <h2 class="widget-title">Immediate Focus</h2>
            <div class="widget-content">
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="col-status">State</th>
                      <th>Task Details</th>
                      <th class="col-category">Category</th>
                      <th class="col-date">Deadline</th>
                      <th class="col-priority">Priority</th>
                    </tr>
                  </thead>
                  <tbody id="dashboard-focus-list">
                    <!-- Loaded dynamically -->
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- Vault Activity Widget -->
          <section class="widget vault-activity-widget" id="widget-vault-activity">
            <h2 class="widget-title">Vault Activity</h2>
            <div class="widget-content" id="vault-activity-content">
              <!-- Loaded dynamically -->
            </div>
          </section>
        </div>

        <!-- Right Column (1fr) -->
        <div class="dashboard-right-column" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Operations Calendar Widget -->
          <section class="widget calendar-widget" id="widget-calendar">
            <h2 class="widget-title">Operations Calendar</h2>
            <div class="widget-content" style="padding: 1.5rem;">
              <div class="calendar-container" style="border: none; padding: 0; box-shadow: none; background: transparent; max-width: 100%;">
                <div class="calendar-header">
                  <button class="btn" id="dash-cal-prev" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&lt;</button>
                  <div class="calendar-month-title" id="dash-cal-title">Month Year</div>
                  <button class="btn" id="dash-cal-next" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&gt;</button>
                </div>
                <div class="calendar-grid" id="dash-cal-grid">
                  <!-- Monthly cells loaded dynamically -->
                </div>
              </div>
            </div>
          </section>

          <!-- From the Backlog Widget -->
          <section class="widget backlog-reminder-widget" id="widget-backlog-reminder">
            <h2 class="widget-title">From the Backlog</h2>
            <div class="widget-content" id="backlog-reminder-content">
              <!-- Loaded dynamically -->
            </div>
          </section>
        </div>
      </div>

      <!-- Dashboard Calendar Day View Modal -->
      <div class="overlay" id="dash-calendar-day-overlay">
        <div class="modal" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title monospace" id="dash-cal-day-title">[Day Overview]</h3>
            <button class="modal-close" id="dash-cal-day-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div id="dash-cal-day-events-list" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
              <!-- Rendered dynamically -->
            </div>
            <button class="btn btn-primary" id="dash-cal-day-add-task-btn" style="width: 100%;">+ Initialize Task for this Date</button>
          </div>
        </div>
      </div>
    `;

    // 2. Bind Events
    bindEvents();

    // 3. Render dynamic views
    renderDashboard();

    // 4. Subscribe to store changes to keep UI reactive
    storeUnsubscribe = subscribe(() => {
      renderDashboard();
    });
  },

  destroy() {
    if (storeUnsubscribe) {
      storeUnsubscribe();
      storeUnsubscribe = null;
    }
    containerRef = null;
  }
};

function fetchRandomBacklogTask() {
  const tasks = getTasks();
  const backlogTasks = tasks.filter(t => t.status !== 'Done' && (t.category === 'Someday / Backlog' || !t.dueDate));
  if (backlogTasks.length === 0) {
    selectedBacklogTask = null;
    return;
  }
  // Check if current selection is still valid and active in backlog
  if (!selectedBacklogTask || !backlogTasks.some(t => t.id === selectedBacklogTask.id)) {
    const idx = Math.floor(Math.random() * backlogTasks.length);
    selectedBacklogTask = backlogTasks[idx];
  }
}

function bindEvents() {
  const prevBtn = document.getElementById('dash-cal-prev');
  const nextBtn = document.getElementById('dash-cal-next');
  const calGrid = document.getElementById('dash-cal-grid');

  const btnTask = document.getElementById('btn-quick-task');
  const btnIntern = document.getElementById('btn-quick-intern');
  const btnLink = document.getElementById('btn-quick-link');
  const btnDoc = document.getElementById('btn-quick-doc');

  const todayStr = new Date().toISOString().split('T')[0];

  if (btnTask) {
    btnTask.addEventListener('click', () => {
      window.openQuickAddModal(todayStr, 'task');
    });
  }
  if (btnIntern) {
    btnIntern.addEventListener('click', () => {
      window.openQuickAddModal(todayStr, 'internship');
    });
  }
  if (btnLink) {
    btnLink.addEventListener('click', () => {
      sessionStorage.setItem('open-bookmark-modal', 'true');
      location.hash = '#/library';
    });
  }
  if (btnDoc) {
    btnDoc.addEventListener('click', () => {
      sessionStorage.setItem('trigger-file-upload', 'true');
      location.hash = '#/vault';
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderDashboard();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderDashboard();
    });
  }

  if (calGrid) {
    calGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.calendar-day');
      if (!cell || !cell.dataset.date) return;
      
      const dateStr = cell.dataset.date;
      renderDashboardDayView(dateStr);
      document.getElementById('dash-calendar-day-overlay').classList.add('active');
    });
  }

  const dashDayOverlay = document.getElementById('dash-calendar-day-overlay');
  if (dashDayOverlay) {
    dashDayOverlay.addEventListener('click', (e) => {
      // Close Day View
      if (e.target.closest('#dash-cal-day-close-btn') || e.target === dashDayOverlay) {
        dashDayOverlay.classList.remove('active');
      }
      
      // Add Task from Day View
      const addBtn = e.target.closest('#dash-cal-day-add-task-btn');
      if (addBtn) {
        e.preventDefault();
        dashDayOverlay.classList.remove('active');
        const dateStr = addBtn.getAttribute('data-date');
        window.openQuickAddModal(dateStr, 'task');
      }
    });
  }
}

function renderDashboard() {
  if (!containerRef) return;

  const tasks = getTasks();
  const documents = getDocuments();
  const today = new Date();

  // --- 1. Render Operations Month Calendar Grid ---
  const calTitle = document.getElementById('dash-cal-title');
  const calGrid = document.getElementById('dash-cal-grid');
  if (calTitle && calGrid) {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    calTitle.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    let gridHTML = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => `
      <div class="calendar-day-label">${day}</div>
    `).join('');

    const events = getCalendarEvents(month, year);

    // Prev month cells padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevTotalDays - i;
      gridHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
    }

    // Current month cells
    for (let day = 1; day <= totalDays; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);

      let eventDotHTML = '';
      let tooltipHTML = '';

      if (dayEvents.length > 0) {
        eventDotHTML = `<div class="calendar-day-events">` + 
          dayEvents.slice(0, 3).map(e => {
            return `<div class="calendar-event-dot" style="background-color: ${e.color}; box-shadow: 0 0 4px ${e.color};"></div>`;
          }).join('') + 
          `</div>`;
        
        tooltipHTML = `<div class="calendar-tooltip">` + 
          dayEvents.map(e => `• ${escapeHTML(e.title)}`).join('<br>') + 
          `</div>`;
      }

      gridHTML += `
        <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}" style="cursor: pointer;">
          ${day}
          ${eventDotHTML}
          ${tooltipHTML}
        </div>
      `;
    }

    // Next month cells padding
    const totalCells = firstDayIndex + totalDays;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
      gridHTML += `<div class="calendar-day other-month">${day}</div>`;
    }

    calGrid.innerHTML = gridHTML;
  }

  // --- 2. Render Suggestion Widget: Immediate Focus ---
  const focusListEl = document.getElementById('dashboard-focus-list');
  if (focusListEl) {
    const focusTasks = tasks.filter(t => {
      if (t.status === 'Done') return false;
      if (t.dueDate) {
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);
        const tomorrowDate = new Date(todayDate);
        tomorrowDate.setDate(todayDate.getDate() + 1);
        
        // Match today or tomorrow
        const d = new Date(t.dueDate + 'T12:00:00');
        return d >= todayDate && d <= new Date(tomorrowDate.getTime() + 86400000);
      }
      return false;
    });

    focusTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (focusTasks.length === 0) {
      focusListEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No immediate tasks due today or tomorrow.
          </td>
        </tr>
      `;
    } else {
      focusListEl.innerHTML = focusTasks.map(task => {
        const isInProgress = task.status === 'In Progress';
        let stateIndicator = '[ ]';
        let stateClass = 'todo-pending';
        if (isInProgress) {
          stateIndicator = '[-]';
          stateClass = 'todo-in-progress';
        }

        return `
          <tr style="cursor: default;">
            <td class="status-cell ${stateClass} monospace" style="font-size: 0.95rem;">${stateIndicator}</td>
            <td>
              <div style="font-weight: 700; color: var(--text-primary);">${escapeHTML(task.title)}</div>
              ${task.description ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">${escapeHTML(task.description)}</div>` : ''}
            </td>
            <td style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">${escapeHTML(task.category)}</td>
            <td class="monospace" style="font-size: 0.8rem;">${task.dueDate || 'N/A'}</td>
            <td><span class="pri-badge pri-${task.priority.toLowerCase()}">${task.priority}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // --- 3. Render Suggestion Widget: Vault Activity ---
  const vaultContent = document.getElementById('vault-activity-content');
  if (vaultContent) {
    const sortedDocs = [...documents]
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
      .slice(0, 3);

    if (sortedDocs.length === 0) {
      vaultContent.innerHTML = `<div style="color: var(--text-muted); text-align: center; font-size: 0.85rem; padding: 1rem 0;">No documents in vault yet.</div>`;
    } else {
      vaultContent.innerHTML = `
        <ul class="activity-list" style="margin: 0; padding: 0;">
          ${sortedDocs.map(d => {
            let icon = '📄';
            if (d.type === 'pdf') {
              icon = '<span style="color: var(--accent);">📄</span>';
            } else if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(d.type)) {
              icon = '🖼️';
            } else if (['zip', 'rar', 'tar', 'gz'].includes(d.type)) {
              icon = '📦';
            }
            
            return `
              <li class="activity-item" style="border-left: 4px solid var(--accent); padding-left: 1rem;">
                <span class="file-icon" style="font-size: 1.2rem;">${icon}</span>
                <div class="file-details">
                  <span class="file-name" style="font-weight: 700;">${escapeHTML(d.name)}</span>
                  <span class="file-meta" style="font-size: 0.75rem; color: var(--text-muted);">${formatBytes(d.size)} &bull; Uploaded ${formatRelativeTime(d.uploadDate)}</span>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    }
  }

  // --- 4. Render From the Backlog Reminder Widget ---
  const backlogContent = document.getElementById('backlog-reminder-content');
  if (backlogContent) {
    fetchRandomBacklogTask();
    if (!selectedBacklogTask) {
      backlogContent.innerHTML = `<div style="color: var(--text-muted); text-align: center; font-size: 0.85rem; padding: 1.5rem 0;">No pending backlog tasks.</div>`;
    } else {
      backlogContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem; height: 100%; justify-content: space-between;">
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 0.25rem;">
              ${escapeHTML(selectedBacklogTask.title)}
            </div>
            ${selectedBacklogTask.description ? `<div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 0.5rem;">${escapeHTML(selectedBacklogTask.description)}</div>` : ''}
            <div>
              <span class="tag">${escapeHTML(selectedBacklogTask.category)}</span>
            </div>
          </div>
          <button class="btn btn-primary" id="btn-backlog-add-today" data-id="${selectedBacklogTask.id}" style="width: 100%; justify-content: center;">
            ⚡ Add to Today
          </button>
        </div>
      `;

      // Bind button listener
      const addTodayBtn = document.getElementById('btn-backlog-add-today');
      if (addTodayBtn) {
        addTodayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = addTodayBtn.getAttribute('data-id');
          const todayStr = new Date().toISOString().split('T')[0];
          const taskTitle = selectedBacklogTask.title;
          selectedBacklogTask = null; // Clear first so store notification picks a new one
          updateTask(id, { dueDate: todayStr, category: 'Daily Tasks' });
          writeTerminal(`Promoted backlog task to today: "${taskTitle}"`, 'TASK');
        });
      }
    }
  }
}

// Relative time formatting helper
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// Byte formatting helper
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderDashboardDayView(dateStr) {
  const container = document.getElementById('dash-cal-day-events-list');
  const title = document.getElementById('dash-cal-day-title');
  const addBtn = document.getElementById('dash-cal-day-add-task-btn');
  if (!container || !title || !addBtn) return;

  // Format date
  const d = new Date(dateStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  title.textContent = `[${d.toLocaleDateString(undefined, options)}]`;
  addBtn.setAttribute('data-date', dateStr);

  const tasks = getTasks();
  let events = tasks.filter(t => t.dueDate === dateStr).map(t => ({
    title: t.title,
    category: t.category,
    color: getCategoryColor(t.category),
    isDone: t.status === 'Done'
  }));

  const internships = getInternships();
  // Internship Deadlines
  internships.filter(i => i.deadline === dateStr && i.status !== 'Rejected').forEach(i => {
    events.push({ title: `Deadline: ${i.company}`, category: 'Internship', color: '#ef4444', isDone: false });
  });
  // Internship Start Dates
  internships.filter(i => i.startDate === dateStr && i.status !== 'Rejected').forEach(i => {
    events.push({ title: `Start Date: ${i.company}`, category: 'Internship', color: '#10b981', isDone: false });
  });

  if (events.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No tasks or deadlines scheduled.</div>`;
    return;
  }

  container.innerHTML = events.map(e => `
    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; opacity: ${e.isDone ? '0.5' : '1'}; text-decoration: ${e.isDone ? 'line-through' : 'none'};">
      <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${e.color}; box-shadow: 0 0 4px ${e.color};"></div>
      <div style="flex: 1;">
        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${escapeHTML(e.title)}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">
          ${escapeHTML(e.category)}
        </div>
      </div>
    </div>
  `).join('');
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
