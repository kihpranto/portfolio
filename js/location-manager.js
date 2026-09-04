/**
 * GarmentTag Warehouse Racks, Pallets & Inventory Location Manager
 */

if (!window.appLocationState) {
  window.appLocationState = {
    appName: "GarmentTag Location Management",
    version: "1.0",
    updatedAt: new Date().toISOString(),
    racks: [],
    pallets: [],
    bundleLocations: [],
    history: []
  };
}
appLocationState = window.appLocationState;
let activeLocationSubTab = 'explorer';
let expandedPalletIds = new Set();
let currentScannedTagObj = null;
let selectedBatchBundleIds = new Set();
let moveTargetTagId = null;
let dispatchTargetTagIds = [];
let masterSetupSortColumn = 'name';
let masterSetupSortDirection = 'asc';
let sessionSortColumn = 'time';
let sessionSortDirection = 'desc';
let historySortColumn = 'timestamp';
let historySortDirection = 'desc';
let auditCurrentPage = 1;
const auditPageSize = 100;
let auditSortColumn = 'assignedAt';
let auditSortDirection = 'desc';

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

async function loadLocationDatabase() {
  // Render current in-memory state immediately so UI never appears empty
  renderLocationManagementUI();

  try {
    const spRes = await fetch(getApiUrl('/api/specs?_t=' + Date.now()), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
    });
    if (spRes.ok) {
      const spJson = await spRes.json();
      if (spJson.success && spJson.data) {
        if (Array.isArray(spJson.data.racks) && spJson.data.racks.length > 0) appLocationState.racks = spJson.data.racks;
        if (Array.isArray(spJson.data.pallets) && spJson.data.pallets.length > 0) appLocationState.pallets = spJson.data.pallets;
        if (Array.isArray(spJson.data.sizes)) appState.sizes = spJson.data.sizes;
        if (Array.isArray(spJson.data.parts)) appState.parts = spJson.data.parts;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(getApiUrl('/api/location-data?_t=' + Date.now()), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        if (Array.isArray(json.data.racks) && json.data.racks.length > 0) appLocationState.racks = json.data.racks;
        if (Array.isArray(json.data.pallets) && json.data.pallets.length > 0) appLocationState.pallets = json.data.pallets;
        appLocationState.bundleLocations = Array.isArray(json.data.bundleLocations) ? json.data.bundleLocations : [];
        appLocationState.history = Array.isArray(json.data.history) ? json.data.history : [];
        if (json.mtime) lastLocationMtime = json.mtime;
        isLocationConnected = true;
        renderLocationManagementUI();
        updateSidebarLocationCount();
        if (typeof updateStatusBadgesUI === 'function') updateStatusBadgesUI();
        if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
        return;
      }
    }
  } catch (e) {
    console.warn('[LIVE] Could not load location data from server:', e);
  }

  // Preserve local/imported racks and pallets if already loaded
  if ((appLocationState.racks && appLocationState.racks.length > 0) || (appState.racks && appState.racks.length > 0)) {
    if (!appLocationState.racks || appLocationState.racks.length === 0) appLocationState.racks = appState.racks || [];
    if (!appLocationState.pallets || appLocationState.pallets.length === 0) appLocationState.pallets = appState.pallets || [];
    renderLocationManagementUI();
    updateSidebarLocationCount();
    return;
  }

  isLocationConnected = false;
  renderLocationManagementUI();
  updateSidebarLocationCount();
  if (typeof updateStatusBadgesUI === 'function') updateStatusBadgesUI();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
}

async function saveLocationDatabase() {
  const specsPayload = {
    sizes: appState.sizes || [],
    parts: appState.parts || [],
    racks: appLocationState.racks || [],
    pallets: appLocationState.pallets || []
  };

  try {
    await fetch(getApiUrl('/api/specs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(specsPayload)
    });
  } catch (e) {}

  if (activeDirectoryHandle) {
    try {
      const spHandle = await activeDirectoryHandle.getFileHandle('garment_specs_data.jsonl', { create: true });
      const spW = await spHandle.createWritable();
      const spLines = [
        JSON.stringify({ type: 'meta', appName: "GarmentTag Specs Data", version: "1.0", updatedAt: new Date().toISOString() }),
        JSON.stringify({ type: 'sizes', items: appState.sizes || [] }),
        JSON.stringify({ type: 'parts', items: appState.parts || [] })
      ];
      (appLocationState.racks || []).forEach(r => spLines.push(JSON.stringify({ type: 'rack', ...r })));
      (appLocationState.pallets || []).forEach(p => spLines.push(JSON.stringify({ type: 'pallet', ...p })));
      await spW.write(spLines.join('\n') + '\n');
      await spW.close();
    } catch(e) {}
  }

  const locationPayload = {
    appName: "GarmentTag Location Management",
    version: "1.0",
    updatedAt: new Date().toISOString(),
    bundleLocations: appLocationState.bundleLocations || [],
    history: appLocationState.history || []
  };

  try {
    const res = await fetch(getApiUrl('/api/location-data'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(locationPayload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.mtime) lastLocationMtime = json.mtime;
      if (typeof flashSyncIndicator === 'function') flashSyncIndicator();
    }
  } catch (e) {}

  if (activeDirectoryHandle) {
    try {
      const locHandle = await activeDirectoryHandle.getFileHandle('garment_location_data.jsonl', { create: true });
      const writable = await locHandle.createWritable();
      const locLines = [
        JSON.stringify({ type: 'meta', appName: "GarmentTag Location Management", version: "1.0", updatedAt: new Date().toISOString() })
      ];
      (appLocationState.bundleLocations || []).forEach(loc => locLines.push(JSON.stringify({ type: 'location', ...loc })));
      (appLocationState.history || []).forEach(h => locLines.push(JSON.stringify({ type: 'history', ...h })));
      await writable.write(locLines.join('\n') + '\n');
      await writable.close();
      if (typeof flashSyncIndicator === 'function') flashSyncIndicator();
    } catch(e) {
      console.warn("Direct directory location JSONL write error:", e);
    }
  }

  renderLocationManagementUI();
  updateSidebarLocationCount();
}

async function reloadLocationData() {
  showLoading("Syncing live Location Database...");
  await loadLocationDatabase();
  hideLoading();
  showToast("🟢 Live Location Database Synced!", "success");
}

const ALL_LOCATION_SUBTABS = ['explorer', 'scan', 'assign', 'dispatch', 'setup', 'audit'];

const LOCATION_SUBTAB_TITLES = {
  'explorer': 'Floor & Pallets',
  'scan': 'Quick Scan & Assign',
  'assign': 'Batch Assign',
  'dispatch': 'Dispatch from Storage',
  'setup': 'Master Rack Setup',
  'audit': 'Inventory Search & Audit'
};

function switchLocationSubTab(subTab) {
  const targetSub = ALL_LOCATION_SUBTABS.includes(subTab) ? subTab : 'explorer';
  activeLocationSubTab = targetSub;

  // 1. Show/Hide subviews and highlight corresponding sidebar subtab item
  ALL_LOCATION_SUBTABS.forEach(st => {
    const viewEl = document.getElementById(`loc-subview-${st}`);
    if (viewEl) viewEl.classList.toggle('hidden', st !== targetSub);

    const sidebarSubBtn = document.getElementById(`sidebar-loc-sub-${st}`);
    if (sidebarSubBtn) {
      if (st === targetSub) {
        sidebarSubBtn.className = "sidebar-sub-item w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-500 text-slate-950 shadow-xs transition cursor-pointer text-left font-bold";
      } else {
        sidebarSubBtn.className = "sidebar-sub-item w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left";
      }
    }
  });

  // 2. Ensure Location Manager parent button is active and submenu is expanded
  const locParentBtn = document.getElementById('tab-location');
  if (locParentBtn) {
    locParentBtn.classList.add('nav-item-active');
    locParentBtn.classList.remove('nav-item-inactive');
  }

  const subMenu = document.getElementById('sidebar-location-subtabs');
  const arrow = document.getElementById('sidebar-loc-arrow');
  if (subMenu) subMenu.classList.remove('hidden');
  if (arrow) arrow.style.transform = 'rotate(0deg)';

  // 3. Update top breadcrumb path
  const breadcrumbEl = document.getElementById('nav-breadcrumb');
  if (breadcrumbEl) {
    const subTitle = LOCATION_SUBTAB_TITLES[targetSub] || 'Location Manager';
    breadcrumbEl.innerHTML = `
      <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-amber-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>Location Manager</span>
      </span>
      <span class="text-slate-300 dark:text-slate-600">/</span>
      <span class="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <span>${subTitle}</span>
      </span>
    `;
  }

  if (targetSub === 'scan') {
    setTimeout(() => {
      const input = document.getElementById('loc-scan-input');
      if (input) input.focus();
    }, 100);
  }
  renderLocationManagementUI();
}

function updateSidebarLocationCount() {
  const badge = document.getElementById('sidebar-location-count');
  if (badge) {
    const storedCount = (appLocationState.bundleLocations || []).filter(b => b.status === 'STORED').length;
    badge.textContent = storedCount > 999 ? `${(storedCount/1000).toFixed(1)}k` : storedCount;
  }
}

function renderLocationMetrics() {
  const racks = appLocationState.racks || [];
  const pallets = appLocationState.pallets || [];
  const bundleLocs = appLocationState.bundleLocations || [];

  const storedBundles = bundleLocs.filter(b => b.status === 'STORED');
  const dispatchedBundles = bundleLocs.filter(b => b.status === 'DISPATCHED');

  const totalCap = pallets.reduce((sum, p) => sum + (parseInt(p.capacity, 10) || 50), 0);
  const utilPercent = totalCap > 0 ? Math.min(100, Math.round((storedBundles.length / totalCap) * 100)) : 0;

  const zones = new Set(racks.map(r => r.zone).filter(Boolean));

  const racksEl = document.getElementById('loc-metric-racks');
  const zonesEl = document.getElementById('loc-metric-zones');
  const palletsEl = document.getElementById('loc-metric-pallets');
  const capEl = document.getElementById('loc-metric-capacity');
  const storedEl = document.getElementById('loc-metric-stored');
  const dispEl = document.getElementById('loc-metric-dispatched');
  const utilEl = document.getElementById('loc-metric-utilization');
  const progEl = document.getElementById('loc-metric-progress');

  if (racksEl) racksEl.textContent = racks.length;
  if (zonesEl) zonesEl.textContent = `${zones.size} Active Zone${zones.size === 1 ? '' : 's'}`;
  if (palletsEl) palletsEl.textContent = pallets.length;
  if (capEl) capEl.textContent = `Max ${totalCap} Bundles`;
  if (storedEl) storedEl.textContent = storedBundles.length;
  if (dispEl) dispEl.textContent = `${dispatchedBundles.length} Dispatched`;
  if (utilEl) utilEl.textContent = `${utilPercent}%`;
  if (progEl) {
    progEl.style.width = `${utilPercent}%`;
    if (utilPercent > 85) progEl.className = "bg-rose-500 h-full transition-all duration-300";
    else if (utilPercent > 60) progEl.className = "bg-amber-500 h-full transition-all duration-300";
    else progEl.className = "bg-emerald-500 h-full transition-all duration-300";
  }
}

function renderLocationManagementUI() {
  renderLocationMetrics();
  populateLocationDropdowns();
  renderRackPills();
  renderPalletPills();
  renderRackPalletSetupTable();
  if (activeLocationSubTab === 'explorer') {
    renderRackPalletExplorer();
  } else if (activeLocationSubTab === 'scan') {
    renderScanStationUI();
  } else if (activeLocationSubTab === 'assign') {
    renderQuickAssignUI();
  } else if (activeLocationSubTab === 'audit') {
    renderLocationAuditTable();
  }
  updateSidebarLocationCount();
}

function renderRackPills() {
  const container = document.getElementById('racks-pill-list');
  const countEl = document.getElementById('racks-pill-count');
  if (!container) return;

  const racks = appLocationState.racks || [];
  const pallets = appLocationState.pallets || [];
  if (countEl) countEl.textContent = `${racks.length} Rack${racks.length === 1 ? '' : 's'}`;

  if (racks.length === 0) {
    container.innerHTML = `<span class="text-slate-400 text-xs italic">No storage racks added yet.</span>`;
    return;
  }

  container.innerHTML = racks.map(r => {
    const palCount = pallets.filter(p => p.rackId === r.id).length;
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs hover:border-blue-300 dark:hover:border-blue-700 transition">
        <span class="text-blue-600 dark:text-blue-400">🏢</span>
        <span class="cursor-pointer" onclick="selectRackForPalletCreation('${escapeHtml(r.id)}')" title="Click to select for Pallet creation">${escapeHtml(r.name)}</span>
        <span class="text-[10px] px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 rounded-md font-mono">${palCount} Pal</span>
        <button type="button" onclick="selectRackForPalletCreation('${escapeHtml(r.id)}')" title="Add Pallet under ${escapeHtml(r.name)}" class="text-indigo-600 dark:text-indigo-400 hover:scale-110 text-xs font-bold cursor-pointer">➕</button>
        <button type="button" onclick="openEditRackModal('${escapeHtml(r.id)}')" title="Edit Rack" class="text-slate-400 hover:text-blue-600 text-xs font-bold cursor-pointer">✏️</button>
        <button type="button" onclick="deleteRack('${escapeHtml(r.id)}')" class="text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer" title="Delete Rack">✕</button>
      </span>
    `;
  }).join('');
}

function selectRackForPalletCreation(rackId) {
  const rackSelect = document.getElementById('pallet-form-rack');
  if (rackSelect) {
    rackSelect.value = rackId;
    const palNameInput = document.getElementById('pallet-form-name');
    if (palNameInput) {
      if (typeof palNameInput.focus === 'function') palNameInput.focus();
      if (typeof palNameInput.scrollIntoView === 'function') palNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function renderPalletPills() {
  const container = document.getElementById('pallets-pill-list');
  const countEl = document.getElementById('pallets-pill-count');
  if (!container) return;

  const pallets = appLocationState.pallets || [];
  const racks = appLocationState.racks || [];
  if (countEl) countEl.textContent = `${pallets.length} Pallet${pallets.length === 1 ? '' : 's'}`;

  if (pallets.length === 0) {
    container.innerHTML = `<span class="text-slate-400 text-xs italic">No pallets created yet.</span>`;
    return;
  }

  container.innerHTML = pallets.map(p => {
    const rack = racks.find(r => r.id === p.rackId);
    const rackName = rack ? rack.name : p.rackId;
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs">
        <span class="text-indigo-600 dark:text-indigo-400">📦</span>
        <span>${escapeHtml(p.name)}</span>
        <span class="text-[10px] px-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold truncate max-w-[80px]">${escapeHtml(rackName)}</span>
        <button type="button" onclick="openEditPalletModal('${escapeHtml(p.id)}')" title="Edit Pallet" class="text-slate-400 hover:text-blue-600 text-xs font-bold cursor-pointer">✏️</button>
        <button type="button" onclick="deletePallet('${escapeHtml(p.id)}')" class="text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer" title="Delete Pallet">✕</button>
      </span>
    `;
  }).join('');
}

function populateLocationDropdowns(selectedRackId) {
  const racks = appLocationState.racks || [];

  const expRackSelect = document.getElementById('loc-explorer-rack-filter');
  if (expRackSelect) {
    const curVal = expRackSelect.value;
    let html = '<option value="ALL">🏢 All Storage Racks</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Main')})</option>`;
    });
    expRackSelect.innerHTML = html;
    if (curVal && racks.some(r => r.id === curVal)) {
      expRackSelect.value = curVal;
    } else {
      expRackSelect.value = 'ALL';
    }
  }

  const scanRack = document.getElementById('loc-scan-target-rack');
  if (scanRack) {
    const curRack = scanRack.value || (racks[0] ? racks[0].id : '');
    let html = '<option value="">-- Select Rack --</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    scanRack.innerHTML = html;
    if (curRack) scanRack.value = curRack;
    onScanTargetRackChange(scanRack.value);
  }

  const batchRack = document.getElementById('loc-batch-target-rack');
  if (batchRack) {
    const curRack = batchRack.value || (racks[0] ? racks[0].id : '');
    let html = '<option value="">Rack</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    batchRack.innerHTML = html;
    if (curRack) batchRack.value = curRack;
    onBatchTargetRackChange(batchRack.value);
  }

  const palFormRack = document.getElementById('pallet-form-rack');
  if (palFormRack) {
    const cur = selectedRackId || palFormRack.value;
    let html = '<option value="">-- Choose Rack --</option>';
    racks.forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Main')})</option>`;
    });
    palFormRack.innerHTML = html;
    if (cur && racks.some(r => r.id === cur)) {
      palFormRack.value = cur;
    } else if (racks.length > 0) {
      palFormRack.value = racks[racks.length - 1].id;
    }
  }

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

  const batchSourceSelect = document.getElementById('loc-batch-source-select');
  const storedTagIds = new Set((appLocationState.bundleLocations || []).filter(b => b.status === 'STORED').map(b => b.tagId));
  const logs = appState.logs || [];
  const sortedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(b.batchId || b.id || '').localeCompare(String(a.batchId || a.id || ''));
  });

  if (batchSourceSelect) {
    const curVal = batchSourceSelect.value;
    let html = '';
    
    const hasCurrent = (appState.generatedTags || []).length > 0;
    if (hasCurrent) {
      const curUnassigned = (appState.generatedTags || []).filter(t => !storedTagIds.has(t.id || t.tagId || t.qrData || t.tagString)).length;
      html += `<option value="CURRENT">⚡ Current Generated Batch (${curUnassigned} unassigned)</option>`;
    }

    const allKnown = [];
    (appState.generatedTags || []).forEach(t => allKnown.push(t));
    (appState.allStoredTags || []).forEach(t => allKnown.push(t));
    logs.forEach(l => extractTagsFromBatchLog(l).forEach(t => allKnown.push(t)));
    const uniqueUnassigned = new Set();
    allKnown.forEach(t => {
      const id = t.id || t.tagId || t.qrData || t.tagString;
      if (id && !storedTagIds.has(id)) uniqueUnassigned.add(id);
    });

    html += `<option value="ALL_UNASSIGNED">📦 All Unassigned Bundles (${uniqueUnassigned.size} available)</option>`;
    html += `<option value="ALL_BATCHES">🌐 All Batches Combined (${uniqueUnassigned.size} unassigned)</option>`;

    sortedLogs.forEach(l => {
      const bId = l.batchId || l.id;
      let tags = [];
      if (Array.isArray(l.tags) && l.tags.length > 0) {
        tags = l.tags;
      } else {
        const storedMatches = (appState.allStoredTags || []).filter(t => (t.batchId || t.batchTagString) === bId);
        tags = storedMatches.length > 0 ? storedMatches : extractTagsFromBatchLog(l);
      }
      const unassignedCount = tags.filter(t => !storedTagIds.has(t.id || t.tagId || t.qrData || t.tagString)).length;
      const tagCount = tags.length;
      const styleStr = l.style ? `[${l.style}]` : '';
      const colorStr = l.color ? `${l.color}` : '';
      const jobStr = l.layJobNo || l.jobNo ? `(Job: ${l.layJobNo || l.jobNo})` : '';
      const dateStr = l.createdAt ? `• ${new Date(l.createdAt).toLocaleDateString()}` : '';
      html += `<option value="${bId}">🏷️ ${escapeHtml(bId)} ${escapeHtml(styleStr)} ${escapeHtml(colorStr)} ${escapeHtml(jobStr)} (${unassignedCount} unassigned / ${tagCount} tags) ${escapeHtml(dateStr)}</option>`;
    });

    batchSourceSelect.innerHTML = html;

    if (curVal && batchSourceSelect.querySelector(`option[value="${curVal}"]`)) {
      batchSourceSelect.value = curVal;
    } else {
      batchSourceSelect.value = 'ALL_UNASSIGNED';
    }
  }

  // Populate Dispatch Source Dropdown
  const dispatchSourceSelect = document.getElementById('loc-dispatch-source-select');
  if (dispatchSourceSelect) {
    const curVal = dispatchSourceSelect.value;
    let dHtml = '';
    const storedList = (appLocationState.bundleLocations || []).filter(b => b.status === 'STORED');
    dHtml += `<option value="ALL_STORED">📦 All Stored Bundles in Warehouse (${storedList.length} stored)</option>`;

    const batchStoredCount = {};
    storedList.forEach(b => {
      const bId = b.batchId || 'UNKNOWN';
      batchStoredCount[bId] = (batchStoredCount[bId] || 0) + 1;
    });

    sortedLogs.forEach(l => {
      const bId = l.batchId || l.id;
      const storedInBatch = batchStoredCount[bId] || 0;
      if (storedInBatch > 0) {
        const styleStr = l.style ? `[${l.style}]` : '';
        const colorStr = l.color ? `${l.color}` : '';
        const jobStr = l.layJobNo || l.jobNo ? `(Job: ${l.layJobNo || l.jobNo})` : '';
        const dateStr = l.createdAt ? `• ${new Date(l.createdAt).toLocaleDateString()}` : '';
        dHtml += `<option value="${bId}">🏷️ ${escapeHtml(bId)} ${escapeHtml(styleStr)} ${escapeHtml(colorStr)} ${escapeHtml(jobStr)} (${storedInBatch} in storage) ${escapeHtml(dateStr)}</option>`;
      }
    });

    dispatchSourceSelect.innerHTML = dHtml;
    if (curVal && dispatchSourceSelect.querySelector(`option[value="${curVal}"]`)) {
      dispatchSourceSelect.value = curVal;
    } else {
      dispatchSourceSelect.value = 'ALL_STORED';
    }
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('loc-explorer-rack-filter');
    refreshSearchableSelect('loc-scan-target-rack');
    refreshSearchableSelect('loc-scan-target-pallet');
    refreshSearchableSelect('loc-batch-source-select');
    refreshSearchableSelect('loc-batch-target-rack');
    refreshSearchableSelect('loc-batch-target-pallet');
    refreshSearchableSelect('loc-dispatch-source-select');
    refreshSearchableSelect('loc-dispatch-destination');
    refreshSearchableSelect('pallet-form-rack');
    refreshSearchableSelect('loc-print-filter-rack');
  }
}

