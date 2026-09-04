/**
 * ==============================================================================
 * WAREHOUSE LOCATION MANAGER - APPLICATION CONTROLLER (location-app.js)
 * ==============================================================================
 * Master application controller for Racks (strictly numeric, e.g. Rack 1, Rack 2),
 * Pallets (3 Pallets per Rack default: Pallet 1, 2, 3), Barcode / QR Scanning Station,
 * Batch Storage Assignment, and Dispatch Management.
 * Zero dummy data, pure live database.
 * ==============================================================================
 */

// Global UI state
let activeLocTab = 'explorer';
let expandedPalletIds = new Set();
let collapsedRackIds = new Set();
let currentScannedTag = null;
let scanSessionHistory = [];
let selectedBatchTagIds = new Set();
let selectedDispatchTagIds = new Set();
let selectedAuditTagIds = new Set();
let explorerPage = 1;
let explorerPageSize = (function() {
  const saved = localStorage.getItem('loc_explorer_page_size');
  if (saved === 'ALL') return 'ALL';
  const num = parseInt(saved, 10);
  return [10, 20, 30, 50].includes(num) ? num : 20;
})();

let auditCurrentPage = 1;
const auditPageSize = 100;
let auditSortCol = 'assignedAt';
let auditSortDir = 'desc';

let batchSortCol = 'tagId';
let batchSortDir = 'asc';
let dispatchSortCol = 'assignedAt';
let dispatchSortDir = 'desc';
let historySortCol = 'timestamp';
let historySortDir = 'desc';
let sessionSortCol = 'time';
let sessionSortDir = 'desc';
let setupSortCol = 'name';
let setupSortDir = 'asc';

// Audio Context for Barcode Scanner Sound Feedback
let audioCtx = null;

function playBeep(freq = 880, durationMs = 120, type = 'sine') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (durationMs / 1000));
    
    osc.start();
    osc.stop(audioCtx.currentTime + (durationMs / 1000));
  } catch (e) {}
}

function playSuccessBeep() {
  playBeep(987, 80);
  setTimeout(() => playBeep(1318, 120), 90);
}

function playWarningBeep() {
  playBeep(330, 200, 'square');
}

/**
 * Natural numeric sorting for Racks (e.g. Rack 1, Rack 2, Rack 3, Rack 10)
 */
