/**
 * Wiki Article Eligibility Rules for Lore Card Generation
 *
 * Defines comprehensive quality standards and validation rules to ensure
 * only high-quality, well-developed wiki articles are selected for lore card creation.
 *
 * Features:
 * - Minimum content quality thresholds
 * - Namespace and pattern exclusions
 * - Category and image requirements
 * - Quality scoring algorithm
 * - Multi-wiki support
 *
 * Usage:
 *   import { checkArticleEligibility, calculateQualityScore } from '~/lib/wiki-eligibility-rules';
 *   const isEligible = checkArticleEligibility(articleData, 'ixwiki');
 */

import type { WikiSource } from "~/lib/mediawiki-config";

/**
 * Eligibility configuration for different wiki sources
 */
export interface EligibilityRules {
  /** Minimum character count for article content */
  minLength: number;

  /** Whether article must have at least one image */
  requireImage: boolean;

  /** Minimum number of categories article must belong to */
  minCategories: number;

  /** Namespaces to exclude from eligibility (e.g., "Template", "User") */
  excludeNamespaces: string[];

  /** Regex patterns to exclude (e.g., disambiguation pages, stubs) */
  excludePatterns: RegExp[];

  /** Minimum quality score required (0-100 scale) */
  minQualityScore: number;

  /** Minimum number of references/citations */
  minReferences: number;

  /** Minimum number of inbound links (backlinks) */
  minInboundLinks: number;

  /** Whether to require an infobox */
  requireInfobox: boolean;
}

/**
 * Article metadata for eligibility checking
 */
export interface ArticleMetadata {
  title: string;
  namespace: number;
  length: number;
  hasImage: boolean;
  imageCount: number;
  categoryCount: number;
  categories: string[];
  referenceCount: number;
  inboundLinks: number;
  hasInfobox: boolean;
  isFeatured: boolean;
  isRedirect: boolean;
  lastModified: Date;
  text?: string;
}

/**
 * Eligibility check result
 */
export interface EligibilityResult {
  eligible: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
  metadata: ArticleMetadata;
}

/**
 * Default eligibility rules for lore card generation
 */
export const DEFAULT_ELIGIBILITY_RULES: EligibilityRules = {
  minLength: 500,
  requireImage: true,
  minCategories: 2,
  excludeNamespaces: [
    "Template",
    "Category",
    "User",
    "User_talk",
    "Wikipedia",
    "Wikipedia_talk",
    "File",
    "File_talk",
    "MediaWiki",
    "MediaWiki_talk",
    "Module",
    "Module_talk",
    "Help",
    "Help_talk",
    "Portal",
    "Portal_talk",
    "Project",
    "Project_talk",
  ],
  excludePatterns: [
    /\(disambiguation\)/i,
    /Stub$/i,
    /^List of/i,
    /^Index of/i,
    /^Timeline of/i,
    /^Outline of/i,
    /^Category:/i,
    /^Template:/i,
    /^User:/i,
    /^File:/i,
    /^Portal:/i,
    /^Help:/i,
    /^Draft:/i,
    /\(redirect\)/i,
    /\(page does not exist\)/i,
  ],
  minQualityScore: 20,
  minReferences: 1,
  minInboundLinks: 2,
  requireInfobox: false, // Optional but adds to quality score
};

/**
 * Stricter rules for high-quality lore cards
 */
export const STRICT_ELIGIBILITY_RULES: EligibilityRules = {
  ...DEFAULT_ELIGIBILITY_RULES,
  minLength: 1000,
  minCategories: 3,
  minQualityScore: 50,
  minReferences: 3,
  minInboundLinks: 5,
  requireInfobox: true,
};

/**
 * Lenient rules for testing or expanding card pool
 */
export const LENIENT_ELIGIBILITY_RULES: EligibilityRules = {
  ...DEFAULT_ELIGIBILITY_RULES,
  minLength: 300,
  requireImage: false,
  minCategories: 1,
  minQualityScore: 20,
  minReferences: 0,
  minInboundLinks: 1,
  requireInfobox: false,
};

/**
 * Get eligibility rules for a specific wiki source
 */
