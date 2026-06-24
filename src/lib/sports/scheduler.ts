import type { ArchetypeType } from "./presets";

const ONE_IXDAY_MS = 86_400_000;

/**
 * IxTime gap between consecutive matchdays, read from a league's `settings` JSON.
 * Defaults to 1 IxDay (current behavior). Set `matchIntervalDays: 7` for a
 * weekly (in IxTime) cadence.
 */
export function matchIntervalMs(settings: unknown): number {
  const days = (settings as { matchIntervalDays?: number } | null)?.matchIntervalDays;
  return (typeof days === "number" && days > 0 ? days : 1) * ONE_IXDAY_MS;
}

/** IxTime gap between races; defaults to 3 IxDays. Override via `raceIntervalDays`. */
export function raceIntervalMs(settings: unknown): number {
  const days = (settings as { raceIntervalDays?: number } | null)?.raceIntervalDays;
  return (typeof days === "number" && days > 0 ? days : 3) * ONE_IXDAY_MS;
}

export interface Fixture {
  matchDay: number;
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeTeamId?: string;
  awayTeamId?: string;
}

export interface DivisionConfig {
  name: string;
  teamIndices: number[];
}

/**
 * Generate a single round-robin using the circle method.
 * Returns an array of rounds, each round is an array of [teamA, teamB] pairs.
 * Team A is home, Team B is away. For odd team counts, a bye (-1) is added.
 */
function circleMethod(teamCount: number): Array<Array<[number, number]>> {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const teams: number[] = Array.from({ length: n }, (_, i) => (i < teamCount ? i : -1));
  const numRounds = n - 1;
  const half = n / 2;
  const schedule: Array<Array<[number, number]>> = [];

  for (let round = 0; round < numRounds; round++) {
    const matches: Array<[number, number]> = [];
    for (let i = 0; i < half; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a !== -1 && b !== -1) {
        matches.push([a, b]);
      }
    }
    schedule.push(matches);
    teams.splice(1, 0, teams.pop()!);
  }

  return schedule;
}

function generateLeagueSchedule(teamCount: number, homeAwayFormat: "single" | "double"): Fixture[] {
  const rounds = circleMethod(teamCount);
  const fixtures: Fixture[] = [];
  let matchDay = 1;

  for (const roundMatches of rounds) {
    for (const [home, away] of roundMatches) {
      fixtures.push({ matchDay, homeTeamIndex: home, awayTeamIndex: away });
    }
    matchDay++;
  }

  if (homeAwayFormat === "double") {
    for (const roundMatches of rounds) {
      for (const [home, away] of roundMatches) {
        fixtures.push({ matchDay, homeTeamIndex: away, awayTeamIndex: home });
      }
      matchDay++;
    }
  }

  return fixtures;
}

function generateDivisionConferenceSchedule(args: {
  teamCount: number;
  divisions: DivisionConfig[];
  conferenceCount?: number;
  divisionCount?: number;
}): Fixture[] {
  const { teamCount: _teamCount, divisions } = args;
  const fixtures: Fixture[] = [];
  let matchDay = 1;

  const intDivGamesPer = 6;
  const interDivGamesPer = 4;
  const interConfGamesPer = 2;

  const divisionMap = new Map<number, number>();
  const conferenceMap = new Map<number, number>();

  const totalDivisions = divisions.length;
  const confCount = args.conferenceCount ?? 2;
  const divsPerConf = Math.max(1, Math.floor(totalDivisions / confCount));

  for (let i = 0; i < divisions.length; i++) {
    const confIndex = Math.min(Math.floor(i / divsPerConf), confCount - 1);
    for (const idx of divisions[i].teamIndices) {
      divisionMap.set(idx, i);
      conferenceMap.set(idx, confIndex);
    }
  }

  // Intra-division games — use circle method for each division, repeat to get desired count
  for (let divIdx = 0; divIdx < divisions.length; divIdx++) {
    const divTeams = divisions[divIdx].teamIndices;
    if (divTeams.length < 2) continue;

    const rounds = circleMethod(divTeams.length);
    const passes = Math.ceil(intDivGamesPer / 2);

    for (let pass = 0; pass < passes; pass++) {
      const flipHome = pass % 2 === 1;
      for (const roundMatches of rounds) {
        let hasMatch = false;
        for (const [aIdx, bIdx] of roundMatches) {
          const a = divTeams[aIdx];
          const b = divTeams[bIdx];
          fixtures.push({
            matchDay,
            homeTeamIndex: flipHome ? b : a,
            awayTeamIndex: flipHome ? a : b,
          });
          hasMatch = true;
        }
        if (hasMatch) matchDay++;
      }
    }
  }

  // Inter-division (same conference, different division) games
  for (let divA = 0; divA < divisions.length; divA++) {
    for (let divB = divA + 1; divB < divisions.length; divB++) {
      if (
        conferenceMap.get(divisions[divA].teamIndices[0]) !==
        conferenceMap.get(divisions[divB].teamIndices[0])
      ) {
        continue;
      }
      const teamsA = divisions[divA].teamIndices;
      const teamsB = divisions[divB].teamIndices;
      const pairs = generateLimitedPairs(teamsA, teamsB, interDivGamesPer);
      for (const [home, away] of pairs) {
        fixtures.push({ matchDay, homeTeamIndex: home, awayTeamIndex: away });
      }
      matchDay++;
    }
  }

  // Inter-conference games
  if (confCount > 1) {
    for (let divA = 0; divA < divisions.length; divA++) {
      for (let divB = divA + 1; divB < divisions.length; divB++) {
        if (
          conferenceMap.get(divisions[divA].teamIndices[0]) ===
          conferenceMap.get(divisions[divB].teamIndices[0])
        ) {
          continue;
        }
        const teamsA = divisions[divA].teamIndices;
        const teamsB = divisions[divB].teamIndices;
        const pairs = generateLimitedPairs(teamsA, teamsB, interConfGamesPer);
        for (const [home, away] of pairs) {
          fixtures.push({ matchDay, homeTeamIndex: home, awayTeamIndex: away });
        }
        matchDay++;
      }
    }
  }

  return fixtures.sort((a, b) => a.matchDay - b.matchDay);
}

