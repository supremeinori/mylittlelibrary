/**
 * My Little Library — script.js
 * Personal book organizer with PDF/ePub file upload and in-app reader.
 */

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const STORAGE_KEY      = 'myLittleLibrary_books';
const FILE_STORAGE_KEY = 'myLittleLibrary_files'; // id -> base64 dataURL
const MAX_INLINE_BYTES = 8 * 1024 * 1024; // 8 MB — warn above this

const CATEGORIES = ['Psychology','Philosophy','Literature','Cinema','Technology','Other'];

const STATUS_CLASS = {
  'Want to Read': 'badge-status-want',
  'Reading':      'badge-status-reading',
  'Finished':     'badge-status-finished',
};

/* ─────────────────────────────────────────────
   State
   ───────────────────────────────────────────── */
let books        = [];   // array of book record objects
let fileStore    = {};   // { bookId: dataURL }
let editingId    = null;
let pendingDeleteId = null;
let currentView  = 'dashboard';
let pendingFile  = null; // { file, dataURL, type } — staged before save
let currentEpub  = null; // epub.js Book instance
let currentRendition = null;

/* ─────────────────────────────────────────────
   Persistence
   ───────────────────────────────────────────── */
function loadData() {
  try {
    const rawBooks = localStorage.getItem(STORAGE_KEY);
    if (rawBooks) {
      const parsed = JSON.parse(rawBooks);
      if (Array.isArray(parsed)) books = parsed;
    }
  } catch (_) { books = []; }

  try {
    const rawFiles = localStorage.getItem(FILE_STORAGE_KEY);
    if (rawFiles) {
      const parsed = JSON.parse(rawFiles);
      if (parsed && typeof parsed === 'object') fileStore = parsed;
    }
  } catch (_) { fileStore = {}; }
}

function saveBooks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); } catch (_) {}
}

function saveFileStore() {
  try { localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(fileStore)); } catch (e) {
    showStorageError();
  }
}

function showStorageError() {
  alert('Storage is full. The file could not be saved permanently. Try removing some books or use smaller files.');
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
function generateId() {
  return 'book-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
}

function $(id) { return document.getElementById(id); }

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf')  return 'pdf';
  if (ext === 'epub') return 'epub';
  return 'unknown';
}

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
  });

  if (viewName === 'dashboard')  renderDashboard();
  if (viewName === 'collection') renderCollection();
}

/* ─────────────────────────────────────────────
   Dashboard
   ───────────────────────────────────────────── */
function renderDashboard() {
  $('statTotal').textContent    = books.length;
  $('statWant').textContent     = books.filter(b => b.status === 'Want to Read').length;
  $('statReading').textContent  = books.filter(b => b.status === 'Reading').length;
  $('statFinished').textContent = books.filter(b => b.status === 'Finished').length;
  renderCategoryBars();
  renderRecent();
}

function renderCategoryBars() {
  const bars = $('categoryBars');
  bars.innerHTML = '';

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
    if (!count) return;
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
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  sorted.forEach(book => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    const fileTypeBadge = book.fileType
      ? '<span class="badge badge-file badge-file-' + book.fileType + '">' + book.fileType.toUpperCase() + '</span>'
      : '';
    item.innerHTML =
      '<div>' +
        '<div class="recent-title">' + esc(book.title) + '</div>' +
        '<div class="recent-author">' + esc(book.author || '—') + '</div>' +
      '</div>' +
      '<div class="recent-meta">' +
        fileTypeBadge +
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
  const query     = $('searchInput').value.trim().toLowerCase();
  const catFilter = $('filterCategory').value;
  const stFilter  = $('filterStatus').value;

  return books.filter(b => {
    if (catFilter && b.category !== catFilter) return false;
    if (stFilter  && b.status   !== stFilter)  return false;
    if (query) {
      const inTitle  = b.title.toLowerCase().includes(query);
      const inAuthor = (b.author || '').toLowerCase().includes(query);
      if (!inTitle && !inAuthor) return false;
    }
    return true;
  });
}

function renderCollection() {
  const filtered = getFiltered();
  const grid  = $('bookGrid');
  const empty = $('emptyState');

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
      $('emptySub').textContent   = 'Upload a PDF or ePub to get started.';
      $('emptyAddBtn').classList.remove('hidden');
    }
    return;
  }

  grid.classList.remove('hidden');
  empty.classList.add('hidden');
  filtered.forEach(book => grid.appendChild(buildBookCard(book)));
}

