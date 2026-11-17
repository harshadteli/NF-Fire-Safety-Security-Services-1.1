/**
 * notifications.js — NF Fire Safety Security Services
 * Notification drawer, toast popup, and bell badge
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
let allNotifications   = [];   // Full list of upcoming / overdue
let dismissedIds       = [];   // SR_No strings of dismissed items
let filteredNotifs     = [];   // Currently displayed subset
let notifFilterMode    = 'all';// 'all' | 'party' | 'day' | 'month' | 'range'

// ─── DOM ──────────────────────────────────────────────────────────────────────
const notifBadge        = document.getElementById('notifBadge');
const notifBell         = document.getElementById('notifBell');
const notifDrawerOverlay= document.getElementById('notifDrawerOverlay');
const notifList         = document.getElementById('notifList');
const notifCountBadge   = document.getElementById('notifCountBadge');
const notifSearchInput  = document.getElementById('notifSearchInput');
const notifFilterBtns   = document.querySelectorAll('.notif-filter-btn');
const notifFilterInputs = document.getElementById('notifFilterInputs');
const notifPartyFilter  = document.getElementById('notifPartyFilter');
const notifDayFilter    = document.getElementById('notifDayFilter');
const notifMonthFilter  = document.getElementById('notifMonthFilter');
const notifRangeFrom    = document.getElementById('notifRangeFrom');
const notifRangeTo      = document.getElementById('notifRangeTo');
const toastContainer    = document.getElementById('toastContainer');

const LEAD_DAYS = APP_CONFIG.notificationLeadDays; // 4

// ─── Init ─────────────────────────────────────────────────────────────────────
function initNotifications() {
  loadDismissed();
  bindNotifEvents();
}

function loadDismissed() {
  try {
    dismissedIds = JSON.parse(localStorage.getItem('nf_dismissed_notifs') || '[]');
  } catch { dismissedIds = []; }
}

function saveDismissed() {
  try { localStorage.setItem('nf_dismissed_notifs', JSON.stringify(dismissedIds)); } catch {}
}

// ─── Called by records.js after data loads ────────────────────────────────────
function refreshNotifications(records) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Include records due within LEAD_DAYS (and overdue)
  allNotifications = records.filter(r => {
    if (!r.Due_Date) return false;
    const due = new Date(r.Due_Date);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    return diff <= LEAD_DAYS; // includes overdue (diff < 0)
  });

  // Active (non-dismissed)
  const active = allNotifications.filter(r => !dismissedIds.includes(r.SR_No));

  // Update badge
  updateBadge(active.length);

  // Show toasts for active (not yet shown this session)
  const shownKey = 'nf_toasts_shown_' + new Date().toDateString();
  let shownToasts = [];
  try { shownToasts = JSON.parse(sessionStorage.getItem(shownKey) || '[]'); } catch {}

  active.forEach(r => {
    if (!shownToasts.includes(r.SR_No)) {
      const days = daysBetween(r.Due_Date);
      showNotifToast(r, days);
      shownToasts.push(r.SR_No);
    }
  });
  try { sessionStorage.setItem(shownKey, JSON.stringify(shownToasts)); } catch {}

  // Refresh drawer list if open
  applyNotifFilter();
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function updateBadge(count) {
  if (!notifBadge) return;
  if (count > 0) {
    notifBadge.textContent = count > 99 ? '99+' : count;
    notifBadge.classList.add('show');
  } else {
    notifBadge.classList.remove('show');
  }
}

// ─── Toast Popup ──────────────────────────────────────────────────────────────
function showNotifToast(record, days) {
  if (!toastContainer) return;

  const label = days < 0 ? `Overdue by ${Math.abs(days)} day(s)!`
    : days === 0 ? 'Due TODAY!'
    : `Due in ${days} day(s)`;

  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.innerHTML = `
    <span class="material-icons toast-icon">fire_extinguisher</span>
    <div class="toast-content">
      <div class="toast-title">⚠️ Refilling Due — ${escapeHtml(record.Party_Name)}</div>
      <div class="toast-body">${label} &nbsp;|&nbsp; Due: ${formatDisplayDate(record.Due_Date)}<br/>Invoice: ${record.Invoice_No || '—'}</div>
    </div>
    <button class="toast-close" title="Dismiss"><span class="material-icons" style="font-size:18px">close</span></button>
    <div class="toast-progress"></div>`;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  toastContainer.appendChild(toast);

  // Auto-dismiss after 5 s
  const timer = setTimeout(() => dismissToast(toast), 5000);
  toast._timer = timer;
}

function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.classList.add('hiding');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function openNotifDrawer() {
  applyNotifFilter();
  if (notifDrawerOverlay) notifDrawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeNotifDrawer() {
  if (notifDrawerOverlay) notifDrawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function applyNotifFilter() {
  const active = allNotifications.filter(r => !dismissedIds.includes(r.SR_No));
  const q = (notifSearchInput?.value || '').trim().toLowerCase();

  let result = active;

  // Text search
  if (q) {
    result = result.filter(r => (r.Party_Name || '').toLowerCase().includes(q));
  }

  // Filter mode
  if (notifFilterMode === 'day' && notifDayFilter?.value) {
    result = result.filter(r => r.Due_Date === notifDayFilter.value);
  } else if (notifFilterMode === 'month' && notifMonthFilter?.value) {
    const [fy, fm] = notifMonthFilter.value.split('-');
    result = result.filter(r => {
      if (!r.Due_Date) return false;
      const d = new Date(r.Due_Date);
      return d.getFullYear() === parseInt(fy) && (d.getMonth() + 1) === parseInt(fm);
    });
  } else if (notifFilterMode === 'range' && notifRangeFrom?.value && notifRangeTo?.value) {
    const from = new Date(notifRangeFrom.value);
    const to   = new Date(notifRangeTo.value);
    result = result.filter(r => {
      if (!r.Due_Date) return false;
      const d = new Date(r.Due_Date);
      return d >= from && d <= to;
    });
  }

  filteredNotifs = result;
  renderNotifList(filteredNotifs);
  if (notifCountBadge) notifCountBadge.textContent = filteredNotifs.length;
}

// ─── Render List ──────────────────────────────────────────────────────────────
function renderNotifList(list) {
  if (!notifList) return;

  if (list.length === 0) {
    notifList.innerHTML = `
      <div class="notif-empty">
        <span class="material-icons">notifications_none</span>
        <p>No notifications found.</p>
      </div>`;
    return;
  }

  notifList.innerHTML = list.map(r => {
    const days  = daysBetween(r.Due_Date);
    const label = days < 0 ? `Overdue by ${Math.abs(days)} day(s)`
      : days === 0 ? 'Due TODAY'
      : `Due in ${days} day(s)`;

    return `
    <div class="notif-item" id="ni_${r.SR_No}">
      <div class="notif-item-icon"><span class="material-icons">fire_extinguisher</span></div>
      <div class="notif-item-content">
        <div class="notif-item-title">${escapeHtml(r.Party_Name)}</div>
        <div class="notif-item-body">Invoice: ${r.Invoice_No || '—'} &nbsp;|&nbsp; SR: ${r.SR_No}</div>
        <div class="notif-item-meta">Due Date: ${formatDisplayDate(r.Due_Date)}</div>
        <span class="notif-days-badge"><span class="material-icons" style="font-size:12px">schedule</span>${label}</span>
      </div>
      <button class="notif-item-delete" title="Dismiss notification" onclick="dismissNotification('${r.SR_No}')">
        <span class="material-icons">delete_outline</span>
      </button>
    </div>`;
  }).join('');
}

// ─── Dismiss Notification ─────────────────────────────────────────────────────
function dismissNotification(srNo) {
  dismissedIds.push(srNo);
  saveDismissed();

  // Animate out
  const el = document.getElementById(`ni_${srNo}`);
  if (el) {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 250);
  }

  const active = allNotifications.filter(r => !dismissedIds.includes(r.SR_No));
  updateBadge(active.length);
  if (notifCountBadge) notifCountBadge.textContent = (parseInt(notifCountBadge.textContent) - 1) || 0;

  // Show empty state if needed
  setTimeout(() => {
    const remaining = notifList.querySelectorAll('.notif-item');
    if (remaining.length === 0) {
      notifList.innerHTML = `<div class="notif-empty"><span class="material-icons">notifications_none</span><p>No notifications found.</p></div>`;
    }
  }, 300);
}

function clearAllNotifications() {
  allNotifications.forEach(r => { if (!dismissedIds.includes(r.SR_No)) dismissedIds.push(r.SR_No); });
  saveDismissed();
  updateBadge(0);
  applyNotifFilter();
}

// ─── Bind Events ──────────────────────────────────────────────────────────────
function bindNotifEvents() {
  if (notifBell) notifBell.addEventListener('click', openNotifDrawer);

  // Close overlay click
  if (notifDrawerOverlay) {
    notifDrawerOverlay.addEventListener('click', e => {
      if (e.target === notifDrawerOverlay) closeNotifDrawer();
    });
  }

  // Search
  if (notifSearchInput) notifSearchInput.addEventListener('input', applyNotifFilter);

  // Filter buttons
  notifFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      notifFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      notifFilterMode = btn.dataset.filter;
      updateNotifFilterInputs();
      applyNotifFilter();
    });
  });

  // Filter inputs change
  [notifDayFilter, notifMonthFilter, notifRangeFrom, notifRangeTo].forEach(el => {
    if (el) el.addEventListener('change', applyNotifFilter);
  });

  // Party name live filter
  if (notifPartyFilter) notifPartyFilter.addEventListener('input', applyNotifFilter);
}

function updateNotifFilterInputs() {
  if (!notifFilterInputs) return;

  if (notifFilterMode === 'all') {
    notifFilterInputs.classList.remove('show');
    return;
  }
  notifFilterInputs.classList.add('show');

  // Show/hide specific inputs
  ['notifDayWrap','notifMonthWrap','notifRangeWrap','notifPartyWrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const map = { day:'notifDayWrap', month:'notifMonthWrap', range:'notifRangeWrap', party:'notifPartyWrap' };
  const target = map[notifFilterMode];
  if (target) {
    const el = document.getElementById(target);
    if (el) el.style.display = 'flex';
  }
}

// ─── Global Exports ───────────────────────────────────────────────────────────
window.initNotifications    = initNotifications;
window.refreshNotifications = refreshNotifications;
window.openNotifDrawer      = openNotifDrawer;
window.closeNotifDrawer     = closeNotifDrawer;
window.dismissNotification  = dismissNotification;
window.clearAllNotifications= clearAllNotifications;
