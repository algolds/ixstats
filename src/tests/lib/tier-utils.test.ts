import {
  getEconomicTierFromGdpPerCapita,
  getPopulationTierFromPopulation
} from "~/lib/tier-utils";
import { EconomicTier, PopulationTier } from "~/types/ixstats";
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

  it("puts a fractional GDP per capita between two tiers' bounds in the lower tier", () => {
    expect(getEconomicTierFromGdpPerCapita(24_999.5)).toBe(EconomicTier.DEVELOPING);
    expect(getEconomicTierFromGdpPerCapita(64_999.99)).toBe(EconomicTier.VERY_STRONG);
    expect(getEconomicTierFromGdpPerCapita(9_999.5)).toBe(EconomicTier.IMPOVERISHED);
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
});
