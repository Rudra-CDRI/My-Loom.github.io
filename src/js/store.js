/* -------------------------------------------------------------
   MY LOOM // CLOUD STATE STORE (Supabase Real-time Sync)
   ------------------------------------------------------------- */

import { supabase } from './db.js';

// In-Memory Synchronous State Cache
let tasks = [];
let folders = [];
let documents = [];
let bookmarks = [];
let internships = [];
let categories = [];
let categoryColors = {};
let bookmarkCategories = [];

// Initialize data from Supabase
export async function initializeStore() {
  try {
    const [
      resTasks,
      resFolders,
      resDocs,
      resBookmarks,
      resInternships,
      resCategories,
      resBookmarkCats
    ] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('folders').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('bookmarks').select('*'),
      supabase.from('internships').select('*'),
      supabase.from('task_categories').select('*').order('id', { ascending: true }),
      supabase.from('bookmark_categories').select('*').order('id', { ascending: true })
    ]);

    tasks = (!resTasks.error && resTasks.data) ? resTasks.data : [];
    folders = (!resFolders.error && resFolders.data) ? resFolders.data : [];
    documents = (!resDocs.error && resDocs.data) ? resDocs.data : [];
    bookmarks = (!resBookmarks.error && resBookmarks.data) ? resBookmarks.data : [];
    internships = (!resInternships.error && resInternships.data) ? resInternships.data : [];
    categories = (!resCategories.error && resCategories.data) ? resCategories.data.map(c => {
      categoryColors[c.name] = c.color || '#3b82f6';
      return c.name;
    }).sort((a, b) => {
      if (a === 'Daily Tasks') return -1;
      if (b === 'Daily Tasks') return 1;
      return 0;
    }) : [];
    bookmarkCategories = (!resBookmarkCats.error && resBookmarkCats.data) ? resBookmarkCats.data.map(c => c.name) : [];
  } catch (err) {
    console.error('Failed to initialize Supabase store:', err);
  }

  setupRealtimeSubscriptions();
}

// Setup real-time channel subscriptions
function setupRealtimeSubscriptions() {
  const tables = ['tasks', 'folders', 'documents', 'bookmarks', 'internships', 'task_categories', 'bookmark_categories'];
  
  tables.forEach(table => {
    supabase.channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: table }, payload => {
        handleRealtimeEvent(table, payload);
      })
      .subscribe();
  });
}

