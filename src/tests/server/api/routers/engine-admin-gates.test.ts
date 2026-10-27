/** @jest-environment node */
/**
 * The engines' admin consoles: the national issues engine (configuration, stats, manual evaluation, the world audit
 * list), NPC personalities and intelligence report templates. One row per router: every admin procedure refuses a
 * player and a signed-out visitor, writing nothing. Then the input bounds each console enforces, and deletes that
 * retire a personality or a template instead of removing it (and a partial trait edit that merges).
 *
 * Folds national-issues-engine, npc-personalities and intelligence-templates.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted jest.mock() factory below
 * calls jest.fn() inline.
 */
jest.mock("~/lib/national-issues", () => ({
  __esModule: true,
  NationalIssuesEngine: {
    forceGenerate: jest.fn().mockResolvedValue(null),
    evaluateCountry: jest.fn().mockResolvedValue({ generated: 1 }),
  },
  getNationalIssuesConfig: jest.fn(() => ({ maxIssuesPerSession: 3, maxIssuesPerWeek: 10 })),
  saveNationalIssuesConfig: jest.fn(),
  completeNationalIssuesConfig: jest.fn((input: object) => ({
    spawnMode: "probability",
    ...input,
  })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { nationalIssuesEngineRouter } from "~/server/api/routers/national-issues/engine";
import { npcPersonalitiesRouter } from "~/server/api/routers/npcPersonalities";
import { intelligenceRouter } from "~/server/api/routers/intelligence";
import { NationalIssuesEngine, saveNationalIssuesConfig } from "~/lib/national-issues";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const engine = createCallerFactory(nationalIssuesEngineRouter);
const personalities = createCallerFactory(npcPersonalitiesRouter);
const intelligence = createCallerFactory(intelligenceRouter);

type Who = "admin" | "player" | null;
const ctxAs = (db: MockPrismaProxy, who: Who) =>
  createMockRouterContext({
    db,
    auth: who ? { userId: `clerk_${who}` } : null,
    user: who
      ? {
          id: who,
          clerkUserId: `clerk_${who}`,
          role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
        }
      : null,
    rateLimitIdentifier: `${who}_${Math.random()}`,
  }) as never;

const traits = {
  assertiveness: 50,
  cooperativeness: 50,
  economicFocus: 50,
  culturalOpenness: 50,
  riskTolerance: 50,
  ideologicalRigidity: 50,
  militarism: 50,
  isolationism: 50,
};
const newPersonality = {
  name: "The Merchant Prince",
  archetype: "peaceful_merchant" as const,
  traits,
  traitDescriptions: { economicFocus: "Trade first" },
  culturalProfile: {
    formality: 1,
    directness: 1,
    emotionality: 1,
    flexibility: 1,
    negotiationStyle: "patient",
  },
  toneMatrix: { friendly: { greeting: "Welcome" } },
  responsePatterns: ["Offer a deal"],
  scenarioResponses: {},
  eventModifiers: {},
};
const template = {
  reportType: "economic" as const,
  classification: "PUBLIC" as const,
  summaryTemplate: "{country} grows",
  findingsTemplate: '["GDP up"]',
  minimumLevel: 2,
  confidenceBase: 60,
};

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.nationalIssue.groupBy.mockResolvedValue([]);
  db.nPCPersonality.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "p1",
    ...data,
  }));
  db.nPCPersonality.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: object }) => ({
      id: where.id,
      name: "Updated",
      ...data,
    })
  );
  db.intelligenceTemplate.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "t1",
    ...data,
  }));
  db.intelligenceTemplate.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: object }) => ({
      id: where.id,
      reportType: "economic",
      ...data,
    })
  );
});

/** How a call ends: "served", or the message it was refused with. */
const outcomeOf = (call: Promise<unknown>) =>
  call.then(
    () => "served",
    (error: { message?: string }) => error.message
  );

