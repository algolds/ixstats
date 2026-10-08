import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { cachedStaticProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import {
  getArticleIntro,
  getPageSections,
  getPageImages as wikiBridgePageImages,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { searchWiki as searchWikiService } from "~/lib/wiki-os/core/native-search-service";
import { parseInfobox as parseInfoboxParser } from "~/lib/wiki-os/transformers/infobox-parser";
import {
  parseInfoboxWithTemplates,
  resolveImageUrl,
  type UnifiedInfoboxData,
} from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { getEligibleCountries } from "~/lib/wiki-os/adapters/ixstates/eligible-country-service";
import { parseRedirect } from "~/lib/wiki-os/core/redirect";
import {
  getWikiBaseUrl,
  parseWikiSource,
  wikiReaderPath,
  type WikiSource,
} from "~/lib/wiki-os/config";

/** Common icon/template image filenames to exclude from media galleries. */
const EXCLUDED_IMAGE_PATTERNS = [
  /^File:Flag.icon/i,
  /^File:Crystal/i,
  /^File:Nuvola/i,
  /^File:Commons-logo/i,
  /^File:Wikisource-logo/i,
  /^File:Wiktionary-logo/i,
  /^File:Symbol /i,
  /^File:Yes ?check/i,
  /^File:X ?mark/i,
  /^File:Increase/i,
  /^File:Decrease/i,
  /^File:Steady/i,
  /^File:Green ?arrow/i,
  /^File:Red ?arrow/i,
  /\.svg$/i,
];

/** Text before the first heading, after dropping a leading infobox template (balanced braces). */
function leadSection(wikitext: string, infoboxPattern: RegExp): string {
  let content = wikitext;
  const infoboxMatch = wikitext.match(infoboxPattern);
  if (infoboxMatch) {
    const startIdx = wikitext.indexOf(infoboxMatch[0]);
    let depth = 0;
    let i = startIdx;
    while (i < wikitext.length - 1) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
        depth++;
        i += 2;
      } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
        depth--;
        i += 2;
        if (depth === 0) break;
      } else {
        i++;
      }
    }
    content = wikitext.substring(i).trim();
  }
  return content.split(/^==/m)[0] || content;
}

/** Strip templates, refs, comments, tables, categories, files and magic words from wikitext. */
function stripCommonWikiMarkup(text: string): string {
  return text
    .replace(/\{\{wp\|[^|}]+\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{wp\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{nowrap\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{convert[^}]*\}\}/gi, "")
    .replace(/\{\{[^}]+\|([^|}]+)\}\}/g, "$1")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[\[Template:[^\]]*\]\]/gi, "")
    .replace(/\[\[Category:[^\]]*\]\]/gi, "")
    .replace(/\[\[File:[^\]]*\]\]/gi, "")
    .replace(/\[\[Image:[^\]]*\]\]/gi, "")
    .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, "")
    .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\{\|.*?\|\}/gs, "")
    .replace(/__[A-Z_]+__/g, "");
}

/**
 * Extract the first paragraph (intro) from wikitext after the infobox.
 * Returns clean plaintext.
 */
function extractWikiIntro(wikitext: string): string | null {
  const beforeFirstHeading = leadSection(wikitext, /\{\{\s*[Ii]nfobox\s/);

  // Clean wikitext to plaintext
  const cleaned = stripCommonWikiMarkup(beforeFirstHeading)
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,3}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&\w+;/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Return first substantial paragraph
  if (cleaned.length > 30) {
    return cleaned.slice(0, 500) + (cleaned.length > 500 ? "..." : "");
  }
  return null;
}

/** Fetch a single wiki intro from ixwiki or iiwiki fallback. */
async function fetchWikiIntro(
  name: string
): Promise<{ extract: string; wikiSource: "ixwiki" | "iiwiki"; wikiUrl: string } | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    try {
      const result = await getArticleIntro(name, wiki);
      if (result?.text) {
        return {
          extract: result.text.substring(0, 400),
          wikiSource: wiki,
          wikiUrl:
            wiki === "ixwiki"
              ? `/wiki/${encodeURIComponent(result.title)}`
              : `https://iiwiki.com/wiki/${encodeURIComponent(result.title)}`,
        };
      }
    } catch (err) {
      console.error(`[Wiki] Error fetching intro for ${name} from ${wiki}:`, err);
    }
  }
  return null;
}

