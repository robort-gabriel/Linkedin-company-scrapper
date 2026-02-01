// Background Service Worker for LinkedIn Scraper Extension
// Coordinates scraping operations and manages state

// Import utilities (note: in service worker, we need to use importScripts or inline)
// For Manifest V3, we'll inline the necessary logic

class ScraperCoordinator {
  constructor() {
    this.state = {
      isRunning: false,
      isPaused: false,
      currentPage: 1,
      startPage: 1, // Track the starting page number
      maxPages: 5,
      processedCompanies: 0,
      totalCompaniesFound: 0,
      companyQueue: [],
      currentCompanyIndex: 0,
      errors: []
    };
    
    this.rateLimiter = {
      minDelay: 5000,
      maxDelay: 10000,
      lastRequestTime: 0
    };
    
    this.activeTabId = null;
    this.searchTabId = null;
  }

  /**
   * Extract current page number from LinkedIn URL
   * LinkedIn URLs can have page parameter like: &page=10 or ?page=10
   * @param {string} url - The LinkedIn search URL
   * @returns {number} Current page number (defaults to 1 if not found)
   */
  extractPageNumberFromUrl(url) {
    if (!url || typeof url !== 'string') {
      return 1;
    }
    
    try {
      // Try to extract page number from URL parameters
      const urlObj = new URL(url);
      const pageParam = urlObj.searchParams.get('page');
      
      if (pageParam) {
        const pageNum = parseInt(pageParam, 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          console.log(`Scraper: Detected page number ${pageNum} from URL`);
          return pageNum;
        }
      }
      
      // LinkedIn might also use different URL patterns
      // Check for patterns like /page-10/ or similar
      const pageMatch = url.match(/[?&]page[=:](\d+)/i);
      if (pageMatch && pageMatch[1]) {
        const pageNum = parseInt(pageMatch[1], 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          console.log(`Scraper: Detected page number ${pageNum} from URL pattern`);
          return pageNum;
        }
      }
      
      // Default to page 1 if no page number found
      console.log('Scraper: No page number found in URL, defaulting to page 1');
      return 1;
    } catch (error) {
      console.warn('Scraper: Error extracting page number from URL:', error);
      return 1;
    }
  }

