/**
 * One path for "simulate a scheduled SportMatch and persist it" (plans 345 Step 1 + 320).
 *
 * The match-day button, the single-match button, the full-season sim and the IxTime
 * cron all call simulateAndPersistMatch, so a match scores the same whichever path
 * advances it (knockout bouts go through simulateAndPersistBout, same snapshot + seed):
 *   1. build a replayable SimulationSnapshot (seed, ratings, rosters, morale, tactics,
 *      storyteller modifiers, home advantage) and resolve the match *from that snapshot*,
 *      so `resolveFromSnapshot(matchStats.simulationSnapshot)` reproduces the result;
 *   2. claim the match atomically (scheduled → completed via a conditional updateMany),
 *      so a double-click, a retry or a cron/button race can never double-count;
 *   3. only when the claim wins: season rating vectors, standings, morale, player stats.
 * Call it inside `db.$transaction` so the claim and the standings commit together.
 */
import type { Prisma, StorytellerEffect } from "@prisma/client";
import { IxTime } from "../ixtime";
import { resolveMatch } from "./resolver";
import { createRNG, seedFromString } from "./rng";
import { computeTeamRatingVector, getTeamModifiers } from "./team-rating";
import { generateMatchAnalysisFacts, type MatchAnalysisFacts } from "./analysis";
import { decidedAfterRegulation } from "./match-outcome";
import { pointsFor, type StandingOutcome } from "./presets";
import type { EventTraceStep, ExtendedMatchResult } from "./types";

const RESOLVER_VERSION = "2.1.0";
const RULE_VERSION = "1.0.0";

const MORALE_SWING = 5;

type Db = Prisma.TransactionClient;
type EffectsMap = Map<string, StorytellerEffect[]>;

// Inputs (a Prisma SportMatch loaded with SIM_MATCH_INCLUDE satisfies these)

type SimPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  careerStage: string;
  isActive: boolean;
  morale: number;
  ratings: Prisma.JsonValue | null;
};

export type SimTeam = {
  id: string;
  name: string;
  nationId: string | null;
  patronSaint: string | null;
  tacticalIntent: string;
  lineup: Prisma.JsonValue | null;
  players: SimPlayer[];
  coaches: Array<{ isActive: boolean; ratings: Prisma.JsonValue | null }>;
};

export type SimMatch = {
  id: string;
  seasonId: string;
  matchDay: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: SimTeam;
  awayTeam: SimTeam;
};

type SimLeague = { sportPreset: string; archetype: string };

/** Prisma `include` that loads a SportTeam as a SimTeam (active roster + coaches). */
export const SIM_TEAM_INCLUDE = {
  players: { where: { isActive: true } },
  coaches: { where: { isActive: true } },
} satisfies Prisma.SportTeamInclude;

const TEAM_WITH_ROSTER = { include: SIM_TEAM_INCLUDE } satisfies Prisma.SportTeamDefaultArgs;

/** Prisma `include` that loads everything simulateAndPersistMatch reads. */
export const SIM_MATCH_INCLUDE = {
  homeTeam: TEAM_WITH_ROSTER,
  awayTeam: TEAM_WITH_ROSTER,
} satisfies Prisma.SportMatchInclude;

// Snapshot contract (stored at SportMatch.matchStats.simulationSnapshot)

type RatingSnapshot = {
  overall: number;
  offense: number;
  defense: number;
  form: number;
  depth: number;
  coaching: number;
};

type RosterSnapshot = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  ratings: Record<string, number>;
};

type TeamSnapshot = {
  id: string;
  ratingVector: RatingSnapshot;
  /** Mean morale of the active roster before kick-off. */
  morale: number;
  tactics: { intent: string; lineup: Prisma.JsonObject | null };
  roster: RosterSnapshot[];
  /** Storyteller effects (saint blessing / country scandal) applied to this side. */
  worldModifiers: { saintName?: string; saintBlessing?: number; countryScandal?: number } | null;
};

