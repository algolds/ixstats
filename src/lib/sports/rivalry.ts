/**
 * Sports rivalries from match results (SL-16).
 *
 * After every completed league match, the two clubs' last `lookback` completed meetings (league
 * matches in either direction, this one included) decide whether they are rivals:
 *
 * - A meeting is **close** when it is a draw or the margin is at most
 *   `max(1, round(closeShare × combined score))` (one goal in football, about five points in a
 *   100-point basketball game).
 * - A pair is a **derby** when both clubs represent the same nation (`SportTeam.nationId`).
 * - A rivalry forms after `minMeetings` meetings with at least `minCloseMeetings` close ones,
 *   or for a derby after `derbyMinMeetings` meetings.
 * - Intensity = `base + perClose × close meetings (+ derbyBonus for a derby)`, capped at 100.
 *   An existing rivalry's intensity never goes down, so seeded rivalries keep theirs.
 *
 * Intensity above 70 raises home advantage in the simulation (simulate-and-persist.ts), and any
 * rivalry tags the fixture "Rivalry" in the league schedule.
 */
import type { Prisma } from "@prisma/client";

export const RIVALRY_RULE = {
  lookback: 10,
  closeShare: 0.05,
  minMeetings: 3,
  minCloseMeetings: 2,
  derbyMinMeetings: 2,
  base: 40,
  perClose: 10,
  derbyBonus: 20,
} as const;

interface Meeting {
  homeScore: number | null;
  awayScore: number | null;
}

/** A draw, or a margin within `max(1, round(closeShare × combined score))`. */
export function isCloseResult(homeScore: number, awayScore: number): boolean {
  const margin = Math.abs(homeScore - awayScore);
  const allowed = Math.max(1, Math.round(RIVALRY_RULE.closeShare * (homeScore + awayScore)));
  return margin <= allowed;
}

interface RivalryAssessment {
  meetings: number;
  closeMeetings: number;
  derby: boolean;
  /** The intensity the rule gives, or null when the pair is not (yet) a rivalry. */
  intensity: number | null;
}

export function assessRivalry(meetings: Meeting[], derby: boolean): RivalryAssessment {
  const scored = meetings.filter(
    (m): m is { homeScore: number; awayScore: number } =>
      typeof m.homeScore === "number" && typeof m.awayScore === "number"
  );
  const closeMeetings = scored.filter((m) => isCloseResult(m.homeScore, m.awayScore)).length;
  const qualifies =
    (scored.length >= RIVALRY_RULE.minMeetings && closeMeetings >= RIVALRY_RULE.minCloseMeetings) ||
    (derby && scored.length >= RIVALRY_RULE.derbyMinMeetings);
  const intensity = qualifies
    ? Math.min(
        100,
        RIVALRY_RULE.base +
          RIVALRY_RULE.perClose * closeMeetings +
          (derby ? RIVALRY_RULE.derbyBonus : 0)
      )
    : null;
  return { meetings: scored.length, closeMeetings, derby, intensity };
}

export interface ExistingRivalry {
  id: string;
  intensity: number;
}

type RivalryDb = Pick<Prisma.TransactionClient, "sportMatch" | "sportRivalry">;

/**
 * Creates or strengthens the rivalry between two clubs after a match between them completed.
 * `existing` is the rivalry row already loaded for the match (either team order), if any.
 */
export async function updateRivalryAfterMatch(
  db: RivalryDb,
  input: {
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeNationId: string | null;
    awayNationId: string | null;
    existing: ExistingRivalry | null;
  }
): Promise<void> {
  const { homeTeamId, awayTeamId } = input;
  if (homeTeamId === awayTeamId) return;

  const meetings = await db.sportMatch.findMany({
    where: {
      status: "completed",
      OR: [
        { homeTeamId, awayTeamId },
        { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      ],
    },
    orderBy: { resolvedIxTime: "desc" },
    take: RIVALRY_RULE.lookback,
    select: { homeScore: true, awayScore: true },
  });
  const derby = !!input.homeNationId && input.homeNationId === input.awayNationId;
  const assessment = assessRivalry(meetings, derby);
  const history = {
    rule: "results-v1",
    meetings: assessment.meetings,
    closeMeetings: assessment.closeMeetings,
    derby,
    lastMatchId: input.matchId,
  };

  if (input.existing) {
    const intensity = Math.max(input.existing.intensity, assessment.intensity ?? 0);
    await db.sportRivalry.update({
      where: { id: input.existing.id },
      data: { intensity, history },
    });
    return;
  }
  if (assessment.intensity === null) return;

  // New rivalries store the pair in id order, so the unique (team1Id, team2Id) key is stable.
  const [team1Id, team2Id] = [homeTeamId, awayTeamId].sort();
  await db.sportRivalry.upsert({
    where: { team1Id_team2Id: { team1Id: team1Id!, team2Id: team2Id! } },
    create: { team1Id: team1Id!, team2Id: team2Id!, intensity: assessment.intensity, history },
    update: { intensity: assessment.intensity, history },
  });
}
