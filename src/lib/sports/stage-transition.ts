import { type PrismaClient } from "@prisma/client";
import { DEFAULT_MATCH_INTERVAL_DAYS } from "./scheduler";

type Prisma =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface StageSpec {
  id: number;
  type: string;
  teams?: number;
}

interface LeagueStageSettings {
  stages?: StageSpec[];
}

interface StandingRow {
  teamId: string;
  division: string | null;
  points: number;
  pointsFor: number;
}

/** Scheduled one-hour-apart first-round brackets for the given pairings. */
async function createBrackets(
  prisma: Prisma,
  seasonId: string,
  stageId: number,
  pairings: Array<[string, string]>
) {
  const nowMs = Date.now();
  for (const [i, [team1Id, team2Id]] of pairings.entries()) {
    await prisma.sportBracket.create({
      data: {
        seasonId,
        round: 1,
        fighter1Id: team1Id,
        fighter2Id: team2Id,
        stage: stageId,
        status: "scheduled",
        scheduledIxTime: nowMs + (i + 1) * 3600000,
      },
    });
  }
}

/** Top two of each (alphabetically paired) division cross over: A1 vs B2, B1 vs A2. */
function crossDivisionPairings(standings: StandingRow[]): Array<[string, string]> {
  const groups: Record<string, StandingRow[]> = {};
  for (const s of standings) (groups[s.division || "Default Group"] ??= []).push(s);

  const divisions = Object.keys(groups).sort();
  const topTwo = (div: string): string[] =>
    [...groups[div]!]
      .sort((a, b) => b.points - a.points || b.pointsFor - a.pointsFor)
      .slice(0, 2)
      .map((s) => s.teamId)
      .filter(Boolean);

  const pairings: Array<[string, string]> = [];
  for (let i = 0; i + 1 < divisions.length; i += 2) {
    const [a1, a2] = topTwo(divisions[i]!);
    const [b1, b2] = topTwo(divisions[i + 1]!);
    if (a1 && b2) pairings.push([a1, b2]);
    if (b1 && a2) pairings.push([b1, a2]);
  }
  return pairings;
}

/** Circle-method round robin: one match day per round. */
function roundRobinFixtures(teamIds: string[]) {
  const n = teamIds.length;
  const fixtures: Array<{ homeTeamId: string; awayTeamId: string; matchDay: number }> = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = (r + i) % (n - 1);
      const away = i === 0 ? n - 1 : (n - 1 - i + r) % (n - 1);
      fixtures.push({ homeTeamId: teamIds[home]!, awayTeamId: teamIds[away]!, matchDay: r + 1 });
    }
  }
  return fixtures;
}

export async function transitionToNextStage(prisma: Prisma, seasonId: string): Promise<boolean> {
  const season = await prisma.sportSeason.findUnique({
    where: { id: seasonId },
    include: { league: true },
  });
  if (!season) return false;

  const settings = season.league.settings as LeagueStageSettings | null;
  const stages = settings?.stages;
  if (!Array.isArray(stages)) return false;

  const currentStageId = season.activeStage ?? 1;
  const nextStage = stages.find((s) => s.id === currentStageId + 1);
  if (!nextStage) return false; // no next stage: the season is done

  // Current stage must have no remaining scheduled matches or brackets before advancing
  const [remainingMatches, remainingBrackets] = await Promise.all([
    typeof prisma.sportMatch?.count === "function"
      ? prisma.sportMatch.count({
          where: { seasonId, stage: currentStageId, status: "scheduled" },
        })
      : 0,
    typeof prisma.sportBracket?.count === "function"
      ? prisma.sportBracket.count({
          where: { seasonId, stage: currentStageId, status: "scheduled" },
        })
      : 0,
  ]);
  if (remainingMatches > 0 || remainingBrackets > 0) return false;

  // Standings of the current stage decide the qualifiers
  const standings = await prisma.sportStanding.findMany({
    where: { seasonId },
    orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
  });
  if (standings.length === 0) return false;

  // Atomically claim the stage advance so concurrent callers cannot both create next-stage fixtures
  if (typeof prisma.sportSeason.updateMany === "function") {
    const claimed = await prisma.sportSeason.updateMany({
      where: { id: seasonId, activeStage: currentStageId },
      data: { activeStage: nextStage.id },
    });
    if (claimed.count === 0) return false;
  } else {
    await prisma.sportSeason.update({
      where: { id: seasonId },
      data: { activeStage: nextStage.id },
    });
  }

  const isBracket = nextStage.type === "bracket" || nextStage.type === "golden_box";

  if (standings.some((s) => s.division)) {
    if (isBracket) {
      await createBrackets(prisma, seasonId, nextStage.id, crossDivisionPairings(standings));
    }
  } else {
    // Standard top-K qualifiers (e.g. top 4 for Golden Box); a bracket plays 1 vs 4, 2 vs 3 (or a single final)
    const qualified = standings.map((s) => s.teamId).slice(0, nextStage.teams || 4);

    if (isBracket) {
      const pairings: Array<[string, string]> =
        qualified.length >= 4
          ? [
              [qualified[0]!, qualified[3]!],
              [qualified[1]!, qualified[2]!],
            ]
          : qualified.length >= 2
            ? [[qualified[0]!, qualified[1]!]]
            : [];
      await createBrackets(prisma, seasonId, nextStage.id, pairings);
    } else if (nextStage.type === "league" || nextStage.type === "round_robin") {
      const nowMs = Date.now();
      for (const fix of roundRobinFixtures(qualified)) {
        await prisma.sportMatch.create({
          data: {
            seasonId,
            matchDay: fix.matchDay,
            homeTeamId: fix.homeTeamId,
            awayTeamId: fix.awayTeamId,
            stage: nextStage.id,
            status: "scheduled",
            scheduledIxTime: nowMs + fix.matchDay * DEFAULT_MATCH_INTERVAL_DAYS * 86_400_000,
          },
        });
      }
    }
  }

  return true;
}

