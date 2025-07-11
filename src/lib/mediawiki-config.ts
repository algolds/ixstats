// src/lib/mediawiki-config.ts
import { env } from "~/env";

export interface MediaWikiConfig {
  baseUrl: string;
  apiEndpoint: string;
  userAgent: string;
  timeout: number;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  cache: {
    infoboxTtl: number;
    flagTtl: number;
    templateTtl: number;
    pageTtl: number;
    maxSize: number;
  };
  retry: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

export const MEDIAWIKI_CONFIG: MediaWikiConfig = {
  baseUrl: env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com',
  apiEndpoint: '/api.php',
  userAgent: 'IxStats/1.0 (https://stats.ixwiki.com; contact@ixstats.com)',
  timeout: 10000, // 10 seconds
  
  rateLimit: {
    maxRequests: 90,
    windowMs: 60 * 1000, // 1 minute
  },
  
  cache: {
    infoboxTtl: 24 * 60 * 60 * 1000, // 24 hours
    flagTtl: 30 * 24 * 60 * 60 * 1000, // 30 days - flags rarely change
    templateTtl: 24 * 60 * 60 * 1000, // 24 hours
    pageTtl: 6 * 60 * 60 * 1000, // 6 hours
    maxSize: 1000, // Max cache entries
  },
  
  retry: {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 5000, // 5 seconds
  },
};

// Common country name variations and their canonical forms
export const COUNTRY_NAME_MAPPINGS: Record<string, string> = {
  // Add variations here as needed, e.g.:
  // 'United States': 'United States of America',
  // 'UK': 'United Kingdom',
  // 'Cappy': 'Caphiria',
};

// Common template patterns for different data types
export const TEMPLATE_PATTERNS = {
  countryData: 'Template:Country_data_{name}',
  infobox: 'Template:Infobox_country',
  flag: [
    'Flag3 {name}.png',
    'Flag_of_{name}.svg',
    'Flag_of_{name}.png',
    '{name}_flag.svg',
    '{name}_flag.png',
    'Flag_{name}.svg',
    'Flag_{name}.png',
    'Flag {name}.svg',
    'Flag {name}.png',
  ],
};

// MediaWiki API parameter sets for different operations
export const API_PARAMS = {
  parseWikitext: {
    action: 'parse',
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
  },
  parseHtml: {
    action: 'parse',
    prop: 'text',
    format: 'json',
    formatversion: '2',
  },
  queryRevisions: {
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
  },
  queryRevisionsSection: {
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvsection: '0', // Get only section 0 (intro section with infobox)
    format: 'json',
    formatversion: '2',
  },
  queryImages: {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
    formatversion: '2',
  },
  siteInfo: {
    action: 'query',
    meta: 'siteinfo',
    format: 'json',
    formatversion: '2',
  },
} as const;

// Validation helpers
export function validateCountryName(name: string): string {
  if (!name?.trim()) {
    throw new Error('Country name cannot be empty');
  }
  
  // Check for mapped name
  const mappedName = COUNTRY_NAME_MAPPINGS[name] || name;
  
  // Basic sanitization
  return mappedName.trim();
}

export function sanitizePageName(pageName: string): string {
  return pageName
    .replace(/ /g, '_')
    .replace(/[^\w\-_.()]/g, '')
    .trim();
}

export function buildApiUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(`${baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`);
  
  // Add default parameters
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');
  
  // Add custom parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  return url.toString();
}

// Cache key generators
export function generateCacheKey(type: string, identifier: string, ...args: string[]): string {
  const parts = [type, identifier.toLowerCase(), ...args.map(arg => arg.toLowerCase())];
  return parts.join('_').replace(/[^a-z0-9_]/g, '');
}

// Error handling helpers
export function isMediaWikiError(error: any): error is { code: string; info: string } {
  return error && typeof error === 'object' && 'code' in error && 'info' in error;
}

export function createMediaWikiError(code: string, message: string): Error {
  const error = new Error(`MediaWiki API Error: ${code} - ${message}`);
  error.name = 'MediaWikiError';
  return error;
}

// Development helpers
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Export commonly used combinations
export const COMMON_API_CALLS = {
  getPageWikitext: (pageName: string) => ({
    ...API_PARAMS.parseWikitext,
    page: sanitizePageName(pageName),
  }),
  
  getPageWikitextSection: (pageName: string) => ({
    ...API_PARAMS.queryRevisionsSection,
    titles: sanitizePageName(pageName),
  }),
  
  getPageHtml: (pageName: string) => ({
    ...API_PARAMS.parseHtml,
    page: sanitizePageName(pageName),
  }),
  
  getTemplate: (templateName: string) => ({
    ...API_PARAMS.parseWikitext,
    page: templateName.startsWith('Template:') ? templateName : `Template:${templateName}`,
  }),
  
  getFileInfo: (fileName: string) => ({
    ...API_PARAMS.queryImages,
    titles: fileName.startsWith('File:') ? fileName : `File:${fileName}`,
  }),
} as const;