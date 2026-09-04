/**
 * ==============================================================================
 * WAREHOUSE LOCATION MANAGER - LIVE DATA SYNC ENGINE (location-sync.js)
 * ==============================================================================
 * Real-time synchronization engine for garment bundle locations, racks, pallets,
 * generated batches, and tags from server API and direct local files.
 * Zero dummy data, zero cached data fallbacks, pure live database synchronization.
 * ==============================================================================
 */

// Global State for Location Management App
window.locAppState = {
  appName: "Warehouse Location Manager",
  version: "3.0",
  updatedAt: new Date().toISOString(),
  
  // Storage & Specs (Strictly real data from database files)
  racks: [],
  pallets: [],
  bundleLocations: [],
  history: [],
  
  // Referenced Tag Data from Generator
  batches: [],
  tags: [],
  sizes: [],
  parts: [],
  
  // Active Connection State
  storageDir: "",
  isServerLive: false,
  isLocationConnected: false,
  isBatchesConnected: false,
  activeFilePathDisplay: "Initializing..."
};

const locAppState = window.locAppState;

let locActiveDirectoryHandle = null;
let locStreamInterval = null;
let lastLocJsonMtime = 0;
let lastBatchesMtime = 0;
let lastSpecsMtime = 0;
let isLocBrowserDirectMode = false;
let _lastLocBrowserDirectPollTime = 0;

const LOC_IDB_NAME = 'GarmentTagDB';
const LOC_IDB_STORE = 'file_handles';

function getLocIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOC_IDB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOC_IDB_STORE)) {
        request.result.createObjectStore(LOC_IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredLocDirectoryHandle() {
  try {
    const db = await getLocIDB();
    const tx = db.transaction(LOC_IDB_STORE, 'readonly');
    const request = tx.objectStore(LOC_IDB_STORE).get('active_database_dir_handle');
    return new Promise(resolve => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveStoredLocDirectoryHandle(handle) {
  try {
    const db = await getLocIDB();
    const tx = db.transaction(LOC_IDB_STORE, 'readwrite');
    tx.objectStore(LOC_IDB_STORE).put(handle, 'active_database_dir_handle');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    console.warn("Failed to store directory handle in IDB:", e);
  }
}

/**
 * Returns API endpoint URL based on host environment with cache-busting timestamp
 */
function getLocApiUrl(path) {
  const baseUrl = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL)
    ? window.APP_CONFIG.API_BASE_URL
    : 'http://localhost:3000';

  const sep = path.includes('?') ? '&' : '?';
  const cleanPath = `${path}${sep}_t=${Date.now()}`;

  if (window.location.protocol.startsWith('http') && window.location.host) {
    return cleanPath;
  }
  return baseUrl.replace(/\/+$/, '') + cleanPath;
}

/**
 * Standard fetch options ensuring ZERO cached data is returned
 */
function getNoCacheFetchOptions(extra = {}) {
  return {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...(extra.headers || {})
    },
    ...extra
  };
}

/**
 * Clear any old legacy cache keys from localStorage
 */
function purgeLegacyLocalCache() {
  try {
    const keysToRemove = [
      'garment_bundle_data_backup',
      'master_data_csv_backup',
      'loc_cached_data',
      'loc_cached_specs',
      'loc_cached_locations',
      'loc_racks_cache',
      'loc_pallets_cache'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

/**
 * Parses JSONL (JSON Lines) or standard JSON content
 */
function parseLocJsonl(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      try {
        items.push(JSON.parse(trimmed));
      } catch (e) {}
    }
  }
  return items;
}

/**
 * Loads all warehouse location data, racks, pallets, and tags from live server or files
 */
async function initLocationDataSync() {
  purgeLegacyLocalCache();

  try {
    const confRes = await fetch(getLocApiUrl('/api/config'), getNoCacheFetchOptions());
    if (confRes.ok) {
      const conf = await confRes.json();
      if (conf.success) {
        locAppState.storageDir = conf.storageDir || conf.databaseDir || '';
        locAppState.activeFilePathDisplay = locAppState.storageDir || 'Connected via Python Server';
      }
    }
  } catch (e) {
    console.warn("[LOC-SYNC] Config API note:", e.message);
  }

  // Load Specs (Racks & Pallets) - Real data only
  const specsOk = await reloadSpecsData();

  // Load Location Database (Bundles & History) - Real data only
  const locOk = await reloadLocationDatabase();

  // Load Batch & Tag Data (for batch assignment lookup)
  await reloadBatchAndTagData();

  // If server is not connected, try auto-restoring directory handle (Zero Node.js Mode)
  if (!specsOk && !locOk && !isLocBrowserDirectMode) {
    try {
      const savedHandle = await getStoredLocDirectoryHandle();
      if (savedHandle) {
        const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          console.log('[LOC-SYNC] Auto-restoring saved directory handle:', savedHandle.name);
          locActiveDirectoryHandle = savedHandle;
          isLocBrowserDirectMode = true;
          await _loadFromLocDirectoryHandle(savedHandle);
          updateLocationConnectionUI();
          if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
          startLocationRealtimeStream();
          return;
        }
      }
    } catch (e) {
      console.warn("[LOC-SYNC] IDB handle restore note:", e);
    }

    // Strict disconnection: No server and no directory handle = Zero data
    locAppState.isLocationConnected = false;
    locAppState.isServerLive = false;
    locAppState.racks = [];
    locAppState.pallets = [];
    locAppState.bundleLocations = [];
    locAppState.history = [];
    locAppState.batches = [];
    locAppState.tags = [];
    locAppState.activeFilePathDisplay = "Database Disconnected";
  }

  // Update UI
  updateLocationConnectionUI();
  if (typeof renderAllLocationUI === 'function') renderAllLocationUI();

  // Start background realtime stream
  startLocationRealtimeStream();
}

/**
 * Loads database directly from a local File System Directory Handle (Browser-Direct Mode)
 */
async function _loadFromLocDirectoryHandle(dirHandle) {
  locActiveDirectoryHandle = dirHandle;
  isLocBrowserDirectMode = true;
  locAppState.storageDir = dirHandle.name;
  locAppState.activeFilePathDisplay = dirHandle.name;

  try {
    for await (const entry of dirHandle.values()) {
      const fname = entry.name.toLowerCase();
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (fname === 'garment_specs_data.jsonl' || fname === 'garment_specs_data.json') {
          const text = await file.text();
          const items = parseLocJsonl(text);
          const racks = [], pallets = [], sizes = [], parts = [];
          items.forEach(it => {
            if (it.type === 'sizes' && Array.isArray(it.items)) sizes.push(...it.items);
            else if (it.type === 'parts' && Array.isArray(it.items)) parts.push(...it.items);
            else if (it.type === 'rack') racks.push(it);
            else if (it.type === 'pallet') pallets.push(it);
          });
          locAppState.sizes = sizes;
          locAppState.parts = parts;
          locAppState.racks = racks;
          locAppState.pallets = pallets;
        } else if (fname === 'garment_location_data.jsonl' || fname === 'garment_location_data.json') {
          const text = await file.text();
          const items = parseLocJsonl(text);
          const bundleLocations = [], history = [];
          items.forEach(it => {
            if (it.type === 'location') bundleLocations.push(it);
            else if (it.type === 'history') history.push(it);
          });
          locAppState.bundleLocations = bundleLocations;
          locAppState.history = history;
        } else if (fname === 'garment_batches_data.jsonl') {
          const text = await file.text();
          locAppState.batches = parseLocJsonl(text).filter(b => b && (b.batchId || b.id));
        } else if (fname === 'garment_tags_data.jsonl') {
          const text = await file.text();
          locAppState.tags = parseLocJsonl(text).filter(t => t && (t.tagId || t.id));
        }
      }
    }

    // Auto-recover real racks/pallets from location records if specs didn't have them yet
    recoverRealRacksFromLocationData();

    locAppState.isLocationConnected = true;
    locAppState.isBatchesConnected = true;
    locAppState.isServerLive = true;
  } catch (err) {
    console.warn("[LOC-SYNC] Error reading direct folder:", err);
  }
}

/**
 * If specs file does not have racks yet, but location data has real stored records (e.g. Rack 1),
 * recover the real racks and pallets from the real data without fabricating dummy ones.
 */
function recoverRealRacksFromLocationData() {
  if ((!locAppState.racks || locAppState.racks.length === 0) && (locAppState.bundleLocations && locAppState.bundleLocations.length > 0)) {
    const rackMap = new Map();
    const palletMap = new Map();

    locAppState.bundleLocations.forEach(b => {
      if (b.rackId) {
        if (!rackMap.has(b.rackId)) {
          rackMap.set(b.rackId, {
            id: b.rackId,
            name: b.rackName || b.rackId.replace('RACK-', 'Rack '),
            zone: 'Cutting Floor',
            description: 'Warehouse Storage Rack',
            createdAt: b.assignedAt || new Date().toISOString()
          });
        }
      }
      if (b.palletId && b.rackId) {
        if (!palletMap.has(b.palletId)) {
          palletMap.set(b.palletId, {
            id: b.palletId,
            rackId: b.rackId,
            name: b.palletName || 'Pallet',
            capacity: 50,
            description: 'Storage Tier',
            createdAt: b.assignedAt || new Date().toISOString()
          });
        }
      }
    });

    if (rackMap.size > 0) {
      locAppState.racks = Array.from(rackMap.values());
      locAppState.pallets = Array.from(palletMap.values());
      // Save recovered real specs
      saveLocationSpecs();
    }
  }
}

/**
 * Reloads specs data (racks, pallets, sizes, parts) from server
 */
async function reloadSpecsData() {
  try {
    const res = await fetch(getLocApiUrl('/api/specs'), getNoCacheFetchOptions());
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        locAppState.racks = Array.isArray(json.data.racks) ? json.data.racks : [];
        locAppState.pallets = Array.isArray(json.data.pallets) ? json.data.pallets : [];
        if (Array.isArray(json.data.sizes)) locAppState.sizes = json.data.sizes;
        if (Array.isArray(json.data.parts)) locAppState.parts = json.data.parts;
        return true;
      }
    }
  } catch (e) {
    console.warn("[LOC-SYNC] Specs load note:", e.message);
  }
  return false;
}

