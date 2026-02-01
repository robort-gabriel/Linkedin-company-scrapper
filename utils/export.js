// Export Utilities for LinkedIn Scraper Extension

class ExportManager {
  /**
   * Export data as JSON file
   * @param {Array} companies - Array of company objects
   * @param {Object} metadata - Optional metadata to include
   */
  static exportAsJSON(companies, metadata = {}) {
    try {
      // Prepare export data
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: companies.length,
          source: 'LinkedIn Company Scraper Extension',
          ...metadata
        },
        companies: companies
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
      
      return { success: true, filename };
    } catch (error) {
      console.error('Error exporting JSON:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export data as CSV file (alternative format)
   * @param {Array} companies - Array of company objects
   */
  static exportAsCSV(companies) {
    try {
      // Define CSV headers
      const headers = ['Name', 'Website', 'Industry', 'LinkedIn URL', 'Scraped Date'];
      
      // Create CSV rows
      const rows = companies.map(company => [
        this.escapeCSV(company.name || ''),
        this.escapeCSV(company.website || ''),
        this.escapeCSV(company.industry || ''),
        this.escapeCSV(company.url || ''),
        this.escapeCSV(company.timestamp || '')
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
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
      
      return { success: true, filename };
    } catch (error) {
      console.error('Error exporting CSV:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Escape CSV fields that contain commas, quotes, or newlines
   * @param {string} field - Field to escape
   * @returns {string} Escaped field
   */
  static escapeCSV(field) {
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
   * Copy data to clipboard
   * @param {Array} companies - Array of company objects
   */
  static async copyToClipboard(companies) {
    try {
      const jsonString = JSON.stringify(companies, null, 2);
      await navigator.clipboard.writeText(jsonString);
      return { success: true, count: companies.length };
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Prepare summary statistics
   * @param {Array} companies - Array of company objects
   */
  static getSummary(companies) {
    return {
      total: companies.length,
      withWebsite: companies.filter(c => c.website && c.website !== 'N/A').length,
      withIndustry: companies.filter(c => c.industry && c.industry !== 'N/A').length,
      unique: new Set(companies.map(c => c.url)).size
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
}

