/** Realms router — realm admin, realm lookup and nation claims. Logic lives in ~/server/modules/realms. */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { ClaimError, createClaimsService, type NationAssignedEvent } from "~/server/modules/realms";
import { fetchPageCreator } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { notificationHooks } from "~/lib/notifications/hooks";
import { getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";
import { globalCache } from "~/lib/cache";

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
      grantBonus(db, event.clerkUserId, "bonus:new_player", cfg.newPlayer, {
        oneTime: true,
        metadata: { countryId: event.countryId, countryName: event.countryName },
      })
    )
    .catch((e: Error) => console.error("[realms] new-player bonus failed:", e));
  await globalCache.delete(`user_profile:${event.clerkUserId}`);
}

const claims = (db: PrismaClient) =>
  createClaimsService(db, {
    fetchPageCreator,
    onNationAssigned: (event) => onNationAssigned(db, event),
  });

const CLAIM_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  ALREADY_OWNED: "CONFLICT",
  CAP_REACHED: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  NOT_PENDING: "CONFLICT",
  REASON_REQUIRED: "BAD_REQUEST",
} as const;

function claimError(error: Error): never {
  if (error instanceof ClaimError)
    throw new TRPCError({ code: CLAIM_ERROR_CODES[error.code], message: error.message });
  throw error;
}

export const realmsRouter = createTRPCRouter({
  /** Public realm page data (public and unlisted realms are both readable by link). */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          thumbnail: true,
          status: true,
          visibility: true,
          countries: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true, flag: true, ownerUserId: true },
          },
        },
      });
      if (!realm) return null;
      // Public endpoint: expose "claimed", never internal user ids.
      return {
        ...realm,
        countries: realm.countries.map(({ ownerUserId, ...c }) => ({
          ...c,
          claimed: ownerUserId !== null,
        })),
      };
    }),

  claimCountry: protectedProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      claims(ctx.db).claimCountry(ctx.user, input.countryId).catch(claimError)
    ),

  myClaims: protectedProcedure.query(({ ctx }) => claims(ctx.db).myClaims(ctx.user)),

  listClaims: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }))
    .query(({ ctx, input }) => claims(ctx.db).listClaims(ctx.user, input.status)),

  reviewClaim: protectedProcedure
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

  /** Admin: list all realms with full details */
  adminListRealms: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.realm.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { countries: true } },
      },
    });
  }),

  /** Admin: list users with their realm associations (via country) */
  adminListUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clerkUserId: true,
        countryId: true,
        membershipTier: true,
        isActive: true,
        createdAt: true,
        country: {
          select: {
            id: true,
            name: true,
            realmId: true,
          },
        },
      },
    });
  }),

  /** Admin: update any realm (not restricted to owner) */
  adminUpdateRealm: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["unlisted", "public"]).optional(),
        status: z.enum(["draft", "generating", "active", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.realm.update({ where: { id }, data });
    }),
});
