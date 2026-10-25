/**
 * Nations, their owners, governments and national-issue templates for the MyCountry engine scenarios, written through
 * the Prisma API so a seed runs on the in-memory client (`memory-prisma.ts`) as on Postgres. A memory client is thrown
 * away after each test; the scenarios that use this have no Postgres variant.
 */
import type { PrismaClient } from "@prisma/client";
import {
  createRealmClock,
  ixnayClockReader,
  withSpeed,
  type RealmClockReader,
} from "~/lib/realms/realm-clock";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

type Db = PrismaClient;

export interface Owner {
  id: string;
  clerkUserId: string;
  countryId: string | null;
}

/** Ixnay, the default realm every nation belongs to unless it names another. */
export async function addIxnay(db: Db): Promise<void> {
  await db.realm.create({
    data: { id: "default", slug: "ixnay", name: "Ixnay", ownerId: "system", status: "published" },
  });
}

/**
 * A realm whose clock reads `nowMs` at this moment and runs at `multiplier` (0 pauses it), as a founder leaves it.
 * Call `resetRealmClockCache()` (`~/server/shared/realm-time`) between tests that reuse a realm id.
 */
export async function addRealm(
  db: Db,
  id: string,
  clock: { nowMs: number; multiplier: number }
): Promise<void> {
  const real = Date.now();
  const started = createRealmClock({
    globalNowMs: clock.nowMs,
    realNowMs: real,
    startDate: "1200-01-01",
    era: "AE",
    multiplier: 1,
  });
  await db.realm.create({
    data: {
      id,
      slug: id,
      name: `Realm ${id}`,
      ownerId: "system",
      status: "published",
      settings: { clock: withSpeed(started, clock.multiplier, real) },
    },
  });
}

/**
 * Realm clocks for a cron run (`clocks` option) where Ixnay reads `ixnayNowMs` and runs (not paused), whatever the
 * frozen IxTime of the test says; `others` are added as they are.
 */
export function ixnayRunningAt(
  ixnayNowMs: number,
  others: ReadonlyMap<string, RealmClockReader> = new Map()
): Map<string, RealmClockReader> {
  return new Map([
    ...others,
    ["default", ixnayClockReader("default", { now: () => ixnayNowMs, multiplier: 2 })],
  ]);
}

/** A player, acting as `countryId` when given (and owning it). */
export async function addOwner(db: Db, id: string, countryId: string | null): Promise<Owner> {
  const user = await db.user.create({
    data: { id, clerkUserId: `${id}-clerk`, countryId, lastSeenAt: new Date() },
    select: { id: true, clerkUserId: true, countryId: true },
  });
  if (countryId) await db.country.update({ where: { id: countryId }, data: { ownerUserId: id } });
  return user;
}

/** The tRPC context of a signed-in player. Each gets its own rate-limit bucket. */
export function asOwner(db: Db, owner: Owner): MockCallerContext {
  return createMockCallerContext({
    db,
    auth: { userId: owner.clerkUserId },
    user: {
      id: owner.id,
      clerkUserId: owner.clerkUserId,
      countryId: owner.countryId,
      role: { name: "member" },
    },
    rateLimitIdentifier: `${owner.id}-${Math.random()}`,
  });
}

/** The departments a seeded government runs, with their budget shares. */
export const DEPARTMENTS = [
  { category: "Finance", percent: 20 },
  { category: "Defense", percent: 25 },
  { category: "Education", percent: 30 },
  { category: "Health", percent: 25 },
] as const;

export interface NationSeed {
  id: string;
  name?: string;
  /** IxTime the nation's projection starts from. */
  baselineDate: Date;
  /** The budget year its allocations are for; no allocations when omitted. */
  budgetYear?: number;
  totalBudget?: number;
  /** Its realm; Ixnay when omitted. */
  realmId?: string;
}

/**
 * A ten-million-person, $30,000-a-head nation with its stability row and a four-department government. The current
 * figures equal the baseline, so a projection starts from the same place for every seeded nation.
 */
export async function addNation(db: Db, seed: NationSeed): Promise<{ structureId: string }> {
  await db.country.create({
    data: {
      id: seed.id,
      name: seed.name ?? `Nation ${seed.id}`,
      slug: seed.id,
      ...(seed.realmId ? { realmId: seed.realmId } : {}),
      baselinePopulation: 10_000_000,
      baselineGdpPerCapita: 30_000,
      baselineDate: seed.baselineDate,
      lastCalculated: seed.baselineDate,
      maxGdpGrowthRate: 0.05,
      adjustedGdpGrowth: 0.02,
      actualGdpGrowth: 0.02,
      populationGrowthRate: 0.01,
      currentPopulation: 10_000_000,
      currentGdpPerCapita: 30_000,
      currentTotalGdp: 3e11,
      publicApproval: 50,
      unemploymentRate: 6.5,
      inflationRate: 2.1,
      economicTier: "Developed",
      populationTier: "2",
      landArea: 100_000,
    },
  });
  await db.internalStabilityMetrics.create({ data: { countryId: seed.id, stabilityScore: 60 } });
  const structure = await db.governmentStructure.create({
    data: {
      countryId: seed.id,
      governmentName: `Government of ${seed.name ?? seed.id}`,
      governmentType: "Parliamentary Republic",
      totalBudget: seed.totalBudget ?? 1e10,
      governmentEffectiveness: 60,
    },
  });
  for (const dept of DEPARTMENTS) {
    const department = await db.governmentDepartment.create({
      data: {
        id: `${seed.id}-${dept.category.toLowerCase()}`,
        governmentStructureId: structure.id,
        name: `Ministry of ${dept.category}`,
        category: dept.category,
      },
    });
    if (seed.budgetYear !== undefined) {
      await db.budgetAllocation.create({
        data: {
          governmentStructureId: structure.id,
          departmentId: department.id,
          budgetYear: seed.budgetYear,
          allocatedPercent: dept.percent,
          allocatedAmount: ((seed.totalBudget ?? 1e10) * dept.percent) / 100,
        },
      });
    }
  }
  return { structureId: structure.id };
}

export interface ConsequenceSeed {
  targetModel: string;
  targetField: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
}

/** An active template with one response option per entry of `options`, each carrying its consequences. */
export async function addIssueTemplate(
  db: Db,
  template: {
    id: string;
    title: string;
    domain: string;
    category?: "economic" | "social" | "governance" | "security" | "infrastructure" | "diplomatic";
    urgency?: number;
    options: Array<{ id: string; label: string; consequences: ConsequenceSeed[] }>;
  }
): Promise<void> {
  await db.nationalIssueTemplate.create({
    data: {
      id: template.id,
      slug: template.id,
      title: template.title,
      description: `{{countryName}} faces ${template.title.toLowerCase()}.`,
      domain: template.domain,
      category: template.category ?? "governance",
      baseUrgency: template.urgency ?? 40,
      triggerConditions: JSON.stringify({ field: "publicApproval", op: ">=", value: 0 }),
      responseOptions: JSON.stringify(
        template.options.map((o, i) => ({
          ...o,
          description: o.label,
          previewEffects: {},
          outcomeText: `{{countryName}} chose to ${o.label.toLowerCase()}.`,
          isAutoResolveDefault: i === 0,
        }))
      ),
    },
  });
}
