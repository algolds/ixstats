#!/usr/bin/env node
// scripts/update-flag-cache.js
// Monthly flag cache update script for cron jobs

import https from 'https';
import http from 'http';

// Type definitions
/**
 * @typedef {Object} RequestOptions
 * @property {number} [timeout] - Request timeout in milliseconds
 * @property {string} [method] - HTTP method
 * @property {any} [headers] - HTTP headers
 * @property {string} [body] - Request body
 */

/**
 * @typedef {Object} HttpResponse
 * @property {number} status - HTTP status code
 * @property {any} data - Response data
 * @property {any} headers - Response headers
 */

/**
 * @typedef {Object} FlagCacheStatus
 * @property {any} flagCache - Flag cache statistics
 * @property {any} mediaWiki - MediaWiki service statistics
 */

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiEndpoint: '/api/flag-cache',
  timeout: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
};

// Logging utility
/**
 * @param {any} message - Log message
 * @param {string} level - Log level
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// HTTP request utility
/**
 * @param {string} url - The URL to request
 * @param {RequestOptions} options - Request options
 * @returns {Promise<HttpResponse>}
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      timeout: CONFIG.timeout,
      ...options,
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode || 0,
            data: jsonData,
            headers: res.headers,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Retry utility
/**
 * @param {Function} fn - Function to retry
 * @param {number} attempts - Number of retry attempts
 * @returns {Promise<any>}
 */
async function retry(fn, attempts = CONFIG.retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`Attempt ${i + 1} failed: ${errorMessage}`, 'WARN');
      log(`Retrying in ${CONFIG.retryDelay}ms...`, 'INFO');
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
    }
  }
}

// Get cache status
/**
 * @returns {Promise<FlagCacheStatus>}
 */
async function getCacheStatus() {
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=status`;
  
  log('Fetching cache status...');
  const response = await makeRequest(url);
  
  if (response.status !== 200) {
    const errorMsg = response.data && response.data.error ? response.data.error : 'Unknown error';
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }
  
  return response.data;
}

// Initialize cache
/**
 * @returns {Promise<any>}
 */
async function initializeCache() {
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=initialize`;
  
  log('Initializing flag cache...');
  const response = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (response.status !== 200) {
    const errorMsg = response.data && response.data.error ? response.data.error : 'Unknown error';
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }
  
  return response.data;
}

// Update all flags
/**
 * @returns {Promise<any>}
 */
async function updateAllFlags() {
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=update`;
  
  log('Updating all flags...');
  const response = await makeRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ countries: [] }), // Empty array means all countries
  });
  
  if (response.status !== 200) {
    const errorMsg = response.data && response.data.error ? response.data.error : 'Unknown error';
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }
  
  return response.data;
}

// Wait for update to complete
/**
 * @param {number} maxWaitTime - Maximum wait time in milliseconds
 * @returns {Promise<FlagCacheStatus>}
 */
async function waitForUpdate(maxWaitTime = 600000) { // 10 minutes
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await getCacheStatus();
      
      if (!status.flagCache.isUpdating) {
        log('Update completed');
        return status;
      }
      
      const progress = status.flagCache.updateProgress;
      log(`Update in progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
      
      // Wait 30 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`Error checking update status: ${errorMessage}`, 'WARN');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  throw new Error('Update timeout - exceeded maximum wait time');
}

// Main execution function
async function main() {
  const startTime = Date.now();
  
  try {
    log('Starting monthly flag cache update');
    
    // Check current status
    const initialStatus = await retry(() => getCacheStatus());
    const flagCache = initialStatus.flagCache;
    log(`Initial status: ${flagCache.cachedFlags}/${flagCache.totalCountries} flags cached`);
    
    // Check if update is needed
    if (flagCache.shouldUpdate) {
      log('Update needed, proceeding with flag cache update');
      
      // Initialize cache if needed
      if (flagCache.totalCountries === 0) {
        await retry(() => initializeCache());
        log('Cache initialized');
      }
      
      // Update all flags
      await retry(() => updateAllFlags());
      log('Update started, waiting for completion...');
      
      // Wait for update to complete
      const finalStatus = await waitForUpdate();
      const finalFlagCache = finalStatus.flagCache;
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      log(`Update completed in ${duration} seconds`);
      log(`Final status: ${finalFlagCache.cachedFlags}/${finalFlagCache.totalCountries} flags cached`);
      log(`Failed flags: ${finalFlagCache.failedFlags}`);
      
      // Exit with error code if there are failed flags
      if (finalFlagCache.failedFlags > 0) {
        log(`${finalFlagCache.failedFlags} flags failed to load`, 'WARN');
        process.exit(1);
      }
      
    } else {
      log('No update needed, cache is up to date');
    }
    
    log('Monthly flag cache update completed successfully');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
    log(`Fatal error: ${errorMessage}`, 'ERROR');
    log(`Stack trace: ${errorStack}`, 'ERROR');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    retry(() => getCacheStatus())
      .then(status => {
        console.log(JSON.stringify(status, null, 2));
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`Error: ${errorMessage}`, 'ERROR');
        process.exit(1);
      });
    break;
    
  case 'update':
    main();
    break;
    
  case 'init':
    retry(() => initializeCache())
      .then(result => {
        log('Cache initialized successfully');
        console.log(JSON.stringify(result, null, 2));
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`Error: ${errorMessage}`, 'ERROR');
        process.exit(1);
      });
    break;
    
  default:
    console.log(`
Flag Cache Update Script

Usage:
  node scripts/update-flag-cache.js <command>

Commands:
  status    - Get current cache status
  update    - Run monthly update (default)
  init      - Initialize cache

Environment Variables:
  NEXT_PUBLIC_APP_URL - Base URL of the application (default: http://localhost:3000)

Examples:
  node scripts/update-flag-cache.js status
  node scripts/update-flag-cache.js update
  NEXT_PUBLIC_APP_URL=https://stats.ixwiki.com node scripts/update-flag-cache.js update
`);
    process.exit(0);
} 