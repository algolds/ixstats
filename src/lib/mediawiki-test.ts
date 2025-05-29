// src/lib/mediawiki-test.ts
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
  static async testFlag(countryName: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const flagUrl = await ixnayWiki.getFlagUrl(countryName);
      const duration = Date.now() - start;
      
      return {
        success: !!flagUrl,
        data: { flagUrl, countryName },
        error: !flagUrl ? 'No flag found' : undefined,
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
  static async testInfobox(countryName: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const infobox = await ixnayWiki.getCountryInfobox(countryName);
      const duration = Date.now() - start;
      
      return {
        success: !!infobox,
        data: infobox,
        error: !infobox ? 'No infobox found' : undefined,
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
   * Test template retrieval
   */
  static async testTemplate(templateName: string): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const response = await fetch(`/api/mediawiki?action=parse&page=Template:${templateName}&prop=wikitext&format=json`);
      const data = await response.json();
      const duration = Date.now() - start;
      
      if (data.error) {
        return {
          success: false,
          error: `Template Error: ${data.error.code} - ${data.error.info}`,
          duration
        };
      }
      
      return {
        success: !!data.parse?.wikitext,
        data: data.parse,
        error: !data.parse?.wikitext ? 'Template not found or empty' : undefined,
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
   * Run comprehensive tests
   */
  static async runFullTest(testCountries: string[] = ['Caphiria', 'Tierrador']): Promise<{
    connection: TestResult;
    countries: Array<{
      name: string;
      flag: TestResult;
      infobox: TestResult;
      template: TestResult;
    }>;
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      averageDuration: number;
    };
  }> {
    console.log('[MediaWiki Test] Starting comprehensive test...');
    
    // Test connection
    const connection = await this.testConnection();
    
    // Test countries
    const countryResults = [];
    let totalDuration = 0;
    let totalTests = 1; // Connection test
    let passed = connection.success ? 1 : 0;
    
    for (const country of testCountries) {
      console.log(`[MediaWiki Test] Testing country: ${country}`);
      
      const flag = await this.testFlag(country);
      const infobox = await this.testInfobox(country);
      const template = await this.testTemplate(`Country_data_${country}`);
      
      countryResults.push({
        name: country,
        flag,
        infobox,
        template
      });
      
      totalDuration += flag.duration + infobox.duration + template.duration;
      totalTests += 3;
      passed += (flag.success ? 1 : 0) + (infobox.success ? 1 : 0) + (template.success ? 1 : 0);
      
      // Small delay between countries
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const results = {
      connection,
      countries: countryResults,
      summary: {
        totalTests,
        passed,
        failed: totalTests - passed,
        averageDuration: Math.round((totalDuration + connection.duration) / totalTests)
      }
    };
    
    console.log('[MediaWiki Test] Test complete:', results.summary);
    return results;
  }

  /**
   * Generate test report
   */
  static generateReport(results: Awaited<ReturnType<typeof MediaWikiTester.runFullTest>>): string {
    let report = 'MediaWiki Integration Test Report\n';
    report += '=====================================\n\n';
    
    // Summary
    report += `Summary:\n`;
    report += `- Total Tests: ${results.summary.totalTests}\n`;
    report += `- Passed: ${results.summary.passed}\n`;
    report += `- Failed: ${results.summary.failed}\n`;
    report += `- Success Rate: ${Math.round((results.summary.passed / results.summary.totalTests) * 100)}%\n`;
    report += `- Average Duration: ${results.summary.averageDuration}ms\n\n`;
    
    // Connection test
    report += `Connection Test:\n`;
    report += `- Status: ${results.connection.success ? 'PASS' : 'FAIL'}\n`;
    report += `- Duration: ${results.connection.duration}ms\n`;
    if (results.connection.error) {
      report += `- Error: ${results.connection.error}\n`;
    }
    report += '\n';
    
    // Country tests
    results.countries.forEach(country => {
      report += `Country: ${country.name}\n`;
      report += `- Flag: ${country.flag.success ? 'PASS' : 'FAIL'} (${country.flag.duration}ms)`;
      if (country.flag.error) report += ` - ${country.flag.error}`;
      report += '\n';
      
      report += `- Infobox: ${country.infobox.success ? 'PASS' : 'FAIL'} (${country.infobox.duration}ms)`;
      if (country.infobox.error) report += ` - ${country.infobox.error}`;
      report += '\n';
      
      report += `- Template: ${country.template.success ? 'PASS' : 'FAIL'} (${country.template.duration}ms)`;
      if (country.template.error) report += ` - ${country.template.error}`;
      report += '\n\n';
    });
    
    return report;
  }
}

// Development utility - run tests from browser console
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testMediaWiki = async (countries?: string[]) => {
    const results = await MediaWikiTester.runFullTest(countries);
    const report = MediaWikiTester.generateReport(results);
    console.log(report);
    return results;
  };
}