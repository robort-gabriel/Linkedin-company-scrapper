# LinkedIn Company Data Extractor Chrome Extension

**Repository:** [github.com/robort-gabriel/Linkedin-company-scrapper](https://github.com/robort-gabriel/Linkedin-company-scrapper)

A Chrome extension that helps users quickly capture company information (name, website, industry, phone, headquarters) from LinkedIn search results they are actively browsing. This productivity tool assists navigation across multiple search result pages.

## Features

- 📊 **Data Collection**: Captures company name, website URL, industry, phone number, and headquarters from LinkedIn company About pages
- 🔄 **Multi-page Navigation**: Processes multiple search result pages; starts from your current page and moves forward (e.g. on page 5 with “5 pages” = pages 5–9)
- ⏱️ **Respectful Timing**: Configurable delays (5–10 s with jitter) between company page visits
- 📈 **Real-time Progress**: Live status, page/company/overall progress bars, and statistics (Companies Found, Collected, With Website, Errors, Imported)
- 💾 **Data Persistence**: Saves collected data to Chrome local storage
- 📥 **Export**: Download data as JSON or CSV with timestamped filenames
- 📤 **Import**: Import JSON or CSV; merges with existing data and skips duplicates (imported companies are skipped during scraping)
- 🎨 **Modern UI**: Side panel with glassmorphism, collapsible “How to Use” instructions, and completion modal with stats
- ⚙️ **Configurable**: Maximum pages to process (1–20); default 5
- 🗑️ **Data Management**: Delete single entries or clear all data
- 🔍 **Duplicate Prevention**: Skips duplicates by URL, company slug, and name (during scrape and on import)
- 🌓 **Theme Toggle**: Dark and light mode; preference saved and respects system preference

## ⚠️ Important Notice

This extension helps users capture information from LinkedIn pages they are actively viewing. It operates on user-visible content and respects LinkedIn's terms of service. Users are responsible for using this tool in accordance with LinkedIn's usage policies and applicable laws.

**Please Note:**
- This extension only works with content that is already visible to the user
- Users must be logged into LinkedIn to access company pages
- The extension does not bypass any LinkedIn security measures
- Users should respect LinkedIn's rate limits and usage policies

## Installation

### Load Unpacked Extension (Development Mode)

1. **Download or Clone** this repository to your local machine:
   ```bash
   git clone https://github.com/robort-gabriel/Linkedin-company-scrapper.git
   cd Linkedin-company-scrapper
   ```

2. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/` in your Chrome browser
   - Or click the three dots menu → More Tools → Extensions

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**:
   - Click "Load unpacked"
   - Select the extension folder
   - The extension should now appear in your extensions list

5. **Verify Installation**:
   - Look for the extension icon in your Chrome toolbar
   - If not visible, click the puzzle icon and pin the extension

## Usage

### Step-by-Step Guide

1. **Navigate to LinkedIn**:
   - Go to [LinkedIn.com](https://www.linkedin.com)
   - Make sure you are logged in

2. **Search for Companies**:
   - Use LinkedIn's search bar to find companies
   - Example searches:
     - "digital marketing agencies"
     - "software companies in San Francisco"
     - "consulting firms"
   - Make sure you're on the company search results page (URL should contain `/search/results/companies/`)

3. **Open the Extension**:
   - Click the extension icon in your Chrome toolbar
   - The side panel will open on the right side of your browser

4. **Configure Settings**:
   - Set the "Maximum Pages to Process" (default: 5)
   - Collection starts from the page you’re currently on and processes that many pages forward (e.g. on page 3 with “5 pages” = pages 3–7)
   - Optional: Import previous JSON/CSV first; those companies will be skipped when scraping

5. **Start Collection**:
   - Click the "Start" button
   - The extension will:
     - Extract company URLs from the current search results page
     - Open each company’s **About** page in a background tab
     - Extract company data (name, website, industry, phone, headquarters)
     - Skip companies already in your list (including imported data)
     - Close the tab and move to the next company
     - Click “Next” to go to the following search result page, then repeat until the requested number of pages is done

6. **Monitor Progress**:
   - Current activity text and three progress indicators: Page Navigation, Company Processing, Overall Progress
   - Statistics: Companies Found, Companies Collected, With Website, Errors, Imported
   - Collected data appears in the live table; a completion modal shows a summary when finished

7. **Control Options**:
   - **Pause / Resume**: Temporarily pause collection, then resume
   - **Stop**: Stop collection (confirmation required)
   - **Import JSON / CSV**: Merge from file; duplicates are skipped
   - **Export JSON / CSV**: Download collected data (enabled when there is data)
   - **Delete**: Remove a single company via the row button
   - **Clear**: Remove all collected data (confirmation required)

8. **Export Data**:
   - Click "Export JSON" or "Export CSV" when collection is complete
   - Files will download with timestamp format: `linkedin-companies-YYYY-MM-DD-HHMMSS.json` or `.csv`

## Data Format

### Exported JSON Structure

```json
{
  "metadata": {
    "exportDate": "2025-12-21T10:30:00.000Z",
    "totalRecords": 50,
    "source": "LinkedIn Company Data Extractor",
    "pagesScraped": 5
  },
  "companies": [
    {
      "name": "Example Company Inc.",
      "website": "https://example.com",
      "industry": "Technology, Information and Internet",
      "phone": "+1 (555) 123-4567",
      "headquarters": "San Francisco, CA",
      "url": "https://www.linkedin.com/company/example-company",
      "timestamp": "2025-12-21T10:25:30.000Z"
    }
  ]
}
```

### Data Fields

- **name**: Company name (string)
- **website**: Company website URL (string, or "N/A" if not found)
- **industry**: Industry/sector (string, or "N/A" if not found)
- **phone**: Phone number (string, or "N/A" if not found)
- **headquarters**: Headquarters location (string, or "N/A" if not found)
- **url**: LinkedIn company page URL (string)
- **timestamp**: Date/time when data was collected (ISO 8601 format)

### CSV Export

The CSV export includes all fields in a comma-separated format, suitable for import into Excel, Google Sheets, or other spreadsheet applications.

### Import

You can re-import previously exported JSON or CSV. Supported formats: an array of company objects, or an object with a `companies` array (same structure as export). Imported data is merged with existing data; duplicates (by URL, slug, or name) are skipped. Imported companies are not re-scraped when you run collection.

## Technical Details

### Architecture

- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background coordination and state management
- **Content Scripts**: Injected into LinkedIn pages for data extraction
- **Side Panel**: Modern Chrome side panel UI for controls and monitoring
- **Chrome Storage**: Persistent data storage using `chrome.storage.local`

### Rate Limiting

To respect LinkedIn's servers and provide a smooth user experience:

- **5-10 second delay** between each company page visit
- **Random jitter** added to delays for natural behavior
- **Sequential processing** (one company at a time)
- **Background tabs** used to minimize user disruption

### Selectors

LinkedIn may update their HTML structure from time to time. If the extension stops working, the selectors in `content/extractors.js` may need to be updated to match LinkedIn's current structure.

## Troubleshooting

### Extension Not Working

1. **Check if you're on the correct page**:
   - URL must contain `/search/results/companies/`
   - Make sure you're logged into LinkedIn

2. **Refresh the page**:
   - Close and reopen the side panel
   - Reload the LinkedIn search results page

3. **Check browser console**:
   - Open DevTools (F12)
   - Look for error messages
   - Check the "Console" tab

### No Data Being Collected

1. **LinkedIn structure changed**:
   - Selectors may need updating
   - Check `content/extractors.js`

2. **Login required**:
   - Make sure you're logged into LinkedIn
   - Some company pages require authentication

3. **Page not fully loaded**:
   - Wait a few seconds after page loads
   - Try refreshing the page

## Development

### Project Structure

```
Linkedin-company-scrapper/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # Background orchestration
├── content/
│   ├── content-script.js     # Page interaction logic
│   └── extractors.js         # Data extraction utilities
├── sidepanel/
│   ├── sidepanel.html        # UI structure
│   ├── sidepanel.css         # Styling
│   └── sidepanel.js          # UI logic and updates
├── utils/
│   ├── storage.js            # Chrome storage utilities
│   ├── rate-limiter.js       # Rate limiting logic
│   └── export.js             # Export functionality
├── icons/                    # Extension icons
└── README.md                 # This file
```

### Debugging

1. **Service Worker Logs**:
   - Go to `chrome://extensions/`
   - Click "Service worker" under the extension
   - View console logs

2. **Content Script Logs**:
   - Open DevTools on LinkedIn page
   - Check Console tab for messages

3. **Side Panel Logs**:
   - Right-click the side panel
   - Select "Inspect"
   - Check Console tab

## Privacy & Security

- **No Data Transmission**: All data is stored locally in Chrome storage
- **No External Servers**: The extension does not send data to any external servers
- **User Control**: Users can delete data at any time
- **LinkedIn Only**: Extension only works on LinkedIn.com
- **Respects Terms**: Operates on user-visible content only

## License

This project is provided as-is for educational and productivity purposes.

---

**Chrome Extension Manifest**: V3  
**Tested On**: Chrome 120+
# Linkedin-company-scrapper