type SimulationSnapshot = {
  seed: number;
  resolverVersion: string;
  ruleVersion: string;
  sport: string;
  archetype: string;
  homeAdvantage: number;
  homeTeamSnapshot: TeamSnapshot;
  awayTeamSnapshot: TeamSnapshot;
  capturedIxTime: number;
};

// Pure helpers

/** One seed per match, independent of which path (button / full season / cron) runs it. */
export function matchSeed(match: { id: string; seasonId: string; matchDay: number }): number {
  return seedFromString(`${match.id}:${match.seasonId}:${match.matchDay}`);
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function numericRatings(value: Prisma.JsonValue | null): Record<string, number> | null {
  const obj = jsonObject(value);
  if (!obj) return null;
  const ratings: Record<string, number> = {};
  for (const [key, rating] of Object.entries(obj)) {
    if (typeof rating === "number") ratings[key] = rating;
  }
  return ratings;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function snapshotTeam(
  team: SimTeam,
  sportPreset: string,
  modifiers: TeamSnapshot["worldModifiers"] | undefined
): TeamSnapshot {
  // Sorted so the resolver sees the same roster order on every run (DB order is not stable).
  const players = [...team.players].sort(byId);
  const ratingVector = computeTeamRatingVector(
    players.map((p) => ({
      id: p.id,
      isActive: p.isActive,
      careerStage: p.careerStage,
      position: p.position,
      ratings: numericRatings(p.ratings),
    })),
    team.coaches.map((c) => ({ isActive: c.isActive, ratings: numericRatings(c.ratings) })),
    sportPreset
  );
  const moraleTotal = players.reduce((sum, p) => sum + p.morale, 0);
  return {
    id: team.id,
    ratingVector: { ...ratingVector },
    morale: players.length > 0 ? Math.round(moraleTotal / players.length) : 50,
    tactics: { intent: team.tacticalIntent, lineup: jsonObject(team.lineup) },
    roster: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      ratings: numericRatings(p.ratings) ?? {},
    })),
    worldModifiers: modifiers ? { ...modifiers } : null,
  };
}

/** Re-runs the resolver from a stored snapshot; same snapshot ⇒ same result. */
export function resolveFromSnapshot(snapshot: SimulationSnapshot): ExtendedMatchResult {
  const home = snapshot.homeTeamSnapshot;
  const away = snapshot.awayTeamSnapshot;
  return resolveMatch({
    sport: snapshot.sport,
    archetype: snapshot.archetype,
    seed: snapshot.seed,
    homeTeam: home.ratingVector,
    awayTeam: away.ratingVector,
    homeTeamModifiers: home.worldModifiers ?? undefined,
    awayTeamModifiers: away.worldModifiers ?? undefined,
    homeRoster: home.roster,
    awayRoster: away.roster,
    homeTacticalIntent: home.tactics.intent,
    awayTacticalIntent: away.tactics.intent,
    homeLineup: home.tactics.lineup ?? undefined,
    awayLineup: away.tactics.lineup ?? undefined,
    context: { homeAdvantage: snapshot.homeAdvantage },
  });
}

function standingOutcome(
  scored: number,
  conceded: number,
  afterRegulation: boolean
): StandingOutcome {
  if (scored > conceded) return "win";
  if (scored === conceded) return "draw";
  return afterRegulation ? "overtimeLoss" : "loss";
}

/**
 * Standings increments for one side, points from the sport's rule (presets `pointsFor`).
 * An overtime loss counts in `losses` (SportStanding has no OTL column) but earns its point.
 */
export function standingDelta(
  sport: string,
  scored: number,
  conceded: number,
  afterRegulation: boolean
) {
  const outcome = standingOutcome(scored, conceded, afterRegulation);
  return {
    wins: outcome === "win" ? 1 : 0,
    draws: outcome === "draw" ? 1 : 0,
    losses: outcome === "loss" || outcome === "overtimeLoss" ? 1 : 0,
    points: pointsFor(sport, outcome),
    pointsFor: scored,
    pointsAgainst: conceded,
  };
}

