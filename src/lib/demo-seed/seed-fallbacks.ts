/**
 * Synthetic seed fallbacks for the Demo Seed system.
 *
 * These generate hardcoded demo data when the source country
 * has no records for a subsystem. Moved from the original DemoSeedService.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";

type Prisma = PrismaClient;

/** Short random hex suffix for unique constraint safety across demo runs */
const demoSuffix = () => Math.random().toString(36).substring(2, 8);

// ─── Meetings ──────────────────────────────────────────────────────

export async function seedMeetings(
  prisma: Prisma,
  countryId: string,
  userId: string
): Promise<number> {
  const now = new Date();
  const meetings = [
    {
      countryId,
      userId,
      title: "Emergency Economic Review",
      description: "Emergency session to address rising inflation and trade deficit concerns.",
      scheduledDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      scheduledIxTime: IxTime.getCurrentIxTime() - 4320,
      duration: 120,
      status: "completed",
      notes:
        "Agreed to implement targeted fiscal stimulus. Minister of Finance to prepare detailed proposal.",
      completedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    },
    {
      countryId,
      userId,
      title: "Defense Modernization Briefing",
      description: "Annual review of military modernization program and budget allocations.",
      scheduledDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      scheduledIxTime: IxTime.getCurrentIxTime() - 1440,
      duration: 90,
      status: "completed",
      notes: "Approved Phase 2 of naval modernization. Cyber defense budget increased by 15%.",
      completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
    },
    {
      countryId,
      userId,
      title: "Weekly Cabinet Session",
      description: "Regular weekly cabinet meeting to review ongoing policy implementations.",
      scheduledDate: now,
      scheduledIxTime: IxTime.getCurrentIxTime(),
      duration: 60,
      status: "in_progress",
    },
    {
      countryId,
      userId,
      title: "Infrastructure Investment Summit",
      description: "Review proposals for national infrastructure modernization initiative.",
      scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      scheduledIxTime: IxTime.getCurrentIxTime() + 2880,
      duration: 180,
      status: "scheduled",
    },
    {
      countryId,
      userId,
      title: "Education Reform Committee",
      description: "Discuss findings from the national education quality assessment.",
      scheduledDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      scheduledIxTime: IxTime.getCurrentIxTime() + 7200,
      duration: 90,
      status: "scheduled",
    },
    {
      countryId,
      userId,
      title: "Healthcare System Review",
      description: "Quarterly review of universal healthcare implementation progress.",
      scheduledDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      scheduledIxTime: IxTime.getCurrentIxTime() - 10080,
      duration: 120,
      status: "completed",
      notes:
        "Hospital capacity targets met in 3 of 5 regions. Rural healthcare initiative extended.",
      completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    },
  ];

  let count = 0;
  // Fetch officials for attendance (or use generic names)
  const govStructure = await prisma.governmentStructure
    .findFirst({ where: { countryId }, select: { id: true } })
    .catch(() => null);
  const officials = govStructure
    ? await prisma.governmentOfficial
        .findMany({
          where: { governmentStructureId: govStructure.id },
          select: { id: true, name: true, role: true },
          take: 5,
        })
        .catch(() => [])
    : [];
  const attendees =
    officials.length > 0
      ? officials.map((o) => ({
          officialId: o.id,
          attendeeName: o.name,
          attendeeRole: o.role ?? "Official",
        }))
      : [
          { officialId: undefined, attendeeName: "Head of State", attendeeRole: "Head of State" },
          { officialId: undefined, attendeeName: "Minister of Finance", attendeeRole: "Finance" },
          { officialId: undefined, attendeeName: "Minister of Defense", attendeeRole: "Defense" },
          { officialId: undefined, attendeeName: "Chief of Staff", attendeeRole: "Chief of Staff" },
        ];

  for (const m of meetings) {
    const meeting = await prisma.cabinetMeeting.create({ data: m });
    count++;

    // MeetingAttendance
    if (m.status === "completed" || m.status === "in_progress" || m.status === "scheduled") {
      for (let a = 0; a < attendees.length; a++) {
        const att = attendees[a]!;
        await prisma.meetingAttendance.create({
          data: {
            meetingId: meeting.id,
            officialId: att.officialId ?? undefined,
            attendeeName: att.attendeeName,
            attendeeRole: att.attendeeRole,
            attendanceStatus:
              m.status === "scheduled"
                ? "invited"
                : a === attendees.length - 1
                  ? "excused"
                  : "attended",
          },
        });
        count++;
      }
    }

    if (m.status === "completed" || m.status === "in_progress") {
      await prisma.meetingAgendaItem.createMany({
        data: [
          {
            meetingId: meeting.id,
            title: "Opening Remarks & Previous Minutes",
            order: 1,
            status: "completed",
            category: "administrative",
          },
          {
            meetingId: meeting.id,
            title: "Key Policy Updates",
            order: 2,
            status: m.status === "completed" ? "completed" : "in_progress",
            category: "policy",
          },
          {
            meetingId: meeting.id,
            title: "Budget & Resource Allocation",
            order: 3,
            status: m.status === "completed" ? "completed" : "pending",
            category: "fiscal",
          },
        ],
      });
      count += 3;
    }

    // Seed decisions and action items for completed meetings
    if (m.status === "completed") {
      if (m.title === "Emergency Economic Review") {
        const decisions = await prisma.meetingDecision.createManyAndReturn({
          data: [
            {
              meetingId: meeting.id,
              title: "Approve Targeted Fiscal Stimulus Package",
              description:
                "Cabinet approved a $500M targeted fiscal stimulus focusing on small business grants, infrastructure fast-tracking, and temporary tax relief for affected sectors.",
              decisionType: "policy",
              impact: "high",
              votingResult: "unanimous",
              implementationStatus: "in_progress",
            },
            {
              meetingId: meeting.id,
              title: "Establish Trade Deficit Task Force",
              description:
                "Cross-ministry task force to investigate rising trade deficit and recommend corrective measures within 30 days.",
              decisionType: "strategic",
              impact: "medium",
              votingResult: "majority",
              implementationStatus: "pending",
            },
          ],
        });
        count += 2;

        await prisma.meetingActionItem.createMany({
          data: [
            {
              meetingId: meeting.id,
              decisionId: decisions[0]?.id,
              title: "Prepare detailed fiscal stimulus proposal",
              description: "Full proposal with sector allocations, timeline, and KPIs.",
              assignedTo: "Minister of Finance",
              dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              priority: "urgent",
              status: "in_progress",
              category: "fiscal",
            },
            {
              meetingId: meeting.id,
              decisionId: decisions[1]?.id,
              title: "Convene Trade Deficit Task Force inaugural meeting",
              assignedTo: "Minister of Commerce",
              dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
              priority: "high",
              status: "pending",
              category: "trade",
            },
            {
              meetingId: meeting.id,
              decisionId: decisions[0]?.id,
              title: "Brief parliament on stimulus rationale",
              assignedTo: "Chief of Staff",
              dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
              priority: "normal",
              status: "completed",
              completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            },
          ],
        });
        count += 3;
      }

      if (m.title === "Defense Modernization Briefing") {
        const decisions = await prisma.meetingDecision.createManyAndReturn({
          data: [
            {
              meetingId: meeting.id,
              title: "Approve Phase 2 Naval Modernization",
              description:
                "Phase 2 approved with $3.2B budget for new corvettes, submarine refits, and port infrastructure upgrades.",
              decisionType: "budget",
              impact: "high",
              votingResult: "majority",
              implementationStatus: "in_progress",
            },
            {
              meetingId: meeting.id,
              title: "Increase Cyber Defense Budget by 15%",
              description:
                "Reallocation from reserve fund to expand cyber defense capabilities including personnel, infrastructure, and training.",
              decisionType: "budget",
              impact: "medium",
              votingResult: "unanimous",
              implementationStatus: "approved",
            },
          ],
        });
        count += 2;

        await prisma.meetingActionItem.createMany({
          data: [
            {
              meetingId: meeting.id,
              decisionId: decisions[0]?.id,
              title: "Submit naval procurement timeline to parliament",
              assignedTo: "Minister of Defense",
              dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
              priority: "high",
              status: "pending",
              category: "defense",
            },
            {
              meetingId: meeting.id,
              decisionId: decisions[1]?.id,
              title: "Recruit 200 cyber defense specialists",
              description: "Coordinate with universities and private sector for talent pipeline.",
              assignedTo: "Cyber Command",
              dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              priority: "high",
              status: "in_progress",
              category: "defense",
            },
          ],
        });
        count += 2;
      }

      if (m.title === "Healthcare System Review") {
        const decisions = await prisma.meetingDecision.createManyAndReturn({
          data: [
            {
              meetingId: meeting.id,
              title: "Extend Rural Healthcare Initiative",
              description:
                "Continuation of rural healthcare program with expanded coverage to underserved communities and increased funding for mobile clinics.",
              decisionType: "policy",
              impact: "medium",
              votingResult: "unanimous",
              implementationStatus: "in_progress",
            },
          ],
        });
        count += 1;

        await prisma.meetingActionItem.createMany({
          data: [
            {
              meetingId: meeting.id,
              decisionId: decisions[0]?.id,
              title: "Draft rural healthcare expansion budget",
              assignedTo: "Minister of Health",
              dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
              priority: "normal",
              status: "pending",
              category: "healthcare",
            },
            {
              meetingId: meeting.id,
              title: "Report on hospital capacity targets for remaining 2 regions",
              assignedTo: "Deputy Health Minister",
              dueDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
              priority: "normal",
              status: "pending",
              category: "healthcare",
            },
          ],
        });
        count += 2;
      }
    }
  }
  return count;
}

/**
 * Ensure completed meetings have decisions and action items.
 * Safe to call after clone or seed — only creates records if none exist.
 */
export async function seedMeetingDecisionsIfMissing(
  prisma: Prisma,
  countryId: string
): Promise<number> {
  const completedMeetings = await prisma.cabinetMeeting.findMany({
    where: { countryId, status: "completed" },
    select: { id: true, title: true },
  });

  let count = 0;
  const now = new Date();

  for (const meeting of completedMeetings) {
    // Skip if already has decisions
    const existingDecisions = await prisma.meetingDecision.count({
      where: { meetingId: meeting.id },
    });
    if (existingDecisions > 0) continue;

    // Create generic decisions and action items for completed meetings without any
    const decisions = await prisma.meetingDecision.createManyAndReturn({
      data: [
        {
          meetingId: meeting.id,
          title: `Policy directive from ${meeting.title}`,
          description: `Key policy decision approved during ${meeting.title}. Implementation authorized by cabinet.`,
          decisionType: "policy",
          impact: "medium",
          votingResult: "majority",
          implementationStatus: "in_progress",
        },
        {
          meetingId: meeting.id,
          title: `Resource allocation for ${meeting.title} follow-up`,
          description: `Budget and personnel allocated for implementing outcomes of ${meeting.title}.`,
          decisionType: "budget",
          impact: "medium",
          votingResult: "unanimous",
          implementationStatus: "pending",
        },
      ],
    });
    count += 2;

    await prisma.meetingActionItem.createMany({
      data: [
        {
          meetingId: meeting.id,
          decisionId: decisions[0]?.id,
          title: `Prepare implementation report for: ${meeting.title}`,
          assignedTo: "Chief of Staff",
          dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          priority: "high",
          status: "pending",
        },
        {
          meetingId: meeting.id,
          decisionId: decisions[1]?.id,
          title: `Submit budget proposal for: ${meeting.title}`,
          assignedTo: "Minister of Finance",
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          priority: "normal",
          status: "in_progress",
        },
      ],
    });
    count += 2;
  }

  return count;
}

// ─── Policies ──────────────────────────────────────────────────────

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

// ─── Diplomacy ──────────────────────────────────────────────────────

export async function seedDiplomacy(
  prisma: Prisma,
  countryId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  const otherCountries = await prisma.country.findMany({
    where: { isDemo: false, id: { not: countryId } },
    take: 6,
    select: { id: true, name: true, flag: true },
  });

  if (otherCountries.length === 0) return 0;

  for (let i = 0; i < Math.min(otherCountries.length, 5); i++) {
    const other = otherCountries[i]!;
    const relationships = ["allied", "friendly", "neutral", "tense", "friendly"];
    const strengths = [85, 72, 50, 30, 68];

    await prisma.diplomaticRelation.create({
      data: {
        country1: countryId,
        country2: other.id,
        relationship: relationships[i]!,
        strength: strengths[i]!,
        status: "active",
        lastContact: new Date(),
        tradeVolume: Math.random() * 50000000000,
      },
    });
    count++;
  }

  for (let i = 0; i < Math.min(otherCountries.length, 3); i++) {
    const other = otherCountries[i]!;
    const embassy = await prisma.embassy.create({
      data: {
        hostCountryId: other.id,
        guestCountryId: countryId,
        name: `Embassy of ${countryName} in ${other.name}`,
        ambassadorName: [
          "Ambassador Helena Varus",
          "Ambassador Marcus Scipio",
          "Ambassador Julia Cornelia",
        ][i],
        staffCount: 8 + i * 3,
        status: "active",
        level: 2 + i,
        experience: 500 + i * 300,
        influence: 30 + i * 15,
        effectiveness: 55 + i * 10,
        reputation: 60 + i * 8,
        budget: 100000 + i * 50000,
      },
    });
    count++;

    if (i === 0) {
      await prisma.embassyMission.create({
        data: {
          embassyId: embassy.id,
          name: "Trade Negotiation",
          type: "economic",
          description: "Negotiate preferential trade terms for agricultural exports.",
          difficulty: "moderate",
          status: "active",
          cost: 15000,
          duration: 14,
          startedAt: new Date(),
          completesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          experienceReward: 100,
          influenceReward: 5,
          successChance: 65,
          progress: 35,
          ixTimeStarted: IxTime.getCurrentIxTime(),
          ixTimeCompletes: IxTime.getCurrentIxTime() + 20160,
        },
      });
      count++;
    }
  }

  return count;
}

