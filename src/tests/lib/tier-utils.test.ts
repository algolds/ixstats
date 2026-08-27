import {
  formatMembershipTier,
  getEconomicTierFromGdpPerCapita,
  getPopulationTierFromPopulation,
  decimalToPercentage,
  percentageToDecimal,
} from "~/lib/tier-utils";
import { EconomicTier, PopulationTier } from "~/types/ixstats";

describe("formatMembershipTier", () => {
  it("formats mycountry_premium as Premium with amber styling", () => {
    const res = formatMembershipTier("mycountry_premium");
    expect(res.label).toBe("Premium");
    expect(res.isPremium).toBe(true);
    expect(res.badgeClass).toContain("amber");
  });

  it("formats premium as Premium with amber styling", () => {
    const res = formatMembershipTier("premium");
    expect(res.label).toBe("Premium");
    expect(res.isPremium).toBe(true);
  });

  it("formats basic as Citizen", () => {
    const res = formatMembershipTier("basic");
    expect(res.label).toBe("Citizen");
    expect(res.isPremium).toBe(false);
  });

  it("handles undefined or null gracefully", () => {
    const res = formatMembershipTier(null);
    expect(res.label).toBe("Citizen");
    expect(res.isPremium).toBe(false);
  });
});

describe("Tier Determination & Math Conversion", () => {
  it("determines correct economic tier from GDP per capita", () => {
    expect(getEconomicTierFromGdpPerCapita(5000)).toBe(EconomicTier.IMPOVERISHED);
    expect(getEconomicTierFromGdpPerCapita(15000)).toBe(EconomicTier.DEVELOPING);
    expect(getEconomicTierFromGdpPerCapita(30000)).toBe(EconomicTier.DEVELOPED);
    expect(getEconomicTierFromGdpPerCapita(40000)).toBe(EconomicTier.HEALTHY);
    expect(getEconomicTierFromGdpPerCapita(50000)).toBe(EconomicTier.STRONG);
    expect(getEconomicTierFromGdpPerCapita(60000)).toBe(EconomicTier.VERY_STRONG);
    expect(getEconomicTierFromGdpPerCapita(70000)).toBe(EconomicTier.EXTRAVAGANT);
  });

  it("determines correct population tier from population count", () => {
    expect(getPopulationTierFromPopulation(5_000_000)).toBe(PopulationTier.TIER_1);
    expect(getPopulationTierFromPopulation(20_000_000)).toBe(PopulationTier.TIER_2);
    expect(getPopulationTierFromPopulation(40_000_000)).toBe(PopulationTier.TIER_3);
    expect(getPopulationTierFromPopulation(60_000_000)).toBe(PopulationTier.TIER_4);
    expect(getPopulationTierFromPopulation(100_000_000)).toBe(PopulationTier.TIER_5);
    expect(getPopulationTierFromPopulation(200_000_000)).toBe(PopulationTier.TIER_6);
    expect(getPopulationTierFromPopulation(400_000_000)).toBe(PopulationTier.TIER_7);
    expect(getPopulationTierFromPopulation(600_000_000)).toBe(PopulationTier.TIER_X);
  });

  it("converts decimals to percentages and vice-versa", () => {
    expect(decimalToPercentage(0.05)).toBe(5);
    expect(decimalToPercentage(0.125)).toBe(12.5);
    expect(percentageToDecimal(5)).toBe(0.05);
    expect(percentageToDecimal(12.5)).toBe(0.125);
  });
});
