/**
 * Demo seed for canonical soccer leagues (Caphirian Imperial League, Ligue Yonderoise).
 */

import { type PrismaClient } from "@prisma/client";
import {
  generateCoach,
  generateSchedule,
  resolveMatch,
  generateTeamRoster,
  createRNG,
} from "../../sports";
import sportsData from "../../../../data/seed/sports-leagues.json";
import {
  downloadImageForSeed,
  hashString,
  computeTeamRatingVector,
  generateCulturallyAppropriateRoster,
} from "./sports-helpers";

type Prisma = PrismaClient;

const {
  caphirianTeams: CAPHIRIAN_TEAMS,
  yonderreTeams: YONDERRE_TEAMS,
} = sportsData;

export async function seedCaphirianSoccerLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number
): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("Caphirian Imperial League");

  const caphiriaCountry = await prisma.country.findFirst({
    where: { name: { contains: "Caphiria", mode: "insensitive" } },
    select: { id: true },
  });
  const caphCountryId = caphiriaCountry?.id ?? null;

  const coverImage = await downloadImageForSeed(
    "https://upload.wikimedia.org/wikipedia/commons/1/16/Wembley_Stadium_interior.jpg"
  );
  const league = await prisma.sportLeague.create({
    data: {
      name: "Caphirian Imperial League",
      sportPreset: "soccer",
      archetype: "league",
      teamCount: CAPHIRIAN_TEAMS.length,
      isCanonical: true,
      nationAffiliation: caphCountryId,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  const teams: Array<{
    id: string;
    name: string;
    players: ReturnType<typeof generateTeamRoster>;
    createdPlayers: Array<{
      id: string;
      firstName: string;
      lastName: string;
      position: string;
      ratings: any;
    }>;
    coach: ReturnType<typeof generateCoach>;
  }> = [];

  for (let i = 0; i < CAPHIRIAN_TEAMS.length; i++) {
    const config = CAPHIRIAN_TEAMS[i]!;
    const teamSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: config.name,
        shortName: config.name.split(" ")[0] ?? config.name,
        city: "Venceia",
        color: config.color,
        foundedIxTime: ixNow - 1440 * 365 * (40 + (i % 25)),
        patronSaint: config.patronSaint,
        nationId: caphCountryId,
      },
    });
    count++;

    const players = generateCulturallyAppropriateRoster("soccer", teamSeed, "caphiria");
    const coach = generateCoach({ seed: teamSeed + 1 });
    const coachRng = createRNG(teamSeed + 2);
    const firsts = ["Lucius", "Gaius", "Marcus", "Aulus", "Flavius", "Tiberius", "Publius"];
    const lasts = ["Aetius", "Decimus", "Aurelius", "Agrippa", "Germanicus", "Severus", "Gracchus"];
    coach.firstName = firsts[Math.floor(coachRng() * firsts.length)]!;
    coach.lastName = lasts[Math.floor(coachRng() * lasts.length)]!;

    const createdPlayers: (typeof teams)[number]["createdPlayers"] = [];
    for (const player of players) {
      const pRecord = await prisma.sportPlayer.create({
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
      createdPlayers.push({
        id: pRecord.id,
        firstName: pRecord.firstName,
        lastName: pRecord.lastName,
        position: pRecord.position,
        ratings: pRecord.ratings,
      });
    }

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

    teams.push({ id: team.id, name: config.name, players, createdPlayers, coach });
  }

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

  const fixtures = generateSchedule({
    archetype: "league",
    teamCount: CAPHIRIAN_TEAMS.length,
    homeAwayFormat: "double",
  });

  const ratingVectors = teams.map((t) =>
    computeTeamRatingVector(t.players, t.coach, "soccer", hashString(t.name))
  );

  for (let i = 0; i < teams.length; i++) {
    await prisma.sportTeamSeason.create({
      data: {
        seasonId: season.id,
        teamId: teams[i]!.id,
        ratingVector: ratingVectors[i] as any,
      },
    });
    count++;
  }

  const standings = new Map<
    string,
    { wins: number; losses: number; draws: number; gf: number; ga: number }
  >();
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
      homeRoster: homeTeam.createdPlayers,
      awayRoster: awayTeam.createdPlayers,
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
        homeRatingBefore: homeRating as any,
        awayRatingBefore: awayRating as any,
        homeRatingAfter: {
          ...homeRating,
          overall: Math.round((homeRating.overall + result.homeRatingDelta) * 100) / 100,
        } as any,
        awayRatingAfter: {
          ...awayRating,
          overall: Math.round((awayRating.overall + result.awayRatingDelta) * 100) / 100,
        } as any,
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

  const standingsArr = Array.from(standings.entries()).map(([teamId, s]) => ({
    teamId,
    points: s.wins * 3 + s.draws,
    ...s,
  }));
  standingsArr.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga));

  for (let r = 0; r < standingsArr.length; r++) {
    const s = standingsArr[r]!;
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
        rank: r + 1,
      },
    });
    count++;
  }

  const champion = standingsArr[0]!;
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
      value: `${teams.find((t) => t.id === champion.teamId)?.name ?? "Unknown"} - Season 1 Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
    },
  });
  count++;

  return count;
}

export async function seedYonderreSoccerLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number
): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("Ligue Yonderoise");

  const yonderreCountry = await prisma.country.findFirst({
    where: { name: { contains: "Yonderre", mode: "insensitive" } },
    select: { id: true },
  });
  const yondCountryId = yonderreCountry?.id ?? null;

  const coverImage = await downloadImageForSeed(
    "https://upload.wikimedia.org/wikipedia/commons/4/42/Football_in_Bloomington%2C_Indiana%2C_1995.jpg"
  );
  const league = await prisma.sportLeague.create({
    data: {
      name: "Ligue Yonderoise",
      sportPreset: "soccer",
      archetype: "round_robin",
      teamCount: YONDERRE_TEAMS.length,
      isCanonical: true,
      nationAffiliation: yondCountryId,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  for (let i = 0; i < YONDERRE_TEAMS.length; i++) {
    const meta = YONDERRE_TEAMS[i]!;
    const teamSeed = leagueSeed + i * 1000;
    const shortName = meta.name.split(" ")[0]!;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: meta.name,
        shortName,
        city: "Toubourg",
        color: meta.color,
        foundedIxTime: ixNow - 1440 * 365 * (25 + (i % 15)),
        nationId: yondCountryId,
      },
    });
    count++;

    const roster = generateCulturallyAppropriateRoster("soccer", teamSeed, "yonderre");
    for (const player of roster) {
      await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          age: player.age,
          careerStage: player.careerStage,
          ratings: player.ratings,
        },
      });
      count++;
    }
  }

  return count;
}
