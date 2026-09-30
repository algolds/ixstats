/**
 * Election lifecycle (MC-2) — the glue that makes politics reachable for a real nation.
 *
 *   setup (legislature + parties) → ensureUpcomingElection → [IxTime passes]
 *   → resolveElection (claim → candidates from parties → simulateElectionCore → follow-up)
 *   → seats carry parties → legislation.holdVote can tally a floor vote.
 *
 * Before this, `election.create` ran only in the cron's follow-up branch and nothing ever
 * registered a candidate, so no election could resolve and seats never had a party.
 *
 * Callers: `configureLegislature` / `createParty` (immediately), the `elections` cron
 * (sweep + resolution) and the owner's `resolveDueElection` mutation. Pure DB work — no auth.
 *
 * ⚠️ Scheduling uses the IxTime clock (IxTime.getCurrentIxTime()), never the wall clock.
 */
import type { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { simulateElectionCore } from "./election-simulation";

const DAY_MS = 24 * 60 * 60 * 1000;
const GAME_YEAR_MS = 365.25 * DAY_MS;
const DEFAULT_TERM_YEARS = 4;

/**
 * How long after setup the first (or a snap) election is held, in IxTime days.
 * Decision default (ROADMAP D1 is still open): a short campaign window, not an instant seating.
 */
export const FIRST_ELECTION_DELAY_IX_DAYS = 30;

/** An election needs at least this many parties (candidates) to resolve — see simulateElectionCore. */
export const MIN_ELECTION_PARTIES = 2;

type Db = PrismaClient;

export type EnsureElectionResult =
  | {
      status: "created" | "rescheduled" | "exists";
      electionId: string;
      scheduledIxTime: number;
    }
  | { status: "no_legislature" | "insufficient_parties" };

function electionName(kind: "first" | "snap" | "general", ixTime: number): string {
  const year = IxTime.getCurrentGameYear(ixTime);
  if (kind === "first") return `First General Election (Year ${year})`;
  if (kind === "snap") return `Snap Election (Year ${year})`;
  return `General Election (Year ${year})`;
}

/**
 * Make sure a country with a legislature and enough active parties has an upcoming election.
 *
 * - No upcoming election and none ever held → create the first one, FIRST_ELECTION_DELAY_IX_DAYS out.
 * - No upcoming election but one was held (follow-up missing) → next one a term after the
 *   last, never earlier than the short window.
 * - `snap: true` (the legislature was dissolved/reconfigured, so every seat is vacant) → an
 *   upcoming election further out than the short window is pulled forward to it.
 */
export async function ensureUpcomingElection(
  db: Db,
  countryId: string,
  opts: { snap?: boolean } = {}
): Promise<EnsureElectionResult> {
  const legislature = await db.legislature.findUnique({
    where: { countryId },
    select: { id: true, termLength: true },
  });
  if (!legislature) return { status: "no_legislature" };

  const activeParties = await db.politicalParty.count({ where: { countryId, isActive: true } });
  if (activeParties < MIN_ELECTION_PARTIES) return { status: "insufficient_parties" };

  const soon = IxTime.getCurrentIxTime() + FIRST_ELECTION_DELAY_IX_DAYS * DAY_MS;

  const upcoming = await db.election.findFirst({
    where: { countryId, status: "upcoming" },
    orderBy: { scheduledIxTime: "asc" },
    select: { id: true, scheduledIxTime: true },
  });
  if (upcoming) {
    if (opts.snap && upcoming.scheduledIxTime > soon) {
      await db.election.update({
        where: { id: upcoming.id },
        data: { scheduledIxTime: soon, name: electionName("snap", soon) },
      });
      return { status: "rescheduled", electionId: upcoming.id, scheduledIxTime: soon };
    }
    return { status: "exists", electionId: upcoming.id, scheduledIxTime: upcoming.scheduledIxTime };
  }

  const last = await db.election.findFirst({
    where: { countryId, status: "completed" },
    orderBy: { scheduledIxTime: "desc" },
    select: { scheduledIxTime: true },
  });

  let scheduledIxTime = soon;
  let kind: "first" | "snap" | "general" = "first";
  if (last) {
    const termYears = legislature.termLength > 0 ? legislature.termLength : DEFAULT_TERM_YEARS;
    kind = opts.snap ? "snap" : "general";
    scheduledIxTime = opts.snap
      ? soon
      : Math.max(soon, last.scheduledIxTime + termYears * GAME_YEAR_MS);
  }

  const created = await db.election.create({
    data: {
      countryId,
      legislatureId: legislature.id,
      name: electionName(kind, scheduledIxTime),
      electionType: "general",
      scheduledIxTime,
      status: "upcoming",
    },
    select: { id: true },
  });
  return { status: "created", electionId: created.id, scheduledIxTime };
}

/**
 * Register one list candidate per active party of the election's country (the parties ARE
 * the candidates), and drop candidates of parties that have since gone inactive. Run at
 * resolution time so the ballot reflects the parties as they stand when the polls close.
 * Returns the number of candidates on the ballot.
 */
export async function syncElectionCandidates(db: Db, electionId: string): Promise<number> {
  const election = await db.election.findUnique({
    where: { id: electionId },
    select: { id: true, countryId: true, candidates: { select: { partyId: true } } },
  });
  if (!election) return 0;

  const parties = await db.politicalParty.findMany({
    where: { countryId: election.countryId, isActive: true },
    select: { id: true, name: true, leaderName: true, platform: true },
    orderBy: { currentSupport: "desc" },
  });
  const activeIds = parties.map((p) => p.id);

  await db.electionCandidate.deleteMany({
    where: { electionId, partyId: { notIn: activeIds } },
  });

  const existing = new Set(election.candidates.map((c) => c.partyId));
  const missing = parties.filter((p) => !existing.has(p.id));
  if (missing.length > 0) {
    await db.electionCandidate.createMany({
      data: missing.map((p) => ({
        electionId,
        partyId: p.id,
        candidateName: p.leaderName?.trim() || `${p.name} list`,
        platform: p.platform ?? null,
        // charisma/politicalCapital keep their neutral schema defaults (50): no invented swing.
      })),
    });
  }

  return parties.length;
}

export type ResolveElectionOutcome = "resolved" | "insufficient_candidates" | "not_claimed";

/**
 * Resolve one due election: claim it (so the cron and the owner's button can't both count
 * it), put the parties on the ballot, run the shared simulation, then queue the next
 * general election one term later. A failed or unresolvable election is released back to
 * `upcoming` so a later pass can retry it.
 */
export async function resolveElection(
  db: Db,
  electionId: string
): Promise<{ outcome: ResolveElectionOutcome; nextElectionId?: string }> {
  const claim = await db.election.updateMany({
    where: { id: electionId, status: "upcoming" },
    data: { status: "voting" },
  });
  if (claim.count === 0) return { outcome: "not_claimed" };

  const release = () =>
    db.election.updateMany({
      where: { id: electionId, status: "voting" },
      data: { status: "upcoming" },
    });

  let election: { countryId: string; legislatureId: string; scheduledIxTime: number } | null;
  try {
    await syncElectionCandidates(db, electionId);
    const sim = await simulateElectionCore(db, electionId);
    if (!sim.ok) {
      await release();
      return { outcome: "insufficient_candidates" };
    }
    election = await db.election.findUnique({
      where: { id: electionId },
      select: { countryId: true, legislatureId: true, scheduledIxTime: true },
    });
  } catch (err) {
    await release();
    throw err;
  }
  if (!election) return { outcome: "resolved" };

  // Queue the next general election one term later — unless one is already queued.
  const alreadyQueued = await db.election.count({
    where: { countryId: election.countryId, status: "upcoming" },
  });
  if (alreadyQueued > 0) return { outcome: "resolved" };

  const legislature = await db.legislature.findUnique({
    where: { id: election.legislatureId },
    select: { termLength: true },
  });
  const termYears =
    legislature?.termLength && legislature.termLength > 0
      ? legislature.termLength
      : DEFAULT_TERM_YEARS;
  // Never schedule into the past (e.g. an election counted long after it fell due).
  const nextScheduled = Math.max(
    election.scheduledIxTime + termYears * GAME_YEAR_MS,
    IxTime.getCurrentIxTime() + FIRST_ELECTION_DELAY_IX_DAYS * DAY_MS
  );
  const next = await db.election.create({
    data: {
      countryId: election.countryId,
      legislatureId: election.legislatureId,
      name: electionName("general", nextScheduled),
      electionType: "general",
      scheduledIxTime: nextScheduled,
      status: "upcoming",
    },
    select: { id: true },
  });
  return { outcome: "resolved", nextElectionId: next.id };
}
