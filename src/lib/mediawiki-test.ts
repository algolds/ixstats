// src/lib/mediawiki-test.ts
// Test utilities for MediaWiki service functionality

import { ixnayWiki } from './mediawiki-service';

/**
 * Test utility for MediaWiki integration
 * Use this to test and debug MediaWiki API calls
 */

export interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export class MediaWikiTester {
  /**
   * Test basic API connectivity
   */
  static async testConnection(): Promise<TestResult> {
    const start = Date.now();
    
    try {
      // Test with a simple page request
      const response = await fetch('/api/mediawiki?action=query&meta=siteinfo&format=json');
      const data = await response.json();
      
      const duration = Date.now() - start;
      
      if (data.error) {
        return {
          success: false,
          error: `API Error: ${data.error.code} - ${data.error.message}`,
          duration
        };
      }
      
      return {
        success: true,
        data: data.query?.general,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
   * Test flag retrieval for a country
   */
  static async testFlagRetrieval(countryName: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const flagUrl = await ixnayWiki.getFlagUrl(countryName);
      const duration = Date.now() - start;
      
      return {
        success: !!flagUrl,
        data: { flagUrl },
        error: !flagUrl ? 'No flag URL found' : undefined,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
   * Test infobox retrieval for a country
   */
  static async testInfoboxRetrieval(countryName: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const infobox = await ixnayWiki.getCountryInfobox(countryName);
      const duration = Date.now() - start;
      
      return {
        success: !!infobox,
        data: { 
          infobox, 
          fieldCount: infobox ? Object.keys(infobox).length : 0,
          hasCapital: !!(infobox?.capital),
          hasGovernment: !!(infobox?.government),
          hasLanguages: !!(infobox?.languages || infobox?.official_languages)
        },
        error: !infobox ? 'No infobox data found' : undefined,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
   * Test wikitext cleaning functionality
   */
  static testWikitextCleaning(): TestResult {
    const start = Date.now();
    
    try {
      // Access the private cleanWikitext method through reflection
      const service = ixnayWiki as any;
      
      const testCases = [
        {
          input: "'''Bold text''' and ''italic text''",
          expected: '<strong class="font-bold">Bold text</strong> and <em class="italic">italic text</em>'
        },
        {
          input: "[[Country Name|Display Name]]",
          expected: '<a href="https://ixwiki.com/wiki/Country Name" target="_blank" rel="noopener noreferrer" style="color: #429284;" class="hover:underline">Display Name</a>'
        },
        {
          input: "{{convert|100|km|mi}}",
          expected: '100 km'
        },
        {
          input: "{{flag|United States}}",
          expected: '🏴 United States'
        }
      ];

      let passedTests = 0;
      const results = [];

      for (const testCase of testCases) {
        try {
          const result = service.cleanWikitext ? service.cleanWikitext(testCase.input) : 'Method not accessible';
          const passed = result.includes(testCase.expected) || result === testCase.expected;
          if (passed) passedTests++;
          
          results.push({
            input: testCase.input,
            expected: testCase.expected,
            actual: result,
            passed
          });
        } catch (error) {
          results.push({
            input: testCase.input,
            expected: testCase.expected,
            actual: `Error: ${error}`,
            passed: false
          });
        }
      }

      const duration = Date.now() - start;
      
      return {
        success: passedTests === testCases.length,
        data: { 
          totalTests: testCases.length,
          passedTests,
          results
        },
        error: passedTests < testCases.length ? `${testCases.length - passedTests} test(s) failed` : undefined,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
   * Test cache functionality
   */
  static testCacheStats(): TestResult {
    const start = Date.now();
    
    try {
      const stats = ixnayWiki.getCacheStats();
      const duration = Date.now() - start;
      
      return {
        success: true,
        data: stats,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
   * Test preloading functionality
   */
  static async testPreloading(countryNames: string[]): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const initialStats = ixnayWiki.getCacheStats();
      
      await ixnayWiki.preloadCountryFlags(countryNames);
      
      const finalStats = ixnayWiki.getCacheStats();
      const duration = Date.now() - start;
      
      return {
        success: finalStats.flags >= initialStats.flags,
        data: {
          initialStats,
          finalStats,
          improvement: finalStats.flags - initialStats.flags,
          countryCount: countryNames.length
        },
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }

  /**
  /**
  /**
   * Run comprehensive test suite
   */
  static async runTestSuite(testCountries: string[] = ['Caphiria', 'Burgundie', 'Urcea']): Promise<{
    overall: boolean;
    results: Record<string, TestResult>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      totalDuration: number;
    };
  }> {
    const results: Record<string, TestResult> = {};
    let totalDuration = 0;

    console.log('[MediaWiki Test] Starting comprehensive test suite...');

    // Test cache stats
    console.log('[MediaWiki Test] Testing cache stats...');
    results.cacheStats = this.testCacheStats();
    totalDuration += results.cacheStats.duration;

    // Test wikitext cleaning
    console.log('[MediaWiki Test] Testing wikitext cleaning...');
    results.wikitextCleaning = this.testWikitextCleaning();
    totalDuration += results.wikitextCleaning.duration;

    // Test flag retrieval
    for (const country of testCountries) {
      console.log(`[MediaWiki Test] Testing flag retrieval for ${country}...`);
      const flagResult = await this.testFlagRetrieval(country);
      results[`flag_${country}`] = flagResult;
      totalDuration += flagResult?.duration ?? 0;
    }

    // Test infobox retrieval  
    for (const country of testCountries) {
      console.log(`[MediaWiki Test] Testing infobox retrieval for ${country}...`);
      const infoboxResult = await this.testInfoboxRetrieval(country);
      results[`infobox_${country}`] = infoboxResult;
      totalDuration += infoboxResult?.duration ?? 0;

    // Test preloading
    console.log('[MediaWiki Test] Testing preloading functionality...');
    results.preloading = await this.testPreloading(testCountries);
    totalDuration += results.preloading.duration;

    // Calculate summary
    const testResults = Object.values(results);
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.length - passed;
    const overall = failed === 0;

    const summary = {
      total: testResults.length,
      passed,
      failed,
      totalDuration
    };

    console.log(`[MediaWiki Test] Test suite completed: ${passed}/${testResults.length} passed in ${totalDuration}ms`);

    return {
      overall,
      results,
      summary
    };
  }

  /**
   * Test specific wikitext parsing scenarios
   */
  static testComplexWikitext(): TestResult {
    const start = Date.now();
    
    try {
      const service = ixnayWiki as any;
      
      const complexCases = [
        {
          name: 'Nested templates',
          input: "{{convert|{{#expr:100*2}}|km|mi}}",
          shouldContain: ['200', 'km']
        },
        {
          name: 'Multiple formatting',
          input: "'''Bold''' and ''italic'' with [[Link|text]]",
          shouldContain: ['<strong', '<em', '<a href']
        },
        {
          name: 'Template with parameters',
          input: "{{lang|fr|République française}}",
          shouldContain: ['République française']
        },
        {
          name: 'Flag template',
          input: "{{flagicon|France}} France",
          shouldContain: ['🏴', 'France']
        }
      ];

      let passedTests = 0;
      const results = [];

      for (const testCase of complexCases) {
        try {
          const result = service.cleanWikitext ? service.cleanWikitext(testCase.input) : 'Method not accessible';
          const passed = testCase.shouldContain.every(item => result.includes(item));
          if (passed) passedTests++;
          
          results.push({
            name: testCase.name,
            input: testCase.input,
            shouldContain: testCase.shouldContain,
            actual: result,
            passed
          });
        } catch (error) {
          results.push({
            name: testCase.name,
            input: testCase.input,
            shouldContain: testCase.shouldContain,
            actual: `Error: ${error}`,
            passed: false
          });
        }
      }

      const duration = Date.now() - start;
      
      return {
        success: passedTests === complexCases.length,
        data: { 
          totalTests: complexCases.length,
          passedTests,
          results
        },
        error: passedTests < complexCases.length ? `${complexCases.length - passedTests} complex test(s) failed` : undefined,
        duration
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      };
    }
  }
}

// Export test utilities for use in development
export const testMediaWiki = {
  flagRetrieval: MediaWikiTester.testFlagRetrieval,
  infoboxRetrieval: MediaWikiTester.testInfoboxRetrieval,
  wikitextCleaning: MediaWikiTester.testWikitextCleaning,
  cacheStats: MediaWikiTester.testCacheStats,
  preloading: MediaWikiTester.testPreloading,
  runSuite: MediaWikiTester.runTestSuite,
  complexWikitext: MediaWikiTester.testComplexWikitext
};

// Development helper to run tests in browser console
if (typeof window !== 'undefined') {
  (window as any).testMediaWiki = testMediaWiki;
}