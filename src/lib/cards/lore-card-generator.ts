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
import { CardType, CardRarity, Prisma } from "@prisma/client";
import { getCurrentIxCardSeason } from "./season";
import { archivedTitlesAmong, withoutArchivedTitles } from "~/lib/wiki-os/core/archived-titles";
import { CategoryService } from "~/lib/wiki-os/core/category-service";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";
import type { WikiSource } from "~/lib/wiki-os/config";
import type {
  MediaWikiPageItem,
  MediaWikiCategoryItem,
  MediaWikiAllCategoriesItem,
} from "~/lib/wiki-os/types";
import { LORE_CATEGORIES } from "~/lib/lorewards";
import { getValuationConfig, computeCardValue, type CardValuationConfig } from "./valuation";
import type { CardAuthorInfo } from "~/types/cards-display";
import { LoreCategory, type LoreCategory as LoreCategoryType } from "./category-enums";
import { classifyLoreArticle } from "./category-classifier";
import { BOT_REGEX, cleanWikiUsername } from "./lore-card-author-info";
import {
  CATEGORY_STAT_WEIGHTS,
  buildAuthorInfo,
  firstPage,
  mwQuery,
  pickCreator,
  type MwPage,
  type RevisionUser,
} from "./lore-card-mediawiki";
import {
  ixwikiAuthorInfo,
  ixwikiCategoryTitles,
  ixwikiImageUrls,
  ixwikiMainNamespaceTitles,
  ixwikiRandomTitles,
  loadIxwikiArticle,
  loadIxwikiPreviews,
} from "./lore-card-ixwiki";

// Re-export for backwards compatibility
export { LORE_CATEGORIES };

interface ArticleQuality {
  length: number;
  referenceCount: number;
  inboundLinks: number;
  categoryCount: number;
  hasInfobox: boolean;
  isFeatured: boolean;
  lastModified: Date;
}

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

/** Lightweight article metadata for discovery/preview (no full generateCard fetch). */
interface ArticleMetadataPreview {
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

/** Lookup keys an article title may be requested under (raw, lowercase, spaced, underscored). */
const titleKeys = (title: string | undefined, underscored = false) =>
  title
    ? [
        title,
        title.toLowerCase(),
        title.replace(/_/g, " ").trim().toLowerCase(),
        ...(underscored ? [title.replace(/ /g, "_").trim().toLowerCase()] : []),
      ]
    : [];

const FILE_IMAGE = /\.(jpe?g|png|svg)$/;
const NON_ARTICLE_IMAGE = /icon|flag|logo/;

const RARITY_THRESHOLDS: Array<[minScore: number, rarity: CardRarity]> = [
  [96, CardRarity.LEGENDARY],
  [81, CardRarity.EPIC],
  [61, CardRarity.ULTRA_RARE],
  [41, CardRarity.RARE],
  [21, CardRarity.UNCOMMON],
];

const BASE_MARKET_VALUE: Record<string, number> = {
  [CardRarity.COMMON]: 5,
  [CardRarity.UNCOMMON]: 15,
  [CardRarity.RARE]: 40,
  [CardRarity.ULTRA_RARE]: 100,
  [CardRarity.EPIC]: 250,
  [CardRarity.LEGENDARY]: 600,
};

const WIKI_URL_BASES: Record<string, string> = {
  ixwiki: `${process.env.BASE_PATH || ""}/w`,
  iiwiki: "https://iiwiki.com/w",
  althistory: "https://althistory.fandom.com/wiki",
};

const INFOBOX_PATTERN = /\{\{infobox[^}]*(?:\{\{[^}]*\}\}[^}]*)*\}\}/i;
const PLACEHOLDER_SUMMARY = "A historical article from the wiki archives.";

/** IxWiki card data: from Postgres once WikiOS v1 is on, from MediaWiki before it (v1-switch.ts). */
const readsPostgres = (wikiSource: WikiSource) => wikiSource === "ixwiki" && isWikiosV1Enabled();