const CONSOLES: Array<{
  name: string;
  calls: Record<string, (who: Who) => Promise<unknown>>;
  writes: () => jest.Mock[];
}> = [
  {
    name: "nationalIssues engine",
    calls: {
      getEngineConfig: (who) => engine(ctxAs(db, who)).getEngineConfig(),
      updateEngineConfig: (who) =>
        engine(ctxAs(db, who)).updateEngineConfig({ maxIssuesPerSession: 2, maxIssuesPerWeek: 5 }),
      triggerEvaluation: (who) => engine(ctxAs(db, who)).triggerEvaluation({ countryId: "c1" }),
      getActiveIssues: (who) => engine(ctxAs(db, who)).getActiveIssues({}),
    },
    writes: () => [
      saveNationalIssuesConfig as unknown as jest.Mock,
      NationalIssuesEngine.evaluateCountry as unknown as jest.Mock,
    ],
  },
  {
    name: "npcPersonalities",
    calls: {
      createPersonality: (who) => personalities(ctxAs(db, who)).createPersonality(newPersonality),
      updatePersonality: (who) =>
        personalities(ctxAs(db, who)).updatePersonality({ id: "p1", name: "X" }),
      deletePersonality: (who) => personalities(ctxAs(db, who)).deletePersonality({ id: "p1" }),
      assignPersonalityToCountry: (who) =>
        personalities(ctxAs(db, who)).assignPersonalityToCountry({
          personalityId: "p1",
          countryId: "c1",
        }),
    },
    writes: () => [
      db.nPCPersonality.create,
      db.nPCPersonality.update,
      db.nPCPersonalityAssignment.create,
    ],
  },
  {
    name: "intelligence templates",
    calls: {
      createTemplate: (who) => intelligence(ctxAs(db, who)).createTemplate(template),
      updateTemplate: (who) =>
        intelligence(ctxAs(db, who)).updateTemplate({ id: "t1", minimumLevel: 3 }),
      deleteTemplate: (who) => intelligence(ctxAs(db, who)).deleteTemplate({ id: "t1" }),
    },
    writes: () => [db.intelligenceTemplate.create, db.intelligenceTemplate.update],
  },
];

describe("admin consoles", () => {
  it.each(CONSOLES)(
    "$name refuses players and signed-out visitors on every admin procedure",
    async ({ calls, writes }) => {
      const refusals: Record<string, [string | undefined, string | undefined]> = {};
      for (const [procedure, call] of Object.entries(calls)) {
        refusals[procedure] = [await outcomeOf(call("player")), await outcomeOf(call(null))];
      }
      expect(refusals).toEqual(
        Object.fromEntries(
          Object.keys(calls).map((procedure) => [
            procedure,
            [
              expect.stringMatching(/Admin privileges required/),
              expect.stringMatching(/Authentication required/),
            ],
          ])
        )
      );
      expect(writes().filter((write) => write.mock.calls.length > 0)).toEqual([]);
    }
  );

  it.each([
    [
      "engine limits out of range",
      () =>
        engine(ctxAs(db, "admin")).updateEngineConfig({
          maxIssuesPerSession: 11,
          maxIssuesPerWeek: 5,
        }),
    ],
    [
      "a world issues list above its cap",
      () => engine(ctxAs(db, null)).getRecentWorldIssues({ limit: 37 }),
    ],
    [
      "a personality trait outside 0 to 100",
      () =>
        personalities(ctxAs(db, "admin")).createPersonality({
          ...newPersonality,
          traits: { ...traits, militarism: 101 },
        }),
    ],
    [
      "findings that are not a JSON array",
      () =>
        intelligence(ctxAs(db, "admin")).createTemplate({
          ...template,
          findingsTemplate: '{"a":1}',
        }),
    ],
    [
      "a template level or confidence out of range",
      () => intelligence(ctxAs(db, "admin")).createTemplate({ ...template, minimumLevel: 6 }),
    ],
  ])("refuses %s, writing nothing", async (_label, call) => {
    await expect(call()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveNationalIssuesConfig).not.toHaveBeenCalled();
    expect(db.nPCPersonality.create).not.toHaveBeenCalled();
    expect(db.intelligenceTemplate.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a personality",
      () => personalities(ctxAs(db, "admin")).deletePersonality({ id: "p1" }),
      () => db.nPCPersonality,
      "p1",
    ],
    [
      "a template",
      () => intelligence(ctxAs(db, "admin")).deleteTemplate({ id: "t1" }),
      () => db.intelligenceTemplate,
      "t1",
    ],
  ])("retires %s instead of deleting it", async (_label, remove, model, id) => {
    await remove();
    expect(model().update).toHaveBeenCalledWith({ where: { id }, data: { isActive: false } });
    expect(model().delete).not.toHaveBeenCalled();
  });

  it("merges a partial trait edit into the personality", async () => {
    await personalities(ctxAs(db, "admin")).updatePersonality({
      id: "p1",
      traits: { militarism: 80 },
    });
    expect(db.nPCPersonality.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ militarism: 80, updatedAt: expect.any(Date) }),
    });
  });
});
