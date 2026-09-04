/**
 * GarmentTag Print Preview & Direct Printer / PDF Output Engine
 */

appState.printColumns = 2;
appState.paperSize = 'A4';
appState.chartPaperSize = 'A4';
appState.tagDensity = '6';
appState.tagHeightMm = 23;
appState.tagGap = '1';

const PAPER_CONFIGS = {
  'A4': {
    name: 'A4 (210 × 297 mm)',
    pageSize: 'A4 portrait',
    margin: '4mm',
    containerMaxWidth: '210mm',
    desc: 'Formatted for standard A4 paper cutter / laser tag sheets.'
  },
  'A3': {
    name: 'A3 (297 × 420 mm)',
    pageSize: 'A3 portrait',
    margin: '4mm',
    containerMaxWidth: '297mm',
    desc: 'Formatted for large A3 production sheets.'
  },
  'Letter': {
    name: 'Letter (8.5" × 11")',
    pageSize: 'letter portrait',
    margin: '4mm',
    containerMaxWidth: '216mm',
    desc: 'Formatted for standard US Letter sheets.'
  },
  '4x6': {
    name: '4" × 6" (Thermal Tag Sheet)',
    pageSize: '4in 6in',
    margin: '3mm',
    containerMaxWidth: '101.6mm',
    desc: 'Formatted for 4x6 inch thermal roll / tag cutter (100 × 150 mm).'
  },
  '4x8': {
    name: '4" × 8" (Continuous Roll)',
    pageSize: '4in 8in',
    margin: '3mm',
    containerMaxWidth: '101.6mm',
    desc: 'Formatted for 4x8 inch continuous bundle rolls.'
  },
  '3x5': {
    name: '3" × 5" (Compact Tag)',
    pageSize: '3in 5in',
    margin: '3mm',
    containerMaxWidth: '76.2mm',
    desc: 'Formatted for 3x5 inch compact sticker tags.'
  }
};

function setPrintTagDensity(density) {
  appState.tagDensity = String(density || '6');
  if (density === '6') appState.tagHeightMm = 23;
  else if (density === '5') appState.tagHeightMm = 27.5;
  else if (density === '4') appState.tagHeightMm = 34.5;
  else if (density === '3') appState.tagHeightMm = 46.0;
  else if (density === '2') appState.tagHeightMm = 68.0;
  else if (density === '1') appState.tagHeightMm = 140.0;

  const heightInput = document.getElementById('print-tag-height');
  if (heightInput) heightInput.value = appState.tagHeightMm;

  renderPrintGrid();
  showToast(`Print layout set to ${density} tag(s) per sheet (${appState.tagHeightMm}mm)`, 'info');
}

function setPrintTagHeight(val) {
  val = parseFloat(val);
  if (isNaN(val) || val < 10) val = 23;
  appState.tagHeightMm = Math.round(val * 10) / 10;

  const heightInput = document.getElementById('print-tag-height');
  if (heightInput) heightInput.value = appState.tagHeightMm;

  renderPrintGrid();
  showToast(`Tag height adjusted to ${appState.tagHeightMm} mm`, 'info');
}

function stepTagHeight(delta) {
  let cur = parseFloat(appState.tagHeightMm || 23);
  cur = Math.max(12, Math.min(150, cur + delta));
  setPrintTagHeight(cur);
}

function setPrintTagGap(gap) {
  appState.tagGap = String(gap !== undefined ? gap : '1');
  updatePrintPageStyle(false);
  renderPrintGrid();
  showToast(`Tag gap set to ${gap} mm`, 'info');
}