/** Fetch table-of-contents sections from a country's wiki page. */
async function fetchWikiSections(
  name: string
): Promise<Array<{ level: number; line: string; number: string; anchor: string }> | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    try {
      const sections = await getPageSections(name, wiki);
      if (sections && sections.length > 0) {
        return sections.map((s, i) => ({
          level: s.level,
          line: s.title,
          number: String(i + 1),
          anchor: s.title.replace(/\s+/g, "_"),
        }));
      }
    } catch (err) {
      console.error(`[Wiki] Error fetching sections for ${name} from ${wiki}:`, err);
    }
  }
  return null;
}

/**
 * Fetch images from a country's wiki page with thumbnail URLs: IxWiki's page first, then iiwiki's (a
 * page's images are looked up on the wiki the page belongs to, as its intro and sections are).
 */
async function fetchWikiPageImages(name: string): Promise<Array<{
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}> | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    try {
      const images = await wikiBridgePageImages(name, {
        excludePatterns: EXCLUDED_IMAGE_PATTERNS,
        wiki,
      });
      if (images && images.length > 0) return images;
    } catch (err) {
      console.error(`[Wiki] Error fetching page images for ${name} from ${wiki}:`, err);
    }
  }
  return null;
}

/** The wikis a country's name is looked up on when it names no page of its own, in order. */
const NAME_LOOKUP_WIKIS = ["ixwiki", "iiwiki"] as const;

/** A country's own wiki page: realm nations name theirs (`Country.wikiSource` + `wikiPageTitle`). */
interface WikiPageRef {
  title: string;
  wiki: WikiSource;
}

/** The wiki pages of the given countries that name one, by country id. */
async function countryWikiPages(
  db: PrismaClient,
  countryIds: string[]
): Promise<Map<string, WikiPageRef>> {
  if (countryIds.length === 0) return new Map();
  const rows = await db.country.findMany({
    where: { id: { in: countryIds } },
    select: { id: true, wikiSource: true, wikiPageTitle: true },
  });
  return new Map(
    rows.flatMap(({ id, wikiSource, wikiPageTitle }): Array<[string, WikiPageRef]> => {
      const title = wikiPageTitle?.trim();
      return title ? [[id, { title, wiki: parseWikiSource(wikiSource) }]] : [];
    })
  );
}

/** A page's wikitext and the title it was read under, following one redirect to the page it names. */
async function readArticle(
  title: string,
  wiki: WikiSource
): Promise<{ title: string; wikitext: string } | null> {
  const article = await getArticleWikitextShadow(title, wiki);
  const target = parseRedirect(article?.wikitext);
  if (!target) return article ? { title, wikitext: article.wikitext } : null;
  const resolved = await getArticleWikitextShadow(target.title, wiki);
  return resolved ? { title: target.title, wikitext: resolved.wikitext } : null;
}

/** An article's link: IxWiki pages open in the WikiOS reader, a sister wiki's on that wiki. */
function articleUrl(title: string, wiki: WikiSource): string {
  return wiki === "ixwiki"
    ? wikiReaderPath(title)
    : `${getWikiBaseUrl(wiki)}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** The lead's paragraphs as HTML; its wiki links open `wiki`'s pages in the reader. */
function richIntroParagraphs(wikitext: string, wiki: WikiSource): string[] {
  const beforeFirstHeading = leadSection(wikitext, /\{\{\s*Infobox/i);

  // Clean wikitext templates, refs, categories, files
  const cleanContent = stripCommonWikiMarkup(beforeFirstHeading)
    .replace(/\n\n+/g, "|||PARA|||")
    .replace(/[ \t]+/g, " ")
    .replace(/\n/g, " ")
    .trim();

  // Convert wiki links to HTML
  const linkBase = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";
  const processedContent = cleanContent
    .replace(/\[\[([^[\]|]+)\|([^[\]]+?)\]\]/g, (_, pg: string, display: string) => {
      if (pg.toLowerCase().includes("template:")) return "";
      return `<a href="${linkBase}${wikiReaderPath(pg, wiki)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
    })
    .replace(/\[\[([^[\]]+?)\]\]/g, (_, pg: string) => {
      if (pg.toLowerCase().includes("template:")) return "";
      return `<a href="${linkBase}${wikiReaderPath(pg, wiki)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${pg}</a>`;
    })
    .replace(
      /\[([^\s\]]+)\s+([^\]]+)\]/g,
      '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>'
    )
    .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

  // Split into paragraphs, filter short/empty
  return processedContent
    .split("|||PARA|||")
    .map((p) => p.trim())
    .filter((p) => p.length > 50)
    .slice(0, 5);
}

