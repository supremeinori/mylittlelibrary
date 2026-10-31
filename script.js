/**
 * My Little Library — script.js
 * Personal book organizer — vanilla JS, localStorage persistence
 */

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const STORAGE_KEY = 'myLittleLibrary_books';

const CATEGORIES = ['Psychology', 'Philosophy', 'Literature', 'Cinema', 'Technology', 'Other'];

const STATUSES = ['Want to Read', 'Reading', 'Finished'];

const STATUS_CLASS = {
  'Want to Read': 'badge-status-want',
  'Reading':      'badge-status-reading',
  'Finished':     'badge-status-finished',
};

const SAMPLE_BOOKS = [
  {
    id: 'sample-1',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    category: 'Psychology',
    status: 'Finished',
    notes: 'Fascinating exploration of cognitive biases and heuristics.',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    title: 'The Myth of Sisyphus',
    author: 'Albert Camus',
    category: 'Philosophy',
    status: 'Finished',
    notes: 'On absurdism and the question of meaning.',
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    category: 'Literature',
    status: 'Reading',
    notes: 'Gripping psychological novel.',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-4',
    title: 'Story: Substance, Structure, Style',
    author: 'Robert McKee',
    category: 'Cinema',
    status: 'Want to Read',
    notes: 'Classic screenwriting guide.',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-5',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt & David Thomas',
    category: 'Technology',
    status: 'Want to Read',
    notes: '',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/* ─────────────────────────────────────────────
   State
   ───────────────────────────────────────────── */
let books = [];
let editingId = null;
let pendingDeleteId = null;
let currentView = 'dashboard';

/* ─────────────────────────────────────────────
   Persistence
   ───────────────────────────────────────────── */
function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        books = parsed;
        return;
      }
    }
  } catch (_) { /* ignore malformed data */ }
  // Initialize with sample books
  books = SAMPLE_BOOKS.map(b => Object.assign({}, b));
  saveBooks();
}

function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (_) { /* storage full or unavailable */ }
}

/* ─────────────────────────────────────────────
   Unique ID
   ───────────────────────────────────────────── */
function generateId() {
  return 'book-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/* ─────────────────────────────────────────────
   XSS-safe text
   ───────────────────────────────────────────── */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ─────────────────────────────────────────────
   DOM helpers
   ───────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

/* ─────────────────────────────────────────────
   Navigation
   ───────────────────────────────────────────── */
function showView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = $('view-' + viewName);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
    btn.setAttribute('aria-current', btn.dataset.view === viewName ? 'page' : 'false');
  });

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'collection') renderCollection();
}

/* ─────────────────────────────────────────────
   Dashboard
   ───────────────────────────────────────────── */
function renderDashboard() {
  const total    = books.length;
  const want     = books.filter(b => b.status === 'Want to Read').length;
  const reading  = books.filter(b => b.status === 'Reading').length;
  const finished = books.filter(b => b.status === 'Finished').length;

  $('statTotal').textContent   = total;
  $('statWant').textContent    = want;
  $('statReading').textContent = reading;
  $('statFinished').textContent = finished;

  renderCategoryBars();
  renderRecent();
}

function renderCategoryBars() {
  const bars = $('categoryBars');
  bars.innerHTML = '';

  // Count per category
  const counts = {};
  CATEGORIES.forEach(c => { counts[c] = 0; });
  books.forEach(b => { if (counts[b.category] !== undefined) counts[b.category]++; });

  const max = Math.max(...Object.values(counts), 1);

  const hasAny = Object.values(counts).some(n => n > 0);
  if (!hasAny) {
    bars.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">No books yet.</p>';
    return;
  }

  CATEGORIES.forEach(cat => {
    const count = counts[cat];
    if (count === 0) return;
    const pct = Math.round((count / max) * 100);
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML =
      '<span class="cat-name">' + esc(cat) + '</span>' +
      '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="cat-count">' + count + '</span>';
    bars.appendChild(row);
  });
}

function renderRecent() {
  const list = $('recentList');
  list.innerHTML = '';

  if (books.length === 0) {
    const p = document.createElement('p');
    p.className = 'recent-empty';
    p.textContent = 'No books yet.';
    list.appendChild(p);
    return;
  }

  const sorted = [...books]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  sorted.forEach(book => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.innerHTML =
      '<div>' +
        '<div class="recent-title">' + esc(book.title) + '</div>' +
        '<div class="recent-author">' + esc(book.author) + '</div>' +
      '</div>' +
      '<div class="recent-meta">' +
        '<span class="badge badge-category">' + esc(book.category) + '</span>' +
        '<span class="badge ' + (STATUS_CLASS[book.status] || '') + '">' + esc(book.status) + '</span>' +
      '</div>';
    list.appendChild(item);
  });
}

