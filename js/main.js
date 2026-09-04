/**
 * GarmentTag Main Application Orchestrator & UI Navigation
 */

const searchableSelectInstances = {};
window.searchableSelectInstances = searchableSelectInstances;

function initDarkMode() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
    updateThemeIcons(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcons(false);
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcons(isDark);
}

function updateThemeIcons(isDark) {
  ['', 'sidebar-'].forEach(prefix => {
    const iconSun = document.getElementById(`${prefix}icon-sun`);
    const iconMoon = document.getElementById(`${prefix}icon-moon`);
    if (iconSun && iconMoon) {
      if (isDark) {
        iconSun.classList.remove('hidden');
        iconMoon.classList.add('hidden');
      } else {
        iconSun.classList.add('hidden');
        iconMoon.classList.remove('hidden');
      }
    }
  });
}

function initSidebarState() {
  try {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1';
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && isCollapsed) {
      sidebar.classList.add('sidebar-collapsed');
    }
  } catch (e) {}
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('sidebar-collapsed');
    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    try {
      localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch (e) {}
  }
}

function toggleCategoryAccordion(catId) {
  const catEl = document.getElementById(catId);
  const arrowEl = document.getElementById(`${catId}-arrow`);
  if (catEl) {
    const isHidden = catEl.classList.toggle('hidden');
    if (arrowEl) {
      arrowEl.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  }
}

function syncSidebarBadges() {
  const printCountEl = document.getElementById('sidebar-print-count');
  if (printCountEl) {
    const combined = [...(appState.generatedTags || []), ...((appState.printLogTags || []))];
    printCountEl.textContent = combined.length;
  }
  const logsCountEl = document.getElementById('sidebar-logs-count') || document.getElementById('sidebar-logs-badge');
  if (logsCountEl) {
    const count = (appState.logs || []).length;
    if (!isJSONConnected) {
      logsCountEl.textContent = 'Offline';
      logsCountEl.className = 'text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-200/60 dark:border-rose-800/60 sidebar-badge';
    } else {
      const displayCount = count > 999 ? `${(count/1000).toFixed(1)}k` : count;
      logsCountEl.textContent = `${displayCount} ${count === 1 ? 'Log' : 'Logs'}`;
      logsCountEl.className = 'text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/60 sidebar-badge';
    }
  }
  const masterCountEl = document.getElementById('sidebar-master-count');
  if (masterCountEl) {
    const count = (appState.styleMaster || []).length;
    masterCountEl.textContent = count > 999 ? `${(count/1000).toFixed(1)}k` : count;
  }
  const archiveCountEl = document.getElementById('sidebar-archive-count');
  if (archiveCountEl) {
    const aCount = (appState.archivedLogs || []).length;
    archiveCountEl.textContent = aCount > 999 ? `${(aCount/1000).toFixed(1)}k` : aCount;
  }
  const dbDot = document.getElementById('sidebar-db-dot');
  const dbLabel = document.getElementById('sidebar-db-label');
  if (dbDot && dbLabel) {
    if (isJSONConnected) {
      dbDot.className = "w-2 h-2 rounded-full bg-emerald-500 shrink-0";
      dbLabel.textContent = "DB Connected";
      dbLabel.className = "text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate";
    } else {
      dbDot.className = "w-2 h-2 rounded-full bg-rose-500 shrink-0";
      dbLabel.textContent = "DB Disconnected";
      dbLabel.className = "text-[11px] font-semibold text-rose-700 dark:text-rose-300 truncate";
    }
  }
}

const NAV_CONFIG = {
  'generator': {
    category: 'Production & Tagging',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-blue-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    title: 'Tag Generator',
    icon: '<svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5a1 1 0 01.707.293l7 7a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 013 12V7a4 4 0 014-4z"/></svg>'
  },
  'print': {
    category: 'Production & Tagging',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-blue-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    title: 'Print Preview',
    icon: '<svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
  },
  'chart': {
    category: 'Production & Tagging',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-blue-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    title: 'Numbering Chart',
    icon: '<svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm0 5h16M10 4v16"/></svg>'
  },
  'logs': {
    category: 'Records & History',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-indigo-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    title: 'Bundle Batch Logs',
    icon: '<svg class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>'
  },
  'reports': {
    category: 'Records & History',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-indigo-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    title: 'Production Reports & Analytics',
    icon: '<svg class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'
  },
  'master': {
    category: 'Master Data & System',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-emerald-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
    title: 'Master Data Source',
    icon: '<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>'
  },
  'specs': {
    category: 'Master Data & System',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-emerald-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
    title: 'Sizes & Cut Parts',
    icon: '<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>'
  },
  'archive': {
    category: 'Records & History',
    categoryIcon: '<svg class="w-3.5 h-3.5 text-indigo-500 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    title: 'Archived Batches',
    icon: '<svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>'
  }
};

const ALL_PAGES = ['generator', 'print', 'chart', 'logs', 'reports', 'master', 'specs', 'archive'];

function switchTab(tabName, subTab) {
  let actualTab = tabName;
  if (tabName === 'master-source') actualTab = 'master';
  if (tabName === 'master-specs') actualTab = 'specs';

  if (!ALL_PAGES.includes(actualTab)) actualTab = 'generator';

  ALL_PAGES.forEach(t => {
    const sec = document.getElementById(`sec-${t}`);
    if (sec) sec.classList.add('hidden');
    
    const navBtns = document.querySelectorAll(`[data-tab-target="${t}"]`);
    navBtns.forEach(btn => {
      btn.classList.remove('nav-item-active');
      btn.classList.add('nav-item-inactive');
    });
  });

  const activeSec = document.getElementById(`sec-${actualTab}`);
  if (activeSec) activeSec.classList.remove('hidden');

  const activeNavBtns = document.querySelectorAll(`[data-tab-target="${actualTab}"]`);
  activeNavBtns.forEach(btn => {
    btn.classList.add('nav-item-active');
    btn.classList.remove('nav-item-inactive');
  });

  const conf = NAV_CONFIG[actualTab];
  const breadcrumbEl = document.getElementById('nav-breadcrumb');
  if (breadcrumbEl && conf) {
    breadcrumbEl.innerHTML = `
      <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">${conf.categoryIcon} <span>${conf.category}</span></span>
      <span class="text-slate-300 dark:text-slate-600">/</span>
      <span class="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">${conf.icon} <span>${conf.title}</span></span>
    `;
  }

  syncSidebarBadges();

  if (actualTab === 'logs') {
    if (typeof renderLogsTable === 'function') renderLogsTable();
  }

  if (actualTab === 'chart') {
    if (typeof renderNumberingChartUI === 'function') renderNumberingChartUI();
  }

  if (actualTab === 'reports') {
    if (typeof renderReportsDashboard === 'function') renderReportsDashboard();
  }

  if (actualTab === 'master') {
    if (typeof updateMasterDataUI === 'function') updateMasterDataUI();
    if (typeof renderMasterTable === 'function') renderMasterTable();
  }

  if (actualTab === 'specs') {
    if (typeof renderSizesPills === 'function') renderSizesPills();
    if (typeof renderPartsPills === 'function') renderPartsPills();
    if (typeof renderPartsTile === 'function') renderPartsTile();
  }

  if (actualTab === 'archive') {
    if (typeof renderArchiveTable === 'function') renderArchiveTable();
  }

  if (actualTab === 'generator') {
    if (typeof updateFormEntryState === 'function') updateFormEntryState();
    if (typeof renderStyleDropdown === 'function') renderStyleDropdown();
  }
  const scrollViewport = document.getElementById('main-scroll-viewport');
  if (scrollViewport) {
    scrollViewport.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

class SearchableSelect {
  constructor(selectId, options = {}) {
    this.selectId = selectId;
    this.selectEl = document.getElementById(selectId);
    this.placeholder = options.placeholder || '-- Select Option --';
    this.preserveOrder = !!options.preserveOrder;
    this.isOpen = false;
    this.searchQuery = '';
    
    if (!this.selectEl) return;
    searchableSelectInstances[selectId] = this;

    this.initDOM();
  }

  initDOM() {
    this.selectEl.classList.add('sr-only');
    this.selectEl.tabIndex = -1;

    this.wrapper = document.createElement('div');
    this.wrapper.className = "relative w-full searchable-select-wrapper";
    this.wrapper.id = `searchable-${this.selectId}`;

    this.trigger = document.createElement('button');
    this.trigger.type = "button";
    this.trigger.className = "w-full h-8.5 min-h-[34px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none flex items-center justify-between gap-1.5 transition hover:border-blue-400 focus:border-blue-500 shadow-2xs cursor-pointer disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:cursor-not-allowed text-left";
    
    this.triggerText = document.createElement('span');
    this.triggerText.className = "truncate flex-1";
    
    this.triggerIcon = document.createElement('span');
    this.triggerIcon.className = "text-slate-400 text-[10px] shrink-0 pointer-events-none transition-transform";
    this.triggerIcon.innerHTML = "▾";

    this.trigger.appendChild(this.triggerText);
    this.trigger.appendChild(this.triggerIcon);

    this.dropdown = document.createElement('div');
    this.dropdown.className = "absolute z-[100] left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl p-2 space-y-1.5 hidden max-h-64 flex flex-col";

    const searchBox = document.createElement('div');
    searchBox.className = "relative shrink-0";
    const inputEl = document.createElement('input');
    inputEl.type = "text";
    inputEl.placeholder = "🔍 Search options (A-Z)...";
    inputEl.className = "w-full h-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 shadow-2xs font-medium";
    searchBox.appendChild(inputEl);
    this.searchInput = inputEl;

    this.listContainer = document.createElement('div');
    this.listContainer.className = "overflow-y-auto max-h-48 space-y-0.5 overscroll-contain text-xs custom-scrollbar";

    this.dropdown.appendChild(searchBox);
    this.dropdown.appendChild(this.listContainer);

    this.wrapper.appendChild(this.trigger);
    this.wrapper.appendChild(this.dropdown);
    if (this.selectEl && this.selectEl.parentNode) {
      this.selectEl.parentNode.insertBefore(this.wrapper, this.selectEl.nextSibling);
    }

    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.selectEl.disabled) return;
      this.toggle();
    });

    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderList();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        this.trigger.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const firstOption = this.listContainer.querySelector('.select-option-item:not(.hidden)');
        if (firstOption) firstOption.click();
      }
    });

    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.wrapper.contains(e.target)) {
        this.close();
      }
    });

    this.sync();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    Object.values(searchableSelectInstances).forEach(inst => {
      if (inst !== this && inst.isOpen) inst.close();
    });

    this.isOpen = true;
    this.dropdown.classList.remove('hidden');
    this.triggerIcon.style.transform = 'rotate(180deg)';
    this.trigger.classList.add('ring-2', 'ring-blue-500/20', 'border-blue-500');
    this.searchInput.value = '';
    this.searchQuery = '';
    this.renderList();
    setTimeout(() => this.searchInput.focus(), 60);
  }

  close() {
    this.isOpen = false;
    this.dropdown.classList.add('hidden');
    this.triggerIcon.style.transform = 'rotate(0deg)';
    this.trigger.classList.remove('ring-2', 'ring-blue-500/20', 'border-blue-500');
  }

  sync() {
    if (!this.selectEl || !this.trigger) return;
    this.trigger.disabled = !!this.selectEl.disabled;
    const optionsList = this.selectEl.options || [];
    const idx = this.selectEl.selectedIndex >= 0 ? this.selectEl.selectedIndex : 0;
    const selectedOpt = optionsList[idx] || null;
    if (selectedOpt && selectedOpt.value) {
      this.triggerText.textContent = selectedOpt.textContent;
      this.triggerText.className = "truncate flex-1 font-bold text-slate-900 dark:text-slate-100";
    } else {
      this.triggerText.textContent = (selectedOpt ? selectedOpt.textContent : '') || this.placeholder;
      this.triggerText.className = "truncate flex-1 text-slate-400 dark:text-slate-500 font-normal";
    }
    if (this.isOpen) this.renderList();
  }

  renderList() {
    if (!this.listContainer || !this.selectEl) return;
    this.listContainer.innerHTML = '';
    const opts = Array.from(this.selectEl.options || []);

    const emptyOpts = opts.filter(o => !o.value);
    const dataOpts = opts.filter(o => o.value);
    if (!this.preserveOrder) {
      dataOpts.sort((a, b) => a.textContent.localeCompare(b.textContent, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const sortedOpts = [...emptyOpts, ...dataOpts];

    let matchCount = 0;
    sortedOpts.forEach(opt => {
      const text = opt.textContent;
      const val = opt.value;
      const isSelected = opt.selected;

      if (this.searchQuery && val && !text.toLowerCase().includes(this.searchQuery)) {
        return;
      }

      matchCount++;
      const item = document.createElement('div');
      item.className = `select-option-item px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between transition text-xs ${
        isSelected 
          ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800' 
          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
      }`;

      if (this.searchQuery && val) {
        const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
        item.innerHTML = `<span class="truncate">${text.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-900 text-slate-900 dark:text-slate-100 rounded px-0.5 font-bold">$1</mark>')}</span>`;
      } else {
        item.innerHTML = `<span class="truncate">${text}</span>`;
      }

      if (isSelected && val) {
        item.innerHTML += `<span class="text-blue-600 dark:text-blue-400 font-bold text-[11px] shrink-0 ml-1">✓</span>`;
      }

      item.addEventListener('click', () => {
        this.selectEl.value = val;
        this.sync();
        this.close();
        this.selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      });

      this.listContainer.appendChild(item);
    });

    if (matchCount === 0) {
      this.listContainer.innerHTML = `<div class="p-2.5 text-center text-slate-400 dark:text-slate-500 italic text-xs">No matching options found</div>`;
    }
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

function initSearchableSelect(selectId, options = {}) {
  if (!document.getElementById(selectId)) return null;
  if (searchableSelectInstances[selectId]) {
    searchableSelectInstances[selectId].sync();
    return searchableSelectInstances[selectId];
  }
  return new SearchableSelect(selectId, options);
}

function refreshSearchableSelect(selectId) {
  if (searchableSelectInstances[selectId]) {
    searchableSelectInstances[selectId].sync();
  } else if (document.getElementById(selectId)) {
    initSearchableSelect(selectId);
  }
}

function initAllSearchableSelects() {
  initSearchableSelect('gen-style', { placeholder: '-- Select Style --' });
  initSearchableSelect('gen-color', { placeholder: '-- Select Color --' });
  initSearchableSelect('gen-po', { placeholder: '-- Select Schedule --' });
  initSearchableSelect('gen-pattern', { placeholder: '-- Select Lay Job No --' });
  initSearchableSelect('gen-docket', { placeholder: '-- Select Docket No --' });

  initSearchableSelect('log-filter-style', { placeholder: '-- All Styles --' });
  initSearchableSelect('log-filter-color', { placeholder: '-- All Colors --' });
  initSearchableSelect('log-filter-po', { placeholder: '-- All Schedules --' });

  initSearchableSelect('chart-source-select', { placeholder: '-- Select Batch --' });

  initSearchableSelect('report-filter-style', { placeholder: '-- All Styles --' });
  initSearchableSelect('report-filter-color', { placeholder: '-- All Colors --' });
  initSearchableSelect('report-filter-schedule', { placeholder: '-- All Schedules --' });

  initSearchableSelect('pallet-form-rack', { placeholder: '-- Choose Rack --' });
  initSearchableSelect('loc-explorer-rack-filter', { placeholder: '🏢 All Storage Racks' });
  initSearchableSelect('loc-scan-target-rack', { placeholder: '-- Select Rack --' });
  initSearchableSelect('loc-scan-target-pallet', { placeholder: '-- Select Pallet --' });
  initSearchableSelect('loc-batch-source-select', { placeholder: '📦 Choose Bundle Source Batch', preserveOrder: true });
  initSearchableSelect('loc-batch-target-rack', { placeholder: 'Rack' });
  initSearchableSelect('loc-batch-target-pallet', { placeholder: 'Pallet' });
  initSearchableSelect('loc-dispatch-source-select', { placeholder: '📦 Choose Dispatch Source Batch', preserveOrder: true });
  initSearchableSelect('loc-dispatch-destination', { placeholder: '-- Target Sewing / Line --' });
  initSearchableSelect('loc-modal-move-rack', { placeholder: 'Select Target Rack' });
  initSearchableSelect('loc-modal-move-pallet', { placeholder: 'Select Target Pallet' });
  initSearchableSelect('loc-edit-pallet-rack', { placeholder: '-- Choose Parent Rack --' });
  initSearchableSelect('loc-print-filter-rack', { placeholder: 'All Racks & Pallets' });
  initSearchableSelect('loc-audit-status-filter', { placeholder: 'All Statuses' });
}

function universalSortArray(arr, col, dir = 'asc') {
  if (!Array.isArray(arr) || arr.length <= 1 || !col) return arr || [];
  const isAsc = dir === 'asc';
  return [...arr].sort((a, b) => {
    let valA = a[col];
    let valB = b[col];
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return isAsc ? valA - valB : valB - valA;
    }
    valA = String(valA).trim();
    valB = String(valB).trim();
    const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    return isAsc ? cmp : -cmp;
  });
}

function updateSortIcons(prefix, currentColumn, currentDir, allColumns) {
  allColumns.forEach(c => {
    const iconEl = document.getElementById(`sort-icon-${prefix}-${c}`);
    if (iconEl) {
      if (c === currentColumn) {
        iconEl.textContent = currentDir === 'asc' ? '▲' : '▼';
        iconEl.className = 'text-blue-600 dark:text-blue-400 font-bold text-[10px]';
      } else {
        iconEl.textContent = '↕';
        iconEl.className = 'text-slate-400 font-mono text-[9px]';
      }
    }
  });
}

function renderStyleDropdown() {
  const select = document.getElementById('gen-style');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Style --</option>';
  const uniqueStyles = Array.from(new Set(appState.styleMaster.map(s => s.style).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  uniqueStyles.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    select.appendChild(opt);
  });
  refreshSearchableSelect('gen-style');
}



window.onload = async function () {
  try {
    localStorage.removeItem('garment_bundle_data_backup');
    localStorage.removeItem('master_data_csv_backup');
  } catch(e) {}

  initDarkMode();
  initSidebarState();
  initAllSearchableSelects();
  renderSizesPills();
  renderPartsPills();
  renderPartsTile();
  await checkAndInitJSONConnection();
  startRealtimeStream();
  loadInstalledPrinters();
  hideLoading();
  switchTab('generator');
  purgeInjectedExtensionElements();
};

/**
 * Suppress third-party browser extension overlays (e.g. Expand Collapse toolbars).
 * This extension injects floating elements or bare text nodes containing "Expand" 
 * anywhere in the DOM — including inside #app-root-container.
 */
function purgeInjectedExtensionElements() {
  try {
    // --- PHASE 1: Remove stray direct children of <body> that aren't ours ---
    const validRootIds = new Set([
      'app-root-container', 'toast-container', 'loading-overlay', 'loc-toast-container'
    ]);
    const validTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META']);
    
    Array.from(document.body.children).forEach(el => {
      if (validTags.has(el.tagName)) return;
      if (!validRootIds.has(el.id)) {
        el.remove();
      }
    });

    // --- PHASE 2: Remove injected overlay elements or wrappers by selector ---
    const suspectSelectors = [
      'body > div:not(#app-root-container):not(#toast-container):not(#loading-overlay):not(#loc-toast-container)',
      '[class*="expand-collapse"]',
      '[id*="expand-collapse"]',
      '[class*="collapse-expand"]',
      '[id*="collapse-expand"]'
    ];
    
    document.querySelectorAll(suspectSelectors.join(', ')).forEach(el => {
      if (!el || !el.isConnected) return;
      if (el.id === 'app-root-container' || el.tagName === 'MAIN' || el.tagName === 'SECTION') return;
      const rawText = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (/^(Expand|Collapse|Expand\s*[\/ ]*\s*Collapse|Collapse\s*[\/ ]*\s*Expand|Expand\s*\[\s*Collapse\s*\])$/i.test(rawText)) {
        if (!el.hasAttribute('onclick')) el.remove();
      }
    });
  } catch (e) { /* Silently ignore errors */ }
}

if (typeof window !== 'undefined') {
  // Run on all major lifecycle events
  window.addEventListener('DOMContentLoaded', purgeInjectedExtensionElements);
  window.addEventListener('load', purgeInjectedExtensionElements);
  
  // CRITICAL: Run right before printing so overlays never appear in print view
  window.addEventListener('beforeprint', purgeInjectedExtensionElements);
  
  // Low-overhead MutationObserver targeting only direct children of body (no subtree)
  try {
    const _extObs = new MutationObserver(() => purgeInjectedExtensionElements());
    if (document.body) {
      _extObs.observe(document.body, { childList: true });
    }
  } catch (e) {}
  
  // Low-overhead fallback interval
  setInterval(purgeInjectedExtensionElements, 5000);
}
