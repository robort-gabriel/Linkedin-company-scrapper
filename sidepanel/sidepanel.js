// Side Panel UI Logic for LinkedIn Company Data Extractor

class SidePanelUI {
  constructor() {
    this.companies = [];
    this.state = {
      isRunning: false,
      isPaused: false,
      currentPage: 0,
      maxPages: 5,
      processedCompanies: 0,
      totalCompaniesFound: 0,
      importedCount: 0
    };
    
    // Track timeouts and intervals for cleanup
    this.activeTimeouts = [];
    this.activeIntervals = [];
    
    this.initializeElements();
    this.attachEventListeners();
    this.initializeTheme();
    this.loadInitialData();
  }

  /**
   * Safe setTimeout wrapper that tracks timeouts for cleanup
   */
  safeSetTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
      this.activeTimeouts = this.activeTimeouts.filter(id => id !== timeoutId);
      callback();
    }, delay);
    this.activeTimeouts.push(timeoutId);
    return timeoutId;
  }

  /**
   * Clear all active timeouts
   */
  clearAllTimeouts() {
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];
  }

  /**
   * Cleanup method for component unmount
   */
  cleanup() {
    this.clearAllTimeouts();
    // Remove event listeners if needed
    // Note: Chrome extension side panels persist, so cleanup is less critical
    // but good practice for future refactoring
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    // Controls
    this.startBtn = document.getElementById('startBtn');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.exportJsonBtn = document.getElementById('exportJsonBtn');
    this.exportCsvBtn = document.getElementById('exportCsvBtn');
    this.clearBtn = document.getElementById('clearBtn');
    
    // Import elements
    this.importJsonBtn = document.getElementById('importJsonBtn');
    this.importJsonInput = document.getElementById('importJsonInput');
    this.importCsvBtn = document.getElementById('importCsvBtn');
    this.importCsvInput = document.getElementById('importCsvInput');
    
    // Theme toggle
    this.themeToggle = document.getElementById('themeToggle');
    
    // Configuration
    this.maxPagesInput = document.getElementById('maxPages');
    
    // Status displays
    this.statusText = document.getElementById('statusText');
    this.currentPageDisplay = document.getElementById('currentPage');
    this.maxPagesDisplay = document.getElementById('maxPagesDisplay');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    
    // New status card elements
    this.statusSection = document.querySelector('.status-section');
    this.pageProgressBar = document.getElementById('pageProgressBar');
    this.companyProgressBar = document.getElementById('companyProgressBar');
    this.currentCompanyIndex = document.getElementById('currentCompanyIndex');
    this.totalCompaniesInQueue = document.getElementById('totalCompaniesInQueue');
    
    // Statistics
    this.totalFoundDisplay = document.getElementById('totalFound');
    this.totalProcessedDisplay = document.getElementById('totalProcessed');
    this.withWebsiteDisplay = document.getElementById('withWebsite');
    this.errorCountDisplay = document.getElementById('errorCount');
    this.importedCountDisplay = document.getElementById('importedCount');
    
    // Data table
    this.dataTableBody = document.getElementById('dataTableBody');
    
    // Custom modal elements
    this.customModal = document.getElementById('customModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalMessage = document.getElementById('modalMessage');
    this.modalStats = document.getElementById('modalStats');
    this.modalPages = document.getElementById('modalPages');
    this.modalFound = document.getElementById('modalFound');
    this.modalCollected = document.getElementById('modalCollected');
    this.modalErrors = document.getElementById('modalErrors');
    this.modalOk = document.getElementById('modalOk');
    this.modalClose = document.getElementById('modalClose');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.startBtn.addEventListener('click', () => this.handleStart());
    this.pauseBtn.addEventListener('click', () => this.handlePause());
    this.stopBtn.addEventListener('click', () => this.handleStop());
    this.exportJsonBtn.addEventListener('click', () => this.handleExportJSON());
    this.exportCsvBtn.addEventListener('click', () => this.handleExportCSV());
    this.clearBtn.addEventListener('click', () => this.handleClear());
    
    // Import event listeners
    this.importJsonBtn.addEventListener('click', () => this.importJsonInput.click());
    this.importJsonInput.addEventListener('change', (e) => this.handleImportJSON(e));
    this.importCsvBtn.addEventListener('click', () => this.importCsvInput.click());
    this.importCsvInput.addEventListener('change', (e) => this.handleImportCSV(e));
    
    // Theme toggle listener
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Modal event listeners
    this.modalOk.addEventListener('click', () => this.hideModal());
    this.modalClose.addEventListener('click', () => this.hideModal());
    this.customModal.addEventListener('click', (e) => {
      if (e.target === this.customModal) {
        this.hideModal();
      }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.customModal.style.display !== 'none') {
        this.hideModal();
      }
    });
    
    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message) => {
      this.handleServiceWorkerMessage(message);
    });
  }

  /**
   * Initialize theme from storage or system preference
   */
  initializeTheme() {
    chrome.storage.local.get(['theme'], (result) => {
      const savedTheme = result.theme;
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
      this.setTheme(theme);
    });
  }

  /**
   * Toggle between dark and light theme
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Set theme and save to storage
   */
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Toggle SVG icons
    const moonIcon = this.themeToggle.querySelector('.theme-icon:not(.theme-icon-sun)');
    const sunIcon = this.themeToggle.querySelector('.theme-icon-sun');
    
    if (theme === 'dark') {
      moonIcon.style.display = 'none';
      sunIcon.style.display = 'block';
    } else {
      moonIcon.style.display = 'block';
      sunIcon.style.display = 'none';
    }
    
    chrome.storage.local.set({ theme: theme });
  }

  /**
   * Load initial data from storage
   */
  async loadInitialData() {
    try {
      // Load companies
      const response = await chrome.runtime.sendMessage({ action: 'getCompanies' });
      if (response && response.success) {
        this.companies = response.companies || [];
        this.updateDataTable();
        this.updateStatistics();
        
        if (this.companies.length > 0) {
          this.exportJsonBtn.disabled = false;
          this.exportCsvBtn.disabled = false;
        }
      }
      
      // Load state
      const stateResponse = await chrome.runtime.sendMessage({ action: 'getState' });
      if (stateResponse && stateResponse.success) {
        this.state = stateResponse.state;
        this.updateUIState();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  /**
   * Handle start button click
   * FIXED: Update max pages display immediately when starting
   */
  async handleStart() {
    const maxPages = parseInt(this.maxPagesInput.value) || 5;
    
    if (maxPages < 1 || maxPages > 20) {
      this.showModal('Invalid Input', 'Please enter a valid number of pages (1-20)', null, 'error');
      return;
    }
    
    // FIXED: Update state immediately so max pages display updates
    this.state.maxPages = maxPages;
    this.state.currentPage = 0;
    
    this.updateStatus('Starting data collection...', 'primary');
    this.updateUIState(); // Update display immediately
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'startScraping',
        maxPages: maxPages
      });
      
      if (response && response.success) {
        this.state.isRunning = true;
        this.updateUIState();
      } else {
        // Reset state if failed
        this.state.isRunning = false;
        this.state.maxPages = 5;
        this.state.currentPage = 0;
        this.updateUIState();
        this.showModal('Start Failed', response?.error || 'Failed to start collection. Make sure you are on a LinkedIn company search results page.', null, 'error');
        this.updateStatus('Ready', 'secondary');
      }
    } catch (error) {
      // Reset state if error
      this.state.isRunning = false;
      this.state.maxPages = 5;
      this.state.currentPage = 0;
      this.updateUIState();
      this.showModal('Error', 'Error: ' + error.message, null, 'error');
      this.updateStatus('Error', 'danger');
    }
  }

  /**
   * Handle pause button click
   */
  async handlePause() {
    try {
      if (this.state.isPaused) {
        // Resume
        const response = await chrome.runtime.sendMessage({ action: 'resumeScraping' });
        if (response && response.success) {
          this.state.isPaused = false;
          this.pauseBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <span class="btn-text">Pause</span>
          `;
          this.updateStatus('Resumed collection...', 'primary');
        }
      } else {
        // Pause
        const response = await chrome.runtime.sendMessage({ action: 'pauseScraping' });
        if (response && response.success) {
          this.state.isPaused = true;
          this.pauseBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span class="btn-text">Resume</span>
          `;
          this.updateStatus('Paused', 'warning');
        }
      }
    } catch (error) {
      this.showModal('Error', 'Error: ' + error.message, null, 'error');
    }
  }

  /**
   * Handle stop button click
   * FIXED: Ensures immediate UI state reset
   */
  async handleStop() {
    if (!confirm('Are you sure you want to stop data collection?')) {
      return;
    }
    
    try {
      console.log('Side Panel: User clicked stop button, sending stop message...');
      
      const response = await chrome.runtime.sendMessage({ action: 'stopScraping' });
      
      if (response && response.success) {
        console.log('Side Panel: Stop command successful, resetting state...');
        
        // Immediately reset state
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Update UI immediately
        this.updateUIState();
        this.updateStatus('Stopped', 'danger');
        
        // Force another UI update after a short delay to ensure buttons are reset
        setTimeout(() => {
          this.state.isRunning = false;
          this.state.isPaused = false;
          this.updateUIState();
          console.log('Side Panel: Forced button state reset after stop');
        }, 200);
      } else {
        console.error('Side Panel: Stop command failed:', response);
        this.showModal('Stop Failed', 'Failed to stop data collection: ' + (response?.error || 'Unknown error'), null, 'error');
      }
    } catch (error) {
      console.error('Side Panel: Error stopping scraping:', error);
      this.showModal('Error', 'Error: ' + error.message, null, 'error');
      
      // Force reset state even on error
      this.state.isRunning = false;
      this.state.isPaused = false;
      this.updateUIState();
    }
  }

  /**
   * Handle JSON export button click
   */
  handleExportJSON() {
    if (this.companies.length === 0) {
      this.showModal('No Data', 'No data to export', null, 'error');
      return;
    }
    
    try {
      // Prepare export data
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: this.companies.length,
          source: 'LinkedIn Company Data Extractor',
          pagesScraped: this.state.currentPage
        },
        companies: this.companies
      };

      // Convert to JSON string with pretty formatting
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create blob
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `linkedin-companies-${timestamp}.json`;
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.updateStatus('JSON exported successfully', 'success');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
    } catch (error) {
      this.showModal('Export Error', 'Error exporting JSON: ' + error.message, null, 'error');
    }
  }

  /**
   * Handle CSV export button click
   */
  handleExportCSV() {
    if (this.companies.length === 0) {
      this.showModal('No Data', 'No data to export', null, 'error');
      return;
    }
    
    try {
      // Define CSV headers
      const headers = ['Name', 'Website', 'Industry', 'Phone', 'Headquarters', 'LinkedIn URL', 'Collection Date'];
      
      // Create CSV rows
      const rows = this.companies.map(company => [
        this.escapeCSV(company.name || ''),
        this.escapeCSV(company.website && company.website !== 'N/A' ? company.website : ''),
        this.escapeCSV(company.industry && company.industry !== 'N/A' ? company.industry : ''),
        this.escapeCSV(company.phone && company.phone !== 'N/A' ? company.phone : ''),
        this.escapeCSV(company.headquarters && company.headquarters !== 'N/A' ? company.headquarters : ''),
        this.escapeCSV(company.url || ''),
        this.escapeCSV(company.timestamp || '')
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create blob with BOM for Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `linkedin-companies-${timestamp}.csv`;
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.updateStatus('CSV exported successfully', 'success');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
    } catch (error) {
      this.showModal('Export Error', 'Error exporting CSV: ' + error.message, null, 'error');
    }
  }

  /**
   * Escape CSV fields that contain commas, quotes, or newlines
   */
  escapeCSV(field) {
    if (typeof field !== 'string') {
      field = String(field);
    }
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }

  /**
   * Handle JSON import
   * FIXED: Validates data structure, checks duplicates, merges with existing data
   */
  async handleImportJSON(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Reset input for future imports
    event.target.value = '';

    try {
      this.updateStatus('Importing JSON file...', 'primary');
      
      const text = await this.readFileAsText(file);
      const data = JSON.parse(text);
      
      // Validate JSON structure
      let companiesToImport = [];
      
      if (Array.isArray(data)) {
        // Direct array of companies
        companiesToImport = data;
      } else if (data.companies && Array.isArray(data.companies)) {
        // Object with companies array (export format)
        companiesToImport = data.companies;
      } else {
        throw new Error('Invalid JSON format. Expected array of companies or object with "companies" array.');
      }

      if (companiesToImport.length === 0) {
        this.showModal('Import Failed', 'JSON file contains no companies to import.', null, 'error');
        this.updateStatus('Import failed: No companies found', 'danger');
        return;
      }

      // Validate and normalize company data
      const validatedCompanies = this.validateAndNormalizeCompanies(companiesToImport);
      
      if (validatedCompanies.length === 0) {
        this.showModal('Import Failed', 'No valid companies found in JSON file. Companies must have at least a name or URL.', null, 'error');
        this.updateStatus('Import failed: No valid companies', 'danger');
        return;
      }

      // Import companies (with duplicate checking)
      const result = await this.importCompanies(validatedCompanies);
      
      // Show success message
      const message = `Import Complete!\n\n` +
        `Total in file: ${companiesToImport.length}\n` +
        `Valid companies: ${validatedCompanies.length}\n` +
        `New companies added: ${result.added}\n` +
        `Duplicates skipped: ${result.skipped}`;
      
      this.showModal('Import Complete', message, null, 'success');
      
      this.updateStatus(`Imported ${result.added} new companies`, 'success');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
      
    } catch (error) {
      console.error('Error importing JSON:', error);
      this.showModal('Import Error', 'Error importing JSON file: ' + error.message, null, 'error');
      this.updateStatus('Import failed', 'danger');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
    }
  }

  /**
   * Handle CSV import
   * FIXED: Parses CSV, validates data, checks duplicates, merges with existing data
   */
  async handleImportCSV(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Reset input for future imports
    event.target.value = '';

    try {
      this.updateStatus('Importing CSV file...', 'primary');
      
      const text = await this.readFileAsText(file);
      const companiesToImport = this.parseCSV(text);
      
      if (companiesToImport.length === 0) {
        this.showModal('Import Failed', 'CSV file contains no companies to import.', null, 'error');
        this.updateStatus('Import failed: No companies found', 'danger');
        return;
      }

      // Validate and normalize company data
      const validatedCompanies = this.validateAndNormalizeCompanies(companiesToImport);
      
      if (validatedCompanies.length === 0) {
        this.showModal('Import Failed', 'No valid companies found in CSV file. Companies must have at least a name or URL.', null, 'error');
        this.updateStatus('Import failed: No valid companies', 'danger');
        return;
      }

      // Import companies (with duplicate checking)
      const result = await this.importCompanies(validatedCompanies);
      
      // Show success message
      const message = `Import Complete!\n\n` +
        `Total in file: ${companiesToImport.length}\n` +
        `Valid companies: ${validatedCompanies.length}\n` +
        `New companies added: ${result.added}\n` +
        `Duplicates skipped: ${result.skipped}`;
      
      this.showModal('Import Complete', message, null, 'success');
      
      this.updateStatus(`Imported ${result.added} new companies`, 'success');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      this.showModal('Import Error', 'Error importing CSV file: ' + error.message, null, 'error');
      this.updateStatus('Import failed', 'danger');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
    }
  }

  /**
   * Read file as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse CSV text into array of company objects
   */
  parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return [];
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const headerMap = {};
    headers.forEach((header, index) => {
      const normalized = header.trim().toLowerCase();
      // Map common CSV column names to our data structure
      if (normalized.includes('name') || normalized === 'company') {
        headerMap.name = index;
      } else if (normalized.includes('website') && !normalized.includes('linkedin')) {
        headerMap.website = index;
      } else if (normalized.includes('industry')) {
        headerMap.industry = index;
      } else if (normalized.includes('phone')) {
        headerMap.phone = index;
      } else if (normalized.includes('headquarter') || normalized.includes('location')) {
        headerMap.headquarters = index;
      } else if (normalized.includes('linkedin') && (normalized.includes('url') || normalized.includes('link'))) {
        headerMap.url = index;
      } else if (normalized.includes('collection date') || normalized.includes('timestamp') || normalized.includes('date') || normalized.includes('time')) {
        headerMap.timestamp = index;
      }
    });

    // Parse data rows
    const companies = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const company = {};
      
      // Extract all fields, preserving empty values as empty strings (not skipping)
      if (headerMap.name !== undefined && values[headerMap.name] !== undefined) {
        company.name = values[headerMap.name].trim();
      }
      if (headerMap.website !== undefined && values[headerMap.website] !== undefined) {
        company.website = values[headerMap.website].trim();
      }
      if (headerMap.industry !== undefined && values[headerMap.industry] !== undefined) {
        company.industry = values[headerMap.industry].trim();
      }
      if (headerMap.phone !== undefined && values[headerMap.phone] !== undefined) {
        company.phone = values[headerMap.phone].trim();
      }
      if (headerMap.headquarters !== undefined && values[headerMap.headquarters] !== undefined) {
        company.headquarters = values[headerMap.headquarters].trim();
      }
      if (headerMap.url !== undefined && values[headerMap.url] !== undefined) {
        company.url = values[headerMap.url].trim();
      }
      if (headerMap.timestamp !== undefined && values[headerMap.timestamp] !== undefined) {
        company.timestamp = values[headerMap.timestamp].trim();
      }

      // Only add if has at least name or URL
      if (company.name || company.url) {
        companies.push(company);
      }
    }

    return companies;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current);
    return values;
  }

  /**
   * Validate and normalize company data from import
   */
  validateAndNormalizeCompanies(companies) {
    const validated = [];

    for (const company of companies) {
      // Must have at least name or URL
      if (!company.name && !company.url) {
        continue;
      }

      const normalized = {
        name: company.name ? String(company.name).trim() : 'N/A',
        website: company.website ? String(company.website).trim() : 'N/A',
        industry: company.industry ? String(company.industry).trim() : 'N/A',
        phone: company.phone ? String(company.phone).trim() : 'N/A',
        headquarters: company.headquarters ? String(company.headquarters).trim() : 'N/A',
        url: company.url ? String(company.url).trim() : '',
        timestamp: company.timestamp ? String(company.timestamp).trim() : new Date().toISOString()
      };

      // Normalize URL if provided
      if (normalized.url && !normalized.url.startsWith('http')) {
        if (normalized.url.includes('linkedin.com/company/')) {
          normalized.url = 'https://' + normalized.url.replace(/^https?:\/\//, '');
        }
      }

      validated.push(normalized);
    }

    return validated;
  }

  /**
   * Import companies with duplicate checking
   * Returns: { added: number, skipped: number }
   * FIXED: Properly tracks imported companies for statistics
   */
  async importCompanies(companiesToImport) {
    let added = 0;
    let skipped = 0;

    // Get existing companies
    const existingCompanies = [...this.companies];
    const initialCount = this.companies.length;

    for (const company of companiesToImport) {
      // Check if duplicate
      if (!this.isDuplicate(company)) {
        // Add to local array
        this.companies.push(company);
        added++;
      } else {
        skipped++;
      }
    }

    // Save to storage
    await chrome.runtime.sendMessage({
      action: 'updateCompanies',
      companies: this.companies
    });

    // Update imported count in state
    this.state.importedCount = this.companies.length - (this.state.processedCompanies || 0);

    // Update UI
    this.updateDataTable();
    this.updateStatistics();
    
    // Enable export buttons if we have data
    if (this.companies.length > 0) {
      this.exportJsonBtn.disabled = false;
      this.exportCsvBtn.disabled = false;
    }

    return { added, skipped };
  }

  /**
   * Handle clear button click
   */
  async handleClear() {
    if (!confirm('Are you sure you want to clear all collected data? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearData' });
      if (response && response.success) {
        this.companies = [];
        this.state = {
          isRunning: false,
          isPaused: false,
          currentPage: 0,
          maxPages: 5,
          processedCompanies: 0,
          totalCompaniesFound: 0
        };
        
        this.updateDataTable();
        this.updateStatistics();
        this.updateUIState();
        this.updateStatus('Data cleared', 'success');
        
        setTimeout(() => this.updateStatus('Ready', 'secondary'), 3000);
      }
    } catch (error) {
      this.showModal('Clear Error', 'Error clearing data: ' + error.message, null, 'error');
    }
  }

  /**
   * Handle messages from service worker
   * FIXED: Properly handles completion and stopped events with full state reset
   */
  handleServiceWorkerMessage(message) {
    console.log('Side Panel: Received message', message.action);
    
    switch(message.action) {
      case 'scrapingStarted':
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.updateUIState();
        this.updateStatus('Data collection started...', 'primary');
        break;
        
      case 'statusUpdate':
        this.updateStatus(message.status, 'primary');
        break;
        
      case 'companiesFound':
        this.state.totalCompaniesFound += message.count;
        this.state.currentPage = message.page || this.state.currentPage;
        // Update queue total if provided
        if (message.queueTotal !== undefined) {
          this.animateValueChange(this.totalCompaniesInQueue, message.queueTotal);
        }
        this.updateStatistics();
        this.updateProgress();
        break;
        
      case 'companyScraped':
        // FIXED: Handle skipped companies (already imported/exists)
        if (message.skipped) {
          console.log('LinkedIn Data Extractor: Company skipped (already exists):', message.company.name);
          this.state.processedCompanies = message.processed;
          this.updateStatistics();
          this.updateProgress();
          break;
        }
        
        // Check for duplicates before adding (safety check)
        if (!this.isDuplicate(message.company)) {
          this.companies.push(message.company);
          this.state.processedCompanies = message.processed;
          this.addCompanyToTable(message.company);
          this.updateStatistics();
          this.updateProgress();
          this.exportJsonBtn.disabled = false;
          this.exportCsvBtn.disabled = false;
        } else {
          console.log('LinkedIn Data Extractor: Duplicate company skipped:', message.company.name);
          // Still update processed count but don't add duplicate
          this.state.processedCompanies = message.processed;
          this.updateStatistics();
        }
        break;
        
      case 'scrapingComplete':
        // FIXED: Properly reset state and UI after completion
        console.log('Side Panel: Scraping completed, resetting state...');
        
        // Immediately reset state
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Update Company Processing to 100% immediately
        const totalInQueue = this.state.totalCompaniesFound || 0;
        const processed = this.state.processedCompanies || 0;
        if (this.companyProgressBar) {
          this.companyProgressBar.style.width = '100%';
        }
        if (this.currentCompanyIndex) {
          this.animateValueChange(this.currentCompanyIndex, processed);
        }
        if (this.totalCompaniesInQueue) {
          this.animateValueChange(this.totalCompaniesInQueue, totalInQueue);
        }
        this.setProcessStepActive('company', false);
        
        // Update status first
        this.updateStatus('Data collection complete!', 'success');
        
        // Update progress to show completion
        this.updateProgress();
        
        // Show custom modal with stats
        const stats = message.stats;
        const summary = `Collection Complete!\n\n` +
          `Pages Processed: ${stats.pagesScraped}\n` +
          `Companies Found: ${stats.totalFound}\n` +
          `Companies Collected: ${stats.totalProcessed}\n` +
          `Errors: ${stats.errors}`;
        
        // Show custom modal and reset UI after it's dismissed
        this.showModalAsync('Collection Complete!', summary, stats, 'success').then(() => {
        // After modal is dismissed, ensure complete reset
        // Force immediate state reset
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Update Company Processing to show 100% completion
        const totalInQueue = this.state.totalCompaniesFound || 0;
        const processed = this.state.processedCompanies || 0;
        if (this.companyProgressBar && totalInQueue > 0) {
          this.companyProgressBar.style.width = '100%';
        }
        if (this.currentCompanyIndex) {
          this.animateValueChange(this.currentCompanyIndex, processed);
        }
        this.setProcessStepActive('company', false);
        
        // Use multiple strategies to ensure UI updates (with tracked timeouts)
        // Strategy 1: Immediate update
        this.updateUIState();
        this.updateProgress();
        
        // Strategy 2: requestAnimationFrame for next frame
        requestAnimationFrame(() => {
          this.state.isRunning = false;
          this.state.isPaused = false;
          this.updateUIState();
          this.updateProgress();
        });
        
        // Strategy 3: setTimeout for DOM to process (tracked)
        this.safeSetTimeout(() => {
          this.state.isRunning = false;
          this.state.isPaused = false;
          this.updateUIState();
          this.updateProgress();
          console.log('Side Panel: Button states reset complete after modal (50ms)');
        }, 50);
        
        // Strategy 4: Final verification (tracked)
        this.safeSetTimeout(() => {
          // Final state check and force update
          if (this.state.isRunning !== false) {
            console.warn('Side Panel: State was not properly reset, forcing reset...');
            this.state.isRunning = false;
            this.state.isPaused = false;
          }
          this.updateUIState();
          console.log('Side Panel: Final button state verification (150ms)', {
            isRunning: this.state.isRunning,
            startDisabled: this.startBtn?.disabled,
            pauseDisabled: this.pauseBtn?.disabled,
            stopDisabled: this.stopBtn?.disabled
          });
        }, 150);
        });
        break;
        
      case 'scrapingStopped':
        // FIXED: Handle user-initiated stop with immediate state reset
        console.log('Side Panel: Scraping stopped by user or error, resetting state...');
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Update status first
        this.updateStatus('Stopped', 'danger');
        
        // Force immediate UI reset
        this.updateUIState();
        this.updateProgress();
        
        // Additional reset passes to ensure everything updates
        requestAnimationFrame(() => {
          this.state.isRunning = false;
          this.state.isPaused = false;
          this.updateUIState();
          this.updateProgress();
        });
        
        setTimeout(() => {
          this.state.isRunning = false;
          this.state.isPaused = false;
          this.updateUIState();
          this.updateProgress();
          console.log('Side Panel: Button states reset after stop');
        }, 100);
        break;
        
      case 'scrapingPaused':
        this.state.isPaused = true;
        this.updateUIState();
        this.updateStatus('Paused', 'warning');
        break;
        
      case 'scrapingResumed':
        this.state.isPaused = false;
        this.updateUIState();
        this.updateStatus('Resumed', 'primary');
        break;
    }
  }

  /**
   * Update UI state based on current state
   * FIXED: More robust state management with logging and defensive checks
   * ENHANCED: Force button state updates to prevent stuck states
   */
  updateUIState() {
    console.log('Side Panel: Updating UI state...', {
      isRunning: this.state.isRunning,
      isPaused: this.state.isPaused,
      currentPage: this.state.currentPage,
      maxPages: this.state.maxPages
    });
    
    // Ensure buttons exist
    if (!this.startBtn || !this.pauseBtn || !this.stopBtn) {
      console.error('Side Panel: Button elements not found!');
      return;
    }
    
    if (this.state.isRunning) {
      console.log('Side Panel: Setting buttons to RUNNING state');
      this.startBtn.disabled = true;
      this.startBtn.classList.add('active');
      this.pauseBtn.disabled = false;
      this.stopBtn.disabled = false;
      this.maxPagesInput.disabled = true;
      
      // Update pause button icon and text based on pause state
      if (this.state.isPaused) {
        this.pauseBtn.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span class="btn-text">Resume</span>
        `;
      } else {
        this.pauseBtn.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <span class="btn-text">Pause</span>
        `;
      }
    } else {
      console.log('Side Panel: Setting buttons to READY state (not running)');
      // Force reset all button states
      this.startBtn.disabled = false;
      this.startBtn.classList.remove('active');
      this.pauseBtn.disabled = true;
      this.stopBtn.disabled = true;
      this.maxPagesInput.disabled = false;
      this.pauseBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span class="btn-text">Pause</span>
      `;
      
      // Force DOM update by reading and setting properties
      // This ensures the browser processes the disabled state changes
      const startDisabled = this.startBtn.disabled;
      const pauseDisabled = this.pauseBtn.disabled;
      const stopDisabled = this.stopBtn.disabled;
      
      // Re-apply to force update
      this.startBtn.disabled = startDisabled;
      this.pauseBtn.disabled = pauseDisabled;
      this.stopBtn.disabled = stopDisabled;
    }
    
    // Verify button states were set correctly
    console.log('Side Panel: Button states after update:', {
      startDisabled: this.startBtn.disabled,
      pauseDisabled: this.pauseBtn.disabled,
      stopDisabled: this.stopBtn.disabled
    });
    
    // Animate page number changes
    this.animateValueChange(this.currentPageDisplay, this.state.currentPage);
    this.animateValueChange(this.maxPagesDisplay, this.state.maxPages || 0);
    this.updateProgress();
  }

  /**
   * Show custom modal popup
   */
  showModal(title, message, stats = null, type = 'info') {
    if (!this.customModal) return;
    
    // Set title and message
    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;
    
    // Update icon based on type
    const icon = this.customModal.querySelector('.modal-icon');
    if (icon) {
      if (type === 'success') {
        icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline>';
      } else if (type === 'error' || type === 'danger') {
        icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
      } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>';
      }
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
    }
    
    // Update icon color
    if (icon) {
      if (type === 'success') {
        icon.style.color = 'var(--success)';
      } else if (type === 'error' || type === 'danger') {
        icon.style.color = 'var(--danger)';
      } else {
        icon.style.color = 'var(--primary-500)';
      }
    }
    
    // Show/hide stats
    if (stats) {
      this.modalStats.style.display = 'flex';
      this.modalPages.textContent = stats.pagesScraped || 0;
      this.modalFound.textContent = stats.totalFound || 0;
      this.modalCollected.textContent = stats.totalProcessed || 0;
      this.modalErrors.textContent = stats.errors || 0;
    } else {
      this.modalStats.style.display = 'none';
    }
    
    // Show modal
    this.customModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus OK button
    setTimeout(() => {
      this.modalOk.focus();
    }, 100);
  }

  /**
   * Hide custom modal popup
   */
  hideModal() {
    if (!this.customModal) return;
    this.customModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Show modal and return a promise that resolves when user clicks OK
   */
  showModalAsync(title, message, stats = null, type = 'info') {
    return new Promise((resolve) => {
      this.showModal(title, message, stats, type);
      
      // Create temporary handler
      const handleOk = () => {
        this.modalOk.removeEventListener('click', handleOk);
        this.modalClose.removeEventListener('click', handleOk);
        this.hideModal();
        resolve();
      };
      
      this.modalOk.addEventListener('click', handleOk);
      this.modalClose.addEventListener('click', handleOk);
    });
  }

  /**
   * Update status text and color with smooth transition
   */
  updateStatus(text, type = 'secondary') {
    // Animate status change
    this.statusText.style.opacity = '0';
    this.statusText.style.transform = 'translateY(-5px)';
    
    setTimeout(() => {
      this.statusText.textContent = text;
      this.statusText.style.color = 
        type === 'primary' ? 'var(--primary-500)' :
        type === 'success' ? 'var(--success)' :
        type === 'danger' ? 'var(--danger)' :
        type === 'warning' ? 'var(--warning)' :
        'var(--text-secondary)';
      
      this.statusText.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      this.statusText.style.opacity = '1';
      this.statusText.style.transform = 'translateY(0)';
    }, 150);
  }

  /**
   * Update progress bar with smooth animation
   * ENHANCED: Now tracks page, company, and overall progress separately
   */
  updateProgress() {
    // If not running, show final state (100%) if we completed, otherwise reset to 0%
    if (!this.state.isRunning) {
      // Check if we actually completed (currentPage equals maxPages)
      const isCompleted = this.state.currentPage >= this.state.maxPages && this.state.maxPages > 0;
      
      if (isCompleted) {
        // Show 100% completion state
        const finalProgress = 100;
        if (this.progressBar) this.progressBar.style.width = '100%';
        if (this.progressText) this.progressText.textContent = '100%';
        if (this.pageProgressBar) this.pageProgressBar.style.width = '100%';
        
        // Company progress - always show 100% when completed
        const totalInQueue = this.state.totalCompaniesFound || 0;
        const processed = this.state.processedCompanies || 0;
        // When completed, show 100% for company processing regardless of actual ratio
        // This ensures it shows completion even if some companies were skipped/duplicates
        if (this.companyProgressBar) this.companyProgressBar.style.width = '100%';
        if (this.currentCompanyIndex) this.animateValueChange(this.currentCompanyIndex, processed);
        if (this.totalCompaniesInQueue) this.animateValueChange(this.totalCompaniesInQueue, totalInQueue);
        
        // Deactivate all process steps after completion
        this.setProcessStepActive('page', false);
        this.setProcessStepActive('company', false);
        this.setProcessStepActive('overall', false);
        if (this.statusSection) this.statusSection.removeAttribute('data-active');
      } else {
        // Reset to 0% if not completed
        if (this.progressBar) this.progressBar.style.width = '0%';
        if (this.progressText) this.progressText.textContent = '0%';
        if (this.pageProgressBar) this.pageProgressBar.style.width = '0%';
        if (this.companyProgressBar) this.companyProgressBar.style.width = '0%';
        this.setProcessStepActive('page', false);
        this.setProcessStepActive('company', false);
        this.setProcessStepActive('overall', false);
        if (this.statusSection) this.statusSection.removeAttribute('data-active');
      }
      
      if (this.state.maxPages === 0) {
        // Complete reset if maxPages is 0
        if (this.progressBar) this.progressBar.style.width = '0%';
        if (this.progressText) this.progressText.textContent = '0%';
        if (this.pageProgressBar) this.pageProgressBar.style.width = '0%';
        if (this.companyProgressBar) this.companyProgressBar.style.width = '0%';
      }
      
      return;
    }

    // Set active state
    if (this.statusSection) this.statusSection.setAttribute('data-active', 'true');

    // Calculate and update page progress
    const pageProgress = this.state.maxPages > 0 
      ? Math.min((this.state.currentPage / this.state.maxPages) * 100, 100)
      : 0;
    if (this.pageProgressBar) this.pageProgressBar.style.width = `${pageProgress}%`;
    if (this.currentPageDisplay) this.animateValueChange(this.currentPageDisplay, this.state.currentPage);
    if (this.maxPagesDisplay) this.animateValueChange(this.maxPagesDisplay, this.state.maxPages);
    this.setProcessStepActive('page', this.state.currentPage < this.state.maxPages);

    // Calculate and update company processing progress
    const totalInQueue = this.state.totalCompaniesFound || 0;
    const processed = this.state.processedCompanies || 0;
    const companyProgress = totalInQueue > 0 
      ? Math.min((processed / totalInQueue) * 100, 100)
      : 0;
    
    if (this.companyProgressBar) this.companyProgressBar.style.width = `${companyProgress}%`;
    if (this.currentCompanyIndex) this.animateValueChange(this.currentCompanyIndex, processed);
    if (this.totalCompaniesInQueue) this.animateValueChange(this.totalCompaniesInQueue, totalInQueue);
    this.setProcessStepActive('company', processed < totalInQueue && this.state.isRunning);

    // Calculate overall progress as weighted combination of page and company progress
    // Page navigation is 30% of overall work, company processing is 70%
    // This ensures overall progress only reaches 100% when both are complete
    let overallProgress = 0;
    
    if (this.state.maxPages > 0 && totalInQueue > 0) {
      // Both page navigation and company processing are active
      // Weight: 30% for pages, 70% for companies
      overallProgress = (pageProgress * 0.3) + (companyProgress * 0.7);
    } else if (this.state.maxPages > 0 && totalInQueue === 0) {
      // Only page navigation (no companies found yet)
      // Use page progress but cap at 30% until companies are found
      overallProgress = Math.min(pageProgress * 0.3, 30);
    } else if (this.state.maxPages === 0 && totalInQueue > 0) {
      // Only company processing (pages already done or not applicable)
      overallProgress = companyProgress;
    } else {
      // No progress data available
      overallProgress = 0;
    }
    
    // Ensure overall progress never exceeds 100%
    overallProgress = Math.min(overallProgress, 100);
    const roundedOverallProgress = Math.round(overallProgress);
    
    // Update overall progress bar
    if (this.progressBar) this.progressBar.style.width = `${overallProgress}%`;
    if (this.progressText) this.animateValueChange(this.progressText, roundedOverallProgress, '%');
    this.setProcessStepActive('overall', overallProgress < 100);
  }

  /**
   * Set active state for a process step
   */
  setProcessStepActive(stepName, isActive) {
    const stepElement = document.querySelector(`.process-step[data-step="${stepName}"]`);
    if (stepElement) {
      if (isActive) {
        stepElement.setAttribute('data-active', 'true');
      } else {
        stepElement.removeAttribute('data-active');
      }
    }
  }

  /**
   * Animate value change with updating class
   * ENHANCED: Supports optional suffix parameter for percentage display
   */
  animateValueChange(element, newValue, suffix = '') {
    if (!element) return;
    
    const oldValue = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const newValueNum = parseInt(newValue) || 0;
    
    if (oldValue !== newValueNum) {
      element.classList.add('updating');
      element.textContent = newValueNum + suffix;
      setTimeout(() => {
        element.classList.remove('updating');
      }, 600);
    } else {
      element.textContent = newValueNum + suffix;
    }
  }

  /**
   * Update statistics display with real-time animations
   * FIXED: Properly tracks imported companies count with smooth updates
   */
  updateStatistics() {
    // Animate value changes
    this.animateValueChange(this.totalFoundDisplay, this.state.totalCompaniesFound || this.companies.length);
    this.animateValueChange(this.totalProcessedDisplay, this.state.processedCompanies || this.companies.length);
    
    const withWebsite = this.companies.filter(c => c.website && c.website !== 'N/A').length;
    this.animateValueChange(this.withWebsiteDisplay, withWebsite);
    
    const errors = this.state.errors?.length || 0;
    this.animateValueChange(this.errorCountDisplay, errors);
    
    // Calculate imported count: total companies minus those scraped in current session
    const importedCount = Math.max(0, this.companies.length - (this.state.processedCompanies || 0));
    this.animateValueChange(this.importedCountDisplay, importedCount);
  }


  /**
   * Update data table with all companies
   */
  updateDataTable() {
    if (this.companies.length === 0) {
      this.dataTableBody.innerHTML = `
        <tr class="empty-state">
          <td colspan="7">
            <svg style="width: 48px; height: 48px; margin: 0 auto var(--spacing-md); display: block; opacity: 0.3;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <div>No companies yet</div>
            <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Start collection or import data to see results</div>
          </td>
        </tr>
      `;
      return;
    }
    
    this.dataTableBody.innerHTML = '';
    this.companies.forEach((company, index) => {
      this.addCompanyToTable(company, index + 1);
    });
  }

  /**
   * Add a single company to the table with real-time animation
   */
  addCompanyToTable(company, index = null) {
    // Remove empty state if present
    const emptyState = this.dataTableBody.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => emptyState.remove(), 300);
    }
    
    const row = document.createElement('tr');
    const rowIndex = index || this.companies.length;
    row.setAttribute('data-company-index', rowIndex - 1);
    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    
    row.innerHTML = `
      <td>${rowIndex}</td>
      <td title="${this.escapeHtml(company.name)}">${this.escapeHtml(company.name)}</td>
      <td title="${this.escapeHtml(company.website || 'N/A')}">
        ${company.website && company.website !== 'N/A' ? 
          `<a href="${this.escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(company.website)}</a>` : 
          'N/A'}
      </td>
      <td title="${this.escapeHtml(company.industry || 'N/A')}">${this.escapeHtml(company.industry || 'N/A')}</td>
      <td title="${this.escapeHtml(company.phone || 'N/A')}">${this.escapeHtml(company.phone || 'N/A')}</td>
      <td title="${this.escapeHtml(company.headquarters || 'N/A')}">${this.escapeHtml(company.headquarters || 'N/A')}</td>
      <td>
        <button class="btn-delete" data-company-index="${rowIndex - 1}" title="Delete this company" aria-label="Delete company">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </td>
    `;
    
    // Add delete button event listener
    const deleteBtn = row.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDeleteCompany(rowIndex - 1);
    });
    
    this.dataTableBody.appendChild(row);
    
    // Animate row appearance
    requestAnimationFrame(() => {
      row.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    });
  }

  /**
   * Check if a company already exists (duplicate check)
   * FIXED: Enhanced matching with improved URL normalization and name matching
   */
  isDuplicate(company) {
    if (!company) return false;
    
    // Enhanced URL normalization (matches service worker logic)
    const normalizeUrl = (url) => {
      if (!url || url === 'N/A' || typeof url !== 'string') return null;
      
      try {
        let normalized = url.split('?')[0].split('#')[0].trim().toLowerCase();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/^www\./, '');
        
        // Handle LinkedIn company URLs
        if (normalized.includes('linkedin.com/company/')) {
          const match = normalized.match(/linkedin\.com\/company\/([^\/]+)/);
          if (match && match[1]) {
            return `linkedin.com/company/${match[1]}`;
          }
        }
        
        normalized = normalized.replace(/\/+$/, '');
        return normalized || null;
      } catch (error) {
        return null;
      }
    };
    
    // Extract company slug from LinkedIn URL
    const extractCompanySlug = (url) => {
      const normalized = normalizeUrl(url);
      if (!normalized) return null;
      const match = normalized.match(/linkedin\.com\/company\/([^\/]+)/);
      return match ? match[1] : null;
    };
    
    // Normalize names for comparison
    const normalizeName = (name) => {
      if (!name || name === 'N/A') return null;
      return name.toLowerCase().trim();
    };
    
    const companyUrl = normalizeUrl(company.url);
    const companyName = normalizeName(company.name);
    const companySlug = extractCompanySlug(company.url);
    
    // Strategy 1: Check by normalized URL
    if (companyUrl) {
      const duplicateByUrl = this.companies.find(c => {
        const existingUrl = normalizeUrl(c.url);
        if (!existingUrl) return false;
        
        if (existingUrl === companyUrl) {
          return true;
        }
        
        // For LinkedIn URLs, also check by slug
        if (companySlug && existingUrl.includes('linkedin.com/company/')) {
          const existingSlug = extractCompanySlug(c.url);
          if (existingSlug && existingSlug === companySlug) {
            return true;
          }
        }
        
        return false;
      });
      
      if (duplicateByUrl) {
        return true;
      }
    }
    
    // Strategy 2: Check by company slug
    if (companySlug) {
      const duplicateBySlug = this.companies.find(c => {
        const existingSlug = extractCompanySlug(c.url);
        return existingSlug && existingSlug === companySlug;
      });
      
      if (duplicateBySlug) {
        return true;
      }
    }
    
    // Strategy 3: Check by name (even if URL exists, as secondary check)
    if (companyName) {
      const duplicateByName = this.companies.find(c => {
        const existingName = normalizeName(c.name);
        if (!existingName || existingName === 'n/a') return false;
        
        // Exact match
        if (existingName === companyName) {
          return true;
        }
        
        // Fuzzy match: remove common suffixes
        const cleanExisting = existingName.replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '').trim();
        const cleanNew = companyName.replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '').trim();
        
        if (cleanExisting === cleanNew && cleanExisting.length > 3) {
          return true;
        }
        
        return false;
      });
      
      if (duplicateByName) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handle delete company button click
   */
  async handleDeleteCompany(index) {
    if (index < 0 || index >= this.companies.length) {
      console.error('Invalid company index:', index);
      return;
    }
    
    const company = this.companies[index];
    if (!confirm(`Are you sure you want to delete "${company.name}"?`)) {
      return;
    }
    
    try {
      // Remove from array
      this.companies.splice(index, 1);
      
      // Update processed count
      if (this.state.processedCompanies > 0) {
        this.state.processedCompanies--;
      }
      
      // Save to storage
      await chrome.runtime.sendMessage({ 
        action: 'updateCompanies',
        companies: this.companies
      });
      
      // Update UI
      this.updateDataTable();
      this.updateStatistics();
      
      // Disable export buttons if no companies left
      if (this.companies.length === 0) {
        this.exportJsonBtn.disabled = true;
        this.exportCsvBtn.disabled = true;
      }
      
      this.updateStatus('Company deleted', 'success');
      setTimeout(() => this.updateStatus('Ready', 'secondary'), 2000);
    } catch (error) {
      console.error('Error deleting company:', error);
      this.showModal('Delete Error', 'Error deleting company: ' + error.message, null, 'error');
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const ui = new SidePanelUI();
  console.log('LinkedIn Company Data Extractor: Side panel initialized');
});

