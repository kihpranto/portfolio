/**
 * GarmentTag Batch Logs & Historical Tag Manager
 */

let logsCurrentPage = 1;
const LOGS_PER_PAGE = 25;

function populateLogFilters() {
  const styleSel = document.getElementById('log-filter-style');
  const colorSel = document.getElementById('log-filter-color');
  const schedSel = document.getElementById('log-filter-po');

  if (!styleSel) return;

  const currentStyle = styleSel.value;
  const currentColor = colorSel.value;
  const currentSched = schedSel.value;

  const styles = Array.from(new Set((appState.logs || []).map(l => l.style).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  styleSel.innerHTML = '<option value="">-- All Styles --</option>' + styles.map(s => `<option value="${s}" ${s === currentStyle ? 'selected' : ''}>${s}</option>`).join('');

  let colorList = appState.logs || [];
  if (currentStyle) colorList = colorList.filter(l => l.style === currentStyle);
  const colors = Array.from(new Set(colorList.map(l => l.color).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  colorSel.innerHTML = '<option value="">-- All Colors --</option>' + colors.map(c => `<option value="${c}" ${c === currentColor ? 'selected' : ''}>${c}</option>`).join('');

  let schedList = colorList;
  if (currentColor) schedList = schedList.filter(l => l.color === currentColor);
  const scheds = Array.from(new Set(schedList.map(l => l.schedule || l.po).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  schedSel.innerHTML = '<option value="">-- All Schedule Numbers --</option>' + scheds.map(p => `<option value="${p}" ${p === currentSched ? 'selected' : ''}>${p}</option>`).join('');

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('log-filter-style');
    refreshSearchableSelect('log-filter-color');
    refreshSearchableSelect('log-filter-po');
  }
}

function onLogSearchInput() {
  logsCurrentPage = 1;
  renderLogsTable();
}

function onLogStyleFilterChange() {
  const colorSel = document.getElementById('log-filter-color');
  const schedSel = document.getElementById('log-filter-po');
  if (colorSel) colorSel.value = '';
  if (schedSel) schedSel.value = '';
  logsCurrentPage = 1;
  renderLogsTable();
  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('log-filter-style');
    refreshSearchableSelect('log-filter-color');
    refreshSearchableSelect('log-filter-po');
  }
}

function onLogColorFilterChange() {
  const schedSel = document.getElementById('log-filter-po');
  if (schedSel) schedSel.value = '';
  logsCurrentPage = 1;
  renderLogsTable();
  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('log-filter-color');
    refreshSearchableSelect('log-filter-po');
  }
}

function onLogScheduleFilterChange() {
  logsCurrentPage = 1;
  renderLogsTable();
  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('log-filter-po');
  }
}
const onLogPoFilterChange = onLogScheduleFilterChange;

function setLogsPage(page) {
  logsCurrentPage = page;
  renderLogsTable();
}

function renderLogsTable() {
  const container = document.getElementById('logs-batch-container');
  const pagContainer = document.getElementById('logs-pagination-container');
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  if (!container) return;
  container.innerHTML = '';

  if (!isJSONConnected) {
    container.innerHTML = `
      <div class="p-8 text-center text-rose-600 dark:text-rose-400 border border-dashed border-rose-200 dark:border-rose-900/60 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
        <div class="w-10 h-10 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 text-lg font-bold">
          ✕
        </div>
        <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200">Database Disconnected</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Live connection to <code class="font-mono bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-1 py-0.5 rounded">garment_batches_data.jsonl</code> is required. Cached data is disabled.
        </p>
      </div>
    `;
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  populateLogFilters();

  const searchVal = (document.getElementById('log-search')?.value || '').toLowerCase();
  const styleVal = document.getElementById('log-filter-style')?.value || '';
  const colorVal = document.getElementById('log-filter-color')?.value || '';
  const schedVal = document.getElementById('log-filter-po')?.value || '';

  const groupsMap = {};
  const tagsByBatch = {};
  const allStored = appState.allStoredTags || [];
  for (let i = 0; i < allStored.length; i++) {
    const t = allStored[i];
    if (t.batchId) {
      if (!tagsByBatch[t.batchId]) tagsByBatch[t.batchId] = [];
      tagsByBatch[t.batchId].push(t);
    }
  }

  (appState.logs || []).forEach(log => {
    const bId = log.batchId || log.id || `BDL-${String(log.timestamp || '').replace(/[^0-9]/g, '')}`;
    const itemSched = log.schedule || log.po || '';
    const itemLayJob = log.layJobNo || log.jobNo || log.pattern || 'N/A';
    const itemDocket = log.docketNo || log.docket || '';
    if (!groupsMap[bId]) {
      groupsMap[bId] = {
        batchId: bId,
        id: log.id || bId,
        timestamp: log.timestamp || '',
        style: log.style || '',
        color: log.color || '',
        schedule: itemSched,
        po: itemSched,
        layJobNo: itemLayJob,
        jobNo: itemLayJob,
        pattern: itemLayJob,
        docketNo: itemDocket,
        docket: itemDocket,
        patternText: log.patternText || '',
        embellishmentStyle: log.embellishmentStyle || 'No',
        metaSizesSummary: log.sizesSummary || '',
        metaCutParts: log.cutParts || '',
        metaPlyRange: log.plyRange || '',
        metaSeqRange: log.seqRange || '',
        metaTagCount: log.tagCount || 0,
        metaTotalBundles: log.totalBundles || '',
        items: []
      };
    }
    if (Array.isArray(log.tags) && log.tags.length > 0) {
      groupsMap[bId].items.push(...log.tags);
    } else {
      const stored = tagsByBatch[bId] || tagsByBatch[log.id] || [];
      if (stored.length > 0) {
        groupsMap[bId].items.push(...stored);
      }
    }
  });

  // Synchronize embellishmentStyle and patternText for all groups from items & cut parts
  Object.values(groupsMap).forEach(group => {
    if (group.embellishmentStyle !== 'Yes') {
      const hasEmbTag = group.items.some(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes' || (t.part && t.part.toLowerCase().includes('emb')));
      const hasEmbCutPart = String(group.metaCutParts || '').toLowerCase().includes('emb');
      if (hasEmbTag || hasEmbCutPart) {
        group.embellishmentStyle = 'Yes';
      }
    }
    if (!group.patternText || group.patternText === 'N/A') {
      const pTag = group.items.find(t => t.patternText && t.patternText !== 'N/A');
      if (pTag) group.patternText = pTag.patternText;
    }
  });

  const allGroups = Object.values(groupsMap);

  if (allGroups.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-xs">No batch records found in live garment_batches_data.jsonl database.</div>';
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const filteredGroups = allGroups.filter(group => {
    if (styleVal && group.style !== styleVal) return false;
    if (colorVal && group.color !== colorVal) return false;
    if (schedVal && group.schedule !== schedVal && group.po !== schedVal) return false;

    if (searchVal) {
      const matchHeader = (
        (group.batchId && group.batchId.toLowerCase().includes(searchVal)) ||
        (group.style && group.style.toLowerCase().includes(searchVal)) ||
        (group.color && group.color.toLowerCase().includes(searchVal)) ||
        (group.schedule && group.schedule.toLowerCase().includes(searchVal)) ||
        (group.po && group.po.toLowerCase().includes(searchVal)) ||
        (group.layJobNo && group.layJobNo.toLowerCase().includes(searchVal)) ||
        (group.jobNo && group.jobNo.toLowerCase().includes(searchVal)) ||
        (group.pattern && group.pattern.toLowerCase().includes(searchVal)) ||
        (group.docketNo && group.docketNo.toLowerCase().includes(searchVal)) ||
        (group.docket && group.docket.toLowerCase().includes(searchVal))
      );
      if (matchHeader) return true;

      const matchItems = group.items.some(item =>
        (item.size && item.size.toLowerCase().includes(searchVal)) ||
        (item.part && item.part.toLowerCase().includes(searchVal)) ||
        (item.tagString && item.tagString.toLowerCase().includes(searchVal)) ||
        (item.plyRange && item.plyRange.toLowerCase().includes(searchVal)) ||
        (item.seqRange && item.seqRange.toLowerCase().includes(searchVal))
      );
      return matchItems;
    }
    return true;
  });

  if (filteredGroups.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-xs">No matching log entries found.</div>';
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const totalItems = filteredGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / LOGS_PER_PAGE));
  if (logsCurrentPage > totalPages) logsCurrentPage = totalPages;
  if (logsCurrentPage < 1) logsCurrentPage = 1;

  const pagedGroups = filteredGroups.slice((logsCurrentPage - 1) * LOGS_PER_PAGE, logsCurrentPage * LOGS_PER_PAGE);

  pagedGroups.forEach(group => {
    const totalTags = group.items.length || group.metaTagCount || 0;
    const uniqueBundleSeqs = Array.from(new Set(group.items.map(i => i.bundleSeq).filter(v => v !== undefined && v !== null)));
    let totalBundlesCount = uniqueBundleSeqs.length;
    if (!totalBundlesCount) {
      if (group.metaTotalBundles) {
        const m = String(group.metaTotalBundles).match(/(\d+)\s*Bundles/i);
        if (m) totalBundlesCount = parseInt(m[1], 10);
      }
    }
    if (!totalBundlesCount) totalBundlesCount = 1;

    let seqRangeStr = group.metaSeqRange || 'SEQ Range';
    if (uniqueBundleSeqs.length > 0) {
      let minSeq = Infinity;
      let maxSeq = -Infinity;
      uniqueBundleSeqs.forEach(s => {
        const num = Number(s);
        if (!isNaN(num)) {
          if (num < minSeq) minSeq = num;
          if (num > maxSeq) maxSeq = num;
        }
      });
      if (minSeq !== Infinity && maxSeq !== -Infinity) seqRangeStr = `SEQ ${minSeq}–${maxSeq}`;
    }

    const sizeCounts = {};
    group.items.forEach(i => {
      if (i.size) sizeCounts[i.size] = (sizeCounts[i.size] || 0) + 1;
    });
    let sizesSummary = Object.keys(sizeCounts).length > 0
      ? Object.entries(sizeCounts).map(([sz, cnt]) => `${sz}(${cnt})`).join(', ')
      : (group.metaSizesSummary || 'N/A');

    const partsSet = new Set(group.items.map(i => i.part).filter(Boolean));
    let cutPartsStr = Array.from(partsSet).join(', ') || group.metaCutParts || 'N/A';

    let plyRangeStr = group.metaPlyRange || 'N/A';
    if (group.items.length > 0) {
      let minPly = Infinity;
      let maxPly = -Infinity;
      group.items.forEach(i => {
        if (i.plyRange) {
          const match = String(i.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(i.plyRange).match(/(\d+)/);
          if (match) {
            const p1 = parseInt(match[1], 10);
            const p2 = parseInt(match[2] || match[1], 10);
            if (!isNaN(p1) && p1 < minPly) minPly = p1;
            if (!isNaN(p2) && p2 > maxPly) maxPly = p2;
          }
        } else {
          if (i.startPly && i.startPly < minPly) minPly = i.startPly;
          if (i.endPly && i.endPly > maxPly) maxPly = i.endPly;
        }
      });
      if (minPly !== Infinity && maxPly !== -Infinity) plyRangeStr = `${minPly}–${maxPly}`;
    }

    const card = document.createElement('div');
    const isSelected = selectedLogBatches.has(group.batchId);
    card.className = `border ${isSelected ? 'border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/20' : 'border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900'} rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-blue-400 dark:hover:border-blue-600 transition-all space-y-3.5`;
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <input type="checkbox" data-batch-id="${group.batchId}" ${isSelected ? 'checked' : ''} onchange="toggleSelectLogBatch('${group.batchId}', this.checked)" class="log-batch-checkbox w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0" title="Select for multi-batch printing">
          <div class="p-2.5 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 rounded-xl text-xs font-mono font-bold shrink-0">
            🏷️ ${group.batchId}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-slate-900 dark:text-slate-100 text-sm">${group.style}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">${group.color}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">SCH: ${group.schedule || group.po}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800">LAY JOB: ${group.layJobNo || group.jobNo || group.pattern || 'N/A'}</span>
              ${group.docketNo ? `<span class="text-slate-300 dark:text-slate-600">&bull;</span><span class="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-lg border border-purple-100 dark:border-purple-800">DOC: ${group.docketNo}</span>` : ''}
              <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">${seqRangeStr}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Generated at <span class="font-mono">${group.timestamp}</span> &bull; 
              <span class="font-semibold text-slate-700 dark:text-slate-300">${totalBundlesCount} Bundles (${totalTags} Tags)</span>
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button onclick="printLogBatch('${group.batchId}', false)" class="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shadow-blue-500/20 cursor-pointer" title="Print this batch tags only">
            🖨️ Print Batch (${totalTags})
          </button>
          <button onclick="appendLogBatchToPrint('${group.batchId}')" class="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all shadow-2xs cursor-pointer" title="Append this batch to the current print queue">
            ➕ Add to Queue
          </button>
          <button onclick="generateChartFromLogBatch('${group.batchId}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer">
            📊 Chart
          </button>
          <button onclick="archiveLogBatch('${group.batchId}')" title="Move Batch to Archive" class="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs font-bold" title="Move to Archive">
            📦
          </button>
          <button onclick="deleteLogBatch('${group.batchId}')" title="Delete Batch from Database" class="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            🗑️
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 font-medium">
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Sizes Included:</span>
          <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${sizesSummary}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Cut Parts Included:</span>
          <span class="text-slate-800 dark:text-slate-200 font-semibold truncate block">${cutPartsStr}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Ply Range:</span>
          <span class="font-mono font-bold text-blue-700 dark:text-blue-400">${plyRangeStr}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Pattern:</span>
          <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${group.patternText || 'N/A'}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Embellishment:</span>
          <span class="font-semibold ${group.embellishmentStyle === 'Yes' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${group.embellishmentStyle || 'No'}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  updateSelectedLogsUI();

  if (pagContainer) {
    if (totalPages <= 1) {
      pagContainer.innerHTML = `<div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Showing all ${totalItems} batches</div>`;
    } else {
      const startNum = (logsCurrentPage - 1) * LOGS_PER_PAGE + 1;
      const endNum = Math.min(logsCurrentPage * LOGS_PER_PAGE, totalItems);
      pagContainer.innerHTML = `
        <div>Showing <strong class="font-bold text-slate-900 dark:text-slate-100">${startNum}</strong> to <strong class="font-bold text-slate-900 dark:text-slate-100">${endNum}</strong> of <strong class="font-bold text-slate-900 dark:text-slate-100">${totalItems}</strong> batches</div>
        <div class="flex items-center gap-2">
          <button onclick="setLogsPage(${logsCurrentPage - 1})" ${logsCurrentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            Previous
          </button>
          <span class="font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-800 dark:text-slate-200">
            Page ${logsCurrentPage} of ${totalPages}
          </span>
          <button onclick="setLogsPage(${logsCurrentPage + 1})" ${logsCurrentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            Next
          </button>
        </div>
      `;
    }
  }
}

let selectedLogBatches = new Set();

function getExistingTagIdsInQueue() {
  const ids = new Set();
  (appState.generatedTags || []).forEach(t => { if (t && t.id) ids.add(String(t.id)); });
  (appState.printLogTags || []).forEach(t => { if (t && t.id) ids.add(String(t.id)); });
  return ids;
}

function getExistingBatchIdsInQueue() {
  const batches = new Set();
  (appState.generatedTags || []).forEach(t => { if (t && t.batchId) batches.add(String(t.batchId)); });
  (appState.printLogTags || []).forEach(t => { if (t && t.batchId) batches.add(String(t.batchId)); });
  return batches;
}

function updateSelectedLogsUI() {
  const count = selectedLogBatches.size;
  const badge = document.getElementById('logs-selected-count-badge');
  const printBtn = document.getElementById('btn-print-selected-logs');
  const appendBtn = document.getElementById('btn-append-selected-logs');
  const chartBtn = document.getElementById('btn-chart-selected-logs');
  const archiveBtn = document.getElementById('btn-archive-selected-logs');
  const printCount = document.getElementById('btn-print-selected-count');
  const chartCount = document.getElementById('btn-chart-selected-count');
  const archiveCount = document.getElementById('btn-archive-selected-count');
  const selectAllCb = document.getElementById('logs-select-all-checkbox');

  if (badge) badge.textContent = `${count} batch${count === 1 ? '' : 'es'} selected`;
  if (printCount) printCount.textContent = count;
  if (chartCount) chartCount.textContent = count;
  if (archiveCount) archiveCount.textContent = count;
  if (printBtn) printBtn.disabled = (count === 0);
  if (appendBtn) appendBtn.disabled = (count === 0);
  if (chartBtn) chartBtn.disabled = (count === 0);
  if (archiveBtn) archiveBtn.disabled = (count === 0);

  const checkboxes = document.querySelectorAll('.log-batch-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = selectedLogBatches.has(cb.dataset.batchId);
  });

  if (selectAllCb) {
    if (checkboxes.length === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else {
      const visibleChecked = Array.from(checkboxes).filter(cb => cb.checked).length;
      if (visibleChecked === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
      } else if (visibleChecked === checkboxes.length) {
        selectAllCb.checked = true;
        selectAllCb.indeterminate = false;
      } else {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = true;
      }
    }
  }
}

function toggleSelectLogBatch(bId, isChecked) {
  if (isChecked) {
    selectedLogBatches.add(bId);
  } else {
    selectedLogBatches.delete(bId);
  }
  updateSelectedLogsUI();
}

function toggleSelectAllLogs(isChecked) {
  const checkboxes = document.querySelectorAll('.log-batch-checkbox');
  checkboxes.forEach(cb => {
    const bId = cb.dataset.batchId;
    if (bId) {
      if (isChecked) selectedLogBatches.add(bId);
      else selectedLogBatches.delete(bId);
    }
  });
  updateSelectedLogsUI();
}

function clearSelectedLogs() {
  selectedLogBatches.clear();
  updateSelectedLogsUI();
}

async function getTagsForBatch(bId) {
  if (!bId) return [];

  let tagsToPrint = [];

  if (Array.isArray(appState.allStoredTags) && appState.allStoredTags.length > 0) {
    tagsToPrint = appState.allStoredTags.filter(t => t && (t.batchId === bId || t.batchId === `BDL-${bId}`));
  }

  if (tagsToPrint.length === 0) {
    (appState.logs || []).forEach(l => {
      const itemBatchId = l.batchId || l.id || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`;
      if (itemBatchId === bId && Array.isArray(l.tags) && l.tags.length > 0) {
        tagsToPrint.push(...l.tags);
      }
    });
  }

  if (tagsToPrint.length === 0) {
    try {
      const res = await fetch(getApiUrl('/api/tags?_t=' + Date.now()), { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j.success && Array.isArray(j.data)) {
          appState.allStoredTags = j.data;
          tagsToPrint = j.data.filter(t => t && (t.batchId === bId || t.batchId === `BDL-${bId}`));
        }
      }
    } catch(e) {}
  }

  if (tagsToPrint.length === 0) {
    const matchingLog = (appState.logs || []).find(l => (l.batchId || l.id) === bId);
    if (matchingLog) {
      const parts = matchingLog.cutParts ? matchingLog.cutParts.split(',').map(p => p.trim()).filter(Boolean) : (appState.parts || ['Body']);
      let startSeq = 1;
      let endSeq = 1;
      if (matchingLog.seqRange) {
        const m = String(matchingLog.seqRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(matchingLog.seqRange).match(/(\d+)/);
        if (m) {
          startSeq = parseInt(m[1], 10);
          endSeq = parseInt(m[2] || m[1], 10);
        }
      }
      let startPly = 1;
      let endPly = 1;
      if (matchingLog.plyRange) {
        const m = String(matchingLog.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(matchingLog.plyRange).match(/(\d+)/);
        if (m) {
          startPly = parseInt(m[1], 10);
          endPly = parseInt(m[2] || m[1], 10);
        }
      }
      const totalPlies = Math.max(1, endPly - startPly + 1);
      const totalBundles = Math.max(1, endSeq - startSeq + 1);
      const pliesPerBundle = Math.floor(totalPlies / totalBundles) || totalPlies;

      const sizeTokens = [];
      if (matchingLog.sizesSummary && matchingLog.sizesSummary !== 'N/A') {
        matchingLog.sizesSummary.split(',').forEach(part => {
          const m = part.trim().match(/^([^(]+)(?:\((\d+)\))?/);
          if (m) {
            const sz = m[1].trim();
            const count = parseInt(m[2] || '1', 10);
            for (let k = 0; k < count; k++) sizeTokens.push(sz);
          }
        });
      }

      let currPly = startPly;
      for (let seq = startSeq; seq <= endSeq; seq++) {
        const idx = seq - startSeq;
        const sz = sizeTokens[idx] || sizeTokens[0] || 'M';
        const ePly = (seq === endSeq) ? endPly : (currPly + pliesPerBundle - 1);
        const plyStr = `${currPly}–${ePly}`;

        parts.forEach(part => {
          const tagId = (typeof generate6CharId === 'function') ? generate6CharId() : Math.random().toString(36).substring(2, 8).toUpperCase();
          tagsToPrint.push({
            id: tagId,
            batchId: bId,
            style: matchingLog.style || 'N/A',
            color: matchingLog.color || 'N/A',
            schedule: matchingLog.schedule || matchingLog.po || '',
            po: matchingLog.schedule || matchingLog.po || '',
            layJobNo: matchingLog.layJobNo || matchingLog.jobNo || matchingLog.pattern || 'N/A',
            jobNo: matchingLog.layJobNo || matchingLog.jobNo || matchingLog.pattern || 'N/A',
            pattern: matchingLog.layJobNo || matchingLog.jobNo || matchingLog.pattern || 'N/A',
            docketNo: matchingLog.docketNo || matchingLog.docket || '',
            docket: matchingLog.docketNo || matchingLog.docket || '',
            size: sz,
            part: part,
            shade: 'A',
            bundleSeq: seq,
            ratioTotal: totalBundles,
            plyRange: plyStr,
            startPly: currPly,
            endPly: ePly,
            tagString: `${sz} ${seq} ${part} Shade A ${plyStr}`,
            qrData: tagId,
            timestamp: matchingLog.timestamp || new Date().toLocaleString()
          });
        });
        currPly = ePly + 1;
      }
    }
  }

  return tagsToPrint.map(t => {
    const copy = { ...t };
    delete copy.isDuplicate;
    return copy;
  });
}

async function printLogBatch(bId, append = false) {
  if (!bId) {
    showToast("Invalid Batch ID.", "error");
    return;
  }

  if (append) {
    await appendLogBatchToPrint(bId);
    return;
  }

  showToast("Loading batch tags...", "info");
  const tags = await getTagsForBatch(bId);

  if (tags.length === 0) {
    showToast(`No tags found for Batch ID: ${bId}`, "error");
    return;
  }

  appState.generatedTags = [];
  appState.printLogTags = [...tags];
  showToast(`Loaded ${tags.length} tags for Batch ${bId} into Print Preview!`, 'success');

  if (typeof renderPrintGrid === 'function') renderPrintGrid();
  if (typeof switchTab === 'function') switchTab('print');
}

async function appendLogBatchToPrint(bId) {
  if (!bId) return;
  const existingBatches = getExistingBatchIdsInQueue();
  if (existingBatches.has(String(bId)) || existingBatches.has(`BDL-${bId}`)) {
    showToast(`⚠️ Batch ${bId} is already in the print queue (no duplicates added).`, 'warning');
    return;
  }

  const tags = await getTagsForBatch(bId);
  const existingIds = getExistingTagIdsInQueue();
  const newTags = tags.filter(t => !existingIds.has(String(t.id)));

  if (newTags.length === 0) {
    showToast(`⚠️ All tags for Batch ${bId} are already in queue.`, 'warning');
    return;
  }

  appState.printLogTags = [...(appState.printLogTags || []), ...newTags];
  
  const total = (appState.generatedTags?.length || 0) + appState.printLogTags.length;
  const sidebarCount = document.getElementById('sidebar-print-count');
  if (sidebarCount) sidebarCount.textContent = total;
  const printCountEl = document.getElementById('print-count');
  if (printCountEl) printCountEl.textContent = total;

  showToast(`✅ Added ${newTags.length} tags from Batch ${bId} to Print Queue (Total in queue: ${total})`, 'success');
  if (typeof renderNumberingChartUI === 'function') renderNumberingChartUI();
}

async function printSelectedLogBatches(append = false) {
  if (selectedLogBatches.size === 0) {
    showToast("Please select at least one batch log.", "warning");
    return;
  }

  const batchList = Array.from(selectedLogBatches);

  if (append) {
    let totalAdded = 0;
    let addedBatches = 0;
    const existingIds = getExistingTagIdsInQueue();
    const existingBatches = getExistingBatchIdsInQueue();

    for (const bId of batchList) {
      if (existingBatches.has(String(bId)) || existingBatches.has(`BDL-${bId}`)) continue;
      const bTags = await getTagsForBatch(bId);
      const newTags = bTags.filter(t => !existingIds.has(String(t.id)));
      if (newTags.length > 0) {
        newTags.forEach(t => existingIds.add(String(t.id)));
        appState.printLogTags = [...(appState.printLogTags || []), ...newTags];
        totalAdded += newTags.length;
        addedBatches++;
      }
    }

    const total = (appState.generatedTags?.length || 0) + (appState.printLogTags?.length || 0);
    const sidebarCount = document.getElementById('sidebar-print-count');
    if (sidebarCount) sidebarCount.textContent = total;
    const printCountEl = document.getElementById('print-count');
    if (printCountEl) printCountEl.textContent = total;

    if (totalAdded === 0) {
      showToast("⚠️ All selected batches are already in the print queue.", "warning");
    } else {
      showToast(`✅ Added ${totalAdded} tags across ${addedBatches} batch(es) to Print Queue (Total: ${total})`, "success");
      if (typeof renderNumberingChartUI === 'function') renderNumberingChartUI();
    }
  } else {
    showToast(`Loading tags for ${batchList.length} selected batches...`, "info");
    let allTags = [];
    const addedTagIds = new Set();

    for (const bId of batchList) {
      const bTags = await getTagsForBatch(bId);
      bTags.forEach(t => {
        if (!addedTagIds.has(String(t.id))) {
          addedTagIds.add(String(t.id));
          allTags.push(t);
        }
      });
    }

    if (allTags.length === 0) {
      showToast("No tags found for selected batches.", "error");
      return;
    }

    appState.generatedTags = [];
    appState.printLogTags = allTags;

    if (typeof renderPrintGrid === 'function') renderPrintGrid();
    if (typeof switchTab === 'function') switchTab('print');
    showToast(`Loaded ${allTags.length} tags across ${batchList.length} batches into Print Preview!`, 'success');
  }
}

async function printSelectedCharts() {
  if (selectedLogBatches.size === 0) {
    showToast("Please select at least one batch log to print charts.", "warning");
    return;
  }

  const batchList = Array.from(selectedLogBatches);
  if (typeof generateMultipleChartsFromLogBatches === 'function') {
    generateMultipleChartsFromLogBatches(batchList);
  } else {
    showToast("Numbering chart generator loading...", "info");
  }
}

function deleteLogBatch(bId) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_batches_data.jsonl before deleting batch logs.", "error");
    return;
  }
  if (!confirm(`Are you sure you want to delete Batch "${bId}" from your database?`)) return;
  appState.logs = (appState.logs || []).filter(l => (l.batchId || l.id) !== bId);
  selectedLogBatches.delete(bId);
  saveLocalDatabase();
  renderLogsTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast(`Batch ${bId} deleted and updated in database.`, 'info');
}

/**
 * ARCHIVE MANAGEMENT ENGINE
 */
function archiveLogBatch(bId) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Live connection required to archive batches.", "error");
    return;
  }
  const matchingLog = (appState.logs || []).find(l => (l.batchId || l.id) === bId);
  if (!matchingLog) {
    showToast(`Batch ${bId} not found in active logs.`, "error");
    return;
  }
  if (!Array.isArray(appState.archivedLogs)) appState.archivedLogs = [];
  
  if (!appState.archivedLogs.some(l => (l.batchId || l.id) === bId)) {
    appState.archivedLogs.unshift({ ...matchingLog, isArchived: true, archivedAt: new Date().toISOString() });
  }
  
  appState.logs = (appState.logs || []).filter(l => (l.batchId || l.id) !== bId);
  selectedLogBatches.delete(bId);
  
  saveLocalDatabase();
  renderLogsTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast(`📦 Batch ${bId} moved to Archive!`, 'success');
}

function archiveSelectedBatches() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Live connection required.", "error");
    return;
  }
  if (selectedLogBatches.size === 0) {
    showToast("Please select at least one batch log to archive.", "warning");
    return;
  }
  const batchList = Array.from(selectedLogBatches);
  if (!Array.isArray(appState.archivedLogs)) appState.archivedLogs = [];

  let count = 0;
  batchList.forEach(bId => {
    const log = (appState.logs || []).find(l => (l.batchId || l.id) === bId);
    if (log) {
      if (!appState.archivedLogs.some(l => (l.batchId || l.id) === bId)) {
        appState.archivedLogs.unshift({ ...log, isArchived: true, archivedAt: new Date().toISOString() });
      }
      count++;
    }
  });

  const selectedSet = new Set(batchList);
  appState.logs = (appState.logs || []).filter(l => !selectedSet.has(l.batchId || l.id));
  selectedLogBatches.clear();

  saveLocalDatabase();
  renderLogsTable();
  if (typeof renderArchiveTable === 'function') renderArchiveTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast(`📦 Moved ${count} batch(es) to Archive!`, 'success');
}

function restoreArchivedBatch(bId) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Live connection required.", "error");
    return;
  }
  const matchingArchived = (appState.archivedLogs || []).find(l => (l.batchId || l.id) === bId);
  if (!matchingArchived) {
    showToast(`Archived batch ${bId} not found.`, "error");
    return;
  }
  if (!Array.isArray(appState.logs)) appState.logs = [];

  const restored = { ...matchingArchived };
  delete restored.isArchived;
  delete restored.archivedAt;

  if (!appState.logs.some(l => (l.batchId || l.id) === bId)) {
    appState.logs.unshift(restored);
  }

  appState.archivedLogs = (appState.archivedLogs || []).filter(l => (l.batchId || l.id) !== bId);

  saveLocalDatabase();
  renderArchiveTable();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast(`🔄 Batch ${bId} restored to active logs!`, 'success');
}

function deleteArchivedBatch(bId) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Live connection required.", "error");
    return;
  }
  if (!confirm(`Permanently delete Archived Batch "${bId}"? This cannot be undone.`)) return;
  appState.archivedLogs = (appState.archivedLogs || []).filter(l => (l.batchId || l.id) !== bId);
  saveLocalDatabase();
  renderArchiveTable();
  if (typeof renderLogsTable === 'function') renderLogsTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast(`Archived Batch ${bId} permanently deleted.`, 'info');
}

function clearAllArchive() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Live connection required.", "error");
    return;
  }
  if (!appState.archivedLogs || appState.archivedLogs.length === 0) {
    showToast("Archive is already empty.", "info");
    return;
  }
  if (!confirm(`Are you sure you want to permanently delete all ${appState.archivedLogs.length} archived batch(es)? This cannot be undone.`)) return;
  appState.archivedLogs = [];
  saveLocalDatabase();
  renderArchiveTable();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  showToast("All archived batches permanently cleared.", 'info');
}

let archiveCurrentPage = 1;
const ARCHIVE_PER_PAGE = 25;

function renderArchiveTable() {
  const container = document.getElementById('archive-batch-container');
  const pagContainer = document.getElementById('archive-pagination-container');
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  if (!container) return;
  container.innerHTML = '';

  const searchVal = (document.getElementById('archive-search')?.value || '').toLowerCase().trim();
  const archives = appState.archivedLogs || [];

  if (archives.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 text-xs">
        <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
        <p class="font-bold text-slate-600 dark:text-slate-400 text-sm">No Batches in Archive</p>
        <p class="text-slate-400 dark:text-slate-500 mt-1">Move completed batches from <strong>Bundle Batch Logs</strong> to keep your active list clean.</p>
      </div>
    `;
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const groupsMap = {};
  archives.forEach(log => {
    const bId = log.batchId || log.id || `BDL-${String(log.timestamp || '').replace(/[^0-9]/g, '')}`;
    const itemSched = log.schedule || log.po || '';
    const itemLayJob = log.layJobNo || log.jobNo || log.pattern || 'N/A';
    const itemDocket = log.docketNo || log.docket || '';
    if (!groupsMap[bId]) {
      groupsMap[bId] = {
        batchId: bId,
        id: log.id || bId,
        timestamp: log.timestamp || '',
        style: log.style || '',
        color: log.color || '',
        schedule: itemSched,
        po: itemSched,
        layJobNo: itemLayJob,
        jobNo: itemLayJob,
        pattern: itemLayJob,
        docketNo: itemDocket,
        docket: itemDocket,
        metaSizesSummary: log.sizesSummary || '',
        metaCutParts: log.cutParts || '',
        metaPlyRange: log.plyRange || '',
        metaSeqRange: log.seqRange || '',
        metaTagCount: log.tagCount || 0,
        metaTotalBundles: log.totalBundles || '',
        items: []
      };
    }
    if (Array.isArray(log.tags) && log.tags.length > 0) {
      groupsMap[bId].items.push(...log.tags);
    } else {
      const stored = (appState.allStoredTags || []).filter(t => (t.batchId === bId || t.batchId === log.id));
      if (stored.length > 0) {
        groupsMap[bId].items.push(...stored);
      }
    }
  });

  const allGroups = Object.values(groupsMap);

  const filtered = allGroups.filter(group => {
    if (!searchVal) return true;
    const matchHeader = (
      (group.batchId && group.batchId.toLowerCase().includes(searchVal)) ||
      (group.style && group.style.toLowerCase().includes(searchVal)) ||
      (group.color && group.color.toLowerCase().includes(searchVal)) ||
      (group.schedule && group.schedule.toLowerCase().includes(searchVal)) ||
      (group.po && group.po.toLowerCase().includes(searchVal)) ||
      (group.layJobNo && group.layJobNo.toLowerCase().includes(searchVal)) ||
      (group.jobNo && group.jobNo.toLowerCase().includes(searchVal)) ||
      (group.pattern && group.pattern.toLowerCase().includes(searchVal)) ||
      (group.docketNo && group.docketNo.toLowerCase().includes(searchVal)) ||
      (group.docket && group.docket.toLowerCase().includes(searchVal))
    );
    if (matchHeader) return true;
    return group.items.some(item =>
      (item.size && item.size.toLowerCase().includes(searchVal)) ||
      (item.part && item.part.toLowerCase().includes(searchVal)) ||
      (item.tagString && item.tagString.toLowerCase().includes(searchVal)) ||
      (item.plyRange && item.plyRange.toLowerCase().includes(searchVal)) ||
      (item.seqRange && item.seqRange.toLowerCase().includes(searchVal))
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-xs">No matching archived records found.</div>';
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ARCHIVE_PER_PAGE));
  if (archiveCurrentPage > totalPages) archiveCurrentPage = totalPages;
  if (archiveCurrentPage < 1) archiveCurrentPage = 1;

  const paged = filtered.slice((archiveCurrentPage - 1) * ARCHIVE_PER_PAGE, archiveCurrentPage * ARCHIVE_PER_PAGE);

  paged.forEach(group => {
    const bId = group.batchId || group.id;
    const totalTags = group.items.length || group.metaTagCount || 0;
    const uniqueBundleSeqs = Array.from(new Set(group.items.map(i => i.bundleSeq).filter(v => v !== undefined && v !== null)));
    let totalBundlesCount = uniqueBundleSeqs.length;
    if (!totalBundlesCount) {
      if (group.metaTotalBundles) {
        const m = String(group.metaTotalBundles).match(/(\d+)\s*Bundles/i);
        if (m) totalBundlesCount = parseInt(m[1], 10);
      }
    }
    if (!totalBundlesCount) totalBundlesCount = 1;

    let seqRangeStr = group.metaSeqRange || 'SEQ Range';
    if (uniqueBundleSeqs.length > 0) {
      let minSeq = Infinity;
      let maxSeq = -Infinity;
      uniqueBundleSeqs.forEach(s => {
        const num = Number(s);
        if (!isNaN(num)) {
          if (num < minSeq) minSeq = num;
          if (num > maxSeq) maxSeq = num;
        }
      });
      if (minSeq !== Infinity && maxSeq !== -Infinity) seqRangeStr = `SEQ ${minSeq}–${maxSeq}`;
    }

    const sizeCounts = {};
    group.items.forEach(i => {
      if (i.size) sizeCounts[i.size] = (sizeCounts[i.size] || 0) + 1;
    });
    let sizesSummary = Object.keys(sizeCounts).length > 0
      ? Object.entries(sizeCounts).map(([sz, cnt]) => `${sz}(${cnt})`).join(', ')
      : (group.metaSizesSummary || 'N/A');

    const partsSet = new Set(group.items.map(i => i.part).filter(Boolean));
    let cutPartsStr = Array.from(partsSet).join(', ') || group.metaCutParts || 'N/A';

    let plyRangeStr = group.metaPlyRange || 'N/A';
    if (group.items.length > 0) {
      let minPly = Infinity;
      let maxPly = -Infinity;
      group.items.forEach(i => {
        if (i.plyRange) {
          const match = String(i.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(i.plyRange).match(/(\d+)/);
          if (match) {
            const p1 = parseInt(match[1], 10);
            const p2 = parseInt(match[2] || match[1], 10);
            if (!isNaN(p1) && p1 < minPly) minPly = p1;
            if (!isNaN(p2) && p2 > maxPly) maxPly = p2;
          }
        } else {
          if (i.startPly && i.startPly < minPly) minPly = i.startPly;
          if (i.endPly && i.endPly > maxPly) maxPly = i.endPly;
        }
      });
      if (minPly !== Infinity && maxPly !== -Infinity) plyRangeStr = `${minPly}–${maxPly}`;
    }

    const card = document.createElement('div');
    card.className = "border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/20 dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 transition-all space-y-3.5";
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-amber-100 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 rounded-xl text-xs font-mono font-bold shrink-0">
            📦 ${bId}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-slate-900 dark:text-slate-100 text-sm">${group.style}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">${group.color}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">SCH: ${group.schedule || group.po}</span>
              <span class="text-slate-300 dark:text-slate-600">&bull;</span>
              <span class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800">LAY JOB: ${group.layJobNo || group.jobNo || group.pattern || 'N/A'}</span>
              ${group.docketNo ? `<span class="text-slate-300 dark:text-slate-600">&bull;</span><span class="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-lg border border-purple-100 dark:border-purple-800">DOC: ${group.docketNo}</span>` : ''}
              <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">${seqRangeStr}</span>
              <span class="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">ARCHIVED</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Generated at <span class="font-mono">${group.timestamp}</span> &bull; 
              <span class="font-semibold text-slate-700 dark:text-slate-300">${totalBundlesCount} Bundles (${totalTags} Tags)</span>
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button onclick="restoreArchivedBatch('${bId}')" class="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shadow-emerald-500/20 cursor-pointer" title="Restore back to active logs">
            🔄 Restore to Active
          </button>
          <button onclick="printLogBatch('${bId}', false)" class="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all shadow-2xs cursor-pointer" title="Print this batch tags">
            🖨️ Print
          </button>
          <button onclick="generateChartFromLogBatch('${bId}')" class="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all shadow-2xs cursor-pointer">
            📊 Chart
          </button>
          <button onclick="deleteArchivedBatch('${bId}')" title="Permanently Delete" class="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            🗑️
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/80 dark:bg-slate-800/50 p-3.5 rounded-xl border border-amber-100/80 dark:border-slate-800 font-medium">
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Sizes Included:</span>
          <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${sizesSummary}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Cut Parts Included:</span>
          <span class="text-slate-800 dark:text-slate-200 font-semibold truncate block">${cutPartsStr}</span>
        </div>
        <div>
          <span class="text-slate-400 font-semibold uppercase text-[10px] block">Ply Range:</span>
          <span class="font-mono font-bold text-blue-700 dark:text-blue-400">${plyRangeStr}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  if (pagContainer) {
    if (totalPages <= 1) {
      pagContainer.innerHTML = `<div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Showing all ${totalItems} archived batch(es)</div>`;
    } else {
      const startNum = (archiveCurrentPage - 1) * ARCHIVE_PER_PAGE + 1;
      const endNum = Math.min(archiveCurrentPage * ARCHIVE_PER_PAGE, totalItems);
      pagContainer.innerHTML = `
        <div>Showing <strong class="font-bold text-slate-900 dark:text-slate-100">${startNum}</strong> to <strong class="font-bold text-slate-900 dark:text-slate-100">${endNum}</strong> of <strong class="font-bold text-slate-900 dark:text-slate-100">${totalItems}</strong> archived batches</div>
        <div class="flex items-center gap-2">
          <button onclick="archiveCurrentPage--; renderArchiveTable();" ${archiveCurrentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            Previous
          </button>
          <span class="font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-800 dark:text-slate-200">
            Page ${archiveCurrentPage} of ${totalPages}
          </span>
          <button onclick="archiveCurrentPage++; renderArchiveTable();" ${archiveCurrentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            Next
          </button>
        </div>
      `;
    }
  }
}
