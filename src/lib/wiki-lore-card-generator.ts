/**
 * Wiki Lore Card Generator Service
 *
 * Automatically generates LORE-type cards from IxWiki and IIWiki articles.
 * Uses quality scoring to determine rarity and generates card metadata.
 *
 * Features:
 * - Multi-wiki support (IxWiki + IIWiki)
 * - Quality-based rarity calculation
 * - Category detection (Historical Figures, Locations, Events, Artifacts, Culture)
 * - Image extraction from infoboxes/articles
 * - Summary generation
 * - Duplicate prevention
 *
 * Usage:
 *   import { wikiLoreCardGenerator } from '~/lib/wiki-lore-card-generator';
 *   const card = await wikiLoreCardGenerator.generateCard('Article_Title', 'ixwiki');
 */

import { db } from "~/server/db";
import { CardType, CardRarity } from "@prisma/client";
import type { WikiSource } from "~/lib/mediawiki-config";
import { getMediaWikiApiUrl, getWikiUserAgent } from "~/lib/mediawiki-config";
import { LORE_CATEGORIES } from "./lore-card-constants";

// Re-export for backwards compatibility
export { LORE_CATEGORIES };

/**
 * Article quality metrics for scoring
 */
interface ArticleQuality {
  length: number;
  referenceCount: number;
  inboundLinks: number;
  categoryCount: number;
  hasInfobox: boolean;
  isFeatured: boolean;
  lastModified: Date;
}

/**
 * Lore card generation result
 */
interface LoreCardCandidate {
  title: string;
  description: string;
  fullExcerpt: string;
  artwork: string;
  rarity: CardRarity;
  wikiSource: string;
  wikiArticleTitle: string;
  wikiUrl: string;
  category: string;
  stats: {
    economic: number;
    diplomatic: number;
    military: number;
    social: number;
  };
  loreStats: {
    historicalSignificance: number;
    culturalImpact: number;
  };
  qualityScore: number;
}

/**
 * Category-based stat weights for lore cards.
 * Each category emphasizes different stats based on thematic relevance.
 */
const CATEGORY_STAT_WEIGHTS: Record<
  string,
  { economic: number; diplomatic: number; military: number; social: number }
> = {
  [LORE_CATEGORIES.HISTORICAL_FIGURES]: {
    economic: 0.15,
    diplomatic: 0.4,
    military: 0.15,
    social: 0.3,
  },
  [LORE_CATEGORIES.LOCATIONS]: { economic: 0.4, diplomatic: 0.2, military: 0.15, social: 0.25 },
  [LORE_CATEGORIES.EVENTS]: { economic: 0.2, diplomatic: 0.3, military: 0.35, social: 0.15 },
  [LORE_CATEGORIES.ARTIFACTS]: { economic: 0.3, diplomatic: 0.2, military: 0.1, social: 0.4 },
  [LORE_CATEGORIES.CULTURE]: { economic: 0.2, diplomatic: 0.25, military: 0.1, social: 0.45 },
  [LORE_CATEGORIES.MYTHOLOGY]: { economic: 0.15, diplomatic: 0.2, military: 0.25, social: 0.4 },
  default: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
};

/**
 * Wiki Lore Card Generator Service
 */