function onScanTargetRackChange(rackId) {
  const palletSelect = document.getElementById('loc-scan-target-pallet');
  if (!palletSelect) return;
  const pallets = (appLocationState.pallets || []).filter(p => p.rackId === rackId);
  let html = '<option value="">-- Select Pallet --</option>';
  pallets.forEach(p => {
    const storedCount = (appLocationState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
    html += `<option value="${p.id}">${escapeHtml(p.name)} (${storedCount}/${p.capacity})</option>`;
  });
  palletSelect.innerHTML = html;
  if (pallets.length > 0) palletSelect.value = pallets[0].id;
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('loc-scan-target-pallet');
}

function onBatchTargetRackChange(rackId) {
  const palletSelect = document.getElementById('loc-batch-target-pallet');
  if (!palletSelect) return;
  const pallets = (appLocationState.pallets || []).filter(p => p.rackId === rackId);
  let html = '<option value="">Pallet</option>';
  pallets.forEach(p => {
    const storedCount = (appLocationState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
    html += `<option value="${p.id}">${escapeHtml(p.name)} (${storedCount}/${p.capacity})</option>`;
  });
  palletSelect.innerHTML = html;
  if (pallets.length > 0) palletSelect.value = pallets[0].id;
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('loc-batch-target-pallet');
}

function onModalMoveRackChange(rackId) {
  const palletSelect = document.getElementById('loc-modal-move-pallet');
  if (!palletSelect) return;
  const pallets = (appLocationState.pallets || []).filter(p => p.rackId === rackId);
  let html = '<option value="">Select Pallet</option>';
  pallets.forEach(p => {
    const storedCount = (appLocationState.bundleLocations || []).filter(b => b.palletId === p.id && b.status === 'STORED').length;
    html += `<option value="${p.id}">${escapeHtml(p.name)} (${storedCount}/${p.capacity})</option>`;
  });
  palletSelect.innerHTML = html;
  if (pallets.length > 0) palletSelect.value = pallets[0].id;
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('loc-modal-move-pallet');
}

let collapsedRackIds = new Set();
let rackExplorerPage = 1;
const RACKS_PER_PAGE = 10;

function toggleRackAccordion(rId) {
  if (collapsedRackIds.has(rId)) {
    collapsedRackIds.delete(rId);
  } else {
    collapsedRackIds.add(rId);
  }
  renderRackPalletExplorer();
}

function expandAllRacks() {
  collapsedRackIds.clear();
  renderRackPalletExplorer();
}

function collapseAllRacks() {
  (appLocationState.racks || []).forEach(r => collapsedRackIds.add(r.id));
  renderRackPalletExplorer();
}

function goToRackPage(page) {
  rackExplorerPage = page;
  renderRackPalletExplorer();
  const grid = document.getElementById('loc-explorer-grid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function togglePalletAccordion(pId) {
  if (expandedPalletIds.has(pId)) {
    expandedPalletIds.delete(pId);
  } else {
    expandedPalletIds.add(pId);
  }
  renderRackPalletExplorer();
}

function expandAllPallets() {
  (appLocationState.pallets || []).forEach(p => expandedPalletIds.add(p.id));
  renderRackPalletExplorer();
}

function collapseAllPallets() {
  expandedPalletIds.clear();
  renderRackPalletExplorer();
}

function renderRackPalletExplorer() {
  const container = document.getElementById('loc-explorer-grid');
  if (!container) return;

  const rawFilter = document.getElementById('loc-explorer-rack-filter')?.value;
  const filterRackId = (!rawFilter || rawFilter === 'ALL') ? 'ALL' : rawFilter;
  const searchQ = (document.getElementById('loc-explorer-search')?.value || '').toLowerCase().trim();

  const allRacks = appLocationState.racks || [];
  const allPallets = appLocationState.pallets || [];
  const allBundles = appLocationState.bundleLocations || [];

  let filteredRacks = (filterRackId === 'ALL') ? allRacks : allRacks.filter(r => r.id === filterRackId);

  // Fallback: If filter returned no racks but racks exist and not searching, show all racks
  if (filteredRacks.length === 0 && allRacks.length > 0 && !searchQ) {
    filteredRacks = allRacks;
    const expRackSelect = document.getElementById('loc-explorer-rack-filter');
    if (expRackSelect) expRackSelect.value = 'ALL';
  }

  // If search query is entered, search across rack names, pallet names, and bundles stored
  if (searchQ) {
    filteredRacks = filteredRacks.filter(rack => {
      if ((rack.name || '').toLowerCase().includes(searchQ) || (rack.zone || '').toLowerCase().includes(searchQ) || (rack.id || '').toLowerCase().includes(searchQ)) {
        return true;
      }
      const rackPallets = allPallets.filter(p => p.rackId === rack.id);
      const rackPalletIds = new Set(rackPallets.map(p => p.id));
      if (rackPallets.some(p => (p.name || '').toLowerCase().includes(searchQ) || (p.id || '').toLowerCase().includes(searchQ))) {
        return true;
      }
      return allBundles.some(b => 
        (rackPalletIds.has(b.palletId) || b.rackId === rack.id) &&
        b.status === 'STORED' &&
        ((b.style || '').toLowerCase().includes(searchQ) ||
         (b.color || '').toLowerCase().includes(searchQ) ||
         (b.part || '').toLowerCase().includes(searchQ) ||
         (b.tagId || '').toLowerCase().includes(searchQ) ||
         (b.size || '').toLowerCase().includes(searchQ))
      );
    });
  }

  if (filteredRacks.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-400">
        <div class="text-3xl mb-2">🏢</div>
        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300">No Storage Racks Found</h4>
        <p class="text-xs text-slate-400 mt-1">${searchQ ? 'No racks match your search query.' : 'Click <strong>+ New Rack</strong> above to create your first warehouse rack.'}</p>
      </div>
    `;
    return;
  }

  const totalRacks = filteredRacks.length;
  const totalPages = Math.ceil(totalRacks / RACKS_PER_PAGE);
  if (rackExplorerPage > totalPages) rackExplorerPage = totalPages;
  if (rackExplorerPage < 1) rackExplorerPage = 1;
  const startIdx = (rackExplorerPage - 1) * RACKS_PER_PAGE;
  const endIdx = Math.min(startIdx + RACKS_PER_PAGE, totalRacks);
  const pageRacks = filteredRacks.slice(startIdx, endIdx);

  let html = '';

  if (totalPages > 1) {
    html += buildRackPaginationBar(rackExplorerPage, totalPages, totalRacks, startIdx + 1, endIdx);
  }

  pageRacks.forEach(rack => {
    const rackPallets = allPallets.filter(p => p.rackId === rack.id);
    const rackBundles = allBundles.filter(b => b.rackId === rack.id && b.status === 'STORED');
    const isRackCollapsed = collapsedRackIds.has(rack.id) && searchQ.length === 0;

    html += `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 space-y-4 transition-all duration-200">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 select-none">
          <div class="flex items-center gap-2.5 cursor-pointer flex-1" onclick="toggleRackAccordion('${rack.id}')" title="Click to ${isRackCollapsed ? 'Expand' : 'Collapse'} ${escapeHtml(rack.name)}">
            <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-200 dark:border-blue-800 shrink-0">
              🏢
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-xs font-extrabold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition">${escapeHtml(rack.name)}</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">${escapeHtml(rack.id)}</span>
                <button type="button" onclick="event.stopPropagation(); toggleRackAccordion('${rack.id}')" class="px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 rounded-md border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer">
                  ${isRackCollapsed ? `▼ Expand (${rackPallets.length} Pallets)` : `▲ Collapse`}
                </button>
              </div>
              <p class="text-[10px] text-slate-400 font-medium mt-0.5">Zone: ${escapeHtml(rack.zone || 'Cutting Floor')} • ${escapeHtml(rack.description || 'General storage')}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2.5 py-1 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              ${rackPallets.length} Pallet${rackPallets.length === 1 ? '' : 's'} • ${rackBundles.length} Bundles Stored
            </span>
            <button type="button" onclick="toggleRackAccordion('${rack.id}')" title="${isRackCollapsed ? 'Expand Rack' : 'Collapse Rack'}" class="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition cursor-pointer border border-blue-200 dark:border-blue-800">
              ${isRackCollapsed ? '▼ Expand' : '▲ Collapse'}
            </button>
            <button onclick="openEditRackModal('${rack.id}')" title="Edit Rack" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              ✏️
            </button>
            <button onclick="deleteRack('${rack.id}')" title="Delete Rack" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              🗑️
            </button>
          </div>
        </div>

        ${!isRackCollapsed ? `
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            ${rackPallets.length === 0 ? `
              <div class="col-span-full p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                No pallets created under ${escapeHtml(rack.name)} yet. Click <strong>+ New Pallet</strong> to add one.
              </div>
            ` : rackPallets.map(pal => {
              let palBundles = allBundles.filter(b => b.palletId === pal.id && b.status === 'STORED');
              
              if (searchQ) {
                palBundles = palBundles.filter(b => 
                  (b.style || '').toLowerCase().includes(searchQ) ||
                  (b.color || '').toLowerCase().includes(searchQ) ||
                  (b.part || '').toLowerCase().includes(searchQ) ||
                  (b.tagId || '').toLowerCase().includes(searchQ) ||
                  (b.size || '').toLowerCase().includes(searchQ)
                );
              }

              const cap = parseInt(pal.capacity, 10) || 50;
              const filledPercent = Math.min(100, Math.round((palBundles.length / cap) * 100));
              const isExpanded = expandedPalletIds.has(pal.id) || searchQ.length > 0;

              let badgeColor = "bg-emerald-500";
              if (filledPercent > 85) badgeColor = "bg-rose-500";
              else if (filledPercent > 60) badgeColor = "bg-amber-500";

              return `
                <div class="bg-slate-50 dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800/90 rounded-xl p-3.5 space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-base">📦</span>
                      <div>
                        <h4 class="text-xs font-extrabold text-slate-900 dark:text-slate-100">${escapeHtml(pal.name)}</h4>
                        <p class="text-[10px] text-slate-400 truncate max-w-[140px]">${escapeHtml(pal.description || 'Tier Location')}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <button onclick="openEditPalletModal('${pal.id}')" title="Edit Pallet" class="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer">✏️</button>
                      <button onclick="deletePallet('${pal.id}')" title="Delete Pallet" class="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer">🗑️</button>
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between text-[10px] font-bold mb-1">
                      <span class="text-slate-500 dark:text-slate-400">Capacity: ${palBundles.length} / ${cap}</span>
                      <span class="font-mono text-slate-700 dark:text-slate-300">${filledPercent}%</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div class="${badgeColor} h-full transition-all duration-300" style="width: ${filledPercent}%"></div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800/70 gap-1.5 flex-wrap">
                    <button type="button" onclick="togglePalletAccordion('${pal.id}')"
                      class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                      <span>${isExpanded ? '▲ Hide Bundles' : `▼ View (${palBundles.length})`}</span>
                    </button>
                    <div class="flex items-center gap-1.5">
                      ${palBundles.length > 0 ? `
                        <button type="button" onclick='openDispatchBundleModal(${JSON.stringify(palBundles.map(b => b.tagId))})'
                          title="Bulk dispatch all ${palBundles.length} bundles from this pallet"
                          class="px-2 py-0.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg cursor-pointer transition shadow-2xs">
                          📦 Bulk Dispatch (${palBundles.length})
                        </button>
                      ` : ''}
                      <span class="text-[10px] font-mono font-bold text-slate-400">${pal.id}</span>
                    </div>
                  </div>

                  ${isExpanded ? `
                    <div class="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      ${palBundles.length > 3 ? `
                        <div class="relative">
                          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">🔍</span>
                          <input type="text" id="pallet-search-${pal.id}" oninput="filterPalletBundles('${pal.id}')"
                            placeholder="Search bundles in ${escapeHtml(pal.name)}..."
                            class="w-full h-7 pl-6 pr-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 shadow-2xs" />
                        </div>
                      ` : ''}
                      <div id="pallet-bundles-${pal.id}" class="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                        ${palBundles.length === 0 ? `
                          <p class="text-[11px] text-slate-400 text-center py-2">No bundles currently stored here.</p>
                        ` : palBundles.map(b => `
                          <div class="pallet-bundle-row p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-1.5 text-xs"
                            data-tag-id="${escapeHtml(b.tagId)}" data-style="${escapeHtml(b.style || '')}" data-color="${escapeHtml(b.color || '')}" data-size="${escapeHtml(b.size || '')}" data-part="${escapeHtml(b.part || '')}">
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-1.5">
                                <span class="font-mono font-extrabold text-[11px] text-blue-600 dark:text-blue-400">${escapeHtml(b.tagId)}</span>
                                <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(b.style)}</span>
                                <span class="text-[9px] px-1 bg-slate-100 dark:bg-slate-800 rounded font-bold">${escapeHtml(b.size)}</span>
                              </div>
                              <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">${escapeHtml(b.color || '')} • ${escapeHtml(b.part)} • Ply ${escapeHtml(b.plyRange || '')}</p>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                              <button onclick="openMoveBundleModal('${b.tagId}')" title="Move Bundle" class="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded cursor-pointer">Move</button>
                              <button onclick="openDispatchBundleModal(['${b.tagId}'])" title="Dispatch Bundle" class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded cursor-pointer">Dispatch</button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                      ${palBundles.length > 3 ? `
                        <div id="pallet-search-count-${pal.id}" class="text-[10px] text-slate-400 font-medium text-right hidden"></div>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  if (totalPages > 1) {
    html += buildRackPaginationBar(rackExplorerPage, totalPages, totalRacks, startIdx + 1, endIdx);
  }

  container.innerHTML = html;
}

function buildRackPaginationBar(currentPage, totalPages, totalRacks, showStart, showEnd) {
  let pageButtons = '';
  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
    pages.add(p);
  }
  const sortedPages = [...pages].sort((a, b) => a - b);
  let lastP = 0;
  sortedPages.forEach(p => {
    if (p - lastP > 1) {
      pageButtons += `<span class="px-1 text-slate-400 text-[11px]">…</span>`;
    }
    const isActive = p === currentPage;
    pageButtons += `
      <button type="button" onclick="goToRackPage(${p})"
        class="min-w-[32px] h-8 px-2 text-xs font-bold rounded-lg transition cursor-pointer border
          ${isActive
            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }">
        ${p}
      </button>`;
    lastP = p;
  });

  return `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-800/90 p-3 sm:p-4">
      <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">
        Showing <span class="font-bold text-slate-800 dark:text-slate-200">${showStart}–${showEnd}</span> of <span class="font-bold text-slate-800 dark:text-slate-200">${totalRacks}</span> Racks
        <span class="text-slate-400 ml-1">(Page ${currentPage} of ${totalPages})</span>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button type="button" onclick="goToRackPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}
          class="px-3 h-8 text-xs font-bold rounded-lg transition cursor-pointer border border-slate-200 dark:border-slate-700
            ${currentPage <= 1
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }">
          ◀ Prev
        </button>
        ${pageButtons}
        <button type="button" onclick="goToRackPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}
          class="px-3 h-8 text-xs font-bold rounded-lg transition cursor-pointer border border-slate-200 dark:border-slate-700
            ${currentPage >= totalPages
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }">
          Next ▶
        </button>
      </div>
    </div>
  `;
}

function filterPalletBundles(palletId) {
  const input = document.getElementById(`pallet-search-${palletId}`);
  const container = document.getElementById(`pallet-bundles-${palletId}`);
  const countEl = document.getElementById(`pallet-search-count-${palletId}`);
  if (!input || !container) return;

  const q = (input.value || '').toLowerCase().trim();
  const rows = container.querySelectorAll('.pallet-bundle-row');
  let visible = 0;
  const total = rows.length;

  rows.forEach(row => {
    if (!q) {
      row.style.display = '';
      visible++;
      return;
    }
    const tagId = (row.getAttribute('data-tag-id') || '').toLowerCase();
    const style = (row.getAttribute('data-style') || '').toLowerCase();
    const color = (row.getAttribute('data-color') || '').toLowerCase();
    const size = (row.getAttribute('data-size') || '').toLowerCase();
    const part = (row.getAttribute('data-part') || '').toLowerCase();
    const text = row.textContent.toLowerCase();

    const match = tagId.includes(q) || style.includes(q) || color.includes(q) || size.includes(q) || part.includes(q) || text.includes(q);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (countEl) {
    if (q) {
      countEl.classList.remove('hidden');
      countEl.textContent = `Showing ${visible} of ${total} bundles`;
    } else {
      countEl.classList.add('hidden');
    }
  }
}

function extractTagsFromBatchLog(log) {
  if (!log) return [];
  if (Array.isArray(log.tags) && log.tags.length > 0) return log.tags;

  const synthesized = [];
  const total = parseInt(log.totalBundles, 10) || 10;
  const parts = (log.cutParts || 'Body, Sleeve').split(',').map(s => s.trim()).filter(Boolean);
  const style = log.style || 'Batch Style';
  const color = log.color || 'General';
  const bId = log.batchId || log.id || ('BATCH-' + Date.now());
  const sizesStr = log.sizesSummary || 'M';
  const ply = log.plyRange || '1–30';
  const docket = log.docketNo || log.docket || '';
  const layJob = log.layJobNo || log.jobNo || log.layJob || '';
  const sched = log.schedule || log.po || log.orderNo || log.sched || '';

  for (let i = 1; i <= total; i++) {
    parts.forEach((part, pIdx) => {
      const partCode = part.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'PRT';
      const tId = `${bId}-B${i}-${partCode}`;
      synthesized.push({
        id: tId,
        tagId: tId,
        qrData: tId,
        batchId: bId,
        style: style,
        color: color,
        schedule: sched,
        po: sched,
        size: sizesStr,
        part: part,
        docketNo: docket,
        docket: docket,
        layJobNo: layJob,
        jobNo: layJob,
        bundleSeq: i,
        plyRange: ply,
        tagString: `${style} | ${color} | ${part} | Bundle ${i} (${ply})`
      });
    });
  }
  return synthesized;
}

function findBundleTagById(tagId) {
  if (!tagId) return null;
  const cleanId = String(tagId).trim().toUpperCase();

  if (Array.isArray(appState.allStoredTags) && appState.allStoredTags.length > 0) {
    const storedMatch = appState.allStoredTags.find(t => (t.id || t.tagId || t.qrData || '').toUpperCase() === cleanId || (t.tagString || '').toUpperCase() === cleanId);
    if (storedMatch) return storedMatch;
  }

  const genMatch = (appState.generatedTags || []).find(t => (t.id || t.qrData || '').toUpperCase() === cleanId || (t.tagString || '').toUpperCase() === cleanId);
  if (genMatch) return genMatch;

  const loadedMatch = (currentBatchLoadedTags || []).find(t => (t.id || t.tagId || t.qrData || '').toUpperCase() === cleanId || (t.tagString || '').toUpperCase() === cleanId);
  if (loadedMatch) return loadedMatch;

  for (const l of (appState.logs || [])) {
    const logTags = extractTagsFromBatchLog(l);
    const tagMatch = logTags.find(t => (t.id || t.qrData || '').toUpperCase() === cleanId || (t.tagString || '').toUpperCase() === cleanId);
    if (tagMatch) return tagMatch;
  }

  const locMatch = (appLocationState.bundleLocations || []).find(b => (b.tagId || b.id || '').toUpperCase() === cleanId);
  if (locMatch) return locMatch;

  return null;
}

let sessionScanHistory = [];

function renderScanStationUI() {
  populateLocationDropdowns();
  updateScanPalletCapBadge();
  renderSessionScanLog();
}

function updateScanPalletCapBadge() {
  const palletId = document.getElementById('loc-scan-target-pallet')?.value;
  const badge = document.getElementById('loc-scan-dest-cap-badge');
  if (!badge) return;
  if (!palletId) {
    badge.textContent = '';
    return;
  }
  const pallet = (appLocationState.pallets || []).find(p => p.id === palletId);
  if (!pallet) {
    badge.textContent = '';
    return;
  }
  const storedCount = (appLocationState.bundleLocations || []).filter(b => b.palletId === palletId && b.status === 'STORED').length;
  const cap = parseInt(pallet.capacity, 10) || 50;
  const free = Math.max(0, cap - storedCount);
  badge.textContent = `Capacity: ${storedCount} / ${cap} (${free} free slots)`;
}

function clearScanStation() {
  const input = document.getElementById('loc-scan-input');
  const previewEl = document.getElementById('loc-scan-preview');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (previewEl) {
    previewEl.innerHTML = `<span class="text-xs text-slate-400 font-medium">Scan or enter a tag above to preview bundle details and assign location.</span>`;
  }
  currentScannedTagObj = null;
}

function clearSessionScanLog() {
  sessionScanHistory = [];
  renderSessionScanLog();
  showToast("Session scan log cleared", "info");
}

function renderSessionScanLog() {
  const tbody = document.getElementById('loc-scan-session-rows');
  const countEl = document.getElementById('loc-scan-session-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = `${sessionScanHistory.length} item${sessionScanHistory.length === 1 ? '' : 's'} scanned this session`;

  if (sessionScanHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-slate-400">
          <div class="space-y-1">
            <span class="text-xl block">📦</span>
            <p class="text-xs font-medium">No bundles scanned yet in this session.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let sortedHistory = sessionScanHistory.map(item => ({
    ...item,
    location: `${item.rackName || item.rackId || ''} > ${item.palletName || item.palletId || ''}`
  }));

  if (typeof universalSortArray === 'function' && typeof sessionSortColumn !== 'undefined') {
    sortedHistory = universalSortArray(sortedHistory, sessionSortColumn, sessionSortDirection);
    updateSortIcons('session', sessionSortColumn, sessionSortDirection, ['time', 'tagId', 'style', 'size', 'docketNo', 'location']);
  }

  let html = '';
  sortedHistory.forEach((item) => {
    const timeStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    html += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition text-xs">
        <td class="p-2.5 font-mono text-[11px] text-slate-400">${timeStr}</td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">${escapeHtml(item.tagId)}</td>
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(item.style || '—')} <span class="font-normal text-slate-500">(${escapeHtml(item.color || '—')})</span></td>
        <td class="p-2.5">${escapeHtml(item.size || '—')} • ${escapeHtml(item.part || '—')}</td>
        <td class="p-2.5 font-mono text-slate-600 dark:text-slate-400">${escapeHtml(item.docketNo || item.docket || '—')} / ${escapeHtml(item.layJobNo || item.jobNo || '—')}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-[10px]">
            🏢 ${escapeHtml(item.rackName || item.rackId)} ➔ 📦 ${escapeHtml(item.palletName || item.palletId)}
          </span>
        </td>
        <td class="p-2.5 text-right">
          <button type="button" onclick="document.getElementById('loc-audit-search').value = '${escapeHtml(item.tagId)}'; switchLocationSubTab('audit'); renderLocationAuditTable(true);"
            class="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer">
            Audit
          </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function selectAllFilteredBatchBundles(select) {
  const searchQ = (document.getElementById('loc-batch-filter-search')?.value || '').toLowerCase().trim();
  const fStyle = document.getElementById('loc-batch-filter-style')?.value || '';
  const fColor = document.getElementById('loc-batch-filter-color')?.value || '';
  const fSched = document.getElementById('loc-batch-filter-sched')?.value || '';
  const fJob = document.getElementById('loc-batch-filter-job')?.value || '';
  const fDocket = document.getElementById('loc-batch-filter-docket')?.value || '';

  let filtered = currentBatchLoadedTags;
  if (fStyle) filtered = filtered.filter(t => (t.style || '') === fStyle);
  if (fColor) filtered = filtered.filter(t => (t.color || '') === fColor);
  if (fSched) filtered = filtered.filter(t => (t.schedule || t.po || '') === fSched);
  if (fJob) filtered = filtered.filter(t => (t.layJobNo || t.jobNo || '') === fJob);
  if (fDocket) filtered = filtered.filter(t => (t.docketNo || t.docket || '') === fDocket);

  if (searchQ) {
    filtered = filtered.filter(t => {
      const tId = (t.tagId || t.id || t.qrData || t.tagString || '').toLowerCase();
      return tId.includes(searchQ) ||
        (t.style || '').toLowerCase().includes(searchQ) ||
        (t.color || '').toLowerCase().includes(searchQ) ||
        (t.schedule || t.po || '').toLowerCase().includes(searchQ) ||
        (t.size || '').toLowerCase().includes(searchQ) ||
        (t.part || '').toLowerCase().includes(searchQ) ||
        (t.docketNo || t.docket || '').toLowerCase().includes(searchQ) ||
        (t.layJobNo || t.jobNo || '').toLowerCase().includes(searchQ) ||
        (t.plyRange || '').toLowerCase().includes(searchQ);
    });
  }

  filtered.forEach(t => {
    const tId = t.tagId || t.id || t.qrData || t.tagString;
    if (select) {
      selectedBatchBundleIds.add(tId);
    } else {
      selectedBatchBundleIds.delete(tId);
    }
  });

  filterBatchBundlesTable();
}

function renderQuickAssignUI() {
  const batchSourceSelect = document.getElementById('loc-batch-source-select');
  if (batchSourceSelect) {
    const curVal = batchSourceSelect.value;
    let html = '';
    
    const hasCurrent = (appState.generatedTags || []).length > 0;
    const totalLogs = (appState.logs || []).length;

    if (hasCurrent) {
      html += `<option value="CURRENT">⚡ Current Generated Batch (${(appState.generatedTags || []).length} tags)</option>`;
    }
    html += `<option value="ALL_UNASSIGNED">📦 All Unassigned Bundles</option>`;
    html += `<option value="ALL_BATCHES">🌐 All Batch Tags Combined</option>`;

    (appState.logs || []).forEach(l => {
      const bId = l.batchId || l.id;
      const tags = extractTagsFromBatchLog(l);
      const tagCount = tags.length;
      html += `<option value="${bId}">${escapeHtml(bId)}: ${escapeHtml(l.style || 'Batch')} - ${escapeHtml(l.color || '')} (${tagCount} tags)</option>`;
    });

    batchSourceSelect.innerHTML = html;

    if (curVal && batchSourceSelect.querySelector(`option[value="${curVal}"]`)) {
      batchSourceSelect.value = curVal;
    } else if (hasCurrent) {
      batchSourceSelect.value = 'CURRENT';
    } else if (totalLogs > 0) {
      batchSourceSelect.value = appState.logs[0].batchId || appState.logs[0].id;
    } else {
      batchSourceSelect.value = 'ALL_UNASSIGNED';
    }
  }
  onLocationBatchSourceChange(batchSourceSelect?.value || 'ALL_UNASSIGNED');
}

function handleLocationScanKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('loc-scan-input');
    const val = (input?.value || '').trim();
    if (!val) return;

    const tag = findBundleTagById(val);
    const previewEl = document.getElementById('loc-scan-preview');
    const autoAssign = document.getElementById('loc-scan-auto-assign')?.checked !== false;

    if (tag) {
      currentScannedTagObj = tag;
      const tId = tag.id || tag.qrData || val;
      const existingLoc = (appLocationState.bundleLocations || []).find(b => b.tagId === tId && b.status === 'STORED');
      
      if (previewEl) {
        previewEl.innerHTML = `
          <div class="text-left w-full space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">${escapeHtml(tId)}</span>
              <span class="px-2 py-0.5 rounded font-bold ${existingLoc ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'} text-[10px]">
                ${existingLoc ? `Stored in ${existingLoc.rackName || existingLoc.rackId} > ${existingLoc.palletName || existingLoc.palletId}` : 'Ready to Assign'}
              </span>
            </div>
            <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(tag.style || '')} • ${escapeHtml(tag.color || '')}</div>
            <div class="text-slate-500 dark:text-slate-400">${escapeHtml(tag.size || '')} | ${escapeHtml(tag.part || '')} | Ply: ${escapeHtml(tag.plyRange || '')}</div>
            <div class="font-mono text-[11px] text-slate-500">Docket: <strong>${escapeHtml(tag.docketNo || tag.docket || '—')}</strong> | Lay Job: <strong>${escapeHtml(tag.layJobNo || tag.jobNo || '—')}</strong></div>
          </div>
        `;
      }
      if (autoAssign) {
        assignScannedBundle();
      }
    } else {
      currentScannedTagObj = {
        id: val.toUpperCase(),
        tagId: val.toUpperCase(),
        style: "Manual Scan",
        color: "General",
        size: "M",
        part: "Bundle",
        plyRange: "1–30",
        tagString: val
      };
      if (previewEl) {
        previewEl.innerHTML = `
          <div class="text-left w-full space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-mono font-bold text-blue-600">${escapeHtml(val.toUpperCase())}</span>
              <span class="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 text-[10px]">Manual Entry</span>
            </div>
            <div class="text-slate-500">Custom Tag ID ready to assign.</div>
          </div>
        `;
      }
      if (autoAssign) {
        assignScannedBundle();
      }
    }
  }
}

async function assignScannedBundle() {
  if (!currentScannedTagObj) {
    showToast("Please scan or enter a Tag ID first.", "error");
    return;
  }
  const rackId = document.getElementById('loc-scan-target-rack')?.value;
  const palletId = document.getElementById('loc-scan-target-pallet')?.value;

  if (!rackId || !palletId) {
    showToast("Please select a target Rack and Pallet.", "error");
    return;
  }

  const rack = (appLocationState.racks || []).find(r => r.id === rackId) || { name: rackId };
  const pallet = (appLocationState.pallets || []).find(p => p.id === palletId) || { name: palletId };

  const tagObj = { ...currentScannedTagObj };
  await assignBundlesToLocation(rackId, palletId, [tagObj]);

  sessionScanHistory.unshift({
    tagId: tagObj.tagId || tagObj.id || tagObj.tagString,
    style: tagObj.style || '',
    color: tagObj.color || '',
    size: tagObj.size || '',
    part: tagObj.part || '',
    docketNo: tagObj.docketNo || tagObj.docket || '',
    layJobNo: tagObj.layJobNo || tagObj.jobNo || '',
    rackId: rackId,
    rackName: rack.name,
    palletId: palletId,
    palletName: pallet.name,
    time: new Date().toISOString()
  });
  if (sessionScanHistory.length > 100) sessionScanHistory = sessionScanHistory.slice(0, 100);
  renderSessionScanLog();
  updateScanPalletCapBadge();

  const input = document.getElementById('loc-scan-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  currentScannedTagObj = null;
}

function toggleExplorerScanWidget() {
  const body = document.getElementById('loc-explorer-scan-body');
  const chevron = document.getElementById('loc-explorer-scan-chevron');
  if (body) {
    body.classList.toggle('hidden');
    if (chevron) chevron.textContent = body.classList.contains('hidden') ? '▼' : '▲';
    if (!body.classList.contains('hidden')) {
      setTimeout(() => document.getElementById('loc-explorer-scan-input')?.focus(), 100);
    }
  }
}

function handleExplorerScanKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerExplorerScan();
  }
}

function triggerExplorerScan() {
  const input = document.getElementById('loc-explorer-scan-input');
  const resultEl = document.getElementById('loc-explorer-scan-result');
  const val = (input?.value || '').trim();
  if (!val) return;

  const loc = (appLocationState.bundleLocations || []).find(b => b.tagId === val || b.tagId === val.toUpperCase());
  const tag = findBundleTagById(val);

  if (loc) {
    const statusColor = loc.status === 'STORED'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    const statusIcon = loc.status === 'STORED' ? '🟢' : '📦';

    let docketVal = loc.docketNo || loc.docket || '';
    let layJobVal = loc.layJobNo || loc.jobNo || '';
    if ((!docketVal || !layJobVal) && tag) {
      docketVal = docketVal || tag.docketNo || tag.docket || '';
      layJobVal = layJobVal || tag.layJobNo || tag.jobNo || '';
    }

    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-left w-full space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">${escapeHtml(loc.tagId)}</span>
            <span class="px-2 py-0.5 rounded font-bold ${statusColor} text-[10px]">${statusIcon} ${escapeHtml(loc.status)}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span class="text-slate-500 dark:text-slate-400">Style:</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(loc.style || tag?.style || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Color:</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(loc.color || tag?.color || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Rack:</span> <strong class="text-blue-700 dark:text-blue-400">${escapeHtml(loc.rackName || loc.rackId || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Pallet:</span> <strong class="text-blue-700 dark:text-blue-400">${escapeHtml(loc.palletName || loc.palletId || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Docket:</span> <strong>${escapeHtml(docketVal || '—')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Lay Job:</span> <strong>${escapeHtml(layJobVal || '—')}</strong></div>
            ${loc.status === 'DISPATCHED' ? `<div class="col-span-2"><span class="text-slate-500 dark:text-slate-400">Dispatched to:</span> <strong class="text-amber-700 dark:text-amber-300">${escapeHtml(loc.dispatchedTo || '')}</strong></div>` : ''}
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button type="button" onclick="document.getElementById('loc-explorer-rack-filter').value = '${escapeHtml(loc.rackId || 'ALL')}'; renderRackPalletExplorer(); showToast('Explorer filtered to ${escapeHtml(loc.rackName || loc.rackId)}', 'info');"
              class="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer transition">
              📍 Jump to Rack
            </button>
          </div>
        </div>
      `;
    }

    const rackFilter = document.getElementById('loc-explorer-rack-filter');
    if (rackFilter && loc.rackId) {
      rackFilter.value = loc.rackId;
      renderRackPalletExplorer();
    }

    const searchInput = document.getElementById('loc-explorer-search');
    if (searchInput) {
      searchInput.value = val;
      renderRackPalletExplorer();
    }
  } else if (tag) {
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-left w-full space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-amber-700 dark:text-amber-400">${escapeHtml(tag.id || tag.qrData || val)}</span>
            <span class="px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">Not Stored</span>
          </div>
          <div class="text-slate-700 dark:text-slate-300 font-medium">${escapeHtml(tag.style || '')} • ${escapeHtml(tag.color || '')}</div>
          <div class="text-slate-500 dark:text-slate-400">${escapeHtml(tag.size || '')} | ${escapeHtml(tag.part || '')} | Ply: ${escapeHtml(tag.plyRange || '')}</div>
          <p class="text-[10px] text-slate-400 pt-1">This bundle has not been assigned to any storage location yet. Use Quick Scan & Batch Assign to store it.</p>
        </div>
      `;
    }
  } else {
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-center w-full">
          <span class="text-xs text-red-500 font-bold">❌ Tag "${escapeHtml(val)}" not found.</span>
          <p class="text-[10px] text-slate-400 mt-1">Check the Tag ID and try again.</p>
        </div>
      `;
    }
  }

  if (input) {
    input.value = '';
    input.focus();
  }
}

function toggleAuditScanWidget() {
  const body = document.getElementById('loc-audit-scan-body');
  const chevron = document.getElementById('loc-audit-scan-chevron');
  if (body) {
    body.classList.toggle('hidden');
    if (chevron) chevron.textContent = body.classList.contains('hidden') ? '▼' : '▲';
    if (!body.classList.contains('hidden')) {
      setTimeout(() => document.getElementById('loc-audit-scan-input')?.focus(), 100);
    }
  }
}

function handleAuditScanKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    triggerAuditScan();
  }
}

function triggerAuditScan() {
  const input = document.getElementById('loc-audit-scan-input');
  const resultEl = document.getElementById('loc-audit-scan-result');
  const val = (input?.value || '').trim();
  if (!val) return;

  const loc = (appLocationState.bundleLocations || []).find(b => b.tagId === val || b.tagId === val.toUpperCase());
  const tag = findBundleTagById(val);

  if (loc) {
    const statusColor = loc.status === 'STORED'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    const statusIcon = loc.status === 'STORED' ? '🟢' : '📦';

    let docketVal = loc.docketNo || loc.docket || '';
    let layJobVal = loc.layJobNo || loc.jobNo || '';
    if ((!docketVal || !layJobVal) && tag) {
      docketVal = docketVal || tag.docketNo || tag.docket || '';
      layJobVal = layJobVal || tag.layJobNo || tag.jobNo || '';
    }

    const assignedAt = loc.assignedAt ? new Date(loc.assignedAt).toLocaleString() : '—';
    const dispatchedAt = loc.dispatchedAt ? new Date(loc.dispatchedAt).toLocaleString() : '';

    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-left w-full space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">${escapeHtml(loc.tagId)}</span>
            <span class="px-2 py-0.5 rounded font-bold ${statusColor} text-[10px]">${statusIcon} ${escapeHtml(loc.status)}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span class="text-slate-500 dark:text-slate-400">Style:</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(loc.style || tag?.style || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Color:</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(loc.color || tag?.color || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Size:</span> <strong>${escapeHtml(loc.size || tag?.size || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Part:</span> <strong>${escapeHtml(loc.part || tag?.part || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Rack:</span> <strong class="text-blue-700 dark:text-blue-400">${escapeHtml(loc.rackName || loc.rackId || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Pallet:</span> <strong class="text-blue-700 dark:text-blue-400">${escapeHtml(loc.palletName || loc.palletId || '')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Docket:</span> <strong>${escapeHtml(docketVal || '—')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Lay Job:</span> <strong>${escapeHtml(layJobVal || '—')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Batch:</span> <strong>${escapeHtml(loc.batchId || '—')}</strong></div>
            <div><span class="text-slate-500 dark:text-slate-400">Stored At:</span> <strong>${escapeHtml(assignedAt)}</strong></div>
            ${loc.status === 'DISPATCHED' ? `
              <div><span class="text-slate-500 dark:text-slate-400">Dispatched to:</span> <strong class="text-amber-700 dark:text-amber-300">${escapeHtml(loc.dispatchedTo || '')}</strong></div>
              <div><span class="text-slate-500 dark:text-slate-400">Dispatched At:</span> <strong>${escapeHtml(dispatchedAt)}</strong></div>
            ` : ''}
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button type="button" onclick="document.getElementById('loc-audit-search').value = '${escapeHtml(loc.tagId)}'; renderLocationAuditTable(true); showToast('Audit table filtered to ${escapeHtml(loc.tagId)}', 'info');"
              class="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-500 hover:bg-blue-600 text-white cursor-pointer transition">
              🔍 Show in Table
            </button>
            ${loc.status === 'STORED' ? `
              <button type="button" onclick="openDispatchBundleModal(['${escapeHtml(loc.tagId)}'])"
                class="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer transition">
                📦 Dispatch
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    const auditSearch = document.getElementById('loc-audit-search');
    if (auditSearch) {
      auditSearch.value = val;
      renderLocationAuditTable(true);
    }
  } else if (tag) {
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-left w-full space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-blue-700 dark:text-blue-400">${escapeHtml(tag.id || tag.qrData || val)}</span>
            <span class="px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">Not in Inventory</span>
          </div>
          <div class="text-slate-700 dark:text-slate-300 font-medium">${escapeHtml(tag.style || '')} • ${escapeHtml(tag.color || '')}</div>
          <div class="text-slate-500 dark:text-slate-400">${escapeHtml(tag.size || '')} | ${escapeHtml(tag.part || '')} | Ply: ${escapeHtml(tag.plyRange || '')}</div>
          <p class="text-[10px] text-slate-400 pt-1">This bundle exists but is not stored in any warehouse location.</p>
        </div>
      `;
    }
  } else {
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="text-center w-full">
          <span class="text-xs text-red-500 font-bold">❌ Tag "${escapeHtml(val)}" not found in system.</span>
          <p class="text-[10px] text-slate-400 mt-1">This tag doesn't exist in generated bundles or inventory.</p>
        </div>
      `;
    }
  }

  if (input) {
    input.value = '';
    input.focus();
  }
}

let batchSortColumn = 'tagId';
let batchSortDirection = 'asc';

function sortBatchTable(col) {
  if (batchSortColumn === col) {
    batchSortDirection = batchSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    batchSortColumn = col;
    batchSortDirection = 'asc';
  }
  filterBatchBundlesTable();
}

let currentBatchLoadedTags = [];

function populateBatchFilterDropdowns(tags, preserveCurrent = true) {
  const styleSelect = document.getElementById('loc-batch-filter-style');
  const colorSelect = document.getElementById('loc-batch-filter-color');
  const schedSelect = document.getElementById('loc-batch-filter-sched');
  const jobSelect = document.getElementById('loc-batch-filter-job');
  const docketSelect = document.getElementById('loc-batch-filter-docket');
  const partSelect = document.getElementById('loc-batch-filter-part');
  const sizeSelect = document.getElementById('loc-batch-filter-size');

  const curStyle = preserveCurrent ? (styleSelect?.value || '') : '';
  const curColor = preserveCurrent ? (colorSelect?.value || '') : '';
  const curSched = preserveCurrent ? (schedSelect?.value || '') : '';
  const curJob = preserveCurrent ? (jobSelect?.value || '') : '';
  const curDocket = preserveCurrent ? (docketSelect?.value || '') : '';
  const curPart = preserveCurrent ? (partSelect?.value || '') : '';
  const curSize = preserveCurrent ? (sizeSelect?.value || '') : '';

  const getCounts = (filteredList, keyFn) => {
    const counts = {};
    filteredList.forEach(t => {
      const k = keyFn(t);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  };

  const matchStyle = t => !curStyle || (t.style || '') === curStyle;
  const matchColor = t => !curColor || (t.color || '') === curColor;
  const matchSched = t => !curSched || (t.schedule || t.po || '') === curSched;
  const matchJob = t => !curJob || (t.layJobNo || t.jobNo || '') === curJob;
  const matchDocket = t => !curDocket || (t.docketNo || t.docket || '') === curDocket;
  const matchPart = t => !curPart || (t.part || '') === curPart;
  const matchSize = t => !curSize || (t.size || '') === curSize;

  const forStyle = tags.filter(t => matchColor(t) && matchSched(t) && matchJob(t) && matchDocket(t) && matchPart(t) && matchSize(t));
  const forColor = tags.filter(t => matchStyle(t) && matchSched(t) && matchJob(t) && matchDocket(t) && matchPart(t) && matchSize(t));
  const forSched = tags.filter(t => matchStyle(t) && matchColor(t) && matchJob(t) && matchDocket(t) && matchPart(t) && matchSize(t));
  const forJob = tags.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchDocket(t) && matchPart(t) && matchSize(t));
  const forDocket = tags.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchJob(t) && matchPart(t) && matchSize(t));
  const forPart = tags.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchJob(t) && matchDocket(t) && matchSize(t));
  const forSize = tags.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchJob(t) && matchDocket(t) && matchPart(t));

  const styleCounts = getCounts(forStyle, t => t.style);
  const colorCounts = getCounts(forColor, t => t.color);
  const schedCounts = getCounts(forSched, t => t.schedule || t.po);
  const jobCounts = getCounts(forJob, t => t.layJobNo || t.jobNo);
  const docketCounts = getCounts(forDocket, t => t.docketNo || t.docket);
  const partCounts = getCounts(forPart, t => t.part);
  const sizeCounts = getCounts(forSize, t => t.size);

  const renderOptions = (selectEl, countsMap, currentVal, defaultLabel) => {
    if (!selectEl) return;
    const keys = Object.keys(countsMap).sort();
    let optHtml = `<option value="">${defaultLabel} (${keys.length})</option>`;
    keys.forEach(k => {
      const selectedAttr = (k === currentVal) ? 'selected' : '';
      optHtml += `<option value="${escapeHtml(k)}" ${selectedAttr}>${escapeHtml(k)} (${countsMap[k]})</option>`;
    });
    selectEl.innerHTML = optHtml;
    if (keys.includes(currentVal)) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = '';
    }
  };

  renderOptions(styleSelect, styleCounts, curStyle, 'All Styles');
  renderOptions(colorSelect, colorCounts, curColor, 'All Colors');
  renderOptions(schedSelect, schedCounts, curSched, 'All Schedules');
  renderOptions(jobSelect, jobCounts, curJob, 'All Lay Jobs');
  renderOptions(docketSelect, docketCounts, curDocket, 'All Dockets');
  renderOptions(partSelect, partCounts, curPart, 'All Parts');
  renderOptions(sizeSelect, sizeCounts, curSize, 'All Sizes');
}

function onBatchFilterDropdownChange(triggerField) {
  populateBatchFilterDropdowns(currentBatchLoadedTags, true);
  filterBatchBundlesTable();
}

function resetBatchBundleFilters() {
  const searchInput = document.getElementById('loc-batch-filter-search');
  if (searchInput) searchInput.value = '';
  populateBatchFilterDropdowns(currentBatchLoadedTags, false);
  filterBatchBundlesTable();
}

function filterBatchBundlesTable() {
  const rowsEl = document.getElementById('loc-batch-table-rows');
  const countEl = document.getElementById('loc-batch-selected-count');
  const sumEl = document.getElementById('loc-batch-summary-info');
  const headerCb = document.getElementById('loc-batch-select-all');
  if (!rowsEl) return;

  const searchQ = (document.getElementById('loc-batch-filter-search')?.value || '').toLowerCase().trim();
  const fStyle = document.getElementById('loc-batch-filter-style')?.value || '';
  const fColor = document.getElementById('loc-batch-filter-color')?.value || '';
  const fSched = document.getElementById('loc-batch-filter-sched')?.value || '';
  const fJob = document.getElementById('loc-batch-filter-job')?.value || '';
  const fDocket = document.getElementById('loc-batch-filter-docket')?.value || '';
  const fPart = document.getElementById('loc-batch-filter-part')?.value || '';
  const fSize = document.getElementById('loc-batch-filter-size')?.value || '';

  let filtered = currentBatchLoadedTags;

  if (fStyle) filtered = filtered.filter(t => (t.style || '') === fStyle);
  if (fColor) filtered = filtered.filter(t => (t.color || '') === fColor);
  if (fSched) filtered = filtered.filter(t => (t.schedule || t.po || '') === fSched);
  if (fJob) filtered = filtered.filter(t => (t.layJobNo || t.jobNo || '') === fJob);
  if (fDocket) filtered = filtered.filter(t => (t.docketNo || t.docket || '') === fDocket);
  if (fPart) filtered = filtered.filter(t => (t.part || '') === fPart);
  if (fSize) filtered = filtered.filter(t => (t.size || '') === fSize);

  if (searchQ) {
    filtered = filtered.filter(t => {
      const tId = (t.tagId || t.id || t.qrData || t.tagString || '').toLowerCase();
      const style = (t.style || '').toLowerCase();
      const color = (t.color || '').toLowerCase();
      const sched = (t.schedule || t.po || '').toLowerCase();
      const size = (t.size || '').toLowerCase();
      const part = (t.part || '').toLowerCase();
      const docket = (t.docketNo || t.docket || '').toLowerCase();
      const layJob = (t.layJobNo || t.jobNo || '').toLowerCase();
      const ply = (t.plyRange || '').toLowerCase();

      return tId.includes(searchQ) ||
        style.includes(searchQ) ||
        color.includes(searchQ) ||
        sched.includes(searchQ) ||
        size.includes(searchQ) ||
        part.includes(searchQ) ||
        docket.includes(searchQ) ||
        layJob.includes(searchQ) ||
        ply.includes(searchQ);
    });
  }

  if (typeof universalSortArray === 'function') {
    filtered = universalSortArray(filtered, batchSortColumn, batchSortDirection);
    updateSortIcons('batch', batchSortColumn, batchSortDirection, ['tagId', 'style', 'color', 'schedule', 'size', 'part', 'docketNo', 'layJobNo', 'plyRange', 'location']);
  }

  if (filtered.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="11" class="p-6 text-center text-slate-400 dark:text-slate-500">
          <div class="space-y-1">
            <span class="text-xl block">🔍</span>
            <p class="font-semibold text-xs text-slate-600 dark:text-slate-400">No bundle tags match your search filters.</p>
            <button type="button" onclick="resetBatchBundleFilters()" class="mt-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer">
              Reset Search & Filters
            </button>
          </div>
        </td>
      </tr>
    `;
    if (headerCb) headerCb.checked = false;
    return;
  }

  let visibleCheckedCount = 0;
  let html = '';
  filtered.forEach(t => {
    const tId = t.tagId || t.id || t.qrData || t.tagString;
    const loc = (appLocationState.bundleLocations || []).find(b => b.tagId === tId && b.status === 'STORED');
    const locText = loc 
      ? `<span class="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 text-[10px] whitespace-nowrap">🏢 ${escapeHtml(loc.rackName || loc.rackId)} ➔ 📦 ${escapeHtml(loc.palletName || loc.palletId)}</span>`
      : '<span class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-[10px]">Unassigned</span>';
    const isChecked = selectedBatchBundleIds.has(tId);
    if (isChecked) visibleCheckedCount++;

    html += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="p-2.5 text-center">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelectBatchBundle('${escapeHtml(tId)}', this.checked)"
            class="batch-bundle-checkbox rounded border-slate-300 dark:border-slate-700 cursor-pointer w-3.5 h-3.5 accent-blue-600" data-tag-id="${escapeHtml(tId)}" />
        </td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">${escapeHtml(tId)}</td>
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-xs">${escapeHtml(t.style || '—')}</td>
        <td class="p-2.5 text-slate-600 dark:text-slate-300 text-xs">${escapeHtml(t.color || '—')}</td>
        <td class="p-2.5 font-mono text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(t.schedule || t.po || '—')}</td>
        <td class="p-2.5"><span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-xs">${escapeHtml(t.size || '—')}</span></td>
        <td class="p-2.5 text-xs">${escapeHtml(t.part || '—')}</td>
        <td class="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">${escapeHtml(t.docketNo || t.docket || '—')}</td>
        <td class="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">${escapeHtml(t.layJobNo || t.jobNo || '—')}</td>
        <td class="p-2.5 font-mono text-xs">${escapeHtml(t.plyRange || '—')}</td>
        <td class="p-2.5 text-[11px]">${locText}</td>
      </tr>
    `;
  });

  rowsEl.innerHTML = html;
  if (headerCb) headerCb.checked = (filtered.length > 0 && visibleCheckedCount === filtered.length);
  if (countEl) countEl.textContent = `${selectedBatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedBatchBundleIds.size} of ${currentBatchLoadedTags.length} bundles selected (${filtered.length} visible)`;
}

function onLocationBatchSourceChange(val) {
  const rowsEl = document.getElementById('loc-batch-table-rows');
  const countEl = document.getElementById('loc-batch-selected-count');
  const sumEl = document.getElementById('loc-batch-summary-info');
  selectedBatchBundleIds.clear();

  let tags = [];
  if (val === 'CURRENT') {
    tags = appState.generatedTags || [];
  } else if (val === 'ALL_UNASSIGNED') {
    const allKnown = [];
    (appState.generatedTags || []).forEach(t => allKnown.push(t));
    (appState.allStoredTags || []).forEach(t => allKnown.push(t));
    (appState.logs || []).forEach(l => {
      extractTagsFromBatchLog(l).forEach(t => allKnown.push(t));
    });
    const storedTagIds = new Set((appLocationState.bundleLocations || []).filter(b => b.status === 'STORED').map(b => b.tagId));
    tags = allKnown.filter(t => !storedTagIds.has(t.id || t.tagId || t.qrData || t.tagString));
  } else if (val === 'ALL_BATCHES') {
    (appState.generatedTags || []).forEach(t => tags.push(t));
    (appState.allStoredTags || []).forEach(t => tags.push(t));
    (appState.logs || []).forEach(l => {
      extractTagsFromBatchLog(l).forEach(t => tags.push(t));
    });
  } else if (val) {
    const matchLog = (appState.logs || []).find(l => (l.batchId || l.id) === val);
    if (matchLog) {
      if (Array.isArray(matchLog.tags) && matchLog.tags.length > 0) {
        tags = matchLog.tags;
      } else {
        const storedMatches = (appState.allStoredTags || []).filter(t => (t.batchId || t.batchTagString) === val);
        if (storedMatches.length > 0) {
          tags = storedMatches;
        } else {
          tags = extractTagsFromBatchLog(matchLog);
        }
      }
    }
  }

  const seen = new Set();
  const enrichedTags = [];
  tags.forEach(t => {
    const id = t.id || t.tagId || t.qrData || t.tagString;
    if (!id || seen.has(id)) return;
    seen.add(id);

    let style = t.style || '';
    let color = t.color || '';
    let sched = t.schedule || t.po || t.orderNo || '';
    let size = t.size || '';
    let part = t.part || '';
    let docket = t.docketNo || t.docket || '';
    let layJob = t.layJobNo || t.jobNo || '';
    let ply = t.plyRange || '';

    if (!sched || !docket || !layJob) {
      const parentLog = (appState.logs || []).find(l => (l.batchId || l.id) === (t.batchId || t.batchTagString));
      if (parentLog) {
        if (!sched) sched = parentLog.schedule || parentLog.po || parentLog.orderNo || '';
        if (!docket) docket = parentLog.docketNo || parentLog.docket || '';
        if (!layJob) layJob = parentLog.layJobNo || parentLog.jobNo || '';
        if (!style) style = parentLog.style || '';
        if (!color) color = parentLog.color || '';
      }
    }

    enrichedTags.push({
      ...t,
      id: id,
      tagId: id,
      style: style,
      color: color,
      schedule: sched,
      po: sched,
      size: size,
      part: part,
      docketNo: docket,
      docket: docket,
      layJobNo: layJob,
      jobNo: layJob,
      plyRange: ply
    });
  });

  // STRICT REQUIREMENT: Only UNASSIGNED bundles come to the assignment table
  const storedTagIds = new Set((appLocationState.bundleLocations || []).filter(b => b.status === 'STORED').map(b => b.tagId));
  const unassignedOnly = enrichedTags.filter(t => !storedTagIds.has(t.tagId || t.id));

  currentBatchLoadedTags = unassignedOnly;
  window.currentBatchLoadedTags = currentBatchLoadedTags;

  if (!rowsEl) return;

  if (currentBatchLoadedTags.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="11" class="p-6 text-center text-slate-400 dark:text-slate-500">
          <div class="space-y-2">
            <span class="text-2xl block">✅</span>
            <p class="font-semibold text-xs text-slate-600 dark:text-slate-400">All bundle tags in this batch are already assigned to storage!</p>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">No unassigned bundles remaining in this batch. View them in Floor Explorer or Dispatch.</p>
            <div class="flex items-center justify-center gap-2 mt-2">
              <button type="button" onclick="switchLocationSubTab('explorer')" class="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs cursor-pointer">
                🏢 View on Floor
              </button>
              <button type="button" onclick="switchLocationSubTab('dispatch')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer">
                🚀 Go to Dispatch
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
    if (countEl) countEl.textContent = "0 Selected";
    if (sumEl) sumEl.textContent = "0 unassigned bundles available";
    return;
  }

  currentBatchLoadedTags.forEach(t => selectedBatchBundleIds.add(t.tagId));

  populateBatchFilterDropdowns(currentBatchLoadedTags);
  filterBatchBundlesTable();
}

function toggleSelectAllBatchBundles(checked) {
  const checkboxes = document.querySelectorAll('.batch-bundle-checkbox');
  checkboxes.forEach(cb => {
    const tagId = cb.getAttribute('data-tag-id');
    cb.checked = checked;
    if (tagId) {
      if (checked) selectedBatchBundleIds.add(tagId);
      else selectedBatchBundleIds.delete(tagId);
    }
  });
  const countEl = document.getElementById('loc-batch-selected-count');
  const sumEl = document.getElementById('loc-batch-summary-info');
  if (countEl) countEl.textContent = `${selectedBatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedBatchBundleIds.size} of ${currentBatchLoadedTags.length} unassigned bundles selected (${checkboxes.length} visible)`;
}

function selectAllFilteredBatchBundles(checked) {
  const headerCb = document.getElementById('loc-batch-select-all');
  if (headerCb) headerCb.checked = checked;
  toggleSelectAllBatchBundles(checked);
}

function toggleSelectBatchBundle(tagId, checked) {
  if (checked) selectedBatchBundleIds.add(tagId);
  else selectedBatchBundleIds.delete(tagId);

  const headerCb = document.getElementById('loc-batch-select-all');
  const checkboxes = Array.from(document.querySelectorAll('.batch-bundle-checkbox'));
  if (headerCb) {
    headerCb.checked = (checkboxes.length > 0 && checkboxes.every(cb => cb.checked));
  }

  const countEl = document.getElementById('loc-batch-selected-count');
  const sumEl = document.getElementById('loc-batch-summary-info');
  if (countEl) countEl.textContent = `${selectedBatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedBatchBundleIds.size} of ${currentBatchLoadedTags.length} unassigned bundles selected (${checkboxes.length} visible)`;
}

async function assignSelectedBatchBundles() {
  let targetTagIds = Array.from(selectedBatchBundleIds);
  if (!targetTagIds || targetTagIds.length === 0) {
    const visibleCheckboxes = Array.from(document.querySelectorAll('.batch-bundle-checkbox:checked'));
    targetTagIds = visibleCheckboxes.map(cb => cb.getAttribute('data-tag-id')).filter(Boolean);
  }

  if (!targetTagIds || targetTagIds.length === 0) {
    showToast("Please select at least one bundle tag to assign.", "error");
    return;
  }
  const rackId = document.getElementById('loc-batch-target-rack')?.value;
  const palletId = document.getElementById('loc-batch-target-pallet')?.value;

  if (!rackId || !palletId) {
    showToast("Please select a target Rack and Pallet.", "error");
    return;
  }

  const bundlesToAssign = [];
  targetTagIds.forEach(tId => {
    const tag = (currentBatchLoadedTags || []).find(t => (t.tagId || t.id || t.qrData || t.tagString) === tId) || findBundleTagById(tId) || { id: tId, tagId: tId };
    bundlesToAssign.push(tag);
  });

  await assignBundlesToLocation(rackId, palletId, bundlesToAssign);
  selectedBatchBundleIds.clear();
  const selectVal = document.getElementById('loc-batch-source-select')?.value;
  if (selectVal) onLocationBatchSourceChange(selectVal);
  renderLocationManagementUI();
  updateSidebarLocationCount();
}

async function assignBundlesToLocation(rackId, palletId, bundles) {
  const rack = (appLocationState.racks || []).find(r => r.id === rackId) || { name: rackId };
  const pallet = (appLocationState.pallets || []).find(p => p.id === palletId) || { name: palletId };

  const now = new Date().toISOString();
  let count = 0;

  bundles.forEach(b => {
    const tId = b.tagId || b.id || b.tagString;
    if (!tId) return;

    const existingIdx = (appLocationState.bundleLocations || []).findIndex(bl => bl.tagId === tId || bl.id === tId);
    const prevLoc = existingIdx >= 0 ? `${appLocationState.bundleLocations[existingIdx].rackName || appLocationState.bundleLocations[existingIdx].rackId} > ${appLocationState.bundleLocations[existingIdx].palletName || appLocationState.bundleLocations[existingIdx].palletId}` : null;

    let refDocket = b.docketNo || b.docket || '';
    let refJob = b.layJobNo || b.jobNo || b.layJob || '';
    if (!refDocket || !refJob) {
      const matchedTag = findBundleTagById(tId);
      if (matchedTag) {
        refDocket = refDocket || matchedTag.docketNo || matchedTag.docket || '';
        refJob = refJob || matchedTag.layJobNo || matchedTag.jobNo || matchedTag.job || '';
      }
    }
    if (!refDocket || !refJob) {
      const matchedLog = (appState.logs || []).find(l => (l.batchId || l.id) === (b.batchId || b.batchTagString));
      if (matchedLog) {
        refDocket = refDocket || matchedLog.docketNo || matchedLog.docket || '';
        refJob = refJob || matchedLog.layJobNo || matchedLog.jobNo || matchedLog.job || '';
      }
    }

    const record = {
      tagId: tId,
      id: tId,
      batchId: b.batchId || b.batchTagString || '',
      rackId: rackId,
      palletId: palletId,
      rackName: rack.name || rackId,
      palletName: pallet.name || palletId,
      style: b.style || '',
      color: b.color || '',
      size: b.size || '',
      part: b.part || '',
      docketNo: refDocket,
      docket: refDocket,
      layJobNo: refJob,
      jobNo: refJob,
      bundleSeq: b.bundleSeq || 1,
      plyRange: b.plyRange || '',
      tagString: b.tagString || `${b.size || ''} ${b.part || ''} ${b.plyRange || ''}`,
      status: 'STORED',
      assignedAt: existingIdx >= 0 ? appLocationState.bundleLocations[existingIdx].assignedAt : now,
      updatedAt: now,
      assignedBy: 'Operator',
      notes: ''
    };

    if (existingIdx >= 0) {
      appLocationState.bundleLocations[existingIdx] = record;
    } else {
      appLocationState.bundleLocations.unshift(record);
    }

    appLocationState.history.unshift({
      id: 'HIST-' + Date.now() + '-' + Math.floor(Math.random()*1000),
      timestamp: now,
      action: existingIdx >= 0 ? 'MOVE' : 'ASSIGN',
      tagId: tId,
      style: b.style || '',
      fromLocation: prevLoc,
      toLocation: `${rack.name} > ${pallet.name}`,
      details: `Assigned ${b.style || ''} ${b.size || ''} ${b.part || ''} (${b.plyRange || ''}) to ${rack.name} > ${pallet.name}`
    });
    count++;
  });

  if (appLocationState.history.length > 500) appLocationState.history = appLocationState.history.slice(0, 500);

  await saveLocationDatabase();
  showToast(`Assigned ${count} bundle(s) to ${rack.name} > ${pallet.name}!`, "success");
}

function openCreateRackModal() {
  switchLocationSubTab('setup');
  setTimeout(() => {
    const input = document.getElementById('rack-form-name');
    if (input) {
      if (typeof input.focus === 'function') input.focus();
      if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 50);
}

async function handleCreateRackSubmit(e) {
  if (e) {
    e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  const nameInput = document.getElementById('rack-form-name');
  const zoneInput = document.getElementById('rack-form-zone');
  const descInput = document.getElementById('rack-form-desc');

  const name = (nameInput?.value || '').trim();
  const zone = (zoneInput?.value || '').trim() || 'Cutting Floor';
  const desc = (descInput?.value || '').trim();

  if (!name) {
    showToast("Please enter a Rack Name.", "error");
    return;
  }

  if (!Array.isArray(appLocationState.racks)) appLocationState.racks = [];
  if (!Array.isArray(appLocationState.pallets)) appLocationState.pallets = [];
  if (!Array.isArray(appLocationState.bundleLocations)) appLocationState.bundleLocations = [];
  if (!Array.isArray(appLocationState.history)) appLocationState.history = [];

  const isDuplicate = (appLocationState.racks || []).some(
    r => String(r.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    showToast(`⚠️ Rack "${name}" already exists! Please choose a unique name.`, "error");
    if (nameInput) nameInput.focus();
    return;
  }

  const rId = 'RACK-' + Date.now();
  appLocationState.racks.push({
    id: rId,
    name: name,
    zone: zone,
    description: desc,
    createdAt: new Date().toISOString()
  });

  const pId = 'PAL-' + Date.now() + '-1';
  appLocationState.pallets.push({
    id: pId,
    rackId: rId,
    name: "Pallet 1",
    capacity: 50,
    description: "Main Tier",
    createdAt: new Date().toISOString()
  });

  await saveLocationDatabase();
  if (nameInput) nameInput.value = '';
  if (zoneInput) zoneInput.value = '';
  if (descInput) descInput.value = '';
  populateLocationDropdowns(rId);
  renderLocationManagementUI();
  showToast(`🟢 Created new Rack: ${name} with Pallet 1!`, "success");
}

async function deleteRack(rId) {
  const rack = (appLocationState.racks || []).find(r => r.id === rId);
  if (!rack) return;
  const stored = (appLocationState.bundleLocations || []).filter(b => b.rackId === rId && b.status === 'STORED').length;
  if (stored > 0) {
    if (!confirm(`Warning: ${stored} bundles are currently stored in ${rack.name}. Deleting this rack will unlink them. Continue?`)) return;
  } else {
    if (!confirm(`Delete ${rack.name} and all its pallets?`)) return;
  }

  appLocationState.racks = (appLocationState.racks || []).filter(r => r.id !== rId);
  appLocationState.pallets = (appLocationState.pallets || []).filter(p => p.rackId !== rId);
  appLocationState.bundleLocations = (appLocationState.bundleLocations || []).filter(b => b.rackId !== rId);

  await saveLocationDatabase();
  populateLocationDropdowns();
  renderLocationManagementUI();
  showToast(`Deleted ${rack.name}.`, "info");
}

function openEditRackModal(rId) {
  const rack = (appLocationState.racks || []).find(r => r.id === rId);
  if (!rack) return;
  const idEl = document.getElementById('loc-edit-rack-id');
  const nameEl = document.getElementById('loc-edit-rack-name');
  const zoneEl = document.getElementById('loc-edit-rack-zone');
  const descEl = document.getElementById('loc-edit-rack-desc');

  if (idEl) idEl.value = rack.id;
  if (nameEl) nameEl.value = rack.name || '';
  if (zoneEl) zoneEl.value = rack.zone || '';
  if (descEl) descEl.value = rack.description || '';

  const modal = document.getElementById('loc-modal-edit-rack');
  if (modal) modal.classList.remove('hidden');
}

async function submitModalEditRack() {
  const rId = document.getElementById('loc-edit-rack-id')?.value;
  const rack = (appLocationState.racks || []).find(r => r.id === rId);
  if (!rack) return;

  const newName = (document.getElementById('loc-edit-rack-name')?.value || rack.name).trim();
  if (!newName) {
    showToast("Rack Name cannot be empty.", "error");
    return;
  }
  const isDuplicate = (appLocationState.racks || []).some(
    r => r.id !== rId && String(r.name || '').trim().toLowerCase() === newName.toLowerCase()
  );
  if (isDuplicate) {
    showToast(`⚠️ Another rack with name "${newName}" already exists!`, "error");
    return;
  }

  rack.name = newName;
  rack.zone = (document.getElementById('loc-edit-rack-zone')?.value || rack.zone).trim();
  rack.description = (document.getElementById('loc-edit-rack-desc')?.value || '').trim();

  (appLocationState.bundleLocations || []).forEach(b => {
    if (b.rackId === rId) b.rackName = rack.name;
  });

  await saveLocationDatabase();
  populateLocationDropdowns();
  renderLocationManagementUI();
  closeModal('loc-modal-edit-rack');
  showToast(`Updated ${rack.name} details!`, "success");
}

function openCreatePalletModal() {
  switchLocationSubTab('setup');
  setTimeout(() => {
    const input = document.getElementById('pallet-form-name');
    if (input) {
      if (typeof input.focus === 'function') input.focus();
      if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 50);
}

async function handleCreatePalletSubmit(e) {
  if (e) {
    e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  const rackSelect = document.getElementById('pallet-form-rack');
  const nameInput = document.getElementById('pallet-form-name');
  const capInput = document.getElementById('pallet-form-cap');
  const descInput = document.getElementById('pallet-form-desc');

  const rackId = rackSelect?.value;
  const name = (nameInput?.value || '').trim();
  const cap = parseInt(capInput?.value, 10) || 50;
  const desc = (descInput?.value || '').trim();

  if (!rackId || !name) {
    showToast("Please choose parent Rack and enter Pallet Name.", "error");
    return;
  }

  if (!Array.isArray(appLocationState.pallets)) appLocationState.pallets = [];
  if (!Array.isArray(appLocationState.bundleLocations)) appLocationState.bundleLocations = [];
  if (!Array.isArray(appLocationState.history)) appLocationState.history = [];

  const isDuplicate = (appLocationState.pallets || []).some(
    p => p.rackId === rackId && String(p.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (isDuplicate) {
    showToast(`⚠️ Pallet "${name}" already exists under this rack! Please choose a unique name.`, "error");
    if (nameInput) nameInput.focus();
    return;
  }

  const pId = 'PAL-' + Date.now();
  appLocationState.pallets.push({
    id: pId,
    rackId: rackId,
    name: name,
    capacity: cap,
    description: desc,
    createdAt: new Date().toISOString()
  });

  await saveLocationDatabase();
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (capInput) capInput.value = '50';
  populateLocationDropdowns(rackId);
  renderLocationManagementUI();
  showToast(`🟢 Added Pallet "${name}" to rack!`, "success");
}

async function deletePallet(pId) {
  const pal = (appLocationState.pallets || []).find(p => p.id === pId);
  if (!pal) return;
  const stored = (appLocationState.bundleLocations || []).filter(b => b.palletId === pId && b.status === 'STORED').length;
  if (stored > 0) {
    if (!confirm(`Warning: ${stored} bundles are stored in ${pal.name}. Continue deleting pallet?`)) return;
  } else {
    if (!confirm(`Delete ${pal.name}?`)) return;
  }

  appLocationState.pallets = (appLocationState.pallets || []).filter(p => p.id !== pId);
  appLocationState.bundleLocations = (appLocationState.bundleLocations || []).filter(b => b.palletId !== pId);

  await saveLocationDatabase();
  populateLocationDropdowns();
  renderLocationManagementUI();
  showToast(`Deleted ${pal.name}.`, "info");
}

function openEditPalletModal(pId) {
  const pal = (appLocationState.pallets || []).find(p => p.id === pId);
  if (!pal) return;
  const idEl = document.getElementById('loc-edit-pallet-id');
  const rackEl = document.getElementById('loc-edit-pallet-rack');
  const nameEl = document.getElementById('loc-edit-pallet-name');
  const capEl = document.getElementById('loc-edit-pallet-cap');
  const descEl = document.getElementById('loc-edit-pallet-desc');

  if (idEl) idEl.value = pal.id;
  if (rackEl) {
    let html = '';
    (appLocationState.racks || []).forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.zone || 'Cutting Floor')})</option>`;
    });
    rackEl.innerHTML = html;
    rackEl.value = pal.rackId;
    if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('loc-edit-pallet-rack');
  }
  if (nameEl) nameEl.value = pal.name || '';
  if (capEl) capEl.value = pal.capacity || 50;
  if (descEl) descEl.value = pal.description || '';

  const modal = document.getElementById('loc-modal-edit-pallet');
  if (modal) modal.classList.remove('hidden');
}

async function submitModalEditPallet() {
  const pId = document.getElementById('loc-edit-pallet-id')?.value;
  const pal = (appLocationState.pallets || []).find(p => p.id === pId);
  if (!pal) return;

  const newRackId = document.getElementById('loc-edit-pallet-rack')?.value || pal.rackId;
  const targetRack = (appLocationState.racks || []).find(r => r.id === newRackId);

  const newPalName = (document.getElementById('loc-edit-pallet-name')?.value || pal.name).trim();
  if (!newPalName) {
    showToast("Pallet Name cannot be empty.", "error");
    return;
  }
  const isDuplicate = (appLocationState.pallets || []).some(
    p => p.id !== pId && p.rackId === newRackId && String(p.name || '').trim().toLowerCase() === newPalName.toLowerCase()
  );
  if (isDuplicate) {
    showToast(`⚠️ Another pallet named "${newPalName}" exists under this rack!`, "error");
    return;
  }

  pal.rackId = newRackId;
  pal.name = newPalName;
  pal.capacity = parseInt(document.getElementById('loc-edit-pallet-cap')?.value, 10) || pal.capacity || 50;
  pal.description = (document.getElementById('loc-edit-pallet-desc')?.value || '').trim();

  (appLocationState.bundleLocations || []).forEach(b => {
    if (b.palletId === pId) {
      b.palletName = pal.name;
      if (targetRack) {
        b.rackId = targetRack.id;
        b.rackName = targetRack.name;
      }
    }
  });

  await saveLocationDatabase();
  populateLocationDropdowns();
  renderLocationManagementUI();
  closeModal('loc-modal-edit-pallet');
  showToast(`Updated Pallet "${pal.name}" details!`, "success");
}

function openMoveBundleModal(tagId) {
  moveTargetTagId = tagId;
  const item = (appLocationState.bundleLocations || []).find(b => b.tagId === tagId || b.id === tagId);
  const infoEl = document.getElementById('loc-modal-move-info');
  const rackSelect = document.getElementById('loc-modal-move-rack');

  if (infoEl) {
    infoEl.innerHTML = item ? `
      <div class="space-y-0.5">
        <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${escapeHtml(tagId)}</span>
        <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.style)} - ${escapeHtml(item.color)} (${escapeHtml(item.size)} ${escapeHtml(item.part)})</div>
        <div class="text-slate-500">Current Location: <strong>${escapeHtml(item.rackName || item.rackId)} > ${escapeHtml(item.palletName || item.palletId)}</strong></div>
      </div>
    ` : `<span class="font-mono font-bold">${escapeHtml(tagId)}</span>`;
  }

  if (rackSelect) {
    let html = '<option value="">Select Target Rack</option>';
    (appLocationState.racks || []).forEach(r => {
      html += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });
    rackSelect.innerHTML = html;
    if (item?.rackId) rackSelect.value = item.rackId;
    onModalMoveRackChange(rackSelect.value);
    if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('loc-modal-move-rack');
  }

  const modal = document.getElementById('loc-modal-move-bundle');
  if (modal) modal.classList.remove('hidden');
}

async function submitModalMoveBundle() {
  if (!moveTargetTagId) return;
  const rackId = document.getElementById('loc-modal-move-rack')?.value;
  const palletId = document.getElementById('loc-modal-move-pallet')?.value;

  if (!rackId || !palletId) {
    showToast("Please choose target Rack and Pallet.", "error");
    return;
  }

  const tagObj = findBundleTagById(moveTargetTagId) || { id: moveTargetTagId, tagId: moveTargetTagId };
  await assignBundlesToLocation(rackId, palletId, [tagObj]);
  closeModal('loc-modal-move-bundle');
  moveTargetTagId = null;
}

let selectedAuditTagIds = new Set();
window.selectedAuditTagIds = selectedAuditTagIds;

function setDispatchDestPreset(preset) {
  const input = document.getElementById('loc-modal-dispatch-dest');
  if (input) input.value = preset;
}

function handleAuditRowCheckboxChange(tagId, isChecked) {
  if (!tagId) return;
  if (isChecked) {
    selectedAuditTagIds.add(tagId);
  } else {
    selectedAuditTagIds.delete(tagId);
  }
  const rowCb = document.querySelector(`.loc-audit-row-cb[value="${tagId}"]`);
  if (rowCb) rowCb.checked = isChecked;
  updateAuditSelectedCount();
}

function toggleSelectAllAuditBundles(isChecked) {
  const cbs = document.querySelectorAll('.loc-audit-row-cb');
  cbs.forEach(cb => {
    cb.checked = isChecked;
    const tagId = cb.value;
    if (tagId) {
      if (isChecked) selectedAuditTagIds.add(tagId);
      else selectedAuditTagIds.delete(tagId);
    }
  });
  updateAuditSelectedCount();
}

function clearAuditSelection() {
  selectedAuditTagIds.clear();
  const cbs = document.querySelectorAll('.loc-audit-row-cb');
  cbs.forEach(cb => cb.checked = false);
  const headerCb = document.getElementById('loc-audit-header-select-all');
  if (headerCb) headerCb.checked = false;
  updateAuditSelectedCount();
}

function updateAuditSelectedCount() {
  const count = selectedAuditTagIds.size;
  const badge = document.getElementById('loc-audit-selected-badge');
  if (badge) badge.textContent = count;
  const clearBtn = document.getElementById('loc-audit-clear-sel-btn');
  if (clearBtn) {
    if (count > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const cbs = Array.from(document.querySelectorAll('.loc-audit-row-cb'));
  const headerCb = document.getElementById('loc-audit-header-select-all');
  if (headerCb) {
    headerCb.checked = (cbs.length > 0 && cbs.every(cb => cb.checked));
  }
}

function openAuditBulkDispatchModal() {
  if (selectedAuditTagIds.size === 0) {
    showToast("Please select one or more bundles with the checkboxes to bulk dispatch.", "warning");
    return;
  }
  openDispatchBundleModal(Array.from(selectedAuditTagIds));
}

function openDispatchBundleModal(tagIds) {
  dispatchTargetTagIds = Array.isArray(tagIds) ? tagIds : [tagIds];
  const infoEl = document.getElementById('loc-modal-dispatch-info');
  if (infoEl) {
    const count = dispatchTargetTagIds.length;
    const targetBundles = dispatchTargetTagIds.map(tId => (appLocationState.bundleLocations || []).find(b => b.tagId === tId || b.id === tId)).filter(Boolean);

    const styles = [...new Set(targetBundles.map(b => b.style).filter(Boolean))];
    const colors = [...new Set(targetBundles.map(b => b.color).filter(Boolean))];
    const dockets = [...new Set(targetBundles.map(b => b.docketNo || b.docket).filter(Boolean))];

    let summaryDetails = '';
    if (targetBundles.length === 1) {
      const b = targetBundles[0];
      summaryDetails = `
        <div class="space-y-1 mt-2 text-slate-700 dark:text-slate-300">
          <div class="flex items-center justify-between"><span class="text-slate-400">Tag ID:</span> <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${escapeHtml(b.tagId)}</span></div>
          <div class="flex items-center justify-between"><span class="text-slate-400">Style / Color:</span> <span class="font-bold">${escapeHtml(b.style || '—')} / ${escapeHtml(b.color || '—')}</span></div>
          <div class="flex items-center justify-between"><span class="text-slate-400">Size / Part:</span> <span class="font-bold">${escapeHtml(b.size || '—')} (${escapeHtml(b.part || '—')})</span></div>
          <div class="flex items-center justify-between"><span class="text-slate-400">Docket / Lay Job:</span> <span class="font-mono font-bold">${escapeHtml(b.docketNo || '—')} / ${escapeHtml(b.layJobNo || '—')}</span></div>
          <div class="flex items-center justify-between"><span class="text-slate-400">Current Location:</span> <span class="font-bold text-slate-900 dark:text-slate-100">🏢 ${escapeHtml(b.rackName || b.rackId)} ➔ 📦 ${escapeHtml(b.palletName || b.palletId)}</span></div>
        </div>
      `;
    } else {
      summaryDetails = `
        <div class="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
          <div class="flex items-center justify-between text-[11px] font-semibold"><span class="text-slate-400">Styles Included:</span> <span class="font-bold truncate max-w-[240px]">${escapeHtml(styles.join(', ') || 'Various')}</span></div>
          <div class="flex items-center justify-between text-[11px] font-semibold"><span class="text-slate-400">Colors:</span> <span class="font-bold truncate max-w-[240px]">${escapeHtml(colors.join(', ') || 'Various')}</span></div>
          ${dockets.length > 0 ? `<div class="flex items-center justify-between text-[11px] font-semibold"><span class="text-slate-400">Docket(s):</span> <span class="font-mono font-bold truncate max-w-[240px]">${escapeHtml(dockets.join(', '))}</span></div>` : ''}
          <div class="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
            <span class="text-[10px] font-bold uppercase text-slate-400">Selected Tags Preview (${count} total):</span>
            <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto mt-1 custom-scrollbar">
              ${dispatchTargetTagIds.slice(0, 40).map(tId => `
                <span class="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-blue-200/60 dark:border-blue-800/60">${escapeHtml(tId)}</span>
              `).join('')}
              ${count > 40 ? `<span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[10px]">+${count - 40} more</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    infoEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xl">📦</span>
        <div>
          <div class="font-bold text-slate-800 dark:text-slate-100 text-sm">
            Ready to dispatch <span class="text-amber-600 dark:text-amber-400">${count} bundle(s)</span>
          </div>
          <p class="text-[10px] text-slate-400">Move inventory status from Storage to Sewing Production Line</p>
        </div>
      </div>
      ${summaryDetails}
    `;
  }
  const modal = document.getElementById('loc-modal-dispatch-bundle');
  if (modal) modal.classList.remove('hidden');
}

async function submitModalDispatchBundle() {
  if (dispatchTargetTagIds.length === 0) return;
  const dest = (document.getElementById('loc-modal-dispatch-dest')?.value || 'Sewing Line 1').trim();
  const notes = (document.getElementById('loc-modal-dispatch-notes')?.value || '').trim();

  const now = new Date().toISOString();
  let count = 0;

  dispatchTargetTagIds.forEach(tId => {
    const item = (appLocationState.bundleLocations || []).find(b => b.tagId === tId || b.id === tId);
    if (item) {
      item.status = 'DISPATCHED';
      item.dispatchedAt = now;
      item.dispatchedTo = dest;
      item.notes = notes || item.notes || '';

      appLocationState.history.unshift({
        id: 'HIST-' + Date.now() + '-' + Math.floor(Math.random()*1000),
        timestamp: now,
        action: 'DISPATCH',
        tagId: tId,
        style: item.style || '',
        fromLocation: `${item.rackName || item.rackId} > ${item.palletName || item.palletId}`,
        toLocation: dest,
        details: `Dispatched ${item.style || ''} ${item.size || ''} ${item.part || ''} to ${dest}`
      });
      count++;
      selectedAuditTagIds.delete(tId);
    }
  });

  if (appLocationState.history.length > 500) appLocationState.history = appLocationState.history.slice(0, 500);

  await saveLocationDatabase();
  closeModal('loc-modal-dispatch-bundle');
  showToast(`Successfully dispatched ${count} bundle(s) to ${dest}!`, "success");
  dispatchTargetTagIds = [];
  updateAuditSelectedCount();
}

function sortAuditTable(col) {
  if (auditSortColumn === col) {
    auditSortDirection = auditSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    auditSortColumn = col;
    auditSortDirection = 'asc';
  }
  renderLocationAuditTable(false);
}

function onAuditDatePresetChange(preset) {
  const customDatesEl = document.getElementById('loc-audit-custom-dates');
  const startEl = document.getElementById('loc-audit-date-start');
  const endEl = document.getElementById('loc-audit-date-end');
  const now = new Date();

  const toDateStr = d => d.toISOString().slice(0, 10);

  if (preset === 'CUSTOM') {
    if (customDatesEl) customDatesEl.classList.remove('hidden');
  } else {
    if (customDatesEl) customDatesEl.classList.add('hidden');
    if (preset === 'ALL') {
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
    } else if (preset === 'TODAY') {
      const todayStr = toDateStr(now);
      if (startEl) startEl.value = todayStr;
      if (endEl) endEl.value = todayStr;
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = toDateStr(yest);
      if (startEl) startEl.value = yestStr;
      if (endEl) endEl.value = yestStr;
    } else if (preset === 'LAST_7_DAYS') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (startEl) startEl.value = toDateStr(past7);
      if (endEl) endEl.value = toDateStr(now);
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (startEl) startEl.value = toDateStr(past30);
      if (endEl) endEl.value = toDateStr(now);
    }
  }
  onAuditStatusOrDateChange();
}

function onAuditStatusOrDateChange() {
  populateAuditFilterDropdowns(appLocationState.bundleLocations || [], true);
  renderLocationAuditTable(true);
}

function onAuditDropdownFilterChange(triggerField) {
  populateAuditFilterDropdowns(appLocationState.bundleLocations || [], true);
  renderLocationAuditTable(true);
}

function populateAuditFilterDropdowns(allLocations, preserveCurrent = true) {
  const styleSelect = document.getElementById('loc-audit-filter-style');
  const colorSelect = document.getElementById('loc-audit-filter-color');
  const schedSelect = document.getElementById('loc-audit-filter-sched');
  const docketSelect = document.getElementById('loc-audit-filter-docket');
  const jobSelect = document.getElementById('loc-audit-filter-job');
  const partSelect = document.getElementById('loc-audit-filter-part');
  const sizeSelect = document.getElementById('loc-audit-filter-size');
  const rackSelect = document.getElementById('loc-audit-filter-rack');

  const curStyle = preserveCurrent ? (styleSelect?.value || '') : '';
  const curColor = preserveCurrent ? (colorSelect?.value || '') : '';
  const curSched = preserveCurrent ? (schedSelect?.value || '') : '';
  const curDocket = preserveCurrent ? (docketSelect?.value || '') : '';
  const curJob = preserveCurrent ? (jobSelect?.value || '') : '';
  const curPart = preserveCurrent ? (partSelect?.value || '') : '';
  const curSize = preserveCurrent ? (sizeSelect?.value || '') : '';
  const curRack = preserveCurrent ? (rackSelect?.value || '') : '';

  const statusFilter = document.getElementById('loc-audit-status-filter')?.value || 'ALL';
  const startDate = document.getElementById('loc-audit-date-start')?.value || '';
  const endDate = document.getElementById('loc-audit-date-end')?.value || '';

  let baseItems = allLocations || [];
  if (statusFilter !== 'ALL') {
    baseItems = baseItems.filter(b => b.status === statusFilter);
  }
  if (startDate) {
    baseItems = baseItems.filter(b => (b.assignedAt || b.updatedAt || '').slice(0, 10) >= startDate);
  }
  if (endDate) {
    baseItems = baseItems.filter(b => (b.assignedAt || b.updatedAt || '').slice(0, 10) <= endDate);
  }

  const enrichedItems = baseItems.map(b => {
    let docket = b.docketNo || b.docket || '';
    let layJob = b.layJobNo || b.jobNo || '';
    if (!docket || !layJob) {
      const tag = findBundleTagById(b.tagId);
      if (tag) {
        docket = docket || tag.docketNo || tag.docket || '';
        layJob = layJob || tag.layJobNo || tag.jobNo || '';
      }
    }
    return { ...b, docketNo: docket, layJobNo: layJob };
  });

  const getCounts = (filteredList, keyFn) => {
    const counts = {};
    filteredList.forEach(t => {
      const k = keyFn(t);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  };

  const matchStyle = t => !curStyle || (t.style || '') === curStyle;
  const matchColor = t => !curColor || (t.color || '') === curColor;
  const matchSched = t => !curSched || (t.schedule || t.po || '') === curSched;
  const matchDocket = t => !curDocket || (t.docketNo || t.docket || '') === curDocket;
  const matchJob = t => !curJob || (t.layJobNo || t.jobNo || '') === curJob;
  const matchPart = t => !curPart || (t.part || '') === curPart;
  const matchSize = t => !curSize || (t.size || '') === curSize;
  const matchRack = t => !curRack || (t.rackName || t.rackId || '') === curRack;

  const forStyle = enrichedItems.filter(t => matchColor(t) && matchSched(t) && matchDocket(t) && matchJob(t) && matchPart(t) && matchSize(t) && matchRack(t));
  const forColor = enrichedItems.filter(t => matchStyle(t) && matchSched(t) && matchDocket(t) && matchJob(t) && matchPart(t) && matchSize(t) && matchRack(t));
  const forSched = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchDocket(t) && matchJob(t) && matchPart(t) && matchSize(t) && matchRack(t));
  const forDocket = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchJob(t) && matchPart(t) && matchSize(t) && matchRack(t));
  const forJob = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchDocket(t) && matchPart(t) && matchSize(t) && matchRack(t));
  const forPart = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchDocket(t) && matchJob(t) && matchSize(t) && matchRack(t));
  const forSize = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchDocket(t) && matchJob(t) && matchPart(t) && matchRack(t));
  const forRack = enrichedItems.filter(t => matchStyle(t) && matchColor(t) && matchSched(t) && matchDocket(t) && matchJob(t) && matchPart(t) && matchSize(t));

  const styleCounts = getCounts(forStyle, t => t.style);
  const colorCounts = getCounts(forColor, t => t.color);
  const schedCounts = getCounts(forSched, t => t.schedule || t.po);
  const docketCounts = getCounts(forDocket, t => t.docketNo || t.docket);
  const jobCounts = getCounts(forJob, t => t.layJobNo || t.jobNo);
  const partCounts = getCounts(forPart, t => t.part);
  const sizeCounts = getCounts(forSize, t => t.size);
  const rackCounts = getCounts(forRack, t => t.rackName || t.rackId);

  const renderOptions = (selectEl, countsMap, currentVal, defaultLabel) => {
    if (!selectEl) return;
    const keys = Object.keys(countsMap).sort();
    let optHtml = `<option value="">${defaultLabel} (${keys.length})</option>`;
    keys.forEach(k => {
      const selectedAttr = (k === currentVal) ? 'selected' : '';
      optHtml += `<option value="${escapeHtml(k)}" ${selectedAttr}>${escapeHtml(k)} (${countsMap[k]})</option>`;
    });
    selectEl.innerHTML = optHtml;
    if (keys.includes(currentVal)) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = '';
    }
  };

  renderOptions(styleSelect, styleCounts, curStyle, 'All Styles');
  renderOptions(colorSelect, colorCounts, curColor, 'All Colors');
  renderOptions(schedSelect, schedCounts, curSched, 'All Schedules');
  renderOptions(docketSelect, docketCounts, curDocket, 'All Dockets');
  renderOptions(jobSelect, jobCounts, curJob, 'All Lay Jobs');
  renderOptions(partSelect, partCounts, curPart, 'All Parts');
  renderOptions(sizeSelect, sizeCounts, curSize, 'All Sizes');
  renderOptions(rackSelect, rackCounts, curRack, 'All Racks');
}

function resetAuditFilters() {
  const searchInput = document.getElementById('loc-audit-search');
  const statusSelect = document.getElementById('loc-audit-status-filter');
  const presetSelect = document.getElementById('loc-audit-date-preset');
  const startEl = document.getElementById('loc-audit-date-start');
  const endEl = document.getElementById('loc-audit-date-end');
  const customDatesEl = document.getElementById('loc-audit-custom-dates');

  if (searchInput) searchInput.value = '';
  if (statusSelect) statusSelect.value = 'ALL';
  if (presetSelect) presetSelect.value = 'ALL';
  if (startEl) startEl.value = '';
  if (endEl) endEl.value = '';
  if (customDatesEl) customDatesEl.classList.add('hidden');

  populateAuditFilterDropdowns(appLocationState.bundleLocations || [], false);
  renderLocationAuditTable(true);
}

function changeAuditPage(newPage) {
  auditCurrentPage = newPage;
  renderLocationAuditTable(false);
  const tableWrapper = document.getElementById('loc-audit-table-rows')?.parentElement?.parentElement;
  if (tableWrapper) tableWrapper.scrollTop = 0;
}

function renderLocationAuditTable(resetPage = false) {
  if (resetPage) auditCurrentPage = 1;

  const tbody = document.getElementById('loc-audit-table-rows');
  const histBody = document.getElementById('loc-history-rows');
  const histCount = document.getElementById('loc-history-count');
  const pageInfoEl = document.getElementById('loc-audit-page-info');
  const paginationControlsEl = document.getElementById('loc-audit-pagination-controls');
  if (!tbody) return;

  const searchQ = (document.getElementById('loc-audit-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('loc-audit-status-filter')?.value || 'ALL';
  const startDate = document.getElementById('loc-audit-date-start')?.value || '';
  const endDate = document.getElementById('loc-audit-date-end')?.value || '';

  const fStyle = document.getElementById('loc-audit-filter-style')?.value || '';
  const fColor = document.getElementById('loc-audit-filter-color')?.value || '';
  const fSched = document.getElementById('loc-audit-filter-sched')?.value || '';
  const fDocket = document.getElementById('loc-audit-filter-docket')?.value || '';
  const fJob = document.getElementById('loc-audit-filter-job')?.value || '';
  const fPart = document.getElementById('loc-audit-filter-part')?.value || '';
  const fSize = document.getElementById('loc-audit-filter-size')?.value || '';
  const fRack = document.getElementById('loc-audit-filter-rack')?.value || '';

  let items = appLocationState.bundleLocations || [];

  if (statusFilter !== 'ALL') {
    items = items.filter(b => b.status === statusFilter);
  }
  if (startDate) {
    items = items.filter(b => (b.assignedAt || b.updatedAt || '').slice(0, 10) >= startDate);
  }
  if (endDate) {
    items = items.filter(b => (b.assignedAt || b.updatedAt || '').slice(0, 10) <= endDate);
  }

  items = items.map(b => {
    let docket = b.docketNo || b.docket || '';
    let layJob = b.layJobNo || b.jobNo || '';
    if (!docket || !layJob) {
      const foundTag = findBundleTagById(b.tagId);
      if (foundTag) {
        docket = docket || foundTag.docketNo || foundTag.docket || '';
        layJob = layJob || foundTag.layJobNo || foundTag.jobNo || '';
      }
    }
    if (!docket || !layJob) {
      const foundLog = (appState.logs || []).find(l => (l.batchId || l.id) === b.batchId);
      if (foundLog) {
        docket = docket || foundLog.docketNo || foundLog.docket || '';
        layJob = layJob || foundLog.layJobNo || foundLog.jobNo || '';
      }
    }
    return {
      ...b,
      docketNo: docket,
      docket: docket,
      layJobNo: layJob,
      jobNo: layJob,
      location: `${b.rackName || b.rackId} > ${b.palletName || b.palletId}`
    };
  });

  if (fStyle) items = items.filter(b => (b.style || '') === fStyle);
  if (fColor) items = items.filter(b => (b.color || '') === fColor);
  if (fSched) items = items.filter(b => (b.schedule || b.po || '') === fSched);
  if (fDocket) items = items.filter(b => (b.docketNo || '') === fDocket);
  if (fJob) items = items.filter(b => (b.layJobNo || '') === fJob);
  if (fPart) items = items.filter(b => (b.part || '') === fPart);
  if (fSize) items = items.filter(b => (b.size || '') === fSize);
  if (fRack) items = items.filter(b => (b.rackName || b.rackId || '') === fRack);

  if (searchQ) {
    items = items.filter(b => {
      return (b.tagId || '').toLowerCase().includes(searchQ) ||
        (b.style || '').toLowerCase().includes(searchQ) ||
        (b.color || '').toLowerCase().includes(searchQ) ||
        (b.size || '').toLowerCase().includes(searchQ) ||
        (b.part || '').toLowerCase().includes(searchQ) ||
        (b.docketNo || '').toLowerCase().includes(searchQ) ||
        (b.layJobNo || '').toLowerCase().includes(searchQ) ||
        (b.rackName || '').toLowerCase().includes(searchQ) ||
        (b.palletName || '').toLowerCase().includes(searchQ) ||
        (b.batchId || '').toLowerCase().includes(searchQ) ||
        (b.plyRange || '').toLowerCase().includes(searchQ);
    });
  }

  if (typeof universalSortArray === 'function') {
    items = universalSortArray(items, auditSortColumn, auditSortDirection);
    updateSortIcons('audit', auditSortColumn, auditSortDirection, ['tagId', 'style', 'color', 'size', 'part', 'docketNo', 'layJobNo', 'plyRange', 'location', 'status', 'assignedAt']);
  }

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / auditPageSize));
  if (auditCurrentPage > totalPages) auditCurrentPage = totalPages;
  if (auditCurrentPage < 1) auditCurrentPage = 1;

  const startIdx = (auditCurrentPage - 1) * auditPageSize;
  const endIdx = Math.min(startIdx + auditPageSize, totalCount);
  const pageItems = items.slice(startIdx, endIdx);

  if (pageInfoEl) {
    pageInfoEl.textContent = totalCount === 0
      ? 'No matching bundles'
      : `Showing ${startIdx + 1}–${endIdx} of ${totalCount} bundles (100 per page)`;
  }

  if (paginationControlsEl) {
    if (totalPages <= 1) {
      paginationControlsEl.innerHTML = `<span class="px-2.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg">Page 1 of 1</span>`;
    } else {
      let navHtml = `
        <button type="button" onclick="changeAuditPage(1)" ${auditCurrentPage === 1 ? 'disabled' : ''} class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition">« First</button>
        <button type="button" onclick="changeAuditPage(${auditCurrentPage - 1})" ${auditCurrentPage === 1 ? 'disabled' : ''} class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition">‹ Prev</button>
        <span class="px-3 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-mono font-bold text-xs">
          Page ${auditCurrentPage} / ${totalPages}
        </span>
        <button type="button" onclick="changeAuditPage(${auditCurrentPage + 1})" ${auditCurrentPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition">Next ›</button>
        <button type="button" onclick="changeAuditPage(${totalPages})" ${auditCurrentPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition">Last »</button>
      `;
      paginationControlsEl.innerHTML = navHtml;
    }
  }

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400 text-xs">No bundle location records found matching your filters.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(b => {
      const isChecked = selectedAuditTagIds.has(b.tagId);
      const isStored = b.status === 'STORED';

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="p-2 text-center">
            ${isStored ? `
              <input type="checkbox" class="loc-audit-row-cb w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
                value="${escapeHtml(b.tagId)}" ${isChecked ? 'checked' : ''} onchange="handleAuditRowCheckboxChange('${escapeHtml(b.tagId)}', this.checked)" />
            ` : `
              <span class="text-slate-300 dark:text-slate-700 font-mono text-[10px]">—</span>
            `}
          </td>
          <td class="p-2 font-mono font-bold text-blue-600 dark:text-blue-400">${escapeHtml(b.tagId)}</td>
          <td class="p-2 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(b.style || '—')}</td>
          <td class="p-2 text-slate-600 dark:text-slate-300">${escapeHtml(b.color || '—')}</td>
          <td class="p-2"><span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold">${escapeHtml(b.size || '—')}</span></td>
          <td class="p-2">${escapeHtml(b.part || '—')}</td>
          <td class="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">${escapeHtml(b.docketNo || '—')}</td>
          <td class="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">${escapeHtml(b.layJobNo || '—')}</td>
          <td class="p-2 font-mono">${escapeHtml(b.plyRange || '—')}</td>
          <td class="p-2 font-bold text-slate-900 dark:text-slate-100">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
              🏢 ${escapeHtml(b.rackName || b.rackId)} ➔ 📦 ${escapeHtml(b.palletName || b.palletId)}
            </span>
          </td>
          <td class="p-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isStored ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
              ${isStored ? '🟢 Stored' : '📦 Dispatched'}
            </span>
          </td>
          <td class="p-2 text-[11px] text-slate-400 font-mono">${(b.assignedAt || '').slice(0, 16).replace('T', ' ')}</td>
          <td class="p-2 text-right space-x-1">
            <button onclick="openMoveBundleModal('${escapeHtml(b.tagId)}')" class="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-bold cursor-pointer transition shadow-2xs">Move</button>
            ${isStored ? `
              <button onclick="openDispatchBundleModal(['${escapeHtml(b.tagId)}'])" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold cursor-pointer transition shadow-2xs">Dispatch</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  updateAuditSelectedCount();
  renderLocationHistoryLog();
}

function sortHistoryTable(col) {
  if (historySortColumn === col) {
    historySortDirection = historySortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    historySortColumn = col;
    historySortDirection = 'asc';
  }
  renderLocationHistoryLog();
}

function renderLocationHistoryLog() {
  const histBody = document.getElementById('loc-history-rows');
  const histCount = document.getElementById('loc-history-count');
  if (!histBody) return;

  let history = appLocationState.history || [];
  if (histCount) histCount.textContent = `${history.length} Events`;

  if (typeof universalSortArray === 'function') {
    history = universalSortArray(history, historySortColumn, historySortDirection);
    updateSortIcons('history', historySortColumn, historySortDirection, ['timestamp', 'action', 'tagId', 'style', 'details']);
  }

  if (history.length === 0) {
    histBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No activity history recorded yet.</td></tr>`;
  } else {
    histBody.innerHTML = history.slice(0, 50).map(h => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="p-2 text-slate-400">${(h.timestamp || '').slice(0, 19).replace('T', ' ')}</td>
        <td class="p-2">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${h.action === 'ASSIGN' ? 'bg-emerald-100 text-emerald-800' : h.action === 'MOVE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}">
            ${h.action}
          </span>
        </td>
        <td class="p-2 text-blue-600 dark:text-blue-400 font-mono font-bold">${escapeHtml(h.tagId || '')}</td>
        <td class="p-2 font-bold">${escapeHtml(h.style || '')}</td>
        <td class="p-2 text-slate-600 dark:text-slate-300 font-sans">${escapeHtml(h.details || `${h.fromLocation || ''} ➔ ${h.toLocation || ''}`)}</td>
      </tr>
    `).join('');
  }
}

function sortSessionTable(col) {
  if (sessionSortColumn === col) {
    sessionSortDirection = sessionSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sessionSortColumn = col;
    sessionSortDirection = 'asc';
  }
  renderSessionScanLog();
}

function renderRackPalletSetupTable() {
  const tbody = document.getElementById('loc-master-setup-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  const racks = appLocationState.racks || [];
  const pallets = appLocationState.pallets || [];
  const bundleLocations = appLocationState.bundleLocations || [];

  if (racks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 text-xs italic">No storage racks configured yet. Use the form above to add racks.</td></tr>`;
    return;
  }

  let tableData = racks.map(r => {
    const rackPallets = pallets.filter(p => p.rackId === r.id);
    const palIds = new Set(rackPallets.map(p => p.id));
    const storedBundles = bundleLocations.filter(b => b.rackId === r.id || palIds.has(b.palletId));
    return {
      id: r.id,
      name: r.name,
      zone: r.zone || 'Default',
      palletsCount: rackPallets.length,
      pallets: rackPallets,
      storedCount: storedBundles.length
    };
  });

  if (typeof universalSortArray === 'function' && masterSetupSortColumn) {
    tableData = universalSortArray(tableData, masterSetupSortColumn, masterSetupSortDirection);
    updateSortIcons('setup', masterSetupSortColumn, masterSetupSortDirection, ['name', 'zone', 'palletsCount', 'storedCount']);
  }

  tableData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 text-xs";
    
    const palBadges = row.pallets.map(p => {
      const pStored = bundleLocations.filter(b => b.palletId === p.id).length;
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] border border-indigo-200/80 dark:border-indigo-800">
        📦 ${escapeHtml(p.name)} <span class="text-slate-400 font-normal">(${pStored}/${p.maxCapacity || 50})</span>
      </span>`;
    }).join(' ') || '<span class="text-slate-400 italic text-[11px]">No pallets</span>';

    tr.innerHTML = `
      <td class="p-2.5 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
        <span>${escapeHtml(row.name)}</span>
        <span class="text-[10px] font-mono text-slate-400">(${escapeHtml(row.id)})</span>
      </td>
      <td class="p-2.5 font-medium text-slate-600 dark:text-slate-400">${escapeHtml(row.zone)}</td>
      <td class="p-2.5 font-bold text-blue-600 dark:text-blue-400 font-mono">${row.palletsCount}</td>
      <td class="p-2.5"><div class="flex flex-wrap gap-1">${palBadges}</div></td>
      <td class="p-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">${row.storedCount} Bundles</td>
      <td class="p-2.5 text-right space-x-1.5">
        <button type="button" onclick="selectRackForPalletCreation('${escapeHtml(row.id)}')" title="Add Pallet" class="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-xs cursor-pointer">➕ Pallet</button>
        <button type="button" onclick="openEditRackModal('${escapeHtml(row.id)}')" title="Edit Rack" class="p-1 text-slate-400 hover:text-blue-600 cursor-pointer">✏️</button>
        <button type="button" onclick="deleteRack('${escapeHtml(row.id)}')" title="Delete Rack" class="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function sortMasterSetupTable(col) {
  if (masterSetupSortColumn === col) {
    masterSetupSortDirection = masterSetupSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    masterSetupSortColumn = col;
    masterSetupSortDirection = 'asc';
  }
  renderRackPalletSetupTable();
}

function exportLocationInventoryCSV() {
  const items = appLocationState.bundleLocations || [];
  if (items.length === 0) {
    showToast("No location records to export.", "error");
    return;
  }
  const headers = ['Tag ID', 'Batch ID', 'Style', 'Color', 'Size', 'Part', 'Docket No', 'Lay Job No', 'Ply Range', 'Rack ID', 'Rack Name', 'Pallet ID', 'Pallet Name', 'Status', 'Assigned Date', 'Dispatched To'];
  const rows = items.map(b => {
    let docketVal = b.docketNo || b.docket || '';
    let layJobVal = b.layJobNo || b.jobNo || '';
    if (!docketVal || !layJobVal) {
      const foundTag = findBundleTagById(b.tagId);
      if (foundTag) {
        docketVal = docketVal || foundTag.docketNo || foundTag.docket || '';
        layJobVal = layJobVal || foundTag.layJobNo || foundTag.jobNo || '';
      }
    }
    if (!docketVal || !layJobVal) {
      const foundLog = (appState.logs || []).find(l => (l.batchId || l.id) === b.batchId);
      if (foundLog) {
        docketVal = docketVal || foundLog.docketNo || foundLog.docket || '';
        layJobVal = layJobVal || foundLog.layJobNo || foundLog.jobNo || '';
      }
    }

    return [
      `"${(b.tagId || '').replace(/"/g, '""')}"`,
      `"${(b.batchId || '').replace(/"/g, '""')}"`,
      `"${(b.style || '').replace(/"/g, '""')}"`,
      `"${(b.color || '').replace(/"/g, '""')}"`,
      `"${(b.size || '').replace(/"/g, '""')}"`,
      `"${(b.part || '').replace(/"/g, '""')}"`,
      `"${docketVal.replace(/"/g, '""')}"`,
      `"${layJobVal.replace(/"/g, '""')}"`,
      `"${(b.plyRange || '').replace(/"/g, '""')}"`,
      `"${(b.rackId || '').replace(/"/g, '""')}"`,
      `"${(b.rackName || '').replace(/"/g, '""')}"`,
      `"${(b.palletId || '').replace(/"/g, '""')}"`,
      `"${(b.palletName || '').replace(/"/g, '""')}"`,
      `"${(b.status || '').replace(/"/g, '""')}"`,
      `"${(b.assignedAt || '').replace(/"/g, '""')}"`,
      `"${(b.dispatchedTo || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `garment_location_inventory_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Exported location inventory to CSV!", "success");
}

function openPrintLocationLabelsModal() {
  populateLocationDropdowns();
  renderPrintableLocationLabels();
  const modal = document.getElementById('loc-modal-print-labels');
  if (modal) modal.classList.remove('hidden');
}

function renderPrintableLocationLabels() {
  const container = document.getElementById('loc-print-preview-container');
  if (!container) return;
  const filterRack = document.getElementById('loc-print-filter-rack')?.value || 'ALL';

  const racks = appLocationState.racks || [];
  const pallets = appLocationState.pallets || [];

  let targetPallets = pallets;
  if (filterRack !== 'ALL') {
    targetPallets = pallets.filter(p => p.rackId === filterRack);
  }

  if (targetPallets.length === 0) {
    container.innerHTML = `<div class="col-span-full p-6 text-center text-slate-400">No pallets found for selected rack.</div>`;
    return;
  }

  let html = '';
  targetPallets.forEach(pal => {
    const parentRack = racks.find(r => r.id === pal.rackId) || { name: pal.rackId, zone: 'Main' };
    const qrCodeText = `LOC:${pal.rackId}:${pal.id}`;
    const qrUrl = typeof getQRCodeUrl === 'function' ? getQRCodeUrl(qrCodeText) : '';

    html += `
      <div class="p-4 bg-white border-2 border-black rounded-xl text-black flex items-center justify-between gap-3 shadow-xs">
        <div class="space-y-1">
          <div class="text-[10px] font-extrabold uppercase tracking-widest text-black bg-gray-200 px-2 py-0.5 rounded inline-block border border-black">
            ${escapeHtml(parentRack.zone || 'Cutting Floor')}
          </div>
          <div class="text-sm font-extrabold tracking-tight text-black">${escapeHtml(parentRack.name)}</div>
          <div class="text-lg font-black text-black tracking-tighter">${escapeHtml(pal.name)}</div>
          <div class="text-[10px] font-mono font-bold text-gray-700">CAP: ${pal.capacity} BUNDLES</div>
        </div>
        <div class="shrink-0 flex flex-col items-center">
          <img src="${qrUrl}" alt="${qrCodeText}" class="w-16 h-16 border-2 border-black p-0.5 bg-white" />
          <span class="text-[8px] font-mono font-bold mt-0.5 text-black">${pal.id}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ==============================================================================
 * DISPATCH & RELEASE MANAGEMENT MODULE
 * Allows releasing stored bundles from Racks/Pallets to Sewing Lines / Finishing
 * ============================================================================== */

let currentDispatchLoadedTags = [];
let selectedDispatchBundleIds = new Set();
let dispatchSortColumn = 'tagId';
let dispatchSortDirection = 'asc';

function sortDispatchTable(col) {
  if (dispatchSortColumn === col) {
    dispatchSortDirection = dispatchSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    dispatchSortColumn = col;
    dispatchSortDirection = 'asc';
  }
  filterDispatchBundlesTable();
}

function populateDispatchFilterDropdowns(tags, preserveCurrent = true) {
  const styleSelect = document.getElementById('loc-dispatch-filter-style');
  const colorSelect = document.getElementById('loc-dispatch-filter-color');
  const rackSelect = document.getElementById('loc-dispatch-filter-rack');
  const palletSelect = document.getElementById('loc-dispatch-filter-pallet');
  const schedSelect = document.getElementById('loc-dispatch-filter-sched');
  const partSelect = document.getElementById('loc-dispatch-filter-part');
  const sizeSelect = document.getElementById('loc-dispatch-filter-size');

  const curStyle = preserveCurrent ? (styleSelect?.value || '') : '';
  const curColor = preserveCurrent ? (colorSelect?.value || '') : '';
  const curRack = preserveCurrent ? (rackSelect?.value || '') : '';
  const curPallet = preserveCurrent ? (palletSelect?.value || '') : '';
  const curSched = preserveCurrent ? (schedSelect?.value || '') : '';
  const curPart = preserveCurrent ? (partSelect?.value || '') : '';
  const curSize = preserveCurrent ? (sizeSelect?.value || '') : '';

  const getCounts = (filteredList, keyFn) => {
    const counts = {};
    filteredList.forEach(t => {
      const k = keyFn(t);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  };

  const matchStyle = t => !curStyle || (t.style || '') === curStyle;
  const matchColor = t => !curColor || (t.color || '') === curColor;
  const matchRack = t => !curRack || (t.rackName || t.rackId || '') === curRack;
  const matchPallet = t => !curPallet || (t.palletName || t.palletId || '') === curPallet;
  const matchSched = t => !curSched || (t.schedule || t.po || '') === curSched;
  const matchPart = t => !curPart || (t.part || '') === curPart;
  const matchSize = t => !curSize || (t.size || '') === curSize;

  const forStyle = tags.filter(t => matchColor(t) && matchRack(t) && matchPallet(t) && matchSched(t) && matchPart(t) && matchSize(t));
  const forColor = tags.filter(t => matchStyle(t) && matchRack(t) && matchPallet(t) && matchSched(t) && matchPart(t) && matchSize(t));
  const forRack = tags.filter(t => matchStyle(t) && matchColor(t) && matchPallet(t) && matchSched(t) && matchPart(t) && matchSize(t));
  const forPallet = tags.filter(t => matchStyle(t) && matchColor(t) && matchRack(t) && matchSched(t) && matchPart(t) && matchSize(t));
  const forSched = tags.filter(t => matchStyle(t) && matchColor(t) && matchRack(t) && matchPallet(t) && matchPart(t) && matchSize(t));
  const forPart = tags.filter(t => matchStyle(t) && matchColor(t) && matchRack(t) && matchPallet(t) && matchSched(t) && matchSize(t));
  const forSize = tags.filter(t => matchStyle(t) && matchColor(t) && matchRack(t) && matchPallet(t) && matchSched(t) && matchPart(t));

  const styleCounts = getCounts(forStyle, t => t.style);
  const colorCounts = getCounts(forColor, t => t.color);
  const rackCounts = getCounts(forRack, t => t.rackName || t.rackId);
  const palletCounts = getCounts(forPallet, t => t.palletName || t.palletId);
  const schedCounts = getCounts(forSched, t => t.schedule || t.po);
  const partCounts = getCounts(forPart, t => t.part);
  const sizeCounts = getCounts(forSize, t => t.size);

  const renderOptions = (selectEl, countsMap, currentVal, defaultLabel) => {
    if (!selectEl) return;
    const keys = Object.keys(countsMap).sort();
    let optHtml = `<option value="">${defaultLabel} (${keys.length})</option>`;
    keys.forEach(k => {
      const selectedAttr = (k === currentVal) ? 'selected' : '';
      optHtml += `<option value="${escapeHtml(k)}" ${selectedAttr}>${escapeHtml(k)} (${countsMap[k]})</option>`;
    });
    selectEl.innerHTML = optHtml;
    if (keys.includes(currentVal)) {
      selectEl.value = currentVal;
    } else {
      selectEl.value = '';
    }
  };

  renderOptions(styleSelect, styleCounts, curStyle, 'All Styles');
  renderOptions(colorSelect, colorCounts, curColor, 'All Colors');
  renderOptions(rackSelect, rackCounts, curRack, 'All Racks');
  renderOptions(palletSelect, palletCounts, curPallet, 'All Pallets');
  renderOptions(schedSelect, schedCounts, curSched, 'All Schedules');
  renderOptions(partSelect, partCounts, curPart, 'All Parts');
  renderOptions(sizeSelect, sizeCounts, curSize, 'All Sizes');
}

function onDispatchFilterDropdownChange(triggerField) {
  populateDispatchFilterDropdowns(currentDispatchLoadedTags, true);
  filterDispatchBundlesTable();
}

function resetDispatchBundleFilters() {
  const searchInput = document.getElementById('loc-dispatch-filter-search');
  if (searchInput) searchInput.value = '';
  populateDispatchFilterDropdowns(currentDispatchLoadedTags, false);
  filterDispatchBundlesTable();
}

function filterDispatchBundlesTable() {
  const rowsEl = document.getElementById('loc-dispatch-table-rows');
  const countEl = document.getElementById('loc-dispatch-selected-count');
  const sumEl = document.getElementById('loc-dispatch-summary-info');
  const headerCb = document.getElementById('loc-dispatch-select-all');
  if (!rowsEl) return;

  const searchQ = (document.getElementById('loc-dispatch-filter-search')?.value || '').toLowerCase().trim();
  const fStyle = document.getElementById('loc-dispatch-filter-style')?.value || '';
  const fColor = document.getElementById('loc-dispatch-filter-color')?.value || '';
  const fRack = document.getElementById('loc-dispatch-filter-rack')?.value || '';
  const fPallet = document.getElementById('loc-dispatch-filter-pallet')?.value || '';
  const fSched = document.getElementById('loc-dispatch-filter-sched')?.value || '';
  const fPart = document.getElementById('loc-dispatch-filter-part')?.value || '';
  const fSize = document.getElementById('loc-dispatch-filter-size')?.value || '';

  let filtered = currentDispatchLoadedTags;

  if (fStyle) filtered = filtered.filter(t => (t.style || '') === fStyle);
  if (fColor) filtered = filtered.filter(t => (t.color || '') === fColor);
  if (fRack) filtered = filtered.filter(t => (t.rackName || t.rackId || '') === fRack);
  if (fPallet) filtered = filtered.filter(t => (t.palletName || t.palletId || '') === fPallet);
  if (fSched) filtered = filtered.filter(t => (t.schedule || t.po || '') === fSched);
  if (fPart) filtered = filtered.filter(t => (t.part || '') === fPart);
  if (fSize) filtered = filtered.filter(t => (t.size || '') === fSize);

  if (searchQ) {
    filtered = filtered.filter(t => {
      const tId = (t.tagId || t.id || '').toLowerCase();
      const style = (t.style || '').toLowerCase();
      const color = (t.color || '').toLowerCase();
      const rack = (t.rackName || t.rackId || '').toLowerCase();
      const pallet = (t.palletName || t.palletId || '').toLowerCase();
      const sched = (t.schedule || t.po || '').toLowerCase();
      const size = (t.size || '').toLowerCase();
      const part = (t.part || '').toLowerCase();
      const docket = (t.docketNo || t.docket || '').toLowerCase();
      const layJob = (t.layJobNo || t.jobNo || '').toLowerCase();
      const ply = (t.plyRange || '').toLowerCase();

      return tId.includes(searchQ) ||
        style.includes(searchQ) ||
        color.includes(searchQ) ||
        rack.includes(searchQ) ||
        pallet.includes(searchQ) ||
        sched.includes(searchQ) ||
        size.includes(searchQ) ||
        part.includes(searchQ) ||
        docket.includes(searchQ) ||
        layJob.includes(searchQ) ||
        ply.includes(searchQ);
    });
  }

  if (typeof universalSortArray === 'function') {
    filtered = universalSortArray(filtered, dispatchSortColumn, dispatchSortDirection);
    updateSortIcons('dispatch', dispatchSortColumn, dispatchSortDirection, ['tagId', 'location', 'style', 'color', 'schedule', 'size', 'part', 'docketNo', 'layJobNo', 'plyRange']);
  }

  if (filtered.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="11" class="p-6 text-center text-slate-400 dark:text-slate-500">
          <div class="space-y-1">
            <span class="text-xl block">🔍</span>
            <p class="font-semibold text-xs text-slate-600 dark:text-slate-400">No stored bundles match your filters.</p>
            <button type="button" onclick="resetDispatchBundleFilters()" class="mt-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer">
              Reset Filters
            </button>
          </div>
        </td>
      </tr>
    `;
    if (headerCb) headerCb.checked = false;
    return;
  }

  let visibleCheckedCount = 0;
  let html = '';
  filtered.forEach(t => {
    const tId = t.tagId || t.id;
    const isChecked = selectedDispatchBundleIds.has(tId);
    if (isChecked) visibleCheckedCount++;

    html += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="p-2.5 text-center">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelectDispatchBundle('${escapeHtml(tId)}', this.checked)"
            class="dispatch-bundle-checkbox rounded border-slate-300 dark:border-slate-700 cursor-pointer w-3.5 h-3.5 accent-indigo-600" data-tag-id="${escapeHtml(tId)}" />
        </td>
        <td class="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">${escapeHtml(tId)}</td>
        <td class="p-2.5 text-[11px]">
          <span class="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 text-[10px] whitespace-nowrap">
            🏢 ${escapeHtml(t.rackName || t.rackId)} ➔ 📦 ${escapeHtml(t.palletName || t.palletId)}
          </span>
        </td>
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-xs">${escapeHtml(t.style || '—')}</td>
        <td class="p-2.5 text-slate-600 dark:text-slate-300 text-xs">${escapeHtml(t.color || '—')}</td>
        <td class="p-2.5 font-mono text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(t.schedule || t.po || '—')}</td>
        <td class="p-2.5"><span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-xs">${escapeHtml(t.size || '—')}</span></td>
        <td class="p-2.5 text-xs">${escapeHtml(t.part || '—')}</td>
        <td class="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">${escapeHtml(t.docketNo || t.docket || '—')}</td>
        <td class="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">${escapeHtml(t.layJobNo || t.jobNo || '—')}</td>
        <td class="p-2.5 font-mono text-xs">${escapeHtml(t.plyRange || '—')}</td>
      </tr>
    `;
  });

  rowsEl.innerHTML = html;
  if (headerCb) headerCb.checked = (filtered.length > 0 && visibleCheckedCount === filtered.length);
  if (countEl) countEl.textContent = `${selectedDispatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedDispatchBundleIds.size} of ${currentDispatchLoadedTags.length} stored bundles selected (${filtered.length} visible)`;
}

function onDispatchSourceChange(val) {
  const rowsEl = document.getElementById('loc-dispatch-table-rows');
  const countEl = document.getElementById('loc-dispatch-selected-count');
  const sumEl = document.getElementById('loc-dispatch-summary-info');
  selectedDispatchBundleIds.clear();

  const storedList = (appLocationState.bundleLocations || []).filter(b => b.status === 'STORED');
  let matchedStored = [];

  if (val === 'ALL_STORED' || !val) {
    matchedStored = storedList;
  } else {
    matchedStored = storedList.filter(b => (b.batchId || b.batchTagString) === val);
  }

  const enriched = matchedStored.map(item => {
    let tagInfo = findBundleTagById(item.tagId) || {};
    let style = item.style || tagInfo.style || '';
    let color = item.color || tagInfo.color || '';
    let sched = item.schedule || item.po || tagInfo.schedule || tagInfo.po || '';
    let size = item.size || tagInfo.size || '';
    let part = item.part || tagInfo.part || '';
    let docket = item.docketNo || item.docket || tagInfo.docketNo || tagInfo.docket || '';
    let layJob = item.layJobNo || item.jobNo || tagInfo.layJobNo || tagInfo.jobNo || '';
    let ply = item.plyRange || tagInfo.plyRange || '';

    if (!sched || !docket || !layJob) {
      const parentLog = (appState.logs || []).find(l => (l.batchId || l.id) === (item.batchId || item.batchTagString));
      if (parentLog) {
        if (!sched) sched = parentLog.schedule || parentLog.po || '';
        if (!docket) docket = parentLog.docketNo || parentLog.docket || '';
        if (!layJob) layJob = parentLog.layJobNo || parentLog.jobNo || '';
        if (!style) style = parentLog.style || '';
        if (!color) color = parentLog.color || '';
      }
    }

    return {
      ...item,
      id: item.tagId,
      style: style,
      color: color,
      schedule: sched,
      po: sched,
      size: size,
      part: part,
      docketNo: docket,
      docket: docket,
      layJobNo: layJob,
      jobNo: layJob,
      plyRange: ply
    };
  });

  currentDispatchLoadedTags = enriched;
  window.currentDispatchLoadedTags = currentDispatchLoadedTags;

  if (!rowsEl) return;

  if (currentDispatchLoadedTags.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="11" class="p-6 text-center text-slate-400 dark:text-slate-500">
          <div class="space-y-2">
            <span class="text-2xl block">📦</span>
            <p class="font-semibold text-xs text-slate-600 dark:text-slate-400">No stored bundles currently in warehouse storage for this batch.</p>
            <p class="text-[11px] text-slate-400">Assign unassigned bundles in Batch Assign first.</p>
            <button type="button" onclick="switchLocationSubTab('assign')" class="mt-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1">
              📦 Go to Batch Assign
            </button>
          </div>
        </td>
      </tr>
    `;
    if (countEl) countEl.textContent = "0 Selected";
    if (sumEl) sumEl.textContent = "0 stored bundles available";
    return;
  }

  currentDispatchLoadedTags.forEach(t => selectedDispatchBundleIds.add(t.tagId));
  populateDispatchFilterDropdowns(currentDispatchLoadedTags);
  filterDispatchBundlesTable();
  renderDispatchedHistoryLog();
}

function toggleSelectAllDispatchBundles(checked) {
  const checkboxes = document.querySelectorAll('.dispatch-bundle-checkbox');
  checkboxes.forEach(cb => {
    const tagId = cb.getAttribute('data-tag-id');
    cb.checked = checked;
    if (tagId) {
      if (checked) selectedDispatchBundleIds.add(tagId);
      else selectedDispatchBundleIds.delete(tagId);
    }
  });
  const countEl = document.getElementById('loc-dispatch-selected-count');
  const sumEl = document.getElementById('loc-dispatch-summary-info');
  if (countEl) countEl.textContent = `${selectedDispatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedDispatchBundleIds.size} of ${currentDispatchLoadedTags.length} stored bundles selected (${checkboxes.length} visible)`;
}

function selectAllFilteredDispatchBundles(checked) {
  const headerCb = document.getElementById('loc-dispatch-select-all');
  if (headerCb) headerCb.checked = checked;
  toggleSelectAllDispatchBundles(checked);
}

function toggleSelectDispatchBundle(tagId, checked) {
  if (checked) selectedDispatchBundleIds.add(tagId);
  else selectedDispatchBundleIds.delete(tagId);

  const headerCb = document.getElementById('loc-dispatch-select-all');
  const checkboxes = Array.from(document.querySelectorAll('.dispatch-bundle-checkbox'));
  if (headerCb) {
    headerCb.checked = (checkboxes.length > 0 && checkboxes.every(cb => cb.checked));
  }

  const countEl = document.getElementById('loc-dispatch-selected-count');
  const sumEl = document.getElementById('loc-dispatch-summary-info');
  if (countEl) countEl.textContent = `${selectedDispatchBundleIds.size} Selected`;
  if (sumEl) sumEl.textContent = `${selectedDispatchBundleIds.size} of ${currentDispatchLoadedTags.length} stored bundles selected (${checkboxes.length} visible)`;
}

async function dispatchSelectedBundles() {
  const visibleCheckboxes = Array.from(document.querySelectorAll('.dispatch-bundle-checkbox:checked'));
  const checkedTagIds = visibleCheckboxes.map(cb => cb.getAttribute('data-tag-id')).filter(Boolean);

  if (checkedTagIds.length === 0) {
    showToast("Please select at least one visible stored bundle to dispatch.", "error");
    return;
  }

  const destination = document.getElementById('loc-dispatch-destination')?.value || 'Sewing Line';
  const operator = document.getElementById('loc-dispatch-operator')?.value?.trim() || 'Floor Operator';
  const notes = document.getElementById('loc-dispatch-notes')?.value?.trim() || '';

  showLoading(`Dispatching ${checkedTagIds.length} bundles to ${destination}...`);

  const now = new Date().toISOString();
  let dispatchedCount = 0;

  checkedTagIds.forEach(tId => {
    const locIdx = (appLocationState.bundleLocations || []).findIndex(b => b.tagId === tId && b.status === 'STORED');
    if (locIdx >= 0) {
      const item = appLocationState.bundleLocations[locIdx];
      item.status = 'DISPATCHED';
      item.dispatchedAt = now;
      item.dispatchedTo = destination;
      item.dispatchedBy = operator;
      item.dispatchNotes = notes;

      appLocationState.history.unshift({
        id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        tagId: tId,
        action: 'DISPATCH',
        fromRackId: item.rackId,
        fromRackName: item.rackName,
        fromPalletId: item.palletId,
        fromPalletName: item.palletName,
        destination: destination,
        operator: operator,
        notes: notes,
        style: item.style,
        color: item.color,
        size: item.size,
        part: item.part,
        docketNo: item.docketNo,
        layJobNo: item.layJobNo,
        timestamp: now
      });
      dispatchedCount++;
    }
  });

  await saveLocationDatabase();
  hideLoading();

  selectedDispatchBundleIds.clear();
  showToast(`🚀 Successfully dispatched ${dispatchedCount} bundle(s) to ${destination}!`, "success");
  
  renderLocationMetrics();
  updateSidebarLocationCount();
  populateLocationDropdowns();
  onDispatchSourceChange(document.getElementById('loc-dispatch-source-select')?.value || 'ALL_STORED');
  renderDispatchedHistoryLog();
}

async function undoDispatchBundle(historyId, tagId) {
  const locItem = (appLocationState.bundleLocations || []).find(b => b.tagId === tagId);
  if (!locItem) {
    showToast("Bundle record not found.", "error");
    return;
  }

  showLoading("Returning bundle to storage...");
  locItem.status = 'STORED';
  delete locItem.dispatchedAt;
  delete locItem.dispatchedTo;
  delete locItem.dispatchedBy;

  appLocationState.history.unshift({
    id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    tagId: tagId,
    action: 'RETURN_FROM_DISPATCH',
    toRackId: locItem.rackId,
    toRackName: locItem.rackName,
    toPalletId: locItem.palletId,
    toPalletName: locItem.palletName,
    timestamp: new Date().toISOString(),
    operator: 'Supervisor'
  });

  await saveLocationDatabase();
  hideLoading();
  showToast(`🟢 Bundle ${tagId} returned to ${locItem.rackName} > ${locItem.palletName}`, "success");
  renderLocationMetrics();
  updateSidebarLocationCount();
  populateLocationDropdowns();
  onDispatchSourceChange(document.getElementById('loc-dispatch-source-select')?.value || 'ALL_STORED');
  renderDispatchedHistoryLog();
}

function renderDispatchedHistoryLog() {
  const tbody = document.getElementById('loc-dispatched-history-rows');
  const countEl = document.getElementById('loc-dispatched-total-count');
  if (!tbody) return;

  const dispatchHistory = (appLocationState.history || []).filter(h => h.action === 'DISPATCH');
  if (countEl) countEl.textContent = `${dispatchHistory.length} Dispatched Bundles`;

  if (dispatchHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center text-slate-400 dark:text-slate-500">
          <div class="space-y-1">
            <span class="text-xl block">📦</span>
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">No dispatch history records yet.</p>
            <p class="text-[11px] text-slate-400">When you dispatch bundles to sewing lines, records will appear here.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  dispatchHistory.slice(0, 50).forEach(h => {
    const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleString() : '—';
    html += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(timeStr)}</td>
        <td class="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">${escapeHtml(h.tagId || '—')}</td>
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-xs">${escapeHtml(h.style || '—')} <span class="text-slate-500 font-normal">(${escapeHtml(h.color || '—')})</span></td>
        <td class="p-2.5 text-xs"><span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold">${escapeHtml(h.size || '—')}</span> ${escapeHtml(h.part || '')}</td>
        <td class="p-2.5 text-[11px]"><span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">🏢 ${escapeHtml(h.fromRackName || 'Rack')} > ${escapeHtml(h.fromPalletName || 'Pallet')}</span></td>
        <td class="p-2.5 font-bold text-xs"><span class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">🧵 ${escapeHtml(h.destination || 'Sewing Line')}</span></td>
        <td class="p-2.5 text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(h.operator || '—')}</td>
        <td class="p-2.5 text-right">
          <button type="button" onclick="undoDispatchBundle('${escapeHtml(h.id)}', '${escapeHtml(h.tagId)}')"
            class="px-2 py-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 rounded-lg border border-amber-200 dark:border-amber-800 transition cursor-pointer">
            ↩ Return to Storage
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderDispatchManagementUI() {
  populateLocationDropdowns();
  const select = document.getElementById('loc-dispatch-source-select');
  onDispatchSourceChange(select?.value || 'ALL_STORED');
  renderDispatchedHistoryLog();
}
