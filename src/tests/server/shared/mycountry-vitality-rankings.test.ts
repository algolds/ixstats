/** @jest-environment node */
// Diplomatic Standing and Governmental Efficiency come from real data (null = "—"), and the
// World Census ranks a country across every stat category within its own realm.
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, it, expect } from "@jest/globals";
import { db as mockedDb } from "~/server/db";
import {
  calculateVitalityScores,
  emptyDiplomaticStandingInputs,
  generateRankings,
  rankCensus,
  scoreDiplomaticStanding
} from "~/server/shared/mycountry-helpers";

function diplomacyDb(
  rows: {
    relations?: Array<{ country1: string; country2: string; strength: number }>;
    embassies?: Array<{ hostCountryId: string; guestCountryId: string }>;
    memberships?: Array<{ countryId: string }>;
    treaties?: Array<{ parties: string | null }>;
    hostile?: Array<{ targetId: string }>;
  } = {}
) {
  return {
    diplomaticRelation: { findMany: jest.fn(async () => rows.relations ?? []) },
    embassy: { findMany: jest.fn(async () => rows.embassies ?? []) },
    allianceMember: { findMany: jest.fn(async () => rows.memberships ?? []) },
    treaty: { findMany: jest.fn(async () => rows.treaties ?? []) },
    foreignPolicyAction: { findMany: jest.fn(async () => rows.hostile ?? []) },
  };
}

const baseCountry = {
  currentGdpPerCapita: 25000,
  adjustedGdpGrowth: 0.02,
  populationGrowthRate: 0.01,
  populationDensity: 100,
  economicTier: "Developed",
} as any;

describe("scoreDiplomaticStanding", () => {
  it("is null (shown as —) when the country has no diplomatic record", () => {
    expect(scoreDiplomaticStanding(emptyDiplomaticStandingInputs())).toBeNull();
  });
});
describe("calculateVitalityScores", () => {
  it("returns null for missing data and averages only the known scores", () => {
    const scores = calculateVitalityScores(baseCountry);
    expect(scores.diplomaticStanding).toBeNull();
    expect(scores.governmentalEfficiency).toBeNull();
    expect(scores.overallScore).toBe(
      Math.round((scores.economicVitality + scores.populationWellbeing) / 2)
    );
  });
});

function row(id: string, values: Record<string, number | null>, region = "North") {
  return { id, region, economicTier: "Developed", populationTier: "3", values };
}

describe("rankCensus", () => {
  it("ranks every category that has a value, with debt and inequality lower-is-better", () => {
    const rows = [
      row("me", {
        "Public Approval": 70,
        "Debt to GDP": 40,
        "Income Equality": 0.3,
        "Diplomatic Standing": 55,
      }),
      row("x", {
        "Public Approval": 80,
        "Debt to GDP": 90,
        "Income Equality": 0.25,
        "Diplomatic Standing": null,
      }),
      row(
        "y",
        {
          "Public Approval": 60,
          "Debt to GDP": 20,
          "Income Equality": 0.5,
          "Diplomatic Standing": 70,
        },
        "South"
      ),
    ];

    const byCategory = Object.fromEntries(rankCensus("me", rows).map((r) => [r.category, r]));

    expect(byCategory["Public Approval"]!.global).toEqual({ position: 2, total: 3 });
    expect(byCategory["Debt to GDP"]!.global).toEqual({ position: 2, total: 3 });
    expect(byCategory["Debt to GDP"]!.lowerIsBetter).toBe(true);
    expect(byCategory["Income Equality"]!.global).toEqual({ position: 2, total: 3 });
    // A country with no diplomatic record is left out of that ranking, not ranked as 0.
    expect(byCategory["Diplomatic Standing"]!.global).toEqual({ position: 2, total: 2 });
    expect(byCategory["Public Approval"]!.regional).toEqual({
      position: 2,
      total: 2,
      region: "North",
    });
    expect(byCategory["Public Approval"]!.value).toBe(70);
  });
});

describe("generateRankings", () => {
  const dbModule = mockedDb as unknown as Record<string, unknown>;

  it("builds the World Census from stored stats within the country's realm", async () => {
    const realmCountries = [
      {
        id: "c_census",
        region: "North",
        currentGdpPerCapita: 30000,
        currentPopulation: 5e6,
        currentTotalGdp: 1.5e11,
        adjustedGdpGrowth: 0.04,
        populationGrowthRate: 0.01,
        publicApproval: 62,
        totalDebtGDPRatio: 55,
        incomeInequalityGini: 0.32,
        infrastructureRating: 70,
        economicTier: "Developed",
        populationTier: "3",
        stabilityMetrics: { stabilityScore: 58 },
      },
      {
        id: "c_other",
        region: "North",
        currentGdpPerCapita: 50000,
        currentPopulation: 2e6,
        currentTotalGdp: 1e11,
        adjustedGdpGrowth: 0.01,
        populationGrowthRate: 0,
        publicApproval: 40,
        totalDebtGDPRatio: null,
        incomeInequalityGini: 0.4,
        infrastructureRating: 50,
        economicTier: "Developed",
        populationTier: "2",
        stabilityMetrics: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(realmCountries);
    dbModule.country = {
      findUnique: jest.fn().mockResolvedValue({
        id: "c_census",
        realmId: "r_eurth",
        adjustedGdpGrowth: 0.04,
        populationGrowthRate: 0.01,
      }),
      findMany,
    };
    Object.assign(
      dbModule,
      diplomacyDb({ relations: [{ country1: "c_census", country2: "c_other", strength: 75 }] })
    );

    const rankings = await generateRankings("c_census");
    const categories = rankings.map((r) => r.category);

    expect(findMany.mock.calls[0][0].where).toMatchObject({ realmId: "r_eurth" });
    expect(categories).toEqual([
      "GDP per Capita",
      "Total GDP",
      "GDP Growth",
      "Population",
      "Public Approval",
      "Stability",
      "Diplomatic Standing",
      "Infrastructure",
      "Debt to GDP",
      "Income Equality",
    ]);
    const get = (c: string) => rankings.find((r) => r.category === c)!;
    expect(get("GDP per Capita").global.position).toBe(2);
    expect(get("Total GDP").global.position).toBe(1);
    expect(get("Public Approval").global.position).toBe(1);
    expect(get("Stability").global).toEqual({ position: 1, total: 1 });
    expect(get("Debt to GDP").global).toEqual({ position: 1, total: 1 });
    expect(get("Income Equality").global.position).toBe(1);
    expect(get("Diplomatic Standing").value).toBe(75);
    expect(get("GDP per Capita").trend).toBe("improving");
    expect(get("Public Approval").trend).toBeUndefined();
  });
});
