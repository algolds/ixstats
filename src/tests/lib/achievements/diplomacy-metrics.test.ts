/** @jest-environment node */
/**
 * The Diplomacy and Defense metric loader: real-time floors on live diplomacy data (V4). Each key
 * is checked at its boundary, with the query filters that make NPCs, closed embassies and
 * hostile actions not count.
 */
import { diplomacyLoader } from "~/lib/achievements/metrics/diplomacy";
import type { MetricContext } from "~/lib/achievements/metrics/registry";
import { MONTH_MS } from "~/lib/achievements/time-buckets";
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

describe("diplomacyLoader", () => {
  it("is a country loader that declares every key it returns", async () => {
    const { load } = setup();
    expect(diplomacyLoader.scope).toBe("country");
    expect(Object.keys(await load()).sort()).toEqual([...diplomacyLoader.keys].sort());
  });

  it("returns nothing for a user with no country", async () => {
    const { ctx } = setup();
    expect(await diplomacyLoader.load({ ...ctx, countryId: null })).toEqual({});
  });
});

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

  it("asks for the embassies the country runs, active, established 6 real months ago or earlier", async () => {
    const { db, load } = setup();
    await load();
    expect(db.embassy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          guestCountryId: "c1",
          status: "active",
          establishedAt: { lte: ago(6 * MONTH_MS) },
        },
      })
    );
  });

  it("asks for closures by country pair (closed events carry no embassyId) and for reopenings", async () => {
    const { db, load } = setup();
    db.embassy.findMany.mockResolvedValue([embassy("e1", "h1"), embassy("e2", "h2")]);
    await load();
    expect(db.diplomaticEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { embassyId: { in: ["e1", "e2"] }, eventType: "embassy_reopened" },
            {
              country1Id: "c1",
              country2Id: { in: ["h1", "h2"] },
              eventType: { in: ["embassy_closed", "embassy_severed"] },
            },
          ],
        },
      })
    );
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

  it("ignores a closure from before this embassy was established (a severed one was deleted and rebuilt)", async () => {
    const { db, load } = setup();
    db.embassy.findMany.mockResolvedValue([embassy("e1", "h1", 8)]);
    db.diplomaticEvent.findMany.mockResolvedValue([closed("h1", 9)]);
    expect((await load()).embassiesLasting6m).toBe(1);
  });

  it("is 0 without embassies and skips the event query", async () => {
    const { db, load } = setup();
    expect((await load()).embassiesLasting6m).toBe(0);
    expect(db.diplomaticEvent.findMany).not.toHaveBeenCalled();
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

describe("npcInvitesAccepted", () => {
  it("counts distinct NPC nations (no owner) with an active membership this country invited", async () => {
    const { db, load } = setup();
    db.allianceMember.groupBy.mockImplementation(
      async (args: { where: { invitedByCountryId?: string } }) =>
        args.where.invitedByCountryId === "c1"
          ? [{ countryId: "npc1" }, { countryId: "npc2" }, { countryId: "npc3" }]
          : [{ countryId: "other" }]
    );

    expect((await load()).npcInvitesAccepted).toBe(3);
    expect(db.allianceMember.groupBy).toHaveBeenCalledWith({
      by: ["countryId"],
      where: {
        invitedByCountryId: "c1",
        isActive: true,
        status: "active",
        country: { ownerUserId: null },
      },
    });
  });

  it("counts one NPC that accepted into three alliances once", async () => {
    const { db, load } = setup();
    // The group-by collapses the NPC's three memberships to one row.
    db.allianceMember.groupBy.mockResolvedValue([{ countryId: "npc1" }]);

    expect((await load()).npcInvitesAccepted).toBe(1);
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

  it("asks for completed missions of the embassies the country runs", async () => {
    const { db, load } = setup();
    await load();
    expect(db.embassyMission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "completed", embassy: { guestCountryId: "c1" } },
      })
    );
  });

  it("counts 20 missions completed across 3 different months, and 0 across only 2", async () => {
    const { db, load } = setup();
    db.embassyMission.findMany.mockResolvedValue(twentyOverThreeMonths());
    expect((await load()).missionsCompleted).toBe(20);

    db.embassyMission.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => mission(`m${i}`, `x${i}`, 30 - i, 7))
    );
    expect((await load()).missionsCompleted).toBe(0);
  });

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

  it("ignores missions that ran under 3 real days (3 days exactly counts)", async () => {
    const { db, load } = setup();
    const missions = twentyOverThreeMonths();
    db.embassyMission.findMany.mockResolvedValue(
      missions.map((m, i) =>
        i === 0 ? { ...m, updatedAt: new Date(m.createdAt.getTime() + 3 * DAY_MS - 1) } : m
      )
    );
    expect((await load()).missionsCompleted).toBe(19);

    db.embassyMission.findMany.mockResolvedValue(
      missions.map((m, i) =>
        i === 0 ? { ...m, updatedAt: new Date(m.createdAt.getTime() + 3 * DAY_MS) } : m
      )
    );
    expect((await load()).missionsCompleted).toBe(20);
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

  it("is 0 without proposals and skips the member query", async () => {
    const { db, load } = setup();
    expect((await load()).proposalsApproved).toBe(0);
    expect(db.allianceMember.groupBy).not.toHaveBeenCalledWith(
      expect.objectContaining({ by: ["allianceId"] })
    );
  });
});

describe("alliance membership", () => {
  const memberships = (db: ReturnType<typeof setup>["db"]) =>
    db.allianceMember.count.mock.calls.map(([args]) => args.where);

  it("allianceJoined counts active memberships", async () => {
    const { db, load } = setup();
    db.allianceMember.count.mockResolvedValue(1);
    expect((await load()).allianceJoined).toBe(1);
    expect(memberships(db)).toContainEqual({ countryId: "c1", isActive: true, status: "active" });
  });

  it("allianceUnbroken18m needs joinedAt (reset on every acceptance) 18 real months back", async () => {
    const { db, load } = setup();
    await load();
    expect(memberships(db)).toContainEqual({
      countryId: "c1",
      isActive: true,
      status: "active",
      joinedAt: { lte: ago(18 * MONTH_MS) },
    });
  });

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

  it("allianceArchitect is 0 when no founded alliance reaches 5 members", async () => {
    const { db, load } = setup();
    db.allianceMember.findMany.mockResolvedValue([{ allianceId: "a2" }]);
    db.allianceMember.groupBy.mockResolvedValue([{ allianceId: "a2", _count: { _all: 4 } }]);
    expect((await load()).allianceArchitect).toBe(0);
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

  it("is 1 at exactly 12 months with no hostile action and no embassy closed or severed", async () => {
    const { db, load } = setup();
    db.country.findUnique.mockResolvedValue({ ownedSince: ago(12 * MONTH_MS) });
    db.foreignPolicyAction.count.mockResolvedValue(0);
    db.diplomaticEvent.count.mockResolvedValue(0);

    expect((await load()).pacifist12m).toBe(1);
    expect(db.foreignPolicyAction.count).toHaveBeenCalledWith({
      where: {
        initiatorId: "c1",
        actionType: { notIn: ["free_trade", "military_alliance"] },
        createdAt: { gte: ago(12 * MONTH_MS) },
      },
    });
    expect(db.diplomaticEvent.count).toHaveBeenCalledWith({
      where: {
        country1Id: "c1",
        eventType: { in: ["embassy_closed", "embassy_severed"] },
        createdAt: { gte: ago(12 * MONTH_MS) },
      },
    });
  });

  it("a hostile action, or a closed embassy, in the last 12 months breaks it", async () => {
    const { db, load } = setup();
    db.country.findUnique.mockResolvedValue({ ownedSince: ago(13 * MONTH_MS) });
    db.foreignPolicyAction.count.mockResolvedValue(1);
    db.diplomaticEvent.count.mockResolvedValue(0);
    expect((await load()).pacifist12m).toBe(0);

    db.foreignPolicyAction.count.mockResolvedValue(0);
    db.diplomaticEvent.count.mockResolvedValue(1);
    expect((await load()).pacifist12m).toBe(0);
  });
});

describe("peacekeeping15d", () => {
  const operation = (lengthMs: number) => ({
    createdAt: ago(100 * DAY_MS),
    updatedAt: new Date(ago(100 * DAY_MS).getTime() + lengthMs),
  });

  it("asks for completed peacekeeping operations of the country", async () => {
    const { db, load } = setup();
    await load();
    expect(db.militaryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { countryId: "c1", operationType: "peacekeeping", status: "completed" },
      })
    );
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
