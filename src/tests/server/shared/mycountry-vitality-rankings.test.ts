/** @jest-environment node */
// Diplomatic Standing and Governmental Efficiency come from real data (null = "—"), and the
// World Census ranks a country across every stat category within its own realm.
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { describe, it, expect } from "@jest/globals";
import { db as mockedDb } from "~/server/db";
import {
  DIPLOMATIC_STANDING_WEIGHTS,
  calculateVitalityScores,
  computeDiplomaticStanding,
  emptyDiplomaticStandingInputs,
  generateRankings,
  loadDiplomaticStandingInputs,
  rankCensus,
  scoreDiplomaticStanding,
  scoreGovernmentalEfficiency,
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

  it("starts from mean relation strength and adds embassy/alliance/treaty bonuses", () => {
    const w = DIPLOMATIC_STANDING_WEIGHTS;
    expect(
      scoreDiplomaticStanding({
        relationStrengths: [40, 60],
        activeEmbassies: 2,
        allianceMemberships: 1,
        activeTreaties: 1,
        hostileActionsReceived: 0,
      })
    ).toBe(50 + 2 * w.perEmbassy + w.perAlliance + w.perTreaty);
  });

  it("drops with hostile actions received and stays within 0-100", () => {
    const hostile = scoreDiplomaticStanding({
      ...emptyDiplomaticStandingInputs(),
      relationStrengths: [20],
      hostileActionsReceived: 10,
    });
    expect(hostile).toBe(0);

    const maxed = scoreDiplomaticStanding({
      relationStrengths: [95],
      activeEmbassies: 50,
      allianceMemberships: 9,
      activeTreaties: 9,
      hostileActionsReceived: 0,
    });
    expect(maxed).toBe(100);
  });

  it("is no longer the constant 70 the old fake fields produced", () => {
    const a = scoreDiplomaticStanding({
      ...emptyDiplomaticStandingInputs(),
      relationStrengths: [20],
    });
    const b = scoreDiplomaticStanding({
      ...emptyDiplomaticStandingInputs(),
      relationStrengths: [90],
    });
    expect(a).toBe(20);
    expect(b).toBe(90);
  });
});

describe("loadDiplomaticStandingInputs", () => {
  it("counts relations, embassies, alliances, treaties and hostile actions per country", async () => {
    const db = diplomacyDb({
      relations: [
        { country1: "a", country2: "b", strength: 80 },
        { country1: "c", country2: "a", strength: 30 },
      ],
      embassies: [
        { hostCountryId: "a", guestCountryId: "b" },
        { hostCountryId: "b", guestCountryId: "a" },
      ],
      memberships: [{ countryId: "a" }],
      treaties: [{ parties: '["a","b"]' }, { parties: null }],
      hostile: [{ targetId: "a" }, { targetId: "zzz" }],
    });

    const map = await loadDiplomaticStandingInputs(["a", "b"], db as never);

    expect(map.get("a")).toEqual({
      relationStrengths: [80, 30],
      activeEmbassies: 2,
      allianceMemberships: 1,
      activeTreaties: 1,
      hostileActionsReceived: 1,
    });
    expect(map.get("b")).toEqual({
      relationStrengths: [80],
      activeEmbassies: 2,
      allianceMemberships: 0,
      activeTreaties: 1,
      hostileActionsReceived: 0,
    });
    expect(map.has("c")).toBe(false);

    // Only active embassies, active memberships and active hostile actions count.
    expect((db.embassy.findMany.mock.calls[0] as any[])[0].where.status).toBe("active");
    expect((db.allianceMember.findMany.mock.calls[0] as any[])[0].where).toMatchObject({
      status: "active",
      isActive: true,
    });
    expect((db.foreignPolicyAction.findMany.mock.calls[0] as any[])[0].where).toMatchObject({
      status: "active",
      actionType: { in: ["embargo", "sanction", "blockade"] },
    });
  });

  it("computeDiplomaticStanding returns null with no record", async () => {
    const result = await computeDiplomaticStanding("lonely", diplomacyDb() as never);
    expect(result.score).toBeNull();
  });
});

describe("calculateVitalityScores", () => {
  it("uses the real diplomatic score and government effectiveness", () => {
    const scores = calculateVitalityScores(baseCountry, {
      diplomaticStanding: 63,
      governmentEffectiveness: 41.6,
    });
    expect(scores.diplomaticStanding).toBe(63);
    expect(scores.governmentalEfficiency).toBe(42);
  });

  it("returns null for missing data and averages only the known scores", () => {
    const scores = calculateVitalityScores(baseCountry);
    expect(scores.diplomaticStanding).toBeNull();
    expect(scores.governmentalEfficiency).toBeNull();
    expect(scores.overallScore).toBe(
      Math.round((scores.economicVitality + scores.populationWellbeing) / 2)
    );
  });

  it("scoreGovernmentalEfficiency clamps and rejects non-numbers", () => {
    expect(scoreGovernmentalEfficiency(null)).toBeNull();
    expect(scoreGovernmentalEfficiency(undefined)).toBeNull();
    expect(scoreGovernmentalEfficiency(140)).toBe(100);
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

  it("leaves out a category the country has no value for", () => {
    const rankings = rankCensus("me", [row("me", { Stability: null, Infrastructure: 50 })]);
    expect(rankings.map((r) => r.category)).toEqual(["Infrastructure"]);
    expect(rankings[0]!.percentile).toBe(100);
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