function buildBookCard(book) {
  const card = document.createElement('article');
  card.className = 'book-card';
  card.dataset.id = book.id;

  const hasFile = !!fileStore[book.id];
  const fileTypeBadge = book.fileType
    ? '<span class="badge badge-file badge-file-' + book.fileType + '">' + book.fileType.toUpperCase() + '</span>'
    : '';

  const notesHtml = book.notes
    ? '<div class="book-notes">' + esc(book.notes) + '</div>'
    : '';

  const readAction = hasFile
    ? '<button class="book-read-btn" data-action="read" data-id="' + esc(book.id) + '">&#128214; Read</button>'
    : '<p class="book-no-file">No file attached</p>';

  card.innerHTML =
    '<div class="book-card-header">' +
      '<div class="book-title">' + esc(book.title) + '</div>' +
      '<div class="book-actions">' +
        '<button class="icon-btn" data-action="edit"   data-id="' + esc(book.id) + '" title="Edit"   aria-label="Edit ' + esc(book.title) + '">&#9998;</button>' +
        '<button class="icon-btn icon-btn--danger" data-action="delete" data-id="' + esc(book.id) + '" title="Delete" aria-label="Delete ' + esc(book.title) + '">&#128465;</button>' +
      '</div>' +
    '</div>' +
    '<div class="book-author">' + esc(book.author || '') + '</div>' +
    '<div class="book-card-meta">' +
      fileTypeBadge +
      '<span class="badge badge-category">' + esc(book.category) + '</span>' +
      '<span class="badge ' + (STATUS_CLASS[book.status] || '') + '">' + esc(book.status) + '</span>' +
    '</div>' +
    notesHtml +
    readAction;

  return card;
}

/* ─────────────────────────────────────────────
   File Upload Logic
   ───────────────────────────────────────────── */
function resetFileState() {
  pendingFile = null;
  $('fileDropInner').classList.remove('hidden');
  $('fileSelected').classList.add('hidden');
  $('errFile').textContent = '';
  $('uploadProgress').classList.add('hidden');
  $('uploadBar').style.width = '0%';
  $('fileSizeWarning').classList.add('hidden');
  $('fileInput').value = '';
}

function stageFile(file) {
  if (!file) return;

  const type = getFileType(file.name);
  if (type === 'unknown') {
    $('errFile').textContent = 'Only PDF and ePub files are supported.';
    return;
  }

  $('errFile').textContent = '';
  $('fileSelName').textContent = file.name;
  $('fileSelSize').textContent = formatBytes(file.size);
  $('fileDropInner').classList.add('hidden');
  $('fileSelected').classList.remove('hidden');

  // Large file warning
  if (file.size > MAX_INLINE_BYTES) {
    $('fileSizeWarning').classList.remove('hidden');
  } else {
    $('fileSizeWarning').classList.add('hidden');
  }

  // Pre-fill title from filename
  const nameWithoutExt = file.name.replace(/\.(pdf|epub)$/i, '');
  if (!$('fieldTitle').value.trim()) {
    $('fieldTitle').value = nameWithoutExt;
  }

  // Read file as base64 with progress simulation
  $('uploadProgress').classList.remove('hidden');
  const reader = new FileReader();

  let fakeProgress = 0;
  const ticker = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 10, 85);
    $('uploadBar').style.width = fakeProgress + '%';
  }, 60);

  reader.onload = function(e) {
    clearInterval(ticker);
    $('uploadBar').style.width = '100%';
    setTimeout(() => $('uploadProgress').classList.add('hidden'), 400);
    pendingFile = { file, dataURL: e.target.result, type };
  };

  reader.onerror = function() {
    clearInterval(ticker);
    $('errFile').textContent = 'Could not read the file. Please try again.';
    resetFileState();
  };

  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────────
   Form Modal
   ───────────────────────────────────────────── */
function openAddForm() {
  editingId = null;
  pendingFile = null;
  $('formModalTitle').textContent = 'Add Book';
  $('formSaveBtn').textContent    = 'Save Book';
  $('bookForm').reset();
  clearFormErrors();
  resetFileState();
  $('fileUploadGroup').classList.remove('hidden');
  openModal('formModal');
  $('fileInput').focus();
}

function openEditForm(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;

  editingId = id;
  $('formModalTitle').textContent = 'Edit Book';
  $('formSaveBtn').textContent    = 'Save Changes';

  $('bookId').value        = book.id;
  $('fieldTitle').value    = book.title;
  $('fieldAuthor').value   = book.author || '';
  $('fieldCategory').value = book.category;
  $('fieldStatus').value   = book.status;
  $('fieldNotes').value    = book.notes || '';

  // Hide file upload when editing (file stays attached)
  $('fileUploadGroup').classList.add('hidden');

  clearFormErrors();
  openModal('formModal');
}

