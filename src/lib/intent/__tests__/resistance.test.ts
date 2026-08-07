import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

let mockSpawnMode = "deterministic";
jest.mock("~/lib/national-issues-config", () => ({
  getNationalIssuesConfig: () => ({
    maxIssuesPerSession: 3,
    maxIssuesPerWeek: 5,
    spawnMode: mockSpawnMode,
  }),
}));

jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => 1000000 },
}));

jest.mock("~/lib/national-issues-engine", () => ({
  NationalIssuesEngine: { forceGenerate: jest.fn() },
}));

import { NationalIssuesEngine } from "~/lib/national-issues-engine";
import {
  INTENT_CATEGORY_TO_TEMPLATE,
  spawnIntentResistance,
  spawnResistanceForIntent,
} from "~/lib/intent/resistance";

const forceGenerateMock = NationalIssuesEngine.forceGenerate as jest.Mock;

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-economic",
    domain: "economic",
    category: "economic",
    cooldownDays: 30,
    maxActivePerCountry: 1,
    baseUrgency: 60,
    ...overrides,
  };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    nationalIssueTemplate: {
      findMany: jest.fn(),
    },
    nationalIssue: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  };
}

const intent = { id: "intent-1", category: "economy", tier: "extreme" };

beforeEach(() => {
  jest.clearAllMocks();
  mockSpawnMode = "deterministic";
  forceGenerateMock.mockResolvedValue("issue-1");
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
    const db = makeDb();
    db.nationalIssueTemplate.findMany.mockRejectedValue(new Error("boom"));

    await expect(
      spawnIntentResistance({ db, countryId: "country-1", intent })
    ).resolves.toBeNull();
  });
});
