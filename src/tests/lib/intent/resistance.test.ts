// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => 1000000 },
}));

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  INTENT_CATEGORY_TO_TEMPLATE,
  spawnIntentResistance,
  spawnResistanceForIntent,
} from "~/lib/intent/resistance";
import { NationalIssuesEngine, nationalIssuesConfig } from "~/lib/national-issues";

let mockSpawnMode = "deterministic";
const forceGenerateMock = jest
  .spyOn(NationalIssuesEngine, "forceGenerate")
  .mockResolvedValue("issue-1" as any);
const configMock = jest
  .spyOn(nationalIssuesConfig, "getNationalIssuesConfig")
  .mockImplementation(() => ({
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: mockSpawnMode as any,
  }));

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-economic",
    title: "Economic Resistance in {{country}}",
    description: "Citizens are demonstrating against economic reforms in {{country}}.",
    triggerReason: "Policy resistance triggered",
    domain: "economic",
    category: "economic",
    options: [
      {
        id: "opt_1",
        label: "Compromise",
        description: "Offer compromises",
        consequences: [],
      },
    ],
    cooldownDays: 30,
    maxActivePerCountry: 1,
    baseUrgency: 60,
    ...overrides,
  };
}

function makeDb(overrides: Record<string, unknown> = {}): any {
  const defaultHandlers: Record<string, any> = {
    findMany: (jest.fn() as any).mockResolvedValue([]),
    findUnique: (jest.fn() as any).mockResolvedValue(null),
    findFirst: (jest.fn() as any).mockResolvedValue(null),
    count: (jest.fn() as any).mockResolvedValue(0),
    update: (jest.fn() as any).mockResolvedValue({ id: "issue-1" }),
    create: (jest.fn() as any).mockResolvedValue({ id: "issue-1" }),
    updateMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
    createMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
    delete: (jest.fn() as any).mockResolvedValue({}),
  };

  const target: any = {
    nationalIssueTemplate: {
      ...defaultHandlers,
      findMany: (jest.fn() as any).mockResolvedValue([makeTemplate()]),
      findUnique: (jest.fn() as any).mockResolvedValue(makeTemplate()),
    },
    nationalIssue: {
      ...defaultHandlers,
      findFirst: (jest.fn() as any).mockResolvedValue(null),
      count: (jest.fn() as any).mockResolvedValue(0),
      update: (jest.fn() as any).mockResolvedValue({ id: "issue-1" }),
      create: (jest.fn() as any).mockResolvedValue({ id: "issue-1" }),
    },
    country: {
      ...defaultHandlers,
      findUnique: (jest.fn() as any).mockResolvedValue({
        id: "country-1",
        name: "Testland",
        currentGdpPerCapita: 20000,
        currentPopulation: 1000000,
      }),
    },
    ...overrides,
  };

  return new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      if (typeof prop === "symbol") return undefined;
      return defaultHandlers;
    },
  });
}

const intent = { id: "intent-1", category: "economy", tier: "extreme" };

beforeEach(() => {
  jest.clearAllMocks();
  mockSpawnMode = "deterministic";
  forceGenerateMock.mockResolvedValue("issue-1" as any);
  configMock.mockImplementation(() => ({
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: mockSpawnMode as any,
  }));
});

describe("INTENT_CATEGORY_TO_TEMPLATE", () => {
  it("maps all 6 intent categories to template domain/category tokens", () => {
    expect(Object.keys(INTENT_CATEGORY_TO_TEMPLATE).sort()).toEqual([
      "defense",
      "economy",
      "fiscal",
      "infrastructure",
      "security",
      "social",
    ]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.defense).toEqual(["military", "security"]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.fiscal).toEqual(["economic"]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.economy).toEqual(["economic"]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.social).toEqual(["social"]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.infrastructure).toEqual(["infrastructure"]);
    expect(INTENT_CATEGORY_TO_TEMPLATE.security).toEqual(["political", "governance"]);
  });
});