function getSortedRacks() {
  return [...(locAppState.racks || [])].sort((a, b) => {
    const numA = parseInt((a.name || a.id || '').replace(/\D+/g, ''), 10) || 0;
    const numB = parseInt((b.name || b.id || '').replace(/\D+/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
  });
}

/**
 * Natural numeric sorting for Pallets (Pallet 1, Pallet 2, Pallet 3)
 */
function getSortedPallets(rackId = null) {
  const list = rackId 
    ? (locAppState.pallets || []).filter(p => p.rackId === rackId)
    : (locAppState.pallets || []);

  return [...list].sort((a, b) => {
    const numA = parseInt((a.name || a.id || '').replace(/\D+/g, ''), 10) || 0;
    const numB = parseInt((b.name || b.id || '').replace(/\D+/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
  });
}

/**
 * Switch top-level navigation tabs
 */
function switchLocationTab(tabName) {
  const validTabs = ['explorer', 'scan', 'assign', 'dispatch', 'setup', 'audit'];
  activeLocTab = validTabs.includes(tabName) ? tabName : 'explorer';

  validTabs.forEach(t => {
    const sec = document.getElementById(`loc-view-${t}`);
    if (sec) sec.classList.toggle('hidden', t !== activeLocTab);

    const navBtn = document.getElementById(`loc-nav-${t}`);
    if (navBtn) {
      if (t === activeLocTab) {
        navBtn.className = "loc-nav-item px-3.5 py-2 text-xs font-extrabold rounded-xl bg-amber-500 text-slate-950 shadow-xs transition flex items-center gap-2 cursor-pointer";
      } else {
        navBtn.className = "loc-nav-item px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer";
      }
    }
  });

  const titles = {
    'explorer': '🏢 Floor & Pallet Explorer',
    'scan': '⚡ Quick Scan & Assign Station',
    'assign': '📦 Batch Assign to Location',
    'dispatch': '🚀 Dispatch from Storage',
    'setup': '⚙️ Master Rack & Pallet Setup',
    'audit': '🔍 Inventory Search & Audit'
  };

  const breadcrumb = document.getElementById('loc-breadcrumb-title');
  if (breadcrumb) breadcrumb.textContent = titles[activeLocTab] || 'Location Manager';

  if (activeLocTab === 'scan') {
    setTimeout(() => {
      const input = document.getElementById('loc-scan-input');
      if (input) input.focus();
    }, 100);
  }

  renderAllLocationUI();
}

/**
 * Renders all views and metrics
 */
function renderAllLocationUI() {
  renderLocationMetrics();
  populateLocationDropdowns();
  
  if (activeLocTab === 'explorer') {
    renderFloorExplorer();
  } else if (activeLocTab === 'scan') {
    renderScanStation();
  } else if (activeLocTab === 'assign') {
    renderBatchAssignTable();
  } else if (activeLocTab === 'dispatch') {
    renderDispatchTable();
  } else if (activeLocTab === 'setup') {
    renderMasterSetupTable();
  } else if (activeLocTab === 'audit') {
    renderAuditTable();
  }
}

/**
 * Metric KPI Summary Cards
 */
function renderLocationMetrics() {
  const racks = locAppState.racks || [];
  const pallets = locAppState.pallets || [];
  const bundleLocs = locAppState.bundleLocations || [];

  const storedBundles = bundleLocs.filter(b => b.status === 'STORED');
  const dispatchedBundles = bundleLocs.filter(b => b.status === 'DISPATCHED');

  const totalCap = pallets.reduce((sum, p) => sum + (parseInt(p.capacity, 10) || 50), 0);
  const utilPercent = totalCap > 0 ? Math.min(100, Math.round((storedBundles.length / totalCap) * 100)) : 0;
  const zones = new Set(racks.map(r => r.zone).filter(Boolean));

  const elRacks = document.getElementById('metric-racks');
  const elZones = document.getElementById('metric-zones');
  const elPallets = document.getElementById('metric-pallets');
  const elCap = document.getElementById('metric-capacity');
  const elStored = document.getElementById('metric-stored');
  const elDisp = document.getElementById('metric-dispatched');
  const elUtil = document.getElementById('metric-utilization');
  const elProg = document.getElementById('metric-progress');

  if (elRacks) elRacks.textContent = racks.length;
  if (elZones) elZones.textContent = `${zones.size} Active Zone${zones.size === 1 ? '' : 's'}`;
  if (elPallets) elPallets.textContent = pallets.length;
  if (elCap) elCap.textContent = `Max ${totalCap.toLocaleString()} Bundles`;
  if (elStored) elStored.textContent = storedBundles.length.toLocaleString();
  if (elDisp) elDisp.textContent = `${dispatchedBundles.length.toLocaleString()} Dispatched`;
  if (elUtil) elUtil.textContent = `${utilPercent}%`;
  
  if (elProg) {
    elProg.style.width = `${utilPercent}%`;
    if (utilPercent > 85) elProg.className = "bg-rose-500 h-full transition-all duration-300";
    else if (utilPercent > 60) elProg.className = "bg-amber-500 h-full transition-all duration-300";
    else elProg.className = "bg-emerald-500 h-full transition-all duration-300";
  }
}

/**
 * Populates all Rack and Pallet dropdowns across the application (strictly numeric sorted)
 */
function populateLocationDropdowns(preferredRackId) {
  const racks = getSortedRacks();

  // Explorer filter
  const expRack = document.getElementById('loc-explorer-rack-filter');
  if (expRack) {
    const cur = expRack.value || 'ALL';
    let html = '<option value="ALL">🏢 All Storage Racks</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Cutting Floor')})</option>`;
    });
    expRack.innerHTML = html;
    if (cur && (cur === 'ALL' || racks.some(r => r.id === cur))) expRack.value = cur;
  }

  // Quick Scan Rack
  const scanRack = document.getElementById('loc-scan-target-rack');
  if (scanRack) {
    const cur = preferredRackId || scanRack.value || (racks[0] ? racks[0].id : '');
    let html = '<option value="">-- Choose Rack Number --</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Cutting Floor')})</option>`;
    });
    scanRack.innerHTML = html;
    if (cur && racks.some(r => r.id === cur)) scanRack.value = cur;
    onScanRackChanged(scanRack.value);
  }

  // Batch Assign Rack
  const batchRack = document.getElementById('loc-batch-target-rack');
  if (batchRack) {
    const cur = preferredRackId || batchRack.value || (racks[0] ? racks[0].id : '');
    let html = '<option value="">-- Choose Rack --</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    batchRack.innerHTML = html;
    if (cur && racks.some(r => r.id === cur)) batchRack.value = cur;
    onBatchRackChanged(batchRack.value);
  }

  // Setup Pallet Form Rack
  const setupRack = document.getElementById('pallet-form-rack');
  if (setupRack) {
    const cur = preferredRackId || setupRack.value;
    let html = '<option value="">-- Select Parent Rack --</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Cutting Floor')})</option>`;
    });
    setupRack.innerHTML = html;
    if (cur && racks.some(r => r.id === cur)) setupRack.value = cur;
    else if (racks.length > 0) setupRack.value = racks[0].id;
  }

  // Print Filter Rack
  const printRack = document.getElementById('loc-print-filter-rack');
  if (printRack) {
    const cur = printRack.value || 'ALL';
    let html = '<option value="ALL">All Racks & Pallets</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    printRack.innerHTML = html;
    printRack.value = cur;
  }

  // Audit Filter Rack
  const auditRack = document.getElementById('loc-audit-rack-filter');
  if (auditRack) {
    const cur = auditRack.value || 'ALL';
    let html = '<option value="ALL">All Storage Racks</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    auditRack.innerHTML = html;
    auditRack.value = cur;
  }

  populateLocationBatchDropdowns();
}

/**
 * Populates batch source dropdowns for Batch Assign & Dispatch
 */
function populateLocationBatchDropdowns() {
  const batchSource = document.getElementById('loc-batch-source-select');
  const storedTagIds = new Set((locAppState.bundleLocations || []).filter(b => b.status === 'STORED').map(b => b.tagId));
  const batches = locAppState.batches || [];

  if (batchSource) {
    const cur = batchSource.value;
    let html = '';
    
    const allKnownTags = locAppState.tags || [];
    const unassignedCount = allKnownTags.filter(t => !storedTagIds.has(t.tagId || t.id)).length;

    html += `<option value="ALL_UNASSIGNED">📦 All Unassigned Bundles (${unassignedCount} available)</option>`;
    html += `<option value="ALL_TAGS">🌐 All Bundles Combined (${allKnownTags.length} total)</option>`;

    batches.forEach(b => {
      const bId = b.batchId || b.id;
      const bTags = (locAppState.tags || []).filter(t => (t.batchId || t.batchTagString) === bId);
      const bUnassigned = bTags.filter(t => !storedTagIds.has(t.tagId || t.id)).length;
      html += `<option value="${bId}">🏷️ ${escapeHtml(bId)} [${escapeHtml(b.style || '')}] ${escapeHtml(b.color || '')} (${bUnassigned} unassigned / ${bTags.length} tags)</option>`;
    });

    batchSource.innerHTML = html;
    if (cur && batchSource.querySelector(`option[value="${cur}"]`)) batchSource.value = cur;
    else batchSource.value = 'ALL_UNASSIGNED';
  }

  // Dispatch Source Dropdown
  const dispSource = document.getElementById('loc-dispatch-source-select');
  if (dispSource) {
    const cur = dispSource.value;
    const storedList = (locAppState.bundleLocations || []).filter(b => b.status === 'STORED');
    let html = `<option value="ALL_STORED">📦 All Stored Bundles (${storedList.length} in warehouse)</option>`;

    const batchStored = {};
    storedList.forEach(b => {
      const bId = b.batchId || 'UNKNOWN';
      batchStored[bId] = (batchStored[bId] || 0) + 1;
    });

    batches.forEach(b => {
      const bId = b.batchId || b.id;
      const cnt = batchStored[bId] || 0;
      if (cnt > 0) {
        html += `<option value="${bId}">🏷️ ${escapeHtml(bId)} [${escapeHtml(b.style || '')}] (${cnt} stored)</option>`;
      }
    });

    dispSource.innerHTML = html;
    if (cur && dispSource.querySelector(`option[value="${cur}"]`)) dispSource.value = cur;
    else dispSource.value = 'ALL_STORED';
  }
}

/**
 * Handle Rack change in Quick Scan Station -> Update 3 Pallets Quick Select Buttons & Dropdown
 */
function onScanRackChanged(rackId) {
  const palletSelect = document.getElementById('loc-scan-target-pallet');
  const palletButtonsContainer = document.getElementById('loc-scan-quick-pallets-bar');
  const pallets = getSortedPallets(rackId);

  if (palletSelect) {
    const prevPalletVal = palletSelect.value;
    let html = '<option value="">-- Select Pallet --</option>';
    pallets.forEach(p => {
      const count = (locAppState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
      html += `<option value="${p.id}">${escapeHtml(p.name)} (${count}/${p.capacity})</option>`;
    });
    palletSelect.innerHTML = html;
    if (prevPalletVal && pallets.some(p => p.id === prevPalletVal)) {
      palletSelect.value = prevPalletVal;
    } else if (pallets.length > 0) {
      palletSelect.value = pallets[0].id;
    }
  }

  // Render 3 PALLETS quick-selection buttons (1, 2, 3)
  if (palletButtonsContainer) {
    if (pallets.length === 0) {
      palletButtonsContainer.innerHTML = `<span class="text-xs text-slate-400 italic">No pallets configured under this rack.</span>`;
    } else {
      palletButtonsContainer.innerHTML = pallets.map((p, idx) => {
        const count = (locAppState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
        const isSelected = palletSelect && palletSelect.value === p.id;
        return `
          <button type="button" onclick="selectQuickScanPallet('${p.id}')" id="btn-quick-pal-${p.id}"
            class="px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 border shadow-2xs ${
              isSelected 
                ? 'bg-amber-500 text-slate-950 border-amber-500 ring-2 ring-amber-400/40 font-black' 
                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }">
            <span class="w-5 h-5 rounded-md bg-black/10 dark:bg-white/10 flex items-center justify-center font-mono text-[10px] font-black">${idx + 1}</span>
            <span>${escapeHtml(p.name)}</span>
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 ${count >= p.capacity ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}">${count}/${p.capacity}</span>
          </button>
        `;
      }).join('');
    }
  }
}

function selectQuickScanPallet(palletId) {
  const palletSelect = document.getElementById('loc-scan-target-pallet');
  if (palletSelect) {
    palletSelect.value = palletId;
    const rackId = document.getElementById('loc-scan-target-rack')?.value;
    onScanRackChanged(rackId);
  }
}

function onBatchRackChanged(rackId) {
  const palletSelect = document.getElementById('loc-batch-target-pallet');
  if (!palletSelect) return;
  const prevPalletVal = palletSelect.value;
  const pallets = getSortedPallets(rackId);
  let html = '<option value="">-- Choose Pallet --</option>';
  pallets.forEach(p => {
    const count = (locAppState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
    html += `<option value="${p.id}">${escapeHtml(p.name)} (${count}/${p.capacity})</option>`;
  });
  palletSelect.innerHTML = html;
  if (prevPalletVal && pallets.some(p => p.id === prevPalletVal)) {
    palletSelect.value = prevPalletVal;
  } else if (pallets.length > 0) {
    palletSelect.value = pallets[0].id;
  }
}

let selectedZoneFilter = 'ALL';

function filterByZone(zone) {
  selectedZoneFilter = zone;
  // Update active styling on zone pills
  document.querySelectorAll('.loc-zone-pill').forEach(btn => {
    const isTarget = btn.getAttribute('data-zone') === zone;
    if (isTarget) {
      btn.className = 'loc-zone-pill px-3 py-1 text-xs font-black rounded-lg bg-amber-500 text-slate-950 shadow-2xs cursor-pointer transition';
    } else {
      btn.className = 'loc-zone-pill px-3 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition';
    }
  });
  explorerPage = 1;
  renderFloorExplorer();
}

function clearExplorerSearch() {
  const inp = document.getElementById('loc-explorer-search');
  if (inp) {
    inp.value = '';
    inp.focus();
    renderFloorExplorer();
  }
}

function playScanBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {}
}

function changeExplorerPageSize(sizeVal) {
  explorerPageSize = sizeVal === 'ALL' ? 'ALL' : (parseInt(sizeVal, 10) || 20);
  try {
    localStorage.setItem('loc_explorer_page_size', String(explorerPageSize));
  } catch(e) {}
  explorerPage = 1;
  renderFloorExplorer();
}

function setExplorerPage(page) {
  explorerPage = page;
  renderFloorExplorer();
  const scrollContainer = document.getElementById('loc-main-scroll-container');
  if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * ==============================================================================
 * 1. FLOOR & PALLET EXPLORER (3 Pallets per Rack Visualization)
 * ==============================================================================
 */
function renderFloorExplorer() {
  const container = document.getElementById('loc-explorer-grid');
  const pagTop = document.getElementById('loc-explorer-pagination-top');
  const pagBottom = document.getElementById('loc-explorer-pagination-bottom');
  if (!container) return;

  // Sync page size select dropdown if rendered
  const pageSizeSel = document.getElementById('loc-explorer-page-size');
  if (pageSizeSel && pageSizeSel.value !== String(explorerPageSize)) {
    pageSizeSel.value = String(explorerPageSize);
  }

  const filterRackId = document.getElementById('loc-explorer-rack-filter')?.value || 'ALL';
  const searchQ = (document.getElementById('loc-explorer-search')?.value || '').toLowerCase().trim();

  const allRacks = getSortedRacks();
  const allPallets = locAppState.pallets || [];
  const allBundles = locAppState.bundleLocations || [];

  let filteredRacks = (filterRackId === 'ALL') ? allRacks : allRacks.filter(r => r.id === filterRackId);

  // Apply Zone Filter
  if (selectedZoneFilter !== 'ALL') {
    filteredRacks = filteredRacks.filter(r => (r.zone || '').includes(selectedZoneFilter));
  }

  if (searchQ) {
    filteredRacks = filteredRacks.filter(r => {
      if (r.name.toLowerCase().includes(searchQ) || (r.zone || '').toLowerCase().includes(searchQ)) return true;
      const rackPallets = allPallets.filter(p => p.rackId === r.id);
      if (rackPallets.some(p => p.name.toLowerCase().includes(searchQ))) return true;
      return allBundles.some(b => b.rackId === r.id && b.status === 'STORED' && (
        (b.tagId || '').toLowerCase().includes(searchQ) ||
        (b.style || '').toLowerCase().includes(searchQ) ||
        (b.color || '').toLowerCase().includes(searchQ) ||
        (b.size || '').toLowerCase().includes(searchQ)
      ));
    });
  }

  if (filteredRacks.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-400">
        <div class="text-4xl mb-2">🏢</div>
        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300">No Storage Racks Configured</h4>
        <p class="text-xs text-slate-400 mt-1">Go to <strong>Master Rack Setup</strong> to add storage racks (Rack 1, Rack 2, etc. with 3 pallets each).</p>
      </div>
    `;
    if (pagTop) pagTop.innerHTML = '';
    if (pagBottom) pagBottom.innerHTML = '';
    return;
  }

  // Calculate Pagination
  const totalRacks = filteredRacks.length;
  let pagedRacks = filteredRacks;
  let totalPages = 1;
  let startIdx = 0;
  let endIdx = totalRacks;

  if (explorerPageSize !== 'ALL') {
    const pSize = parseInt(explorerPageSize, 10) || 20;
    totalPages = Math.ceil(totalRacks / pSize) || 1;
    if (explorerPage > totalPages) explorerPage = totalPages;
    if (explorerPage < 1) explorerPage = 1;

    startIdx = (explorerPage - 1) * pSize;
    endIdx = Math.min(startIdx + pSize, totalRacks);
    pagedRacks = filteredRacks.slice(startIdx, endIdx);
  }

  // Helper to render pagination controls
  function buildExplorerPaginationHTML() {
    if (explorerPageSize === 'ALL' || totalPages <= 1) {
      return `
        <div class="text-xs font-bold text-slate-500 dark:text-slate-400">
          Showing <strong>${totalRacks}</strong> total racks
        </div>
      `;
    }

    const prevDisabled = explorerPage <= 1 
      ? 'disabled class="opacity-40 cursor-not-allowed px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400"' 
      : `onclick="setExplorerPage(${explorerPage - 1})" class="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer text-slate-700 dark:text-slate-300"`;

    const nextDisabled = explorerPage >= totalPages 
      ? 'disabled class="opacity-40 cursor-not-allowed px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400"' 
      : `onclick="setExplorerPage(${explorerPage + 1})" class="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer text-slate-700 dark:text-slate-300"`;

    let pageButtons = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - explorerPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 || p === totalPages - 1) pageButtons += `<span class="px-1 text-xs text-slate-400">...</span>`;
        continue;
      }
      const isActive = p === explorerPage;
      pageButtons += `
        <button onclick="setExplorerPage(${p})" class="w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
          isActive 
            ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/50 font-black' 
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
        }">${p}</button>
      `;
    }

    return `
      <div class="text-xs font-bold text-slate-600 dark:text-slate-400">
        Showing Racks <strong class="text-slate-900 dark:text-slate-100">${startIdx + 1}–${endIdx}</strong> of <strong class="text-slate-900 dark:text-slate-100">${totalRacks}</strong>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button ${prevDisabled}>◀ Prev</button>
        <div class="flex items-center gap-1">${pageButtons}</div>
        <button ${nextDisabled}>Next ▶</button>
      </div>
    `;
  }

  if (pagTop) pagTop.innerHTML = buildExplorerPaginationHTML();
  if (pagBottom) pagBottom.innerHTML = buildExplorerPaginationHTML();

  container.innerHTML = pagedRacks.map(rack => {
    const rackPallets = getSortedPallets(rack.id);
    const rackBundles = allBundles.filter(b => b.rackId === rack.id && b.status === 'STORED');
    const isCollapsed = collapsedRackIds.has(rack.id) && searchQ.length === 0;

    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 space-y-3.5 transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <!-- Rack Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-3 cursor-pointer" onclick="toggleRackAccordion('${rack.id}')">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg border border-blue-200 dark:border-blue-800 shrink-0 shadow-2xs">
              🏢
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">${escapeHtml(rack.name)}</h3>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700">${escapeHtml(rack.id)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900">${rackPallets.length} Pallets</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${escapeHtml(rack.zone || 'Cutting Floor')}</span>
              </div>
              <p class="text-[11px] text-slate-400 font-medium mt-0.5">${escapeHtml(rack.description || '3-Pallet Standard Storage')}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-black text-slate-800 dark:text-slate-200 px-3 py-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              ${rackBundles.length} Bundles Stored
            </span>
            <button onclick="openEditRackModal('${rack.id}')" title="Edit Rack" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">✏️</button>
            <button onclick="deleteRack('${rack.id}')" title="Delete Rack" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">🗑️</button>
            <button onclick="toggleRackAccordion('${rack.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer">
              ${isCollapsed ? '▼ Expand' : '▲ Collapse'}
            </button>
          </div>
        </div>

        <!-- 3 Pallets Grid -->
        ${!isCollapsed ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${rackPallets.map((pal, pIdx) => {
              const palBundles = allBundles.filter(b => b.palletId === pal.id && b.status === 'STORED');
              const cap = parseInt(pal.capacity, 10) || 50;
              const fillPct = Math.min(100, Math.round((palBundles.length / cap) * 100));
              const isExpanded = expandedPalletIds.has(pal.id) || searchQ.length > 0;

              let tierIcon = "🔽";
              let tierName = "Tier 1 (Bottom)";
              let tierBadge = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
              if (pIdx === 1) {
                tierIcon = "⏸️";
                tierName = "Tier 2 (Middle)";
                tierBadge = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
              } else if (pIdx === 2) {
                tierIcon = "🔼";
                tierName = "Tier 3 (Top)";
                tierBadge = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
              }

              let barColor = "bg-emerald-500";
              if (fillPct > 85) barColor = "bg-rose-500";
              else if (fillPct > 60) barColor = "bg-amber-500";

              return `
                <div class="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800/90 rounded-xl p-3.5 space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg ${tierBadge} font-black text-xs flex items-center justify-center font-mono shrink-0 shadow-2xs">
                        ${pIdx + 1}
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5">
                          <h4 class="text-xs font-black text-slate-900 dark:text-slate-100">${escapeHtml(pal.name)}</h4>
                          <span class="text-[10px] font-bold text-slate-400 font-mono">${tierIcon}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate max-w-[130px]">${escapeHtml(pal.description || tierName)}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <button onclick="openEditPalletModal('${pal.id}')" title="Edit Pallet" class="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer">✏️</button>
                    </div>
                  </div>

                  <!-- Capacity Progress Bar -->
                  <div>
                    <div class="flex items-center justify-between text-[10px] font-bold mb-1">
                      <span class="text-slate-500 dark:text-slate-400">Capacity: <strong>${palBundles.length}</strong> / ${cap}</span>
                      <span class="font-mono text-slate-700 dark:text-slate-300">${fillPct}%</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div class="${barColor} h-full transition-all duration-300" style="width: ${fillPct}%"></div>
                    </div>
                  </div>

                  <!-- Pallet Actions Bar -->
                  <div class="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800/70">
                    <button type="button" onclick="togglePalletAccordion('${pal.id}')"
                      class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                      <span>${isExpanded ? '▲ Hide Bundles' : `▼ View (${palBundles.length})`}</span>
                    </button>
                    ${palBundles.length > 0 ? `
                      <button type="button" onclick='openDispatchModalForPallet(${JSON.stringify(palBundles.map(b => b.tagId))})'
                        class="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg cursor-pointer transition shadow-2xs">
                        🚀 Dispatch (${palBundles.length})
                      </button>
                    ` : ''}
                  </div>

                  <!-- Collapsible Stored Bundles List -->
                  ${isExpanded ? `
                    <div class="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                      ${palBundles.length === 0 ? `
                        <p class="text-[10px] text-slate-400 text-center py-2 italic">Pallet is empty</p>
                      ` : palBundles.map(raw => {
                        const b = getEnrichedBundle(raw);
                        const isEmb = (b.embellishmentStyle || '').toLowerCase() === 'yes';
                        return `
                          <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition shadow-2xs">
                            <div class="min-w-0 flex-1 space-y-1">
                              <div class="flex items-center gap-1.5 flex-wrap">
                                <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="font-mono font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" title="View Full Specs">
                                  ${escapeHtml(b.tagId)}
                                </button>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">#${escapeHtml(b.bundleSeq)}</span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Shade ${escapeHtml(b.shade)}</span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
                                  EMB: ${isEmb ? 'YES' : 'NO'}
                                </span>
                              </div>
                              <div class="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold truncate">
                                <span>${escapeHtml(b.style)}</span>
                                <span class="text-slate-400">•</span>
                                <span class="text-slate-600 dark:text-slate-300">${escapeHtml(b.color)}</span>
                                <span class="text-slate-400">•</span>
                                <span class="text-blue-600 dark:text-blue-400">${escapeHtml(b.size)} (${escapeHtml(b.part)})</span>
                              </div>
                              <div class="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                <span>PO: ${escapeHtml(b.schedule || b.po || '—')}</span>
                                <span>Job: ${escapeHtml(b.layJobNo || '—')}</span>
                                <span>Dkt: ${escapeHtml(b.docketNo || '—')}</span>
                                <span>Ply: ${escapeHtml(b.plyRange || '—')}</span>
                              </div>
                            </div>
                            <div class="flex items-center gap-1 shrink-0 self-end sm:self-center">
                              <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded cursor-pointer transition">Specs</button>
                              <button type="button" onclick="openMoveModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded cursor-pointer transition">Move</button>
                              <button type="button" onclick="openDispatchModalSingle('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded cursor-pointer transition">Dispatch</button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function toggleRackAccordion(rId) {
  if (collapsedRackIds.has(rId)) collapsedRackIds.delete(rId);
  else collapsedRackIds.add(rId);
  renderFloorExplorer();
}

function expandAllRacks() {
  collapsedRackIds.clear();
  renderFloorExplorer();
}

function collapseAllRacks() {
  (locAppState.racks || []).forEach(r => collapsedRackIds.add(r.id));
  renderFloorExplorer();
}

function togglePalletAccordion(pId) {
  if (expandedPalletIds.has(pId)) expandedPalletIds.delete(pId);
  else expandedPalletIds.add(pId);
  renderFloorExplorer();
}

/**
 * ==============================================================================
 * 2. QUICK SCAN & ASSIGN STATION (With Instant 3-Pallet Buttons)
 * ==============================================================================
 */
function handleScanInputKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    processScannedTagInput();
  } else if (e.key === '1' && e.ctrlKey) {
    e.preventDefault();
    quickAssignToPalletIndex(0);
  } else if (e.key === '2' && e.ctrlKey) {
    e.preventDefault();
    quickAssignToPalletIndex(1);
  } else if (e.key === '3' && e.ctrlKey) {
    e.preventDefault();
    quickAssignToPalletIndex(2);
  }
}

function processScannedTagInput() {
  const input = document.getElementById('loc-scan-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const tagId = extractTagIdFromScan(raw);
  const tagObj = findTagInDatabase(tagId);

  const previewCard = document.getElementById('loc-scan-preview-card');
  const targetRackId = document.getElementById('loc-scan-target-rack')?.value;
  const targetPalletId = document.getElementById('loc-scan-target-pallet')?.value;

  if (!tagObj) {
    playWarningBeep();
    showLocToast(`⚠️ Tag "${tagId}" not found in database!`, "warning");
    if (previewCard) {
      previewCard.innerHTML = `
        <div class="text-center p-4 text-rose-500">
          <div class="text-2xl mb-1">❌</div>
          <div class="font-bold text-xs">Unrecognized Tag: ${escapeHtml(tagId)}</div>
          <div class="text-[11px] text-slate-400 mt-1">Please verify the tag exists in the generated database.</div>
        </div>
      `;
    }
    return;
  }

  const b = getEnrichedBundle(tagObj);
  currentScannedTag = b;
  playSuccessBeep();

  const isEmb = (b.embellishmentStyle || '').toLowerCase() === 'yes';

  if (previewCard) {
    previewCard.innerHTML = `
      <div class="w-full p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 animate-in fade-in duration-150 space-y-3 shadow-2xs">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-blue-200/70 dark:border-blue-800/70">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="font-mono font-black text-base text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" title="View Full Specs">
                ${escapeHtml(b.tagId)}
              </button>
              <span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">Bundle #${escapeHtml(b.bundleSeq)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Shade ${escapeHtml(b.shade)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">
                EMB: ${isEmb ? 'YES' : 'NO'}
              </span>
            </div>
            <div class="text-sm font-extrabold text-slate-900 dark:text-slate-100">${escapeHtml(b.style)} • <span class="text-slate-600 dark:text-slate-300">${escapeHtml(b.color)}</span></div>
          </div>
          <div class="flex items-center gap-2 flex-wrap self-end md:self-center">
            <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="px-3.5 py-2 bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
              <span>📋 Full Specs</span>
            </button>
            <button type="button" onclick="confirmScanAssign()" class="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
              <span>💾 Assign to Selected Pallet</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Size & Part</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.size)} (${escapeHtml(b.part)})</span>
          </div>
          <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Ply Range</span>
            <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.plyRange || '—')}</span>
          </div>
          <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">PO & Lay Job</span>
            <span class="font-mono text-slate-700 dark:text-slate-300">${escapeHtml(b.schedule || b.po || '—')} / ${escapeHtml(b.layJobNo || '—')}</span>
          </div>
          <div class="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Current Storage</span>
            ${b.status === 'STORED' ? `
              <span class="font-bold text-emerald-600 dark:text-emerald-400">🏢 ${escapeHtml(b.rackName)} > 📦 ${escapeHtml(b.palletName)}</span>
            ` : `
              <span class="font-bold text-amber-600 dark:text-amber-400">Unassigned (Ready)</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Auto assign if target rack and pallet are ready
  if (targetRackId && targetPalletId) {
    executeAssignSingleTag(tagObj, targetRackId, targetPalletId);
  }

  input.value = '';
  input.focus();
}

function confirmScanAssign() {
  if (!currentScannedTag) {
    showLocToast("Please scan or enter a bundle tag first.", "error");
    return;
  }
  const rackId = document.getElementById('loc-scan-target-rack')?.value;
  const palletId = document.getElementById('loc-scan-target-pallet')?.value;
  if (!rackId || !palletId) {
    showLocToast("Please choose target Rack Number and Pallet.", "error");
    return;
  }
  executeAssignSingleTag(currentScannedTag, rackId, palletId);
}

function quickAssignToPalletIndex(index) {
  const targetRackId = document.getElementById('loc-scan-target-rack')?.value;
  if (!targetRackId) {
    showLocToast("Please select a target Rack Number first.", "error");
    return;
  }
  const pallets = getSortedPallets(targetRackId);
  if (pallets[index]) {
    selectQuickScanPallet(pallets[index].id);
    if (currentScannedTag) {
      executeAssignSingleTag(currentScannedTag, targetRackId, pallets[index].id);
    }
  }
}

async function executeAssignSingleTag(tagObj, rackId, palletId) {
  const rack = (locAppState.racks || []).find(r => r.id === rackId);
  const pallet = (locAppState.pallets || []).find(p => p.id === palletId);
  if (!rack || !pallet) return;

  const b = getEnrichedBundle(tagObj);
  const tId = b.tagId;
  const now = new Date().toISOString();

  // Update bundleLocations
  const existingIdx = (locAppState.bundleLocations || []).findIndex(x => x.tagId === tId);
  const locRecord = {
    tagId: tId,
    batchId: b.batchId || 'BATCH',
    style: b.style || '',
    color: b.color || '',
    size: b.size || '',
    part: b.part || '',
    bundleSeq: b.bundleSeq !== undefined && b.bundleSeq !== null ? b.bundleSeq : '',
    shade: b.shade || '',
    schedule: b.schedule || b.po || '',
    po: b.po || b.schedule || '',
    layJobNo: b.layJobNo || b.jobNo || '',
    jobNo: b.jobNo || b.layJobNo || '',
    docketNo: b.docketNo || b.docket || '',
    docket: b.docket || b.docketNo || '',
    patternText: b.patternText || '',
    embellishmentStyle: b.embellishmentStyle || 'No',
    plyRange: b.plyRange || '',
    startPly: b.startPly || '',
    endPly: b.endPly || '',
    sizeRatio: b.sizeRatio || '',
    ratioTotal: b.ratioTotal || '',
    tagString: b.tagString || '',
    rackId: rack.id,
    rackName: rack.name,
    palletId: pallet.id,
    palletName: pallet.name,
    status: 'STORED',
    assignedAt: now
  };

  if (existingIdx >= 0) {
    locAppState.bundleLocations[existingIdx] = locRecord;
  } else {
    locAppState.bundleLocations.push(locRecord);
  }

  // Add history event
  locAppState.history.unshift({
    timestamp: now,
    action: 'STORED',
    tagId: tId,
    style: b.style || '',
    rackName: rack.name,
    palletName: pallet.name,
    details: `Assigned #${b.bundleSeq} (${b.style} ${b.color}) to ${rack.name} > ${pallet.name}`
  });

  // Add to active session log
  scanSessionHistory.unshift({
    time: new Date().toLocaleTimeString(),
    tagId: tId,
    bundleSeq: b.bundleSeq,
    shade: b.shade,
    style: b.style,
    color: b.color,
    size: b.size,
    part: b.part,
    schedule: b.schedule,
    layJobNo: b.layJobNo,
    docketNo: b.docketNo,
    plyRange: b.plyRange,
    embellishmentStyle: b.embellishmentStyle,
    location: `${rack.name} > ${pallet.name}`
  });

  await saveLocationDatabase();
  renderScanSessionTable();
  renderLocationMetrics();
  showLocToast(`🟢 Assigned #${b.bundleSeq} (${tId}) to ${rack.name} > ${pallet.name}`, "success");
}

function renderScanSessionTable() {
  const tbody = document.getElementById('loc-scan-session-rows');
  if (!tbody) return;

  if (scanSessionHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 italic">No tags scanned in this session yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = scanSessionHistory.map(row => {
    const b = getEnrichedBundle(row);
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="p-2.5 font-mono text-[11px] text-slate-500">${escapeHtml(row.time)}</td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="hover:underline cursor-pointer font-mono font-bold text-left" title="View Specs">
            ${escapeHtml(b.tagId)}
          </button>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 dark:text-slate-100">#${escapeHtml(b.bundleSeq)}</div>
          <div class="text-[10px] text-slate-400 font-mono">Shade ${escapeHtml(b.shade)}</div>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">${escapeHtml(b.style)}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[140px]">${escapeHtml(b.color)}</div>
        </td>
        <td class="p-2.5">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.size)}</span>
          <span class="text-[10px] text-slate-400">(${escapeHtml(b.part)})</span>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-500">
          <div>PO: ${escapeHtml(b.schedule || b.po || '—')}</div>
          <div class="text-[10px] text-slate-400">Job: ${escapeHtml(b.layJobNo || b.jobNo || '—')}</div>
        </td>
        <td class="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">🏢 ${escapeHtml(row.location || `${b.rackName} > ${b.palletName}`)}</td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded mr-1 cursor-pointer">Specs</button>
          <button type="button" onclick="openMoveModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded cursor-pointer">Move</button>
        </td>
      </tr>
    `;
  }).join('');
}

function clearScanSessionTable() {
  scanSessionHistory = [];
  renderScanSessionTable();
}

function renderScanStation() {
  const rackSelect = document.getElementById('loc-scan-target-rack');
  if (rackSelect && rackSelect.value) {
    onScanRackChanged(rackSelect.value);
  }
  renderScanSessionTable();
}

/**
 * ==============================================================================
 * 3. BATCH ASSIGN TO LOCATION (Bulk Assignment)
 * ==============================================================================
 */
function onLocationBatchSourceChange() {
  selectedBatchTagIds.clear();
  const thCb = document.getElementById('loc-batch-th-cb');
  if (thCb) thCb.checked = false;
  renderBatchAssignTable();
}

function renderBatchAssignTable() {
  const tbody = document.getElementById('loc-batch-table-rows');
  const infoEl = document.getElementById('loc-batch-table-info');
  const badgeEl = document.getElementById('loc-batch-selected-count-badge');
  const searchQ = (document.getElementById('loc-batch-table-search')?.value || '').toLowerCase().trim();
  const sourceVal = document.getElementById('loc-batch-source-select')?.value || 'ALL_UNASSIGNED';

  if (badgeEl) badgeEl.textContent = `${selectedBatchTagIds.size} Selected`;

  const storedMap = new Map();
  (locAppState.bundleLocations || []).forEach(b => storedMap.set(b.tagId, b));

  let candidateTags = locAppState.tags || [];

  if (sourceVal === 'ALL_UNASSIGNED') {
    candidateTags = candidateTags.filter(t => !storedMap.has(t.tagId || t.id) || storedMap.get(t.tagId || t.id).status !== 'STORED');
  } else if (sourceVal !== 'ALL_TAGS') {
    candidateTags = candidateTags.filter(t => (t.batchId || t.batchTagString) === sourceVal);
  }

  if (searchQ) {
    candidateTags = candidateTags.filter(raw => {
      const t = getEnrichedBundle(raw);
      return (
        (t.tagId || '').toLowerCase().includes(searchQ) ||
        (t.style || '').toLowerCase().includes(searchQ) ||
        (t.color || '').toLowerCase().includes(searchQ) ||
        (t.size || '').toLowerCase().includes(searchQ) ||
        (t.part || '').toLowerCase().includes(searchQ) ||
        (t.plyRange || '').toLowerCase().includes(searchQ) ||
        (String(t.bundleSeq) || '').toLowerCase().includes(searchQ) ||
        (t.shade || '').toLowerCase().includes(searchQ) ||
        (t.schedule || '').toLowerCase().includes(searchQ) ||
        (t.layJobNo || '').toLowerCase().includes(searchQ) ||
        (t.docketNo || '').toLowerCase().includes(searchQ)
      );
    });
  }

  if (infoEl) infoEl.textContent = `Showing ${candidateTags.length} candidate bundles`;
  if (!tbody) return;

  const visibleTags = candidateTags.slice(0, 200);
  const thCb = document.getElementById('loc-batch-th-cb');
  if (thCb) {
    thCb.checked = visibleTags.length > 0 && visibleTags.every(t => selectedBatchTagIds.has(t.tagId || t.id));
  }

  if (candidateTags.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400 italic">No bundles match the selected batch or search filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = visibleTags.map(raw => {
    const t = getEnrichedBundle(raw);
    const tId = t.tagId;
    const isChecked = selectedBatchTagIds.has(tId);
    const loc = storedMap.get(tId);
    const isStored = loc && loc.status === 'STORED';
    const isEmb = (t.embellishmentStyle || '').toLowerCase() === 'yes';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs ${isChecked ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}">
        <td class="p-2.5 text-center">
          <input type="checkbox" onchange="toggleBatchRowCheckbox('${escapeHtml(tId)}', this.checked)" ${isChecked ? 'checked' : ''} class="loc-batch-row-cb rounded text-blue-600 cursor-pointer" />
        </td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(tId)}')" class="hover:underline cursor-pointer font-mono font-bold text-left" title="View Specs">
            ${escapeHtml(tId)}
          </button>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 dark:text-slate-100">#${escapeHtml(t.bundleSeq)}</div>
          <div class="text-[10px] text-slate-400 font-mono">Shade ${escapeHtml(t.shade)}</div>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">${escapeHtml(t.style)}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[130px]">${escapeHtml(t.color)}</div>
        </td>
        <td class="p-2.5">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(t.size)}</span>
          <span class="text-[10px] text-slate-400">(${escapeHtml(t.part)})</span>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-500">
          <div>PO: ${escapeHtml(t.schedule || t.po || '—')}</div>
          <div class="text-[10px] text-slate-400">Job: ${escapeHtml(t.layJobNo || '—')} | Dkt: ${escapeHtml(t.docketNo || '—')}</div>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">${escapeHtml(t.plyRange || (t.startPly && t.endPly ? `${t.startPly}–${t.endPly}` : '—'))}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
            ${isEmb ? 'YES' : 'NO'}
          </span>
        </td>
        <td class="p-2.5">
          ${isStored ? `
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">STORED</span>
              <div class="text-[10px] text-slate-500 mt-0.5">🏢 ${escapeHtml(loc.rackName)} > 📦 ${escapeHtml(loc.palletName)}</div>
            </div>
          ` : `
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">UNASSIGNED</span>
          `}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(tId)}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition cursor-pointer">Specs</button>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleBatchRowCheckbox(tagId, checked) {
  if (checked) selectedBatchTagIds.add(tagId);
  else selectedBatchTagIds.delete(tagId);
  const badgeEl = document.getElementById('loc-batch-selected-count-badge');
  if (badgeEl) badgeEl.textContent = `${selectedBatchTagIds.size} Selected`;
  const thCb = document.getElementById('loc-batch-th-cb');
  if (thCb) {
    const cbs = document.querySelectorAll('.loc-batch-row-cb');
    thCb.checked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
  }
}

function toggleSelectAllBatchBundles(checked) {
  const sourceVal = document.getElementById('loc-batch-source-select')?.value || 'ALL_UNASSIGNED';
  const storedMap = new Map();
  (locAppState.bundleLocations || []).forEach(b => storedMap.set(b.tagId, b));

  let candidateTags = locAppState.tags || [];
  if (sourceVal === 'ALL_UNASSIGNED') {
    candidateTags = candidateTags.filter(t => !storedMap.has(t.tagId || t.id) || storedMap.get(t.tagId || t.id).status !== 'STORED');
  } else if (sourceVal !== 'ALL_TAGS') {
    candidateTags = candidateTags.filter(t => (t.batchId || t.batchTagString) === sourceVal);
  }
  const searchQ = (document.getElementById('loc-batch-table-search')?.value || '').toLowerCase().trim();
  if (searchQ) {
    candidateTags = candidateTags.filter(raw => {
      const t = getEnrichedBundle(raw);
      return (
        (t.tagId || '').toLowerCase().includes(searchQ) ||
        (t.style || '').toLowerCase().includes(searchQ) ||
        (t.color || '').toLowerCase().includes(searchQ) ||
        (t.size || '').toLowerCase().includes(searchQ) ||
        (t.part || '').toLowerCase().includes(searchQ) ||
        (t.plyRange || '').toLowerCase().includes(searchQ) ||
        (String(t.bundleSeq) || '').toLowerCase().includes(searchQ) ||
        (t.shade || '').toLowerCase().includes(searchQ) ||
        (t.schedule || '').toLowerCase().includes(searchQ) ||
        (t.layJobNo || '').toLowerCase().includes(searchQ) ||
        (t.docketNo || '').toLowerCase().includes(searchQ)
      );
    });
  }

  if (checked) {
    candidateTags.forEach(t => selectedBatchTagIds.add(t.tagId || t.id));
  } else {
    selectedBatchTagIds.clear();
  }
  renderBatchAssignTable();
}

async function submitBatchAssignSelected() {
  if (selectedBatchTagIds.size === 0) {
    showLocToast("Please select one or more bundles with checkboxes to assign.", "warning");
    return;
  }

  const rackId = document.getElementById('loc-batch-target-rack')?.value;
  const palletId = document.getElementById('loc-batch-target-pallet')?.value;

  if (!rackId || !palletId) {
    showLocToast("Please choose target Destination Rack and Pallet.", "error");
    return;
  }

  const rack = (locAppState.racks || []).find(r => r.id === rackId);
  const pallet = (locAppState.pallets || []).find(p => p.id === palletId);
  if (!rack || !pallet) return;

  const count = selectedBatchTagIds.size;
  const now = new Date().toISOString();

  selectedBatchTagIds.forEach(tId => {
    const b = getEnrichedBundle({ tagId: tId });
    const existingIdx = (locAppState.bundleLocations || []).findIndex(x => x.tagId === tId);

    const rec = {
      tagId: tId,
      batchId: b.batchId || 'BATCH',
      style: b.style || '',
      color: b.color || '',
      size: b.size || '',
      part: b.part || '',
      bundleSeq: b.bundleSeq !== undefined && b.bundleSeq !== null ? b.bundleSeq : '',
      shade: b.shade || '',
      schedule: b.schedule || b.po || '',
      po: b.po || b.schedule || '',
      layJobNo: b.layJobNo || b.jobNo || '',
      jobNo: b.jobNo || b.layJobNo || '',
      docketNo: b.docketNo || b.docket || '',
      docket: b.docket || b.docketNo || '',
      patternText: b.patternText || '',
      embellishmentStyle: b.embellishmentStyle || 'No',
      plyRange: b.plyRange || '',
      startPly: b.startPly || '',
      endPly: b.endPly || '',
      sizeRatio: b.sizeRatio || '',
      ratioTotal: b.ratioTotal || '',
      tagString: b.tagString || '',
      rackId: rack.id,
      rackName: rack.name,
      palletId: pallet.id,
      palletName: pallet.name,
      status: 'STORED',
      assignedAt: now
    };

    if (existingIdx >= 0) locAppState.bundleLocations[existingIdx] = rec;
    else locAppState.bundleLocations.push(rec);

    locAppState.history.unshift({
      timestamp: now,
      action: 'BATCH_ASSIGN',
      tagId: tId,
      style: b.style || '',
      rackName: rack.name,
      palletName: pallet.name,
      details: `Batch assigned #${b.bundleSeq} to ${rack.name} > ${pallet.name}`
    });
  });

  await saveLocationDatabase();
  selectedBatchTagIds.clear();
  const thCb = document.getElementById('loc-batch-th-cb');
  if (thCb) thCb.checked = false;
  renderBatchAssignTable();
  renderLocationMetrics();
  showLocToast(`🟢 Successfully batch assigned ${count} bundles to ${rack.name} > ${pallet.name}!`, "success");
}

/**
 * ==============================================================================
 * 4. DISPATCH FROM STORAGE
 * ==============================================================================
 */
function onLocationDispatchSourceChange() {
  selectedDispatchTagIds.clear();
  const thCb = document.getElementById('loc-dispatch-th-cb');
  if (thCb) thCb.checked = false;
  renderDispatchTable();
}

function renderDispatchTable() {
  const tbody = document.getElementById('loc-dispatch-table-rows');
  const infoEl = document.getElementById('loc-dispatch-table-info');
  const badgeEl = document.getElementById('loc-dispatch-selected-count-badge');
  const searchQ = (document.getElementById('loc-dispatch-table-search')?.value || '').toLowerCase().trim();
  const sourceVal = document.getElementById('loc-dispatch-source-select')?.value || 'ALL_STORED';

  if (badgeEl) badgeEl.textContent = `${selectedDispatchTagIds.size} Selected`;

  let storedList = (locAppState.bundleLocations || []).filter(b => b.status === 'STORED');

  if (sourceVal !== 'ALL_STORED') {
    storedList = storedList.filter(b => b.batchId === sourceVal);
  }

  if (searchQ) {
    storedList = storedList.filter(raw => {
      const b = getEnrichedBundle(raw);
      return (
        (b.tagId || '').toLowerCase().includes(searchQ) ||
        (b.style || '').toLowerCase().includes(searchQ) ||
        (b.color || '').toLowerCase().includes(searchQ) ||
        (b.rackName || '').toLowerCase().includes(searchQ) ||
        (b.palletName || '').toLowerCase().includes(searchQ) ||
        (b.plyRange || '').toLowerCase().includes(searchQ) ||
        (String(b.bundleSeq) || '').toLowerCase().includes(searchQ) ||
        (b.shade || '').toLowerCase().includes(searchQ) ||
        (b.schedule || '').toLowerCase().includes(searchQ) ||
        (b.docketNo || '').toLowerCase().includes(searchQ)
      );
    });
  }

  if (infoEl) infoEl.textContent = `Showing ${storedList.length} stored bundles`;
  if (!tbody) return;

  const visibleStored = storedList.slice(0, 200);
  const thCb = document.getElementById('loc-dispatch-th-cb');
  if (thCb) {
    thCb.checked = visibleStored.length > 0 && visibleStored.every(b => selectedDispatchTagIds.has(b.tagId));
  }

  if (storedList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400 italic">No stored bundles found in warehouse storage.</td></tr>`;
    return;
  }

  tbody.innerHTML = visibleStored.map(raw => {
    const b = getEnrichedBundle(raw);
    const isChecked = selectedDispatchTagIds.has(b.tagId);
    const isEmb = (b.embellishmentStyle || '').toLowerCase() === 'yes';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs ${isChecked ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}">
        <td class="p-2.5 text-center">
          <input type="checkbox" value="${escapeHtml(b.tagId)}" onchange="toggleDispatchRowCheckbox('${escapeHtml(b.tagId)}', this.checked)" ${isChecked ? 'checked' : ''} class="loc-disp-row-cb rounded text-amber-600 cursor-pointer" />
        </td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="hover:underline cursor-pointer font-mono font-bold text-left" title="View Specs">
            ${escapeHtml(b.tagId)}
          </button>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 dark:text-slate-100">#${escapeHtml(b.bundleSeq)}</div>
          <div class="text-[10px] text-slate-400 font-mono">Shade ${escapeHtml(b.shade)}</div>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">${escapeHtml(b.style)}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[130px]">${escapeHtml(b.color)}</div>
        </td>
        <td class="p-2.5">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.size)}</span>
          <span class="text-[10px] text-slate-400">(${escapeHtml(b.part)})</span>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-500">
          <div>PO: ${escapeHtml(b.schedule || b.po || '—')}</div>
          <div class="text-[10px] text-slate-400">Dkt: ${escapeHtml(b.docketNo || '—')}</div>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">${escapeHtml(b.plyRange || (b.startPly && b.endPly ? `${b.startPly}–${b.endPly}` : '—'))}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
            ${isEmb ? 'YES' : 'NO'}
          </span>
        </td>
        <td class="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
          <div>🏢 ${escapeHtml(b.rackName)}</div>
          <div class="text-[10px] text-slate-400">📦 ${escapeHtml(b.palletName)}</div>
        </td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition cursor-pointer mr-1">Specs</button>
          <button type="button" onclick="openDispatchModalSingle('${escapeHtml(b.tagId)}')" class="px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer">Dispatch</button>
        </td>
      </tr>
    `;
  }).join('');
}

function setQuickDispatchDest(dest) {
  const input = document.getElementById('loc-dispatch-destination');
  if (input) input.value = dest;
}

function toggleDispatchRowCheckbox(tagId, checked) {
  if (checked) selectedDispatchTagIds.add(tagId);
  else selectedDispatchTagIds.delete(tagId);
  const badgeEl = document.getElementById('loc-dispatch-selected-count-badge');
  if (badgeEl) badgeEl.textContent = `${selectedDispatchTagIds.size} Selected`;
  const thCb = document.getElementById('loc-dispatch-th-cb');
  if (thCb) {
    const cbs = document.querySelectorAll('.loc-disp-row-cb');
    thCb.checked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
  }
}

function toggleSelectAllDispatchBundles(checked) {
  const sourceVal = document.getElementById('loc-dispatch-source-select')?.value || 'ALL_STORED';
  let storedList = (locAppState.bundleLocations || []).filter(b => b.status === 'STORED');
  if (sourceVal !== 'ALL_STORED') {
    storedList = storedList.filter(b => b.batchId === sourceVal);
  }
  const searchQ = (document.getElementById('loc-dispatch-table-search')?.value || '').toLowerCase().trim();
  if (searchQ) {
    storedList = storedList.filter(raw => {
      const b = getEnrichedBundle(raw);
      return (
        (b.tagId || '').toLowerCase().includes(searchQ) ||
        (b.style || '').toLowerCase().includes(searchQ) ||
        (b.color || '').toLowerCase().includes(searchQ) ||
        (b.rackName || '').toLowerCase().includes(searchQ) ||
        (b.palletName || '').toLowerCase().includes(searchQ) ||
        (b.plyRange || '').toLowerCase().includes(searchQ) ||
        (String(b.bundleSeq) || '').toLowerCase().includes(searchQ) ||
        (b.shade || '').toLowerCase().includes(searchQ) ||
        (b.schedule || '').toLowerCase().includes(searchQ) ||
        (b.docketNo || '').toLowerCase().includes(searchQ)
      );
    });
  }

  if (checked) {
    storedList.forEach(b => selectedDispatchTagIds.add(b.tagId));
  } else {
    selectedDispatchTagIds.clear();
  }
  renderDispatchTable();
}

async function submitDispatchSelectedBundles() {
  if (selectedDispatchTagIds.size === 0) {
    showLocToast("Please select one or more stored bundles with the checkboxes.", "warning");
    return;
  }
  const tagIds = Array.from(selectedDispatchTagIds);
  const destination = document.getElementById('loc-dispatch-destination')?.value || 'Sewing Line 1';
  await executeDispatchBundles(tagIds, destination, "Bulk line dispatch");
  selectedDispatchTagIds.clear();
  const thCb = document.getElementById('loc-dispatch-th-cb');
  if (thCb) thCb.checked = false;
  renderDispatchTable();
}

function openDispatchModalSingle(tagId) {
  openDispatchModalForPallet([tagId]);
}

function openDispatchModalForPallet(tagIds) {
  dispatchTargetTagIds = Array.isArray(tagIds) ? tagIds : [tagIds];
  const modal = document.getElementById('modal-dispatch');
  const countEl = document.getElementById('modal-dispatch-count');
  if (countEl) countEl.textContent = `${dispatchTargetTagIds.length} Bundle(s)`;
  if (modal) modal.classList.remove('hidden');
}

async function submitModalDispatch() {
  const dest = document.getElementById('modal-dispatch-destination')?.value || 'Sewing Line 1';
  const notes = document.getElementById('modal-dispatch-notes')?.value || '';
  await executeDispatchBundles(dispatchTargetTagIds, dest, notes);
  closeModal('modal-dispatch');
}

async function executeDispatchBundles(tagIds, destination, notes) {
  const now = new Date().toISOString();
  let count = 0;

  tagIds.forEach(tId => {
    const b = (locAppState.bundleLocations || []).find(x => x.tagId === tId);
    if (b) {
      b.status = 'DISPATCHED';
      b.dispatchedAt = now;
      b.dispatchDestination = destination;
      b.dispatchNotes = notes;
      count++;

      locAppState.history.unshift({
        timestamp: now,
        action: 'DISPATCHED',
        tagId: tId,
        style: b.style,
        rackName: b.rackName,
        palletName: b.palletName,
        details: `Dispatched to ${destination} (${notes || 'Production'})`
      });
    }
  });

  await saveLocationDatabase();
  renderDispatchTable();
  renderLocationMetrics();
  showLocToast(`🚀 Dispatched ${count} bundle(s) to ${destination}!`, "success");
}

/**
 * ==============================================================================
 * 5. MASTER RACK & PALLET SETUP (3 Pallets Per Rack Auto Generation - Numbers Only)
 * ==============================================================================
 */
async function handleCreateRackSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('setup-new-rack-name');
  const zoneInput = document.getElementById('setup-new-rack-zone');
  const descInput = document.getElementById('setup-new-rack-desc');

  const rawName = (nameInput?.value || '').trim();
  const zone = (zoneInput?.value || '').trim() || 'Cutting Floor';
  const desc = (descInput?.value || '').trim() || 'Standard Storage';

  if (!rawName) {
    showLocToast("Please enter a Rack Number (e.g. 1, 2, 3 or Rack 1).", "error");
    return;
  }

  // Enforce numeric rack: extract digits
  const numMatch = rawName.match(/\d+/);
  if (!numMatch) {
    showLocToast("Rack must be a number, not letters (e.g. 1, 2, 3 or Rack 1).", "error");
    return;
  }

  const rackNum = parseInt(numMatch[0], 10);
  const formattedName = `Rack ${rackNum}`;
  const rId = `RACK-${rackNum}`;

  // Check if rack with this number already exists
  if ((locAppState.racks || []).some(r => r.id === rId || (r.name || '').toLowerCase() === formattedName.toLowerCase())) {
    showLocToast(`Rack ${rackNum} already exists! Please enter a different number.`, "error");
    return;
  }

  // 1. Add Rack
  locAppState.racks.push({
    id: rId,
    name: formattedName,
    zone: zone,
    description: desc,
    createdAt: new Date().toISOString()
  });

  // 2. USER REQUIREMENT: Automatically create 3 PALLETS EACH per Rack (with numeric IDs)
  const p1 = `PAL-${rackNum}-1`;
  const p2 = `PAL-${rackNum}-2`;
  const p3 = `PAL-${rackNum}-3`;

  locAppState.pallets.push(
    { id: p1, rackId: rId, name: "Pallet 1", capacity: 50, description: "Tier 1 (Bottom)", createdAt: new Date().toISOString() },
    { id: p2, rackId: rId, name: "Pallet 2", capacity: 50, description: "Tier 2 (Middle)", createdAt: new Date().toISOString() },
    { id: p3, rackId: rId, name: "Pallet 3", capacity: 50, description: "Tier 3 (Top)", createdAt: new Date().toISOString() }
  );

  await saveLocationSpecs();
  if (nameInput) nameInput.value = '';
  if (zoneInput) zoneInput.value = '';
  if (descInput) descInput.value = '';

  populateLocationDropdowns(rId);
  renderMasterSetupTable();
  renderFloorExplorer();
  renderLocationMetrics();
  showLocToast(`🟢 Created Rack ${rackNum} with 3 Pallets (Pallet 1, 2, 3)!`, "success");
}

async function handleCreatePalletSubmit(e) {
  if (e) e.preventDefault();
  const rackId = document.getElementById('pallet-form-rack')?.value;
  const name = (document.getElementById('pallet-form-name')?.value || '').trim();
  const cap = parseInt(document.getElementById('pallet-form-cap')?.value, 10) || 50;
  const desc = (document.getElementById('pallet-form-desc')?.value || '').trim();

  if (!rackId || !name) {
    showLocToast("Please select parent Rack and enter Pallet Name.", "error");
    return;
  }

  const parentRack = (locAppState.racks || []).find(r => r.id === rackId);
  const rackNum = parentRack ? (parentRack.id.replace(/\D+/g, '') || Date.now()) : Date.now();
  const existingPallets = (locAppState.pallets || []).filter(p => p.rackId === rackId);
  const nextPalletNum = existingPallets.length + 1;
  const pId = `PAL-${rackNum}-${nextPalletNum}`;

  locAppState.pallets.push({
    id: pId,
    rackId: rackId,
    name: name,
    capacity: cap,
    description: desc || 'Storage Pallet',
    createdAt: new Date().toISOString()
  });

  await saveLocationSpecs();
  document.getElementById('pallet-form-name').value = '';
  document.getElementById('pallet-form-desc').value = '';
  renderMasterSetupTable();
  renderFloorExplorer();
  renderLocationMetrics();
  showLocToast(`🟢 Added Pallet "${name}" to ${parentRack ? parentRack.name : 'rack'}!`, "success");
}

function renderMasterSetupTable() {
  const tbody = document.getElementById('loc-setup-table-rows');
  const racksPillList = document.getElementById('setup-racks-pill-list');
  const palletsPillList = document.getElementById('setup-pallets-pill-list');

  const racks = getSortedRacks();
  const pallets = locAppState.pallets || [];
  const bundles = locAppState.bundleLocations || [];

  if (racksPillList) {
    racksPillList.innerHTML = racks.length === 0 
      ? `<span class="text-xs text-slate-400 italic">No racks created yet.</span>`
      : racks.map(r => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700">
          <span>🏢 ${escapeHtml(r.name)}</span>
          <button onclick="openEditRackModal('${r.id}')" class="text-slate-400 hover:text-blue-600 text-xs cursor-pointer">✏️</button>
          <button onclick="deleteRack('${r.id}')" class="text-slate-400 hover:text-rose-600 text-xs cursor-pointer">✕</button>
        </span>
      `).join('');
  }

  if (palletsPillList) {
    palletsPillList.innerHTML = pallets.length === 0
      ? `<span class="text-xs text-slate-400 italic">No pallets created yet.</span>`
      : pallets.map(p => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700">
          <span>📦 ${escapeHtml(p.name)}</span>
          <button onclick="openEditPalletModal('${p.id}')" class="text-slate-400 hover:text-blue-600 text-xs cursor-pointer">✏️</button>
          <button onclick="deletePallet('${p.id}')" class="text-slate-400 hover:text-rose-600 text-xs cursor-pointer">✕</button>
        </span>
      `).join('');
  }

  if (!tbody) return;

  if (racks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 italic">No racks or pallets registered in the system yet.</td></tr>`;
    return;
  }

  const rows = [];
  racks.forEach(r => {
    const rPallets = getSortedPallets(r.id);
    const rBundles = bundles.filter(b => b.rackId === r.id && b.status === 'STORED');
    rows.push(`
      <tr class="bg-blue-50/40 dark:bg-blue-950/20 font-bold border-b border-slate-200 dark:border-slate-800">
        <td class="p-2.5 text-blue-600 dark:text-blue-400">🏢 RACK</td>
        <td class="p-2.5 text-slate-900 dark:text-slate-100">${escapeHtml(r.name)}</td>
        <td class="p-2.5 font-normal text-slate-600 dark:text-slate-400">${escapeHtml(r.zone || 'Cutting Floor')}</td>
        <td class="p-2.5 font-mono text-slate-600 dark:text-slate-400">${rPallets.length} Pallets</td>
        <td class="p-2.5 font-mono text-emerald-600 dark:text-emerald-400">${rBundles.length} Stored</td>
        <td class="p-2.5 font-normal text-slate-500">${escapeHtml(r.description || '')}</td>
        <td class="p-2.5 text-right">
          <button onclick="openEditRackModal('${r.id}')" class="px-2 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded mr-1 cursor-pointer">Edit</button>
          <button onclick="deleteRack('${r.id}')" class="px-2 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 rounded cursor-pointer">Delete</button>
        </td>
      </tr>
    `);

    rPallets.forEach(p => {
      const pBundles = bundles.filter(b => b.palletId === p.id && b.status === 'STORED');
      rows.push(`
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 pl-4">
          <td class="p-2.5 pl-6 text-amber-600 dark:text-amber-400">📦 Pallet</td>
          <td class="p-2.5 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(p.name)}</td>
          <td class="p-2.5 font-mono text-xs text-slate-400">${escapeHtml(r.name)}</td>
          <td class="p-2.5 font-mono text-slate-600 dark:text-slate-400">${p.capacity} Max</td>
          <td class="p-2.5 font-mono text-emerald-600 dark:text-emerald-400">${pBundles.length} Stored</td>
          <td class="p-2.5 text-slate-500 text-xs">${escapeHtml(p.description || '')}</td>
          <td class="p-2.5 text-right">
            <button onclick="openEditPalletModal('${p.id}')" class="px-2 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded mr-1 cursor-pointer">Edit</button>
            <button onclick="deletePallet('${p.id}')" class="px-2 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 rounded cursor-pointer">Delete</button>
          </td>
        </tr>
      `);
    });
  });

  tbody.innerHTML = rows.join('');
}

async function deleteRack(rId) {
  const rack = (locAppState.racks || []).find(r => r.id === rId);
  if (!rack) return;
  if (!confirm(`Delete Rack "${rack.name}" and all its pallets?`)) return;

  locAppState.racks = locAppState.racks.filter(r => r.id !== rId);
  locAppState.pallets = locAppState.pallets.filter(p => p.rackId !== rId);
  locAppState.bundleLocations = locAppState.bundleLocations.filter(b => b.rackId !== rId);

  await saveLocationSpecs();
  await saveLocationDatabase();
  populateLocationDropdowns();
  renderAllLocationUI();
  showLocToast(`Deleted ${rack.name}.`, "info");
}

async function deletePallet(pId) {
  const pal = (locAppState.pallets || []).find(p => p.id === pId);
  if (!pal) return;
  if (!confirm(`Delete Pallet "${pal.name}"?`)) return;

  locAppState.pallets = locAppState.pallets.filter(p => p.id !== pId);
  locAppState.bundleLocations = locAppState.bundleLocations.filter(b => b.palletId !== pId);

  await saveLocationSpecs();
  await saveLocationDatabase();
  populateLocationDropdowns();
  renderAllLocationUI();
  showLocToast(`Deleted ${pal.name}.`, "info");
}

/**
 * ==============================================================================
 * 6. INVENTORY SEARCH & AUDIT
 * ==============================================================================
 */
function renderAuditTable(resetPage = false) {
  if (resetPage) auditCurrentPage = 1;
  const tbody = document.getElementById('loc-audit-table-rows');
  const searchQ = (document.getElementById('loc-audit-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('loc-audit-status-filter')?.value || 'ALL';
  const rackFilter = document.getElementById('loc-audit-rack-filter')?.value || 'ALL';

  let list = locAppState.bundleLocations || [];

  if (statusFilter !== 'ALL') {
    list = list.filter(b => b.status === statusFilter);
  }
  if (rackFilter !== 'ALL') {
    list = list.filter(b => b.rackId === rackFilter);
  }
  if (searchQ) {
    list = list.filter(raw => {
      const b = getEnrichedBundle(raw);
      return (
        (b.tagId || '').toLowerCase().includes(searchQ) ||
        (b.style || '').toLowerCase().includes(searchQ) ||
        (b.color || '').toLowerCase().includes(searchQ) ||
        (b.rackName || '').toLowerCase().includes(searchQ) ||
        (b.palletName || '').toLowerCase().includes(searchQ) ||
        (b.docketNo || '').toLowerCase().includes(searchQ) ||
        (String(b.bundleSeq) || '').toLowerCase().includes(searchQ) ||
        (b.shade || '').toLowerCase().includes(searchQ) ||
        (b.schedule || '').toLowerCase().includes(searchQ) ||
        (b.layJobNo || '').toLowerCase().includes(searchQ) ||
        (b.plyRange || '').toLowerCase().includes(searchQ)
      );
    });
  }

  const total = list.length;
  const totalPages = Math.ceil(total / auditPageSize) || 1;
  if (auditCurrentPage > totalPages) auditCurrentPage = totalPages;
  const start = (auditCurrentPage - 1) * auditPageSize;
  const end = Math.min(start + auditPageSize, total);
  const pageItems = list.slice(start, end);

  const pageInfo = document.getElementById('loc-audit-page-info');
  if (pageInfo) pageInfo.textContent = `Showing ${total > 0 ? start + 1 : 0}–${end} of ${total.toLocaleString()} bundles`;

  if (!tbody) return;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400 italic">No bundles match the current audit filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(raw => {
    const b = getEnrichedBundle(raw);
    const isStored = b.status === 'STORED';
    const isEmb = (b.embellishmentStyle || '').toLowerCase() === 'yes';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="hover:underline cursor-pointer font-mono font-bold text-left" title="View Specs">
            ${escapeHtml(b.tagId)}
          </button>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 dark:text-slate-100">#${escapeHtml(b.bundleSeq)}</div>
          <div class="text-[10px] text-slate-400 font-mono">Shade ${escapeHtml(b.shade)}</div>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">${escapeHtml(b.style)}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[130px]">${escapeHtml(b.color || '—')}</div>
        </td>
        <td class="p-2.5">
          <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(b.size)}</span>
          <span class="text-[10px] text-slate-400">(${escapeHtml(b.part)})</span>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-500">
          <div>PO: ${escapeHtml(b.schedule || b.po || '—')}</div>
          <div class="text-[10px] text-slate-400">Job: ${escapeHtml(b.layJobNo || '—')} | Dkt: ${escapeHtml(b.docketNo || '—')}</div>
        </td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">${escapeHtml(b.plyRange || (b.startPly && b.endPly ? `${b.startPly}–${b.endPly}` : '—'))}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
            ${isEmb ? 'YES' : 'NO'}
          </span>
        </td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isStored ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'}">
            ${escapeHtml(b.status)}
          </span>
        </td>
        <td class="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
          <div>🏢 ${escapeHtml(b.rackName || '—')} > 📦 ${escapeHtml(b.palletName || '—')}</div>
          ${!isStored && b.dispatchDestination ? `<div class="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Line: ${escapeHtml(b.dispatchDestination)}</div>` : ''}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap">
          <button type="button" onclick="openTagDetailsModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded mr-1 cursor-pointer">Specs</button>
          ${isStored ? `
            <button type="button" onclick="openMoveModal('${escapeHtml(b.tagId)}')" class="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded mr-1 cursor-pointer">Move</button>
            <button type="button" onclick="openDispatchModalSingle('${escapeHtml(b.tagId)}')" class="px-2 py-0.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded cursor-pointer">Dispatch</button>
          ` : `
            <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(b.dispatchDestination || 'Dispatched')}</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function exportLocationInventoryCSV() {
  const list = locAppState.bundleLocations || [];
  if (list.length === 0) {
    showLocToast("No inventory records available to export.", "info");
    return;
  }

  const headers = [
    "Tag ID", "Batch ID", "Bundle Seq", "Shade", "Style", "Color", "Size", "Part",
    "PO / Schedule", "Lay Job No", "Cutting Docket", "Pattern", "EMB", "Ply Range",
    "Start Ply", "End Ply", "Size Ratio", "Ratio Total", "Tag String",
    "Status", "Rack Name", "Pallet Name", "Assigned At", "Dispatched At", "Dispatch Destination", "Dispatch Notes"
  ];

  const rows = list.map(raw => {
    const b = getEnrichedBundle(raw);
    return [
      `"${b.tagId}"`,
      `"${b.batchId || ''}"`,
      `"${b.bundleSeq || ''}"`,
      `"${b.shade || ''}"`,
      `"${b.style || ''}"`,
      `"${b.color || ''}"`,
      `"${b.size || ''}"`,
      `"${b.part || ''}"`,
      `"${b.schedule || b.po || ''}"`,
      `"${b.layJobNo || b.jobNo || ''}"`,
      `"${b.docketNo || b.docket || ''}"`,
      `"${b.patternText || ''}"`,
      `"${b.embellishmentStyle || 'No'}"`,
      `"${b.plyRange || ''}"`,
      `"${b.startPly || ''}"`,
      `"${b.endPly || ''}"`,
      `"${b.sizeRatio || ''}"`,
      `"${b.ratioTotal || ''}"`,
      `"${(b.tagString || '').replace(/"/g, '""')}"`,
      `"${b.status || ''}"`,
      `"${b.rackName || ''}"`,
      `"${b.palletName || ''}"`,
      `"${b.assignedAt || ''}"`,
      `"${b.dispatchedAt || ''}"`,
      `"${b.dispatchDestination || ''}"`,
      `"${(b.dispatchNotes || '').replace(/"/g, '""')}"`
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warehouse_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showLocToast("📊 Warehouse inventory exported to CSV with all bundle tag specifications!", "success");
}

/**
 * ==============================================================================
 * 7. PRINT LOCATION LABELS (Barcodes & QR Codes)
 * ==============================================================================
 */
function openPrintLabelsModal() {
  const modal = document.getElementById('modal-print-labels');
  if (modal) modal.classList.remove('hidden');
  renderPrintableLabelsPreview();
}

function renderPrintableLabelsPreview() {
  const container = document.getElementById('print-labels-preview-container');
  if (!container) return;
  const filterRack = document.getElementById('loc-print-filter-rack')?.value || 'ALL';

  const racks = getSortedRacks();
  const pallets = locAppState.pallets || [];

  let targetRacks = (filterRack === 'ALL') ? racks : racks.filter(r => r.id === filterRack);

  let html = '';
  targetRacks.forEach(r => {
    const rPallets = getSortedPallets(r.id);
    
    // Rack Header Label
    html += `
      <div class="p-4 bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-100 rounded-xl flex items-center justify-between col-span-2 shadow-xs">
        <div>
          <span class="text-[10px] font-black uppercase text-blue-600">WAREHOUSE RACK LOCATION</span>
          <h2 class="text-xl font-black text-slate-900 dark:text-slate-100">${escapeHtml(r.name)}</h2>
          <div class="font-mono font-bold text-xs text-slate-500">${escapeHtml(r.id)} • Zone: ${escapeHtml(r.zone || 'Cutting Floor')}</div>
        </div>
        <div id="qr-rack-${r.id}" class="w-16 h-16 bg-slate-100 flex items-center justify-center rounded"></div>
      </div>
    `;

    // 3 Pallet Labels
    rPallets.forEach(p => {
      html += `
        <div class="p-3 bg-white dark:bg-slate-900 border-2 border-slate-700 dark:border-slate-300 rounded-xl flex items-center justify-between shadow-2xs">
          <div>
            <span class="text-[9px] font-bold uppercase text-amber-600">PALLET STORAGE TIER</span>
            <h3 class="text-base font-black text-slate-900 dark:text-slate-100">${escapeHtml(p.name)}</h3>
            <div class="font-mono font-bold text-[11px] text-slate-500">${escapeHtml(r.name)} > ${escapeHtml(p.name)}</div>
            <div class="text-[10px] text-slate-400">Cap: ${p.capacity} Bundles</div>
          </div>
          <div id="qr-pal-${p.id}" class="w-14 h-14 bg-slate-100 flex items-center justify-center rounded"></div>
        </div>
      `;
    });
  });

  container.innerHTML = html;

  // Generate QR codes
  setTimeout(() => {
    targetRacks.forEach(r => {
      const el = document.getElementById(`qr-rack-${r.id}`);
      if (el && typeof QRCode !== 'undefined') {
        el.innerHTML = '';
        new QRCode(el, { text: `LOC-RACK:${r.id}`, width: 64, height: 64 });
      }
      const rPallets = getSortedPallets(r.id);
      rPallets.forEach(p => {
        const pel = document.getElementById(`qr-pal-${p.id}`);
        if (pel && typeof QRCode !== 'undefined') {
          pel.innerHTML = '';
          new QRCode(pel, { text: `LOC-PAL:${p.id}`, width: 56, height: 56 });
        }
      });
    });
  }, 100);
}

/**
 * ==============================================================================
 * MODAL HELPERS & UTILITIES
 * ==============================================================================
 */
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function openEditRackModal(rId) {
  const rack = (locAppState.racks || []).find(r => r.id === rId);
  if (!rack) return;
  document.getElementById('edit-rack-id').value = rack.id;
  document.getElementById('edit-rack-name').value = rack.name || '';
  document.getElementById('edit-rack-zone').value = rack.zone || '';
  document.getElementById('edit-rack-desc').value = rack.description || '';
  document.getElementById('modal-edit-rack').classList.remove('hidden');
}

async function submitEditRackModal() {
  const rId = document.getElementById('edit-rack-id')?.value;
  const rack = (locAppState.racks || []).find(r => r.id === rId);
  if (!rack) return;

  const rawName = document.getElementById('edit-rack-name')?.value.trim() || rack.name;
  const numMatch = rawName.match(/\d+/);
  if (!numMatch) {
    showLocToast("Rack must be a number (e.g. 1, 2, 3 or Rack 1).", "error");
    return;
  }

  const rackNum = parseInt(numMatch[0], 10);
  const formattedName = `Rack ${rackNum}`;

  rack.name = formattedName;
  rack.zone = document.getElementById('edit-rack-zone')?.value.trim() || rack.zone;
  rack.description = document.getElementById('edit-rack-desc')?.value.trim() || '';

  // Update bundle locations
  (locAppState.bundleLocations || []).forEach(b => {
    if (b.rackId === rId) b.rackName = rack.name;
  });

  await saveLocationSpecs();
  await saveLocationDatabase();
  closeModal('modal-edit-rack');
  renderAllLocationUI();
  showLocToast(`Updated Rack ${rack.name}!`, "success");
}

function openEditPalletModal(pId) {
  const pal = (locAppState.pallets || []).find(p => p.id === pId);
  if (!pal) return;
  document.getElementById('edit-pallet-id').value = pal.id;
  document.getElementById('edit-pallet-name').value = pal.name || '';
  document.getElementById('edit-pallet-cap').value = pal.capacity || 50;
  document.getElementById('edit-pallet-desc').value = pal.description || '';

  const rackSel = document.getElementById('edit-pallet-rack');
  if (rackSel) {
    rackSel.innerHTML = getSortedRacks().map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    rackSel.value = pal.rackId;
  }

  document.getElementById('modal-edit-pallet').classList.remove('hidden');
}

async function submitEditPalletModal() {
  const pId = document.getElementById('edit-pallet-id')?.value;
  const pal = (locAppState.pallets || []).find(p => p.id === pId);
  if (!pal) return;

  pal.name = document.getElementById('edit-pallet-name')?.value.trim() || pal.name;
  pal.rackId = document.getElementById('edit-pallet-rack')?.value || pal.rackId;
  pal.capacity = parseInt(document.getElementById('edit-pallet-cap')?.value, 10) || 50;
  pal.description = document.getElementById('edit-pallet-desc')?.value.trim() || '';

  const parentRack = (locAppState.racks || []).find(r => r.id === pal.rackId);

  (locAppState.bundleLocations || []).forEach(b => {
    if (b.palletId === pId) {
      b.palletName = pal.name;
      if (parentRack) {
        b.rackId = parentRack.id;
        b.rackName = parentRack.name;
      }
    }
  });

  await saveLocationSpecs();
  await saveLocationDatabase();
  closeModal('modal-edit-pallet');
  renderAllLocationUI();
  showLocToast(`Updated Pallet ${pal.name}!`, "success");
}

function openMoveModal(tagId) {
  moveTargetTagId = tagId;
  const modal = document.getElementById('modal-move-bundle');
  const tagInfo = document.getElementById('modal-move-tag-info');
  const rackSel = document.getElementById('modal-move-rack');

  if (tagInfo) tagInfo.textContent = `Tag ID: ${tagId}`;
  if (rackSel) {
    const racks = getSortedRacks();
    rackSel.innerHTML = '<option value="">-- Choose Rack --</option>' + racks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    rackSel.onchange = (e) => onModalMoveRackChange(e.target.value);
    if (racks.length > 0) {
      rackSel.value = racks[0].id;
      onModalMoveRackChange(racks[0].id);
    }
  }
  if (modal) modal.classList.remove('hidden');
}

function onModalMoveRackChange(rackId) {
  const palSel = document.getElementById('modal-move-pallet');
  if (!palSel) return;
  const pallets = getSortedPallets(rackId);
  palSel.innerHTML = pallets.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

async function submitModalMove() {
  if (!moveTargetTagId) return;
  const rackId = document.getElementById('modal-move-rack')?.value;
  const palletId = document.getElementById('modal-move-pallet')?.value;

  if (!rackId || !palletId) {
    showLocToast("Please select target Rack and Pallet.", "error");
    return;
  }

  const tagObj = findTagInDatabase(moveTargetTagId) || { tagId: moveTargetTagId, id: moveTargetTagId };
  await executeAssignSingleTag(tagObj, rackId, palletId);
  closeModal('modal-move-bundle');
  moveTargetTagId = null;
}

function extractTagIdFromScan(raw) {
  if (!raw) return '';
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const j = JSON.parse(raw);
      return j.tagId || j.id || raw;
    } catch(e) {}
  }
  if (raw.includes('tagId=')) {
    const match = raw.match(/tagId=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return raw.trim();
}

/**
 * Checks for a real tag in generated batches or stored locations.
 * Zero dummy fabrication if not found.
 */
function findTagInDatabase(tagId) {
  if (!tagId) return null;
  const cleanId = String(tagId).trim().toUpperCase();

  // 1. Check generated tags from batches
  const match = (locAppState.tags || []).find(t => 
    (t.tagId && String(t.tagId).trim().toUpperCase() === cleanId) || 
    (t.id && String(t.id).trim().toUpperCase() === cleanId)
  );
  if (match) return match;

  // 2. Check stored bundle locations
  const stored = (locAppState.bundleLocations || []).find(b => 
    (b.tagId && String(b.tagId).trim().toUpperCase() === cleanId) ||
    (b.id && String(b.id).trim().toUpperCase() === cleanId)
  );
  if (stored) return stored;

  return null;
}

/**
 * Merges all cut bundle tag fields from master tags dataset and location storage.
 * Ensures all 16+ production parameters (Bundle #, Shade, Style, Color, Size, Part,
 * PO/Schedule, Lay Job, Docket, Pattern, EMB, Ply Range, Ratio, Tag String, Rack, Pallet, Status)
 * are always fully available without dummy fabrication.
 */
function getEnrichedBundle(item) {
  if (!item) return null;
  const tagId = (item.tagId || item.id || '').trim();
  const master = findTagInDatabase(tagId) || {};
  const stored = (locAppState.bundleLocations || []).find(b => (b.tagId || b.id || '').trim().toUpperCase() === tagId.toUpperCase()) || {};

  return {
    tagId: tagId,
    id: tagId,
    batchId: item.batchId || stored.batchId || master.batchId || master.batchTagString || '—',
    style: item.style || stored.style || master.style || '—',
    color: item.color || stored.color || master.color || '—',
    size: item.size || stored.size || master.size || master.baseSize || '—',
    baseSize: master.baseSize || item.baseSize || item.size || stored.size || '—',
    part: item.part || stored.part || master.part || item.partName || stored.partName || '—',
    partName: item.partName || stored.partName || item.part || stored.part || master.part || '—',
    bundleSeq: item.bundleSeq !== undefined && item.bundleSeq !== null && item.bundleSeq !== '' ? item.bundleSeq : (stored.bundleSeq !== undefined && stored.bundleSeq !== null && stored.bundleSeq !== '' ? stored.bundleSeq : (master.bundleSeq !== undefined && master.bundleSeq !== null && master.bundleSeq !== '' ? master.bundleSeq : '—')),
    shade: item.shade || stored.shade || master.shade || '—',
    schedule: item.schedule || stored.schedule || master.schedule || item.po || stored.po || master.po || '—',
    po: item.po || stored.po || master.po || item.schedule || stored.schedule || master.schedule || '—',
    layJobNo: item.layJobNo || stored.layJobNo || master.layJobNo || item.jobNo || stored.jobNo || master.jobNo || '—',
    jobNo: item.jobNo || stored.jobNo || master.jobNo || item.layJobNo || stored.layJobNo || master.layJobNo || '—',
    docketNo: item.docketNo || stored.docketNo || master.docketNo || item.docket || stored.docket || master.docket || '—',
    docket: item.docket || stored.docket || master.docket || item.docketNo || stored.docketNo || master.docketNo || '—',
    patternText: item.patternText || stored.patternText || master.patternText || item.pattern || stored.pattern || master.pattern || '—',
    embellishmentStyle: item.embellishmentStyle || stored.embellishmentStyle || master.embellishmentStyle || 'No',
    plyRange: item.plyRange || stored.plyRange || master.plyRange || (master.startPly && master.endPly ? `${master.startPly}–${master.endPly}` : '—'),
    startPly: item.startPly || stored.startPly || master.startPly || '—',
    endPly: item.endPly || stored.endPly || master.endPly || '—',
    sizeRatio: item.sizeRatio || stored.sizeRatio || master.sizeRatio || '1',
    ratioTotal: item.ratioTotal || stored.ratioTotal || master.ratioTotal || '1',
    tagString: item.tagString || stored.tagString || master.tagString || '—',
    timestamp: item.timestamp || master.timestamp || '—',
    // Storage location fields:
    rackId: stored.rackId || item.rackId || '',
    rackName: stored.rackName || item.rackName || '—',
    palletId: stored.palletId || item.palletId || '',
    palletName: stored.palletName || item.palletName || '—',
    status: stored.status || item.status || 'UNASSIGNED',
    assignedAt: stored.assignedAt || item.assignedAt || '',
    dispatchedAt: stored.dispatchedAt || item.dispatchedAt || '',
    dispatchDestination: stored.dispatchDestination || item.dispatchDestination || '',
    dispatchNotes: stored.dispatchNotes || item.dispatchNotes || ''
  };
}

/**
 * Opens modal inspect view showing ALL information found in a garment bundle tag
 */
function openTagDetailsModal(tagId) {
  const b = getEnrichedBundle({ tagId });
  if (!b || !b.tagId) {
    showLocToast("Tag details could not be found in database.", "error");
    return;
  }

  const modal = document.getElementById('modal-tag-details');
  const titleEl = document.getElementById('tag-modal-id');
  const badgeEl = document.getElementById('tag-modal-status-badge');
  const bodyEl = document.getElementById('tag-modal-body');
  const btnMove = document.getElementById('tag-modal-btn-move');
  const btnDispatch = document.getElementById('tag-modal-btn-dispatch');

  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = b.tagId;

  if (badgeEl) {
    badgeEl.textContent = b.status;
    badgeEl.className = `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-2xs ${
      b.status === 'STORED' ? 'bg-emerald-400 text-slate-950 font-black' : 
      b.status === 'DISPATCHED' ? 'bg-amber-400 text-slate-950 font-black' : 
      'bg-slate-300 text-slate-900 font-bold'
    }`;
  }

  if (btnMove) {
    btnMove.onclick = () => {
      closeModal('modal-tag-details');
      openMoveModal(b.tagId);
    };
  }

  if (btnDispatch) {
    if (b.status === 'STORED') {
      btnDispatch.classList.remove('hidden');
      btnDispatch.onclick = () => {
        closeModal('modal-tag-details');
        openDispatchModalSingle(b.tagId);
      };
    } else {
      btnDispatch.classList.add('hidden');
    }
  }

  const isEmb = (b.embellishmentStyle || '').toLowerCase() === 'yes';

  bodyEl.innerHTML = `
    <!-- Top Summary Banner with QR / Identifier -->
    <div class="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-950/80 dark:to-blue-950/20 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Bundle Unit</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${isEmb ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">
            EMB: ${isEmb ? 'YES' : 'NO'}
          </span>
        </div>
        <h4 class="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">${escapeHtml(b.style)}</h4>
        <p class="text-xs text-slate-600 dark:text-slate-400 font-semibold">${escapeHtml(b.color)}</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="text-right">
          <div class="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">#${escapeHtml(b.bundleSeq)}</div>
          <div class="text-[11px] font-bold text-slate-600 dark:text-slate-400 font-mono">Shade ${escapeHtml(b.shade)}</div>
        </div>
        <div id="tag-modal-qrcode" class="w-14 h-14 bg-white p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"></div>
      </div>
    </div>

    <!-- 2-Column Full Tag Specifications Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Base Size & Part</span>
        <div class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-black text-xs">${escapeHtml(b.size)}</span>
          <span class="text-slate-700 dark:text-slate-300">${escapeHtml(b.part)}</span>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Ply Range & Quantity</span>
        <div class="font-mono font-bold text-slate-900 dark:text-slate-100">
          ${escapeHtml(b.plyRange || (b.startPly && b.endPly ? `${b.startPly}–${b.endPly}` : '—'))}
          <span class="text-[11px] text-slate-400 font-normal">(${b.startPly && b.endPly && !isNaN(b.endPly) ? (parseInt(b.endPly, 10) - parseInt(b.startPly, 10) + 1) + ' Plys' : '30 Plys'})</span>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">PO / Schedule No</span>
        <div class="font-mono font-bold text-slate-900 dark:text-slate-100">${escapeHtml(b.schedule || b.po || '—')}</div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Lay Job No & Pattern</span>
        <div class="font-mono font-bold text-slate-900 dark:text-slate-100">
          ${escapeHtml(b.layJobNo || b.jobNo || '—')}
          ${b.patternText && b.patternText !== '—' ? `<span class="text-[10px] text-slate-400 font-sans ml-1">(${escapeHtml(b.patternText)})</span>` : ''}
        </div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Cutting Docket No</span>
        <div class="font-mono font-bold text-slate-900 dark:text-slate-100">${escapeHtml(b.docketNo || b.docket || '—')}</div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Size Ratio & Ratio Total</span>
        <div class="font-mono font-bold text-slate-900 dark:text-slate-100">${escapeHtml(b.sizeRatio)} / Ratio Total: ${escapeHtml(b.ratioTotal)}</div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1 col-span-1 sm:col-span-2">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Full Bundle Tag String</span>
        <div class="font-mono text-xs text-slate-700 dark:text-slate-300 break-all bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">${escapeHtml(b.tagString)}</div>
      </div>

      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1 col-span-1 sm:col-span-2">
        <span class="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Production Batch Identifier & Generation Timestamp</span>
        <div class="font-mono text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between flex-wrap gap-1">
          <span class="font-bold text-blue-600 dark:text-blue-400">${escapeHtml(b.batchId)}</span>
          <span class="text-[11px] text-slate-400">${escapeHtml(b.timestamp)}</span>
        </div>
      </div>
    </div>

    <!-- Storage Location Status Box -->
    <div class="p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl space-y-2 text-xs">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Warehouse Floor Storage Status</span>
        <span class="font-black text-xs ${b.status === 'STORED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${escapeHtml(b.status)}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-[10px] text-slate-400 block">Warehouse Location:</span>
          <span class="font-bold text-slate-900 dark:text-slate-100">${b.rackName !== '—' ? `🏢 ${escapeHtml(b.rackName)} > 📦 ${escapeHtml(b.palletName)}` : 'Unassigned (Floor Buffer)'}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Assigned Timestamp:</span>
          <span class="font-mono text-[11px] text-slate-600 dark:text-slate-400">${b.assignedAt ? new Date(b.assignedAt).toLocaleString() : '—'}</span>
        </div>
        ${b.status === 'DISPATCHED' ? `
          <div class="col-span-1 sm:col-span-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
            <span class="text-[10px] text-slate-400 block">Dispatched To:</span>
            <span class="font-bold text-amber-600 dark:text-amber-400">🚀 ${escapeHtml(b.dispatchDestination)} ${b.dispatchedAt ? `(${new Date(b.dispatchedAt).toLocaleString()})` : ''}</span>
            ${b.dispatchNotes ? `<p class="text-[11px] text-slate-400 mt-0.5">Notes: ${escapeHtml(b.dispatchNotes)}</p>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Render QR Code if library available
  setTimeout(() => {
    const qrContainer = document.getElementById('tag-modal-qrcode');
    if (qrContainer && typeof QRCode !== 'undefined') {
      qrContainer.innerHTML = '';
      try {
        new QRCode(qrContainer, {
          text: b.tagId,
          width: 56,
          height: 56,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch(e) {}
    }
  }, 50);

  modal.classList.remove('hidden');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showLocToast(msg, type = 'info') {
  const container = document.getElementById('loc-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-slate-950 font-bold',
    info: 'bg-slate-900 text-white'
  };
  toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom duration-200 ${colors[type] || colors.info}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function updateThemeToggleUI(isDark) {
  const icon = document.getElementById('loc-theme-toggle-icon');
  const btn = document.getElementById('loc-theme-toggle-btn');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (btn) btn.title = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';
}

function initLocDarkMode() {
  const saved = localStorage.getItem('theme');
  const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  updateThemeToggleUI(isDark);
}

function toggleLocDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeToggleUI(isDark);
  showLocToast(isDark ? "🌙 Dark mode enabled" : "☀️ Light mode enabled", "info");
}

// Global Keyboard Shortcuts (Press / for search, 1-6 for tabs, Esc to blur/close)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // If inside an input/select/textarea
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }
    // Search focus shortcut: /
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const searchInp = document.getElementById('loc-explorer-search');
      if (searchInp) {
        searchInp.focus();
        searchInp.select();
      }
    }
    // Tab switching shortcuts: 1-6
    if (e.key === '1') switchLocationTab('explorer');
    if (e.key === '2') switchLocationTab('scan');
    if (e.key === '3') switchLocationTab('assign');
    if (e.key === '4') switchLocationTab('dispatch');
    if (e.key === '5') switchLocationTab('setup');
    if (e.key === '6') switchLocationTab('audit');
  });
}

// Initialize on page load
window.onload = async function() {
  initLocDarkMode();
  await initLocationDataSync();
  purgeInjectedExtensionElements();
};

function purgeInjectedExtensionElements() {
  try {
    // Remove stray injected browser extension elements
    const validRootIds = new Set([
      'app-root-container', 'loc-toast-container', 'toast-container', 'loading-overlay',
      'loc-kpi-bar', 'modal-edit-rack', 'modal-edit-pallet', 'modal-move-bundle', 'modal-dispatch', 'modal-print-labels', 'modal-tag-details'
    ]);
    const validTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META', 'HEADER', 'NAV', 'MAIN', 'FOOTER', 'SECTION', 'ASIDE']);
    Array.from(document.body.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim()) { node.remove(); return; }
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (validTags.has(node.tagName)) return;
        if (!validRootIds.has(node.id)) {
          // Only remove if it's an extension injected overlay
          if (node.className && (node.className.includes('extension') || node.className.includes('inject'))) {
            node.remove();
          }
        }
      }
    });
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', purgeInjectedExtensionElements);
  window.addEventListener('beforeprint', purgeInjectedExtensionElements);
  try {
    let _purgeTimer = null;
    const _extObs = new MutationObserver(() => {
      // Debounce: only run purge once per 800ms even if many mutations fire
      if (_purgeTimer) clearTimeout(_purgeTimer);
      _purgeTimer = setTimeout(purgeInjectedExtensionElements, 800);
    });
    // Only observe direct children of body (not deep subtree) to avoid performance issues
    _extObs.observe(document.body, { childList: true });
  } catch (e) {}
  // Fallback interval at 5s (MutationObserver handles real-time)
  setInterval(purgeInjectedExtensionElements, 5000);
}