// ─── Diplomacy Extras (alliances, foreign policy, cultural exchanges, bilateral trade) ───

export async function seedDiplomacyExtras(
  prisma: Prisma,
  countryId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  const otherCountries = await prisma.country.findMany({
    where: { isDemo: false, id: { not: countryId } },
    take: 6,
    select: { id: true, name: true },
  });

  if (otherCountries.length < 2) return 0;

  // ── Alliances (random suffix guarantees unique names across runs) ──
  const existingAlliances = await prisma.allianceMember.count({ where: { countryId } });
  if (existingAlliances === 0) {
    const suffix = demoSuffix();

    const alliance1 = await prisma.alliance.create({
      data: {
        name: `${countryName} Regional Economic Forum (${suffix})`,
        shortName: "REF",
        type: "economic",
        description:
          "A multilateral economic cooperation forum promoting free trade and shared prosperity among member states.",
        color: "#06b6d4",
        visibility: "public",
        joinPolicy: "application",
        memberCount: 2,
        foundedIxTime: IxTime.getCurrentIxTime() - 10000,
      },
    });
    await prisma.allianceMember.create({
      data: {
        allianceId: alliance1.id,
        countryId,
        role: "founder",
        votingPower: 2.0,
        contributionLevel: "high",
      },
    });
    if (otherCountries[0]) {
      await prisma.allianceMember.create({
        data: {
          allianceId: alliance1.id,
          countryId: otherCountries[0].id,
          role: "member",
          votingPower: 1.0,
        },
      });
    }
    count += 3;

    const alliance2 = await prisma.alliance.create({
      data: {
        name: `${countryName} Strategic Defense Pact (${suffix})`,
        shortName: "SDP",
        type: "military",
        description:
          "A mutual defense agreement providing collective security guarantees among member nations.",
        color: "#ef4444",
        visibility: "public",
        joinPolicy: "invite",
        memberCount: 2,
        foundedIxTime: IxTime.getCurrentIxTime() - 5000,
      },
    });
    await prisma.allianceMember.create({
      data: {
        allianceId: alliance2.id,
        countryId,
        role: "founder",
        votingPower: 2.0,
        contributionLevel: "high",
      },
    });
    if (otherCountries[1]) {
      await prisma.allianceMember.create({
        data: {
          allianceId: alliance2.id,
          countryId: otherCountries[1].id,
          role: "member",
          votingPower: 1.0,
        },
      });
    }
    count += 3;
  }

  // ── Foreign Policy Actions ──
  const existingPolicies = await prisma.foreignPolicyAction.count({
    where: { initiatorId: countryId },
  });
  if (existingPolicies === 0 && otherCountries.length >= 3) {
    await prisma.foreignPolicyAction.createMany({
      data: [
        {
          initiatorId: countryId,
          targetId: otherCountries[2]!.id,
          actionType: "free_trade",
          category: "trade",
          severity: "moderate",
          status: "active",
          effectiveIxTime: IxTime.getCurrentIxTime() - 8000,
          initiatorGdpImpact: 1200000000,
          targetGdpImpact: 800000000,
          relationshipDelta: 15,
          reason: "Strengthening bilateral trade relations and reducing tariff barriers.",
        },
        {
          initiatorId: countryId,
          targetId: otherCountries[3]?.id ?? otherCountries[0]!.id,
          actionType: "sanction",
          category: "trade",
          severity: "light",
          status: "active",
          effectiveIxTime: IxTime.getCurrentIxTime() - 3000,
          initiatorGdpImpact: -200000000,
          targetGdpImpact: -500000000,
          relationshipDelta: -20,
          reason: "Response to trade policy violations and intellectual property theft.",
        },
        {
          initiatorId: countryId,
          targetId: otherCountries[4]?.id ?? otherCountries[1]!.id,
          actionType: "military_alliance",
          category: "military",
          severity: "moderate",
          status: "proposed",
          initiatorGdpImpact: 0,
          targetGdpImpact: 0,
          relationshipDelta: 25,
          reason: "Proposed mutual defense and intelligence-sharing agreement.",
        },
      ],
    });
    count += 3;
  }

  // ── Cultural Exchanges ──
  const existingExchanges = await prisma.culturalExchange.count({
    where: { hostCountryId: countryId },
  });
  if (existingExchanges === 0 && otherCountries.length >= 2) {
    await prisma.culturalExchange.createMany({
      data: [
        {
          title: "International Arts Festival",
          type: "festival",
          description:
            "A week-long celebration of visual arts, music, and performing arts from participating nations.",
          hostCountryId: countryId,
          hostCountryName: countryName,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ixTimeContext: IxTime.getCurrentIxTime(),
          participants: 450,
          culturalImpact: 35,
          diplomaticValue: 22,
          socialEngagement: 1200,
          isPublic: true,
        },
        {
          title: "Academic Exchange Program",
          type: "education",
          description:
            "Scholar and student exchange program with partner universities, completed last quarter.",
          hostCountryId: countryId,
          hostCountryName: countryName,
          status: "completed",
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          ixTimeContext: IxTime.getCurrentIxTime() - 5000,
          participants: 120,
          culturalImpact: 45,
          diplomaticValue: 30,
          socialEngagement: 800,
          isPublic: true,
        },
      ],
    });
    count += 2;
  }

  // ── Bilateral Trade ──
  const existingTrade = await prisma.bilateralTrade.count({
    where: { OR: [{ country1Id: countryId }, { country2Id: countryId }] },
  });
  if (existingTrade === 0) {
    const tradeData = otherCountries.slice(0, 3).map((other, i) => ({
      country1Id: countryId,
      country2Id: other.id,
      tradeVolume: (30 - i * 8) * 1_000_000_000,
      exportsFrom1: (15 - i * 3) * 1_000_000_000,
      exportsFrom2: (15 - i * 5) * 1_000_000_000,
      tradeBalance1: (i * 2 - 2) * 1_000_000_000,
      commodities: JSON.stringify(
        [
          ["Machinery", "Electronics", "Chemicals"],
          ["Agricultural Products", "Textiles", "Raw Materials"],
          ["Energy", "Minerals", "Manufactured Goods"],
        ][i] ?? []
      ),
      lastCalculatedIx: IxTime.getCurrentIxTime(),
    }));
    await prisma.bilateralTrade.createMany({ data: tradeData });
    count += tradeData.length;
  }

  return count;
}

// ─── Intelligence ──────────────────────────────────────────────────────

export async function seedIntelligence(prisma: Prisma, countryId: string): Promise<number> {
  const briefings = [
    {
      countryId,
      title: "Economic Growth Trajectory Analysis",
      description:
        "GDP growth has outpaced regional average by 1.2% this quarter. Key drivers: technology sector expansion and increased foreign investment. Risk: potential overheating in real estate market.",
      type: "OPPORTUNITY" as const,
      priority: "MEDIUM" as const,
      area: "ECONOMIC" as const,
      confidence: 82,
      urgency: "THIS_MONTH" as const,
      impactMagnitude: "moderate",
      evidence: "Quarterly economic indicators, trade balance data, foreign investment records",
      isActive: true,
    },
    {
      countryId,
      title: "Regional Security Threat Assessment",
      description:
        "Intelligence indicates increased military exercises by neighboring states. No immediate threat, but readiness levels should be reviewed. Cyber probing activity detected on government networks.",
      type: "RISK_MITIGATION" as const,
      priority: "HIGH" as const,
      area: "SECURITY" as const,
      confidence: 71,
      urgency: "THIS_WEEK" as const,
      impactMagnitude: "significant",
      evidence: "SIGINT intercepts, satellite imagery, cyber intrusion logs",
      isActive: true,
    },
    {
      countryId,
      title: "Public Sentiment Monitoring Report",
      description:
        "Government approval rating has stabilized at 58% following infrastructure spending announcements. Social media sentiment trending positive on healthcare reform. Concern flagged on housing affordability in urban centers.",
      type: "STRATEGIC_INITIATIVE" as const,
      priority: "LOW" as const,
      area: "SOCIAL" as const,
      confidence: 88,
      urgency: "THIS_QUARTER" as const,
      impactMagnitude: "minor",
      evidence: "Public polling data, social media analysis, housing market indices",
      isActive: true,
    },
    {
      countryId,
      title: "Critical Infrastructure Vulnerability Report",
      description:
        "Annual audit reveals 3 high-priority vulnerabilities in power grid control systems. Water treatment facilities in eastern region require immediate security upgrades.",
      type: "HOT_ISSUE" as const,
      priority: "CRITICAL" as const,
      area: "INFRASTRUCTURE" as const,
      confidence: 95,
      urgency: "IMMEDIATE" as const,
      impactMagnitude: "critical",
      evidence: "Infrastructure audit reports, penetration testing results, incident response logs",
      isActive: true,
    },
    {
      countryId,
      title: "Diplomatic Opportunity: Trade Bloc Expansion",
      description:
        "Three nations have expressed interest in joining the regional trade agreement. Favorable terms could increase GDP by 0.4% annually. Window of opportunity narrows as competing blocs court same nations.",
      type: "OPPORTUNITY" as const,
      priority: "HIGH" as const,
      area: "DIPLOMATIC" as const,
      confidence: 76,
      urgency: "THIS_MONTH" as const,
      impactMagnitude: "significant",
      evidence: "Diplomatic cables, trade analysis, bilateral meeting summaries",
      isActive: true,
    },
  ];

  let count = 0;
  for (const b of briefings) {
    const briefing = await prisma.intelligenceBriefing.create({ data: b });
    count++;

    await prisma.intelligenceRecommendation.create({
      data: {
        briefingId: briefing.id,
        countryId,
        title: `Action Plan: ${b.title.replace("Analysis", "Response").replace("Report", "Action")}`,
        description: `Recommended action based on ${b.title.toLowerCase()}.`,
        category: b.area,
        urgency: b.urgency,
        difficulty: "MODERATE" as const,
        estimatedDuration: "2-4 weeks",
        estimatedCost: "$10M-$50M",
        estimatedBenefit: "Significant improvement in national metrics",
        prerequisites: "Cabinet approval required",
        risks: "Political opposition, budget constraints",
        successProbability: b.confidence / 100,
        economicImpact: b.area === "ECONOMIC" ? 0.3 : 0.1,
        socialImpact: b.area === "SOCIAL" ? 0.4 : 0.1,
        diplomaticImpact: b.area === "DIPLOMATIC" ? 0.5 : 0,
        isActive: true,
      },
    });
    count++;
  }

  // Add alert thresholds (new for key findings)
  // Model is IntelligenceAlertThreshold with min/max fields per severity level
  const thresholds = [
    {
      countryId,
      userId: "system",
      alertType: "economic",
      metricName: "GDP Growth",
      criticalMin: null,
      criticalMax: -5.0,
      highMin: null,
      highMax: -2.0,
      mediumMin: null,
      mediumMax: 0.0,
      notifyOnCritical: true,
      notifyOnHigh: true,
      notifyOnMedium: false,
      isActive: true,
    },
    {
      countryId,
      userId: "system",
      alertType: "security",
      metricName: "Security Score",
      criticalMin: null,
      criticalMax: 40.0,
      highMin: null,
      highMax: 60.0,
      mediumMin: null,
      mediumMax: 70.0,
      notifyOnCritical: true,
      notifyOnHigh: true,
      notifyOnMedium: true,
      isActive: true,
    },
    {
      countryId,
      userId: "system",
      alertType: "diplomatic",
      metricName: "Diplomatic Tension",
      criticalMin: 90.0,
      criticalMax: null,
      highMin: 70.0,
      highMax: null,
      mediumMin: 50.0,
      mediumMax: null,
      notifyOnCritical: true,
      notifyOnHigh: true,
      notifyOnMedium: false,
      isActive: true,
    },
  ];

  for (const t of thresholds) {
    await prisma.intelligenceAlertThreshold.create({ data: t });
    count++;
  }

  // Add intelligence alerts (varied severity for key findings)
  // severity uses Priority enum: CRITICAL, HIGH, MEDIUM, LOW
  // category uses Category enum: ECONOMIC, DIPLOMATIC, SOCIAL, SECURITY, etc.
  const alerts = [
    {
      countryId,
      title: "Unusual trade pattern detected",
      description:
        "Export volumes to eastern partners have dropped 12% this month, suggesting potential trade disruption.",
      severity: "MEDIUM" as const,
      category: "ECONOMIC" as const,
      alertType: "trade_anomaly",
      isActive: true,
      isResolved: false,
      currentValue: -12,
      expectedValue: 0,
      deviation: 12,
      zScore: 1.8,
      confidence: 75,
      factors: "[]",
    },
    {
      countryId,
      title: "Cyber intrusion attempt blocked",
      description:
        "Government network firewall blocked 47 intrusion attempts from unknown foreign IPs in the past 24 hours.",
      severity: "HIGH" as const,
      category: "SECURITY" as const,
      alertType: "cyber_threat",
      isActive: true,
      isResolved: false,
      currentValue: 47,
      expectedValue: 5,
      deviation: 42,
      zScore: 3.2,
      confidence: 92,
      factors: "[]",
    },
    {
      countryId,
      title: "Diplomatic relationship improving",
      description:
        "Relations with three neighboring nations have improved by an average of 8 points this quarter.",
      severity: "LOW" as const,
      category: "DIPLOMATIC" as const,
      alertType: "relationship_change",
      isActive: true,
      isResolved: false,
      currentValue: 8,
      expectedValue: 0,
      deviation: 8,
      zScore: 1.1,
      confidence: 88,
      factors: "[]",
    },
    {
      countryId,
      title: "Infrastructure spending ROI exceeding targets",
      description:
        "Recent infrastructure investments are yielding 1.4x projected economic returns.",
      severity: "LOW" as const,
      category: "ECONOMIC" as const,
      alertType: "metric_exceeded",
      isActive: true,
      isResolved: false,
      currentValue: 140,
      expectedValue: 100,
      deviation: 40,
      zScore: 2.0,
      confidence: 80,
      factors: "[]",
    },
  ];

  for (const a of alerts) {
    await prisma.intelligenceAlert.create({ data: a });
    count++;
  }

  return count;
}

