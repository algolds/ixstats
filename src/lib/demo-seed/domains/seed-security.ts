/**
 * Demo seed for security, intelligence briefings, alerts, military branches, and threats.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../../ixtime";
import fallbackSec from "../../../../data/seed/fallback-security.json";

type Prisma = PrismaClient;

export async function seedIntelligence(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  for (const b of fallbackSec.briefings) {
    const briefing = await prisma.intelligenceBriefing.create({
      data: {
        countryId,
        title: b.title,
        description: b.description,
        type: b.type as any,
        priority: b.priority as any,
        area: b.area as any,
        confidence: b.confidence,
        urgency: b.urgency as any,
        impactMagnitude: b.impactMagnitude,
        evidence: b.evidence,
        isActive: b.isActive,
      },
    });
    count++;

    await prisma.intelligenceRecommendation.create({
      data: {
        briefingId: briefing.id,
        countryId,
        title: `Action Plan: ${b.title.replace("Analysis", "Response")}`,
        description: `Recommended strategic action for ${b.title.toLowerCase()}.`,
        category: b.area as any,
        urgency: b.urgency as any,
        difficulty: "MODERATE",
        estimatedDuration: "2-4 weeks",
        estimatedCost: "$10M-$50M",
        estimatedBenefit: "Significant improvement in national metrics",
        prerequisites: "Cabinet approval required",
        risks: "Budget allocation required",
        successProbability: b.confidence / 100,
        economicImpact: b.area === "ECONOMIC" ? 0.3 : 0.1,
        socialImpact: b.area === "SOCIAL" ? 0.4 : 0.1,
        diplomaticImpact: b.area === "DIPLOMATIC" ? 0.5 : 0,
        isActive: true,
      },
    });
    count++;
  }

  for (const t of fallbackSec.thresholds) {
    await prisma.intelligenceAlertThreshold.create({
      data: {
        countryId,
        userId: "system",
        alertType: t.alertType,
        metricName: t.metricName,
        criticalMax: t.criticalMax,
        highMax: t.highMax,
        mediumMax: t.mediumMax,
        notifyOnCritical: t.notifyOnCritical,
        notifyOnHigh: t.notifyOnHigh,
        notifyOnMedium: t.notifyOnMedium,
        isActive: t.isActive,
      },
    });
    count++;
  }

  return count;
}

export async function seedDefense(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  const branches = [
    {
      countryId,
      branchType: "army" as const,
      name: "Imperial Army",
      description:
        "Primary land warfare force responsible for territorial defense and power projection.",
      activeDuty: 180000,
      reserves: 95000,
      civilianStaff: 25000,
      annualBudget: 12000000000,
      budgetPercent: 45,
      readinessLevel: 78,
      technologyLevel: 72,
      trainingLevel: 80,
      morale: 75,
    },
    {
      countryId,
      branchType: "navy" as const,
      name: "Imperial Navy",
      description:
        "Maritime defense and blue-water naval operations. Includes carrier battle groups.",
      activeDuty: 65000,
      reserves: 20000,
      civilianStaff: 12000,
      annualBudget: 8500000000,
      budgetPercent: 32,
      readinessLevel: 82,
      technologyLevel: 78,
      trainingLevel: 85,
      morale: 80,
    },
    {
      countryId,
      branchType: "air_force" as const,
      name: "Imperial Air Force",
      description: "Aerial warfare, air defense, and strategic airlift capabilities.",
      activeDuty: 45000,
      reserves: 15000,
      civilianStaff: 8000,
      annualBudget: 6000000000,
      budgetPercent: 23,
      readinessLevel: 85,
      technologyLevel: 82,
      trainingLevel: 83,
      morale: 82,
    },
  ];

  for (const b of branches) {
    const branch = await prisma.militaryBranch.create({ data: b });
    count++;

    const unitTypes =
      b.branchType === "army"
        ? [
            {
              name: "1st Armored Division",
              unitType: "armored",
              personnel: 15000,
              designation: "1st AD",
            },
            {
              name: "3rd Infantry Brigade",
              unitType: "infantry",
              personnel: 5000,
              designation: "3rd IB",
            },
          ]
        : b.branchType === "navy"
          ? [
              {
                name: "Carrier Strike Group Alpha",
                unitType: "carrier_group",
                personnel: 6500,
                designation: "CSG-A",
              },
              {
                name: "Submarine Squadron 2",
                unitType: "submarine",
                personnel: 1200,
                designation: "SUBRON-2",
              },
            ]
          : [
              {
                name: "1st Fighter Wing",
                unitType: "fighter",
                personnel: 3000,
                designation: "1st FW",
              },
              {
                name: "Strategic Airlift Command",
                unitType: "transport",
                personnel: 2000,
                designation: "SAC",
              },
            ];

    for (const u of unitTypes) {
      await prisma.militaryUnit.create({
        data: {
          branchId: branch.id,
          ...u,
          readiness: 60 + Math.random() * 30,
          commanderName: `Gen. ${["Maximus", "Flavius", "Octavius", "Lucius", "Titus", "Severus"][Math.floor(Math.random() * 6)]}`,
        },
      });
      count++;
    }
  }

  await prisma.militaryOperation.create({
    data: {
      countryId,
      operationType: "patrol",
      name: "Operation Vigilant Shield",
      description: "Maritime patrol and surveillance operation in territorial waters.",
      status: "active",
      startIxTime: IxTime.getCurrentIxTime() - 5000,
      personnelDeployed: 2500,
      dailyCost: 500000,
      totalCostSoFar: 15000000,
      readinessImpact: -5,
    },
  });
  count++;

  return count;
}

export async function seedCrisisEvents(prisma: Prisma, countryName: string): Promise<number> {
  const crises = [
    {
      type: "natural_disaster",
      title: "Severe Flooding in Eastern Provinces",
      severity: "HIGH" as const,
      description:
        "Unprecedented rainfall has caused major flooding in 3 eastern provinces, displacing 50,000 residents.",
      category: "social" as const,
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      casualties: 12,
      economicImpact: -500000000,
      responseStatus: "responding",
      location: "Eastern Provinces",
    },
    {
      type: "economic_crisis",
      title: "Regional Banking Sector Stress",
      severity: "MEDIUM" as const,
      description:
        "Three regional banks report elevated non-performing loan ratios. Central bank monitoring closely.",
      category: "economic" as const,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      economicImpact: -200000000,
      responseStatus: "monitoring",
    },
    {
      type: "diplomatic_incident",
      title: "Trade Vessel Detained in Foreign Port",
      severity: "LOW" as const,
      description: `A ${countryName}-flagged cargo vessel has been detained pending documentation review. Diplomatic channels engaged.`,
      category: "diplomatic" as const,
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      responseStatus: "responding",
    },
  ];

  await prisma.crisisEvent.createMany({ data: crises });
  return crises.length;
}

export async function seedSecurityThreats(prisma: Prisma, countryId: string): Promise<number> {
  const threats = [
    {
      countryId,
      threatName: "Organized Smuggling Network",
      threatType: "organized_crime" as const,
      severity: "moderate" as const,
      status: "monitoring" as const,
      description: "Cross-border smuggling ring operating in eastern border regions.",
      likelihood: 55,
      impact: 40,
      actorType: "criminal_organization",
      actorCapability: 45,
      potentialCasualties: 0,
      economicImpact: 150000000,
      confidenceLevel: 72,
    },
    {
      countryId,
      threatName: "Cyber Espionage Campaign",
      threatType: "cyber" as const,
      severity: "high" as const,
      status: "responding" as const,
      description: "Sophisticated state-sponsored cyber operations targeting government systems.",
      likelihood: 68,
      impact: 65,
      actorType: "state_actor",
      actorCapability: 78,
      potentialCasualties: 0,
      economicImpact: 500000000,
      confidenceLevel: 82,
    },
    {
      countryId,
      threatName: "Regional Insurgent Activity",
      threatType: "insurgency" as const,
      severity: "low" as const,
      status: "monitoring" as const,
      description: "Low-level separatist activity in remote provinces. Limited capability.",
      likelihood: 25,
      impact: 30,
      actorType: "non_state_actor",
      actorCapability: 20,
      potentialCasualties: 5,
      economicImpact: 20000000,
      confidenceLevel: 65,
    },
  ];

  let count = 0;
  for (const threat of threats) {
    await prisma.securityThreat.create({ data: threat });
    count++;
  }
  return count;
}
