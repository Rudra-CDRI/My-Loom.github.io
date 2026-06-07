/* -------------------------------------------------------------
   MY LOOM // TASK THREAD VIEW MODULE
   ------------------------------------------------------------- */

import { getTasks, addTask, updateTask, deleteTask, getTaskCategories, addTaskCategory, updateTaskCategory, deleteTaskCategory, subscribe, getSyncCategories, saveSyncCategories, getCategoryColor, getInternships, getCalendarEvents } from '../store.js';
import { writeTerminal } from '../app.js';
import { showDialog, showPrompt } from '../components/dialog.js';

let storeUnsubscribe = null;
let containerRef = null;
let editingTaskId = null;
let editingTaskId_local = null;

// Calendar month state
let currentCalDate = new Date();
let syncDeadlinesEnabled = true;

// Active filters
let activeSearchQuery = '';
let activeFilterCategory = 'ALL';
let activeFilterStatus = 'ALL';
let activeFilterPriority = 'ALL';

export const TasksView = {
  render(container) {
    containerRef = container;
    
    // 1. Build initial layout structure
    container.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Task Thread</h1>
      </header>

      <div class="dashboard-grid">
        <!-- Main Tasks Column (Left) -->
        <div class="tasks-main-column" style="grid-column: span 8;">
          <!-- Toolbar with search, filters and trigger to add task/category -->
          <div class="toolbar" style="flex-wrap: wrap; gap: 0.75rem;">
            <div class="actions-group" style="flex: 1; min-width: 280px; flex-wrap: wrap; gap: 0.5rem;">
              <input type="text" id="task-search" class="form-control search-input" placeholder="Search tasks..." value="${escapeHTML(activeSearchQuery)}">
              <select id="filter-category" class="form-control" style="width: auto;">
                <option value="ALL">Category: All</option>
                <!-- Categories loaded dynamically -->
              </select>
              <select id="filter-status" class="form-control" style="width: auto;">
                <option value="ALL" ${activeFilterStatus === 'ALL' ? 'selected' : ''}>Status: All</option>
                <option value="Todo" ${activeFilterStatus === 'Todo' ? 'selected' : ''}>Status: Todo</option>
                <option value="In Progress" ${activeFilterStatus === 'In Progress' ? 'selected' : ''}>Status: In Progress</option>
                <option value="Done" ${activeFilterStatus === 'Done' ? 'selected' : ''}>Status: Done</option>
              </select>
              <select id="filter-priority" class="form-control" style="width: auto;">
                <option value="ALL" ${activeFilterPriority === 'ALL' ? 'selected' : ''}>Priority: All</option>
                <option value="HIGH" ${activeFilterPriority === 'HIGH' ? 'selected' : ''}>Priority: High</option>
                <option value="MED" ${activeFilterPriority === 'MED' ? 'selected' : ''}>Priority: Med</option>
                <option value="LOW" ${activeFilterPriority === 'LOW' ? 'selected' : ''}>Priority: Low</option>
                <option value="NONE" ${activeFilterPriority === 'NONE' ? 'selected' : ''}>Priority: None</option>
              </select>
            </div>
            <div class="actions-group" style="margin-left: auto;">
              <button class="btn" id="btn-manage-categories" title="View, rename or delete categories">⚙ Manage</button>
              <button class="btn" id="btn-add-category" title="Create a custom task category">+ Category</button>
              <button class="btn btn-primary" id="btn-add-task">+ Initialize Task</button>
            </div>
          </div>

          <!-- Tasks List Stream -->
          <div class="widget">
            <h2 class="widget-title">Task Stream</h2>
            <div class="widget-content">
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="col-status">State</th>
                      <th>Task Details</th>
                      <th>Category</th>
                      <th class="col-date">Deadline</th>
                      <th class="col-priority">Priority</th>
                      <th style="width: 120px; text-align: right;">Operations</th>
                    </tr>
                  </thead>
                  <tbody id="tasks-table-body">
                    <!-- Dynamic Tasks -->
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Calendar Column (Right) -->
        <div class="tasks-side-column" style="grid-column: span 4;">
          <div class="widget">
            <h2 class="widget-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span>Deadlines Calendar</span>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <button id="btn-sync-settings" style="cursor: pointer; background: none; border: none; color: var(--text-secondary); font-size: 0.8rem; display: flex; align-items: center; gap: 0.15rem;" title="Sync Settings">
                  ⚙ Settings
                </button>
                <label class="select-none" style="font-size: 0.7rem; font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                  <input type="checkbox" id="task-sync-deadlines" ${syncDeadlinesEnabled ? 'checked' : ''} style="cursor: pointer;">
                  Sync
                </label>
              </div>
            </h2>
            <div class="widget-content" style="padding: 1.5rem;">
              <div class="calendar-container" style="border: none; padding: 0; box-shadow: none; background: transparent;">
                <div class="calendar-header">
                  <button class="btn" id="task-cal-prev" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&lt;</button>
                  <div class="calendar-month-title" id="task-cal-title">Month Year</div>
                  <button class="btn" id="task-cal-next" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&gt;</button>
                </div>
                <div class="calendar-grid" id="task-cal-grid">
                  <!-- Monthly cells loaded dynamically -->
                </div>
                <div class="calendar-sync-categories" id="task-cal-sync-categories" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.25rem; justify-content: center;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Task Modal Overlay -->
      <div class="overlay" id="add-task-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title" id="task-modal-title">[Create New Task]</h3>
            <button class="modal-close" id="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="add-task-form">
              <div class="form-group">
                <label class="form-label" for="task-title">Task Title</label>
                <input type="text" id="task-title" class="form-control" required placeholder="Describe core operation...">
              </div>
              <div class="form-group">
                <label class="form-label" for="task-desc">Description</label>
                <textarea id="task-desc" class="form-control" rows="3" placeholder="Additional details..."></textarea>
              </div>
              <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label class="form-label" for="task-category-select">Category</label>
                  <select id="task-category-select" class="form-control">
                    <!-- Loaded dynamically -->
                  </select>
                </div>
                <div>
                  <label class="form-label" for="task-priority">Priority Level</label>
                  <select id="task-priority" class="form-control monospace">
                    <option value="NONE">NONE</option>
                    <option value="LOW">LOW</option>
                    <option value="MED">MED</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>
              <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label class="form-label" for="task-status">Initial Status</label>
                  <select id="task-status" class="form-control">
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div>
                  <label class="form-label" for="task-duedate">Due Date</label>
                  <input type="date" id="task-duedate" class="form-control monospace">
                </div>
              </div>
              <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label class="form-label" for="task-recurrence">Repeat</label>
                  <select id="task-recurrence" class="form-control">
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-primary" type="submit" form="add-task-form" id="task-submit-btn">Execute Creation</button>
          </div>
        </div>
      </div>

      <!-- Manage Categories Modal Overlay -->
      <div class="overlay" id="manage-categories-overlay">
        <div class="modal" style="max-width: 480px;">
          <div class="modal-header">
            <h3 class="modal-title monospace">[Manage Categories]</h3>
            <button class="modal-close" id="manage-cat-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">
              Rename or delete your task categories. Tasks inside a deleted category will move to the first remaining one.
            </p>
            <div id="categories-list-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
              <!-- Rendered dynamically -->
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- Calendar Day View Modal -->
      <div class="overlay" id="calendar-day-overlay">
        <div class="modal" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="modal-title monospace" id="cal-day-title">[Day Overview]</h3>
            <button class="modal-close" id="cal-day-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div id="cal-day-events-list" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
              <!-- Rendered dynamically -->
            </div>
            <button class="btn btn-primary" id="cal-day-add-task-btn" style="width: 100%;">+ Initialize Task for this Date</button>
          </div>
        </div>
      </div>
    `;

    // 2. Bind all actions
    bindEvents();

    // 3. Render dynamic views
    populateCategoriesFilters();
    renderTasksList();
    renderCalendar();

    // 4. Subscribe to changes
    storeUnsubscribe = subscribe((event) => {
      if (event === 'categories') {
        populateCategoriesFilters();
        // Also refresh the manage modal if it's currently open
        const manageOverlay = document.getElementById('manage-categories-overlay');
        if (manageOverlay && manageOverlay.classList.contains('active')) {
          renderCategoriesManager();
        }
      }
      renderTasksList();
      renderCalendar();
    });
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

let isDelegated = false;

function bindEvents() {
  if (isDelegated) return;

  document.body.addEventListener('input', (e) => {
    if (e.target.matches('#task-search')) {
      activeSearchQuery = e.target.value;
      renderTasksList();
    }
  });

  document.body.addEventListener('change', (e) => {
    if (e.target.matches('#filter-category')) {
      activeFilterCategory = e.target.value;
      renderTasksList();
    }
    if (e.target.matches('#filter-status')) {
      activeFilterStatus = e.target.value;
      renderTasksList();
    }
    if (e.target.matches('#filter-priority')) {
      activeFilterPriority = e.target.value;
      renderTasksList();
    }
    if (e.target.matches('#task-sync-deadlines')) {
      syncDeadlinesEnabled = e.target.checked;
      renderCalendar();
    }
  });

  document.body.addEventListener('submit', async (e) => {
    if (e.target.matches('#add-task-form')) {
      e.preventDefault();
      e.stopPropagation();
      const form = e.target;
      if (!window.validateFormFields(form)) return;

      const title = document.getElementById('task-title').value.trim();
      const description = document.getElementById('task-desc').value.trim();
      const category = document.getElementById('task-category-select').value;
      const priority = document.getElementById('task-priority').value;
      const status = document.getElementById('task-status').value;
      const dueDate = document.getElementById('task-duedate').value;
      const recurrence = document.getElementById('task-recurrence').value;

      if (title) {
        // Close modal FIRST before async operation
        document.getElementById('add-task-overlay').classList.remove('active');
        form.reset();
        editingTaskId_local = editingTaskId;
        editingTaskId = null;

        if (editingTaskId_local) {
          await updateTask(editingTaskId_local, { title, description, category, priority, status, dueDate, recurrence });
          writeTerminal(`Modified task details: "${title}"`, 'TASK');
        } else {
          const newTask = await addTask({ title, description, category, priority, status, dueDate, recurrence });
          if (newTask) writeTerminal(`Created task: "${newTask.title}" inside "${newTask.category}"`, 'TASK');
        }
      }
    }
  });

  document.body.addEventListener('click', async (e) => {
    // Open Manage Categories modal
    if (e.target.closest('#btn-manage-categories')) {
      e.preventDefault();
      renderCategoriesManager();
      document.getElementById('manage-categories-overlay').classList.add('active');
      return;
    }

    // Close Manage Categories modal
    if (e.target.closest('#manage-cat-close-btn') || e.target.closest('#manage-cat-done-btn')) {
      document.getElementById('manage-categories-overlay').classList.remove('active');
      return;
    }
    if (e.target.matches('#manage-categories-overlay')) {
      e.target.classList.remove('active');
      return;
    }

    // "Add New Category" shortcut inside the manage modal
    if (e.target.closest('#manage-cat-add-btn')) {
      e.preventDefault();
      showPrompt('Enter new category name:', '', async (name) => {
        if (name && name.trim() !== '') {
          const trimmed = name.trim();
          const result = await addTaskCategory(trimmed);
          if (result) {
            writeTerminal(`Created category: "${trimmed}"`, 'TASK');
            renderCategoriesManager(); // refresh the list
          } else {
            showDialog('Category already exists or is invalid.');
          }
        }
      });
      return;
    }

    // Delete category row button inside manage modal
    if (e.target.closest('.btn-delete-category-row')) {
      const cat = e.target.closest('.btn-delete-category-row').getAttribute('data-cat');
      const cats = getTaskCategories();
      if (cats.length <= 1) {
        showDialog('You must keep at least one category.');
        return;
      }
      showDialog(`Delete category "${cat}"? Tasks inside will move to "${cats.filter(c => c !== cat)[0]}".`, async () => {
        const ok = await deleteTaskCategory(cat);
        if (ok) {
          writeTerminal(`Deleted category: "${cat}"`, 'WARN');
          renderCategoriesManager();
        } else {
          showDialog('Failed to delete category.');
        }
      });
      return;
    }

    // Rename category row button inside manage modal
    if (e.target.closest('.btn-rename-category-row')) {
      const cat = e.target.closest('.btn-rename-category-row').getAttribute('data-cat');
      showPrompt(`Rename "${cat}" to:`, cat, async (newName) => {
        if (newName && newName.trim() !== '' && newName.trim() !== cat) {
          const ok = await updateTaskCategory(cat, newName.trim());
          if (ok) {
            writeTerminal(`Renamed category: "${cat}" → "${newName.trim()}"`, 'TASK');
            renderCategoriesManager();
          } else {
            showDialog('Name already in use or invalid.');
          }
        }
      });
      return;
    }

    // Open Day View when clicking a calendar day
    if (e.target.closest('.calendar-day[data-date]')) {
      const dateStr = e.target.closest('.calendar-day').getAttribute('data-date');
      renderCalendarDayView(dateStr);
      document.getElementById('calendar-day-overlay').classList.add('active');
      return;
    }

    // Close Day View
    if (e.target.closest('#cal-day-close-btn') || e.target.matches('#calendar-day-overlay')) {
      document.getElementById('calendar-day-overlay').classList.remove('active');
      return;
    }

    // Add Task from Day View
    if (e.target.closest('#cal-day-add-task-btn')) {
      e.preventDefault();
      document.getElementById('calendar-day-overlay').classList.remove('active');
      const dateStr = e.target.closest('#cal-day-add-task-btn').getAttribute('data-date');
      
      // Open add task modal and prefill
      document.getElementById('add-task-form').reset();
      document.getElementById('task-duedate').value = dateStr;
      editingTaskId = null;
      document.getElementById('task-modal-title').textContent = '[Create New Task]';
      document.getElementById('task-submit-btn').textContent = 'Execute Creation';
      document.getElementById('add-task-overlay').classList.add('active');
      setTimeout(() => document.getElementById('task-title').focus(), 100);
      return;
    }

    // Add new category
    if (e.target.closest('#btn-add-category')) {
      e.preventDefault();
      showPrompt('Enter new category name:', '', async (name) => {
        if (name && name.trim() !== '') {
          const trimmed = name.trim();
          const result = await addTaskCategory(trimmed);
          if (result) {
            writeTerminal(`Created custom task category: "${trimmed}"`, 'TASK');
          } else {
            showDialog('Category already exists or is invalid.');
          }
        }
      });
      return;
    }

    // Show Modal
    if (e.target.closest('#btn-add-task')) {
      editingTaskId = null;
      document.getElementById('task-modal-title').textContent = '[Create New Task]';
      document.getElementById('task-submit-btn').textContent = 'Execute Creation';
      populateFormCategories();
      document.getElementById('add-task-overlay').classList.add('active');
      document.getElementById('task-title').focus();
      return;
    }

    // Hide Modal (buttons)
    if (e.target.closest('#modal-close-btn') || e.target.closest('#modal-cancel-btn')) {
      document.getElementById('add-task-overlay').classList.remove('active');
      document.getElementById('add-task-form').reset();
      return;
    }

    // Hide Modal (overlay click)
    if (e.target.matches('#add-task-overlay')) {
      e.target.classList.remove('active');
      document.getElementById('add-task-form').reset();
      return;
    }

    // Calendar buttons
    if (e.target.closest('#task-cal-prev')) {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderCalendar();
      return;
    }
    if (e.target.closest('#task-cal-next')) {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderCalendar();
      return;
    }
    if (e.target.closest('#btn-sync-settings')) {
      e.preventDefault();
      e.stopPropagation();
      window.openSyncSettingsModal();
      return;
    }

    // Calendar Grid Cell
    const calCell = e.target.closest('.calendar-day');
    if (calCell && calCell.closest('#task-cal-grid') && calCell.dataset.date) {
      const dateStr = calCell.dataset.date;
      const year = currentCalDate.getFullYear();
      const month = currentCalDate.getMonth();
      const events = getCalendarEvents(month, year);
      const dayEvents = events.filter(ev => ev.date === dateStr);

      if (dayEvents.length > 0) {
        const eventsList = dayEvents.map(ev => `• ${ev.title}`).join('\n');
        const message = `SCHEDULED EVENTS FOR ${dateStr}:\n\n${eventsList}\n\nWould you like to schedule a new task on this date?`;
        showDialog(message, () => {
          window.openQuickAddModal(dateStr, 'task');
        });
      } else {
        window.openQuickAddModal(dateStr, 'task');
      }
      return;
    }

    // Table Inline Buttons
    const cycleBtn = e.target.closest('.btn-cycle') || e.target.closest('.status-cell');
    if (cycleBtn) {
      cycleTaskStatus(cycleBtn.getAttribute('data-id'));
      return;
    }

    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const task = getTasks().find(t => t.id === id);
      if (task) {
        editingTaskId = task.id;
        document.getElementById('task-modal-title').textContent = '[Modify Task Details]';
        document.getElementById('task-submit-btn').textContent = 'Save Changes';
        populateFormCategories();
        
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-category-select').value = task.category;
        document.getElementById('task-priority').value = task.priority || 'NONE';
        document.getElementById('task-status').value = task.status || 'Todo';
        document.getElementById('task-duedate').value = task.dueDate || '';
        document.getElementById('task-recurrence').value = task.recurrence || 'none';
        
        document.getElementById('add-task-overlay').classList.add('active');
        document.getElementById('task-title').focus();
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const task = getTasks().find(t => t.id === id);
      if (task) {
        showDialog(`Purge task: "${task.title}"?`, () => {
          deleteTask(id);
          writeTerminal(`Purged task: "${task.title}"`, 'WARN');
        });
      }
      return;
    }
  });

  isDelegated = true;
}

function populateCategoriesFilters() {
  const filter = document.getElementById('filter-category');
  if (!filter) return;

  const categories = getTaskCategories();
  
  let optionsHTML = `<option value="ALL">Category: All</option>`;
  categories.forEach(cat => {
    optionsHTML += `<option value="${escapeHTML(cat)}" ${activeFilterCategory === cat ? 'selected' : ''}>
      Category: ${escapeHTML(cat)}
    </option>`;
  });
  
  filter.innerHTML = optionsHTML;
}

function populateFormCategories() {
  const select = document.getElementById('task-category-select');
  if (!select) return;

  const categories = getTaskCategories();
  if (categories.length === 0) {
    select.innerHTML = '<option value="Daily Tasks">Daily Tasks</option>';
    return;
  }
  select.innerHTML = categories.map(cat => `
    <option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>
  `).join('');
}

function renderTasksList() {
  if (!containerRef) return;
  const tableBody = document.getElementById('tasks-table-body');
  if (!tableBody) return;

  let tasks = getTasks();

  // Search filter
  if (activeSearchQuery.trim() !== '') {
    const query = activeSearchQuery.toLowerCase();
    tasks = tasks.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query)
    );
  }

  // Category filter
  if (activeFilterCategory !== 'ALL') {
    tasks = tasks.filter(t => t.category === activeFilterCategory);
  }

  // Status filter
  if (activeFilterStatus !== 'ALL') {
    tasks = tasks.filter(t => t.status === activeFilterStatus);
  }

  // Priority filter
  if (activeFilterPriority !== 'ALL') {
    tasks = tasks.filter(t => t.priority === activeFilterPriority);
  }

  // Sorting
  const priorityWeight = { 'HIGH': 3, 'MED': 2, 'LOW': 1, 'NONE': 0 };
  tasks.sort((a, b) => {
    if (a.status === 'Done' && b.status !== 'Done') return 1;
    if (a.status !== 'Done' && b.status === 'Done') return -1;
    return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
  });

  if (tasks.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No operational tasks match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = tasks.map(task => {
    const isDone = task.status === 'Done';
    const isInProgress = task.status === 'In Progress';
    
    let stateIndicator = '[ ]';
    let stateClass = 'todo-pending';
    if (isDone) {
      stateIndicator = '[x]';
      stateClass = 'todo-completed';
    } else if (isInProgress) {
      stateIndicator = '[-]';
      stateClass = 'todo-in-progress';
    }

    return `
      <tr>
        <td class="status-cell ${stateClass} select-none monospace" data-id="${task.id}" style="cursor: pointer; font-size: 1.15rem;" title="Click to cycle status">
          ${stateIndicator}
        </td>
        <td>
          <div style="font-weight: 700; color: ${isDone ? 'var(--text-muted)' : 'var(--text-primary)'}; ${isDone ? 'text-decoration: line-through;' : ''}">
            ${escapeHTML(task.title)}
          </div>
          ${task.description ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${escapeHTML(task.description)}</div>` : ''}
        </td>
        <td><span class="tag">${escapeHTML(task.category)}</span></td>
        <td class="col-date">${task.dueDate || 'N/A'}</td>
        <td><span class="pri-badge pri-${task.priority.toLowerCase()}">${task.priority}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-icon btn-cycle" data-id="${task.id}" title="Cycle status">↻</button>
          <button class="btn btn-icon btn-edit" data-id="${task.id}" title="Modify Task">✏️</button>
          <button class="btn btn-icon btn-delete" data-id="${task.id}" style="color: var(--danger); border-color: rgba(239,68,68,0.2)" title="Purge Task">&times;</button>
        </td>
      </tr>
    `;
  }).join('');
}

