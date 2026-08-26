/**
 * Wiki Importer Router
 *
 * Handles importing country data from MediaWiki infobox templates
 * Supports multiple wiki sources: IIWiki, IxWiki, AltHistoryWiki
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getArticleWikitext, type WikiSource as BridgeWikiSource } from "~/lib/wiki-os/adapters/mediawiki/bridge";

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

export const wikiImporterDiscoveryRouter = createTRPCRouter({
  /**
   * Fetch wiki page from multiple wiki sources (auto-detect)
   */
  fetchFromWiki: publicProcedure
    .input(
      z.object({
        pageName: z.string(),
        preferredSource: z.enum(["iiwiki", "ixwiki", "althist"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await searchAcrossWikis(input.pageName, input.preferredSource);
        return result;
      } catch (error) {
        throw new Error(
          `Failed to fetch wiki page: ${error instanceof Error ? error.message : "Unknown error"}`, { cause: error }
        );
      }
    }),

  /**
   * Search for a country across all wiki sources
   */
  searchAllWikis: publicProcedure
    .input(
      z.object({
        searchTerm: z.string().min(2),
      })
    )
    .query(async ({ input }) => {
      const { searchPages } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const sources: WikiSource[] = ["iiwiki", "ixwiki", "althist"];
      const results = await Promise.allSettled(
        sources.map(async (source) => {
          const bridgeSource = toBridgeSource(source);
          if (bridgeSource) {
            const searchResults = await searchPages(input.searchTerm, 5, bridgeSource);
            if (searchResults.length > 0) {
              return {
                source,
                sourceName: WIKI_SOURCE_NAMES[source].name,
                results: searchResults.map((r) => ({
                  title: r.title,
                  url: getWikiUrl(source, r.title),
                })),
              };
            }
          } else {
            const apiUrl = "https://althistory.fandom.com/api.php";
            const response = await fetch(
              `${apiUrl}?action=opensearch&search=${encodeURIComponent(input.searchTerm)}&limit=5&format=json`,
              { headers: { "User-Agent": "IxStats-Builder" } }
            );
            if (response.ok) {
              const data = await response.json();
              const [, titles, , urls] = data;
              if (titles && titles.length > 0) {
                return {
                  source,
                  sourceName: WIKI_SOURCE_NAMES[source].name,
                  results: titles.map((title: string, idx: number) => ({
                    title,
                    url: urls[idx],
                  })),
                };
              }
            }
          }
          return null;
        })
      );

      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<unknown>).value)
        .filter((v): v is NonNullable<typeof v> => v !== null);
    }),

  /**
   * Get available wiki sources
   */
  getWikiSources: publicProcedure.query(() => {
    return Object.entries(WIKI_SOURCE_NAMES).map(([key, config]) => ({
      id: key,
      name: config.name,
      priority: config.priority,
    }));
  }),
});