type PlayerLine = { goals: number; assists: number; shots: number };

/** Goals / shots from the trace, assists picked with the match's seeded RNG (replayable). */
function tallyPlayerStats(
  trace: EventTraceStep[],
  home: RosterSnapshot[],
  away: RosterSnapshot[],
  seed: number
): Array<{ playerId: string; stats: PlayerLine }> {
  const rng = createRNG(seed + 1);
  const homeIds = new Set(home.map((p) => p.id));
  const awayIds = new Set(away.map((p) => p.id));
  const lines = new Map<string, PlayerLine>();
  const line = (id: string): PlayerLine => {
    const existing = lines.get(id);
    if (existing) return existing;
    const created = { goals: 0, assists: 0, shots: 0 };
    lines.set(id, created);
    return created;
  };

  for (const event of trace) {
    const actorId = event.actorId;
    // Resolver fallbacks ("fallback_G_0") are not real players — skip them.
    if (!actorId || !(homeIds.has(actorId) || awayIds.has(actorId))) continue;
    const type: string = event.type;
    if (type === "shot") line(actorId).shots++;
    if (type !== "goal") continue;
    line(actorId).goals++;
    const teammates = (homeIds.has(actorId) ? home : away).filter((p) => p.id !== actorId);
    if (teammates.length > 0 && rng() < 0.7) {
      const assister = teammates[Math.floor(rng() * teammates.length)];
      if (assister) line(assister.id).assists++;
    }
  }
  return Array.from(lines, ([playerId, stats]) => ({ playerId, stats }));
}

function ratingAfter(before: RatingSnapshot, delta: number): RatingSnapshot {
  return { ...before, overall: Math.round((before.overall + delta) * 100) / 100 };
}

function toMatchStats(
  result: ExtendedMatchResult,
  snapshot: SimulationSnapshot,
  analysisFacts: MatchAnalysisFacts
) {
  return {
    keyStats: result.keyStats,
    evaluation: { ...result.evaluation },
    trace: result.trace.map((step) => ({ ...step })),
    simulationSnapshot: snapshot,
    analysisFacts: { ...analysisFacts },
  };
}

export type PersistedMatchStats = ReturnType<typeof toMatchStats>;

/** Resolves from the snapshot and builds the persisted stats (league matches and bouts). */
function simulateFromSnapshot(snapshot: SimulationSnapshot, homeName: string, awayName: string) {
  const result = resolveFromSnapshot(snapshot);
  const home = snapshot.homeTeamSnapshot;
  const away = snapshot.awayTeamSnapshot;
  const analysisFacts = generateMatchAnalysisFacts({
    homeTeamName: homeName,
    awayTeamName: awayName,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    sportPreset: snapshot.sport,
    events: result.trace,
    homeRatings: home.ratingVector,
    awayRatings: away.ratingVector,
    homeTactics: home.tactics.intent || "Balanced",
    awayTactics: away.tactics.intent || "Balanced",
  });
  return { result, analysisFacts, matchStats: toMatchStats(result, snapshot, analysisFacts) };
}

// DB steps

/** Active storyteller effects for these nations, keyed by nationId (one query). */
export async function loadEffectsMap(db: Db, nationIds: Array<string | null>): Promise<EffectsMap> {
  const ids = Array.from(new Set(nationIds.filter((id): id is string => !!id)));
  const map: EffectsMap = new Map();
  if (ids.length === 0) return map;
  const effects = await db.storytellerEffect.findMany({
    where: { countryId: { in: ids }, isActive: true },
  });
  for (const effect of effects) {
    if (!effect.countryId) continue;
    map.set(effect.countryId, [...(map.get(effect.countryId) ?? []), effect]);
  }
  return map;
}

