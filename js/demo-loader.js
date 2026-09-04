/**
 * StitchSync Tag - Garment Bundle Tag & Cut Identification Engine
 * Live Demo Data Loader & Auto-Connect Orchestrator
 * Pre-populates authentic apparel production data so visitors can immediately
 * understand, test, generate tags, and view live print previews & numbering charts.
 */

const DEMO_MASTER_DATA = [
  {
    id: "DEMO-01",
    style: "BWD011B6",
    color: "Bliss Black",
    schedule: "1347960",
    po: "1347960",
    layJobNo: "372916",
    jobNo: "372916",
    pattern: "372916",
    docketNo: "543139",
    docket: "543139",
    fabricCategory: "Cotton Spandex Single Jersey",
    uom: "PCS",
    grmtQty: "2400",
    sourceSheet: "Brandix Production Master",
    rowIndex: 1
  },
  {
    id: "DEMO-02",
    style: "BWD011C6",
    color: "Prachi Purple Prune",
    schedule: "1356936",
    po: "1356936",
    layJobNo: "385809",
    jobNo: "385809",
    pattern: "385809",
    docketNo: "560314",
    docket: "560314",
    fabricCategory: "Cotton Modal Interlock",
    uom: "PCS",
    grmtQty: "1800",
    sourceSheet: "Brandix Production Master",
    rowIndex: 2
  },
  {
    id: "DEMO-03",
    style: "VT0350H6",
    color: "VS25164-01 C13 Prty Blsm 7ZCC",
    schedule: "1361514",
    po: "1361514",
    layJobNo: "398093",
    jobNo: "398093",
    pattern: "398093",
    docketNo: "577465",
    docket: "577465",
    fabricCategory: "100% Poly Tricot Brushed",
    uom: "PCS",
    grmtQty: "3200",
    sourceSheet: "Brandix Production Master",
    rowIndex: 3
  },
  {
    id: "DEMO-04",
    style: "TT4568F6",
    color: "NAVY 411",
    schedule: "1318321",
    po: "1318321",
    layJobNo: "355498",
    jobNo: "355498",
    pattern: "355498",
    docketNo: "518730",
    docket: "518730",
    fabricCategory: "95% Cotton 5% Elastane",
    uom: "PCS",
    grmtQty: "1500",
    sourceSheet: "Brandix Production Master",
    rowIndex: 4
  },
  {
    id: "DEMO-05",
    style: "Polo Classic 101",
    color: "Navy Blue",
    schedule: "SCH-2026-001",
    po: "SCH-2026-001",
    layJobNo: "JOB-101-A",
    jobNo: "JOB-101-A",
    pattern: "JOB-101-A",
    docketNo: "543140",
    docket: "543140",
    fabricCategory: "Pique Knit 220 GSM",
    uom: "PCS",
    grmtQty: "1200",
    sourceSheet: "Brandix Production Master",
    rowIndex: 5
  },
  {
    id: "DEMO-06",
    style: "Polo Classic 101",
    color: "Heather Gray",
    schedule: "SCH-2026-001",
    po: "SCH-2026-001",
    layJobNo: "JOB-101-B",
    jobNo: "JOB-101-B",
    pattern: "JOB-101-B",
    docketNo: "543141",
    docket: "543141",
    fabricCategory: "Pique Knit 220 GSM",
    uom: "PCS",
    grmtQty: "1200",
    sourceSheet: "Brandix Production Master",
    rowIndex: 6
  },
  {
    id: "DEMO-07",
    style: "Denim Jacket X",
    color: "Raw Indigo",
    schedule: "SCH-2026-006",
    po: "SCH-2026-006",
    layJobNo: "JOB-506-IND",
    jobNo: "JOB-506-IND",
    pattern: "JOB-506-IND",
    docketNo: "560320",
    docket: "560320",
    fabricCategory: "12.5 oz Rigid Denim",
    uom: "PCS",
    grmtQty: "800",
    sourceSheet: "Brandix Production Master",
    rowIndex: 7
  },
  {
    id: "DEMO-08",
    style: "Denim Jacket X",
    color: "Washed Black",
    schedule: "SCH-2026-005",
    po: "SCH-2026-005",
    layJobNo: "JOB-505-BLK",
    jobNo: "JOB-505-BLK",
    pattern: "JOB-505-BLK",
    docketNo: "560321",
    docket: "560321",
    fabricCategory: "12.5 oz Rigid Denim",
    uom: "PCS",
    grmtQty: "800",
    sourceSheet: "Brandix Production Master",
    rowIndex: 8
  },
  {
    id: "DEMO-09",
    style: "Slim Fit Chino",
    color: "Khaki",
    schedule: "SCH-2026-012",
    po: "SCH-2026-012",
    layJobNo: "JOB-612-KHK",
    jobNo: "JOB-612-KHK",
    pattern: "JOB-612-KHK",
    docketNo: "577470",
    docket: "577470",
    fabricCategory: "Twill Stretch 240 GSM",
    uom: "PCS",
    grmtQty: "1600",
    sourceSheet: "Brandix Production Master",
    rowIndex: 9
  },
  {
    id: "DEMO-10",
    style: "Slim Fit Chino",
    color: "Olive Green",
    schedule: "SCH-2026-012",
    po: "SCH-2026-012",
    layJobNo: "JOB-612-OLV",
    jobNo: "JOB-612-OLV",
    pattern: "JOB-612-OLV",
    docketNo: "577471",
    docket: "577471",
    fabricCategory: "Twill Stretch 240 GSM",
    uom: "PCS",
    grmtQty: "1600",
    sourceSheet: "Brandix Production Master",
    rowIndex: 10
  },
  {
    id: "DEMO-11",
    style: "Crewneck Tee 200",
    color: "Pure White",
    schedule: "SCH-2026-020",
    po: "SCH-2026-020",
    layJobNo: "JOB-220-WHT",
    jobNo: "JOB-220-WHT",
    pattern: "JOB-220-WHT",
    docketNo: "518740",
    docket: "518740",
    fabricCategory: "Comb Yarn Jersey 180 GSM",
    uom: "PCS",
    grmtQty: "3000",
    sourceSheet: "Brandix Production Master",
    rowIndex: 11
  },
  {
    id: "DEMO-12",
    style: "Crewneck Tee 200",
    color: "Pitch Black",
    schedule: "SCH-2026-020",
    po: "SCH-2026-020",
    layJobNo: "JOB-220-BLK",
    jobNo: "JOB-220-BLK",
    pattern: "JOB-220-BLK",
    docketNo: "518741",
    docket: "518741",
    fabricCategory: "Comb Yarn Jersey 180 GSM",
    uom: "PCS",
    grmtQty: "3000",
    sourceSheet: "Brandix Production Master",
    rowIndex: 12
  }
];

