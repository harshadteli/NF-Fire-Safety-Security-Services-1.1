/**
 * app.js — NF Fire Safety Security Services
 * App bootstrap, navigation, GAS API helpers, toast messages
 */

"use strict";

// ─── Navigation ───────────────────────────────────────────────────────────────
const navLinks   = document.querySelectorAll('.nav-link[data-section]');
const sections   = document.querySelectorAll('.page-section');
const mobileNav  = document.getElementById('mobileNav');
const hamburger  = document.getElementById('hamburger');
const mobileOverlay = document.getElementById('mobileOverlay');

function navigateTo(sectionId) {
  sections.forEach(s => s.classList.toggle('active', s.id === sectionId));
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));

  // Lazy-load reports data when entering reports section
  if (sectionId === 'reportsSection' && typeof loadReportsData === 'function') {
    loadReportsData();
  }
  closeMobileNav();
}

navLinks.forEach(link => {
  link.addEventListener('click', () => navigateTo(link.dataset.section));
});

// Mobile nav
if (hamburger) hamburger.addEventListener('click', () => {
  mobileNav?.classList.toggle('open');
  mobileOverlay?.classList.toggle('show');
});
if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileNav);
function closeMobileNav() {
  mobileNav?.classList.remove('open');
  mobileOverlay?.classList.remove('show');
}

// Mobile nav links
document.querySelectorAll('.mobile-nav-link').forEach(link => {
  link.addEventListener('click', () => navigateTo(link.dataset.section));
});

// ─── Live Date/Time in Navbar ─────────────────────────────────────────────────
function updateNavDate() {
  const el = document.getElementById('navDateDisplay');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  }) + '  ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
updateNavDate();
setInterval(updateNavDate, 30000);

// ─── Toast Messages (info/success/warning) ────────────────────────────────────
function showToastMsg(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const colors = {
    success: { bg: '#1e7e34', icon: 'check_circle' },
    warning: { bg: '#f57c00', icon: 'warning' },
    info:    { bg: '#1a73e8', icon: 'info' },
    error:   { bg: '#c62828', icon: 'error' },
  };
  const cfg = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.style.background = cfg.bg;
  toast.style.boxShadow  = `0 4px 16px ${cfg.bg}66`;
  toast.innerHTML = `
    <span class="material-icons toast-icon">${cfg.icon}</span>
    <div class="toast-content">
      <div class="toast-body">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" title="Close"><span class="material-icons" style="font-size:18px">close</span></button>`;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  });
  container.appendChild(toast);

  const t = setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 4000);
  toast._timer = t;
}
window.showToastMsg = showToastMsg;

// ─── DOM References ──────────────────────────────────────────────────────────
const pageLoader     = document.getElementById('pageLoader');
const offlineOverlay = document.getElementById('offlineOverlay');

// ─── Page Loader Helpers ──────────────────────────────────────────────────────
function showPageLoader(message = 'Connecting To Server Please wait...') {
  if (pageLoader) {
    const msgEl = pageLoader.querySelector('.loader-message');
    if (msgEl) msgEl.textContent = message;
    pageLoader.classList.add('show');
  }
}

function hidePageLoader() {
  if (pageLoader) {
    pageLoader.classList.remove('show');
  }
}

window.showPageLoader = showPageLoader;
window.hidePageLoader = hidePageLoader;

// ─── Network Status Monitoring ────────────────────────────────────────────────
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  if (!isOnline) {
    document.body.classList.add('is-offline');
    if (offlineOverlay) offlineOverlay.classList.add('show');
  } else {
    document.body.classList.remove('is-offline');
    if (offlineOverlay) offlineOverlay.classList.remove('show');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ─── GAS API Helpers ──────────────────────────────────────────────────────────
/**
 * GET request to GAS Web App.
 * @param {string} action  — GAS action param
 * @param {object} params  — optional extra query params
 */
async function apiGet(action, params = {}) {
  if (!GAS_URL || GAS_URL === 'YOUR_GAS_DEPLOY_URL_HERE') {
    throw new Error('GAS URL not configured');
  }
  
  showPageLoader();
  try {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data ?? json;
  } finally {
    hidePageLoader();
  }
}

/**
 * POST request to GAS Web App (via URL-encoded form to bypass CORS preflight).
 * @param {string} action
 * @param {object} payload
 */
async function apiPost(action, payload = {}) {
  if (!GAS_URL || GAS_URL === 'YOUR_GAS_DEPLOY_URL_HERE') {
    throw new Error('GAS URL not configured');
  }
  
  showPageLoader('Saving to Server Please wait...');
  try {
    const body = new URLSearchParams({ action, ...payload });
    const res  = await fetch(GAS_URL, {
      method: 'POST',
      body,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data ?? json;
  } finally {
    hidePageLoader();
  }
}

window.apiGet  = apiGet;
window.apiPost = apiPost;

// ─── Escape HTML Helper ───────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escapeHtml = escapeHtml;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Start on Records section
  navigateTo('recordsSection');

  // Check initial connection status
  updateOnlineStatus();

  // Init modules
  if (typeof initNotifications === 'function') initNotifications();
  if (typeof initRecords       === 'function') initRecords();
  if (typeof initReports       === 'function') initReports();
});