// ─── Defense ──────────────────────────────────────────────────────

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

// ─── National Issues ──────────────────────────────────────────────────────

export async function seedNationalIssues(
  prisma: Prisma,
  countryId: string,
  countryName: string
): Promise<number> {
  const templates = await prisma.nationalIssueTemplate.findMany({
    where: { isActive: true },
    take: 8,
    orderBy: { domain: "asc" },
  });

  if (templates.length === 0) return 0;

  let count = 0;
  const ixNow = IxTime.getCurrentIxTime();
  const statuses = [
    "pending",
    "pending",
    "pending",
    "viewed",
    "viewed",
    "responded",
    "responded",
    "responded",
  ];

  for (let i = 0; i < Math.min(templates.length, 8); i++) {
    const t = templates[i]!;
    const status = statuses[i]!;

    const issueData: any = {
      templateId: t.id,
      countryId,
      title: t.title
        .replace(/\{\{countryName\}\}/g, countryName)
        .replace(/\{\{[^}]+\}\}/g, "the region"),
      description: t.description
        .replace(/\{\{countryName\}\}/g, countryName)
        .replace(/\{\{[^}]+\}\}/g, "various stakeholders"),
      domain: t.domain,
      category: t.category,
      severity: t.baseSeverity,
      urgency: t.baseUrgency,
      status,
      responseOptions: t.responseOptions,
      createdIxTime: ixNow - i * 2000,
      deadlineIxTime: t.deadlineDaysBase ? ixNow + t.deadlineDaysBase * 1440 : null,
      autoResolveOptionId: t.deadlineDaysBase ? "option_0" : null,
      contextSnapshot: JSON.stringify({ countryName, gdpFormatted: "$2.1T" }),
    };

    if (status === "responded") {
      issueData.chosenOptionId = "option_0";
      issueData.chosenOptionLabel = "Balanced approach";
      issueData.respondedAt = new Date();
      issueData.respondedIxTime = ixNow - i * 500;
      issueData.consequenceLog = "Applied balanced response. Public approval adjusted.";
    }

    const issue = await prisma.nationalIssue.create({ data: issueData });
    count++;

    // Create consequences for responded issues
    if (status === "responded") {
      const consequenceData = [
        {
          issueId: issue.id,
          targetModel: "Country",
          targetField: "publicApproval",
          previousValue: "62",
          newValue: "65",
          deltaValue: 3.0,
          description: "Public approval increased due to balanced policy response.",
          effectType: "immediate",
          appliedIxTime: ixNow - i * 500,
        },
        {
          issueId: issue.id,
          targetModel: "InternalStabilityMetrics",
          targetField: "socialCohesion",
          previousValue: "58",
          newValue: "60",
          deltaValue: 2.0,
          description: "Social cohesion improved marginally following government action.",
          effectType: "gradual",
          effectDuration: 30,
          appliedIxTime: ixNow - i * 500,
        },
      ];
      await prisma.nationalIssueConsequence.createMany({ data: consequenceData });
      count += consequenceData.length;
    }
  }

  return count;
}

// ─── Crisis Events ──────────────────────────────────────────────────────

export async function seedCrisisEvents(prisma: Prisma, countryName: string): Promise<number> {
  const crises = [
    {
      type: "natural_disaster",
      title: "Severe Flooding in Eastern Provinces",
      severity: "HIGH" as const,
      description:
        "Unprecedented rainfall has caused major flooding in 3 eastern provinces, displacing 50,000 residents.",
      category: "CRISIS" as const,
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
      category: "ECONOMIC" as const,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      economicImpact: -200000000,
      responseStatus: "monitoring",
    },
    {
      type: "diplomatic_incident",
      title: "Trade Vessel Detained in Foreign Port",
      severity: "LOW" as const,
      description: `A ${countryName}-flagged cargo vessel has been detained pending documentation review. Diplomatic channels engaged.`,
      category: "DIPLOMATIC" as const,
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      responseStatus: "responding",
    },
  ];

  await prisma.crisisEvent.createMany({ data: crises });
  return crises.length;
}

// ─── Social ──────────────────────────────────────────────────────

