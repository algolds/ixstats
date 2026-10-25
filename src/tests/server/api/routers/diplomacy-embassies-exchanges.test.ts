/** @jest-environment node */
/**
 * Embassies, cultural exchanges and diplomatic scenarios do what they record (WP-DE: P1-18, P1-24, P1-25, P1-26,
 * P1-23 F17/F19, F30, F31). An embassy is never opened in its own nation, and opening one starts a neutral relation;
 * closing one costs reputation (it used to raise it) and relation strength, reopening wins a little back once, and
 * severing really cools the relation. The embassy list carries the pair's relation strength, not a staff formula.
 * Exchanges run planning → active → completed with metrics from what happened; joining needs a running public
 * exchange; their impact is the host's to measure, from those metrics. The AI answers only for nations nobody plays.
 * The events hub finds a nation's scenarios on either side, its history holds only finished ones, and a choice's
 * relationship change reaches the relation.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { Diplomatic: { onEmbassyEstablished: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/diplomacy/choice-tracker", () => ({
  DiplomaticChoiceTracker: { recordChoice: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticEmbassiesRouter } from "~/server/api/routers/diplomacy/embassies";
import { diplomaticCulturalRouter } from "~/server/api/routers/diplomacy/cultural";
import { diplomaticScenariosRouter } from "~/server/api/routers/diplomaticScenarios";
import { advanceCulturalExchanges, exchangeMetrics } from "~/lib/diplomacy/cultural-exchange-lifecycle";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const embassies = createCallerFactory(diplomaticEmbassiesRouter);
const cultural = createCallerFactory(diplomaticCulturalRouter);
const scenarios = createCallerFactory(diplomaticScenariosRouter);

/** One relation row between the caller and the foreign nation, updated in place. */
function relationDelegate(strength: number | null) {
  const row = strength === null ? null : { id: "rel1", strength, relationship: "neutral" };
  return {
    row,
    findFirst: jest.fn(async () => (row ? { ...row } : null)),
    findMany: jest.fn(async () =>
      row ? [{ country1: CALLER_COUNTRY, country2: FOREIGN_COUNTRY, strength: row.strength }] : []
    ),
    create: jest.fn(async ({ data }: { data: object }) => data),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(row!, data)),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("embassies", () => {
  it("are never opened in their own nation, and opening one starts a neutral relation", async () => {
    const relation = relationDelegate(null);
    const ctx = createIdorContext({
      embassy: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "e1" }),
      },
      diplomaticRelation: relation,
    });
    const caller = embassies(ctx as never);
    await expect(
      caller.establishEmbassy({ hostCountryId: CALLER_COUNTRY, guestCountryId: CALLER_COUNTRY, name: "Self" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await caller.establishEmbassy({ hostCountryId: FOREIGN_COUNTRY, guestCountryId: CALLER_COUNTRY, name: "E" });
    expect(relation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ strength: 55, relationship: "neutral" }),
    });
  });

  it("closing costs reputation and relation strength; reopening wins some back once; severing cools it", async () => {
    const relation = relationDelegate(60);
    const embassy = {
      id: "e1",
      name: "Embassy",
      hostCountryId: FOREIGN_COUNTRY,
      guestCountryId: CALLER_COUNTRY,
      status: "active",
      influence: 40,
      reputation: 50,
      hostCountry: { name: "Foreignland" },
      guestCountry: { name: "Testland" },
    };
    const embassyUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      embassy.status = String(data.status);
      return embassy;
    });
    const ctx = createIdorContext({
      embassy: {
        findUnique: jest.fn(async () => ({ ...embassy })),
        findUniqueOrThrow: jest.fn(async () => ({ ...embassy })),
        update: embassyUpdate,
        updateMany: jest.fn(async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
          if (embassy.status !== where.status) return { count: 0 };
          embassy.status = data.status;
          return { count: 1 };
        }),
        delete: jest.fn().mockResolvedValue(embassy),
      },
      diplomaticRelation: relation,
      diplomaticEvent: { create: jest.fn().mockResolvedValue({}) },
    });
    const caller = embassies(ctx as never);

    await caller.closeEmbassy({ embassyId: "e1" });
    expect(embassyUpdate.mock.calls[0]![0].data).toMatchObject({
      reputation: { decrement: 10 },
      influence: { decrement: 20 },
    });
    expect(relation.row).toMatchObject({ strength: 45, relationship: "neutral" });

    await caller.reopenEmbassy({ embassyId: "e1" });
    expect(relation.row!.strength).toBe(50);
    await expect(caller.reopenEmbassy({ embassyId: "e1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(relation.row!.strength).toBe(50);

    await caller.deleteEmbassy({ embassyId: "e1" });
    expect(relation.row).toMatchObject({ strength: 20, relationship: "tense" });
  });

  it("list the pair's relation strength (null without a relation), not a staff formula", async () => {
    const listed = (strength: number | null) => {
      const db = createMockPrisma({
        embassy: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "e1",
              name: "E",
              hostCountryId: FOREIGN_COUNTRY,
              guestCountryId: CALLER_COUNTRY,
              status: "active",
              services: null,
              staffCount: 9,
              establishedAt: new Date(),
              updatedAt: new Date(),
              hostCountry: { id: FOREIGN_COUNTRY, name: "F" },
              guestCountry: { id: CALLER_COUNTRY, name: "T" },
            },
          ]),
        },
        diplomaticRelation: relationDelegate(strength),
      });
      return embassies(createIdorContext(db as never) as never).getEmbassies({ countryId: CALLER_COUNTRY });
    };
    expect((await listed(72))[0]!.strength).toBe(72);
    expect((await listed(null))[0]!.strength).toBeNull();
  });
});

