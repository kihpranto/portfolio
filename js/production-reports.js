/**
 * GarmentTag Production Reports & Visual Analytics Engine
 */

function getReportTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const reportState = {
  dimension: 'hourly',
  datePreset: 'today',
  startDate: getReportTodayYMD(),
  endDate: getReportTodayYMD(),
  search: '',
  style: '',
  color: '',
  schedule: '',
  sortCol: '',
  sortAsc: true,
  expandedRows: new Set(),
  lastAggregatedRows: []
};

function setReportDimension(dim) {
  reportState.dimension = dim;
  reportState.expandedRows.clear();
  ['hourly', 'style', 'style_color', 'style_color_schedule', 'job', 'docket'].forEach(d => {
    const btn = document.getElementById(`report-dim-${d}`);
    if (btn) {
      if (d === dim) {
        btn.className = "px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs border border-slate-200/80 dark:border-slate-700";
      } else {
        btn.className = "px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 transition cursor-pointer";
      }
    }
  });
  renderReportsDashboard();
}

function setReportDatePreset(preset) {
  reportState.datePreset = preset;
  ['today', 'yesterday', '7days', 'month'].forEach(p => {
    const btn = document.getElementById(`report-preset-${p}`);
    if (btn) {
      if (p === preset) {
        btn.className = "px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer transition";
      } else {
        btn.className = "px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/70 cursor-pointer transition";
      }
    }
  });

  const today = new Date();
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');

  if (preset === 'today') {
    const str = formatYMD(today);
    reportState.startDate = str;
    reportState.endDate = str;
    if (startInput) startInput.value = str;
    if (endInput) endInput.value = str;
  } else if (preset === 'yesterday') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const str = formatYMD(yest);
    reportState.startDate = str;
    reportState.endDate = str;
    if (startInput) startInput.value = str;
    if (endInput) endInput.value = str;
  } else if (preset === '7days') {
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6);
    reportState.startDate = formatYMD(d7);
    reportState.endDate = formatYMD(today);
    if (startInput) startInput.value = reportState.startDate;
    if (endInput) endInput.value = reportState.endDate;
  } else if (preset === 'month') {
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    reportState.startDate = formatYMD(mStart);
    reportState.endDate = formatYMD(today);
    if (startInput) startInput.value = reportState.startDate;
    if (endInput) endInput.value = reportState.endDate;
  }
  renderReportsDashboard();
}

function onReportDateCustomChange() {
  const s = document.getElementById('report-start-date')?.value || '';
  const e = document.getElementById('report-end-date')?.value || '';
  reportState.startDate = s;
  reportState.endDate = e;
  reportState.datePreset = 'custom';
  ['today', 'yesterday', '7days', 'month'].forEach(p => {
    const btn = document.getElementById(`report-preset-${p}`);
    if (btn) {
      btn.className = "px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/70 cursor-pointer transition";
    }
  });
  renderReportsDashboard();
}

function onReportFilterChange() {
  reportState.search = (document.getElementById('report-search-input')?.value || '').trim().toLowerCase();
  reportState.style = document.getElementById('report-filter-style')?.value || '';
  reportState.color = document.getElementById('report-filter-color')?.value || '';
  reportState.schedule = document.getElementById('report-filter-schedule')?.value || '';
  renderReportsDashboard();
}

function populateReportFilters() {
  const logs = appState.logs || [];
  const styleSelect = document.getElementById('report-filter-style');
  const colorSelect = document.getElementById('report-filter-color');
  const schedSelect = document.getElementById('report-filter-schedule');

  const styles = Array.from(new Set(logs.map(l => l.style).filter(Boolean))).sort();
  const colors = Array.from(new Set(logs.map(l => l.color).filter(Boolean))).sort();
  const schedules = Array.from(new Set(logs.map(l => l.schedule || l.po).filter(Boolean))).sort();

  if (styleSelect) {
    const curStyle = styleSelect.value;
    styleSelect.innerHTML = '<option value="">-- All Styles --</option>';
    styles.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === curStyle) opt.selected = true;
      styleSelect.appendChild(opt);
    });
  }
  if (colorSelect) {
    const curColor = colorSelect.value;
    colorSelect.innerHTML = '<option value="">-- All Colors --</option>';
    colors.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === curColor) opt.selected = true;
      colorSelect.appendChild(opt);
    });
  }
  if (schedSelect) {
    const curSched = schedSelect.value;
    schedSelect.innerHTML = '<option value="">-- All Schedules --</option>';
    schedules.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc;
      opt.textContent = sc;
      if (sc === curSched) opt.selected = true;
      schedSelect.appendChild(opt);
    });
  }

  if (typeof refreshSearchableSelect === 'function') {
    refreshSearchableSelect('report-filter-style');
    refreshSearchableSelect('report-filter-color');
    refreshSearchableSelect('report-filter-schedule');
  }
}

