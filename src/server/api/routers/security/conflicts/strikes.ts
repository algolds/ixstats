/**
 * Security conflicts: reads and PvNPC strikes (Plan 163 / Plan 191). A nation's conflicts, the
 * target lists, a strike on an NPC nation, the combat odds and the declared terrain.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  premiumProcedure,
  premiumMutationProcedure,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import {
  assertCountryWriteAccess,
  countriesWithWriteAccess,
} from "~/server/shared/country-authorization";
import { redactConflictCosts } from "~/lib/military/owner-redaction";
import { pvpConflictEndsAt, pvpDurationDays } from "~/lib/military/conflict-outcome";
import {
  MAX_ENGAGEMENT_DAYS,
  MIN_COMMITMENT,
  TERRAIN_CLASSES,
  formatDeclaredTerrain,
} from "~/lib/military/combat";
import { combatOdds, commitStrike } from "~/server/modules/combat";
import { syncDefense } from "~/server/modules/defense";
import { assertRealmsMatch } from "~/server/shared/same-realm-guard";
import { nationsInRealm } from "~/lib/realms/same-realm";
import { clockForCountry, type RealmClockReader } from "~/server/shared/realm-time";
import { withPvPExpiry } from "~/lib/military/pvp-proposals";
import {
  PVNPC_STRIKE_COOLDOWN_IXDAYS,
  ixDaysAgo,
  ixDaysLater,
} from "~/lib/military/operation-rules";

/**
 * A PvNPC strike's target must be a nation the striker has relations with, in the same realm,
 * and not struck by it within the cooldown on the striker's realm clock (the UI's target list,
 * enforced on the server).
 */
