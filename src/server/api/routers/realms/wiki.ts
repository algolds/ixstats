/**
 * realms.wiki: a realm's wiki settings, world discovery on that wiki (step by step), choosing and re-checking a
 * world map from it, and the per-nation infobox hints for the map import (site admins and the realm's founder).
 * Logic lives in ~/server/modules/realms/realms.wiki.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { MAX_TITLE_LENGTH, REALM_WIKI_SOURCES } from "~/lib/realms/realm-wiki-settings";
import { HINT_BATCH } from "~/lib/realms/sources/iiwiki-discovery";
import {
  chooseRealmWikiMap,
  getRealmWikiView,
  realmInfoboxHints,
  RealmWikiError,
  recheckRealmWikiMap,
  runRealmDiscoveryStep,
  saveRealmWikiSettings,
} from "~/server/modules/realms/realms.wiki";

function wikiError(error: Error): never {
  if (error instanceof RealmWikiError) throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

const slug = z.string().min(1).max(100);
const title = z.string().trim().min(1).max(MAX_TITLE_LENGTH);

/** The settings as typed; the server's schema (`realmWikiSettingsSchema`) validates and normalizes them. */
const wikiInput = z.object({
  source: z.enum(REALM_WIKI_SOURCES),
  rootCategory: z.string().max(MAX_TITLE_LENGTH),
  keyword: z.string().max(200),
  rosterCategory: z.string().max(MAX_TITLE_LENGTH).nullable(),
  portalTitle: z.string().max(MAX_TITLE_LENGTH).nullable(),
  mapCategories: z.array(z.string().max(MAX_TITLE_LENGTH)).max(10),
});

export const realmWikiRouter = createTRPCRouter({
  /** The realm's wiki settings (null before they are set), its chosen wiki map, and the wikis offered. */
  get: protectedProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getRealmWikiView(ctx.db, ctx.user, input.slug).catch(wikiError)),

  /** Save the realm's wiki settings, or clear them with `wiki: null`. */
  save: rateLimitedMutationProcedure
    .input(z.object({ slug, wiki: wikiInput.nullable() }))
    .mutation(({ ctx, input }) =>
      saveRealmWikiSettings(ctx.db, ctx.user, input.slug, input.wiki).catch(wikiError)
    ),

  /**
   * One discovery step on the realm's wiki: the roster, one batch of nation hints, or the map candidates
   * (`exclude`: file names known not to be the world map, such as the nations' flags). A refused step returns what
   * it read with `blocked` set.
   */
  discover: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        step: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("roster") }),
          z.object({ kind: z.literal("hints"), titles: z.array(title).min(1).max(HINT_BATCH) }),
          z.object({ kind: z.literal("maps"), exclude: z.array(title).max(1500) }),
        ]),
      })
    )
    .mutation(({ ctx, input }) =>
      runRealmDiscoveryStep(ctx.db, ctx.user, input.slug, input.step).catch(wikiError)
    ),

  /** "Use this map": fetch and check the original, then store the choice in the realm's settings. */
  chooseMap: rateLimitedMutationProcedure
    .input(z.object({ slug, fileTitle: title }))
    .mutation(({ ctx, input }) =>
      chooseRealmWikiMap(ctx.db, ctx.user, input.slug, input.fileTitle).catch(wikiError)
    ),

  /** Compare the chosen map's SHA-1 with the wiki's current file: unchanged, changed or missing. */
  recheckMap: rateLimitedMutationProcedure
    .input(z.object({ slug }))
    .mutation(({ ctx, input }) => recheckRealmWikiMap(ctx.db, ctx.user, input.slug).catch(wikiError)),

  /** Per roster nation: capital coordinates and a locator map thumbnail, for the map import (cached an hour). */
  infoboxHints: protectedProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => realmInfoboxHints(ctx.db, ctx.user, input.slug).catch(wikiError)),
});