// Handle real-time database broadcast payloads
function handleRealtimeEvent(table, payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (table === 'tasks') {
    if (eventType === 'INSERT') {
      if (!tasks.some(t => t.id === newRecord.id)) tasks.push(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = tasks.findIndex(t => t.id === newRecord.id);
      if (idx !== -1) tasks[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      tasks = tasks.filter(t => t.id !== oldRecord.id);
    }
    notify('tasks');
  } else if (table === 'folders') {
    if (eventType === 'INSERT') {
      if (!folders.some(f => f.id === newRecord.id)) folders.push(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = folders.findIndex(f => f.id === newRecord.id);
      if (idx !== -1) folders[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      folders = folders.filter(f => f.id !== oldRecord.id);
    }
    notify('folders');
  } else if (table === 'documents') {
    if (eventType === 'INSERT') {
      if (!documents.some(d => d.id === newRecord.id)) documents.unshift(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = documents.findIndex(d => d.id === newRecord.id);
      if (idx !== -1) documents[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      documents = documents.filter(d => d.id !== oldRecord.id);
    }
    notify('documents');
  } else if (table === 'bookmarks') {
    if (eventType === 'INSERT') {
      if (!bookmarks.some(b => b.id === newRecord.id)) bookmarks.push(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = bookmarks.findIndex(b => b.id === newRecord.id);
      if (idx !== -1) bookmarks[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      bookmarks = bookmarks.filter(b => b.id !== oldRecord.id);
    }
    notify('bookmarks');
  } else if (table === 'internships') {
    if (eventType === 'INSERT') {
      if (!internships.some(i => i.id === newRecord.id)) internships.push(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = internships.findIndex(i => i.id === newRecord.id);
      if (idx !== -1) internships[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      internships = internships.filter(i => i.id !== oldRecord.id);
    }
    notify('internships');
  } else if (table === 'task_categories') {
    syncCategoriesFromDatabase();
  } else if (table === 'bookmark_categories') {
    syncBookmarkCategoriesFromDatabase();
  }
}

async function syncCategoriesFromDatabase() {
  const { data } = await supabase.from('task_categories').select('*').order('id', { ascending: true });
  if (data) {
    categories = data.map(c => {
      categoryColors[c.name] = c.color || '#3b82f6';
      return c.name;
    }).sort((a, b) => {
      if (a === 'Daily Tasks') return -1;
      if (b === 'Daily Tasks') return 1;
      return 0;
    });
    notify('categories');
  }
}

async function syncBookmarkCategoriesFromDatabase() {
  const { data } = await supabase.from('bookmark_categories').select('*');
  if (data) {
    bookmarkCategories = data.map(c => c.name);
    notify('bookmark_categories');
  }
}

// -------------------------------------------------------------
// SUPABASE CLOUD BLOB STORAGE (Cross-device file sync)
// -------------------------------------------------------------

export async function storeFileBlob(id, file) {
  try {
    const { error } = await supabase.storage
      .from('vault')
      .upload(id, file, { upsert: true });
    
    if (error) throw error;
  } catch (err) {
    console.error('Supabase Storage Upload Error:', err);
  }
}

export async function getFileBlob(id) {
  try {
    const { data, error } = await supabase.storage
      .from('vault')
      .download(id);
      
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase Storage Download Error:', err);
    return null;
  }
}

export function getFileUrl(id) {
  const { data } = supabase.storage.from('vault').getPublicUrl(id);
  return data.publicUrl;
}

export async function deleteFileBlob(id) {
  try {
    const { error } = await supabase.storage
      .from('vault')
      .remove([id]);
      
    if (error) throw error;
  } catch (err) {
    console.error('Supabase Storage Delete Error:', err);
  }
}

// -------------------------------------------------------------
// PUB-SUB SYSTEM
// -------------------------------------------------------------
const subscribers = [];

export function subscribe(callback) {
  subscribers.push(callback);
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx > -1) subscribers.splice(idx, 1);
  };
}

function notify(eventType, data) {
  subscribers.forEach(callback => {
    try {
      callback(eventType, data);
    } catch (err) {
      console.error('Error running store subscriber callback:', err);
    }
  });
}

// -------------------------------------------------------------
// HISTORIC UNDO / REDO CACHE SYSTEM (Disabled in Cloud Sync Mode)
// -------------------------------------------------------------
export function pushHistory() {}
export function undo() { return false; }
export function redo() { return false; }
export function canUndo() { return false; }
export function canRedo() { return false; }

// -------------------------------------------------------------
// TASK CATEGORIES OPERATIONS
// -------------------------------------------------------------
export function getTaskCategories() {
  return categories;
}

export async function addTaskCategory(name, color = '#3b82f6') {
  try {
    if (name && !categories.includes(name)) {
      categories.push(name);
      categoryColors[name] = color;
      notify('categories');
      notify('render');
      const { error } = await supabase.from('task_categories').insert([{ name, color }]);
      if (error) throw error;
      return true;
    }
    return false;
  } catch (error) {
    console.error("STATE ERROR:", error);
    categories = categories.filter(c => c !== name);
    notify('categories');
    notify('render');
    return false;
  }
}

export async function updateTaskCategory(oldName, newName, newColor) {
  if ((newName && !categories.includes(newName)) || newColor) {
    const finalName = newName || oldName;
    
    if (finalName !== oldName) {
      categories = categories.map(c => c === oldName ? finalName : c);
      tasks = tasks.map(t => t.category === oldName ? { ...t, category: finalName } : t);
      // migrate color to new key
      categoryColors[finalName] = newColor || categoryColors[oldName];
      delete categoryColors[oldName];
    } else if (newColor) {
      categoryColors[oldName] = newColor;
    }

    notify('categories');
    notify('tasks');
    notify('render');

    const updatePayload = {};
    if (newName && newName !== oldName) updatePayload.name = newName;
    if (newColor) updatePayload.color = newColor;

    const { error } = await supabase.from('task_categories').update(updatePayload).eq('name', oldName);
    if (error) return false;
    
    if (updatePayload.name) {
      await supabase.from('tasks').update({ category: updatePayload.name }).eq('category', oldName);
    }
    return true;
  }
  return false;
}

export async function deleteTaskCategory(name) {
  if (categories.length <= 1) {
    return false;
  }
  const filteredCategories = categories.filter(c => c !== name);
  const defaultCat = filteredCategories[0] || 'Daily Tasks';

  categories = filteredCategories;
  tasks = tasks.map(t => t.category === name ? { ...t, category: defaultCat } : t);
  notify('categories');
  notify('tasks');
  notify('render');

  const { error } = await supabase.from('task_categories').delete().eq('name', name);
  if (error) return false;

  await supabase.from('tasks').update({ category: defaultCat }).eq('category', name);
  return true;
}

// -------------------------------------------------------------
// TASKS OPERATIONS
// -------------------------------------------------------------
export function getTasks() {
  return tasks;
}

export async function addTask(task) {
  try {
    const newTask = {
      id: 't-' + Date.now(),
      title: task.title,
      description: task.description || '',
      status: task.status || 'Todo',
      dueDate: task.dueDate || '',
      priority: task.priority || 'LOW',
      category: task.category || 'Daily Tasks',
      recurrence: task.recurrence || 'none'
    };
    
    tasks.push(newTask);
    notify('tasks');
    notify('render');
    
    const { error } = await supabase.from('tasks').insert([newTask]);
    if (error) throw error;
    
    return newTask;
  } catch (error) {
    console.error("STATE ERROR:", error);
    tasks = tasks.filter(t => t.id !== task.id);
    notify('tasks');
    notify('render');
    return null;
  }
}

export async function updateTask(id, updatedFields) {
  const oldTaskIndex = tasks.findIndex(t => t.id === id);
  if (oldTaskIndex === -1) return null;
  
  const oldTask = tasks[oldTaskIndex];
  const newTask = { ...oldTask, ...updatedFields };
  
  tasks[oldTaskIndex] = newTask;
  notify('tasks');
  notify('render');

  // Recurrence logic trigger
  const wasDoneToggled = (oldTask.status !== 'Done' && newTask.status === 'Done');
  if (wasDoneToggled && oldTask.recurrence && oldTask.recurrence !== 'none') {
    const nextDueDate = calculateNextDueDate(oldTask.dueDate || new Date().toISOString().split('T')[0], oldTask.recurrence);
    const duplicate = {
      id: 't-' + Date.now() + '-rec',
      title: oldTask.title,
      description: oldTask.description || '',
      status: 'Todo',
      dueDate: nextDueDate,
      priority: oldTask.priority || 'LOW',
      category: oldTask.category || 'Daily Tasks',
      recurrence: oldTask.recurrence
    };
    tasks.push(duplicate);
    notify('tasks');
    notify('render');
    await supabase.from('tasks').insert([duplicate]);
  }

  const { error } = await supabase.from('tasks').update(updatedFields).eq('id', id);
  if (error) console.error('Error updating task:', error);
  return newTask;
}

export async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  notify('tasks');
  notify('render');

  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) console.error('Error deleting task:', error);
}

// -------------------------------------------------------------
// FOLDERS & DOCUMENTS OPERATIONS
// -------------------------------------------------------------
export function getFolders() {
  return folders;
}

export async function addFolder(folder) {
  const newFolder = {
    id: 'f-' + Date.now(),
    name: folder.name,
    parentId: folder.parentId || 'root'
  };
  
  folders.push(newFolder);
  notify('folders');
  notify('render');
  
  const { error } = await supabase.from('folders').insert([newFolder]);
  if (error) {
    console.error('Error adding folder:', error);
    folders = folders.filter(f => f.id !== newFolder.id);
    notify('folders');
    notify('render');
  }
  return newFolder;
}

export async function updateFolder(id, updatedFields) {
  const oldIdx = folders.findIndex(folder => folder.id === id);
  if (oldIdx === -1) return null;

  const newFolder = { ...folders[oldIdx], ...updatedFields };
  folders[oldIdx] = newFolder;
  notify('folders');
  notify('render');

  const { error } = await supabase.from('folders').update(updatedFields).eq('id', id);
  if (error) console.error('Error updating folder:', error);
  return newFolder;
}

export async function deleteFolder(id) {
  const toDelete = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    folders.forEach(f => {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        added = true;
      }
    });
  }

  // Delete local state optimistically
  folders = folders.filter(f => !toDelete.has(f.id));
  const docsToDelete = documents.filter(d => toDelete.has(d.folderId));
  documents = documents.filter(d => !toDelete.has(d.folderId));
  notify('folders');
  notify('documents');
  notify('render');

  // Delete folders from cloud
  const { error: fErr } = await supabase.from('folders').delete().in('id', Array.from(toDelete));
  if (fErr) console.error('Error deleting folders:', fErr);

  // Delete documents from cloud
  if (docsToDelete.length > 0) {
    const docIds = docsToDelete.map(d => d.id);
    const { error: dErr } = await supabase.from('documents').delete().in('id', docIds);
    if (dErr) console.error('Error deleting documents:', dErr);
    docIds.forEach(docId => deleteFileBlob(docId));
  }
}

export function getDocuments() {
  return documents;
}

export function getDocumentsByFolder(folderId) {
  return documents.filter(d => d.folderId === folderId);
}

export async function addDocument(doc) {
  const newDoc = {
    id: 'd-' + Date.now(),
    title: doc.name || doc.title,
    name: doc.name || doc.title,
    size: doc.size || 0,
    folderId: doc.folderId || 'root',
    type: doc.type || 'unknown',
    uploadDate: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    tags: doc.tags || [],
    hasRealBlob: doc.hasRealBlob || false
  };
  
  documents.unshift(newDoc);
  notify('documents');
  notify('render');

  const { error } = await supabase.from('documents').insert([newDoc]);
  if (error) {
    console.error('Error adding document:', error);
    documents = documents.filter(d => d.id !== newDoc.id);
    notify('documents');
    notify('render');
  }
  
  return newDoc;
}

export async function deleteDocument(id) {
  documents = documents.filter(d => d.id !== id);
  notify('documents');
  notify('render');

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) console.error('Error deleting document:', error);
  deleteFileBlob(id);
}

// -------------------------------------------------------------
// BOOKMARK CATEGORIES OPERATIONS
// -------------------------------------------------------------
export function getBookmarkCategories() {
  return bookmarkCategories;
}

export async function addBookmarkCategory(name) {
  try {
    if (name && !bookmarkCategories.includes(name)) {
      bookmarkCategories.push(name);
      notify('bookmark_categories');
      notify('render');
      const { error } = await supabase.from('bookmark_categories').insert([{ name }]);
      if (error) throw error;
      return true;
    }
    return false;
  } catch (error) {
    console.error("STATE ERROR:", error);
    bookmarkCategories = bookmarkCategories.filter(c => c !== name);
    notify('bookmark_categories');
    notify('render');
    return false;
  }
}

export async function updateBookmarkCategory(oldName, newName) {
  if (newName && !bookmarkCategories.includes(newName)) {
    bookmarkCategories = bookmarkCategories.map(c => c === oldName ? newName : c);
    bookmarks = bookmarks.map(b => b.category === oldName ? { ...b, category: newName, tags: (b.tags || []).map(t => t === oldName.toLowerCase() ? newName.toLowerCase() : t) } : b);
    notify('bookmark_categories');
    notify('bookmarks');
    notify('render');

    const { error } = await supabase.from('bookmark_categories').update({ name: newName }).eq('name', oldName);
    if (error) return false;

    const updatedBookmarks = bookmarks.filter(b => b.category === newName);
    for (const b of updatedBookmarks) {
      await supabase.from('bookmarks').update({ category: b.category, tags: b.tags }).eq('id', b.id);
    }
    return true;
  }
  return false;
}

export async function deleteBookmarkCategory(name) {
  if (bookmarkCategories.length <= 1) {
    return false;
  }
  const filteredCategories = bookmarkCategories.filter(c => c !== name);
  const defaultCat = filteredCategories[0] || 'General';

  bookmarkCategories = filteredCategories;
  bookmarks = bookmarks.map(b => b.category === name ? { ...b, category: defaultCat } : b);
  notify('bookmark_categories');
  notify('bookmarks');
  notify('render');

  const { error } = await supabase.from('bookmark_categories').delete().eq('name', name);
  if (error) return false;

  await supabase.from('bookmarks').update({ category: defaultCat }).eq('category', name);
  return true;
}

// -------------------------------------------------------------
// BOOKMARKS (LINKS) OPERATIONS
// -------------------------------------------------------------
export function getBookmarks() {
  return bookmarks;
}

export async function addBookmark(bookmark) {
  try {
    const newBookmark = {
      id: 'b-' + Date.now(),
      title: bookmark.title,
      url: bookmark.url,
      category: bookmark.category || bookmark.tags?.[0] || 'General',
      tags: bookmark.tags || [bookmark.category || 'General'],
      timestamp: new Date().toISOString()
    };
    
    bookmarks.push(newBookmark);
    notify('bookmarks');
    notify('render');
    
    const { error } = await supabase.from('bookmarks').insert([newBookmark]);
    if (error) throw error;
    
    return newBookmark;
  } catch (error) {
    console.error("STATE ERROR:", error);
    bookmarks = bookmarks.filter(b => b.title !== bookmark.title);
    notify('bookmarks');
    notify('render');
    return null;
  }
}

export async function deleteBookmark(id) {
  bookmarks = bookmarks.filter(b => b.id !== id);
  notify('bookmarks');
  notify('render');

  const { error } = await supabase.from('bookmarks').delete().eq('id', id);
  if (error) console.error('Error deleting bookmark:', error);
}

export async function updateBookmark(id, updatedFields) {
  const oldIdx = bookmarks.findIndex(bk => bk.id === id);
  if (oldIdx === -1) return null;
  
  const newBookmark = { ...bookmarks[oldIdx], ...updatedFields };
  bookmarks[oldIdx] = newBookmark;
  notify('bookmarks');
  notify('render');

  const { error } = await supabase.from('bookmarks').update(updatedFields).eq('id', id);
  if (error) console.error('Error updating bookmark:', error);
  return newBookmark;
}

// -------------------------------------------------------------
// INTERNSHIPS OPERATIONS
// -------------------------------------------------------------
export function getInternships() {
  return internships;
}

export async function addInternship(internship) {
  try {
    const newInternship = {
      id: 'i-' + Date.now(),
      company: internship.company,
      role: internship.role,
      status: internship.status || 'Applied',
      date: internship.date || new Date().toISOString().split('T')[0],
      startDate: internship.startDate || internship.date || new Date().toISOString().split('T')[0],
      deadline: internship.deadline || 'N/A',
      customDates: internship.customDates || [],
      notes: internship.notes || ''
    };
    
    internships.push(newInternship);
    notify('internships');
    notify('render');
    
    const { error } = await supabase.from('internships').insert([newInternship]);
    if (error) throw error;
    
    return newInternship;
  } catch (error) {
    console.error("STATE ERROR:", error);
    internships = internships.filter(i => i.company !== internship.company);
    notify('internships');
    notify('render');
    return null;
  }
}

export async function updateInternship(id, updatedFields) {
  const oldIdx = internships.findIndex(intern => intern.id === id);
  if (oldIdx === -1) return null;
  
  const newInternship = { ...internships[oldIdx], ...updatedFields };
  internships[oldIdx] = newInternship;
  notify('internships');
  notify('render');

  const { error } = await supabase.from('internships').update(updatedFields).eq('id', id);
  if (error) console.error('Error updating internship:', error);
  return newInternship;
}

export async function deleteInternship(id) {
  internships = internships.filter(i => i.id !== id);
  notify('internships');
  notify('render');

  const { error } = await supabase.from('internships').delete().eq('id', id);
  if (error) console.error('Error deleting internship:', error);
}

// -------------------------------------------------------------
// UNIFIED CALENDAR EVENT FEED
// -------------------------------------------------------------
export function getCalendarEvents(month, year) {
  const syncCats = getSyncCategories();
  const events = [];

  // 1. Process tasks
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (t.status !== 'Done' && syncCats.includes(t.category)) {
        events.push({
          date: t.dueDate,
          type: 'task',
          title: `[Task] ${t.title}`,
          color: getCategoryColor(t.category),
          isDone: false
        });
      } else if (t.status === 'Done') {
        events.push({
          date: t.dueDate,
          type: 'task',
          title: `[Task] ${t.title}`,
          color: getCategoryColor(t.category),
          isDone: true
        });
      }
    }
  });

  // 2. Process internships
  internships.forEach(i => {
    if (i.status === 'Rejected') return;

    if (i.startDate) {
      const d = new Date(i.startDate);
      if (d.getMonth() === month && d.getFullYear() === year) {
        events.push({
          date: i.startDate,
          type: 'internship_start',
          title: `[Open] ${i.company} - ${i.role}`,
          color: '#06b6d4',
          isDone: false
        });
      }
    }

    if (i.deadline && i.deadline !== 'N/A') {
      const d = new Date(i.deadline);
      if (d.getMonth() === month && d.getFullYear() === year) {
        events.push({
          date: i.deadline,
          type: 'internship_deadline',
          title: `[Deadline] ${i.company} - ${i.role}`,
          color: '#ec4899',
          isDone: false
        });
      }
    }
  });

  return events;
}

export function getSyncCategories() {
  const stored = localStorage.getItem('loom_sync_categories_db');
  if (stored) {
    return JSON.parse(stored);
  }
  return getTaskCategories();
}

export function saveSyncCategories(cats) {
  localStorage.setItem('loom_sync_categories_db', JSON.stringify(cats));
  notify('sync_categories');
}

export function getCategoryColor(category) {
  return categoryColors[category] || '#3b82f6';
}

export function getInternshipColor(status) {
  switch (status) {
    case 'Applied': return '#c97d4e';
    case 'Interviewing': return '#f59e0b';
    case 'Offer': return '#10b981';
    case 'Rejected': return '#ef4444';
    default: return '#66666a';
  }
}

// Link audit access log tracking
export async function recordLinkAccess(id) {
  const lastAccessed = new Date().toISOString();
  await supabase.from('bookmarks').update({ lastAccessed }).eq('id', id);
}

// Helper date calculator for recurrence
function calculateNextDueDate(currentDateStr, recurrence) {
  if (!currentDateStr) return '';
  const date = new Date(currentDateStr + 'T12:00:00');
  if (isNaN(date.getTime())) return '';
  
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return '';
  }
  return date.toISOString().split('T')[0];
}
