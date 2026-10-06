/** Realms router — realm admin, realm lookup and nation claims. Logic lives in ~/server/modules/realms. */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
  lightMutationProcedure,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  ClaimError,
  createClaimsService,
  getRealmHub,
  listBuilderRealms,
  listMyNations,
  realmSettings,
  withMaxNationsPerUser,
  type NationAssignedEvent,
} from "~/server/modules/realms";
import { notifyClaimRejected } from "~/server/modules/realms/realms.notices";
import { fetchNationPagePrefill } from "~/server/modules/realms/realms.prefill";
import { fetchPageCreator } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { parsePrismaError } from "~/lib/prisma-error";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { notificationHooks } from "~/lib/notifications/hooks";
import { getBonusConfig, grantBonus, NEW_PLAYER_BONUS_SOURCE } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { ActivityHooks } from "~/lib/activity/hooks";
import { globalCache } from "~/lib/cache";
import { listRealmDirectory, openRealmBoard } from "./places";
import { realmRegionRouter } from "./region";

/** The side effects linkCountry used to run when a nation changed hands; failures are logged, never thrown. */
async function onNationAssigned(db: PrismaClient, event: NationAssignedEvent): Promise<void> {
  await notificationHooks
    .onUserAccountChange({
      userId: event.clerkUserId,
      changeType: "country_assigned",
      title: "Country Assigned",
      description: `You have been assigned to ${event.countryName}. You can now manage your country from the MyCountry dashboard.`,
      metadata: { countryId: event.countryId, countryName: event.countryName },
    })
    .catch((e: Error) => console.error("[realms] claim notification failed:", e));
  await getBonusConfig(db)
    .then((cfg) =>
      grantBonus(db, event.clerkUserId, NEW_PLAYER_BONUS_SOURCE, cfg.newPlayer, {
        oneTime: true,
        metadata: { countryId: event.countryId, countryName: event.countryName },
      })
    )
    .catch((e: Error) => console.error("[realms] new-player bonus failed:", e));
  queueAchievementCheck(event.clerkUserId, event.countryId);
  await ActivityHooks.User.onCountryLink(event.clerkUserId, event.countryId, false);
  await globalCache.delete(`user_profile:${event.clerkUserId}`);
}

const claims = (db: PrismaClient) =>
  createClaimsService(db, {
    fetchPageCreator,
    onNationAssigned: (event) => onNationAssigned(db, event),
    onClaimRejected: notifyClaimRejected,
    fetchNationPrefill: fetchNationPagePrefill,
  });

const CLAIM_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  ALREADY_OWNED: "CONFLICT",
  CAP_REACHED: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  NOT_PENDING: "CONFLICT",
  REASON_REQUIRED: "BAD_REQUEST",
  REALM_CLOSED: "FORBIDDEN",
} as const;

function claimError(error: Error): never {
  if (error instanceof ClaimError)
    throw new TRPCError({ code: CLAIM_ERROR_CODES[error.code], message: error.message });
  throw error;
}

function slugTaken(error: Error): never {
  if (parsePrismaError(error)?.type === "unique_constraint")
    throw new TRPCError({ code: "CONFLICT", message: "That slug is taken" });
  throw error;
}