function generateLimitedPairs(
  teamsA: number[],
  teamsB: number[],
  maxPerTeam: number
): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const aUsed = new Map<number, number>();
  const bUsed = new Map<number, number>();

  for (const a of teamsA) aUsed.set(a, 0);
  for (const b of teamsB) bUsed.set(b, 0);

  for (const a of teamsA) {
    const targets = [...teamsB].sort(() => Math.random() - 0.5);
    for (const b of targets) {
      if ((aUsed.get(a) ?? 0) < maxPerTeam && (bUsed.get(b) ?? 0) < maxPerTeam) {
        const flip = pairs.length % 2 === 0;
        pairs.push(flip ? [a, b] : [b, a]);
        aUsed.set(a, (aUsed.get(a) ?? 0) + 1);
        bUsed.set(b, (bUsed.get(b) ?? 0) + 1);
        break;
      }
    }
  }

  return pairs;
}

function generateBracketSchedule(fighterCount: number): Fixture[] {
  const fixtures: Fixture[] = [];
  const pow2 = Math.pow(2, Math.ceil(Math.log2(fighterCount)));

  // Build bracket with cross-pairing for round 1: 1st vs last, 2nd vs 2nd-to-last, etc.
  const bracket: number[] = [];
  const half = pow2 / 2;
  for (let i = 0; i < half; i++) {
    const a = i < fighterCount ? i : -1;
    const b = pow2 - 1 - i < fighterCount ? pow2 - 1 - i : -1;
    bracket.push(a, b);
  }

  let slots: number[] = bracket;
  let matchDay = 1;
  let nextVirtualIndex = fighterCount;

  while (slots.length > 1) {
    const nextSlots: number[] = [];
    let hasRealMatch = false;

    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];

      if (a === -1 && b === -1) {
        nextSlots.push(-1);
      } else if (a === -1) {
        nextSlots.push(b);
      } else if (b === -1) {
        nextSlots.push(a);
      } else {
        fixtures.push({ matchDay, homeTeamIndex: a, awayTeamIndex: b });
        nextSlots.push(nextVirtualIndex++);
        hasRealMatch = true;
      }
    }

    if (hasRealMatch) {
      matchDay++;
    }
    slots = nextSlots;
  }

  return fixtures;
}

function generateCircuitSchedule(raceCount: number, teamCount: number): Fixture[] {
  const fixtures: Fixture[] = [];
  for (let race = 0; race < raceCount; race++) {
    for (let team = 0; team < teamCount; team++) {
      fixtures.push({
        matchDay: race + 1,
        homeTeamIndex: team,
        awayTeamIndex: team,
      });
    }
  }
  return fixtures;
}

export function generateSchedule(args: {
  archetype: ArchetypeType;
  teamCount: number;
  divisions?: DivisionConfig[];
  raceCount?: number;
  homeAwayFormat?: "single" | "double";
  conferenceCount?: number;
  divisionCount?: number;
}): Fixture[] {
  switch (args.archetype) {
    case "league":
      return generateLeagueSchedule(args.teamCount, args.homeAwayFormat ?? "double");

    case "division_conference": {
      let divisions = args.divisions;
      if (!divisions || divisions.length === 0) {
        const confCount = args.conferenceCount ?? 2;
        const divCountPerConf = args.divisionCount ?? 2;
        let totalDivs = confCount * divCountPerConf;
        if (totalDivs > args.teamCount) {
          totalDivs = Math.max(1, args.teamCount);
        }
        divisions = [];
        for (let d = 0; d < totalDivs; d++) {
          divisions.push({
            name: `Division ${d + 1}`,
            teamIndices: [],
          });
        }
        for (let i = 0; i < args.teamCount; i++) {
          const divIndex = i % totalDivs;
          divisions[divIndex].teamIndices.push(i);
        }
      }
      return generateDivisionConferenceSchedule({
        teamCount: args.teamCount,
        divisions,
        conferenceCount: args.conferenceCount,
        divisionCount: args.divisionCount,
      });
    }

    case "bracket":
      if (args.teamCount < 4) {
        throw new Error("Bracket scheduling requires at least 4 participants");
      }
      return generateBracketSchedule(args.teamCount);

    case "circuit":
      return generateCircuitSchedule(args.raceCount ?? 20, args.teamCount);

    default:
      throw new Error(`Unknown archetype: ${args.archetype}`);
  }
}