function clearFormErrors() {
  ['errFile','errTitle','errCategory','errStatus'].forEach(id => {
    $(id).textContent = '';
  });
  ['fieldTitle','fieldCategory','fieldStatus'].forEach(id => {
    $(id).classList.remove('is-error');
  });
}

function validateForm() {
  let valid = true;

  // File required only when adding
  if (!editingId && !pendingFile) {
    $('errFile').textContent = 'Please select a PDF or ePub file.';
    valid = false;
  }

  const fields = [
    { input: 'fieldTitle',    error: 'errTitle',    label: 'Title' },
    { input: 'fieldCategory', error: 'errCategory', label: 'Category' },
    { input: 'fieldStatus',   error: 'errStatus',   label: 'Status' },
  ];

  fields.forEach(({ input, error, label }) => {
    const el  = $(input);
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
    // Update metadata only
    const idx = books.findIndex(b => b.id === editingId);
    if (idx !== -1) {
      books[idx] = Object.assign({}, books[idx], { title, author, category, status, notes });
    }
  } else {
    // New book with file
    const id = generateId();
    const fileType = pendingFile.type;

    books.push({
      id,
      title,
      author,
      category,
      status,
      notes,
      fileType,
      createdAt: new Date().toISOString(),
    });

    // Store file data
    fileStore[id] = pendingFile.dataURL;
    saveFileStore();
  }

  saveBooks();
  closeModal('formModal');
  renderCollection();
  renderDashboard();
}

/* ─────────────────────────────────────────────
   Delete
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
  delete fileStore[pendingDeleteId];
  pendingDeleteId = null;
  saveBooks();
  saveFileStore();
  closeModal('deleteModal');
  renderCollection();
  renderDashboard();
}

/* ─────────────────────────────────────────────
   Reader
   ───────────────────────────────────────────── */
function openReader(bookId) {
  const book = books.find(b => b.id === bookId);
  const dataURL = fileStore[bookId];
  if (!book || !dataURL) {
    alert('File not found. The file data may have been lost if storage was cleared.');
    return;
  }

  $('readerTitle').textContent  = book.title;
  $('readerAuthor').textContent = book.author || '';

  const body = $('readerBody');
  body.innerHTML = '';

  // Store current blob URL for "open in tab"
  let blobURL = null;

  if (book.fileType === 'pdf') {
    // Convert base64 dataURL to blob URL for iframe
    const blob = dataURLToBlob(dataURL);
    blobURL = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.src = blobURL;
    iframe.title = book.title;
    body.appendChild(iframe);

    $('readerOpenExternal').onclick = () => window.open(blobURL, '_blank');

  } else if (book.fileType === 'epub') {
    // ePub via epub.js
    const viewerDiv = document.createElement('div');
    viewerDiv.id = 'epubViewer';
    body.appendChild(viewerDiv);

    // Prev/Next nav buttons
    const prevBtn = document.createElement('button');
    prevBtn.className = 'epub-nav epub-prev';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.title = 'Previous page';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'epub-nav epub-next';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.title = 'Next page';

    body.appendChild(prevBtn);
    body.appendChild(nextBtn);

    // Destroy previous instance
    if (currentRendition) { try { currentRendition.destroy(); } catch(_){} }
    if (currentEpub)      { try { currentEpub.destroy();      } catch(_){} }

    const blob = dataURLToBlob(dataURL);
    blobURL = URL.createObjectURL(blob);

    if (typeof ePub !== 'undefined') {
      currentEpub = ePub(blobURL);
      currentRendition = currentEpub.renderTo('epubViewer', {
        width:  '100%',
        height: '100%',
        spread: 'none',
      });
      currentRendition.display();

      prevBtn.onclick = () => currentRendition.prev();
      nextBtn.onclick = () => currentRendition.next();
    } else {
      body.innerHTML = '<p style="color:#fff;padding:40px;font-size:14px;">ePub.js library not loaded. Make sure you are connected to the internet on first load.</p>';
    }

    $('readerOpenExternal').onclick = () => window.open(blobURL, '_blank');
  }

  $('readerPanel').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeReader() {
  $('readerPanel').classList.add('hidden');
  document.body.style.overflow = '';

  const body = $('readerBody');

  // Revoke any blob URLs inside iframes
  const iframe = body.querySelector('iframe');
  if (iframe && iframe.src.startsWith('blob:')) {
    URL.revokeObjectURL(iframe.src);
  }

  // Destroy epub instances
  if (currentRendition) { try { currentRendition.destroy(); } catch(_){} currentRendition = null; }
  if (currentEpub)      { try { currentEpub.destroy();      } catch(_){} currentEpub = null; }

  body.innerHTML = '';
}

function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* ─────────────────────────────────────────────
   Modal helpers
   ───────────────────────────────────────────── */
function openModal(id) {
  $(id).classList.remove('hidden');
  const focusable = $(id).querySelector('input:not([type=hidden]), select, textarea, button:not(.modal-close)');
  if (focusable) setTimeout(() => focusable.focus(), 50);
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).classList.add('hidden');
  document.body.style.overflow = '';
}

/* ─────────────────────────────────────────────
   Mobile Sidebar
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
    btn.addEventListener('click', () => { showView(btn.dataset.view); closeSidebar(); });
  });

  // Add book
  $('addBookBtn').addEventListener('click', openAddForm);
  $('emptyAddBtn').addEventListener('click', openAddForm);

  // ── File input / drag-drop ──
  $('fileInput').addEventListener('change', e => {
    if (e.target.files[0]) stageFile(e.target.files[0]);
  });

  $('fileDropArea').addEventListener('click', e => {
    // Don't trigger if clicking the remove button
    if (e.target.closest('.file-sel-remove')) return;
    if (pendingFile) return; // already selected
    $('fileInput').click();
  });

  $('fileSelRemove').addEventListener('click', e => {
    e.stopPropagation();
    resetFileState();
    // Clear auto-filled title only if it still matches the filename
    // (leave it if user changed it manually — best-effort)
  });

  // Drag over
  $('fileDropArea').addEventListener('dragover', e => {
    e.preventDefault();
    $('fileDropArea').classList.add('drag-over');
  });
  $('fileDropArea').addEventListener('dragleave', () => {
    $('fileDropArea').classList.remove('drag-over');
  });
  $('fileDropArea').addEventListener('drop', e => {
    e.preventDefault();
    $('fileDropArea').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) stageFile(file);
  });

  // Form
  $('bookForm').addEventListener('submit', handleFormSubmit);
  $('formModalClose').addEventListener('click', () => closeModal('formModal'));
  $('formCancelBtn').addEventListener('click',  () => closeModal('formModal'));

  // Delete modal
  $('deleteModalClose').addEventListener('click', () => closeModal('deleteModal'));
  $('deleteCancelBtn').addEventListener('click',  () => closeModal('deleteModal'));
  $('deleteConfirmBtn').addEventListener('click', handleDeleteConfirm);

  // Book grid delegation
  $('bookGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit')   openEditForm(id);
    if (btn.dataset.action === 'delete') openDeleteConfirm(id);
    if (btn.dataset.action === 'read')   openReader(id);
  });

  // Reader also supports clicking the "Read" button on book-read-btn
  $('bookGrid').addEventListener('click', e => {
    const btn = e.target.closest('.book-read-btn');
    if (btn) openReader(btn.dataset.id);
  });

  // Reader close
  $('readerCloseBtn').addEventListener('click', closeReader);

  // Search / filters
  $('searchInput').addEventListener('input',   renderCollection);
  $('filterCategory').addEventListener('change', renderCollection);
  $('filterStatus').addEventListener('change',   renderCollection);
  $('clearFiltersBtn').addEventListener('click', () => {
    $('searchInput').value    = '';
    $('filterCategory').value = '';
    $('filterStatus').value   = '';
    renderCollection();
  });

  // Backdrop click to close modals
  ['formModal','deleteModal'].forEach(id => {
    $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('readerPanel').classList.contains('hidden'))  { closeReader(); return; }
    if (!$('formModal').classList.contains('hidden'))    { closeModal('formModal'); return; }
    if (!$('deleteModal').classList.contains('hidden'))  { closeModal('deleteModal'); return; }
    closeSidebar();
  });

  // Live-clear form errors
  ['fieldTitle','fieldCategory','fieldStatus'].forEach(id => {
    const errId = 'err' + id.replace('field','');
    const clear = () => {
      if ($(id).value.trim()) { $(errId).textContent = ''; $(id).classList.remove('is-error'); }
    };
    $(id).addEventListener('input',  clear);
    $(id).addEventListener('change', clear);
  });

  // Mobile sidebar
  $('hamburgerBtn').addEventListener('click', openSidebar);
  $('sidebarOverlay').addEventListener('click', closeSidebar);
}

/* ─────────────────────────────────────────────
   Bootstrap
   ───────────────────────────────────────────── */
function init() {
  loadData();
  bindEvents();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
