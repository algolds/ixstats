/**
 * Diplomacy and Defense metrics for the active country: embassies, cooperative actions, alliances,
 * missions and peacekeeping. Every duration is real time on real `DateTime` fields (V4), never the
 * IxTime columns. An NPC nation is one with no `ownerUserId`. Keys that pair a count with a floor
 * ("20 missions across 3 months") return the count only once the floor is met, and 0 before.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { COOPERATIVE_FP_TYPES } from "~/lib/diplomacy/proposal-lifecycle";
import type { MetricContext, MetricLoader } from "./registry";
import { distinctBuckets, monthKey, MONTH_MS } from "../time-buckets";
import { ownedMonths } from "./nation";

const DAY_MS = 86_400_000;
const EMBASSY_CLOSED_EVENTS = ["embassy_closed", "embassy_severed"];
const ACTIVE_MEMBER = { isActive: true, status: "active" } as const;

const EMBASSY_LASTING_MS = 6 * MONTH_MS;
const ALLIANCE_UNBROKEN_MS = 18 * MONTH_MS;
const ARCHITECT_AGE_MS = 12 * MONTH_MS;
const ARCHITECT_MEMBERS = 5;
const PACIFIST_MONTHS = 12;
const CONSENSUS_MEMBERS = 3;
const MISSION_MIN_MS = 3 * DAY_MS;
const MISSION_MIN_MONTHS = 3;
const PEACEKEEPING_MIN_MS = 15 * DAY_MS;

const before = (now: Date, ms: number) => new Date(now.getTime() - ms);

/**
 * Embassies the country runs (it is the guest) that stayed open 6 real months. `embassy_closed`
 * events carry only the country pair (no embassyId), and reopening keeps `establishedAt`, so a
 * closure is any closed or severed event for the pair since `establishedAt`, or any
 * `embassy_reopened` for the embassy (which only follows a closure).
 */
async function embassiesLasting(db: PrismaClient, countryId: string, now: Date): Promise<number> {
  const embassies = await db.embassy.findMany({
    where: {
      guestCountryId: countryId,
      status: "active",
      establishedAt: { lte: before(now, EMBASSY_LASTING_MS) },
    },
    select: { id: true, hostCountryId: true, establishedAt: true },
  });
  if (embassies.length === 0) return 0;
  const events = await db.diplomaticEvent.findMany({
    where: {
      OR: [
        { embassyId: { in: embassies.map((e) => e.id) }, eventType: "embassy_reopened" },
        {
          country1Id: countryId,
          country2Id: { in: embassies.map((e) => e.hostCountryId) },
          eventType: { in: EMBASSY_CLOSED_EVENTS },
        },
      ],
    },
    select: { embassyId: true, country2Id: true, createdAt: true },
  });
  return embassies.filter(
    (embassy) =>
      !events.some(
        (event) =>
          event.createdAt >= embassy.establishedAt &&
          (event.embassyId === embassy.id || event.country2Id === embassy.hostCountryId)
      )
  ).length;
}

/** Accepted cooperative actions toward nations that another player owns. */
const cooperativeAccepted = (db: PrismaClient, countryId: string, userId: string) =>
  db.foreignPolicyAction.count({
    where: {
      initiatorId: countryId,
      actionType: { in: [...COOPERATIVE_FP_TYPES] },
      status: { in: ["active", "lifted"] },
      target: { AND: [{ ownerUserId: { not: null } }, { ownerUserId: { not: userId } }] },
    },
  });

/** Distinct NPC nations (no owner) that accepted this country's alliance invites, however many alliances. */
async function npcInvitesAccepted(db: PrismaClient, countryId: string): Promise<number> {
  const nations = await db.allianceMember.groupBy({
    by: ["countryId"],
    where: { invitedByCountryId: countryId, ...ACTIVE_MEMBER, country: { ownerUserId: null } },
  });
  return nations.length;
}

/**
 * Completed embassy missions that really ran 3 days or longer, one per cultural exchange (an
 * exchange mints a mission for every embassy at once), once they completed in 3 different months.
 * `startedAt`/`completesAt` are player-typed dates, so real time is the row's `createdAt` and the
 * `updatedAt` the completion sweep writes.
 */
async function missionsCompleted(db: PrismaClient, countryId: string): Promise<number> {
  const missions = await db.embassyMission.findMany({
    where: { status: "completed", embassy: { guestCountryId: countryId } },
    select: { id: true, culturalExchangeId: true, createdAt: true, updatedAt: true },
  });
  const lasting = missions.filter(
    (m) => m.updatedAt.getTime() - m.createdAt.getTime() >= MISSION_MIN_MS
  );
  const units = new Set(lasting.map((m) => m.culturalExchangeId ?? m.id));
  const months = distinctBuckets(
    lasting.map((m) => m.updatedAt),
    monthKey
  );
  return months >= MISSION_MIN_MONTHS ? units.size : 0;
}