function updatePrintPageStyle(isChart = false) {
  const currentSize = isChart ? (appState.chartPaperSize || 'A4') : (appState.paperSize || 'A4');
  const config = PAPER_CONFIGS[currentSize] || PAPER_CONFIGS['A4'];
  const currentGap = appState.tagGap !== undefined ? appState.tagGap : '1';

  let styleEl = document.getElementById('dynamic-print-page-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `
    @media print {
      @page {
        size: ${config.pageSize};
        margin: ${config.margin} !important;
      }
      #print-tags-grid, .tag-print-sheet {
        gap: ${currentGap}mm !important;
      }
    }
  `;

  if (!isChart) {
    const container = document.querySelector('#sec-print .print-container');
    if (container) {
      container.style.maxWidth = config.containerMaxWidth;
      container.style.marginLeft = 'auto';
      container.style.marginRight = 'auto';
    }

    const subEl = document.getElementById('print-header-subtitle');
    if (subEl) {
      subEl.textContent = `${config.name} - ${config.desc}`;
    }
  } else {
    const container = document.getElementById('numbering-sheet-container');
    if (container) {
      container.style.maxWidth = config.containerMaxWidth;
    }
  }
}

function setPrintPaperSize(size) {
  if (PAPER_CONFIGS[size]) {
    appState.paperSize = size;
    updatePrintPageStyle(false);

    // Standardize: A4 and 4x6 share the same standard tag height (23mm), density (6 rows/sheet), and gap (1mm)
    appState.tagDensity = '6';
    appState.tagHeightMm = 23;
    appState.tagGap = '1';

    const densitySelect = document.getElementById('print-tag-density');
    if (densitySelect) densitySelect.value = '6';

    const heightInput = document.getElementById('print-tag-height');
    if (heightInput) heightInput.value = '23';

    const gapSelect = document.getElementById('print-tag-gap');
    if (gapSelect) gapSelect.value = '1';

    // The only difference between 4x6 and A4 is column count:
    // 4x6: 1 column
    // A4: 2 columns
    if (size === '4x6') {
      setPrintColumns(1);
    } else if (size === 'A4') {
      setPrintColumns(2);
    } else if ((size === '4x8' || size === '3x5') && appState.printColumns > 1) {
      setPrintColumns(1);
    } else {
      renderPrintGrid();
    }

    showToast(`Print paper size set to ${PAPER_CONFIGS[size].name}`, 'info');
  }
}

function setChartPaperSize(size) {
  if (PAPER_CONFIGS[size]) {
    appState.chartPaperSize = size;
    updatePrintPageStyle(true);
    const btn = document.querySelector('#sec-chart button[onclick="window.print()"]');
    if (btn) {
      btn.innerHTML = `🖨️ Print Chart (${size})`;
    }
    showToast(`Numbering chart paper size set to ${PAPER_CONFIGS[size].name}`, 'info');
  }
}

function setPrintColumns(cols) {
  appState.printColumns = parseInt(cols, 10) || 2;

  [1, 2, 3].forEach(c => {
    const btn = document.getElementById(`btn-print-col-${c}`);
    if (btn) {
      if (c === appState.printColumns) {
        btn.className = "px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs";
      } else {
        btn.className = "px-2.5 py-1 text-xs font-semibold rounded-md text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-all cursor-pointer";
      }
    }
  });

  const titleEl = document.getElementById('print-header-title');
  if (titleEl) {
    titleEl.textContent = `Bundle Tag Print Preview (${appState.printColumns} Column${appState.printColumns > 1 ? 's' : ''})`;
  }

  renderPrintGrid();
  showToast(`Bundle tag layout set to ${appState.printColumns} column(s)`, 'info');
}

let installedPrinters = [];

async function loadInstalledPrinters() {
  try {
    const res = await fetch(getApiUrl('/api/printers'));
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.printers)) {
        installedPrinters = json.printers;
        populatePrinterDropdowns();
      }
    }
  } catch (e) {
    console.warn("Could not load printer list:", e);
  }
}

function onPrinterSelectionChanged(val) {
  if (val) {
    localStorage.setItem('garment_preferred_printer', val);
    showToast(`Selected Printer: ${val}`, 'info');
  }
}

function populatePrinterDropdowns() {
  const tagSelect = document.getElementById('print-printer-select');
  const chartSelect = document.getElementById('chart-printer-select');
  const savedPref = localStorage.getItem('garment_preferred_printer') || '';

  let defaultPrinterName = '';
  if (savedPref && installedPrinters.some(p => p.name === savedPref)) {
    defaultPrinterName = savedPref;
  } else {
    const nonOneNotePrinters = installedPrinters.filter(p => {
      const lower = p.name.toLowerCase();
      return !lower.includes('onenote') && !lower.includes('fax') && !lower.includes('xps');
    });
    const defaultNonOneNote = nonOneNotePrinters.find(p => p.isDefault);
    if (defaultNonOneNote) {
      defaultPrinterName = defaultNonOneNote.name;
    } else if (nonOneNotePrinters.length > 0) {
      const pdfPrinter = nonOneNotePrinters.find(p => p.name.toLowerCase().includes('pdf'));
      defaultPrinterName = pdfPrinter ? pdfPrinter.name : nonOneNotePrinters[0].name;
    } else if (installedPrinters.length > 0) {
      defaultPrinterName = installedPrinters[0].name;
    }
  }

  [tagSelect, chartSelect].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    if (installedPrinters.length === 0) {
      sel.innerHTML = '<option value="">Default System Printer</option>';
    } else {
      installedPrinters.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        const isChosen = p.name === defaultPrinterName;
        const isPdf = p.name.toLowerCase().includes('pdf');
        const isOneNote = p.name.toLowerCase().includes('onenote');
        opt.textContent = `${isChosen ? '⭐ ' : (isPdf ? '📄 ' : (isOneNote ? '📝 ' : '🖨️ '))}${p.name}`;
        if (isChosen) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    sel.onchange = function () {
      onPrinterSelectionChanged(this.value);
      if (tagSelect && sel !== tagSelect) tagSelect.value = this.value;
      if (chartSelect && sel !== chartSelect) chartSelect.value = this.value;
    };
  });
}

async function printDirectTags() {
  const printerSelect = document.getElementById('print-printer-select');
  const copiesInput = document.getElementById('print-copies-input');
  const paperSize = document.getElementById('print-paper-size')?.value || appState.paperSize || 'A4';
  const deviceName = printerSelect?.value || '';
  const copies = parseInt(copiesInput?.value, 10) || 1;

  if (deviceName.toLowerCase().includes('onenote')) {
    const confirmOneNote = confirm(`The currently selected printer is "${deviceName}". Do you want to send directly to OneNote? Click Cancel to pick your paper/label printer from the dropdown.`);
    if (!confirmOneNote) {
      printerSelect?.focus();
      return;
    }
  }

  showLoading(`Sending tags directly to ${deviceName || 'Default Printer'}...`);
  try {
    const res = await fetch(getApiUrl('/api/print-direct'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: deviceName,
        copies: copies,
        pageSize: paperSize,
        silent: true
      })
    });
    const json = await res.json();
    hideLoading();
    if (json.success) {
      showToast(`Printed directly to ${deviceName || 'Default Printer'} (${copies} copies)!`, "success");
    } else {
      showToast("Print error: " + (json.failureReason || json.message || "Failed to print"), "error");
    }
  } catch (e) {
    hideLoading();
    showToast("Direct Print Error: " + e.message, "error");
  }
}

async function printDirectChart() {
  const paperSize = document.getElementById('chart-paper-size')?.value || appState.chartPaperSize || 'A4';
  const printerSelect = document.getElementById('chart-printer-select') || document.getElementById('print-printer-select');
  const deviceName = printerSelect?.value || '';

  if (deviceName.toLowerCase().includes('onenote')) {
    const confirmOneNote = confirm(`The currently selected printer is "${deviceName}". Do you want to send directly to OneNote? Click Cancel to pick your paper/label printer from the dropdown.`);
    if (!confirmOneNote) {
      printerSelect?.focus();
      return;
    }
  }

  showLoading(`Sending Numbering Chart directly to ${deviceName || 'Default Printer'}...`);
  try {
    const res = await fetch(getApiUrl('/api/print-direct'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: deviceName,
        copies: 1,
        pageSize: paperSize,
        silent: true
      })
    });
    const json = await res.json();
    hideLoading();
    if (json.success) {
      showToast(`Chart sent directly to ${deviceName || 'Default Printer'}!`, "success");
    } else {
      showToast("Print error: " + (json.failureReason || json.message || "Failed"), "error");
    }
  } catch (e) {
    hideLoading();
    showToast("Print Error: " + e.message, "error");
  }
}

function executeBrowserPrint() {
  const isChartActive = !document.getElementById('sec-chart')?.classList.contains('hidden');
  updatePrintPageStyle(isChartActive);
  const vp = document.getElementById('main-scroll-viewport');
  if (vp) vp.scrollTop = 0;
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  window.scrollTo(0, 0);
  // Purge any injected extension elements before printing
  if (typeof purgeInjectedExtensionElements === 'function') purgeInjectedExtensionElements();
  setTimeout(() => {
    if (typeof purgeInjectedExtensionElements === 'function') purgeInjectedExtensionElements();
    window.print();
  }, 50);
}

window.addEventListener('beforeprint', () => {
  const isChartActive = !document.getElementById('sec-chart')?.classList.contains('hidden');
  updatePrintPageStyle(isChartActive);
});

function triggerPrintTags() {
  executeBrowserPrint();
}

function exportTagsAsPDF() {
  executeBrowserPrint();
}


function getQRCodeUrl(text) {
  if (!text) return '';
  try {
    if (typeof qrcode !== 'undefined') {
      const qr = qrcode(0, 'M');
      qr.addData(String(text), 'Byte');
      qr.make();
      return qr.createDataURL(3, 0);
    }
  } catch (e) {
    console.warn("Client QR generation fallback:", e);
  }
  const safeText = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="100%" height="100%" fill="#ffffff"/><rect x="10" y="10" width="28" height="28" fill="#000000"/><rect x="14" y="14" width="20" height="20" fill="#ffffff"/><rect x="18" y="18" width="12" height="12" fill="#000000"/><rect x="82" y="10" width="28" height="28" fill="#000000"/><rect x="86" y="14" width="20" height="20" fill="#ffffff"/><rect x="90" y="18" width="12" height="12" fill="#000000"/><rect x="10" y="82" width="28" height="28" fill="#000000"/><rect x="14" y="86" width="20" height="20" fill="#ffffff"/><rect x="18" y="90" width="12" height="12" fill="#000000"/><rect x="46" y="20" width="8" height="20" fill="#000000"/><rect x="62" y="20" width="12" height="8" fill="#000000"/><rect x="46" y="52" width="28" height="16" fill="#000000"/><rect x="52" y="58" width="16" height="4" fill="#ffffff"/><rect x="82" y="60" width="28" height="8" fill="#000000"/><rect x="20" y="52" width="18" height="8" fill="#000000"/><rect x="82" y="82" width="12" height="12" fill="#000000"/><rect x="98" y="98" width="12" height="12" fill="#000000"/><rect x="46" y="82" width="28" height="28" fill="#000000"/><rect x="52" y="88" width="16" height="16" fill="#ffffff"/><text x="60" y="116" font-family="monospace" font-size="7" font-weight="bold" text-anchor="middle" fill="#000000">QR CODE</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function renderPrintGrid() {
  const grid = document.getElementById('print-tags-grid');
  const countEl = document.getElementById('print-count');
  if (!grid) return;
  grid.innerHTML = '';

  const cols = appState.printColumns || 2;
  const gap = appState.tagGap !== undefined ? appState.tagGap : '1';

  grid.className = `tag-grid cols-${cols} bg-white text-black p-0 border border-black min-h-[400px] rounded-none`;
  grid.style.gap = `${gap}mm`;

  const combined = [...(appState.generatedTags || []), ...((appState.printLogTags || []))];
  const tags = combined;
  if (countEl) countEl.textContent = tags.length;
  const sidebarPrintCount = document.getElementById('sidebar-print-count');
  if (sidebarPrintCount) sidebarPrintCount.textContent = tags.length;

  if (tags.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-black font-semibold">No generated tags in print queue. Use the Tag Generator tab to create tags or load a log batch.</div>`;
    return;
  }

  const tagH = appState.tagHeightMm || 23;
  const isUltraCompact = tagH <= 28;
  const is3Cols = cols === 3;
  const is1Col = cols === 1;

  tags.forEach(tag => {
    const schedVal = tag.schedule || tag.po || '';
    const layJobVal = tag.layJobNo || tag.jobNo || tag.pattern || 'N/A';
    const docketVal = tag.docketNo || tag.docket || '';
    const displaySize = (tag.sizeRatio > 1 && tag.sizeCopy && !/-[0-9]+$/.test(tag.size))
      ? `${tag.baseSize || tag.size}-${tag.sizeCopy}`
      : (tag.size || '');
    const qrDataContent = tag.qrData || tag.id || `ID:${tag.id}|STYLE:${tag.style}|CLR:${tag.color}|SCH:${schedVal}|JOB:${layJobVal}|DOC:${docketVal}|SZ:${displaySize}|PART:${tag.part}|SHD:${tag.shade || 'A'}|BND:${tag.bundleSeq}/${tag.ratioTotal || 1}|PLY:${tag.plyRange}`;
    const qrImgUrl = getQRCodeUrl(qrDataContent);

    const card = document.createElement('div');
    const heightStyle = `height: ${tagH}mm; min-height: ${tagH}mm; max-height: ${tagH}mm; box-sizing: border-box;`;

    card.className = `tag-card border border-black bg-white text-black flex flex-row items-stretch justify-between relative overflow-hidden gap-1 rounded-none ${isUltraCompact ? 'p-[1.5px]' : is3Cols ? 'p-1' : 'p-1.5'}`;
    card.setAttribute('style', `${heightStyle} page-break-inside: avoid; break-inside: avoid;`);
    card.innerHTML = `
      <!-- 3/4 LEFT INFO SECTION (75% OF TAG) -->
      <div class="tag-info-box w-[75%] min-w-0 flex flex-col justify-between h-full py-0 pr-0.5 shrink-0 overflow-hidden">
        <!-- Compact Upper Header with Min Line Space & Larger Font -->
        <div class="flex items-center justify-between border-b border-black ${isUltraCompact ? 'pb-[1px] mb-[1px]' : 'pb-0.5 mb-0.5'} gap-1 shrink-0">
          <span class="font-black ${isUltraCompact ? 'text-[10px] leading-none' : is3Cols ? 'text-[11px]' : 'text-[13px] sm:text-[14px]'} uppercase tracking-tight text-black truncate ${is3Cols ? 'max-w-[80px]' : 'max-w-[140px]'}" title="${tag.style}">${tag.style}</span>
          <div class="flex items-center gap-1 shrink-0">
            ${tag.shade ? `<span class="tag-badge-gray font-mono ${isUltraCompact ? 'text-[8px] px-1 py-[1px] leading-none' : is3Cols ? 'text-[9px] px-1.5' : 'text-[10px] sm:text-[10.5px] px-2 py-0.5'} font-black bg-slate-200 text-black border border-black rounded-none">SHADE ${tag.shade}</span>` : ''}
            <span class="font-mono ${isUltraCompact ? 'text-[10.5px] px-1.5 py-[1px] border border-black leading-none' : is3Cols ? 'text-[11.5px] px-2 border-2 border-black leading-tight' : 'text-[13px] sm:text-[14px] px-2.5 py-0.5 border-2 border-black leading-tight'} font-black bg-white text-black rounded-none">${displaySize}</span>
          </div>
        </div>
        <!-- 4-Row Information Grid with Min Line Space and Larger Font -->
        <div class="grid grid-cols-2 gap-x-1 ${isUltraCompact ? 'gap-y-[0.5px] text-[9px] leading-tight py-0 my-auto' : is3Cols ? 'gap-y-[1px] text-[9px] leading-tight py-0.5' : 'gap-y-[1px] text-[10px] sm:text-[10.5px] leading-tight py-0.5'} font-bold text-black flex-1">
          <div class="col-span-2 truncate" title="${tag.color}"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">CLR:</span> <strong class="text-black font-black ${isUltraCompact ? 'text-[9px]' : ''}">${tag.color}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">LAY JOB:</span> <strong class="text-black font-black ${isUltraCompact ? 'text-[9px]' : ''}">${layJobVal}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">DOCKET:</span> <strong class="text-black font-black font-mono ${isUltraCompact ? 'text-[9px]' : ''}">${docketVal || '-'}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">PATTERN:</span> <strong class="text-black font-black ${isUltraCompact ? 'text-[9px]' : ''}">${tag.patternText || '-'}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">PART:</span> <strong class="text-black font-black ${isUltraCompact ? 'text-[9px]' : ''}">${tag.part}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">SCH #:</span> <strong class="text-black font-black font-mono ${isUltraCompact ? 'text-[9px]' : ''}">${schedVal}</strong></div>
          <div class="truncate"><span class="text-black uppercase ${isUltraCompact ? 'text-[7.5px]' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-extrabold">EMB:</span> <strong class="text-black font-black ${isUltraCompact ? 'text-[9px]' : ''}">${tag.embellishmentStyle === 'Yes' ? 'Yes ✦' : 'No'}</strong></div>
        </div>
        <!-- Fully Adjusted Bottom Bar with Larger Font and Min Line Space -->
        <div class="flex items-center justify-between border-t border-black ${isUltraCompact ? 'pt-[1px] mt-[1px] mb-0' : 'pt-0.5 mt-0.5 mb-0.5'} gap-1 shrink-0">
          <div class="font-mono ${isUltraCompact ? 'text-[8px] leading-none' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-black text-black truncate shrink-0" title="Sequence: ${tag.bundleSeq}/${tag.ratioTotal || 1}">
            SEQ: ${tag.bundleSeq}/${tag.ratioTotal || 1}
          </div>
          <div class="font-mono ${isUltraCompact ? 'text-[8px] leading-none' : is3Cols ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]'} font-black text-black truncate px-0.5 text-center" title="Tag ID: ${tag.id || '-'}">
            ID: ${tag.id || '-'}
          </div>
          <div class="tag-badge-gray ${isUltraCompact ? 'text-[8.5px] px-1.5 py-[1px] leading-none' : is3Cols ? 'text-[8.5px] px-1.5' : 'text-[10px] sm:text-[10.5px] px-2 py-0.5'} font-mono font-black text-black bg-slate-200 rounded-none border border-black shrink-0">
            PLY: ${tag.plyRange}
          </div>
        </div>
      </div>

      <!-- 1/4 RIGHT QR CODE SECTION (ALWAYS 25% OF TAG) -->
      <div class="tag-qr-box w-[25%] min-w-[25%] max-w-[25%] h-full border-l-2 border-black ${isUltraCompact ? 'pl-0.5 pr-0.5 py-0' : 'pl-1 pr-0.5 py-0.5'} flex flex-col items-center justify-between shrink-0 bg-white rounded-none">
        <div class="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden">
          <img src="${qrImgUrl}"
               alt="QR Code"
               class="tag-qr-img max-h-full max-w-full aspect-square border border-black ${isUltraCompact ? 'p-[1px]' : 'p-0.5'} rounded-none bg-white object-contain" />
        </div>
        <span class="font-mono ${isUltraCompact ? 'text-[5.5px] leading-none mt-[1px] py-0 px-0.5' : is3Cols ? 'text-[6px]' : 'text-[7px]'} font-black text-black text-center truncate max-w-full bg-white rounded-none border border-black w-full text-center">
          ${tag.tagString}
        </span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function clearPrintPreview() {
  appState.generatedTags = [];
  appState.printLogTags = [];
  renderPrintGrid();
}