/* ─────────────────────────────────────────────
   Collection
   ───────────────────────────────────────────── */
function getFiltered() {
  const query  = $('searchInput').value.trim().toLowerCase();
  const catFilter = $('filterCategory').value;
  const stFilter  = $('filterStatus').value;

  return books.filter(b => {
    if (catFilter && b.category !== catFilter) return false;
    if (stFilter  && b.status   !== stFilter)  return false;
    if (query) {
      const inTitle  = b.title.toLowerCase().includes(query);
      const inAuthor = b.author.toLowerCase().includes(query);
      if (!inTitle && !inAuthor) return false;
    }
    return true;
  });
}

function renderCollection() {
  const filtered = getFiltered();
  const grid     = $('bookGrid');
  const empty    = $('emptyState');

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');

    const hasFilters =
      $('searchInput').value.trim() !== '' ||
      $('filterCategory').value     !== '' ||
      $('filterStatus').value       !== '';

    if (hasFilters) {
      $('emptyTitle').textContent = 'No books match your search.';
      $('emptySub').textContent   = 'Try adjusting the search or filters.';
      $('emptyAddBtn').classList.add('hidden');
    } else {
      $('emptyTitle').textContent = 'Your library is empty.';
      $('emptySub').textContent   = 'Add your first book to get started.';
      $('emptyAddBtn').classList.remove('hidden');
    }
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  filtered.forEach(book => {
    const card = buildBookCard(book);
    grid.appendChild(card);
  });
}

function buildBookCard(book) {
  const card = document.createElement('article');
  card.className = 'book-card';
  card.dataset.id = book.id;

  const notesHtml = book.notes
    ? '<div class="book-notes">' + esc(book.notes) + '</div>'
    : '';

  card.innerHTML =
    '<div class="book-card-header">' +
      '<div class="book-title">' + esc(book.title) + '</div>' +
      '<div class="book-actions">' +
        '<button class="icon-btn" data-action="edit" data-id="' + esc(book.id) + '" title="Edit" aria-label="Edit ' + esc(book.title) + '">&#9998;</button>' +
        '<button class="icon-btn icon-btn--danger" data-action="delete" data-id="' + esc(book.id) + '" title="Delete" aria-label="Delete ' + esc(book.title) + '">&#128465;</button>' +
      '</div>' +
    '</div>' +
    '<div class="book-author">' + esc(book.author) + '</div>' +
    '<div class="book-card-meta">' +
      '<span class="badge badge-category">' + esc(book.category) + '</span>' +
      '<span class="badge ' + (STATUS_CLASS[book.status] || '') + '">' + esc(book.status) + '</span>' +
    '</div>' +
    notesHtml;

  return card;
}

/* ─────────────────────────────────────────────
   Form Modal
   ───────────────────────────────────────────── */
function openAddForm() {
  editingId = null;
  $('formModalTitle').textContent = 'Add Book';
  $('formSaveBtn').textContent    = 'Save Book';
  $('bookForm').reset();
  clearFormErrors();
  openModal('formModal');
}

function openEditForm(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;

  editingId = id;
  $('formModalTitle').textContent = 'Edit Book';
  $('formSaveBtn').textContent    = 'Save Changes';

  $('bookId').value       = book.id;
  $('fieldTitle').value   = book.title;
  $('fieldAuthor').value  = book.author;
  $('fieldCategory').value = book.category;
  $('fieldStatus').value  = book.status;
  $('fieldNotes').value   = book.notes || '';

  clearFormErrors();
  openModal('formModal');
}

function clearFormErrors() {
  ['errTitle', 'errAuthor', 'errCategory', 'errStatus'].forEach(id => {
    $(id).textContent = '';
  });
  ['fieldTitle', 'fieldAuthor', 'fieldCategory', 'fieldStatus'].forEach(id => {
    $(id).classList.remove('is-error');
  });
}

