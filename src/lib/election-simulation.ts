/**
 * Election simulation core — extracted so BOTH the tRPC mutation (manual "Simulate"
 * button) and the scheduled-elections cron run the exact same logic. The cron has no
 * auth context, so this is a plain `(db, electionId)` function with no tRPC coupling;
 * the mutation does its ownership check, then delegates here.
 */
import type { PrismaClient } from "@prisma/client";
import { generateDiplomaticNews } from "./diplomatic-news-generator";
import { notificationAPI } from "./notification-api";

// ── Seat-allocation helpers (single source of truth) ──

/** D'Hondt method for proportional seat allocation. */
export function dHondtAllocation(
  partyVotes: { partyId: string; votes: number }[],
  totalSeats: number
): Map<string, number> {
  const seats = new Map<string, number>();
  partyVotes.forEach((p) => seats.set(p.partyId, 0));

  for (let i = 0; i < totalSeats; i++) {
    let maxQuotient = -1;
    let maxParty = "";
    for (const { partyId, votes } of partyVotes) {
      const currentSeats = seats.get(partyId) ?? 0;
      const quotient = votes / (currentSeats + 1);
      if (quotient > maxQuotient) {
        maxQuotient = quotient;
        maxParty = partyId;
      }
    }
    if (maxParty) seats.set(maxParty, (seats.get(maxParty) ?? 0) + 1);
  }
  return seats;
}

/** FPTP allocation: winner takes all (single-district). */
export function fptpAllocation(
  partyVotes: { partyId: string; votes: number }[],
  totalSeats: number
): Map<string, number> {
  const seats = new Map<string, number>();
  if (partyVotes.length === 0) return seats;
  const sorted = [...partyVotes].sort((a, b) => b.votes - a.votes);
  const winner = sorted[0]!;
  seats.set(winner.partyId, totalSeats);
  for (const p of partyVotes) {
    if (p.partyId !== winner.partyId) seats.set(p.partyId, 0);
  }
  return seats;
}

// Lore-first: how a chamber's members are chosen (not every legislature is party-elected).
// Stored as the 4th positional field of the serialized chamberType blob. Keep in sync with
// the copy in routers/elections/legislature.ts. See plans/mycountry-lore-alignment*.md.
export type SelectionMethod =
  | "elected"
  | "appointed"
  | "sortition"
  | "hereditary"
  | "ex-officio"
  | "corporatist";

export interface ChamberConfig {
  name: string;
  seats: number;
  electoralSystem: "proportional" | "fptp" | "mixed";
  selectionMethod: SelectionMethod;
}

export function parseChambers(
  chamberType: string,
  legislatureName: string,
  totalSeats: number,
  globalElectoralSystem: string
): ChamberConfig[] {
  if (chamberType.includes("|")) {
    const [, serialized] = chamberType.split("|");
    if (serialized) {
      const parts = serialized.split(";").filter(Boolean);
      return parts.map((part) => {
        const [name, seatsStr, system, selection] = part.split(":");
        return {
          name: name || "Chamber",
          seats: Number(seatsStr) || 100,
          electoralSystem: (system || globalElectoralSystem || "proportional") as any,
          selectionMethod: (selection || "elected") as SelectionMethod,
        };
      });
    }
  }
  const system = (globalElectoralSystem || "proportional") as any;
  if (chamberType === "bicameral") {
    const senateSeats = Math.max(10, Math.floor(totalSeats * 0.4));
    const houseSeats = Math.max(10, totalSeats - senateSeats);
    return [
      { name: "House of Representatives", seats: houseSeats, electoralSystem: system, selectionMethod: "elected" },
      { name: "Senate", seats: senateSeats, electoralSystem: system, selectionMethod: "elected" },
    ];
  }
  return [
    { name: legislatureName || "National Assembly", seats: totalSeats, electoralSystem: system, selectionMethod: "elected" },
  ];
}

export type SimulateElectionResult =
  | { ok: true; election: any }
  | { ok: false; reason: "not_found" | "insufficient_candidates" };

/**
 * Run a full election simulation: vote shares → seat allocation → results, seat
 * reassignment, political-metric updates, storyteller effect, party support,
 * auto-news + notification. Pure DB work — no auth, no throw.
 */