/**
 * Reloads location database (bundleLocations, history) from server
 */
async function reloadLocationDatabase() {
  try {
    const res = await fetch(getLocApiUrl('/api/location-data'), getNoCacheFetchOptions());
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        locAppState.bundleLocations = Array.isArray(json.data.bundleLocations) ? json.data.bundleLocations : [];
        locAppState.history = Array.isArray(json.data.history) ? json.data.history : [];
        if (json.mtime) lastLocJsonMtime = json.mtime;
        locAppState.isLocationConnected = true;
        locAppState.isServerLive = true;

        // Auto-recover real racks if specs was empty
        recoverRealRacksFromLocationData();
        return true;
      }
    }
  } catch (e) {
    console.warn("[LOC-SYNC] Location data load note:", e.message);
  }

  if (isLocBrowserDirectMode && locActiveDirectoryHandle) {
    return true;
  }

  locAppState.isLocationConnected = false;
  return false;
}

/**
 * Reloads batch and tag records (from garment_batches_data.jsonl & garment_tags_data.jsonl)
 */
async function reloadBatchAndTagData() {
  try {
    const res = await fetch(getLocApiUrl('/api/data'), getNoCacheFetchOptions());
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        locAppState.batches = Array.isArray(json.data.batches) ? json.data.batches : [];
        locAppState.tags = Array.isArray(json.data.tags) ? json.data.tags : [];
        locAppState.isBatchesConnected = true;
        return true;
      }
    }
  } catch (e) {
    console.warn("[LOC-SYNC] Batches data load note:", e.message);
  }
  return false;
}

/**
 * Saves location database to server and local file system
 */
