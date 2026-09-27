/**
 * Sports Leagues Helpers
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { decidedAfterRegulation } from "~/lib/sports/match-outcome";
import { standingDelta } from "~/lib/sports/simulate-and-persist";
import type { EventTraceStep } from "~/lib/sports/types";

type StandingTotals = ReturnType<typeof standingDelta>;

const emptyTotals = (): StandingTotals => ({
  wins: 0,
  losses: 0,
  draws: 0,
  points: 0,
  pointsFor: 0,
  pointsAgainst: 0,
});

function addInto(target: StandingTotals, delta: StandingTotals) {
  target.wins += delta.wins;
  target.losses += delta.losses;
  target.draws += delta.draws;
  target.points += delta.points;
  target.pointsFor += delta.pointsFor;
  target.pointsAgainst += delta.pointsAgainst;
}

/** Trace stored with a simulated match; manual results have none (then no overtime is assumed). */
function traceOf(matchStats: Prisma.JsonValue): EventTraceStep[] {
  const stats = matchStats as { trace?: EventTraceStep[] } | null;
  return Array.isArray(stats?.trace) ? stats.trace : [];
}

/**
 * Recompute a season's standings from scratch off completed matches (idempotent).
 * Points follow the sport's rule (`pointsFor` via `standingDelta`), the same one live
 * match completion uses — e.g. hockey pays 2 for a win and 1 for an overtime loss.
 */
export async function recalculateStandings(
  db: PrismaClient | Prisma.TransactionClient,
  seasonId: string
) {
  const season = await db.sportSeason.findUnique({
    where: { id: seasonId },
    select: { league: { select: { sportPreset: true } } },
  });
  const sport = season?.league.sportPreset ?? "soccer";

  const teams = await db.sportTeamSeason.findMany({
    where: { seasonId },
    select: { teamId: true },
  });
  const matches = await db.sportMatch.findMany({
    where: { seasonId, status: "completed" },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, matchStats: true },
  });

  const totals = new Map<string, StandingTotals>(teams.map((t) => [t.teamId, emptyTotals()]));
  const totalsFor = (teamId: string) => {
    const existing = totals.get(teamId);
    if (existing) return existing;
    const created = emptyTotals();
    totals.set(teamId, created);
    return created;
  };

  for (const m of matches) {
    const home = m.homeScore ?? 0;
    const away = m.awayScore ?? 0;
    const afterRegulation = decidedAfterRegulation(sport, traceOf(m.matchStats));
    addInto(totalsFor(m.homeTeamId), standingDelta(sport, home, away, afterRegulation));
    addInto(totalsFor(m.awayTeamId), standingDelta(sport, away, home, afterRegulation));
  }

  const ranked = [...totals.entries()].sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    const diff = b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
    if (diff !== 0) return diff;
    return b.pointsFor - a.pointsFor;
  });

  for (const [idx, [teamId, stats]] of ranked.entries()) {
    const data = { ...stats, rank: idx + 1 };
    await db.sportStanding.upsert({
      where: { seasonId_teamId: { seasonId, teamId } },
      create: { seasonId, teamId, ...data },
      update: data,
    });
  }
}