const DEMO_BATCH_LOGS = [
  {
    id: "BDL-20260904-467",
    batchId: "BDL-20260904-467",
    timestamp: "9/4/2026, 4:29:14 PM",
    style: "BWD011B6",
    color: "Bliss Black",
    schedule: "1347960",
    po: "1347960",
    layJobNo: "372916",
    jobNo: "372916",
    pattern: "372916",
    docketNo: "543139",
    docket: "543139",
    sizesSummary: "XS(1)",
    cutParts: "Front Body, Back Body, Left Sleeve, Right Sleeve, Collar / Neckband, Chest Pocket, Cuff, EMB Part",
    totalBundles: "1 Bundles (8 Tags)",
    seqRange: "SEQ 36–36",
    plyRange: "281–310",
    batchTagString: "BWD011B6 | Bliss Black | 1347960 | 372916 | 543139 | BDL-20260904-467",
    tagCount: 8,
    embellishmentStyle: "Yes",
    patternText: "PTN-101"
  },
  {
    id: "BDL-20260904-354",
    batchId: "BDL-20260904-354",
    timestamp: "9/4/2026, 3:58:32 PM",
    style: "BWD011C6",
    color: "Prachi Purple Prune",
    schedule: "1356936",
    po: "1356936",
    layJobNo: "385809",
    jobNo: "385809",
    pattern: "385809",
    docketNo: "560314",
    docket: "560314",
    sizesSummary: "XS(2), S(3)",
    cutParts: "Front Body, Back Body, Left Sleeve, Right Sleeve, Collar / Neckband, Chest Pocket, Cuff, EMB Part",
    totalBundles: "5 Bundles (40 Tags)",
    seqRange: "SEQ 1–5",
    plyRange: "1–150",
    batchTagString: "BWD011C6 | Prachi Purple Prune | 1356936 | 385809 | 560314 | BDL-20260904-354",
    tagCount: 40,
    embellishmentStyle: "Yes",
    patternText: "5698p"
  },
  {
    id: "BDL-20260904-632",
    batchId: "BDL-20260904-632",
    timestamp: "9/4/2026, 2:00:45 PM",
    style: "BWD011B6",
    color: "Bliss Black",
    schedule: "1347960",
    po: "1347960",
    layJobNo: "372916",
    jobNo: "372916",
    pattern: "372916",
    docketNo: "543139",
    docket: "543139",
    sizesSummary: "S(3), M(1), L(2)",
    cutParts: "Front Body, Back Body, Left Sleeve, Right Sleeve, Collar / Neckband, Chest Pocket, Cuff",
    totalBundles: "6 Bundles (48 Tags)",
    seqRange: "SEQ 30–35",
    plyRange: "101–280",
    batchTagString: "BWD011B6 | Bliss Black | 1347960 | 372916 | 543139 | BDL-20260904-632",
    tagCount: 48,
    embellishmentStyle: "No",
    patternText: ""
  },
  {
    id: "BDL-20260820-001",
    batchId: "BDL-20260820-001",
    timestamp: "08/20/2026, 10:47:00 AM",
    style: "VT0350H6",
    color: "VS25164-01 C13 Prty Blsm 7ZCC",
    schedule: "1361514",
    po: "1361514",
    layJobNo: "398093",
    jobNo: "398093",
    pattern: "398093",
    docketNo: "577465",
    docket: "577465",
    sizesSummary: "S(1), M(1), L(1), XL(1)",
    cutParts: "Front Body, Back Body, Left Sleeve, Right Sleeve, Collar / Neckband, Chest Pocket, Cuff, EMB Part",
    totalBundles: "4 Bundles (32 Tags)",
    seqRange: "SEQ 1–4",
    plyRange: "1–200",
    batchTagString: "VT0350H6 | VS25164-01 C13 Prty Blsm 7ZCC | 1361514 | 398093 | 577465 | BDL-20260820-001",
    tagCount: 32,
    embellishmentStyle: "Yes",
    patternText: "PTN-101"
  },
  {
    id: "BDL-20260820-002",
    batchId: "BDL-20260820-002",
    timestamp: "08/20/2026, 12:20:00 PM",
    style: "TT4568F6",
    color: "NAVY 411",
    schedule: "1318321",
    po: "1318321",
    layJobNo: "355498",
    jobNo: "355498",
    pattern: "355498",
    docketNo: "518730",
    docket: "518730",
    sizesSummary: "M(1), L(1), XL(1)",
    cutParts: "Front Body, Back Body, Left Sleeve, Right Sleeve, Collar / Neckband, Chest Pocket, Cuff",
    totalBundles: "3 Bundles (24 Tags)",
    seqRange: "SEQ 1–3",
    plyRange: "1–150",
    batchTagString: "TT4568F6 | NAVY 411 | 1318321 | 355498 | 518730 | BDL-20260820-002",
    tagCount: 24,
    embellishmentStyle: "No",
    patternText: ""
  }
];

