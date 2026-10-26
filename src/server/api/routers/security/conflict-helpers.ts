/**
 * Conflicts router helpers: the PvNPC strike check, the caller's related nations and nation, and the conflict row
 * as clients see it.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertRealmsMatch } from "~/server/shared/same-realm-guard";
import { nationsInRealm } from "~/lib/realms/same-realm";
import type { RealmClockReader } from "~/server/shared/realm-time";
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
export async function assertStrikeAllowed(
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

/**
 * Nations the caller has diplomatic relations with: player-owned ones (PvP challenge targets) or
 * unclaimed ones (PvNPC strike targets).
 */
/**
 * Related nations of the caller's realm (player-owned or unclaimed): relations made before the cross-realm rule still
 * exist, but a nation of another realm is no target (the commit would refuse it).
 */
export async function relatedCountries(
  db: PrismaClient,
  clerkUserId: string,
  playerOwned: boolean
) {
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
  return nationsInRealm(partners, userProfile.country?.realmId ?? null).map(({ id, name }) => ({
    id,
    name,
  }));
}

/** The caller's nation, or UNAUTHORIZED. */
export async function callerCountryId(db: PrismaClient, clerkUserId: string): Promise<string> {
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
export function withoutServerOnly<
  T extends {
    status: string;
    inputSnapshot?: string | null;
    orders?: string | null;
    seed?: string | null;
  },
>(conflict: T): Omit<T, "inputSnapshot" | "orders"> {
  const { inputSnapshot: _snapshot, orders: _orders, ...rest } = conflict;
  return { ...rest, seed: conflict.status === "resolved" ? (conflict.seed ?? null) : null };
}