export class WikiLoreCardGenerator {
  /**
   * Generate a lore card from a wiki article
   */
  async generateCard(
    articleTitle: string,
    wikiSource: WikiSource,
    options?: { requireImage?: boolean }
  ): Promise<LoreCardCandidate | null> {
    try {
      console.log(`[Lore Card Generator] Generating card for "${articleTitle}" from ${wikiSource}`);

      // Fetch article data
      const articleData = await this.fetchArticleData(articleTitle, wikiSource);
      if (!articleData) {
        console.warn(`[Lore Card Generator] Article "${articleTitle}" not found`);
        return null;
      }

      // Check image requirement
      if (options?.requireImage && !articleData.image) {
        console.log(`[Lore Card Generator] Skipping "${articleTitle}" — no image found`);
        return null;
      }

      // Check if card already exists
      const exists = await this.checkCardExists(articleTitle, wikiSource);
      if (exists) {
        console.log(`[Lore Card Generator] Card already exists for "${articleTitle}"`);
        return null;
      }

      // Calculate quality score
      const quality = this.analyzeArticleQuality(articleData);
      const qualityScore = this.calculateQualityScore(quality);

      // Determine rarity based on quality
      const rarity = this.determineRarity(qualityScore);

      // Detect category
      const category = this.detectCategory(articleData);

      // Extract image
      const artwork = this.extractArtwork(articleData, wikiSource);

      // Generate summary (short for card face) and full excerpt (for lore tab)
      const rawExcerpt = articleData.extract || articleData.text || "";
      const description = this.generateSummary(rawExcerpt);
      const fullExcerpt = rawExcerpt.slice(0, 2000).trim();

      // Calculate standard stats (economic/diplomatic/military/social)
      const stats = this.calculateStats(quality, qualityScore, category);

      // Calculate lore-specific metrics for display
      const loreStats = this.calculateLoreStats(quality);

      // Build wiki URL
      const wikiUrl = this.buildWikiUrl(articleTitle, wikiSource);

      const candidate: LoreCardCandidate = {
        title: articleTitle.replace(/_/g, " "),
        description,
        fullExcerpt,
        artwork,
        rarity,
        wikiSource,
        wikiArticleTitle: articleTitle,
        wikiUrl,
        category,
        stats,
        loreStats,
        qualityScore,
      };

      console.log(
        `[Lore Card Generator] Generated ${rarity} card for "${articleTitle}" ` +
          `(quality: ${qualityScore.toFixed(1)}, category: ${category})`
      );

      return candidate;
    } catch (error) {
      console.error(`[Lore Card Generator] Error generating card for "${articleTitle}":`, error);
      return null;
    }
  }

