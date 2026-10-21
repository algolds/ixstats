/** @jest-environment node */
/**
 * The Diplomacy, Defense and Nation achievement sets (spec 5.3): thresholds, rarities, scope, the
 * redefined End of days, and the 4x IxTime fixture, where a clock running four times faster than
 * real time must not unlock anything early (V4: durations are real).
 */

jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn().mockResolvedValue({ granted: true, amount: 100 }),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { User: { onAchievementUnlocked: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onAchievementUnlock: jest.fn().mockResolvedValue(undefined) },
}));
import type { AccountAchievementData, AchievementDefinition } from "~/lib/achievements/definitions";
import { diplomacyLoader } from "~/lib/achievements/metrics/diplomacy";
import { nationLoader } from "~/lib/achievements/metrics/nation";
import { type MetricContext } from "~/lib/achievements/metrics/registry";
import { distinctBuckets, monthKey } from "~/lib/achievements/time-buckets";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { DIPLOMACY_DEFINITIONS } from "~/lib/achievements/sets/diplomacy";
import { NATION_DEFINITIONS } from "~/lib/achievements/sets/nation";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const MINE = [...DIPLOMACY_DEFINITIONS, ...NATION_DEFINITIONS];
const byId = (id: string) => MINE.find((d) => d.id === id);

const isUnlocked = (def: AchievementDefinition, metrics: Record<string, number>) =>
  achievementService.evaluateCondition(
    { key: def.id, conditionJson: null },
    { country: { id: "c1" } as never, metrics }
  );
describe("thresholds", () => {
  it.each([
    ["dip-first-alliance", "allianceJoined", 1],
    ["dip-lasting-embassies", "embassiesLasting6m", 10],
    ["dip-good-neighbour", "cooperativeAccepted", 5],
    ["dip-winning-hearts", "npcInvitesAccepted", 3],
    ["dip-cultural-envoy", "missionsCompleted", 20],
    ["dip-consensus-builder", "proposalsApproved", 25],
    ["dip-old-friends", "allianceUnbroken18m", 1],
    ["dip-alliance-architect", "allianceArchitect", 1],
    ["dip-pacifist", "pacifist12m", 1],
    ["mil-peacekeeper", "peacekeeping15d", 10],
    ["nation-first-arms", "armsAttached", 1],
    ["nation-stewardship-1", "ownedMonths", 6],
    ["nation-stewardship-2", "ownedMonths", 18],
    ["nation-stewardship-3", "ownedMonths", 36],
    ["nation-identity", "identityComplete", 1],
    ["nation-heraldic-house", "heraldryPublishedInstitutions", 3],
    ["nation-cartographer", "mapEditsApproved", 10],
  ])("%s unlocks at %s >= %d and not one below", (id, metric, threshold) => {
    const def = byId(id)!;
    expect(isUnlocked(def, { [metric]: threshold })).toBe(true);
    expect(isUnlocked(def, { [metric]: threshold - 1 })).toBe(false);
    expect(isUnlocked(def, {})).toBe(false);
  });
});

describe("vid-end-of-days", () => {
  const stored = { key: "vid-end-of-days", conditionJson: null };
  const trees = new Set(["Executive", "Politics", "Diplomacy"]);
  const active = ALL_DEFINITIONS.filter((d) => !d.retired && d.id !== "vid-end-of-days");
  const treeIds = active.filter((d) => trees.has(d.category)).map((d) => d.id);
  const unlock = (held: string[]) =>
    achievementService.evaluateCondition(stored, {
      existingKeys: held,
    } satisfies AccountAchievementData);
  it("unlocks on every active Executive, Politics and Diplomacy achievement alone", () => {
    expect(unlock(treeIds)).toBe(true);
  });

  it("does not unlock with one Diplomacy achievement missing, however much else is held", () => {
    const rest = treeIds.filter((id) => id !== "dip-pacifist");
    const everythingElse = active.filter((d) => d.id !== "dip-pacifist").map((d) => d.id);
    expect(unlock(rest)).toBe(false);
    expect(unlock(everythingElse)).toBe(false);
  });
});

/** A tiny where-clause matcher: scalars, `lte`/`gte`/`in`, and nested relation filters. */
type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, want]) => {
    const have = row[key];
    if (want instanceof Date) return have instanceof Date && have.getTime() === want.getTime();
    if (want === null || typeof want !== "object") return have === want;
    const op = want as Row;
    if ("lte" in op) return (have as Date) <= (op.lte as Date);
    if ("gte" in op) return (have as Date) >= (op.gte as Date);
    if ("in" in op) return (op.in as unknown[]).includes(have);
    if ("notIn" in op) return !(op.notIn as unknown[]).includes(have);
    return have !== null && typeof have === "object" && matches(have as Row, op);
  });
}
const query = (rows: Row[]) =>
  jest.fn(async (args?: { where?: Row }) => rows.filter((r) => matches(r, args?.where ?? {})));
