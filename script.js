// Global variables
let oldUrls = []; // Array of { fullUrl, slug, slugTokens }
let newUrls = []; // Array of { fullUrl, slug, slugTokens }
let existingRedirects = []; // Store existing redirects
let selectedRows = []; // Track selected rows
let excludedFromExistingCount = 0; // Track URLs excluded due to existing redirects
let lastSelectedRow = null; // Track the last selected row for shift-click
let fuseNewUrls = null; // Fuse.js instance for new URLs

// AI Matching variables
let aiMatchedResults = new Map(); // Store AI matched results to prevent re-matching
let isAiMatching = false; // Flag to prevent multiple AI matching operations
let aiApiKey = ''; // Will be set from environment or user input

// Step Navigation variables
let currentStep = 1;
const totalSteps = 4;

// DOM Elements
const oldCsvInput = document.getElementById('oldCsvInput');
const newCsvInput = document.getElementById('newCsvInput');
const existingRedirectsInput = document.getElementById('existingRedirectsInput');
const manualUrlInput = document.getElementById('manualUrlInput');
const addManualUrlButton = document.getElementById('addManualUrl');
const oldUrlStatus = document.getElementById('oldUrlStatus');
const newUrlStatus = document.getElementById('newUrlStatus');
const manualUrlStatus = document.getElementById('manualUrlStatus');
const redirectSection = document.getElementById('redirectSection');
const redirectTableBody = document.getElementById('redirectTableBody');
const exportCsvButton = document.getElementById('exportCsv');
const redirectCount = document.getElementById('redirectCount');
const newUrlsContainer = document.getElementById('newUrlsContainer');
const newUrlsList = document.getElementById('newUrlsList');
const existingRedirectsContainer = document.getElementById('existingRedirectsContainer');
const existingRedirectsList = document.getElementById('existingRedirectsList');
const existingRedirectStatus = document.getElementById('existingRedirectStatus');

// New DOM elements for old URL manual entry
const manualOldUrlInput = document.getElementById('manualOldUrlInput');
const addManualOldUrlButton = document.getElementById('addManualOldUrl');
const manualOldUrlStatus = document.getElementById('manualOldUrlStatus');
const oldUrlsContainer = document.getElementById('oldUrlsContainer');
const oldUrlsList = document.getElementById('oldUrlsList');

// Bulk action buttons
const checkAllBtn = document.getElementById('checkAllBtn');
const uncheckAllBtn = document.getElementById('uncheckAllBtn');
const checkUnmappedBtn = document.getElementById('checkUnmappedBtn');
const checkMappedBtn = document.getElementById('checkMappedBtn');

// Paste functionality DOM Elements
const existingRedirectsPaste = document.getElementById('existingRedirectsPaste');
const loadPastedExistingRedirectsBtn = document.getElementById('loadPastedExistingRedirects');
const pastedExistingRedirectsStatus = document.getElementById('pastedExistingRedirectsStatus');

// Filter buttons
const filterAllBtn = document.getElementById('filterAllBtn');
const filterMappedBtn = document.getElementById('filterMappedBtn');
const filterUnmappedBtn = document.getElementById('filterUnmappedBtn');
const filterNeedsAttentionBtn = document.getElementById('filterNeedsAttentionBtn');
const filterSkippedBtn = document.getElementById('filterSkippedBtn');
const filterConflictsBtn = document.getElementById('filterConflictsBtn');

// Export options - now using radio buttons
const exportTypeRadios = document.querySelectorAll('input[name="exportType"]');

// Clear buttons
const clearExistingRedirectsBtn = document.getElementById('clearExistingRedirects');
const clearOldUrlsBtn = document.getElementById('clearOldUrls');
const clearNewUrlsBtn = document.getElementById('clearNewUrls');

// Remove buttons for files
const removeExistingRedirectsFileBtn = document.getElementById('removeExistingRedirectsFile');
const removeOldUrlsFileBtn = document.getElementById('removeOldUrlsFile');
const removeNewUrlsFileBtn = document.getElementById('removeNewUrlsFile');

// Modal elements
const instructionsBtn = document.getElementById('instructionsBtn');
const instructionsModal = document.getElementById('instructionsModal');
const closeInstructionsModalBtn = document.getElementById('closeInstructionsModal');

// API Key Modal elements
const apiKeyBtn = document.getElementById('apiKeyBtn');
const apiKeyModal = document.getElementById('apiKeyModal');
const closeApiKeyModalBtn = document.getElementById('closeApiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibility');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const clearApiKeyBtn = document.getElementById('clearApiKey');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// CSV Format Modal elements
const csvFormatModal = document.getElementById('csvFormatModal');

// AI Matching DOM elements
const aiMatchBtn = document.getElementById('aiMatchBtn');
const aiMatchingSection = document.getElementById('aiMatchingSection');
const aiMatchStatus = document.getElementById('aiMatchStatus');
const aiMatchProgress = document.getElementById('aiMatchProgress');
const aiMatchResults = document.getElementById('aiMatchResults');

// Search elements
const searchFilter = document.getElementById('searchFilter');
const clearSearchBtn = document.getElementById('clearSearch');

// Floating selection bar elements
const floatingSelectionBar = document.getElementById('floatingSelectionBar');
const floatingSelectionCount = document.getElementById('floatingSelectionCount');
const floatingSetRedirect = document.getElementById('floatingSetRedirect');
const floatingSetSkip = document.getElementById('floatingSetSkip');
const floatingExportSelected = document.getElementById('floatingExportSelected');
const floatingClearSelection = document.getElementById('floatingClearSelection');


// Minimum confidence score to auto-fill a match (0.0 to 1.0, higher is better)
const MIN_AUTO_MATCH_SCORE = 0.5; // User updated this from 0.7. This is our internal score (1 = best)
const MIN_AUTO_MATCH_SCORE_FUZZY = 0.70; // Stricter threshold for auto-filling PURELY fuzzy matches
// Fuse.js threshold (0.0 to 1.0, lower is stricter for Fuse.js native score)
const FUSE_THRESHOLD = 0.3; // Reverted from 0.6 back to 0.3 for stricter token similarity in fuzzy matching

// Helper function to update file input appearance without localStorage
function updateFileInputAppearance(inputId, removeBtnId, fileName, action) {
    const inputElement = document.getElementById(inputId);
    const fileInputContainer = inputElement.closest('.file-input-container');
    const fileInputText = fileInputContainer.querySelector('.file-input-text');
    const removeBtn = document.getElementById(removeBtnId);

    if (!inputElement || !fileInputText || !removeBtn) {
        console.error('Missing elements for updateFileInputAppearance', inputId);
        return;
    }

    switch (action) {
        case 'fileSelected':
            fileInputText.textContent = fileName;
            fileInputText.classList.add('has-file');
            removeBtn.classList.remove('hidden');
            break;
        case 'fileRemoved':
        case 'initialClear': // For initial page load
            fileInputText.textContent = 'No file chosen';
            fileInputText.classList.remove('has-file');
            removeBtn.classList.add('hidden');
            inputElement.value = ''; // Clear the file input
            break;
        case 'selectionCancelled': // When user opens file dialog but cancels
            // For now, just revert to no file state since we don't have persistence
            fileInputText.textContent = 'No file chosen';
            fileInputText.classList.remove('has-file');
            removeBtn.classList.add('hidden');
            inputElement.value = ''; // Important: clear the input so change event fires again if same file is chosen
            break;
    }
}

// Toast Notification System - Sonner/shadcn inspired
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.toasts = new Map();
        this.toastId = 0;
    }

    show(title, description = '', type = 'info', options = {}) {
        const {
            duration = type === 'error' ? 8000 : 5000,
            dismissible = true,
            showProgress = false
        } = options;

        const id = ++this.toastId;
        const toast = this.createToast(id, title, description, type, dismissible, showProgress);
        
        this.container.appendChild(toast);
        this.toasts.set(id, { element: toast, timeoutId: null });

        // Auto dismiss
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                this.dismiss(id);
            }, duration);
            this.toasts.get(id).timeoutId = timeoutId;
        }

        return id;
    }

    createToast(id, title, description, type, dismissible, showProgress) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.dataset.toastId = id;

        const iconContent = this.getIconContent(type);
        
        toast.innerHTML = `
            <div class="toast-icon">${iconContent}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${description ? `<div class="toast-description">${description}</div>` : ''}
            </div>
            ${dismissible ? '<button class="toast-close" onclick="toastManager.dismiss(' + id + ')">×</button>' : ''}
            ${showProgress ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
        `;

        return toast;
    }

    getIconContent(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'i'
        };
        return icons[type] || icons.info;
    }

    dismiss(id) {
        const toastData = this.toasts.get(id);
        if (!toastData) return;

        const { element, timeoutId } = toastData;
        
        // Clear timeout if exists
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Add removing animation
        element.classList.add('toast-removing');
        
        // Remove after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.toasts.delete(id);
        }, 200);
    }

    dismissAll() {
        this.toasts.forEach((_, id) => this.dismiss(id));
    }

    success(title, description = '', options = {}) {
        return this.show(title, description, 'success', options);
    }

    error(title, description = '', options = {}) {
        return this.show(title, description, 'error', options);
    }

    warning(title, description = '', options = {}) {
        return this.show(title, description, 'warning', options);
    }

    info(title, description = '', options = {}) {
        return this.show(title, description, 'info', options);
    }
}

// Initialize global toast manager
const toastManager = new ToastManager();

// Legacy functions for backward compatibility - now use toasts
function showStatusMessage(statusElement, message, type = 'info', isClosable = true) {
    toastManager.show(message, '', type);
}

function hideStatusMessage(statusElement) {
    // No longer needed - toasts auto-dismiss
}

function initializeStatusMessages() {
    // No longer needed - toast system handles everything
}

// Event Listeners
oldCsvInput.addEventListener('change', handleOldCsvUpload);
newCsvInput.addEventListener('change', handleNewCsvUpload);
existingRedirectsInput.addEventListener('change', handleExistingRedirectsUpload);
addManualUrlButton.addEventListener('click', addManualUrl);
addManualOldUrlButton.addEventListener('click', addManualOldUrl);
exportCsvButton.addEventListener('click', exportToCsv);

// Add event listeners for bulk action buttons
checkAllBtn.addEventListener('click', checkAll);
uncheckAllBtn.addEventListener('click', uncheckAll);
checkUnmappedBtn.addEventListener('click', checkUnmapped);
checkMappedBtn.addEventListener('click', checkMapped);

// Add event listeners for paste buttons
loadPastedExistingRedirectsBtn.addEventListener('click', handlePastedExistingRedirects);
exportCsvButton.addEventListener('click', exportToCsv);

// Add event listeners for filter buttons
filterAllBtn.addEventListener('click', () => applyFilter('all'));
filterMappedBtn.addEventListener('click', () => applyFilter('mapped'));
filterUnmappedBtn.addEventListener('click', () => applyFilter('unmapped'));
filterNeedsAttentionBtn.addEventListener('click', () => applyFilter('needsAttention'));
filterSkippedBtn.addEventListener('click', () => applyFilter('skipped'));
filterConflictsBtn.addEventListener('click', () => applyFilter('conflicts'));

// Add event listeners for clear buttons
clearExistingRedirectsBtn.addEventListener('click', clearExistingRedirects);
clearOldUrlsBtn.addEventListener('click', clearOldUrls);
clearNewUrlsBtn.addEventListener('click', clearNewUrls);

// Add event listeners for export radio buttons
exportTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateRedirectCount);
});

// Add event listeners for individual 'Remove File' buttons
removeExistingRedirectsFileBtn.addEventListener('click', handleRemoveExistingRedirectsFile);
removeOldUrlsFileBtn.addEventListener('click', handleRemoveOldUrlsFile);
removeNewUrlsFileBtn.addEventListener('click', handleRemoveNewUrlsFile);

// Add event listener for AI matching
aiMatchBtn.addEventListener('click', handleAiMatching);

// Helper function to extract slug from a URL
function extractSlug(url) {
    if (!url) return '';
    
    let slug = url.trim();
    
    // Check if it's already a slug (starts with /)
    if (slug.startsWith('/')) {
        // Remove trailing slash except for homepage "/"
        if (slug !== '/' && slug.endsWith('/')) {
            slug = slug.slice(0, -1);
        }
        return slug;
    } else {
        // Try to extract path from a URL
        try {
            const urlObj = new URL(slug);
            slug = urlObj.pathname + urlObj.search + urlObj.hash;
        } catch (e) {
            // If not a valid URL, just use as is
            // Make sure it starts with /
            if (!slug.startsWith('/') && slug !== '') {
                slug = '/' + slug;
            }
        }
    }
    
    // Ensure slug starts with /
    if (!slug.startsWith('/') && slug !== '') {
        slug = '/' + slug;
    }
    
    // Remove trailing slash except for homepage "/"
    if (slug !== '/' && slug.endsWith('/')) {
        slug = slug.slice(0, -1);
    }
    
    return slug;
}

// Helper function to clean and tokenize a slug
function cleanSlugForTokenization(slug) {
    if (!slug) return [];
    return slug
        .replace(/\/$/, '') // remove trailing slash
        .split(/[\/\-_]/) // tokenize by separators / , - , _
        .filter(Boolean); // remove empty strings
}

// Handle Existing Redirects Upload
function handleExistingRedirectsUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        // If no file is selected (e.g., user cancels file dialog)
        updateFileInputAppearance('existingRedirectsInput', 'removeExistingRedirectsFile', null, 'selectionCancelled');
        // Do not clear existingRedirects data here, as the user might just be changing the file
        return;
    }
    
    const fileName = file.name;
    updateFileInputAppearance('existingRedirectsInput', 'removeExistingRedirectsFile', fileName, 'fileSelected');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            const { headers, data } = parseCSV(csvContent);
            
            // Clear existing redirects
            existingRedirects = [];
            
            // Enhanced source and target column detection
            let sourceColumn = null;
            let targetColumn = null;
            
            // First try: Look for common redirect column names
            const sourceKeywords = ['source', 'old', 'from', 'original', 'redirect_from'];
            const targetKeywords = ['target', 'new', 'to', 'destination', 'redirect_to'];
            
            sourceColumn = headers.find(h => 
                sourceKeywords.some(keyword => h.toLowerCase().includes(keyword))
            );
            
            targetColumn = headers.find(h => 
                targetKeywords.some(keyword => h.toLowerCase().includes(keyword))
            );
            
            // Second try: If exactly two columns, assume first is source, second is target
            if (!sourceColumn && !targetColumn && headers.length === 2) {
                sourceColumn = headers[0];
                targetColumn = headers[1];
            }
            
            // Third try: Look for URL-like content in columns
            if (!sourceColumn || !targetColumn) {
                const urlLikeColumns = [];
                for (const header of headers) {
                    const sampleValues = data.slice(0, Math.min(3, data.length)).map(row => row[header] || '');
                    const hasUrlLikeContent = sampleValues.some(value => 
                        typeof value === 'string' && 
                        (value.includes('/') || value.includes('http') || value.includes('www') || value.includes('.com'))
                    );
                    if (hasUrlLikeContent) {
                        urlLikeColumns.push(header);
                    }
                }
                
                // If we found exactly two URL-like columns, use them
                if (urlLikeColumns.length === 2) {
                    sourceColumn = sourceColumn || urlLikeColumns[0];
                    targetColumn = targetColumn || urlLikeColumns[1];
                }
            }
            
            if (!sourceColumn || !targetColumn) {
                const availableColumns = headers.map(h => `"${h}"`).join(', ');
                const errorMessage = `Error: Could not identify source and target columns in the CSV.

Available columns: ${availableColumns}

Please ensure your CSV has columns for redirects. Supported column combinations:
• "Source" and "Target"
• "Old" and "New" 
• "From" and "To"

Click the "📋 CSV Format Requirements" above for examples.`;
                existingRedirectStatus.textContent = errorMessage;
                existingRedirectStatus.className = 'status-message error';
                showStatusMessage(existingRedirectStatus, errorMessage, 'error');
                return;
            }
            
            // Add redirects from the CSV
            data.forEach(row => {
                const sourceUrl = extractSlug(row[sourceColumn]);
                const targetUrl = extractSlug(row[targetColumn]);
                
                if (sourceUrl && targetUrl) {
                    existingRedirects.push({
                        source: sourceUrl,
                        target: targetUrl
                    });
                }
            });
            
            // Display success message
            const successMessage = `Success! Loaded ${existingRedirects.length} existing redirects from columns "${sourceColumn}" → "${targetColumn}".`;
            existingRedirectStatus.textContent = successMessage;
            existingRedirectStatus.className = 'status-message success';
            showStatusMessage(existingRedirectStatus, successMessage, 'success');
            
            // Display existing redirects
            displayExistingRedirects();
            
            // Update redirect table to check for conflicts
            updateRedirectTable();
            
        } catch (error) {
            existingRedirectStatus.textContent = `Error: ${error.message}`;
            existingRedirectStatus.className = 'status-message error';
            showStatusMessage(existingRedirectStatus, `Error: ${error.message}`, 'error');
        }
        
        // Update step navigation
        updateSummaryPanel();
    };
    reader.readAsText(file);
}

