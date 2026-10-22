/** @jest-environment node */
/**
 * The Diplomacy, Defense and Nation achievements (achievements pay IxCredits, so these are money guards). The metric
 * loader's real-time floors on live diplomacy data (V4): each key at its boundary, with the query filters that keep
 * NPCs, closed embassies, self-dealing, one exchange's bulk missions, typed dates, sock alliances and new nations from
 * counting. The sets (spec 5.3): each threshold not already exercised by the fixture below, End of days needing every
 * tree achievement, and the 4x IxTime fixture, where a clock running four times faster than real time unlocks nothing
 * early (durations are real).
 *
 * Folds diplomacy-nation-sets.
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
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import { distinctBuckets, monthKey, MONTH_MS } from "~/lib/achievements/time-buckets";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { DIPLOMACY_DEFINITIONS } from "~/lib/achievements/sets/diplomacy";
import { NATION_DEFINITIONS } from "~/lib/achievements/sets/nation";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const DAY_MS = 86_400_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function setup() {
  const db = createMockPrisma();
  db.country.findUnique.mockResolvedValue({ ownedSince: ago(24 * MONTH_MS) });
  db.allianceMember.groupBy.mockResolvedValue([]);
  const ctx: MetricContext = {
    db: db as never,
    clerkUserId: "clerk_1",
    userId: "user_1",
    countryId: "c1",
    now: NOW,
  };
  const load = async () => diplomacyLoader.load(ctx);
  return { db, ctx, load };
}

describe("embassiesLasting6m", () => {
  const embassy = (id: string, host: string, establishedMonthsAgo = 8) => ({
    id,
    hostCountryId: host,
    establishedAt: ago(establishedMonthsAgo * MONTH_MS),
  });
  /** The event `closeEmbassy` writes: the country pair, and no embassyId. */
  const closed = (host: string, monthsAgo: number, eventType = "embassy_closed") => ({
    embassyId: null,
    country2Id: host,
    createdAt: ago(monthsAgo * MONTH_MS),
    eventType,
  });
  /** The event `reopenEmbassy` writes: the pair and the embassyId. */
  const reopened = (id: string, host: string, monthsAgo: number) => ({
    embassyId: id,
    country2Id: host,
    createdAt: ago(monthsAgo * MONTH_MS),
  });
  it("does not count an embassy that was closed and reopened (the closed event has no embassyId)", async () => {
    const { db, load } = setup();
    db.embassy.findMany.mockResolvedValue([
      embassy("e1", "h1"),
      embassy("e2", "h2"),
      embassy("e3", "h3"),
    ]);
    // e2: closed (pair event) then reopened; e3: a reopening alone still proves a closure.
    db.diplomaticEvent.findMany.mockResolvedValue([
      closed("h2", 5),
      reopened("e2", "h2", 4),
      reopened("e3", "h3", 3),
    ]);
    expect((await load()).embassiesLasting6m).toBe(1);
  });

  it("does not count an embassy severed since it was established", async () => {
    const { db, load } = setup();
    db.embassy.findMany.mockResolvedValue([embassy("e1", "h1"), embassy("e2", "h2")]);
    db.diplomaticEvent.findMany.mockResolvedValue([closed("h1", 2, "embassy_severed")]);
    expect((await load()).embassiesLasting6m).toBe(1);
  });
});

describe("cooperativeAccepted", () => {
  it("counts accepted (active or lifted) cooperative actions whose target another player owns", async () => {
    const { db, load } = setup();
    db.foreignPolicyAction.count.mockResolvedValue(5);

    expect((await load()).cooperativeAccepted).toBe(5);
    expect(db.foreignPolicyAction.count).toHaveBeenCalledWith({
      where: {
        initiatorId: "c1",
        actionType: { in: ["free_trade", "military_alliance"] },
        status: { in: ["active", "lifted"] },
        target: { AND: [{ ownerUserId: { not: null } }, { ownerUserId: { not: "user_1" } }] },
      },
    });
  });
});
describe("missionsCompleted", () => {
  /** Real server timestamps: created `startDaysAgo` days ago, completed by the sweep `lengthDays` later. */
  const mission = (
    id: string,
    exchange: string | null,
    startDaysAgo: number,
    lengthDays: number
  ) => ({
    id,
    culturalExchangeId: exchange,
    createdAt: ago(startDaysAgo * DAY_MS),
    updatedAt: ago((startDaysAgo - lengthDays) * DAY_MS),
  });
  /** 20 missions of 7 days, one per exchange, completing in 3 different months. */
  const twentyOverThreeMonths = () =>
    Array.from({ length: 20 }, (_, i) => mission(`m${i}`, `x${i}`, 120 - i * 4, 7));
  it("counts one cultural exchange once, however many embassies it minted missions for", async () => {
    const { db, load } = setup();
    const bulk = Array.from({ length: 20 }, (_, i) => mission(`b${i}`, "one-exchange", 100, 7));
    db.embassyMission.findMany.mockResolvedValue([...bulk, ...twentyOverThreeMonths()]);
    expect((await load()).missionsCompleted).toBe(21);
  });

  it("ignores the player-typed dates: a backdated 3-day exchange completed at once is not 3 real days", async () => {
    const { db, load } = setup();
    db.embassyMission.findMany.mockResolvedValue(
      twentyOverThreeMonths().map((m) => ({
        ...m,
        startedAt: ago(200 * DAY_MS),
        completesAt: ago(197 * DAY_MS),
        updatedAt: new Date(m.createdAt.getTime() + 60_000),
      }))
    );
    expect((await load()).missionsCompleted).toBe(0);
  });
});

