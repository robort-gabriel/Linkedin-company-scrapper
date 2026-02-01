// Content Script for LinkedIn Scraper Extension
// Runs on all LinkedIn pages

(function() {
  'use strict';
  
  // Initialize extractor
  const extractor = new LinkedInExtractor();
  
  // State
  let isScrapingActive = false;
  
  console.log('LinkedIn Scraper: Content script loaded');

  /**
   * Handle messages from service worker
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('LinkedIn Scraper: Received message', request.action);
    
    switch(request.action) {
      case 'ping':
        // Quick response to verify content script is loaded
        sendResponse({ success: true, ready: true });
        return false;
        
      case 'detectPageType':
        handleDetectPageType(sendResponse);
        return true; // Keep channel open for async response
        
      case 'extractCompanyURLs':
        handleExtractCompanyURLs(sendResponse);
        return true;
        
      case 'extractCompanyData':
        handleExtractCompanyData(sendResponse);
        return true;
        
      case 'checkPagination':
        handleCheckPagination(sendResponse);
        return true;
        
      case 'clickNextPage':
        handleClickNextPage(sendResponse);
        return true;
        
      case 'getCurrentPageNumber':
        handleGetCurrentPageNumber(sendResponse);
        return true;
        
      case 'setScrapingActive':
        isScrapingActive = request.active;
        sendResponse({ success: true });
        return false;
        
      default:
        sendResponse({ error: 'Unknown action' });
        return false;
    }
  });

  /**
   * Detect current page type
   */
  async function handleDetectPageType(sendResponse) {
    try {
      const pageType = extractor.detectPageType();
      sendResponse({ 
        success: true, 
        pageType,
        url: window.location.href
      });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Extract company URLs from search results page
   */
  async function handleExtractCompanyURLs(sendResponse) {
    try {
      console.log('LinkedIn Scraper: Extracting company URLs...');
      console.log('LinkedIn Scraper: Current URL:', window.location.href);
      console.log('LinkedIn Scraper: Page type:', extractor.detectPageType());
      
      const companies = await extractor.extractCompanyURLsFromSearch();
      
      // Extract URLs for backward compatibility
      const urls = companies.map(c => c.url);
      
      console.log(`LinkedIn Scraper: Found ${companies.length} companies`);
      
      if (companies.length === 0) {
        console.warn('LinkedIn Scraper: WARNING - No companies found!');
        console.warn('LinkedIn Scraper: This usually means LinkedIn changed their HTML structure.');
        console.warn('LinkedIn Scraper: Check browser console for detailed debug info.');
        
        // Try to help debug - log what we can find
        const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]');
        console.log(`LinkedIn Scraper: Debug - Found ${allCompanyLinks.length} total links containing "/company/"`);
        if (allCompanyLinks.length > 0) {
          console.log('LinkedIn Scraper: Sample links found:');
          Array.from(allCompanyLinks).slice(0, 3).forEach((link, i) => {
            console.log(`  ${i + 1}. ${link.href}`);
          });
        }
      } else {
        console.log('LinkedIn Scraper: First 3 companies:', companies.slice(0, 3).map(c => ({ url: c.url, name: c.name })));
      }
      
      sendResponse({ 
        success: true, 
        urls: urls, // Backward compatibility
        companies: companies, // New: includes names
        count: companies.length
      });
    } catch (error) {
      console.error('LinkedIn Scraper: Error extracting URLs', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Extract company data from company page
   */
  async function handleExtractCompanyData(sendResponse) {
    try {
      console.log('LinkedIn Scraper: Extracting company data...');
      const data = await extractor.extractCompanyData();
      
      console.log('LinkedIn Scraper: Extracted data', data);
      sendResponse({ 
        success: true, 
        data 
      });
    } catch (error) {
      console.error('LinkedIn Scraper: Error extracting company data', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Check if there's a next page in pagination
   */
  async function handleCheckPagination(sendResponse) {
    try {
      const hasNext = extractor.hasNextPage();
      
      sendResponse({ 
        success: true, 
        hasNextPage: hasNext 
      });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Click next page button with improved navigation handling
   */
  async function handleClickNextPage(sendResponse) {
    try {
      console.log('LinkedIn Scraper: Clicking next page...');
      const initialUrl = window.location.href;
      
      // Wait for navigation to complete
      const navigationPromise = waitForNavigation(initialUrl, 15000);
      
      // Click the button
      const success = await extractor.clickNextPage();
      
      if (!success) {
        sendResponse({ 
          success: false, 
          error: 'Could not find or click next page button' 
        });
        return;
      }
      
      // Wait for URL to change (LinkedIn SPA navigation)
      try {
        await navigationPromise;
        console.log('LinkedIn Scraper: Navigation completed, new URL:', window.location.href);
      } catch (error) {
        console.warn('LinkedIn Scraper: Navigation timeout, but continuing...', error);
      }
      
      // Wait for content to load
      await waitForContentReady();
      
      sendResponse({ 
        success: true,
        newUrl: window.location.href
      });
    } catch (error) {
      console.error('LinkedIn Scraper: Error clicking next page', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Get current page number from LinkedIn search results page
   */
  async function handleGetCurrentPageNumber(sendResponse) {
    try {
      let pageNumber = 1;
      
      // Method 1: Try to extract from URL
      const url = window.location.href;
      const urlObj = new URL(url);
      const pageParam = urlObj.searchParams.get('page');
      if (pageParam) {
        const pageNum = parseInt(pageParam, 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          pageNumber = pageNum;
          sendResponse({ success: true, pageNumber: pageNumber });
          return;
        }
      }
      
      // Method 2: Try to detect from pagination buttons
      // LinkedIn shows active page button with aria-current="true" or similar
      const paginationButtons = document.querySelectorAll(
        '.artdeco-pagination__pages button, ' +
        'button[aria-label*="Page"], ' +
        '.artdeco-pagination__indicator--number, ' +
        'li.artdeco-pagination__indicator--number button'
      );
      
      for (const button of paginationButtons) {
        // Check if button is active/selected
        const isActive = button.getAttribute('aria-current') === 'true' ||
                        button.classList.contains('active') ||
                        button.classList.contains('artdeco-pagination__indicator--number--active') ||
                        button.getAttribute('aria-selected') === 'true';
        
        if (isActive) {
          const buttonText = button.textContent?.trim();
          const pageNum = parseInt(buttonText, 10);
          if (!isNaN(pageNum) && pageNum > 0) {
            pageNumber = pageNum;
            console.log(`LinkedIn Scraper: Detected page ${pageNumber} from pagination button`);
            sendResponse({ success: true, pageNumber: pageNumber });
            return;
          }
        }
      }
      
      // Method 3: Try to find page number in button text
      for (const button of paginationButtons) {
        const buttonText = button.textContent?.trim();
        const pageNum = parseInt(buttonText, 10);
        if (!isNaN(pageNum) && pageNum > 0 && pageNum <= 100) {
          // Check if this button looks like the current page
          const parent = button.closest('li');
          if (parent && (
            parent.classList.contains('active') ||
            parent.classList.contains('artdeco-pagination__indicator--number--active') ||
            button.classList.contains('active')
          )) {
            pageNumber = pageNum;
            console.log(`LinkedIn Scraper: Detected page ${pageNumber} from pagination button text`);
            sendResponse({ success: true, pageNumber: pageNumber });
            return;
          }
        }
      }
      
      // Default to page 1 if not found
      console.log('LinkedIn Scraper: Could not detect page number, defaulting to 1');
      sendResponse({ success: true, pageNumber: 1 });
    } catch (error) {
      console.error('LinkedIn Scraper: Error detecting page number', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        pageNumber: 1 // Default fallback
      });
    }
  }

  /**
   * Wait for navigation to complete (URL change)
   */
  function waitForNavigation(initialUrl, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkNavigation = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== initialUrl) {
          // URL changed, wait a bit more for content to load
          setTimeout(() => resolve(), 1000);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('Navigation timeout'));
          return;
        }
        
        setTimeout(checkNavigation, 200);
      };
      
      checkNavigation();
    });
  }

  /**
   * Wait for page content to be ready after navigation
   */
  async function waitForContentReady() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = 10000;
      
      const checkReady = () => {
        // Check if search results are visible
        const hasResults = document.querySelector(
          'li.reusable-search__result-container, ' +
          'li.entity-result, ' +
          'div.entity-result, ' +
          '[data-chameleon-result-urn]'
        );
        
        // Check if skeleton loader is gone
        const skeletonLoader = document.querySelector(
          '.app-boot-bg-skeleton, .skeleton-loader, .initial-load-animation'
        );
        
        if (hasResults && !skeletonLoader) {
          console.log('LinkedIn Scraper: Content is ready');
          resolve();
        } else if (Date.now() - startTime > timeout) {
          console.warn('LinkedIn Scraper: Content ready timeout, continuing anyway...');
          resolve();
        } else {
          setTimeout(checkReady, 300);
        }
      };
      
      checkReady();
    });
  }

  /**
   * Notify service worker when page is ready
   */
  function notifyPageReady() {
    chrome.runtime.sendMessage({
      action: 'pageReady',
      url: window.location.href,
      pageType: extractor.detectPageType()
    }).catch(() => {
      // Service worker might not be ready, that's okay
    });
  }

  /**
   * Initialize URL change detection for LinkedIn SPA
   * FIXED: Properly manages intervals and event listeners to prevent memory leaks
   */
  function initializeNavigationDetection() {
    let lastUrl = window.location.href;
    let urlCheckInterval = null;
    let mutationObserver = null;
    let bodyObserver = null;
    
    // Cleanup function to remove all listeners
    const cleanup = () => {
      if (urlCheckInterval) {
        clearInterval(urlCheckInterval);
        urlCheckInterval = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      // Restore original history methods
      if (window._originalPushState) {
        history.pushState = window._originalPushState;
        delete window._originalPushState;
      }
      if (window._originalReplaceState) {
        history.replaceState = window._originalReplaceState;
        delete window._originalReplaceState;
      }
    };
    
    // Store cleanup function for later use
    window._linkedinScraperCleanup = cleanup;
    
    // Method 1: Listen to popstate (back/forward navigation)
    const popstateHandler = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('LinkedIn Scraper: URL changed (popstate):', currentUrl);
        setTimeout(notifyPageReady, 500);
      }
    };
    window.addEventListener('popstate', popstateHandler);
    
    // Method 2: Override pushState and replaceState to catch SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    // Store originals for cleanup
    window._originalPushState = originalPushState;
    window._originalReplaceState = originalReplaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('LinkedIn Scraper: URL changed (pushState):', currentUrl);
        setTimeout(notifyPageReady, 500);
      }
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('LinkedIn Scraper: URL changed (replaceState):', currentUrl);
        setTimeout(notifyPageReady, 500);
      }
    };
    
    // Method 3: MutationObserver as fallback (for DOM changes)
    mutationObserver = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('LinkedIn Scraper: URL changed (DOM mutation):', currentUrl);
        setTimeout(notifyPageReady, 500);
      }
    });
    
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      // Wait for body to be available
      bodyObserver = new MutationObserver(() => {
        if (document.body) {
          mutationObserver.observe(document.body, { childList: true, subtree: true });
          bodyObserver.disconnect();
          bodyObserver = null;
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }
    
    // Method 4: Periodic check as ultimate fallback (with cleanup)
    urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('LinkedIn Scraper: URL changed (periodic check):', currentUrl);
        notifyPageReady();
      }
    }, 2000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Cleanup if content script is reloaded
    if (window._linkedinScraperInitialized) {
      // Previous instance exists, clean it up first
      if (typeof window._linkedinScraperCleanup === 'function') {
        window._linkedinScraperCleanup();
      }
    }
    window._linkedinScraperInitialized = true;
  }

  // Initialize navigation detection
  initializeNavigationDetection();

  // Notify when page is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyPageReady);
  } else {
    notifyPageReady();
  }

})();