// Display list of existing redirects
function displayExistingRedirects() {
    if (existingRedirects.length > 0) {
        existingRedirectsContainer.classList.remove('hidden');
        
        // Create header with count
        const headerHtml = `
            <div class="url-list-header">
                <h3>Current Existing Redirects:</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="url-count">${existingRedirects.length} redirect${existingRedirects.length !== 1 ? 's' : ''}</span>
                    <button id="clearExistingRedirects" class="bulk-btn" style="background-color: var(--destructive); color: var(--destructive-foreground);">Clear All</button>
                </div>
            </div>
        `;
        
        // Create list with toggle functionality
        const listHtml = existingRedirects.slice(0, 5).map(redirect => 
            `<div title="${redirect.source} → ${redirect.target}">${redirect.source} → ${redirect.target}</div>`
        ).join('');
        
        const remainingCount = existingRedirects.length - 5;
        const showMoreHtml = remainingCount > 0 ? 
            `<div class="url-list-more" style="color: var(--muted-foreground); font-style: italic; padding: 0.5rem 0; text-align: center; border-top: 1px solid var(--border);">
                +${remainingCount} more redirect${remainingCount !== 1 ? 's' : ''}... 
                <button class="url-list-expand-btn" style="background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline;">Show All</button>
            </div>` : '';
        
        existingRedirectsContainer.innerHTML = headerHtml + `<div id="existingRedirectsList" class="url-list-compact">${listHtml}${showMoreHtml}</div>`;
        
        // Add expand functionality
        const expandBtn = existingRedirectsContainer.querySelector('.url-list-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => toggleUrlList('existingRedirects', existingRedirects));
        }
        
        // Re-attach clear button event listener
        document.getElementById('clearExistingRedirects').addEventListener('click', clearExistingRedirects);
    } else {
        existingRedirectsContainer.classList.add('hidden');
    }
}

// Check if a redirect would create a loop or conflict
function checkRedirectConflicts(sourceSlug, targetSlug) {
    if (!sourceSlug || !targetSlug) return { hasConflict: false };
    
    // Direct loop: A → A
    if (sourceSlug === targetSlug) {
        return {
            hasConflict: true,
            type: 'self-redirect',
            message: 'Self-redirect: The source and target URLs are the same'
        };
    }
    
    // Check existing redirects for conflicts
    for (const redirect of existingRedirects) {
        // Case 1: Creating a redirect that already exists but with a different target
        // Existing: A → B, New: A → C
        if (redirect.source === sourceSlug && redirect.target !== targetSlug) {
            return {
                hasConflict: true,
                type: 'different-target',
                message: `Conflict: This URL already redirects to ${redirect.target}`
            };
        }
        
        // Case 2: Direct loop with existing redirect
        // Existing: A → B, New: B → A
        if (redirect.source === targetSlug && redirect.target === sourceSlug) {
            return {
                hasConflict: true,
                type: 'direct-loop',
                message: 'Redirect loop: This would create a direct redirect loop'
            };
        }
        
        // Case 3: Redirecting to a URL that is itself being redirected
        // Existing: B → C, New: A → B
        if (redirect.source === targetSlug) {
            return {
                hasConflict: true,
                type: 'chained-redirect',
                message: `Chain warning: The target URL redirects to ${redirect.target}`
            };
        }
        
        // Case 4: Creating a redirect for a URL that already has redirects pointing to it
        // Existing: A → B, New: B → C
        if (redirect.target === sourceSlug) {
            return {
                hasConflict: true,
                type: 'target-moved',
                message: 'Warning: Other URLs redirect to this source'
            };
        }
    }
    
    // Check proposed redirects in the table
    const rows = document.querySelectorAll('#redirectTableBody tr');
    for (const row of rows) {
        const rowSource = row.querySelector('td:first-child').textContent;
        const rowTargetInput = row.querySelector('td:nth-child(4) input'); // Adjusted for score column
        if (!rowTargetInput) continue; // Should not happen
        const rowTarget = rowTargetInput.value;
        
        // Skip empty targets or self
        if (!rowTarget || rowSource === sourceSlug) continue;
        
        // Case 5: Creating a redirect that conflicts with a proposed redirect
        if (rowSource === sourceSlug && rowTarget !== targetSlug) {
            return {
                hasConflict: true,
                type: 'proposed-conflict',
                message: 'Conflict: This URL is already being redirected in the table'
            };
        }
        
        // Case 6: Direct loop with a proposed redirect
        if (rowSource === targetSlug && rowTarget === sourceSlug) {
            return {
                hasConflict: true,
                type: 'proposed-loop',
                message: 'Redirect loop: This would create a loop with another proposed redirect'
            };
        }
    }
    
    return { hasConflict: false };
}

// Parse CSV content
function parseCSV(csvContent) {
    const lines = csvContent.split(/\r\n|\n|\r/).filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Handle commas within quoted values
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());
        
        const entry = {};
        for (let j = 0; j < headers.length && j < values.length; j++) {
            entry[headers[j]] = values[j];
        }
        result.push(entry);
    }
    
    return { headers, data: result };
}

// Handle Old CSV Upload
function handleOldCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        updateFileInputAppearance('oldCsvInput', 'removeOldUrlsFile', null, 'selectionCancelled');
        return;
    }

    const fileName = file.name;
    updateFileInputAppearance('oldCsvInput', 'removeOldUrlsFile', fileName, 'fileSelected');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            const { headers, data } = parseCSV(csvContent);
            
            // Enhanced URL column detection
            let urlColumn = null;
            
            // First try: Look for common URL column names
            const urlKeywords = ['address', 'url', 'page', 'link', 'uri', 'href', 'path', 'location'];
            urlColumn = headers.find(h => 
                urlKeywords.some(keyword => h.toLowerCase().includes(keyword))
            );
            
            // Second try: If only one column, assume it's URLs
            if (!urlColumn && headers.length === 1) {
                urlColumn = headers[0];
            }
            
            // Third try: Look for column with URL-like content in first few rows
            if (!urlColumn) {
                for (const header of headers) {
                    const sampleValues = data.slice(0, Math.min(3, data.length)).map(row => row[header] || '');
                    const hasUrlLikeContent = sampleValues.some(value => 
                        typeof value === 'string' && 
                        (value.includes('/') || value.includes('http') || value.includes('www') || value.includes('.com'))
                    );
                    if (hasUrlLikeContent) {
                        urlColumn = header;
                        break;
                    }
                }
            }
            
            if (!urlColumn) {
                const availableColumns = headers.map(h => `"${h}"`).join(', ');
                const errorMessage = `Error: Could not find a URL column in the CSV. 

Available columns: ${availableColumns}

Please ensure your CSV has a column with URLs. Supported column names include: "Address", "URL", "Page", "Link", "Path", or any column containing URLs.

Click the "📋 CSV Format Requirements" above for examples.`;
                oldUrlStatus.textContent = errorMessage;
                oldUrlStatus.className = 'status-message error';
                showStatusMessage(oldUrlStatus, errorMessage, 'error');
                return;
            }
            
            // Find status code column if it exists
            const statusCodeColumn = headers.find(h => 
                h.toLowerCase().includes('status code') || 
                h.toLowerCase() === 'code');
            
            // Filter the data to exclude 301, 404, and 502 status codes
            const statusFilteredData = statusCodeColumn ? 
                data.filter(row => {
                    const statusCode = row[statusCodeColumn];
                    return !["301", "404", "502"].includes(statusCode);
                }) : data;
            
            // Get status code excluded count
            const statusExcludedCount = data.length - statusFilteredData.length;
            
            // Further filter to exclude URLs that already have existing redirects
            const filteredData = statusFilteredData.filter(row => {
                const fullUrl = row[urlColumn];
                const slug = extractSlug(fullUrl);
                
                // Check if this URL already has an existing redirect
                const hasExistingRedirect = existingRedirects.some(redirect => 
                    redirect.source === slug
                );
                
                return !hasExistingRedirect;
            });
            
            // Get existing redirects excluded count
            const existingRedirectsExcludedCount = statusFilteredData.length - filteredData.length;
            
            // Update global excluded count for summary panel
            excludedFromExistingCount = existingRedirectsExcludedCount;
            
            // Store existing URLs before adding new ones
            const existingUrls = [...oldUrls];
            
            // Add new old URLs from the CSV, avoiding duplicates
            filteredData.forEach(row => {
                const fullUrl = row[urlColumn];
                const slug = extractSlug(fullUrl);
                const slugTokens = cleanSlugForTokenization(slug);
                
                // Check if URL already exists
                const isDuplicate = existingUrls.some(url => url.slug === slug);
                if (!isDuplicate && slug) {
                    oldUrls.push({
                        fullUrl,
                        slug: slug,
                        slugTokens: slugTokens,
                        originalData: row // Store the original row data for reference
                    });
                }
            });
            
            let successMessage = `Success! Loaded ${oldUrls.length} URLs from column "${urlColumn}".`;
            
            // Build excluded count message
            const excludedMessages = [];
            if (statusExcludedCount > 0) {
                excludedMessages.push(`${statusExcludedCount} URLs with status codes 301, 404, or 502`);
            }
            if (existingRedirectsExcludedCount > 0) {
                excludedMessages.push(`${existingRedirectsExcludedCount} URLs that already have existing redirects`);
            }
            
            if (excludedMessages.length > 0) {
                successMessage += ` (Excluded ${excludedMessages.join(' and ')})`;
            }
            
            oldUrlStatus.textContent = successMessage;
            oldUrlStatus.className = 'status-message success';
            showStatusMessage(oldUrlStatus, successMessage, 'success');
            
            // Display old URLs list
            displayOldUrls();
            
            // Update the redirects table
            updateRedirectTable();
            
        } catch (error) {
            oldUrlStatus.textContent = `Error: ${error.message}`;
            oldUrlStatus.className = 'status-message error';
            showStatusMessage(oldUrlStatus, `Error: ${error.message}`, 'error');
        }
        
        // Update step navigation
        updateSummaryPanel();
        autoAdvanceStep();
    };
    reader.readAsText(file);
}

// Handle New CSV Upload
function handleNewCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        updateFileInputAppearance('newCsvInput', 'removeNewUrlsFile', null, 'selectionCancelled');
        return;
    }

    const fileName = file.name;
    updateFileInputAppearance('newCsvInput', 'removeNewUrlsFile', fileName, 'fileSelected');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            const { headers, data } = parseCSV(csvContent);
            
            // Enhanced URL column detection
            let urlColumn = null;
            
            // First try: Look for common URL column names
            const urlKeywords = ['address', 'url', 'page', 'link', 'uri', 'href', 'path', 'location'];
            urlColumn = headers.find(h => 
                urlKeywords.some(keyword => h.toLowerCase().includes(keyword))
            );
            
            // Second try: If only one column, assume it's URLs
            if (!urlColumn && headers.length === 1) {
                urlColumn = headers[0];
            }
            
            // Third try: Look for column with URL-like content in first few rows
            if (!urlColumn) {
                for (const header of headers) {
                    const sampleValues = data.slice(0, Math.min(3, data.length)).map(row => row[header] || '');
                    const hasUrlLikeContent = sampleValues.some(value => 
                        typeof value === 'string' && 
                        (value.includes('/') || value.includes('http') || value.includes('www') || value.includes('.com'))
                    );
                    if (hasUrlLikeContent) {
                        urlColumn = header;
                        break;
                    }
                }
            }
            
            if (!urlColumn) {
                const availableColumns = headers.map(h => `"${h}"`).join(', ');
                const errorMessage = `Error: Could not find a URL column in the CSV.

Available columns: ${availableColumns}

Please ensure your CSV has a column with URLs. Supported column names include: "Address", "URL", "Page", "Link", "Path", or any column containing URLs.

Click the "📋 CSV Format Requirements" above for examples.`;
                newUrlStatus.textContent = errorMessage;
                newUrlStatus.className = 'status-message error';
                showStatusMessage(newUrlStatus, errorMessage, 'error');
                return;
            }
            
            // Find status code column if it exists
            const statusCodeColumn = headers.find(h => 
                h.toLowerCase().includes('status code') || 
                h.toLowerCase() === 'code');
            
            // Filter the data to exclude 301, 404, and 502 status codes
            const filteredData = statusCodeColumn ? 
                data.filter(row => {
                    const statusCode = row[statusCodeColumn];
                    return !["301", "404", "502"].includes(statusCode);
                }) : data;
            
            // Get excluded count
            const excludedCount = data.length - filteredData.length;
            
            // Store existing URLs before adding new ones
            const existingUrls = [...newUrls];
            
            // Add new URLs from the CSV
            const newUrlsFromCsv = filteredData.map(row => {
                const fullUrl = row[urlColumn];
                const slug = extractSlug(fullUrl); // slug extracted once
                return {
                    fullUrl,
                    slug: slug, // Use the variable
                    slugTokens: cleanSlugForTokenization(slug),
                    originalData: row 
                };
            });
            
            // Add to global newUrls, ensuring uniqueness by slug
            let addedCount = 0;
            newUrlsFromCsv.forEach(candidateUrl => {
                if (candidateUrl.slug) { // Ensure slug is not empty or null
                    // Check against the CURRENT global newUrls array for duplicates
                    const isDuplicate = newUrls.some(existingUrl => existingUrl.slug === candidateUrl.slug);
                    if (!isDuplicate) {
                        newUrls.push(candidateUrl);
                        addedCount++;
                    }
                }
            });
            
            let successMessage = `Success! Added ${addedCount} new URLs from column "${urlColumn}".`;
            if (excludedCount > 0) {
                successMessage += ` (Excluded ${excludedCount} URLs with status codes 301, 404, or 502)`;
            }
            
            newUrlStatus.textContent = successMessage;
            newUrlStatus.className = 'status-message success';
            showStatusMessage(newUrlStatus, successMessage, 'success');
            
            // Update UI
            initializeFuse(); // Initialize Fuse.js with new data
            displayNewUrls();
            updateRedirectTable();
            
        } catch (error) {
            newUrlStatus.textContent = `Error: ${error.message}`;
            newUrlStatus.className = 'status-message error';
            showStatusMessage(newUrlStatus, `Error: ${error.message}`, 'error');
        }
        
        // Update step navigation
        updateSummaryPanel();
        autoAdvanceStep();
    };
    reader.readAsText(file);
}

