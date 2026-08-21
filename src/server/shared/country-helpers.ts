import { mapTaxComponentTypeToId } from "~/lib/enums";
import { IxTime } from "~/lib/ixtime";
import type { BaseCountryData } from "~/types/ixstats";

export const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

export const validateNumber = (value: number | null | undefined, max = 1e18, min = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0;
  return Math.min(Math.max(numValue, min), max);
};

export const prepareBaseCountryData = (country: any, componentsData?: any): BaseCountryData => ({
  country: country.name,
  continent: country.continent,
  region: country.region,
  governmentType: country.governmentType,
  religion: country.religion,
  leader: country.leader,
  population: country.baselinePopulation,
  gdpPerCapita: country.baselineGdpPerCapita,
  landArea: country.landArea,
  areaSqMi: country.areaSqMi,
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,

  totalGovernmentSpending: country.totalGovernmentSpending ?? 0,
  taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? 25,
  unemploymentRate: country.unemploymentRate ?? 5,
  inflationRate: country.inflationRate ?? 0.02,

  activeGovComponents: componentsData?.activeGovComponents ?? [],
  activeEconComponents: componentsData?.activeEconComponents ?? [],
  activeTaxComponents: componentsData?.activeTaxComponents ?? [],
  implementingGovComponents: componentsData?.implementingGovComponents ?? [],
  implementingEconComponents: componentsData?.implementingEconComponents ?? [],
  implementingTaxComponents: componentsData?.implementingTaxComponents ?? [],
  activePolicyMaintenanceCost: componentsData?.activePolicyMaintenanceCost ?? 0,
});

export async function getCountryComponentsStatsData(db: any, countryId: string) {
  const now = new Date(IxTime.getCurrentIxTime());

  try {
    await Promise.all([
      db.governmentComponent.updateMany({
        where: { countryId, implementationDate: { lte: now }, isActive: false },
        data: { isActive: true },
      }),
      db.economicComponent.updateMany({
        where: { countryId, implementationDate: { lte: now }, isActive: false },
        data: { isActive: true },
      }),
      db.taxComponent.updateMany({
        where: { countryId, implementationDate: { lte: now }, isActive: false },
        data: { isActive: true },
      }),
    ]);
  } catch (err) {
    console.error("Failed to self-heal components active state:", err);
  }

  const [gov, econ, tax] = await Promise.all([
    db.governmentComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
    db.economicComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
    db.taxComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
  ]).catch(() => [[], [], []]);

  const activeGov: string[] = [];
  const implementingGov: string[] = [];
  gov.forEach((c: any) => {
    if (c.isActive || c.implementationDate <= now) {
      activeGov.push(c.componentType);
    } else {
      implementingGov.push(c.componentType);
    }
  });

  const activeEcon: string[] = [];
  const implementingEcon: string[] = [];
  econ.forEach((c: any) => {
    if (c.isActive || c.implementationDate <= now) {
      activeEcon.push(c.componentType);
    } else {
      implementingEcon.push(c.componentType);
    }
  });

  const activeTax: string[] = [];
  const implementingTax: string[] = [];
  tax.forEach((c: any) => {
    const frontendId = mapTaxComponentTypeToId(c.componentType);
    if (c.isActive || c.implementationDate <= now) {
      activeTax.push(frontendId);
    } else {
      implementingTax.push(frontendId);
    }
  });

  const activePolicies = await db.policy
    .findMany({
      where: { countryId, status: "active" },
      select: { maintenanceCost: true },
    })
    .catch(() => []);

  const activePolicyMaintenanceCost = activePolicies.reduce(
    (sum: number, p: any) => sum + (p.maintenanceCost || 0),
    0
  );

  return {
    activeGovComponents: activeGov,
    implementingGovComponents: implementingGov,
    activeEconComponents: activeEcon,
    implementingEconComponents: implementingEcon,
    activeTaxComponents: activeTax,
    implementingTaxComponents: implementingTax,
    activePolicyMaintenanceCost,
  };
}
