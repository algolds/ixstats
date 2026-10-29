/**
 * The Economy tabs' derived figures (MyCountry fix plan, WP-B2):
 * - one revenue figure: saved rates on today's GDP, the founding total only while no rate is saved;
 * - top 10% wealth and middle class share derived from the stored income classes;
 * - the infrastructure card's budget is the transport department's live allocation, or none;
 * - the typed figures reader takes GDP growth from `calculatedStats.gdpGrowth`.
 */
import { describe, it, expect } from "@jest/globals";
import { nationalRevenue } from "~/lib/economy/national-revenue";
import { incomeSharesOf } from "~/lib/economy/income-classes";
import { infrastructureBudgetBillions } from "~/lib/economy/national-mobility";
import { economyFiguresOf } from "~/lib/economy/country-relations";
import { economicProfileFromModel } from "~/lib/economy/modeling-engine";
import { effectiveGrowthOf } from "~/lib/economy/effective-growth";
import { mapCountryToEconomyData } from "~/lib/economy/data-mapper";

const BUILDER_CLASSES = JSON.stringify([
  { name: "Upper Class", populationPercent: 5, wealthPercent: 40 },
  { name: "Upper Middle Class", populationPercent: 15, wealthPercent: 30 },
  { name: "Middle Class", populationPercent: 30, wealthPercent: 20 },
  { name: "Lower Middle Class", populationPercent: 30, wealthPercent: 8 },
  { name: "Lower Class", populationPercent: 20, wealthPercent: 2 },
]);

describe("nationalRevenue", () => {
  const withRates = {
    currentTotalGdp: 100e9,
    governmentRevenueTotal: 999e9,
    fiscalSystem: { personalIncomeTaxRates: JSON.stringify({ incomeRate: 20 }), salesTaxRate: 10 },
  };

  it("is the saved rates on today's GDP once any rate is saved, ignoring the founding total", () => {
    const revenue = nationalRevenue(withRates);
    // income 100B x 20% x 0.18 + VAT 100B x 10% x 0.15 (fallback weights, no sector profile)
    expect(revenue.basis).toBe("rates");
    expect(revenue.total).toBeCloseTo(3.6e9 + 1.5e9);
  });

  it("follows GDP: the same rates on double the GDP double the revenue", () => {
    const doubled = nationalRevenue({ ...withRates, currentTotalGdp: 200e9 });
    expect(doubled.total).toBeCloseTo(2 * (3.6e9 + 1.5e9));
  });

  it("applies unsaved console edits the same way", () => {
    expect(nationalRevenue(withRates, { income: 30 }).total).toBeCloseTo(5.4e9 + 1.5e9);
  });

  it("falls back to the founding total only while no rate is saved, else nothing", () => {
    expect(nationalRevenue({ currentTotalGdp: 100e9, governmentRevenueTotal: 25e9 })).toMatchObject(
      {
        basis: "founding",
        total: 25e9,
      }
    );
    expect(nationalRevenue({ currentTotalGdp: 100e9 })).toMatchObject({ basis: null, total: null });
  });
});

describe("incomeSharesOf", () => {
  it("derives the top 10% wealth share and the middle class share from the builder's classes", () => {
    // The richest 10%: all of Upper (5% of people, 40% of wealth) and a third of Upper Middle (10%).
    expect(incomeSharesOf(BUILDER_CLASSES)).toEqual({ top10WealthShare: 50, middleClassShare: 75 });
  });

  it("is null when no classes are recorded", () => {
    expect(incomeSharesOf(null)).toEqual({ top10WealthShare: null, middleClassShare: null });
    expect(incomeSharesOf("not json")).toEqual({ top10WealthShare: null, middleClassShare: null });
  });
});

describe("infrastructureBudgetBillions", () => {
  const row = (budgetYear: number, allocatedAmount: number, name: string, category: string) => ({
    budgetYear,
    allocatedAmount,
    department: { name, category },
  });

  it("is the transport department's allocation in the budget in effect", () => {
    const allocations = [
      row(2042, 2e9, "Ministry of Transport", "Transportation"),
      row(2043, 4e9, "Ministry of Transport", "Transportation"),
      row(2044, 8e9, "Ministry of Transport", "Transportation"),
      row(2043, 50e9, "Ministry of Health", "Health"),
    ];
    expect(infrastructureBudgetBillions(allocations, 2043)).toBe(4);
  });

  it("is null when the budget has no transport or infrastructure department", () => {
    expect(infrastructureBudgetBillions([row(2043, 50e9, "Health", "Health")], 2043)).toBeNull();
    expect(infrastructureBudgetBillions([], 2043)).toBeNull();
  });
});

