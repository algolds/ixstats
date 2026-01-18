/**
 * Wiki Batch Fetcher Usage Examples
 *
 * Demonstrates how to use the wiki batch fetcher service for lore card generation.
 * These are example patterns - adapt to your specific use case.
 */

import { WikiBatchFetcher } from "~/lib/wiki-batch-fetcher";
import type { WikiSource } from "~/lib/mediawiki-config";
import {
  getEligibilityRules,
  ELIGIBILITY_PRESETS,
  getEligibilitySummary,
  type EligibilityPreset,
} from "~/lib/wiki-eligibility-rules";
import {
  extractCardSummary,
  PARSE_PRESETS,
  validateParsedText,
} from "~/lib/wiki-rich-text-parser";

/**
 * Example 1: Basic Usage - Fetch and validate 50 articles from IxWiki
 */
export async function basicExample() {
  const fetcher = new WikiBatchFetcher();

  const result = await fetcher.fetchAndValidate(50, "ixwiki");

  console.log(`Fetched ${result.statistics.eligible} eligible articles`);
  console.log(`Average quality score: ${result.statistics.averageScore.toFixed(1)}`);

  // Process eligible articles
  for (const article of result.articles) {
    console.log(`\n${article.normalizedTitle}`);
    console.log(`  Score: ${article.eligibility.score.toFixed(1)}/100`);
    console.log(`  Preview: ${article.excerpt.substring(0, 100)}...`);
    console.log(`  Categories: ${article.categories.slice(0, 3).join(", ")}`);
  }

  return result.articles;
}

/**
 * Example 2: Strict Quality Filter - Get only high-quality articles
 */
export async function strictQualityExample() {
  const fetcher = new WikiBatchFetcher();

  // Use strict rules for premium lore cards
  const result = await fetcher.fetchAndValidate(30, "ixwiki", {
    strictness: "strict", // Requires: 1000+ chars, 3+ categories, 50+ quality score
    includeImages: true,
    includeBacklinks: true,
  });

  console.log(`Found ${result.statistics.eligible} high-quality articles`);
  console.log(`Highest score: ${result.statistics.highestScore.toFixed(1)}`);

  // Filter for only the best
  const topArticles = result.articles.filter(
    article => article.eligibility.score >= 70
  );

  return topArticles;
}

/**
 * Example 3: Category-Specific Search - Find historical figures
 */
export async function categoryFilterExample() {
  const fetcher = new WikiBatchFetcher();

  const result = await fetcher.fetchAndValidate(40, "ixwiki", {
    includeCategories: [
      "Historical figures",
      "Politicians",
      "Leaders",
      "Monarchs",
    ],
    excludeCategories: [
      "Fictional characters",
      "Stubs",
    ],
    strictness: "default",
  });

  console.log(`Found ${result.statistics.eligible} historical figures`);

  return result.articles;
}

/**
 * Example 4: Multi-Wiki Fetch - Get articles from both IxWiki and IIWiki
 */
export async function multiWikiExample() {
  const fetcher = new WikiBatchFetcher();

  // Fetch from IxWiki
  const ixwikiResult = await fetcher.fetchAndValidate(25, "ixwiki", {
    strictness: "default",
  });

  // Fetch from IIWiki
  const iiwikiResult = await fetcher.fetchAndValidate(25, "iiwiki", {
    strictness: "lenient", // IIWiki has different structure
  });

  const combined = [
    ...ixwikiResult.articles,
    ...iiwikiResult.articles,
  ];

  console.log(`Combined: ${combined.length} articles`);
  console.log(`  IxWiki: ${ixwikiResult.articles.length}`);
  console.log(`  IIWiki: ${iiwikiResult.articles.length}`);

  return combined;
}

/**
 * Example 5: Custom Eligibility Rules - Fine-tune filtering
 */
export async function customRulesExample() {
  const fetcher = new WikiBatchFetcher();

  const customRules = {
    minLength: 800,
    requireImage: true,
    minCategories: 2,
    excludeNamespaces: ["Template", "Category", "User"],
    excludePatterns: [
      /\(disambiguation\)/i,
      /Stub$/i,
      /^List of/i,
    ],
    minQualityScore: 40,
    minReferences: 2,
    minInboundLinks: 5,
    requireInfobox: true,
  };

  const result = await fetcher.fetchAndValidate(50, "ixwiki", {
    customRules,
    includeImages: true,
    includeBacklinks: true,
  });

  console.log(`Custom filter yielded ${result.statistics.eligible} articles`);

  return result.articles;
}

/**
 * Example 6: Top Quality Articles - Keep fetching until you get N high-quality articles
 */
export async function topQualityExample() {
  const fetcher = new WikiBatchFetcher();

  // Will fetch in batches until 20 eligible articles are found (max 3 attempts)
  const articles = await fetcher.getTopQualityArticles(
    20,
    "ixwiki",
    { strictness: "strict" },
    3 // max attempts
  );

  console.log(`Retrieved ${articles.length} top-quality articles`);

  // Articles are already sorted by quality score
  for (const article of articles) {
    console.log(`${article.normalizedTitle}: ${article.eligibility.score.toFixed(1)}/100`);
  }

  return articles;
}

/**
 * Example 7: Batch Processing with Progress Tracking
 */
export async function batchProgressExample() {
  const fetcher = new WikiBatchFetcher();

  const totalNeeded = 100;
  const batchSize = 25;
  const allArticles = [];

  for (let i = 0; i < totalNeeded; i += batchSize) {
    console.log(`\nFetching batch ${Math.floor(i / batchSize) + 1}...`);

    const result = await fetcher.fetchAndValidate(batchSize, "ixwiki", {
      strictness: "default",
      batchSize: 10,
      batchDelay: 500,
    });

    allArticles.push(...result.articles);

    console.log(`  Eligible: ${result.statistics.eligible}`);
    console.log(`  Total so far: ${allArticles.length}`);

    // Stop if we have enough
    if (allArticles.length >= totalNeeded) break;
  }

  return allArticles.slice(0, totalNeeded);
}

