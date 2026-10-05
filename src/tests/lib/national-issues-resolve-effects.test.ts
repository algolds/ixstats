/** @jest-environment node */
/**
 * Resolving an issue closes the decision → stat loop:
 * - publicApproval and stabilityScore land in the columns the Standing bands read
 *   (Country.publicApproval, InternalStabilityMetrics.stabilityScore), through the real spine;
 * - GDP / GDP-growth / population consequences become StorytellerEffects the projection applies
 *   instead of field writes that were overwritten or read by nothing;
 * - consequences that cannot be applied are left out of the displayed list.
 * (Creating a missing stability row is covered in stability-event-deltas.test.ts.)
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect, beforeEach } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => 1_000_000, getYearsElapsed: () => 0 },
}));
jest.mock("~/lib/gameplay-flags", () => ({ GAMEPLAY_FLAGS: {} }));
jest.mock("~/lib/national-issues/engine", () => ({
  NationalIssuesEngine: { forceGenerate: jest.fn() },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({ ActivityHooks: {} }));
jest.mock("~/lib/activity", () => ({
  CountryEventSpine: jest.requireActual("~/lib/activity/event-spine").CountryEventSpine,
}));

import { NationalIssuesConsequences } from "~/lib/national-issues/consequences";

const COUNTRY = "country-1";
const ISSUE = "issue-1";

function makeDb(options: { consequences: unknown[] }) {
  return {
    nationalIssue: {
      findUnique: jest.fn().mockResolvedValue({
        id: ISSUE,
        countryId: COUNTRY,
        title: "Port strike",
        status: "pending",
        intentId: null,
        responseOptions: JSON.stringify([
          { id: "opt-1", label: "Negotiate", consequences: options.consequences },
        ]),
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    nationalIssueConsequence: { create: jest.fn().mockResolvedValue({}) },
    countryChangeLog: { create: jest.fn().mockResolvedValue({}) },
    storytellerEffect: { create: jest.fn().mockResolvedValue({}) },
    country: {
      findUnique: jest.fn(({ select }: { select: Record<string, boolean> }) => {
        const row: Record<string, number> = {
          publicApproval: 50,
          actualGdpGrowth: 0.02,
          currentTotalGdp: 1e12,
        };
        const field = Object.keys(select)[0]!;
        return Promise.resolve({ [field]: row[field] });
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    internalStabilityMetrics: {
      findUnique: jest.fn().mockResolvedValue({ stabilityScore: 60 }),
      update: jest.fn().mockResolvedValue({}),
    },
    politicalParty: { findFirst: jest.fn() },
  };
}

const approval = {
  targetModel: "Country",
  targetField: "publicApproval",
  operation: "add",
  value: 4,
};
const stability = {
  targetModel: "InternalStabilityMetrics",
  targetField: "stabilityScore",
  operation: "subtract",
  value: 3,
};
const growth = {
  targetModel: "Country",
  targetField: "actualGdpGrowth",
  operation: "add",
  value: 0.3,
};
const gdpShock = {
  targetModel: "Country",
  targetField: "currentTotalGdp",
  operation: "multiply",
  value: 0.995,
};

describe("NationalIssuesConsequences.resolveIssue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists approval and stability to the columns the Standing bands read", async () => {
    const db = makeDb({ consequences: [approval, stability] });

    const result = await NationalIssuesConsequences.resolveIssue(ISSUE, "opt-1", db as any);

    expect(result.success).toBe(true);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: COUNTRY },
      data: { publicApproval: 54 },
    });
    expect(db.internalStabilityMetrics.update).toHaveBeenCalledWith({
      where: { countryId: COUNTRY },
      data: { stabilityScore: 57 },
    });
    expect(result.consequences.map((c) => c.targetField)).toEqual([
      "publicApproval",
      "stabilityScore",
    ]);
  });

  it("turns GDP-growth and GDP consequences into StorytellerEffects, not field writes", async () => {
    const db = makeDb({ consequences: [growth, gdpShock] });

    const result = await NationalIssuesConsequences.resolveIssue(ISSUE, "opt-1", db as any);

    expect(result.success).toBe(true);
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.storytellerEffect.create).toHaveBeenCalledTimes(2);
    expect(db.storytellerEffect.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        countryId: COUNTRY,
        ixTimeTimestamp: new Date(1_000_000),
        inputType: "gdp_level_adjustment",
        value: 0.003,
        duration: 1,
        isActive: true,
        createdBy: `issue:${ISSUE}`,
      }),
    });
    expect(db.storytellerEffect.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        inputType: "gdp_level_adjustment",
        value: -0.005,
        duration: null,
      }),
    });
    expect(result.consequences).toEqual([
      expect.objectContaining({
        targetField: "actualGdpGrowth",
        effectType: "projection",
        delta: 0.3,
      }),
      expect.objectContaining({ targetField: "currentTotalGdp", effectType: "projection" }),
    ]);
    expect(result.consequenceLog).toContain("GDP per capita +0.30% over 1 IxTime year");
    expect(db.nationalIssueConsequence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ targetField: "actualGdpGrowth", effectType: "projection" }),
    });
  });

  it("leaves unappliable consequences out of the displayed list", async () => {
    const db = makeDb({
      consequences: [
        approval,
        { targetModel: "Country", targetField: "currentTotalGdp", operation: "set", value: 1 },
      ],
    });

    const result = await NationalIssuesConsequences.resolveIssue(ISSUE, "opt-1", db as any);

    expect(result.consequences.map((c) => c.targetField)).toEqual(["publicApproval"]);
    expect(db.storytellerEffect.create).not.toHaveBeenCalled();
    expect(result.consequenceLog).not.toContain("GDP");
  });
});