/**
 * Fetch raw wikitext intro, clean it, and convert wiki markup to HTML paragraphs. A country's own page is
 * read on its own wiki; without one, its name is looked up on IxWiki and then on iiwiki.
 */
async function fetchWikiRichIntro(
  name: string,
  page: WikiPageRef | undefined
): Promise<{ paragraphs: string[]; wikiUrl: string } | null> {
  const candidates = page ? [page] : NAME_LOOKUP_WIKIS.map((wiki) => ({ title: name, wiki }));
  for (const { title, wiki } of candidates) {
    try {
      const article = await readArticle(title, wiki);
      if (!article) continue;
      const paragraphs = richIntroParagraphs(article.wikitext, wiki);
      if (paragraphs.length > 0) {
        return { paragraphs, wikiUrl: articleUrl(article.title, wiki) };
      }
    } catch (err) {
      console.error(`[Wiki] Error fetching rich intro for ${title} from ${wiki}:`, err);
    }
  }
  return null;
}

/**
 * Fetch wiki sections with plain-text previews for level-2 headers.
 */
async function fetchWikiSectionPreviews(name: string): Promise<Array<{
  level: number;
  line: string;
  number: string;
  anchor: string;
  preview?: string;
}> | null> {
  const sections = await fetchWikiSections(name);
  if (!sections || sections.length === 0) return null;

  try {
    const article =
      (await getArticleWikitextShadow(name, "ixwiki")) ??
      (await getArticleWikitextShadow(name, "iiwiki"));
    if (!article) return sections.map((s) => ({ ...s, preview: undefined }));

    const wikitext = article.wikitext;
    const results = sections.map((s) => ({ ...s, preview: undefined as string | undefined }));
    const level2Indices = results
      .map((s, i) => (s.level === 2 ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, 10);

    const headingPattern = /^(={2,6})\s*(.+?)\s*\1$/gm;
    const headingPositions: Array<{ title: string; start: number }> = [];
    let m;
    while ((m = headingPattern.exec(wikitext)) !== null) {
      headingPositions.push({ title: m[2]!.trim(), start: m.index + m[0].length });
    }

    for (const idx of level2Indices) {
      const section = results[idx]!;
      const hIdx = headingPositions.findIndex((h) => h.title === section.line);
      if (hIdx < 0) continue;

      const start = headingPositions[hIdx]!.start;
      const end =
        hIdx + 1 < headingPositions.length ? headingPositions[hIdx + 1]!.start - 10 : start + 1000;
      const sectionText = wikitext.substring(start, Math.min(end, start + 1000));

      const cleaned = sectionText
        .replace(/\{\{[^}]*\}\}/g, "")
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
        .replace(/<ref[^>]*\/>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/^==+[^=]+=+\s*/gm, "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (cleaned.length > 20) {
        section.preview = cleaned.slice(0, 200) + (cleaned.length > 200 ? "..." : "");
      }
    }

    return results as Array<{
      level: number;
      line: string;
      number: string;
      anchor: string;
      preview?: string;
    }>;
  } catch (err) {
    console.error(`[Wiki] Error fetching section previews for ${name}:`, err);
    return sections.map((s) => ({ ...s, preview: undefined }));
  }
}

