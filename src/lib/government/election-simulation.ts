/**
 * Election simulation core — extracted so BOTH the tRPC mutation (manual "Simulate"
 * button) and the scheduled-elections cron run the exact same logic. The cron has no
 * auth context, so this is a plain `(db, electionId)` function with no tRPC coupling;
 * the mutation does its ownership check, then delegates here.
 */
import type { PrismaClient } from "@prisma/client";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { notificationAPI } from "~/lib/notifications";

// ── Seat-allocation helpers (single source of truth) ──

/** D'Hondt method for proportional seat allocation. */
function dHondtAllocation(
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
function fptpAllocation(
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
// Stored as the 4th positional field of the serialized chamberType blob.
// See plans/mycountry-lore-alignment*.md.
type SelectionMethod =
  "elected" | "appointed" | "sortition" | "hereditary" | "ex-officio" | "corporatist";

type ElectoralSystem = "proportional" | "fptp" | "mixed";

interface ChamberConfig {
  name: string;
  seats: number;
  electoralSystem: ElectoralSystem;
  selectionMethod: SelectionMethod;
}

function toElectoralSystem(val?: string): ElectoralSystem {
  if (val === "fptp" || val === "mixed" || val === "proportional") return val;
  return "proportional";
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
          electoralSystem: toElectoralSystem(system || globalElectoralSystem),
          selectionMethod: (selection || "elected") as SelectionMethod,
        };
      });
    }
  }
  const system = toElectoralSystem(globalElectoralSystem);
  if (chamberType === "bicameral") {
    const senateSeats = Math.max(10, Math.floor(totalSeats * 0.4));
    const houseSeats = Math.max(10, totalSeats - senateSeats);
    return [
      {
        name: "House of Representatives",
        seats: houseSeats,
        electoralSystem: system,
        selectionMethod: "elected",
      },
      { name: "Senate", seats: senateSeats, electoralSystem: system, selectionMethod: "elected" },
    ];
  }
  return [
    {
      name: legislatureName || "National Assembly",
      seats: totalSeats,
      electoralSystem: system,
      selectionMethod: "elected",
    },
  ];
}

type SimulateElectionResult =
  { ok: true; election: any } | { ok: false; reason: "not_found" | "insufficient_candidates" };

type PartyVote = { partyId: string; votes: number; candidateId: string };
type ChamberAllocation = { chamberName: string; allocation: Map<string, number> };

