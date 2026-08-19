/**
 * Wiki Importer Router
 *
 * Handles importing country data from MediaWiki infobox templates
 * Supports multiple wiki sources: IIWiki, IxWiki, AltHistoryWiki
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseInfoboxTemplate, mapInfoboxToIxStats } from "~/lib/wiki/infobox-mapper";
import { getArticleWikitext, type WikiSource as BridgeWikiSource } from "~/lib/wiki/bridge";

/**
 * Wiki source configuration (name mapping only — fetching delegated to WikiBridge)
 */
const WIKI_SOURCE_NAMES = {
  iiwiki: { name: "IIWiki", priority: 1 },
  ixwiki: { name: "IxWiki", priority: 2 },
  althist: { name: "Alternative History Wiki", priority: 3 },
} as const;

type WikiSource = keyof typeof WIKI_SOURCE_NAMES;

/** Map local source keys to WikiBridge-supported sources. */
function toBridgeSource(source: WikiSource): BridgeWikiSource | null {
  if (source === "ixwiki" || source === "iiwiki") return source;
  // althistory is now supported by WikiBridge (HTTP-only fetching)
  if (source === "althist") return "althistory";
  return null;
}

function getWikiUrl(source: WikiSource, pageName: string): string {
  const slug = encodeURIComponent(pageName.replace(/ /g, "_"));
  if (source === "iiwiki") return `https://iiwiki.com/wiki/${slug}`;
  if (source === "ixwiki") return `/wiki/${slug}`;
  return `https://althistory.fandom.com/wiki/${slug}`;
}

/**
 * Fetch page from a specific wiki source via WikiBridge.
 * Falls back to direct HTTP for unsupported sources (althist).
 */
async function fetchFromWikiSource(pageName: string, source: WikiSource) {
  const bridgeSource = toBridgeSource(source);

  if (bridgeSource) {
    // Use WikiBridge (direct MySQL for ixwiki, HTTP for iiwiki)
    const article = await getArticleWikitext(pageName, bridgeSource);
    if (!article) return null;

    return {
      source,
      sourceName: WIKI_SOURCE_NAMES[source].name,
      pageName,
      pageId: article.pageId,
      wikitext: article.wikitext,
      hasInfobox:
        article.wikitext.includes("{{Infobox country") ||
        article.wikitext.includes("{{Infobox Country"),
      url: getWikiUrl(source, pageName),
    };
  }

  // Fallback: althist uses direct HTTP (not in WikiBridge)
  const apiUrl = "https://althistory.fandom.com/api.php";
  const response = await fetch(
    `${apiUrl}?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&format=json`,
    {
      headers: { "User-Agent": "IxStats-Builder", Accept: "application/json" },
    }
  );
  if (!response.ok)
    throw new Error(`HTTP ${response.status} from ${WIKI_SOURCE_NAMES[source].name}`);
  const data = await response.json();
  const pages = data.query?.pages;
  if (!pages || Object.keys(pages).length === 0) return null;
  const page = Object.values(pages)[0];
  if (!page || typeof page !== "object") return null;
  const pageObj = page as Record<string, unknown>;
  if (pageObj.missing !== undefined || parseInt(String(pageObj.pageid ?? "-1")) < 0) return null;
  const revisions = pageObj.revisions as Array<Record<string, unknown>> | undefined;
  const wikitext = revisions?.[0]?.["*"] as string | undefined;
  if (!wikitext) return null;

  return {
    source,
    sourceName: WIKI_SOURCE_NAMES[source].name,
    pageName,
    pageId: pageObj.pageid,
    wikitext,
    hasInfobox: wikitext.includes("{{Infobox country") || wikitext.includes("{{Infobox Country"),
    url: getWikiUrl(source, pageName),
  };
}

/**
 * Search for page across all wiki sources
 */
async function searchAcrossWikis(pageName: string, preferredSource?: WikiSource) {
  const sources: WikiSource[] = preferredSource
    ? [
        preferredSource,
        ...(Object.keys(WIKI_SOURCE_NAMES).filter((s) => s !== preferredSource) as WikiSource[]),
      ]
    : (Object.keys(WIKI_SOURCE_NAMES) as WikiSource[]).sort(
        (a, b) => WIKI_SOURCE_NAMES[a].priority - WIKI_SOURCE_NAMES[b].priority
      );

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const data = await fetchFromWikiSource(pageName, source);
      return { source, data };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.data) {
      return result.value.data;
    }
  }

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

  throw new Error(
    `Page "${pageName}" not found in any wiki source. Tried: ${sources.map((s) => WIKI_SOURCE_NAMES[s].name).join(", ")}${errors.length > 0 ? `. Errors: ${errors.join("; ")}` : ""}`
  );
}

