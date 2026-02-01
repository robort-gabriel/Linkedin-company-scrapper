// Chrome Storage Utilities for LinkedIn Scraper Extension

class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'linkedin_scraper_data';
    this.STATE_KEY = 'scraper_state';
  }

  /**
   * Save scraped company data
   * @param {Array} companies - Array of company objects
   */
  async saveCompanies(companies) {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: companies
      });
      return { success: true };
    } catch (error) {
      console.error('Error saving companies:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all scraped companies
   * @returns {Promise<Array>} Array of company objects
   */
  async getCompanies() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Error getting companies:', error);
      return [];
    }
  }

  /**
   * Add a single company to storage
   * @param {Object} company - Company object {name, website, industry, timestamp, url}
   */
  async addCompany(company) {
    try {
      const companies = await this.getCompanies();
      
      // Check if company already exists (by URL or name)
      const exists = companies.some(c => 
        c.url === company.url || c.name === company.name
      );
      
      if (!exists) {
        companies.push({
          ...company,
          timestamp: new Date().toISOString()
        });
        await this.saveCompanies(companies);
      }
      
      return { success: true, total: companies.length };
    } catch (error) {
      console.error('Error adding company:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all scraped data
   */
  async clearCompanies() {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error clearing companies:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save scraper state (for resume capability)
   * @param {Object} state - State object
   */
  async saveState(state) {
    try {
      await chrome.storage.local.set({
        [this.STATE_KEY]: {
          ...state,
          lastUpdated: new Date().toISOString()
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Error saving state:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get scraper state
   * @returns {Promise<Object>} State object
   */
  async getState() {
    try {
      const result = await chrome.storage.local.get(this.STATE_KEY);
      return result[this.STATE_KEY] || {
        isRunning: false,
        isPaused: false,
        currentPage: 1,
        processedCompanies: 0,
        totalCompanies: 0,
        maxPages: 5
      };
    } catch (error) {
      console.error('Error getting state:', error);
      return null;
    }
  }

  /**
   * Clear scraper state
   */
  async clearState() {
    try {
      await chrome.storage.local.remove(this.STATE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error clearing state:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const companies = await this.getCompanies();
      const state = await this.getState();
      
      return {
        totalCompanies: companies.length,
        companiesWithWebsite: companies.filter(c => c.website).length,
        companiesWithIndustry: companies.filter(c => c.industry).length,
        lastUpdated: state?.lastUpdated || null,
        currentPage: state?.currentPage || 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}