async function buildSimulationSnapshot(
  db: Db,
  match: SimMatch,
  league: SimLeague,
  effectsMap?: EffectsMap
): Promise<SimulationSnapshot> {
  const effects =
    effectsMap ?? (await loadEffectsMap(db, [match.homeTeam.nationId, match.awayTeam.nationId]));
  const homeModifiers = await getTeamModifiers(match.homeTeam, db, effects);
  const awayModifiers = await getTeamModifiers(match.awayTeam, db, effects);

  const rivalry = await db.sportRivalry.findFirst({
    where: {
      OR: [
        { team1Id: match.homeTeamId, team2Id: match.awayTeamId },
        { team1Id: match.awayTeamId, team2Id: match.homeTeamId },
      ],
    },
    select: { intensity: true },
  });

  return {
    seed: matchSeed(match),
    resolverVersion: RESOLVER_VERSION,
    ruleVersion: RULE_VERSION,
    sport: league.sportPreset,
    archetype: league.archetype,
    homeAdvantage: (rivalry?.intensity ?? 0) > 70 ? 65 : 55,
    homeTeamSnapshot: snapshotTeam(match.homeTeam, league.sportPreset, homeModifiers),
    awayTeamSnapshot: snapshotTeam(match.awayTeam, league.sportPreset, awayModifiers),
    capturedIxTime: IxTime.getCurrentIxTime(),
  };
}

async function applyStanding(
  db: Db,
  seasonId: string,
  teamId: string,
  delta: ReturnType<typeof standingDelta>
): Promise<void> {
  await db.sportStanding.upsert({
    where: { seasonId_teamId: { seasonId, teamId } },
    create: { seasonId, teamId, ...delta },
    update: {
      wins: { increment: delta.wins },
      draws: { increment: delta.draws },
      losses: { increment: delta.losses },
      points: { increment: delta.points },
      pointsFor: { increment: delta.pointsFor },
      pointsAgainst: { increment: delta.pointsAgainst },
    },
  });
}

async function applyMorale(db: Db, winnerIds: string[], loserIds: string[]): Promise<void> {
  await db.sportPlayer.updateMany({
    where: { id: { in: winnerIds } },
    data: { morale: { increment: MORALE_SWING } },
  });
  await db.sportPlayer.updateMany({
    where: { id: { in: loserIds } },
    data: { morale: { decrement: MORALE_SWING } },
  });
  // Keep morale in [0, 100].
  await db.sportPlayer.updateMany({
    where: { id: { in: winnerIds }, morale: { gt: 100 } },
    data: { morale: 100 },
  });
  await db.sportPlayer.updateMany({
    where: { id: { in: loserIds }, morale: { lt: 0 } },
    data: { morale: 0 },
  });
}

export type SimulatedMatch = {
  homeScore: number;
  awayScore: number;
  winner: ExtendedMatchResult["winner"];
  trace: EventTraceStep[];
  analysisFacts: MatchAnalysisFacts;
  matchStats: PersistedMatchStats;
};

/**
 * Simulates one scheduled match and persists it. Returns null when another caller
 * already completed the match — nothing is written in that case.
 */