/**
 * Example 8: Article Validation - Check specific articles
 */
export async function validateSpecificExample() {
  const fetcher = new WikiBatchFetcher();

  const titlesToCheck = [
    "Caphiria",
    "Urcea",
    "Burgundie",
    "Yonderre",
  ];

  const result = await fetcher.batchValidateArticles(titlesToCheck, "ixwiki", {
    strictness: "default",
  });

  for (const article of result.articles) {
    console.log(`\n${article.normalizedTitle}`);
    console.log(getEligibilitySummary(article.eligibility));

    if (article.eligibility.warnings.length > 0) {
      console.log(`  Warnings: ${article.eligibility.warnings.join(", ")}`);
    }
  }

  return result;
}

/**
 * Example 9: Rich Text Parsing - Generate card descriptions
 */
export async function textParsingExample() {
  const fetcher = new WikiBatchFetcher();

  const result = await fetcher.fetchAndValidate(10, "ixwiki");

  for (const article of result.articles) {
    // Short preview for tooltips
    const preview = extractCardSummary(
      article.metadata.text || "",
      false,
    );

    // Validate the parsed text
    const isValid = validateParsedText(preview, 100);

    console.log(`\n${article.normalizedTitle}`);
    console.log(`  Preview (${preview.length} chars, valid: ${isValid}):`);
    console.log(`  ${preview}`);
  }

  return result.articles;
}

/**
 * Example 10: Error Handling and Statistics
 */
export async function errorHandlingExample() {
  const fetcher = new WikiBatchFetcher();

  const result = await fetcher.fetchAndValidate(50, "ixwiki", {
    strictness: "strict",
    timeout: 10000,
    batchSize: 10,
  });

  // Check for errors
  if (result.errors.length > 0) {
    console.log(`\nEncountered ${result.errors.length} errors:`);
    for (const error of result.errors.slice(0, 5)) {
      console.log(`  ${error.title}: ${error.error}`);
    }
  }

  // Display statistics
  console.log(`\nStatistics:`);
  console.log(`  Requested: ${result.statistics.requested}`);
  console.log(`  Fetched: ${result.statistics.fetched}`);
  console.log(`  Eligible: ${result.statistics.eligible}`);
  console.log(`  Ineligible: ${result.statistics.ineligible}`);
  console.log(`  Success rate: ${(result.statistics.eligible / result.statistics.fetched * 100).toFixed(1)}%`);
  console.log(`  Average score: ${result.statistics.averageScore.toFixed(1)}`);
  console.log(`  Duration: ${result.statistics.duration}ms`);

  return result;
}

/**
 * Example 11: Integration with Lore Card Generator
 */
export async function loreCardIntegrationExample() {
  const fetcher = new WikiBatchFetcher();

  // Fetch high-quality articles suitable for lore cards
  const articles = await fetcher.getTopQualityArticles(
    30,
    "ixwiki",
    {
      strictness: "default",
      includeImages: true,
      includeBacklinks: true,
    }
  );

  console.log(`Found ${articles.length} articles for lore card generation`);

  // Prepare for card creation
  const cardCandidates = articles.map(article => ({
    title: article.normalizedTitle,
    wikiSource: "ixwiki" as WikiSource,
    description: article.excerpt,
    imageUrl: article.imageUrl,
    categories: article.categories,
    qualityScore: article.eligibility.score,
    url: article.url,
  }));

  console.log(`\nTop 5 candidates:`);
  for (const candidate of cardCandidates.slice(0, 5)) {
    console.log(`  ${candidate.title} (${candidate.qualityScore.toFixed(1)}/100)`);
  }

  return cardCandidates;
}

/**
 * Example 12: Preset-based Filtering
 */
export async function presetFilteringExample() {
  const fetcher = new WikiBatchFetcher();

  // Use preset eligibility rules
  const presets: EligibilityPreset[] = ["strict", "default", "lenient"];

  for (const preset of presets) {
    const rules = ELIGIBILITY_PRESETS[preset];

    const result = await fetcher.fetchAndValidate(30, "ixwiki", {
      customRules: rules,
    });

    console.log(`\n${preset.toUpperCase()} preset:`);
    console.log(`  Eligible: ${result.statistics.eligible}`);
    console.log(`  Average score: ${result.statistics.averageScore.toFixed(1)}`);
  }
}

/**
 * Example 13: Exclude Existing Cards - Avoid duplicates
 */
export async function excludeExistingExample() {
  const fetcher = new WikiBatchFetcher();

  // Simulate existing card titles (in real use, fetch from database)
  const existingTitles = [
    "Caphiria",
    "Urcea",
    "Burgundie",
  ];

  const result = await fetcher.fetchAndValidate(50, "ixwiki", {
    excludeTitles: existingTitles,
    strictness: "default",
  });

  console.log(`Found ${result.statistics.eligible} new articles (excluding ${existingTitles.length} existing)`);

  return result.articles;
}

// Export all examples for easy testing
export const examples = {
  basic: basicExample,
  strictQuality: strictQualityExample,
  categoryFilter: categoryFilterExample,
  multiWiki: multiWikiExample,
  customRules: customRulesExample,
  topQuality: topQualityExample,
  batchProgress: batchProgressExample,
  validateSpecific: validateSpecificExample,
  textParsing: textParsingExample,
  errorHandling: errorHandlingExample,
  loreCardIntegration: loreCardIntegrationExample,
  presetFiltering: presetFilteringExample,
  excludeExisting: excludeExistingExample,
};