function cycleTaskStatus(taskId) {
  const task = getTasks().find(t => t.id === taskId);
  if (!task) return;

  let nextStatus = 'Todo';
  if (task.status === 'Todo') {
    nextStatus = 'In Progress';
  } else if (task.status === 'In Progress') {
    nextStatus = 'Done';
  }

  updateTask(taskId, { status: nextStatus });
  writeTerminal(`Updated task status: "${task.title}" to ${nextStatus.toUpperCase()}`, 'TASK');
}

function renderCalendar() {
  const calTitle = document.getElementById('task-cal-title');
  const calGrid = document.getElementById('task-cal-grid');
  if (!calTitle || !calGrid) return;

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

  // Feed from getCalendarEvents
  let events = getCalendarEvents(month, year);
  if (!syncDeadlinesEnabled) {
    events = events.filter(e => e.type !== 'task');
  }

  const today = new Date();

  // Draw previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    gridHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
  }

  // Draw days of month
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

  // Next month padding
  const totalCells = firstDayIndex + totalDays;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    gridHTML += `<div class="calendar-day other-month">${day}</div>`;
  }

  calGrid.innerHTML = gridHTML;

  // Render synced categories toggles below calendar
  renderSyncCategoryPills();
}

function renderSyncCategoryPills() {
  const container = document.getElementById('task-cal-sync-categories');
  if (!container) return;

  const categories = getTaskCategories();
  const syncCats = getSyncCategories();

  container.innerHTML = categories.map(cat => {
    const isSynced = syncCats.includes(cat);
    const color = getCategoryColor(cat);
    return `
      <button class="sync-cat-pill ${isSynced ? 'active' : ''}" data-cat="${escapeHTML(cat)}" title="${isSynced ? 'Ignore category deadlines' : 'Sync category deadlines'}">
        <span class="sync-cat-dot" style="background-color: ${color}; box-shadow: 0 0 4px ${color}"></span>
        ${escapeHTML(cat)}
        <span class="btn-delete-cat" data-cat="${escapeHTML(cat)}" style="margin-left: 0.5rem; color: var(--text-secondary); cursor: pointer;" title="Delete Category">&times;</span>
      </button>
    `;
  }).join('');

  // Bind click handlers to toggles
  container.querySelectorAll('.sync-cat-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // If user clicked the delete 'x', handle deletion instead of sync toggle
      if (e.target.classList.contains('btn-delete-cat')) {
        e.stopPropagation();
        const cat = e.target.getAttribute('data-cat');
        showDialog(`Are you sure you want to delete category "${cat}"? Tasks inside will move to the first remaining category.`, () => {
          if (deleteTaskCategory(cat)) {
            writeTerminal(`Deleted task category "${cat}"`, 'WARN');
          } else {
            showDialog('Failed to delete. At least one category must remain.');
          }
        });
        return;
      }
      
      e.stopPropagation();
      const cat = btn.getAttribute('data-cat');
      let currentSync = getSyncCategories();
      if (currentSync.includes(cat)) {
        currentSync = currentSync.filter(c => c !== cat);
      } else {
        currentSync.push(cat);
      }
      saveSyncCategories(currentSync);
    });
  });
}