export async function simulateAndPersistMatch(
  db: Db,
  input: { match: SimMatch; league: SimLeague; effectsMap?: EffectsMap }
): Promise<SimulatedMatch | null> {
  const { match, league } = input;
  const snapshot = await buildSimulationSnapshot(db, match, league, input.effectsMap);
  const { result, analysisFacts, matchStats } = simulateFromSnapshot(
    snapshot,
    match.homeTeam.name,
    match.awayTeam.name
  );
  const home = snapshot.homeTeamSnapshot;
  const away = snapshot.awayTeamSnapshot;
  const homeAfter = ratingAfter(home.ratingVector, result.homeRatingDelta);
  const awayAfter = ratingAfter(away.ratingVector, result.awayRatingDelta);

  const claimed = await db.sportMatch.updateMany({
    where: { id: match.id, status: "scheduled" },
    data: {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      status: "completed",
      resolvedIxTime: snapshot.capturedIxTime,
      matchStats,
      homeRatingBefore: home.ratingVector,
      awayRatingBefore: away.ratingVector,
      homeRatingAfter: homeAfter,
      awayRatingAfter: awayAfter,
    },
  });
  if (claimed.count === 0) return null;

  await db.sportTeamSeason.updateMany({
    where: { seasonId: match.seasonId, teamId: match.homeTeamId },
    data: { ratingVector: homeAfter },
  });
  await db.sportTeamSeason.updateMany({
    where: { seasonId: match.seasonId, teamId: match.awayTeamId },
    data: { ratingVector: awayAfter },
  });

  const sport = league.sportPreset;
  const afterRegulation = decidedAfterRegulation(sport, result.trace);
  const { homeScore, awayScore } = result;
  await applyStanding(
    db,
    match.seasonId,
    match.homeTeamId,
    standingDelta(sport, homeScore, awayScore, afterRegulation)
  );
  await applyStanding(
    db,
    match.seasonId,
    match.awayTeamId,
    standingDelta(sport, awayScore, homeScore, afterRegulation)
  );

  const homeIds = home.roster.map((p) => p.id);
  const awayIds = away.roster.map((p) => p.id);
  if (result.winner === "home") await applyMorale(db, homeIds, awayIds);
  if (result.winner === "away") await applyMorale(db, awayIds, homeIds);

  const playerStats = tallyPlayerStats(result.trace, home.roster, away.roster, snapshot.seed);
  if (playerStats.length > 0) {
    await db.sportMatchStat.createMany({
      data: playerStats.map((ps) => ({
        matchId: match.id,
        playerId: ps.playerId,
        stats: ps.stats,
      })),
    });
  }

  return {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winner: result.winner,
    trace: result.trace,
    analysisFacts,
    matchStats,
  };
}

// Knockout bouts (SportBracket rows)

type SimBout = {
  id: string;
  seasonId: string;
  round: number;
  fighter1Id: string;
  fighter2Id: string;
};

export type PersistedBoutResult = PersistedMatchStats & {
  winner: string;
  method: string;
  homeScore: number;
  awayScore: number;
};

/**
 * Simulates one scheduled knockout bout with the same seeded snapshot as a league match
 * (fighter1 at home, archetype "bracket"), so `resolveFromSnapshot(result.simulationSnapshot)`
 * replays it. Claims the bout atomically (scheduled → completed); returns null when another
 * caller already completed it. A drawn bout goes to fighter2, as before.
 */
export async function simulateAndPersistBout(
  db: Db,
  input: {
    bout: SimBout;
    fighter1: SimTeam;
    fighter2: SimTeam;
    sportPreset: string;
    effectsMap?: EffectsMap;
  }
): Promise<PersistedBoutResult | null> {
  const { bout, fighter1, fighter2 } = input;
  const match: SimMatch = {
    id: bout.id,
    seasonId: bout.seasonId,
    matchDay: bout.round,
    homeTeamId: bout.fighter1Id,
    awayTeamId: bout.fighter2Id,
    homeTeam: fighter1,
    awayTeam: fighter2,
  };
  const league = { sportPreset: input.sportPreset, archetype: "bracket" };
  const snapshot = await buildSimulationSnapshot(db, match, league, input.effectsMap);
  const { result, matchStats } = simulateFromSnapshot(snapshot, fighter1.name, fighter2.name);
  const winnerId = result.winner === "home" ? bout.fighter1Id : bout.fighter2Id;
  const boutResult: PersistedBoutResult = {
    winner: winnerId,
    method: "decision",
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    ...matchStats,
  };

  const claimed = await db.sportBracket.updateMany({
    where: { id: bout.id, status: "scheduled" },
    data: {
      winnerId,
      status: "completed",
      resolvedIxTime: snapshot.capturedIxTime,
      result: boutResult,
    },
  });
  return claimed.count === 0 ? null : boutResult;
}
