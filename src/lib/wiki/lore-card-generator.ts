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
import { getCurrentIxCardSeason } from "~/lib/ixcard-season";
import type { WikiSource } from "./config";
import { getMediaWikiApiUrl, getWikiUserAgent } from "./config";
import { LORE_CATEGORIES } from "~/lib/lore-card-constants";
import { getValuationConfig, computeCardValue, type CardValuationConfig } from "~/lib/card-valuation";
import type { CardAuthorInfo } from "~/types/cards-display";
import { LoreCategory, classifyLoreArticle, type LoreCategory as LoreCategoryType } from "~/lib/cards";

// Re-export for backwards compatibility
export { LORE_CATEGORIES };
export type { CardAuthorInfo };

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
  category: LoreCategoryType;
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
  authorInfo?: CardAuthorInfo;
}

/**
 * Lightweight article metadata for discovery/preview (no full generateCard fetch).
 */
export interface ArticleMetadataPreview {
  title: string;
  hasImage: boolean;
  imageUrl: string | null;
  length: number; // page length in bytes (cheap size proxy from prop=info)
  extract: string;
  categoryCount: number;
  category?: LoreCategoryType;
  estimatedQuality: number;
  estimatedRarity: CardRarity;
  estimatedValue: number; // catalog value in IxCredits at the estimated rarity (LORE card)
  authorInfo?: CardAuthorInfo | null;
}

// Stub floor: an article must have at least this many cleaned-text chars to become a card.
// Image presence is the primary gate; this just skips near-empty stubs.
// ponytail: lone knob — raise to be pickier, lower to generate from shorter pages.
const MIN_ARTICLE_LENGTH = 600;

export const BOT_REGEX =
  /^(.*bot|mediawiki default|maintenance script|adminimport|importbot|uploadwizard|system|anonymous)$/i;

/**
 * Clean a wiki username by stripping import prefixes, namespaces, and brackets
 */
