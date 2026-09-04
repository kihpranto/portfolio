/**
 * GarmentTag Numbering Chart & Recut Sheet Engine
 * Brandix Bangladesh Ltd. Unit 2 Edition
 */

let currentChartSource = 'current';
let selectedChartBatchIds = [];
let chartRowHeight = 27;
let chartSheetMode = 'both'; // 'both', 'chart', 'emb'
let chartEmbOverride = 'auto'; // 'auto', 'yes', 'no'

const chartData = {
  schedule: '',
  po: '',
  style: '',
  color: '',
  layJobNo: '',
  jobNo: '',
  pattern: '',
  patternText: '',
  embellishmentStyle: 'No',
  docketNo: '',
  docket: '',
  dateStr: '',
  timeStr: '',
  gridColumns: 4,
  preparedBy: '',
  rows: []
};

function isDataEmbellishment(data) {
  if (chartEmbOverride === 'yes') return true;
  if (chartEmbOverride === 'no') return false;
  return String(data?.embellishmentStyle || '').toLowerCase() === 'yes';
}

function getChartDataForBatch(bId) {
  if (!bId) return null;

  const cleanBId = String(bId).trim();
  const matchingLogs = (appState.logs || []).filter(l => {
    const itemBatchId = String(l.batchId || l.id || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`).trim();
    return itemBatchId === cleanBId || 
           itemBatchId === `BDL-${cleanBId}` || 
           `BDL-${itemBatchId}` === cleanBId || 
           String(l.batchId || '') === cleanBId || 
           String(l.id || '') === cleanBId;
  });

  const first = (matchingLogs && matchingLogs.length > 0) ? matchingLogs[0] : null;
  const schedVal = first ? (first.schedule || first.po || 'N/A') : '';
  const layJobVal = first ? (first.layJobNo || first.jobNo || first.pattern || 'N/A') : 'N/A';
  const docketVal = first ? (first.docketNo || first.docket || '') : '';

  const allTags = [];
  if (matchingLogs && matchingLogs.length > 0) {
    matchingLogs.forEach(l => {
      if (Array.isArray(l.tags) && l.tags.length > 0) {
        allTags.push(...l.tags);
      }
    });
  }

  if (allTags.length === 0) {
    const stored = (appState.allStoredTags || []).filter(t => t && (
      t.batchId === cleanBId || 
      t.batchId === `BDL-${cleanBId}` || 
      `BDL-${t.batchId}` === cleanBId
    ));
    if (stored.length > 0) allTags.push(...stored);
  }

  if (allTags.length === 0) {
    const queued = [...(appState.printLogTags || []), ...(appState.generatedTags || [])].filter(t => t && (
      t.batchId === cleanBId || 
      t.batchId === `BDL-${cleanBId}` || 
      `BDL-${t.batchId}` === cleanBId
    ));
    if (queued.length > 0) allTags.push(...queued);
  }

  // Detect embellishment style & pattern text
  let embVal = (first && (first.embellishmentStyle || first.embellishment)) || '';
  if (!embVal || embVal === 'No') {
    const foundEmbTag = allTags.find(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes');
    if (foundEmbTag) embVal = 'Yes';
  }
  if (!embVal) embVal = 'No';

  let patternTextVal = (first && (first.patternText || (first.pattern !== first.layJobNo ? first.pattern : ''))) || '';
  if (!patternTextVal) {
    const foundPatTag = allTags.find(t => t.patternText);
    if (foundPatTag) patternTextVal = foundPatTag.patternText;
  }

  const cData = {
    batchId: cleanBId,
    schedule: schedVal,
    po: schedVal,
    style: first ? (first.style || 'N/A') : 'N/A',
    color: first ? (first.color || 'N/A') : 'N/A',
    layJobNo: layJobVal,
    jobNo: layJobVal,
    pattern: layJobVal,
    patternText: patternTextVal,
    embellishmentStyle: embVal,
    docketNo: docketVal,
    docket: docketVal,
    preparedBy: '',
    dateStr: first && first.timestamp ? String(first.timestamp).split(' ')[0] : new Date().toLocaleDateString(),
    timeStr: first && first.timestamp ? String(first.timestamp).split(' ').slice(1).join(' ') : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rows: []
  };

  const map = new Map();
  allTags.forEach(t => {
    const bundleSeq = (t.bundleSeq !== undefined && t.bundleSeq !== null && !isNaN(Number(t.bundleSeq))) 
      ? Number(t.bundleSeq) 
      : ((t.id && !isNaN(Number(t.id))) ? Number(t.id) : 1);
    const size = t.size || 'N/A';
    const shade = t.shade || 'A';
    let plyRange = t.plyRange || '';

    let startP = t.startPly;
    let endP = t.endPly;
    if (startP === undefined || endP === undefined || isNaN(Number(startP)) || isNaN(Number(endP))) {
      const match = String(plyRange).match(/(\d+)\s*[\–\-]\s*(\d+)/);
      if (match) {
        startP = parseInt(match[1], 10);
        endP = parseInt(match[2], 10);
      } else {
        const single = String(plyRange).match(/(\d+)/);
        if (single) {
          startP = parseInt(single[1], 10);
          endP = startP;
        } else {
          startP = 1;
          endP = 1;
        }
      }
    } else {
      startP = parseInt(startP, 10);
      endP = parseInt(endP, 10);
    }

    const key = `${bundleSeq}-${size}-${shade}-${startP}-${endP}`;
    if (!map.has(key)) {
      const qty = Math.max(1, endP - startP + 1);
      map.set(key, {
        id: 'row-' + Math.random().toString(36).substring(2, 7),
        bundleNo: bundleSeq,
        size: size,
        startPly: startP,
        endPly: endP,
        quantity: qty,
        shade: `Shade : ${shade}`
      });
    }
  });

  if (map.size === 0 && first) {
    let startSeq = 1;
    let endSeq = 1;
    if (first.seqRange) {
      const m = String(first.seqRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(first.seqRange).match(/(\d+)/);
      if (m) {
        startSeq = parseInt(m[1], 10);
        endSeq = parseInt(m[2] || m[1], 10);
      }
    }
    let startPly = 1;
    let endPly = 1;
    if (first.plyRange) {
      const m = String(first.plyRange).match(/(\d+)[\s\–\-]+(\d+)/) || String(first.plyRange).match(/(\d+)/);
      if (m) {
        startPly = parseInt(m[1], 10);
        endPly = parseInt(m[2] || m[1], 10);
      }
    }
    const totalPlies = Math.max(1, endPly - startPly + 1);
    const totalBundles = Math.max(1, endSeq - startSeq + 1);
    const pliesPerBundle = Math.floor(totalPlies / totalBundles) || totalPlies;

    const sizeTokens = [];
    if (first.sizesSummary && first.sizesSummary !== 'N/A') {
      first.sizesSummary.split(',').forEach(part => {
        const m = part.trim().match(/^([^(]+)(?:\((\d+)\))?/);
        if (m) {
          const sz = m[1].trim();
          const count = parseInt(m[2] || '1', 10);
          for (let k = 1; k <= count; k++) {
            sizeTokens.push(count > 1 ? `${sz}-${k}` : sz);
          }
        }
      });
    }

    let currPly = startPly;
    for (let seq = startSeq; seq <= endSeq; seq++) {
      const idx = seq - startSeq;
      const sz = sizeTokens[idx] || sizeTokens[0] || 'M';
      const ePly = (seq === endSeq) ? endPly : (currPly + pliesPerBundle - 1);
      const qty = Math.max(1, ePly - currPly + 1);
      map.set(`fallback-${seq}`, {
        id: 'row-' + seq,
        bundleNo: seq,
        size: sz,
        startPly: currPly,
        endPly: ePly,
        quantity: qty,
        shade: 'Shade : A'
      });
      currPly = ePly + 1;
    }
  }

  cData.rows = Array.from(map.values()).sort((a, b) => Number(a.bundleNo) - Number(b.bundleNo));
  return cData;
}

/**
 * Renders the Main Numbering & Recut Chart HTML
 * - Header includes Brandix Logo and Company Name Header
 * - Top-left date/time REMOVED
 * - Top-right Defect SL / SL NO REMOVED
 */
function renderSingleChartHtml(data, cols = 4) {
  if (!data || !data.rows || data.rows.length === 0) return '';
  const displayedRows = data.rows || [];
  const rh = chartRowHeight || 27;
  const fontSize = rh <= 18 ? '8px' : rh <= 24 ? '9px' : rh <= 32 ? '10px' : '11px';
  const fontSizeSmall = rh <= 18 ? '7.5px' : rh <= 24 ? '8.5px' : rh <= 32 ? '9px' : '10px';
  const totalQty = displayedRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const isEmb = isDataEmbellishment(data);

  return `
    <div style="color:#000000!important; margin:0!important; padding:0!important;" class="text-black bg-white font-sans">
      <!-- Company Header with Logo & Name (Brandix Bangladesh Ltd. Unit 2) -->
      <div class="flex items-center justify-between border-b-2 border-black pb-1 mb-1 px-0.5 text-black">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <img src="https://epro.lk/wp-content/uploads/2024/12/Brandix.png" 
               alt="Brandix Logo" 
               onerror="this.onerror=null; this.src='Brandix.png';" 
               class="h-8 sm:h-9 max-h-9 object-contain shrink-0" />
          <div>
            <h1 class="text-sm sm:text-base font-black tracking-tight text-black uppercase leading-tight font-sans">
              Brandix Bangladesh Ltd. Unit 2
            </h1>
            <h2 class="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-700 uppercase leading-tight font-sans">
              NUMBERING, ISSUING RECUT & CHART
            </h2>
          </div>
        </div>
        ${isEmb ? `
          <div class="shrink-0 text-right">
            <span class="inline-block border-2 border-black px-2 py-0.5 text-[8.5px] font-black tracking-wider uppercase bg-slate-100 text-black">
              EMB STYLE: YES
            </span>
          </div>
        ` : ''}
      </div>

      <!-- Batch Specifications Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-6 gap-y-0.5 gap-x-2 text-[9px] font-medium text-black mb-1 bg-slate-50/70 p-1 border border-black rounded-none">
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">SCHEDULE#</span>
          <strong class="text-black font-bold font-mono text-[10px]">${data.schedule || data.po || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">STYLE</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.style || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">COLOR</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.color || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">LAY JOB NO</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.layJobNo || data.jobNo || data.pattern || 'N/A'}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">DOCKET NO</span>
          <strong class="text-black font-mono font-bold text-[10px] truncate block">${data.docketNo || data.docket || '-'}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">PATTERN / EMB</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.patternText || (data.pattern && data.pattern !== data.layJobNo ? data.pattern : (isEmb ? 'EMB STYLE: YES' : '-'))}</strong>
        </div>
      </div>

      <!-- Bundle Grid Table -->
      <div class="w-full overflow-x-auto text-black">
        <table class="w-full text-left border-collapse border-2 border-black text-[9px] table-fixed bg-white text-black">
          <thead>
            <tr class="border-b-2 border-black bg-slate-100 font-black uppercase text-black" style="height:${rh}px; font-size:${fontSizeSmall}">
              <th class="py-0 px-0.5 text-center border-r border-black w-[11%] text-black">BUNDLE NO</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[13%] text-black">SIZE & INSEAM</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[10%] text-black">START PLY</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[10%] text-black">END PLY</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[10%] text-black">QUANTITY</th>
              <th class="py-0 px-1 text-left border-r-2 border-black w-[14%] text-black">SHADE</th>
              <th colSpan="${cols}" class="py-0 px-0.5 text-center bg-slate-100 border-b-2 border-black font-black tracking-wider text-black">
                DEFECT SL
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-black text-[9px] font-semibold text-black">
            ${displayedRows.map(row => `
              <tr class="border-b border-black text-black" style="height:${rh}px">
                <td class="py-0 px-0.5 text-center border-r border-black font-mono font-bold text-black" style="font-size:${fontSize}">${row.bundleNo}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-bold text-black" style="font-size:${fontSize}">${row.size}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono text-black" style="font-size:${fontSize}">${row.startPly}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono text-black" style="font-size:${fontSize}">${row.endPly}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono font-bold text-black" style="font-size:${fontSize}">${row.quantity}</td>
                <td class="py-0 px-1 text-left border-r-2 border-black font-medium whitespace-nowrap text-black" style="font-size:${fontSize}">${row.shade}</td>
                ${Array.from({ length: cols }).map(() => `
                  <td class="border-r border-black last:border-r-0 p-0 relative overflow-hidden" style="height:${rh}px">
                    <svg class="absolute inset-0 w-full h-full text-black stroke-current" style="stroke-width:0.8">
                      <line x1="0" y1="100%" x2="100%" y2="0" />
                    </svg>
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Total Quantity -->
      <div class="mt-1 flex justify-start pl-0.5 text-black">
        <div class="text-[9px] font-black text-black font-mono tracking-tight flex items-center gap-1 bg-slate-100 px-2 py-0.5 border border-black rounded-none">
          <span>Total:</span>
          <span class="text-xs text-black font-black">${totalQty}</span>
        </div>
      </div>

      <!-- Signatures -->
      <div class="mt-3 pt-1 border-t border-black grid grid-cols-3 gap-3 text-center text-[9px] font-bold text-black">
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-24 sm:w-28"></div>
          </div>
          <p class="text-black">${data.preparedBy ? data.preparedBy : 'Prepared by'}</p>
        </div>
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-24 sm:w-28"></div>
          </div>
          <p class="text-black">Cutting Recorder</p>
        </div>
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-24 sm:w-28"></div>
          </div>
          <p class="text-black">Line Recorder</p>
        </div>
      </div>

      <!-- Footer with Date & Time -->
      <div class="mt-1 flex items-center justify-between text-[8px] text-black border-t border-black pt-0.5">
        <div class="text-black font-mono">
          Date:${data.dateStr || new Date().toLocaleDateString()} Time:${data.timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div class="font-serif italic text-black font-bold">
          BBAN2 Cutting
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Separate Embellishment Reconciliation Sheet HTML
 * - Embellishment specific columns: BUNDLE NO, SIZE, PLY RANGE, SENT QTY, SHADE, RCVD QTY, DEFECT/REJECT, RECUT, PASS/OK
 * - Summary boxes & reconciliation signatures (Cutting Dispatcher, EMB Receiver, EMB QC Inspector, Line Receiver)
 */
function renderEmbellishmentReconciliationHtml(data, cols = 4) {
  if (!data || !data.rows || data.rows.length === 0) return '';
  const displayedRows = data.rows || [];
  const rh = chartRowHeight || 27;
  const fontSize = rh <= 18 ? '8px' : rh <= 24 ? '9px' : rh <= 32 ? '10px' : '11px';
  const fontSizeSmall = rh <= 18 ? '7.5px' : rh <= 24 ? '8.5px' : rh <= 32 ? '9px' : '10px';
  const totalQty = displayedRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  return `
    <div style="color:#000000!important; margin:0!important; padding:0!important;" class="text-black bg-white font-sans">
      <!-- Embellishment Sheet Header with Brandix Logo -->
      <div class="flex items-center justify-between border-b-2 border-black pb-1 mb-1 px-0.5 text-black">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <img src="https://epro.lk/wp-content/uploads/2024/12/Brandix.png" 
               alt="Brandix Logo" 
               onerror="this.onerror=null; this.src='Brandix.png';" 
               class="h-8 sm:h-9 max-h-9 object-contain shrink-0" />
          <div>
            <h1 class="text-sm sm:text-base font-black tracking-tight text-black uppercase leading-tight font-sans">
              Brandix Bangladesh Ltd. Unit 2
            </h1>
            <h2 class="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-700 uppercase leading-tight font-sans">
              EMBELLISHMENT RECONCILIATION SHEET
            </h2>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <span class="inline-block border-2 border-black px-2 py-0.5 text-[8.5px] font-black tracking-wider uppercase bg-slate-100 text-black">
            EMBELLISHMENT RECONCILIATION
          </span>
        </div>
      </div>

      <!-- Batch Specifications Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-6 gap-y-0.5 gap-x-2 text-[9px] font-medium text-black mb-1 bg-slate-50/70 p-1 border border-black rounded-none">
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">SCHEDULE#</span>
          <strong class="text-black font-bold font-mono text-[10px]">${data.schedule || data.po || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">STYLE</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.style || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">COLOR</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.color || ''}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">LAY JOB NO</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.layJobNo || data.jobNo || data.pattern || 'N/A'}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">DOCKET NO</span>
          <strong class="text-black font-mono font-bold text-[10px] truncate block">${data.docketNo || data.docket || '-'}</strong>
        </div>
        <div>
          <span class="block text-[8px] font-bold text-black uppercase tracking-wider">PATTERN / EMB</span>
          <strong class="text-black font-bold text-[10px] truncate block">${data.patternText || (data.pattern && data.pattern !== data.layJobNo ? data.pattern : 'EMB STYLE: YES')}</strong>
        </div>
      </div>

      <!-- Embellishment Reconciliation Table -->
      <div class="w-full overflow-x-auto text-black">
        <table class="w-full text-left border-collapse border-2 border-black text-[9px] table-fixed bg-white text-black">
          <thead>
            <tr class="border-b-2 border-black bg-slate-100 font-black uppercase text-black" style="height:${rh}px; font-size:${fontSizeSmall}">
              <th class="py-0 px-0.5 text-center border-r border-black w-[9%] text-black">BUNDLE NO</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[11%] text-black">SIZE & INSEAM</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[8%] text-black">START PLY</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[8%] text-black">END PLY</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[8%] text-black">QUANTITY</th>
              <th class="py-0 px-1 text-left border-r-2 border-black w-[11%] text-black">SHADE</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[15%] text-black bg-slate-200/80 font-black tracking-wider">EMB SEND</th>
              <th class="py-0 px-0.5 text-center border-r border-black w-[15%] text-black bg-slate-200/80 font-black tracking-wider">EMB PLANT SEND</th>
              <th class="py-0 px-0.5 text-center border-black w-[15%] text-black bg-slate-200/80 font-black tracking-wider">EMB RECEIVED</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-black text-[9px] font-semibold text-black">
            ${displayedRows.map(row => `
              <tr class="border-b border-black text-black" style="height:${rh}px">
                <td class="py-0 px-0.5 text-center border-r border-black font-mono font-bold text-black" style="font-size:${fontSize}">${row.bundleNo}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-bold text-black" style="font-size:${fontSize}">${row.size}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono text-black" style="font-size:${fontSize}">${row.startPly}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono text-black" style="font-size:${fontSize}">${row.endPly}</td>
                <td class="py-0 px-0.5 text-center border-r border-black font-mono font-bold text-black" style="font-size:${fontSize}">${row.quantity}</td>
                <td class="py-0 px-1 text-left border-r-2 border-black font-medium whitespace-nowrap text-black" style="font-size:${fontSize}">${row.shade}</td>
                <td class="border-r border-black p-0 relative overflow-hidden" style="height:${rh}px">
                  <svg class="absolute inset-0 w-full h-full text-black stroke-current" style="stroke-width:0.8">
                    <line x1="0" y1="100%" x2="100%" y2="0" />
                  </svg>
                  <span class="absolute top-0.5 left-1.5 font-mono font-bold text-black z-10 leading-tight bg-white/70 px-0.5" style="font-size:${fontSize}">${row.quantity}</span>
                </td>
                <td class="border-r border-black p-0 relative overflow-hidden" style="height:${rh}px">
                  <svg class="absolute inset-0 w-full h-full text-black stroke-current" style="stroke-width:0.8">
                    <line x1="0" y1="100%" x2="100%" y2="0" />
                  </svg>
                </td>
                <td class="border-black p-0 relative overflow-hidden" style="height:${rh}px">
                  <svg class="absolute inset-0 w-full h-full text-black stroke-current" style="stroke-width:0.8">
                    <line x1="0" y1="100%" x2="100%" y2="0" />
                  </svg>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Reconciliation Summary Totals -->
      <div class="mt-1 flex items-center justify-between pl-0.5 pr-0.5 text-black flex-wrap gap-1">
        <div class="flex items-center gap-2">
          <div class="text-[9px] font-black text-black font-mono tracking-tight flex items-center gap-1 bg-slate-100 px-2 py-0.5 border border-black rounded-none">
            <span>Total Quantity:</span>
            <span class="text-xs text-black font-black">${totalQty}</span>
          </div>
          <div class="text-[9px] font-black text-black font-mono tracking-tight flex items-center gap-1 bg-slate-100 px-2 py-0.5 border border-black rounded-none">
            <span>Total EMB Send:</span>
            <span class="text-xs text-black font-black">${totalQty}</span>
          </div>
          <div class="text-[9px] font-bold text-black font-mono tracking-tight flex items-center gap-1 bg-white px-2 py-0.5 border border-black rounded-none">
            <span>Total EMB Plant Send:</span>
            <span class="text-[10px] text-black font-bold min-w-10 inline-block">&nbsp;</span>
          </div>
          <div class="text-[9px] font-bold text-black font-mono tracking-tight flex items-center gap-1 bg-white px-2 py-0.5 border border-black rounded-none">
            <span>Total EMB Received:</span>
            <span class="text-[10px] text-black font-bold min-w-10 inline-block">&nbsp;</span>
          </div>
        </div>
      </div>

      <!-- Signatures for Embellishment Reconciliation -->
      <div class="mt-3 pt-1 border-t border-black grid grid-cols-4 gap-2 text-center text-[9px] font-bold text-black">
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-20 sm:w-24"></div>
          </div>
          <p class="text-black">${data.preparedBy ? data.preparedBy : 'Prepared by'}</p>
        </div>
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-20 sm:w-24"></div>
          </div>
          <p class="text-black">Cutting Recorder</p>
        </div>
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-20 sm:w-24"></div>
          </div>
          <p class="text-black">EMB Recorder</p>
        </div>
        <div>
          <div class="h-11 flex items-end justify-center mb-1">
            <div class="border-t border-dashed border-black w-20 sm:w-24"></div>
          </div>
          <p class="text-black">Line Recorder</p>
        </div>
      </div>

      <!-- Footer with Date & Time -->
      <div class="mt-1 flex items-center justify-between text-[8px] text-black border-t border-black pt-0.5">
        <div class="text-black font-mono">
          Date:${data.dateStr || new Date().toLocaleDateString()} Time:${data.timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div class="font-serif italic text-black font-bold">
          BBAN2 Embellishment Section
        </div>
      </div>
    </div>
  `;
}

/**
 * Helper to render complete printable pages for a batch
 * If embellishment is yes (or forced), appends the Embellishment Reconciliation Sheet
 */
function renderBatchCompleteSheetsHtml(data, cols = 4, isMultiBatch = false, batchIdx = 0) {
  if (!data || !data.rows || data.rows.length === 0) return '';
  const isEmb = isDataEmbellishment(data);
  let html = '';

  const showChart = chartSheetMode === 'both' || chartSheetMode === 'chart';
  const showEmb = (chartSheetMode === 'both' && isEmb) || chartSheetMode === 'emb';

  if (showChart) {
    html += `
      <div class="chart-print-page bg-white p-0 mb-6 ${isMultiBatch && batchIdx > 0 ? 'border-t-2 border-dashed border-slate-300 pt-6' : ''}">
        ${renderSingleChartHtml(data, cols)}
      </div>
    `;
  }

  if (showEmb) {
    const dividerClass = showChart 
      ? 'border-t-2 border-dashed border-slate-300 pt-6 mt-6' 
      : (isMultiBatch && batchIdx > 0 ? 'border-t-2 border-dashed border-slate-300 pt-6 mt-6' : '');
    html += `
      <div class="chart-print-page bg-white p-0 mb-6 ${dividerClass}">
        ${renderEmbellishmentReconciliationHtml(data, cols)}
      </div>
    `;
  }

  return html;
}

function generateChartFromLogBatch(bId) {
  if (!bId) return;
  currentChartSource = 'log-' + bId;
  const bData = getChartDataForBatch(bId);
  if (!bData) {
    showToast("No log entries found for Batch ID: " + bId, "error");
    chartData.rows = [];
    renderNumberingSheet();
    return;
  }

  Object.assign(chartData, bData);
  const selectEl = document.getElementById('chart-source-select');
  if (selectEl) selectEl.value = currentChartSource;
  renderNumberingSheet();
  if (typeof switchTab === 'function') switchTab('chart');
  showToast(`Loaded Numbering Chart for Batch ${bId}`, 'success');
}

function generateMultipleChartsFromLogBatches(batchIds) {
  if (!Array.isArray(batchIds) || batchIds.length === 0) {
    showToast("No batch logs selected for numbering charts.", "warning");
    return;
  }

  currentChartSource = 'selected';
  selectedChartBatchIds = [...batchIds];

  const container = document.getElementById('numbering-sheet-container');
  if (!container) return;

  const cols = chartData.gridColumns || 4;
  let allHtml = '';

  batchIds.forEach((bId, idx) => {
    const bData = getChartDataForBatch(bId);
    if (bData && bData.rows && bData.rows.length > 0) {
      allHtml += renderBatchCompleteSheetsHtml(bData, cols, true, idx);
    }
  });

  if (!allHtml) {
    showToast("No chart data found for the selected batches.", "error");
    return;
  }

  container.innerHTML = allHtml;
  if (typeof switchTab === 'function') switchTab('chart');
  renderNumberingChartUI();
  showToast(`Loaded ${batchIds.length} separate batch sheet(s) ready to print!`, 'success');
}

function loadCurrentGeneratedTagsToChart() {
  const combined = [...(appState.generatedTags || []), ...(appState.printLogTags || [])];
  if (!combined || combined.length === 0) {
    chartData.rows = [];
    renderNumberingSheet();
    return;
  }

  // Check if multiple distinct batches exist in the queue:
  const batchGroups = {};
  combined.forEach(t => {
    const bId = t.batchId || `${t.style}_${t.color}_${t.schedule || t.po || ''}`;
    if (!batchGroups[bId]) batchGroups[bId] = [];
    batchGroups[bId].push(t);
  });

  const bKeys = Object.keys(batchGroups);
  const container = document.getElementById('numbering-sheet-container');
  const cols = chartData.gridColumns || 4;

  if (bKeys.length > 1) {
    let allHtml = '';

    bKeys.forEach((bKey, idx) => {
      const bTags = batchGroups[bKey];
      const first = bTags[0];
      const schedVal = first.schedule || first.po || 'N/A';
      const layJobVal = first.layJobNo || first.jobNo || first.pattern || 'N/A';
      const docketVal = first.docketNo || first.docket || '';

      let embVal = (first.embellishmentStyle || first.embellishment) || '';
      if (!embVal || embVal === 'No') {
        if (bTags.some(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes')) {
          embVal = 'Yes';
        }
      }
      if (!embVal) embVal = 'No';
      let patternTextVal = first.patternText || (bTags.find(t => t.patternText)?.patternText || '');

      const map = new Map();
      bTags.forEach(t => {
        const bundleSeq = t.bundleSeq !== undefined && t.bundleSeq !== null ? t.bundleSeq : (t.id || '1');
        const size = t.size || 'N/A';
        const shade = t.shade || 'A';
        let plyRange = t.plyRange || '';
        let startP = t.startPly;
        let endP = t.endPly;
        if (startP === undefined || endP === undefined || isNaN(Number(startP)) || isNaN(Number(endP))) {
          const match = String(plyRange).match(/(\d+)\s*[\–\-]\s*(\d+)/);
          if (match) {
            startP = parseInt(match[1], 10);
            endP = parseInt(match[2], 10);
          } else {
            const single = String(plyRange).match(/(\d+)/);
            startP = single ? parseInt(single[1], 10) : 1;
            endP = startP;
          }
        } else {
          startP = parseInt(startP, 10);
          endP = parseInt(endP, 10);
        }

        const key = `${bundleSeq}-${size}-${shade}-${startP}-${endP}`;
        if (!map.has(key)) {
          const qty = Math.max(1, endP - startP + 1);
          map.set(key, {
            id: 'row-' + Math.random().toString(36).substring(2, 7),
            bundleNo: bundleSeq,
            size: size,
            startPly: startP,
            endPly: endP,
            quantity: qty,
            shade: `Shade : ${shade}`
          });
        }
      });

      const bData = {
        schedule: schedVal,
        po: schedVal,
        style: first.style || 'N/A',
        color: first.color || 'N/A',
        layJobNo: layJobVal,
        jobNo: layJobVal,
        pattern: layJobVal,
        patternText: patternTextVal,
        embellishmentStyle: embVal,
        docketNo: docketVal,
        docket: docketVal,
        dateStr: first.timestamp ? String(first.timestamp).split(' ')[0] : new Date().toLocaleDateString(),
        timeStr: first.timestamp ? String(first.timestamp).split(' ').slice(1).join(' ') : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rows: Array.from(map.values()).sort((a, b) => Number(a.bundleNo) - Number(b.bundleNo))
      };

      allHtml += renderBatchCompleteSheetsHtml(bData, cols, true, idx);
    });

    if (container) container.innerHTML = allHtml;
    return;
  }

  // Single batch in queue:
  const first = combined[0];
  const schedVal = first.schedule || first.po || 'N/A';
  const layJobVal = first.layJobNo || first.jobNo || first.pattern || 'N/A';
  const docketVal = first.docketNo || first.docket || '';

  let embVal = (first.embellishmentStyle || first.embellishment) || '';
  if (!embVal || embVal === 'No') {
    if (combined.some(t => String(t.embellishmentStyle || t.embellishment || '').toLowerCase() === 'yes')) {
      embVal = 'Yes';
    }
  }
  if (!embVal) embVal = 'No';
  let patternTextVal = first.patternText || (combined.find(t => t.patternText)?.patternText || '');

  chartData.schedule = schedVal;
  chartData.po = schedVal;
  chartData.style = first.style || 'N/A';
  chartData.color = first.color || 'N/A';
  chartData.layJobNo = layJobVal;
  chartData.jobNo = layJobVal;
  chartData.pattern = layJobVal;
  chartData.patternText = patternTextVal;
  chartData.embellishmentStyle = embVal;
  chartData.docketNo = docketVal;
  chartData.docket = docketVal;
  chartData.dateStr = first.timestamp ? String(first.timestamp).split(' ')[0] : new Date().toLocaleDateString();
  chartData.timeStr = first.timestamp ? String(first.timestamp).split(' ').slice(1).join(' ') : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const map = new Map();
  combined.forEach(t => {
    const bundleSeq = t.bundleSeq !== undefined && t.bundleSeq !== null ? t.bundleSeq : (t.id || '1');
    const size = t.size || 'N/A';
    const shade = t.shade || 'A';
    let plyRange = t.plyRange || '';

    let startP = t.startPly;
    let endP = t.endPly;
    if (startP === undefined || endP === undefined || isNaN(Number(startP)) || isNaN(Number(endP))) {
      const match = String(plyRange).match(/(\d+)\s*[\–\-]\s*(\d+)/);
      if (match) {
        startP = parseInt(match[1], 10);
        endP = parseInt(match[2], 10);
      } else {
        const single = String(plyRange).match(/(\d+)/);
        startP = single ? parseInt(single[1], 10) : 1;
        endP = startP;
      }
    } else {
      startP = parseInt(startP, 10);
      endP = parseInt(endP, 10);
    }

    const key = `${bundleSeq}-${size}-${shade}-${startP}-${endP}`;
    if (!map.has(key)) {
      const qty = Math.max(1, endP - startP + 1);
      map.set(key, {
        id: 'row-' + Math.random().toString(36).substring(2, 7),
        bundleNo: bundleSeq,
        size: size,
        startPly: startP,
        endPly: endP,
        quantity: qty,
        shade: `Shade : ${shade}`
      });
    }
  });

  chartData.rows = Array.from(map.values()).sort((a, b) => Number(a.bundleNo) - Number(b.bundleNo));
  renderNumberingSheet();
}

function loadSampleChartData() {
  chartData.schedule = 'SCH-8801';
  chartData.po = 'SCH-8801';
  chartData.style = 'SLIM-FIT-01';
  chartData.color = 'NAVY BLUE';
  chartData.layJobNo = 'JOB-101';
  chartData.jobNo = 'JOB-101';
  chartData.pattern = 'JOB-101';
  chartData.patternText = 'Standard Pattern A';
  chartData.embellishmentStyle = 'Yes';
  chartData.docketNo = '501680';
  chartData.docket = '501680';
  chartData.preparedBy = '';
  chartData.dateStr = new Date().toLocaleDateString();
  chartData.timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  chartData.rows = [
    { id: 'row-1', bundleNo: 1, size: 'M', startPly: 1, endPly: 10, quantity: 10, shade: 'Shade : A' },
    { id: 'row-2', bundleNo: 2, size: 'M', startPly: 11, endPly: 20, quantity: 10, shade: 'Shade : B' },
    { id: 'row-3', bundleNo: 3, size: 'L', startPly: 21, endPly: 30, quantity: 10, shade: 'Shade : A' },
    { id: 'row-4', bundleNo: 4, size: 'XL', startPly: 31, endPly: 40, quantity: 10, shade: 'Shade : A' }
  ];
  renderNumberingSheet();
  showToast("Loaded Sample Chart Template with Embellishment Sheet!", "info");
}

function onChartSourceSelectChange(val) {
  currentChartSource = val || 'current';
  if (!val) {
    chartData.schedule = '';
    chartData.po = '';
    chartData.style = '';
    chartData.color = '';
    chartData.jobNo = '';
    chartData.pattern = '';
    chartData.patternText = '';
    chartData.embellishmentStyle = 'No';
    chartData.rows = [];
    renderNumberingSheet();
    return;
  }
  if (val === 'sample') {
    loadSampleChartData();
    return;
  }
  if (val === 'current') {
    loadCurrentGeneratedTagsToChart();
    return;
  }
  if (val === 'selected') {
    if (selectedChartBatchIds && selectedChartBatchIds.length > 0) {
      generateMultipleChartsFromLogBatches(selectedChartBatchIds);
    } else {
      loadCurrentGeneratedTagsToChart();
    }
    return;
  }
  if (val === 'all-batches') {
    const allBIds = Array.from(new Set((appState.logs || []).map(l => l.batchId || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`)));
    generateMultipleChartsFromLogBatches(allBIds);
    return;
  }
  if (val.startsWith('log-')) {
    const bId = val.replace('log-', '');
    generateChartFromLogBatch(bId);
    return;
  }
  renderNumberingSheet();
}

function onChartColumnsChange(val) {
  chartData.gridColumns = Math.max(1, Math.min(10, parseInt(val, 10) || 4));
  renderNumberingSheet();
}

function onChartRowHeightChange(val) {
  chartRowHeight = Math.max(14, Math.min(50, parseInt(val, 10) || 27));
  const label = document.getElementById('chart-row-height-label');
  if (label) label.textContent = chartRowHeight + 'px';
  const slider = document.getElementById('chart-row-height');
  if (slider) slider.value = chartRowHeight;
  refreshCurrentChartDisplay();
}

function onChartSheetModeChange(val) {
  chartSheetMode = val || 'both';
  refreshCurrentChartDisplay();
}

function onChartEmbOverrideChange(val) {
  chartEmbOverride = val || 'auto';
  refreshCurrentChartDisplay();
}

function refreshCurrentChartDisplay() {
  if (currentChartSource === 'selected' && selectedChartBatchIds && selectedChartBatchIds.length > 0) {
    generateMultipleChartsFromLogBatches(selectedChartBatchIds);
  } else if (currentChartSource === 'all-batches') {
    const allBIds = Array.from(new Set((appState.logs || []).map(l => l.batchId || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`)));
    generateMultipleChartsFromLogBatches(allBIds);
  } else if (currentChartSource === 'current') {
    loadCurrentGeneratedTagsToChart();
  } else if (currentChartSource.startsWith('log-')) {
    const bId = currentChartSource.replace('log-', '');
    const bData = getChartDataForBatch(bId);
    if (bData) { Object.assign(chartData, bData); }
    renderNumberingSheet();
  } else {
    renderNumberingSheet();
  }
}

function renderNumberingChartUI() {
  const selectEl = document.getElementById('chart-source-select');
  const combined = [...(appState.generatedTags || []), ...(appState.printLogTags || [])];

  if (selectEl) {
    const uniqueBatches = Array.from(new Set((appState.logs || []).map(l => l.batchId || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    let optionsHtml = '';
    optionsHtml += `<option value="current" ${currentChartSource === 'current' ? 'selected' : ''}>⚡ Current Print Queue (${combined.length} Tags)</option>`;
    if (selectedChartBatchIds && selectedChartBatchIds.length > 0) {
      optionsHtml += `<option value="selected" ${currentChartSource === 'selected' ? 'selected' : ''}>📊 Selected Batches (${selectedChartBatchIds.length} Batches)</option>`;
    }
    if (uniqueBatches.length > 1) {
      optionsHtml += `<option value="all-batches" ${currentChartSource === 'all-batches' ? 'selected' : ''}>📑 All Database Batches (${uniqueBatches.length} Separate Sheets)</option>`;
    }
    uniqueBatches.forEach(bId => {
      const logVal = 'log-' + bId;
      optionsHtml += `<option value="${logVal}" ${currentChartSource === logVal ? 'selected' : ''}>🏷️ Batch ${bId}</option>`;
    });
    selectEl.innerHTML = optionsHtml;
    selectEl.value = currentChartSource;
    if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('chart-source-select');
  }

  const colSelectEl = document.getElementById('chart-columns-select');
  if (colSelectEl && chartData.gridColumns) {
    colSelectEl.value = String(chartData.gridColumns);
  }

  const sheetModeEl = document.getElementById('chart-sheet-mode');
  if (sheetModeEl) {
    sheetModeEl.value = chartSheetMode;
  }

  const embOverrideEl = document.getElementById('chart-emb-override');
  if (embOverrideEl) {
    embOverrideEl.value = chartEmbOverride;
  }

  if (currentChartSource === 'selected') {
    if (selectedChartBatchIds && selectedChartBatchIds.length > 0) {
      const container = document.getElementById('numbering-sheet-container');
      const cols = chartData.gridColumns || 4;
      let allHtml = '';
      selectedChartBatchIds.forEach((bId, idx) => {
        const bData = getChartDataForBatch(bId);
        if (bData && bData.rows && bData.rows.length > 0) {
          allHtml += renderBatchCompleteSheetsHtml(bData, cols, true, idx);
        }
      });
      if (container && allHtml) {
        container.innerHTML = allHtml;
        return;
      }
    }
  }

  if (currentChartSource === 'current') {
    loadCurrentGeneratedTagsToChart();
  } else if (currentChartSource === 'all-batches') {
    const allBIds = Array.from(new Set((appState.logs || []).map(l => l.batchId || `BDL-${String(l.timestamp || '').replace(/[^0-9]/g, '')}`)));
    generateMultipleChartsFromLogBatches(allBIds);
  } else if (currentChartSource.startsWith('log-')) {
    const bId = currentChartSource.replace('log-', '');
    const bData = getChartDataForBatch(bId);
    if (bData) {
      Object.assign(chartData, bData);
      renderNumberingSheet();
    } else {
      renderNumberingSheet();
    }
  } else {
    renderNumberingSheet();
  }
}

function renderNumberingSheet() {
  const container = document.getElementById('numbering-sheet-container');
  if (!container) return;

  if (!chartData.rows || chartData.rows.length === 0) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400 no-print">
        <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        <h3 class="font-bold text-slate-700 dark:text-slate-300 text-sm">No Tags in Print Queue</h3>
        <p class="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1">
          Generate tags in <strong>Tag Generator</strong> or click <strong>➕ Add to Queue</strong> on any batch in <strong>Bundle Logs</strong> to populate this chart.
        </p>
      </div>
    `;
    return;
  }

  const cols = chartData.gridColumns || 4;
  container.innerHTML = renderBatchCompleteSheetsHtml(chartData, cols, false, 0);
}

function exportChartAsPDF() {
  if (typeof executeBrowserPrint === 'function') executeBrowserPrint();
  else window.print();
}

function triggerPrintChart() {
  if (typeof executeBrowserPrint === 'function') executeBrowserPrint();
  else window.print();
}
