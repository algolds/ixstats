/**
 * Demo seed for country policies and elections.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../../ixtime";

type Prisma = PrismaClient;

export async function seedPolicies(
  prisma: Prisma,
  countryId: string,
  userId: string
): Promise<number> {
  const now = new Date();
  const ixNow = IxTime.getCurrentIxTime();
  const policies = [
    {
      countryId,
      userId,
      name: "National Digital Infrastructure Act",
      description:
        "Comprehensive broadband expansion and digital services modernization across all regions.",
      policyType: "legislation",
      category: "infrastructure",
      status: "active",
      priority: "high",
      objectives: JSON.stringify([
        "95% broadband coverage by 2028",
        "Digital government services portal",
        "Rural connectivity initiative",
      ]),
      implementationCost: 2500000000,
      maintenanceCost: 150000000,
      gdpEffect: 0.3,
      employmentEffect: 0.5,
      inflationEffect: 0.1,
      proposedDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      effectiveDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 43200,
      effectiveIxTime: ixNow - 21600,
    },
    {
      countryId,
      userId,
      name: "Green Energy Transition Plan",
      description:
        "Phase out coal power plants and transition to renewable energy sources over 10 years.",
      policyType: "strategic_plan",
      category: "environmental",
      status: "active",
      priority: "critical",
      objectives: JSON.stringify([
        "50% renewable energy by 2030",
        "Carbon tax implementation",
        "Electric vehicle incentives",
      ]),
      implementationCost: 8000000000,
      maintenanceCost: 500000000,
      gdpEffect: -0.1,
      employmentEffect: 0.8,
      inflationEffect: 0.2,
      proposedDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      effectiveDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 86400,
      effectiveIxTime: ixNow - 64800,
    },
    {
      countryId,
      userId,
      name: "Universal Healthcare Expansion",
      description:
        "Extend universal healthcare coverage to include dental, mental health, and prescription drugs.",
      policyType: "reform",
      category: "social",
      status: "active",
      priority: "high",
      implementationCost: 5000000000,
      maintenanceCost: 3000000000,
      gdpEffect: 0.1,
      employmentEffect: 1.2,
      inflationEffect: 0.3,
      proposedDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      effectiveDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 129600,
      effectiveIxTime: ixNow - 86400,
    },
    {
      countryId,
      userId,
      name: "Small Business Innovation Fund",
      description:
        "Government-backed venture fund to support technology startups and small business growth.",
      policyType: "program",
      category: "economic",
      status: "active",
      priority: "medium",
      implementationCost: 1000000000,
      maintenanceCost: 100000000,
      gdpEffect: 0.5,
      employmentEffect: 1.5,
      inflationEffect: 0,
      proposedDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      effectiveDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 28800,
      effectiveIxTime: ixNow - 14400,
    },
    {
      countryId,
      userId,
      name: "National Defense Modernization Act",
      description:
        "Comprehensive military modernization including cyber capabilities and naval expansion.",
      policyType: "legislation",
      category: "defense",
      status: "active",
      priority: "critical",
      implementationCost: 12000000000,
      maintenanceCost: 2000000000,
      gdpEffect: 0.2,
      employmentEffect: 0.3,
      inflationEffect: 0.1,
      proposedDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
      effectiveDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 172800,
      effectiveIxTime: ixNow - 129600,
    },
    {
      countryId,
      userId,
      name: "Anti-Corruption Transparency Act",
      description:
        "Strengthen whistleblower protections and require financial disclosure for all senior officials.",
      policyType: "legislation",
      category: "governance",
      status: "draft",
      priority: "medium",
      implementationCost: 50000000,
      maintenanceCost: 10000000,
      gdpEffect: 0.1,
      employmentEffect: 0,
      inflationEffect: 0,
      proposedDate: now,
      proposedIxTime: ixNow,
    },
    {
      countryId,
      userId,
      name: "Agricultural Subsidy Reform",
      description: "Restructure agricultural subsidies to favor sustainable farming practices.",
      policyType: "reform",
      category: "economic",
      status: "review",
      priority: "medium",
      implementationCost: 800000000,
      maintenanceCost: 600000000,
      gdpEffect: 0.1,
      employmentEffect: -0.2,
      inflationEffect: -0.1,
      proposedDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 7200,
    },
    {
      countryId,
      userId,
      name: "Immigration Reform Package",
      description:
        "Streamline skilled worker visa process and strengthen border security measures.",
      policyType: "legislation",
      category: "social",
      status: "draft",
      priority: "high",
      implementationCost: 2000000000,
      maintenanceCost: 500000000,
      gdpEffect: 0.4,
      employmentEffect: 0.6,
      inflationEffect: 0.1,
      proposedDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      proposedIxTime: ixNow - 2880,
    },
  ];

  let count = 0;

  // Effect log data for active policies (keyed by policy name)
  const effectLogData: Record<
    string,
    Array<{
      effectType: string;
      metricsBefore: string;
      metricsAfter: string;
      actualEffect: string;
      notes: string;
      daysAgo: number;
    }>
  > = {
    "National Digital Infrastructure Act": [
      {
        effectType: "economic",
        metricsBefore: JSON.stringify({ broadbandCoverage: 72 }),
        metricsAfter: JSON.stringify({ broadbandCoverage: 78 }),
        actualEffect: "+6% broadband coverage",
        notes: "Phase 1 rollout complete in urban areas.",
        daysAgo: 10,
      },
    ],
    "Green Energy Transition Plan": [
      {
        effectType: "environmental",
        metricsBefore: JSON.stringify({ renewableShare: 22 }),
        metricsAfter: JSON.stringify({ renewableShare: 26 }),
        actualEffect: "+4% renewable energy share",
        notes: "Two coal plants decommissioned ahead of schedule.",
        daysAgo: 30,
      },
      {
        effectType: "economic",
        metricsBefore: JSON.stringify({ greenJobs: 45000 }),
        metricsAfter: JSON.stringify({ greenJobs: 52000 }),
        actualEffect: "+7,000 green sector jobs",
        notes: "Solar panel manufacturing facility opened.",
        daysAgo: 15,
      },
    ],
    "Universal Healthcare Expansion": [
      {
        effectType: "social",
        metricsBefore: JSON.stringify({ coverageRate: 85 }),
        metricsAfter: JSON.stringify({ coverageRate: 91 }),
        actualEffect: "+6% healthcare coverage",
        notes: "Dental and mental health services now covered in 3 regions.",
        daysAgo: 20,
      },
    ],
    "Small Business Innovation Fund": [
      {
        effectType: "economic",
        metricsBefore: JSON.stringify({ startupsCreated: 0 }),
        metricsAfter: JSON.stringify({ startupsCreated: 140 }),
        actualEffect: "140 startups funded in first cycle",
        notes: "Applications exceeded projections by 200%.",
        daysAgo: 5,
      },
    ],
    "National Defense Modernization Act": [
      {
        effectType: "defense",
        metricsBefore: JSON.stringify({ readinessIndex: 68 }),
        metricsAfter: JSON.stringify({ readinessIndex: 74 }),
        actualEffect: "+6 readiness index points",
        notes: "Cyber defense division fully operational.",
        daysAgo: 45,
      },
      {
        effectType: "economic",
        metricsBefore: JSON.stringify({ defenseIndustryJobs: 120000 }),
        metricsAfter: JSON.stringify({ defenseIndustryJobs: 128000 }),
        actualEffect: "+8,000 defense industry jobs",
        notes: "Naval shipyard expansion created new positions.",
        daysAgo: 25,
      },
    ],
  };

  for (const p of policies) {
    const policy = await prisma.policy.create({ data: p });
    count++;

    // Create effect logs for active policies
    const logs = effectLogData[p.name];
    if (logs && p.status === "active") {
      for (const log of logs) {
        await prisma.policyEffectLog.create({
          data: {
            policyId: policy.id,
            appliedIxTime: ixNow - log.daysAgo * 1440,
            appliedAt: new Date(now.getTime() - log.daysAgo * 24 * 60 * 60 * 1000),
            effectType: log.effectType,
            metricsBefore: log.metricsBefore,
            metricsAfter: log.metricsAfter,
            actualEffect: log.actualEffect,
            notes: log.notes,
          },
        });
        count++;
      }
    }
  }
  return count;
}

// ─── Elections ──────────────────────────────────────────────────────

export async function seedElections(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  const partyData = [
    {
      countryId,
      name: "National Unity Party",
      shortName: "NUP",
      ideology: "center_right",
      color: "#1e40af",
      leaderName: "Marcus Aurelius Varro",
      baseSupport: 35,
      currentSupport: 38,
    },
    {
      countryId,
      name: "Progressive Democratic Alliance",
      shortName: "PDA",
      ideology: "center_left",
      color: "#dc2626",
      leaderName: "Lucia Septimia",
      baseSupport: 28,
      currentSupport: 26,
    },
    {
      countryId,
      name: "Conservative Reform Party",
      shortName: "CRP",
      ideology: "right",
      color: "#15803d",
      leaderName: "Gaius Decimus Albinus",
      baseSupport: 18,
      currentSupport: 17,
    },
    {
      countryId,
      name: "Social Democratic Front",
      shortName: "SDF",
      ideology: "left",
      color: "#d97706",
      leaderName: "Valeria Messalina",
      baseSupport: 12,
      currentSupport: 13,
    },
    {
      countryId,
      name: "Liberty & Justice Coalition",
      shortName: "LJC",
      ideology: "center",
      color: "#7c3aed",
      leaderName: "Tiberius Cassius",
      baseSupport: 7,
      currentSupport: 6,
    },
  ];

  const parties = [];
  for (const p of partyData) {
    parties.push(await prisma.politicalParty.create({ data: p }));
    count++;
  }

  const legislature = await prisma.legislature.create({
    data: {
      countryId,
      name: "Imperial Senate",
      chamberType: "unicameral",
      totalSeats: 200,
      electoralSystem: "proportional",
      termLength: 5,
      electionCycle: "fixed",
    },
  });
  count++;

  const seatDistribution = [76, 52, 34, 26, 12];
  let seatNum = 1;
  for (let i = 0; i < parties.length; i++) {
    for (let s = 0; s < seatDistribution[i]!; s++) {
      await prisma.legislativeSeat.create({
        data: {
          legislatureId: legislature.id,
          partyId: parties[i]!.id,
          seatNumber: seatNum++,
          isActive: true,
        },
      });
      count++;
    }
  }

  const election = await prisma.election.create({
    data: {
      countryId,
      legislatureId: legislature.id,
      electionType: "general",
      name: `${new Date().getFullYear()} General Election`,
      scheduledIxTime: IxTime.getCurrentIxTime() - 100000,
      status: "completed",
      turnout: 72.4,
      totalVotes: 45000000,
      marginOfVictory: 12.3,
    },
  });
  count++;

  for (let i = 0; i < parties.length; i++) {
    const candidate = await prisma.electionCandidate.create({
      data: {
        electionId: election.id,
        partyId: parties[i]!.id,
        candidateName: partyData[i]!.leaderName!,
        charisma: 40 + Math.random() * 40,
        politicalCapital: 30 + Math.random() * 50,
      },
    });
    count++;

    await prisma.electionResult.create({
      data: {
        electionId: election.id,
        candidateId: candidate.id,
        votesReceived: Math.round(45000000 * (partyData[i]!.currentSupport / 100)),
        votePercentage: partyData[i]!.currentSupport,
        seatsWon: seatDistribution[i]!,
      },
    });
    count++;
  }

  return count;
}