export function cleanWikiUsername(username: string | null | undefined): string {
  if (!username) return "";
  let clean = String(username).trim();
  // Strip MediaWiki XML import dump prefixes: "imported>", "Imported>", "import>", "Import>"
  clean = clean.replace(/^(?:imported|import)\s*>\s*/i, "").trim();
  // Strip "User:" or "user:" namespace prefix
  clean = clean.replace(/^user:\s*/i, "").trim();
  // Strip wiki links [[User:Foo|Foo]] or [[Foo]]
  clean = clean.replace(/^\[\[(?:[^|\]]*\|)?([^\]]+)\]\]$/g, "$1").trim();
  // Strip enclosing quotes
  clean = clean.replace(/^["']|["']$/g, "").trim();
  return clean;
}

/**
 * Category-based stat weights for lore cards.
 * Each category emphasizes different stats based on thematic relevance.
 */
const CATEGORY_STAT_WEIGHTS: Record<
  string,
  { economic: number; diplomatic: number; military: number; social: number }
> = {
  [LoreCategory.PEOPLE]: { economic: 0.15, diplomatic: 0.4, military: 0.15, social: 0.3 },
  [LoreCategory.GEOGRAPHY]: { economic: 0.4, diplomatic: 0.2, military: 0.15, social: 0.25 },
  [LoreCategory.MILITARY]: { economic: 0.1, diplomatic: 0.2, military: 0.55, social: 0.15 },
  [LoreCategory.DIPLOMACY]: { economic: 0.2, diplomatic: 0.5, military: 0.1, social: 0.2 },
  [LoreCategory.GOVERNMENT]: { economic: 0.25, diplomatic: 0.35, military: 0.15, social: 0.25 },
  [LoreCategory.ECONOMY]: { economic: 0.55, diplomatic: 0.2, military: 0.1, social: 0.15 },
  [LoreCategory.SCIENCE]: { economic: 0.35, diplomatic: 0.15, military: 0.2, social: 0.3 },
  [LoreCategory.RELIGION]: { economic: 0.1, diplomatic: 0.25, military: 0.15, social: 0.5 },
  [LoreCategory.CULTURE]: { economic: 0.15, diplomatic: 0.25, military: 0.1, social: 0.5 },
  [LoreCategory.HISTORY]: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
  [LoreCategory.NATION]: { economic: 0.3, diplomatic: 0.3, military: 0.2, social: 0.2 },
  [LoreCategory.SPECIAL]: { economic: 0.25, diplomatic: 0.25, military: 0.25, social: 0.25 },
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
        throw new Error(`Article "${articleTitle}" was not found or could not be loaded from ${wikiSource}.`);
      }

      // Check image requirement
      if (options?.requireImage && !articleData.image) {
        throw new Error(`Article "${articleTitle}" has no usable images (image requirement enabled).`);
      }

      // Check if card already exists
      const exists = await this.checkCardExists(articleTitle, wikiSource);
      if (exists) {
        throw new Error(`A lore card for "${articleTitle}" (${wikiSource}) already exists in the collection.`);
      }

      // Calculate quality score
      const quality = this.analyzeArticleQuality(articleData);

      // Minimal floor: skip near-empty stubs (image is the gate, this drops one-liners)
      if (quality.length < MIN_ARTICLE_LENGTH) {
        throw new Error(
          `Article "${articleTitle}" is too short (${quality.length} chars; minimum is ${MIN_ARTICLE_LENGTH} chars).`
        );
      }

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

      // Extract author info if available
      const authorInfo = articleData.authorInfo as CardAuthorInfo | undefined;

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
        authorInfo,
      };

      console.log(
        `[Lore Card Generator] Generated ${rarity} card for "${articleTitle}" ` +
          `(quality: ${qualityScore.toFixed(1)}, category: ${category})`
      );

      return candidate;
    } catch (error) {
      console.error(`[Lore Card Generator] Error generating card for "${articleTitle}":`, error);
      throw error;
    }
  }

  /**
   * Fetch article data from wiki API
   */
  async fetchArticleData(title: string, wikiSource: WikiSource): Promise<any | null> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      // Fetch article content with infobox, metadata, and contributors
      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "extracts|pageimages|info|categories|links|revisions|images|contributors");
      url.searchParams.set("exchars", "2000"); // Get first ~2000 chars for full excerpt
      url.searchParams.set("exlimit", "1");
      url.searchParams.set("explaintext", "1"); // Plain text
      url.searchParams.set("piprop", "original|name"); // Get original image and name
      url.searchParams.set("pithumbsize", "500"); // Thumbnail size
      url.searchParams.set("inprop", "url");
      url.searchParams.set("cllimit", "50"); // Get up to 50 categories
      url.searchParams.set("pllimit", "500"); // Get up to 500 links (inbound indicator)
      url.searchParams.set("rvprop", "content|timestamp|user|comment"); // Get full wikitext, user, and timestamp
      url.searchParams.set("imlimit", "10"); // Get up to 10 images
      url.searchParams.set("pclimit", "10"); // Get up to 10 contributors

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) {
        throw new Error(`MediaWiki API returned HTTP ${response.status} (${response.statusText || "Error"}) on ${wikiSource}.`);
      }

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) {
        throw new Error(`MediaWiki response contained no page data.`);
      }

      const page = Object.values(pages)[0] as any;
      if (page.missing !== undefined) {
        throw new Error(`Article "${title}" does not exist on ${wikiSource}. Check title spelling/casing.`);
      }
      if (page.invalid !== undefined) {
        throw new Error(`Article title "${title}" is invalid: ${page.invalidreason || "bad characters"}`);
      }

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
            (filename.endsWith(".jpg") ||
              filename.endsWith(".jpeg") ||
              filename.endsWith(".png") ||
              filename.endsWith(".svg"))
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

      // Extract author information (query earliest revision for creator)
      let creator = "";
      let createdAt = "";
      let isBotFiltered = false;

      try {
        const creatorUrl = new URL(apiUrl);
        creatorUrl.searchParams.set("action", "query");
        creatorUrl.searchParams.set("format", "json");
        creatorUrl.searchParams.set("titles", title);
        creatorUrl.searchParams.set("prop", "revisions");
        creatorUrl.searchParams.set("rvdir", "newer");
        creatorUrl.searchParams.set("rvlimit", "5");
        creatorUrl.searchParams.set("rvprop", "user|timestamp|comment");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const creatorRes = await fetch(creatorUrl.toString(), {
          headers: { "User-Agent": userAgent },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (creatorRes.ok) {
          const creatorData = await creatorRes.json();
          const creatorPage = Object.values(creatorData.query?.pages ?? {})[0] as any;
          const earlyRevs = (creatorPage?.revisions || []) as Array<{ user: string; timestamp: string }>;
          for (const r of earlyRevs) {
            const u = cleanWikiUsername(r.user);
            if (u && !BOT_REGEX.test(u)) {
              creator = u;
              createdAt = r.timestamp;
              break;
            } else if (u && BOT_REGEX.test(u)) {
              isBotFiltered = true;
            }
          }
        }
      } catch (err) {
        console.warn(`[Lore Card Generator] Earliest revision lookup failed for "${title}":`, err);
      }

      // Fallback: check latest revision user from main query
      if (!creator && page.revisions?.length > 0) {
        for (const r of page.revisions) {
          const u = cleanWikiUsername(r.user);
          if (u && !BOT_REGEX.test(u)) {
            creator = u;
            createdAt = r.timestamp;
            break;
          }
        }
      }

      // 2. Primary Contributor
      const contributors = (page.contributors || []) as Array<{ name: string; editcount?: number }>;
      let primaryContributor: string | null = null;
      for (const c of contributors) {
        const u = cleanWikiUsername(c.name);
        if (u && (!creator || u.toLowerCase() !== creator.toLowerCase()) && !BOT_REGEX.test(u)) {
          primaryContributor = u;
          break;
        }
      }

      // If creator was empty, promote primary contributor to creator
      if (!creator && primaryContributor) {
        creator = primaryContributor;
        primaryContributor = null;
      }

      if (!creator) {
        creator = "Unknown";
      }

      const displayAuthor = primaryContributor
        ? `${creator} (Created) • ${primaryContributor} (Top Editor)`
        : creator;

      const authorInfo: CardAuthorInfo = {
        creator,
        createdAt: createdAt || undefined,
        primaryContributor,
        contributorCount: contributors.length,
        displayAuthor,
        isBotFiltered,
      };

      return {
        ...page,
        authorInfo,
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
   * Lightweight batched metadata for many articles — ONE request per <=50 titles.
   * Used for discovery/preview so we don't run the full generateCard fetch per article
   * (that per-article storm tripped the wiki's rate limit). estimatedQuality/Rarity reuse
   * the real scorers with the cheap signals available here; the exact score is recomputed
   * in generateCard at actual generation time.
   */
  /**
   * Lightweight batched metadata for many articles — ONE request per <=50 titles.
   */
  async fetchArticleMetadataBatch(
    titles: string[],
    wikiSource: WikiSource
  ): Promise<ArticleMetadataPreview[]> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const out: ArticleMetadataPreview[] = [];
    const valuationCfg = await getValuationConfig(db);

    const authorsMap = await this.fetchArticleAuthorInfoBatch(titles, wikiSource);

    // MediaWiki caps titles at 50 per query; chunk and run a few chunks at a time.
    const chunks: string[][] = [];
    for (let i = 0; i < titles.length; i += 50) chunks.push(titles.slice(i, i + 50));

    const CONCURRENCY = 3;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const results = await Promise.all(
        chunks.slice(i, i + CONCURRENCY).map(async (chunk) => {
          const url = new URL(apiUrl);
          url.searchParams.set("action", "query");
          url.searchParams.set("format", "json");
          url.searchParams.set("titles", chunk.join("|"));
          url.searchParams.set("prop", "pageimages|info|extracts|categories");
          url.searchParams.set("piprop", "original");
          url.searchParams.set("exintro", "1");
          url.searchParams.set("explaintext", "1");
          url.searchParams.set("exlimit", "max");
          url.searchParams.set("cllimit", "50");
          try {
            const res = await fetch(url.toString(), { headers: { "User-Agent": userAgent } });
            if (!res.ok) {
              console.error(`[Lore Card Generator] Metadata batch error: ${res.status}`);
              return [] as ArticleMetadataPreview[];
            }
            const data = await res.json();
            const pages = Object.values(data.query?.pages ?? {}) as any[];
            return pages
              .filter((p) => !p.missing)
              .map((p) => {
                const titleKey = (p.title || "").replace(/_/g, " ").trim().toLowerCase();
                const authorInfo = authorsMap.get(titleKey) || null;
                return this.toMetadataPreview(p, valuationCfg, authorInfo);
              });
          } catch (e) {
            console.error(`[Lore Card Generator] Metadata batch fetch failed:`, e);
            return [] as ArticleMetadataPreview[];
          }
        })
      );
      for (const r of results) out.push(...r);
    }
    return out;
  }

  private toMetadataPreview(
    page: any,
    cfg: CardValuationConfig,
    authorInfo?: CardAuthorInfo | null
  ): ArticleMetadataPreview {
    const extract: string = page.extract || "";
    const length: number = page.length ?? extract.length;
    const categoryCount: number = page.categories?.length ?? 0;
    const quality: ArticleQuality = {
      length,
      referenceCount: 0,
      inboundLinks: 0,
      categoryCount,
      hasInfobox: length > 4000,
      isFeatured: false,
      lastModified: new Date(),
    };
    const estimatedQuality = this.calculateQualityScore(quality);
    const estimatedRarity = this.determineRarity(estimatedQuality);
    const category = classifyLoreArticle({
      title: page.title,
      text: extract,
      categories: page.categories,
    });
    return {
      title: (page.title || "").replace(/_/g, " "),
      hasImage: !!page.original?.source,
      imageUrl: page.original?.source ?? null,
      length,
      extract,
      categoryCount,
      category,
      estimatedQuality,
      estimatedRarity,
      estimatedValue: computeCardValue({ rarity: estimatedRarity, cardType: "LORE" }, cfg),
      authorInfo: authorInfo ?? null,
    };
  }

  /**
   * Batched author information extractor (Page Creator + Primary Contributor)
   * Queries MediaWiki per title with concurrent pooling to avoid invalidparammix on multi-title queries.
   */
  async fetchArticleAuthorInfoBatch(
    titles: string[],
    wikiSource: WikiSource
  ): Promise<Map<string, CardAuthorInfo>> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const resultMap = new Map<string, CardAuthorInfo>();

    if (titles.length === 0) return resultMap;

    const uniqueTitles = Array.from(
      new Set(titles.map((t) => t.trim()).filter((t) => t.length > 0))
    );

    // Concurrently process titles in chunks of 8
    const CHUNK_SIZE = 8;
    for (let i = 0; i < uniqueTitles.length; i += CHUNK_SIZE) {
      const slice = uniqueTitles.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        slice.map(async (title) => {
          const url = new URL(apiUrl);
          url.searchParams.set("action", "query");
          url.searchParams.set("format", "json");
          url.searchParams.set("titles", title);
          url.searchParams.set("prop", "revisions|contributors");
          url.searchParams.set("rvdir", "newer");
          url.searchParams.set("rvlimit", "5");
          url.searchParams.set("rvprop", "user|timestamp|comment");
          url.searchParams.set("pclimit", "10");

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url.toString(), {
              headers: { "User-Agent": userAgent },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) return;
            const data = await res.json();
            const pages = Object.values(data.query?.pages ?? {}) as any[];
            if (pages.length === 0) return;

            const p = pages[0];
            if (p.missing) return;

            // 1. Page Creator
            const revs = (p.revisions || []) as Array<{ user: string; timestamp: string }>;
            let creator = "";
            let createdAt = "";
            let isBotFiltered = false;

            for (const r of revs) {
              const u = cleanWikiUsername(r.user);
              if (u && !BOT_REGEX.test(u)) {
                creator = u;
                createdAt = r.timestamp;
                break;
              } else if (u && BOT_REGEX.test(u)) {
                isBotFiltered = true;
              }
            }

            if (!creator && revs.length > 0 && revs[0].user) {
              const u = cleanWikiUsername(revs[0].user);
              if (u) {
                creator = u;
                createdAt = revs[0].timestamp;
              }
            }

            // 2. Primary Contributor
            const contributors = (p.contributors || []) as Array<{ name: string; editcount?: number }>;
            let primaryContributor: string | null = null;
            for (const c of contributors) {
              const u = cleanWikiUsername(c.name);
              if (u && (!creator || u.toLowerCase() !== creator.toLowerCase()) && !BOT_REGEX.test(u)) {
                primaryContributor = u;
                break;
              }
            }

            // If creator was empty or filtered out, promote top contributor to creator
            if (!creator && primaryContributor) {
              creator = primaryContributor;
              primaryContributor = null;
            }

            if (!creator) {
              creator = "Unknown";
            }

            // 3. Formatted display string
            const displayAuthor = primaryContributor
              ? `${creator} (Created) • ${primaryContributor} (Top Editor)`
              : creator;

            const info: CardAuthorInfo = {
              creator,
              createdAt: createdAt || undefined,
              primaryContributor,
              contributorCount: contributors.length,
              displayAuthor,
              isBotFiltered,
            };

            // Register under multiple lookup keys to ensure cache hits
            const keys = [
              title,
              title.toLowerCase(),
              title.replace(/_/g, " ").trim().toLowerCase(),
              title.replace(/ /g, "_").trim().toLowerCase(),
              p.title,
              (p.title || "").toLowerCase(),
              (p.title || "").replace(/_/g, " ").trim().toLowerCase(),
              (p.title || "").replace(/ /g, "_").trim().toLowerCase(),
            ];

            if (data.query?.normalized) {
              for (const n of data.query.normalized) {
                if (n.from) keys.push(n.from, n.from.toLowerCase(), n.from.replace(/_/g, " ").trim().toLowerCase());
                if (n.to) keys.push(n.to, n.to.toLowerCase(), n.to.replace(/_/g, " ").trim().toLowerCase());
              }
            }

            if (data.query?.redirects) {
              for (const r of data.query.redirects) {
                if (r.from) keys.push(r.from, r.from.toLowerCase(), r.from.replace(/_/g, " ").trim().toLowerCase());
                if (r.to) keys.push(r.to, r.to.toLowerCase(), r.to.replace(/_/g, " ").trim().toLowerCase());
              }
            }

            for (const k of keys) {
              if (k) resultMap.set(k, info);
            }
          } catch (e) {
            console.error(`[Lore Card Generator] Author info fetch failed for "${title}":`, e);
          }
        })
      );
    }

    return resultMap;
  }

  /**
   * List page titles in a live wiki category (namespace-0 pages and files, with paging).
   */
  async fetchCategoryMembers(
    category: string,
    wikiSource: WikiSource,
    limit = 10000,
    type: "page" | "file" | "page|file" = "page|file"
  ): Promise<string[]> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const cmtitle = category.startsWith("Category:") ? category : `Category:${category}`;
    const titles: string[] = [];
    let cmcontinue: string | undefined;

    do {
      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("list", "categorymembers");
      url.searchParams.set("cmtitle", cmtitle);
      url.searchParams.set("cmtype", type);
      url.searchParams.set("cmlimit", "500");
      if (cmcontinue) url.searchParams.set("cmcontinue", cmcontinue);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": userAgent },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.error(`[Lore Card Generator] categorymembers error: ${res.status}`);
          break;
        }
        const data = await res.json();
        for (const m of data.query?.categorymembers ?? []) {
          if (m.title) titles.push(m.title as string);
        }
        cmcontinue = data.continue?.cmcontinue;
      } catch (e) {
        console.error(`[Lore Card Generator] categorymembers fetch failed:`, e);
        break;
      }
    } while (cmcontinue && titles.length < limit);

    return titles.slice(0, limit);
  }

  /**
   * Search live wiki categories by prefix — feeds the discovery category picker.
   */
  async searchCategories(prefix: string, wikiSource: WikiSource, limit = 20): Promise<string[]> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const url = new URL(apiUrl);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("list", "allcategories");
    url.searchParams.set("acprefix", prefix);
    url.searchParams.set("aclimit", String(Math.min(Math.max(limit, 1), 100)));
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error(`[Lore Card Generator] allcategories error: ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.query?.allcategories ?? []).map((c: any) => c["*"] as string);
    } catch (e) {
      console.error(`[Lore Card Generator] allcategories fetch failed:`, e);
      return [];
    }
  }

  /**
   * Fetch category statistics (size, pages, files, subcats) for categories
   */
  async getCategoriesInfo(
    categories: string[],
    wikiSource: WikiSource
  ): Promise<Record<string, { size: number; pages: number; files: number; subcats: number }>> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const result: Record<string, { size: number; pages: number; files: number; subcats: number }> = {};

    const formattedTitles = categories
      .map((c) => (c.startsWith("Category:") ? c : `Category:${c}`))
      .slice(0, 50);

    if (formattedTitles.length === 0) return result;

    const url = new URL(apiUrl);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("prop", "categoryinfo");
    url.searchParams.set("titles", formattedTitles.join("|"));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        for (const pageId in data.query?.pages ?? {}) {
          const p = data.query.pages[pageId];
          const rawTitle = p.title?.replace(/^Category:\s*/i, "") || "";
          if (p.categoryinfo) {
            result[rawTitle] = p.categoryinfo;
            result[p.title] = p.categoryinfo;
          }
        }
      }
    } catch (e) {
      console.warn("[Lore Card Generator] getCategoriesInfo failed:", e);
    }

    return result;
  }

  /**
   * List all pages in the main namespace (namespace 0, excluding redirects).
   */
  async fetchAllMainNamespacePages(
    wikiSource: WikiSource,
    limit = 10000
  ): Promise<string[]> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);
    const titles: string[] = [];
    let apcontinue: string | undefined;

    do {
      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("list", "allpages");
      url.searchParams.set("apnamespace", "0");
      url.searchParams.set("apfilterredir", "nonredirects");
      url.searchParams.set("aplimit", "500");
      if (apcontinue) url.searchParams.set("apcontinue", apcontinue);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": userAgent },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.error(`[Lore Card Generator] allpages error: ${res.status}`);
          break;
        }
        const data = await res.json();
        for (const p of data.query?.allpages ?? []) {
          if (p.title) titles.push(p.title as string);
        }
        apcontinue = data.continue?.apcontinue;
      } catch (e) {
        console.error(`[Lore Card Generator] allpages fetch failed:`, e);
        break;
      }
    } while (apcontinue && titles.length < limit);

    return titles.slice(0, limit);
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
  async getImageUrl(filename: string, wikiSource: WikiSource): Promise<string | null> {

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
  private detectCategory(articleData: any): LoreCategoryType {
    return classifyLoreArticle({
      title: articleData.title,
      text: articleData.text || articleData.extract,
      categories: articleData.categories,
    });
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

    // Strip raw templates and infoboxes while preserving wikitext links and bold formatting
    let summary = extract
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\{\{[\s\S]*$/g, "")
      .replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!summary) summary = "A historical article from the wiki archives.";

    // Limit to 250 characters
    if (summary.length > 250) {
      summary = summary.substring(0, 247) + "...";
      // Clean up unclosed wikitext links if cut off mid-link
      const openCount = (summary.match(/\[\[/g) || []).length;
      const closeCount = (summary.match(/\]\]/g) || []).length;
      if (openCount > closeCount) {
        summary = summary.replace(/\[\[[^\]]*$/, "") + "...";
      }
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
      ixwiki: `${process.env.BASE_PATH || ""}/w`,
      iiwiki: "https://iiwiki.com/w",
      althistory: "https://althistory.fandom.com/wiki",
    };

    return `${baseUrls[wikiSource]}/${encodeURIComponent(articleTitle)}`;
  }

  /**
   * Create card in database from candidate
   */
  async createCard(candidate: LoreCardCandidate): Promise<string> {
    const season = await getCurrentIxCardSeason(db);
    const card = await db.card.create({
      data: {
        title: candidate.title,
        description: candidate.description,
        artwork: candidate.artwork,
        category: candidate.category as any,
        cardType: CardType.LORE,
        rarity: candidate.rarity,
        season,
        wikiSource: candidate.wikiSource,
        wikiArticleTitle: candidate.wikiArticleTitle,
        stats: candidate.stats,
        metadata: {
          wikiUrl: candidate.wikiUrl,
          category: candidate.category,
          qualityScore: candidate.qualityScore,
          loreStats: candidate.loreStats,
          fullExcerpt: candidate.fullExcerpt,
          ...(candidate.authorInfo ? { authorInfo: candidate.authorInfo as any } : {}),
          ...(candidate.authorInfo?.displayAuthor ? { author: candidate.authorInfo.displayAuthor } : {}),
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
    // One request: `generator=random` returns random pages and `prop=pageimages` tells
    // us which have an image — no per-article checkArticleHasImage loop. That loop made
    // 1 + 3N sequential calls and tripped the wiki's rate limit (429). Over-fetch via
    // grnlimit to cover pages without an image.
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("generator", "random");
      url.searchParams.set("grnnamespace", "0");
      url.searchParams.set("grnlimit", String(Math.min(count * 3, 50)));
      url.searchParams.set("prop", "pageimages");
      url.searchParams.set("piprop", "original");
      url.searchParams.set("pilimit", "max");

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });
      if (!response.ok) {
        console.error(`[Lore Card Generator] Random+images fetch error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const pages = Object.values(data.query?.pages ?? {}) as any[];
      return pages
        .filter((p) => p?.original?.source)
        .map((p) => p.title as string)
        .slice(0, count);
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching random articles with images:`, error);
      return [];
    }
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
