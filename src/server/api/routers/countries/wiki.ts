import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  cachedStaticProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import {
  getArticleIntro,
  getPageSections,
  getArticleWikitext,
  getPageImages as wikiBridgePageImages,
  getInfobox as wikiBridgeInfobox,
} from "~/lib/wiki-bridge";
import { searchWiki as searchWikiService } from "~/lib/wiki-search-service";
import { parseInfobox as parseInfoboxParser } from "~/lib/wiki-infobox-parser";
import { parseInfoboxWithTemplates, resolveImageUrl } from "~/lib/unified-wiki-parser";
import { getEligibleCountries } from "~/lib/eligible-country-service";
import { wikiCacheService } from "~/lib/services/wiki-cache-service";

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

/**
 * Extract the first paragraph (intro) from wikitext after the infobox.
 * Returns clean plaintext.
 */
function extractWikiIntro(wikitext: string): string | null {
  // Strip infobox template (match balanced braces)
  let contentAfterInfobox = wikitext;
  const infoboxMatch = wikitext.match(/\{\{\s*[Ii]nfobox\s/);
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
    contentAfterInfobox = wikitext.substring(i).trim();
  }

  // Take content before first heading (==)
  const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

  // Clean wikitext to plaintext
  const cleaned = beforeFirstHeading
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
    .replace(/__[A-Z_]+__/g, "")
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
              ? `/w/${encodeURIComponent(result.title)}`
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

/** Fetch images from a country's wiki page with thumbnail URLs. */
async function fetchWikiPageImages(name: string): Promise<Array<{
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}> | null> {
  try {
    return await wikiBridgePageImages(name, { excludePatterns: EXCLUDED_IMAGE_PATTERNS });
  } catch (err) {
    console.error(`[Wiki] Error fetching page images for ${name}:`, err);
    return null;
  }
}

/**
 * Fetch raw wikitext intro, clean it, and convert wiki markup to HTML paragraphs.
 */
async function fetchWikiRichIntro(
  name: string
): Promise<{ paragraphs: string[]; wikiUrl: string } | null> {
  for (const wiki of ["ixwiki", "iiwiki"] as const) {
    try {
      const article = await getArticleWikitext(name, wiki);
      if (!article) continue;

      const wikitext = article.wikitext;
      const wikiUrl =
        wiki === "ixwiki"
          ? `/w/${encodeURIComponent(article.title)}`
          : `https://iiwiki.com/wiki/${encodeURIComponent(article.title)}`;

      // Strip infobox template (match balanced braces)
      let contentAfterInfobox = wikitext;
      const infoboxMatch = wikitext.match(/\{\{\s*Infobox/i);
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
        contentAfterInfobox = wikitext.substring(i).trim();
      }

      // Take content before first heading (==)
      const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

      // Clean wikitext templates, refs, categories, files
      const cleanContent = beforeFirstHeading
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
        .replace(/__[A-Z_]+__/g, "")
        .replace(/\n\n+/g, "|||PARA|||")
        .replace(/[ \t]+/g, " ")
        .replace(/\n/g, " ")
        .trim();

      // Convert wiki links to HTML
      const linkBase = base;
      const processedContent = cleanContent
        .replace(/\[\[([^\[\]|]+)\|([^\[\]]+?)\]\]/g, (_, pg: string, display: string) => {
          if (pg.toLowerCase().includes("template:")) return "";
          return `<a href="${linkBase}/wiki/${encodeURIComponent(pg)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
        })
        .replace(/\[\[([^\[\]]+?)\]\]/g, (_, pg: string) => {
          if (pg.toLowerCase().includes("template:")) return "";
          return `<a href="${linkBase}/wiki/${encodeURIComponent(pg)}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${pg}</a>`;
        })
        .replace(
          /\[([^\s\]]+)\s+([^\]]+)\]/g,
          '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>'
        )
        .replace(/'''([^']*)'''/g, '<strong class="font-semibold text-foreground">$1</strong>')
        .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

      // Split into paragraphs, filter short/empty
      const paragraphs = processedContent
        .split("|||PARA|||")
        .map((p) => p.trim())
        .filter((p) => p.length > 50)
        .slice(0, 5);

      if (paragraphs.length > 0) {
        return { paragraphs, wikiUrl };
      }
    } catch (err) {
      console.error(`[Wiki] Error fetching rich intro for ${name} from ${wiki}:`, err);
      continue;
    }
  }
  return null;
}

/**
 * Fetch wiki infobox server-side via WikiBridge.
 */
async function fetchWikiInfoboxCached(name: string): Promise<Record<string, unknown> | null> {
  try {
    const infobox =
      (await wikiBridgeInfobox(name, "ixwiki")) ?? (await wikiBridgeInfobox(name, "iiwiki"));
    if (!infobox) return null;
    const result: Record<string, unknown> = { templateName: infobox.templateName };
    for (const field of infobox.fields) {
      result[field.key] = field.value;
    }
    return result;
  } catch (err) {
    console.error(`[Wiki] Error fetching infobox for ${name}:`, err);
    return null;
  }
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
      (await getArticleWikitext(name, "ixwiki")) ?? (await getArticleWikitext(name, "iiwiki"));
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

  getBulkWikiIntros: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) return {};
      const results: Record<string, any> = {};
      await Promise.all(
        names.map(async (n) => {
          results[n] = await fetchWikiIntro(n);
        })
      );
      return results;
    }),

  getWikiSections: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiSections(name);
    }),

  getBulkWikiSections: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, any> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 50. (audit B5)
      await Promise.all(
        names.map(async (name) => {
          results[name] = await fetchWikiSections(name);
        })
      );
      return results;
    }),

  getWikiPageImages: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiPageImages(name);
    }),

  getBulkWikiPageImages: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, any> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 30. (audit B5)
      await Promise.all(
        names.map(async (name) => {
          results[name] = await fetchWikiPageImages(name);
        })
      );
      return results;
    }),

  getWikiRichIntro: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiRichIntro(name);
    }),

  getBulkWikiRichIntros: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, any> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 50. (audit B5)
      await Promise.all(
        names.map(async (name) => {
          results[name] = await fetchWikiRichIntro(name);
        })
      );
      return results;
    }),

  getWikiInfoboxCached: cachedStaticProcedure
    .input(z.object({ countryName: z.string() }))
    .query(async ({ input }) => {
      const name = input.countryName.trim();
      if (!name) return null;
      return fetchWikiInfoboxCached(name);
    }),

  getBulkWikiInfoboxes: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, any> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 30. (audit B5)
      await Promise.all(
        names.map(async (name) => {
          results[name] = await fetchWikiInfoboxCached(name);
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

  getBulkWikiSectionPreviews: cachedStaticProcedure
    .input(z.object({ countryNames: z.array(z.string()).max(30) }))
    .query(async ({ input }) => {
      const names = input.countryNames.map((n) => n.trim()).filter(Boolean);
      const results: Record<string, any> = {};
      // Fetch concurrently (matches getBulkWikiIntros); input is capped at 30. (audit B5)
      await Promise.all(
        names.map(async (name) => {
          results[name] = await fetchWikiSectionPreviews(name);
        })
      );
      return results;
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
        const cached = await wikiCacheService.getCustomCache<any>(cacheKey);
        if (cached) {
          return cached;
        }

        const article = await getArticleWikitext(pageName, site);
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

  getWikiInfobox: cachedStaticProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const name = input.name.trim();
      if (!name) return null;
      const cacheKey = `get-wiki-infobox:${name.toLowerCase()}`;
      try {
        // Try L1/L2 cache first
        const cached = await wikiCacheService.getCustomCache<any>(cacheKey);
        if (cached) {
          return cached;
        }

        // Try ixwiki first, then iiwiki
        let article = await getArticleWikitext(name, "ixwiki");
        let wikiSource: "ixwiki" | "iiwiki" = "ixwiki";
        if (!article) {
          article = await getArticleWikitext(name, "iiwiki");
          wikiSource = "iiwiki";
        }
        if (!article) return null;

        // Use unified parser for full template processing
        const unified = parseInfoboxWithTemplates(article.wikitext, name);
        if (unified) {
          if (unified.image_flag) unified.flagUrl = resolveImageUrl(unified.image_flag, wikiSource);
          if (unified.image_coat || unified.coat_of_arms)
            unified.coatOfArmsUrl = resolveImageUrl(
              unified.image_coat || unified.coat_of_arms,
              wikiSource
            );
          await wikiCacheService.setCustomCache(
            cacheKey,
            "get-wiki-infobox",
            unified,
            24 * 60 * 60 * 1000
          );
          return unified;
        }

        // Fallback to basic parsed infobox
        const infobox = await wikiBridgeInfobox(name, wikiSource);
        if (!infobox) return null;
        const result: Record<string, unknown> = { templateName: infobox.templateName };
        for (const field of infobox.fields) {
          result[field.key] = field.value;
        }
        const imgFlag = result.image_flag as string | undefined;
        if (imgFlag) {
          result.flagUrl = resolveImageUrl(imgFlag, wikiSource);
        }
        const imgCoat = (result.image_coat || result.coat_of_arms) as string | undefined;
        if (imgCoat) {
          result.coatOfArmsUrl = resolveImageUrl(imgCoat, wikiSource);
        }
        await wikiCacheService.setCustomCache(
          cacheKey,
          "get-wiki-infobox",
          result,
          24 * 60 * 60 * 1000
        );
        return result;
      } catch (err) {
        console.error(`[Wiki] Error fetching infobox for ${name}:`, err);
        return null;
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