export const wikiImporterDeepRouter = createTRPCRouter({
  /**
   * Deep import — full article extraction with semantic analysis and IxWorld matching.
   *
   * Goes beyond infobox parsing: extracts sections, prose, lists, tables, and
   * uses semantic keyword matching to identify economy, government, demographics,
   * geography, military, and history data from the full article.
   */
  deepImport: publicProcedure
    .input(
      z.object({
        pageName: z.string().min(1),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Dynamic imports to keep the module lightweight when not used
      const { extractWikiContent } = await import("~/lib/wiki/content-extractor");
      const { analyzeWikiContent } = await import("~/lib/wiki/content-analyzer");
      const { matchToIxWorld } = await import("~/lib/wiki/ixworld-mapper");

      // 1. Fetch full wikitext via WikiBridge
      const bridgeSource = input.site as BridgeWikiSource;
      const article = await getArticleWikitext(input.pageName, bridgeSource);
      if (!article) {
        // Fallback: try fetchFromWikiSource for althist
        const fallback = await fetchFromWikiSource(
          input.pageName,
          input.site === "althistory" ? "althist" : (input.site as WikiSource)
        );
        if (!fallback) {
          return { success: false, error: `Page "${input.pageName}" not found on ${input.site}` };
        }

        // Process fallback wikitext
        const extracted = extractWikiContent(input.pageName, fallback.wikitext);
        const analyzed = analyzeWikiContent(extracted);

        // Run infobox mapper for compatibility
        let infoboxMapped = {};
        try {
          const parsedInfobox = parseInfoboxTemplate(fallback.wikitext);
          infoboxMapped = mapInfoboxToIxStats(parsedInfobox);
        } catch (e) {
          console.warn("[deepImport] infobox parsing failed:", e);
        }

        // IxWorld matching
        let ixworldMatch = null;
        try {
          ixworldMatch = await matchToIxWorld(
            extracted.coordinates,
            input.pageName,
            ctx.db as any,
            analyzed.borders?.value
          );
        } catch (e) {
          console.warn("[deepImport] IxWorld matching failed:", e);
        }

        return {
          success: true,
          extracted: {
            title: extracted.title,
            intro: extracted.intro,
            sectionCount: extracted.sections.length,
            sections: extracted.sections.map((s) => ({ level: s.level, title: s.title })),
            categories: extracted.categories,
            coordinates: extracted.coordinates,
            imageCount: extracted.images.length,
            tableCount: extracted.tables.length,
          },
          analyzed,
          infoboxMapped,
          ixworldMatch,
          sourceUrl: fallback.url,
        };
      }

      // 2. Run full extraction
      const extracted = extractWikiContent(input.pageName, article.wikitext);

      // 3. Run semantic analyzer
      const analyzed = analyzeWikiContent(extracted);

      // 4. Run infobox mapper for compatibility with existing builder
      let infoboxMapped = {};
      try {
        const parsedInfobox = parseInfoboxTemplate(article.wikitext);
        infoboxMapped = mapInfoboxToIxStats(parsedInfobox);
      } catch (e) {
        console.warn("[deepImport] infobox parsing failed:", e);
      }

      // 5. IxWorld geographic matching
      let ixworldMatch = null;
      try {
        ixworldMatch = await matchToIxWorld(
          extracted.coordinates,
          input.pageName,
          ctx.db as any,
          analyzed.borders?.value
        );
      } catch (e) {
        console.warn("[deepImport] IxWorld matching failed:", e);
      }

      return {
        success: true,
        extracted: {
          title: extracted.title,
          intro: extracted.intro,
          sectionCount: extracted.sections.length,
          sections: extracted.sections.map((s) => ({ level: s.level, title: s.title })),
          categories: extracted.categories,
          coordinates: extracted.coordinates,
          imageCount: extracted.images.length,
          tableCount: extracted.tables.length,
        },
        analyzed,
        infoboxMapped,
        ixworldMatch,
        sourceUrl: getWikiUrl(
          input.site === "althistory" ? "althist" : (input.site as WikiSource),
          input.pageName
        ),
      };
    }),
});
