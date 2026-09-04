/**
 * GarmentTag Tag Generator & Sequential Calculations Engine
 */

function renderStyleDropdown() {
  const select = document.getElementById('gen-style');
  if (!select) return;
  const currentVal = select.value || (window.isDemoMode ? 'BWD011B6' : '');
  select.innerHTML = '<option value="">-- Select Style --</option>';
  const uniqueStyles = Array.from(new Set((appState.styleMaster || []).map(s => s.style).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  uniqueStyles.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    if (st === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
  if (currentVal && uniqueStyles.includes(currentVal)) {
    select.value = currentVal;
  }
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('gen-style');
}

function getMaxPreviousEndingPly(style, color, schedule) {
  if (!style || !color || !schedule) return 0;
  let maxPly = 0;
  const targetSched = String(schedule).toLowerCase();
  const allLogs = [...(appState.logs || []), ...(appState.archivedLogs || [])];
  
  allLogs.forEach(l => {
    const itemSched = String(l.schedule || l.po || '').toLowerCase();
    if (
      String(l.style || '').toLowerCase() === style.toLowerCase() &&
      String(l.color || '').toLowerCase() === color.toLowerCase() &&
      itemSched === targetSched
    ) {
      if (l.plyRange) {
        const match = String(l.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(l.plyRange).match(/(\d+)/);
        if (match) {
          const endVal = parseInt(match[2] || match[1], 10);
          if (!isNaN(endVal) && endVal > maxPly) maxPly = endVal;
        }
      }
      if (Array.isArray(l.tags)) {
        l.tags.forEach(t => {
          if (t.endPly && t.endPly > maxPly) maxPly = t.endPly;
          else if (t.plyRange) {
            const m = String(t.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(t.plyRange).match(/(\d+)/);
            if (m) {
              const val = parseInt(m[2] || m[1], 10);
              if (!isNaN(val) && val > maxPly) maxPly = val;
            }
          }
        });
      }
    }
  });

  (appState.allStoredTags || []).forEach(t => {
    const itemSched = String(t.schedule || t.po || '').toLowerCase();
    if (
      String(t.style || '').toLowerCase() === style.toLowerCase() &&
      String(t.color || '').toLowerCase() === color.toLowerCase() &&
      itemSched === targetSched
    ) {
      if (t.endPly && t.endPly > maxPly) maxPly = t.endPly;
      else if (t.plyRange) {
        const m = String(t.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(t.plyRange).match(/(\d+)/);
        if (m) {
          const val = parseInt(m[2] || m[1], 10);
          if (!isNaN(val) && val > maxPly) maxPly = val;
        }
      }
    }
  });

  return maxPly;
}

function getMaxPreviousBundleSeq(style, color, schedule) {
  if (!style || !color || !schedule) return 0;
  let maxSeq = 0;
  const targetSched = String(schedule).toLowerCase();
  const allLogs = [...(appState.logs || []), ...(appState.archivedLogs || [])];

  allLogs.forEach(l => {
    const itemSched = String(l.schedule || l.po || '').toLowerCase();
    if (
      String(l.style || '').toLowerCase() === style.toLowerCase() &&
      String(l.color || '').toLowerCase() === color.toLowerCase() &&
      itemSched === targetSched
    ) {
      let seq = 0;
      if (l.endSeq !== undefined && l.endSeq !== null) {
        seq = typeof l.endSeq === 'number' ? l.endSeq : parseInt(String(l.endSeq), 10);
      } else if (l.bundleSeq !== undefined && l.bundleSeq !== null) {
        seq = typeof l.bundleSeq === 'number' ? l.bundleSeq : parseInt(String(l.bundleSeq), 10);
      } else if (l.seqRange) {
        const match = String(l.seqRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(l.seqRange).match(/(\d+)/);
        if (match) seq = parseInt(match[2] || match[1], 10);
      }
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;

      if (Array.isArray(l.tags)) {
        l.tags.forEach(t => {
          if (t.bundleSeq !== undefined && t.bundleSeq !== null) {
            const num = Number(t.bundleSeq);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        });
      }
    }
  });

  (appState.allStoredTags || []).forEach(t => {
    const itemSched = String(t.schedule || t.po || '').toLowerCase();
    if (
      String(t.style || '').toLowerCase() === style.toLowerCase() &&
      String(t.color || '').toLowerCase() === color.toLowerCase() &&
      itemSched === targetSched
    ) {
      if (t.bundleSeq !== undefined && t.bundleSeq !== null) {
        const num = Number(t.bundleSeq);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  });

  return maxSeq;
}

function updatePlySequenceBadge() {
  const badge = document.getElementById('ply-sequence-badge');
  if (!badge) return;

  const style = document.getElementById('gen-style')?.value || '';
  const color = document.getElementById('gen-color')?.value || '';
  const schedule = document.getElementById('gen-po')?.value || '';
  const plyQty = parseInt(document.getElementById('gen-ply')?.value, 10) || 1;

  if (!style || !color || !schedule) {
    badge.className = "text-[11px] text-slate-400 dark:text-slate-500 italic";
    badge.innerHTML = "Select Style, Color & Schedule to calculate sequential Ply start";
    return;
  }

  const maxPreviousEnding = getMaxPreviousEndingPly(style, color, schedule);
  const maxPreviousBundleSeq = getMaxPreviousBundleSeq(style, color, schedule);

  badge.className = "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 px-3 py-1 rounded-md text-xs font-medium flex flex-wrap items-center gap-2";
  if (maxPreviousEnding > 0 || maxPreviousBundleSeq > 0) {
    badge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>Last SEQ: <strong class="font-mono text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">${maxPreviousBundleSeq}</strong> | Next SEQ: <strong class="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">${maxPreviousBundleSeq + 1}</strong></span>
      <span class="text-slate-300 dark:text-slate-700">|</span>
      <span>Last Ply: <strong class="font-mono text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">${maxPreviousEnding}</strong> | Next Ply: <strong class="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">${maxPreviousEnding + 1}</strong> <span class="text-[11px] text-slate-500 dark:text-slate-400">(${maxPreviousEnding + 1}–${maxPreviousEnding + plyQty})</span></span>
    `;
  } else {
    badge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>✨ <strong class="text-blue-800 dark:text-blue-300">New Combo</strong> — SEQ starts at <strong class="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">1</strong>, Ply range starts at <strong class="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">1</strong> <span class="text-[11px] text-slate-500 dark:text-slate-400">(1–${plyQty})</span></span>
    `;
  }
}

function onStyleChange() {
  const styleVal = document.getElementById('gen-style')?.value || '';
  const colorSelect = document.getElementById('gen-color');
  const schedSelect = document.getElementById('gen-po');
  const jobSelect = document.getElementById('gen-pattern');
  const docketSelect = document.getElementById('gen-docket');

  if (colorSelect) colorSelect.innerHTML = '<option value="">-- Select Color --</option>';
  if (schedSelect) {
    schedSelect.innerHTML = '<option value="">-- Select Schedule --</option>';
    schedSelect.disabled = true;
  }
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">-- Select Lay Job No --</option>';
    jobSelect.disabled = true;
  }
  if (docketSelect) {
    docketSelect.innerHTML = '<option value="">-- Select Docket No --</option>';
    docketSelect.disabled = true;
  }
  updatePlySequenceBadge();

  if (!styleVal) {
    if (colorSelect) colorSelect.disabled = true;
    if (typeof refreshSearchableSelect === 'function') {
      refreshSearchableSelect('gen-style');
      refreshSearchableSelect('gen-color');
      refreshSearchableSelect('gen-po');
      refreshSearchableSelect('gen-pattern');
      refreshSearchableSelect('gen-docket');
    }
    return;
  }

  const colors = (appState.styleMaster || [])
    .filter(m => String(m.style).toLowerCase() === styleVal.toLowerCase())
    .map(m => m.color)
    .filter(Boolean);
  const uniqueColors = Array.from(new Set(colors))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (colorSelect) {
    uniqueColors.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      colorSelect.appendChild(opt);
    });
    colorSelect.disabled = false;
    if (uniqueColors.length === 1) {
      colorSelect.value = uniqueColors[0];
      onColorChange();
    }
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('gen-style');
    refreshSearchableSelect('gen-color');
    refreshSearchableSelect('gen-po');
    refreshSearchableSelect('gen-pattern');
    refreshSearchableSelect('gen-docket');
  }
}

function onColorChange() {
  const styleVal = document.getElementById('gen-style')?.value || '';
  const colorVal = document.getElementById('gen-color')?.value || '';
  const schedSelect = document.getElementById('gen-po');
  const jobSelect = document.getElementById('gen-pattern');
  const docketSelect = document.getElementById('gen-docket');

  if (schedSelect) schedSelect.innerHTML = '<option value="">-- Select Schedule --</option>';
  if (jobSelect) {
    jobSelect.innerHTML = '<option value="">-- Select Lay Job No --</option>';
    jobSelect.disabled = true;
  }
  if (docketSelect) {
    docketSelect.innerHTML = '<option value="">-- Select Docket No --</option>';
    docketSelect.disabled = true;
  }
  updatePlySequenceBadge();

  if (!styleVal || !colorVal) {
    if (schedSelect) schedSelect.disabled = true;
    if (typeof refreshSearchableSelect === 'function') {
      refreshSearchableSelect('gen-color');
      refreshSearchableSelect('gen-po');
      refreshSearchableSelect('gen-pattern');
      refreshSearchableSelect('gen-docket');
    }
    return;
  }

  const scheds = (appState.styleMaster || [])
    .filter(m => String(m.style).toLowerCase() === styleVal.toLowerCase() && String(m.color).toLowerCase() === colorVal.toLowerCase())
    .map(m => m.schedule || m.po)
    .filter(Boolean);
  const uniqueScheds = Array.from(new Set(scheds))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (schedSelect) {
    uniqueScheds.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      schedSelect.appendChild(opt);
    });
    schedSelect.disabled = false;
    if (uniqueScheds.length === 1) {
      schedSelect.value = uniqueScheds[0];
      onScheduleChange();
    }
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('gen-color');
    refreshSearchableSelect('gen-po');
    refreshSearchableSelect('gen-pattern');
    refreshSearchableSelect('gen-docket');
  }
}

function onScheduleChange() {
  const styleVal = document.getElementById('gen-style')?.value || '';
  const colorVal = document.getElementById('gen-color')?.value || '';
  const schedVal = document.getElementById('gen-po')?.value || '';
  const jobSelect = document.getElementById('gen-pattern');
  const docketSelect = document.getElementById('gen-docket');

  if (jobSelect) jobSelect.innerHTML = '<option value="">-- Select Lay Job No --</option>';
  if (docketSelect) docketSelect.innerHTML = '<option value="">-- Select Docket No --</option>';
  updatePlySequenceBadge();

  if (!styleVal || !colorVal || !schedVal) {
    if (jobSelect) jobSelect.disabled = true;
    if (docketSelect) docketSelect.disabled = true;
    if (typeof refreshSearchableSelect === 'function') {
      refreshSearchableSelect('gen-po');
      refreshSearchableSelect('gen-pattern');
      refreshSearchableSelect('gen-docket');
    }
    return;
  }

  const matchingRecords = (appState.styleMaster || []).filter(m =>
    String(m.style).toLowerCase() === styleVal.toLowerCase() &&
    String(m.color).toLowerCase() === colorVal.toLowerCase() &&
    String(m.schedule || m.po).toLowerCase() === schedVal.toLowerCase()
  );

  const jobs = matchingRecords.map(m => m.layJobNo || m.jobNo || m.pattern).filter(Boolean);
  const uniqueJobs = Array.from(new Set(jobs))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const dockets = matchingRecords.map(m => m.docketNo || m.docket).filter(Boolean);
  const uniqueDockets = Array.from(new Set(dockets))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (jobSelect) {
    if (uniqueJobs.length > 0) {
      uniqueJobs.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j;
        opt.textContent = j;
        jobSelect.appendChild(opt);
      });
      jobSelect.disabled = false;
      jobSelect.value = uniqueJobs[0];
    } else {
      const defaultJob = `JOB-${schedVal.replace(/[^a-zA-Z0-9]/g, '')}`;
      const opt = document.createElement('option');
      opt.value = defaultJob;
      opt.textContent = defaultJob;
      jobSelect.appendChild(opt);
      jobSelect.disabled = false;
      jobSelect.value = defaultJob;
    }
  }

  if (docketSelect) {
    if (uniqueDockets.length > 0) {
      uniqueDockets.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        docketSelect.appendChild(opt);
      });
      docketSelect.disabled = false;
      docketSelect.value = uniqueDockets[0];
    } else {
      const defaultDoc = `DOC-${schedVal.replace(/[^a-zA-Z0-9]/g, '')}`;
      const opt = document.createElement('option');
      opt.value = defaultDoc;
      opt.textContent = defaultDoc;
      docketSelect.appendChild(opt);
      docketSelect.disabled = false;
      docketSelect.value = defaultDoc;
    }
  }

  if ((!appState.mappingRows || appState.mappingRows.length === 0) && appState.sizes.length > 0) {
    addMappingRow(appState.sizes[0] || 'M', 1);
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('gen-po');
    refreshSearchableSelect('gen-pattern');
    refreshSearchableSelect('gen-docket');
  }
}

function onJobNoChange() {
  updatePlySequenceBadge();
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('gen-pattern');
}

function onDocketChange() {
  if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('gen-docket');
}
const onPOChange = onScheduleChange;

function renderPartsTile() {
  const container = document.getElementById('parts-tile-container');
  const countEl = document.getElementById('selected-parts-count');
  if (!container) return;

  if (!appState.parts || appState.parts.length === 0) {
    appState.parts = ["Front Body", "Back Body", "Left Sleeve", "Right Sleeve", "Collar / Neckband", "Chest Pocket", "Cuff", "EMB Part"];
  }
  if (!appState.selectedParts) {
    appState.selectedParts = [...appState.parts];
  }

  container.innerHTML = '';
  if (countEl) countEl.textContent = `${appState.selectedParts.length} Selected`;

  appState.parts.forEach(p => {
    const isSelected = appState.selectedParts.includes(p);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.onclick = () => togglePartSelection(p);
    btn.className = `px-3 py-1.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${isSelected
      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-600 text-white shadow-xs shadow-blue-500/25'
      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700/90 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs'
      }`;
    btn.innerHTML = `<span class="${isSelected ? 'text-white' : 'text-blue-500 dark:text-blue-400'} text-xs font-black">${isSelected ? '✓' : '+'}</span> <span>${p}</span>`;
    container.appendChild(btn);
  });

  updateMappingSummaryText();
}

function togglePartSelection(partName) {
  if (appState.selectedParts.includes(partName)) {
    appState.selectedParts = appState.selectedParts.filter(p => p !== partName);
  } else {
    appState.selectedParts.push(partName);
  }
  const embSelect = document.getElementById('gen-embellishment');
  if (embSelect && appState.selectedParts.some(p => p.toLowerCase().includes('emb'))) {
    embSelect.value = 'Yes';
  }
  renderPartsTile();
}

function selectAllParts() {
  appState.selectedParts = [...appState.parts];
  const embSelect = document.getElementById('gen-embellishment');
  if (embSelect && appState.selectedParts.some(p => p.toLowerCase().includes('emb'))) {
    embSelect.value = 'Yes';
  }
  renderPartsTile();
}

function deselectAllParts() {
  appState.selectedParts = [];
  renderPartsTile();
}

function toggleRowShadePanel(rowId) {
  if (!appState.expandedShadeRowIds) appState.expandedShadeRowIds = {};
  appState.expandedShadeRowIds[rowId] = !appState.expandedShadeRowIds[rowId];
  renderMappingRows();
}

function copyRowShadesToAll(sourceRowId) {
  const sourceRow = appState.mappingRows.find(r => r.id === sourceRowId);
  if (!sourceRow || !sourceRow.shades || !sourceRow.shades.length) return;
  appState.mappingRows.forEach(row => {
    row.shades = sourceRow.shades.map((s, idx) => ({
      id: 'sh-' + row.id + '-' + idx + '-' + Math.random().toString(36).substring(2, 5),
      shade: s.shade,
      plyCount: s.plyCount
    }));
  });
  renderMappingRows();
  showToast(`Copied shades from Size ${sourceRow.size || 'selected'} to all size rows!`, 'success');
}

function addMappingRow(defaultSize = '', defaultRatio = 1) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_batches_data.jsonl before adding size mapping rows.", "error");
    return;
  }
  const rowId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  if (!appState.expandedShadeRowIds) appState.expandedShadeRowIds = {};
  appState.expandedShadeRowIds[rowId] = true;

  const defaultShades = [{ id: 'sh-1', shade: 'A', plyCount: '' }];

  appState.mappingRows.push({
    id: rowId,
    size: defaultSize || '',
    ratio: defaultRatio,
    shades: defaultShades
  });
  renderMappingRows();
}