describe("proposalsApproved", () => {
  it("counts approved or active proposals with a vote for from another country in alliances of 3 or more active members", async () => {
    const { db, load } = setup();
    db.allianceAction.findMany.mockResolvedValue([
      { allianceId: "a1" },
      { allianceId: "a1" },
      { allianceId: "a2" },
    ]);
    db.allianceMember.groupBy.mockResolvedValue([
      { allianceId: "a1", _count: { _all: 3 } },
      { allianceId: "a2", _count: { _all: 2 } },
    ]);

    expect((await load()).proposalsApproved).toBe(2);
    expect(db.allianceAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          proposedBy: "c1",
          status: { in: ["approved", "active"] },
          votes: { some: { vote: "for", countryId: { not: "c1" } } },
        },
      })
    );
    expect(db.allianceMember.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["allianceId"],
        where: { allianceId: { in: ["a1", "a2"] }, isActive: true, status: "active" },
      })
    );
  });
});

describe("alliance membership", () => {
  it("allianceArchitect: a founded alliance 12 real months old, not realm-synced, with 5 or more active members", async () => {
    const { db, load } = setup();
    db.allianceMember.findMany.mockResolvedValue([{ allianceId: "a1" }, { allianceId: "a2" }]);
    db.allianceMember.groupBy.mockResolvedValue([
      { allianceId: "a1", _count: { _all: 5 } },
      { allianceId: "a2", _count: { _all: 4 } },
    ]);

    expect((await load()).allianceArchitect).toBe(1);
    expect(db.allianceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          countryId: "c1",
          role: "founder",
          isActive: true,
          status: "active",
          alliance: { externalSourceKey: null, createdAt: { lte: ago(12 * MONTH_MS) } },
        },
      })
    );
  });
});

describe("pacifist12m", () => {
  it("is 0 without 12 real months of ownership, whatever the history (a new nation is not a pacifist)", async () => {
    const { db, load } = setup();
    db.country.findUnique.mockResolvedValue({ ownedSince: ago(12 * MONTH_MS - 1) });
    expect((await load()).pacifist12m).toBe(0);

    db.country.findUnique.mockResolvedValue({ ownedSince: null });
    expect((await load()).pacifist12m).toBe(0);
  });
});

describe("peacekeeping15d", () => {
  const operation = (lengthMs: number) => ({
    createdAt: ago(100 * DAY_MS),
    updatedAt: new Date(ago(100 * DAY_MS).getTime() + lengthMs),
  });
  it("counts operations that lasted 15 real days or longer, by createdAt and updatedAt", async () => {
    const { db, load } = setup();
    db.militaryOperation.findMany.mockResolvedValue([
      operation(15 * DAY_MS),
      operation(15 * DAY_MS - 1),
      operation(40 * DAY_MS),
      operation(0),
    ]);
    expect((await load()).peacekeeping15d).toBe(2);
  });
});

const MINE = [...DIPLOMACY_DEFINITIONS, ...NATION_DEFINITIONS];
const byId = (id: string) => MINE.find((d) => d.id === id);

const isUnlocked = (def: AchievementDefinition, metrics: Record<string, number>) =>
  achievementService.evaluateCondition(
    { key: def.id, conditionJson: null },
    { country: { id: "c1" } as never, metrics }
  );
describe("thresholds the fixture does not reach", () => {
  it.each([
    ["dip-good-neighbour", "cooperativeAccepted", 5],
    ["dip-winning-hearts", "npcInvitesAccepted", 3],
    ["dip-consensus-builder", "proposalsApproved", 25],
    ["nation-first-arms", "armsAttached", 1],
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
