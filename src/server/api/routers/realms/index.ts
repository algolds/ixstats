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
  rateLimitedPublicProcedure,
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
import { seedRealmCategories } from "~/server/modules/thinkpages-forum";
import { notifyClaimRejected } from "~/server/modules/realms/realms.notices";
import {
  resolveInviterUserId,
  resolveRealmInviter,
} from "~/server/modules/identity/identity.invites";
import { fetchNationPagePrefill } from "~/server/modules/realms/realms.prefill";
import { fetchPageCreator } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { parsePrismaError } from "~/lib/prisma-error";
import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { notificationHooks } from "~/lib/notifications/hooks";
import { getBonusConfig, grantBonus, NEW_PLAYER_BONUS_SOURCE } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { ActivityHooks } from "~/lib/activity/hooks";
import { globalCache } from "~/lib/cache";
import { listRealmDirectory, openRealmBoard, searchDirectoryNations } from "./places";
import { realmRegionRouter } from "./region";
import { realmSourceSyncRouter } from "./source-sync";
import { realmMapRouter } from "./map";
import { realmMapPipelineRouter } from "./map-pipeline";
import { realmWikiRouter } from "./wiki";
import { realmNationDefaultsRouter } from "./nation-defaults";

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
  // The inviter's recruiter achievements count approved invited claims (account-level, no country).
  queueAchievementCheck(event.inviterUserId);
  await ActivityHooks.User.onCountryLink(event.clerkUserId, event.countryId, false);
  await globalCache.delete(`user_profile:${event.clerkUserId}`);
}

const claims = (db: PrismaClient) =>
  createClaimsService(db, {
    fetchPageCreator,
    onNationAssigned: (event) => onNationAssigned(db, event),
    onClaimRejected: notifyClaimRejected,
    fetchNationPrefill: fetchNationPagePrefill,
    resolveInviter: resolveInviterUserId,
  });

/**
 * An invite's `via` handle (`/r/{slug}?via=`). One too long to be a handle or name is dropped, never refused:
 * an invite that does not hold up never fails a claim.
 */
const inviteVia = z
  .string()
  .optional()
  .transform((via) => (via && via.length <= 100 ? via : undefined));

const CLAIM_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  ALREADY_OWNED: "CONFLICT",
  CAP_REACHED: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  NOT_PENDING: "CONFLICT",
  REASON_REQUIRED: "BAD_REQUEST",
  REALM_CLOSED: "FORBIDDEN",
  SLUG_CONFLICT: "CONFLICT",
  RULES_NOT_ACCEPTED: "PRECONDITION_FAILED",
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

  /**
   * `acceptedRules`: the player ticked "I have read the realm's rules" (required when the realm has rules).
   * `via`: the handle of the player whose invite link they came by.
   */
  claimCountry: lightMutationProcedure
    .input(
      z.object({
        countryId: z.string().min(1),
        acceptedRules: z.boolean().optional(),
        via: inviteVia,
      })
    )
    .mutation(({ ctx, input }) =>
      claims(ctx.db)
        .claimCountry(ctx.user, input.countryId, {
          acceptedRules: input.acceptedRules,
          via: input.via,
        })
        .catch(claimError)
    ),

  /** Claim a nation page of the realm's lore index; approval creates the realm's country (ruling E-f). */
  claimNationPage: lightMutationProcedure
    .input(
      z.object({
        realmSlug: z.string().min(1).max(100),
        title: z.string().trim().min(1).max(255),
        acceptedRules: z.boolean().optional(),
        via: inviteVia,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { slug: input.realmSlug },
        select: { id: true },
      });
      if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
      return claims(ctx.db)
        .claimNationPage(ctx.user, realm.id, input.title, {
          acceptedRules: input.acceptedRules,
          via: input.via,
        })
        .catch(claimError);
    }),

  /**
   * The Join panel's "@handle invited you": the inviter's handle and name, only when `via` names a player
   * holding a nation in this realm; null otherwise. Nothing else about them.
   */
  inviter: rateLimitedPublicProcedure
    .input(z.object({ slug: z.string().min(1).max(100), via: z.string().trim().min(1).max(100) }))
    .query(({ input }) => resolveRealmInviter(input.slug, input.via)),

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
    // The realm and its forum categories commit together (N3).
    .mutation(({ ctx, input }) =>
      ctx.db
        .$transaction(async (tx) => {
          const realm = await tx.realm.create({
            data: { ...input, ownerId: input.ownerId ?? "system", status: "active" },
          });
          await seedRealmCategories(tx, realm.id);
          return realm;
        })
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

  /** A realm's source sync: settings, dry runs, applied runs and history (see ./source-sync.ts). */
  sourceSync: realmSourceSyncRouter,

  /** A realm's wiki: settings, world discovery, the chosen wiki map and infobox hints (see ./wiki.ts). */
  wiki: realmWikiRouter,
  /** A realm's map: display settings for the viewer, map settings and recomputed areas (see ./map.ts). */
  map: realmMapRouter,
  /** A realm's map pipeline: config, presets, background runs and history (see ./map-pipeline.ts). */
  mapPipeline: realmMapPipelineRouter,
  /** A realm's nation growth defaults, applied to its unclaimed nations (see ./nation-defaults.ts). */
  nationDefaults: realmNationDefaultsRouter,

  /** The realm directory (/realms): open realms, nation counts, board activity, the viewer's holdings. */
  directory: publicProcedure.query(({ ctx }) => listRealmDirectory(ctx.db, ctx.user?.id ?? null)),

  /** Nation search on /realms: countries and claimable nation pages in the realms the directory lists. */
  searchNations: rateLimitedPublicProcedure
    .input(z.object({ query: z.string().trim().min(2).max(100) }))
    .query(({ ctx, input }) => searchDirectoryNations(ctx.db, input.query)),

  /** Open a realm's board (created on first open) and sync the caller's membership from their nations. */
  getBoard: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => openRealmBoard(ctx.db, input.slug, ctx.user ?? null)),
});
