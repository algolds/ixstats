/**
 * Demo seed for government, cabinet, policies, elections, departments, and taxation.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../../ixtime";
import fallbackGov from "../../../../data/seed/fallback-government.json";

type Prisma = PrismaClient;

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
                  ? "declined"
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