async function saveLocationDatabase() {
  locAppState.updatedAt = new Date().toISOString();

  const payload = {
    appName: "Warehouse Location Manager",
    version: "3.0",
    updatedAt: locAppState.updatedAt,
    bundleLocations: locAppState.bundleLocations || [],
    history: locAppState.history || []
  };

  try {
    const res = await fetch(getLocApiUrl('/api/location-data'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.mtime) lastLocJsonMtime = json.mtime;
      flashLocationSyncIndicator();
    }
  } catch (e) {
    console.warn("[LOC-SYNC] Server save error:", e);
  }

  // Direct Directory Handle write if open
  if (locActiveDirectoryHandle) {
    try {
      const locHandle = await locActiveDirectoryHandle.getFileHandle('garment_location_data.jsonl', { create: true });
      const writable = await locHandle.createWritable();
      const locLines = [
        JSON.stringify({ type: 'meta', appName: "Warehouse Location Manager", version: "3.0", updatedAt: new Date().toISOString() })
      ];
      (locAppState.bundleLocations || []).forEach(loc => locLines.push(JSON.stringify({ type: 'location', ...loc })));
      (locAppState.history || []).forEach(h => locLines.push(JSON.stringify({ type: 'history', ...h })));
      await writable.write(locLines.join('\n') + '\n');
      await writable.close();
      flashLocationSyncIndicator();
    } catch (e) {
      console.warn("[LOC-SYNC] Direct directory write error:", e);
    }
  }

  if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
}

/**
 * Saves racks and pallets to specs file
 */
async function saveLocationSpecs() {
  const payload = {
    sizes: locAppState.sizes || [],
    parts: locAppState.parts || [],
    racks: locAppState.racks || [],
    pallets: locAppState.pallets || []
  };

  try {
    await fetch(getLocApiUrl('/api/specs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  if (locActiveDirectoryHandle) {
    try {
      const spHandle = await locActiveDirectoryHandle.getFileHandle('garment_specs_data.jsonl', { create: true });
      const spW = await spHandle.createWritable();
      const spLines = [
        JSON.stringify({ type: 'meta', appName: "GarmentTag Specs Data", version: "1.0", updatedAt: new Date().toISOString() }),
        JSON.stringify({ type: 'sizes', items: locAppState.sizes || [] }),
        JSON.stringify({ type: 'parts', items: locAppState.parts || [] })
      ];
      (locAppState.racks || []).forEach(r => spLines.push(JSON.stringify({ type: 'rack', ...r })));
      (locAppState.pallets || []).forEach(p => spLines.push(JSON.stringify({ type: 'pallet', ...p })));
      await spW.write(spLines.join('\n') + '\n');
      await spW.close();
    } catch(e) {}
  }
}

/**
 * Start live real-time stream polling every 1.5s
 */
function startLocationRealtimeStream() {
  if (locStreamInterval) clearInterval(locStreamInterval);
  locStreamInterval = setInterval(async () => {
    // Browser Direct Mode: Check file modifications
    if (isLocBrowserDirectMode && locActiveDirectoryHandle) {
      try {
        for await (const entry of locActiveDirectoryHandle.values()) {
          const fname = entry.name.toLowerCase();
          if (entry.kind === 'file' && fname === 'garment_location_data.jsonl') {
            const file = await entry.getFile();
            if (file.lastModified !== _lastLocBrowserDirectPollTime) {
              _lastLocBrowserDirectPollTime = file.lastModified;
              const text = await file.text();
              const items = parseLocJsonl(text);
              locAppState.bundleLocations = items.filter(it => it.type === 'location');
              locAppState.history = items.filter(it => it.type === 'history');
              if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
              flashLocationSyncIndicator();
            }
          }
        }
      } catch (e) {}
      return;
    }

    // Live Server API Mode: Check stream status mtimes
    try {
      const res = await fetch(getLocApiUrl('/api/stream-status'), getNoCacheFetchOptions());
      if (res.ok) {
        const status = await res.json();
        if (status.success) {
          locAppState.isServerLive = true;
          
          if (status.locationJsonMtime && status.locationJsonMtime !== lastLocJsonMtime) {
            lastLocJsonMtime = status.locationJsonMtime;
            await reloadLocationDatabase();
            if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
            flashLocationSyncIndicator();
          }

          if (status.specsJsonMtime && status.specsJsonMtime !== lastSpecsMtime) {
            lastSpecsMtime = status.specsJsonMtime;
            await reloadSpecsData();
            if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
          }

          if (status.batchesJsonMtime && status.batchesJsonMtime !== lastBatchesMtime) {
            lastBatchesMtime = status.batchesJsonMtime;
            await reloadBatchAndTagData();
            if (typeof populateLocationBatchDropdowns === 'function') populateLocationBatchDropdowns();
          }
          
          updateLocationConnectionUI();
        }
      }
    } catch (e) {
      locAppState.isServerLive = false;
      updateLocationConnectionUI();
    }
  }, 1500);
}

function flashLocationSyncIndicator() {
  const syncInd = document.getElementById('loc-sync-indicator');
  if (syncInd) {
    syncInd.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> 💾 Synced!`;
    setTimeout(() => {
      syncInd.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Auto-Sync Active`;
    }, 1500);
  }
}