export const realmsRouter = createTRPCRouter({
  /**
   * Public realm page data (public and unlisted realms are both readable by link; draft and generating realms only
   * by their moderators).
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => getRealmHub(ctx.db, input.slug, ctx.user ?? null)),

  claimCountry: lightMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      claims(ctx.db).claimCountry(ctx.user, input.countryId).catch(claimError)
    ),

  /** Claim a nation page of the realm's lore index; approval creates the realm's country (ruling E-f). */
  claimNationPage: lightMutationProcedure
    .input(
      z.object({
        realmSlug: z.string().min(1).max(100),
        title: z.string().trim().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { slug: input.realmSlug },
        select: { id: true },
      });
      if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
      return claims(ctx.db).claimNationPage(ctx.user, realm.id, input.title).catch(claimError);
    }),

  /** The player's own claims and their status (pending, approved, rejected with the reason), optionally in one realm. */
  myClaims: protectedProcedure
    .input(z.object({ realmSlug: z.string().min(1).max(100).optional() }).optional())
    .query(({ ctx, input }) => claims(ctx.db).myClaims(ctx.user, input?.realmSlug)),

  /** The player's nations in every realm, grouped by realm, for the nation switcher. */
  myNations: protectedProcedure.query(({ ctx }) =>
    listMyNations(ctx.db, { id: ctx.user.id, countryId: ctx.user.countryId ?? null })
  ),

  /** Realms the builder can create a nation in, with the player's standing against each realm's cap. */
  builderRealms: protectedProcedure.query(({ ctx }) => listBuilderRealms(ctx.db, ctx.user)),

  listClaims: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }))
    .query(({ ctx, input }) => claims(ctx.db).listClaims(ctx.user, input.status)),

  reviewClaim: rateLimitedMutationProcedure
    .input(
      z.object({
        claimId: z.string().min(1),
        approve: z.boolean(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      claims(ctx.db)
        .reviewClaim(ctx.user, input.claimId, { approve: input.approve, reason: input.reason })
        .catch(claimError)
    ),

  /** Admin: list all realms with full details, plus each realm's effective nation cap */
  adminListRealms: adminProcedure.query(async ({ ctx }) => {
    const realms = await ctx.db.realm.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { countries: true } },
      },
    });
    return realms.map((realm) => ({
      ...realm,
      maxNationsPerUser: realmSettings(realm.settings).maxNationsPerUser,
    }));
  }),

  /**
   * Admin: list users with every nation they hold, in every realm (AT-19). `active` marks the nation they act as;
   * an active nation without an ownership row (legacy link) is still listed.
   */
  adminListUsers: adminProcedure.query(async ({ ctx }) => {
    const nation = { id: true, name: true, realmId: true, realm: { select: { name: true } } };
    const users = await ctx.db.user.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clerkUserId: true,
        countryId: true,
        membershipTier: true,
        isActive: true,
        createdAt: true,
        country: { select: nation },
        ownedCountries: { orderBy: { name: "asc" }, select: nation },
      },
    });
    return users.map(({ country, ownedCountries, ...user }) => {
      const held =
        country && !ownedCountries.some((c) => c.id === country.id)
          ? [country, ...ownedCountries]
          : ownedCountries;
      return {
        ...user,
        nations: held.map(({ realm, ...c }) => ({
          ...c,
          realmName: realm?.name ?? null,
          active: c.id === user.countryId,
        })),
      };
    });
  }),

  /** Admin: create a realm (ruling E-j — admin-created, founder "system" until its admin has an account). */
  adminCreateRealm: adminProcedure
    .input(
      z.object({
        slug: z.string().regex(REALM_SLUG_PATTERN, "2–40 lower-case letters, digits or hyphens"),
        name: z.string().trim().min(1).max(100),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["public", "unlisted"]),
        ownerId: z.string().min(1).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.db.realm
        .create({ data: { ...input, ownerId: input.ownerId ?? "system", status: "active" } })
        .catch(slugTaken)
    ),

  /** Admin: update any realm (not restricted to owner) */
  adminUpdateRealm: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["unlisted", "public"]).optional(),
        status: z.enum(["draft", "generating", "active", "archived"]).optional(),
        /** Decision 15's per-realm nation cap, merged into `Realm.settings`. */
        maxNationsPerUser: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, maxNationsPerUser, ...data } = input;
      if (maxNationsPerUser === undefined) return ctx.db.realm.update({ where: { id }, data });

      const realm = await ctx.db.realm.findUnique({ where: { id }, select: { settings: true } });
      if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
      return ctx.db.realm.update({
        where: { id },
        data: { ...data, settings: withMaxNationsPerUser(realm.settings, maxNationsPerUser) },
      });
    }),

  /** The realm region page: overview, happenings, the Manage tab and its actions (see ./region.ts). */
  region: realmRegionRouter,

  /** The realm directory (/realms): open realms, nation counts, board activity, the viewer's holdings. */
  directory: publicProcedure.query(({ ctx }) => listRealmDirectory(ctx.db, ctx.user?.id ?? null)),

  /** Open a realm's board (created on first open) and sync the caller's membership from their nations. */
  getBoard: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => openRealmBoard(ctx.db, input.slug, ctx.user ?? null)),
});