function initDemoDataLoader(force = false) {
  window.isDemoMode = true;
  isJSONConnected = true;
  isMasterCSVConnected = true;
  isLocationConnected = true;

  activeFilePathDisplay = "Brandix Apparel Live Demo Database (Auto-Connected)";
  activeCSVFileName = "MasterData_Brandix_Production.xlsx";
  appState.storageDir = "Brandix Apparel Live Demo Database (Auto-Connected)";
  appState.resolvedCsvPath = "MasterData_Brandix_Production.xlsx";

  // 1. Populate Master Data
  appState.styleMaster = JSON.parse(JSON.stringify(DEMO_MASTER_DATA));

  // 2. Populate Universal Specs
  appState.sizes = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  appState.parts = [
    "Front Body", "Back Body", "Left Sleeve", "Right Sleeve",
    "Collar / Neckband", "Chest Pocket", "Cuff", "EMB Part"
  ];
  appState.selectedParts = [...appState.parts];

  // 3. Populate Batch Logs
  appState.logs = JSON.parse(JSON.stringify(DEMO_BATCH_LOGS));

  // 4. Update Indicators & UI State
  updateJSONConnectionUI(activeFilePathDisplay, true);
  if (typeof updateMasterDataUI === 'function') updateMasterDataUI();
  if (typeof updateStatusBadgesUI === 'function') updateStatusBadgesUI();
  if (typeof syncSidebarBadges === 'function') syncSidebarBadges();
  if (typeof updateFormEntryState === 'function') updateFormEntryState();

  // Hide the red warning banner completely in demo mode
  const alertBanner = document.getElementById('db-disconnected-alert');
  if (alertBanner) alertBanner.classList.add('hidden');

  // 5. Populate Generator Form Inputs
  if (typeof renderStyleDropdown === 'function') renderStyleDropdown();

  const styleSelect = document.getElementById('gen-style');
  if (styleSelect) {
    styleSelect.value = "BWD011B6";
    if (typeof onStyleChange === 'function') onStyleChange();
  }

  const colorSelect = document.getElementById('gen-color');
  if (colorSelect) {
    colorSelect.value = "Bliss Black";
    if (typeof onColorChange === 'function') onColorChange();
  }

  const schedSelect = document.getElementById('gen-po');
  if (schedSelect) {
    schedSelect.value = "1347960";
    if (typeof onScheduleChange === 'function') onScheduleChange();
  }

  const jobSelect = document.getElementById('gen-pattern');
  if (jobSelect) {
    jobSelect.value = "372916";
    if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('gen-pattern');
  }

  const docketSelect = document.getElementById('gen-docket');
  if (docketSelect) {
    docketSelect.value = "543139";
    if (typeof refreshSearchableSelect === 'function') refreshSearchableSelect('gen-docket');
  }

  const plyInput = document.getElementById('gen-ply');
  if (plyInput) plyInput.value = "30";

  const ptnTextInput = document.getElementById('gen-pattern-text');
  if (ptnTextInput) ptnTextInput.value = "PTN-101";

  const embSelect = document.getElementById('gen-embellishment');
  if (embSelect) embSelect.value = "Yes";

  // 6. Populate Cut Parts Matrix
  if (typeof renderPartsTile === 'function') renderPartsTile();
  if (typeof renderSizesPills === 'function') renderSizesPills();
  if (typeof renderPartsPills === 'function') renderPartsPills();

  // 7. Setup Realistic Size Mapping Breakdown Rows
  appState.mappingRows = [
    {
      id: 'demo-row-xs',
      size: 'XS',
      ratio: 1,
      shades: [{ id: 'sh-xs-1', shade: 'A', plyCount: 30 }]
    },
    {
      id: 'demo-row-s',
      size: 'S',
      ratio: 2,
      shades: [{ id: 'sh-s-1', shade: 'A', plyCount: 30 }]
    },
    {
      id: 'demo-row-m',
      size: 'M',
      ratio: 2,
      shades: [{ id: 'sh-m-1', shade: 'A', plyCount: 30 }]
    },
    {
      id: 'demo-row-l',
      size: 'L',
      ratio: 1,
      shades: [{ id: 'sh-l-1', shade: 'A', plyCount: 30 }]
    }
  ];

  if (typeof renderMappingRows === 'function') renderMappingRows();
  if (typeof updatePlySequenceBadge === 'function') updatePlySequenceBadge();

  // 8. Generate Working Demo Tags in Memory for Instant Print Preview & Numbering Chart
  generateDemoTagsInMemory();

  // 9. Render Tables & Views
  if (typeof renderLogsTable === 'function') renderLogsTable();
  if (typeof renderPrintGrid === 'function') renderPrintGrid();
  if (typeof generateNumberingChartFromCurrentTags === 'function') generateNumberingChartFromCurrentTags();

  // Ensure header displays live demo indicator badge
  injectDemoHeaderBadge();

  console.log('[LIVE DEMO] ✅ Auto-connected to Brandix Demo Database & Pre-populated tags.');
}

