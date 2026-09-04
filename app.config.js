/**
 * ==============================================================================
 * GARMENT BUNDLE TAG GENERATOR - CONFIGURATION FILE (app.config.js)
 * ==============================================================================
 * Central configuration file for all data paths.
 * You can set the database (.jsonl) folder and the Master Data (Excel / CSV) folder
 * to the same folder OR two completely different folders or drives.
 * ==============================================================================
 */

const APP_CONFIG = {
  // 1. DATA STORAGE DIRECTORY
  // Folder containing all .jsonl database files (garment_batches_data.jsonl, etc.)
  DATA_STORAGE_PATH: String.raw`D:\Pranto\Videos Work\GarmentTag-Portable-Package`,

  // 2. MASTER DATA STORAGE (Excel or CSV)
  // Folder where Docket Summary - From 1st Oct 2025-BABL-DT-JOBAYDA.xlsx is stored
  MASTER_DATA_STORAGE_PATH: String.raw`D:\Pranto\Videos Work`,
  MASTER_DATA_FILE: "Docket Summary - From 1st Oct 2025-BABL-DT-JOBAYDA.xlsx",

  // 3. DATABASE FILES (Co-located inside DATA_STORAGE_PATH)
  DATABASE_FILES: {
    batches: "garment_batches_data.jsonl",
    tags: "garment_tags_data.jsonl",
    specs: "garment_specs_data.jsonl",
    location: "garment_location_data.jsonl",
    archive: "garment_archive_data.jsonl"
  },

  // 4. LOCAL SERVER PORT & API URL
  SERVER_PORT: 3000,
  API_BASE_URL: "http://localhost:3000"
};

// CommonJS support for Node.js server (server.js) and Electron (electron-main.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}

// Global browser window support for BundleTagApp.html & LocationManager.html
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}