  /**
   * Get random delay for rate limiting
   */
  getRandomDelay() {
    const baseDelay = Math.random() * (this.rateLimiter.maxDelay - this.rateLimiter.minDelay) + this.rateLimiter.minDelay;
    const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Wait with rate limiting
   */
  async waitWithRateLimit() {
    const delay = this.getRandomDelay();
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiter.lastRequestTime;
    
    let actualDelay = delay;
    if (timeSinceLastRequest < delay) {
      actualDelay = delay - timeSinceLastRequest;
    } else {
      actualDelay = Math.min(delay, 2000); // At least 2 seconds
    }
    
    if (actualDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
    
    this.rateLimiter.lastRequestTime = Date.now();
  }

  /**
   * Start scraping process
   * FIXED: Now detects current page from URL and navigates forward for specified number of pages
   */
  async startScraping(searchTabId, maxPages = 5) {
    console.log('Scraper: Starting scraping process...');
    
    // Get the current tab to detect starting page number
    let startPage = 1;
    try {
      const currentTab = await chrome.tabs.get(searchTabId);
      if (currentTab && currentTab.url) {
        // First try to extract from URL
        startPage = this.extractPageNumberFromUrl(currentTab.url);
        
        // If URL doesn't have page number, try to detect from page content
        if (startPage === 1) {
          console.log('Scraper: No page number in URL, attempting to detect from page content...');
          try {
            await this.ensureContentScriptInjected(searchTabId);
            const pageResponse = await this.sendMessageToTab(searchTabId, { 
              action: 'getCurrentPageNumber' 
            });
            
            if (pageResponse && pageResponse.success && pageResponse.pageNumber) {
              startPage = pageResponse.pageNumber;
              console.log(`Scraper: Detected page ${startPage} from page content`);
            } else {
              console.log('Scraper: Could not detect page from content, defaulting to page 1');
            }
          } catch (contentError) {
            console.warn('Scraper: Error detecting page from content:', contentError);
            // Default to 1 if detection fails
          }
        } else {
          console.log(`Scraper: Starting from page ${startPage} (detected from URL)`);
        }
      }
    } catch (error) {
      console.warn('Scraper: Could not detect starting page, defaulting to page 1:', error);
      startPage = 1;
    }
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.maxPages = maxPages; // Number of pages to process
    this.state.startPage = startPage; // Track where we started
    this.state.currentPage = startPage; // Start from current page
    this.state.processedCompanies = 0;
    this.state.totalCompaniesFound = 0;
    this.state.companyQueue = [];
    this.state.currentCompanyIndex = 0;
    this.state.errors = [];
    this.searchTabId = searchTabId;
    
    console.log(`Scraper: Will process ${maxPages} pages starting from page ${startPage}`);
    console.log(`Scraper: Target end page: ${startPage + maxPages - 1}`);
    
    await this.saveState();
    this.notifyUI({ action: 'scrapingStarted' });
    
    try {
      await this.processCurrentPage();
    } catch (error) {
      console.error('Scraper: Error during scraping', error);
      this.state.errors.push(error.message);
      await this.stopScraping();
    }
  }

  /**
   * Process current search results page
   */
  async processCurrentPage() {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }
    
    const pagesProcessed = this.state.currentPage - this.state.startPage + 1;
    const targetEndPage = this.state.startPage + this.state.maxPages - 1;
    console.log(`Scraper: Processing page ${this.state.currentPage} (${pagesProcessed}/${this.state.maxPages} pages from start page ${this.state.startPage}, target: page ${targetEndPage})`);
    
    // Ensure search tab is still valid and content script is injected
    try {
      await this.ensureContentScriptInjected(this.searchTabId);
    } catch (error) {
      console.error('Scraper: Failed to ensure content script on search tab', error);
      this.state.errors.push(`Page ${this.state.currentPage}: Content script injection failed`);
      await this.completeScraping();
      return;
    }
    
    this.notifyUI({ 
      action: 'statusUpdate', 
      status: `Processing page ${this.state.currentPage}...` 
    });
    
    try {
      // Extract company URLs from current page
      const response = await this.sendMessageToTab(this.searchTabId, { 
        action: 'extractCompanyURLs' 
      });
      
      if (!response) {
        throw new Error('No response from content script. Make sure you are on a LinkedIn company search results page.');
      }
      
      if (!response.success) {
        const errorMsg = response.error || 'Unknown error';
        throw new Error(`Failed to extract company URLs: ${errorMsg}`);
      }
      
      if (!response.urls || !Array.isArray(response.urls)) {
        throw new Error('Invalid response format from content script');
      }
      
      // Get companies data (with names if available)
      const companiesData = response.companies || response.urls.map(url => ({ url: url, name: '' }));
      const urls = response.urls || [];
      
      if (companiesData.length === 0) {
        console.warn('Scraper: No companies found on page. This might mean:');
        console.warn('  1. LinkedIn changed their HTML structure');
        console.warn('  2. The page hasn\'t fully loaded yet');
        console.warn('  3. You\'re not on a company search results page');
        console.warn('  4. This is the last page with no results');
        
        this.notifyUI({ 
          action: 'statusUpdate', 
          status: `No companies found on page ${this.state.currentPage}. Moving to next page or completing...` 
        });
        
        // Empty queue - move to next page or stop
        this.state.companyQueue = [];
      } else {
        // FIXED: Pre-filter companies (URL + NAME) to check for duplicates BEFORE adding to queue
        // This prevents opening tabs for companies that already exist
        console.log(`Scraper: Found ${companiesData.length} companies on page ${this.state.currentPage}`);
        console.log(`Scraper: Checking for duplicates (URL + Name) before adding to queue...`);
        
        const existingCompanies = await this.getCompanies();
        const filteredCompanies = [];
        const skippedCompanies = [];
        
        for (const company of companiesData) {
          // Use actual company data (URL + NAME) for comprehensive duplicate checking
          const companyToCheck = {
            url: company.url || company,
            name: company.name || ''
          };
          
          // FIXED: Use comprehensive duplicate check with URL, slug, AND name
          const isDuplicate = this.isDuplicateCompany(companyToCheck, existingCompanies);
          
          if (isDuplicate) {
            skippedCompanies.push(companyToCheck);
            console.log(`Scraper: Skipping duplicate (already exists): ${companyToCheck.url} - "${companyToCheck.name}"`);
          } else {
            filteredCompanies.push(companyToCheck);
            console.log(`Scraper: New company to scrape: ${companyToCheck.url} - "${companyToCheck.name}"`);
          }
        }
        
        console.log(`Scraper: Pre-filter results - Total: ${companiesData.length}, New: ${filteredCompanies.length}, Duplicates: ${skippedCompanies.length}`);
        
        // Set queue to only NEW companies (extract URLs for queue)
        this.state.companyQueue = filteredCompanies.map(c => c.url);
        this.state.totalCompaniesFound += companiesData.length;
        this.state.currentCompanyIndex = 0;
        
        this.notifyUI({ 
          action: 'companiesFound', 
          count: companiesData.length,
          page: this.state.currentPage
        });
        
        // Notify about skipped duplicates with details
        if (skippedCompanies.length > 0) {
          const skippedNames = skippedCompanies.slice(0, 3).map(c => c.name || 'Unknown').join(', ');
          const moreText = skippedCompanies.length > 3 ? ` and ${skippedCompanies.length - 3} more` : '';
          this.notifyUI({ 
            action: 'statusUpdate', 
            status: `Page ${this.state.currentPage}: ${filteredCompanies.length} new, ${skippedCompanies.length} skipped (${skippedNames}${moreText})` 
          });
        }
        
        await this.saveState();
        
        // Process only NEW companies (duplicates already filtered out)
        if (filteredCompanies.length > 0) {
          console.log(`Scraper: Processing ${filteredCompanies.length} new companies (all duplicate checks passed)`);
          await this.processCompanyQueue();
        } else {
          console.log(`Scraper: All companies on page ${this.state.currentPage} already exist, moving to next page...`);
          this.notifyUI({ 
            action: 'statusUpdate', 
            status: `All companies on page ${this.state.currentPage} already collected` 
          });
        }
      }
      
      // FIXED: Check user's maxPages requirement FIRST before checking LinkedIn pagination
      // FIXED: Check if we've processed the requested number of pages from the starting page
      // Calculate target end page: startPage + maxPages - 1
      // Example: startPage=10, maxPages=5 → process pages 10,11,12,13,14 (5 pages total)
      const targetEndPage = this.state.startPage + this.state.maxPages - 1;
      const pagesProcessed = this.state.currentPage - this.state.startPage + 1;
      
      if (this.state.isRunning && !this.state.isPaused && pagesProcessed < this.state.maxPages) {
        console.log(`Scraper: Page ${this.state.currentPage} complete. Processed ${pagesProcessed}/${this.state.maxPages} pages. Target: page ${targetEndPage}. Attempting to go to next page...`);
        await this.goToNextPage();
      } else {
        console.log(`Scraper: Reached page limit. Started at page ${this.state.startPage}, processed ${pagesProcessed} pages, reached page ${this.state.currentPage}. Target was page ${targetEndPage}. Completing scraping...`);
        await this.completeScraping();
      }
    } catch (error) {
      console.error('Scraper: Error processing page', error);
      const errorMessage = error.message || 'Unknown error occurred';
      this.state.errors.push(`Page ${this.state.currentPage}: ${errorMessage}`);
      
      this.notifyUI({ 
        action: 'statusUpdate', 
        status: `Error: ${errorMessage}` 
      });
      
      await this.completeScraping();
    }
  }

  /**
   * Process queue of companies
   */
  async processCompanyQueue() {
    for (let i = 0; i < this.state.companyQueue.length; i++) {
      if (!this.state.isRunning || this.state.isPaused) {
        break;
      }
      
      const companyUrl = this.state.companyQueue[i];
      this.state.currentCompanyIndex = i;
      
      await this.processCompany(companyUrl);
    }
  }

  /**
   * Process individual company
   * FIXED: Final duplicate check BEFORE opening tab (safety net)
   */
  async processCompany(companyUrl) {
    console.log(`Scraper: Processing company ${this.state.currentCompanyIndex + 1}/${this.state.companyQueue.length}`);
    
    // FIXED: Final duplicate check BEFORE opening tab (safety net)
    // This ensures we never open a tab for a duplicate, even if pre-filter missed something
    const existingCompanies = await this.getCompanies();
    const tempCompany = { url: companyUrl, name: '' };
    const isDuplicate = this.isDuplicateCompany(tempCompany, existingCompanies);
    
    if (isDuplicate) {
      console.log(`Scraper: Final check - Duplicate detected before opening tab: ${companyUrl}`);
      console.log(`Scraper: Skipping (should have been caught in pre-filter, but safety check caught it)`);
      
      this.state.processedCompanies++;
      this.notifyUI({ 
        action: 'statusUpdate', 
        status: `Skipped duplicate: ${companyUrl}` 
      });
      
      await this.saveState();
      return; // Skip opening tab
    }
    
    this.notifyUI({ 
      action: 'statusUpdate', 
      status: `Scraping company ${this.state.processedCompanies + 1}...` 
    });
    
    try {
      // Wait for rate limiting
      await this.waitWithRateLimit();
      
      // Ensure we navigate to the About page directly
      let aboutUrl = companyUrl;
      if (!aboutUrl.includes('/about/')) {
        // Remove trailing slash if present, then append /about/
        aboutUrl = aboutUrl.replace(/\/$/, '') + '/about/';
      }
      
      console.log(`Scraper: All checks passed - Opening About page: ${aboutUrl}`);
      
      // Open company About page in new tab
      const tab = await chrome.tabs.create({ 
        url: aboutUrl, 
        active: false 
      });
      
      this.activeTabId = tab.id;
      
      // Wait for page to load
      await this.waitForTabLoad(tab.id);
      
      // Extract company data
      const response = await this.sendMessageToTab(tab.id, { 
        action: 'extractCompanyData' 
      });
      
      if (response && response.success && response.data) {
        // Save company data (with duplicate check as final safety net)
        const wasAdded = await this.saveCompanyData(response.data);
        
        if (wasAdded) {
          this.state.processedCompanies++;
          
          this.notifyUI({ 
            action: 'companyScraped', 
            company: response.data,
            processed: this.state.processedCompanies
          });
          
          console.log(`Scraper: Successfully scraped ${response.data.name}`);
        } else {
          // Duplicate (shouldn't happen since we pre-filtered, but safety check)
          this.state.processedCompanies++;
          console.warn(`Scraper: Unexpected duplicate detected (should have been pre-filtered): ${response.data.name}`);
        }
      } else {
        throw new Error('Failed to extract company data');
      }
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      this.activeTabId = null;
      
      await this.saveState();
      
    } catch (error) {
      console.error('Scraper: Error processing company', error);
      this.state.errors.push(`Company ${companyUrl}: ${error.message}`);
      
      // Try to close tab if it's still open
      if (this.activeTabId) {
        try {
          await chrome.tabs.remove(this.activeTabId);
        } catch (e) {
          // Tab might already be closed
        }
        this.activeTabId = null;
      }
    }
  }

  /**
   * Go to next page with improved navigation handling
   * FIXED: Now attempts pagination even if button detection is unreliable
   */
  async goToNextPage() {
    console.log(`Scraper: Attempting to move to page ${this.state.currentPage + 1}...`);
    
    try {
      // Ensure search tab is still valid
      const searchTab = await chrome.tabs.get(this.searchTabId);
      if (!searchTab || !searchTab.url || !searchTab.url.includes('linkedin.com')) {
        throw new Error('Search tab is no longer valid');
      }
      
      const initialUrl = searchTab.url;
      
      // Activate the search tab to ensure it's ready
      await chrome.tabs.update(this.searchTabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Ensure content script is injected
      await this.ensureContentScriptInjected(this.searchTabId);
      
      // Check if next page button exists (but don't stop if detection fails)
      const checkResponse = await this.sendMessageToTab(this.searchTabId, { 
        action: 'checkPagination' 
      });
      
      let hasNextButton = false;
      if (checkResponse && checkResponse.success && checkResponse.hasNextPage) {
        hasNextButton = true;
        console.log('Scraper: Next page button detected');
      } else {
        console.warn('Scraper: Next page button not detected, but will attempt navigation anyway');
        console.warn('Scraper: User requested multiple pages, so trying to navigate even without visible button');
      }
      
      // FIXED: Attempt to click next page button regardless of detection
      // The user specified they want multiple pages, so we should try
      console.log('Scraper: Attempting to click next page button...');
      
      const clickResponse = await this.sendMessageToTab(this.searchTabId, { 
        action: 'clickNextPage' 
      });
      
      if (!clickResponse || !clickResponse.success) {
        // Button click failed - this might mean we've reached the actual last page
        console.error('Scraper: Failed to click next page button:', clickResponse?.error || 'No response');
        console.log(`Scraper: Cannot proceed to page ${this.state.currentPage + 1}. This might be the last available page.`);
        
        // Check if we found any companies on this page
        if (this.state.companyQueue.length === 0 && this.state.processedCompanies === 0) {
          throw new Error('No pagination button found and no companies extracted. Might not be on a valid search results page.');
        }
        
        // We've truly reached the end of available pages
        console.log('Scraper: Reached the last available page on LinkedIn.');
        await this.completeScraping();
        return;
      }
      
      console.log('Scraper: Next page button clicked successfully, waiting for navigation...');
      
      // Increment page counter AFTER successful click
      this.state.currentPage++;
      await this.saveState();
      
      // Wait for URL to change (LinkedIn SPA navigation)
      try {
        await this.waitForTabNavigation(this.searchTabId, initialUrl, 20000);
        console.log('Scraper: Navigation completed successfully');
      } catch (navError) {
        console.warn('Scraper: Navigation timeout, but will check if page changed...', navError);
      }
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ensure content script is still injected after navigation
      await this.ensureContentScriptInjected(this.searchTabId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify we're still on a search results page
      const updatedTab = await chrome.tabs.get(this.searchTabId);
      if (!updatedTab.url || !updatedTab.url.includes('/search/results/companies/')) {
        console.error('Scraper: Navigation failed - not on search results page anymore:', updatedTab.url);
        throw new Error('Navigation took us away from search results page');
      }
      
      console.log(`Scraper: Successfully navigated to page ${this.state.currentPage}, URL: ${updatedTab.url}`);
      
      // Process new page
      await this.processCurrentPage();
      
    } catch (error) {
      console.error('Scraper: Error navigating to next page', error);
      this.state.errors.push(`Pagination to page ${this.state.currentPage + 1}: ${error.message}`);
      
      this.notifyUI({ 
        action: 'statusUpdate', 
        status: `Navigation error: ${error.message}` 
      });
      
      // Cannot continue - complete scraping with what we have
      console.log('Scraper: Cannot continue pagination, completing with collected data...');
      await this.completeScraping();
    }
  }

  /**
   * Wait for tab navigation to complete (URL change)
   */
  async waitForTabNavigation(tabId, initialUrl, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkNavigation = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          
          if (chrome.runtime.lastError) {
            reject(new Error('Tab closed or not found'));
            return;
          }
          
          const currentUrl = tab.url || '';
          
          // Check if URL changed
          if (currentUrl !== initialUrl && currentUrl.includes('linkedin.com')) {
            console.log('Scraper: Navigation detected:', currentUrl);
            resolve();
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > timeout) {
            // If URL hasn't changed but we've waited long enough, continue anyway
            console.warn('Scraper: Navigation timeout, but continuing...');
            resolve();
            return;
          }
          
          // Check again soon
          setTimeout(checkNavigation, 300);
        } catch (error) {
          reject(error);
        }
      };
      
      checkNavigation();
    });
  }

  /**
   * Complete scraping (successful finish or natural end)
   * FIXED: Properly resets all state and ensures UI is updated
   */
  async completeScraping() {
    console.log('Scraper: Completing scraping process...');
    console.log(`Scraper: Final stats - Pages: ${this.state.currentPage}/${this.state.maxPages}, Companies: ${this.state.processedCompanies}, Errors: ${this.state.errors.length}`);
    
    // Mark as no longer running
    this.state.isRunning = false;
    this.state.isPaused = false;
    
    // Close active company tab if any
    if (this.activeTabId) {
      try {
        await chrome.tabs.remove(this.activeTabId);
        console.log('Scraper: Closed active company tab');
      } catch (e) {
        console.log('Scraper: Active tab already closed');
      }
      this.activeTabId = null;
    }
    
    // Save final state
    await this.saveState();
    console.log('Scraper: Final state saved');
    
    // Prepare completion stats
    const stats = {
      totalProcessed: this.state.processedCompanies,
      totalFound: this.state.totalCompaniesFound,
      pagesScraped: this.state.currentPage,
      errors: this.state.errors.length
    };
    
    // Notify UI that scraping is complete
    this.notifyUI({ 
      action: 'scrapingComplete', 
      stats: stats
    });
    
    console.log('Scraper: Completion notification sent to UI');
    
    // Give UI time to process the message
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Stop scraping (user-initiated stop)
   * FIXED: Ensures immediate state reset and UI update
   */
  async stopScraping() {
    console.log('Scraper: User-initiated stop...');
    
    // Mark as stopped
    this.state.isRunning = false;
    this.state.isPaused = false;
    
    // Close active company tab if any
    if (this.activeTabId) {
      try {
        await chrome.tabs.remove(this.activeTabId);
      } catch (e) {
        // Tab might already be closed
      }
      this.activeTabId = null;
    }
    
    // Save state immediately
    await this.saveState();
    
    // Notify UI immediately
    this.notifyUI({ 
      action: 'scrapingStopped', 
      stats: {
        totalProcessed: this.state.processedCompanies,
        totalFound: this.state.totalCompaniesFound,
        pagesScraped: this.state.currentPage,
        errors: this.state.errors.length
      }
    });
    
    console.log('Scraper: Stop complete, state reset');
  }

  /**
   * Pause scraping
   */
  async pauseScraping() {
    this.state.isPaused = true;
    await this.saveState();
    this.notifyUI({ action: 'scrapingPaused' });
  }

  /**
   * Resume scraping
   */
  async resumeScraping() {
    this.state.isPaused = false;
    await this.saveState();
    this.notifyUI({ action: 'scrapingResumed' });
    
    // Continue processing
    if (this.state.isRunning) {
      await this.processCompanyQueue();
    }
  }

  /**
   * Normalize URL for comparison (shared utility)
   * FIXED: Handles LinkedIn URL variations (http/https, www, paths, trailing slashes)
   */
  normalizeUrl(url) {
    if (!url || url === 'N/A' || typeof url !== 'string') return null;
    
    try {
      // Remove query params and fragments
      let normalized = url.split('?')[0].split('#')[0].trim();
      
      // Convert to lowercase
      normalized = normalized.toLowerCase();
      
      // Remove protocol (http:// or https://)
      normalized = normalized.replace(/^https?:\/\//, '');
      
      // Remove www. prefix
      normalized = normalized.replace(/^www\./, '');
      
      // Handle LinkedIn company URLs specifically
      if (normalized.includes('linkedin.com/company/')) {
        // Extract company slug from various LinkedIn URL formats:
        // - linkedin.com/company/example
        // - linkedin.com/company/example/
        // - linkedin.com/company/example/about/
        // - linkedin.com/company/example/jobs/
        const match = normalized.match(/linkedin\.com\/company\/([^\/]+)/);
        if (match && match[1]) {
          // Return normalized company URL (just the slug)
          return `linkedin.com/company/${match[1]}`;
        }
      }
      
      // For non-LinkedIn URLs, remove trailing slashes
      normalized = normalized.replace(/\/+$/, '');
      
      return normalized || null;
    } catch (error) {
      console.error('Error normalizing URL:', url, error);
      return null;
    }
  }
  
  /**
   * Extract company slug from LinkedIn URL
   * Returns: company slug or null
   */
  extractCompanySlug(url) {
    if (!url || typeof url !== 'string') return null;
    
    const normalized = this.normalizeUrl(url);
    if (!normalized) return null;
    
    const match = normalized.match(/linkedin\.com\/company\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Normalize name for comparison (shared utility)
   */
  normalizeName(name) {
    if (!name || name === 'N/A') return null;
    return name.toLowerCase().trim();
  }

  /**
   * Check if company already exists (duplicate check)
   * FIXED: Enhanced matching with URL normalization and name fallback
   */
  isDuplicateCompany(company, companies) {
    if (!company) return false;
    
    const companyUrl = this.normalizeUrl(company.url);
    const companyName = this.normalizeName(company.name);
    const companySlug = this.extractCompanySlug(company.url);
    
    // Strategy 1: Check by normalized URL (most reliable)
    if (companyUrl) {
      const duplicateByUrl = companies.find(c => {
        const existingUrl = this.normalizeUrl(c.url);
        if (!existingUrl) return false;
        
        // Direct URL match
        if (existingUrl === companyUrl) {
          return true;
        }
        
        // For LinkedIn URLs, also check by company slug
        if (companySlug && existingUrl.includes('linkedin.com/company/')) {
          const existingSlug = this.extractCompanySlug(c.url);
          if (existingSlug && existingSlug === companySlug) {
            return true;
          }
        }
        
        return false;
      });
      
      if (duplicateByUrl) {
        console.log(`Scraper: Duplicate found by URL: ${companyUrl} matches ${this.normalizeUrl(duplicateByUrl.url)}`);
        return true;
      }
    }
    
    // Strategy 2: Check by company slug (for LinkedIn URLs)
    if (companySlug) {
      const duplicateBySlug = companies.find(c => {
        const existingSlug = this.extractCompanySlug(c.url);
        return existingSlug && existingSlug === companySlug;
      });
      
      if (duplicateBySlug) {
        console.log(`Scraper: Duplicate found by slug: ${companySlug}`);
        return true;
      }
    }
    
    // Strategy 3: Check by name (as secondary check, even if URL exists)
    // This catches cases where URL format changed but company is the same
    if (companyName) {
      const duplicateByName = companies.find(c => {
        const existingName = this.normalizeName(c.name);
        if (!existingName || existingName === 'n/a') return false;
        
        // Exact name match
        if (existingName === companyName) {
          return true;
        }
        
        // Fuzzy match: check if names are very similar (handles minor variations)
        // Remove common suffixes/prefixes and compare
        const cleanExisting = existingName.replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '').trim();
        const cleanNew = companyName.replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '').trim();
        
        if (cleanExisting === cleanNew && cleanExisting.length > 3) {
          return true;
        }
        
        return false;
      });
      
      if (duplicateByName) {
        console.log(`Scraper: Duplicate found by name: "${companyName}" matches "${duplicateByName.name}"`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Save company data to storage (with duplicate check)
   */
  async saveCompanyData(company) {
    const companies = await this.getCompanies();
    
    // Check for duplicates before adding
    if (this.isDuplicateCompany(company, companies)) {
      console.log('Scraper: Duplicate company skipped:', company.name);
      return false; // Indicate duplicate was skipped
    }
    
    companies.push(company);
    await chrome.storage.local.set({ linkedin_scraper_data: companies });
    return true; // Indicate company was added
  }

  /**
   * Get all companies from storage
   */
  async getCompanies() {
    const result = await chrome.storage.local.get('linkedin_scraper_data');
    return result.linkedin_scraper_data || [];
  }

  /**
   * Save scraper state
   */
  async saveState() {
    await chrome.storage.local.set({ 
      scraper_state: {
        ...this.state,
        lastUpdated: new Date().toISOString()
      }
    });
  }

  /**
   * Load scraper state
   */
  async loadState() {
    const result = await chrome.storage.local.get('scraper_state');
    if (result.scraper_state) {
      this.state = { ...this.state, ...result.scraper_state };
    }
  }

  /**
   * Ensure content script is injected in tab with retry logic
   */
  async ensureContentScriptInjected(tabId, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Check if content script is already loaded by sending a ping
        const pingResponse = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve(false); // Content script not loaded
            } else {
              resolve(true); // Content script is loaded
            }
          });
        });

        if (pingResponse) {
          console.log(`Scraper: Content script already loaded (attempt ${attempt})`);
          return true; // Already loaded
        }

        // Content script not loaded, inject it
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || !tab.url.includes('linkedin.com')) {
          throw new Error('Tab is not a LinkedIn page');
        }

        // Check if tab is still loading
        if (tab.status === 'loading') {
          console.log('Scraper: Tab is still loading, waiting...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Re-check tab status
          const updatedTab = await chrome.tabs.get(tabId);
          if (updatedTab.status === 'loading') {
            if (attempt < retries) {
              console.log(`Scraper: Tab still loading, retrying injection (attempt ${attempt + 1})...`);
              continue;
            }
          }
        }

        console.log(`Scraper: Injecting content scripts (attempt ${attempt})...`);
        
        // Inject content scripts
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/extractors.js', 'content/content-script.js']
        });

        // Wait for content script to initialize
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify injection by pinging again
        const verifyResponse = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });

        if (verifyResponse) {
          console.log('Scraper: Content script injection verified');
          return true;
        } else {
          throw new Error('Content script injection verification failed');
        }
      } catch (error) {
        console.error(`Scraper: Error ensuring content script (attempt ${attempt}/${retries})`, error);
        
        if (attempt === retries) {
          console.error('Scraper: Failed to inject content script after all retries');
          return false;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    return false;
  }

  /**
   * Send message to tab with retry logic
   */
  async sendMessageToTab(tabId, message, retries = 2) {
    // Ensure content script is injected first
    const injected = await this.ensureContentScriptInjected(tabId);
    if (!injected) {
      return { 
        success: false, 
        error: 'Failed to inject content script. Make sure you are on a LinkedIn page.' 
      };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.error('Scraper: Error sending message', error);
          
          // Retry if we have retries left and error suggests content script issue
          if (retries > 0 && (
            error.includes('Could not establish connection') ||
            error.includes('Receiving end does not exist')
          )) {
            console.log(`Scraper: Retrying message send (${retries} retries left)...`);
            setTimeout(() => {
              this.sendMessageToTab(tabId, message, retries - 1).then(resolve);
            }, 1000);
            return;
          }
          
          resolve({ success: false, error: error });
        } else {
          resolve(response || { success: false, error: 'No response from content script' });
        }
      });
    });
  }

  /**
   * Wait for tab to finish loading
   */
  async waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkStatus = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Tab closed or not found'));
            return;
          }
          
          if (tab.status === 'complete') {
            // Wait longer for JavaScript to render (LinkedIn is heavy on JS)
            setTimeout(() => resolve(), 5000);
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
          } else {
            setTimeout(checkStatus, 500);
          }
        });
      };
      
      checkStatus();
    });
  }

  /**
   * Notify UI (side panel) of updates
   */
  notifyUI(message) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open
    });
  }
}

