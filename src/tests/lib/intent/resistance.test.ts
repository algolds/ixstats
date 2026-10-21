// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => 1000000 },
}));

// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
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
describe("spawnResistanceForIntent", () => {
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
});

describe("spawnIntentResistance (mode-aware wrapper)", () => {
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