// Add manually entered URL
function addManualUrl() {
    const urlValue = manualUrlInput.value.trim();
    if (!urlValue) {
        manualUrlStatus.textContent = 'Please enter a URL or slug.';
        manualUrlStatus.className = 'status-message error';
        showStatusMessage(manualUrlStatus, 'Please enter a URL or slug.', 'error');
        return;
    }
    
    const slug = extractSlug(urlValue);
    
    // Check for duplicates
    if (newUrls.some(url => url.slug === slug)) {
        manualUrlStatus.textContent = 'This URL already exists in your list.';
        manualUrlStatus.className = 'status-message error';
        showStatusMessage(manualUrlStatus, 'This URL already exists in your list.', 'error');
        return;
    }
    
    newUrls.push({
        fullUrl: urlValue,
        slug: slug,
        slugTokens: cleanSlugForTokenization(slug)
    });
    
    manualUrlInput.value = '';
    manualUrlStatus.textContent = `Added: ${slug}`;
    manualUrlStatus.className = 'status-message success';
    showStatusMessage(manualUrlStatus, `Added: ${slug}`, 'success');
    
    // Update UI
    initializeFuse(); // Re-initialize Fuse.js
    displayNewUrls();
    updateRedirectTable(); // This should work - ensure it's called after newUrls is updated
    
    // Force update redirect count to reflect any new matches
    setTimeout(() => {
        updateRedirectCount();
        updateAiMatchingSection();
        updateSummaryPanel();
        autoAdvanceStep();
    }, 100);
}

// Add manually entered old URL
function addManualOldUrl() {
    const urlValue = manualOldUrlInput.value.trim();
    if (!urlValue) {
        manualOldUrlStatus.textContent = 'Please enter a URL or slug.';
        manualOldUrlStatus.className = 'status-message error';
        showStatusMessage(manualOldUrlStatus, 'Please enter a URL or slug.', 'error');
        return;
    }
    
    const slug = extractSlug(urlValue);
    
    // Check for duplicates
    if (oldUrls.some(url => url.slug === slug)) {
        manualOldUrlStatus.textContent = 'This URL already exists in your list.';
        manualOldUrlStatus.className = 'status-message error';
        showStatusMessage(manualOldUrlStatus, 'This URL already exists in your list.', 'error');
        return;
    }
    
    oldUrls.push({
        fullUrl: urlValue,
        slug: slug,
        slugTokens: cleanSlugForTokenization(slug)
    });
    
    manualOldUrlInput.value = '';
    manualOldUrlStatus.textContent = `Added old URL: ${slug}`;
    manualOldUrlStatus.className = 'status-message success';
    showStatusMessage(manualOldUrlStatus, `Added old URL: ${slug}`, 'success');
    
    // Update UI
    displayOldUrls();
    updateRedirectTable();
    
    // Force update redirect count to reflect new rows
    setTimeout(() => {
        updateRedirectCount();
        updateAiMatchingSection();
        updateSummaryPanel();
        autoAdvanceStep();
    }, 100);
}

// Display list of new URLs
function displayNewUrls() {
    if (newUrls.length > 0) {
        newUrlsContainer.classList.remove('hidden');
        
        // Create header with count
        const headerHtml = `
            <div class="url-list-header">
                <h3>Current New URLs:</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="url-count">${newUrls.length} URL${newUrls.length !== 1 ? 's' : ''}</span>
                    <button id="clearNewUrls" class="bulk-btn" style="background-color: var(--destructive); color: var(--destructive-foreground);">Clear All</button>
                </div>
            </div>
        `;
        
        // Create list with toggle functionality
        const listHtml = newUrls.slice(0, 5).map(url => 
            `<div title="${url.slug}">${url.slug}</div>`
        ).join('');
        
        const remainingCount = newUrls.length - 5;
        const showMoreHtml = remainingCount > 0 ? 
            `<div class="url-list-more" style="color: var(--muted-foreground); font-style: italic; padding: 0.5rem 0; text-align: center; border-top: 1px solid var(--border);">
                +${remainingCount} more URL${remainingCount !== 1 ? 's' : ''}... 
                <button class="url-list-expand-btn" style="background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline;">Show All</button>
            </div>` : '';
        
        newUrlsContainer.innerHTML = headerHtml + `<div id="newUrlsList" class="url-list-compact">${listHtml}${showMoreHtml}</div>`;
        
        // Add expand functionality
        const expandBtn = newUrlsContainer.querySelector('.url-list-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => toggleUrlList('newUrls', newUrls));
        }
        
        // Re-attach clear button event listener
        document.getElementById('clearNewUrls').addEventListener('click', clearNewUrls);
    } else {
        newUrlsContainer.classList.add('hidden');
    }
}

// Display list of old URLs
function displayOldUrls() {
    if (oldUrls.length > 0) {
        oldUrlsContainer.classList.remove('hidden');
        
        // Create header with count
        const headerHtml = `
            <div class="url-list-header">
                <h3>Current Old URLs:</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="url-count">${oldUrls.length} URL${oldUrls.length !== 1 ? 's' : ''}</span>
                    <button id="clearOldUrls" class="bulk-btn" style="background-color: var(--destructive); color: var(--destructive-foreground);">Clear All</button>
                </div>
            </div>
        `;
        
        // Create list with toggle functionality
        const listHtml = oldUrls.slice(0, 5).map(url => 
            `<div title="${url.slug}">${url.slug}</div>`
        ).join('');
        
        const remainingCount = oldUrls.length - 5;
        const showMoreHtml = remainingCount > 0 ? 
            `<div class="url-list-more" style="color: var(--muted-foreground); font-style: italic; padding: 0.5rem 0; text-align: center; border-top: 1px solid var(--border);">
                +${remainingCount} more URL${remainingCount !== 1 ? 's' : ''}... 
                <button class="url-list-expand-btn" style="background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline;">Show All</button>
            </div>` : '';
        
        oldUrlsContainer.innerHTML = headerHtml + `<div id="oldUrlsList" class="url-list-compact">${listHtml}${showMoreHtml}</div>`;
        
        // Add expand functionality
        const expandBtn = oldUrlsContainer.querySelector('.url-list-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => toggleUrlList('oldUrls', oldUrls));
        }
        
        // Re-attach clear button event listener
        document.getElementById('clearOldUrls').addEventListener('click', clearOldUrls);
    } else {
        oldUrlsContainer.classList.add('hidden');
    }
}

// Initialize Fuse.js for fuzzy matching
function initializeFuse() {
    if (typeof Fuse !== 'undefined' && newUrls.length > 0) {
        const options = {
            includeScore: true,
            keys: ['slugTokens'], 
            threshold: FUSE_THRESHOLD, 
            ignoreLocation: true,
            matchAllTokens: true, // Ensure all search tokens must be found in the target
            tokenize: true      
            // useExtendedSearch: false, // Explicitly false or remove, as default is false
        };
        // Ensure slugTokens is always an array for Fuse.js
        const fuseData = newUrls.map(u => ({...u, slugTokens: u.slugTokens || cleanSlugForTokenization(u.slug) }));
        fuseNewUrls = new Fuse(fuseData, options);
    } else {
        fuseNewUrls = null;
    }
}

// AI Matching Functions

// Initialize AI API key (you would set this from environment or config)
function initializeAiApiKey() {
    // For demo purposes, check localStorage first
    aiApiKey = localStorage.getItem('openai_api_key') || '';
}

// Prompt user for API key if needed
function promptForApiKey() {
    // Instead of using a prompt, open the API key modal
    openApiKeyModal();
    return false; // Return false since modal is async
}

// Get unmapped URLs that need AI matching
function getUnmappedUrls() {
    const unmappedUrls = [];
    
    oldUrls.forEach((oldUrl, index) => {
        // Skip if already has AI match result cached
        if (aiMatchedResults.has(oldUrl.slug)) {
            return;
        }
        
        // Check if URL is currently unmatched in the table
        const row = document.querySelector(`tr[data-index="${index}"]`);
        if (row) {
            const targetInput = row.querySelector('input.autocomplete-input');
            const hasValue = targetInput && targetInput.value.trim() !== '';
            
            // Include if no target value or if it's a low-confidence suggestion
            if (!hasValue || row.classList.contains('needs-attention')) {
                unmappedUrls.push({
                    slug: oldUrl.slug,
                    index: index,
                    rowElement: row
                });
            }
        }
    });
    
    return unmappedUrls;
}

