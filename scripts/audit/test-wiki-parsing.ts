#!/usr/bin/env tsx
/**
 * Test script to verify wiki intro parsing for all countries
 * Tests that wikitext is properly cleaned and formatted
 */

import https from 'https';

// All countries from database
const TEST_COUNTRIES = [
  'Alba Concordia', 'Algosh Republic', 'Almadaria', 'Alstin', 'Ardmore', 'Argyrea',
  'Arona', 'Asteria', 'Avonia', 'Battganuur', 'Bulkh', 'Burgundie', 'Caergwynn',
  'Caldera', 'Canespa', 'Canpei', 'Caphiria', 'Caracua', 'Cartadania', 'Castadilla',
  'Ceylonia', 'Chakailan', 'Chenango Confederacy', 'Copake', 'Daxia', 'East Arctic Mandate',
  'Faneria', 'Fiannria', 'Hendalarsk', 'Hollona and Diorisia', 'Housatonic', 'Huoxia',
  'International Nature Preserve', 'Istrenya', 'Kabasa', 'Kandara', 'Kelekona', 'Kiravia',
  'Kuronia', 'Lapody', 'Lariana', 'Lucrecia', 'Malentina', 'Mandatory Venua\'tino',
  'Mehristan', 'Metzetta', 'Mid-Atrassic States', 'Netansett', 'New Archduchy', 'New Harren',
  'New Veltorina', 'Olmeria', 'Oyashima', 'Papal State', 'Paulastra', 'Pelaxia', 'Porlos',
  'Pukhgundi', 'Pursat', 'Quetzenkel', 'Rhotia', 'Rusana', 'Slaconia', 'Soleylib',
  'Takatta Loa', 'Tapakdore', 'The Cape', 'Thervala', 'Tierrador', 'Timbia', 'Umardwal',
  'Urcea', 'Vallejar', 'Varshan', 'Volonia', 'Yanuban', 'Yonderre', 'Zaclaria'
];

interface TestResult {
  country: string;
  success: boolean;
  issues: string[];
  paragraphCount: number;
  sampleText: string;
}

/**
 * Fetch wikitext from IxWiki API
 */
async function fetchWikitext(countryName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://ixwiki.com/w/api.php?action=query&prop=revisions&rvprop=content&titles=${encodeURIComponent(countryName)}&rvsection=0&format=json&formatversion=2`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.query.pages[0]?.revisions?.[0]?.content;
          if (!content) {
            reject(new Error(`No content found for ${countryName}`));
            return;
          }
          resolve(content);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Extract infobox template from wikitext
 */
function extractInfoboxTemplate(wikitext: string): string | null {
  const infoboxStart = wikitext.indexOf('{{Infobox');
  if (infoboxStart === -1) return null;

  let braceDepth = 0;
  let infoboxEnd = -1;

  for (let i = infoboxStart; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      braceDepth++;
      i++;
    } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        infoboxEnd = i + 2;
        break;
      }
      i++;
    }
  }

  if (infoboxEnd === -1) return null;
  return wikitext.substring(infoboxStart, infoboxEnd);
}

/**
 * Process wikitext using the same logic as the country profile page
 */