/** The seat-holding party with the most seats (none before a first election) and the economy's swing for it. */
function incumbentAndEconomy(
  seats: Array<{ partyId: string | null }>,
  gdpGrowth: number
): { incumbentPartyId: string | null; economicModifier: number } {
  const seatsHeld = new Map<string, number>();
  for (const seat of seats) {
    if (seat.partyId) seatsHeld.set(seat.partyId, (seatsHeld.get(seat.partyId) ?? 0) + 1);
  }
  return {
    incumbentPartyId: [...seatsHeld.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    // Good economy: up to +10 for the incumbent; bad economy: down to -15
    economicModifier:
      gdpGrowth > 0 ? Math.min(gdpGrowth * 100, 10) : Math.max(gdpGrowth * 150, -15),
  };
}

/** Per-party vote totals: current support, incumbent/economy swing, candidate charisma and noise. */
function computePartyVotes(
  candidates: Array<{
    id: string;
    charisma: number;
    party: { id: string; currentSupport: number };
  }>,
  incumbentPartyId: string | null,
  economicModifier: number
): PartyVote[] {
  return candidates.map((candidate) => {
    const { party } = candidate;
    let support = party.currentSupport;
    if (incumbentPartyId) {
      support += party.id === incumbentPartyId ? economicModifier : -economicModifier * 0.5;
    }
    support += (candidate.charisma - 50) / 10; // charisma swing
    support += (Math.random() - 0.5) * 15; // random swing
    support = Math.max(1, Math.min(99, support));
    return { partyId: party.id, candidateId: candidate.id, votes: Math.round(support * 1000) };
  });
}

function allocateChamber(chamber: ChamberConfig, partyVotes: PartyVote[]): Map<string, number> {
  if (chamber.electoralSystem === "proportional")
    return dHondtAllocation(partyVotes, chamber.seats);
  if (chamber.electoralSystem === "fptp") return fptpAllocation(partyVotes, chamber.seats);

  // Mixed: half proportional, half first-past-the-post
  const propSeats = Math.floor(chamber.seats / 2);
  const propAlloc = dHondtAllocation(partyVotes, propSeats);
  const fptpAlloc = fptpAllocation(partyVotes, chamber.seats - propSeats);
  const alloc = new Map<string, number>();
  for (const [partyId, seats] of propAlloc)
    alloc.set(partyId, seats + (fptpAlloc.get(partyId) ?? 0));
  return alloc;
}

/** Persists one ElectionResult per party and returns the vote shares and seats won. */
async function recordResults(
  db: PrismaClient,
  electionId: string,
  partyVotes: PartyVote[],
  seatsWonPerParty: Map<string, number>,
  totalVotesCast: number
) {
  const results: {
    partyId: string;
    candidateId: string;
    votePercentage: number;
    seatsWon: number;
  }[] = [];
  const totalRawVotes = partyVotes.reduce((sum, x) => sum + x.votes, 0);
  for (const pv of partyVotes) {
    const pctOfTotal = (pv.votes / totalRawVotes) * 100;
    const votePercentage = Math.round(pctOfTotal * 100) / 100;
    const seatsWon = seatsWonPerParty.get(pv.partyId) ?? 0;
    await db.electionResult.create({
      data: {
        electionId,
        candidateId: pv.candidateId,
        votesReceived: Math.round((pctOfTotal / 100) * totalVotesCast),
        votePercentage,
        seatsWon,
      },
    });
    results.push({ partyId: pv.partyId, candidateId: pv.candidateId, votePercentage, seatsWon });
  }
  return results;
}

/** Hands each chamber's seats to the winning parties (largest first); leftover seats go vacant. */
async function reassignSeats(
  db: PrismaClient,
  legislatureId: string,
  chambers: ChamberConfig[],
  allocations: ChamberAllocation[]
) {
  const allSeats = await db.legislativeSeat.findMany({
    where: { legislatureId },
    orderBy: { seatNumber: "asc" },
  });
  const updatedSeatIds = new Set<string>();
  let seatOffset = 0;

  for (const { chamberName, allocation } of allocations) {
    let chamberSeats = allSeats.filter((s) => s.region === chamberName);
    if (chamberSeats.length === 0) {
      const numSeats = chambers.find((c) => c.name === chamberName)?.seats ?? 0;
      chamberSeats = allSeats.slice(seatOffset, seatOffset + numSeats);
      seatOffset += numSeats;
    }

    // One partyId per seat, in order of seats won; vacant (null) for the rest
    const assignments: Array<string | null> = [...allocation.entries()]
      .sort((a, b) => b[1] - a[1])
      .flatMap(([partyId, seatsWon]) => Array<string | null>(seatsWon).fill(partyId));
    for (const [i, seat] of chamberSeats.entries()) {
      await db.legislativeSeat.update({
        where: { id: seat.id },
        data: { partyId: assignments[i] ?? null, region: chamberName },
      });
      updatedSeatIds.add(seat.id);
    }
  }

  for (const seat of allSeats.filter((s) => !updatedSeatIds.has(s.id))) {
    await db.legislativeSeat.update({ where: { id: seat.id }, data: { partyId: null } });
  }
}

/** A comfortable win steadies the government; a razor-thin one shakes it. Democracy index +2. */
async function updatePoliticalMetrics(
  db: PrismaClient,
  countryId: string,
  marginOfVictory: number
) {
  const govStructure = await db.governmentStructure.findUnique({ where: { countryId } });
  if (!govStructure) return;

  const stabilityDelta =
    marginOfVictory > 15 ? 0.05 : marginOfVictory > 5 ? 0.02 : marginOfVictory > 2 ? -0.05 : -0.1;
  await db.governmentStructure.update({
    where: { countryId },
    data: {
      politicalStability: Math.max(
        0,
        Math.min(1, (govStructure.politicalStability ?? 0.5) + stabilityDelta)
      ),
      democracyIndex: Math.min(100, (govStructure.democracyIndex ?? 50) + 2),
      politicalMetricsUpdated: new Date(),
    },
  });
}

/** Diplomatic news item plus an in-app notification for the leading party. */
async function announceResults(
  db: PrismaClient,
  election: {
    id: string;
    countryId: string;
    candidates: Array<{ id: string; party?: { name: string } | null }>;
  },
  topResult: { candidateId: string; seatsWon: number; votePercentage: number },
  extras: { marginOfVictory: number; turnout: number }
) {
  const partyName = election.candidates.find((c) => c.id === topResult.candidateId)?.party?.name;
  const countryRow = await db.country.findUnique({
    where: { id: election.countryId },
    select: { name: true },
  });
  void generateDiplomaticNews(db, election.countryId, "election_result", {
    countryName: countryRow?.name ?? "Unknown",
    partyName: partyName ?? "Leading party",
    seats: topResult.seatsWon,
    percentage: topResult.votePercentage.toFixed(1),
  });
  try {
    await notificationAPI.create({
      title: "Election Results",
      message: `${partyName ?? "Leading party"} wins with ${topResult.seatsWon} seats (${topResult.votePercentage.toFixed(1)}%). Turnout: ${extras.turnout.toFixed(1)}%`,
      countryId: election.countryId,
      category: "governance",
      priority: "high",
      type: "success",
      source: "elections",
      href: "/mycountry/politics",
      actionable: true,
      metadata: {
        electionId: election.id,
        winnerParty: partyName,
        seatsWon: topResult.seatsWon,
        marginOfVictory: extras.marginOfVictory,
        turnout: extras.turnout,
      },
    });
  } catch (e) {
    console.warn("[Notifications] simulateElectionCore:", e);
  }
}

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
      legislature: { include: { seats: { select: { partyId: true } } } },
      country: true,
    },
  });
  if (!election) return { ok: false, reason: "not_found" };
  if (election.candidates.length < 2) return { ok: false, reason: "insufficient_candidates" };

  const { country, legislature } = election;

  const { incumbentPartyId, economicModifier } = incumbentAndEconomy(
    legislature.seats,
    country.adjustedGdpGrowth
  );
  const partyVotes = computePartyVotes(election.candidates, incumbentPartyId, economicModifier);
  const totalVotesCast = Math.floor((country?.currentPopulation || 1000000) * 0.65);
  const turnout = Math.min(95, 55 + (country?.overallNationalHealth ?? 50) * 0.3);

  // Seats per chamber
  const chambers = parseChambers(
    legislature.chamberType,
    legislature.name,
    legislature.totalSeats,
    legislature.electoralSystem
  );
  const allocations: ChamberAllocation[] = chambers.map((chamber) => ({
    chamberName: chamber.name,
    allocation: allocateChamber(chamber, partyVotes),
  }));
  const seatsWonPerParty = new Map<string, number>();
  for (const { allocation } of allocations) {
    for (const [partyId, seatsWon] of allocation) {
      seatsWonPerParty.set(partyId, (seatsWonPerParty.get(partyId) ?? 0) + seatsWon);
    }
  }

  const results = await recordResults(
    db,
    election.id,
    partyVotes,
    seatsWonPerParty,
    totalVotesCast
  );

  await reassignSeats(db, legislature.id, chambers, allocations);

  const sortedResults = [...results].sort(
    (a, b) => (seatsWonPerParty.get(b.partyId) ?? 0) - (seatsWonPerParty.get(a.partyId) ?? 0)
  );
  const marginOfVictory =
    sortedResults.length >= 2
      ? sortedResults[0]!.votePercentage - sortedResults[1]!.votePercentage
      : 100;

  await db.election.update({
    where: { id: election.id },
    data: {
      status: "completed",
      turnout: Math.round(turnout * 10) / 10,
      totalVotes: totalVotesCast,
      marginOfVictory: Math.round(marginOfVictory * 100) / 100,
    },
  });

  await updatePoliticalMetrics(db, election.countryId, marginOfVictory);

  // Storyteller effect for economic impact
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

  // Party support reflects results
  for (const r of results) {
    await db.politicalParty.update({
      where: { id: r.partyId },
      data: { currentSupport: r.votePercentage },
    });
  }

  const topResult = [...results].sort((a, b) => b.seatsWon - a.seatsWon)[0];
  if (topResult) await announceResults(db, election, topResult, { marginOfVictory, turnout });

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
