/**
 * GarmentTag Sizes & Cut Parts Management Engine
 */

async function loadUniversalSizesAndParts() {
  try {
    const [resSizes, resParts] = await Promise.all([
      fetch(getApiUrl('/api/sizes')).catch(() => null),
      fetch(getApiUrl('/api/parts')).catch(() => null)
    ]);
    if (resSizes && resSizes.ok) {
      const jSizes = await resSizes.json();
      if (jSizes.success && Array.isArray(jSizes.data) && jSizes.data.length > 0) {
        appState.sizes = jSizes.data;
      }
    }
    if (resParts && resParts.ok) {
      const jParts = await resParts.json();
      if (jParts.success && Array.isArray(jParts.data) && jParts.data.length > 0) {
        appState.parts = jParts.data;
      }
    }
  } catch (e) {
    console.warn("Could not fetch sizes/parts from API:", e);
  }

  if (!appState.sizes || appState.sizes.length === 0) {
    try {
      const res = await fetch('universal_sizes.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) appState.sizes = data;
      }
    } catch (e) {}
  }
  if (!appState.parts || appState.parts.length === 0) {
    try {
      const res = await fetch('universal_parts.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) appState.parts = data;
      }
    } catch (e) {}
  }

  if (!appState.sizes) appState.sizes = [];
  if (!appState.parts) appState.parts = [];

  if (appState.selectedParts.length === 0 && appState.parts.length > 0) {
    appState.selectedParts = [...appState.parts];
  }

  renderSizesPills();
  renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  updateStatusBadgesUI();
}

function renderSizesPills() {
  const container = document.getElementById('sizes-pill-list');
  if (!container) return;
  if (!appState.sizes || appState.sizes.length === 0) {
    container.innerHTML = `<span class="text-slate-400 text-xs italic">No sizes configured. Connect garment_specs_data.jsonl to manage sizes.</span>`;
    return;
  }
  container.innerHTML = (appState.sizes || []).map(s => `
    <span class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs">
      <span>${s}</span>
      <button onclick="deleteSize('${s}')" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold cursor-pointer" title="Remove Size">✕</button>
    </span>
  `).join('');
}

async function addUniversalSize() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_specs_data.jsonl before adding universal sizes.", "error");
    return;
  }
  const input = document.getElementById('m-new-size');
  const val = input ? input.value.trim() : '';
  if (!val) return;
  if (!appState.sizes.includes(val)) {
    appState.sizes.push(val);
    fetch(getApiUrl('/api/specs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizes: appState.sizes, parts: appState.parts })
    }).catch(() => {});
    saveLocalDatabase();
  }
  renderSizesPills();
  if (typeof renderMappingRows === 'function') renderMappingRows();
  updateStatusBadgesUI();
  if (input) input.value = '';
  showToast(`Added Size "${val}" to garment_specs_data.jsonl.`, 'success');
}

async function deleteSize(s) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_specs_data.jsonl before editing sizes.", "error");
    return;
  }
  appState.sizes = (appState.sizes || []).filter(item => item !== s);
  fetch(getApiUrl('/api/specs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sizes: appState.sizes, parts: appState.parts })
  }).catch(() => {});
  saveLocalDatabase();
  renderSizesPills();
  if (typeof renderMappingRows === 'function') renderMappingRows();
  updateStatusBadgesUI();
  showToast(`Removed Size "${s}" from garment_specs_data.jsonl.`, 'info');
}

function renderPartsPills() {
  const container = document.getElementById('parts-pill-list');
  if (!container) return;
  if (!appState.parts || appState.parts.length === 0) {
    container.innerHTML = `<span class="text-slate-400 text-xs italic">No cut parts configured. Connect garment_specs_data.jsonl to manage parts.</span>`;
    return;
  }
  container.innerHTML = (appState.parts || []).map(p => `
    <span class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs">
      <span>${p}</span>
      <button onclick="deletePart('${p}')" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold cursor-pointer" title="Remove Part">✕</button>
    </span>
  `).join('');
}

async function addUniversalPart() {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_specs_data.jsonl before adding universal cut parts.", "error");
    return;
  }
  const input = document.getElementById('m-new-part');
  const val = input ? input.value.trim() : '';
  if (!val) return;
  if (!appState.parts.includes(val)) {
    appState.parts.push(val);
    fetch(getApiUrl('/api/specs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizes: appState.sizes, parts: appState.parts })
    }).catch(() => {});
    saveLocalDatabase();
  }
  renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  updateStatusBadgesUI();
  if (input) input.value = '';
  showToast(`Added Part "${val}" to garment_specs_data.jsonl.`, 'success');
}

async function deletePart(p) {
  if (!isJSONConnected) {
    showToast("⚠️ Database Disconnected: Please connect garment_specs_data.jsonl before editing cut parts.", "error");
    return;
  }
  appState.parts = (appState.parts || []).filter(item => item !== p);
  fetch(getApiUrl('/api/specs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sizes: appState.sizes, parts: appState.parts })
  }).catch(() => {});
  saveLocalDatabase();
  renderPartsPills();
  if (typeof renderPartsTile === 'function') renderPartsTile();
  updateStatusBadgesUI();
  showToast(`Removed Part "${p}" from garment_specs_data.jsonl.`, 'info');
}
