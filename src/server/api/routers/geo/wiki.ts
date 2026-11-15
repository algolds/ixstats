/**
 * Wiki Map Router
 *
 * tRPC router for the IxEarth world map system wiki integration.
 * Handles fetching wiki article intros, parsing infoboxes,
 * searching wiki pages, and scanning wiki text for place names.
 */

import { iiwikiFeatureMiddleware } from "~/server/api/trpc/middleware";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { parseWikiSource, wikiReaderPath, type WikiSource } from "~/lib/wiki-os/config";
import { wikiSourceSchema } from "~/lib/wiki-os/wiki-source-availability";
import {
  parseInfobox,
  extractCoordsFromFields,
  parseCoordTemplate,
} from "~/lib/wiki-os/transformers/infobox-parser";

/**
 * Ixnay's lookup order: ixwiki (direct DB, fast), then iiwiki (HTTP). A wiki that cannot be reached is passed over
 * like one without the page (`unlessUnavailable`), so the lookup goes on to the next.
 */
const IXNAY_WIKIS: readonly WikiSource[] = ["ixwiki", "iiwiki"];

/**
 * The wikis a realm's map looks pages up in (AT-12): the wiki its lore index was imported from, else
 * Ixnay's order. A realm's wiki is recorded on its RealmPage rows; Realm has no wiki setting of its own.
 */
async function realmWikis(
  ctx: Parameters<typeof viewerRealmId>[0] & { db: Pick<PrismaClient, "realmPage"> },
  realmSlug: string | undefined
): Promise<readonly WikiSource[]> {
  const realmId = await viewerRealmId(ctx, realmSlug);
  if (realmId === DEFAULT_REALM_ID) return IXNAY_WIKIS;
  const lore = await ctx.db.realmPage.findFirst({
    where: { realmId },
    select: { wikiSource: true },
  });
  return lore ? [parseWikiSource(lore.wikiSource)] : IXNAY_WIKIS;
}

/** A wiki the editor picked (`wiki`), one of the realm's own; with none, or one the realm does not read, all of them. */
const wikiPick = { wiki: wikiSourceSchema.optional() };

function lookupWikis(
  wikis: readonly WikiSource[],
  picked: WikiSource | undefined
): readonly WikiSource[] {
  return picked && wikis.includes(picked) ? [picked] : wikis;
}

/**
 * A lookup across the realm's wikis passes over one that cannot answer; a lookup in the one wiki the editor picked
 * says so instead (SERVICE_UNAVAILABLE, "IIWiki is switched off for now."), so an outage never reads as "no pages".
 */
async function lookup<T>(work: Promise<T>, picked: WikiSource | undefined): Promise<T | null> {
  if (picked) return work;
  const { unlessUnavailable } = await import("~/lib/wiki-os/upstream-guard");
  return unlessUnavailable(work);
}

export const geoWikiRouter = createTRPCRouter({
  /** The wikis this realm's map looks pages up in, in lookup order: what the editor's wiki picker lists. */
  wikiSources: cachedPublicProcedure
    .input(realmScopeInput)
    .query(async ({ ctx, input }) => [...(await realmWikis(ctx, input.realm))]),

  /** Fetch wiki article intro for a map feature (city/POI) by its linked wiki page title. */
  getFeatureWikiIntro: cachedPublicProcedure
    .use(iiwikiFeatureMiddleware("country"))
    .input(realmScopeInput.extend({ wikiPageTitle: z.string(), ...wikiPick }))
    .query(async ({ ctx, input }) => {
      const name = input.wikiPageTitle.trim();
      if (!name) return null;

      const { getArticleIntro } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");
      const { unlessUnavailable } = await import("~/lib/wiki-os/upstream-guard");

      for (const wiki of lookupWikis(await realmWikis(ctx, input.realm), input.wiki)) {
        const result = await unlessUnavailable(getArticleIntro(name, wiki));
        if (result?.text) {
          return {
            extract: result.text.substring(0, 400),
            wikiSource: wiki,
            wikiUrl: wikiReaderPath(result.title, wiki),
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
    .use(iiwikiFeatureMiddleware("country"))
    .input(realmScopeInput.extend({ pageTitle: z.string().min(1).max(200), ...wikiPick }))
    .query(async ({ ctx, input }) => {
      const title = input.pageTitle.trim();
      const { getArticleWikitext } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");

      for (const wiki of lookupWikis(await realmWikis(ctx, input.realm), input.wiki)) {
        const article = await lookup(getArticleWikitext(title, wiki), input.wiki);
        if (!article) continue;

        const pageUrl = wikiReaderPath(article.title, wiki);
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
    .use(iiwikiFeatureMiddleware("country"))
    .input(
      realmScopeInput.extend({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).default(10),
        ...wikiPick,
      })
    )
    .query(async ({ ctx, input }) => {
      const { searchPages } = await import("~/lib/wiki-os/adapters/mediawiki/bridge");

      for (const wiki of lookupWikis(await realmWikis(ctx, input.realm), input.wiki)) {
        const results = await lookup(searchPages(input.query, input.limit, wiki), input.wiki);
        if (results?.length) {
          return {
            wikiSource: wiki,
            results: results.map((r) => ({
              title: r.title,
              description: "",
              url: wikiReaderPath(r.title, wiki),
            })),
          };
        }
      }

      return { wikiSource: null, results: [] };
    }),
});