async function assertStrikeAllowed(
  db: PrismaClient,
  initiator: { id: string; realmId: string },
  target: { id: string; name: string; realmId: string },
  clock: RealmClockReader
) {
  const [relation, lastStrike] = await Promise.all([
    db.diplomaticRelation.findFirst({
      where: {
        OR: [
          { country1: initiator.id, country2: target.id },
          { country1: target.id, country2: initiator.id },
        ],
      },
      select: { id: true },
    }),
    db.militaryConflict.findFirst({
      where: {
        type: "pvnpc",
        initiatorId: initiator.id,
        defenderId: target.id,
        createdAt: { gte: ixDaysAgo(PVNPC_STRIKE_COOLDOWN_IXDAYS, clock) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  assertRealmsMatch(initiator.realmId, target.realmId);
  if (!relation) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Strikes target NPC nations you have diplomatic relations with in your realm.",
    });
  }
  if (lastStrike) {
    const next = ixDaysLater(lastStrike.createdAt, PVNPC_STRIKE_COOLDOWN_IXDAYS, clock);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: next
        ? `You struck ${target.name} recently. You can strike again on ${next.toISOString().slice(0, 10)}.`
        : `You struck ${target.name} recently. Your realm's clock is paused, so the cooldown waits for it.`,
    });
  }
}

const STRIKE_COUNTRY_FIELDS = {
  id: true,
  name: true,
  realmId: true,
  currentGdpPerCapita: true,
  currentPopulation: true,
} as const;

/**
 * Nations the caller has diplomatic relations with: player-owned ones (PvP challenge targets) or
 * unclaimed ones (PvNPC strike targets).
 */
/**
 * Related nations of the caller's realm (player-owned or unclaimed): relations made before the cross-realm rule still
 * exist, but a nation of another realm is no target (the commit would refuse it).
 */
async function relatedCountries(db: PrismaClient, clerkUserId: string, playerOwned: boolean) {
  const userProfile = await db.user.findUnique({
    where: { clerkUserId },
    select: { countryId: true, country: { select: { realmId: true } } },
  });
  const countryId = userProfile?.countryId;
  if (!countryId) return [];

  const relations = await db.diplomaticRelation.findMany({
    where: { OR: [{ country1: countryId }, { country2: countryId }] },
    select: { country1: true, country2: true },
  });
  const partnerIds = [
    ...new Set(relations.map((r) => (r.country1 === countryId ? r.country2 : r.country1))),
  ];
  if (partnerIds.length === 0) return [];

  const partners = await db.country.findMany({
    where: { id: { in: partnerIds }, ownerUserId: playerOwned ? { not: null } : null },
    select: { id: true, name: true, realmId: true },
    orderBy: { name: "asc" },
  });
  return nationsInRealm(partners, userProfile.country?.realmId ?? null).map(({ id, name }) => ({ id, name }));
}

/** The caller's nation, or UNAUTHORIZED. */
async function callerCountryId(db: PrismaClient, clerkUserId: string): Promise<string> {
  const profile = await db.user.findUnique({ where: { clerkUserId }, select: { countryId: true } });
  if (!profile?.countryId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
  }
  return profile.countryId;
}

/**
 * A conflict row without what stays on the server: the inputs snapshot (true values of both sides) and the orders,
 * and the seed until the battle is resolved (knowing it early would reveal the roll).
 */
function withoutServerOnly<T extends { status: string; inputSnapshot?: string | null; orders?: string | null; seed?: string | null }>(
  conflict: T
): Omit<T, "inputSnapshot" | "orders"> {
  const { inputSnapshot: _snapshot, orders: _orders, ...rest } = conflict;
  return { ...rest, seed: conflict.status === "resolved" ? (conflict.seed ?? null) : null };
}

export const securityConflictReadsRouter = createTRPCRouter({
  // Get conflicts involving a country. Casualties and economic damage go to the parties only.
  getConflicts: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conflicts = await ctx.db.militaryConflict.findMany({
        where: {
          OR: [{ initiatorId: input.countryId }, { defenderId: input.countryId }],
        },
        include: {
          initiator: { select: { id: true, name: true, flag: true } },
          defender: { select: { id: true, name: true, flag: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const parties = await countriesWithWriteAccess(
        ctx,
        conflicts.flatMap((c) => [c.initiatorId, c.defenderId])
      );
      const clock = await clockForCountry(ctx.db, input.countryId);
      const rows = conflicts.map(withPvPExpiry).map(withoutServerOnly).map((c) => ({
        ...c,
        // When an active PvP conflict may be concluded (concludePvPConflict), on the realm clock;
        // null while the realm is paused.
        endsAt:
          c.type === "pvp" && c.status === "active"
            ? (pvpConflictEndsAt(c, clock)?.endsAt ?? null)
            : null,
        initiator: c.initiator
          ? {
              id: c.initiator.id,
              name: c.initiator.name,
              flagUrl: c.initiator.flag,
            }
          : null,
        defender: c.defender
          ? {
              id: c.defender.id,
              name: c.defender.name,
              flagUrl: c.defender.flag,
            }
          : null,
      }));
      return rows.map((c) =>
        parties.has(c.initiatorId) || parties.has(c.defenderId) ? c : redactConflictCosts(c)
      );
    }),

  // Related player nations the caller may challenge via proposePvPConflict.
  getPvPTargets: premiumProcedure.query(({ ctx }) =>
    relatedCountries(ctx.db, ctx.auth.userId, true)
  ),

  // Related nations the caller may strike via resolvePvNPCConflict: those no user has claimed.
  getPvNPCTargets: premiumProcedure.query(({ ctx }) =>
    relatedCountries(ctx.db, ctx.auth.userId, false)
  ),

  // Resolve a PvNPC conflict automatically
  resolvePvNPCConflict: premiumMutationProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        reason: z.string().optional(),
        commitment: z.number().min(MIN_COMMITMENT).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (!userProfile?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // The strike damages the target's GDP, so the target must be an NPC (unclaimed) nation;
      // player nations (including the caller's own) go through the mutual-consent PvP flow.
      const targetPlayer = await ctx.db.user.findFirst({
        where: { ownedCountries: { some: { id: input.targetCountryId } } },
        select: { id: true },
      });
      if (targetPlayer || input.targetCountryId === userProfile.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PvNPC strikes can only target NPC nations. Challenge player nations via PvP.",
        });
      }

      const [initiator, defender] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: userProfile.countryId },
          select: STRIKE_COUNTRY_FIELDS,
        }),
        ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: STRIKE_COUNTRY_FIELDS,
        }),
      ]);

      if (!initiator || !defender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }
      await assertStrikeAllowed(ctx.db, initiator, defender, await clockForCountry(ctx.db, initiator));

      // The combat model: committed with a seed bound to the orders, resolved on both nations' derived forces (the
      // NPC defends with forces from its economy), losses and economic effects applied.
      const { conflict, result } = await commitStrike(ctx.db, {
        attackerId: initiator.id,
        defenderId: defender.id,
        commitment: input.commitment,
        reason: input.reason,
      });
      const initiatorWins = result.objectiveReached;

      const winnerName = initiatorWins ? initiator.name : defender.name;

      // Canon news: initiator's feed
      void generateDiplomaticNews(ctx.db as any, userProfile.countryId, "pvnpc_conflict_resolved", {
        countryName: initiator.name,
        targetName: defender.name,
        winner: winnerName,
      });

      // Canon news: defender's feed
      void generateDiplomaticNews(ctx.db as any, input.targetCountryId, "pvnpc_conflict_resolved", {
        countryName: initiator.name,
        targetName: defender.name,
        winner: winnerName,
      });

      return withoutServerOnly(conflict);
    }),

  // The odds screen: the caller's view of an engagement it is considering (estimates of the enemy, never true values).
  getCombatOdds: premiumProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        mode: z.enum(["strike", "pvp"]),
        commitment: z.number().min(MIN_COMMITMENT).max(1).optional(),
        days: z.number().int().min(1).max(MAX_ENGAGEMENT_DAYS).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const countryId = await callerCountryId(ctx.db, ctx.auth.userId);
      if (countryId === input.targetCountryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose another nation." });
      }
      return combatOdds(ctx.db, {
        attackerId: countryId,
        defenderId: input.targetCountryId,
        mode: input.mode,
        commitment: input.commitment,
        days: input.days ?? (input.mode === "strike" ? 3 : pvpDurationDays(null)),
      });
    }),

  // The defender's declared terrain, used where the realm map has no data for an attack on it.
  setDeclaredTerrain: premiumMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        terrain: z.enum(TERRAIN_CLASSES).nullable(),
        riverLine: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      await syncDefense(ctx.db, input.countryId);
      const terrainProfile = input.terrain
        ? formatDeclaredTerrain({ terrain: input.terrain, riverLine: input.riverLine })
        : null;
      await ctx.db.defensePolicy.update({ where: { countryId: input.countryId }, data: { terrainProfile } });
      return { countryId: input.countryId, terrainProfile };
    }),

  getDeclaredTerrain: premiumProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.defensePolicy.findUnique({
        where: { countryId: input.countryId },
        select: { terrainProfile: true },
      });
      return { countryId: input.countryId, terrainProfile: policy?.terrainProfile ?? null };
    }),
});
