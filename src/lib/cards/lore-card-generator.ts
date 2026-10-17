/**
 * The lore-card generator: reads a wiki article into a card candidate (summary, excerpt, lead image and its file
 * name, category, quality signals and score, author credit), and previews many articles cheaply for discovery.
 * IxWiki's articles come from Postgres once WikiOS v1 is on; a sister wiki's from its MediaWiki API. It mints
 * nothing: the importer (src/server/modules/cards/cards.importer.ts) decides rarity, realm, licence and review.
 *
 * Usage:
 *   import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
 *   const candidate = await wikiLoreCardGenerator.generateCard("Article_Title", "ixwiki");
 */

import { db } from "~/server/db";
import type { CardRarity } from "@prisma/client";
import { archivedTitlesAmong, withoutArchivedTitles } from "~/lib/wiki-os/core/archived-titles";
import { wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";
import type { MediaWikiPageItem, MediaWikiCategoryItem } from "~/lib/wiki-os/types";
import { LORE_CATEGORIES } from "~/lib/lorewards";
import { getRarityThresholds } from "~/server/modules/cards/cards.config";
import { getValuationConfig, computeCardValue, type CardValuationConfig } from "./valuation";
import type { CardAuthorInfo } from "~/types/cards-display";
import type { LoreCategory as LoreCategoryType } from "./category-enums";
import { classifyLoreArticle } from "./category-classifier";
import { fileNameFromArtworkUrl } from "./art-licence";
import type { CardArticleSource } from "./card-sources";
import { ArticleRejected, type LoreCardCandidate } from "./lore-card-candidate";
import { readsPostgres } from "./lore-card-discovery";
import {
  qualityScore,
  rarityForScore,
  type ArticleSignals,
  type RarityThresholds,
} from "./rarity-engine";
import { BOT_REGEX, cleanWikiUsername } from "./lore-card-author-info";
import {
  buildAuthorInfo,
  firstPage,
  mwQuery,
  pickCreator,
  type MwPage,
  type RevisionUser,
} from "./lore-card-mediawiki";
import {
  ixwikiAuthorInfo,
  ixwikiImageUrls,
  loadIxwikiArticle,
  loadIxwikiPreviews,
} from "./lore-card-ixwiki";

// Re-export for backwards compatibility
export { LORE_CATEGORIES };

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

/** An article as the generator reads it: MediaWiki's page plus what it derived, or the same fields from Postgres. */
interface ArticleData extends MwPage {
  /** Wikitext without templates or references. */
  text: string;
  rawText: string;
  image?: string;
  imageFile?: string | null;
  inboundLinks: number;
  authorInfo?: CardAuthorInfo;
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
/** A file name without its `File:` (or `Image:`) namespace. */
const withoutFileNamespace = (name: string) => name.replace(/^(File|Image):/i, "");

const INFOBOX_PATTERN = /\{\{infobox[^}]*(?:\{\{[^}]*\}\}[^}]*)*\}\}/i;
const PLACEHOLDER_SUMMARY = "A historical article from the wiki archives.";

class WikiLoreCardGenerator {
  /** An article read into a card candidate; throws ArticleRejected when the page cannot become a card. */
  async generateCard(
    articleTitle: string,
    wikiSource: CardArticleSource,
    options: { requireImage?: boolean; minLength?: number } = {}
  ): Promise<LoreCardCandidate> {
    const articleData = await this.fetchArticleData(articleTitle, wikiSource);
    if (!articleData) {
      throw new ArticleRejected(
        "missing",
        `"${articleTitle}" was not found on ${wikiSource}, or could not be loaded.`
      );
    }
    if (options.requireImage && !articleData.image) {
      throw new ArticleRejected("no-image", `"${articleTitle}" has no usable image.`);
    }
    const signals = this.analyzeArticleQuality(articleData);
    const minLength = options.minLength ?? MIN_ARTICLE_LENGTH;
    if (signals.length < minLength) {
      throw new ArticleRejected(
        "too-short",
        `"${articleTitle}" is too short (${signals.length} characters; the minimum is ${minLength}).`
      );
    }
    // Short summary for the card face, longer excerpt for the lore tab
    const rawExcerpt = articleData.extract || articleData.text || "";
    return {
      title: articleTitle.replace(/_/g, " "),
      description: this.generateSummary(rawExcerpt),
      fullExcerpt: rawExcerpt.slice(0, 2000).trim(),
      artwork: articleData.image ?? null,
      imageFile: articleData.imageFile ?? null,
      wikiSource,
      wikiArticleTitle: articleTitle,
      wikiUrl: wikiReaderPath(articleTitle, wikiSource),
      category: this.detectCategory(articleData),
      signals,
      qualityScore: qualityScore(signals),
      authorInfo: articleData.authorInfo,
    };
  }