  /**
   * Fetch article data from wiki API
   */
  private async fetchArticleData(title: string, wikiSource: WikiSource): Promise<any | null> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      // Fetch article content with infobox and metadata
      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "extracts|pageimages|info|categories|links|revisions|images");
      url.searchParams.set("exchars", "2000"); // Get first ~2000 chars for full excerpt
      url.searchParams.set("exlimit", "1");
      url.searchParams.set("explaintext", "1"); // Plain text
      url.searchParams.set("piprop", "original|name"); // Get original image and name
      url.searchParams.set("pithumbsize", "500"); // Thumbnail size
      url.searchParams.set("inprop", "url");
      url.searchParams.set("cllimit", "50"); // Get up to 50 categories
      url.searchParams.set("pllimit", "500"); // Get up to 500 links (inbound indicator)
      url.searchParams.set("rvprop", "content|timestamp"); // Get full wikitext and timestamp
      url.searchParams.set("imlimit", "10"); // Get up to 10 images

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        console.error(`[Lore Card Generator] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return null;

      const page = Object.values(pages)[0] as any;
      if (page.missing) return null;

      // Get wikitext
      const wikitext = page.revisions?.[0]?.["*"] || "";

      // Parse infobox from wikitext
      const infoboxData = this.parseInfobox(wikitext);

      // Extract featured image (try multiple sources)
      let featuredImage = page.original?.source; // From pageimages API

      // If no pageimage, try to get from infobox
      if (!featuredImage && infoboxData.image) {
        // Get actual image URL from image filename
        featuredImage = await this.getImageUrl(infoboxData.image, wikiSource);
      }

      // If still no image, try first image from article
      if (!featuredImage && page.images?.length > 0) {
        // Get first non-icon image
        const firstImage = page.images.find((img: any) => {
          const filename = img.title?.toLowerCase() || "";
          return (
            !filename.includes("icon") &&
            !filename.includes("flag") &&
            !filename.includes("logo") &&
            (filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png"))
          );
        });
        if (firstImage) {
          featuredImage = await this.getImageUrl(firstImage.title, wikiSource);
        }
      }

      // Get backlinks count (inbound links)
      const backlinksUrl = new URL(apiUrl);
      backlinksUrl.searchParams.set("action", "query");
      backlinksUrl.searchParams.set("format", "json");
      backlinksUrl.searchParams.set("list", "backlinks");
      backlinksUrl.searchParams.set("bltitle", title);
      backlinksUrl.searchParams.set("bllimit", "500");

      const backlinksResponse = await fetch(backlinksUrl.toString(), {
        headers: { "User-Agent": userAgent },
      });

      let inboundLinks = 0;
      if (backlinksResponse.ok) {
        const backlinksData = await backlinksResponse.json();
        inboundLinks = backlinksData.query?.backlinks?.length || 0;
      }

      // Clean text by removing all templates except infobox
      const cleanedText = this.removeTemplates(wikitext);

      return {
        title: page.title,
        extract: page.extract,
        text: cleanedText,
        rawText: wikitext,
        image: featuredImage,
        infobox: infoboxData,
        categories: page.categories || [],
        links: page.links || [],
        images: page.images || [],
        inboundLinks,
        lastModified: page.revisions?.[0]?.timestamp
          ? new Date(page.revisions[0].timestamp)
          : new Date(),
        url: page.fullurl,
      };
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching article "${title}":`, error);
      return null;
    }
  }

  /**
   * Parse infobox template from wikitext
   */
  private parseInfobox(wikitext: string): Record<string, string> {
    const infobox: Record<string, string> = {};

    // Match infobox template
    const infoboxMatch = wikitext.match(/\{\{infobox[^}]*(?:\{\{[^}]*\}\}[^}]*)*\}\}/i);
    if (!infoboxMatch) return infobox;

    const infoboxText = infoboxMatch[0];

    // Extract key-value pairs from infobox
    const lines = infoboxText.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.+?)\s*$/);
      if (match) {
        const key = match[1]?.trim().toLowerCase() || "";
        let value = match[2]?.trim() || "";

        // Clean value (remove nested templates, links)
        value = value.replace(/\{\{[^}]*\}\}/g, ""); // Remove templates
        value = value.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1"); // Extract link text
        value = value.replace(/<[^>]+>/g, ""); // Remove HTML tags
        value = value.trim();

        if (value && key) {
          infobox[key] = value;
        }
      }
    }

    return infobox;
  }

  /**
   * Remove all templates except infobox from wikitext
   */
  private removeTemplates(wikitext: string): string {
    // Remove all templates except infobox
    let cleaned = wikitext;

    // First, preserve infobox
    const infoboxMatch = wikitext.match(/\{\{infobox[^}]*(?:\{\{[^}]*\}\}[^}]*)*\}\}/i);
    const infoboxPlaceholder = infoboxMatch ? `___INFOBOX_PLACEHOLDER___` : "";
    if (infoboxMatch) {
      cleaned = cleaned.replace(infoboxMatch[0], infoboxPlaceholder);
    }

    // Remove all other templates (nested template handling)
    let prevCleaned = "";
    while (prevCleaned !== cleaned) {
      prevCleaned = cleaned;
      cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, "");
    }

    // Restore infobox if it was there
    if (infoboxMatch) {
      cleaned = cleaned.replace(infoboxPlaceholder, "");
    }

    // Remove reference tags
    cleaned = cleaned.replace(/<ref[^>]*>.*?<\/ref>/gi, "");
    cleaned = cleaned.replace(/<ref[^>]*\/>/gi, "");

    return cleaned;
  }

  /**
   * Get image URL from filename via MediaWiki API
   */
  private async getImageUrl(filename: string, wikiSource: WikiSource): Promise<string | null> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      // Remove "File:" or "Image:" prefix if present
      const cleanFilename = filename.replace(/^(File|Image):/i, "");

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", `File:${cleanFilename}`);
      url.searchParams.set("prop", "imageinfo");
      url.searchParams.set("iiprop", "url");

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return null;

      const page = Object.values(pages)[0] as any;
      return page.imageinfo?.[0]?.url || null;
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching image URL:`, error);
      return null;
    }
  }

  /**
   * Check if lore card already exists for this article
   */
  private async checkCardExists(articleTitle: string, wikiSource: WikiSource): Promise<boolean> {
    const existing = await db.card.findFirst({
      where: {
        wikiArticleTitle: articleTitle,
        wikiSource: wikiSource,
        cardType: CardType.LORE,
      },
    });

    return !!existing;
  }

  /**
   * Analyze article quality metrics
   */
  private analyzeArticleQuality(articleData: any): ArticleQuality {
    // Use raw text for template/reference detection
    const rawText = articleData.rawText || articleData.text || "";

    // Use cleaned text for length measurement
    const cleanText = articleData.text || "";

    // Count references ({{cite}} templates, <ref> tags) from raw text
    const refMatches = rawText.match(/<ref[^>]*>|{{cite/gi) || [];
    const referenceCount = refMatches.length;

    // Check for infobox from raw text
    const hasInfobox = /{{infobox/i.test(rawText);

    // Check if featured (has {{featured}} template or in Featured category)
    const isFeatured =
      /{{featured/i.test(rawText) ||
      articleData.categories?.some((cat: any) => cat.title?.toLowerCase().includes("featured"));

    return {
      length: cleanText.length, // Use cleaned text length
      referenceCount,
      inboundLinks: articleData.inboundLinks || 0,
      categoryCount: articleData.categories?.length || 0,
      hasInfobox,
      isFeatured,
      lastModified: articleData.lastModified,
    };
  }

  /**
   * Calculate quality score (0-100)
   * Formula: (length/1000)*0.3 + (refs*5)*0.3 + (inbound*2)*0.2 + (featured?50:0)*0.2
   */
  private calculateQualityScore(quality: ArticleQuality): number {
    let score = 0;

    // Article length score (0-30 points)
    score += Math.min((quality.length / 1000) * 0.3, 30);

    // Reference count score (0-30 points)
    score += Math.min(quality.referenceCount * 5 * 0.3, 30);

    // Inbound links score (0-20 points)
    score += Math.min(quality.inboundLinks * 2 * 0.2, 20);

    // Featured article bonus (0-20 points)
    if (quality.isFeatured) {
      score += 20;
    }

    // Infobox bonus (+5 points)
    if (quality.hasInfobox) {
      score += 5;
    }

    // Category bonus (0-5 points)
    score += Math.min(quality.categoryCount * 0.5, 5);

    return Math.min(score, 100);
  }

  /**
   * Determine card rarity based on quality score
   */
  private determineRarity(qualityScore: number): CardRarity {
    if (qualityScore >= 96) return CardRarity.LEGENDARY;
    if (qualityScore >= 81) return CardRarity.EPIC;
    if (qualityScore >= 61) return CardRarity.ULTRA_RARE;
    if (qualityScore >= 41) return CardRarity.RARE;
    if (qualityScore >= 21) return CardRarity.UNCOMMON;
    return CardRarity.COMMON;
  }

  /**
   * Detect lore category from article categories and content
   */
  private detectCategory(articleData: any): string {
    const categories = articleData.categories || [];
    const text = (articleData.text || "").toLowerCase();
    const _title = (articleData.title || "").toLowerCase();

    // Check categories first
    for (const cat of categories) {
      const catTitle = (cat.title || "").toLowerCase();

      if (
        catTitle.includes("people") ||
        catTitle.includes("politician") ||
        catTitle.includes("leader") ||
        catTitle.includes("historical figure")
      ) {
        return LORE_CATEGORIES.HISTORICAL_FIGURES;
      }

      if (
        catTitle.includes("cit") ||
        catTitle.includes("place") ||
        catTitle.includes("geography") ||
        catTitle.includes("location")
      ) {
        return LORE_CATEGORIES.LOCATIONS;
      }

      if (
        catTitle.includes("war") ||
        catTitle.includes("battle") ||
        catTitle.includes("event") ||
        catTitle.includes("history")
      ) {
        return LORE_CATEGORIES.EVENTS;
      }

      if (
        catTitle.includes("culture") ||
        catTitle.includes("tradition") ||
        catTitle.includes("heritage")
      ) {
        return LORE_CATEGORIES.CULTURE;
      }

      if (
        catTitle.includes("mythology") ||
        catTitle.includes("legend") ||
        catTitle.includes("folklore")
      ) {
        return LORE_CATEGORIES.MYTHOLOGY;
      }

      if (
        catTitle.includes("artifact") ||
        catTitle.includes("monument") ||
        catTitle.includes("architecture")
      ) {
        return LORE_CATEGORIES.ARTIFACTS;
      }
    }

    // Fallback: detect from content
    if (
      text.includes("was born") ||
      text.includes("politician") ||
      text.includes("leader") ||
      text.includes("president") ||
      text.includes("prime minister")
    ) {
      return LORE_CATEGORIES.HISTORICAL_FIGURES;
    }

    if (
      text.includes("city") ||
      text.includes("located in") ||
      text.includes("capital") ||
      text.includes("region")
    ) {
      return LORE_CATEGORIES.LOCATIONS;
    }

    if (
      text.includes("war") ||
      text.includes("battle") ||
      text.includes("conflict") ||
      text.includes("occurred on")
    ) {
      return LORE_CATEGORIES.EVENTS;
    }

    // Default to culture
    return LORE_CATEGORIES.CULTURE;
  }

  /**
   * Extract artwork/image from article
   */
  private extractArtwork(articleData: any, _wikiSource: WikiSource): string {
    // Use original image from API if available
    if (articleData.image) {
      return articleData.image;
    }

    // Fallback to placeholder SVG
    return "/images/cards/lore-placeholder.svg";
  }

  /**
   * Generate summary from article extract (limit 200 chars)
   */
  private generateSummary(extract: string): string {
    if (!extract) return "A historical article from the wiki archives.";

    // Clean up extract
    let summary = extract.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    // Limit to 200 characters
    if (summary.length > 200) {
      summary = summary.substring(0, 197) + "...";
    }

    return summary;
  }

  /**
   * Calculate standard card stats (economic/diplomatic/military/social)
   * based on article quality metrics and category-specific weighting.
   */
  private calculateStats(
    quality: ArticleQuality,
    qualityScore: number,
    category: string
  ): {
    economic: number;
    diplomatic: number;
    military: number;
    social: number;
  } {
    const basePower = qualityScore;
    const refPower = Math.min(quality.referenceCount * 8, 100);
    const linkPower = Math.min(quality.inboundLinks * 5, 100);
    const featuredBonus = quality.isFeatured ? 20 : 0;

    const weights = CATEGORY_STAT_WEIGHTS[category] ?? CATEGORY_STAT_WEIGHTS.default!;

    return {
      economic: Math.round(
        Math.min(basePower * weights.economic + refPower * 0.15 + featuredBonus * 0.1, 100)
      ),
      diplomatic: Math.round(
        Math.min(basePower * weights.diplomatic + linkPower * 0.2 + featuredBonus * 0.15, 100)
      ),
      military: Math.round(Math.min(basePower * weights.military + refPower * 0.1, 100)),
      social: Math.round(
        Math.min(basePower * weights.social + linkPower * 0.15 + featuredBonus * 0.2, 100)
      ),
    };
  }

  /**
   * Calculate lore-specific metrics for display in the Lore tab.
   */
  private calculateLoreStats(quality: ArticleQuality): {
    historicalSignificance: number;
    culturalImpact: number;
  } {
    const historicalSignificance = Math.min(
      (quality.referenceCount * 10 + quality.inboundLinks * 5) / 2,
      100
    );
    const culturalImpact = Math.min(quality.inboundLinks * 10 + (quality.isFeatured ? 50 : 0), 100);
    return {
      historicalSignificance: Math.round(historicalSignificance),
      culturalImpact: Math.round(culturalImpact),
    };
  }

  /**
   * Build wiki URL for article
   */
  private buildWikiUrl(articleTitle: string, wikiSource: WikiSource): string {
    const baseUrls = {
      ixwiki: "https://ixwiki.com/wiki",
      iiwiki: "https://iiwiki.com/wiki",
    };

    return `${baseUrls[wikiSource]}/${encodeURIComponent(articleTitle)}`;
  }

  /**
   * Create card in database from candidate
   */
  async createCard(candidate: LoreCardCandidate): Promise<string> {
    const card = await db.card.create({
      data: {
        title: candidate.title,
        description: candidate.description,
        artwork: candidate.artwork,
        cardType: CardType.LORE,
        rarity: candidate.rarity,
        season: 1, // TODO: Use current season
        wikiSource: candidate.wikiSource,
        wikiArticleTitle: candidate.wikiArticleTitle,
        stats: candidate.stats,
        metadata: {
          wikiUrl: candidate.wikiUrl,
          category: candidate.category,
          qualityScore: candidate.qualityScore,
          loreStats: candidate.loreStats,
          fullExcerpt: candidate.fullExcerpt,
        },
        totalSupply: 0, // Unlimited for lore cards
        marketValue: this.getBaseMarketValue(candidate.rarity),
      },
    });

    console.log(`[Lore Card Generator] Created card ${card.id} for "${candidate.title}"`);
    return card.id;
  }

  /**
   * Get base market value by rarity
   */
  private getBaseMarketValue(rarity: CardRarity): number {
    const baseValues = {
      [CardRarity.COMMON]: 5,
      [CardRarity.UNCOMMON]: 15,
      [CardRarity.RARE]: 40,
      [CardRarity.ULTRA_RARE]: 100,
      [CardRarity.EPIC]: 250,
      [CardRarity.LEGENDARY]: 600,
    };

    return baseValues[rarity];
  }

  /**
   * Check if a wiki article has a page image
   */
  private async checkArticleHasImage(title: string, wikiSource: WikiSource): Promise<boolean> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "pageimages");
      url.searchParams.set("piprop", "original");

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });
      if (!response.ok) return false;

      const data = await response.json();
      const page = Object.values(data.query?.pages ?? {})[0] as any;
      return !!page?.original?.source;
    } catch {
      return false;
    }
  }

  /**
   * Fetch random articles that have images, for lore card generation.
   * Fetches extra candidates to account for articles without images.
   */
  async fetchRandomArticlesWithImages(count: number, wikiSource: WikiSource): Promise<string[]> {
    const candidates = await this.fetchRandomArticles(count * 3, wikiSource);
    const withImages: string[] = [];

    for (const title of candidates) {
      if (withImages.length >= count) break;
      const hasImage = await this.checkArticleHasImage(title, wikiSource);
      if (hasImage) withImages.push(title);
    }

    return withImages;
  }

  /**
   * Fetch random articles from wiki for card generation
   */
  async fetchRandomArticles(count: number, wikiSource: WikiSource): Promise<string[]> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("list", "random");
      url.searchParams.set("rnnamespace", "0"); // Main namespace only
      url.searchParams.set("rnlimit", count.toString());

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        console.error(`[Lore Card Generator] Random articles fetch error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const articles = data.query?.random || [];

      return articles.map((article: any) => article.title);
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching random articles:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const wikiLoreCardGenerator = new WikiLoreCardGenerator();