/** How many of these alliances have at least `min` active members. */
async function alliancesWithMembers(
  db: PrismaClient,
  allianceIds: string[],
  min: number
): Promise<Set<string>> {
  if (allianceIds.length === 0) return new Set();
  const counts = await db.allianceMember.groupBy({
    by: ["allianceId"],
    where: { allianceId: { in: allianceIds }, ...ACTIVE_MEMBER },
    _count: { _all: true },
  });
  return new Set(counts.filter((c) => c._count._all >= min).map((c) => c.allianceId));
}

/** The country's proposals approved with a vote for from another member, in alliances of 3 or more. */
async function proposalsApproved(db: PrismaClient, countryId: string): Promise<number> {
  const proposals = await db.allianceAction.findMany({
    where: {
      proposedBy: countryId,
      status: { in: ["approved", "active"] },
      votes: { some: { vote: "for", countryId: { not: countryId } } },
    },
    select: { allianceId: true },
  });
  const large = await alliancesWithMembers(
    db,
    [...new Set(proposals.map((p) => p.allianceId))],
    CONSENSUS_MEMBERS
  );
  return proposals.filter((p) => large.has(p.allianceId)).length;
}

/** Alliances this country founded that are 12 real months old, not realm-synced, with 5 or more active members. */
async function allianceArchitect(db: PrismaClient, countryId: string, now: Date): Promise<number> {
  const founded = await db.allianceMember.findMany({
    where: {
      countryId,
      role: "founder",
      ...ACTIVE_MEMBER,
      alliance: { externalSourceKey: null, createdAt: { lte: before(now, ARCHITECT_AGE_MS) } },
    },
    select: { allianceId: true },
  });
  const grown = await alliancesWithMembers(
    db,
    founded.map((f) => f.allianceId),
    ARCHITECT_MEMBERS
  );
  return grown.size;
}

/** 1 after 12 real months of ownership with no hostile action initiated and no embassy closed or severed. */
async function pacifist(db: PrismaClient, countryId: string, now: Date): Promise<number> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { ownedSince: true },
  });
  if (ownedMonths(country?.ownedSince ?? null, now) < PACIFIST_MONTHS) return 0;
  const since = before(now, PACIFIST_MONTHS * MONTH_MS);
  const [hostile, closed] = await Promise.all([
    db.foreignPolicyAction.count({
      where: {
        initiatorId: countryId,
        actionType: { notIn: [...COOPERATIVE_FP_TYPES] },
        createdAt: { gte: since },
      },
    }),
    db.diplomaticEvent.count({
      where: {
        country1Id: countryId,
        eventType: { in: EMBASSY_CLOSED_EVENTS },
        createdAt: { gte: since },
      },
    }),
  ]);
  return hostile === 0 && closed === 0 ? 1 : 0;
}

/** Completed peacekeeping operations that really lasted 15 days or longer (the end is a player call). */
async function peacekeeping(db: PrismaClient, countryId: string): Promise<number> {
  const operations = await db.militaryOperation.findMany({
    where: { countryId, operationType: "peacekeeping", status: "completed" },
    select: { createdAt: true, updatedAt: true },
  });
  return operations.filter(
    (op) => op.updatedAt.getTime() - op.createdAt.getTime() >= PEACEKEEPING_MIN_MS
  ).length;
}

const member = (db: PrismaClient, countryId: string, extra: Prisma.AllianceMemberWhereInput = {}) =>
  db.allianceMember.count({ where: { countryId, ...ACTIVE_MEMBER, ...extra } });

export const diplomacyLoader: MetricLoader = {
  id: "diplomacy",
  scope: "country",
  keys: [
    "embassiesLasting6m",
    "cooperativeAccepted",
    "npcInvitesAccepted",
    "missionsCompleted",
    "proposalsApproved",
    "allianceJoined",
    "allianceUnbroken18m",
    "allianceArchitect",
    "pacifist12m",
    "peacekeeping15d",
  ],
  async load({ db, countryId, userId, now }: MetricContext): Promise<Record<string, number>> {
    if (!countryId) return {};
    const [
      embassiesLasting6m,
      cooperative,
      npcInvites,
      missions,
      proposals,
      allianceJoined,
      allianceUnbroken18m,
      architect,
      pacifist12m,
      peacekeeping15d,
    ] = await Promise.all([
      embassiesLasting(db, countryId, now),
      cooperativeAccepted(db, countryId, userId),
      npcInvitesAccepted(db, countryId),
      missionsCompleted(db, countryId),
      proposalsApproved(db, countryId),
      member(db, countryId),
      member(db, countryId, { joinedAt: { lte: before(now, ALLIANCE_UNBROKEN_MS) } }),
      allianceArchitect(db, countryId, now),
      pacifist(db, countryId, now),
      peacekeeping(db, countryId),
    ]);
    return {
      embassiesLasting6m,
      cooperativeAccepted: cooperative,
      npcInvitesAccepted: npcInvites,
      missionsCompleted: missions,
      proposalsApproved: proposals,
      allianceJoined,
      allianceUnbroken18m,
      allianceArchitect: architect,
      pacifist12m,
      peacekeeping15d,
    };
  },
};
