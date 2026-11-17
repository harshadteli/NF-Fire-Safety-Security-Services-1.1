/**
 * records.js — NF Fire Safety Security Services
 * CRUD operations for party records
 */

"use strict";

// ─── State ──────────────────────────────────────────────────────────────────
let allRecords = [];
let editingId  = null;

// ─── DOM References ──────────────────────────────────────────────────────────
const recordsTableBody  = document.getElementById('recordsTableBody');
const recordSearchInput = document.getElementById('recordSearchInput');
const addRecordBtn      = document.getElementById('addRecordBtn');
const recordModal       = document.getElementById('recordModal');
const recordModalOverlay= document.getElementById('recordModalOverlay');
const recordForm        = document.getElementById('recordForm');
const modalTitle        = document.getElementById('modalTitle');
const confirmModalOverlay = document.getElementById('confirmModalOverlay');
const confirmDeleteBtn  = document.getElementById('confirmDeleteBtn');
const confirmPartyName  = document.getElementById('confirmPartyName');

// Form fields
const fSrNo         = document.getElementById('f_sr_no');
const fInvoiceNo    = document.getElementById('f_invoice_no');
const fDate         = document.getElementById('f_date');
const fPartyName    = document.getElementById('f_party_name');
const fRefillingDate= document.getElementById('f_refilling_date');
const fDueDate      = document.getElementById('f_due_date');
const fNote         = document.getElementById('f_note');

let pendingDeleteId = null;

// ─── Initialise ──────────────────────────────────────────────────────────────
function initRecords() {
  setTodayDate();
  bindRecordsEvents();
  loadRecords();
}

function setTodayDate() {
  const today = toInputDate(new Date());
  if (fDate) fDate.value = today;
}

// ─── SR No Generation ────────────────────────────────────────────────────────
/**
 * Generates a monthly auto-incremented SR No.
 * Format: MM/YYYY-XXX  (e.g. 07/2026-001)
 * The sequence resets to 001 every new month.
 * @param {Date|string} refDate — date of record (used for MM/YYYY prefix)
 * @param {Array} existingRecords — all current records (to find highest seq)
 */
