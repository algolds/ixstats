/**
 * realms.region — the realm region page (/r/[realm]): overview, happenings, the Manage tab and its actions,
 * and leaving a realm. Logic lives in ~/server/modules/realms/realms.region*.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  HAPPENING_KINDS,
  isRealmImageUrl,
  MAX_REALM_TAGS,
  REALM_POWERS,
  REALM_TAGS,
} from "~/lib/realms/realm-region";
import { InWorldDateSchema, RealmLinksSchema } from "~/lib/realms/realm-community";
import { globalCache } from "~/lib/cache";
import {
  getRealmHappenings,
  getRealmManage,
  getRealmOverview,
  RealmRegionError,
} from "~/server/modules/realms/realms.region";
import {
  abandonNation,
  appointRealmOfficer,
  closeRealmEmbassy,
  closeRealmPoll,
  createRealmPoll,
  listOfficerCandidates,
  proposeRealmEmbassy,
  removeRealmOfficer,
  respondRealmEmbassy,
  updateRealmAppearance,
  updateRealmFactbook,
  updateRealmInWorldDate,
  updateRealmLinks,
  updateRealmOfficer,
  updateRealmRules,
  type BoardGrantGuard,
} from "~/server/modules/realms/realms.region-actions";
import { assertBoardGrantable, ForumError } from "~/server/modules/thinkpages-forum";
import { deleteRealm } from "~/server/modules/realms/realms.admin";
import {
  adminTransferRealmOwner,
  handOverRealm,
  listHandOverCandidates,
} from "~/server/modules/realms/realms.transfer";

/** M9: the forum's refusal of the board power to a player banned in the realm or sitewide, for the realms module. */
const boardGuard: BoardGrantGuard = (tx, realmId, clerkUserId) =>
  assertBoardGrantable(tx, realmId, clerkUserId);