export const wikiProcedures = {
  getWikiIntro: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiIntro(name);
    }),

  getWikiSections: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSections(name);
    }),

  getWikiPageImages: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiPageImages(name);
    }),

  /** `countryId` reads the country's own page when it names one; it is part of the cache key. */
  getWikiRichIntro: cachedStaticProcedure
    .input(z.object({ countryName: z.string(), countryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      const pages = await countryWikiPages(ctx.db, input.countryId ? [input.countryId] : []);
      return fetchWikiRichIntro(name, input.countryId ? pages.get(input.countryId) : undefined);
    }),

  getBulkWikiRichIntros: cachedStaticProcedure
    .input(
      z.object({
        countries: z
          .array(z.object({ countryName: z.string(), countryId: z.string().optional() }))
          .max(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = input.countries
        .map((c) => ({ name: c.countryName.trim(), id: c.countryId }))
        .filter((c) => c.name);
      const ids = countries.flatMap((c) => (c.id ? [c.id] : []));
      const pages = await countryWikiPages(ctx.db, ids);
      const results: Record<string, Awaited<ReturnType<typeof fetchWikiRichIntro>>> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 50. (audit B5)
      await Promise.all(
        countries.map(async ({ name, id }) => {
          results[name] = await fetchWikiRichIntro(name, id ? pages.get(id) : undefined);
        })
      );
      return results;
    }),

  getWikiSectionPreviews: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSectionPreviews(name);
    }),

  searchWiki: rateLimitedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1, "Search query is required"),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
        categoryFilter: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { query, site, categoryFilter } = input;
      try {
        const results = await searchWikiService(query, site, categoryFilter);
        return results;
      } catch (error) {
        console.error("[WikiSearch] Search failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  parseInfobox: rateLimitedPublicProcedure
    .input(
      z.object({
        pageName: z.string().min(1, "Page name is required"),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]),
      })
    )
    .mutation(async ({ input }) => {
      const { pageName, site } = input;
      const cacheKey = `parsed-infobox:${site}:${pageName.trim().toLowerCase()}`;
      try {
        // Try L1/L2 cache first
        const cached = await wikiCacheService.getCustomCache<
          UnifiedInfoboxData & { wikiIntro?: string }
        >(cacheKey);
        if (cached) {
          return cached;
        }

        const article = await getArticleWikitextShadow(pageName, site);
        if (!article) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Could not fetch wikitext for "${pageName}" from ${site}`,
          });
        }

        // Use unified parser with full template processing
        const unified = parseInfoboxWithTemplates(article.wikitext, pageName);
        if (!unified) {
          // Fallback to basic parser
          const parsed = parseInfoboxParser(article.wikitext);
          if (!parsed) return null;
          const result: Record<string, unknown> = { templateName: parsed.templateName };
          for (const field of parsed.fields) {
            result[field.key] = field.cleanValue || field.rawValue;
          }
          await wikiCacheService.setCustomCache(
            cacheKey,
            "parsed-infobox",
            result,
            24 * 60 * 60 * 1000
          );
          return result;
        }

        // Extract wiki intro (first paragraph after infobox)
        const intro = extractWikiIntro(article.wikitext);
        if (intro) {
          unified.wikiIntro = intro;
        }

        // Extract category tags from article wikitext to guide background LoreScanner
        const catMatches =
          article.wikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi) || [];
        const categories = catMatches
          .map((c) =>
            c
              .replace(/^\[\[Category:/i, "")
              .replace(/\]\]$/, "")
              .split("|")[0]
              ?.trim()
          )
          .filter((c): c is string => Boolean(c));
        if (categories.length > 0) {
          unified.categories = categories;
        }
        unified.rawWikitext = article.wikitext;

        // Resolve image URLs
        const wikiSource = site as "ixwiki" | "iiwiki" | "althistory";
        if (unified.image_flag) {
          unified.flagUrl = resolveImageUrl(unified.image_flag, wikiSource);
        }
        if (unified.image_coat || unified.coat_of_arms) {
          unified.coatOfArmsUrl = resolveImageUrl(
            unified.image_coat || unified.coat_of_arms,
            wikiSource
          );
        }

        await wikiCacheService.setCustomCache(
          cacheKey,
          "parsed-infobox",
          unified,
          24 * 60 * 60 * 1000
        );
        return unified;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[WikiParse] Parse failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse infobox: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getEligibleCountries: cachedStaticProcedure
    .input(z.object({ site: z.enum(["iiwiki", "althistory"]) }))
    .query(async ({ input }) => {
      try {
        return await getEligibleCountries(input.site);
      } catch (err) {
        console.error(`[Wiki] Error fetching eligible countries for ${input.site}:`, err);
        return [];
      }
    }),
};