function generateSrNo(refDate, existingRecords) {
  const d = refDate ? new Date(refDate) : new Date();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const prefix = `${mm}/${yyyy}-`;

  let maxSeq = 0;
  existingRecords.forEach(r => {
    if (r.SR_No && r.SR_No.startsWith(prefix)) {
      const seq = parseInt(r.SR_No.replace(prefix, ''), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  });
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function toInputDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Due Date = Refilling Date + 1 year − 1 day
 * e.g. 11/04/2026 → 10/04/2027
 */
function calcDueDate(refillingDateStr) {
  if (!refillingDateStr) return '';
  const d = new Date(refillingDateStr);
  if (isNaN(d)) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return toInputDate(d);
}

function daysBetween(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

// ─── Load Records ─────────────────────────────────────────────────────────────
async function loadRecords() {
  showTableLoading();
  try {
    const data = await apiGet('getRecords');
    allRecords = Array.isArray(data) ? data : [];
  } catch (e) {
    // fallback to localStorage for offline demo
    allRecords = getLocalRecords();
    showToastMsg('⚠️ Using offline data. Connect GAS for live data.', 'warning');
  }
  renderRecordsTable(allRecords);
  updateStats();
  // Notify notification module
  if (typeof refreshNotifications === 'function') refreshNotifications(allRecords);
}

// ─── Render Table ─────────────────────────────────────────────────────────────
function renderRecordsTable(records) {
  if (!recordsTableBody) return;

  if (records.length === 0) {
    recordsTableBody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <span class="material-icons">inventory_2</span>
          <p>No records found. Click <strong>Add Record</strong> to get started.</p>
        </div>
      </td></tr>`;
    return;
  }

  recordsTableBody.innerHTML = records.map((r, idx) => {
    const days     = r.Due_Date ? daysBetween(r.Due_Date) : null;
    const dueCls   = days === null ? '' : days < 0 ? 'overdue' : days <= 4 ? 'due-soon' : 'due-ok';
    const dueIcon  = days === null ? '' : days < 0
      ? '<span class="material-icons" style="font-size:14px;vertical-align:middle;color:var(--danger)">warning</span> '
      : days <= 4
        ? '<span class="material-icons" style="font-size:14px;vertical-align:middle;color:var(--warning)">schedule</span> '
        : '';

    return `
    <tr data-id="${r.SR_No}">
      <td><span class="sr-badge">${r.SR_No || idx + 1}</span></td>
      <td>${r.Invoice_No || '—'}</td>
      <td>${formatDisplayDate(r.Date)}</td>
      <td style="font-weight:500">${r.Party_Name || '—'}</td>
      <td>${formatDisplayDate(r.Refilling_Date)}</td>
      <td class="${dueCls}">${dueIcon}${formatDisplayDate(r.Due_Date)}</td>
      <td style="max-width:160px;white-space:normal;font-size:12px">${r.Note || '—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon view" title="View Details" onclick="openViewModal('${r.SR_No}')">
            <span class="material-icons">visibility</span>
          </button>
          <button class="btn-icon" title="Edit" onclick="openEditModal('${r.SR_No}')">
            <span class="material-icons">edit</span>
          </button>
          <button class="btn-icon danger" title="Delete" onclick="openDeleteConfirm('${r.SR_No}','${escapeHtml(r.Party_Name)}')">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function showTableLoading() {
  if (!recordsTableBody) return;
  recordsTableBody.innerHTML = `<tr><td colspan="9"><div class="spinner-wrap"><div class="spinner"></div></div></td></tr>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  const total    = allRecords.length;
  const dueSoon  = allRecords.filter(r => { const d = r.Due_Date ? daysBetween(r.Due_Date) : null; return d !== null && d >= 0 && d <= 4; }).length;
  const overdue  = allRecords.filter(r => r.Due_Date && daysBetween(r.Due_Date) < 0).length;
  const thisMonth= allRecords.filter(r => {
    if (!r.Date) return false;
    const d = new Date(r.Date);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  setStatVal('statTotal',    total);
  setStatVal('statDueSoon',  dueSoon);
  setStatVal('statOverdue',  overdue);
  setStatVal('statThisMonth', thisMonth);
}
function setStatVal(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ─── Bind Events ──────────────────────────────────────────────────────────────
function bindRecordsEvents() {
  // Open Add Modal
  if (addRecordBtn) addRecordBtn.addEventListener('click', openAddModal);

  // Close modal on overlay click
  if (recordModalOverlay) {
    recordModalOverlay.addEventListener('click', e => {
      if (e.target === recordModalOverlay) closeRecordModal();
    });
  }

  // Form submit
  if (recordForm) recordForm.addEventListener('submit', handleFormSubmit);

  // Refilling Date → auto Due Date
  if (fRefillingDate) {
    fRefillingDate.addEventListener('change', () => {
      if (fDueDate && !fDueDate.dataset.manualOverride) {
        fDueDate.value = calcDueDate(fRefillingDate.value);
      }
    });
  }
  // Mark Due Date as manually overridden when user types in it
  if (fDueDate) {
    fDueDate.addEventListener('change', () => {
      fDueDate.dataset.manualOverride = '1';
    });
  }

  // Record Date change → regenerate SR No (for add mode)
  if (fDate) {
    fDate.addEventListener('change', () => {
      if (!editingId) {
        fSrNo.value = generateSrNo(fDate.value, allRecords);
      }
    });
  }

  // Search
  if (recordSearchInput) {
    recordSearchInput.addEventListener('input', () => {
      const q = recordSearchInput.value.trim().toLowerCase();
      if (!q) { renderRecordsTable(allRecords); return; }
      renderRecordsTable(allRecords.filter(r =>
        (r.Party_Name || '').toLowerCase().includes(q) ||
        (r.Invoice_No || '').toLowerCase().includes(q) ||
        (r.SR_No || '').toLowerCase().includes(q) ||
        (r.Note || '').toLowerCase().includes(q)
      ));
    });
  }

  // Confirm delete button
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      if (pendingDeleteId) deleteRecord(pendingDeleteId);
    });
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  resetForm();
  modalTitle.textContent = 'Add New Record';
  // Set today's date and generate SR No
  const today = toInputDate(new Date());
  fDate.value = today;
  fSrNo.value = generateSrNo(today, allRecords);
  openModal();
}

function openEditModal(srNo) {
  const r = allRecords.find(x => x.SR_No === srNo);
  if (!r) return;
  editingId = srNo;
  resetForm();
  modalTitle.textContent = 'Edit Record';

  fSrNo.value          = r.SR_No          || '';
  fInvoiceNo.value     = r.Invoice_No     || '';
  fDate.value          = r.Date           || '';
  fPartyName.value     = r.Party_Name     || '';
  fRefillingDate.value = r.Refilling_Date || '';
  fDueDate.value       = r.Due_Date       || '';
  fNote.value          = r.Note           || '';
  openModal();
}

function openModal() {
  if (recordModalOverlay) recordModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRecordModal() {
  if (recordModalOverlay) recordModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
  editingId = null;
}
window.closeRecordModal = closeRecordModal;

function resetForm() {
  if (recordForm) recordForm.reset();
  if (fDueDate) delete fDueDate.dataset.manualOverride;
  // Clear validation states
  document.querySelectorAll('.form-control.invalid').forEach(el => el.classList.remove('invalid'));
}

// ─── Form Submit ──────────────────────────────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    SR_No:         fSrNo.value.trim(),
    Invoice_No:    fInvoiceNo.value.trim(),
    Date:          fDate.value,
    Party_Name:    fPartyName.value.trim(),
    Refilling_Date:fRefillingDate.value,
    Due_Date:      fDueDate.value,
    Note:          fNote.value.trim(),
  };

  const submitBtn = recordForm.querySelector('[type="submit"]');
  setButtonLoading(submitBtn, true);

  try {
    if (editingId) {
      await apiPost('updateRecord', payload);
      const idx = allRecords.findIndex(r => r.SR_No === editingId);
      if (idx !== -1) allRecords[idx] = payload;
      showToastMsg('Record updated successfully!', 'success');
    } else {
      await apiPost('addRecord', payload);
      allRecords.push(payload);
      showToastMsg('Record added successfully!', 'success');
    }
    saveLocalRecords(allRecords);
  } catch (err) {
    // Offline fallback
    if (editingId) {
      const idx = allRecords.findIndex(r => r.SR_No === editingId);
      if (idx !== -1) allRecords[idx] = payload;
    } else {
      allRecords.push(payload);
    }
    saveLocalRecords(allRecords);
    showToastMsg('Saved locally (GAS offline)', 'warning');
  }

  setButtonLoading(submitBtn, false);
  closeRecordModal();
  renderRecordsTable(allRecords);
  updateStats();
  if (typeof refreshNotifications === 'function') refreshNotifications(allRecords);
}

function validateForm() {
  let ok = true;
  const required = [
    { el: fPartyName,    msg: 'Party name is required' },
    { el: fRefillingDate,msg: 'Refilling date is required' },
    { el: fDueDate,      msg: 'Due date is required' },
  ];
  required.forEach(({ el }) => {
    if (!el.value.trim()) { el.classList.add('invalid'); ok = false; }
    else el.classList.remove('invalid');
  });
  return ok;
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openDeleteConfirm(srNo, partyName) {
  pendingDeleteId = srNo;
  if (confirmPartyName) confirmPartyName.textContent = partyName;
  if (confirmModalOverlay) confirmModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openDeleteConfirm = openDeleteConfirm;

function closeConfirmModal() {
  pendingDeleteId = null;
  if (confirmModalOverlay) confirmModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeConfirmModal = closeConfirmModal;

async function deleteRecord(srNo) {
  closeConfirmModal();
  try {
    await apiPost('deleteRecord', { SR_No: srNo });
  } catch (e) { /* offline */ }
  allRecords = allRecords.filter(r => r.SR_No !== srNo);
  saveLocalRecords(allRecords);
  renderRecordsTable(allRecords);
  updateStats();
  if (typeof refreshNotifications === 'function') refreshNotifications(allRecords);
  showToastMsg('Record deleted.', 'info');
}

// ─── LocalStorage Fallback ────────────────────────────────────────────────────
function getLocalRecords() {
  try { return JSON.parse(localStorage.getItem('nf_records') || '[]'); } catch { return []; }
}
function saveLocalRecords(records) {
  try { localStorage.setItem('nf_records', JSON.stringify(records)); } catch {}
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle"></span>Saving...'
    : '<span class="material-icons">save</span> Save Record';
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function openViewModal(srNo) {
  const r = allRecords.find(x => x.SR_No === srNo);
  if (!r) return;

  const days    = r.Due_Date ? daysBetween(r.Due_Date) : null;
  const dueCls  = days === null ? 'chip-blue'
    : days < 0   ? 'chip-red'
    : days <= 4  ? 'chip-yellow'
    : 'chip-green';
  const dueLabel = days === null ? '—'
    : days < 0   ? `Overdue by ${Math.abs(days)} day(s)`
    : days === 0 ? 'Due TODAY'
    : `Due in ${days} day(s)`;

  // Populate view modal fields
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('view_sr_no',          r.SR_No);
  set('view_invoice_no',     r.Invoice_No);
  set('view_date',           formatDisplayDate(r.Date));
  set('view_party_name',     r.Party_Name);
  set('view_refilling_date', formatDisplayDate(r.Refilling_Date));
  set('view_due_date',       formatDisplayDate(r.Due_Date));
  set('view_note',           r.Note || 'No notes added.');

  // Due status chip
  const dueChipEl = document.getElementById('view_due_status');
  if (dueChipEl) {
    dueChipEl.textContent  = dueLabel;
    dueChipEl.className    = `chip ${dueCls}`;
  }

  // Edit button in view modal jumps to edit
  const viewEditBtn = document.getElementById('viewEditBtn');
  if (viewEditBtn) {
    viewEditBtn.onclick = () => { closeViewModal(); openEditModal(srNo); };
  }

  const overlay = document.getElementById('viewModalOverlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeViewModal() {
  const overlay = document.getElementById('viewModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeViewModal = closeViewModal;

// ─── Open for global use ──────────────────────────────────────────────────────
window.openEditModal    = openEditModal;
window.openViewModal    = openViewModal;
window.initRecords      = initRecords;
window.getAllRecords     = () => allRecords;
window.calcDueDate      = calcDueDate;
window.formatDisplayDate= formatDisplayDate;
window.daysBetween      = daysBetween;