export async function seedSocial(
  prisma: Prisma,
  countryId: string,
  userId: string,
  countryName: string
): Promise<number> {
  let count = 0;

  const account = await prisma.thinkpagesAccount.create({
    data: {
      clerkUserId: userId,
      countryId,
      accountType: "official",
      username: `demo_${countryName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
      displayName: `Republic of ${countryName}`,
      firstName: "Government",
      lastName: "Communications",
      bio: `Official government communications account for the Republic of ${countryName}.`,
      verified: true,
      followerCount: 12500,
      followingCount: 45,
      postCount: 5,
      personality: "formal",
      politicalLean: "center_right",
    },
  });
  count++;

  const posts = [
    {
      accountId: account.id,
      content: `The Infrastructure Investment Summit concluded today with unanimous cabinet approval for the National Digital Infrastructure Act. 95% broadband coverage target set for 2028. #Digital${countryName.replace(/\s+/g, "")} #Infrastructure`,
      postType: "original",
      likeCount: 342,
      repostCount: 87,
      replyCount: 23,
      impressions: 15600,
      hashtags: JSON.stringify([`Digital${countryName.replace(/\s+/g, "")}`, "Infrastructure"]),
      ixTimeTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isAutoGenerated: true,
    },
    {
      accountId: account.id,
      content:
        "Breaking: Navy successfully completes maritime exercises. Our territorial waters remain secure. #NationalDefense",
      postType: "original",
      likeCount: 891,
      repostCount: 234,
      replyCount: 56,
      impressions: 45000,
      hashtags: JSON.stringify(["NationalDefense"]),
      ixTimeTimestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isAutoGenerated: true,
    },
    {
      accountId: account.id,
      content:
        "Healthcare reform update: Universal coverage expansion has reached 3 of 5 target regions ahead of schedule. Rural healthcare initiative continues to make strong progress. #HealthcareForAll",
      postType: "original",
      likeCount: 567,
      repostCount: 145,
      replyCount: 89,
      impressions: 28000,
      hashtags: JSON.stringify(["HealthcareForAll"]),
      ixTimeTimestamp: new Date(),
      isAutoGenerated: true,
    },
  ];

  await prisma.thinkpagesPost.createMany({ data: posts });
  count += posts.length;

  return count;
}

// ─── ThinkTank Groups ──────────────────────────────────────────────

export async function seedThinkTanks(
  prisma: Prisma,
  userId: string,
  countryName: string
): Promise<number> {
  // Guard: skip if user already has ThinkTank groups
  const existing = await (prisma as any).thinktankGroup.count({ where: { createdBy: userId } });
  if (existing > 0) return 0;

  let count = 0;
  const now = new Date();

  // ── Group 1: Economic Policy Forum ──────────────────────
  const econGroup = await (prisma as any).thinktankGroup.create({
    data: {
      name: `${countryName} Economic Policy Forum`,
      description:
        "A collaborative space for discussing economic policy, fiscal strategy, and trade agreements. Open to government advisors and policy analysts.",
      type: "public",
      category: "economics",
      tags: JSON.stringify(["economics", "fiscal-policy", "trade"]),
      memberCount: 3,
      createdBy: userId,
      isActive: true,
      settings: JSON.stringify({ allowInvites: true, moderationLevel: "standard" }),
    },
  });
  count++;

  // Members
  await (prisma as any).thinktankMember.createMany({
    data: [
      { groupId: econGroup.id, userId, role: "admin" },
      { groupId: econGroup.id, userId: "system_advisor_1", role: "moderator" },
      { groupId: econGroup.id, userId: "system_analyst_1", role: "member" },
    ],
  });
  count += 3;

  // Messages
  const econMessages = [
    {
      userId,
      content:
        "Welcome to the Economic Policy Forum. This space is designated for discussing our fiscal strategy and evaluating policy proposals before they reach the cabinet.",
      messageType: "text",
      daysAgo: 5,
    },
    {
      userId: "system_advisor_1",
      content:
        "Thank you for the invitation. I've prepared an analysis of our current trade deficit trends — the eastern export corridor shows promising growth potential if we streamline customs procedures.",
      messageType: "text",
      daysAgo: 4,
    },
    {
      userId: "system_analyst_1",
      content:
        "Agreed. Our modeling suggests that a 15% reduction in customs processing time could boost trade volume by $2.3B annually. I'll upload the detailed projections.",
      messageType: "text",
      daysAgo: 3,
    },
    {
      userId,
      content:
        "Excellent work. Let's compile this into a formal policy brief for the next cabinet meeting. Can we also factor in the impact on domestic producers?",
      messageType: "text",
      daysAgo: 2,
    },
    {
      userId: "system_advisor_1",
      content:
        "Domestic impact assessment is underway. Preliminary findings suggest small businesses would benefit from reduced compliance costs, while larger exporters gain from faster turnaround.",
      messageType: "text",
      daysAgo: 1,
    },
  ];
  for (const msg of econMessages) {
    await (prisma as any).thinktankMessage.create({
      data: {
        groupId: econGroup.id,
        userId: msg.userId,
        content: msg.content,
        messageType: msg.messageType,
        ixTimeTimestamp: new Date(now.getTime() - msg.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
    count++;
  }

  // Collaborative Doc
  await (prisma as any).collaborativeDoc.create({
    data: {
      groupId: econGroup.id,
      title: "Q2 Fiscal Strategy Brief",
      content: `# Q2 Fiscal Strategy Brief\n\n## Executive Summary\nThis brief outlines proposed fiscal adjustments for the upcoming quarter, including trade corridor optimization and domestic producer support mechanisms.\n\n## Key Recommendations\n1. Streamline eastern customs corridor processing (target: -15% processing time)\n2. Implement small business compliance cost reduction program\n3. Expand export credit facilities for mid-tier manufacturers\n\n## Expected Impact\n- Trade volume increase: $2.3B annually\n- Domestic job creation: ~4,500 positions\n- GDP growth contribution: +0.15%\n\n*Draft — pending cabinet review*`,
      version: 2,
      createdBy: userId,
      lastEditBy: "system_advisor_1",
      isPublic: false,
    },
  });
  count++;

  // ── Group 2: National Security Advisory ──────────────────
  const secGroup = await (prisma as any).thinktankGroup.create({
    data: {
      name: `${countryName} Security Advisory Council`,
      description:
        "Restricted forum for security strategy discussions, threat assessments, and defense coordination among senior officials.",
      type: "private",
      category: "security",
      tags: JSON.stringify(["security", "defense", "intelligence"]),
      memberCount: 2,
      createdBy: userId,
      isActive: true,
      settings: JSON.stringify({ allowInvites: false, moderationLevel: "strict" }),
    },
  });
  count++;

  // Members
  await (prisma as any).thinktankMember.createMany({
    data: [
      { groupId: secGroup.id, userId, role: "admin" },
      { groupId: secGroup.id, userId: "system_defense_advisor", role: "member" },
    ],
  });
  count += 2;

  // Messages
  const secMessages = [
    {
      userId,
      content:
        "This council is now active. All discussions here are classified RESTRICTED. Please observe communication protocols.",
      messageType: "text",
      daysAgo: 7,
    },
    {
      userId: "system_defense_advisor",
      content:
        "Acknowledged. I've completed the quarterly threat landscape review. Overall threat posture remains MODERATE with elevated cyber risk in the eastern sector.",
      messageType: "text",
      daysAgo: 6,
    },
    {
      userId,
      content: "Noted. What's the status of our cyber defense modernization initiative?",
      messageType: "text",
      daysAgo: 5,
    },
    {
      userId: "system_defense_advisor",
      content:
        "Phase 2 is 78% complete. New intrusion detection systems are operational in 4 of 6 critical infrastructure networks. Full deployment expected within the quarter.",
      messageType: "text",
      daysAgo: 4,
    },
  ];
  for (const msg of secMessages) {
    await (prisma as any).thinktankMessage.create({
      data: {
        groupId: secGroup.id,
        userId: msg.userId,
        content: msg.content,
        messageType: msg.messageType,
        ixTimeTimestamp: new Date(now.getTime() - msg.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
    count++;
  }

  return count;
}

// ─── ThinkShare Direct Messages ──────────────────────────────────

export async function seedThinkShareDMs(
  prisma: Prisma,
  userId: string,
  _countryName: string
): Promise<number> {
  // Guard: skip if user already has non-diplomatic conversations
  const existing = await (prisma as any).thinkshareConversation.findFirst({
    where: { type: "direct", conversationType: { not: "diplomatic" } },
    include: { participants: { where: { userId } } },
  });
  if (existing && (existing as any).participants?.length > 0) return 0;

  let count = 0;
  const now = new Date();

  // ── Conversation 1: Chief Advisor DM ──────────────────────
  const advisorConv = await (prisma as any).thinkshareConversation.create({
    data: {
      type: "direct",
      conversationType: "personal",
      name: null,
      isActive: true,
      lastActivity: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  });
  count++;

  await (prisma as any).conversationParticipant.createMany({
    data: [
      { conversationId: advisorConv.id, userId, role: "participant" },
      { conversationId: advisorConv.id, userId: "chief_advisor_npc", role: "participant" },
    ],
    skipDuplicates: true,
  });
  count += 2;

  const advisorMessages = [
    {
      senderId: "chief_advisor_npc",
      content: `Good morning. The latest polling data is in — public approval is holding steady at 64%. The healthcare initiative is polling particularly well in the northern provinces.`,
      daysAgo: 2,
      hoursOffset: 9,
    },
    {
      senderId: userId,
      content:
        "Good to hear. What about the eastern regions? They've been skeptical of the infrastructure spending.",
      daysAgo: 2,
      hoursOffset: 10,
    },
    {
      senderId: "chief_advisor_npc",
      content:
        "Eastern approval is at 52%, up from 48% last month. The announcement of the Eastport digital hub project helped. I'd recommend a follow-up visit within the next two weeks.",
      daysAgo: 2,
      hoursOffset: 10.5,
    },
    {
      senderId: userId,
      content:
        "Schedule it. Also, prepare talking points on job creation numbers — those resonate well.",
      daysAgo: 2,
      hoursOffset: 11,
    },
    {
      senderId: "chief_advisor_npc",
      content:
        "Will do. One more item — the Minister of Finance has requested a private briefing on the Q3 budget projections. Shall I schedule that for tomorrow?",
      daysAgo: 1,
      hoursOffset: 14,
    },
    {
      senderId: userId,
      content: "Yes, slot it in after the morning cabinet session.",
      daysAgo: 1,
      hoursOffset: 15,
    },
  ];
  for (const msg of advisorMessages) {
    await (prisma as any).thinkshareMessage.create({
      data: {
        conversationId: advisorConv.id,
        userId: msg.senderId,
        content: msg.content,
        messageType: "text",
        status: "READ",
        ixTimeTimestamp: new Date(
          now.getTime() - msg.daysAgo * 24 * 60 * 60 * 1000 + msg.hoursOffset * 60 * 60 * 1000
        ),
      },
    });
    count++;
  }

  // ── Conversation 2: Press Secretary DM ──────────────────────
  const pressConv = await (prisma as any).thinkshareConversation.create({
    data: {
      type: "direct",
      conversationType: "personal",
      name: null,
      isActive: true,
      lastActivity: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
  });
  count++;

  await (prisma as any).conversationParticipant.createMany({
    data: [
      { conversationId: pressConv.id, userId, role: "participant" },
      { conversationId: pressConv.id, userId: "press_secretary_npc", role: "participant" },
    ],
    skipDuplicates: true,
  });
  count += 2;

  const pressMessages = [
    {
      senderId: "press_secretary_npc",
      content: `We have three media requests pending: (1) Eastern Herald wants a statement on the infrastructure timeline, (2) National Broadcasting is requesting an interview about the trade deficit, (3) World Economic Journal wants comment on the green energy transition.`,
      daysAgo: 1,
      hoursOffset: 8,
    },
    {
      senderId: userId,
      content:
        "Accept the Eastern Herald request — tie it to the job creation numbers. Defer the trade deficit interview until after the Finance Minister's briefing. Accept the green energy piece.",
      daysAgo: 1,
      hoursOffset: 9,
    },
    {
      senderId: "press_secretary_npc",
      content:
        "Understood. I'll draft responses for your review. Also, the ThinkPages post about the healthcare expansion is trending — 28K impressions and climbing. Should we amplify it?",
      daysAgo: 1,
      hoursOffset: 9.5,
    },
    {
      senderId: userId,
      content:
        "Yes, push it. Good timing with the regional expansion announcement coming next week.",
      daysAgo: 1,
      hoursOffset: 10,
    },
  ];
  for (const msg of pressMessages) {
    await (prisma as any).thinkshareMessage.create({
      data: {
        conversationId: pressConv.id,
        userId: msg.senderId,
        content: msg.content,
        messageType: "text",
        status: "READ",
        ixTimeTimestamp: new Date(
          now.getTime() - msg.daysAgo * 24 * 60 * 60 * 1000 + msg.hoursOffset * 60 * 60 * 1000
        ),
      },
    });
    count++;
  }

  return count;
}

// ═══════════════════════════════════════════════════════════════════
// NEW: Fallback seeders for 1:1 economic models + government tree
// ═══════════════════════════════════════════════════════════════════

// ─── Demographics ──────────────────────────────────────────────────

export async function seedDemographics(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.demographics.create({
    data: {
      countryId,
      ageDistribution: JSON.stringify({
        "0-14": 18.2,
        "15-24": 12.8,
        "25-54": 40.1,
        "55-64": 13.5,
        "65+": 15.4,
      }),
      regions: JSON.stringify({
        "Capital Region": 28,
        "Northern Province": 18,
        "Eastern Territories": 15,
        "Western District": 14,
        "Southern Coast": 13,
        "Central Highlands": 12,
      }),
      educationLevels: JSON.stringify({
        "No formal education": 2,
        Primary: 8,
        Secondary: 35,
        Vocational: 15,
        "Bachelor's": 25,
        Graduate: 12,
        Doctorate: 3,
      }),
      citizenshipStatuses: JSON.stringify({
        Citizens: 92,
        "Permanent Residents": 5,
        "Temporary Residents": 2,
        Other: 1,
      }),
      birthRate: 11.2,
      deathRate: 7.8,
      migrationRate: 2.1,
      dependencyRatio: 52.3,
      medianAge: 38.5,
      populationGrowthProjection: 0.45,
      ethnicDiversity: 62,
      religiousDiversity: 55,
      linguisticDiversity: 35,
      culturalDiversity: 58,
    },
  });
  return 1;
}

// ─── EconomicProfile ──────────────────────────────────────────────

export async function seedEconomicProfile(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.economicProfile.create({
    data: {
      countryId,
      gdpGrowthVolatility: 1.8,
      economicComplexity: 72,
      innovationIndex: 65,
      competitivenessRank: 28,
      easeOfDoingBusiness: 32,
      corruptionIndex: 35,
      sectorBreakdown: JSON.stringify({
        Agriculture: 3.2,
        "Mining & Resources": 5.1,
        Manufacturing: 18.5,
        Construction: 6.8,
        "Wholesale & Retail": 12.3,
        Transportation: 4.9,
        "Information Technology": 8.7,
        "Finance & Insurance": 9.2,
        "Real Estate": 7.4,
        Education: 5.8,
        Healthcare: 7.3,
        Government: 6.1,
        "Other Services": 4.7,
      }),
      exportsGDPPercent: 28.5,
      importsGDPPercent: 26.1,
      tradeBalance: 2.4,
    },
  });
  return 1;
}

// ─── LaborMarket ──────────────────────────────────────────────────

export async function seedLaborMarket(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.laborMarket.create({
    data: {
      countryId,
      employmentBySector: JSON.stringify({
        Agriculture: 4.5,
        Industry: 22.3,
        Services: 58.7,
        Government: 8.2,
        Construction: 6.3,
      }),
      youthUnemploymentRate: 12.8,
      femaleParticipationRate: 62.5,
      informalEmploymentRate: 8.2,
      medianWage: 42000,
      wageGrowthRate: 2.8,
      wageBySector: JSON.stringify({
        Agriculture: 28000,
        Industry: 45000,
        Services: 48000,
        Government: 52000,
        Technology: 72000,
        Finance: 68000,
        Healthcare: 55000,
        Education: 44000,
      }),
    },
  });
  return 1;
}

// ─── FiscalSystem ──────────────────────────────────────────────────

export async function seedFiscalSystem(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.fiscalSystem.create({
    data: {
      countryId,
      personalIncomeTaxRates: JSON.stringify([
        { bracket: "0-15,000", rate: 0 },
        { bracket: "15,001-45,000", rate: 15 },
        { bracket: "45,001-120,000", rate: 25 },
        { bracket: "120,001-250,000", rate: 33 },
        { bracket: "250,001+", rate: 39 },
      ]),
      corporateTaxRates: JSON.stringify([
        { type: "Standard", rate: 21 },
        { type: "Small Business (<$500K)", rate: 15 },
        { type: "Capital Gains", rate: 18 },
      ]),
      salesTaxRate: 8.5,
      propertyTaxRate: 1.2,
      payrollTaxRate: 7.65,
      exciseTaxRates: JSON.stringify({
        Tobacco: 45,
        Alcohol: 25,
        Fuel: 18,
        "Luxury Goods": 12,
      }),
      wealthTaxRate: 0,
      spendingByCategory: JSON.stringify({
        Healthcare: 22,
        Defense: 15,
        Education: 14,
        "Social Security": 18,
        Infrastructure: 8,
        "Public Safety": 6,
        "Science & Technology": 4,
        "Debt Service": 7,
        Other: 6,
      }),
      fiscalBalanceGDPPercent: -2.8,
      primaryBalanceGDPPercent: -1.1,
      taxEfficiency: 78,
    },
  });
  return 1;
}

// ─── IncomeDistribution ──────────────────────────────────────────

export async function seedIncomeDistribution(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.incomeDistribution.create({
    data: {
      countryId,
      economicClasses: JSON.stringify({
        "Upper Class (>$200K)": 8,
        "Upper Middle ($100K-$200K)": 18,
        "Middle Class ($50K-$100K)": 32,
        "Lower Middle ($25K-$50K)": 25,
        "Working Class ($15K-$25K)": 12,
        "Below Poverty (<$15K)": 5,
      }),
      top10PercentWealth: 48.5,
      bottom50PercentWealth: 8.2,
      middleClassPercent: 50,
      intergenerationalMobility: 62,
      educationMobility: 68,
    },
  });
  return 1;
}

// ─── GovernmentBudget ──────────────────────────────────────────────

export async function seedGovernmentBudget(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.governmentBudget.create({
    data: {
      countryId,
      spendingCategories: JSON.stringify({
        Healthcare: 22,
        Defense: 15,
        Education: 14,
        "Social Security": 18,
        Infrastructure: 8,
        "Public Safety": 6,
        "Science & Technology": 4,
        "Debt Service": 7,
        Other: 6,
      }),
      spendingEfficiency: 72,
      publicInvestmentRate: 4.5,
      socialSpendingPercent: 54,
    },
  });
  return 1;
}

// ─── DefenseBudget ──────────────────────────────────────────────────

export async function seedDefenseBudget(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.defenseBudget.create({
    data: {
      countryId,
      fiscalYear: new Date().getFullYear(),
      totalBudget: 26500000000,
      gdpPercent: 3.2,
      perCapita: 850,
      personnelCosts: 10600000000,
      operationsMaintenance: 6625000000,
      procurement: 5300000000,
      rdteCosts: 2650000000,
      militaryConstruction: 1325000000,
    },
  });
  return 1;
}

// ─── SecurityAssessment ──────────────────────────────────────────

export async function seedSecurityAssessment(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.securityAssessment.create({
    data: {
      countryId,
      overallSecurityScore: 72,
      securityLevel: "elevated",
      securityTrend: "stable",
      militaryStrength: 75,
      internalStability: 68,
      borderSecurity: 70,
      cybersecurity: 62,
      counterTerrorism: 65,
      militaryReadiness: 78,
      emergencyResponse: 71,
      disasterPreparedness: 64,
      activeThreatCount: 3,
      highSeverityThreats: 1,
    },
  });
  return 1;
}

// ─── AtomicEffectiveness ──────────────────────────────────────────

export async function seedAtomicEffectiveness(prisma: Prisma, countryId: string): Promise<number> {
  await prisma.atomicEffectiveness.create({
    data: {
      countryId,
      overallScore: 68,
      taxEffectiveness: 72,
      economicPolicyScore: 65,
      stabilityScore: 70,
      legitimacyScore: 74,
      componentCount: 6,
      synergyBonus: 4.5,
      conflictPenalty: 1.2,
    },
  });
  return 1;
}

// ─── NationalIdentity ──────────────────────────────────────────────

export async function seedNationalIdentity(
  prisma: Prisma,
  countryId: string,
  countryName: string
): Promise<number> {
  await prisma.nationalIdentity.create({
    data: {
      countryId,
      countryName,
      officialName: `Republic of ${countryName}`,
      governmentType: "Federal Republic",
      motto: "Unity, Progress, Prosperity",
      capitalCity: "Nova Capita",
      largestCity: "Nova Capita",
      demonym: `${countryName}n`,
      currency: "National Dollar",
      currencySymbol: "$",
      officialLanguages: JSON.stringify(["Common", "National Language"]),
      nationalAnthem: "Glory to the Republic",
      nationalDay: "Independence Day - March 15",
      callingCode: "+1",
      internetTLD: ".nc",
      drivingSide: "right",
      timeZone: "UTC+0",
      emergencyNumber: "911",
      nationalSport: "Football",
      weekStartDay: "Monday",
    },
  });
  return 1;
}

// ─── Government Tree ──────────────────────────────────────────────

export async function seedGovernmentTree(
  prisma: Prisma,
  countryId: string,
  governmentStructureId: string
): Promise<number> {
  let count = 0;

  const departments = [
    {
      name: "Ministry of Finance",
      shortName: "MoF",
      category: "economic",
      minister: "Alexandra Petrova",
      color: "#059669",
      priority: 10,
      description: "Responsible for fiscal policy, taxation, and public finance management.",
      icon: "💰",
    },
    {
      name: "Ministry of Defense",
      shortName: "MoD",
      category: "defense",
      minister: "General Marcus Thorne",
      color: "#dc2626",
      priority: 20,
      description: "National defense, military operations, and strategic security.",
      icon: "🛡️",
    },
    {
      name: "Ministry of Foreign Affairs",
      shortName: "MFA",
      category: "diplomacy",
      minister: "Isabella Fontaine",
      color: "#2563eb",
      priority: 30,
      description: "International relations, diplomatic missions, and foreign policy.",
      icon: "🌐",
    },
    {
      name: "Ministry of Health",
      shortName: "MoH",
      category: "social",
      minister: "Dr. Samuel Chen",
      color: "#7c3aed",
      priority: 40,
      description: "Public health, hospitals, and healthcare regulation.",
      icon: "🏥",
    },
    {
      name: "Ministry of Education",
      shortName: "MoE",
      category: "social",
      minister: "Prof. Maria Santos",
      color: "#0891b2",
      priority: 50,
      description: "Education policy, schools, universities, and research funding.",
      icon: "🎓",
    },
    {
      name: "Ministry of Infrastructure",
      shortName: "MoI",
      category: "infrastructure",
      minister: "Viktor Andersen",
      color: "#d97706",
      priority: 60,
      description: "Transportation, utilities, and public infrastructure projects.",
      icon: "🏗️",
    },
    {
      name: "Ministry of Justice",
      shortName: "MoJ",
      category: "governance",
      minister: "Justice Elena Varga",
      color: "#4f46e5",
      priority: 70,
      description: "Law enforcement, courts, and the judicial system.",
      icon: "⚖️",
    },
    {
      name: "Ministry of Commerce",
      shortName: "MoC",
      category: "economic",
      minister: "Robert Kingsley",
      color: "#0d9488",
      priority: 80,
      description: "Trade, industry regulation, and economic development.",
      icon: "📊",
    },
  ];

  const deptIds: string[] = [];
  for (const dept of departments) {
    const created = await prisma.governmentDepartment.create({
      data: { governmentStructureId, ...dept },
    });
    deptIds.push(created.id);
    count++;
  }

  // Add officials for first 4 departments
  const officials = [
    {
      governmentStructureId,
      departmentId: deptIds[0],
      name: "Alexandra Petrova",
      title: "Minister of Finance",
      role: "minister",
      bio: "Former central bank governor with 20 years of fiscal policy experience.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[0],
      name: "Thomas Richter",
      title: "Deputy Minister of Finance",
      role: "deputy_minister",
      bio: "Tax reform specialist and public finance expert.",
      priority: 20,
    },
    {
      governmentStructureId,
      departmentId: deptIds[1],
      name: "General Marcus Thorne",
      title: "Minister of Defense",
      role: "minister",
      bio: "Distinguished military career spanning 30 years. Former Joint Chiefs chairman.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[2],
      name: "Isabella Fontaine",
      title: "Minister of Foreign Affairs",
      role: "minister",
      bio: "Career diplomat with ambassadorial experience in 4 nations.",
      priority: 10,
    },
    {
      governmentStructureId,
      departmentId: deptIds[3],
      name: "Dr. Samuel Chen",
      title: "Minister of Health",
      role: "minister",
      bio: "Leading epidemiologist and public health policy architect.",
      priority: 10,
    },
  ];
  for (const official of officials) {
    await (prisma as any).governmentOfficial.create({ data: official });
    count++;
  }

  // Budget allocations for each department
  const budgetYear = new Date().getFullYear();
  const budgets = [
    { departmentId: deptIds[0]!, allocatedAmount: 85000000000, allocatedPercent: 22 },
    { departmentId: deptIds[1]!, allocatedAmount: 58000000000, allocatedPercent: 15 },
    { departmentId: deptIds[2]!, allocatedAmount: 12000000000, allocatedPercent: 3 },
    { departmentId: deptIds[3]!, allocatedAmount: 78000000000, allocatedPercent: 20 },
    { departmentId: deptIds[4]!, allocatedAmount: 54000000000, allocatedPercent: 14 },
    { departmentId: deptIds[5]!, allocatedAmount: 31000000000, allocatedPercent: 8 },
    { departmentId: deptIds[6]!, allocatedAmount: 23000000000, allocatedPercent: 6 },
    { departmentId: deptIds[7]!, allocatedAmount: 19000000000, allocatedPercent: 5 },
  ];
  for (const budget of budgets) {
    await (prisma as any).budgetAllocation.create({
      data: { governmentStructureId, budgetYear, budgetStatus: "Allocated", ...budget },
    });
    count++;
  }

  // Revenue sources
  const revenueSources = [
    {
      name: "Personal Income Tax",
      category: "direct_tax",
      rate: 25,
      revenueAmount: 120000000000,
      revenuePercent: 38,
    },
    {
      name: "Corporate Tax",
      category: "direct_tax",
      rate: 21,
      revenueAmount: 65000000000,
      revenuePercent: 21,
    },
    {
      name: "Sales Tax / VAT",
      category: "indirect_tax",
      rate: 8.5,
      revenueAmount: 52000000000,
      revenuePercent: 16,
    },
    {
      name: "Payroll Tax",
      category: "direct_tax",
      rate: 7.65,
      revenueAmount: 42000000000,
      revenuePercent: 13,
    },
    {
      name: "Property Tax",
      category: "direct_tax",
      rate: 1.2,
      revenueAmount: 18000000000,
      revenuePercent: 6,
    },
    {
      name: "Excise Duties",
      category: "indirect_tax",
      rate: null,
      revenueAmount: 12000000000,
      revenuePercent: 4,
    },
    {
      name: "Other Revenue",
      category: "non_tax",
      rate: null,
      revenueAmount: 6000000000,
      revenuePercent: 2,
    },
  ];
  for (const rev of revenueSources) {
    await (prisma as any).revenueSource.create({
      data: { governmentStructureId, isActive: true, ...rev },
    });
    count++;
  }

  return count;
}

// ─── Government / Economic / Tax Components ──────────────────────

export async function seedGovernmentComponents(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  const govComponents = [
    { componentType: "CENTRALIZED_POWER", effectivenessScore: 72 },
    { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 68 },
    { componentType: "INDEPENDENT_JUDICIARY", effectivenessScore: 75 },
    { componentType: "PROFESSIONAL_BUREAUCRACY", effectivenessScore: 70 },
    { componentType: "ELECTORAL_LEGITIMACY", effectivenessScore: 65 },
  ];

  const govCompIds: string[] = [];
  for (const comp of govComponents) {
    const created = await prisma.governmentComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    govCompIds.push(created.id);
    count++;
  }

  // Add synergies between complementary components
  if (govCompIds.length >= 3) {
    await prisma.componentSynergy.create({
      data: {
        countryId,
        primaryComponentId: govCompIds[0]!,
        secondaryComponentId: govCompIds[2]!,
        synergyType: "checks_and_balances",
        effectMultiplier: 1.15,
        description: "Executive-Judicial checks and balances improve governance quality.",
      },
    });
    count++;
  }

  // Economic components
  const econComponents = [
    { componentType: "MIXED_ECONOMY", effectivenessScore: 74 },
    { componentType: "EXPORT_ORIENTED", effectivenessScore: 68 },
    { componentType: "SERVICE_BASED", effectivenessScore: 62 },
  ];
  for (const comp of econComponents) {
    await prisma.economicComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    count++;
  }

  // Tax components
  const taxComponents = [
    { componentType: "PROGRESSIVE_TAX", effectivenessScore: 71 },
    { componentType: "CORPORATE_TAX", effectivenessScore: 66 },
    { componentType: "SALES_TAX", effectivenessScore: 78 },
  ];
  for (const comp of taxComponents) {
    await prisma.taxComponent.create({
      data: { countryId, isActive: true, ...comp } as any,
    });
    count++;
  }

  return count;
}

// ─── Tax Tree ──────────────────────────────────────────────────────

export async function seedTaxTree(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  // TaxSystem (1:1)
  const taxSystem = await prisma.taxSystem.create({
    data: {
      countryId,
      taxSystemName: "National Revenue Service",
      taxAuthority: "Department of Revenue",
      fiscalYear: "calendar",
      progressiveTax: true,
      complianceRate: 92,
      collectionEfficiency: 87,
    },
  });
  count++;

  // TaxCategory: Personal Income
  const incomeCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Personal Income Tax",
      categoryType: "income",
      description: "Progressive tax on individual earned and investment income.",
      isActive: true,
      baseRate: 25,
      calculationMethod: "progressive",
      deductionAllowed: true,
      standardDeduction: 15000,
      priority: 10,
      color: "#059669",
    },
  });
  count++;

  // Income tax brackets
  const brackets = [
    { bracketName: "Exempt", minIncome: 0, maxIncome: 15000, rate: 0, priority: 10 },
    { bracketName: "Low", minIncome: 15001, maxIncome: 45000, rate: 15, priority: 20 },
    { bracketName: "Middle", minIncome: 45001, maxIncome: 120000, rate: 25, priority: 30 },
    { bracketName: "Upper", minIncome: 120001, maxIncome: 250000, rate: 33, priority: 40 },
    { bracketName: "Top", minIncome: 250001, maxIncome: null, rate: 39, priority: 50 },
  ];
  for (const bracket of brackets) {
    await prisma.taxBracket.create({
      data: {
        taxSystemId: taxSystem.id,
        categoryId: incomeCat.id,
        marginalRate: true,
        isActive: true,
        ...bracket,
      },
    });
    count++;
  }

  // TaxCategory: Corporate
  const corpCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Corporate Tax",
      categoryType: "corporate",
      description: "Tax on business profits and corporate income.",
      isActive: true,
      baseRate: 21,
      calculationMethod: "flat",
      deductionAllowed: true,
      priority: 20,
      color: "#2563eb",
    },
  });
  count++;

  await prisma.taxBracket.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryId: corpCat.id,
      bracketName: "Standard Rate",
      minIncome: 0,
      rate: 21,
      marginalRate: false,
      isActive: true,
      priority: 10,
    },
  });
  count++;

  // TaxCategory: Sales
  const salesCat = await prisma.taxCategory.create({
    data: {
      taxSystemId: taxSystem.id,
      categoryName: "Sales Tax / VAT",
      categoryType: "consumption",
      description: "Tax on goods and services at point of sale.",
      isActive: true,
      baseRate: 8.5,
      calculationMethod: "percentage",
      deductionAllowed: false,
      priority: 30,
      color: "#d97706",
    },
  });
  count++;

  // Exemptions
  const exemptions = [
    {
      exemptionName: "Standard Personal Deduction",
      exemptionType: "personal",
      description: "Base income exempt from taxation.",
      exemptionAmount: 15000,
    },
    {
      exemptionName: "Charitable Donations",
      exemptionType: "deduction",
      description: "Deduction for verified charitable contributions.",
      exemptionRate: 100,
    },
    {
      exemptionName: "Medical Expenses",
      exemptionType: "deduction",
      description: "Deduction for out-of-pocket medical costs exceeding 7.5% of income.",
      exemptionRate: 100,
    },
  ];
  for (const ex of exemptions) {
    await prisma.taxExemption.create({
      data: { taxSystemId: taxSystem.id, categoryId: incomeCat.id, isActive: true, ...ex },
    });
    count++;
  }

  // TaxDeductions — Personal Income
  const personalDeductions = [
    {
      categoryId: incomeCat.id,
      deductionName: "Charitable Donations",
      deductionType: "charitable",
      description: "Deduction for verified charitable contributions.",
      percentage: 100,
      isActive: true,
      priority: 10,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Mortgage Interest",
      deductionType: "housing",
      description: "Deduction for primary residence mortgage interest.",
      maximumAmount: 750000,
      isActive: true,
      priority: 20,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Medical Expenses",
      deductionType: "medical",
      description: "Deduction for out-of-pocket medical costs exceeding 7.5% of income.",
      percentage: 100,
      isActive: true,
      priority: 30,
    },
    {
      categoryId: incomeCat.id,
      deductionName: "Education Expenses",
      deductionType: "education",
      description: "Deduction for qualifying tuition and educational materials.",
      maximumAmount: 10000,
      isActive: true,
      priority: 40,
    },
  ];
  await prisma.taxDeduction.createMany({ data: personalDeductions });
  count += personalDeductions.length;

  // TaxDeductions — Corporate
  const corporateDeductions = [
    {
      categoryId: corpCat.id,
      deductionName: "Business Expenses",
      deductionType: "operational",
      description: "Standard deduction for legitimate business operating costs.",
      percentage: 100,
      isActive: true,
      priority: 10,
    },
    {
      categoryId: corpCat.id,
      deductionName: "R&D Tax Credit",
      deductionType: "research",
      description: "Tax credit for qualifying research and development expenditures.",
      percentage: 20,
      isActive: true,
      priority: 20,
    },
  ];
  await prisma.taxDeduction.createMany({ data: corporateDeductions });
  count += corporateDeductions.length;

  // Tax policies
  await prisma.taxPolicy.create({
    data: {
      taxSystemId: taxSystem.id,
      policyName: "Small Business Relief Act",
      policyType: "rate_reduction",
      description: "Reduced corporate tax rate for small businesses with revenue under $500K.",
      targetCategory: "corporate",
      impactType: "revenue_decrease",
      rateChange: -6,
      effectiveDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      isActive: true,
      estimatedRevenue: -2500000000,
      affectedPopulation: 15,
    },
  });
  count++;

  return count;
}

// ─── Cross-Builder Synergies ────────────────────────────────────────

export async function seedCrossBuilderSynergy(prisma: Prisma, countryId: string): Promise<number> {
  const synergies = [
    {
      countryId,
      governmentComponents: JSON.stringify(["DEMOCRATIC_PROCESS", "INDEPENDENT_JUDICIARY"]),
      economicComponents: JSON.stringify(["MIXED_ECONOMY"]),
      taxComponents: JSON.stringify(["PROGRESSIVE_TAX"]),
      synergyType: "governance_economic",
      effectivenessBonus: 8.5,
      description:
        "Balanced Governance — democratic institutions paired with mixed-market economics and progressive taxation create a stable, high-performing economy.",
      isActive: true,
    },
    {
      countryId,
      governmentComponents: JSON.stringify(["REGULATORY_FRAMEWORK"]),
      economicComponents: JSON.stringify(["EXPORT_ORIENTED"]),
      taxComponents: JSON.stringify(["CORPORATE_TAX"]),
      synergyType: "market_reform",
      effectivenessBonus: 6.0,
      description:
        "Market-Oriented Reform — streamlined regulations with export focus and competitive corporate taxation boost trade competitiveness.",
      isActive: true,
    },
  ];

  await prisma.crossBuilderSynergy.createMany({ data: synergies });
  return synergies.length;
}

// ─── Border Security ──────────────────────────────────────────────

export async function seedBorderSecurity(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;

  const border = await prisma.borderSecurity.create({
    data: {
      countryId,
      overallSecurityLevel: 72,
      securityStatus: "moderate",
      borderIntegrity: 82,
      borderLength: 4250,
      landBorders: 3,
      maritimeBorders: 2,
      borderAgents: 12500,
      checkpoints: 45,
      surveillanceSystems: 128,
      interceptionRate: 68,
      processingEfficiency: 74,
      illegalCrossings: 1200,
      smugglingActivity: 22,
      traffickingRisk: 15,
      refugeePresure: 18,
      technologyLevel: 65,
      infrastructureQuality: 70,
    },
  });
  count++;

  // Neighbor threat assessments
  const neighbors = [
    {
      neighborName: "Northern Republic",
      borderType: "land",
      borderLength: 1800,
      threatLevel: "low",
      threatScore: 18,
      militaryThreat: 12,
      terrorismRisk: 8,
      smugglingRisk: 22,
      politicalStability: 72,
      diplomaticRelations: "friendly",
      tradeVolume: 15000000000,
    },
    {
      neighborName: "Eastern Federation",
      borderType: "land",
      borderLength: 1450,
      threatLevel: "moderate",
      threatScore: 42,
      militaryThreat: 35,
      terrorismRisk: 18,
      smugglingRisk: 38,
      politicalStability: 52,
      diplomaticRelations: "neutral",
      tradeVolume: 8000000000,
    },
    {
      neighborName: "Southern Islands",
      borderType: "maritime",
      borderLength: 1000,
      threatLevel: "low",
      threatScore: 15,
      militaryThreat: 8,
      terrorismRisk: 5,
      smugglingRisk: 28,
      politicalStability: 78,
      diplomaticRelations: "allied",
      tradeVolume: 22000000000,
    },
  ];
  for (const neighbor of neighbors) {
    await prisma.neighborThreatAssessment.create({
      data: { borderSecurityId: border.id, ...neighbor } as any,
    });
    count++;
  }

  return count;
}

// ─── Secure Diplomatic Channels ──────────────────────────────────────

/**
 * Seed realistic diplomatic channel threads into ThinkshareConversation.
 * Uses already-seeded embassies/alliances as partners so everything feels connected.
 * Safe to call multiple times — only runs if no diplomatic conversations exist yet.
 */
export async function seedSecureChannels(
  prisma: Prisma,
  demoCountryId: string,
  countryName: string
): Promise<number> {
  // Guard: skip if already seeded
  const existingChannels = await (prisma as any).thinkshareConversation.findFirst({
    where: { conversationType: "diplomatic" },
    include: { participants: { where: { userId: demoCountryId } } },
  });
  if (existingChannels && (existingChannels as any).participants.length > 0) return 0;

  // ── Collect partner countries ──────────────────────────────────────
  const embassies = await (prisma.embassy as any).findMany({
    where: { OR: [{ guestCountryId: demoCountryId }, { hostCountryId: demoCountryId }] },
    include: {
      guestCountry: { select: { id: true, name: true } },
      hostCountry: { select: { id: true, name: true } },
    },
    take: 4,
  });

  const embassyPartners: { id: string; name: string }[] = embassies.map((e: any) =>
    e.guestCountryId === demoCountryId
      ? { id: e.hostCountryId, name: e.hostCountry.name }
      : { id: e.guestCountryId, name: e.guestCountry.name }
  );

  const ownMemberships = await prisma.allianceMember.findMany({
    where: { countryId: demoCountryId },
    select: { allianceId: true },
  });
  const allianceIds = ownMemberships.map((m) => m.allianceId);
  const otherMembers =
    allianceIds.length > 0
      ? await prisma.allianceMember.findMany({
          where: { allianceId: { in: allianceIds }, countryId: { not: demoCountryId } },
          include: { country: { select: { id: true, name: true } } },
          take: 3,
        })
      : [];
  const alliancePartners = otherMembers.map((m: any) => ({
    id: m.countryId,
    name: m.country.name,
  }));

  // Fallback: use any real countries if no embassies seeded yet
  const partners: { id: string; name: string }[] =
    embassyPartners.length > 0
      ? embassyPartners
      : await prisma.country.findMany({
          where: { id: { not: demoCountryId }, isDemo: false },
          select: { id: true, name: true },
          take: 4,
        });

  if (partners.length === 0) return 0;

  let count = 0;
  const now = new Date();

  // ── Helper: create a full channel with participants and messages ──
  async function createChannel(
    convData: {
      name: string;
      channelType: string;
      diplomaticClassification: string;
      encrypted: boolean;
      lastActivity: Date;
    },
    participantIds: string[],
    messages: {
      senderId: string;
      content: string;
      classification: string;
      subject: string;
      priority?: string;
      timestamp: Date;
    }[]
  ): Promise<void> {
    const conv = await (prisma as any).thinkshareConversation.create({
      data: {
        type: "group",
        conversationType: "diplomatic",
        name: convData.name,
        channelType: convData.channelType,
        diplomaticClassification: convData.diplomaticClassification,
        encrypted: convData.encrypted,
        lastActivity: convData.lastActivity,
        isActive: true,
      },
    });
    count++;

    await (prisma as any).conversationParticipant.createMany({
      data: participantIds.map((uid) => ({
        conversationId: conv.id,
        userId: uid,
        isActive: true,
        role: uid === demoCountryId ? "admin" : "participant",
      })),
      skipDuplicates: true,
    });
    count += participantIds.length;

    for (const msg of messages) {
      await (prisma as any).thinkshareMessage.create({
        data: {
          conversationId: conv.id,
          userId: msg.senderId,
          content: msg.content,
          classification: msg.classification,
          subject: msg.subject,
          priority: msg.priority ?? "NORMAL",
          status: "DELIVERED",
          ixTimeTimestamp: msg.timestamp,
        },
      });
      count++;
    }
  }

  // ── Channel 1: Trade & Diplomacy (CONFIDENTIAL, BILATERAL) ────────
  const partner0 = partners[0]!;
  await createChannel(
    {
      name: `${countryName} — ${partner0.name} Diplomatic Channel`,
      channelType: "BILATERAL",
      diplomaticClassification: "CONFIDENTIAL",
      encrypted: false,
      lastActivity: new Date(now.getTime() - 30 * 60 * 1000),
    },
    [demoCountryId, partner0.id],
    [
      {
        senderId: partner0.id,
        content: `[CONFIDENTIAL] Greetings from ${partner0.name}. We wish to discuss the progress of our ongoing trade framework and bilateral agreements.`,
        classification: "CONFIDENTIAL",
        subject: "Trade Framework Review",
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },
      {
        senderId: demoCountryId,
        content: `We acknowledge your communication. Our delegation confirms readiness to advance the trade negotiations outlined in our recent Foreign Policy accord.`,
        classification: "CONFIDENTIAL",
        subject: "Re: Trade Framework Review",
        timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        senderId: partner0.id,
        content: `We propose a joint review of tariff schedules for the coming fiscal year. Please advise on your preferred timeline.`,
        classification: "CONFIDENTIAL",
        subject: "Tariff Schedule Proposal",
        timestamp: new Date(now.getTime() - 90 * 60 * 1000),
      },
      {
        senderId: demoCountryId,
        content: `Concurred. We will arrange for our trade envoys to convene within the next quarter. Further details to follow via secure communiqué.`,
        classification: "CONFIDENTIAL",
        subject: "Re: Tariff Schedule Proposal",
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
      },
    ]
  );

  // ── Channel 2: Security Coordination (SECRET, BILATERAL) ──────────
  const partner1 = partners[1] ?? partners[0]!;
  await createChannel(
    {
      name: `${countryName} — ${partner1.name} Security Channel`,
      channelType: "BILATERAL",
      diplomaticClassification: "SECRET",
      encrypted: true,
      lastActivity: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    [demoCountryId, partner1.id],
    [
      {
        senderId: demoCountryId,
        content: `[SECRET] This channel is designated for security coordination between our nations. Encryption protocols are active.`,
        classification: "SECRET",
        subject: "Channel Establishment",
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
      {
        senderId: partner1.id,
        content: `Confirmed. We have reviewed the joint readiness assessment. Our positions remain aligned with the strategic framework established at our last summit.`,
        classification: "SECRET",
        subject: "Re: Channel Establishment",
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },
      {
        senderId: demoCountryId,
        content: `Acknowledged. Standing by for further directives. All transmissions are to be considered classified at SECRET level.`,
        classification: "SECRET",
        subject: "Acknowledgement",
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    ]
  );

  // ── Channel 3: Alliance Forum (RESTRICTED, MULTILATERAL) ──────────
  const forumPartners = alliancePartners.length > 0 ? alliancePartners : partners.slice(0, 3);
  if (forumPartners.length > 0) {
    const forumParticipantIds = [demoCountryId, ...forumPartners.slice(0, 3).map((p) => p.id)];
    const firstAlly = forumPartners[0]!;
    await createChannel(
      {
        name: `Alliance Coordination Forum — ${countryName}`,
        channelType: "MULTILATERAL",
        diplomaticClassification: "RESTRICTED",
        encrypted: false,
        lastActivity: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      forumParticipantIds,
      [
        {
          senderId: demoCountryId,
          content: `[RESTRICTED] Welcome to the Alliance Coordination Forum. This channel facilitates multilateral communication between member states.`,
          classification: "RESTRICTED",
          subject: "Forum Established",
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          senderId: firstAlly.id,
          content: `Thank you for establishing this channel. We propose a standing agenda for quarterly coordination reviews.`,
          classification: "RESTRICTED",
          subject: "Re: Forum Established",
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          senderId: demoCountryId,
          content: `Motion carried. First coordination session will address collective security posture and economic cooperation targets.`,
          classification: "RESTRICTED",
          subject: "First Session Agenda",
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      ]
    );
  }

  // ── Channel 4: Emergency Protocol (TOP_SECRET, EMERGENCY) ─────────
  await createChannel(
    {
      name: `EMERGENCY CHANNEL — ${countryName}`,
      channelType: "EMERGENCY",
      diplomaticClassification: "TOP_SECRET",
      encrypted: true,
      lastActivity: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
    [demoCountryId, partner0.id],
    [
      {
        senderId: demoCountryId,
        content: `[TOP SECRET] EMERGENCY PROTOCOL ACTIVATED. This channel is reserved for diplomatic crises requiring immediate bilateral response. Respond to confirm secure receipt.`,
        classification: "TOP_SECRET",
        subject: "EMERGENCY PROTOCOL",
        priority: "URGENT",
        timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
      },
      {
        senderId: partner0.id,
        content: `[TOP SECRET] Secure receipt confirmed. Standing by. Emergency coordination procedures acknowledged and ready to activate.`,
        classification: "TOP_SECRET",
        subject: "Re: EMERGENCY PROTOCOL",
        priority: "URGENT",
        timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
      },
    ]
  );

  return count;
}

// ─── Country Field Defaults ─────────────────────────────────────────
// The MyCountry UI reads many fields directly from the Country model.
// After cloning, any NULL fields must be filled so tabs aren't blank.

/**
 * Fill NULL economic/labor/government/demographics fields on the Country record.
 * Only updates fields that are currently NULL — never overwrites existing data.
 */
export async function populateCountryFields(prisma: Prisma, countryId: string): Promise<void> {
  const country = await prisma.country.findUnique({ where: { id: countryId } });
  if (!country) return;

  // Build an update object with only the NULL fields
  const updates: Record<string, number | string> = {};

  // Derive sensible defaults from existing non-null core fields
  const pop = country.currentPopulation || country.baselinePopulation || 50_000_000;
  const gdpPc = country.currentGdpPerCapita || country.baselineGdpPerCapita || 35_000;
  const totalGdp = pop * gdpPc;

  // ─── Core economic indicators ───
  if (country.nominalGDP == null) updates.nominalGDP = totalGdp;
  if (country.realGDPGrowthRate == null) updates.realGDPGrowthRate = 2.8;
  if (country.inflationRate == null) updates.inflationRate = 2.1;
  if (country.currencyExchangeRate == null) updates.currencyExchangeRate = 1.0;
  if (country.actualGdpGrowth === 0) updates.actualGdpGrowth = 2.8;

  // ─── Labor market ───
  if (country.unemploymentRate == null) updates.unemploymentRate = 5.2;
  if (country.employmentRate == null) updates.employmentRate = 94.8;
  if (country.laborForceParticipationRate == null) updates.laborForceParticipationRate = 64.5;
  if (country.totalWorkforce == null) updates.totalWorkforce = Math.round(pop * 0.45);
  if (country.averageWorkweekHours == null) updates.averageWorkweekHours = 38.5;
  if (country.minimumWage == null) updates.minimumWage = Math.round(gdpPc * 0.35);
  if (country.averageAnnualIncome == null) updates.averageAnnualIncome = Math.round(gdpPc * 0.85);

  // ─── Fiscal / government spending ───
  if (country.taxRevenueGDPPercent == null) updates.taxRevenueGDPPercent = 22.5;
  if (country.governmentRevenueTotal == null)
    updates.governmentRevenueTotal = Math.round(totalGdp * 0.225);
  if (country.taxRevenuePerCapita == null) updates.taxRevenuePerCapita = Math.round(gdpPc * 0.225);
  if (country.governmentBudgetGDPPercent == null) updates.governmentBudgetGDPPercent = 28.0;
  if (country.budgetDeficitSurplus == null) updates.budgetDeficitSurplus = -2.5;
  if (country.totalGovernmentSpending == null)
    updates.totalGovernmentSpending = Math.round(totalGdp * 0.28);
  if (country.spendingGDPPercent == null) updates.spendingGDPPercent = 28.0;
  if (country.spendingPerCapita == null) updates.spendingPerCapita = Math.round(gdpPc * 0.28);

  // ─── Debt ───
  if (country.totalDebtGDPRatio == null) updates.totalDebtGDPRatio = 62.0;
  if (country.internalDebtGDPPercent == null) updates.internalDebtGDPPercent = 45.0;
  if (country.externalDebtGDPPercent == null) updates.externalDebtGDPPercent = 17.0;
  if (country.debtPerCapita == null) updates.debtPerCapita = Math.round(gdpPc * 0.62);
  if (country.interestRates == null) updates.interestRates = 3.5;
  if (country.debtServiceCosts == null) updates.debtServiceCosts = Math.round(totalGdp * 0.025);

  // ─── Demographics / social ───
  if (country.lifeExpectancy == null) updates.lifeExpectancy = 78.5;
  if (country.urbanPopulationPercent == null) updates.urbanPopulationPercent = 68.0;
  if (country.ruralPopulationPercent == null) updates.ruralPopulationPercent = 32.0;
  if (country.literacyRate == null) updates.literacyRate = 96.5;
  if (country.povertyRate == null) updates.povertyRate = 8.5;
  if (country.incomeInequalityGini == null) updates.incomeInequalityGini = 0.34;
  if (country.socialMobilityIndex == null) updates.socialMobilityIndex = 65.0;

  // ─── Density (derived) ───
  if (country.populationDensity == null && country.landArea) {
    updates.populationDensity = Math.round(pop / country.landArea);
  }
  if (country.gdpDensity == null && country.landArea) {
    updates.gdpDensity = Math.round(totalGdp / country.landArea);
  }

  // ─── Vitality scores (if all zero) ───
  if (country.economicVitality === 0) updates.economicVitality = 68.0;
  if (country.populationWellbeing === 0) updates.populationWellbeing = 72.0;
  if (country.diplomaticStanding === 0) updates.diplomaticStanding = 65.0;
  if (country.governmentalEfficiency === 0) updates.governmentalEfficiency = 70.0;
  if (country.overallNationalHealth === 0) updates.overallNationalHealth = 69.0;
  if (country.infrastructureRating === 50) updates.infrastructureRating = 72.0;
  if (country.tradeBalance === 0) updates.tradeBalance = Math.round(totalGdp * 0.02);

  // Only issue the update if there are fields to fill
  if (Object.keys(updates).length > 0) {
    await prisma.country.update({
      where: { id: countryId },
      data: updates,
    });
  }
}

// ─── NPC Personality Assignment ─────────────────────────────────────

export async function seedNPCPersonality(prisma: Prisma, countryId: string): Promise<number> {
  // Check if already assigned
  const existing = await prisma.nPCPersonalityAssignment
    .findUnique({
      where: { countryId },
    })
    .catch(() => null);
  if (existing) return 0;

  // Find the least-used active personality
  const personality = await (prisma as any).nPCPersonality
    .findFirst({
      where: { isActive: true },
      orderBy: { usageCount: "asc" },
    })
    .catch(() => null);
  if (!personality) return 0; // No personalities in DB

  await prisma.nPCPersonalityAssignment.create({
    data: {
      personalityId: personality.id,
      countryId,
      assignedBy: "demo_seed",
      reason: "Auto-assigned for demo mode",
      driftHistory: JSON.stringify([]),
    },
  });

  // Increment usage count
  await (prisma as any).nPCPersonality
    .update({
      where: { id: personality.id },
      data: { usageCount: { increment: 1 } },
    })
    .catch(() => null);

  return 1;
}

// ─── Internal Stability Metrics ─────────────────────────────────────

export async function seedInternalStabilityMetrics(
  prisma: Prisma,
  countryId: string
): Promise<number> {
  const existing = await prisma.internalStabilityMetrics
    .findUnique({
      where: { countryId },
    })
    .catch(() => null);
  if (existing) return 0;

  await prisma.internalStabilityMetrics.create({
    data: {
      countryId,
      stabilityScore: 72,
      stabilityTrend: "stable",
      crimeRate: 5.2,
      violentCrimeRate: 1.8,
      propertyCrimeRate: 8.5,
      organizedCrimeLevel: 3.2,
      policingEffectiveness: 65,
      justiceSystemEfficiency: 58,
      protestFrequency: 4,
      riotRisk: 8,
      civilDisobedience: 3,
      socialCohesion: 72,
      ethnicTension: 15,
      politicalPolarization: 35,
      trustInGovernment: 55,
      trustInPolice: 60,
      fearOfCrime: 28,
    },
  });
  return 1;
}

// ─── Security Threats ───────────────────────────────────────────────

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
  const now = new Date();

  // Incident data keyed by threat type
  const incidentsByType: Record<
    string,
    Array<{
      title: string;
      description: string;
      incidentType: string;
      casualties: number;
      damage: number;
      location: string;
      effectiveness: number;
      daysAgo: number;
    }>
  > = {
    organized_crime: [
      {
        title: "Smuggling Interdiction — Eastern Border",
        description:
          "Customs agents intercepted a convoy transporting undeclared goods across the eastern border checkpoint.",
        incidentType: "interdiction",
        casualties: 0,
        damage: 0,
        location: "Eastern Border Checkpoint 7",
        effectiveness: 85,
        daysAgo: 14,
      },
      {
        title: "Money Laundering Probe Initiated",
        description:
          "Financial intelligence unit flagged suspicious transaction patterns linked to known criminal networks.",
        incidentType: "investigation",
        casualties: 0,
        damage: 0,
        location: "National Financial Center",
        effectiveness: 60,
        daysAgo: 5,
      },
    ],
    cyber: [
      {
        title: "Phishing Campaign Detected",
        description:
          "Coordinated phishing attack targeting government email systems. 12 compromised accounts identified and secured.",
        incidentType: "attack",
        casualties: 0,
        damage: 250000,
        location: "Government IT Infrastructure",
        effectiveness: 72,
        daysAgo: 3,
      },
    ],
    insurgency: [
      {
        title: "Border Patrol Encounter",
        description:
          "Routine patrol encountered and dispersed a small group operating near the southern border. No casualties.",
        incidentType: "encounter",
        casualties: 0,
        damage: 5000,
        location: "Southern Province — Sector 12",
        effectiveness: 90,
        daysAgo: 21,
      },
    ],
  };

  for (const threat of threats) {
    const created = await prisma.securityThreat.create({ data: threat });
    count++;

    const incidents = incidentsByType[threat.threatType] ?? [];
    for (const inc of incidents) {
      await prisma.threatIncident.create({
        data: {
          threatId: created.id,
          title: inc.title,
          description: inc.description,
          incidentType: inc.incidentType,
          casualties: inc.casualties,
          damage: inc.damage,
          location: inc.location,
          effectiveness: inc.effectiveness,
          occurredAt: new Date(now.getTime() - inc.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
      count++;
    }
  }
  return count;
}

// ─── Geography (Territories, Subdivisions, Cities) ──────────────────

export async function seedGeography(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;
  const emptyGeom = { type: "Polygon", coordinates: [] };

  // Territories
  await prisma.territory.createMany({
    data: [
      { countryId, name: "Mainland", geometry: emptyGeom, isMainland: true, areaSqKm: 320000 },
      {
        countryId,
        name: "Southern Islands",
        geometry: emptyGeom,
        isMainland: false,
        areaSqKm: 15000,
      },
    ],
  });
  count += 2;

  // Subdivisions (6 provinces)
  const subdivisionData = [
    { name: "Capital Region", population: 14000000, capital: "Nova Capita", areaSqKm: 28000 },
    { name: "Northern Province", population: 9000000, capital: "Northgate", areaSqKm: 72000 },
    { name: "Eastern Territories", population: 7500000, capital: "Eastport", areaSqKm: 65000 },
    { name: "Western District", population: 7000000, capital: "Westholm", areaSqKm: 58000 },
    { name: "Southern Coast", population: 6500000, capital: "Southhaven", areaSqKm: 55000 },
    { name: "Central Highlands", population: 6000000, capital: "Highlands City", areaSqKm: 57000 },
  ];

  const subIds: string[] = [];
  for (const sub of subdivisionData) {
    const created = await prisma.subdivision.create({
      data: {
        countryId,
        name: sub.name,
        type: "province",
        geometry: emptyGeom,
        level: 1,
        population: sub.population,
        capital: sub.capital,
        areaSqKm: sub.areaSqKm,
        status: "approved",
        submittedBy: "system",
      },
    });
    subIds.push(created.id);
    count++;
  }

  // Cities (capital + 3 major cities)
  const cities = [
    {
      name: "Nova Capita",
      type: "capital",
      subdivisionId: subIds[0],
      population: 4200000,
      isNationalCapital: true,
      isSubdivisionCapital: true,
    },
    {
      name: "Northgate",
      type: "city",
      subdivisionId: subIds[1],
      population: 1800000,
      isNationalCapital: false,
      isSubdivisionCapital: true,
    },
    {
      name: "Eastport",
      type: "city",
      subdivisionId: subIds[2],
      population: 1500000,
      isNationalCapital: false,
      isSubdivisionCapital: true,
    },
    {
      name: "Southhaven",
      type: "port_city",
      subdivisionId: subIds[4],
      population: 1200000,
      isNationalCapital: false,
      isSubdivisionCapital: true,
    },
  ];
  for (const city of cities) {
    await prisma.city.create({
      data: {
        countryId,
        name: city.name,
        type: city.type,
        coordinates: { lat: 45.0, lng: 20.0 },
        population: city.population,
        isNationalCapital: city.isNationalCapital,
        isSubdivisionCapital: city.isSubdivisionCapital,
        subdivisionId: city.subdivisionId,
        status: "approved",
        submittedBy: "system",
      },
    });
    count++;
  }

  // Points of Interest (linked to capital subdivision)
  const pois = [
    {
      name: "National Parliament",
      category: "government",
      coordinates: { lat: 45.01, lng: 20.01 },
      description: "Seat of the national legislature and primary government complex.",
    },
    {
      name: "Central Reserve Bank",
      category: "financial",
      coordinates: { lat: 45.02, lng: 19.98 },
      description: "National central banking authority and monetary policy headquarters.",
    },
    {
      name: "National History Museum",
      category: "cultural",
      coordinates: { lat: 44.99, lng: 20.03 },
      description: "Premier cultural institution housing national heritage collections.",
    },
    {
      name: "Nova Capita International Airport",
      category: "infrastructure",
      coordinates: { lat: 45.08, lng: 20.15 },
      description: "Primary international gateway serving the capital region.",
    },
  ];
  for (const poi of pois) {
    await prisma.pointOfInterest.create({
      data: {
        countryId,
        subdivisionId: subIds[0], // Capital Region
        name: poi.name,
        category: poi.category,
        coordinates: poi.coordinates,
        description: poi.description,
        status: "approved",
        submittedBy: "system",
      },
    });
    count++;
  }

  return count;
}

// ─── History (VitalityHistory, HistoricalDataPoint, ComponentEffectivenessHistory)

export async function seedHistory(prisma: Prisma, countryId: string): Promise<number> {
  let count = 0;
  const now = new Date();

  // VitalityHistory: 30 days with sine-wave oscillation
  const vitalityRecords = [];
  for (let i = 29; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const phase = (30 - i) / 30;
    const wave = Math.sin(phase * Math.PI * 2) * 3;
    // Deterministic noise based on day index
    const noise = (idx: number) => Math.sin(idx * 7.3) * 1.5;
    vitalityRecords.push({
      countryId,
      economicVitality: 65 + wave + noise(i) + phase * 5,
      populationWellbeing: 70 + wave * 0.8 + noise(i + 1),
      diplomaticStanding: 62 + wave * 1.2 + noise(i + 2),
      governmentalEfficiency: 68 + wave * 0.6 + noise(i + 3),
      overallHealth: 66 + wave * 0.9 + noise(i + 4) + phase * 3,
      timestamp,
    });
  }
  await prisma.vitalityHistory.createMany({ data: vitalityRecords });
  count += vitalityRecords.length;

  // HistoricalDataPoint: 30 days derived from country data
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { currentPopulation: true, currentGdpPerCapita: true, landArea: true },
  });
  const basePop = country?.currentPopulation ?? 50000000;
  const baseGdpPc = country?.currentGdpPerCapita ?? 35000;
  const landArea = country?.landArea ?? 335000;

  const historicalRecords = [];
  for (let i = 29; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayFactor = (30 - i) / 30;
    const pop = basePop * (0.998 + dayFactor * 0.004);
    const gdpPc = baseGdpPc * (0.995 + dayFactor * 0.01);
    historicalRecords.push({
      countryId,
      ixTimeTimestamp: timestamp,
      population: pop,
      gdpPerCapita: gdpPc,
      totalGdp: pop * gdpPc,
      populationGrowthRate: 0.3 + Math.sin(i * 2.1) * 0.15,
      gdpGrowthRate: 2.5 + Math.sin(i * 1.7) * 0.8,
      landArea,
      populationDensity: pop / landArea,
      gdpDensity: (pop * gdpPc) / landArea,
    });
  }
  await prisma.historicalDataPoint.createMany({ data: historicalRecords });
  count += historicalRecords.length;

  // ComponentEffectivenessHistory: 30 days per active government component
  const govComponents = await prisma.governmentComponent
    .findMany({
      where: { countryId, isActive: true },
      select: { id: true, componentType: true, effectivenessScore: true },
    })
    .catch(() => []);

  if (govComponents.length > 0) {
    const compHistRecords = [];
    for (const comp of govComponents) {
      for (let i = 29; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const baseScore = comp.effectivenessScore ?? 65;
        const drift = Math.sin((30 - i) / 10) * 3 + Math.sin(i * 3.7) * 1.5;
        compHistRecords.push({
          countryId,
          componentId: comp.id,
          componentType: String(comp.componentType),
          effectivenessScore: Math.max(0, Math.min(100, baseScore + drift)),
          timestamp,
        });
      }
    }
    await prisma.componentEffectivenessHistory.createMany({ data: compHistRecords });
    count += compHistRecords.length;
  }

  return count;
}

// ─── Activity Feed ──────────────────────────────────────────────────

export async function seedActivityFeed(
  prisma: Prisma,
  countryId: string,
  userId: string
): Promise<number> {
  const now = new Date();

  const activities = [
    {
      type: "economic_report",
      category: "economic",
      title: "GDP Report Published",
      description: "Quarterly GDP figures released showing continued growth across key sectors.",
      priority: "low" as const,
    },
    {
      type: "diplomatic_event",
      category: "diplomatic",
      title: "New Embassy Established",
      description: "Diplomatic mission opened in allied nation, expanding the diplomatic network.",
      priority: "medium" as const,
    },
    {
      type: "military_update",
      category: "military",
      title: "Naval Exercise Completed",
      description: "Joint maritime exercise concluded successfully with allied forces.",
      priority: "medium" as const,
    },
    {
      type: "policy_enacted",
      category: "political",
      title: "Infrastructure Act Signed",
      description: "National Digital Infrastructure Act signed into law by the executive.",
      priority: "high" as const,
    },
    {
      type: "social_milestone",
      category: "social",
      title: "Education Reform Milestone",
      description: "University enrollment reaches all-time high following education subsidies.",
      priority: "low" as const,
    },
    {
      type: "achievement_unlocked",
      category: "achievement",
      title: "Economic Powerhouse",
      description: "Nation GDP surpassed major milestone, earning Economic Powerhouse achievement.",
      priority: "medium" as const,
    },
    {
      type: "election_result",
      category: "political",
      title: "General Election Results",
      description: "National Unity Party secured parliamentary majority in general election.",
      priority: "high" as const,
    },
    {
      type: "trade_agreement",
      category: "economic",
      title: "Free Trade Agreement Signed",
      description: "Bilateral free trade agreement ratified, reducing tariffs on key exports.",
      priority: "medium" as const,
    },
    {
      type: "crisis_response",
      category: "military",
      title: "Flood Relief Operation",
      description: "Military deployed for disaster relief in eastern provinces.",
      priority: "high" as const,
    },
    {
      type: "intelligence_alert",
      category: "security",
      title: "Cyber Threat Detected",
      description: "Intelligence services identified and blocked sophisticated cyber attack.",
      priority: "high" as const,
    },
    {
      type: "diplomatic_meeting",
      category: "diplomatic",
      title: "Alliance Summit Concluded",
      description: "Strategic Defense Pact annual summit agreed on joint security framework.",
      priority: "medium" as const,
    },
    {
      type: "economic_indicator",
      category: "economic",
      title: "Trade Surplus Recorded",
      description: "Monthly trade data shows surplus for third consecutive month.",
      priority: "low" as const,
    },
    {
      type: "government_action",
      category: "political",
      title: "Cabinet Reshuffle",
      description: "Minor cabinet changes announced to strengthen economic policy team.",
      priority: "medium" as const,
    },
    {
      type: "military_drill",
      category: "military",
      title: "Air Defense Drill",
      description: "National air defense exercise tested response readiness across all regions.",
      priority: "low" as const,
    },
    {
      type: "social_event",
      category: "social",
      title: "Cultural Festival Opens",
      description: "International Arts Festival attracting participants from 12 nations.",
      priority: "low" as const,
    },
    {
      type: "health_update",
      category: "social",
      title: "Healthcare Expansion",
      description: "Rural healthcare initiative expanded to cover 2 additional provinces.",
      priority: "medium" as const,
    },
    {
      type: "budget_report",
      category: "economic",
      title: "Budget Surplus Announced",
      description: "Fiscal year ended with modest budget surplus, reducing national debt ratio.",
      priority: "medium" as const,
    },
    {
      type: "diplomatic_incident",
      category: "diplomatic",
      title: "Trade Vessel Released",
      description: "Detained cargo vessel released following diplomatic negotiations.",
      priority: "low" as const,
    },
    {
      type: "security_update",
      category: "security",
      title: "Border Security Enhanced",
      description: "New surveillance systems deployed along eastern border region.",
      priority: "medium" as const,
    },
    {
      type: "national_issue",
      category: "political",
      title: "Immigration Reform Debate",
      description: "Parliamentary debate on immigration reform package enters second reading.",
      priority: "medium" as const,
    },
  ];

  const records = activities.map((activity, i) => {
    const daysAgo = Math.floor((i / activities.length) * 30);
    const hoursOffset = (i * 7) % 12;
    return {
      ...activity,
      userId,
      countryId,
      likes: (i * 13 + 7) % 50,
      views: ((i * 37 + 50) % 500) + 50,
      createdAt: new Date(
        now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursOffset * 60 * 60 * 1000
      ),
    };
  });

  await prisma.activityFeed.createMany({ data: records });
  return records.length;
}

// ─── Achievements ───────────────────────────────────────────────────

export async function seedAchievements(prisma: Prisma, userId: string): Promise<number> {
  const now = new Date();

  const achievements = [
    {
      achievementId: "econ-first-million",
      title: "First Million",
      description: "Country GDP reached $1M",
      category: "Economic",
      rarity: "Common",
      daysAgo: 25,
    },
    {
      achievementId: "econ-millionaire-nation",
      title: "Millionaire Nation",
      description: "GDP per capita exceeded $10,000",
      category: "Economic",
      rarity: "Uncommon",
      daysAgo: 20,
    },
    {
      achievementId: "econ-economic-powerhouse",
      title: "Economic Powerhouse",
      description: "GDP exceeded $1 Trillion",
      category: "Economic",
      rarity: "Rare",
      daysAgo: 15,
    },
    {
      achievementId: "econ-growth-rocket",
      title: "Growth Rocket",
      description: "Achieved 5%+ GDP growth rate",
      category: "Economic",
      rarity: "Uncommon",
      daysAgo: 12,
    },
    {
      achievementId: "mil-first-branch",
      title: "Armed & Ready",
      description: "Established first military branch",
      category: "Military",
      rarity: "Common",
      daysAgo: 18,
    },
    {
      achievementId: "mil-armed-forces",
      title: "Armed Forces",
      description: "Two military branches operational",
      category: "Military",
      rarity: "Uncommon",
      daysAgo: 14,
    },
    {
      achievementId: "dip-first-embassy",
      title: "First Embassy",
      description: "Established first diplomatic embassy",
      category: "Diplomatic",
      rarity: "Common",
      daysAgo: 22,
    },
    {
      achievementId: "dip-diplomatic-network",
      title: "Diplomatic Network",
      description: "Three or more active embassies",
      category: "Diplomatic",
      rarity: "Uncommon",
      daysAgo: 10,
    },
    {
      achievementId: "econ-full-employment",
      title: "Full Employment",
      description: "Unemployment rate below 3%",
      category: "Economic",
      rarity: "Rare",
      daysAgo: 8,
    },
    {
      achievementId: "econ-price-stability",
      title: "Price Stability",
      description: "Inflation maintained below 2%",
      category: "Economic",
      rarity: "Uncommon",
      daysAgo: 5,
    },
  ];

  // Deduplicate against existing
  const existing = await prisma.userAchievement
    .findMany({
      where: { userId },
      select: { achievementId: true },
    })
    .catch(() => []);
  const existingIds = new Set(existing.map((e: { achievementId: string }) => e.achievementId));

  const toCreate = achievements
    .filter((a) => !existingIds.has(a.achievementId))
    .map(({ daysAgo, ...a }) => ({
      ...a,
      userId,
      unlockedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    }));

  if (toCreate.length > 0) {
    await prisma.userAchievement.createMany({ data: toCreate });
  }
  return toCreate.length;
}
