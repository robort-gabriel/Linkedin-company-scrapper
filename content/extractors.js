// Data Extraction Utilities for LinkedIn Pages

class LinkedInExtractor {
  constructor() {
    // Selectors may need to be updated as LinkedIn changes their UI
    this.selectors = {
      // Search results page selectors
      searchResults: {
        companyCards: 'li.reusable-search__result-container',
        companyLink: 'a.app-aware-link[href*="/company/"]',
        paginationNext: 'button[aria-label="Next"]',
        paginationButtons: '.artdeco-pagination__pages button'
      },
      
      // Company page selectors
      companyPage: {
        name: 'h1.org-top-card-summary__title',
        nameAlt: '.org-top-card-summary__title',
        website: 'a.link-without-visited-state[href*="http"]',
        websiteContainer: '.org-top-card-summary__info-item',
        industry: '.org-top-card-summary__industry',
        industryAlt: '.org-page-details__definition-text',
        description: '.org-top-card-summary__tagline',
        location: '.org-top-card-summary__headquarter',
        employeeCount: '.org-top-card-summary__employee-count',
        // About tab selectors
        aboutTab: 'a[href*="/about/"]',
        aboutSection: '.org-about-us-organization-description__text',
        aboutDetails: '.org-page-details__definition-text',
        aboutInfoList: '.org-about-us-organization-description__text-container',
        infoListItem: '.org-page-details__definition-text'
      }
    };
  }

  /**
   * Detect page type
   * @returns {string} 'search', 'company', or 'unknown'
   */
  detectPageType() {
    const url = window.location.href;
    
    if (url.includes('/search/results/companies/')) {
      return 'search';
    } else if (url.includes('/company/')) {
      return 'company';
    }
    
    return 'unknown';
  }