function generateDemoTagsInMemory() {
  try {
    const style = "BWD011B6";
    const color = "Bliss Black";
    const schedule = "1347960";
    const layJobNo = "372916";
    const docketNo = "543139";
    const plyQty = 30;
    const batchId = "BDL-20260904-789";
    const timestamp = new Date().toLocaleString();

    let currentPlyStart = 311;
    let globalBundleSeq = 36;
    const generated = [];

    const totalBatchCopies = appState.mappingRows.reduce((acc, m) => acc + m.ratio, 0);

    appState.mappingRows.forEach(m => {
      const baseSize = m.size;
      const ratioCount = m.ratio;

      for (let copy = 1; copy <= ratioCount; copy++) {
        const displaySize = ratioCount > 1 ? `${baseSize}-${copy}` : baseSize;
        globalBundleSeq++;
        const bundleStartPly = currentPlyStart;
        const endPly = bundleStartPly + plyQty - 1;
        const plyRange = `${bundleStartPly}–${endPly}`;

        appState.selectedParts.forEach(part => {
          const tagId = generate6CharId();
          const tagString = `${displaySize} ${globalBundleSeq} ${part} Shade A ${plyRange}`;
          generated.push({
            id: tagId,
            batchId: batchId,
            style: style,
            color: color,
            schedule: schedule,
            po: schedule,
            layJobNo: layJobNo,
            jobNo: layJobNo,
            pattern: layJobNo,
            docketNo: docketNo,
            docket: docketNo,
            patternText: "PTN-101",
            embellishmentStyle: "Yes",
            baseSize: baseSize,
            sizeCopy: copy,
            sizeRatio: ratioCount,
            size: displaySize,
            part: part,
            shade: "A",
            bundleSeq: globalBundleSeq,
            ratioTotal: totalBatchCopies,
            plyRange: plyRange,
            startPly: bundleStartPly,
            endPly: endPly,
            tagString: tagString,
            qrData: tagId,
            timestamp: timestamp
          });
        });

        currentPlyStart += plyQty;
      }
    });

    appState.printLogTags = [];
    appState.generatedTags = generated;

    if (!Array.isArray(appState.allStoredTags)) appState.allStoredTags = [];
    generated.forEach(t => appState.allStoredTags.unshift(t));

    // Also prepend this live batch to logs
    const newDemoBatch = {
      id: batchId,
      batchId: batchId,
      timestamp: timestamp,
      style: style,
      color: color,
      schedule: schedule,
      po: schedule,
      layJobNo: layJobNo,
      jobNo: layJobNo,
      pattern: layJobNo,
      docketNo: docketNo,
      docket: docketNo,
      patternText: "PTN-101",
      embellishmentStyle: "Yes",
      sizesSummary: appState.mappingRows.map(m => `${m.size}(${m.ratio})`).join(', '),
      cutParts: appState.selectedParts.join(', '),
      totalBundles: `${totalBatchCopies} Bundles (${generated.length} Tags)`,
      seqRange: `SEQ 37–${globalBundleSeq}`,
      plyRange: `311–${currentPlyStart - 1}`,
      batchTagString: `${style} | ${color} | ${schedule} | ${layJobNo} | ${docketNo} | ${batchId}`,
      tags: generated,
      tagCount: generated.length,
      source: "Brandix Demo Database"
    };

    appState.logs.unshift(newDemoBatch);
  } catch (e) {
    console.warn("Failed generating demo tags in memory:", e);
  }
}

function injectDemoHeaderBadge() {
  const breadcrumb = document.getElementById('nav-breadcrumb');
  if (!breadcrumb || document.getElementById('live-demo-badge')) return;

  const demoBadge = document.createElement('div');
  demoBadge.id = 'live-demo-badge';
  demoBadge.className = 'ml-auto flex items-center gap-2';
  demoBadge.innerHTML = `
    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 shadow-xs">
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span>Live Demo Connected</span>
    </span>
    <button type="button" onclick="initDemoDataLoader(true); showToast('Demo data reloaded!', 'info');" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer" title="Reset to default demo data">
      🔄 Reset Demo
    </button>
  `;

  // Place beside breadcrumb container if possible
  breadcrumb.parentElement.appendChild(demoBadge);
}

// Auto-run if running on GitHub Pages, file protocol, or if backend server is unreachable
if (typeof window !== 'undefined') {
  window.initDemoDataLoader = initDemoDataLoader;
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (!isJSONConnected || (appState.styleMaster || []).length === 0) {
        initDemoDataLoader();
      }
    }, 400);
  });
}
