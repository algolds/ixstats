/**
 * The people, wallets, league and clubs of a sports scenario, written through the Prisma API so one seed runs on the
 * in-memory client (`memory-prisma.ts`) and on the scratch Postgres (`scenario-db.ts`) alike. Every id starts with the
 * scenario's prefix, and `removeSportsWorld` deletes them again (Postgres only; a memory client is thrown away).
 */
import type { PrismaClient } from "@prisma/client";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

type Db = PrismaClient;

export interface Person {
  id: string;
  clerkUserId: string;
}

/** A signed-up user, with a Sovereign wallet holding `sovereigns` when given. */
export async function addPerson(db: Db, id: string, sovereigns?: number): Promise<Person> {
  const user = await db.user.create({
    data: { id, clerkUserId: `${id}-clerk`, lastSeenAt: new Date() },
    select: { id: true, clerkUserId: true },
  });
  if (sovereigns !== undefined) {
    await db.exchangeWallet.create({ data: { userId: id, sovereigns } });
  }
  return user;
}

/** The tRPC context of a signed-in user. Each gets its own rate-limit bucket. */
export function asPerson(db: Db, person: Person): MockCallerContext {
  return createMockCallerContext({
    db,
    auth: { userId: person.clerkUserId },
    user: { id: person.id, clerkUserId: person.clerkUserId, countryId: null, isActive: true },
    rateLimitIdentifier: `${person.id}-${Math.random()}`,
  });
}

const HOCKEY_POSITIONS = ["G", "D", "C", "LW", "RW"];

export interface ClubSeed {
  id: string;
  ownerUserId: string | null;
  /** Roster strength (overall ratings around it). */
  base: number;
  budget?: number;
  sponsor?: { baseFee: number; winBonus: number };
  /** Players on the roster; the hockey preset's full roster is 20, fewer leaves vacancies for the draft. */
  rosterSize?: number;
}

/** A league and its clubs, each with a hockey roster and a head coach. */
export async function addLeague(
  db: Db,
  league: { id: string; managerId: string; sportPreset: string; clubs: ClubSeed[] }
): Promise<void> {
  await db.sportLeague.create({
    data: {
      id: league.id,
      name: `League ${league.id}`,
      sportPreset: league.sportPreset,
      archetype: "league",
      teamCount: league.clubs.length,
      createdByUserId: league.managerId,
    },
  });
  for (const club of league.clubs) {
    await db.sportTeam.create({
      data: {
        id: club.id,
        leagueId: league.id,
        name: `Club ${club.id}`,
        ownerUserId: club.ownerUserId,
        budget: club.budget ?? 100_000,
        stadiumCapacity: 5000,
        ticketPrice: 15,
        popularity: 50,
        sponsor: club.sponsor ?? { baseFee: 1000, winBonus: 500 },
      },
    });
    await db.sportPlayer.createMany({
      data: Array.from({ length: club.rosterSize ?? 20 }, (_, i) => ({
        id: `${club.id}-p${String(i).padStart(2, "0")}`,
        teamId: club.id,
        firstName: `${club.id}${i}`,
        lastName: "Player",
        position: HOCKEY_POSITIONS[i % HOCKEY_POSITIONS.length]!,
        age: 24 + (i % 6),
        careerStage: "prime",
        ratings: {
          overall: club.base + (i % 5),
          skating: club.base,
          shooting: club.base + 2,
          passing: club.base,
          checking: club.base - 1,
          positioning: club.base,
          reflexes: club.base + 1,
          physical: club.base,
        },
      })),
    });
    await db.sportCoach.create({
      data: {
        id: `${club.id}-coach`,
        teamId: club.id,
        firstName: "Head",
        lastName: club.id,
        role: "Head Coach",
        age: 50,
        ratings: { strategy: 60, development: 60, motivation: 60, adaptability: 60 },
      },
    });
  }
}

/** A user's Sovereigns, by user id. */
export async function sovereignsOf(
  db: Db,
  ids: readonly string[]
): Promise<Record<string, number>> {
  const rows = await db.exchangeWallet.findMany({
    where: { userId: { in: [...ids] } },
    select: { userId: true, sovereigns: true },
  });
  return Object.fromEntries(rows.map((r) => [r.userId, r.sovereigns]));
}

/** A user's Sovereign ledger rows, oldest first. */
export async function sovereignLedgerOf(db: Db, userId: string) {
  return db.exchangeTransaction.findMany({
    where: { wallet: { userId } },
    select: { sovereigns: true, type: true, source: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** Deletes a Postgres scenario's rows, children first. Never needed for a memory client. */
export async function removeSportsWorld(db: Db, prefix: string): Promise<void> {
  const mine = { startsWith: prefix };
  await db.sportLeague.deleteMany({ where: { id: mine } }); // seasons, matches, predictions, clubs, rosters
  await db.exchangeWallet.deleteMany({ where: { userId: mine } }); // and their ledger rows
  await db.user.deleteMany({ where: { id: mine } });
}