  /** Article content, infobox, featured image, backlinks and author info from the wiki API. */
  private async fetchArticleData(
    title: string,
    wikiSource: CardArticleSource
  ): Promise<ArticleData | null> {
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

      const featured = await this.resolveFeaturedImage(page, infoboxData, wikiSource);

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
        image: featured?.url,
        imageFile: featured?.file ?? null,
        categories: page.categories || [],
        links: page.links || [],
        images: page.images || [],
        inboundLinks,
      };
    } catch (error) {
      console.error(`[Lore Card Generator] Error fetching article "${title}":`, error);
      return null;
    }
  }

  /** The featured image and its file: the page image, else the infobox image, else the first real image. */
  private async resolveFeaturedImage(
    page: MwPage,
    infobox: Record<string, string>,
    wikiSource: CardArticleSource
  ): Promise<{ url: string; file: string | null } | undefined> {
    if (page.original?.source) {
      const url = page.original.source;
      return { url, file: page.pageimage ?? fileNameFromArtworkUrl(url, wikiSource) };
    }
    if (infobox.image) {
      const url = await this.getImageUrl(infobox.image, wikiSource);
      if (url) return { url, file: withoutFileNamespace(infobox.image) };
    }
    const firstImage = page.images?.find((img: { title?: string }) => {
      const filename = img.title?.toLowerCase() || "";
      return !NON_ARTICLE_IMAGE.test(filename) && FILE_IMAGE.test(filename);
    });
    if (!firstImage?.title) return undefined;
    const url = await this.getImageUrl(firstImage.title, wikiSource);
    return url ? { url, file: withoutFileNamespace(firstImage.title) } : undefined;
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
   * (that per-article storm tripped the wiki's rate limit). estimatedQuality/Rarity use the
   * rarity engine and the source's rarity table with the cheap signals available here; the
   * exact score is recomputed in generateCard at import time.
   */
  async fetchArticleMetadataBatch(
    requestedTitles: string[],
    wikiSource: WikiSource
  ): Promise<ArticleMetadataPreview[]> {
    if (readsPostgres(wikiSource)) return this.fetchIxwikiMetadataBatch(requestedTitles);
    // MediaWiki may still have a page WikiOS deleted: it is neither asked about nor previewed.
    const titles = await withoutArchivedTitles(requestedTitles, wikiSource);
    const valuationCfg = await getValuationConfig(db);
    const thresholds = (await getRarityThresholds(db))[wikiSource];
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
            return this.toMetadataPreview(
              p,
              valuationCfg,
              thresholds,
              authorsMap.get(titleKey) || null
            );
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
  private async fetchIxwikiArticleData(title: string): Promise<ArticleData | null> {
    try {
      const article = await loadIxwikiArticle(title);
      if (!article) return null;
      const { wikitext, ...rest } = article;
      return {
        ...rest,
        text: this.removeTemplates(wikitext),
        rawText: wikitext,
        links: [],
      };
    } catch (error) {
      console.error(`[Lore Card Generator] Error reading article "${title}":`, error);
      return null;
    }
  }

  /** Previews of published IxWiki pages from Postgres, in the order asked. */
  private async fetchIxwikiMetadataBatch(titles: string[]): Promise<ArticleMetadataPreview[]> {
    const [pages, valuationCfg, thresholds, authors] = await Promise.all([
      loadIxwikiPreviews(titles),
      getValuationConfig(db),
      getRarityThresholds(db),
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
        thresholds.ixwiki,
        authors.get(page.title.replace(/_/g, " ").trim().toLowerCase()) ?? null
      )
    );
  }

  private toMetadataPreview(
    page: MediaWikiPageItem & { extract?: string; length?: number },
    cfg: CardValuationConfig,
    thresholds: RarityThresholds,
    authorInfo?: CardAuthorInfo | null
  ): ArticleMetadataPreview {
    const extract: string = page.extract || "";
    const length: number = page.length ?? extract.length;
    const categoryCount: number = page.categories?.length ?? 0;
    const estimatedQuality = qualityScore({
      length,
      referenceCount: 0,
      inboundLinks: 0,
      categoryCount,
      hasInfobox: length > 4000,
      isFeatured: false,
    });
    const estimatedRarity = rarityForScore(estimatedQuality, thresholds);
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
      const name = withoutFileNamespace(filename);
      return (await ixwikiImageUrls([name])).get(name) ?? null;
    }
    try {
      const response = await mwQuery(wikiSource, {
        titles: `File:${withoutFileNamespace(filename)}`,
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

  private analyzeArticleQuality(articleData: ArticleData): ArticleSignals {
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
    };
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
}

export const wikiLoreCardGenerator = new WikiLoreCardGenerator();
