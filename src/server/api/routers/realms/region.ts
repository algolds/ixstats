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
  BOARD_RESTRICTIONS,
  MAX_REALM_TAGS,
  REALM_POWERS,
  REALM_TAGS,
} from "~/lib/realms/realm-region";
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
  assignRealmFounder,
  closeRealmEmbassy,
  closeRealmPoll,
  createRealmPoll,
  liftBoardRestriction,
  listOfficerCandidates,
  proposeRealmEmbassy,
  removeRealmOfficer,
  respondRealmEmbassy,
  restrictBoardNation,
  updateRealmAppearance,
  updateRealmFactbook,
  updateRealmOfficer,
} from "~/server/modules/realms/realms.region-actions";

function regionError(error: Error): never {
  if (error instanceof RealmRegionError)
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
const bannerUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((url) => url === "" || /^https:\/\/[^\s]+$/i.test(url), "Use an https:// image address");

export const realmRegionRouter = createTRPCRouter({
  /** The front page and header: banner, stats, factbook, officers, embassies, poll, board preview. */
  overview: publicProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getRealmOverview(ctx.db, input.slug, ctx.user ?? null)),

  /** New nations, claims, embassies, officers and the nations' game events, newest first. */
  happenings: publicProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) =>
      getRealmHappenings(ctx.db, input.slug, ctx.user ?? null).catch(regionError)
    ),

  /** The Manage tab (founder and officers): each section the caller's powers allow. */
  manage: protectedProcedure
    .input(z.object({ slug }))
    .query(({ ctx, input }) => getRealmManage(ctx.db, input.slug, ctx.user).catch(regionError)),

  updateAppearance: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        bannerUrl: bannerUrl.nullable().optional(),
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

  /** Founder: nation owners of the realm who could be appointed. */
  officerCandidates: protectedProcedure
    .input(z.object({ slug, query: z.string().max(100).default("") }))
    .query(({ ctx, input }) => listOfficerCandidates(ctx.db, ctx.user, input).catch(regionError)),

  appointOfficer: rateLimitedMutationProcedure
    .input(officerInput)
    .mutation(({ ctx, input }) => appointRealmOfficer(ctx.db, ctx.user, input).catch(regionError)),

  updateOfficer: rateLimitedMutationProcedure
    .input(officerInput)
    .mutation(({ ctx, input }) => updateRealmOfficer(ctx.db, ctx.user, input).catch(regionError)),

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

  /** Mute (no board posts) or ban (off the board) a nation, for `days` or until lifted. */
  restrictBoardNation: rateLimitedMutationProcedure
    .input(
      z.object({
        slug,
        countryId: z.string().min(1),
        kind: z.enum(BOARD_RESTRICTIONS),
        reason: z.string().trim().max(300).optional(),
        days: z.number().int().min(1).max(365).optional(),
      })
    )
    .mutation(({ ctx, input }) => restrictBoardNation(ctx.db, ctx.user, input).catch(regionError)),

  liftBoardRestriction: rateLimitedMutationProcedure
    .input(z.object({ slug, countryId: z.string().min(1) }))
    .mutation(({ ctx, input }) => liftBoardRestriction(ctx.db, ctx.user, input).catch(regionError)),

  /** Leave a realm with one of your nations: it is released and becomes unclaimed. */
  abandonNation: rateLimitedMutationProcedure
    .input(z.object({ countryId: z.string().min(1), confirmName: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      const result = await abandonNation(ctx.db, ctx.user, input).catch(regionError);
      await globalCache.delete(`user_profile:${ctx.user.clerkUserId}`);
      return result;
    }),

  /** Site admins: set a realm's founder, or hand it back to staff (`clerkUserId: null`). */
  assignFounder: adminProcedure
    .input(z.object({ realmId: z.string().min(1), clerkUserId: z.string().min(1).nullable() }))
    .mutation(({ ctx, input }) => assignRealmFounder(ctx.db, ctx.user, input).catch(regionError)),
});