describe("economyFiguresOf", () => {
  it("reads GDP growth from calculatedStats and keeps unrecorded figures null", () => {
    const figures = economyFiguresOf({
      currentTotalGdp: 5e11,
      calculatedStats: { gdpGrowth: 0.021 },
      unemploymentRate: undefined,
      realGDPGrowthRate: 3,
    });
    expect(figures.gdpGrowth).toBe(0.021);
    expect(figures.unemploymentRate).toBeNull();
    expect(figures.currentTotalGdp).toBe(5e11);
  });
});

describe("economicProfileFromModel", () => {
  it("maps a saved model onto the economic profile's real fields", () => {
    const outputs = [
      { year: 2042, agriculture: 1, industry: 1, services: 1, government: 1, totalGDP: 4 },
      { year: 2043, agriculture: 10, industry: 30, services: 50, government: 10, totalGDP: 100 },
    ];
    const profile = economicProfileFromModel(outputs, -2, 500e9);
    expect(Object.keys(profile).sort()).toEqual(["sectorBreakdown", "tradeBalance"]);
    expect(JSON.parse(profile.sectorBreakdown!)).toEqual({
      agriculture: 10,
      industry: 30,
      services: 50,
      government: 10,
    });
    expect(profile.tradeBalance).toBe(-10e9);
  });

  it("writes nothing it cannot derive", () => {
    const empty = [
      { year: 2043, agriculture: 0, industry: 0, services: 0, government: 0, totalGDP: 0 },
    ];
    expect(economicProfileFromModel(empty, 3, null)).toEqual({});
  });
});

describe("realised growth off MyCountry", () => {
  it("effectiveGrowthOf reads the latest history point, the static input only before one exists", () => {
    expect(
      effectiveGrowthOf({ adjustedGdpGrowth: 0.03, historicalData: [{ gdpGrowthRate: 0.0032 }] })
    ).toBe(0.0032);
    expect(effectiveGrowthOf({ adjustedGdpGrowth: 0.03, historicalData: [] })).toBe(0.03);
    expect(effectiveGrowthOf({})).toBeNull();
  });

  it("the economy data mapper takes core growth from the engine, not the mixed-unit column", () => {
    const mapped = mapCountryToEconomyData({
      currentPopulation: 1e6,
      currentGdpPerCapita: 30_000,
      realGDPGrowthRate: 3,
      adjustedGdpGrowth: 0.03,
      calculatedStats: { gdpGrowth: 0.012 },
    } as Parameters<typeof mapCountryToEconomyData>[0]);
    expect(mapped?.core.realGDPGrowthRate).toBe(0.012);
  });

  it("the mapper shows a blank inflation, unemployment or debt as the flagged estimate, a recorded one as recorded", () => {
    const mapped = mapCountryToEconomyData({
      currentPopulation: 1e6,
      currentGdpPerCapita: 30_000,
      inflationRate: 2,
      totalDebtGDPRatio: 44,
      effectiveFigures: {
        inflationRate: { value: 3.4, estimated: true },
        unemploymentRate: { value: 6.2, estimated: true },
        totalDebtGDPRatio: { value: 44, estimated: false },
      },
    } as Parameters<typeof mapCountryToEconomyData>[0]);
    expect(mapped?.core.inflationRate).toBe(3.4);
    expect(mapped?.labor.unemploymentRate).toBe(6.2);
    expect(mapped?.fiscal.totalDebtGDPRatio).toBe(44);
    expect(mapped?.estimated).toEqual({
      inflationRate: true,
      unemploymentRate: true,
      totalDebtGDPRatio: false,
    });
    // Without the server's figures (another read), nothing is marked and the record stands.
    const plain = mapCountryToEconomyData({ currentPopulation: 1e6, inflationRate: 2.5 });
    expect(plain?.core.inflationRate).toBe(2.5);
    expect(plain?.estimated).toEqual({
      inflationRate: false,
      unemploymentRate: false,
      totalDebtGDPRatio: false,
    });
  });
});