describe("spawnResistanceForIntent", () => {
  it("spawns via forceGenerate and links intentId when template is eligible", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([makeTemplate()]);
    db.nationalIssue.findFirst.mockResolvedValue(null); // no dedupe, no recent
    db.nationalIssue.count.mockResolvedValue(0); // no active

    const result = await spawnResistanceForIntent({
      db,
      countryId: "country-1",
      intent,
      tokens: ["economic"],
    });

    expect(result).toBe("issue-1");
    expect(forceGenerateMock).toHaveBeenCalledWith("tmpl-economic", "country-1", db);
    expect(db.nationalIssue.update).toHaveBeenCalledWith({
      where: { id: "issue-1" },
      data: { intentId: "intent-1", triggerReason: "Resistance to intent intent-1" },
    });
  });

  it("dedupes when an open issue is already linked to this intent+template", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([makeTemplate()]);
    db.nationalIssue.findFirst.mockResolvedValue({ id: "existing" }); // linked open
    db.nationalIssue.count.mockResolvedValue(0);

    const result = await spawnResistanceForIntent({
      db,
      countryId: "country-1",
      intent,
      tokens: ["economic"],
    });

    expect(result).toBeNull();
    expect(forceGenerateMock).not.toHaveBeenCalled();
  });

  it("respects maxActivePerCountry", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([makeTemplate()]);
    db.nationalIssue.findFirst.mockResolvedValue(null);
    db.nationalIssue.count.mockResolvedValue(1); // already at max

    const result = await spawnResistanceForIntent({
      db,
      countryId: "country-1",
      intent,
      tokens: ["economic"],
    });

    expect(result).toBeNull();
    expect(forceGenerateMock).not.toHaveBeenCalled();
  });

  it("respects template cooldown (recent spawn from same template)", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([makeTemplate()]);
    db.nationalIssue.findFirst.mockResolvedValueOnce(null); // dedupe query
    db.nationalIssue.count.mockResolvedValue(0);
    db.nationalIssue.findFirst.mockResolvedValueOnce({ id: "recent" }); // cooldown hit

    const result = await spawnResistanceForIntent({
      db,
      countryId: "country-1",
      intent,
      tokens: ["economic"],
    });

    expect(result).toBeNull();
    expect(forceGenerateMock).not.toHaveBeenCalled();
  });

  it("returns null when no templates match the tokens", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([]);

    const result = await spawnResistanceForIntent({
      db,
      countryId: "country-1",
      intent,
      tokens: ["economic"],
    });

    expect(result).toBeNull();
    expect(forceGenerateMock).not.toHaveBeenCalled();
  });
});

describe("spawnIntentResistance (mode-aware wrapper)", () => {
  it("spawns in deterministic mode", async () => {
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockResolvedValue([makeTemplate()]);
    db.nationalIssue.findFirst.mockResolvedValue(null);
    db.nationalIssue.count.mockResolvedValue(0);

    const result = await spawnIntentResistance({
      db,
      countryId: "country-1",
      intent,
    });

    expect(result).toBe("issue-1");
  });

  it("does not spawn in probability mode", async () => {
    mockSpawnMode = "probability";
    const db = makeDb();

    const result = await spawnIntentResistance({
      db,
      countryId: "country-1",
      intent,
    });

    expect(result).toBeNull();
    expect(db.nationalIssueTemplate.findMany).not.toHaveBeenCalled();
  });

  it("does not spawn in off mode", async () => {
    mockSpawnMode = "off";
    const db = makeDb();

    const result = await spawnIntentResistance({
      db,
      countryId: "country-1",
      intent,
    });

    expect(result).toBeNull();
  });

  it("never throws even when the db fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockRejectedValue(new Error("boom"));

    await expect(spawnIntentResistance({ db, countryId: "country-1", intent })).resolves.toBeNull();
    warnSpy.mockRestore();
  });
});