const counter = (rows: Row[]) =>
  jest.fn(
    async (args?: { where?: Row }) => rows.filter((r) => matches(r, args?.where ?? {})).length
  );

const NOW = new Date("2026-10-14T12:00:00.000Z");
const DAY_MS = 86_400_000;
const IXTIME_SPEED = 4;

/**
 * A nation whose every duration, read on the IxTime clock, is `IXTIME_SPEED` times what really
 * passed. `realScale` stretches the real durations: 1 is the scene as it really happened (nothing
 * is old enough yet), IXTIME_SPEED makes the real time equal the IxTime figures (the control).
 */
function scene(realScale: number) {
  const real = (ixDays: number) =>
    new Date(NOW.getTime() - (ixDays / IXTIME_SPEED) * realScale * DAY_MS);
  const ixDays = 20 * 30.44; // 20 IxTime months: past every month floor that Stewardship II and Old friends set
  const db = createMockPrisma({ $queryRaw: jest.fn() });

  db.country.findUnique.mockResolvedValue({
    ownedSince: real(ixDays),
    coatOfArms: null,
    nationalIdentity: null,
  });
  db.embassy.findMany = query(
    Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      guestCountryId: "c1",
      hostCountryId: `h${i}`,
      status: "active",
      establishedAt: real(ixDays),
      ixTimeTimestamp: ixDays,
    }))
  );
  db.diplomaticEvent.count.mockResolvedValue(0);
  db.foreignPolicyAction.count.mockResolvedValue(0);
  db.allianceMember.count = counter([
    { countryId: "c1", isActive: true, status: "active", joinedAt: real(ixDays) },
  ]);
  db.allianceMember.findMany = query([
    {
      allianceId: "a1",
      countryId: "c1",
      role: "founder",
      isActive: true,
      status: "active",
      alliance: { externalSourceKey: null, createdAt: real(ixDays) },
    },
  ]);
  db.allianceMember.groupBy.mockResolvedValue([{ allianceId: "a1", _count: { _all: 5 } }]);
  db.militaryOperation.findMany.mockResolvedValue(
    Array.from({ length: 10 }, () => ({
      createdAt: real(100),
      updatedAt: new Date(real(100).getTime() + (16 / IXTIME_SPEED) * realScale * DAY_MS),
      startIxTime: 0,
      endIxTime: 16,
    }))
  );
  db.embassyMission.findMany.mockResolvedValue(
    Array.from({ length: 20 }, (_, i) => {
      const completed = new Date(NOW.getTime() - (10 + i * 5) * DAY_MS);
      return {
        id: `m${i}`,
        culturalExchangeId: `x${i}`,
        createdAt: new Date(completed.getTime() - (4 / IXTIME_SPEED) * realScale * DAY_MS),
        updatedAt: completed,
      };
    })
  );
  const pinDates = Array.from(
    { length: 25 },
    (_, i) => new Date(NOW.getTime() - (i % 6) * 35 * (realScale / IXTIME_SPEED) * DAY_MS)
  );
  db.$queryRaw.mockResolvedValue([
    {
      pins: BigInt(pinDates.length),
      months: BigInt(distinctBuckets(pinDates, monthKey)),
      years: BigInt(5), // in-world years follow the IxTime clock: always 5
    },
  ]);
  return db;
}

async function unlockedBy(db: ReturnType<typeof createMockPrisma>): Promise<string[]> {
  const ctx: MetricContext = {
    db: db as never,
    clerkUserId: "clerk_1",
    userId: "user_1",
    countryId: "c1",
    now: NOW,
  };
  const metrics = Object.assign(
    {},
    ...(await Promise.all([diplomacyLoader.load(ctx), nationLoader.load(ctx)]))
  );
  return MINE.filter((d) => isUnlocked(d, metrics)).map((d) => d.id);
}

describe("the 4x IxTime fixture", () => {
  it("unlocks nothing early: a clock four times faster than real time earns no duration", async () => {
    // Only the milestone that takes no time (membership itself) unlocks.
    expect(await unlockedBy(scene(1))).toEqual(["dip-first-alliance"]);
  });

  it("unlocks the duration achievements once the same durations really passed (control)", async () => {
    expect(await unlockedBy(scene(IXTIME_SPEED))).toEqual(
      expect.arrayContaining([
        "dip-lasting-embassies",
        "dip-old-friends",
        "dip-alliance-architect",
        "dip-pacifist",
        "dip-cultural-envoy",
        "mil-peacekeeper",
        "nation-stewardship-1",
        "nation-stewardship-2",
        "nation-chronicler",
      ])
    );
  });
});
