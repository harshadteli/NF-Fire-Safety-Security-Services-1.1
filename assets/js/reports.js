/**
 * reports.js — NF Fire Safety Security Services
 * Report generation, filtering, CSV & PDF export
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
let reportData      = [];
let reportFilterMode= 'all';

// ─── DOM ──────────────────────────────────────────────────────────────────────
const reportTableBody    = document.getElementById('reportTableBody');
const reportCountEl      = document.getElementById('reportCount');
const reportMetaEl       = document.getElementById('reportMeta');
const reportFilterTabs   = document.querySelectorAll('.filter-tab');
const reportInputsArea   = document.getElementById('reportInputsArea');
const rPartyInput        = document.getElementById('rPartyInput');
const rDayInput          = document.getElementById('rDayInput');
const rMonthInput        = document.getElementById('rMonthInput');
const rRangeFrom         = document.getElementById('rRangeFrom');
const rRangeTo           = document.getElementById('rRangeTo');
const reportApplyBtn     = document.getElementById('reportApplyBtn');
const reportResetBtn     = document.getElementById('reportResetBtn');
const exportCsvBtn       = document.getElementById('exportCsvBtn');
const exportPdfBtn       = document.getElementById('exportPdfBtn');
const printArea          = document.getElementById('printArea');

// ─── Init ─────────────────────────────────────────────────────────────────────
function initReports() {
  bindReportEvents();
}

function loadReportsData() {
  reportData = getAllRecords ? getAllRecords() : [];
  reportFilterMode = 'all';
  applyReportFilter();
}

// ─── Bind Events ──────────────────────────────────────────────────────────────
function bindReportEvents() {
  // Filter tabs
  reportFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      reportFilterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      reportFilterMode = tab.dataset.filter;
      updateReportInputs();
    });
  });

  if (reportApplyBtn) reportApplyBtn.addEventListener('click', applyReportFilter);
  if (reportResetBtn) reportResetBtn.addEventListener('click', resetReportFilter);
  if (exportCsvBtn)   exportCsvBtn.addEventListener('click', exportCSV);
  if (exportPdfBtn)   exportPdfBtn.addEventListener('click', exportPDF);

  // Live filter for party name
  if (rPartyInput) rPartyInput.addEventListener('input', applyReportFilter);
}

function updateReportInputs() {
  if (!reportInputsArea) return;

  if (reportFilterMode === 'all') {
    reportInputsArea.classList.remove('show');
    applyReportFilter();
    return;
  }
  reportInputsArea.classList.add('show');

  ['rDayField','rMonthField','rRangeFields','rPartyField'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const map = { day:'rDayField', month:'rMonthField', range:'rRangeFields', party:'rPartyField' };
  const target = map[reportFilterMode];
  if (target) {
    const el = document.getElementById(target);
    if (el) el.style.display = 'flex';
  }
}

// ─── Apply Filter ─────────────────────────────────────────────────────────────
function applyReportFilter() {
  const records = getAllRecords ? getAllRecords() : [];
  let result    = [...records];
  let label     = 'All Records';

  if (reportFilterMode === 'party' && rPartyInput?.value.trim()) {
    const q = rPartyInput.value.trim().toLowerCase();
    result  = result.filter(r => (r.Party_Name || '').toLowerCase().includes(q));
    label   = `Party: "${rPartyInput.value.trim()}"`;
  } else if (reportFilterMode === 'day' && rDayInput?.value) {
    result = result.filter(r => r.Date === rDayInput.value);
    label  = `Day: ${formatDisplayDate(rDayInput.value)}`;
  } else if (reportFilterMode === 'month' && rMonthInput?.value) {
    const [fy, fm] = rMonthInput.value.split('-').map(Number);
    result = result.filter(r => {
      if (!r.Date) return false;
      const d = new Date(r.Date);
      return d.getFullYear() === fy && (d.getMonth() + 1) === fm;
    });
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    label = `Month: ${monthNames[fm - 1]} ${fy}`;
  } else if (reportFilterMode === 'range' && rRangeFrom?.value && rRangeTo?.value) {
    const from = new Date(rRangeFrom.value);
    const to   = new Date(rRangeTo.value);
    result = result.filter(r => {
      if (!r.Date) return false;
      const d = new Date(r.Date);
      return d >= from && d <= to;
    });
    label = `Range: ${formatDisplayDate(rRangeFrom.value)} – ${formatDisplayDate(rRangeTo.value)}`;
  }

  reportData = result;
  renderReportTable(result);
  if (reportCountEl) reportCountEl.textContent = result.length + ' record(s)';
  if (reportMetaEl)  reportMetaEl.textContent  = label;
}

function resetReportFilter() {
  reportFilterMode = 'all';
  reportFilterTabs.forEach(t => t.classList.remove('active'));
  const allTab = document.querySelector('.filter-tab[data-filter="all"]');
  if (allTab) allTab.classList.add('active');
  if (reportInputsArea) reportInputsArea.classList.remove('show');
  [rPartyInput, rDayInput, rMonthInput, rRangeFrom, rRangeTo].forEach(el => { if (el) el.value = ''; });
  applyReportFilter();
}

// ─── Render Report Table ──────────────────────────────────────────────────────
function renderReportTable(records) {
  if (!reportTableBody) return;

  if (records.length === 0) {
    reportTableBody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <span class="material-icons">analytics</span>
          <p>No records match the selected filter.</p>
        </div>
      </td></tr>`;
    return;
  }

  reportTableBody.innerHTML = records.map((r, i) => `
    <tr>
      <td><span class="sr-badge">${r.SR_No || i + 1}</span></td>
      <td>${r.Invoice_No || '—'}</td>
      <td>${formatDisplayDate(r.Date)}</td>
      <td style="font-weight:500">${r.Party_Name || '—'}</td>
      <td>${formatDisplayDate(r.Refilling_Date)}</td>
      <td>${formatDisplayDate(r.Due_Date)}</td>
      <td style="font-size:12px;max-width:160px;white-space:normal">${r.Note || '—'}</td>
    </tr>`).join('');
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV() {
  if (!reportData || reportData.length === 0) {
    alert('No data to export.');
    return;
  }

  const headers = ['SR No','Invoice No','Date','Party Name','Refilling Date','Due Date','Note'];
  const rows = reportData.map(r => [
    `"${r.SR_No || ''}"`,
    `"${r.Invoice_No || ''}"`,
    `"${r.Date || ''}"`,
    `"${(r.Party_Name || '').replace(/"/g, '""')}"`,
    `"${r.Refilling_Date || ''}"`,
    `"${r.Due_Date || ''}"`,
    `"${(r.Note || '').replace(/"/g, '""')}"`,
  ].join(','));

  const now = new Date();
  const headerLine = `# NF Fire Safety Security Services — Export: ${reportMetaEl?.textContent || 'All Records'} — Generated: ${now.toLocaleDateString('en-IN')}`;
  const csv = [headerLine, headers.join(','), ...rows].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = `${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
  a.href     = url;
  a.download = `NF_Fire_Report_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF Export (Crystal-Report Style Print) ──────────────────────────────────
function exportPDF() {
  if (!reportData || reportData.length === 0) {
    alert('No data to export.');
    return;
  }

  const now     = new Date();
  const months  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const period  = reportMetaEl?.textContent || 'All Records';

  // Determine period string for header
  let periodLine = period;
  if (reportFilterMode === 'month' && rMonthInput?.value) {
    const [fy, fm] = rMonthInput.value.split('-').map(Number);
    periodLine = `${months[fm - 1]} ${fy}`;
  }

  const tableRows = reportData.map((r, i) => `
    <tr>
      <td>${r.SR_No || i + 1}</td>
      <td>${r.Invoice_No || '—'}</td>
      <td>${formatDisplayDate(r.Date)}</td>
      <td><strong>${r.Party_Name || '—'}</strong></td>
      <td>${formatDisplayDate(r.Refilling_Date)}</td>
      <td>${formatDisplayDate(r.Due_Date)}</td>
      <td>${r.Note || '—'}</td>
    </tr>`).join('');

  const printContent = `
    <div class="pdf-header">
      <div class="pdf-company-name">NF FIRE SAFETY SECURITY SERVICES</div>
      <div class="pdf-company-sub">Fire Extinguisher Refilling Management System</div>
      <div class="pdf-report-title">REFILLING RECORDS REPORT</div>
      <div class="pdf-period">${periodLine}</div>
      <div class="pdf-generated">Generated: ${now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })} &nbsp;|&nbsp; Total Records: ${reportData.length}</div>
    </div>
    <table class="pdf-table">
      <thead>
        <tr>
          <th>SR No</th><th>Invoice No</th><th>Date</th>
          <th>Party Name</th><th>Refilling Date</th><th>Due Date</th><th>Note</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="pdf-footer">
      <span>NF Fire Safety Security Services — Confidential</span>
      <span class="pdf-footer-total">Total: ${reportData.length} Record(s)</span>
      <span>${now.toLocaleDateString('en-IN')}</span>
    </div>`;

  if (printArea) {
    printArea.innerHTML = printContent;
    printArea.style.display = 'block';
    setTimeout(() => {
      window.print();
      setTimeout(() => { printArea.style.display = 'none'; }, 1000);
    }, 200);
  }
}

// ─── Global ───────────────────────────────────────────────────────────────────
window.initReports      = initReports;
window.loadReportsData  = loadReportsData;