function renderMappingRows() {
  const tbody = document.getElementById('mapping-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  const usedSizes = appState.mappingRows.map(r => r.size).filter(Boolean);
  const plyInputVal = document.getElementById('gen-ply')?.value;
  const currentPlyQty = (plyInputVal !== undefined && plyInputVal !== null && plyInputVal.trim() !== '') ? parseInt(plyInputVal, 10) : 0;
  const hasLayPly = !isNaN(currentPlyQty) && currentPlyQty > 0;
  const style = document.getElementById('gen-style')?.value || '';
  const color = document.getElementById('gen-color')?.value || '';
  const schedule = document.getElementById('gen-po')?.value || '';
  const maxPreviousEndingPly = getMaxPreviousEndingPly(style, color, schedule);

  appState.mappingRows.forEach((row, idx) => {
    if (!row.shades || !row.shades.length) {
      row.shades = [{ id: 'sh-1', shade: 'A', plyCount: '' }];
    }

    const totalRowShadePlies = row.shades.reduce((sum, s) => sum + (parseInt(s.plyCount, 10) || 0), 0);
    const isExpanded = !!(appState.expandedShadeRowIds && appState.expandedShadeRowIds[row.id]);

    let pliesPillText = '';
    let pliesPillClass = '';
    if (!hasLayPly) {
      pliesPillText = totalRowShadePlies > 0 ? `${totalRowShadePlies} Plies` : '0 Plies';
      pliesPillClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    } else if (totalRowShadePlies === currentPlyQty) {
      pliesPillText = `${totalRowShadePlies}/${currentPlyQty} Plies ✓`;
      pliesPillClass = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (totalRowShadePlies > currentPlyQty) {
      pliesPillText = `${totalRowShadePlies}/${currentPlyQty} Plies 🛑 (Over)`;
      pliesPillClass = 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else {
      pliesPillText = `${totalRowShadePlies}/${currentPlyQty} Plies ⚠️ (Short)`;
      pliesPillClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }

    let subTrHeaderBadgeText = '';
    let subTrHeaderBadgeClass = '';
    if (!hasLayPly) {
      subTrHeaderBadgeText = totalRowShadePlies > 0 ? `${totalRowShadePlies} Total Plies` : '0 Total Plies';
      subTrHeaderBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    } else if (totalRowShadePlies === currentPlyQty) {
      subTrHeaderBadgeText = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      subTrHeaderBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (totalRowShadePlies > currentPlyQty) {
      subTrHeaderBadgeText = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      subTrHeaderBadgeClass = 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else {
      subTrHeaderBadgeText = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      subTrHeaderBadgeClass = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-blue-50/20 dark:bg-blue-900/20' : ''}`;
    tr.innerHTML = `
      <td class="py-1.5 px-2 font-mono text-center font-bold text-slate-400 align-middle">
        ${idx + 1}
      </td>

      <td class="py-1.5 px-2 align-middle">
        <select onchange="updateRow('${row.id}', 'size', this.value)" class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-2 py-1 font-bold outline-none text-xs shadow-2xs">
          <option value="">-- Select Size --</option>
          ${appState.sizes.map(s => {
      const isUsed = usedSizes.includes(s) && row.size !== s;
      return `<option value="${s}" ${s === row.size ? 'selected' : ''} ${isUsed ? 'disabled' : ''}>Size ${s}${isUsed ? ' (added)' : ''}</option>`;
    }).join('')}
        </select>
      </td>

      <td class="py-1.5 px-2 align-middle">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button type="button" onclick="stepRowRatio('${row.id}', -1)" class="ratio-stepper-btn" title="Decrease copies">-</button>
          <input type="number" min="1" max="99" value="${row.ratio}" onchange="updateRow('${row.id}', 'ratio', this.value)" class="w-12 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-1.5 py-0.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-center outline-none text-xs shadow-2xs">
          <button type="button" onclick="stepRowRatio('${row.id}', 1)" class="ratio-stepper-btn" title="Increase copies">+</button>
          <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1">Copy(s)</span>
          ${(row.size && row.ratio > 1) ? `<span class="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 ml-1">(${row.size}-1...${row.size}-${row.ratio})</span>` : ''}
        </div>
      </td>

      <td class="py-1.5 px-2 align-middle">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" onclick="toggleRowShadePanel('${row.id}')" class="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/90 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
            <span>🎨 Size ${row.size || 'N/A'} Shades (${row.shades.length})</span>
            <span class="text-[10px]">${isExpanded ? '▲' : '▼'}</span>
          </button>

          <div class="flex flex-wrap items-center gap-1" id="shades-pill-preview-${row.id}">
            ${row.shades.slice(0, 3).map(sh => `
              <span class="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 font-mono text-[10px] text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-lg shadow-2xs">
                ${escapeHtml(sh.shade || '')}${sh.plyCount ? `:${sh.plyCount}p` : ''}
              </span>
            `).join('')}
            ${row.shades.length > 3 ? `<span class="text-[10px] text-slate-400 font-bold">+${row.shades.length - 3} more</span>` : ''}
          </div>

          <span id="shades-status-pill-${row.id}" class="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${pliesPillClass}">
            ${pliesPillText}
          </span>
        </div>
      </td>

      <td class="py-1.5 px-2 text-center align-middle">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="duplicateRow('${row.id}')" title="Duplicate Row" class="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            📋
          </button>
          <button onclick="removeRow('${row.id}')" title="Remove Row" class="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            🗑️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    if (isExpanded) {
      const subTr = document.createElement('tr');
      subTr.className = "bg-blue-50/30 dark:bg-slate-900/40 border-b border-blue-100 dark:border-slate-800";
      subTr.innerHTML = `
        <td colspan="5" class="p-2 sm:p-2.5">
          <div class="bg-white dark:bg-slate-900 rounded-xl p-2.5 sm:p-3 border border-blue-200/90 dark:border-slate-800 shadow-2xs space-y-2">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  SHADE BREAKDOWN FOR SIZE <span class="text-blue-700 dark:text-blue-400 font-mono font-black">${row.size || 'N/A'}</span>
                </h4>
                <span id="shade-header-badge-${row.id}" class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${subTrHeaderBadgeClass}">
                  ${subTrHeaderBadgeText}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button type="button" onclick="copyRowShadesToAll('${row.id}')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs" title="Copy this shade setup to all other size rows">
                  📋 Copy Shades to All Sizes
                </button>
                <button type="button" onclick="addRowShade('${row.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs">
                  + Add Shade
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              ${row.shades.map((sh, sIdx) => {
          const plyVal = parseInt(sh.plyCount, 10);
          const hasPly = !isNaN(plyVal) && plyVal > 0;
          const previousShadesSum = row.shades.slice(0, sIdx).reduce((acc, item) => acc + (parseInt(item.plyCount, 10) || 0), 0);
          const startPly = maxPreviousEndingPly + 1 + previousShadesSum;
          const rawEndPly = startPly + (hasPly ? plyVal : 0) - 1;
          const endPly = hasPly ? (hasLayPly ? Math.min(rawEndPly, maxPreviousEndingPly + currentPlyQty) : rawEndPly) : startPly;
          const rangeDisplay = hasPly ? `${startPly}–${endPly}` : '—';

          return `
                  <div class="bg-slate-50/90 dark:bg-slate-950 p-2 sm:p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-1.5 shadow-2xs">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 flex-1">
                        <span class="text-[10px] font-bold text-slate-400 font-mono">#${sIdx + 1}</span>
                        <input type="text" value="${escapeHtml(sh.shade || '')}" oninput="updateRowShade('${row.id}', '${sh.id}', 'shade', this.value)" placeholder="Shade A" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      </div>
                      ${row.shades.length > 1 ? `
                        <button type="button" onclick="removeRowShade('${row.id}', '${sh.id}')" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold px-1 py-0.5 rounded cursor-pointer" title="Remove Shade">✕</button>
                      ` : ''}
                    </div>

                    <div class="flex items-center gap-2">
                      <div class="flex-1">
                        <label class="block text-[9px] text-slate-500 dark:text-slate-400 font-medium">Ply Qty</label>
                        <input type="number" min="1" ${hasLayPly ? `max="${currentPlyQty}"` : ''} value="${sh.plyCount !== undefined && sh.plyCount !== null ? sh.plyCount : ''}" placeholder="Qty" oninput="updateRowShade('${row.id}', '${sh.id}', 'plyCount', this.value)" onblur="onRowShadePlyBlur('${row.id}', '${sh.id}', this.value)" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      </div>
                      <div class="shrink-0 text-right">
                        <span class="block text-[9px] text-slate-400">Copy 1 Range</span>
                        <span id="shade-range-${row.id}-${sh.id}" class="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          ${rangeDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                `;
        }).join('')}
            </div>

            <div id="shade-warning-container-${row.id}">
              ${hasLayPly && totalRowShadePlies > currentPlyQty ? `
                <p class="text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
                  <span>🛑</span> The total shade plies (${totalRowShadePlies}) exceed Total Ply Lay Qty (${currentPlyQty}). Tag ranges will automatically cap at ply ${currentPlyQty}.
                </p>
              ` : ''}
              ${hasLayPly && totalRowShadePlies < currentPlyQty ? `
                <p class="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                  <span>💡</span> ${currentPlyQty - totalRowShadePlies} plies remaining unassigned. Click "<button type="button" onclick="syncRowShades('${row.id}')" class="underline font-bold cursor-pointer">⚡ Auto-Sync to Total Ply Qty</button>" to balance automatically.
                </p>
              ` : ''}
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(subTr);
    }
  });

  updateMappingSummaryText();
}

function addRowShade(rowId) {
  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row) return;
  if (!row.shades) row.shades = [];
  const nextChar = String.fromCharCode(65 + row.shades.length);

  row.shades.push({ id: 'sh-' + Date.now(), shade: nextChar, plyCount: '' });
  renderMappingRows();
}

function removeRowShade(rowId, shadeId) {
  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row || !row.shades || row.shades.length <= 1) return;
  row.shades = row.shades.filter(s => s.id !== shadeId);
  renderMappingRows();
}

function updateRowShade(rowId, shadeId, field, value) {
  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row || !row.shades) return;
  const sh = row.shades.find(s => s.id === shadeId);
  if (sh) {
    if (field === 'plyCount') {
      sh.plyCount = value;
    } else {
      sh.shade = value;
    }
    updateShadeBadgesInPlace(rowId);
    updateMappingSummaryText();
  }
}

function onRowShadePlyBlur(rowId, shadeId, value) {
  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row || !row.shades) return;
  const sh = row.shades.find(s => s.id === shadeId);
  if (sh && value !== '') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      sh.plyCount = parsed;
    }
    updateShadeBadgesInPlace(rowId);
    updateMappingSummaryText();
  }
}

