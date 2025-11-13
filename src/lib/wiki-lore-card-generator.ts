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
  artwork: string;
  rarity: CardRarity;
  wikiSource: string;
  wikiArticleTitle: string;
  wikiUrl: string;
  category: string;
  stats: {
    historicalSignificance: number;
    culturalImpact: number;
    rarity: number;
    preserved: number;
  };
  qualityScore: number;
}

/**
 * Lore card categories
 */
export const LORE_CATEGORIES = {
  HISTORICAL_FIGURES: "Historical Figures",
  LOCATIONS: "Geographical Locations",
  EVENTS: "Historical Events",
  ARTIFACTS: "Cultural Artifacts",
  CULTURE: "Cultural Heritage",
  MYTHOLOGY: "Mythology & Legends",
} as const;

/**
 * Wiki Lore Card Generator Service
 */
export class WikiLoreCardGenerator {
  /**
   * Generate a lore card from a wiki article
   */
  async generateCard(
    articleTitle: string,
    wikiSource: WikiSource
  ): Promise<LoreCardCandidate | null> {
    try {
      console.log(`[Lore Card Generator] Generating card for "${articleTitle}" from ${wikiSource}`);

      // Fetch article data
      const articleData = await this.fetchArticleData(articleTitle, wikiSource);
      if (!articleData) {
        console.warn(`[Lore Card Generator] Article "${articleTitle}" not found`);
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

      // Generate summary
      const description = this.generateSummary(articleData.extract || articleData.text);

      // Calculate stats
      const stats = this.calculateStats(quality, qualityScore);

      // Build wiki URL
      const wikiUrl = this.buildWikiUrl(articleTitle, wikiSource);

      const candidate: LoreCardCandidate = {
        title: articleTitle.replace(/_/g, " "),
        description,
        artwork,
        rarity,
        wikiSource,
        wikiArticleTitle: articleTitle,
        wikiUrl,
        category,
        stats,
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
  private async fetchArticleData(
    title: string,
    wikiSource: WikiSource
  ): Promise<any | null> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      // Fetch article content with infobox and metadata
      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "extracts|pageimages|info|categories|links|revisions");
      url.searchParams.set("exintro", "1"); // Get intro only for summary
      url.searchParams.set("explaintext", "1"); // Plain text
      url.searchParams.set("piprop", "original"); // Get original image
      url.searchParams.set("inprop", "url");
      url.searchParams.set("cllimit", "50"); // Get up to 50 categories
      url.searchParams.set("pllimit", "500"); // Get up to 500 links (inbound indicator)
      url.searchParams.set("rvprop", "content|timestamp"); // Get full wikitext and timestamp

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

      return {
        title: page.title,
        extract: page.extract,
        text: page.revisions?.[0]?.["*"] || "",
        image: page.original?.source,
        categories: page.categories || [],
        links: page.links || [],
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
   * Check if lore card already exists for this article
   */
  private async checkCardExists(
    articleTitle: string,
    wikiSource: WikiSource
  ): Promise<boolean> {
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
    // Count references ({{cite}} templates, <ref> tags)
    const text = articleData.text || "";
    const refMatches = text.match(/<ref[^>]*>|{{cite/gi) || [];
    const referenceCount = refMatches.length;

    // Check for infobox
    const hasInfobox = /{{infobox/i.test(text);

    // Check if featured (has {{featured}} template or in Featured category)
    const isFeatured =
      /{{featured/i.test(text) ||
      articleData.categories?.some((cat: any) =>
        cat.title?.toLowerCase().includes("featured")
      );

    return {
      length: text.length,
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
    const title = (articleData.title || "").toLowerCase();

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
  private extractArtwork(articleData: any, wikiSource: WikiSource): string {
    // Use original image from API if available
    if (articleData.image) {
      return articleData.image;
    }

    // Fallback to placeholder based on category
    return "/images/cards/lore-placeholder.png";
  }

  /**
   * Generate summary from article extract (limit 200 chars)
   */
  private generateSummary(extract: string): string {
    if (!extract) return "A historical article from the wiki archives.";

    // Clean up extract
    let summary = extract
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to 200 characters
    if (summary.length > 200) {
      summary = summary.substring(0, 197) + "...";
    }

    return summary;
  }

  /**
   * Calculate card stats based on quality
   */
  private calculateStats(
    quality: ArticleQuality,
    qualityScore: number
  ): {
    historicalSignificance: number;
    culturalImpact: number;
    rarity: number;
    preserved: number;
  } {
    // Historical significance (0-100) - based on references and inbound links
    const historicalSignificance = Math.min(
      (quality.referenceCount * 10 + quality.inboundLinks * 5) / 2,
      100
    );

    // Cultural impact (0-100) - based on inbound links and featured status
    const culturalImpact = Math.min(
      quality.inboundLinks * 10 + (quality.isFeatured ? 50 : 0),
      100
    );

    // Rarity stat matches quality score
    const rarity = qualityScore;

    // Preserved is always 100 for lore cards
    const preserved = 100;

    return {
      historicalSignificance: Math.round(historicalSignificance),
      culturalImpact: Math.round(culturalImpact),
      rarity: Math.round(rarity),
      preserved,
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
        metadata: {
          wikiUrl: candidate.wikiUrl,
          stats: candidate.stats,
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
   * Fetch random articles from wiki for card generation
   */
  async fetchRandomArticles(
    count: number,
    wikiSource: WikiSource
  ): Promise<string[]> {
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