// Call OpenAI API for URL matching
async function callAiMatchingApi(unmappedUrls, allNewUrls) {
    if (!aiApiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key.');
    }
    
    const oldUrlSlugs = unmappedUrls.map(u => u.slug);
    const newUrlSlugs = allNewUrls.map(u => u.slug);
    
    // Batch process in chunks of 25 to manage token usage
    const batchSize = 25;
    const allMatches = [];
    
    for (let i = 0; i < oldUrlSlugs.length; i += batchSize) {
        const batch = oldUrlSlugs.slice(i, i + batchSize);
        
        // Try different models in order of preference (most capable to most cost-effective)
        const modelsToTry = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
        let selectedModel = modelsToTry[0]; // Default to best model
        
        const prompt = {
            model: selectedModel,
            messages: [
                {
                    role: "system",
                    content: "You are a URL mapping expert. Your task is to match old website URLs to the most appropriate new URLs based on semantic similarity, content intent, and structural patterns. Be conservative with matches - only suggest matches you're confident about."
                },
                {
                    role: "user",
                    content: `Match these old URLs to the most appropriate new URLs. Return ONLY a clean JSON array with matches for URLs you're confident about (60%+ confidence).

Old URLs: ${JSON.stringify(batch)}
New URLs: ${JSON.stringify(newUrlSlugs)}

Return format (plain JSON only, no markdown formatting):
[
  {
    "old": "/old-url",
    "match": "/new-url", 
    "confidence": 85,
    "reasoning": "Brief explanation"
  }
]

Return empty array [] if no confident matches found. Do not wrap the response in markdown code blocks.`
                }
            ],
            max_tokens: 2000,
            temperature: 0.1 // Low temperature for consistent results
        };
        
        // Try each model until one works
        let success = false;
        for (let modelIndex = 0; modelIndex < modelsToTry.length && !success; modelIndex++) {
            selectedModel = modelsToTry[modelIndex];
            prompt.model = selectedModel;
            
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${aiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(prompt)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    const errorMessage = error.error?.message || response.statusText;
                    
                    // If this model doesn't exist or isn't accessible, try the next one
                    if (error.error?.code === 'model_not_found' || 
                        errorMessage.includes('does not exist') || 
                        errorMessage.includes('do not have access') ||
                        response.status === 404) {
                        console.warn(`Model ${selectedModel} not available, trying next model...`);
                        continue; // Try next model
                    }
                    
                    // Handle rate limiting
                    if (error.error?.code === 'rate_limit_exceeded' || 
                        errorMessage.includes('Rate limit') ||
                        response.status === 429) {
                        console.warn(`Rate limit hit for ${selectedModel}, trying next model...`);
                        continue; // Try next model
                    }
                    
                    throw new Error(`OpenAI API error: ${errorMessage}`);
                }
                
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                
                if (content) {
                    try {
                        // Extract JSON from markdown code blocks if present
                        let jsonContent = content.trim();
                        
                        // Remove markdown code block formatting if present
                        if (jsonContent.startsWith('```json')) {
                            jsonContent = jsonContent.replace(/^```json\s*/i, '');
                        }
                        if (jsonContent.startsWith('```')) {
                            jsonContent = jsonContent.replace(/^```\s*/, '');
                        }
                        if (jsonContent.endsWith('```')) {
                            jsonContent = jsonContent.replace(/\s*```$/, '');
                        }
                        
                        // Try to parse the cleaned JSON
                        const batchMatches = JSON.parse(jsonContent.trim());
                        if (Array.isArray(batchMatches)) {
                            allMatches.push(...batchMatches);
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse AI response for batch:', batch);
                        console.warn('Raw response:', content);
                        console.warn('Parse error:', parseError.message);
                        
                        // Try to extract JSON manually if standard parsing fails
                        try {
                            const jsonMatch = content.match(/\[[\s\S]*\]/);
                            if (jsonMatch) {
                                const extractedJson = jsonMatch[0];
                                const batchMatches = JSON.parse(extractedJson);
                                if (Array.isArray(batchMatches)) {
                                    allMatches.push(...batchMatches);
                                    console.log('Successfully extracted JSON manually');
                                }
                            }
                        } catch (fallbackError) {
                            console.warn('Fallback JSON extraction also failed:', fallbackError.message);
                        }
                    }
                }
                
                success = true; // Mark this batch as successful
                
            } catch (error) {
                if (modelIndex === modelsToTry.length - 1) {
                    // If all models failed, log the error and continue
                    console.error('AI API batch error (all models tried):', error);
                    break; // Exit the model loop for this batch
                } else {
                    console.warn(`Model ${selectedModel} failed, trying next model:`, error.message);
                }
            }
        }
        
        if (success) {
            // Update progress
            const progressPercent = Math.min(100, ((i + batchSize) / oldUrlSlugs.length) * 100);
            updateAiProgress(Math.ceil((i + batchSize) / batchSize), Math.ceil(oldUrlSlugs.length / batchSize), progressPercent);
            
            // Longer delay between requests to respect rate limits (especially for free tier)
            if (i + batchSize < oldUrlSlugs.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
        }
    }
    
    return allMatches;
}

// Update AI matching progress
function updateAiProgress(currentBatch, totalBatches, progressPercent) {
    const progressElement = aiMatchProgress.querySelector('.progress-fill');
    const progressText = aiMatchProgress.querySelector('.progress-text');
    
    if (progressElement) {
        progressElement.style.width = `${progressPercent}%`;
    }
    
    if (progressText) {
        progressText.textContent = `Processing batch ${currentBatch} of ${totalBatches}...`;
    }
}

// Apply AI matches to the table
function applyAiMatches(aiMatches, unmappedUrls) {
    let successCount = 0;
    
    aiMatches.forEach(match => {
        // Cache the result
        aiMatchedResults.set(match.old, {
            target: match.match,
            confidence: match.confidence,
            reasoning: match.reasoning,
            timestamp: Date.now()
        });
        
        // Find the corresponding row
        const unmappedUrl = unmappedUrls.find(u => u.slug === match.old);
        if (unmappedUrl && unmappedUrl.rowElement) {
            const row = unmappedUrl.rowElement;
            const targetInput = row.querySelector('input.autocomplete-input');
            const statusCell = row.querySelector('.status-cell');
            
            if (targetInput && match.confidence >= 60) { // Only apply matches with 60%+ confidence
                // Set the target URL
                targetInput.value = match.match;
                targetInput.title = `AI Match: ${match.match} (${match.confidence}% confidence)`;
                
                // Update status cell
                if (statusCell) {
                    statusCell.innerHTML = `<span class="match-ai" title="${match.reasoning}">AI Match (${match.confidence}%)</span>`;
                }
                
                // Update row classes
                row.classList.remove('unmapped', 'needs-attention');
                row.classList.add('mapped', 'ai-matched-row');
                
                // Store AI metadata on the row
                row.dataset.aiMatch = 'true';
                row.dataset.aiConfidence = match.confidence;
                row.dataset.aiReasoning = match.reasoning;
                
                successCount++;
                
                // Trigger input event to update conflicts and other logic, but prevent dropdown opening
                const inputEvent = new Event('input');
                inputEvent.aiGenerated = true; // Mark this as AI-generated to prevent dropdown
                targetInput.dispatchEvent(inputEvent);
                
                // Make sure any open dropdown is closed
                const dropdownContainer = row.querySelector('.autocomplete-dropdown');
                if (dropdownContainer) {
                    dropdownContainer.innerHTML = '';
                    dropdownContainer.classList.remove('show');
                }
            }
        }
    });
    
    return successCount;
}

// Show AI matching results
function showAiResults(successCount, totalAttempted) {
    const message = `AI matching complete: ${successCount} URLs matched out of ${totalAttempted} attempted.`;
    if (successCount > 0) {
        toastManager.success('AI Matching Complete', message);
    } else {
        toastManager.warning('AI Matching Complete', 'No new matches found. Try adjusting your URL structure or check for existing matches.');
    }
}

// Main AI matching handler
async function handleAiMatching() {
    if (isAiMatching) {
        return; // Prevent multiple simultaneous AI matching operations
    }
    
    // Check if API key is available, prompt if needed
    if (!aiApiKey) {
        if (!promptForApiKey()) {
            aiMatchStatus.textContent = 'AI matching cancelled - OpenAI API key required.';
            return;
        }
    }
    
    const unmappedUrls = getUnmappedUrls();
    
    if (unmappedUrls.length === 0) {
        aiMatchStatus.textContent = 'No unmapped URLs found to process.';
        return;
    }
    
    isAiMatching = true;
    aiMatchBtn.disabled = true;
    aiMatchStatus.textContent = `Processing ${unmappedUrls.length} unmapped URLs with AI...`;
    aiMatchProgress.classList.remove('hidden');
    aiMatchResults.classList.add('hidden');
    
    try {
        const aiMatches = await callAiMatchingApi(unmappedUrls, newUrls);
        const successCount = applyAiMatches(aiMatches, unmappedUrls);
        
        // Update table counts and conflicts
        detectDuplicateTargets();
        updateRedirectCount();
        
        // Show results
        showAiResults(successCount, unmappedUrls.length);
        
        // Determine which model was primarily used (first successful one)
        let modelUsed = 'AI';
        if (aiMatches.length > 0) {
            // For simplicity, just show that AI was used successfully
            modelUsed = 'OpenAI';
        }
        
        aiMatchStatus.textContent = `${modelUsed} matching completed. ${successCount} URLs matched.`;
        
    } catch (error) {
        console.error('AI matching error:', error);
        aiMatchStatus.textContent = `AI matching failed: ${error.message}`;
    } finally {
        isAiMatching = false;
        aiMatchBtn.disabled = false;
        aiMatchProgress.classList.add('hidden');
    }
}

// Update AI section visibility and button state
function updateAiMatchingSection() {
    if (oldUrls.length === 0 || newUrls.length === 0) {
        aiMatchingSection.classList.add('hidden');
        return;
    }
    
    const unmappedCount = getUnmappedUrls().length;
    
    if (unmappedCount > 0) {
        aiMatchingSection.classList.remove('hidden');
        aiMatchBtn.disabled = false;
        aiMatchStatus.textContent = `${unmappedCount} unmapped URLs available for AI matching.`;
    } else {
        aiMatchBtn.disabled = true;
        aiMatchStatus.textContent = 'All URLs are already mapped.';
    }
}

// Update redirect table based on old and new URLs
function updateRedirectTable() {
    if (oldUrls.length === 0) {
        redirectSection.classList.add('hidden');
        return;
    }
    
    redirectSection.classList.remove('hidden');
    redirectTableBody.innerHTML = '';
    
    // Update table header to include selection column
    const headerRow = document.querySelector('#redirectTable thead tr');
    
    // Only add the selection header if it doesn't exist
    if (!headerRow.querySelector('.selection-header')) {
        const selectionHeader = document.createElement('th');
        selectionHeader.className = 'selection-header';
        
        // Create select all checkbox
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'select-all-container';
        
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'selectAllCheckbox';
        selectAllCheckbox.addEventListener('change', function() {
            const allRows = document.querySelectorAll('#redirectTableBody tr');
            if (this.checked) {
                // Select all rows
                allRows.forEach(row => {
                    selectRow(row);
                });
            } else {
                // Unselect all rows
                clearAllSelections();
            }
            updateSelectionCount();
            updateSelectionControls();
        });
        
        selectAllContainer.appendChild(selectAllCheckbox);
        selectionHeader.appendChild(selectAllContainer);
        
        // Insert at the beginning of the header row
        headerRow.insertBefore(selectionHeader, headerRow.firstChild);
    }
    
    selectedRows = []; // Clear selected rows when updating table
    lastSelectedRow = null; // Reset last selected row
    
    // Group URLs: unmatched first, matched at the bottom
    const unmatchedUrls = [];
    const matchedUrls = [];
    
    oldUrls.forEach((oldUrl, index) => {
        let bestMatch = null;
        let score = 0; // Our score: 0 to 1 (1 is best)
        let matchType = 'None'; // 'Exact', 'Segment', 'Fuzzy'

        // 1. Try exact match first (on original slugs)
        const exactMatchCandidate = newUrls.find(newUrl => newUrl.slug === oldUrl.slug);
        if (exactMatchCandidate) {
            bestMatch = exactMatchCandidate;
            score = 1.0;
            matchType = 'Exact';
        }

        // 2. If no exact match, try Trailing Segment Matching
        if (!bestMatch) {
            let bestSegmentScore = 0;
            let segmentMatchCandidate = null;
            const oldTokens = oldUrl.slugTokens || cleanSlugForTokenization(oldUrl.slug);

            if (oldTokens.length > 0) {
                newUrls.forEach(newUrlCandidate => {
                    const newCandidateTokens = newUrlCandidate.slugTokens || cleanSlugForTokenization(newUrlCandidate.slug);
                    
                    if (newCandidateTokens.length >= oldTokens.length) {
                        let isSuffix = true;
                        for (let i = 0; i < oldTokens.length; i++) {
                            if (oldTokens[oldTokens.length - 1 - i] !== newCandidateTokens[newCandidateTokens.length - 1 - i]) {
                                isSuffix = false;
                                break;
                            }
                        }

                        if (isSuffix) {
                            let currentSegmentScore = 0.7; // Base score for any suffix match
                            currentSegmentScore += 0.15 * (oldTokens.length / newCandidateTokens.length); // Proportional to overlap similarity
                            if (oldTokens.length >= 2) currentSegmentScore += 0.05; // Bonus for longer suffixes (2+ segments)
                            if (oldTokens.length >= 3) currentSegmentScore += 0.05; // Additional bonus for 3+ segments
                            
                            // If all tokens match (oldTokens is suffix and lengths are same)
                            if (oldTokens.length === newCandidateTokens.length) {
                                currentSegmentScore = 0.98; // Very high score for full token sequence match
                            }
                            currentSegmentScore = Math.min(currentSegmentScore, 0.98); // Cap just below exact slug match

                            if (currentSegmentScore > bestSegmentScore) {
                                bestSegmentScore = currentSegmentScore;
                                segmentMatchCandidate = newUrlCandidate;
                            }
                        }
                    }
                });
            }

            if (segmentMatchCandidate && bestSegmentScore > score) {
                 // Consider segment match if its score is good enough on its own (e.g. > 0.7)
                if (bestSegmentScore >= 0.7) { 
                    bestMatch = segmentMatchCandidate;
                    score = bestSegmentScore;
                    matchType = 'Segment';
                }
            }
        }

        // 3. If no exact or good segment match (or segment match score is too low for auto-fill but could be a suggestion),
        //    try fuzzy match (Fuse.js), but only if it can provide a better score than what we have.
        if (fuseNewUrls && (score < MIN_AUTO_MATCH_SCORE || !bestMatch)) { 
            const oldUrlTokensForFuse = oldUrl.slugTokens || cleanSlugForTokenization(oldUrl.slug);
            
            if (oldUrlTokensForFuse.length > 0) { // Guard against empty search string for Fuse
                const searchStringForFuse = Array.isArray(oldUrlTokensForFuse) ? oldUrlTokensForFuse.join(' ') : oldUrlTokensForFuse;
                const results = fuseNewUrls.search(searchStringForFuse);

                if (results.length > 0 && results[0].item) {
                    const fuseScoreResult = results[0].score; // Fuse's native score (0=best)
                    const ourFuseScore = 1 - fuseScoreResult;

                    // Only consider this fuzzy match if it's better than any existing low-score segment match
                    if (ourFuseScore > score) {
                        bestMatch = results[0].item; 
                        score = ourFuseScore;
                        matchType = 'Fuzzy'; 
                    }
                }
            }
        }

        // 4. Check for cached AI matches (Tier 4)
        if ((!bestMatch || score < MIN_AUTO_MATCH_SCORE) && aiMatchedResults.has(oldUrl.slug)) {
            const aiMatch = aiMatchedResults.get(oldUrl.slug);
            const aiTarget = newUrls.find(newUrl => newUrl.slug === aiMatch.target);
            
            if (aiTarget && aiMatch.confidence >= 60) {
                bestMatch = aiTarget;
                score = aiMatch.confidence / 100; // Convert percentage to decimal
                matchType = 'AI';
            }
        }

        // Decision: Auto-fill or suggest
        let autoFill = false;
        if (bestMatch && score > 0) {
            if (matchType === 'Exact' || matchType === 'Segment') {
                if (score >= MIN_AUTO_MATCH_SCORE) {
                    autoFill = true;
                }
            } else if (matchType === 'Fuzzy') {
                if (score >= MIN_AUTO_MATCH_SCORE_FUZZY) { // Use stricter threshold for fuzzy auto-fill
                    autoFill = true;
                }
            } else if (matchType === 'AI') {
                if (score >= 0.6) { // AI matches with 60%+ confidence are auto-filled
                    autoFill = true;
                }
            }
        }

        if (autoFill) {
            matchedUrls.push({ oldUrl, index, matchingNewUrl: bestMatch, score, matchType });
        } else if (bestMatch && score > 0 && score >= MIN_AUTO_MATCH_SCORE) { // Suggest if score is decent but didn't meet auto-fill criteria for its type
            unmatchedUrls.push({ oldUrl, index, suggestedMatch: bestMatch, score, matchType });
        } else {
            unmatchedUrls.push({ oldUrl, index }); // No match or too low score
        }
    });
    
    // Add unmatched URLs to the table first
    unmatchedUrls.forEach(({ oldUrl, index, suggestedMatch, score, matchType }) => {
        const row = createTableRow(oldUrl, index, null, score || 0, suggestedMatch, matchType || 'None');
        redirectTableBody.appendChild(row);
    });
    
    // Then add matched URLs (good score)
    matchedUrls.forEach(({ oldUrl, index, matchingNewUrl, score, matchType }) => {
        const row = createTableRow(oldUrl, index, matchingNewUrl, score, null, matchType);
        redirectTableBody.appendChild(row);
    });

    detectDuplicateTargets(); // Call after table is populated
    
    updateRedirectCount();
    updateSelectionCount(); // Initialize selection count
    applyFilter('all'); // Apply default filter
    
    // Update row numbers to reflect actual table order
    updateRowNumbers();
    
    // Auto-expand redirects section when data is available
    autoExpandRedirectsSection();
    
    // Update AI matching section
    updateAiMatchingSection();
    
    // Update step navigation
    updateSummaryPanel();
}

// Function to update row numbers to match the actual table order
function updateRowNumbers() {
    const rows = document.querySelectorAll('#redirectTableBody tr');
    let visibleIndex = 1; // Start from 1 for visible rows
    
    rows.forEach((row) => {
        const rowNumberSpan = row.querySelector('.row-number');
        if (rowNumberSpan) {
            if (row.style.display !== 'none') {
                // Only update numbering for visible rows
                rowNumberSpan.textContent = visibleIndex;
                visibleIndex++;
            }
        }
    });
}

// Create a table row for a URL
function createTableRow(oldUrl, index, matchingNewUrl, score, suggestedMatchForLowScore = null, matchType = 'None') {
    const row = document.createElement('tr');
    row.dataset.index = index; // Keep original index from oldUrls
    row.dataset.oldUrlSlug = oldUrl.slug; // Store slug for filtering
    
    // Add selectable class and data attribute
    row.classList.add('selectable-row');
    
    // Apply a class if it's a matched URL
    if (matchingNewUrl) {
        row.classList.add('mapped'); // For filtering
    } else {
        row.classList.add('unmapped'); // For filtering
    }
    
    // Selection cell with number and checkbox
    const selectionCell = document.createElement('td');
    selectionCell.className = 'selection-cell';
    
    // Row number span
    const rowNumberSpan = document.createElement('span');
    rowNumberSpan.className = 'row-number';
    rowNumberSpan.textContent = index + 1; // 1-based for display
    selectionCell.appendChild(rowNumberSpan);
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-checkbox';
    checkbox.addEventListener('change', function(e) {
        e.stopPropagation(); // Prevent row click from triggering
        
        if (this.checked) {
            selectRow(row);
        } else {
            unselectRow(row);
        }
        
        // Update row selected state
        row.classList.toggle('selected-row', this.checked);
        lastSelectedRow = row; // Update lastSelectedRow when a checkbox is changed
        updateSelectionCount();
        updateSelectionControls();
    });
    selectionCell.appendChild(checkbox);
    
    // Add selection cell to row
    row.appendChild(selectionCell);
    
    // Old URL cell
    const oldUrlCell = document.createElement('td');
    oldUrlCell.textContent = oldUrl.slug;
    // Add title attribute to show full path on hover
    oldUrlCell.title = oldUrl.slug;
    row.appendChild(oldUrlCell);
    
    // Status cell
    const statusCell = document.createElement('td');
    statusCell.className = 'status-cell';
    
    if (matchingNewUrl && score >= MIN_AUTO_MATCH_SCORE) { // Good auto-match
        if (matchType === 'Exact') {
            statusCell.innerHTML = '<span class="match-exact">Exact Match</span>';
        } else if (matchType === 'Segment') {
            statusCell.innerHTML = '<span class="match-segment">Segment Match</span>';
        } else if (matchType === 'Fuzzy') {
            statusCell.innerHTML = `<span class="match-fuzzy">Auto Matched (Fuzzy)</span>`;
        } else if (matchType === 'AI') {
            const confidence = Math.round(score * 100);
            const aiMatch = aiMatchedResults.get(oldUrl.slug);
            const reasoning = aiMatch ? aiMatch.reasoning : 'AI-powered semantic matching';
            statusCell.innerHTML = `<span class="match-ai" title="${reasoning}">AI Match (${confidence}%)</span>`;
            row.classList.add('ai-matched-row');
        } else { // Fallback if matchType is somehow not set for a good match
             statusCell.innerHTML = `<span class="match-auto">Auto Matched</span>`; // Generic auto match
        }
        row.classList.add('mapped');
    } else if (score > 0 && suggestedMatchForLowScore) { // Low score, suggestion exists
        let suggestionSourceInfo = 'Suggestion';
        if (matchType === 'Segment') suggestionSourceInfo = 'Segment Suggestion';
        else if (matchType === 'Fuzzy') suggestionSourceInfo = 'Fuzzy Suggestion';
        
        statusCell.innerHTML = `<span class="match-low-confidence">${suggestionSourceInfo}</span>`;
        row.classList.add('unmapped', 'needs-attention');
    } else { // No match or score is 0
        statusCell.innerHTML = '<span class="no-match">Needs Mapping</span>';
        row.classList.add('unmapped', 'needs-attention');
    }
    row.appendChild(statusCell);
    
    // New URL (target) cell with dropdown
    const newUrlCell = document.createElement('td');
    
    // Create autocomplete container
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.className = 'autocomplete-container';
    
    // Create conflict warning element
    const conflictWarning = document.createElement('div');
    conflictWarning.className = 'conflict-warning hidden';
    autocompleteContainer.appendChild(conflictWarning);
    
    // Create input field
    const newUrlInput = document.createElement('input');
    newUrlInput.type = 'text';
    newUrlInput.placeholder = 'Enter or select target URL'; // Always generic placeholder
    // if (score > 0 && !matchingNewUrl && suggestedMatchForLowScore) { 
    //     let suggestionTypeInfo = matchType !== 'None' ? `(${matchType}) ` : '';
    //     newUrlInput.placeholder = `Suggest: ${suggestedMatchForLowScore.slug} ${suggestionTypeInfo}(${(score * 100).toFixed(0)}%)`;
    // }
    newUrlInput.className = 'autocomplete-input';

    // Store low-confidence suggestion details as data attributes if present
    if (suggestedMatchForLowScore && score > 0 && score < (matchType === 'Fuzzy' ? MIN_AUTO_MATCH_SCORE_FUZZY : MIN_AUTO_MATCH_SCORE)) {
        newUrlInput.dataset.suggestedSlug = suggestedMatchForLowScore.slug;
        newUrlInput.dataset.suggestedScore = score.toFixed(2); // Store score with precision
        newUrlInput.dataset.suggestedType = matchType;
    }
    
    // Only set a value if there's a good matching URL (score >= applicable auto-match threshold)
    let autoFilled = false;
    if (matchingNewUrl && score >= MIN_AUTO_MATCH_SCORE) {
        newUrlInput.value = matchingNewUrl.slug;
        newUrlInput.title = matchingNewUrl.slug;
        autoFilled = true;
    } else {
        newUrlInput.value = '';
    }
    
    newUrlInput.dataset.index = index;
    
    // Create dropdown for suggestions
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'autocomplete-dropdown';
    
    // Add event listener to handle input changes
    newUrlInput.addEventListener('input', function(e) {
        updateRedirectCount();
        
        // Update title attribute to match current value
        e.target.title = e.target.value;
        
        // Show dropdown with filtered results (but not for AI-generated events)
        if (!e.aiGenerated) {
            showAutocompleteDropdown(e.target, dropdownContainer);
        }
        
        // Check for conflicts with the entered URL
        const sourceSlug = oldUrl.slug;
        const targetSlug = e.target.value.trim();
        
        // Clear previous conflict warnings
        conflictWarning.textContent = '';
        conflictWarning.className = 'conflict-warning hidden';
        
        if (targetSlug) {
            const conflict = checkRedirectConflicts(sourceSlug, targetSlug);
            if (conflict.hasConflict) {
                conflictWarning.textContent = conflict.message;
                conflictWarning.classList.remove('hidden');
                
                // Add class based on conflict type
                if (conflict.type === 'direct-loop' || conflict.type === 'proposed-loop' || conflict.type === 'self-redirect' || conflict.type === 'duplicate-target') {
                    conflictWarning.classList.add('conflict-critical');
                } else {
                    conflictWarning.classList.add('conflict-warning');
                }
            }
        }
        
        // Visual feedback when user inputs a target URL
        const hasValue = targetSlug !== '';
        const row = e.target.closest('tr');
        const statusSelect = row.querySelector('select.status-select');
        
        // Check if source and target are the same (exact match) - auto-skip to prevent redirect loops
        if (hasValue && targetSlug === sourceSlug) {
            statusSelect.value = 'skip';
            statusSelect.classList.remove('status-redirect');
            statusSelect.classList.add('status-skip');
            row.classList.add('skipped-row');
            row.dataset.action = 'skip';
        } else if (hasValue) {
            // If input has a value and it's not a self-redirect, update row status
            e.target.classList.remove('needs-attention');
            e.target.classList.add('has-mapping');
            
            // Update status cell - only update to show manual mapping if this is NOT an AI-generated event
            if (!e.aiGenerated) {
                const statusCell = row.querySelector('td:nth-child(3)'); // Adjusted for new selection column
                if (statusCell) {
                    // Check if this was previously an auto-match (exact, segment, fuzzy, or AI)
                    const hasAutoMatch = statusCell.querySelector('.match-exact, .match-segment, .match-fuzzy, .match-ai, .match-auto');
                    if (hasAutoMatch || statusCell.querySelector('.no-match')) {
                        statusCell.innerHTML = '<span class="mapped-status">Manual Mapping</span>';
                    }
                }
            }
            row.classList.remove('unmapped');
            row.classList.add('mapped'); // For filtering
            
            // Reset to redirect if it was previously skipped due to exact match
            if (statusSelect.value === 'skip' && row.classList.contains('skipped-row')) {
                statusSelect.value = 'redirect';
                statusSelect.classList.remove('status-skip');
                statusSelect.classList.add('status-redirect');
                row.classList.remove('skipped-row');
                row.dataset.action = 'redirect';
            }
        } else {
            // If input is empty, revert status
            e.target.classList.add('needs-attention');
            e.target.classList.remove('has-mapping');
            
            // Update status cell back to original state
            const statusCell = row.querySelector('td:nth-child(3)'); // Adjusted for new selection column
            if (statusCell) {
                // Always revert to "Needs Mapping" when input is cleared
                const hasAnyStatus = statusCell.querySelector('.mapped-status, .match-exact, .match-segment, .match-fuzzy, .match-ai, .match-auto');
                if (hasAnyStatus) {
                    statusCell.innerHTML = '<span class="no-match">Needs Mapping</span>';
                }
            }
            row.classList.remove('mapped');
            row.classList.add('unmapped'); // For filtering
            if (!row.classList.contains('needs-attention')) {
                 row.classList.add('needs-attention'); // If manually cleared, it needs attention
            }
            
            // Reset to redirect when input is cleared
            if (statusSelect.value === 'skip') {
                statusSelect.value = 'redirect';
                statusSelect.classList.remove('status-skip');
                statusSelect.classList.add('status-redirect');
                row.classList.remove('skipped-row');
                row.dataset.action = 'redirect';
            }
        }
    });
    
    // Add focus event to show all suggestions
    newUrlInput.addEventListener('focus', function(e) {
        showAutocompleteDropdown(e.target, dropdownContainer, true);
    });
    
    // Add blur event to hide dropdown (with delay to allow click)
    newUrlInput.addEventListener('blur', function() {
        setTimeout(() => {
            dropdownContainer.innerHTML = '';
            dropdownContainer.classList.remove('show');
        }, 200);
    });
    
    // Highlight inputs that need attention
    if (!matchingNewUrl) {
        newUrlInput.classList.add('needs-attention');
    }
    
    autocompleteContainer.appendChild(newUrlInput);
    autocompleteContainer.appendChild(dropdownContainer);
    newUrlCell.appendChild(autocompleteContainer);
    row.appendChild(newUrlCell);
    
    // Score cell
    const scoreCell = document.createElement('td');
    scoreCell.className = 'score-cell';
    if (score > 0) { // Display score if it's calculated, even if low
        scoreCell.textContent = `${(score * 100).toFixed(0)}%`;
        if (score < MIN_AUTO_MATCH_SCORE && score !== 1.0) { 
            scoreCell.classList.add('low-confidence');
        } else if (score >= MIN_AUTO_MATCH_SCORE && score < 1.0) {
            scoreCell.classList.remove('low-confidence'); // Good fuzzy match
        } else if (score === 1.0) {
             scoreCell.classList.remove('low-confidence'); // Exact match
        }
    } else {
        scoreCell.textContent = '-';
    }
    row.appendChild(scoreCell);
    
    // Action cell with select dropdown instead of checkbox
    const actionCell = document.createElement('td');
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    statusSelect.dataset.index = index;
    
    // Add options
    const redirectOption = document.createElement('option');
    redirectOption.value = 'redirect';
    redirectOption.textContent = 'Redirect';
    redirectOption.className = 'status-redirect';
    
    const skipOption = document.createElement('option');
    skipOption.value = 'skip';
    skipOption.textContent = 'Skip';
    skipOption.className = 'status-skip';
    
    statusSelect.appendChild(redirectOption);
    statusSelect.appendChild(skipOption);
    
    // Set default value based on match status
    // If source and target URLs are exactly the same, skip by default to prevent redirect loops
    const targetValue = newUrlInput.value.trim();
    if (targetValue && targetValue === oldUrl.slug) {
        statusSelect.value = 'skip';
        statusSelect.classList.add('status-skip');
        row.classList.add('skipped-row');
        row.dataset.action = 'skip';
    } else {
        statusSelect.value = 'redirect';
        statusSelect.classList.add('status-redirect');
        row.dataset.action = 'redirect';
    }
    
    // Add event listener for select change
    statusSelect.addEventListener('change', function(e) {
        updateRedirectCount();
        
        const row = e.target.closest('tr');
        if (e.target.value === 'skip') {
            row.classList.add('skipped-row');
            e.target.classList.remove('status-redirect');
            e.target.classList.add('status-skip');
            row.dataset.action = 'skip'; // For filtering
        } else {
            row.classList.remove('skipped-row');
            e.target.classList.remove('status-skip');
            e.target.classList.add('status-redirect');
            row.dataset.action = 'redirect'; // For filtering
        }
    });
    
    actionCell.appendChild(statusSelect);
    row.appendChild(actionCell);

    // Add click listener to the row itself for selection
    row.addEventListener('click', function(e) {
        // Do not process if click was on an interactive element within the row
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.classList.contains('row-checkbox')) {
            return;
        }

        // If shift is pressed, there's a lastSelectedRow, and it's a different row, handle range selection.
        if (e.shiftKey && lastSelectedRow && lastSelectedRow !== this) {
            handleShiftSelection(this); // handleShiftSelection will manage checkbox states and events
        }
        // For any click on the row (shift or not, same row or different), update lastSelectedRow.
        // This makes the clicked row the new anchor for future shift-selections.
        // Selection itself is not changed by a direct row click.
        lastSelectedRow = this;

        // updateSelectionCount and updateSelectionControls are not called here directly
        // because a row click itself doesn't change selection state.
        // They are called by checkbox change listeners, which are triggered by handleShiftSelection
        // or direct checkbox clicks.
    });
    
    return row;
}

// Select a row
function selectRow(row) {
    if (!row.classList.contains('selected-row')) {
        row.classList.add('selected-row');
        // Update checkbox
        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.checked = true;
        }
        selectedRows.push(row);
    }
}

// Unselect a row
function unselectRow(row) {
    row.classList.remove('selected-row');
    // Update checkbox
    const checkbox = row.querySelector('.row-checkbox');
    if (checkbox) {
        checkbox.checked = false;
    }
    const index = selectedRows.indexOf(row);
    if (index > -1) {
        selectedRows.splice(index, 1);
    }
}

// Clear all row selections
function clearAllSelections(excludeRow = null) {
    const selectedRowElements = document.querySelectorAll('#redirectTableBody tr.selected-row');
    selectedRowElements.forEach(row => {
        if (row === excludeRow) return; // Don't unselect the row that was just clicked (in non-ctrl/shift cases)
        row.classList.remove('selected-row');
        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.checked = false;
        }
    });
    selectedRows = [];
}

// Update the selection count display
function updateSelectionCount() {
    // Create or update the selection count element
    let selectionCountElement = document.getElementById('selectionCount');
    
    if (!selectionCountElement) {
        selectionCountElement = document.createElement('span');
        selectionCountElement.id = 'selectionCount';
        selectionCountElement.className = 'selection-count';
        
        // Insert it after redirect count
        const redirectCountElement = document.getElementById('redirectCount');
        redirectCountElement.insertAdjacentElement('afterend', selectionCountElement);
    }
    
    if (selectedRows.length > 0) {
        selectionCountElement.textContent = `${selectedRows.length} row${selectedRows.length !== 1 ? 's' : ''} selected`;
        selectionCountElement.classList.remove('hidden');
    } else {
        selectionCountElement.classList.add('hidden');
    }
}

// Update controls based on selection
function updateSelectionControls() {
    const floatingSelectionBar = document.getElementById('floatingSelectionBar');
    const floatingSelectionCount = document.getElementById('floatingSelectionCount');
    
    if (selectedRows.length > 0) {
        // Update the count text
        const countText = selectedRows.length === 1 ? '1 selected' : `${selectedRows.length} selected`;
        floatingSelectionCount.textContent = countText;
        
        // Show the floating bar with animation
        floatingSelectionBar.classList.remove('hidden');
        // Force a reflow to ensure the class change is applied
        floatingSelectionBar.offsetHeight;
        floatingSelectionBar.classList.add('show');
    } else {
        // Hide the floating bar with animation
        floatingSelectionBar.classList.remove('show');
        floatingSelectionBar.classList.add('hidden');
    }
}

// Apply an action (redirect/skip) to all selected rows
function applyActionToSelected(action) {
    if (selectedRows.length === 0) return;
    
    selectedRows.forEach(row => {
        const statusSelect = row.querySelector('select.status-select');
        statusSelect.value = action;
        
        // Trigger the change event
        const event = new Event('change');
        statusSelect.dispatchEvent(event);
    });
    
    // Show feedback
    showBulkActionFeedback(`${selectedRows.length} row${selectedRows.length !== 1 ? 's' : ''} set to ${action}`);
    
    // Don't clear selection to allow further actions
    updateRedirectCount();
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl+A or Cmd+A to select all rows
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const allVisibleRows = document.querySelectorAll('#redirectTableBody tr:not([style*="display: none"])'); // Select only visible rows
        const allSelected = selectedRows.length === allVisibleRows.length && allVisibleRows.length > 0;

        if (allSelected) { // If all visible are selected, deselect all
            clearAllSelections();
        } else { // Otherwise, select all visible
            clearAllSelections(); // Clear previous selections first
            allVisibleRows.forEach(row => {
                const checkbox = row.querySelector('.row-checkbox');
                if (checkbox && !checkbox.checked) {
                     checkbox.checked = true;
                     const event = new Event('change');
                     checkbox.dispatchEvent(event); // Trigger change to update selectedRows array
                }
            });
        }
        
        updateSelectionCount();
        updateSelectionControls();
    }
    
    // Escape to clear selection (only if no modal is open)
    if (e.key === 'Escape' && !instructionsModal.classList.contains('show')) {
        clearAllSelections();
        updateSelectionCount();
        updateSelectionControls();
    }
    
    // Implement other keyboard shortcuts as needed
}

// Show autocomplete dropdown with suggestions
function showAutocompleteDropdown(inputElement, dropdownElement, showAll = false) {
    const inputValue = inputElement.value.toLowerCase();
    const oldUrlIndex = parseInt(inputElement.dataset.index);

    if (isNaN(oldUrlIndex) || oldUrlIndex < 0 || oldUrlIndex >= oldUrls.length) {
        console.error("Invalid oldUrlIndex for autocomplete:", oldUrlIndex);
        dropdownElement.classList.remove('show');
        return;
    }
    const oldUrlForRow = oldUrls[oldUrlIndex];
    const oldUrlSlugForRow = oldUrlForRow.slug;
    const oldUrlTokensForRow = oldUrlForRow.slugTokens || cleanSlugForTokenization(oldUrlSlugForRow);

    // Score all new URLs against the current old URL for the row
    let allNewUrlsScored = newUrls.map(newUrlCandidate => {
        let score = 0;
        let matchType = 'None';
        const newUrlCandidateSlug = newUrlCandidate.slug;
        const newUrlCandidateTokens = newUrlCandidate.slugTokens || cleanSlugForTokenization(newUrlCandidateSlug);

        // 1. Exact Slug Match with oldUrlForRow.slug
        if (newUrlCandidateSlug === oldUrlSlugForRow) {
            score = 1.0;
            matchType = 'Exact (Row)';
        } else {
            // 2. Trailing Segment Match with oldUrlForRow.slugTokens
            if (oldUrlTokensForRow.length > 0 && newUrlCandidateTokens.length >= oldUrlTokensForRow.length) {
                let isSuffix = true;
                for (let i = 0; i < oldUrlTokensForRow.length; i++) {
                    if (oldUrlTokensForRow[oldUrlTokensForRow.length - 1 - i] !== newUrlCandidateTokens[newUrlCandidateTokens.length - 1 - i]) {
                        isSuffix = false;
                        break;
                    }
                }
                if (isSuffix) {
                    let currentSegmentScore = 0.75; // Base for segment
                    currentSegmentScore += 0.15 * (oldUrlTokensForRow.length / Math.max(1, newUrlCandidateTokens.length));
                    if (oldUrlTokensForRow.length === newUrlCandidateTokens.length && oldUrlTokensForRow.every((val, idx) => val === newUrlCandidateTokens[idx])) {
                        currentSegmentScore = 0.98; // Almost exact if all tokens match
                    }
                    score = Math.min(currentSegmentScore, 0.98);
                    matchType = 'Segment (Row)';
                }
            }

            // 3. Simple Token Overlap Score (Jaccard-like) with oldUrlForRow.slugTokens
            if (oldUrlTokensForRow.length > 0 && newUrlCandidateTokens.length > 0) {
                const setOld = new Set(oldUrlTokensForRow);
                const setNew = new Set(newUrlCandidateTokens);
                const intersection = new Set([...setOld].filter(x => setNew.has(x)));
                const union = new Set([...setOld, ...setNew]);
                const jaccardValue = union.size > 0 ? intersection.size / union.size : 0;
                const potentialFuzzyScore = jaccardValue * 0.7; // Weighted Jaccard

                if (potentialFuzzyScore > score && potentialFuzzyScore > 0.1) { // If Jaccard is better and meaningful
                    score = potentialFuzzyScore;
                    matchType = 'Fuzzy (Row)';
                }
            }
        }
        return { ...newUrlCandidate, dropdownScore: score, dropdownMatchType: matchType };
    });

    // Sort by the new dropdownScore (relevance to current old URL)
    allNewUrlsScored.sort((a, b) => b.dropdownScore - a.dropdownScore);

    let displayItems = allNewUrlsScored;

    // If user has typed something, filter the primarily sorted list by items containing the input text
    if (inputValue.length > 0 && !showAll) {
        displayItems = allNewUrlsScored.filter(url => url.slug.toLowerCase().includes(inputValue));
    }

    displayItems = displayItems.slice(0, 15); // Take top N results

    dropdownElement.innerHTML = ''; // Clear current dropdown

    // Determine if dropdown should be shown
    const shouldShowDropdown = displayItems.length > 0 || (inputValue.length > 0 && !exactMatchFound(inputValue, displayItems));
    
    if (!shouldShowDropdown) {
        dropdownElement.classList.remove('show');
        return;
    }
    dropdownElement.classList.add('show');

    const initialSuggestedSlugFromTable = inputElement.dataset.suggestedSlug;

    displayItems.forEach(url => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';

        if (url.slug === initialSuggestedSlugFromTable) {
            item.classList.add('initial-suggestion'); // Special styling for the table's first best guess
        }
        if (inputValue && url.slug.toLowerCase() === inputValue) {
            item.classList.add('exact-match'); // For what user typed
        }

        item.innerHTML = `
            <div>${url.slug}</div>
        `;
        item.title = `${url.slug}`;
        
        item.addEventListener('click', function() {
            inputElement.value = url.slug;
            inputElement.title = url.slug;
            dropdownElement.innerHTML = '';
            dropdownElement.classList.remove('show');
            inputElement.dispatchEvent(new Event('input')); // Trigger updates
        });
        dropdownElement.appendChild(item);
    });
    
    // "Use custom value" logic
    if (inputValue.length > 0) {
        const exactMatchToInputInDisplay = displayItems.some(url => url.slug.toLowerCase() === inputValue);
        if (!exactMatchToInputInDisplay) {
            if (displayItems.length > 0) { // Add divider if other items exist
                const divider = document.createElement('div');
                divider.className = 'autocomplete-divider';
                dropdownElement.appendChild(divider);
            }
            
            const customItem = document.createElement('div');
            customItem.className = 'autocomplete-item autocomplete-custom';
            const formattedInputValue = inputValue.startsWith('/') ? inputValue : '/' + inputValue;
            customItem.innerHTML = `
                <span>Use custom value:</span>
                <strong>${formattedInputValue}</strong>
            `;
            
            customItem.addEventListener('click', function() {
                inputElement.value = formattedInputValue;
                inputElement.title = formattedInputValue;
                dropdownElement.innerHTML = '';
                dropdownElement.classList.remove('show');
                inputElement.dispatchEvent(new Event('input')); // Trigger updates
            });
            dropdownElement.appendChild(customItem);
        }
    }

    if (dropdownElement.children.length === 0) {
        dropdownElement.classList.remove('show');
    }
}

function exactMatchFound(inputValue, filteredUrls) {
    return filteredUrls.some(url => url.slug.toLowerCase() === inputValue);
}

// Bulk Action Functions

// Set all to redirect
function checkAll() {
    const selects = document.querySelectorAll('#redirectTableBody select.status-select');
    selects.forEach(select => {
        select.value = 'redirect';
        select.classList.remove('status-skip');
        select.classList.add('status-redirect');
        // Remove skipped-row class if it exists
        const row = select.closest('tr');
        row.classList.remove('skipped-row');
    });
    updateRedirectCount();
    
    // Show feedback
    showBulkActionFeedback('All set to redirect');
}

// Set all to skip
function uncheckAll() {
    const selects = document.querySelectorAll('#redirectTableBody select.status-select');
    selects.forEach(select => {
        select.value = 'skip';
        select.classList.remove('status-redirect');
        select.classList.add('status-skip');
        // Add skipped-row class
        const row = select.closest('tr');
        row.classList.add('skipped-row');
    });
    updateRedirectCount();
    
    // Show feedback
    showBulkActionFeedback('All set to skip');
}

// Set unmapped URLs to redirect
function checkUnmapped() {
    const rows = document.querySelectorAll('#redirectTableBody tr');
    
    rows.forEach(row => {
        const statusCell = row.querySelector('td:nth-child(2)');
        const selectField = row.querySelector('select.status-select');
        
        // Check if this is an unmapped row (has no-match class)
        if (statusCell.querySelector('.no-match')) {
            selectField.value = 'redirect';
            selectField.classList.remove('status-skip');
            selectField.classList.add('status-redirect');
            row.classList.remove('skipped-row');
        } else {
            selectField.value = 'skip';
            selectField.classList.remove('status-redirect');
            selectField.classList.add('status-skip');
            row.classList.add('skipped-row');
        }
    });
    
    updateRedirectCount();
    
    // Show feedback
    showBulkActionFeedback('Only unmapped URLs set to redirect');
}

// Set mapped URLs to redirect
function checkMapped() {
    const rows = document.querySelectorAll('#redirectTableBody tr');
    
    rows.forEach(row => {
        const statusCell = row.querySelector('td:nth-child(2)');
        const selectField = row.querySelector('select.status-select');
        const inputField = row.querySelector('input[type="text"]');
        
        // Check if this is a mapped row (has mapped-status class or match-found class) or has a value in the input
        const isMapped = statusCell.querySelector('.mapped-status') || 
                         statusCell.querySelector('.match-found') ||
                         (inputField && inputField.value.trim() !== '');
        
        if (isMapped) {
            selectField.value = 'redirect';
            selectField.classList.remove('status-skip');
            selectField.classList.add('status-redirect');
            row.classList.remove('skipped-row');
        } else {
            selectField.value = 'skip';
            selectField.classList.remove('status-redirect');
            selectField.classList.add('status-skip');
            row.classList.add('skipped-row');
        }
    });
    
    updateRedirectCount();
    
    // Show feedback
    showBulkActionFeedback('Only mapped URLs set to redirect');
}

// Show feedback for bulk actions
function showBulkActionFeedback(message) {
    toastManager.success(message);
}

// Update redirect count and export button state
function updateRedirectCount() {
    const selectedRadio = document.querySelector('input[name="exportType"]:checked');
    const exportType = selectedRadio ? selectedRadio.value : 'mapped_redirect';
    const rows = Array.from(document.querySelectorAll('#redirectTableBody tr'));
    let count = 0;
    let description = '';
    
    if (exportType === 'unmapped_skip') {
        count = rows.filter(row => {
            if (row.style.display === 'none') return false;
            const targetSlugInput = row.querySelector('td:nth-child(4) input');
            const isUnmapped = !row.classList.contains('mapped') || !targetSlugInput || targetSlugInput.value.trim() === '';
            return isUnmapped;
        }).length;
        description = `${count} unmapped URL${count !== 1 ? 's' : ''} will be exported`;
    } else if (exportType === 'mapped_redirect') {
        count = rows.filter(row => {
            if (row.style.display === 'none') return false;
            const actionSelect = row.querySelector('select.status-select');
            if (!actionSelect || actionSelect.value !== 'redirect') return false;
            const targetSlugInput = row.querySelector('td:nth-child(4) input');
            const isConsideredMapped = row.classList.contains('mapped');
            return targetSlugInput && targetSlugInput.value.trim() !== '' && isConsideredMapped;
        }).length;
        description = `${count} mapped redirect${count !== 1 ? 's' : ''} will be exported`;
    }
    
    document.getElementById('redirectCount').textContent = description;
    exportCsvButton.disabled = count === 0;
    
    // Also update summary panel when redirect count changes
    updateSummaryPanel();
}

// Apply table filter
function applyFilter(filterType) {
    const rows = document.querySelectorAll('#redirectTableBody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        let showRow = false;
        const isSkipped = row.classList.contains('skipped-row');
        const isMapped = row.classList.contains('mapped') || (row.querySelector('input.autocomplete-input') && row.querySelector('input.autocomplete-input').value.trim() !== '');
        const isUnmapped = !isMapped;
        const needsAttention = isUnmapped || row.querySelector('.low-confidence'); // Or other criteria for "needs attention"
        const hasConflict = row.querySelector('.conflict-warning:not(.hidden)');

        switch (filterType) {
            case 'all':
                showRow = true;
                break;
            case 'mapped':
                showRow = isMapped && !isSkipped;
                break;
            case 'unmapped':
                showRow = isUnmapped && !isSkipped;
                break;
            case 'needsAttention':
                showRow = needsAttention && !isSkipped;
                break;
            case 'skipped':
                showRow = isSkipped;
                break;
            case 'conflicts':
                showRow = hasConflict && !isSkipped;
                break;
        }

        row.style.display = showRow ? '' : 'none';
        if (showRow) {
            visibleCount++;
        }
    });

    // Update active state for filter buttons
    const filterButtons = document.querySelectorAll('.filter-actions .filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Btn`).classList.add('active');
    
    updateRedirectCount(); // Update count based on visible rows
    updateSelectionCount(); // Also update selection count as visibility changes selection context for Ctrl+A
    clearAllSelections(); // Clear selections when filter changes
    updateSelectionControls();
    updateRowNumbers(); // Update row numbers for visible rows
}

// Export to CSV
function exportToCsv() {
    const rows = Array.from(document.querySelectorAll('#redirectTableBody tr'));
    const selectedRadio = document.querySelector('input[name="exportType"]:checked');
    const exportType = selectedRadio ? selectedRadio.value : 'mapped_redirect';
    let redirectsToExport = [];

    if (exportType === 'unmapped_skip') { // Export unmapped URLs (for manual review)
        redirectsToExport = rows
            .filter(row => {
                // Row must be visible
                if (row.style.display === 'none') return false;
                
                const targetSlugInput = row.querySelector('td:nth-child(4) input'); // Adjusted for score column
                const isUnmapped = !row.classList.contains('mapped') || !targetSlugInput || targetSlugInput.value.trim() === '';
                return isUnmapped;
            })
            .map(row => {
                const sourceSlug = row.dataset.oldUrlSlug; // Use dataset for original slug
                return { source: sourceSlug, target: '' }; // Empty target for unmapped URLs
            });
    } else { // 'mapped_redirect'
        redirectsToExport = rows
            .filter(row => {
                // Row must be visible
                if (row.style.display === 'none') return false;
                
                const actionSelect = row.querySelector('select.status-select');
                if (!actionSelect || actionSelect.value !== 'redirect') return false;

                const targetSlugInput = row.querySelector('td:nth-child(4) input'); // Adjusted for score column
                // Ensure it has a target and is not just a low-score suggestion that wasn't auto-filled
                const isConsideredMapped = row.classList.contains('mapped');
                return targetSlugInput && targetSlugInput.value.trim() !== '' && isConsideredMapped;
            })
            .map(row => {
                const sourceSlug = row.dataset.oldUrlSlug; // Use dataset for original slug
                const targetSlugInput = row.querySelector('td:nth-child(4) input'); // Adjusted for score column
                return { source: sourceSlug, target: targetSlugInput ? targetSlugInput.value : '' };
            });
    }
    
    if (redirectsToExport.length === 0) {
        toastManager.warning('Export Error', 'No redirects selected or matching criteria for export.');
        return;
    }
    
    // Validate all redirects have target values (except for unmapped export)
    if (exportType !== 'unmapped_skip') {
        const emptyTargets = redirectsToExport.filter(r => !r.target || !r.target.trim());
        if (emptyTargets.length > 0) {
            toastManager.error('Export Error', `${emptyTargets.length} redirect(s) are missing target URLs. Please enter target URLs for all selected redirects.`);
            return;
        }
    }
    
    // Check for critical conflicts (except for unmapped exports)
    let hasCriticalConflicts = false;
    const conflictMessages = [];
    
    if (exportType !== 'unmapped_skip') {
        redirectsToExport.forEach(redirect => {
            const conflict = checkRedirectConflicts(redirect.source, redirect.target);
            if (conflict.hasConflict && 
                (conflict.type === 'direct-loop' || 
                 conflict.type === 'proposed-loop' || 
                 conflict.type === 'self-redirect')) {
                hasCriticalConflicts = true;
                conflictMessages.push(`${redirect.source} → ${redirect.target}: ${conflict.message}`);
            }
        });
    }
    
    if (hasCriticalConflicts) {
        const confirmExport = confirm(`Warning: The following critical conflicts were detected:\n\n${conflictMessages.join('\n')}\n\nThese will cause redirect loops. Do you still want to export?`);
        if (!confirmExport) {
            return;
        }
    }
    
    // Create CSV content
    let csvContent = 'source,target\n';
    csvContent += redirectsToExport.map(r => `${r.source},${r.target}`).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'redirects.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success toast
    toastManager.success('Export Complete', `Successfully exported ${redirectsToExport.length} redirect${redirectsToExport.length !== 1 ? 's' : ''} to CSV.`);
}

// Export selected rows to CSV
function exportSelectedToCsv() {
    if (selectedRows.length === 0) {
        toastManager.warning('Export Error', 'No rows selected for export.');
        return;
    }
    
    // Extract source and target from selected rows
    const redirectsToExport = selectedRows.map(row => {
        const sourceSlug = row.dataset.oldUrlSlug; // Use dataset for original slug
        const targetSlugInput = row.querySelector('td:nth-child(4) input'); // Target URL input
        return { 
            source: sourceSlug, 
            target: targetSlugInput ? targetSlugInput.value.trim() : '' 
        };
    });
    
    // Validate all redirects have source values
    const emptySources = redirectsToExport.filter(r => !r.source || !r.source.trim());
    if (emptySources.length > 0) {
        toastManager.error('Export Error', `${emptySources.length} selected row(s) are missing source URLs.`);
        return;
    }
    
    // Note: We don't require target URLs for export as user might want to export for further processing
    
    // Check for critical conflicts only if targets are provided
    let hasCriticalConflicts = false;
    const conflictMessages = [];
    
    redirectsToExport.forEach(redirect => {
        if (redirect.target && redirect.target.trim()) {
            const conflict = checkRedirectConflicts(redirect.source, redirect.target);
            if (conflict.hasConflict && 
                (conflict.type === 'direct-loop' || 
                 conflict.type === 'proposed-loop' || 
                 conflict.type === 'self-redirect')) {
                hasCriticalConflicts = true;
                conflictMessages.push(`${redirect.source} → ${redirect.target}: ${conflict.message}`);
            }
        }
    });
    
    if (hasCriticalConflicts) {
        const confirmExport = confirm(`Warning: The following critical conflicts were detected:\n\n${conflictMessages.join('\n')}\n\nThese will cause redirect loops. Do you still want to export?`);
        if (!confirmExport) {
            return;
        }
    }
    
    // Create CSV content
    let csvContent = 'source,target\n';
    csvContent += redirectsToExport.map(r => `${r.source},${r.target}`).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-redirects-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success toast
    toastManager.success('Export Complete', `Successfully exported ${selectedRows.length} selected redirect${selectedRows.length !== 1 ? 's' : ''} to CSV.`);
}

// Handle Pasted Existing Redirects
function handlePastedExistingRedirects() {
    const pasteData = existingRedirectsPaste.value.trim();
    if (!pasteData) {
        pastedExistingRedirectsStatus.textContent = 'Error: Paste area is empty.';
        pastedExistingRedirectsStatus.className = 'status-message error';
        showStatusMessage(pastedExistingRedirectsStatus, 'Error: Paste area is empty.', 'error');
        return;
    }

    try {
        const lines = pasteData.split('\n');
        const newExistingRedirects = [];
        lines.forEach(line => {
            const parts = line.split(/[\t,;]/); // Split by tab, comma, or semicolon
            if (parts.length >= 2) {
                const sourceSlug = extractSlug(parts[0].trim()); // Keep original source for matching
                const targetSlug = extractSlug(parts[1].trim());
                if (sourceSlug && targetSlug) {
                    newExistingRedirects.push({ source: sourceSlug, target: targetSlug });
                }
            }
        });

        if (newExistingRedirects.length === 0) {
            pastedExistingRedirectsStatus.textContent = 'Error: No valid redirect pairs found. Ensure format is source,target per line.';
            pastedExistingRedirectsStatus.className = 'status-message error';
            showStatusMessage(pastedExistingRedirectsStatus, 'Error: No valid redirect pairs found. Ensure format is source,target per line.', 'error');
            return;
        }

        // Add to existingRedirects, avoiding duplicates with current ones
        let addedCount = 0;
        newExistingRedirects.forEach(redir => {
            if (!existingRedirects.some(er => er.source === redir.source && er.target === redir.target)) {
                existingRedirects.push(redir);
                addedCount++;
            }
        });

        pastedExistingRedirectsStatus.textContent = `Success! Loaded ${addedCount} new existing redirects. Total: ${existingRedirects.length}.`;
        pastedExistingRedirectsStatus.className = 'status-message success';
        showStatusMessage(pastedExistingRedirectsStatus, `Success! Loaded ${addedCount} new existing redirects. Total: ${existingRedirects.length}.`, 'success');
        existingRedirectsPaste.value = ''; // Clear textarea
        displayExistingRedirects();
        updateRedirectTable();
        
    } catch (error) {
        pastedExistingRedirectsStatus.textContent = `Error: ${error.message}`;
        pastedExistingRedirectsStatus.className = 'status-message error';
        showStatusMessage(pastedExistingRedirectsStatus, `Error: ${error.message}`, 'error');
    }
}

// Handle Shift Selection
function handleShiftSelection(currentRow) {
    const allRows = Array.from(document.querySelectorAll('#redirectTableBody tr.selectable-row:not([style*="display: none"])')); // Only visible rows
    const lastClickedCheckbox = lastSelectedRow ? lastSelectedRow.querySelector('.row-checkbox') : null;
    const currentCheckbox = currentRow.querySelector('.row-checkbox');

    if (!lastClickedCheckbox || !currentCheckbox || lastSelectedRow === currentRow) {
        // If no last selected or same row, just toggle current
        currentCheckbox.checked = !currentCheckbox.checked;
        // Dispatch change event for the checkbox
        const event = new Event('change');
        currentCheckbox.dispatchEvent(event);
        return;
    }

    const startIndex = allRows.indexOf(lastSelectedRow);
    const endIndex = allRows.indexOf(currentRow);

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    for (let i = minIndex; i <= maxIndex; i++) {
        const rowToSelect = allRows[i];
        const rowCheckbox = rowToSelect.querySelector('.row-checkbox');
        if (rowCheckbox && !rowCheckbox.checked) { // Select if not already selected
            rowCheckbox.checked = true;
            // Dispatch change event for the checkbox
            const event = new Event('change');
            rowCheckbox.dispatchEvent(event);
        }
    }
}

// Function to detect and warn about duplicate targets
function detectDuplicateTargets() {
    // This function is intentionally left empty to remove duplicate target warnings
    // Multiple sources mapping to the same target is now considered acceptable
}

// Accordion functionality
function initializeAccordions() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const isCurrentlyActive = content.classList.contains('active');
            
            // Close all accordions first
            accordionHeaders.forEach(otherHeader => {
                const otherTargetId = otherHeader.getAttribute('data-target');
                const otherContent = document.getElementById(otherTargetId);
                otherContent.classList.remove('active');
                otherHeader.classList.remove('active');
            });
            
            // If the clicked accordion wasn't active, open it
            if (!isCurrentlyActive) {
                content.classList.add('active');
                this.classList.add('active');
            }
        });
    });
}

// Auto-expand the redirects section when data is available
function autoExpandRedirectsSection() {
    const redirectSection = document.getElementById('redirectSection');
    if (!redirectSection.classList.contains('hidden')) {
        const manageRedirectsHeader = document.querySelector('[data-target="manage-redirects-content"]');
        const manageRedirectsContent = document.getElementById('manage-redirects-content');
        
        if (manageRedirectsHeader && manageRedirectsContent && !manageRedirectsContent.classList.contains('active')) {
            manageRedirectsContent.classList.add('active');
            manageRedirectsHeader.classList.add('active');
        }
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeStepNavigation(); // Initialize step navigation system
    
    // Add keyboard shortcuts event listener once
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Initialize status messages (hide them by default or make existing closable)
    initializeStatusMessages();
    
    // Initialize AI API key
    initializeAiApiKey();
});

// Initial calls if needed
initializeFuse(); 

// Clear functions
function clearExistingRedirects() {
    if (confirm('Are you sure you want to clear all existing redirects? This action cannot be undone.')) {
        existingRedirects = [];
        existingRedirectsContainer.classList.add('hidden');
        existingRedirectStatus.textContent = 'All existing redirects cleared.';
        existingRedirectStatus.className = 'status-message success';
        showStatusMessage(existingRedirectStatus, 'All existing redirects cleared.', 'success');
        
        // Clear the file input, displayed name, and hide remove button
        existingRedirectsInput.value = '';
        existingRedirectsPaste.value = '';
        updateFileInputAppearance('existingRedirectsInput', 'removeExistingRedirectsFile', null, 'fileRemoved');
        
        updateRedirectTable(); // Update table to remove conflict warnings
    }
}

function clearOldUrls() {
    if (confirm('Are you sure you want to clear all old URLs? This action cannot be undone.')) {
        oldUrls = [];
        excludedFromExistingCount = 0; // Reset excluded count
        oldUrlsContainer.classList.add('hidden');
        redirectSection.classList.add('hidden'); // Hide redirect section since no old URLs
        oldUrlStatus.textContent = 'All old URLs cleared.';
        oldUrlStatus.className = 'status-message success';
        showStatusMessage(oldUrlStatus, 'All old URLs cleared.', 'success');
        
        // Clear the file input, paste area
        oldCsvInput.value = '';
        manualOldUrlInput.value = '';
        updateFileInputAppearance('oldCsvInput', 'removeOldUrlsFile', null, 'fileRemoved');
        
        // Clear the redirect table
        redirectTableBody.innerHTML = '';
        selectedRows = [];
        lastSelectedRow = null;
        updateRedirectCount();
        updateSummaryPanel(); // Update summary to reflect cleared excluded count
    }
}

function clearNewUrls() {
    if (confirm('Are you sure you want to clear all new URLs? This action cannot be undone.')) {
        newUrls = [];
        newUrlsContainer.classList.add('hidden');
        newUrlStatus.textContent = 'All new URLs cleared.';
        newUrlStatus.className = 'status-message success';
        showStatusMessage(newUrlStatus, 'All new URLs cleared.', 'success');
        
        // Clear the file input, paste area
        newCsvInput.value = '';
        manualUrlInput.value = '';
        updateFileInputAppearance('newCsvInput', 'removeNewUrlsFile', null, 'fileRemoved');
        
        // Re-initialize Fuse with empty data
        initializeFuse();
        
        updateRedirectTable(); // Update table to remove suggestions
    }
}

// Functions to handle individual file removal
function handleRemoveExistingRedirectsFile() {
    if (confirm('Are you sure you want to remove the selected existing redirects file and its data?')) {
        // Clear data array
        existingRedirects = [];
        excludedFromExistingCount = 0; // Reset excluded count since existing redirects are cleared
        displayExistingRedirects(); // Update UI for data list
        existingRedirectStatus.textContent = 'Existing redirects file and data cleared.';
        existingRedirectStatus.className = 'status-message success';
        showStatusMessage(existingRedirectStatus, 'Existing redirects file and data cleared.', 'success');

        // Clear file input
        existingRedirectsInput.value = ''; // Reset file input
        updateFileInputAppearance('existingRedirectsInput', 'removeExistingRedirectsFile', null, 'fileRemoved');

        updateRedirectTable(); // Update main table for conflicts etc.
        updateSummaryPanel(); // Update summary to reflect cleared excluded count
    }
}

function handleRemoveOldUrlsFile() {
    if (confirm('Are you sure you want to remove the selected old URLs file and its data?')) {
        oldUrls = [];
        excludedFromExistingCount = 0; // Reset excluded count
        displayOldUrls();
        oldUrlStatus.textContent = 'Old URLs file and data cleared.';
        oldUrlStatus.className = 'status-message success';
        showStatusMessage(oldUrlStatus, 'Old URLs file and data cleared.', 'success');

        oldCsvInput.value = '';
        updateFileInputAppearance('oldCsvInput', 'removeOldUrlsFile', null, 'fileRemoved');

        redirectTableBody.innerHTML = ''; // Clear main table
        redirectSection.classList.add('hidden');
        updateRedirectCount();
        updateSummaryPanel(); // Update summary to reflect cleared excluded count
    }
}

function handleRemoveNewUrlsFile() {
    if (confirm('Are you sure you want to remove the selected new URLs file and its data?')) {
        newUrls = [];
        displayNewUrls();
        newUrlStatus.textContent = 'New URLs file and data cleared.';
        newUrlStatus.className = 'status-message success';
        showStatusMessage(newUrlStatus, 'New URLs file and data cleared.', 'success');

        newCsvInput.value = '';
        updateFileInputAppearance('newCsvInput', 'removeNewUrlsFile', null, 'fileRemoved');

        initializeFuse(); // Re-initialize Fuse with empty data
        updateRedirectTable(); // Update main table
    }
}

// Modal functionality
function openInstructionsModal() {
    instructionsModal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeInstructionsModal() {
    instructionsModal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
}

// Event listeners for modal
instructionsBtn.addEventListener('click', openInstructionsModal);
closeInstructionsModalBtn.addEventListener('click', closeInstructionsModal);

// Close modal when clicking outside of it
instructionsModal.addEventListener('click', function(e) {
    if (e.target === instructionsModal) {
        closeInstructionsModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (instructionsModal.classList.contains('show')) {
            closeInstructionsModal();
        } else if (apiKeyModal.classList.contains('show')) {
            closeApiKeyModal();
        } else if (csvFormatModal.classList.contains('show')) {
            closeCsvFormatModal();
        }
    }
});

// API Key Modal functionality
function openApiKeyModal() {
    // Load current API key
    const currentKey = localStorage.getItem('openai_api_key') || '';
    apiKeyInput.value = currentKey;
    
    apiKeyModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Clear any previous status
    apiKeyStatus.classList.add('hidden');
    apiKeyStatus.textContent = '';
}

function closeApiKeyModal() {
    apiKeyModal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Clear the input for security
    apiKeyInput.value = '';
}

function toggleApiKeyVisibility() {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    // Update icon (you could change the SVG here if desired)
    const icon = toggleApiKeyVisibilityBtn.querySelector('svg');
    if (isPassword) {
        // Show "hide" icon (eye with slash)
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M21 4L3 20"/>
        `;
    } else {
        // Show "show" icon (normal eye)
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    }
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showApiKeyStatus('Please enter an API key.', 'error');
        return;
    }
    
    // Basic validation for OpenAI API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
        showApiKeyStatus('Invalid API key format. OpenAI API keys start with "sk-" and are longer.', 'error');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('openai_api_key', apiKey);
    aiApiKey = apiKey; // Update global variable
    
    showApiKeyStatus('API key saved successfully!', 'success');
    
    // Update AI matching section
    updateAiMatchingSection();
    
    // Clear input and close modal after a delay
    setTimeout(() => {
        closeApiKeyModal();
    }, 1500);
}

function clearApiKey() {
    if (confirm('Are you sure you want to clear your saved API key?')) {
        localStorage.removeItem('openai_api_key');
        aiApiKey = ''; // Clear global variable
        apiKeyInput.value = '';
        
        showApiKeyStatus('API key cleared.', 'success');
        
        // Update AI matching section
        updateAiMatchingSection();
        
        // Close modal after a delay
        setTimeout(() => {
            closeApiKeyModal();
        }, 1500);
    }
}

function showApiKeyStatus(message, type) {
    if (type === 'success') {
        toastManager.success(message);
    } else if (type === 'error') {
        toastManager.error(message);
    } else {
        toastManager.info(message);
    }
}

// Event listeners for API Key modal
apiKeyBtn.addEventListener('click', openApiKeyModal);
closeApiKeyModalBtn.addEventListener('click', closeApiKeyModal);
toggleApiKeyVisibilityBtn.addEventListener('click', toggleApiKeyVisibility);
saveApiKeyBtn.addEventListener('click', saveApiKey);
clearApiKeyBtn.addEventListener('click', clearApiKey);

// Close API Key modal when clicking outside of it
apiKeyModal.addEventListener('click', function(e) {
    if (e.target === apiKeyModal) {
        closeApiKeyModal();
    }
});

// Close CSV Format modal when clicking outside of it
csvFormatModal.addEventListener('click', function(e) {
    if (e.target === csvFormatModal) {
        closeCsvFormatModal();
    }
});

// Add event listeners for search functionality
searchFilter.addEventListener('input', handleSearchFilter);
clearSearchBtn.addEventListener('click', clearSearchFilter);

// Add event listeners for floating selection bar
if (floatingSetRedirect) {
    floatingSetRedirect.addEventListener('click', () => applyActionToSelected('redirect'));
}
if (floatingSetSkip) {
    floatingSetSkip.addEventListener('click', () => applyActionToSelected('skip'));
}
if (floatingExportSelected) {
    floatingExportSelected.addEventListener('click', exportSelectedToCsv);
}
if (floatingClearSelection) {
    floatingClearSelection.addEventListener('click', () => {
        clearAllSelections();
        updateSelectionCount();
        updateSelectionControls();
    });
}

function handleSearchFilter() {
    const searchTerm = searchFilter.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#redirectTableBody tr');
    let visibleCount = 0;
    
    // Update clear button state and visibility
    if (searchTerm === '') {
        clearSearchBtn.style.opacity = '0';
        clearSearchBtn.style.pointerEvents = 'none';
    } else {
        clearSearchBtn.style.opacity = '1';
        clearSearchBtn.style.pointerEvents = 'auto';
    }
    
    rows.forEach(row => {
        const sourceUrl = row.querySelector('td:nth-child(2)').textContent.toLowerCase(); // Source URL column
        const targetInput = row.querySelector('td:nth-child(4) input'); // Target URL input
        const targetUrl = targetInput ? targetInput.value.toLowerCase() : '';
        
        // Check if search term matches source URL or target URL
        const matchesSearch = searchTerm === '' || 
                             sourceUrl.includes(searchTerm) || 
                             targetUrl.includes(searchTerm);
        
        // Apply search filter in combination with existing filter
        const currentFilter = document.querySelector('.filter-btn.active').id.replace('filter', '').replace('Btn', '').toLowerCase();
        const passesCurrentFilter = checkRowAgainstFilter(row, currentFilter);
        
        const shouldShow = matchesSearch && passesCurrentFilter;
        row.style.display = shouldShow ? '' : 'none';
        
        if (shouldShow) {
            visibleCount++;
        }
    });
    
    updateRedirectCount(); // Update count based on visible rows
    updateRowNumbers(); // Update row numbers for visible rows
}

function clearSearchFilter() {
    searchFilter.value = '';
    clearSearchBtn.style.opacity = '0';
    clearSearchBtn.style.pointerEvents = 'none';
    handleSearchFilter(); // Re-apply filters without search term
}

// Helper function to check if a row passes the current filter
function checkRowAgainstFilter(row, filterType) {
    const isSkipped = row.classList.contains('skipped-row');
    const isMapped = row.classList.contains('mapped') || (row.querySelector('input.autocomplete-input') && row.querySelector('input.autocomplete-input').value.trim() !== '');
    const isUnmapped = !isMapped;
    const needsAttention = isUnmapped || row.querySelector('.low-confidence');
    const hasConflict = row.querySelector('.conflict-warning:not(.hidden)');

    switch (filterType) {
        case 'all':
            return true;
        case 'mapped':
            return isMapped && !isSkipped;
        case 'unmapped':
            return isUnmapped && !isSkipped;
        case 'needsattention':
            return needsAttention && !isSkipped;
        case 'skipped':
            return isSkipped;
        case 'conflicts':
            return hasConflict && !isSkipped;
        default:
            return true;
    }
}

// Update the existing applyFilter function to work with search
function applyFilter(filterType) {
    const rows = document.querySelectorAll('#redirectTableBody tr');
    let visibleCount = 0;
    const searchTerm = searchFilter.value.toLowerCase().trim();

    rows.forEach(row => {
        const sourceUrl = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        const targetInput = row.querySelector('td:nth-child(4) input');
        const targetUrl = targetInput ? targetInput.value.toLowerCase() : '';
        
        // Check search filter
        const matchesSearch = searchTerm === '' || 
                             sourceUrl.includes(searchTerm) || 
                             targetUrl.includes(searchTerm);
        
        // Check category filter
        const passesFilter = checkRowAgainstFilter(row, filterType);
        
        const shouldShow = matchesSearch && passesFilter;
        row.style.display = shouldShow ? '' : 'none';
        
        if (shouldShow) {
            visibleCount++;
        }
    });

    // Update active state for filter buttons
    const filterButtons = document.querySelectorAll('.filter-actions .filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Btn`).classList.add('active');
    
    updateRedirectCount(); // Update count based on visible rows
    updateSelectionCount(); // Also update selection count as visibility changes selection context for Ctrl+A
    clearAllSelections(); // Clear selections when filter changes
    updateSelectionControls();
    updateRowNumbers(); // Update row numbers for visible rows
}

// Toggle URL list expansion
function toggleUrlList(listType, dataArray) {
    const listId = listType === 'existingRedirects' ? 'existingRedirectsList' : 
                   listType === 'oldUrls' ? 'oldUrlsList' : 'newUrlsList';
    const list = document.getElementById(listId);
    
    if (list.classList.contains('url-list-compact')) {
        // Expand - show all items
        let allItemsHtml;
        if (listType === 'existingRedirects') {
            allItemsHtml = dataArray.map(redirect => 
                `<div title="${redirect.source} → ${redirect.target}">${redirect.source} → ${redirect.target}</div>`
            ).join('');
        } else {
            allItemsHtml = dataArray.map(url => 
                `<div title="${url.fullUrl}">${url.slug}</div>`
            ).join('');
        }
        
        list.innerHTML = allItemsHtml;
        list.classList.remove('url-list-compact');
        
        // Update button text
        const expandBtn = list.querySelector('.url-list-expand-btn');
        if (expandBtn) {
            expandBtn.textContent = 'Show Less';
            expandBtn.onclick = () => toggleUrlList(listType, dataArray);
        }
    } else {
        // Collapse - show only first 5 items
        const displayItems = dataArray.slice(0, 5);
        let limitedHtml;
        if (listType === 'existingRedirects') {
            limitedHtml = displayItems.map(redirect => 
                `<div title="${redirect.source} → ${redirect.target}">${redirect.source} → ${redirect.target}</div>`
            ).join('');
        } else {
            limitedHtml = displayItems.map(url => 
                `<div title="${url.fullUrl}">${url.slug}</div>`
            ).join('');
        }
        
        const remainingCount = dataArray.length - 5;
        const showMoreHtml = remainingCount > 0 ? 
            `<div class="url-list-more" style="color: var(--muted-foreground); font-style: italic; padding: 0.5rem 0; text-align: center; border-top: 1px solid var(--border);">
                +${remainingCount} more... 
                <button class="url-list-expand-btn" style="background: none; border: none; color: var(--primary); cursor: pointer; text-decoration: underline;">Show All</button>
            </div>` : '';
        
        list.innerHTML = limitedHtml + showMoreHtml;
        list.classList.add('url-list-compact');
        
        // Reattach event listener
        const expandBtn = list.querySelector('.url-list-expand-btn');
        if (expandBtn) {
            expandBtn.onclick = () => toggleUrlList(listType, dataArray);
        }
    }
}

// Open CSV format modal with specific content
function openCsvFormatModal(type) {
    const content = document.getElementById('csvFormatContent');
    
    let htmlContent = '';
    
    if (type === 'old-urls') {
        htmlContent = `
            <p><strong>Your CSV needs a column with URLs. These column names work:</strong></p>
            <ul>
                <li><code>Address</code>, <code>URL</code>, <code>Page</code>, <code>Link</code></li>
                <li>Or any single column with URLs - the tool will detect it automatically</li>
            </ul>
            <p><strong>Example formats that work:</strong></p>
            <div class="csv-example">
                <code>Address,Title 1,Indexability<br>
                https://example.com/old-page,Page Title,Indexable</code>
            </div>
            <div class="csv-example">
                <code>URL<br>
                https://example.com/old-page<br>
                https://example.com/about</code>
            </div>
            <p><small>💡 URLs with 301, 404, or 502 status codes are automatically filtered out.</small></p>
        `;
    } else if (type === 'new-urls') {
        htmlContent = `
            <p><strong>Your CSV needs a column with URLs. These column names work:</strong></p>
            <ul>
                <li><code>URL</code>, <code>Address</code>, <code>Page</code>, <code>Link</code></li>
                <li>Or any single column with URLs - the tool will detect it automatically</li>
            </ul>
            <p><strong>Example formats that work:</strong></p>
            <div class="csv-example">
                <code>URL<br>
                https://newsite.com/<br>
                https://newsite.com/about</code>
            </div>
            <div class="csv-example">
                <code>Address<br>
                https://newsite.com/services<br>
                https://newsite.com/contact</code>
            </div>
        `;
    } else if (type === 'existing-redirects') {
        htmlContent = `
            <p><strong>Your CSV needs 2 columns with URLs:</strong></p>
            <ul>
                <li>Column names like: <code>Source/Target</code>, <code>Old/New</code>, <code>From/To</code></li>
            
            </ul>
            <p><strong>Example formats that work:</strong></p>
            <div class="csv-example">
                <code>Source,Target<br>
                /old-page,/new-page<br>
                /about-old,/about</code>
            </div>
            <div class="csv-example">
                <code>Old URL,New URL<br>
                /products/old,/products/new<br>
                /contact-old,/contact</code>
            </div>
            <p><small>💡 Used to prevent redirect loops and conflicts with your new redirects.</small></p>
        `;
    }
    
    content.innerHTML = htmlContent;
    csvFormatModal.classList.add('show');
}

// Close CSV format modal
function closeCsvFormatModal() {
    csvFormatModal.classList.remove('show');
}

// Step Navigation Functions
function initializeStepNavigation() {
  // Wait for DOM to be ready and check if elements exist
  const nextBtn = document.getElementById('nextStepBtn');
  const prevBtn = document.getElementById('prevStepBtn');
  
  if (!nextBtn || !prevBtn) {
    console.error('Step navigation buttons not found in DOM');
    return;
  }
  
  // Add event listeners
  nextBtn.addEventListener('click', nextStep);
  prevBtn.addEventListener('click', prevStep);
  
  // Add click listeners to step items
  document.querySelectorAll('.step-item').forEach(item => {
    item.addEventListener('click', function() {
      const step = parseInt(this.dataset.step);
      if (canNavigateToStep(step)) {
        showStep(step);
      }
    });
  });
  
  // Set initial step
  showStep(1);
  updateStepNavigation();
  
  // Initialize summary panel
  updateSummaryPanel();
}

function showStep(stepNumber) {
  // Update current step first
  currentStep = stepNumber;
  
  // Hide all step contents
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Show target step content
  const targetContent = document.querySelector(`.step-content[data-step="${stepNumber}"]`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
  
  // Update step navigation
  updateStepNavigation();
  updateNavigationButtons();
  
  // Handle redirect section visibility for step 4
  if (stepNumber === 4) {
    const redirectSection = document.getElementById('redirectSection');
    if (redirectSection && oldUrls.length > 0) {
      redirectSection.classList.remove('hidden');
    }
  }
}

function updateStepNavigation() {
  document.querySelectorAll('.step-item').forEach(item => {
    const stepNum = parseInt(item.dataset.step);
    
    // Remove all state classes
    item.classList.remove('active', 'completed');
    
    // Add appropriate class
    if (stepNum === currentStep) {
      item.classList.add('active');
    } else if (stepNum < currentStep) {
      item.classList.add('completed');
    }
  });
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  
  if (!prevBtn || !nextBtn) {
    console.warn('Navigation buttons not found');
    return;
  }
  
  // Update previous button
  prevBtn.disabled = currentStep === 1;
  
  // Update next button
  if (currentStep === totalSteps) {
    nextBtn.innerHTML = 'Finish <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10-10"/></svg>';
    nextBtn.disabled = !canCompleteProcess();
  } else {
    nextBtn.innerHTML = `Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
    nextBtn.disabled = !canProceedToNextStep();
  }
}

function nextStep() {
  if (currentStep < totalSteps && canProceedToNextStep()) {
    showStep(currentStep + 1);
  } else if (currentStep === totalSteps && canCompleteProcess()) {
    // Handle completion
    exportToCsv();
  }
}

function prevStep() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
}

function canNavigateToStep(stepNumber) {
  // Allow navigation to completed steps or current step
  if (stepNumber <= currentStep) return true;
  
  // Check if previous steps are completed
  switch (stepNumber) {
    case 2:
      return true; // Can always go to step 2
    case 3:
      return oldUrls.length > 0; // Need old URLs to proceed
    case 4:
      return oldUrls.length > 0 && newUrls.length > 0; // Need both URL sets
    default:
      return false;
  }
}

function canProceedToNextStep() {
  switch (currentStep) {
    case 1:
      return true; // Step 1 is optional
    case 2:
      return oldUrls.length > 0; // Need old URLs
    case 3:
      return newUrls.length > 0; // Need new URLs
    case 4:
      return false; // Last step
    default:
      return false;
  }
}

function canCompleteProcess() {
  // Check if there are redirects ready to export
  const rows = Array.from(document.querySelectorAll('#redirectTableBody tr'));
  const hasRedirects = rows.some(row => {
    const actionSelect = row.querySelector('select.status-select');
    const targetInput = row.querySelector('input.autocomplete-input');
    return actionSelect?.value === 'redirect' && targetInput?.value.trim();
  });
  
  return hasRedirects;
}

// Update Summary Panel
function updateSummaryPanel() {
  const totalUrls = oldUrls.length;
  const rows = Array.from(document.querySelectorAll('#redirectTableBody tr'));
  
  let mapped = 0;
  let unmapped = 0;
  let conflicts = 0;
  let skipped = 0;
  
  rows.forEach(row => {
    const targetInput = row.querySelector('input.autocomplete-input');
    const actionSelect = row.querySelector('select.status-select');
    const hasConflict = row.querySelector('.conflict-warning:not(.hidden)');
    
    if (actionSelect?.value === 'skip') {
      skipped++;
    } else if (targetInput?.value.trim()) {
      mapped++;
    } else {
      unmapped++;
    }
    
    if (hasConflict) {
      conflicts++;
    }
  });
  
  // Update summary display - safely check if elements exist
  const totalElement = document.getElementById('totalUrlsCount');
  const mappedElement = document.getElementById('mappedCount');
  const unmappedElement = document.getElementById('unmappedCount');
  const conflictsElement = document.getElementById('conflictsCount');
  const skippedElement = document.getElementById('skippedCount');
  const excludedElement = document.getElementById('excludedCount');
  
  if (totalElement) totalElement.textContent = totalUrls;
  if (mappedElement) mappedElement.textContent = mapped;
  if (unmappedElement) unmappedElement.textContent = unmapped;
  if (conflictsElement) conflictsElement.textContent = conflicts;
  if (skippedElement) skippedElement.textContent = skipped;
  if (excludedElement) excludedElement.textContent = excludedFromExistingCount;
  
  // Only update navigation buttons if step navigation is initialized
  if (typeof currentStep !== 'undefined') {
    updateNavigationButtons();
  }
}

// Auto-advance logic
function autoAdvanceStep() {
  // Auto-advance from step 2 when old URLs are loaded
  if (currentStep === 2 && oldUrls.length > 0) {
    setTimeout(() => {
      if (currentStep === 2) { // Still on step 2
        showStep(3);
      }
    }, 1000);
  }
  
  // Auto-advance from step 3 when new URLs are loaded
  if (currentStep === 3 && newUrls.length > 0 && oldUrls.length > 0) {
    setTimeout(() => {
      if (currentStep === 3) { // Still on step 3
        showStep(4);
      }
    }, 1000);
  }
}