function parseLogDate(log) {
  if (!log.timestamp) return null;
  const d = new Date(log.timestamp);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function filterReportLogs() {
  const allLogs = appState.logs || [];
  return allLogs.filter(log => {
    if (reportState.startDate || reportState.endDate) {
      const d = parseLogDate(log);
      if (d) {
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (reportState.startDate && ymd < reportState.startDate) return false;
        if (reportState.endDate && ymd > reportState.endDate) return false;
      }
    }
    if (reportState.style && log.style !== reportState.style) return false;
    if (reportState.color && log.color !== reportState.color) return false;
    const schedVal = log.schedule || log.po || '';
    if (reportState.schedule && schedVal !== reportState.schedule) return false;

    if (reportState.search) {
      const hay = [
        log.style, log.color, schedVal,
        log.layJobNo || log.jobNo || log.pattern || '',
        log.docketNo || log.docket || '',
        log.batchId || log.id || '',
        log.sizesSummary || '',
        log.cutParts || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(reportState.search)) return false;
    }
    return true;
  });
}

function calculateBatchPieces(log) {
  if (Array.isArray(log.tags) && log.tags.length > 0) {
    const bundlesMap = {};
    log.tags.forEach(t => {
      const bSeq = t.bundleSeq || 1;
      if (!bundlesMap[bSeq]) {
        const startP = Number(t.startPly) || 1;
        const endP = Number(t.endPly) || startP;
        const qty = Math.max(1, endP - startP + 1);
        bundlesMap[bSeq] = qty;
      }
    });
    return Object.values(bundlesMap).reduce((a, b) => a + b, 0);
  }
  return 0;
}

function calculateBatchBundles(log) {
  if (Array.isArray(log.tags) && log.tags.length > 0) {
    const uniqueSeq = new Set(log.tags.map(t => t.bundleSeq || 1));
    return uniqueSeq.size;
  }
  const match = String(log.totalBundles || '').match(/(\d+)\s*Bundles/i);
  if (match) return parseInt(match[1], 10);
  return 1;
}

function calculateBatchTags(log) {
  if (Array.isArray(log.tags) && log.tags.length > 0) {
    return log.tags.length;
  }
  const match = String(log.totalBundles || '').match(/(\d+)\s*Tags/i);
  if (match) return parseInt(match[1], 10);
  return calculateBatchBundles(log);
}

function toggleReportRowExpand(rowKey) {
  if (reportState.expandedRows.has(rowKey)) {
    reportState.expandedRows.delete(rowKey);
  } else {
    reportState.expandedRows.add(rowKey);
  }
  renderReportsDashboard();
}

function sortReportTable(colKey) {
  if (reportState.sortCol === colKey) {
    reportState.sortAsc = !reportState.sortAsc;
  } else {
    reportState.sortCol = colKey;
    reportState.sortAsc = true;
  }
  renderReportsDashboard();
}

function renderReportsDashboard() {
  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');
  if (startInput && !startInput.value && reportState.startDate) {
    startInput.value = reportState.startDate;
  }
  if (endInput && !endInput.value && reportState.endDate) {
    endInput.value = reportState.endDate;
  }

  populateReportFilters();
  const filteredLogs = filterReportLogs();

  let totalBundles = 0;
  let totalTags = 0;
  let totalPcs = 0;
  const totalBatches = filteredLogs.length;

  filteredLogs.forEach(l => {
    totalBundles += calculateBatchBundles(l);
    totalTags += calculateBatchTags(l);
    totalPcs += calculateBatchPieces(l);
  });

  const kpiBundles = document.getElementById('report-kpi-bundles');
  const kpiTags = document.getElementById('report-kpi-tags');
  const kpiPieces = document.getElementById('report-kpi-pieces');
  const kpiBatches = document.getElementById('report-kpi-batches');
  const kpiPeak = document.getElementById('report-kpi-peak');

  if (kpiBundles) kpiBundles.textContent = totalBundles.toLocaleString();
  if (kpiTags) kpiTags.textContent = totalTags.toLocaleString();
  if (kpiPieces) kpiPieces.textContent = totalPcs.toLocaleString();
  if (kpiBatches) kpiBatches.textContent = totalBatches.toLocaleString();

  const dim = reportState.dimension;
  let aggregated = [];

  if (dim === 'hourly') {
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, '0');
      hourlyMap[hStr] = {
        key: hStr,
        hourSlot: `${hStr}:00 – ${hStr}:59`,
        hourNum: h,
        batchesCount: 0,
        bundlesCount: 0,
        tagsCount: 0,
        piecesCount: 0,
        stylesSet: new Set(),
        logs: []
      };
    }

    filteredLogs.forEach(l => {
      const d = parseLogDate(l);
      const hKey = d ? String(d.getHours()).padStart(2, '0') : '00';
      if (hourlyMap[hKey]) {
        hourlyMap[hKey].batchesCount++;
        hourlyMap[hKey].bundlesCount += calculateBatchBundles(l);
        hourlyMap[hKey].tagsCount += calculateBatchTags(l);
        hourlyMap[hKey].piecesCount += calculateBatchPieces(l);
        if (l.style) hourlyMap[hKey].stylesSet.add(l.style);
        hourlyMap[hKey].logs.push(l);
      }
    });

    aggregated = Object.values(hourlyMap).map(item => ({
      ...item,
      stylesSummary: Array.from(item.stylesSet).join(', ') || 'None'
    }));

    let peakHour = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakHour = a.hourSlot;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakHour} (${peakVol} bnd)` : 'N/A';
    }

    renderHourlyChart(aggregated);

  } else if (dim === 'style') {
    const styleMap = {};
    filteredLogs.forEach(l => {
      const s = l.style || 'Unassigned Style';
      if (!styleMap[s]) {
        styleMap[s] = {
          key: s,
          style: s,
          colorsSet: new Set(),
          schedulesSet: new Set(),
          batchesCount: 0,
          bundlesCount: 0,
          tagsCount: 0,
          piecesCount: 0,
          sizesMap: {},
          cutPartsSet: new Set(),
          logs: []
        };
      }
      styleMap[s].batchesCount++;
      styleMap[s].bundlesCount += calculateBatchBundles(l);
      styleMap[s].tagsCount += calculateBatchTags(l);
      styleMap[s].piecesCount += calculateBatchPieces(l);
      if (l.color) styleMap[s].colorsSet.add(l.color);
      if (l.schedule || l.po) styleMap[s].schedulesSet.add(l.schedule || l.po);
      if (l.cutParts) l.cutParts.split(',').forEach(p => styleMap[s].cutPartsSet.add(p.trim()));
      styleMap[s].logs.push(l);
    });

    aggregated = Object.values(styleMap).map(item => ({
      ...item,
      uniqueColors: item.colorsSet.size,
      colorsSummary: Array.from(item.colorsSet).join(', ') || 'N/A',
      schedulesSummary: Array.from(item.schedulesSet).join(', ') || 'N/A',
      cutPartsSummary: Array.from(item.cutPartsSet).join(', ') || 'N/A'
    }));

    let peakStyle = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakStyle = a.style;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakStyle} (${peakVol} bnd)` : 'N/A';
    }

    renderCategoryBarChart(aggregated.slice(0, 8), 'style');

  } else if (dim === 'style_color') {
    const scMap = {};
    filteredLogs.forEach(l => {
      const s = l.style || 'Unassigned Style';
      const c = l.color || 'Unassigned Color';
      const k = `${s}__${c}`;
      if (!scMap[k]) {
        scMap[k] = {
          key: k,
          style: s,
          color: c,
          schedulesSet: new Set(),
          batchesCount: 0,
          bundlesCount: 0,
          tagsCount: 0,
          piecesCount: 0,
          logs: []
        };
      }
      scMap[k].batchesCount++;
      scMap[k].bundlesCount += calculateBatchBundles(l);
      scMap[k].tagsCount += calculateBatchTags(l);
      scMap[k].piecesCount += calculateBatchPieces(l);
      if (l.schedule || l.po) scMap[k].schedulesSet.add(l.schedule || l.po);
      scMap[k].logs.push(l);
    });

    aggregated = Object.values(scMap).map(item => ({
      ...item,
      schedulesSummary: Array.from(item.schedulesSet).join(', ') || 'N/A'
    }));

    let peakSC = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakSC = `${a.style} / ${a.color}`;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakSC} (${peakVol})` : 'N/A';
    }

    renderCategoryBarChart(aggregated.slice(0, 8), 'style_color');

  } else if (dim === 'style_color_schedule') {
    const scsMap = {};
    filteredLogs.forEach(l => {
      const s = l.style || 'Unassigned Style';
      const c = l.color || 'Unassigned Color';
      const sc = l.schedule || l.po || 'N/A';
      const k = `${s}__${c}__${sc}`;
      if (!scsMap[k]) {
        scsMap[k] = {
          key: k,
          style: s,
          color: c,
          schedule: sc,
          jobsSet: new Set(),
          docketsSet: new Set(),
          batchesCount: 0,
          bundlesCount: 0,
          tagsCount: 0,
          piecesCount: 0,
          logs: []
        };
      }
      scsMap[k].batchesCount++;
      scsMap[k].bundlesCount += calculateBatchBundles(l);
      scsMap[k].tagsCount += calculateBatchTags(l);
      scsMap[k].piecesCount += calculateBatchPieces(l);
      const j = l.layJobNo || l.jobNo || l.pattern || '';
      if (j) scsMap[k].jobsSet.add(j);
      const doc = l.docketNo || l.docket || '';
      if (doc) scsMap[k].docketsSet.add(doc);
      scsMap[k].logs.push(l);
    });

    aggregated = Object.values(scsMap).map(item => ({
      ...item,
      jobsSummary: Array.from(item.jobsSet).join(', ') || 'N/A',
      docketsSummary: Array.from(item.docketsSet).join(', ') || 'N/A'
    }));

    let peakSCS = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakSCS = `${a.style} (${a.schedule})`;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakSCS} (${peakVol})` : 'N/A';
    }

    renderCategoryBarChart(aggregated.slice(0, 8), 'style_color_schedule');

  } else if (dim === 'job') {
    const jobMap = {};
    filteredLogs.forEach(l => {
      const j = l.layJobNo || l.jobNo || l.pattern || 'Unassigned Job';
      if (!jobMap[j]) {
        jobMap[j] = {
          key: j,
          jobNo: j,
          stylesSet: new Set(),
          colorsSet: new Set(),
          schedulesSet: new Set(),
          docketsSet: new Set(),
          batchesCount: 0,
          bundlesCount: 0,
          tagsCount: 0,
          piecesCount: 0,
          logs: []
        };
      }
      jobMap[j].batchesCount++;
      jobMap[j].bundlesCount += calculateBatchBundles(l);
      jobMap[j].tagsCount += calculateBatchTags(l);
      jobMap[j].piecesCount += calculateBatchPieces(l);
      if (l.style) jobMap[j].stylesSet.add(l.style);
      if (l.color) jobMap[j].colorsSet.add(l.color);
      if (l.schedule || l.po) jobMap[j].schedulesSet.add(l.schedule || l.po);
      const doc = l.docketNo || l.docket || '';
      if (doc) jobMap[j].docketsSet.add(doc);
      jobMap[j].logs.push(l);
    });

    aggregated = Object.values(jobMap).map(item => ({
      ...item,
      stylesSummary: Array.from(item.stylesSet).join(', ') || 'N/A',
      colorsSummary: Array.from(item.colorsSet).join(', ') || 'N/A',
      schedulesSummary: Array.from(item.schedulesSet).join(', ') || 'N/A',
      docketsSummary: Array.from(item.docketsSet).join(', ') || 'N/A'
    }));

    let peakJob = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakJob = a.jobNo;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakJob} (${peakVol} bnd)` : 'N/A';
    }

    renderCategoryBarChart(aggregated.slice(0, 8), 'job');

  } else if (dim === 'docket') {
    const docketMap = {};
    filteredLogs.forEach(l => {
      const d = l.docketNo || l.docket || 'Unassigned Docket';
      if (!docketMap[d]) {
        docketMap[d] = {
          key: d,
          docketNo: d,
          stylesSet: new Set(),
          colorsSet: new Set(),
          schedulesSet: new Set(),
          jobsSet: new Set(),
          batchesCount: 0,
          bundlesCount: 0,
          tagsCount: 0,
          piecesCount: 0,
          logs: []
        };
      }
      docketMap[d].batchesCount++;
      docketMap[d].bundlesCount += calculateBatchBundles(l);
      docketMap[d].tagsCount += calculateBatchTags(l);
      docketMap[d].piecesCount += calculateBatchPieces(l);
      if (l.style) docketMap[d].stylesSet.add(l.style);
      if (l.color) docketMap[d].colorsSet.add(l.color);
      if (l.schedule || l.po) docketMap[d].schedulesSet.add(l.schedule || l.po);
      const j = l.layJobNo || l.jobNo || l.pattern || '';
      if (j) docketMap[d].jobsSet.add(j);
      docketMap[d].logs.push(l);
    });

    aggregated = Object.values(docketMap).map(item => ({
      ...item,
      stylesSummary: Array.from(item.stylesSet).join(', ') || 'N/A',
      colorsSummary: Array.from(item.colorsSet).join(', ') || 'N/A',
      schedulesSummary: Array.from(item.schedulesSet).join(', ') || 'N/A',
      jobsSummary: Array.from(item.jobsSet).join(', ') || 'N/A'
    }));

    let peakDoc = null;
    let peakVol = 0;
    aggregated.forEach(a => {
      if (a.bundlesCount > peakVol) {
        peakVol = a.bundlesCount;
        peakDoc = a.docketNo;
      }
    });
    if (kpiPeak) {
      kpiPeak.textContent = peakVol > 0 ? `${peakDoc} (${peakVol} bnd)` : 'N/A';
    }

    renderCategoryBarChart(aggregated.slice(0, 8), 'docket');
  }

  if (reportState.sortCol) {
    const c = reportState.sortCol;
    const mult = reportState.sortAsc ? 1 : -1;
    aggregated.sort((a, b) => {
      const valA = a[c] !== undefined ? a[c] : '';
      const valB = b[c] !== undefined ? b[c] : '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * mult;
      }
      return String(valA).localeCompare(String(valB)) * mult;
    });
  }

  reportState.lastAggregatedRows = aggregated;
  renderReportTableHTML(dim, aggregated);
}

function renderHourlyChart(hourlyData) {
  const chartContainer = document.getElementById('report-chart-container');
  const chartTitle = document.getElementById('report-chart-title');
  const chartSubtitle = document.getElementById('report-chart-subtitle');

  if (chartTitle) chartTitle.innerHTML = `<span>📊 Hourly Generation Volume & Velocity</span>`;
  if (chartSubtitle) chartSubtitle.textContent = `24-hour output distribution across selected period`;
  if (!chartContainer) return;

  const maxVal = Math.max(1, ...hourlyData.map(h => h.bundlesCount));
  const chartH = 90;
  const barW = 24;
  const gap = 12;
  const totalW = hourlyData.length * (barW + gap) + 40;

  let svgBars = '';
  hourlyData.forEach((h, idx) => {
    const x = 20 + idx * (barW + gap);
    const barHeight = Math.max(4, Math.round((h.bundlesCount / maxVal) * chartH));
    const y = chartH - barHeight + 10;
    const isPeak = h.bundlesCount === maxVal && maxVal > 0;
    const fill = isPeak ? '#3b82f6' : (h.bundlesCount > 0 ? '#6366f1' : '#cbd5e1');
    const opacity = h.bundlesCount > 0 ? '1' : '0.4';

    svgBars += `
      <g class="cursor-pointer group" transform="translate(0, 0)">
        <rect x="${x}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${fill}" opacity="${opacity}" class="transition-all hover:brightness-110">
          <title>${h.hourSlot}: ${h.bundlesCount} Bundles (${h.tagsCount} Tags, ${h.piecesCount} Pcs, ${h.batchesCount} Batches)</title>
        </rect>
        ${h.bundlesCount > 0 ? `
          <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" font-family="sans-serif" font-weight="bold" fill="#475569" class="dark:fill-slate-300">${h.bundlesCount}</text>
        ` : ''}
        <text x="${x + barW / 2}" y="${chartH + 24}" text-anchor="middle" font-size="8.5" font-family="monospace" font-weight="600" fill="#64748b" class="dark:fill-slate-400">${String(h.hourNum).padStart(2,'0')}</text>
      </g>
    `;
  });

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${totalW} ${chartH + 35}" class="w-full h-36 select-none" style="min-width: 700px;">
      <line x1="10" y1="${chartH + 10}" x2="${totalW - 10}" y2="${chartH + 10}" stroke="#e2e8f0" stroke-width="1" class="dark:stroke-slate-700" />
      ${svgBars}
    </svg>
  `;
}

