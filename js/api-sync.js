/**
 * GarmentTag Database Sync, File System Watcher & Master Data Integration Engine
 */

let activeMasterSheetName = '';
let isPickerInProgress = false;
let lastCSVHandleMtime = 0;
let activeDirectoryHandle = null;
let activeMasterDirHandle = null;
let isBrowserDirectMode = false;
let _lastBrowserDirectPollTime = 0;
let _lastArchivePollTime = 0;
let lastArchiveMtime = 0;

const IDB_NAME = 'GarmentTagDB';
const IDB_STORE = 'file_handles';

function getIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoredDirectoryHandle(handle) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, 'active_database_dir_handle');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    console.warn("Failed to store directory handle in IDB:", e);
  }
}

async function getStoredDirectoryHandle() {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const request = tx.objectStore(IDB_STORE).get('active_database_dir_handle');
    return new Promise(resolve => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveStoredFileHandle(handle) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, 'active_json_handle');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    console.warn("Failed to store file handle in IDB:", e);
  }
}

async function getStoredFileHandle() {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const request = tx.objectStore(IDB_STORE).get('active_json_handle');
    return new Promise(resolve => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveStoredCSVHandle(handle) {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, 'active_master_csv_handle');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) {
    console.warn("Failed to store CSV handle in IDB:", e);
  }
}

async function getStoredCSVHandle() {
  try {
    const db = await getIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const request = tx.objectStore(IDB_STORE).get('active_master_csv_handle');
    return new Promise(resolve => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Browser-Direct Mode: Read all database + master data files from a directory handle.
 * Used for both initial browse and auto-restore on page reload.
 */
async function _loadFromDirectoryHandle(dirHandle) {
  const folderName = dirHandle.name;
  activeDirectoryHandle = dirHandle;
  appState.storageDir = folderName;
  activeFilePathDisplay = folderName;

  const input = document.getElementById('json-custom-path-input');
  if (input) input.value = folderName;

  showLoading("Reading database and master data files from folder...");
  try {
    for await (const entry of dirHandle.values()) {
      const fname = entry.name.toLowerCase();
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (fname === 'garment_batches_data.jsonl' || fname === 'garment_batches_data.json') {
          const text = await file.text();
          const parsed = parseJsonlOrJson(text);
          if (Array.isArray(parsed.batches)) appState.logs = parsed.batches;
          else if (Array.isArray(parsed)) appState.logs = parsed;
        } else if (fname === 'garment_tags_data.jsonl' || fname === 'garment_tags_data.json') {
          const text = await file.text();
          const parsed = parseJsonlOrJson(text);
          if (Array.isArray(parsed.tags)) appState.allStoredTags = parsed.tags;
          else if (Array.isArray(parsed)) appState.allStoredTags = parsed;
        } else if (fname === 'garment_specs_data.jsonl' || fname === 'garment_specs_data.json') {
          const text = await file.text();
          const parsed = parseJsonlOrJson(text);
          if (Array.isArray(parsed.sizes) && parsed.sizes.length > 0) appState.sizes = parsed.sizes;
          if (Array.isArray(parsed.parts) && parsed.parts.length > 0) appState.parts = parsed.parts;
          if (Array.isArray(parsed.racks) && parsed.racks.length > 0) appLocationState.racks = parsed.racks;
          if (Array.isArray(parsed.pallets) && parsed.pallets.length > 0) appLocationState.pallets = parsed.pallets;
        } else if (fname === 'garment_archive_data.jsonl' || fname === 'garment_archive_data.json') {
          const text = await file.text();
          const parsed = parseJsonlOrJson(text);
          let arcList = [];
          if (Array.isArray(parsed.archivedLogs) && parsed.archivedLogs.length > 0) {
            arcList = parsed.archivedLogs;
          } else if (Array.isArray(parsed.batches) && parsed.batches.length > 0) {
            arcList = parsed.batches;
          } else if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
            arcList = parsed.logs;
          } else if (Array.isArray(parsed)) {
            arcList = parsed;
          } else if (parsed && (parsed.batchId || parsed.id)) {
            arcList = [parsed];
          }
          appState.archivedLogs = arcList.map(a => ({ ...a, isArchived: true }));
        } else if (fname === 'garment_location_data.jsonl' || fname === 'garment_location_data.json') {
          const text = await file.text();
          const parsed = parseJsonlOrJson(text);
          if (Array.isArray(parsed.bundleLocations)) appLocationState.bundleLocations = parsed.bundleLocations;
          if (Array.isArray(parsed.history)) appLocationState.history = parsed.history;
        } else if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname === 'masterdata.csv') {
          if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
            const buf = await file.arrayBuffer();
            const res = parseMasterDataExcelBuffer(buf);
            if (res.data && res.data.length > 0) {
              appState.styleMaster = res.data;
              activeCSVFileName = file.name;
              if (res.sheetName) activeMasterSheetName = res.sheetName;
              isMasterCSVConnected = true;
            }
          } else {
            const text = await file.text();
            const rows = parseMasterDataCSVText(text);
            if (rows.length > 0) {
              appState.styleMaster = rows;
              activeCSVFileName = file.name;
              isMasterCSVConnected = true;
            }
          }
        }
      } else if (entry.kind === 'directory' && !isMasterCSVConnected) {
        try {
          for await (const subEntry of entry.values()) {
            if (subEntry.kind === 'file') {
              const subFname = subEntry.name.toLowerCase();
              if (subFname.endsWith('.xlsx') || subFname.endsWith('.xls') || subFname.endsWith('.csv')) {
                const file = await subEntry.getFile();
                if (subFname.endsWith('.xlsx') || subFname.endsWith('.xls')) {
                  const buf = await file.arrayBuffer();
                  const res = parseMasterDataExcelBuffer(buf);
                  if (res.data && res.data.length > 0) {
                    appState.styleMaster = res.data;
                    activeCSVFileName = file.name;
                    if (res.sheetName) activeMasterSheetName = res.sheetName;
                    isMasterCSVConnected = true;
                    break;
                  }
                } else {
                  const text = await file.text();
                  const rows = parseMasterDataCSVText(text);
                  if (rows.length > 0) {
                    appState.styleMaster = rows;
                    activeCSVFileName = file.name;
                    isMasterCSVConnected = true;
                    break;
                  }
                }
              }
            }
          }
        } catch (subE) {
          console.warn("Subfolder scan note:", subE);
        }
      }
    }

    // Auto-initialize defaults
    if (!appState.sizes || appState.sizes.length === 0) {
      appState.sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
    }
    if (!appState.parts || appState.parts.length === 0) {
      appState.parts = ["Front Body", "Back Body", "Left Sleeve", "Right Sleeve", "Collar/Neckband", "Chest Pocket", "Cuff", "EMB Part"];
    }
  } catch (err) {
    console.warn("Error reading directory entries:", err);
  } finally {
    hideLoading();
  }

  isBrowserDirectMode = true;
  isJSONConnected = true;
  isLocationConnected = true;
  updateJSONConnectionUI(folderName, true);
  updateMasterDataUI();
  if (typeof renderSizesPills === 'function') renderSizesPills();
  if (typeof renderPartsPills === 'function') renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  if (typeof renderLocationManagementUI === 'function') renderLocationManagementUI();
  if (typeof populateLocationDropdowns === 'function') populateLocationDropdowns();
  if (typeof renderRacksGrid === 'function') renderRacksGrid();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  if (typeof renderArchiveTable === 'function') renderArchiveTable();
  updateFormEntryState();
  updateStatusBadgesUI();
  syncSidebarBadges();
  showToast(`🟢 Connected directly to folder: ${folderName} (Zero Node.js Mode)`, "success");
}

/**
 * Browser-Direct Mode: Load Master Data (Excel/CSV) from a separate directory handle.
 */
async function _loadMasterDataFromDirHandle(dirHandle) {
  try {
    for await (const entry of dirHandle.values()) {
      const fname = entry.name.toLowerCase();
      if (entry.kind === 'file' && (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.csv'))) {
        const file = await entry.getFile();
        if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
          const buf = await file.arrayBuffer();
          const res = parseMasterDataExcelBuffer(buf);
          if (res.data && res.data.length > 0) {
            appState.styleMaster = res.data;
            activeCSVFileName = file.name;
            if (res.sheetName) activeMasterSheetName = res.sheetName;
            isMasterCSVConnected = true;
            break;
          }
        } else {
          const text = await file.text();
          const rows = parseMasterDataCSVText(text);
          if (rows.length > 0) {
            appState.styleMaster = rows;
            activeCSVFileName = file.name;
            isMasterCSVConnected = true;
            break;
          }
        }
      }
    }
    if (isMasterCSVConnected) {
      updateMasterDataUI();
      updateFormEntryState();
      updateStatusBadgesUI();
      syncSidebarBadges();
    }
  } catch (e) {
    console.warn('[BROWSER-DIRECT] Error loading master data from dir handle:', e);
  }
}

function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      cols.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

function parseMasterDataExcelBuffer(arrayBuffer) {
  if (typeof XLSX === 'undefined') {
    console.error("XLSX library not loaded");
    return { data: [], sheetName: '', count: 0 };
  }
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return { data: [], sheetName: '', count: 0 };

    let targetSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'docket summary');
    if (!targetSheetName) {
      targetSheetName = workbook.SheetNames.find(s => /docket\s*summary/i.test(s));
    }
    if (!targetSheetName) {
      targetSheetName = workbook.SheetNames.find(s => /docket|summary|master|data/i.test(s));
    }
    if (!targetSheetName) {
      targetSheetName = workbook.SheetNames[0];
    }

    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) return { data: [], sheetName: targetSheetName, count: 0 };

    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!sheetData || sheetData.length === 0) return { data: [], sheetName: targetSheetName, count: 0 };

    let headerRowIndex = -1;
    let styleIdx = -1, schedIdx = -1, colorIdx = -1, docketIdx = -1, jobIdx = -1;
    let fabCatIdx = -1, uomIdx = -1, grmtQtyIdx = -1, fabricTypeIdx = -1, cutTableIdx = -1;

    for (let r = 0; r < Math.min(sheetData.length, 15); r++) {
      const row = sheetData[r] || [];
      const normCols = row.map(c => String(c || '').trim().toLowerCase());
      
      const sIdx = normCols.findIndex(h => /^style/i.test(h));
      const scIdx = normCols.findIndex(h => /^sched|po|order/i.test(h));
      const cIdx = normCols.findIndex(h => /^colou?r/i.test(h));
      const dIdx = normCols.findIndex(h => /docket\s*(id|no|#)?/i.test(h) || /^docket/i.test(h));
      const jIdx = normCols.findIndex(h => /lay\s*job|job\s*no|jobno|pattern/i.test(h));

      const matchCount = [sIdx, scIdx, cIdx, dIdx, jIdx].filter(idx => idx !== -1).length;
      if (matchCount >= 2 || (sIdx !== -1 && (scIdx !== -1 || cIdx !== -1))) {
        headerRowIndex = r;
        styleIdx = sIdx;
        schedIdx = scIdx;
        colorIdx = cIdx;
        docketIdx = dIdx;
        jobIdx = jIdx;
        fabCatIdx = normCols.findIndex(h => /fabric\s*cat/i.test(h));
        uomIdx = normCols.findIndex(h => /^uom/i.test(h));
        grmtQtyIdx = normCols.findIndex(h => /docket\s*grmt|grmt\s*qty|garment\s*qty|qty/i.test(h));
        fabricTypeIdx = normCols.findIndex(h => /fabric\s*type/i.test(h));
        cutTableIdx = normCols.findIndex(h => /cut\s*table/i.test(h));
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      styleIdx = 0;
      schedIdx = 1;
      colorIdx = 2;
      docketIdx = 4;
      jobIdx = 7;
    }

    const rows = [];
    for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
      const row = sheetData[i] || [];
      const style = (styleIdx !== -1 && row[styleIdx] !== undefined) ? String(row[styleIdx] || '').trim() : '';
      const sched = (schedIdx !== -1 && row[schedIdx] !== undefined) ? String(row[schedIdx] || '').trim() : '';
      const color = (colorIdx !== -1 && row[colorIdx] !== undefined) ? String(row[colorIdx] || '').trim() : '';
      const docketNo = (docketIdx !== -1 && row[docketIdx] !== undefined) ? String(row[docketIdx] || '').trim() : '';
      const layJobNo = (jobIdx !== -1 && row[jobIdx] !== undefined) ? String(row[jobIdx] || '').trim() : '';
      const fabricCategory = (fabCatIdx !== -1 && row[fabCatIdx] !== undefined) ? String(row[fabCatIdx] || '').trim() : '';
      const uom = (uomIdx !== -1 && row[uomIdx] !== undefined) ? String(row[uomIdx] || '').trim() : '';
      const grmtQty = (grmtQtyIdx !== -1 && row[grmtQtyIdx] !== undefined) ? String(row[grmtQtyIdx] || '').trim() : '';
      const fabricType = (fabricTypeIdx !== -1 && row[fabricTypeIdx] !== undefined) ? String(row[fabricTypeIdx] || '').trim() : '';
      const cutTable = (cutTableIdx !== -1 && row[cutTableIdx] !== undefined) ? String(row[cutTableIdx] || '').trim() : '';

      if (style || color || sched || layJobNo || docketNo) {
        rows.push({
          id: `XLS-${i}`,
          style: style,
          color: color,
          schedule: sched,
          po: sched,
          layJobNo: layJobNo || 'N/A',
          jobNo: layJobNo || 'N/A',
          pattern: layJobNo || 'N/A',
          docketNo: docketNo || '',
          docket: docketNo || '',
          fabricCategory: fabricCategory,
          uom: uom,
          grmtQty: grmtQty,
          fabricType: fabricType,
          cutTable: cutTable,
          sourceSheet: targetSheetName,
          rowIndex: i + 1
        });
      }
    }
    return { data: rows, sheetName: targetSheetName, count: rows.length };
  } catch (e) {
    console.error("Failed to parse Excel buffer:", e);
    return { data: [], sheetName: '', count: 0, error: e.message };
  }
}