export async function simulateElectionCore(
  db: PrismaClient,
  electionId: string
): Promise<SimulateElectionResult> {
  const election = await db.election.findUnique({
    where: { id: electionId },
    include: {
      candidates: { include: { party: true } },
      legislature: true,
      country: true,
    },
  });

  if (!election) return { ok: false, reason: "not_found" };
  if (election.candidates.length < 2) return { ok: false, reason: "insufficient_candidates" };

  const country = election.country;
  const legislature = election.legislature;

  // Step 1: Economic performance modifier (good economy → incumbent benefits)
  const gdpGrowth = country.adjustedGdpGrowth;
  const economicModifier =
    gdpGrowth > 0 ? Math.min(gdpGrowth * 100, 10) : Math.max(gdpGrowth * 150, -15);

  // Step 2: Per-party vote shares
  const partyVotes: { partyId: string; votes: number; candidateId: string }[] = [];
  for (const candidate of election.candidates) {
    const party = candidate.party;
    let support = party.currentSupport;
    const isFirstParty = election.candidates.indexOf(candidate) === 0;
    if (isFirstParty) support += economicModifier;
    else support -= economicModifier * 0.5;
    const charismaSwing = (candidate.charisma - 50) / 10;
    support += charismaSwing;
    const randomSwing = (Math.random() - 0.5) * 15;
    support += randomSwing;
    support = Math.max(1, Math.min(99, support));
    partyVotes.push({
      partyId: party.id,
      candidateId: candidate.id,
      votes: Math.round(support * 1000),
    });
  }

  const totalVotesCast = Math.floor((country?.currentPopulation || 1000000) * 0.65);
  const turnout = Math.min(95, 55 + (country?.overallNationalHealth ?? 50) * 0.3);

  // Step 3: Allocate seats per chamber
  const chambers = parseChambers(
    legislature.chamberType,
    legislature.name,
    legislature.totalSeats,
    legislature.electoralSystem
  );

  const chamberAllocations: { chamberName: string; allocation: Map<string, number> }[] = [];
  const totalSeatsWonPerParty = new Map<string, number>();

  for (const chamber of chambers) {
    let alloc: Map<string, number>;
    if (chamber.electoralSystem === "proportional") {
      alloc = dHondtAllocation(partyVotes, chamber.seats);
    } else if (chamber.electoralSystem === "fptp") {
      alloc = fptpAllocation(partyVotes, chamber.seats);
    } else {
      const propSeats = Math.floor(chamber.seats / 2);
      const fptpSeats = chamber.seats - propSeats;
      const propAlloc = dHondtAllocation(partyVotes, propSeats);
      const fptpAlloc = fptpAllocation(partyVotes, fptpSeats);
      alloc = new Map<string, number>();
      for (const [pid, s] of propAlloc) alloc.set(pid, s + (fptpAlloc.get(pid) ?? 0));
    }
    chamberAllocations.push({ chamberName: chamber.name, allocation: alloc });
    for (const [partyId, seatsWon] of alloc) {
      totalSeatsWonPerParty.set(partyId, (totalSeatsWonPerParty.get(partyId) ?? 0) + seatsWon);
    }
  }

  // Step 4: ElectionResult records
  const results: {
    partyId: string;
    candidateId: string;
    votePercentage: number;
    seatsWon: number;
  }[] = [];
  const totalRawVotes = partyVotes.reduce((s, x) => s + x.votes, 0);
  for (const pv of partyVotes) {
    const pctOfTotal = (pv.votes / totalRawVotes) * 100;
    const seatsWon = totalSeatsWonPerParty.get(pv.partyId) ?? 0;
    await db.electionResult.create({
      data: {
        electionId: election.id,
        candidateId: pv.candidateId,
        votesReceived: Math.round((pctOfTotal / 100) * totalVotesCast),
        votePercentage: Math.round(pctOfTotal * 100) / 100,
        seatsWon,
      },
    });
    results.push({
      partyId: pv.partyId,
      candidateId: pv.candidateId,
      votePercentage: Math.round(pctOfTotal * 100) / 100,
      seatsWon,
    });
  }

  // Step 5: Reassign LegislativeSeat rows per chamber
  const allSeats = await db.legislativeSeat.findMany({
    where: { legislatureId: legislature.id },
    orderBy: { seatNumber: "asc" },
  });
  const updatedSeatIds = new Set<string>();
  let seatOffset = 0;

  for (const { chamberName, allocation } of chamberAllocations) {
    let chamberSeats = allSeats.filter((s) => s.region === chamberName);
    if (chamberSeats.length === 0) {
      const chamberConfig = chambers.find((c) => c.name === chamberName);
      const numSeats = chamberConfig ? chamberConfig.seats : 0;
      chamberSeats = allSeats.slice(seatOffset, seatOffset + numSeats);
      seatOffset += numSeats;
    }
    const sortedChamberParties = [...allocation.entries()].sort((a, b) => b[1] - a[1]);
    let chamberSeatIdx = 0;
    for (const [partyId, seatsWon] of sortedChamberParties) {
      for (let i = 0; i < seatsWon; i++) {
        if (chamberSeatIdx < chamberSeats.length) {
          const seat = chamberSeats[chamberSeatIdx]!;
          await db.legislativeSeat.update({
            where: { id: seat.id },
            data: { partyId, region: chamberName },
          });
          updatedSeatIds.add(seat.id);
          chamberSeatIdx++;
        }
      }
    }
    while (chamberSeatIdx < chamberSeats.length) {
      const seat = chamberSeats[chamberSeatIdx]!;
      await db.legislativeSeat.update({
        where: { id: seat.id },
        data: { partyId: null, region: chamberName },
      });
      updatedSeatIds.add(seat.id);
      chamberSeatIdx++;
    }
  }

  const unassignedSeats = allSeats.filter((s) => !updatedSeatIds.has(s.id));
  for (const seat of unassignedSeats) {
    await db.legislativeSeat.update({ where: { id: seat.id }, data: { partyId: null } });
  }

  // Step 6: Margin of victory
  const sortedResults = [...results].sort(
    (a, b) =>
      (totalSeatsWonPerParty.get(b.partyId) ?? 0) - (totalSeatsWonPerParty.get(a.partyId) ?? 0)
  );
  const marginOfVictory =
    sortedResults.length >= 2
      ? sortedResults[0]!.votePercentage - sortedResults[1]!.votePercentage
      : 100;

  // Step 7: Election status
  await db.election.update({
    where: { id: election.id },
    data: {
      status: "completed",
      turnout: Math.round(turnout * 10) / 10,
      totalVotes: totalVotesCast,
      marginOfVictory: Math.round(marginOfVictory * 100) / 100,
    },
  });

  // Step 8: Political metrics
  const govStructure = await db.governmentStructure.findUnique({
    where: { countryId: election.countryId },
  });
  if (govStructure) {
    let stabilityDelta = 0;
    if (marginOfVictory > 15) stabilityDelta = 0.05;
    else if (marginOfVictory > 5) stabilityDelta = 0.02;
    else if (marginOfVictory > 2) stabilityDelta = -0.05;
    else stabilityDelta = -0.1;

    const newStability = Math.max(
      0,
      Math.min(1, (govStructure.politicalStability ?? 0.5) + stabilityDelta)
    );
    const newDemocracy = Math.min(100, (govStructure.democracyIndex ?? 50) + 2);

    await db.governmentStructure.update({
      where: { countryId: election.countryId },
      data: {
        politicalStability: newStability,
        democracyIndex: newDemocracy,
        politicalMetricsUpdated: new Date(),
      },
    });
  }

  // Step 9: Storyteller effect for economic impact
  const growthModifier = marginOfVictory > 10 ? 0.003 : marginOfVictory > 5 ? 0.001 : -0.003;
  await db.storytellerEffect.create({
    data: {
      countryId: election.countryId,
      ixTimeTimestamp: new Date(),
      inputType: "economic_policy",
      value: growthModifier,
      duration: legislature.termLength,
      description: `Election result: ${marginOfVictory > 10 ? "Decisive victory" : marginOfVictory > 5 ? "Clear win" : "Close election"} - ${sortedResults[0]?.votePercentage.toFixed(1)}% to ${sortedResults[1]?.votePercentage.toFixed(1)}%`,
      isActive: true,
      createdBy: "ELECTION_SYSTEM",
    },
  });

  // Step 10: Party support reflects results
  for (const r of results) {
    await db.politicalParty.update({
      where: { id: r.partyId },
      data: { currentSupport: r.votePercentage },
    });
  }

  // Step 11: Auto-news + notification
  const topResult = [...results].sort((a, b) => b.seatsWon - a.seatsWon)[0];
  if (topResult) {
    const winnerParty = election.candidates.find((c) => c.id === topResult.candidateId);
    const countryRow = await db.country.findUnique({
      where: { id: election.countryId },
      select: { name: true },
    });
    void generateDiplomaticNews(db, election.countryId, "election_result", {
      countryName: countryRow?.name ?? "Unknown",
      partyName: winnerParty?.party?.name ?? "Leading party",
      seats: topResult.seatsWon,
      percentage: topResult.votePercentage.toFixed(1),
    });
    try {
      await notificationAPI.create({
        title: "Election Results",
        message: `${winnerParty?.party?.name ?? "Leading party"} wins with ${topResult.seatsWon} seats (${topResult.votePercentage.toFixed(1)}%). Turnout: ${turnout.toFixed(1)}%`,
        countryId: election.countryId,
        category: "governance",
        priority: "high",
        type: "success",
        source: "elections",
        href: "/mycountry/politics",
        actionable: true,
        metadata: {
          electionId: election.id,
          winnerParty: winnerParty?.party?.name,
          seatsWon: topResult.seatsWon,
          marginOfVictory,
          turnout,
        },
      });
    } catch (e) {
      console.warn("[Notifications] simulateElectionCore:", e);
    }
  }

  const finalElection = await db.election.findUnique({
    where: { id: election.id },
    include: {
      candidates: { include: { party: true } },
      results: {
        include: { candidate: { include: { party: true } } },
        orderBy: { seatsWon: "desc" },
      },
      legislature: {
        include: { seats: { include: { party: true }, orderBy: { seatNumber: "asc" } } },
      },
    },
  });

  return { ok: true, election: finalElection };
}
