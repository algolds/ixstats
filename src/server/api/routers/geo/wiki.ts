/**
 * Wiki Map Router
 *
 * tRPC router for the IxEarth world map system wiki integration.
 * Handles fetching wiki article intros, parsing infoboxes,
 * searching wiki pages, and scanning wiki text for place names.
 */

import { z } from "zod";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import {
  parseInfobox,
  extractCoordsFromFields,
  parseCoordTemplate,
} from "~/lib/wiki-infobox-parser";

export const geoWikiRouter = createTRPCRouter({
  /** Fetch wiki article intro for a map feature (city/POI) by its linked wiki page title. */
  getFeatureWikiIntro: cachedPublicProcedure
    .input(z.object({ wikiPageTitle: z.string() }))
    .query(async ({ input }) => {
      const name = input.wikiPageTitle.trim();
      if (!name) return null;

      const { getArticleIntro } = await import("~/lib/wiki-bridge");

      // Try ixwiki first (direct MySQL, ~8ms), then iiwiki (HTTP, ~400ms)
      for (const wiki of ["ixwiki", "iiwiki"] as const) {
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
      }
      return null;
    }),

  /**
   * Parse a wiki page's infobox template and return structured fields.
   * Used by the map editor WikiLinkWizard for auto-filling city/POI data.
   */
  parseWikiInfobox: cachedPublicProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const title = input.pageTitle.trim();
      const { getArticleWikitext } = await import("~/lib/wiki-bridge");

      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const article = await getArticleWikitext(title, wiki);
        if (!article) continue;

        const pageUrl =
          wiki === "ixwiki"
            ? `/w/${encodeURIComponent(article.title)}`
            : `https://iiwiki.com/wiki/${encodeURIComponent(article.title)}`;
        const parsed = parseInfobox(article.wikitext);

        if (!parsed) {
          return {
            found: true,
            hasInfobox: false,
            pageTitle: article.title,
            pageUrl,
            wikiSource: wiki,
            fields: [],
            coordinates: null,
          };
        }

        const splitCoords = extractCoordsFromFields(parsed.fields);
        const templateCoords = parseCoordTemplate(article.wikitext);
        const coordinates = splitCoords ?? templateCoords;

        return {
          found: true,
          hasInfobox: true,
          templateName: parsed.templateName,
          pageTitle: article.title,
          pageUrl,
          wikiSource: wiki,
          fields: parsed.fields.map((f) => ({
            key: f.key,
            cleanValue: f.cleanValue,
            typedValue: f.typedValue ?? null,
            fieldType: f.fieldType,
          })),
          coordinates,
        };
      }

      return {
        found: false,
        hasInfobox: false,
        pageTitle: title,
        pageUrl: null,
        wikiSource: null,
        fields: [],
        coordinates: null,
      };
    }),

  /**
   * Search wiki pages by prefix (opensearch). Used by WikiLinkWizard for
   * type-ahead suggestions when linking a map feature to a wiki article.
   */
  searchWikiPages: cachedPublicProcedure
    .input(
      z.object({ query: z.string().min(1).max(100), limit: z.number().min(1).max(20).default(10) })
    )
    .query(async ({ input }) => {
      const { searchPages } = await import("~/lib/wiki-bridge");

      // Try ixwiki first (MySQL, ~30ms), then iiwiki (HTTP, ~400ms)
      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const results = await searchPages(input.query, input.limit, wiki);
        if (results.length > 0) {
          return {
            wikiSource: wiki,
            results: results.map((r) => ({
              title: r.title,
              description: "",
              url:
                wiki === "ixwiki"
                  ? `/w/${encodeURIComponent(r.title)}`
                  : `https://iiwiki.com/wiki/${encodeURIComponent(r.title)}`,
            })),
          };
        }
      }

      return { wikiSource: null, results: [] };
    }),

  /**
   * Scan a wiki article for place names that match known map features.
   * Returns matched/unmatched place names for the auto-linker.
   */
  scanWikiForPlaces: cachedPublicProcedure
    .input(z.object({ pageTitle: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const title = input.pageTitle.trim();

      // Fetch article intro via WikiBridge (direct MySQL for ixwiki)
      const { getArticleIntro } = await import("~/lib/wiki-bridge");
      let plaintext = "";

      for (const wiki of ["ixwiki", "iiwiki"] as const) {
        const result = await getArticleIntro(title, wiki);
        if (result?.text) {
          plaintext = result.text;
          break;
        }
      }

      if (!plaintext) return { matches: [], unmatched: [] };

      // Get all known place names from the database
      const [countries, cities, pois, subdivisions] = await Promise.all([
        ctx.db.country.findMany({
          select: { id: true, name: true },
          where: { geometry: { not: null } as any },
        }),
        ctx.db.city.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
        ctx.db.pointOfInterest.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
        ctx.db.subdivision.findMany({
          select: { id: true, name: true, countryId: true },
          where: { status: "approved" },
        }),
      ]);

      // Build a name → feature lookup (case-insensitive, min 3 chars to avoid noise)
      const knownPlaces = new Map<string, { id: string; type: string; name: string }>();
      for (const c of countries)
        if (c.name.length >= 3)
          knownPlaces.set(c.name.toLowerCase(), { id: c.id, type: "country", name: c.name });
      for (const c of cities)
        if (c.name.length >= 3)
          knownPlaces.set(c.name.toLowerCase(), { id: c.id, type: "city", name: c.name });
      for (const p of pois)
        if (p.name.length >= 3)
          knownPlaces.set(p.name.toLowerCase(), { id: p.id, type: "poi", name: p.name });
      for (const s of subdivisions)
        if (s.name.length >= 3)
          knownPlaces.set(s.name.toLowerCase(), { id: s.id, type: "subdivision", name: s.name });

      // Scan plaintext for known place names
      const matches: Array<{ name: string; type: string; id: string; linked: boolean }> = [];
      const seen = new Set<string>();

      // Check each known place name against the article text
      for (const [lowerName, place] of knownPlaces) {
        if (seen.has(lowerName)) continue;
        // Word-boundary match (avoid matching "an" inside "Canpei")
        const regex = new RegExp(`\\b${lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(plaintext)) {
          seen.add(lowerName);

          // Check if this feature already has a wikiPageTitle linking to it
          let linked = false;
          if (place.type === "city") {
            const city = await ctx.db.city.findUnique({
              where: { id: place.id },
              select: { wikiPageTitle: true },
            });
            linked = !!city?.wikiPageTitle;
          } else if (place.type === "poi") {
            const poi = await ctx.db.pointOfInterest.findUnique({
              where: { id: place.id },
              select: { wikiPageTitle: true },
            });
            linked = !!poi?.wikiPageTitle;
          } else if (place.type === "country") {
            linked = true; // Countries are always "linked" by nature
          }

          matches.push({ name: place.name, type: place.type, id: place.id, linked });
        }
      }

      return {
        matches: matches.sort((a, b) => a.name.localeCompare(b.name)),
        scannedChars: plaintext.length,
      };
    }),
});