function updateLocationConnectionUI() {
  const badge = document.getElementById('loc-status-db-badge');
  const dot = document.getElementById('loc-status-db-dot');
  const text = document.getElementById('loc-status-db-text');
  const isLive = locAppState.isLocationConnected || locAppState.isServerLive || isLocBrowserDirectMode;

  if (dot) dot.className = isLive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-rose-500";
  if (text) text.textContent = isLive ? "Live Connected" : "Disconnected";
  if (badge) {
    badge.className = isLive
      ? "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
      : "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
  }

  const pathDisplay = document.getElementById('loc-storage-path-display');
  if (pathDisplay) {
    pathDisplay.textContent = isLive ? (locAppState.storageDir || locAppState.activeFilePathDisplay || "http://localhost:3000") : "Database Disconnected";
  }
}

async function browseLocationDatabaseFolder() {
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      locActiveDirectoryHandle = dirHandle;
      await saveStoredLocDirectoryHandle(dirHandle);
      isLocBrowserDirectMode = true;
      locAppState.storageDir = dirHandle.name;
      locAppState.activeFilePathDisplay = dirHandle.name;
      await _loadFromLocDirectoryHandle(dirHandle);
      updateLocationConnectionUI();
      if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
      if (typeof showLocToast === 'function') showLocToast(`🟢 Connected folder: ${dirHandle.name}`, "success");
      return;
    } catch (e) {
      if (e.name !== 'AbortError') {
        const htmlPicker = document.getElementById('loc-html-folder-picker');
        if (htmlPicker) htmlPicker.click();
      }
    }
  } else {
    const htmlPicker = document.getElementById('loc-html-folder-picker');
    if (htmlPicker) htmlPicker.click();
  }
}

async function handleLocHtmlFolderPicked(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  for (const file of files) {
    const fname = file.name.toLowerCase();
    const text = await file.text();
    const items = parseLocJsonl(text);
    if (fname.includes('specs')) {
      const racks = [], pallets = [], sizes = [], parts = [];
      items.forEach(it => {
        if (it.type === 'sizes' && Array.isArray(it.items)) sizes.push(...it.items);
        else if (it.type === 'parts' && Array.isArray(it.items)) parts.push(...it.items);
        else if (it.type === 'rack') racks.push(it);
        else if (it.type === 'pallet') pallets.push(it);
      });
      locAppState.sizes = sizes;
      locAppState.parts = parts;
      locAppState.racks = racks;
      locAppState.pallets = pallets;
    } else if (fname.includes('location')) {
      const bundleLocations = [], history = [];
      items.forEach(it => {
        if (it.type === 'location') bundleLocations.push(it);
        else if (it.type === 'history') history.push(it);
      });
      locAppState.bundleLocations = bundleLocations;
      locAppState.history = history;
    } else if (fname.includes('batches')) {
      locAppState.batches = items.filter(b => b && (b.batchId || b.id));
    } else if (fname.includes('tags')) {
      locAppState.tags = items.filter(t => t && (t.tagId || t.id));
    }
  }
  recoverRealRacksFromLocationData();
  locAppState.isLocationConnected = true;
  locAppState.isBatchesConnected = true;
  locAppState.storageDir = 'Local Folder';
  locAppState.activeFilePathDisplay = 'Local Folder';
  updateLocationConnectionUI();
  if (typeof renderAllLocationUI === 'function') renderAllLocationUI();
  if (typeof showLocToast === 'function') showLocToast("🟢 Loaded database from selected folder", "success");
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('loc-html-folder-picker');
    if (picker) {
      picker.addEventListener('change', handleLocHtmlFolderPicked);
    }
  });
}
