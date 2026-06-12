/**
 * Demo seed for canonical sports leagues.
 *
 * Seeds three canonical leagues (soccer, F1, boxing) with completed seasons
 * including full rosters, match/race/bracket results, and standings.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import {
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  createRNG,
  resolveMatch,
  resolveRace,
  type TeamRatingVector,
} from "../sports";

type Prisma = PrismaClient;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const CITY_NAMES = [
  "Olympus City", "Nova Albion", "Port Azure", "Crownhaven", "Ironforge",
  "Silverstead", "Goldenfield", "Westhaven", "Eastgate", "Northport",
  "Southbank", "Riverside", "Highcastle", "Stormwind", "Sunhaven",
  "Greenwood", "Oakvale", "Stonebridge", "Ashford", "Lakewood",
];

const F1_CONSTRUCTOR_NAMES = [
  "Velocity Racing", "Apex Motorsport", "Titan GP", "Phoenix Racing",
  "Storm Engineering", "Nova F1 Team", "Precision Motors", "Horizon Racing",
  "Quantum GP", "Fusion Motorsport",
];

const F1_CONSTRUCTOR_COLORS = [
  "#dc2626", "#2563eb", "#ca8a04", "#16a34a", "#9333ea",
  "#ea580c", "#0891b2", "#db2777", "#4f46e5", "#65a30d",
];

const CIRCUIT_NAMES = [
  "Aurelian Grand Prix Circuit", "Crownstone International Speedway",
  "Port Azure Street Circuit", "Silverstone Heritage Track",
  "Monte Cielo Circuit", "Ironforge Motorsport Park",
  "Goldenfield Raceway", "Westhaven Speed Ring",
  "Eastgate International Circuit", "Northport Coastal Track",
  "Southbank City Circuit", "Riverside Grand Prix",
  "Highcastle Mountain Course", "Stormwind Motor Arena",
  "Sunhaven Park Circuit", "Greenwood Forest Track",
  "Oakvale Racing Circuit", "Stonebridge Grand Prix",
  "Ashford Speedway", "Lakewood International Circuit",
];

function computePlayerAvg(ratings: Record<string, number>): number {
  const values = Object.values(ratings);
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeTeamRatingVector(
  players: Array<{ position: string; ratings: Record<string, number> }>,
  coach: { ratings: { strategy: number; development: number; motivation: number; adaptability: number } },
  sport: string,
  seed: number,
): TeamRatingVector {
  const rng = createRNG(seed);
  const allAvgs = players.map((p) => computePlayerAvg(p.ratings));
  const overall = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 50;

  let offensivePositions: string[];
  let defensivePositions: string[];

  if (sport === "soccer") {
    offensivePositions = ["ST", "AM", "W"];
    defensivePositions = ["GK", "CB", "FB"];
  } else if (sport === "boxing") {
    offensivePositions = ["fighter"];
    defensivePositions = ["fighter"];
  } else {
    offensivePositions = ["driver"];
    defensivePositions = ["driver"];
  }

  const offPlayers = players.filter((p) => offensivePositions.includes(p.position));
  const defPlayers = players.filter((p) => defensivePositions.includes(p.position));

  const offense = offPlayers.length > 0
    ? offPlayers.map((p) => computePlayerAvg(p.ratings)).reduce((a, b) => a + b, 0) / offPlayers.length
    : overall;
  const defense = defPlayers.length > 0
    ? defPlayers.map((p) => computePlayerAvg(p.ratings)).reduce((a, b) => a + b, 0) / defPlayers.length
    : overall;

  const coachValues = Object.values(coach.ratings);
  const coaching = coachValues.reduce((a, b) => a + b, 0) / coachValues.length;
  const form = 40 + rng() * 30;
  const depth = 30 + rng() * 40;

  return {
    overall: Math.round(overall * 100) / 100,
    offense: Math.round(offense * 100) / 100,
    defense: Math.round(defense * 100) / 100,
    form: Math.round(form * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    coaching: Math.round(coaching * 100) / 100,
  };
}

// ─── Soccer League ──────────────────────────────────────────────────

async function seedSoccerLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number,
): Promise<number> {
  let count = 0;
  const preset = getPreset("soccer");
  const leagueSeed = hashString("World Association Football — Premier Division");

  const league = await prisma.sportLeague.create({
    data: {
      name: "World Association Football — Premier Division",
      sportPreset: "soccer",
      archetype: "league",
      teamCount: 20,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
    },
  });
  count++;

  // Create teams
  const teams: Array<{ id: string; name: string; players: ReturnType<typeof generateTeamRoster>; coach: ReturnType<typeof generateCoach> }> = [];
  const teamRecords: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < 20; i++) {
    const city = CITY_NAMES[i]!;
    const teamName = `${city} FC`;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: teamName,
        shortName: city,
        city,
        color: ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#9333ea",
               "#ea580c", "#0891b2", "#db2777", "#4f46e5", "#65a30d",
               "#0d9488", "#be123c", "#7c3aed", "#b45309", "#059669",
               "#1d4ed8", "#a21caf", "#b91c1c", "#0e7490", "#4d7c0f"][i],
        foundedIxTime: ixNow - 1440 * 365 * (20 + (i % 15)),
      },
    });
    count++;

    const players = generateTeamRoster({ sport: "soccer", rosterSize: 23, seed: teamSeed });
    const coach = generateCoach({ seed: teamSeed + 1 });

    // Create players
    for (const player of players) {
      await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          number: 1 + Math.floor(createRNG(teamSeed + hashString(player.lastName))() * 99),
          age: player.age,
          careerStage: player.careerStage,
          ratings: player.ratings,
          isActive: true,
        },
      });
      count++;
    }

    // Create coach
    await prisma.sportCoach.create({
      data: {
        teamId: team.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        role: coach.role,
        age: coach.age,
        careerStage: coach.careerStage,
        ratings: coach.ratings,
        isActive: true,
      },
    });
    count++;

    teamRecords.push({ id: team.id, name: teamName });
    teams.push({ id: team.id, name: teamName, players, coach });
  }

  // Create season
  const seasonStart = ixNow - 259200; // ~180 IxTime days ago
  const seasonEnd = ixNow - 7200; // ~5 IxTime days ago
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // Generate schedule
  const fixtures = generateSchedule({ archetype: "league", teamCount: 20, homeAwayFormat: "double" });

  // Compute rating vectors for each team
  const ratingVectors = teams.map((t) => computeTeamRatingVector(t.players, t.coach, "soccer", hashString(t.name)));

  // Create team seasons with rating vectors
  for (let i = 0; i < teams.length; i++) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: teams[i].id,
        ratingVector: ratingVectors[i],
      },
    });
    count++;
  }

  // Resolve matches and track standings
  const standings = new Map<string, { wins: number; losses: number; draws: number; gf: number; ga: number }>();
  for (const t of teams) {
    standings.set(t.id, { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 });
  }

  let matchIdx = 0;
  for (const fixture of fixtures) {
    const homeTeam = teams[fixture.homeTeamIndex]!;
    const awayTeam = teams[fixture.awayTeamIndex]!;
    const matchSeed = leagueSeed + 200000 + matchIdx * 7919;

    const homeRating = ratingVectors[fixture.homeTeamIndex]!;
    const awayRating = ratingVectors[fixture.awayTeamIndex]!;

    const result = resolveMatch({
      sport: "soccer",
      homeTeam: homeRating,
      awayTeam: awayRating,
      archetype: "league",
      seed: matchSeed,
    });

    const matchIxTime = seasonStart + fixture.matchDay * 1440;

    await prisma.sportMatch.create({
      data: {
        seasonId: season.id,
        matchDay: fixture.matchDay,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: "completed",
        scheduledIxTime: matchIxTime,
        resolvedIxTime: matchIxTime + 120,
        matchStats: result.keyStats,
        homeRatingBefore: homeRating,
        awayRatingBefore: awayRating,
        homeRatingAfter: {
          ...homeRating,
          overall: Math.round((homeRating.overall + result.homeRatingDelta) * 100) / 100,
        },
        awayRatingAfter: {
          ...awayRating,
          overall: Math.round((awayRating.overall + result.awayRatingDelta) * 100) / 100,
        },
      },
    });
    count++;

    const hStand = standings.get(homeTeam.id)!;
    const aStand = standings.get(awayTeam.id)!;
    hStand.gf += result.homeScore;
    hStand.ga += result.awayScore;
    aStand.gf += result.awayScore;
    aStand.ga += result.homeScore;

    if (result.winner === "home") {
      hStand.wins++;
      aStand.losses++;
    } else if (result.winner === "away") {
      aStand.wins++;
      hStand.losses++;
    } else {
      hStand.draws++;
      aStand.draws++;
    }
    matchIdx++;
  }

  // Create standings
  const standingsArr = Array.from(standings.entries()).map(([teamId, s]) => {
    const points = s.wins * 3 + s.draws;
    return { teamId, points, ...s };
  });
  standingsArr.sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));

  for (let rank = 0; rank < standingsArr.length; rank++) {
    const s = standingsArr[rank]!;
    await prisma.sportStanding.create({
      data: {
        seasonId: season.id,
        teamId: s.teamId,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        points: s.points,
        pointsFor: s.gf,
        pointsAgainst: s.ga,
        rank: rank + 1,
      },
    });
    count++;
  }

  // Set champion
  const champion = standingsArr[0]!;
  await prisma.sportSeason.update({
    where: { id: season.id },
    data: { championTeamId: champion.teamId },
  });

  // Create season record for champion
  await prisma.sportSeasonRecord.create({
    data: {
      leagueId: league.id,
      seasonId: season.id,
      recordType: "champion",
      holderId: champion.teamId,
      value: `${teamRecords.find((t) => t.id === champion.teamId)?.name ?? "Unknown"} - Season 1 Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
    },
  });
  count++;

  // Create records for top performers
  if (standingsArr.length >= 2) {
    await prisma.sportSeasonRecord.create({
      data: {
        leagueId: league.id,
        seasonId: season.id,
        recordType: "runner_up",
        holderId: standingsArr[1]!.teamId,
        value: `${teamRecords.find((t) => t.id === standingsArr[1]!.teamId)?.name ?? "Unknown"} - Season 1 Runner-up`,
      },
    });
    count++;
  }

  // Most goals scored
  let maxGf = 0;
  let maxGfTeamId = "";
  for (const s of standingsArr) {
    if (s.gf > maxGf) {
      maxGf = s.gf;
      maxGfTeamId = s.teamId;
    }
  }
  if (maxGfTeamId) {
    await prisma.sportSeasonRecord.create({
      data: {
        leagueId: league.id,
        seasonId: season.id,
        recordType: "most_goals",
        holderId: maxGfTeamId,
        value: `${maxGf} goals in Season 1`,
      },
    });
    count++;
  }

  return count;
}

// ─── F1 / Motorsport ────────────────────────────────────────────────

async function seedF1League(
  prisma: Prisma,
  userId: string,
  ixNow: number,
): Promise<number> {
  let count = 0;
  const preset = getPreset("f1");
  const leagueSeed = hashString("IRF World Championship");
  const raceCount = 20;

  const league = await prisma.sportLeague.create({
    data: {
      name: "IRF World Championship",
      sportPreset: "f1",
      archetype: "circuit",
      teamCount: 10,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
    },
  });
  count++;

  // Create teams
  const teams: Array<{ id: string; name: string; drivers: Array<{ id: string; ratings: Record<string, number> }> }> = [];

  for (let i = 0; i < 10; i++) {
    const constructorName = F1_CONSTRUCTOR_NAMES[i]!;
    const shortName = constructorName.split(" ")[0]!;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: constructorName,
        shortName,
        color: F1_CONSTRUCTOR_COLORS[i],
        foundedIxTime: ixNow - 1440 * 365 * (15 + (i % 10)),
      },
    });
    count++;

    const rng = createRNG(teamSeed);

    // Create 2 drivers
    const drivers: Array<{ id: string; ratings: Record<string, number> }> = [];
    for (let d = 0; d < 2; d++) {
      const driverSeed = teamSeed + 100 + d * 7919;
      const drng = createRNG(driverSeed);
      const driverRatings: Record<string, number> = {
        pace: Math.round(50 + drng() * 45),
        consistency: Math.round(40 + drng() * 50),
        wetSkill: Math.round(30 + drng() * 60),
        overtaking: Math.round(35 + drng() * 55),
        tyreManagement: Math.round(40 + drng() * 50),
        technicalFeedback: Math.round(30 + drng() * 60),
        starts: Math.round(40 + drng() * 50),
      };
      const firstName = ["Alex", "Marco", "Yuki", "Dmitri", "Carlos", "Liam", "Jean", "Hiroshi", "Omar", "Viktor",
        "Andre", "Sven", "Kwame", "Diego", "Enzo", "Kai", "Sergei", "Pedro", "Luca", "Niko"][i * 2 + d]!;
      const lastName = ["Kozlov", "Dubois", "Tanaka", "Muller", "Santos", "Park", "Ferrari", "Jensen",
        "Nakamura", "Silva", "Petrov", "Kowalski", "Garcia", "Rossi", "Fernandez", "Chen",
        "Vasquez", "Lindberg", "Costa", "Zhang"][i * 2 + d]!;

      const driver = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName,
          lastName,
          position: "driver",
          number: d === 0 ? 1 : 2,
          age: Math.floor(20 + drng() * 15),
          careerStage: "prime",
          ratings: driverRatings,
          isActive: true,
        },
      });
      count++;
      drivers.push({ id: driver.id, ratings: driverRatings });
    }

    // Create team principal
    const tpRatings = {
      pace: Math.round(rng() * 30),
      consistency: Math.round(rng() * 30),
      wetSkill: Math.round(rng() * 30),
      overtaking: Math.round(rng() * 30),
      tyreManagement: Math.round(30 + rng() * 40),
      technicalFeedback: Math.round(50 + rng() * 40),
      starts: Math.round(rng() * 30),
    };
    const tp = await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: ["Henrik", "Matteo", "Bjorn", "Anton", "Gustav", "Erik", "Ravi", "Idris", "Sami", "Boris"][i]!,
        lastName: ["Berg", "Vogel", "Jensen", "Romanov", "Holm", "Sorensen", "Ibrahim", "Mwangi", "Larsson", "Novak"][i]!,
        position: "team_principal",
        age: Math.floor(40 + rng() * 20),
        careerStage: "prime",
        ratings: tpRatings,
        isActive: true,
      },
    });
    count++;

    // Create race engineer
    const reRatings = {
      pace: Math.round(rng() * 30),
      consistency: Math.round(30 + rng() * 40),
      wetSkill: Math.round(30 + rng() * 40),
      overtaking: Math.round(rng() * 25),
      tyreManagement: Math.round(40 + rng() * 45),
      technicalFeedback: Math.round(50 + rng() * 40),
      starts: Math.round(rng() * 25),
    };
    await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: ["Wei", "Jin", "Ahmad", "Tunde", "Kofi", "Ren", "Ali", "Piotr", "Zain", "Tomás"][i]!,
        lastName: ["Yamamoto", "Watanabe", "Ito", "Ndiaye", "Choi", "Okafor", "Adebayo", "Singh", "Moreau", "Roux"][i]!,
        position: "race_engineer",
        age: Math.floor(30 + rng() * 20),
        careerStage: "prime",
        ratings: reRatings,
        isActive: true,
      },
    });
    count++;

    teams.push({ id: team.id, name: constructorName, drivers });
  }

  // Create season
  const seasonStart = ixNow - 259200;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // Create team seasons
  for (const team of teams) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        ratingVector: { overall: 50, offense: 50, defense: 50, form: 50, depth: 50, coaching: 50 },
      },
    });
    count++;
  }

  // Driver standings accumulator
  const driverPoints = new Map<string, number>();
  const constructorPoints = new Map<string, number>();
  for (const t of teams) {
    constructorPoints.set(t.id, 0);
    for (const d of t.drivers) {
      driverPoints.set(d.id, 0);
    }
  }

  // Create and resolve races
  for (let raceNum = 0; raceNum < raceCount; raceNum++) {
    const raceSeed = leagueSeed + 300000 + raceNum * 7919;
    const circuitName = CIRCUIT_NAMES[raceNum]!;
    const raceIxTime = seasonStart + raceNum * 8640; // ~ every 6 IxTime days

    // Generate qualifying grid (just random order for demo)
    const rng = createRNG(raceSeed);
    const allDrivers = teams.flatMap((t) =>
      t.drivers.map((d) => ({
        driverId: d.id,
        teamId: t.id,
        pace: d.ratings.pace ?? 50,
        consistency: d.ratings.consistency ?? 50,
        wetSkill: d.ratings.wetSkill ?? 50,
        overtaking: d.ratings.overtaking ?? 50,
        tyreManagement: d.ratings.tyreManagement ?? 50,
        starts: d.ratings.starts ?? 50,
      }))
    );

    const grid = allDrivers.map((d, idx) => ({
      driverId: d.driverId,
      teamId: d.teamId,
      gridPosition: idx + 1,
    }));

    // Resolve race
    const isWet = rng() < 0.2;
    const result = resolveRace({
      drivers: allDrivers,
      seed: raceSeed + 1,
      isWet,
    });

    await prisma.sportRace.create({
      data: {
        seasonId: season.id,
        raceNumber: raceNum + 1,
        circuitName,
        raceIxTime,
        status: "completed",
        grid: JSON.stringify(grid),
        results: JSON.stringify(result.positions),
        weather: isWet ? "wet" : "dry",
      },
    });
    count++;

    // Update standings
    for (const pos of result.positions) {
      driverPoints.set(pos.driverId, (driverPoints.get(pos.driverId) ?? 0) + pos.points);
      if (pos.fastestLap) {
        driverPoints.set(pos.driverId, (driverPoints.get(pos.driverId) ?? 0) + 1);
      }
      constructorPoints.set(pos.teamId, (constructorPoints.get(pos.teamId) ?? 0) + pos.points);
    }
  }

  // Determine champion
  const driverStandings = Array.from(driverPoints.entries()).sort((a, b) => b[1] - a[1]);
  const constructorStandings = Array.from(constructorPoints.entries()).sort((a, b) => b[1] - a[1]);

  const championDriverId = driverStandings[0]?.[0];
  const championTeamId = constructorStandings[0]?.[0];

  if (championTeamId) {
    await prisma.sportSeason.update({
      where: { id: season.id },
      data: { championTeamId },
    });
  }

  // Create driver champion record
  if (championDriverId) {
    const driver = await prisma.sportPlayer.findUnique({
      where: { id: championDriverId },
      select: { firstName: true, lastName: true, team: { select: { name: true } } },
    });
    if (driver) {
      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "drivers_champion",
          holderId: championDriverId,
          value: `${driver.firstName} ${driver.lastName} (${driver.team.name}) - ${driverStandings[0]![1]} pts`,
        },
      });
      count++;
    }
  }

  // Create constructor champion record
  if (championTeamId) {
    const team = teams.find((t) => t.id === championTeamId);
    if (team) {
      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "constructors_champion",
          holderId: championTeamId,
          value: `${team.name} - ${constructorStandings[0]![1]} pts`,
        },
      });
      count++;
    }
  }

  return count;
}

// ─── Boxing Bracket ─────────────────────────────────────────────────

async function seedBoxingLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number,
): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("ICC Heavyweight Grand Prix");

  const league = await prisma.sportLeague.create({
    data: {
      name: "ICC Heavyweight Grand Prix",
      sportPreset: "boxing",
      archetype: "bracket",
      teamCount: 16,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
    },
  });
  count++;

  // Create 16 fighters as individual teams
  const fighters: Array<{
    teamId: string;
    playerId: string;
    name: string;
    ratings: Record<string, number>;
  }> = [];

  const fighterFirstNames = [
    "Marco", "Dmitri", "Carlos", "Kwame", "Diego", "Boris", "Tunde", "Enzo",
    "Sergei", "Pedro", "Mateo", "Thiago", "Arjun", "Luca", "Niko", "Ivan",
  ];
  const fighterLastNames = [
    "Kozlov", "Santos", "Okafor", "Ferrari", "Mwangi", "Petrov", "Ndiaye", "Rossi",
    "Vasquez", "Silva", "Garcia", "Costa", "Singh", "Bianchi", "Tanaka", "Andersen",
  ];

  for (let i = 0; i < 16; i++) {
    const fighterName = `${fighterFirstNames[i]} "${["The Hammer", "Iron", "Lightning", "The Wall", "Bulldog", "Hurricane", "Titan", "Cobra", "The Bear", "Falcon", "Wolf", "Dragon", "Gladiator", "Phantom", "Viper", "Cyclone"][i]}" ${fighterLastNames[i]}`;
    const fighterSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: fighterName,
        shortName: `${fighterFirstNames[i]} ${fighterLastNames[i]}`,
        color: ["#dc2626", "#2563eb", "#ca8a04", "#16a34a", "#9333ea",
               "#ea580c", "#0891b2", "#db2777", "#4f46e5", "#65a30d",
               "#0d9488", "#be123c", "#7c3aed", "#b45309", "#059669", "#1d4ed8"][i],
        foundedIxTime: ixNow - 1440 * 365 * 5,
      },
    });
    count++;

    const rng = createRNG(fighterSeed);
    const fighterRatings: Record<string, number> = {
      power: Math.round(50 + rng() * 45),
      speed: Math.round(40 + rng() * 50),
      stamina: Math.round(40 + rng() * 50),
      defense: Math.round(35 + rng() * 55),
      chin: Math.round(40 + rng() * 50),
      footwork: Math.round(35 + rng() * 55),
      ringIQ: Math.round(30 + rng() * 60),
    };

    const player = await prisma.sportPlayer.create({
      data: {
        teamId: team.id,
        firstName: fighterFirstNames[i]!,
        lastName: fighterLastNames[i]!,
        position: "fighter",
        age: Math.floor(22 + rng() * 12),
        careerStage: "prime",
        ratings: fighterRatings,
        isActive: true,
      },
    });
    count++;

    fighters.push({
      teamId: team.id,
      playerId: player.id,
      name: `${fighterFirstNames[i]!} ${fighterLastNames[i]!}`,
      ratings: fighterRatings,
    });
  }

  // Create season
  const seasonStart = ixNow - 129600;
  const seasonEnd = ixNow - 7200;
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: seasonStart,
      endIxTime: seasonEnd,
    },
  });
  count++;

  // Create team seasons
  for (const f of fighters) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: f.teamId,
        ratingVector: {
          overall: Math.round(computePlayerAvg(f.ratings)),
          offense: Math.round((f.ratings.power + f.ratings.speed) / 2),
          defense: Math.round((f.ratings.defense + f.ratings.chin) / 2),
          form: 50,
          depth: 50,
          coaching: 50,
        },
      },
    });
    count++;
  }

  // Manually run bracket tournament: 16 → 8 → 4 → 2 → champion
  // Round 1: seed 1 vs 16, 2 vs 15, 3 vs 14, ... 8 vs 9
  let roundFighters: Array<typeof fighters[number]> = [...fighters];
  // Reorder for bracket pairing: top of bracket vs bottom
  const bracketOrder: typeof fighters = [];
  const half = 8;
  for (let i = 0; i < half; i++) {
    bracketOrder.push(roundFighters[i]!, roundFighters[15 - i]!);
  }
  roundFighters = bracketOrder;

  let roundNum = 1;
  let bracketMatchCount = 0;

  while (roundFighters.length >= 2) {
    const nextRound: typeof fighters = [];
    const isChampionship = roundFighters.length === 2;

    for (let i = 0; i < roundFighters.length; i += 2) {
      const homeFighter = roundFighters[i]!;
      const awayFighter = roundFighters[i + 1]!;
      const matchSeed = leagueSeed + 400000 + bracketMatchCount * 7919;
      bracketMatchCount++;

      const homeRatingVector: TeamRatingVector = {
        overall: Math.round(computePlayerAvg(homeFighter.ratings)),
        offense: Math.round((homeFighter.ratings.power + homeFighter.ratings.speed) / 2),
        defense: Math.round((homeFighter.ratings.defense + homeFighter.ratings.chin) / 2),
        form: 50,
        depth: 50,
        coaching: 50,
      };
      const awayRatingVector: TeamRatingVector = {
        overall: Math.round(computePlayerAvg(awayFighter.ratings)),
        offense: Math.round((awayFighter.ratings.power + awayFighter.ratings.speed) / 2),
        defense: Math.round((awayFighter.ratings.defense + awayFighter.ratings.chin) / 2),
        form: 50,
        depth: 50,
        coaching: 50,
      };

      const result = resolveMatch({
        sport: "boxing",
        homeTeam: homeRatingVector,
        awayTeam: awayRatingVector,
        archetype: "bracket",
        seed: matchSeed,
        context: { isChampionship, isPlayoff: !isChampionship },
      });

      const boutIxTime = seasonStart + roundNum * 2880;

      const winnerId = result.winner === "home" ? homeFighter.playerId : awayFighter.playerId;
      const methods = ["KO", "TKO", "UD", "SD", "MD"];

      await prisma.sportBracket.create({
        data: {
          seasonId: season.id,
          round: roundNum,
          weightClass: "heavyweight",
          fighter1Id: homeFighter.playerId,
          fighter2Id: awayFighter.playerId,
          winnerId,
          status: "completed",
          scheduledIxTime: boutIxTime,
          resolvedIxTime: boutIxTime + 60,
          result: {
            method: methods[bracketMatchCount % methods.length]!,
            round: Math.floor(1 + createRNG(matchSeed + 99)() * 12),
            time: `${Math.floor(1 + createRNG(matchSeed + 100)() * 3)}:${String(Math.floor(createRNG(matchSeed + 101)() * 60)).padStart(2, "0")}`,
          },
        },
      });
      count++;

      nextRound.push(result.winner === "home" ? homeFighter : awayFighter);
    }

    roundFighters = nextRound;
    roundNum++;

    // Champion determined
    if (roundFighters.length === 1) {
      const champion = roundFighters[0]!;
      await prisma.sportSeason.update({
        where: { id: season.id },
        data: { championTeamId: champion.teamId },
      });

      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: league.id,
          seasonId: season.id,
          recordType: "champion",
          holderId: champion.teamId,
          value: `${champion.name} - ICC Heavyweight Grand Prix Champion`,
        },
      });
      count++;
    }
  }

  return count;
}

// ─── Main Entry Point ───────────────────────────────────────────────

export async function seedSportsLeagues(
  prisma: Prisma,
  countryId: string,
  userId: string,
): Promise<number> {
  let count = 0;
  const ixNow = IxTime.getCurrentIxTime();

  // Check if canonical leagues already exist
  const existing = await prisma.sportLeague.count({ where: { isCanonical: true } });
  if (existing > 0) {
    return 0;
  }

  count += await seedSoccerLeague(prisma, userId, ixNow);
  count += await seedF1League(prisma, userId, ixNow);
  count += await seedBoxingLeague(prisma, userId, ixNow);

  return count;
}