export function getEligibilityRules(
  wikiSource: WikiSource,
  strictness: "default" | "strict" | "lenient" = "default"
): EligibilityRules {
  // Base rules by strictness
  let baseRules: EligibilityRules;

  switch (strictness) {
    case "strict":
      baseRules = STRICT_ELIGIBILITY_RULES;
      break;
    case "lenient":
      baseRules = LENIENT_ELIGIBILITY_RULES;
      break;
    default:
      baseRules = DEFAULT_ELIGIBILITY_RULES;
  }

  // Wiki-specific adjustments
  if (wikiSource === "iiwiki") {
    // IIWiki tends to have slightly different structure
    return {
      ...baseRules,
      minLength: Math.floor(baseRules.minLength * 0.8), // 20% more lenient
      minCategories: Math.max(1, baseRules.minCategories - 1),
    };
  }

  return baseRules;
}

/**
 * Calculate article quality score (0-100)
 *
 * Formula breakdown:
 * - Article length: 0-30 points (1 point per 100 chars, max 3000 chars)
 * - References: 0-25 points (5 points each, max 5 refs)
 * - Inbound links: 0-20 points (2 points each, max 10 links)
 * - Categories: 0-10 points (2 points each, max 5 categories)
 * - Images: 0-10 points (5 points per image, max 2 images)
 * - Infobox: +10 points bonus
 * - Featured: +15 points bonus
 *
 * @param metadata Article metadata
 * @returns Quality score from 0-100
 */
export function calculateQualityScore(metadata: ArticleMetadata): number {
  let score = 0;

  // Length score (0-30 points)
  // 100 chars = 1 point, maxes out at 3000 chars (30 points)
  score += Math.min((metadata.length / 100), 30);

  // Reference score (0-25 points)
  // Each reference = 5 points, max 5 references
  score += Math.min(metadata.referenceCount * 5, 25);

  // Inbound links score (0-20 points)
  // Each link = 2 points, max 10 links
  score += Math.min(metadata.inboundLinks * 2, 20);

  // Category score (0-10 points)
  // Each category = 2 points, max 5 categories
  score += Math.min(metadata.categoryCount * 2, 10);

  // Image score (0-10 points)
  // Each image = 5 points, max 2 images
  score += Math.min(metadata.imageCount * 5, 10);

  // Infobox bonus (+10 points)
  if (metadata.hasInfobox) {
    score += 10;
  }

  // Featured article bonus (+15 points)
  if (metadata.isFeatured) {
    score += 15;
  }

  // Ensure score is between 0-100
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Check if an article is eligible for lore card generation
 *
 * @param metadata Article metadata
 * @param rules Eligibility rules to apply
 * @returns Detailed eligibility result with score and reasons
 */
export function checkArticleEligibility(
  metadata: ArticleMetadata,
  rules: EligibilityRules = DEFAULT_ELIGIBILITY_RULES
): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let eligible = true;

  // Check if redirect
  if (metadata.isRedirect) {
    eligible = false;
    reasons.push("Article is a redirect");
  }

  // Check namespace (must be main namespace = 0)
  if (metadata.namespace !== 0) {
    eligible = false;
    reasons.push(`Article is in namespace ${metadata.namespace} (must be main namespace)`);
  }

  // Check title patterns
  for (const pattern of rules.excludePatterns) {
    if (pattern.test(metadata.title)) {
      eligible = false;
      reasons.push(`Title matches excluded pattern: ${pattern.toString()}`);
      break;
    }
  }

  // Check minimum length
  if (metadata.length < rules.minLength) {
    eligible = false;
    reasons.push(
      `Article too short: ${metadata.length} chars (minimum: ${rules.minLength})`
    );
  }

  // Check image requirement
  if (rules.requireImage && !metadata.hasImage) {
    eligible = false;
    reasons.push("Article has no images (required)");
  } else if (!metadata.hasImage) {
    warnings.push("Article has no images");
  }

  // Check category requirement
  if (metadata.categoryCount < rules.minCategories) {
    eligible = false;
    reasons.push(
      `Too few categories: ${metadata.categoryCount} (minimum: ${rules.minCategories})`
    );
  }

  // Check reference requirement
  if (metadata.referenceCount < rules.minReferences) {
    if (rules.minReferences > 0) {
      eligible = false;
      reasons.push(
        `Too few references: ${metadata.referenceCount} (minimum: ${rules.minReferences})`
      );
    } else {
      warnings.push(`Low reference count: ${metadata.referenceCount}`);
    }
  }

  // Check inbound links requirement
  if (metadata.inboundLinks < rules.minInboundLinks) {
    if (rules.minInboundLinks > 0) {
      eligible = false;
      reasons.push(
        `Too few inbound links: ${metadata.inboundLinks} (minimum: ${rules.minInboundLinks})`
      );
    } else {
      warnings.push(`Low inbound link count: ${metadata.inboundLinks}`);
    }
  }

  // Check infobox requirement
  if (rules.requireInfobox && !metadata.hasInfobox) {
    eligible = false;
    reasons.push("Article lacks infobox (required)");
  } else if (!metadata.hasInfobox) {
    warnings.push("Article has no infobox");
  }

  // Calculate quality score
  const score = calculateQualityScore(metadata);

  // Check minimum quality score
  if (score < rules.minQualityScore) {
    eligible = false;
    reasons.push(
      `Quality score too low: ${score.toFixed(1)} (minimum: ${rules.minQualityScore})`
    );
  }

  return {
    eligible,
    score,
    reasons,
    warnings,
    metadata,
  };
}