function validateForm() {
  let valid = true;

  const fields = [
    { input: 'fieldTitle',    error: 'errTitle',    label: 'Title' },
    { input: 'fieldAuthor',   error: 'errAuthor',   label: 'Author' },
    { input: 'fieldCategory', error: 'errCategory', label: 'Category' },
    { input: 'fieldStatus',   error: 'errStatus',   label: 'Status' },
  ];

  fields.forEach(({ input, error, label }) => {
    const el = $(input);
    const val = el.value.trim();
    if (!val) {
      $(error).textContent = label + ' is required.';
      el.classList.add('is-error');
      valid = false;
    } else {
      $(error).textContent = '';
      el.classList.remove('is-error');
    }
  });

  return valid;
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const title    = $('fieldTitle').value.trim();
  const author   = $('fieldAuthor').value.trim();
  const category = $('fieldCategory').value;
  const status   = $('fieldStatus').value;
  const notes    = $('fieldNotes').value.trim();

  if (editingId) {
    const idx = books.findIndex(b => b.id === editingId);
    if (idx !== -1) {
      books[idx] = Object.assign({}, books[idx], { title, author, category, status, notes });
    }
  } else {
    const newBook = {
      id: generateId(),
      title,
      author,
      category,
      status,
      notes,
      createdAt: new Date().toISOString(),
    };
    books.push(newBook);
  }

  saveBooks();
  closeModal('formModal');
  renderCollection();
  renderDashboard();
}

/* ─────────────────────────────────────────────
   Delete Modal
   ───────────────────────────────────────────── */
function openDeleteConfirm(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  pendingDeleteId = id;
  $('deleteBookTitle').textContent = book.title;
  openModal('deleteModal');
}

function handleDeleteConfirm() {
  if (!pendingDeleteId) return;
  books = books.filter(b => b.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveBooks();
  closeModal('deleteModal');
  renderCollection();
  renderDashboard();
}

/* ─────────────────────────────────────────────
   Modal helpers
   ───────────────────────────────────────────── */
function openModal(id) {
  const modal = $(id);
  modal.classList.remove('hidden');
  // Focus first focusable element
  const focusable = modal.querySelector('input, select, textarea, button:not(.modal-close)');
  if (focusable) focusable.focus();
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).classList.add('hidden');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────
   Mobile sidebar
   ───────────────────────────────────────────── */
function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────
   Event Wiring
   ───────────────────────────────────────────── */
function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.view);
      closeSidebar();
    });
  });

  // Add book
  $('addBookBtn').addEventListener('click', openAddForm);
  $('emptyAddBtn').addEventListener('click', openAddForm);

  // Form modal
  $('bookForm').addEventListener('submit', handleFormSubmit);
  $('formModalClose').addEventListener('click', () => closeModal('formModal'));
  $('formCancelBtn').addEventListener('click', () => closeModal('formModal'));

  // Delete modal
  $('deleteModalClose').addEventListener('click', () => closeModal('deleteModal'));
  $('deleteCancelBtn').addEventListener('click', () => closeModal('deleteModal'));
  $('deleteConfirmBtn').addEventListener('click', handleDeleteConfirm);

  // Book grid delegation (edit / delete)
  $('bookGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit')   openEditForm(id);
    if (btn.dataset.action === 'delete') openDeleteConfirm(id);
  });

  // Search & filters
  $('searchInput').addEventListener('input', renderCollection);
  $('filterCategory').addEventListener('change', renderCollection);
  $('filterStatus').addEventListener('change', renderCollection);

  // Clear filters
  $('clearFiltersBtn').addEventListener('click', () => {
    $('searchInput').value    = '';
    $('filterCategory').value = '';
    $('filterStatus').value   = '';
    renderCollection();
  });

  // Close modals on backdrop click
  ['formModal', 'deleteModal'].forEach(id => {
    $(id).addEventListener('click', e => {
      if (e.target === $(id)) closeModal(id);
    });
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('formModal').classList.contains('hidden'))   closeModal('formModal');
      if (!$('deleteModal').classList.contains('hidden')) closeModal('deleteModal');
      closeSidebar();
    }
  });

  // Form field live-clear errors
  ['fieldTitle', 'fieldAuthor', 'fieldCategory', 'fieldStatus'].forEach(id => {
    $(id).addEventListener('input', () => {
      if ($(id).value.trim()) {
        const errId = 'err' + id.replace('field', '');
        $(errId).textContent = '';
        $(id).classList.remove('is-error');
      }
    });
    $(id).addEventListener('change', () => {
      if ($(id).value.trim()) {
        const errId = 'err' + id.replace('field', '');
        $(errId).textContent = '';
        $(id).classList.remove('is-error');
      }
    });
  });

  // Mobile sidebar
  $('hamburgerBtn').addEventListener('click', openSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);
}

/* ─────────────────────────────────────────────
   Bootstrap
   ───────────────────────────────────────────── */
function init() {
  loadBooks();
  bindEvents();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
