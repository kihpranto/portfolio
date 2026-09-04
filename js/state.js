/**
 * GarmentTag Global Application State & UI Notification Utilities
 */

const DEFAULT_BUNDLE_DATA = {
  appName: "GarmentTag Bundle Generator",
  version: "2.4",
  sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  parts: ["Front Body", "Back Body", "Left Sleeve", "Right Sleeve", "Collar / Neckband", "Chest Pocket", "Cuff", "EMB Part"],
  customColumns: {},
  logs: []
};

let appState = {
  styleMaster: [],
  sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  parts: ["Front Body", "Back Body", "Left Sleeve", "Right Sleeve", "Collar / Neckband", "Chest Pocket", "Cuff", "EMB Part"],
  selectedParts: ["Front Body", "Back Body", "Left Sleeve", "Right Sleeve", "Collar / Neckband", "Chest Pocket", "Cuff", "EMB Part"],
  logs: [],
  archivedLogs: [],
  allStoredTags: [],
  mappingRows: [],
  generatedTags: [],
  printLogTags: []
};
window.appState = appState;

let isJSONConnected = true;
let isMasterCSVConnected = false;
let isLocationConnected = false;
let activeFileHandle = null;
let activeFilePathDisplay = "garment_batches_data.jsonl";

if (!window.appLocationState) {
  window.appLocationState = {
    racks: [],
    pallets: [],
    bundleLocations: [],
    history: []
  };
}
let appLocationState = window.appLocationState;

let activeCSVHandle = null;
let activeCSVFileName = "MasterData.csv";

let lastSpecsMtime = 0;
let lastBatchesMtime = 0;
let lastTagsMtime = 0;
let lastJSONMtime = 0;
let lastMasterMtime = 0;
let streamPollingInterval = null;

/**
 * Returns absolute or relative URL for API requests depending on host environment
 */
function getApiUrl(path) {
  const baseUrl = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL)
    ? window.APP_CONFIG.API_BASE_URL
    : 'http://localhost:3000';

  if (window.location.protocol.startsWith('http') && window.location.host) {
    return path;
  }
  return baseUrl.replace(/\/+$/, '') + path;
}

/**
 * Generates a random 6-character alphanumeric Unique Tag ID (e.g., K9X2M4)
 */
function generate6CharId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

let _loadingTimeout = null;

/**
 * Shows global loading overlay spinner with informative label
 */
function showLoading(msg = 'Processing request...', timeoutMs = 8000) {
  const overlay = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-spinner-text');
  if (textEl && msg) textEl.textContent = msg;
  if (overlay) overlay.classList.remove('hidden');
  if (_loadingTimeout) clearTimeout(_loadingTimeout);
  if (timeoutMs > 0) {
    _loadingTimeout = setTimeout(() => {
      hideLoading();
    }, timeoutMs);
  }
}

/**
 * Hides global loading overlay spinner
 */
function hideLoading() {
  if (_loadingTimeout) {
    clearTimeout(_loadingTimeout);
    _loadingTimeout = null;
  }
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Displays clean, enterprise floating toast notifications
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`[Toast ${type}]`, message);
    return;
  }

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold transform transition-all duration-300 translate-y-[-8px] opacity-0 max-w-sm sm:max-w-md ${
    isSuccess
      ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
      : isError
      ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
      : isWarning
      ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
      : 'bg-slate-900 dark:bg-slate-100 border-slate-800 dark:border-slate-300 text-white dark:text-slate-900'
  }`;

  const iconHtml = isSuccess
    ? '<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    : isError
    ? '<svg class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    : isWarning
    ? '<svg class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    : '<svg class="w-4 h-4 text-blue-400 dark:text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  toast.innerHTML = `
    ${iconHtml}
    <span class="flex-1 leading-relaxed break-words">${message}</span>
    <button type="button" class="ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-xs leading-none" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-[-8px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-8px]', 'opacity-0');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, duration);
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
