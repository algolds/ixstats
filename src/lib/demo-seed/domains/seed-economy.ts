/**
 * Demo seed for economic profile, labor, demographics, fiscal system, and vitality metrics.
 */

import { type PrismaClient } from "@prisma/client";

type Prisma = PrismaClient;

export async function seedDemographics(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.demographics.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      birthRate: 12.4,
      deathRate: 7.8,
      migrationRate: 2.1,
      dependencyRatio: 52.3,
      medianAge: 38.5,
      populationGrowthProjection: 0.8,
    },
  });
  return 1;
}

export async function seedEconomicProfile(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.economicProfile.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      gdpGrowthVolatility: 2.1,
      economicComplexity: 78.5,
      innovationIndex: 74.2,
      competitivenessRank: 18,
      exportsGDPPercent: 32.5,
      importsGDPPercent: 28.1,
      tradeBalance: 4.4,
    },
  });
  return 1;
}

export async function seedLaborMarket(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.laborMarket.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      youthUnemploymentRate: 8.5,
      femaleParticipationRate: 64.2,
      informalEmploymentRate: 4.8,
      medianWage: 42000,
      wageGrowthRate: 3.2,
    },
  });
  return 1;
}

export async function seedFiscalSystem(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.fiscalSystem.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      salesTaxRate: 15.0,
      corporateTaxRates: "22.0",
      personalIncomeTaxRates: "25.0",
      fiscalBalanceGDPPercent: -1.2,
      taxEfficiency: 88.0,
    },
  });
  return 1;
}

export async function seedIncomeDistribution(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.incomeDistribution.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      economicClasses: JSON.stringify([
        { name: "Lower Class", percentage: 20, avgIncome: 18000 },
        { name: "Middle Class", percentage: 60, avgIncome: 45000 },
        { name: "Upper Class", percentage: 20, avgIncome: 120000 },
      ]),
    },
  });
  return 1;
}

export async function seedGovernmentBudget(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.governmentBudget.upsert({
    where: { countryId },
    update: {},
    create: {
      countryId,
      spendingCategories: JSON.stringify([
        { category: "Healthcare", percentage: 25 },
        { category: "Education", percentage: 20 },
        { category: "Defense", percentage: 18 },
        { category: "Infrastructure", percentage: 15 },
        { category: "Social Welfare", percentage: 12 },
        { category: "Administration", percentage: 10 },
      ]),
    },
  });
  return 1;
}

export async function populateCountryFields(prisma: Prisma, countryId: string): Promise<void> {
  await prisma.country.update({
    where: { id: countryId },
    data: {
      economicVitality: 78.5,
      populationWellbeing: 82.0,
      diplomaticStanding: 74.0,
      governmentalEfficiency: 80.0,
      overallNationalHealth: 79.5,
    },
  });
}

export async function seedNPCPersonality(prisma: Prisma, countryId: string): Promise<number> {
  const existing = await prisma.nPCPersonalityAssignment
    .findUnique({
      where: { countryId },
    })
    .catch(() => null);
  if (existing) return 0;

  const personality = await (prisma as any).nPCPersonality
    .findFirst({
      where: { isActive: true },
      orderBy: { usageCount: "asc" },
    })
    .catch(() => null);
  if (!personality) return 0;

  await prisma.nPCPersonalityAssignment.create({
    data: {
      personalityId: personality.id,
      countryId,
      assignedBy: "demo_seed",
      reason: "Auto-assigned for demo mode",
      driftHistory: JSON.stringify([]),
    },
  });

  await (prisma as any).nPCPersonality
    .update({
      where: { id: personality.id },
      data: { usageCount: { increment: 1 } },
    })
    .catch(() => null);

  return 1;
}
