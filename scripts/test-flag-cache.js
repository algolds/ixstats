#!/usr/bin/env node
// scripts/test-flag-cache.js
// Test script for the flag cache system

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

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiEndpoint: '/api/flag-cache',
  timeout: 30000, // 30 seconds for testing
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * @param {any} message - Log message
 * @param {string} level - Log level
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const color = level === 'ERROR' ? colors.red : 
                level === 'WARN' ? colors.yellow : 
                level === 'SUCCESS' ? colors.green : colors.blue;
  console.log(`${color}[${timestamp}] [${level}]${colors.reset} ${message}`);
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

// Test functions
async function testStatus() {
  log('Testing status endpoint...');
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=status`;
  
  try {
    const response = await makeRequest(url);
    
    if (response.status === 200) {
      log('✓ Status endpoint working', 'SUCCESS');
      log(`Flag cache stats: ${response.data.flagCache.cachedFlags}/${response.data.flagCache.totalCountries} flags cached`);
      return true;
    } else {
      log(`✗ Status endpoint failed with status ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`✗ Status endpoint error: ${errorMessage}`, 'ERROR');
    return false;
  }
}

async function testInitialize() {
  log('Testing initialize endpoint...');
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=initialize`;
  
  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 200) {
      log('✓ Initialize endpoint working', 'SUCCESS');
      log(`Initialized with ${response.data.countryCount} countries`);
      return true;
    } else {
      log(`✗ Initialize endpoint failed with status ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`✗ Initialize endpoint error: ${errorMessage}`, 'ERROR');
    return false;
  }
}

async function testUpdate() {
  log('Testing update endpoint...');
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=update`;
  
  try {
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ countries: [] }),
    });
    
    if (response.status === 200) {
      log('✓ Update endpoint working', 'SUCCESS');
      return true;
    } else {
      log(`✗ Update endpoint failed with status ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`✗ Update endpoint error: ${errorMessage}`, 'ERROR');
    return false;
  }
}

async function testClear() {
  log('Testing clear endpoint...');
  const url = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}?action=clear`;
  
  try {
    const response = await makeRequest(url, {
      method: 'DELETE',
    });
    
    if (response.status === 200) {
      log('✓ Clear endpoint working', 'SUCCESS');
      return true;
    } else {
      log(`✗ Clear endpoint failed with status ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`✗ Clear endpoint error: ${errorMessage}`, 'ERROR');
    return false;
  }
}

async function testMediaWikiService() {
  log('Testing MediaWiki service integration...');
  const url = `${CONFIG.baseUrl}/api/mediawiki?action=query&prop=revisions&rvprop=content&titles=United_States&format=json&formatversion=2`;
  
  try {
    const response = await makeRequest(url);
    
    if (response.status === 200) {
      log('✓ MediaWiki service working', 'SUCCESS');
      return true;
    } else {
      log(`✗ MediaWiki service failed with status ${response.status}`, 'ERROR');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`✗ MediaWiki service error: ${errorMessage}`, 'ERROR');
    return false;
  }
}

// Main test function
async function runTests() {
  log('Starting flag cache system tests...', 'INFO');
  log(`Testing against: ${CONFIG.baseUrl}`, 'INFO');
  
  const results = {
    status: false,
    initialize: false,
    update: false,
    clear: false,
    mediawiki: false,
  };
  
  try {
    // Test MediaWiki service first
    results.mediawiki = await testMediaWikiService();
    
    // Test status endpoint
    results.status = await testStatus();
    
    // Test clear endpoint
    results.clear = await testClear();
    
    // Test initialize endpoint
    results.initialize = await testInitialize();
    
    // Test update endpoint
    results.update = await testUpdate();
    
    // Final status check
    await testStatus();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Test suite error: ${errorMessage}`, 'ERROR');
  }
  
  // Summary
  log('\n=== Test Results ===', 'INFO');
  log(`MediaWiki Service: ${results.mediawiki ? '✓ PASS' : '✗ FAIL'}`, results.mediawiki ? 'SUCCESS' : 'ERROR');
  log(`Status Endpoint: ${results.status ? '✓ PASS' : '✗ FAIL'}`, results.status ? 'SUCCESS' : 'ERROR');
  log(`Clear Endpoint: ${results.clear ? '✓ PASS' : '✗ FAIL'}`, results.clear ? 'SUCCESS' : 'ERROR');
  log(`Initialize Endpoint: ${results.initialize ? '✓ PASS' : '✗ FAIL'}`, results.initialize ? 'SUCCESS' : 'ERROR');
  log(`Update Endpoint: ${results.update ? '✓ PASS' : '✗ FAIL'}`, results.update ? 'SUCCESS' : 'ERROR');
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  log(`\nOverall: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'SUCCESS' : 'WARN');
  
  if (passedTests === totalTests) {
    log('🎉 All tests passed! Flag cache system is working correctly.', 'SUCCESS');
    process.exit(0);
  } else {
    log('⚠️  Some tests failed. Please check the configuration and try again.', 'WARN');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    testStatus().then(success => process.exit(success ? 0 : 1));
    break;
    
  case 'init':
    testInitialize().then(success => process.exit(success ? 0 : 1));
    break;
    
  case 'update':
    testUpdate().then(success => process.exit(success ? 0 : 1));
    break;
    
  case 'clear':
    testClear().then(success => process.exit(success ? 0 : 1));
    break;
    
  case 'mediawiki':
    testMediaWikiService().then(success => process.exit(success ? 0 : 1));
    break;
    
  case 'all':
  default:
    runTests();
    break;
} 