function processWikitext(wikitext: string): string[] {
  // Extract infobox
  const infoboxTemplate = extractInfoboxTemplate(wikitext);

  // Get content after infobox
  let contentAfterInfobox = wikitext;
  if (infoboxTemplate) {
    const infoboxIndex = wikitext.indexOf(infoboxTemplate);
    if (infoboxIndex !== -1) {
      contentAfterInfobox = wikitext.substring(infoboxIndex + infoboxTemplate.length).trim();
    }
  }

  // Extract content before first heading
  const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

  // Clean wikitext - extract template content
  let cleanContent = beforeFirstHeading
    // Process common templates to extract their display text
    .replace(/\{\{wp\|[^\|\}]+\|([^\}]+)\}\}/g, '$1')
    .replace(/\{\{wp\|([^\}]+)\}\}/g, '$1')
    .replace(/\{\{lang\|[^\|]+\|([^\}]+)\}\}/g, '$1')
    .replace(/\{\{nowrap\|([^\}]+)\}\}/g, '$1')
    .replace(/\{\{convert[^\}]*\}\}/gi, '')
    .replace(/\{\{[^\}]+\|([^\|\}]+)\}\}/g, '$1')
    .replace(/\{\{[^\}]+\}\}/g, '')
    .replace(/\[\[Template:[^\]]*\]\]/gi, '')
    .replace(/\[\[Category:[^\]]*\]\]/gi, '')
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/\[\[Image:[^\]]*\]\]/gi, '')
    .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, '')
    .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<!--.*?-->/gs, '')
    .replace(/\{\|.*?\|\}/gs, '')
    .replace(/__[A-Z_]+__/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Process wikilinks and formatting
  const processedContent = cleanContent
    .replace(/\[\[([^\[\]\|]+)\|([^\[\]]+?)\]\]/g, (_, page, display) => {
      if (page.toLowerCase().includes('template:')) return '';
      return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}">${display}</a>`;
    })
    .replace(/\[\[([^\[\]]+?)\]\]/g, (_, page) => {
      if (page.toLowerCase().includes('template:')) return '';
      return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(page)}">${page}</a>`;
    })
    .replace(/\[([^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1">$2</a>')
    .replace(/'''([^']+?)'''/g, '<strong>$1</strong>')
    .replace(/''([^']+?)''/g, '<em>$1</em>');

  // Split into paragraphs
  const paragraphs = processedContent
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 50)
    .slice(0, 3);

  return paragraphs;
}

/**
 * Test a single country
 */
async function testCountry(countryName: string): Promise<TestResult> {
  const issues: string[] = [];

  try {
    console.log(`\n🔍 Testing ${countryName}...`);

    const wikitext = await fetchWikitext(countryName);

    // Check for redirect pages
    if (wikitext.trim().startsWith('#REDIRECT')) {
      console.log(`⚠️  ${countryName}: REDIRECT PAGE (skipped)`);
      return {
        country: countryName,
        success: true,
        issues: ['Redirect page - skipped'],
        paragraphCount: 0,
        sampleText: 'Redirect page',
      };
    }

    const paragraphs = processWikitext(wikitext);

    // Check for issues
    if (paragraphs.length === 0) {
      // Check if page has no infobox (like stub pages)
      if (!wikitext.includes('{{Infobox')) {
        issues.push('No infobox found (likely stub page)');
      } else {
        issues.push('No paragraphs extracted');
      }
    }

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];

      // Check for double spaces (indicates removed templates without content)
      if (p.includes('  ')) {
        issues.push(`Paragraph ${i + 1}: Contains double spaces (possible template removal issue)`);
      }

      // Check for unclosed wikilinks
      if (p.includes('[[') || p.includes(']]')) {
        issues.push(`Paragraph ${i + 1}: Contains unclosed wikilinks`);
      }

      // Check for remaining templates
      if (p.includes('{{') || p.includes('}}')) {
        issues.push(`Paragraph ${i + 1}: Contains remaining template markup`);
      }

      // Check for very short paragraphs after processing
      if (p.replace(/<[^>]+>/g, '').length < 100) {
        issues.push(`Paragraph ${i + 1}: Too short after processing (${p.replace(/<[^>]+>/g, '').length} chars)`);
      }
    }

    const result: TestResult = {
      country: countryName,
      success: issues.length === 0,
      issues,
      paragraphCount: paragraphs.length,
      sampleText: paragraphs[0]?.substring(0, 200).replace(/<[^>]+>/g, '') || 'N/A',
    };

    // Print results
    if (result.success) {
      console.log(`✅ ${countryName}: PASS`);
      console.log(`   ${result.paragraphCount} paragraphs extracted`);
      console.log(`   Sample: "${result.sampleText}..."`);
    } else {
      console.log(`❌ ${countryName}: FAIL`);
      console.log(`   ${result.paragraphCount} paragraphs extracted`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return result;

  } catch (error) {
    console.log(`❌ ${countryName}: ERROR`);
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);

    return {
      country: countryName,
      success: false,
      issues: [error instanceof Error ? error.message : String(error)],
      paragraphCount: 0,
      sampleText: 'N/A',
    };
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Starting wiki parsing tests for all countries...\n');
  console.log('=' .repeat(60));

  const results: TestResult[] = [];

  for (const country of TEST_COUNTRIES) {
    const result = await testCountry(country);
    results.push(result);

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 SUMMARY\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed countries:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n  ${r.country}:`);
      r.issues.forEach(issue => console.log(`    - ${issue}`));
    });
  }

  console.log('\n' + '=' .repeat(60));

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