function parseMasterDataCSVText(csvText) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  let headerRowIndex = 0;
  let styleIdx = -1, schedIdx = -1, colorIdx = -1, docketIdx = -1, jobIdx = -1;
  let fabCatIdx = -1, uomIdx = -1, grmtQtyIdx = -1;

  for (let r = 0; r < Math.min(lines.length, 10); r++) {
    const rawHeaders = parseCSVLine(lines[r]);
    const headers = rawHeaders.map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    
    const sIdx = headers.findIndex(h => /^style/i.test(h));
    const scIdx = headers.findIndex(h => /^sched|po|order/i.test(h));
    const cIdx = headers.findIndex(h => /^colou?r/i.test(h));
    const dIdx = headers.findIndex(h => /docket\s*(id|no|#)?/i.test(h) || /^docket/i.test(h));
    const jIdx = headers.findIndex(h => /lay\s*job|job\s*no|jobno|pattern/i.test(h));

    if ((sIdx !== -1 && (scIdx !== -1 || cIdx !== -1)) || [sIdx, scIdx, cIdx, dIdx, jIdx].filter(x => x !== -1).length >= 2) {
      headerRowIndex = r;
      styleIdx = sIdx;
      schedIdx = scIdx;
      colorIdx = cIdx;
      docketIdx = dIdx;
      jobIdx = jIdx;
      fabCatIdx = headers.findIndex(h => /fabric\s*cat/i.test(h));
      uomIdx = headers.findIndex(h => /^uom/i.test(h));
      grmtQtyIdx = headers.findIndex(h => /docket\s*grmt|grmt\s*qty|garment\s*qty|qty/i.test(h));
      break;
    }
  }

  if (styleIdx === -1) styleIdx = 0;
  if (schedIdx === -1) schedIdx = 1;
  if (colorIdx === -1) colorIdx = 2;
  if (docketIdx === -1) docketIdx = 4;
  if (jobIdx === -1) jobIdx = 7;

  const rows = [];
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const style = (styleIdx !== -1 && cols[styleIdx] !== undefined) ? cols[styleIdx].trim() : '';
    const sched = (schedIdx !== -1 && cols[schedIdx] !== undefined) ? cols[schedIdx].trim() : '';
    const color = (colorIdx !== -1 && cols[colorIdx] !== undefined) ? cols[colorIdx].trim() : '';
    const docketNo = (docketIdx !== -1 && cols[docketIdx] !== undefined) ? cols[docketIdx].trim() : '';
    const layJobNo = (jobIdx !== -1 && cols[jobIdx] !== undefined) ? cols[jobIdx].trim() : '';
    const fabricCategory = (fabCatIdx !== -1 && cols[fabCatIdx] !== undefined) ? cols[fabCatIdx].trim() : '';
    const uom = (uomIdx !== -1 && cols[uomIdx] !== undefined) ? cols[uomIdx].trim() : '';
    const grmtQty = (grmtQtyIdx !== -1 && cols[grmtQtyIdx] !== undefined) ? cols[grmtQtyIdx].trim() : '';

    if (style || color || sched || layJobNo || docketNo) {
      rows.push({
        id: `CSV-${i}`,
        style: style,
        color: color,
        schedule: sched,
        po: sched,
        layJobNo: layJobNo || 'N/A',
        jobNo: layJobNo || 'N/A',
        pattern: layJobNo || 'N/A',
        docketNo: docketNo || '',
        docket: docketNo || '',
        fabricCategory: fabricCategory,
        uom: uom,
        grmtQty: grmtQty,
        sourceSheet: 'CSV',
        rowIndex: i + 1
      });
    }
  }
  return rows;
}

async function loadMasterDataFromCSV() {
  // LIVE CONNECTION ONLY - Master data loaded exclusively from live server API
  try {
    const res = await fetch(getApiUrl('/api/masterdata?_t=' + Date.now()), {
      cache: 'no-store'
    });
    
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.error === 'FILE_NOT_FOUND') {
        isMasterCSVConnected = false;
        appState.styleMaster = [];
        updateMasterDataUI();
        updateFormEntryState();
        showToast(`⚠️ ${json.message || 'Master Data file not found'}`, "error");
        return false;
      }
      throw new Error('Server returned status ' + res.status);
    }

    const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
    const serverFileName = res.headers.get('X-File-Name');
    const serverMtime = parseInt(res.headers.get('X-File-Mtime') || '0', 10);
    
    if (serverFileName) {
      activeCSVFileName = serverFileName;
    }
    if (serverMtime) {
      lastMasterMtime = serverMtime;
    }

    // 1. JSON Payload Format
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null);
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        appState.styleMaster = json.data;
        if (json.filePath) {
          appState.resolvedCsvPath = json.filePath;
          activeCSVFileName = json.activeFileName || json.filePath.split(/[\\/]/).pop() || activeCSVFileName;
        }
        if (json.sheetName) {
          activeMasterSheetName = json.sheetName;
        }
        isMasterCSVConnected = true;
        if (json.mtime) lastMasterMtime = json.mtime;
        updateMasterDataUI();
        updateFormEntryState();
        console.log('[LIVE] ✅ Master data JSON loaded:', json.data.length, 'records');
        return true;
      }
    } else {
      // 2. Binary Excel (.xlsx / .xls) or CSV Stream Format
      const buf = await res.arrayBuffer();
      const fname = (activeCSVFileName || 'MasterData.csv').toLowerCase();
      
      if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || contentType.includes('spreadsheet') || contentType.includes('excel')) {
        const excelRes = parseMasterDataExcelBuffer(buf);
        if (excelRes && excelRes.data && excelRes.data.length > 0) {
          appState.styleMaster = excelRes.data;
          activeMasterSheetName = excelRes.sheetName || 'Docket Summary';
          isMasterCSVConnected = true;
          if (serverMtime) lastMasterMtime = serverMtime;
          updateMasterDataUI();
          updateFormEntryState();
          console.log('[LIVE] ✅ Master data Excel parsed:', excelRes.data.length, 'records from sheet [' + activeMasterSheetName + ']');
          return true;
        }
      } else {
        const text = new TextDecoder('utf-8').decode(buf);
        const rows = parseMasterDataCSVText(text);
        if (rows && rows.length > 0) {
          appState.styleMaster = rows;
          isMasterCSVConnected = true;
          updateMasterDataUI();
          updateFormEntryState();
          console.log('[LIVE] ✅ Master data CSV parsed:', rows.length, 'records');
          return true;
        }
      }
    }
  } catch (e) {
    console.warn("[LIVE] ❌ Could not load masterdata from live server:", e);
  }

  // STRICT DISCONNECT: No cached/embedded fallback — zero data when server unavailable
  isMasterCSVConnected = false;
  appState.styleMaster = [];
  updateMasterDataUI();
  updateFormEntryState();
  return false;
}

function updateMasterDataUI() {
  const nameBadge = document.getElementById('csv-file-name-badge');
  const countEl = document.getElementById('csv-records-count');
  const stylesCountEl = document.getElementById('csv-styles-count');
  const colorsCountEl = document.getElementById('csv-colors-count');
  const csvPathInput = document.getElementById('csv-custom-path-input');
  const csvPathDisplay = document.getElementById('csv-custom-path-display');
  const csvStatusBadge = document.getElementById('csv-file-status-badge');

  const total = (appState.styleMaster || []).length;
  if (nameBadge) {
    const displaySheet = activeMasterSheetName ? ` [${activeMasterSheetName}]` : '';
    nameBadge.textContent = (activeCSVFileName || 'MasterData.csv') + displaySheet;
  }
  if (countEl) countEl.textContent = total.toLocaleString();
  if (stylesCountEl && total > 0) {
    const uniqueStyles = new Set(appState.styleMaster.map(s => s.style).filter(Boolean));
    stylesCountEl.textContent = uniqueStyles.size.toLocaleString();
  }
  if (colorsCountEl && total > 0) {
    const uniqueColors = new Set(appState.styleMaster.map(s => s.color).filter(Boolean));
    colorsCountEl.textContent = uniqueColors.size.toLocaleString();
  }
  const resolvedCsv = appState.resolvedCsvPath || (appState.storageDir ? (appState.storageDir + '\\' + (activeCSVFileName || 'MasterData.csv')) : (activeCSVFileName || 'MasterData.csv'));
  if (csvPathInput) csvPathInput.value = resolvedCsv;
  if (csvPathDisplay) csvPathDisplay.textContent = resolvedCsv;

  if (csvStatusBadge) {
    const isLive = isMasterCSVConnected && total > 0;
    csvStatusBadge.className = isLive 
      ? "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-800" 
      : "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono border border-rose-200 dark:border-rose-800";
    csvStatusBadge.textContent = isLive ? "Live Connected" : "Disconnected";
  }

  try { if (typeof renderStyleDropdown === 'function') renderStyleDropdown(); } catch (e) { console.error(e); }
  try { if (typeof renderMasterTable === 'function') renderMasterTable(); } catch (e) { console.error(e); }
  try { if (typeof updateStatusBadgesUI === 'function') updateStatusBadgesUI(); } catch (e) { console.error(e); }
  try { if (typeof syncSidebarBadges === 'function') syncSidebarBadges(); } catch (e) { console.error(e); }
}

async function reloadMasterDataFromCSV() {
  showLoading("Reloading Master Data from Live Database...");
  await loadMasterDataFromCSV();
  hideLoading();
  if (isMasterCSVConnected) {
    showToast(`🟢 Live Master Data Refreshed: ${(appState.styleMaster || []).length.toLocaleString()} records from ${activeCSVFileName}`, "success");
  } else {
    showToast("Master Data file is disconnected. Please link the file.", "error");
  }
}

async function connectMasterDataCSVFile() {
  await reloadMasterDataFromCSV();
}