function renderCategoryBarChart(topRows, dimKey) {
  const chartContainer = document.getElementById('report-chart-container');
  const chartTitle = document.getElementById('report-chart-title');
  const chartSubtitle = document.getElementById('report-chart-subtitle');

  const dimLabels = {
    'style': 'Top Styles Distribution',
    'style_color': 'Top Style & Color Combinations',
    'style_color_schedule': 'Top Orders by Schedule',
    'job': 'Top Lay Jobs Volume',
    'docket': 'Top Dockets Volume'
  };

  if (chartTitle) chartTitle.innerHTML = `<span>📊 ${dimLabels[dimKey] || 'Production Distribution'}</span>`;
  if (chartSubtitle) chartSubtitle.textContent = `Visual distribution of top volume items`;
  if (!chartContainer) return;

  if (topRows.length === 0) {
    chartContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No output recorded for the selected filter.</div>`;
    return;
  }

  const maxVal = Math.max(1, ...topRows.map(r => r.bundlesCount));
  const chartH = 90;
  const barW = 48;
  const gap = 20;
  const totalW = topRows.length * (barW + gap) + 40;

  let svgBars = '';
  topRows.forEach((r, idx) => {
    const x = 20 + idx * (barW + gap);
    const barHeight = Math.max(4, Math.round((r.bundlesCount / maxVal) * chartH));
    const y = chartH - barHeight + 10;
    const fill = idx === 0 ? '#3b82f6' : idx === 1 ? '#6366f1' : idx === 2 ? '#8b5cf6' : '#a855f7';

    let label = r.style || r.jobNo || r.docketNo || r.key;
    if (dimKey === 'style_color') label = `${(r.style || '').substring(0, 6)} / ${(r.color || '').substring(0, 5)}`;
    if (label.length > 8) label = label.substring(0, 7) + '..';

    svgBars += `
      <g class="cursor-pointer group" transform="translate(0, 0)">
        <rect x="${x}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${fill}" class="transition-all hover:brightness-110">
          <title>${r.key}: ${r.bundlesCount} Bundles (${r.tagsCount} Tags, ${r.piecesCount} Pcs, ${r.batchesCount} Batches)</title>
        </rect>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" font-family="sans-serif" font-weight="bold" fill="#475569" class="dark:fill-slate-300">${r.bundlesCount}</text>
        <text x="${x + barW / 2}" y="${chartH + 24}" text-anchor="middle" font-size="8.5" font-family="sans-serif" font-weight="bold" fill="#64748b" class="dark:fill-slate-400">${label}</text>
      </g>
    `;
  });

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${totalW} ${chartH + 35}" class="w-full h-36 select-none" style="min-width: ${Math.max(500, totalW)}px;">
      <line x1="10" y1="${chartH + 10}" x2="${totalW - 10}" y2="${chartH + 10}" stroke="#e2e8f0" stroke-width="1" class="dark:stroke-slate-700" />
      ${svgBars}
    </svg>
  `;
}

function renderReportTableHTML(dim, rows) {
  const container = document.getElementById('report-table-container');
  const countEl = document.getElementById('report-records-count');

  if (!container) return;
  if (countEl) countEl.textContent = `${rows.length} Grouped Row${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-xs italic">
        No matching production records found for the selected criteria.
      </div>
    `;
    return;
  }

  const sortIndicator = (col) => {
    if (reportState.sortCol === col) {
      return reportState.sortAsc ? ' ↑' : ' ↓';
    }
    return '';
  };

  let headersHTML = '';
  if (dim === 'hourly') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('hourSlot')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Hour Window${sortIndicator('hourSlot')}</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags / Labels${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3">Active Styles</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  } else if (dim === 'style') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('style')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Style Name${sortIndicator('style')}</th>
      <th onclick="sortReportTable('uniqueColors')" class="py-2.5 px-3 text-center cursor-pointer hover:text-blue-600">Colors${sortIndicator('uniqueColors')}</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3">Associated Schedules</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  } else if (dim === 'style_color') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('style')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Style Name${sortIndicator('style')}</th>
      <th onclick="sortReportTable('color')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Color Name${sortIndicator('color')}</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3">Schedules</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  } else if (dim === 'style_color_schedule') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('style')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Style Name${sortIndicator('style')}</th>
      <th onclick="sortReportTable('color')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Color Name${sortIndicator('color')}</th>
      <th onclick="sortReportTable('schedule')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600 font-mono">Schedule #${sortIndicator('schedule')}</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3">Lay Jobs / Dockets</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  } else if (dim === 'job') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('jobNo')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600 font-mono">Lay Job No${sortIndicator('jobNo')}</th>
      <th onclick="sortReportTable('stylesSummary')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Style</th>
      <th onclick="sortReportTable('colorsSummary')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Color</th>
      <th onclick="sortReportTable('schedulesSummary')" class="py-2.5 px-3 font-mono">Schedule</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  } else if (dim === 'docket') {
    headersHTML = `
      <th class="py-2.5 px-3 w-10 text-center">#</th>
      <th onclick="sortReportTable('docketNo')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600 font-mono">Docket No${sortIndicator('docketNo')}</th>
      <th onclick="sortReportTable('stylesSummary')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Style</th>
      <th onclick="sortReportTable('colorsSummary')" class="py-2.5 px-3 cursor-pointer hover:text-blue-600">Color</th>
      <th onclick="sortReportTable('schedulesSummary')" class="py-2.5 px-3 font-mono">Schedule</th>
      <th onclick="sortReportTable('jobsSummary')" class="py-2.5 px-3 font-mono">Lay Job No</th>
      <th onclick="sortReportTable('batchesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Batches${sortIndicator('batchesCount')}</th>
      <th onclick="sortReportTable('bundlesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Bundles${sortIndicator('bundlesCount')}</th>
      <th onclick="sortReportTable('tagsCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Tags${sortIndicator('tagsCount')}</th>
      <th onclick="sortReportTable('piecesCount')" class="py-2.5 px-3 text-right cursor-pointer hover:text-blue-600">Estimated Pcs${sortIndicator('piecesCount')}</th>
      <th class="py-2.5 px-3 w-16 text-center">Details</th>
    `;
  }

  let rowsHTML = '';
  rows.forEach((r, idx) => {
    const isExpanded = reportState.expandedRows.has(r.key);

    let mainCols = '';
    if (dim === 'hourly') {
      mainCols = `
        <td class="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 font-mono">${r.hourSlot}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">${r.stylesSummary}</td>
      `;
    } else if (dim === 'style') {
      mainCols = `
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${r.style}</td>
        <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold text-[10px]">${r.uniqueColors} Colors</span></td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs font-mono text-[11px]">${r.schedulesSummary}</td>
      `;
    } else if (dim === 'style_color') {
      mainCols = `
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${r.style}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">${r.color}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs font-mono text-[11px]">${r.schedulesSummary}</td>
      `;
    } else if (dim === 'style_color_schedule') {
      mainCols = `
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${r.style}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">${r.color}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">${r.schedule}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
        <td class="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs font-mono text-[11px]">Jobs: ${r.jobsSummary} | Doc: ${r.docketsSummary}</td>
      `;
    } else if (dim === 'job') {
      mainCols = `
        <td class="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">${r.jobNo}</td>
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${r.stylesSummary}</td>
        <td class="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">${r.colorsSummary}</td>
        <td class="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">${r.schedulesSummary}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
      `;
    } else if (dim === 'docket') {
      mainCols = `
        <td class="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">${r.docketNo}</td>
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">${r.stylesSummary}</td>
        <td class="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">${r.colorsSummary}</td>
        <td class="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">${r.schedulesSummary}</td>
        <td class="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">${r.jobsSummary}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.batchesCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${r.bundlesCount}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 font-mono">${r.tagsCount}</td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${r.piecesCount.toLocaleString()}</td>
      `;
    }

    let drillDownHTML = '';
    if (isExpanded) {
      const batchRows = (r.logs || []).map(b => {
        const bPcs = calculateBatchPieces(b);
        const bBnd = calculateBatchBundles(b);
        const bTags = calculateBatchTags(b);
        return `
          <tr class="text-[11px] bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/60">
            <td class="py-1 px-2 font-mono text-slate-500">${b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : 'N/A'}</td>
            <td class="py-1 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">${b.batchId || b.id}</td>
            <td class="py-1 px-2 font-bold">${b.style}</td>
            <td class="py-1 px-2">${b.color}</td>
            <td class="py-1 px-2 font-mono">${b.schedule || b.po}</td>
            <td class="py-1 px-2 font-mono">${b.layJobNo || b.jobNo || b.pattern || 'N/A'}</td>
            <td class="py-1 px-2 font-mono">${b.docketNo || b.docket || 'N/A'}</td>
            <td class="py-1 px-2 text-right font-bold">${bBnd}</td>
            <td class="py-1 px-2 text-right">${bTags}</td>
            <td class="py-1 px-2 text-right font-bold text-emerald-600">${bPcs.toLocaleString()}</td>
            <td class="py-1 px-2 text-[10px] text-slate-500 truncate max-w-[150px]">${b.sizesSummary || ''}</td>
          </tr>
        `;
      }).join('');

      drillDownHTML = `
        <tr class="bg-slate-100/70 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-700">
          <td colspan="12" class="p-3">
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>🔍 Detailed Batches under "${r.key}" (${r.logs.length} Batch Runs)</span>
              </div>
              <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-56 overflow-y-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                    <tr>
                      <th class="py-1.5 px-2">Time</th>
                      <th class="py-1.5 px-2">Batch ID</th>
                      <th class="py-1.5 px-2">Style</th>
                      <th class="py-1.5 px-2">Color</th>
                      <th class="py-1.5 px-2">Schedule</th>
                      <th class="py-1.5 px-2">Lay Job</th>
                      <th class="py-1.5 px-2">Docket</th>
                      <th class="py-1.5 px-2 text-right">Bundles</th>
                      <th class="py-1.5 px-2 text-right">Tags</th>
                      <th class="py-1.5 px-2 text-right">Pieces</th>
                      <th class="py-1.5 px-2">Sizes (Ratio)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${batchRows}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    rowsHTML += `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
        <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">${idx + 1}</td>
        ${mainCols}
        <td class="py-2.5 px-3 text-center">
          <button type="button" onclick="toggleReportRowExpand('${r.key.replace(/'/g, "\\'")}')"
            class="px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${isExpanded ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">
            ${isExpanded ? 'Hide' : 'View'}
          </button>
        </td>
      </tr>
      ${drillDownHTML}
    `;
  });

  container.innerHTML = `
    <table class="w-full text-left text-xs">
      <thead class="bg-[#F8FAFC] dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[11px] sticky top-0">
        <tr>
          ${headersHTML}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        ${rowsHTML}
      </tbody>
    </table>
  `;
}

function exportReportAsCSV() {
  const rows = reportState.lastAggregatedRows || [];
  if (rows.length === 0) {
    showToast("No data to export.", "info");
    return;
  }
  const dim = reportState.dimension;

  let csvHeaders = [];
  let csvData = [];

  if (dim === 'hourly') {
    csvHeaders = ['Hour Window', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces', 'Active Styles'];
    csvData = rows.map(r => [r.hourSlot, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount, `"${r.stylesSummary.replace(/"/g, '""')}"`]);
  } else if (dim === 'style') {
    csvHeaders = ['Style Name', 'Unique Colors', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces', 'Associated Schedules', 'Cut Parts'];
    csvData = rows.map(r => [r.style, r.uniqueColors, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount, `"${r.schedulesSummary.replace(/"/g, '""')}"`, `"${r.cutPartsSummary.replace(/"/g, '""')}"`]);
  } else if (dim === 'style_color') {
    csvHeaders = ['Style Name', 'Color Name', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces', 'Associated Schedules'];
    csvData = rows.map(r => [r.style, r.color, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount, `"${r.schedulesSummary.replace(/"/g, '""')}"`]);
  } else if (dim === 'style_color_schedule') {
    csvHeaders = ['Style Name', 'Color Name', 'Schedule Number', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces', 'Lay Jobs', 'Dockets'];
    csvData = rows.map(r => [r.style, r.color, r.schedule, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount, `"${r.jobsSummary.replace(/"/g, '""')}"`, `"${r.docketsSummary.replace(/"/g, '""')}"`]);
  } else if (dim === 'job') {
    csvHeaders = ['Lay Job No', 'Style', 'Color', 'Schedule', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces', 'Dockets'];
    csvData = rows.map(r => [r.jobNo, `"${r.stylesSummary.replace(/"/g, '""')}"`, `"${r.colorsSummary.replace(/"/g, '""')}"`, `"${r.schedulesSummary.replace(/"/g, '""')}"`, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount, `"${r.docketsSummary.replace(/"/g, '""')}"`]);
  } else if (dim === 'docket') {
    csvHeaders = ['Docket No', 'Style', 'Color', 'Schedule', 'Lay Job No', 'Batches', 'Bundles', 'Tags', 'Estimated Pieces'];
    csvData = rows.map(r => [r.docketNo, `"${r.stylesSummary.replace(/"/g, '""')}"`, `"${r.colorsSummary.replace(/"/g, '""')}"`, `"${r.schedulesSummary.replace(/"/g, '""')}"`, `"${r.jobsSummary.replace(/"/g, '""')}"`, r.batchesCount, r.bundlesCount, r.tagsCount, r.piecesCount]);
  }

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
    + csvHeaders.join(",") + "\n"
    + csvData.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Production_Report_${dim}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${rows.length} rows to CSV.`, 'success');
}

function printProductionReport() {
  window.print();
}