  /**
   * Extract company URLs and names from search results page
   * FIXED: Now extracts both URL and name for better duplicate detection
   * @returns {Promise<Array>} Array of company objects {url: string, name: string}
   */
  async extractCompanyURLsFromSearch() {
    return new Promise((resolve) => {
      // Wait a bit for LinkedIn's dynamic content to load
      setTimeout(() => {
        const companies = []; // Array of {url, name} objects
        
        // Helper to extract company name from card
        const extractNameFromCard = (card) => {
          // Try multiple selectors for company name
          const nameSelectors = [
            'span.entity-result__title-text a',
            '.entity-result__title-text',
            'h3.entity-result__title-text',
            'a.entity-result__title-link',
            '.search-result__result-link',
            'a[href*="/company/"] span',
            'a[href*="/company/"]'
          ];
          
          for (const selector of nameSelectors) {
            const element = card.querySelector(selector);
            if (element) {
              const text = element.textContent?.trim();
              if (text && text.length > 0 && text.length < 200) {
                return text;
              }
            }
          }
          
          // Fallback: get text from the link itself
          const link = card.querySelector('a[href*="/company/"]');
          if (link) {
            const text = link.textContent?.trim() || link.innerText?.trim();
            if (text && text.length > 0 && text.length < 200) {
              return text;
            }
          }
          
          return '';
        };
        
        // Strategy 1: Try the primary selector approach
        const companyCards = document.querySelectorAll(this.selectors.searchResults.companyCards);
        if (companyCards.length > 0) {
          console.log(`LinkedIn Scraper: Found ${companyCards.length} cards with primary selector`);
          companyCards.forEach(card => {
            const link = card.querySelector(this.selectors.searchResults.companyLink);
            if (link && link.href) {
              const url = link.href.split('?')[0];
              if (url.includes('linkedin.com/company/')) {
                const name = extractNameFromCard(card);
                const existing = companies.find(c => c.url === url);
                if (!existing) {
                  companies.push({ url: url, name: name });
                }
              }
            }
          });
        }
        
        // Strategy 2: If no cards found, try alternative selectors
        if (companies.length === 0) {
          console.log('LinkedIn Scraper: Primary selector failed, trying alternatives...');
          
          // Try alternative container selectors
          const alternativeSelectors = [
            'li.entity-result',
            'div.entity-result',
            'li.search-result',
            'div.search-result',
            '[data-chameleon-result-urn]',
            'li[data-chameleon-result-urn]',
            'div[data-chameleon-result-urn]'
          ];
          
          for (const containerSelector of alternativeSelectors) {
            const cards = document.querySelectorAll(containerSelector);
            if (cards.length > 0) {
              console.log(`LinkedIn Scraper: Found ${cards.length} cards with ${containerSelector}`);
              cards.forEach(card => {
                // Try multiple link selectors within each card
                const linkSelectors = [
                  'a.app-aware-link[href*="/company/"]',
                  'a.entity-result__title-link[href*="/company/"]',
                  'a.search-result__result-link[href*="/company/"]',
                  'a[href*="/company/"][data-control-name]',
                  'a[href*="/company/"]'
                ];
                
                for (const linkSelector of linkSelectors) {
                  const link = card.querySelector(linkSelector);
                  if (link && link.href) {
                    const url = link.href.split('?')[0];
                    if (url.includes('linkedin.com/company/')) {
                      const name = extractNameFromCard(card);
                      const existing = companies.find(c => c.url === url);
                      if (!existing) {
                        companies.push({ url: url, name: name });
                        break; // Found link in this card, move to next
                      }
                    }
                  }
                }
              });
              
              if (companies.length > 0) break; // Found companies, stop trying other selectors
            }
          }
        }
        
        // Strategy 3: Last resort - find ALL links with /company/ and filter
        if (companies.length === 0) {
          console.log('LinkedIn Scraper: Container approach failed, trying direct link search...');
          const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]');
          console.log(`LinkedIn Scraper: Found ${allCompanyLinks.length} total links with /company/`);
          
          allCompanyLinks.forEach(link => {
            if (link.href) {
              const url = link.href.split('?')[0].split('#')[0];
              // Validate it's a proper LinkedIn company URL (not a sub-page like /jobs, /about, etc)
              if (url.includes('linkedin.com/company/')) {
                // Make sure it's a company page, not a jobs/about/etc page
                const urlParts = url.split('/company/');
                if (urlParts.length === 2 && urlParts[1]) {
                  const afterCompany = urlParts[1];
                  // Only include if it's just the company slug (no additional path)
                  if (!afterCompany.includes('/') && afterCompany.length > 0) {
                    const baseUrl = `https://www.linkedin.com/company/${afterCompany}`;
                    const name = link.textContent?.trim() || link.innerText?.trim() || '';
                    const existing = companies.find(c => c.url === baseUrl);
                    if (!existing) {
                      companies.push({ url: baseUrl, name: name });
                    }
                  }
                }
              }
            }
          });
        }
        
        // Remove duplicates by URL
        const uniqueCompanies = [];
        const seenUrls = new Set();
        companies.forEach(company => {
          if (!seenUrls.has(company.url)) {
            seenUrls.add(company.url);
            uniqueCompanies.push(company);
          }
        });
        
        console.log(`LinkedIn Scraper: Extracted ${uniqueCompanies.length} unique companies (with names)`);
        if (uniqueCompanies.length > 0) {
          console.log('LinkedIn Scraper: Sample companies:', uniqueCompanies.slice(0, 3).map(c => ({ url: c.url, name: c.name })));
        }
        
        resolve(uniqueCompanies);
      }, 3000); // Wait 3 seconds for LinkedIn's dynamic content to load
    });
  }

  /**
   * Extract company data from company page
   * @returns {Promise<Object>} Company data object
   */
  async extractCompanyData() {
    const currentUrl = window.location.href;
    
    console.log('LinkedIn Scraper: Starting data extraction from:', currentUrl);
    
    // Verify we're on the About page
    if (!currentUrl.includes('/about/')) {
      console.warn('LinkedIn Scraper: Warning - Not on About page. Some data may be missing.');
    } else {
      console.log('LinkedIn Scraper: Confirmed on About page');
    }
    
    // Wait for the page to finish loading (check for skeleton loader to disappear)
    console.log('LinkedIn Scraper: Waiting for skeleton loader to disappear...');
    await this.waitForPageReady();
    
    // Wait for company name to appear
    console.log('LinkedIn Scraper: Waiting for company name...');
    await this.waitForElement(this.selectors.companyPage.name, 15000);
    
    // Wait for About page content to load (if on About page)
    if (currentUrl.includes('/about/')) {
      console.log('LinkedIn Scraper: Waiting for About page content...');
      try {
        // Wait for either the about section or page details to appear
        await this.waitForElement('.org-page-details, .org-about-us-organization-description', 15000);
      } catch (e) {
        console.log('LinkedIn Scraper: About content may not have loaded, continuing anyway...');
      }
    }
    
    // Add additional delay to ensure all content is fully rendered
    console.log('LinkedIn Scraper: Waiting for content to fully render...');
    await this.delay(5000);
    
    console.log('LinkedIn Scraper: Starting data extraction...');
    
    // Extract all data
    const data = {
      name: this.extractCompanyName(),
      website: this.extractWebsite(),
      industry: this.extractIndustry(),
      phone: this.extractPhone(),
      headquarters: this.extractHeadquarters(),
      url: window.location.href.split('?')[0].split('/about/')[0],
      timestamp: new Date().toISOString()
    };
    
    console.log('LinkedIn Scraper: Extracted data:', data);
    
    return data;
  }

  /**
   * Extract company name
   * @returns {string} Company name or 'N/A'
   */
  extractCompanyName() {
    const selectors = [
      this.selectors.companyPage.name,
      this.selectors.companyPage.nameAlt,
      'h1'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    
    return 'N/A';
  }

  /**
   * Extract company website
   * @returns {string} Website URL or 'N/A'
   */
  extractWebsite() {
    console.log('LinkedIn Scraper: Extracting website...');
    
    // Strategy 1: Look in page details section using dt/dd structure (most reliable)
    const pageDetails = document.querySelector('.org-page-details');
    if (pageDetails) {
      console.log('LinkedIn Scraper: Searching page details section...');
      
      // Find all dt elements and check for "Website"
      const dtElements = pageDetails.querySelectorAll('dt');
      for (const dt of dtElements) {
        const dtText = dt.textContent.trim().toLowerCase();
        if (dtText === 'website' || dtText.includes('website')) {
          console.log('LinkedIn Scraper: Found Website dt element');
          
          // Get the next dd element
          let dd = dt.nextElementSibling;
          while (dd && dd.tagName !== 'DD') {
            dd = dd.nextElementSibling;
          }
          
          if (dd) {
            // Look for link in dd
            const link = dd.querySelector('a[href]');
            if (link && link.href) {
              const href = link.href;
              if (!href.includes('linkedin.com') && 
                  (href.startsWith('http://') || href.startsWith('https://'))) {
                console.log('LinkedIn Scraper: Found website in page details dt/dd:', href);
                return href;
              }
            }
            
            // If no link, check if dd text is a URL
            const ddText = dd.textContent.trim();
            if (ddText && (ddText.startsWith('http://') || ddText.startsWith('https://'))) {
              console.log('LinkedIn Scraper: Found website URL in dd text:', ddText);
              return ddText;
            }
          }
        }
      }
      
      // Also check all links in page details
      const allLinks = pageDetails.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const href = link.href;
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          // Check if it's in a context that suggests it's the website
          const parent = link.closest('dd');
          if (parent) {
            const prevDt = parent.previousElementSibling;
            if (prevDt && prevDt.tagName === 'DT') {
              const dtText = prevDt.textContent.trim().toLowerCase();
              if (dtText === 'website' || dtText.includes('website')) {
                if (!href.includes('linkedin.com') && 
                    !href.includes('facebook.com') && 
                    !href.includes('twitter.com') && 
                    !href.includes('instagram.com')) {
                  console.log('LinkedIn Scraper: Found website link in page details:', href);
                  return href;
                }
              }
            }
          }
        }
      }
    }
    
    // Strategy 2: Look in org-top-card-summary (main company card)
    const topCard = document.querySelector('.org-top-card-summary');
    if (topCard) {
      console.log('LinkedIn Scraper: Searching top card summary...');
      
      // Look for link-without-visited-state class (LinkedIn's website link class)
      const websiteLink = topCard.querySelector('a.link-without-visited-state[href*="http"]');
      if (websiteLink && websiteLink.href) {
        const href = websiteLink.href;
        if (!href.includes('linkedin.com') && 
            (href.startsWith('http://') || href.startsWith('https://'))) {
          console.log('LinkedIn Scraper: Found website in top card:', href);
          return href;
        }
      }
      
      // Look in info items
      const infoItems = topCard.querySelectorAll('.org-top-card-summary__info-item');
      for (const item of infoItems) {
        const link = item.querySelector('a[href*="http"]');
        if (link && link.href) {
          const href = link.href;
          if (!href.includes('linkedin.com') && 
              (href.startsWith('http://') || href.startsWith('https://'))) {
            console.log('LinkedIn Scraper: Found website in info item:', href);
            return href;
          }
        }
      }
    }
    
    // Strategy 3: Look in overview section
    const overviewSection = document.querySelector('.org-page-details__overview-section, .org-about-module');
    if (overviewSection) {
      console.log('LinkedIn Scraper: Searching overview section...');
      
      const dtElements = overviewSection.querySelectorAll('dt');
      for (const dt of dtElements) {
        if (dt.textContent.trim().toLowerCase().includes('website')) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const link = dd.querySelector('a[href]');
            if (link && link.href) {
              const href = link.href;
              if (!href.includes('linkedin.com') && 
                  (href.startsWith('http://') || href.startsWith('https://'))) {
                console.log('LinkedIn Scraper: Found website in overview section:', href);
                return href;
              }
            }
          }
        }
      }
    }
    
    // Strategy 4: Look for any external link in about/org sections
    const aboutSections = document.querySelectorAll('.org-about-module, .org-about-us-organization-description, .org-page-details');
    for (const section of aboutSections) {
      const links = section.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href;
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          if (!href.includes('linkedin.com') && 
              !href.includes('facebook.com') && 
              !href.includes('twitter.com') && 
              !href.includes('instagram.com') &&
              !href.includes('youtube.com')) {
            // Check if it's likely the main website (not a social link)
            const linkText = link.textContent.trim().toLowerCase();
            const parentText = (link.parentElement?.textContent || '').toLowerCase();
            if (parentText.includes('website') || 
                linkText.includes('www.') || 
                linkText.includes('.com') ||
                linkText.includes('.org') ||
                linkText.includes('.net')) {
              console.log('LinkedIn Scraper: Found potential website in about section:', href);
              return href;
            }
          }
        }
      }
    }
    
    // Strategy 5: Global search for external links (last resort)
    console.log('LinkedIn Scraper: Trying global search for website...');
    const allLinks = document.querySelectorAll('a[href]');
    const externalLinks = [];
    
    for (const link of allLinks) {
      const href = link.href;
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        if (!href.includes('linkedin.com') && 
            !href.includes('facebook.com') && 
            !href.includes('twitter.com') && 
            !href.includes('instagram.com') &&
            !href.includes('youtube.com')) {
          externalLinks.push({ href, link });
        }
      }
    }
    
    // If we found external links, try to find the most likely website
    if (externalLinks.length > 0) {
      // Prefer links that are in definition lists or have "website" context
      for (const { href, link } of externalLinks) {
        const context = (link.closest('dd')?.previousElementSibling?.textContent || '').toLowerCase();
        if (context.includes('website')) {
          console.log('LinkedIn Scraper: Found website in global search with context:', href);
          return href;
        }
      }
      
      // If no context match, return first external link (might be the website)
      console.log('LinkedIn Scraper: Found external link (may be website):', externalLinks[0].href);
      return externalLinks[0].href;
    }
    
    console.log('LinkedIn Scraper: No website found');
    return 'N/A';
  }

  /**
   * Extract company industry
   * @returns {string} Industry or 'N/A'
   */
  extractIndustry() {
    console.log('LinkedIn Scraper: Extracting industry...');
    
    // Strategy 1: Look in page details section (most reliable on About page)
    const pageDetails = document.querySelector('.org-page-details');
    if (pageDetails) {
      const dtElements = pageDetails.querySelectorAll('dt');
      for (const dt of dtElements) {
        if (dt.textContent.trim().toLowerCase().includes('industry')) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const industry = dd.textContent.trim();
            if (industry && industry !== 'Industry') {
              console.log('LinkedIn Scraper: Found industry in page details:', industry);
              return industry;
            }
          }
        }
      }
    }
    
    // Strategy 2: Try main page selectors
    const selectors = [
      this.selectors.companyPage.industry,
      this.selectors.companyPage.industryAlt,
      '.org-top-card-summary__industry'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        console.log('LinkedIn Scraper: Found industry with selector:', selector, element.textContent.trim());
        return element.textContent.trim();
      }
    }
    
    // Strategy 3: Look anywhere for industry label
    const allDts = document.querySelectorAll('dt');
    for (const dt of allDts) {
      if (dt.textContent.trim().toLowerCase() === 'industry') {
        const dd = dt.nextElementSibling;
        if (dd) {
          const industry = dd.textContent.trim();
          if (industry) {
            console.log('LinkedIn Scraper: Found industry from dt/dd:', industry);
            return industry;
          }
        }
      }
    }
    
    console.log('LinkedIn Scraper: No industry found');
    return 'N/A';
  }

  /**
   * Extract company phone number
   * @returns {string} Phone number or 'N/A'
   */
  extractPhone() {
    console.log('LinkedIn Scraper: Extracting phone...');
    
    // Search for phone pattern in text
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
    
    // Strategy 1: Look for tel: links
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    if (telLinks.length > 0) {
      const phone = telLinks[0].href.replace('tel:', '').trim();
      console.log('LinkedIn Scraper: Found phone from tel: link:', phone);
      return phone;
    }
    
    // Strategy 2: Look in page details section
    const pageDetails = document.querySelector('.org-page-details');
    if (pageDetails) {
      const dtElements = pageDetails.querySelectorAll('dt');
      for (const dt of dtElements) {
        if (dt.textContent.trim().toLowerCase().includes('phone')) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const phone = dd.textContent.trim();
            const match = phone.match(phonePattern);
            if (match) {
              console.log('LinkedIn Scraper: Found phone in page details:', match[0]);
              return match[0].trim();
            }
          }
        }
      }
    }
    
    // Strategy 3: Look anywhere for phone label
    const allDts = document.querySelectorAll('dt');
    for (const dt of allDts) {
      const text = dt.textContent.trim().toLowerCase();
      if (text.includes('phone') || text === 'phone') {
        const dd = dt.nextElementSibling;
        if (dd) {
          const phone = dd.textContent.trim();
          const match = phone.match(phonePattern);
          if (match) {
            console.log('LinkedIn Scraper: Found phone from dt/dd:', match[0]);
            return match[0].trim();
          }
        }
      }
    }
    
    // Strategy 4: Search entire page for phone pattern near "phone" text
    const allText = document.body.textContent;
    const phoneContext = /phone:?\s*(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i;
    const contextMatch = allText.match(phoneContext);
    if (contextMatch) {
      const match = contextMatch[0].match(phonePattern);
      if (match) {
        console.log('LinkedIn Scraper: Found phone from context search:', match[0]);
        return match[0].trim();
      }
    }
    
    console.log('LinkedIn Scraper: No phone found');
    return 'N/A';
  }

  /**
   * Extract company headquarters location
   * @returns {string} Headquarters location or 'N/A'
   */
  extractHeadquarters() {
    console.log('LinkedIn Scraper: Extracting headquarters...');
    
    // Strategy 1: Look in page details section
    const pageDetails = document.querySelector('.org-page-details');
    if (pageDetails) {
      const dtElements = pageDetails.querySelectorAll('dt');
      for (const dt of dtElements) {
        const text = dt.textContent.trim().toLowerCase();
        if (text.includes('headquarters') || text.includes('headquarter')) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === 'DD') {
            const location = dd.textContent.trim();
            if (location && !location.toLowerCase().includes('headquarters')) {
              console.log('LinkedIn Scraper: Found headquarters in page details:', location);
              return location;
            }
          }
        }
      }
    }
    
    // Strategy 2: Try main page selectors
    const mainSelectors = [
      '.org-top-card-summary__headquarter',
      '[data-test-id="about-us-headquarters"]'
    ];
    
    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && !text.toLowerCase().includes('headquarters')) {
          console.log('LinkedIn Scraper: Found headquarters with selector:', selector, text);
          return text;
        }
      }
    }
    
    // Strategy 3: Look anywhere for headquarters label
    const allDts = document.querySelectorAll('dt');
    for (const dt of allDts) {
      const text = dt.textContent.trim().toLowerCase();
      if (text.includes('headquarters') || text.includes('headquarter')) {
        const dd = dt.nextElementSibling;
        if (dd) {
          const location = dd.textContent.trim();
          if (location && !location.toLowerCase().includes('headquarters')) {
            console.log('LinkedIn Scraper: Found headquarters from dt/dd:', location);
            return location;
          }
        }
      }
    }
    
    console.log('LinkedIn Scraper: No headquarters found');
    return 'N/A';
  }

  /**
   * Check if there's a next page in search results
   * @returns {boolean} True if next page exists
   */
  hasNextPage() {
    // Try multiple selectors for next button
    const selectors = [
      this.selectors.searchResults.paginationNext,
      'button[aria-label="Next"]',
      'button[aria-label*="Next"]',
      '.artdeco-pagination__button--next',
      'button.artdeco-pagination__button[aria-label*="Next"]'
    ];
    
    for (const selector of selectors) {
      const nextButton = document.querySelector(selector);
      if (nextButton && 
          !nextButton.disabled && 
          !nextButton.classList.contains('artdeco-button--disabled') &&
          !nextButton.hasAttribute('disabled')) {
        console.log('LinkedIn Scraper: Found next page button with selector:', selector);
        return true;
      }
    }
    
    console.log('LinkedIn Scraper: No next page button found');
    return false;
  }

  /**
   * Click next page button with improved reliability
   * @returns {Promise<boolean>} True if successful
   */
  async clickNextPage() {
    const initialUrl = window.location.href;
    
    // Try multiple selectors for next button
    const selectors = [
      this.selectors.searchResults.paginationNext,
      'button[aria-label="Next"]',
      'button[aria-label*="Next"]',
      '.artdeco-pagination__button--next',
      'button.artdeco-pagination__button[aria-label*="Next"]',
      'button[data-test-pagination-page-btn="next"]',
      'button.artdeco-pagination__indicator--active + button',
      '.artdeco-pagination__pages button:last-child'
    ];
    
    let nextButton = null;
    let usedSelector = null;
    
    // Find the button
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && 
          !button.disabled && 
          !button.classList.contains('artdeco-button--disabled') &&
          !button.hasAttribute('disabled') &&
          !button.classList.contains('artdeco-pagination__button--disabled')) {
        nextButton = button;
        usedSelector = selector;
        break;
      }
    }
    
    if (!nextButton) {
      console.error('LinkedIn Scraper: Could not find clickable next page button');
      // Debug: log what pagination buttons exist
      const allButtons = document.querySelectorAll('.artdeco-pagination button, button[aria-label*="Next"], button[aria-label*="next"]');
      console.log(`LinkedIn Scraper: Found ${allButtons.length} pagination buttons`);
      allButtons.forEach((btn, i) => {
        console.log(`  Button ${i + 1}:`, {
          ariaLabel: btn.getAttribute('aria-label'),
          disabled: btn.disabled || btn.hasAttribute('disabled'),
          classes: btn.className,
          text: btn.textContent.trim()
        });
      });
      return false;
    }
    
    console.log('LinkedIn Scraper: Clicking next page button with selector:', usedSelector);
    
    try {
      // Scroll button into view
      nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(800);
      
      // Verify button is still visible and clickable
      const rect = nextButton.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.left >= 0 && 
                       rect.bottom <= window.innerHeight && 
                       rect.right <= window.innerWidth;
      
      if (!isVisible) {
        console.warn('LinkedIn Scraper: Button not fully visible, scrolling again...');
        nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(500);
      }
      
      // Try multiple click methods for reliability
      let clicked = false;
      
      // Method 1: Direct click
      try {
        nextButton.click();
        clicked = true;
      } catch (e) {
        console.warn('LinkedIn Scraper: Direct click failed, trying alternative methods...', e);
      }
      
      // Method 2: Mouse events if direct click didn't work
      if (!clicked) {
        try {
          const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
          const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
          const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
          
          nextButton.dispatchEvent(mouseDownEvent);
          await this.delay(50);
          nextButton.dispatchEvent(mouseUpEvent);
          await this.delay(50);
          nextButton.dispatchEvent(clickEvent);
          clicked = true;
        } catch (e) {
          console.warn('LinkedIn Scraper: Mouse event click failed', e);
        }
      }
      
      if (!clicked) {
        throw new Error('Failed to trigger click on next button');
      }
      
      console.log('LinkedIn Scraper: Next page button clicked successfully');
      return true;
      
    } catch (error) {
      console.error('LinkedIn Scraper: Error clicking next page button', error);
      return false;
    }
  }

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element>}
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Check if element already exists
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      // Set up mutation observer
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Set timeout
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Simple delay utility
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for page to be fully ready (skeleton loader gone, content rendered)
   * @param {number} timeout - Maximum time to wait in milliseconds
   * @returns {Promise<void>}
   */
  async waitForPageReady(timeout = 20000) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkReady = () => {
        // Check if skeleton loader is gone
        const skeletonLoader = document.querySelector('.app-boot-bg-skeleton, .skeleton-loader, .initial-load-animation');
        const hasContent = document.querySelector('.org-top-card-summary, .org-about-us-organization-description, .org-page-details');
        
        if (!skeletonLoader && hasContent) {
          console.log('LinkedIn Scraper: Page is ready (skeleton gone, content present)');
          resolve();
        } else if (Date.now() - startTime > timeout) {
          console.log('LinkedIn Scraper: Page ready timeout reached, continuing anyway...');
          resolve();
        } else {
          setTimeout(checkReady, 500);
        }
      };
      
      checkReady();
    });
  }
}

// Make available globally for content script
if (typeof window !== 'undefined') {
  window.LinkedInExtractor = LinkedInExtractor;
}