async function connectMasterDataCSVFileDirect() {
  if ('showOpenFilePicker' in window) {
    let handle;
    try {
      const handles = await window.showOpenFilePicker({
        types: [{
          description: 'Master Data File (*.xlsx, *.xls, *.csv)',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
            'text/plain': ['.txt']
          }
        }],
        multiple: false
      });
      handle = handles && handles[0];
    } catch (pickerErr) {
      return;
    }

    if (!handle) return;

    activeCSVHandle = handle;
    activeCSVFileName = handle.name;
    appState.resolvedCsvPath = handle.name;
    await saveStoredCSVHandle(handle);

    try {
      const file = await handle.getFile();
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];

      if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const res = parseMasterDataExcelBuffer(buf);
        rows = res.data;
        if (res.sheetName) activeMasterSheetName = res.sheetName;
      } else {
        const text = await file.text();
        rows = parseMasterDataCSVText(text);
        activeMasterSheetName = 'CSV';
      }

      if (rows.length === 0) {
        showToast("No valid records found in selected Master Data file.", "error");
        return;
      }
      appState.styleMaster = rows;
      isMasterCSVConnected = true;

      const csvPathInput = document.getElementById('csv-custom-path-input');
      if (csvPathInput) csvPathInput.value = handle.name;
      const wizardCsvInput = document.getElementById('wizard-csv-path-input');
      if (wizardCsvInput) wizardCsvInput.value = handle.name;

      updateMasterDataUI();
      updateFormEntryState();
      showToast(`Linked to ${handle.name}! Loaded ${rows.length.toLocaleString()} master records.`, "success");
    } catch (readErr) {
      showToast("Failed to read file: " + readErr.message, "error");
    }
    return;
  }

  const fileInput = document.getElementById('csv-database-file-input');
  if (fileInput) {
    fileInput.click();
  } else {
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = '.xlsx,.xls,.csv,.txt';
    tempInput.style.display = 'none';
    document.body.appendChild(tempInput);
    tempInput.onchange = (e) => {
      handleCSVImportFile(e);
      document.body.removeChild(tempInput);
    };
    tempInput.click();
  }
}

function handleCSVImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const buf = evt.target.result;
        const res = parseMasterDataExcelBuffer(buf);
        const rows = res.data;
        if (rows.length === 0) {
          showToast("No valid records found in selected Excel file (Sheet: Docket Summary).", "error");
          return;
        }
        appState.styleMaster = rows;
        isMasterCSVConnected = true;
        activeCSVFileName = file.name;
        activeMasterSheetName = res.sheetName || 'Docket Summary';
        appState.resolvedCsvPath = file.name;

        const csvPathInput = document.getElementById('csv-custom-path-input');
        if (csvPathInput) csvPathInput.value = file.name;
        const wizardCsvInput = document.getElementById('wizard-csv-path-input');
        if (wizardCsvInput) wizardCsvInput.value = file.name;

        updateMasterDataUI();
        showToast(`Linked to ${file.name}! Loaded ${rows.length.toLocaleString()} master records from sheet "${activeMasterSheetName}".`, "success");
      } catch (err) {
        showToast("Excel Import Error: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const text = evt.target.result;
        const rows = parseMasterDataCSVText(text);
        if (rows.length === 0) {
          showToast("No valid records found in selected CSV file.", "error");
          return;
        }
        appState.styleMaster = rows;
        isMasterCSVConnected = true;
        activeCSVFileName = file.name;
        activeMasterSheetName = 'CSV';
        appState.resolvedCsvPath = file.name;

        const csvPathInput = document.getElementById('csv-custom-path-input');
        if (csvPathInput) csvPathInput.value = file.name;
        const wizardCsvInput = document.getElementById('wizard-csv-path-input');
        if (wizardCsvInput) wizardCsvInput.value = file.name;

        updateMasterDataUI();
        showToast(`Linked to ${file.name}! Loaded ${rows.length.toLocaleString()} master records.`, "success");
      } catch (err) {
        showToast("CSV Import Error: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  }
  e.target.value = '';
}

function downloadMasterDataTemplate() {
  const headers = "Style,Schedule,Color,Fabric Category,Docket ID,Fabric Requirement,UOM,Lay Job No\r\n";
  const rows = (appState.styleMaster || []).map(m =>
    `"${(m.style || '').replace(/"/g, '""')}","${(m.schedule || m.po || '').replace(/"/g, '""')}","${(m.color || '').replace(/"/g, '""')}","Body","${(m.docketNo || m.docket || '').replace(/"/g, '""')}","","yards","${(m.layJobNo || m.jobNo || m.pattern || '').replace(/"/g, '""')}"`
  ).join('\r\n');
  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "MasterData.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Downloaded MasterData.csv!", "success");
}

function onDataLoaded(data) {
  if (!data || typeof data !== 'object') return;
  isJSONConnected = true;

  if (Array.isArray(data.sizes)) {
    appState.sizes = Array.from(new Set(data.sizes.map(s => String(s || '').trim()).filter(Boolean)));
  } else if (!appState.sizes) {
    appState.sizes = [];
  }

  if (Array.isArray(data.parts)) {
    appState.parts = Array.from(new Set(data.parts.map(p => String(p || '').trim()).filter(Boolean)));
  } else if (!appState.parts) {
    appState.parts = [];
  }

  if (Array.isArray(data.racks)) {
    appLocationState.racks = data.racks;
  }
  if (Array.isArray(data.pallets)) {
    appLocationState.pallets = data.pallets;
  }

  if (!appState.selectedParts || appState.selectedParts.length === 0) {
    appState.selectedParts = [...appState.parts];
  }

  if (Array.isArray(data.tags)) {
    appState.allStoredTags = data.tags.filter(t => t && (t.id || t.tagId || t.qrData));
  } else if (!appState.allStoredTags) {
    appState.allStoredTags = [];
  }

  const tagMap = new Map();
  (appState.allStoredTags || []).forEach(t => {
    const bId = t.batchId;
    if (bId) {
      if (!tagMap.has(bId)) tagMap.set(bId, []);
      tagMap.get(bId).push(t);
    }
  });

  let rawLogs = [];
  if (Array.isArray(data.logs)) {
    rawLogs = data.logs.filter(l => l && (l.batchId || l.id));
  } else if (Array.isArray(data.batches)) {
    rawLogs = data.batches.filter(l => l && (l.batchId || l.id));
  }

  appState.logs = rawLogs.map(l => {
    const bId = l.batchId || l.id;
    const matchedTags = (Array.isArray(l.tags) && l.tags.length > 0)
      ? l.tags
      : (tagMap.get(bId) || []);

    let embStyle = l.embellishmentStyle;
    if (!embStyle || embStyle === 'No') {
      const hasEmbTag = matchedTags.some(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes' || (t.part && t.part.toLowerCase().includes('emb')));
      const hasEmbCutPart = String(l.cutParts || '').toLowerCase().includes('emb');
      if (hasEmbTag || hasEmbCutPart) {
        embStyle = 'Yes';
      }
    }

    let ptnText = l.patternText;
    if (!ptnText || ptnText === 'N/A') {
      const pTag = matchedTags.find(t => t.patternText && t.patternText !== 'N/A');
      if (pTag) ptnText = pTag.patternText;
    }

    return {
      ...l,
      embellishmentStyle: embStyle || 'No',
      patternText: ptnText || '',
      tags: matchedTags,
      tagCount: matchedTags.length || l.tagCount || 0
    };
  });

  if ((!appState.allStoredTags || appState.allStoredTags.length === 0)) {
    const gathered = [];
    appState.logs.forEach(l => {
      if (Array.isArray(l.tags)) gathered.push(...l.tags);
    });
    if (gathered.length > 0) appState.allStoredTags = gathered;
  }

  let rawArchived = [];
  if (Array.isArray(data.archivedLogs)) {
    rawArchived = data.archivedLogs.filter(l => l && (l.batchId || l.id));
  } else if (Array.isArray(data.archive)) {
    rawArchived = data.archive.filter(l => l && (l.batchId || l.id));
  }

  appState.archivedLogs = rawArchived.map(l => {
    const bId = l.batchId || l.id;
    const matchedTags = (Array.isArray(l.tags) && l.tags.length > 0)
      ? l.tags
      : (tagMap.get(bId) || []);

    let embStyle = l.embellishmentStyle;
    if (!embStyle || embStyle === 'No') {
      const hasEmbTag = matchedTags.some(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes' || (t.part && t.part.toLowerCase().includes('emb')));
      const hasEmbCutPart = String(l.cutParts || '').toLowerCase().includes('emb');
      if (hasEmbTag || hasEmbCutPart) {
        embStyle = 'Yes';
      }
    }

    let ptnText = l.patternText;
    if (!ptnText || ptnText === 'N/A') {
      const pTag = matchedTags.find(t => t.patternText && t.patternText !== 'N/A');
      if (pTag) ptnText = pTag.patternText;
    }

    return {
      ...l,
      isArchived: true,
      embellishmentStyle: embStyle || 'No',
      patternText: ptnText || '',
      tags: matchedTags,
      tagCount: matchedTags.length || l.tagCount || 0
    };
  });

  if (data.customColumns && typeof data.customColumns === 'object') {
    appState.customColumns = data.customColumns;
  }

  if ((!appState.mappingRows || appState.mappingRows.length === 0) && appState.sizes.length > 0) {
    if (typeof addMappingRow === 'function') {
      addMappingRow(appState.sizes[0] || 'M', 1);
    }
  }

  if (typeof updateJSONConnectionUI === 'function') updateJSONConnectionUI(activeFilePathDisplay, true);
  if (typeof renderSizesPills === 'function') renderSizesPills();
  if (typeof renderPartsPills === 'function') renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  if (typeof renderArchiveTable === 'function') renderArchiveTable();
  if (typeof updateStatusBadgesUI === 'function') updateStatusBadgesUI();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  if (typeof renderReportsDashboard === 'function') renderReportsDashboard();
}

function updateFormEntryState() {
  const isLive = isJSONConnected;
  const isCsvLive = isMasterCSVConnected && (appState.styleMaster || []).length > 0;

  const styleSelect = document.getElementById('gen-style');
  const colorSelect = document.getElementById('gen-color');
  const schedSelect = document.getElementById('gen-po');
  const jobSelect = document.getElementById('gen-pattern');
  const docketSelect = document.getElementById('gen-docket');
  const plyInput = document.getElementById('gen-ply');

  if (styleSelect) {
    styleSelect.disabled = !isLive || !isCsvLive;
  }
  if (!isLive) {
    if (colorSelect) colorSelect.disabled = true;
    if (schedSelect) schedSelect.disabled = true;
    if (jobSelect) jobSelect.disabled = true;
    if (docketSelect) docketSelect.disabled = true;
    if (plyInput) plyInput.disabled = true;
  } else {
    if (plyInput) plyInput.disabled = false;
  }

  const btnGen = document.getElementById('btn-generate');
  if (btnGen) {
    btnGen.disabled = !isLive;
    if (isLive) {
      btnGen.className = "px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-md shadow-2xs transition-all whitespace-nowrap shrink-0 cursor-pointer";
      btnGen.title = "Generate Garment Tags";
    } else {
      btnGen.className = "px-5 py-2 bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs rounded-md shadow-none transition-all whitespace-nowrap shrink-0 cursor-not-allowed opacity-60 pointer-events-none";
      btnGen.title = "Database is disconnected. Live database connection is required to generate tags.";
    }
  }

  const btnAddRow = document.getElementById('btn-add-mapping-row') || document.querySelector('#sec-generator button[onclick="addMappingRow()"]');
  if (btnAddRow) {
    btnAddRow.disabled = !isLive;
    btnAddRow.classList.toggle('opacity-50', !isLive);
    btnAddRow.classList.toggle('cursor-not-allowed', !isLive);
    btnAddRow.title = isLive ? "Add Size Row" : "Database is disconnected. Connect database to add size rows.";
  }

  const btnAddSize = document.getElementById('btn-add-size');
  const inputSize = document.getElementById('m-new-size');
  const btnAddPart = document.getElementById('btn-add-part');
  const inputPart = document.getElementById('m-new-part');
  const btnResetLogs = document.querySelector('button[onclick="resetDatabaseToDefaults()"]');

  if (btnAddSize) {
    btnAddSize.disabled = !isLive;
    btnAddSize.classList.toggle('opacity-50', !isLive);
    btnAddSize.classList.toggle('cursor-not-allowed', !isLive);
  }
  if (inputSize) inputSize.disabled = !isLive;

  if (btnAddPart) {
    btnAddPart.disabled = !isLive;
    btnAddPart.classList.toggle('opacity-50', !isLive);
    btnAddPart.classList.toggle('cursor-not-allowed', !isLive);
  }
  if (inputPart) inputPart.disabled = !isLive;

  if (btnResetLogs) {
    btnResetLogs.disabled = !isLive;
    btnResetLogs.classList.toggle('opacity-50', !isLive);
    btnResetLogs.classList.toggle('cursor-not-allowed', !isLive);
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('gen-style');
    refreshSearchableSelect('gen-color');
    refreshSearchableSelect('gen-po');
    refreshSearchableSelect('gen-pattern');
    refreshSearchableSelect('gen-docket');
  }
}

function updateStatusBadgesUI() {
  const masterBadge = document.getElementById('gen-status-master');
  const masterText = document.getElementById('gen-status-master-text');
  const masterDot = document.getElementById('gen-status-master-dot');
  const masterCount = document.getElementById('gen-master-records-count');
  const masterQuickBtn = document.getElementById('btn-connect-master-quick');
  const recordsCount = (appState.styleMaster || []).length;
  const isMasterLive = isMasterCSVConnected && recordsCount > 0;
  
  if (masterCount) masterCount.textContent = recordsCount.toLocaleString();
  if (masterText) {
    masterText.textContent = isMasterLive ? "Connected" : "Disconnected";
  }
  if (masterDot) {
    masterDot.className = isMasterLive
      ? "w-2 h-2 rounded-full bg-emerald-500"
      : "w-2 h-2 rounded-full bg-rose-500";
  }
  if (masterBadge) {
    masterBadge.className = isMasterLive
      ? "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
      : "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
  }
  if (masterQuickBtn) {
    if (isMasterLive) masterQuickBtn.classList.add('hidden');
    else masterQuickBtn.classList.remove('hidden');
  }

  const bundleBadge = document.getElementById('gen-status-bundle');
  const bundleText = document.getElementById('gen-status-bundle-text');
  const bundleDot = document.getElementById('gen-status-bundle-dot');
  const quickBtn = document.getElementById('btn-connect-json-quick');
  const alertBanner = document.getElementById('db-disconnected-alert');
  const syncIndicator = document.getElementById('json-sync-indicator');

  if (bundleText) {
    bundleText.textContent = isJSONConnected ? "Connected" : "Disconnected";
  }
  if (bundleDot) {
    bundleDot.className = isJSONConnected
      ? "w-2 h-2 rounded-full bg-emerald-500"
      : "w-2 h-2 rounded-full bg-rose-500";
  }
  if (bundleBadge) {
    bundleBadge.className = isJSONConnected
      ? "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
      : "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
  }
  if (quickBtn) {
    if (isJSONConnected) quickBtn.classList.add('hidden');
    else quickBtn.classList.remove('hidden');
  }
  if (alertBanner) {
    if (isJSONConnected) alertBanner.classList.add('hidden');
    else alertBanner.classList.remove('hidden');
  }
  if (syncIndicator) {
    if (isJSONConnected) {
      syncIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Auto-Sync Active`;
      syncIndicator.className = "inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800";
    } else {
      syncIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> Database Disconnected`;
      syncIndicator.className = "inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800";
    }
  }

  const specsText = document.getElementById('gen-status-specs-text');
  const specsDot = document.getElementById('gen-status-specs-dot');
  const specsBadge = document.getElementById('gen-status-specs');
  if (specsText) {
    specsText.textContent = isJSONConnected ? "Connected" : "Disconnected";
    if (specsDot) {
      specsDot.className = isJSONConnected
        ? "w-2 h-2 rounded-full bg-emerald-500"
        : "w-2 h-2 rounded-full bg-rose-500";
    }
    if (specsBadge) {
      specsBadge.className = isJSONConnected
        ? "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
        : "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
    }
  }

  const archiveText = document.getElementById('gen-status-archive-text');
  const archiveDot = document.getElementById('gen-status-archive-dot');
  const archiveBadge = document.getElementById('gen-status-archive');
  const archiveLiveBadge = document.getElementById('archive-live-status-badge');
  if (archiveText) {
    archiveText.textContent = isJSONConnected ? "Connected" : "Disconnected";
    if (archiveDot) {
      archiveDot.className = isJSONConnected
        ? "w-2 h-2 rounded-full bg-emerald-500"
        : "w-2 h-2 rounded-full bg-rose-500";
    }
    if (archiveBadge) {
      archiveBadge.className = isJSONConnected
        ? "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
        : "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
    }
  }
  if (archiveLiveBadge) {
    if (isJSONConnected) {
      archiveLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> JSONL Archive Database (Live)`;
      archiveLiveBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
    } else {
      archiveLiveBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Archive Disconnected`;
      archiveLiveBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
    }
  }

  updateFormEntryState();
  syncSidebarBadges();
}

function updateJSONConnectionUI(filePath, isLive) {
  isJSONConnected = !!isLive;
  const pathInput = document.getElementById('json-custom-path-input');
  const pathDisplay = document.getElementById('json-custom-path-display');
  const csvPathInput = document.getElementById('csv-custom-path-input');
  const csvPathDisplay = document.getElementById('csv-custom-path-display');
  const storageDirEl = document.getElementById('storage-dir-display');
  const modalBadge = document.getElementById('modal-conn-badge');
  const alertBanner = document.getElementById('db-disconnected-alert');
  const quickBtn = document.getElementById('btn-connect-json-quick');
  const jsonStatusBadge = document.getElementById('json-file-status-badge');
  const csvStatusBadge = document.getElementById('csv-file-status-badge');

  const liveFolder = appState.storageDir || (filePath ? filePath.replace(/[\\/][^\\/]+$/, '') : 'D:\\Pranto\\Videos Work');
  if (pathInput) pathInput.value = liveFolder;
  if (pathDisplay) pathDisplay.textContent = liveFolder;
  if (csvPathInput && appState.resolvedCsvPath) csvPathInput.value = appState.resolvedCsvPath;
  if (csvPathDisplay && appState.resolvedCsvPath) csvPathDisplay.textContent = appState.resolvedCsvPath;

  if (storageDirEl) {
    storageDirEl.textContent = liveFolder;
    storageDirEl.title = liveFolder;
  }

  if (jsonStatusBadge) {
    jsonStatusBadge.className = isLive 
      ? "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-800" 
      : "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono border border-rose-200 dark:border-rose-800";
    jsonStatusBadge.textContent = isLive ? "Connected" : "Disconnected";
  }

  if (csvStatusBadge) {
    const csvLive = isMasterCSVConnected && (appState.styleMaster || []).length > 0;
    csvStatusBadge.className = csvLive 
      ? "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-800" 
      : "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono border border-rose-200 dark:border-rose-800";
    csvStatusBadge.textContent = csvLive ? "Connected" : "Disconnected";
  }

  if (modalBadge) {
    if (isLive) {
      modalBadge.className = "text-xs font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5";
      modalBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected`;
    } else {
      modalBadge.className = "text-xs font-bold px-2.5 py-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1.5";
      modalBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> Disconnected`;
    }
  }

  const allConnected = isJSONConnected && isMasterCSVConnected && (appState.styleMaster || []).length > 0;
  if (alertBanner) {
    if (allConnected) {
      alertBanner.classList.add('hidden');
    } else {
      alertBanner.classList.remove('hidden');
      const bannerTitle = document.getElementById('db-alert-title');
      const bannerDesc = document.getElementById('db-alert-desc');
      const btnDb = document.getElementById('btn-connect-db-banner');
      const btnCsv = document.getElementById('btn-connect-csv-banner');
      
      if (isJSONConnected && !isMasterCSVConnected) {
        if (bannerTitle) bannerTitle.textContent = "✅ Database Connected — Master Data (Excel) Needed";
        if (bannerDesc) bannerDesc.textContent = "Database (.jsonl) is connected! Now click 'Connect Master Data' to link your Excel file:";
        if (btnDb) {
          btnDb.classList.remove('hidden');
          btnDb.innerHTML = "✅ Database Connected (Change)";
          btnDb.className = "px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5";
        }
        if (btnCsv) {
          btnCsv.classList.remove('hidden');
          btnCsv.innerHTML = "📊 Connect Master Data (Excel)";
          btnCsv.className = "px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 ring-2 ring-emerald-400";
        }
      } else if (!isJSONConnected && isMasterCSVConnected) {
        if (bannerTitle) bannerTitle.textContent = "✅ Master Data Connected — Database (.jsonl) Needed";
        if (bannerDesc) bannerDesc.textContent = "Excel file is connected! Now click 'Connect Database Folder' to link your .jsonl files:";
        if (btnDb) {
          btnDb.classList.remove('hidden');
          btnDb.innerHTML = "📁 Connect Database Folder (.jsonl)";
          btnDb.className = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 ring-2 ring-indigo-400";
        }
        if (btnCsv) {
          btnCsv.classList.remove('hidden');
          btnCsv.innerHTML = "✅ Master Data Connected (Change)";
          btnCsv.className = "px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5";
        }
      } else {
        if (bannerTitle) bannerTitle.textContent = "Folders Disconnected (Zero Node.js Mode)";
        if (bannerDesc) bannerDesc.textContent = "Connect both Database (.jsonl) and Master Data (Excel) folders below:";
        if (btnDb) {
          btnDb.classList.remove('hidden');
          btnDb.innerHTML = "📁 Connect Database Folder (.jsonl)";
          btnDb.className = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95";
        }
        if (btnCsv) {
          btnCsv.classList.remove('hidden');
          btnCsv.innerHTML = "📊 Connect Master Data (Excel)";
          btnCsv.className = "px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95";
        }
      }
    }
  }

  if (quickBtn) {
    if (allConnected) quickBtn.classList.add('hidden');
    else quickBtn.classList.remove('hidden');
  }

  updateStatusBadgesUI();
  syncSidebarBadges();
  updateFormEntryState();
}

function flashSyncIndicator() {
  const syncInd = document.getElementById('json-sync-indicator');
  if (syncInd) {
    syncInd.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> 💾 Saved to JSON!`;
    setTimeout(() => {
      if (isJSONConnected) {
        syncInd.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Auto-Sync Active`;
      } else {
        syncInd.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Database Disconnected`;
      }
    }, 1800);
  }
}

async function checkAndInitJSONConnection() {
  // LIVE CONNECTION ONLY - Reading strictly from path configured in server_config.json
  try {
    const confRes = await fetch(getApiUrl('/api/config?_t=' + Date.now()), {
      cache: 'no-store'
    });
    if (!confRes.ok) throw new Error('Server config endpoint returned ' + confRes.status);
    const conf = await confRes.json();
    if (!conf.success) throw new Error('Server config returned success=false');

    appState.storageDir = conf.storageDir || conf.databaseDir || '';
    appState.resolvedCsvPath = conf.resolvedCsvPath || conf.csvFilePath || '';
    appState.resolvedJsonPath = conf.batchesFilePath || conf.resolvedJsonPath || conf.jsonFilePath || '';
    activeFilePathDisplay = appState.storageDir || conf.storageDir || 'garment_batches_data.jsonl';
    activeCSVFileName = (conf.resolvedCsvPath || conf.csvFilePath || 'MasterData.csv').split(/[\\/]/).pop();

    const csvPathInput = document.getElementById('csv-custom-path-input');
    const csvPathDisplay = document.getElementById('csv-custom-path-display');
    const jsonPathInput = document.getElementById('json-custom-path-input');
    const jsonPathDisplay = document.getElementById('json-custom-path-display');

    if (csvPathInput) csvPathInput.value = appState.resolvedCsvPath;
    if (csvPathDisplay) csvPathDisplay.textContent = appState.resolvedCsvPath;
    if (jsonPathInput) jsonPathInput.value = appState.storageDir || activeFilePathDisplay;
    if (jsonPathDisplay) jsonPathDisplay.textContent = appState.storageDir || activeFilePathDisplay;

    const dataRes = await fetch(getApiUrl('/api/data?_t=' + Date.now()), {
      cache: 'no-store'
    });
    const dataJson = await dataRes.json().catch(() => null);

    if (dataRes.ok && dataJson && dataJson.success && dataJson.data) {
      isJSONConnected = true;
      if (dataJson.mtime) lastJSONMtime = dataJson.mtime;
      onDataLoaded(dataJson.data);
      await loadMasterDataFromCSV();
      updateJSONConnectionUI(activeFilePathDisplay, true);
      updateStatusBadgesUI();
      syncSidebarBadges();
      updateFormEntryState();
      console.log('[LIVE] ✅ All databases connected successfully from live server');
      return;
    }

    // Server responded but data files are missing/deleted
    if (dataJson && (dataJson.error === 'DIRECTORY_NOT_FOUND' || dataJson.error === 'FILE_NOT_FOUND')) {
      showToast(`⚠️ ${dataJson.message || 'Database storage path not found'}`, "error");
    }
    throw new Error('Data endpoint did not return valid data');
  } catch (e) {
    console.warn("[LIVE] ❌ Live server connection failed:", e.message || e);
  }

  // If already in browser-direct mode, don't wipe — keep the connection alive
  if (isBrowserDirectMode && activeDirectoryHandle) {
    console.log('[BROWSER-DIRECT] Skipping server check — running in Zero Node.js mode');
    return;
  }

  // Try to auto-restore previously saved directory handles from IndexedDB (Zero Node.js auto-reconnect)
  try {
    const savedHandle = await getStoredDirectoryHandle();
    if (savedHandle) {
      const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        console.log('[BROWSER-DIRECT] Auto-restoring saved database handle:', savedHandle.name);
        activeDirectoryHandle = savedHandle;
        isBrowserDirectMode = true;
        await _loadFromDirectoryHandle(savedHandle);

        // Also auto-restore master data folder handle if separate
        try {
          const savedCsvHandle = await getStoredCSVHandle();
          if (savedCsvHandle && savedCsvHandle.kind === 'directory') {
            const csvPerm = await savedCsvHandle.queryPermission({ mode: 'read' });
            if (csvPerm === 'granted') {
              console.log('[BROWSER-DIRECT] Auto-restoring saved master data handle:', savedCsvHandle.name);
              activeMasterDirHandle = savedCsvHandle;
              await _loadMasterDataFromDirHandle(savedCsvHandle);
            }
          }
        } catch (csvE) {
          console.warn('[BROWSER-DIRECT] Could not auto-restore master data handle:', csvE.message);
        }
        return;
      }
    }
  } catch (e) {
    console.warn('[BROWSER-DIRECT] Could not auto-restore directory handle:', e.message);
  }

  // Auto-connect to live demo data if running in browser / demo mode
  if (typeof initDemoDataLoader === 'function') {
    initDemoDataLoader();
    return;
  }

  isJSONConnected = false;
  isMasterCSVConnected = false;
  appState.logs = [];
  appState.allStoredTags = [];
  appState.sizes = [];
  appState.parts = [];
  appState.selectedParts = [];
  appState.styleMaster = [];
  activeFilePathDisplay = "Database Disconnected";
  updateJSONConnectionUI(activeFilePathDisplay, false);
  updateMasterDataUI();
  if (typeof renderSizesPills === 'function') renderSizesPills();
  if (typeof renderPartsPills === 'function') renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  updateStatusBadgesUI();
  syncSidebarBadges();
  updateFormEntryState();
}

function startRealtimeStream() {
  if (streamPollingInterval) clearInterval(streamPollingInterval);
  streamPollingInterval = setInterval(async () => {
    // BROWSER DIRECT MODE: Live-poll files every second for multi-user live updates
    if (isBrowserDirectMode && activeDirectoryHandle) {
      try {
        // Re-read batches and archive files for live changes from other PCs
        for await (const entry of activeDirectoryHandle.values()) {
          const fname = entry.name.toLowerCase();
          if (entry.kind === 'file') {
            if (fname === 'garment_batches_data.jsonl') {
              const file = await entry.getFile();
              // Only re-parse if file was modified (check lastModified timestamp)
              if (file.lastModified !== _lastBrowserDirectPollTime) {
                _lastBrowserDirectPollTime = file.lastModified;
                const text = await file.text();
                const parsed = parseJsonlOrJson(text);
                const newLogs = Array.isArray(parsed.batches) ? parsed.batches : (Array.isArray(parsed) ? parsed : []);
                if (JSON.stringify(newLogs.length) !== JSON.stringify(appState.logs.length) || newLogs.length !== appState.logs.length) {
                  appState.logs = newLogs;
                  if (typeof renderLogsTable === 'function') renderLogsTable();
                  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
                  flashSyncIndicator();
                }
              }
            } else if (fname === 'garment_archive_data.jsonl' || fname === 'garment_archive_data.json') {
              const file = await entry.getFile();
              if (file.lastModified !== _lastArchivePollTime) {
                _lastArchivePollTime = file.lastModified;
                const text = await file.text();
                const parsed = parseJsonlOrJson(text);
                let arcList = [];
                if (Array.isArray(parsed.archivedLogs) && parsed.archivedLogs.length > 0) {
                  arcList = parsed.archivedLogs;
                } else if (Array.isArray(parsed.batches) && parsed.batches.length > 0) {
                  arcList = parsed.batches;
                } else if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
                  arcList = parsed.logs;
                } else if (Array.isArray(parsed)) {
                  arcList = parsed;
                } else if (parsed && (parsed.batchId || parsed.id)) {
                  arcList = [parsed];
                }
                const newArchived = arcList.map(a => ({ ...a, isArchived: true }));
                if (newArchived.length !== (appState.archivedLogs || []).length || JSON.stringify(newArchived.map(a => a.batchId || a.id)) !== JSON.stringify((appState.archivedLogs || []).map(a => a.batchId || a.id))) {
                  appState.archivedLogs = newArchived;
                  if (typeof renderArchiveTable === 'function') renderArchiveTable();
                  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
                  flashSyncIndicator();
                }
              }
            } else if (fname === 'garment_tags_data.jsonl') {
              const file = await entry.getFile();
              const text = await file.text();
              const parsed = parseJsonlOrJson(text);
              const newTags = Array.isArray(parsed.tags) ? parsed.tags : (Array.isArray(parsed) ? parsed : []);
              if (newTags.length !== (appState.allStoredTags || []).length) {
                appState.allStoredTags = newTags;
              }
            } else if (fname === 'garment_specs_data.jsonl') {
              const file = await entry.getFile();
              const text = await file.text();
              const parsed = parseJsonlOrJson(text);
              let changed = false;
              if (Array.isArray(parsed.sizes) && parsed.sizes.length > 0 && JSON.stringify(parsed.sizes) !== JSON.stringify(appState.sizes)) {
                appState.sizes = parsed.sizes;
                changed = true;
              }
              if (Array.isArray(parsed.parts) && parsed.parts.length > 0 && JSON.stringify(parsed.parts) !== JSON.stringify(appState.parts)) {
                appState.parts = parsed.parts;
                changed = true;
              }
              if (changed) {
                if (typeof renderSizesPills === 'function') renderSizesPills();
                if (typeof renderPartsPills === 'function') renderPartsPills();
                if (typeof renderPartsTile === 'function') renderPartsTile();
              }
            }
          }
        }
      } catch (pollErr) {
        console.warn('[BROWSER-DIRECT] Poll error:', pollErr.message);
      }
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/stream-status?_t=' + Date.now()), {
        cache: 'no-store'
      });
      if (res.ok) {
        const status = await res.json();
        if (status.success) {
          // If we were disconnected, perform full atomic initialization immediately
          if (!isJSONConnected || !isMasterCSVConnected) {
            await checkAndInitJSONConnection();
            return;
          }

          if (status.jsonConnected || status.connected) {
            const bMtime = status.batchesJsonMtime || 0;
            const tMtime = status.tagsJsonMtime || 0;
            const spMtime = status.specsJsonMtime || 0;
            const aMtime = status.archiveJsonMtime || 0;

            if (bMtime !== lastBatchesMtime || tMtime !== lastTagsMtime || aMtime !== lastArchiveMtime) {
              lastBatchesMtime = bMtime;
              lastTagsMtime = tMtime;
              lastArchiveMtime = aMtime;
              const dataRes = await fetch(getApiUrl('/api/data?_t=' + Date.now()), {
                cache: 'no-store'
              });
              if (dataRes.ok) {
                const dataJson = await dataRes.json();
                if (dataJson.success && dataJson.data) {
                  onDataLoaded(dataJson.data);
                  flashSyncIndicator();
                }
              }
            }

            if (spMtime && spMtime !== lastSpecsMtime) {
              lastSpecsMtime = spMtime;
              const spRes = await fetch(getApiUrl('/api/specs?_t=' + Date.now()), {
                cache: 'no-store'
              });
              if (spRes.ok) {
                const spJson = await spRes.json();
                if (spJson.success && spJson.data) {
                  if (Array.isArray(spJson.data.sizes)) appState.sizes = spJson.data.sizes;
                  if (Array.isArray(spJson.data.parts)) appState.parts = spJson.data.parts;
                  if (typeof renderSizesPills === 'function') renderSizesPills();
                  if (typeof renderPartsPills === 'function') renderPartsPills();
                  if (typeof renderPartsTile === 'function') renderPartsTile();
                }
              }
            }
          } else {
            if (isJSONConnected) {
              isJSONConnected = false;
              appState.logs = [];
              appState.allStoredTags = [];
              appState.sizes = [];
              appState.parts = [];
              appState.selectedParts = [];
              updateJSONConnectionUI(activeFilePathDisplay, false);
              updateFormEntryState();
              if (typeof renderLogsTable === 'function') renderLogsTable();
              if (typeof renderSizesPills === 'function') renderSizesPills();
              if (typeof renderPartsPills === 'function') renderPartsPills();
            }
          }

          if (status.csvConnected) {
            if (!isMasterCSVConnected || (status.masterCsvMtime && status.masterCsvMtime !== lastMasterMtime)) {
              if (status.masterCsvMtime) lastMasterMtime = status.masterCsvMtime;
              await loadMasterDataFromCSV();
            }
          } else {
            if (isMasterCSVConnected) {
              isMasterCSVConnected = false;
              appState.styleMaster = [];
              updateMasterDataUI();
              updateFormEntryState();
            }
          }

          return;
        }
      }
    } catch (e) {
      // BROWSER DIRECT MODE: Do NOT wipe data when server is unreachable
      if (isBrowserDirectMode && activeDirectoryHandle) {
        return;
      }
      if (window.isDemoMode) {
        return; // Maintain active demo mode
      }
      // STRICT ZERO-CACHE: If live connection fails, immediately disable connection and wipe in-memory data
      if (isJSONConnected || isMasterCSVConnected) {
        isJSONConnected = false;
        isMasterCSVConnected = false;
        appState.logs = [];
        appState.allStoredTags = [];
        appState.styleMaster = [];
        appState.sizes = [];
        appState.parts = [];
        updateJSONConnectionUI(activeFilePathDisplay, false);
        updateMasterDataUI();
        updateFormEntryState();
        updateStatusBadgesUI();
        if (typeof renderLogsTable === 'function') renderLogsTable();
        if (typeof renderSizesPills === 'function') renderSizesPills();
        if (typeof renderPartsPills === 'function') renderPartsPills();
      }
    }
  }, 1000);
}

function isElectronEnv() {
  return !!(window && (window.process?.type || window.electron || navigator.userAgent.includes('Electron')));
}

async function browseDatabaseFolder() {
  showLoading("Opening folder picker...");
  try {
    const res = await fetch(getApiUrl('/api/browse-folder'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'database' })
    });
    hideLoading();
    if (res.ok) {
      const json = await res.json();
      if (json.cancelled) return;
      if (json.success && (json.databaseDir || json.folderPath)) {
        const selectedFolder = json.databaseDir || json.folderPath;
        appState.storageDir = selectedFolder;
        appState.resolvedJsonPath = json.batchesFilePath || (selectedFolder + '\\garment_batches_data.jsonl');
        activeFilePathDisplay = selectedFolder;
        const input = document.getElementById('json-custom-path-input');
        if (input) input.value = selectedFolder;
        const wizInput = document.getElementById('wizard-json-path-input');
        if (wizInput) wizInput.value = selectedFolder;
        await checkAndInitJSONConnection();
        await loadMasterDataFromCSV();
        updateFormEntryState();
        updateStatusBadgesUI();
        showToast(`🟢 Database folder connected: ${selectedFolder}`, 'success');
        return;
      }
    }
  } catch (e) {
    hideLoading();
  }

  // Web Browser Fallback: Open directory picker directly if server API not reachable
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      await saveStoredDirectoryHandle(dirHandle);
      await _loadFromDirectoryHandle(dirHandle);
      return;
    } catch(e) {
      hideLoading();
      if (e.name !== 'AbortError') {
        const htmlPicker = document.getElementById('html-folder-picker-db');
        if (htmlPicker) htmlPicker.click();
      }
      return;
    }
  }

  // Fallback to HTML folder picker
  hideLoading();
  const htmlPicker = document.getElementById('html-folder-picker-db');
  if (htmlPicker) {
    htmlPicker.click();
  }
}

async function handleHTMLFolderPickerDB(event) {
  const files = event.target?.files;
  if (!files || files.length === 0) return;
  showLoading("Reading selected database files from folder...");
  try {
    let folderPath = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!folderPath && file.webkitRelativePath) {
        folderPath = file.webkitRelativePath.split('/')[0];
      }
      const fname = file.name.toLowerCase();
      if (fname === 'garment_batches_data.jsonl' || fname === 'garment_batches_data.json') {
        const text = await file.text();
        const parsed = parseJsonlOrJson(text);
        if (Array.isArray(parsed.batches)) appState.logs = parsed.batches;
        else if (Array.isArray(parsed)) appState.logs = parsed;
      } else if (fname === 'garment_tags_data.jsonl' || fname === 'garment_tags_data.json') {
        const text = await file.text();
        const parsed = parseJsonlOrJson(text);
        if (Array.isArray(parsed.tags)) appState.allStoredTags = parsed.tags;
        else if (Array.isArray(parsed)) appState.allStoredTags = parsed;
      } else if (fname === 'garment_specs_data.jsonl' || fname === 'garment_specs_data.json') {
        const text = await file.text();
        const parsed = parseJsonlOrJson(text);
        if (Array.isArray(parsed.sizes)) appState.sizes = parsed.sizes;
        if (Array.isArray(parsed.parts)) appState.parts = parsed.parts;
      } else if (fname === 'garment_archive_data.jsonl' || fname === 'garment_archive_data.json') {
        const text = await file.text();
        const parsed = parseJsonlOrJson(text);
        let arcList = [];
        if (Array.isArray(parsed.archivedLogs) && parsed.archivedLogs.length > 0) {
          arcList = parsed.archivedLogs;
        } else if (Array.isArray(parsed.batches) && parsed.batches.length > 0) {
          arcList = parsed.batches;
        } else if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
          arcList = parsed.logs;
        } else if (Array.isArray(parsed)) {
          arcList = parsed;
        } else if (parsed && (parsed.batchId || parsed.id)) {
          arcList = [parsed];
        }
        appState.archivedLogs = arcList.map(a => ({ ...a, isArchived: true }));
      } else if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname === 'masterdata.csv') {
        if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
          const buf = await file.arrayBuffer();
          const res = parseMasterDataExcelBuffer(buf);
          if (res.data && res.data.length > 0) {
            appState.styleMaster = res.data;
            activeCSVFileName = file.name;
            if (res.sheetName) activeMasterSheetName = res.sheetName;
            isMasterCSVConnected = true;
          }
        } else {
          const text = await file.text();
          const rows = parseMasterDataCSVText(text);
          if (rows.length > 0) {
            appState.styleMaster = rows;
            activeCSVFileName = file.name;
            isMasterCSVConnected = true;
          }
        }
      }
    }

    if (folderPath) {
      appState.storageDir = folderPath;
      activeFilePathDisplay = folderPath;
      const input = document.getElementById('json-custom-path-input');
      if (input) input.value = folderPath;
    }

    isJSONConnected = true;
    updateJSONConnectionUI(activeFilePathDisplay, true);
    updateMasterDataUI();
    if (typeof renderSizesPills === 'function') renderSizesPills();
    if (typeof renderPartsPills === 'function') renderPartsPills();
    if (typeof renderLogsTable === 'function') renderLogsTable();
    updateFormEntryState();
    updateStatusBadgesUI();
    showToast(`🟢 Loaded database from folder: ${folderPath || 'Selected Folder'}`, 'success');
  } catch (e) {
    showToast("Failed to parse database folder: " + e.message, "error");
  } finally {
    hideLoading();
    event.target.value = '';
  }
}

function parseJsonlOrJson(content) {
  if (!content || !content.trim()) return {};
  const trimmed = content.trim();
  
  // If it's a full JSON export bundle containing arrays of batches/logs
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      // Check if it's a root database bundle object
      if ((Array.isArray(obj.batches) || Array.isArray(obj.logs) || Array.isArray(obj.archivedLogs)) && !obj.batchId) {
        return {
          ...obj,
          batches: Array.isArray(obj.batches) ? obj.batches : (Array.isArray(obj.logs) ? obj.logs : []),
          archivedLogs: Array.isArray(obj.archivedLogs) ? obj.archivedLogs : []
        };
      }
      // If it's a single record object like { id: '...', batchId: '...', isArchived: true, tags: [...] }
      if (obj.batchId || obj.id || obj.tagString || obj.type) {
        const singleResult = { batches: [], archivedLogs: [], tags: [], sizes: [], parts: [], racks: [], pallets: [], bundleLocations: [], history: [] };
        if (obj.type === 'sizes') singleResult.sizes = obj.items || [];
        else if (obj.type === 'parts') singleResult.parts = obj.items || [];
        else if (obj.type === 'rack') singleResult.racks.push(obj);
        else if (obj.type === 'pallet') singleResult.pallets.push(obj);
        else if (obj.type === 'location') singleResult.bundleLocations.push(obj);
        else if (obj.type === 'history') singleResult.history.push(obj);
        else if (obj.isArchived) singleResult.archivedLogs.push(obj);
        else if (obj.batchId && obj.tagString && !Array.isArray(obj.tags)) singleResult.tags.push(obj);
        else if (obj.batchId || obj.id) singleResult.batches.push(obj);
        return singleResult;
      }
    } catch(e) {}
  }

  // Multi-line JSONL format
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { batches: [], archivedLogs: [], tags: [], sizes: [], parts: [], racks: [], pallets: [], bundleLocations: [], history: [] };
  lines.forEach(l => {
    try {
      const obj = JSON.parse(l);
      if (obj.type === 'sizes') result.sizes = obj.items || [];
      else if (obj.type === 'parts') result.parts = obj.items || [];
      else if (obj.type === 'rack') result.racks.push(obj);
      else if (obj.type === 'pallet') result.pallets.push(obj);
      else if (obj.type === 'location') result.bundleLocations.push(obj);
      else if (obj.type === 'history') result.history.push(obj);
      else if (obj.type === 'meta') {
        if (obj.sizes) result.sizes = obj.sizes;
        if (obj.parts) result.parts = obj.parts;
      } else if (obj.isArchived) {
        result.archivedLogs.push(obj);
      } else if (obj.batchId && obj.tagString && !Array.isArray(obj.tags)) {
        result.tags.push(obj);
      } else if (obj.batchId || obj.id) {
        result.batches.push(obj);
      }
    } catch(e) {}
  });
  return result;
}

function browseJSONFolder() {
  return browseDatabaseFolder();
}

async function reloadBothDatabases() {
  showLoading("Syncing Bundle & Location databases from disk...");
  await checkAndInitJSONConnection();
  if (typeof loadLocationDatabase === 'function') await loadLocationDatabase();
  hideLoading();
  showToast("🟢 Both Bundle & Location JSON Databases Synced!", "success");
}

async function browseCSVFolder() {
  if (isElectronEnv()) {
    showLoading("Opening Master Data folder picker...");
    try {
      const res = await fetch(getApiUrl('/api/browse-folder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'csv' })
      });
      hideLoading();
      if (res.ok) {
        const json = await res.json();
        if (json.cancelled) return;
        if (json.success && (json.folderPath || json.csvFilePath)) {
          const selectedFolder = json.folderPath || json.csvFilePath;
          const newCsvPath = json.csvFilePath || selectedFolder;
          appState.resolvedCsvPath = newCsvPath;
          activeCSVFileName = newCsvPath.split(/[\\/]/).pop() || 'MasterData.csv';
          const input = document.getElementById('csv-custom-path-input');
          if (input) input.value = selectedFolder;
          const wizInput = document.getElementById('wizard-csv-path-input');
          if (wizInput) wizInput.value = selectedFolder;
          await loadMasterDataFromCSV();
          updateMasterDataUI();
          updateFormEntryState();
          showToast(`🟢 Master Data connected: ${selectedFolder}`, 'success');
          return;
        }
      }
    } catch (e) {
      hideLoading();
    }
  }

  // Web Browser / Standalone:
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      activeMasterDirHandle = dirHandle;
      await saveStoredCSVHandle(dirHandle);
      const folderName = dirHandle.name;
      const input = document.getElementById('csv-custom-path-input');
      if (input) input.value = folderName;

      showLoading("Scanning folder for Master Data (Excel / CSV)...");
      let matched = false;
      for await (const entry of dirHandle.values()) {
        const fname = entry.name.toLowerCase();
        if (entry.kind === 'file' && (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.csv'))) {
          const file = await entry.getFile();
          if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
            const buf = await file.arrayBuffer();
            const res = parseMasterDataExcelBuffer(buf);
            if (res.data && res.data.length > 0) {
              appState.styleMaster = res.data;
              activeCSVFileName = file.name;
              if (res.sheetName) activeMasterSheetName = res.sheetName;
              isMasterCSVConnected = true;
              matched = true;
              break;
            }
          } else {
            const text = await file.text();
            const rows = parseMasterDataCSVText(text);
            if (rows.length > 0) {
              appState.styleMaster = rows;
              activeCSVFileName = file.name;
              isMasterCSVConnected = true;
              matched = true;
              break;
            }
          }
        }
      }
      hideLoading();
      if (matched) {
        isBrowserDirectMode = true;
        updateMasterDataUI();
        updateFormEntryState();
        updateStatusBadgesUI();
        syncSidebarBadges();
        updateJSONConnectionUI(activeFilePathDisplay, isJSONConnected);
        showToast(`🟢 Loaded ${appState.styleMaster.length} Master Data records from ${activeCSVFileName}`, "success");
      } else {
        showToast("No valid Excel / CSV master data found in folder.", "warning");
      }
      return;
    } catch(e) {
      hideLoading();
      if (e.name !== 'AbortError') {
        const htmlPicker = document.getElementById('html-folder-picker-csv');
        if (htmlPicker) htmlPicker.click();
      }
      return;
    }
  }

  // Fallback to HTML folder picker
  hideLoading();
  const htmlPicker = document.getElementById('html-folder-picker-csv');
  if (htmlPicker) {
    htmlPicker.click();
  }
}

async function handleHTMLFolderPickerCSV(event) {
  const files = event.target?.files;
  if (!files || files.length === 0) return;
  showLoading("Scanning folder for Master Data (Excel / CSV)...");
  try {
    let matched = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fname = file.name.toLowerCase();
      if (fname.endsWith('.xlsx') || fname.endsWith('.xls') || fname.endsWith('.csv')) {
        if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
          const buf = await file.arrayBuffer();
          const res = parseMasterDataExcelBuffer(buf);
          if (res.data && res.data.length > 0) {
            appState.styleMaster = res.data;
            activeCSVFileName = file.name;
            if (res.sheetName) activeMasterSheetName = res.sheetName;
            isMasterCSVConnected = true;
            matched = true;
            break;
          }
        } else {
          const text = await file.text();
          const rows = parseMasterDataCSVText(text);
          if (rows.length > 0) {
            appState.styleMaster = rows;
            activeCSVFileName = file.name;
            isMasterCSVConnected = true;
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) {
      updateMasterDataUI();
      updateFormEntryState();
      showToast(`🟢 Loaded ${appState.styleMaster.length} Master Data records from ${activeCSVFileName}`, "success");
    } else {
      showToast("No Excel (.xlsx/.xls) or CSV files found in selected folder.", "error");
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      showToast("Error opening folder: " + e.message, "error");
    }
  } finally {
    hideLoading();
    if (event.target) event.target.value = '';
  }
}

async function browseJSONFile() {
  showLoading("Opening Database file picker...");
  try {
    const res = await fetch(getApiUrl('/api/browse-file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'json' })
    });
    hideLoading();
    if (res.ok) {
      const json = await res.json();
      if (json.cancelled) return;
      if (json.success && (json.filePath || json.jsonFilePath)) {
        const selectedPath = json.filePath || json.jsonFilePath;
        const folder = json.databaseDir || json.storageDir || selectedPath;
        appState.storageDir = folder;
        appState.resolvedJsonPath = selectedPath;
        activeFilePathDisplay = folder;
        const input = document.getElementById('json-custom-path-input');
        if (input) input.value = selectedPath;
        await checkAndInitJSONConnection();
        if (typeof loadLocationDatabase === 'function') await loadLocationDatabase();
        updateFormEntryState();
        updateStatusBadgesUI();
        showToast(`🟢 Connected to Database: ${selectedPath}`, 'success');
        return;
      }
    }
  } catch (e) {
    hideLoading();
  }

  // Web Browser Fallback: Trigger native browser file picker directly
  hideLoading();
  const fileInput = document.getElementById('json-database-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

async function browseCSVFile() {
  showLoading("Opening Master Data file picker...");
  try {
    const res = await fetch(getApiUrl('/api/browse-file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'csv' })
    });
    hideLoading();
    if (res.ok) {
      const json = await res.json();
      if (json.cancelled) return;
      if (json.success && (json.filePath || json.csvFilePath)) {
        const selectedPath = json.filePath || json.csvFilePath;
        appState.resolvedCsvPath = selectedPath;
        activeCSVFileName = selectedPath.split(/[\\/]/).pop() || 'MasterData.csv';
        const input = document.getElementById('csv-custom-path-input');
        if (input) input.value = selectedPath;
        const wizInput = document.getElementById('wizard-csv-path-input');
        if (wizInput) wizInput.value = selectedPath;
        await loadMasterDataFromCSV();
        updateMasterDataUI();
        updateFormEntryState();
        showToast(`🟢 Connected to Master Data: ${selectedPath}`, 'success');
        return;
      }
    }
  } catch (e) {
    hideLoading();
  }

  // Web Browser Fallback: Trigger native browser file picker directly
  hideLoading();
  const fileInput = document.getElementById('csv-database-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

async function handleCSVImportFile(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  showLoading(`Reading Master Data file: ${file.name}...`);
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer();
      const res = parseMasterDataExcelBuffer(buf);
      if (res.data && res.data.length > 0) {
        appState.styleMaster = res.data;
        activeCSVFileName = file.name;
        appState.resolvedCsvPath = file.name;
        if (res.sheetName) activeMasterSheetName = res.sheetName;
        isMasterCSVConnected = true;
        const input = document.getElementById('csv-custom-path-input');
        if (input) input.value = file.name;
        try {
          await fetch(getApiUrl('/api/config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvFilePath: file.name })
          });
        } catch(e) {}
        updateMasterDataUI();
        updateFormEntryState();
        updateStatusBadgesUI();
        showToast(`🟢 Loaded ${res.data.length} records from ${file.name} (Sheet: ${res.sheetName || 'Active'})`, "success");
      } else {
        showToast("No valid rows found in Excel sheet.", "error");
      }
    } else {
      const text = await file.text();
      const rows = parseMasterDataCSVText(text);
      if (rows.length > 0) {
        appState.styleMaster = rows;
        activeCSVFileName = file.name;
        appState.resolvedCsvPath = file.name;
        isMasterCSVConnected = true;
        const input = document.getElementById('csv-custom-path-input');
        if (input) input.value = file.name;
        try {
          await fetch(getApiUrl('/api/config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvFilePath: file.name })
          });
        } catch(e) {}
        updateMasterDataUI();
        updateFormEntryState();
        updateStatusBadgesUI();
        showToast(`🟢 Loaded ${rows.length} records from ${file.name}`, "success");
      } else {
        showToast("No valid CSV records found.", "error");
      }
    }
  } catch (e) {
    showToast("Failed to parse Master Data file: " + e.message, "error");
  } finally {
    hideLoading();
    event.target.value = '';
  }
}

async function handleJSONImportFile(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  showLoading(`Importing database from ${file.name}...`);
  try {
    const text = await file.text();
    const parsed = parseJsonlOrJson(text);
    if (Array.isArray(parsed.batches) && parsed.batches.length > 0) appState.logs = parsed.batches;
    if (Array.isArray(parsed.archivedLogs) && parsed.archivedLogs.length > 0) appState.archivedLogs = parsed.archivedLogs;
    if (Array.isArray(parsed.tags) && parsed.tags.length > 0) appState.allStoredTags = parsed.tags;
    if (Array.isArray(parsed.sizes) && parsed.sizes.length > 0) appState.sizes = parsed.sizes;
    if (Array.isArray(parsed.parts) && parsed.parts.length > 0) appState.parts = parsed.parts;
    if (Array.isArray(parsed.racks) && parsed.racks.length > 0) appLocationState.racks = parsed.racks;
    if (Array.isArray(parsed.pallets) && parsed.pallets.length > 0) appLocationState.pallets = parsed.pallets;
    if (Array.isArray(parsed.bundleLocations) && parsed.bundleLocations.length > 0) appLocationState.bundleLocations = parsed.bundleLocations;
    if (Array.isArray(parsed.history) && parsed.history.length > 0) appLocationState.history = parsed.history;

    isJSONConnected = true;
    activeFilePathDisplay = file.name;
    const input = document.getElementById('json-custom-path-input');
    if (input) input.value = file.name;
    try {
      await fetch(getApiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonFilePath: file.name })
      });
    } catch(e) {}

    if (typeof onDataLoaded === 'function') onDataLoaded(parsed);
    if (typeof renderLocationManagementUI === 'function') renderLocationManagementUI();
    if (typeof renderSizesPills === 'function') renderSizesPills();
    if (typeof renderPartsPills === 'function') renderPartsPills();
    if (typeof renderLogsTable === 'function') renderLogsTable();
    updateFormEntryState();
    updateStatusBadgesUI();
    showToast(`🟢 Successfully imported data from ${file.name}!`, "success");
  } catch (e) {
    showToast("Failed to import database: " + e.message, "error");
  } finally {
    hideLoading();
    event.target.value = '';
  }
}

async function connectLocalJSONDataFile() {
  await checkAndInitJSONConnection();
}

async function connectLocalJSONDataFileDirect() {
  await checkAndInitJSONConnection();
}

async function openJSONFolderInExplorer() {
  try {
    const storageDir = appState.storageDir || document.getElementById('json-custom-path-input')?.value || '';
    const res = await fetch(getApiUrl('/api/open-folder'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'json', folderPath: storageDir, filePath: storageDir })
    });
    const json = await res.json();
    if (json.success) {
      showToast("Opened database folder in Windows Explorer", "info");
      return;
    }
  } catch (e) {}
  showToast("Opening Windows File Explorer requires running via desktop app or local server.", "info");
}

async function openCSVFolderInExplorer() {
  try {
    const csvPath = document.getElementById('csv-custom-path-input')?.value || appState.resolvedCsvPath || '';
    let folderPath = '';
    if (csvPath) {
      folderPath = csvPath.replace(/[\\/][^\\/]+$/, '');
    }
    const res = await fetch(getApiUrl('/api/open-folder'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'csv', folderPath: folderPath, filePath: csvPath })
    });
    const json = await res.json();
    if (json.success) {
      showToast("Opened Master Data folder in Windows Explorer", "info");
      return;
    }
  } catch (e) {}
  showToast("Opening Windows File Explorer requires running via desktop app or local server.", "info");
}

async function reloadFromActiveJSONFile() {
  showLoading("Re-reading latest data from database folder...");
  try {
    const res = await fetch(getApiUrl('/api/data?_t=' + Date.now()), { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        hideLoading();
        isJSONConnected = true;
        onDataLoaded(json.data);
        updateFormEntryState();
        showToast("Reloaded latest data from server database files!", "success");
        return;
      }
    }
  } catch (e) {}

  hideLoading();
  await checkAndInitJSONConnection();
  showToast("Reloaded latest database state.", "info");
}

async function forceSaveToActiveJSONFile() {
  if (!isJSONConnected) {
    showToast("⚠️ Cannot save: Database is disconnected. Please connect the database folder first.", "error");
    return;
  }
  showLoading("Writing current data to split database files...");
  await saveLocalDatabase();
  hideLoading();
  showToast("All specs, batches, and tags saved directly to database folder!", "success");
}

async function saveCustomServerPath() {
  const dataInput = document.getElementById('json-custom-path-input');
  const csvInput = document.getElementById('csv-custom-path-input');
  
  const newJsonPath = dataInput ? dataInput.value.trim() : '';
  const newCsvMasterPath = csvInput ? csvInput.value.trim() : '';

  if (!newJsonPath && !newCsvMasterPath) {
    showToast("Please enter a database folder or master data path.", "error");
    return;
  }

  showLoading("Updating database folder & file paths...");
  try {
    const payload = {};
    if (newJsonPath) {
      payload.databaseDir = newJsonPath;
      payload.storageDir = newJsonPath;
    }
    if (newCsvMasterPath) payload.csvFilePath = newCsvMasterPath;

    const res = await fetch(getApiUrl('/api/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    hideLoading();
    if (json.success) {
      if (json.databaseDir || json.storageDir) {
        activeFilePathDisplay = json.databaseDir || json.storageDir;
        appState.storageDir = json.databaseDir || json.storageDir;
        appState.resolvedJsonPath = json.batchesFilePath || (appState.storageDir + '\\garment_batches_data.jsonl');
      }
      if (json.resolvedCsvPath || (json.config && json.config.csvFilePath)) {
        appState.resolvedCsvPath = json.resolvedCsvPath || json.config.csvFilePath;
        activeCSVFileName = appState.resolvedCsvPath.split(/[\\/]/).pop() || 'MasterData.csv';
      }
      await checkAndInitJSONConnection();
      await loadMasterDataFromCSV();
      updateFormEntryState();
      updateStatusBadgesUI();
      syncSidebarBadges();
      showToast("🟢 Database storage folder & paths updated successfully!", "success");
      return;
    }
  } catch (e) {
    hideLoading();
  }

  if (newJsonPath) {
    appState.storageDir = newJsonPath;
    activeFilePathDisplay = newJsonPath;
  }
  if (newCsvMasterPath) {
    appState.resolvedCsvPath = newCsvMasterPath;
    activeCSVFileName = newCsvMasterPath.split(/[\\/]/).pop() || 'MasterData.csv';
  }
  updateJSONConnectionUI(activeFilePathDisplay, isJSONConnected);
  updateMasterDataUI();
  updateStatusBadgesUI();
  showToast(`Database folder saved.`, "success");
}

async function saveLocalDatabase() {
  if (!isJSONConnected) return false;

  const cleanSizes = Array.isArray(appState.sizes) 
    ? Array.from(new Set(appState.sizes.map(s => String(s || '').trim()).filter(Boolean)))
    : [];
  const cleanParts = Array.isArray(appState.parts)
    ? Array.from(new Set(appState.parts.map(p => String(p || '').trim()).filter(Boolean)))
    : [];
  const cleanLogs = Array.isArray(appState.logs)
    ? appState.logs.filter(l => l && (l.batchId || l.id)).map(l => ({
        id: l.id || l.batchId || 'BDL-' + Date.now(),
        batchId: l.batchId || l.id || 'BDL-' + Date.now(),
        timestamp: l.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
        style: String(l.style || '').trim(),
        color: String(l.color || '').trim(),
        schedule: String(l.schedule || l.po || '').trim(),
        po: String(l.schedule || l.po || '').trim(),
        layJobNo: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        jobNo: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        pattern: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        docketNo: String(l.docketNo || l.docket || '').trim(),
        docket: String(l.docketNo || l.docket || '').trim(),
        sizesSummary: String(l.sizesSummary || '').trim(),
        cutParts: String(l.cutParts || '').trim(),
        totalBundles: String(l.totalBundles || '').trim(),
        seqRange: String(l.seqRange || '').trim(),
        plyRange: String(l.plyRange || '').trim(),
        batchTagString: String(l.batchTagString || '').trim(),
        tagCount: Array.isArray(l.tags) ? l.tags.length : (l.tagCount || 0),
        tags: Array.isArray(l.tags) ? l.tags : ((appState.allStoredTags || []).filter(t => t.batchId === (l.batchId || l.id)))
      }))
    : [];

  const cleanArchivedLogs = Array.isArray(appState.archivedLogs)
    ? appState.archivedLogs.filter(l => l && (l.batchId || l.id)).map(l => ({
        id: l.id || l.batchId || 'BDL-' + Date.now(),
        batchId: l.batchId || l.id || 'BDL-' + Date.now(),
        timestamp: l.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
        style: String(l.style || '').trim(),
        color: String(l.color || '').trim(),
        schedule: String(l.schedule || l.po || '').trim(),
        po: String(l.schedule || l.po || '').trim(),
        layJobNo: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        jobNo: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        pattern: String(l.layJobNo || l.jobNo || l.pattern || 'N/A').trim(),
        docketNo: String(l.docketNo || l.docket || '').trim(),
        docket: String(l.docketNo || l.docket || '').trim(),
        sizesSummary: String(l.sizesSummary || '').trim(),
        cutParts: String(l.cutParts || '').trim(),
        totalBundles: String(l.totalBundles || '').trim(),
        seqRange: String(l.seqRange || '').trim(),
        plyRange: String(l.plyRange || '').trim(),
        batchTagString: String(l.batchTagString || '').trim(),
        isArchived: true,
        tagCount: Array.isArray(l.tags) ? l.tags.length : (l.tagCount || 0),
        tags: Array.isArray(l.tags) ? l.tags : ((appState.allStoredTags || []).filter(t => t.batchId === (l.batchId || l.id)))
      }))
    : [];

  appState.sizes = cleanSizes;
  appState.parts = cleanParts;
  appState.logs = cleanLogs;
  appState.archivedLogs = cleanArchivedLogs;

  const payload = {
    appName: "GarmentTag Bundle Generator",
    version: "3.1",
    updatedAt: new Date().toISOString(),
    sizes: cleanSizes,
    parts: cleanParts,
    customColumns: appState.customColumns || {},
    logs: cleanLogs,
    archivedLogs: cleanArchivedLogs,
    batches: cleanLogs.map(b => {
      const cp = { ...b };
      delete cp.tags;
      return cp;
    }),
    tags: appState.allStoredTags || []
  };

  if (activeDirectoryHandle) {
    try {
      const spHandle = await activeDirectoryHandle.getFileHandle('garment_specs_data.jsonl', { create: true });
      const spW = await spHandle.createWritable();
      const spLines = [
        JSON.stringify({ type: 'meta', appName: "GarmentTag Specs Data", version: "1.0", updatedAt: new Date().toISOString() }),
        JSON.stringify({ type: 'sizes', items: cleanSizes }),
        JSON.stringify({ type: 'parts', items: cleanParts })
      ];
      await spW.write(spLines.join('\n') + '\n');
      await spW.close();

      const bHandle = await activeDirectoryHandle.getFileHandle('garment_batches_data.jsonl', { create: true });
      const bW = await bHandle.createWritable();
      await bW.write(cleanLogs.map(b => JSON.stringify(b)).join('\n') + '\n');
      await bW.close();

      const aHandle = await activeDirectoryHandle.getFileHandle('garment_archive_data.jsonl', { create: true });
      const aW = await aHandle.createWritable();
      await aW.write(cleanArchivedLogs.map(b => JSON.stringify(b)).join('\n') + '\n');
      await aW.close();

      const tHandle = await activeDirectoryHandle.getFileHandle('garment_tags_data.jsonl', { create: true });
      const tW = await tHandle.createWritable();
      await tW.write((appState.allStoredTags || []).map(t => JSON.stringify(t)).join('\n') + '\n');
      await tW.close();

      flashSyncIndicator();
    } catch (e) {
      console.warn("Direct directory JSONL write error:", e);
    }
  }

  try {
    const res = await fetch(getApiUrl('/api/data'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const j = await res.json();
      if (j.mtime) lastJSONMtime = j.mtime;
      flashSyncIndicator();
    }
  } catch (e) {
    console.warn("Could not save to local server API:", e);
  }

  updateStatusBadgesUI();
  return true;
}

function exportDatabaseAsJSON() {
  try {
    const payload = {
      appName: "GarmentTag Bundle Generator",
      version: "3.1",
      exportedAt: new Date().toISOString(),
      sizes: appState.sizes || [],
      parts: appState.parts || [],
      logs: appState.logs || []
    };
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `garment_bundle_data_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Full database exported as JSON file!", "success");
  } catch (err) {
    showToast("Export failed: " + err.message, "error");
  }
}

function exportLogsAsCSV() {
  if (!appState.logs || appState.logs.length === 0) {
    showToast("No logs available to export.", "info");
    return;
  }
  const headers = ["Batch ID", "Timestamp", "Style", "Color", "Schedule", "Job No", "Docket No", "Sizes Summary", "Cut Parts", "Total Bundles", "SEQ Range", "Ply Range", "Batch Tag String"];
  const rows = appState.logs.map(l => [
    `"${(l.batchId || l.id || '').replace(/"/g, '""')}"`,
    `"${(l.timestamp || '').replace(/"/g, '""')}"`,
    `"${(l.style || '').replace(/"/g, '""')}"`,
    `"${(l.color || '').replace(/"/g, '""')}"`,
    `"${(l.schedule || l.po || '').replace(/"/g, '""')}"`,
    `"${(l.jobNo || l.layJobNo || l.pattern || '').replace(/"/g, '""')}"`,
    `"${(l.docketNo || l.docket || '').replace(/"/g, '""')}"`,
    `"${(l.sizesSummary || '').replace(/"/g, '""')}"`,
    `"${(l.cutParts || '').replace(/"/g, '""')}"`,
    `"${(l.totalBundles || '').replace(/"/g, '""')}"`,
    `"${(l.seqRange || '').replace(/"/g, '""')}"`,
    `"${(l.plyRange || '').replace(/"/g, '""')}"`,
    `"${(l.batchTagString || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `bundle_logs_summary_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Batch summary logs exported as CSV file!", "success");
}

function exportArchiveAsJSON() {
  try {
    const payload = {
      appName: "GarmentTag Bundle Generator - Archive",
      version: "3.1",
      exportedAt: new Date().toISOString(),
      archivedLogs: appState.archivedLogs || []
    };
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `garment_archive_data_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Archived batches exported as JSON file!", "success");
  } catch (err) {
    showToast("Archive export failed: " + err.message, "error");
  }
}

function exportArchiveAsCSV() {
  if (!appState.archivedLogs || appState.archivedLogs.length === 0) {
    showToast("No archived batches available to export.", "info");
    return;
  }
  const headers = ["Batch ID", "Timestamp", "Style", "Color", "Schedule", "Job No", "Docket No", "Sizes Summary", "Cut Parts", "Total Bundles", "SEQ Range", "Ply Range", "Batch Tag String"];
  const rows = appState.archivedLogs.map(l => [
    `"${(l.batchId || l.id || '').replace(/"/g, '""')}"`,
    `"${(l.timestamp || '').replace(/"/g, '""')}"`,
    `"${(l.style || '').replace(/"/g, '""')}"`,
    `"${(l.color || '').replace(/"/g, '""')}"`,
    `"${(l.schedule || l.po || '').replace(/"/g, '""')}"`,
    `"${(l.jobNo || l.layJobNo || l.pattern || '').replace(/"/g, '""')}"`,
    `"${(l.docketNo || l.docket || '').replace(/"/g, '""')}"`,
    `"${(l.sizesSummary || '').replace(/"/g, '""')}"`,
    `"${(l.cutParts || '').replace(/"/g, '""')}"`,
    `"${(l.totalBundles || '').replace(/"/g, '""')}"`,
    `"${(l.seqRange || '').replace(/"/g, '""')}"`,
    `"${(l.plyRange || '').replace(/"/g, '""')}"`,
    `"${(l.batchTagString || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `garment_archive_summary_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Archived batch summary exported as CSV file!", "success");
}



async function resetDatabaseToDefaults() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_bundle_data.json before resetting bundle logs.", "error");
    return;
  }
  if (!confirm("Are you sure you want to reset all bundle logs in garment_bundle_data.json?")) {
    return;
  }
  if (window.location.protocol.startsWith('http')) {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (e) {}
  }
  appState.logs = [];
  await saveLocalDatabase();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  updateStatusBadgesUI();
  updateFormEntryState();
  showToast("Bundle logs reset to empty.", "info");
}

function renderMasterTable() {
  const tbody = document.getElementById('master-table-rows');
  const countEl = document.getElementById('csv-records-count');
  const stylesCountEl = document.getElementById('csv-styles-count');
  const colorsCountEl = document.getElementById('csv-colors-count');
  const searchInput = document.getElementById('master-search-input');
  const searchVal = (searchInput?.value || '').trim().toLowerCase();

  const totalRecords = (appState.styleMaster || []).length;
  if (countEl) countEl.textContent = totalRecords.toLocaleString();
  const sidebarMasterCount = document.getElementById('sidebar-master-count');
  if (sidebarMasterCount) {
    sidebarMasterCount.textContent = totalRecords > 999 ? `${(totalRecords/1000).toFixed(1)}k` : totalRecords;
  }

  if (stylesCountEl) {
    const uniqueStyles = new Set((appState.styleMaster || []).map(s => s.style).filter(Boolean));
    stylesCountEl.textContent = uniqueStyles.size.toLocaleString();
  }

  if (colorsCountEl) {
    const uniqueColors = new Set((appState.styleMaster || []).map(s => s.color).filter(Boolean));
    colorsCountEl.textContent = uniqueColors.size.toLocaleString();
  }

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!appState.styleMaster || appState.styleMaster.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No master records found in MasterData.csv. Please reload or link your CSV file.</td></tr>`;
    return;
  }

  let filtered = appState.styleMaster || [];
  if (searchVal) {
    filtered = filtered.filter(m =>
      (m.style && m.style.toLowerCase().includes(searchVal)) ||
      (m.color && m.color.toLowerCase().includes(searchVal)) ||
      (m.schedule && m.schedule.toLowerCase().includes(searchVal)) ||
      (m.po && m.po.toLowerCase().includes(searchVal)) ||
      (m.layJobNo && m.layJobNo.toLowerCase().includes(searchVal)) ||
      (m.jobNo && m.jobNo.toLowerCase().includes(searchVal)) ||
      (m.pattern && m.pattern.toLowerCase().includes(searchVal)) ||
      (m.docketNo && m.docketNo.toLowerCase().includes(searchVal)) ||
      (m.docket && m.docket.toLowerCase().includes(searchVal))
    );
  }

  if (typeof universalSortArray === 'function' && typeof masterDataSortColumn !== 'undefined') {
    filtered = universalSortArray(filtered, masterDataSortColumn, masterDataSortDirection);
    updateSortIcons('master', masterDataSortColumn, masterDataSortDirection, ['style', 'color', 'schedule', 'layJobNo', 'docketNo']);
  }

  const displayList = filtered.slice(0, 50);

  if (displayList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No master records match "${searchVal}".</td></tr>`;
    return;
  }

  displayList.forEach((item, idx) => {
    const schedVal = item.schedule || item.po || '';
    const layJobVal = item.layJobNo || item.jobNo || item.pattern || 'N/A';
    const docketVal = item.docketNo || item.docket || '-';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800";
    tr.innerHTML = `
      <td class="p-2 text-slate-500 dark:text-slate-400 font-mono text-xs text-center">${idx + 1}</td>
      <td class="p-2 font-bold text-slate-900 dark:text-slate-100">${escapeHtml(item.style || '')}</td>
      <td class="p-2 text-slate-800 dark:text-slate-200">${escapeHtml(item.color || '')}</td>
      <td class="p-2 font-mono text-xs text-slate-700 dark:text-slate-300">${escapeHtml(schedVal)}</td>
      <td class="p-2 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">${escapeHtml(layJobVal)}</td>
      <td class="p-2 font-mono text-xs font-medium text-purple-600 dark:text-purple-400">${escapeHtml(docketVal)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (filtered.length > 50) {
    const trMore = document.createElement('tr');
    trMore.innerHTML = `
      <td colspan="6" class="p-2 text-center text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/40">
        Showing top 50 of ${filtered.length.toLocaleString()} matching records (Live stream - type in search box to narrow down).
      </td>
    `;
    tbody.appendChild(trMore);
  }
}

let masterDataSortColumn = 'style';
let masterDataSortDirection = 'asc';

function sortMasterDataTable(col) {
  if (masterDataSortColumn === col) {
    masterDataSortDirection = masterDataSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    masterDataSortColumn = col;
    masterDataSortDirection = 'asc';
  }
  renderMasterTable();
}

function renderMasterDataTable() {
  renderMasterTable();
}

function onMasterSearchInput() {
  renderMasterTable();
}