// Create coordinator instance
const coordinator = new ScraperCoordinator();

// Listen for messages from side panel and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Service Worker: Received message', request.action);
  
  switch(request.action) {
    case 'startScraping':
      handleStartScraping(request, sendResponse);
      return true;
      
    case 'stopScraping':
      handleStopScraping(sendResponse);
      return true;
      
    case 'pauseScraping':
      handlePauseScraping(sendResponse);
      return true;
      
    case 'resumeScraping':
      handleResumeScraping(sendResponse);
      return true;
      
    case 'getState':
      sendResponse({ success: true, state: coordinator.state });
      return false;
      
    case 'getCompanies':
      handleGetCompanies(sendResponse);
      return true;
      
      case 'clearData':
        handleClearData(sendResponse);
        return true;
      
      case 'updateCompanies':
        handleUpdateCompanies(request, sendResponse);
        return true;
      
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
  }
});

async function handleStartScraping(request, sendResponse) {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url.includes('linkedin.com/search/results/companies')) {
      sendResponse({ 
        success: false, 
        error: 'Please navigate to a LinkedIn company search results page first' 
      });
      return;
    }
    
    await coordinator.startScraping(tab.id, request.maxPages || 5);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopScraping(sendResponse) {
  try {
    await coordinator.stopScraping();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handlePauseScraping(sendResponse) {
  try {
    await coordinator.pauseScraping();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleResumeScraping(sendResponse) {
  try {
    await coordinator.resumeScraping();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetCompanies(sendResponse) {
  try {
    const companies = await coordinator.getCompanies();
    sendResponse({ success: true, companies });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleClearData(sendResponse) {
  try {
    await chrome.storage.local.remove(['linkedin_scraper_data', 'scraper_state']);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateCompanies(request, sendResponse) {
  try {
    await chrome.storage.local.set({ linkedin_scraper_data: request.companies || [] });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Load state on startup
coordinator.loadState();

console.log('Service Worker: LinkedIn Scraper initialized');