/**
 * Check multiple articles for eligibility (batch processing)
 *
 * @param articles Array of article metadata
 * @param rules Eligibility rules to apply
 * @returns Array of eligibility results
 */
export function checkBatchEligibility(
  articles: ArticleMetadata[],
  rules: EligibilityRules = DEFAULT_ELIGIBILITY_RULES
): EligibilityResult[] {
  return articles.map(article => checkArticleEligibility(article, rules));
}

/**
 * Filter eligible articles from a batch
 *
 * @param articles Array of article metadata
 * @param rules Eligibility rules to apply
 * @returns Array of eligible articles with their results
 */
export function filterEligibleArticles(
  articles: ArticleMetadata[],
  rules: EligibilityRules = DEFAULT_ELIGIBILITY_RULES
): EligibilityResult[] {
  const results = checkBatchEligibility(articles, rules);
  return results.filter(result => result.eligible);
}

/**
 * Get eligibility statistics for a batch of articles
 *
 * @param articles Array of article metadata
 * @param rules Eligibility rules to apply
 * @returns Statistics about eligibility
 */
export function getEligibilityStats(
  articles: ArticleMetadata[],
  rules: EligibilityRules = DEFAULT_ELIGIBILITY_RULES
): {
  total: number;
  eligible: number;
  ineligible: number;
  averageScore: number;
  topReasons: Array<{ reason: string; count: number }>;
} {
  const results = checkBatchEligibility(articles, rules);

  const eligible = results.filter(r => r.eligible).length;
  const ineligible = results.length - eligible;

  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  // Collect all reasons
  const reasonCounts = new Map<string, number>();
  results.forEach(result => {
    result.reasons.forEach(reason => {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });
  });

  // Sort by count and get top 5
  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: results.length,
    eligible,
    ineligible,
    averageScore,
    topReasons,
  };
}

/**
 * Validate if a category is excluded
 *
 * @param categories Article categories
 * @param excludePatterns Patterns to exclude
 * @returns True if any category matches exclusion pattern
 */
export function hasExcludedCategory(
  categories: string[],
  excludePatterns: RegExp[] = DEFAULT_ELIGIBILITY_RULES.excludePatterns
): boolean {
  return categories.some(category =>
    excludePatterns.some(pattern => pattern.test(category))
  );
}

/**
 * Get human-readable eligibility summary
 *
 * @param result Eligibility check result
 * @returns Formatted summary string
 */
export function getEligibilitySummary(result: EligibilityResult): string {
  if (result.eligible) {
    return `✅ ELIGIBLE - Quality Score: ${result.score.toFixed(1)}/100`;
  }

  const mainReason = result.reasons[0] || "Unknown reason";
  return `❌ INELIGIBLE - ${mainReason} (Score: ${result.score.toFixed(1)}/100)`;
}

/**
 * Export preset rule configurations
 */
export const ELIGIBILITY_PRESETS = {
  default: DEFAULT_ELIGIBILITY_RULES,
  strict: STRICT_ELIGIBILITY_RULES,
  lenient: LENIENT_ELIGIBILITY_RULES,
} as const;

export type EligibilityPreset = keyof typeof ELIGIBILITY_PRESETS;