function regionError(error: Error): never {
  if (error instanceof RealmRegionError || error instanceof ForumError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

const slug = z.string().min(1).max(100);
const officerInput = z.object({
  slug,
  userId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(60),
  powers: z.array(z.enum(REALM_POWERS)).max(REALM_POWERS.length),
});
/** A banner or thumbnail: an https:// address or an uploaded image (see `isRealmImageUrl`), or "" for none. */
const realmImage = z
  .string()
  .trim()
  .max(1000)
  .refine(isRealmImageUrl, "Use an https:// image address or upload an image");

export const realmRegionRouter = createTRPCRouter({
  /** The front page and header: banner, stats, factbook, officers, embassies, poll, board preview. */
  overview: publicProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getRealmOverview(ctx.db, input.slug, ctx.user ?? null)),

  /**
   * New nations, claims, embassies, officers and the nations' game events, newest first, a page at a time:
   * `cursor` is the previous page's `nextCursor`; `kinds` filters.
   */
  happenings: publicProcedure
    .input(
      z.object({
        slug,
        cursor: z.string().datetime().nullish(),
        kinds: z.array(z.enum(HAPPENING_KINDS)).max(HAPPENING_KINDS.length).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
    )
    .query(({ ctx, input }) =>
      getRealmHappenings(ctx.db, input.slug, ctx.user ?? null, {
        before: input.cursor ? new Date(input.cursor) : null,
        kinds: input.kinds,
        limit: input.limit,
      }).catch(regionError)
    ),

  /** The Manage tab (founder and officers): each section the caller's powers allow. */
  manage: protectedProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getRealmManage(ctx.db, input.slug, ctx.user).catch(regionError)),

  updateAppearance: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        bannerUrl: realmImage.nullable().optional(),
        thumbnail: realmImage.nullable().optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        tags: z.array(z.enum(REALM_TAGS)).max(MAX_REALM_TAGS).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      updateRealmAppearance(ctx.db, ctx.user, input).catch(regionError)
    ),

  updateFactbook: rateLimitedMutationProcedure
    .input(z.object({ slug, wikitext: z.string().max(100_000) }))
    .mutation(({ ctx, input }) => updateRealmFactbook(ctx.db, ctx.user, input).catch(regionError)),

  /** The rules tab; while rules exist, claiming a nation needs `acceptedRules`. Empty text removes them. */
  updateRules: rateLimitedMutationProcedure
    .input(z.object({ slug, wikitext: z.string().max(100_000) }))
    .mutation(({ ctx, input }) => updateRealmRules(ctx.db, ctx.user, input).catch(regionError)),

  /** Community links (forum, Discord, wiki, map, website): https only, at most `MAX_REALM_LINKS`. */
  updateLinks: rateLimitedMutationProcedure
    .input(z.object({ slug, links: RealmLinksSchema }))
    .mutation(({ ctx, input }) => updateRealmLinks(ctx.db, ctx.user, input).catch(regionError)),

  /** The in-world date in the header (display only), or `null` to clear it. */
  updateInWorldDate: rateLimitedMutationProcedure
    .input(z.object({ slug, inWorldDate: InWorldDateSchema.nullable() }))
    .mutation(({ ctx, input }) =>
      updateRealmInWorldDate(ctx.db, ctx.user, input).catch(regionError)
    ),

  /** Founder: nation owners of the realm who could be appointed. */
  officerCandidates: protectedProcedure
    .input(z.object({ slug, query: z.string().max(100).default("") }))
    .query(({ ctx, input }) => listOfficerCandidates(ctx.db, ctx.user, input).catch(regionError)),

  appointOfficer: rateLimitedMutationProcedure
    .input(officerInput)
    .mutation(({ ctx, input }) =>
      appointRealmOfficer(ctx.db, ctx.user, input, boardGuard).catch(regionError)
    ),

  updateOfficer: rateLimitedMutationProcedure
    .input(officerInput)
    .mutation(({ ctx, input }) =>
      updateRealmOfficer(ctx.db, ctx.user, input, boardGuard).catch(regionError)
    ),

  /** Founder dismisses an officer; an officer may resign (their own userId). */
  removeOfficer: rateLimitedMutationProcedure
    .input(z.object({ slug, userId: z.string().min(1).max(200) }))
    .mutation(({ ctx, input }) => removeRealmOfficer(ctx.db, ctx.user, input).catch(regionError)),

  proposeEmbassy: rateLimitedMutationProcedure
    .input(z.object({ slug, targetSlug: slug }))
    .mutation(({ ctx, input }) => proposeRealmEmbassy(ctx.db, ctx.user, input).catch(regionError)),

  respondEmbassy: rateLimitedMutationProcedure
    .input(z.object({ slug, embassyId: z.string().min(1), accept: z.boolean() }))
    .mutation(({ ctx, input }) => respondRealmEmbassy(ctx.db, ctx.user, input).catch(regionError)),

  closeEmbassy: rateLimitedMutationProcedure
    .input(z.object({ slug, embassyId: z.string().min(1) }))
    .mutation(({ ctx, input }) => closeRealmEmbassy(ctx.db, ctx.user, input).catch(regionError)),

  createPoll: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        question: z.string().trim().min(1).max(300),
        description: z.string().trim().max(1000).optional(),
        options: z.array(z.string().trim().min(1).max(200)).min(2).max(10),
        multiple: z.boolean().default(false),
        endDate: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) => createRealmPoll(ctx.db, ctx.user, input).catch(regionError)),

  closePoll: rateLimitedMutationProcedure
    .input(z.object({ slug, pollId: z.string().min(1) }))
    .mutation(({ ctx, input }) => closeRealmPoll(ctx.db, ctx.user, input).catch(regionError)),

  /** Leave a realm with one of your nations: it is released and becomes unclaimed. */
  abandonNation: rateLimitedMutationProcedure
    .input(z.object({ countryId: z.string().min(1), confirmName: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      const result = await abandonNation(ctx.db, ctx.user, input).catch(regionError);
      await globalCache.delete(`user_profile:${ctx.user.clerkUserId}`);
      return result;
    }),

  /**
   * Site admins: delete a realm created by mistake (AT-8), confirmed by its slug. Refuses IxWorld and any realm
   * that still has nations or map regions; archive those instead.
   */
  deleteRealm: adminProcedure
    .input(z.object({ realmId: z.string().min(1), confirmSlug: z.string().max(100) }))
    .mutation(({ ctx, input }) => deleteRealm(ctx.db, ctx.user, input).catch(regionError)),

  /**
   * Site admins: hand a realm to a player (an active account, by Clerk id) or back to staff (`newOwnerId: null`),
   * confirmed by its slug. Recorded in the admin audit log; the previous founder may stay on as an officer.
   */
  adminTransferOwner: adminProcedure
    .input(
      z.object({
        realmId: z.string().min(1),
        newOwnerId: z.string().min(1).max(200).nullable(),
        confirmSlug: z.string().max(100),
        keepPreviousAsOfficer: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) =>
      adminTransferRealmOwner(ctx.db, ctx.user, input, boardGuard).catch(regionError)
    ),

  /** Founder: nation owners of the realm who could take it over. */
  handOverCandidates: protectedProcedure
    .input(z.object({ slug, query: z.string().max(100).default("") }))
    .query(({ ctx, input }) => listHandOverCandidates(ctx.db, ctx.user, input).catch(regionError)),

  /**
   * Founder: hand the realm to a nation owner or officer of it, confirmed by its slug; `keepPreviousAsOfficer`
   * keeps the founder on as an officer with every power.
   */
  handOver: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        newOwnerId: z.string().min(1).max(200),
        confirmSlug: z.string().max(100),
        keepPreviousAsOfficer: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) =>
      handOverRealm(ctx.db, ctx.user, input, boardGuard).catch(regionError)
    ),
});