function updateShadeBadgesInPlace(rowId) {
  const plyInputVal = document.getElementById('gen-ply')?.value;
  const hasLayPly = plyInputVal !== undefined && plyInputVal !== null && plyInputVal.trim() !== '';
  const currentPlyQty = hasLayPly ? (parseInt(plyInputVal, 10) || 0) : 0;

  // Find maxPreviousEndingPly for the entire table sequence
  let maxPreviousEndingPly = 0;
  for (const r of (appState.mappingRows || [])) {
    if (r.id === rowId) break;
    const rRatio = parseInt(r.ratio, 10) || 1;
    const rShades = r.shades || [];
    for (let c = 1; c <= rRatio; c++) {
      for (const s of rShades) {
        const pCount = parseInt(s.plyCount, 10);
        if (!isNaN(pCount) && pCount > 0) {
          maxPreviousEndingPly += pCount;
        }
      }
    }
  }

  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row) return;

  let totalRowShadePlies = 0;
  let runningShadePlies = 0;

  (row.shades || []).forEach((sh, sIdx) => {
    const plyVal = parseInt(sh.plyCount, 10);
    const hasPly = !isNaN(plyVal) && plyVal > 0;
    if (hasPly) totalRowShadePlies += plyVal;

    const startPly = maxPreviousEndingPly + 1 + runningShadePlies;
    const rawEndPly = startPly + (hasPly ? plyVal : 0) - 1;
    const endPly = hasPly ? (hasLayPly ? Math.min(rawEndPly, maxPreviousEndingPly + currentPlyQty) : rawEndPly) : startPly;
    const rangeDisplay = hasPly ? `${startPly}–${endPly}` : '—';

    if (hasPly) runningShadePlies += plyVal;

    const rangeEl = document.getElementById(`shade-range-${row.id}-${sh.id}`);
    if (rangeEl) rangeEl.textContent = rangeDisplay;
  });

  // Update header badge
  const headerBadge = document.getElementById(`shade-header-badge-${row.id}`);
  if (headerBadge) {
    if (!hasLayPly) {
      headerBadge.textContent = `${totalRowShadePlies} Plies Total`;
      headerBadge.className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    } else if (totalRowShadePlies === currentPlyQty) {
      headerBadge.textContent = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      headerBadge.className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (totalRowShadePlies > currentPlyQty) {
      headerBadge.textContent = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      headerBadge.className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else {
      headerBadge.textContent = `${totalRowShadePlies}/${currentPlyQty} Total Plies`;
      headerBadge.className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  }

  // Update row pill preview
  const pillPreview = document.getElementById(`shades-pill-preview-${row.id}`);
  if (pillPreview) {
    let html = (row.shades || []).slice(0, 3).map(sh => `
      <span class="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 font-mono text-[10px] text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-lg shadow-2xs">
        ${escapeHtml(sh.shade || '')}${sh.plyCount ? `:${sh.plyCount}p` : ''}
      </span>
    `).join('');
    if ((row.shades || []).length > 3) {
      html += `<span class="text-[10px] text-slate-400 font-bold">+${row.shades.length - 3} more</span>`;
    }
    pillPreview.innerHTML = html;
  }

  // Update status pill badge on main row
  const rowPill = document.getElementById(`shades-status-pill-${row.id}`);
  if (rowPill) {
    if (!hasLayPly) {
      rowPill.textContent = `${totalRowShadePlies} Plies`;
      rowPill.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    } else if (totalRowShadePlies === currentPlyQty) {
      rowPill.textContent = `${totalRowShadePlies}/${currentPlyQty} Plies ✓`;
      rowPill.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (totalRowShadePlies > currentPlyQty) {
      rowPill.textContent = `${totalRowShadePlies}/${currentPlyQty} Plies ⚠️`;
      rowPill.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else {
      rowPill.textContent = `${totalRowShadePlies}/${currentPlyQty} Plies`;
      rowPill.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  }

  // Update warning container
  const warnContainer = document.getElementById(`shade-warning-container-${row.id}`);
  if (warnContainer) {
    if (hasLayPly && totalRowShadePlies > currentPlyQty) {
      warnContainer.innerHTML = `
        <p class="text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
          <span>🛑</span> The total shade plies (${totalRowShadePlies}) exceed Total Ply Lay Qty (${currentPlyQty}). Tag ranges will automatically cap at ply ${currentPlyQty}.
        </p>
      `;
    } else if (hasLayPly && totalRowShadePlies < currentPlyQty) {
      warnContainer.innerHTML = `
        <p class="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
          <span>💡</span> ${currentPlyQty - totalRowShadePlies} plies remaining unassigned. Click "<button type="button" onclick="syncRowShades('${row.id}')" class="underline font-bold cursor-pointer">⚡ Auto-Sync to Total Ply Qty</button>" to balance automatically.
        </p>
      `;
    } else {
      warnContainer.innerHTML = '';
    }
  }
}

function syncRowShades(rowId) {
  const row = appState.mappingRows.find(r => r.id === rowId);
  if (!row || !row.shades || !row.shades.length) return;
  const plyInputVal = document.getElementById('gen-ply')?.value;
  const currentPlyQty = (plyInputVal !== undefined && plyInputVal !== null && plyInputVal.trim() !== '') ? parseInt(plyInputVal, 10) : 0;
  if (isNaN(currentPlyQty) || currentPlyQty <= 0) {
    showToast("Please enter Total Lay Plies in Step 1 first.", "info");
    return;
  }
  const previousSum = row.shades.slice(0, -1).reduce((sum, s) => sum + (parseInt(s.plyCount, 10) || 0), 0);
  row.shades[row.shades.length - 1].plyCount = Math.max(1, currentPlyQty - previousSum);
  renderMappingRows();
}

function updateRow(id, field, val) {
  const row = appState.mappingRows.find(r => r.id === id);
  if (row) {
    row[field] = field === 'ratio' ? Math.max(1, parseInt(val, 10) || 1) : val;
    renderMappingRows();
  }
}

function stepRowRatio(id, delta) {
  const row = appState.mappingRows.find(r => r.id === id);
  if (!row) return;
  let cur = parseInt(row.ratio, 10) || 1;
  cur = Math.max(1, Math.min(99, cur + delta));
  row.ratio = cur;
  renderMappingRows();
}

function duplicateRow(id) {
  const row = appState.mappingRows.find(r => r.id === id);
  if (row) addMappingRow(row.size, row.ratio);
}

function removeRow(id) {
  appState.mappingRows = appState.mappingRows.filter(r => r.id !== id);
  renderMappingRows();
}

function updateMappingSummaryText() {
  const textEl = document.getElementById('mapping-summary-text');
  if (!textEl) return;

  const numParts = (appState.selectedParts || []).length;
  const validRows = (appState.mappingRows || []).filter(r => r.size && r.ratio > 0);

  let totalEntities = 0;
  validRows.forEach(r => {
    const ratio = parseInt(r.ratio, 10) || 1;
    const shadesCount = (r.shades && r.shades.length) ? r.shades.length : 1;
    totalEntities += ratio * shadesCount;
  });
  const totalTags = totalEntities * numParts;

  if (numParts === 0) {
    textEl.innerHTML = `<span class="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5"><span>⚠️</span> No Cut Parts selected. Please select at least one Cut Part in 2A.</span>`;
  } else if (validRows.length === 0) {
    textEl.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5"><span>⚠️</span> Please configure at least one garment size row above.</span>`;
  } else {
    textEl.innerHTML = `
      <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
        <span class="text-slate-600 dark:text-slate-300 font-medium">Entities: <strong class="text-blue-600 dark:text-blue-400 font-mono font-bold">${totalEntities}</strong></span>
        <span class="text-slate-300 dark:text-slate-700">•</span>
        <span class="text-slate-600 dark:text-slate-300 font-medium">Parts: <strong class="text-indigo-600 dark:text-indigo-400 font-mono font-bold">${numParts}</strong></span>
        <span class="text-slate-300 dark:text-slate-700">•</span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 font-mono font-extrabold text-xs">
          🏷️ ${totalTags} Total Tags to Generate
        </span>
      </div>
    `;
  }
}

function generateTags() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_batches_data.jsonl or start the local server before generating tags.", 'error');
    return;
  }
  const style = document.getElementById('gen-style')?.value || '';
  const color = document.getElementById('gen-color')?.value || '';
  const schedule = document.getElementById('gen-po')?.value || '';
  const layJobNo = (document.getElementById('gen-pattern')?.value || '').trim();
  const docketNo = (document.getElementById('gen-docket')?.value || '').trim();
  const plyQty = parseInt(document.getElementById('gen-ply')?.value, 10);
  const patternText = (document.getElementById('gen-pattern-text')?.value || '').trim();
  let embellishmentStyle = document.getElementById('gen-embellishment')?.value || 'No';
  if (embellishmentStyle !== 'Yes' && (appState.selectedParts || []).some(p => p.toLowerCase().includes('emb'))) {
    embellishmentStyle = 'Yes';
    const embSelect = document.getElementById('gen-embellishment');
    if (embSelect) embSelect.value = 'Yes';
  }

  if (!style || !color || !schedule) {
    showToast("Please select Style, Color, and Schedule Number in Step 1.", 'error');
    return;
  }

  if (!layJobNo) {
    showToast("Lay Job No is required in Step 1.", 'error');
    return;
  }

  if (!plyQty || plyQty <= 0 || isNaN(plyQty)) {
    showToast("Ply / Lay Qty must be greater than 0.", 'error');
    return;
  }

  if (!appState.selectedParts || appState.selectedParts.length === 0) {
    showToast("⚠️ Cut Parts Required: Please select at least 1 Cut Part in '2A Cut Parts Selection Matrix' before generating tags.", 'error');
    return;
  }

  if (!appState.mappingRows || appState.mappingRows.length === 0) {
    addMappingRow(appState.sizes[0] || 'M', 1);
    showToast("Added size breakdown row. Please verify size, cut ratio, and shades.", 'info');
    return;
  }

  let totalEntities = 0;
  for (const r of appState.mappingRows) {
    const ratio = parseInt(r.ratio, 10) || 1;
    const shadesCount = (r.shades && r.shades.length) ? r.shades.length : 1;
    totalEntities += ratio * shadesCount;
  }

  for (const r of appState.mappingRows) {
    if (!r.size || !r.size.trim()) {
      showToast("Size selection is required for all configured size rows.", 'error');
      return;
    }

    const ratio = parseInt(r.ratio, 10);
    if (isNaN(ratio) || ratio <= 0) {
      showToast(`Cut Ratio (Copies) must be greater than 0 for Size ${r.size}.`, 'error');
      return;
    }

    if (!r.shades || r.shades.length === 0) {
      showToast(`Minimum one shade is required for Size ${r.size}.`, 'error');
      return;
    }

    let rowShadeSum = 0;
    for (const s of r.shades) {
      if (!s.shade || !String(s.shade).trim()) {
        showToast(`Shade Name is required for all shades in Size ${r.size}.`, 'error');
        return;
      }
      const p = parseInt(s.plyCount, 10);
      if (isNaN(p) || p <= 0) {
        showToast(`Shade ply count must be greater than 0 for Shade ${s.shade} in Size ${r.size}.`, 'error');
        return;
      }
      rowShadeSum += p;
    }

    if (rowShadeSum !== plyQty) {
      if (rowShadeSum < plyQty) {
        showToast(`Cannot generate tags: Size ${r.size} shades sum (${rowShadeSum}) is SHORT. Must equal Ply / Lay Qty (${plyQty}).`, 'error');
      } else {
        showToast(`Cannot generate tags: Size ${r.size} shades sum (${rowShadeSum}) is OVER. Must equal Ply / Lay Qty (${plyQty}).`, 'error');
      }
      return;
    }
  }

  const seenSizes = new Set();
  for (const r of appState.mappingRows) {
    if (seenSizes.has(r.size)) {
      showToast(`Duplicate size (${r.size}) found. Please adjust the ratio copy count on a single row.`, 'error');
      return;
    }
    seenSizes.add(r.size);
  }

  const validMappings = appState.mappingRows;

  const btn = document.getElementById('btn-generate');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating Tags...";
  }
  showLoading("Generating sequential bundle tags & saving to local database...");

  setTimeout(() => {
    try {
      let maxPreviousEnding = getMaxPreviousEndingPly(style, color, schedule);
      let currentPlyStart = maxPreviousEnding + 1;

      const generated = [];
      let globalBundleSeq = getMaxPreviousBundleSeq(style, color, schedule);
      const startSeq = globalBundleSeq + 1;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const batchId = `BDL-${dateStr}-${randomSuffix}`;
      const timestamp = new Date().toLocaleString();

      const totalBatchCopies = validMappings.reduce((acc, m) => acc + m.ratio, 0);

      validMappings.forEach(m => {
        const baseSize = String(m.size || '').trim();
        const ratioCount = parseInt(m.ratio, 10) || 1;
        const itemShades = (m.shades && m.shades.length) ? m.shades : [{ shade: 'A', plyCount: plyQty }];

        for (let copy = 1; copy <= ratioCount; copy++) {
          // If more than 1 copy: S-1, S-2, S-3... If 1 copy: just S
          const displaySize = ratioCount > 1 ? `${baseSize}-${copy}` : baseSize;

          globalBundleSeq++;
          const bundleStartPly = currentPlyStart;
          const maxBundlePly = bundleStartPly + plyQty - 1;

          let shadePlyOffset = 0;

          itemShades.forEach(sh => {
            const startPly = bundleStartPly + shadePlyOffset;
            if (startPly > maxBundlePly) return;

            const reqPlyCount = parseInt(sh.plyCount, 10) || 1;
            const actualPlyCount = Math.min(reqPlyCount, maxBundlePly - startPly + 1);
            if (actualPlyCount <= 0) return;

            const endPly = startPly + actualPlyCount - 1;
            const plyRange = `${startPly}–${endPly}`;
            const shadeStr = sh.shade ? String(sh.shade).trim() : 'A';

            appState.selectedParts.forEach(part => {
              const tagId = generate6CharId();
              const tagString = `${displaySize} ${globalBundleSeq} ${part} Shade ${shadeStr} ${plyRange}`;
              const qrData = tagId;

              const tagObj = {
                id: tagId,
                batchId: batchId,
                style: style,
                color: color,
                schedule: schedule,
                po: schedule,
                layJobNo: layJobNo || 'N/A',
                jobNo: layJobNo || 'N/A',
                pattern: layJobNo || 'N/A',
                docketNo: docketNo || 'N/A',
                docket: docketNo || 'N/A',
                patternText: patternText || '',
                embellishmentStyle: embellishmentStyle,
                baseSize: baseSize,
                sizeCopy: copy,
                sizeRatio: ratioCount,
                size: displaySize,
                part: part,
                shade: shadeStr,
                bundleSeq: globalBundleSeq,
                ratioTotal: totalBatchCopies,
                plyRange: plyRange,
                startPly: startPly,
                endPly: endPly,
                tagString: tagString,
                qrData: qrData,
                timestamp: timestamp
              };

              generated.push(tagObj);
            });

            shadePlyOffset += actualPlyCount;
          });

          currentPlyStart += plyQty;
        }
      });

      appState.printLogTags = [];
      appState.generatedTags = generated;

      const newLogEntry = {
        id: batchId,
        batchId: batchId,
        timestamp: timestamp,
        style: style,
        color: color,
        schedule: schedule,
        po: schedule,
        layJobNo: layJobNo || 'N/A',
        jobNo: layJobNo || 'N/A',
        pattern: layJobNo || 'N/A',
        docketNo: docketNo || 'N/A',
        docket: docketNo || 'N/A',
        patternText: patternText || '',
        embellishmentStyle: embellishmentStyle,
        sizesSummary: validMappings.map(m => m.size + '(' + m.ratio + ')').join(', '),
        cutParts: appState.selectedParts.join(', '),
        totalBundles: totalBatchCopies + ' Bundles (' + generated.length + ' Tags)',
        seqRange: 'SEQ ' + startSeq + '–' + globalBundleSeq,
        plyRange: (maxPreviousEnding + 1) + '–' + (currentPlyStart - 1),
        batchTagString: `${style} | ${color} | ${schedule} | ${layJobNo} | ${docketNo ? docketNo + ' | ' : ''}${batchId}`,
        tags: generated,
        tagCount: generated.length,
        source: 'Database Folder'
      };

      if (!Array.isArray(appState.allStoredTags)) appState.allStoredTags = [];
      generated.forEach(t => appState.allStoredTags.unshift(t));

      appState.logs.unshift(newLogEntry);
      saveLocalDatabase();

      fetch(getApiUrl('/api/append-batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLogEntry)
      }).catch(() => {});

      if (typeof renderPrintGrid === 'function') renderPrintGrid();
      if (typeof renderLogsTable === 'function') renderLogsTable();
      if (typeof switchTab === 'function') switchTab('print');
      showToast(`Generated ${generated.length} tags & saved directly to ${activeFilePathDisplay}!`, 'success');
    } catch (err) {
      console.error("Tag Generation Error:", err);
      showToast("Failed to generate tags: " + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "⚡ Generate Garment Tags";
      }
      hideLoading();
    }
  }, 100);
}