// Helpers
function renderCategoriesManager() {
  const container = document.getElementById('categories-list-container');
  if (!container) return;

  const cats = getTaskCategories();

  if (cats.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">No categories yet. Add one below.</div>`;
    return;
  }

  container.innerHTML = cats.map((cat, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #141414; border-radius: 12px; margin-bottom: 10px; border: 1px solid #222;">
      <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${escapeHTML(cat)}</span>
      <div style="display: flex; gap: 12px;">
        <button
          class="modal-icon-btn edit-icon btn-rename-category-row"
          data-cat="${escapeHTML(cat)}"
          title="Rename category"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button
          class="modal-icon-btn delete-icon btn-delete-category-row"
          data-cat="${escapeHTML(cat)}"
          title="${cats.length <= 1 ? 'Cannot delete the last category' : 'Delete category'}"
          ${cats.length <= 1 ? 'disabled' : ''}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderCalendarDayView(dateStr) {
  const container = document.getElementById('cal-day-events-list');
  const title = document.getElementById('cal-day-title');
  const addBtn = document.getElementById('cal-day-add-task-btn');
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

  if (syncDeadlinesEnabled) {
    const internships = getInternships();
    
    // Internship Deadlines
    internships.filter(i => i.deadline === dateStr && i.status !== 'Rejected').forEach(i => {
      events.push({ title: `Deadline: ${i.company}`, category: 'Internship', color: '#ef4444', isDone: false });
    });
    
    // Internship Start Dates
    internships.filter(i => i.startDate === dateStr && i.status !== 'Rejected').forEach(i => {
      events.push({ title: `Start Date: ${i.company}`, category: 'Internship', color: '#10b981', isDone: false });
    });
  }

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