describe("cultural exchanges", () => {
  it("run planning → active → completed, with metrics from what happened", async () => {
    const now = new Date("2026-10-25T00:00:00Z");
    const day = 86_400_000;
    const rows = [
      { id: "starting", status: "planning", startDate: new Date(now.getTime() - day), endDate: new Date(now.getTime() + day), counts: [1, 2, 3] },
      { id: "ending", status: "active", startDate: new Date(now.getTime() - 9 * day), endDate: new Date(now.getTime() - day), counts: [2, 0, 0] },
      { id: "racing", status: "planning", startDate: new Date(now.getTime() - day), endDate: new Date(now.getTime() + day), counts: [0, 0, 0] },
    ];
    const updateMany = jest.fn(async ({ where }: { where: { id: string } }) => ({
      count: where.id === "racing" ? 0 : 1,
    }));
    const db = {
      culturalExchange: {
        findMany: jest.fn(async () =>
          rows.map((r) => ({
            ...r,
            _count: { participatingCountries: r.counts[0], culturalArtifacts: r.counts[1], votes: r.counts[2] },
          }))
        ),
        updateMany,
      },
    };
    expect(await advanceCulturalExchanges(db as never, now)).toEqual({
      exchangesActivated: 1,
      exchangesCompleted: 1,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "starting", status: "planning" },
      data: { status: "active", participants: 1, ...exchangeMetrics({ participants: 1, artifacts: 2, votes: 3 }) },
    });
    expect(updateMany.mock.calls[1]![0]).toMatchObject({
      where: { id: "ending", status: "active" },
      data: { status: "completed", culturalImpact: 60, diplomaticValue: 50, socialEngagement: 20 },
    });
  });

  const exchange = (over: Record<string, unknown> = {}) => ({
    id: "ex1",
    title: "Festival",
    type: "festival",
    status: "active",
    isPublic: true,
    maxParticipants: null,
    hostCountryId: FOREIGN_COUNTRY,
    hostCountryName: "Foreignland",
    participatingCountries: [] as Array<{ countryId: string; countryName?: string }>,
    ...over,
  });
  const joinAs = (row: ReturnType<typeof exchange>) =>
    cultural(
      createIdorContext({
        culturalExchange: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn() },
        culturalExchangeParticipant: { create: jest.fn().mockResolvedValue({ id: "p1" }) },
      }) as never
    ).joinCulturalExchange({ exchangeId: "ex1", countryId: CALLER_COUNTRY, countryName: "Testland" });

  it("can be joined only while running, public, not hosted by the joiner, not joined yet and not full", async () => {
    await expect(joinAs(exchange())).resolves.toMatchObject({ id: "p1" });
    for (const refused of [
      exchange({ status: "planning" }),
      exchange({ isPublic: false }),
      exchange({ hostCountryId: CALLER_COUNTRY }),
      exchange({ participatingCountries: [{ countryId: CALLER_COUNTRY }] }),
      exchange({ maxParticipants: 1, participatingCountries: [{ countryId: "other" }] }),
    ]) {
      await expect(joinAs(refused)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("have their impact measured by the host only, from their metrics, and only with participants", async () => {
    const measured = (row: Record<string, unknown>) => {
      const create = jest.fn(async ({ data }: { data: object }) => data);
      const db = createMockPrisma({
        culturalExchange: { findUnique: jest.fn().mockResolvedValue(row) },
        culturalExchangeOutcome: { create },
        diplomaticRelation: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const call = cultural(createIdorContext(db as never) as never).calculateExchangeImpact({
        exchangeId: "ex1",
        responseChoice: "collaborative",
        participantSatisfaction: 70,
        publicPerception: 60,
      });
      return { call, create };
    };
    const base = {
      ...exchange({ status: "completed", economicCost: 0, startDate: new Date(), endDate: new Date() }),
      _count: { culturalArtifacts: 0, votes: 0 },
    };
    await expect(measured(base).call).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      measured({ ...base, hostCountryId: CALLER_COUNTRY }).call
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const { call, create } = measured({
      ...base,
      hostCountryId: CALLER_COUNTRY,
      participatingCountries: [
        { countryId: "p1", countryName: "One" },
        { countryId: "p2", countryName: "Two" },
      ],
    });
    await call;
    // Two participants: cultural impact 60, ten over an ordinary exchange's 50; recorded for the host
    expect(create.mock.calls[0]![0].data).toMatchObject({
      countryId: CALLER_COUNTRY,
      culturalImpactChange: 10,
      diplomaticChange: 0,
    });
  });

  it("get AI answers only for participants nobody plays", async () => {
    const db = createMockPrisma({
      culturalExchange: {
        findUnique: jest.fn().mockResolvedValue({
          ...exchange({ economicCost: 1000, description: "", startDate: new Date(), endDate: new Date() }),
          participatingCountries: [
            { countryId: "npc", countryName: "Npcland", role: "participant" },
            { countryId: "player", countryName: "Playerland", role: "participant" },
          ],
          _count: { culturalArtifacts: 0, votes: 0 },
        }),
      },
      country: { findMany: jest.fn().mockResolvedValue([{ id: "npc" }]) },
      culturalExchangeOutcome: { count: jest.fn().mockResolvedValue(0) },
      diplomaticRelation: { findMany: jest.fn().mockResolvedValue([]) },
      embassy: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const responses = await cultural(createIdorContext(db as never) as never).getNPCCulturalResponses({
      exchangeId: "ex1",
      hostCountryId: FOREIGN_COUNTRY,
    });
    expect(responses.map((r) => r.countryId)).toEqual(["npc"]);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerUserId: null }) })
    );
  });
});

describe("diplomatic scenarios", () => {
  it("are found on either side, and the history holds only finished ones", async () => {
    const db = createMockPrisma({
      culturalScenario: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    });
    const caller = scenarios(createIdorContext(db as never) as never);
    await caller.getAllScenarios({ countryId: CALLER_COUNTRY, isActive: false });
    const where = db.culturalScenario.findMany.mock.calls[0]![0].where;
    expect(where.AND).toEqual([
      {
        OR: [
          { status: { in: ["completed", "expired"] } },
          { status: { in: ["active", "pending"] }, expiresAt: { lte: expect.any(Date) } },
        ],
      },
      { OR: [{ country1Id: CALLER_COUNTRY }, { country2Id: CALLER_COUNTRY }] },
    ]);
  });

  it("a choice's relationship change reaches the relation", async () => {
    const countryA = "ckcountrya0000000000001";
    const scenario = {
      id: "ckscenario00000000000004",
      type: "cultural_exchange",
      title: "Scenario",
      narrative: "N",
      country1Id: countryA,
      country2Id: "ckcountryb0000000000002",
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      responseOptions: JSON.stringify([{ id: "warm", label: "Warm", effects: { relationshipChange: 8 } }]),
      tags: "[]",
    };
    const relation = relationDelegate(50);
    const db = createMockPrisma({
      culturalScenario: {
        findUnique: jest.fn().mockResolvedValue(scenario),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...scenario, status: "completed" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      diplomaticRelation: relation,
      culturalExchange: { create: jest.fn().mockResolvedValue({}) },
    });
    const ctx = createIdorContext(db as never);
    ctx.user!.countryId = countryA;
    await scenarios(ctx as never).recordChoice({
      scenarioId: scenario.id,
      countryId: countryA,
      choiceId: "warm",
      choiceLabel: "Warm",
    });
    expect(relation.row!.strength).toBe(58);
  });
});
