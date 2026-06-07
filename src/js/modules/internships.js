/* -------------------------------------------------------------
   MY LOOM // INTERNSHIP TRACKER MODULE
   ------------------------------------------------------------- */

import { getInternships, addInternship, updateInternship, deleteInternship, subscribe, getInternshipColor } from '../store.js';
import { writeTerminal } from '../app.js';
import { showDialog } from '../components/dialog.js';

let storeUnsubscribe = null;
let containerRef = null;
let currentCalDate = new Date();
let activeSearchQuery = '';
let activeFilterStatus = 'ALL';

export const InternshipView = {
  render(container) {
    containerRef = container;

    // 1. Scaffold main view structure with two-column responsive grid layout
    container.innerHTML = `
      <header class="view-header">
        <h1 class="view-title">Internship Tracker</h1>
      </header>

      <div class="internships-grid">
        <!-- Main Applications Pipeline Stream (Left Column) -->
        <div class="internships-main-column">
          <!-- Toolbar with search, add application, and export button -->
          <div class="toolbar" style="flex-wrap: wrap; gap: 0.75rem;">
            <div class="actions-group" style="flex: 1; min-width: 250px; flex-wrap: wrap; gap: 0.5rem;">
              <input type="text" id="internship-search" class="form-control search-input" placeholder="Search companies or roles...">
              <select id="filter-status" class="form-control" style="width: auto;">
                <option value="ALL">Status: All</option>
                <option value="Applied">Status: Applied</option>
                <option value="Interviewing">Status: Interviewing</option>
                <option value="Offer">Status: Offer</option>
                <option value="Rejected">Status: Rejected</option>
              </select>
            </div>
            <div class="actions-group" style="margin-left: auto;">
              <button class="btn" id="btn-export-excel" title="Download Excel formatted spreadsheet">📥 Export to Excel</button>
              <button class="btn btn-primary" id="btn-add-internship">+ Add Application</button>
            </div>
          </div>

          <!-- Applications Table card -->
          <div class="widget">
            <div class="widget-title">Application Pipeline</div>
            <div class="widget-content">
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role / Position</th>
                      <th style="width: 110px;">Start Date</th>
                      <th style="width: 110px;">Deadline</th>
                      <th style="width: 120px;">Status</th>
                      <th>Notes</th>
                      <th style="width: 130px; text-align: right;">Operations</th>
                    </tr>
                  </thead>
                  <tbody id="internship-table-body">
                    <!-- Dynamically loaded entries -->
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Localized Internship Deadlines Calendar (Right Column) -->
        <div class="internships-side-column">
          <div class="widget">
            <h2 class="widget-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span>Internship Calendar</span>
            </h2>
            <div class="widget-content" style="padding: 1.5rem;">
              <div class="calendar-container" style="border: none; padding: 0; box-shadow: none; background: transparent;">
                <div class="calendar-header">
                  <button class="btn" id="intern-cal-prev" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&lt;</button>
                  <div class="calendar-month-title" id="intern-cal-title">Month Year</div>
                  <button class="btn" id="intern-cal-next" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">&gt;</button>
                </div>
                <div class="calendar-grid" id="intern-cal-grid">
                  <!-- Monthly cells loaded dynamically -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Application Modal -->
      <div class="overlay" id="add-internship-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">[Register New Application]</h3>
            <button class="modal-close" id="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="add-internship-form">
              <div class="form-group">
                <label class="form-label" for="internship-company">Company Name</label>
                <input type="text" id="internship-company" class="form-control" required placeholder="e.g. Google">
              </div>
              <div class="form-group">
                <label class="form-label" for="internship-role">Role / Position Title</label>
                <input type="text" id="internship-role" class="form-control" required placeholder="e.g. Software Engineering Intern">
              </div>
              <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label class="form-label" for="internship-start-date">Application Start Date</label>
                  <input type="date" id="internship-start-date" class="form-control" required>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label class="form-label" for="internship-deadline">Deadline</label>
                    <label class="select-none" style="font-size: 0.7rem; font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 0.15rem; margin-bottom: 0.5rem;">
                      <input type="checkbox" id="internship-deadline-na" style="cursor: pointer;">
                      Rolling (N/A)
                    </label>
                  </div>
                  <input type="date" id="internship-deadline" class="form-control" required>
                </div>
              </div>
              <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label class="form-label" for="internship-status">Status</label>
                  <select id="internship-status" class="form-control">
                    <option value="Applied">Applied</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label class="form-label" for="internship-date">Application Date</label>
                  <input type="date" id="internship-date" class="form-control" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="internship-notes">Notes</label>
                <textarea id="internship-notes" class="form-control" rows="3" placeholder="Resume details, referrals, interview times..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-primary" type="submit" form="add-internship-form">Register Pipeline</button>
          </div>
        </div>
      </div>
    `;

    // 2. Bind DOM events
    bindEvents();

    // 3. Render initial list and calendar
    renderInternshipList();
    renderInternshipCalendar();

    // 4. Subscribe to database changes
    storeUnsubscribe = subscribe(() => {
      renderInternshipList();
      renderInternshipCalendar();
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
  const setDateDefaults = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('internship-date');
    const startDateInput = document.getElementById('internship-start-date');
    if (dateInput) dateInput.value = todayStr;
    if (startDateInput) startDateInput.value = todayStr;
  };

  if (isDelegated) return;

  document.body.addEventListener('input', (e) => {
    if (e.target.matches('#internship-search')) {
      activeSearchQuery = e.target.value;
      renderInternshipList();
    }
  });

  document.body.addEventListener('change', (e) => {
    if (e.target.matches('#internship-deadline-na')) {
      const deadlineInput = document.getElementById('internship-deadline');
      if (deadlineInput) {
        if (e.target.checked) {
          deadlineInput.value = '';
          deadlineInput.disabled = true;
          deadlineInput.removeAttribute('required');
        } else {
          deadlineInput.disabled = false;
          deadlineInput.setAttribute('required', 'true');
        }
      }
    }
    if (e.target.matches('#filter-status')) {
      activeFilterStatus = e.target.value;
      renderInternshipList();
    }
    if (e.target.matches('.select-inline-status')) {
      const id = e.target.getAttribute('data-id');
      const nextStatus = e.target.value;
      const app = getInternships().find(i => i.id === id);
      if (app) {
        updateInternship(id, { status: nextStatus });
        writeTerminal(`Updated ${app.company} status to ${nextStatus.toUpperCase()}`, 'INTERN');
      }
    }
  });

  document.body.addEventListener('submit', async (e) => {
    if (e.target.matches('#add-internship-form')) {
      e.preventDefault();
      e.stopPropagation();
      const form = e.target;
      if (!window.validateFormFields(form)) return;

      const company = document.getElementById('internship-company').value.trim();
      const role = document.getElementById('internship-role').value.trim();
      const status = document.getElementById('internship-status').value;
      const date = document.getElementById('internship-date').value;
      const startDateInput = document.getElementById('internship-start-date');
      const rollingCheckbox = document.getElementById('internship-deadline-na');
      const deadlineInput = document.getElementById('internship-deadline');
      const startDate = startDateInput ? startDateInput.value : date;
      const isRolling = rollingCheckbox ? rollingCheckbox.checked : false;
      const deadline = isRolling ? 'N/A' : (deadlineInput ? deadlineInput.value : 'N/A');
      const notes = document.getElementById('internship-notes').value.trim();

      if (company && role) {
        // Close modal first
        document.getElementById('add-internship-overlay').classList.remove('active');
        form.reset();
        setDateDefaults();
        if (deadlineInput) {
          deadlineInput.disabled = false;
          deadlineInput.setAttribute('required', 'true');
        }

        const newApp = await addInternship({ company, role, status, date, startDate, deadline, notes });
        if (newApp) writeTerminal(`Registered internship: "${newApp.role}" at ${newApp.company}`, 'INTERN');
      }
    }
  });

  document.body.addEventListener('click', (e) => {
    // Show Modal
    if (e.target.closest('#btn-add-internship')) {
      document.getElementById('add-internship-overlay').classList.add('active');
      document.getElementById('internship-company').focus();
      return;
    }

    // Hide Modal
    if (e.target.closest('#modal-close-btn') || e.target.closest('#modal-cancel-btn')) {
      document.getElementById('add-internship-overlay').classList.remove('active');
      document.getElementById('add-internship-form').reset();
      setDateDefaults();
      const deadlineInput = document.getElementById('internship-deadline');
      if (deadlineInput) {
        deadlineInput.disabled = false;
        deadlineInput.setAttribute('required', 'true');
      }
      return;
    }

    if (e.target.matches('#add-internship-overlay')) {
      e.target.classList.remove('active');
      document.getElementById('add-internship-form').reset();
      setDateDefaults();
      const deadlineInput = document.getElementById('internship-deadline');
      if (deadlineInput) {
        deadlineInput.disabled = false;
        deadlineInput.setAttribute('required', 'true');
      }
      return;
    }

    // Export
    if (e.target.closest('#btn-export-excel')) {
      exportToExcel();
      return;
    }

    // Calendar
    if (e.target.closest('#intern-cal-prev')) {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderInternshipCalendar();
      return;
    }
    if (e.target.closest('#intern-cal-next')) {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderInternshipCalendar();
      return;
    }

    // Grid Click
    const calCell = e.target.closest('.calendar-day');
    if (calCell && calCell.closest('#intern-cal-grid') && calCell.dataset.date) {
      window.openQuickAddModal(calCell.dataset.date, 'internship');
      return;
    }

    // Delete
    const deleteBtn = e.target.closest('.btn-delete-internship');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const app = getInternships().find(i => i.id === id);
      if (app) {
        showDialog(`Are you sure you want to delete internship tracker record: "${app.role}" at ${app.company}?`, () => {
          deleteInternship(id);
          writeTerminal(`Deleted internship application for ${app.company}`, 'WARN');
        });
      }
      return;
    }
  });

  isDelegated = true;
  setDateDefaults();
}

function renderInternshipList() {
  if (!containerRef) return;
  const tableBody = document.getElementById('internship-table-body');
  if (!tableBody) return;

  let internships = getInternships();

  // Search filter
  if (activeSearchQuery.trim() !== '') {
    const query = activeSearchQuery.toLowerCase();
    internships = internships.filter(i => 
      i.company.toLowerCase().includes(query) || 
      i.role.toLowerCase().includes(query)
    );
  }

  // Status filter
  if (activeFilterStatus !== 'ALL') {
    internships = internships.filter(i => i.status === activeFilterStatus);
  }

  // Sort by date descending
  internships.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (internships.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No internship applications match search parameters.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = internships.map(item => {
    const currentStatus = item.status || 'Applied';
    const statusClass = currentStatus.toLowerCase();
    return `
      <tr>
        <td><span style="font-weight: 700; color: var(--text-primary);">${escapeHTML(item.company)}</span></td>
        <td>${escapeHTML(item.role)}</td>
        <td class="monospace" style="font-size: 0.85rem;">${item.startDate || item.date}</td>
        <td class="monospace" style="font-size: 0.85rem;">${item.deadline || 'N/A'}</td>
        <td>
          <span class="status-badge status-${statusClass}">${currentStatus}</span>
        </td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(item.notes || '')}">
          ${escapeHTML(item.notes || 'No notes.')}
        </td>
        <td style="text-align: right;">
          <select class="form-control select-inline-status" data-id="${item.id}" style="width: auto; display: inline-block; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 6px; margin-right: 0.5rem;">
            <option value="Applied" ${currentStatus === 'Applied' ? 'selected' : ''}>Applied</option>
            <option value="Interviewing" ${currentStatus === 'Interviewing' ? 'selected' : ''}>Interviewing</option>
            <option value="Offer" ${currentStatus === 'Offer' ? 'selected' : ''}>Offer</option>
            <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
          <button class="btn btn-icon btn-delete-internship" data-id="${item.id}" style="color: var(--danger); border-color: rgba(239,68,68,0.2)" title="Delete Application">&times;</button>
        </td>
      </tr>
    `;
  }).join('');
}

function exportToExcel() {
  const internships = getInternships();
  if (internships.length === 0) {
    showDialog('No applications to export.');
    return;
  }

  // Generate HTML table for Excel with background status colors
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; background-color: #fafaf8; color: #1c1c1e; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th { background-color: #080808; color: #fafaf8; font-weight: bold; border: 1px solid #222222; padding: 10px; font-size: 14px; text-align: left; }
        td { border: 1px solid #e8e4dc; padding: 10px; font-size: 13px; vertical-align: middle; }
        .company { font-weight: bold; color: #080808; }
        .role { color: #55555c; }
        .date { font-family: monospace; color: #66666a; }
        .status-applied { background-color: #fdece2; color: #c97d4e; font-weight: bold; text-align: center; }
        .status-interviewing { background-color: #fff9e6; color: #f59e0b; font-weight: bold; text-align: center; }
        .status-offer { background-color: #e6f7f0; color: #10b981; font-weight: bold; text-align: center; }
        .status-rejected { background-color: #ffebe6; color: #ef4444; font-weight: bold; text-align: center; }
        .notes { color: #66666a; font-style: italic; }
      </style>
    </head>
    <body>
      <h2>My Loom - Internship Application Pipeline</h2>
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Role</th>
            <th>Status</th>
            <th>Start Date</th>
            <th>Deadline</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
  `;

  internships.forEach(item => {
    const currentStatus = item.status || 'Applied';
    const statusClass = 'status-' + currentStatus.toLowerCase();
    html += `
      <tr>
        <td class="company">${escapeHTML(item.company)}</td>
        <td class="role">${escapeHTML(item.role)}</td>
        <td class="${statusClass}">${escapeHTML(currentStatus)}</td>
        <td class="date">${escapeHTML(item.startDate || item.date)}</td>
        <td class="date">${escapeHTML(item.deadline || 'N/A')}</td>
        <td class="notes">${escapeHTML(item.notes || '')}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my_loom_internships_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  writeTerminal('Exported styled internship application pipeline spreadsheet to XLS (Excel)', 'SYS');
}

function renderInternshipCalendar() {
  const calTitle = document.getElementById('intern-cal-title');
  const calGrid = document.getElementById('intern-cal-grid');
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

  const internships = getInternships();
  const today = new Date();

  // Draw previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    gridHTML += `<div class="calendar-day other-month">${dayNum}</div>`;
  }

  // Draw current month days
  for (let day = 1; day <= totalDays; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find matching internship opening start dates and deadlines
    const dayStarts = internships.filter(i => i.startDate === dateStr);
    const dayDeadlines = internships.filter(i => i.deadline === dateStr);

    let eventDotHTML = '';
    let tooltipHTML = '';

    const dayMilestones = [
      ...dayStarts.map(i => ({ type: 'start', label: `[Open] ${i.company}`, color: '#06b6d4', detail: `${i.company} - ${i.role} (Opening)` })),
      ...dayDeadlines.map(i => ({ type: 'deadline', label: `[Due] ${i.company}`, color: '#ec4899', detail: `${i.company} - ${i.role} (Deadline)` }))
    ];

    if (dayMilestones.length > 0) {
      eventDotHTML = `<div class="calendar-day-events">` + 
        dayMilestones.slice(0, 3).map(m => `<div class="calendar-event-dot" style="background-color: ${m.color}; box-shadow: 0 0 4px ${m.color};"></div>`).join('') + 
        `</div>`;
      
      tooltipHTML = `<div class="calendar-tooltip">` + 
        dayMilestones.map(m => `• ${escapeHTML(m.detail)}`).join('<br>') + 
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

  // Draw next month padding
  const totalCells = firstDayIndex + totalDays;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    gridHTML += `<div class="calendar-day other-month">${day}</div>`;
  }

  calGrid.innerHTML = gridHTML;
}

// Helpers
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