class WikiLoreCardGenerator {
  /** Generate a lore card candidate from a wiki article; throws a descriptive error when it can't. */
  async generateCard(
    articleTitle: string,
    wikiSource: WikiSource,
    options?: { requireImage?: boolean }
  ): Promise<LoreCardCandidate | null> {
    try {
      console.log(`[Lore Card Generator] Generating card for "${articleTitle}" from ${wikiSource}`);

      const articleData = await this.fetchArticleData(articleTitle, wikiSource);
      if (!articleData) {
        throw new Error(
          `Article "${articleTitle}" was not found or could not be loaded from ${wikiSource}.`
        );
      }
      if (options?.requireImage && !articleData.image) {
        throw new Error(
          `Article "${articleTitle}" has no usable images (image requirement enabled).`
        );
      }
      if (await this.checkCardExists(articleTitle, wikiSource)) {
        throw new Error(
          `A lore card for "${articleTitle}" (${wikiSource}) already exists in the collection.`
        );
      }

      const quality = this.analyzeArticleQuality(articleData);

      // Minimal floor: skip near-empty stubs (image is the gate, this drops one-liners)
      if (quality.length < MIN_ARTICLE_LENGTH) {
        throw new Error(
          `Article "${articleTitle}" is too short (${quality.length} chars; minimum is ${MIN_ARTICLE_LENGTH} chars).`
        );
      }

      const qualityScore = this.calculateQualityScore(quality);
      const rarity = this.determineRarity(qualityScore);
      const category = this.detectCategory(articleData);

      // Short summary for the card face, longer excerpt for the lore tab
      const rawExcerpt = articleData.extract || articleData.text || "";

      const candidate: LoreCardCandidate = {
        title: articleTitle.replace(/_/g, " "),
        description: this.generateSummary(rawExcerpt),
        fullExcerpt: rawExcerpt.slice(0, 2000).trim(),
        artwork: articleData.image || "/images/cards/lore-placeholder.svg",
        rarity,
        wikiSource,
        wikiArticleTitle: articleTitle,
        wikiUrl: `${WIKI_URL_BASES[wikiSource]}/${encodeURIComponent(articleTitle)}`,
        category,
        stats: this.calculateStats(quality, qualityScore, category),
        loreStats: this.calculateLoreStats(quality),
        qualityScore,
        authorInfo: articleData.authorInfo as CardAuthorInfo | undefined,
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

  /** Article content, infobox, featured image, backlinks and author info from the wiki API. */
  private async fetchArticleData(title: string, wikiSource: WikiSource): Promise<any | null> {
    if (readsPostgres(wikiSource)) return this.fetchIxwikiArticleData(title);
    try {
      // MediaWiki may still have a page WikiOS deleted: it is not a card's source.
      if ((await archivedTitlesAmong([title], wikiSource)).size > 0) return null;
      const response = await mwQuery(wikiSource, {
        titles: title,
        prop: "extracts|pageimages|info|categories|links|revisions|images|contributors",
        exchars: "2000", // first ~2000 chars for the full excerpt
        exlimit: "1",
        explaintext: "1",
        piprop: "original|name",
        pithumbsize: "500",
        inprop: "url",
        cllimit: "50",
        pllimit: "500", // up to 500 links (inbound indicator)
        rvprop: "content|timestamp|user|comment", // full wikitext, user, and timestamp
        imlimit: "10",
        pclimit: "10", // up to 10 contributors
      });
      if (!response.ok) {
        throw new Error(
          `MediaWiki API returned HTTP ${response.status} (${response.statusText || "Error"}) on ${wikiSource}.`
        );
      }

      const data = await response.json();
      if (!data.query?.pages) throw new Error(`MediaWiki response contained no page data.`);

      const page = firstPage<MwPage & { invalidreason?: string }>(data)!;
      if (page.missing !== undefined) {
        throw new Error(
          `Article "${title}" does not exist on ${wikiSource}. Check title spelling/casing.`
        );
      }
      if (page.invalid !== undefined) {
        throw new Error(
          `Article title "${title}" is invalid: ${page.invalidreason || "bad characters"}`
        );
      }

      const wikitext = page.revisions?.[0]?.["*"] || "";
      const infoboxData = this.parseInfobox(wikitext);

      const featuredImage = await this.resolveFeaturedImage(page, infoboxData, wikiSource);

      const backlinksResponse = await mwQuery(wikiSource, {
        list: "backlinks",
        bltitle: title,
        bllimit: "500",
      });
      const inboundLinks = backlinksResponse.ok
        ? (await backlinksResponse.json()).query?.backlinks?.length || 0
        : 0;

      return {
        ...page,
        authorInfo: await this.lookupAuthorInfo(page, title, wikiSource),
        text: this.removeTemplates(wikitext),
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

  /** Featured image: the page image, else the infobox image, else the first real image in the article. */
  private async resolveFeaturedImage(
    page: MwPage,
    infobox: Record<string, string>,
    wikiSource: WikiSource
  ): Promise<string | undefined> {
    if (page.original?.source) return page.original.source;
    if (infobox.image) {
      const url = await this.getImageUrl(infobox.image, wikiSource);
      if (url) return url;
    }
    const firstImage = page.images?.find((img: { title?: string }) => {
      const filename = img.title?.toLowerCase() || "";
      return !NON_ARTICLE_IMAGE.test(filename) && FILE_IMAGE.test(filename);
    });
    return firstImage?.title
      ? ((await this.getImageUrl(firstImage.title, wikiSource)) ?? undefined)
      : undefined;
  }

  /** Creator: earliest non-bot editor, else the first non-bot editor among the fetched revisions. */
  private async lookupAuthorInfo(page: MwPage, title: string, wikiSource: WikiSource) {
    let found = { creator: "", createdAt: "", isBotFiltered: false };
    try {
      const creatorRes = await mwQuery(
        wikiSource,
        {
          titles: title,
          prop: "revisions",
          rvdir: "newer",
          rvlimit: "5",
          rvprop: "user|timestamp|comment",
        },
        8000
      );
      if (creatorRes.ok) {
        const early = firstPage<MediaWikiPageItem>(await creatorRes.json())?.revisions;
        found = pickCreator((early || []) as RevisionUser[]);
      }
    } catch (err) {
      console.warn(`[Lore Card Generator] Earliest revision lookup failed for "${title}":`, err);
    }
    if (!found.creator) {
      for (const r of page.revisions ?? []) {
        const user = cleanWikiUsername(r.user);
        if (user && !BOT_REGEX.test(user)) {
          found = { ...found, creator: user, createdAt: r.timestamp ?? new Date().toISOString() };
          break;
        }
      }
    }
    return buildAuthorInfo(found, (page.contributors || []) as Array<{ name: string }>);
  }

  /**
   * Lightweight batched metadata for many articles — ONE request per <=50 titles.
   * Used for discovery/preview so we don't run the full generateCard fetch per article
   * (that per-article storm tripped the wiki's rate limit). estimatedQuality/Rarity reuse
   * the real scorers with the cheap signals available here; the exact score is recomputed
   * in generateCard at actual generation time.
   */
  async fetchArticleMetadataBatch(
    requestedTitles: string[],
    wikiSource: WikiSource
  ): Promise<ArticleMetadataPreview[]> {
    if (readsPostgres(wikiSource)) return this.fetchIxwikiMetadataBatch(requestedTitles);
    // MediaWiki may still have a page WikiOS deleted: it is neither asked about nor previewed.
    const titles = await withoutArchivedTitles(requestedTitles, wikiSource);
    const valuationCfg = await getValuationConfig(db);
    const authorsMap = await this.fetchArticleAuthorInfoBatch(titles, wikiSource);

    const fetchChunk = async (chunk: string[]): Promise<ArticleMetadataPreview[]> => {
      try {
        const res = await mwQuery(wikiSource, {
          titles: chunk.join("|"),
          prop: "pageimages|info|extracts|categories",
          piprop: "original",
          exintro: "1",
          explaintext: "1",
          exlimit: "max",
          cllimit: "50",
        });
        if (!res.ok) {
          console.error(`[Lore Card Generator] Metadata batch error: ${res.status}`);
          return [];
        }
        const data = await res.json();
        const pages = Object.values(data.query?.pages ?? {}) as Array<
          MediaWikiPageItem & { missing?: boolean; extract?: string; length?: number }
        >;
        return pages
          .filter((p) => !p.missing)
          .map((p) => {
            const titleKey = (p.title || "").replace(/_/g, " ").trim().toLowerCase();
            return this.toMetadataPreview(p, valuationCfg, authorsMap.get(titleKey) || null);
          });
      } catch (e) {
        console.error(`[Lore Card Generator] Metadata batch fetch failed:`, e);
        return [];
      }
    };

    // MediaWiki caps titles at 50 per query; chunk and run a few chunks at a time.
    const chunks: string[][] = [];
    for (let i = 0; i < titles.length; i += 50) chunks.push(titles.slice(i, i + 50));

    const out: ArticleMetadataPreview[] = [];
    const CONCURRENCY = 3;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const results = await Promise.all(chunks.slice(i, i + CONCURRENCY).map(fetchChunk));
      out.push(...results.flat());
    }
    return out;
  }

  /** A published IxWiki page's card data, from Postgres (MediaWiki is not asked); null when missing or deleted. */
  private async fetchIxwikiArticleData(title: string) {
    try {
      const article = await loadIxwikiArticle(title);
      if (!article) return null;
      const { wikitext, ...rest } = article;
      return {
        ...rest,
        text: this.removeTemplates(wikitext),
        rawText: wikitext,
        infobox: this.parseInfobox(wikitext),
        links: [],
      };
    } catch (error) {
      console.error(`[Lore Card Generator] Error reading article "${title}":`, error);
      return null;
    }
  }

  /** Previews of published IxWiki pages from Postgres, in the order asked. */
  private async fetchIxwikiMetadataBatch(titles: string[]): Promise<ArticleMetadataPreview[]> {
    const [pages, valuationCfg, authors] = await Promise.all([
      loadIxwikiPreviews(titles),
      getValuationConfig(db),
      ixwikiAuthorInfo(titles),
    ]);
    return pages.map((page) =>
      this.toMetadataPreview(
        {
          title: page.title,
          extract: page.extract,
          length: page.length,
          categories: page.categories,
          original: page.imageUrl ? { source: page.imageUrl } : undefined,
        },
        valuationCfg,
        authors.get(page.title.replace(/_/g, " ").trim().toLowerCase()) ?? null
      )
    );
  }

  private toMetadataPreview(
    page: MediaWikiPageItem & { extract?: string; length?: number },
    cfg: CardValuationConfig,
    authorInfo?: CardAuthorInfo | null
  ): ArticleMetadataPreview {
    const extract: string = page.extract || "";
    const length: number = page.length ?? extract.length;
    const categoryCount: number = page.categories?.length ?? 0;
    const estimatedQuality = this.calculateQualityScore({
      length,
      referenceCount: 0,
      inboundLinks: 0,
      categoryCount,
      hasInfobox: length > 4000,
      isFeatured: false,
      lastModified: new Date(),
    });
    const estimatedRarity = this.determineRarity(estimatedQuality);
    return {
      title: (page.title || "").replace(/_/g, " "),
      hasImage: !!page.original?.source,
      imageUrl: page.original?.source ?? null,
      length,
      extract,
      categoryCount,
      category: classifyLoreArticle({
        title: page.title,
        text: extract,
        categories: page.categories,
      }),
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
    if (readsPostgres(wikiSource)) return ixwikiAuthorInfo(titles);
    const resultMap = new Map<string, CardAuthorInfo>();
    const uniqueTitles = Array.from(
      new Set(titles.map((t) => t.trim()).filter((t) => t.length > 0))
    );

    const fetchOne = async (title: string) => {
      try {
        const res = await mwQuery(
          wikiSource,
          {
            titles: title,
            prop: "revisions|contributors",
            rvdir: "newer",
            rvlimit: "5",
            rvprop: "user|timestamp|comment",
            pclimit: "10",
          },
          10000
        );
        if (!res.ok) return;
        const data = await res.json();
        const p = firstPage<MediaWikiPageItem>(data);
        if (!p || p.missing) return;

        const revs = (p.revisions || []) as RevisionUser[];
        let found = pickCreator(revs);
        // Everything filtered as a bot: credit the very first editor anyway
        const firstEditor = revs[0]?.user && cleanWikiUsername(revs[0].user);
        if (!found.creator && firstEditor) {
          found = { ...found, creator: firstEditor, createdAt: revs[0]!.timestamp };
        }
        const info = buildAuthorInfo(found, (p.contributors || []) as Array<{ name: string }>);

        // Register under every spelling the title may be looked up by (incl. normalizations/redirects)
        const aliases = [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])];
        const keys = [
          ...titleKeys(title, true),
          ...titleKeys(p.title, true),
          ...aliases.flatMap((a: { from?: string; to?: string }) => [
            ...titleKeys(a.from),
            ...titleKeys(a.to),
          ]),
        ];
        for (const key of keys) resultMap.set(key, info);
      } catch (e) {
        console.error(`[Lore Card Generator] Author info fetch failed for "${title}":`, e);
      }
    };

    // Concurrently process titles in chunks of 8
    const CHUNK_SIZE = 8;
    for (let i = 0; i < uniqueTitles.length; i += CHUNK_SIZE) {
      await Promise.all(uniqueTitles.slice(i, i + CHUNK_SIZE).map(fetchOne));
    }
    return resultMap;
  }

  /** Page titles from a paged `list=` query, up to `limit`. */
  private async listAll(
    wikiSource: WikiSource,
    params: Record<string, string>,
    listKey: string,
    continueKey: string,
    limit: number
  ): Promise<string[]> {
    const titles: string[] = [];
    let cont: string | undefined;
    do {
      try {
        const res = await mwQuery(
          wikiSource,
          { ...params, ...(cont && { [continueKey]: cont }) },
          12000
        );
        if (!res.ok) {
          console.error(`[Lore Card Generator] ${params.list} error: ${res.status}`);
          break;
        }
        const data = await res.json();
        for (const m of data.query?.[listKey] ?? []) {
          if (m.title) titles.push(m.title as string);
        }
        cont = data.continue?.[continueKey];
      } catch (e) {
        console.error(`[Lore Card Generator] ${params.list} fetch failed:`, e);
        break;
      }
    } while (cont && titles.length < limit);
    return withoutArchivedTitles(titles.slice(0, limit), wikiSource);
  }

  /** List page titles in a live wiki category (namespace-0 pages and files, with paging). */
  fetchCategoryMembers(
    category: string,
    wikiSource: WikiSource,
    limit = 10000,
    type: "page" | "file" | "page|file" = "page|file"
  ): Promise<string[]> {
    if (readsPostgres(wikiSource)) {
      const kinds: Array<"page" | "file"> = type === "page|file" ? ["page", "file"] : [type];
      return ixwikiCategoryTitles(category, kinds, limit);
    }
    const cmtitle = category.startsWith("Category:") ? category : `Category:${category}`;
    return this.listAll(
      wikiSource,
      { list: "categorymembers", cmtitle, cmtype: type, cmlimit: "500" },
      "categorymembers",
      "cmcontinue",
      limit
    );
  }

  /** List all pages in the main namespace (namespace 0, excluding redirects). */
  fetchAllMainNamespacePages(wikiSource: WikiSource, limit = 10000): Promise<string[]> {
    if (readsPostgres(wikiSource)) return ixwikiMainNamespaceTitles(limit);
    return this.listAll(
      wikiSource,
      { list: "allpages", apnamespace: "0", apfilterredir: "nonredirects", aplimit: "500" },
      "allpages",
      "apcontinue",
      limit
    );
  }

  /** Search live wiki categories by prefix — feeds the discovery category picker. */
  async searchCategories(prefix: string, wikiSource: WikiSource, limit = 20): Promise<string[]> {
    if (readsPostgres(wikiSource)) {
      return CategoryService.autocomplete(prefix, Math.min(Math.max(limit, 1), 100));
    }
    try {
      const res = await mwQuery(
        wikiSource,
        {
          list: "allcategories",
          acprefix: prefix,
          aclimit: String(Math.min(Math.max(limit, 1), 100)),
        },
        8000
      );
      if (!res.ok) {
        console.error(`[Lore Card Generator] allcategories error: ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.query?.allcategories ?? []).map(
        (c: MediaWikiAllCategoriesItem) => (c["*"] || c.title || "") as string
      );
    } catch (e) {
      console.error(`[Lore Card Generator] allcategories fetch failed:`, e);
      return [];
    }
  }

  /** Category statistics (size, pages, files, subcats). */
  async getCategoriesInfo(
    categories: string[],
    wikiSource: WikiSource
  ): Promise<Record<string, { size: number; pages: number; files: number; subcats: number }>> {
    const result: Record<string, { size: number; pages: number; files: number; subcats: number }> =
      {};
    if (readsPostgres(wikiSource)) {
      const names = categories.map((c) => c.replace(/^Category:\s*/i, "")).slice(0, 50);
      for (const [name, { pages, files, subcats }] of await CategoryService.getCounts(names)) {
        const counts = { size: pages + files + subcats, pages, files, subcats };
        result[name] = result[`Category:${name}`] = counts;
      }
      return result;
    }
    const formattedTitles = categories
      .map((c) => (c.startsWith("Category:") ? c : `Category:${c}`))
      .slice(0, 50);
    if (formattedTitles.length === 0) return result;

    try {
      const res = await mwQuery(
        wikiSource,
        { prop: "categoryinfo", titles: formattedTitles.join("|") },
        10000
      );
      if (res.ok) {
        const data = await res.json();
        for (const p of Object.values<any>(data.query?.pages ?? {})) {
          if (!p.categoryinfo) continue;
          result[p.title?.replace(/^Category:\s*/i, "") || ""] = p.categoryinfo;
          result[p.title] = p.categoryinfo;
        }
      }
    } catch (e) {
      console.warn("[Lore Card Generator] getCategoriesInfo failed:", e);
    }
    return result;
  }

  /** Infobox fields (lowercased keys, templates/links/HTML stripped) from wikitext. */
  private parseInfobox(wikitext: string): Record<string, string> {
    const infobox: Record<string, string> = {};
    const infoboxText = wikitext.match(INFOBOX_PATTERN)?.[0];
    if (!infoboxText) return infobox;

    for (const line of infoboxText.split("\n")) {
      const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.+?)\s*$/);
      if (!match) continue;
      const key = match[1]?.trim().toLowerCase() || "";
      const value = (match[2]?.trim() || "")
        .replace(/\{\{[^}]*\}\}/g, "") // templates
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // link text
        .replace(/<[^>]+>/g, "") // HTML tags
        .trim();
      if (value && key) infobox[key] = value;
    }
    return infobox;
  }

  /** Wikitext without templates (the infobox is preserved out of the way, then dropped) or refs. */
  private removeTemplates(wikitext: string): string {
    let cleaned = wikitext;
    const infobox = wikitext.match(INFOBOX_PATTERN);
    const placeholder = "___INFOBOX_PLACEHOLDER___";
    if (infobox) cleaned = cleaned.replace(infobox[0], placeholder);

    // Remove remaining templates, innermost first, until stable
    let previous = "";
    while (previous !== cleaned) {
      previous = cleaned;
      cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, "");
    }
    if (infobox) cleaned = cleaned.replace(placeholder, "");

    return cleaned.replace(/<ref[^>]*>.*?<\/ref>/gi, "").replace(/<ref[^>]*\/>/gi, "");
  }

  /** Image URL from a file name: IxWiki's from Postgres, a sister wiki's via its MediaWiki API. */
  private async getImageUrl(filename: string, wikiSource: WikiSource): Promise<string | null> {
    if (readsPostgres(wikiSource)) {
      const name = filename.replace(/^(File|Image):/i, "");
      return (await ixwikiImageUrls([name])).get(name) ?? null;
    }
    try {
      const response = await mwQuery(wikiSource, {
        titles: `File:${filename.replace(/^(File|Image):/i, "")}`,
        prop: "imageinfo",
        iiprop: "url",
      });
      if (!response.ok) return null;

      const data = await response.json();
      return firstPage<MediaWikiPageItem>(data)?.imageinfo?.[0]?.url || null;
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching image URL:`, error);
      return null;
    }
  }

  private async checkCardExists(articleTitle: string, wikiSource: WikiSource): Promise<boolean> {
    const existing = await db.card.findFirst({
      where: { wikiArticleTitle: articleTitle, wikiSource, cardType: CardType.LORE },
    });
    return !!existing;
  }

  private analyzeArticleQuality(
    articleData: MediaWikiPageItem & {
      rawText?: string;
      text?: string;
      inboundLinks?: number;
      lastModified?: Date;
    }
  ): ArticleQuality {
    // Raw text for template/reference detection, cleaned text for length
    const rawText = articleData.rawText || articleData.text || "";
    const isFeatured =
      /{{featured/i.test(rawText) ||
      (articleData.categories?.some((cat: MediaWikiCategoryItem) =>
        cat.title?.toLowerCase().includes("featured")
      ) ??
        false);

    return {
      length: (articleData.text || "").length,
      referenceCount: (rawText.match(/<ref[^>]*>|{{cite/gi) || []).length,
      inboundLinks: articleData.inboundLinks || 0,
      categoryCount: articleData.categories?.length || 0,
      hasInfobox: /{{infobox/i.test(rawText),
      isFeatured,
      lastModified: articleData.lastModified ?? new Date(),
    };
  }

  /** Quality score (0-100): length, references, inbound links, featured/infobox/category bonuses. */
  private calculateQualityScore(quality: ArticleQuality): number {
    const score =
      Math.min((quality.length / 1000) * 0.3, 30) +
      Math.min(quality.referenceCount * 5 * 0.3, 30) +
      Math.min(quality.inboundLinks * 2 * 0.2, 20) +
      (quality.isFeatured ? 20 : 0) +
      (quality.hasInfobox ? 5 : 0) +
      Math.min(quality.categoryCount * 0.5, 5);
    return Math.min(score, 100);
  }

  private determineRarity(qualityScore: number): CardRarity {
    return RARITY_THRESHOLDS.find(([min]) => qualityScore >= min)?.[1] ?? CardRarity.COMMON;
  }

  private detectCategory(
    articleData: MediaWikiPageItem & { text?: string; extract?: string }
  ): LoreCategoryType {
    return classifyLoreArticle({
      title: articleData.title,
      text: articleData.text || articleData.extract || "",
      categories: (articleData.categories || []).map((c) => ({ title: c.title || "" })),
    });
  }

  /** Card-face summary from the article extract: templates stripped, whitespace collapsed, <= 250 chars. */
  private generateSummary(extract: string): string {
    if (!extract) return PLACEHOLDER_SUMMARY;

    let summary =
      extract
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/\{\{[\s\S]*$/g, "")
        .replace(/(?:Template|template)\s*:[^\n.<|\]}]*/gi, "")
        .replace(/\s+/g, " ")
        .trim() || PLACEHOLDER_SUMMARY;

    if (summary.length > 250) {
      summary = summary.substring(0, 247) + "...";
      // Drop an unclosed wikitext link left by the cut
      const openCount = (summary.match(/\[\[/g) || []).length;
      const closeCount = (summary.match(/\]\]/g) || []).length;
      if (openCount > closeCount) summary = summary.replace(/\[\[[^\]]*$/, "") + "...";
    }
    return summary;
  }

  /** Economic/diplomatic/military/social stats from quality metrics and category-specific weights. */
  private calculateStats(quality: ArticleQuality, qualityScore: number, category: string) {
    const basePower = qualityScore;
    const refPower = Math.min(quality.referenceCount * 8, 100);
    const linkPower = Math.min(quality.inboundLinks * 5, 100);
    const featuredBonus = quality.isFeatured ? 20 : 0;
    const weights = CATEGORY_STAT_WEIGHTS[category] ?? CATEGORY_STAT_WEIGHTS.default!;

    const stat = (value: number) => Math.round(Math.min(value, 100));
    return {
      economic: stat(basePower * weights.economic + refPower * 0.15 + featuredBonus * 0.1),
      diplomatic: stat(basePower * weights.diplomatic + linkPower * 0.2 + featuredBonus * 0.15),
      military: stat(basePower * weights.military + refPower * 0.1),
      social: stat(basePower * weights.social + linkPower * 0.15 + featuredBonus * 0.2),
    };
  }

  /** Lore-specific metrics for the Lore tab. */
  private calculateLoreStats(quality: ArticleQuality) {
    return {
      historicalSignificance: Math.round(
        Math.min((quality.referenceCount * 10 + quality.inboundLinks * 5) / 2, 100)
      ),
      culturalImpact: Math.round(
        Math.min(quality.inboundLinks * 10 + (quality.isFeatured ? 50 : 0), 100)
      ),
    };
  }

  /** Create the card in the database from a candidate. */
  async createCard(candidate: LoreCardCandidate): Promise<string> {
    const season = await getCurrentIxCardSeason(db);
    const card = await db.card.create({
      data: {
        title: candidate.title,
        description: candidate.description,
        artwork: candidate.artwork,
        category: candidate.category as LoreCategory,
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
          ...(candidate.authorInfo
            ? { authorInfo: candidate.authorInfo as unknown as Prisma.InputJsonValue }
            : {}),
          ...(candidate.authorInfo?.displayAuthor
            ? { author: candidate.authorInfo.displayAuthor }
            : {}),
        },
        totalSupply: 0, // Unlimited for lore cards
        marketValue: BASE_MARKET_VALUE[candidate.rarity]!,
      },
    });

    console.log(`[Lore Card Generator] Created card ${card.id} for "${candidate.title}"`);
    return card.id;
  }

  /**
   * Random articles that have a page image, for lore card generation. One request:
   * `generator=random` returns random pages and `prop=pageimages` says which have an image
   * (a per-article image check tripped the wiki's rate limit). Over-fetches via grnlimit to
   * cover pages without an image.
   */
  async fetchRandomArticlesWithImages(count: number, wikiSource: WikiSource): Promise<string[]> {
    if (readsPostgres(wikiSource)) return ixwikiRandomTitles(count, { withImage: true });
    try {
      const response = await mwQuery(wikiSource, {
        generator: "random",
        grnnamespace: "0",
        grnlimit: String(Math.min(count * 3, 50)),
        prop: "pageimages",
        piprop: "original",
        pilimit: "max",
      });
      if (!response.ok) {
        console.error(`[Lore Card Generator] Random+images fetch error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const pages = Object.values(data.query?.pages ?? {}) as MwPage[];
      const titles = pages.filter((p) => p?.original?.source).map((p) => p.title as string);
      return withoutArchivedTitles(titles.slice(0, count), wikiSource);
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching random articles with images:`, error);
      return [];
    }
  }

  /** Random main-namespace article titles. */
  async fetchRandomArticles(count: number, wikiSource: WikiSource): Promise<string[]> {
    if (readsPostgres(wikiSource)) return ixwikiRandomTitles(count, { withImage: false });
    try {
      const response = await mwQuery(wikiSource, {
        list: "random",
        rnnamespace: "0",
        rnlimit: count.toString(),
      });
      if (!response.ok) {
        console.error(`[Lore Card Generator] Random articles fetch error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const titles = ((data.query?.random || []) as Array<{ title: string }>).map((a) => a.title);
      return withoutArchivedTitles(titles, wikiSource);
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching random articles:`, error);
      return [];
    }
  }
}

export const wikiLoreCardGenerator = new WikiLoreCardGenerator();
