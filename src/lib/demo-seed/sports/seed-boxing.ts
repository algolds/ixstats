/**
 * Demo seed for boxing bracket tournament (ICC Heavyweight Grand Prix).
 */

import { type PrismaClient } from "@prisma/client";
import { createRNG, resolveMatch, type TeamRatingVector } from "../../sports";
import sportsData from "../../../../data/seed/sports-leagues.json";
import { downloadImageForSeed, hashString, computePlayerAvg } from "./sports-helpers";

type Prisma = PrismaClient;

const { boxingFighters: BOXING_FIGHTERS } = sportsData;

export async function seedBoxingLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number
): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("ICC Heavyweight Grand Prix");

  const coverImage = await downloadImageForSeed(
    "https://upload.wikimedia.org/wikipedia/commons/7/7e/Boxing_ring.jpg"
  );
  const league = await prisma.sportLeague.create({
    data: {
      name: "ICC Heavyweight Grand Prix",
      sportPreset: "boxing",
      archetype: "bracket",
      teamCount: BOXING_FIGHTERS.firstNames.length,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  const fighters: Array<{
    teamId: string;
    playerId: string;
    name: string;
    ratings: Record<string, number>;
  }> = [];

  for (let i = 0; i < BOXING_FIGHTERS.firstNames.length; i++) {
    const fighterName = `${BOXING_FIGHTERS.firstNames[i]} "${BOXING_FIGHTERS.nicknames[i]}" ${BOXING_FIGHTERS.lastNames[i]}`;
    const fighterSeed = leagueSeed + i * 1000;

    const team = await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: fighterName,
        shortName: `${BOXING_FIGHTERS.firstNames[i]} ${BOXING_FIGHTERS.lastNames[i]}`,
        color: BOXING_FIGHTERS.colors[i] || "#dc2626",
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
        firstName: BOXING_FIGHTERS.firstNames[i]!,
        lastName: BOXING_FIGHTERS.lastNames[i]!,
        position: "fighter",
        age: Math.floor(22 + rng() * 12),
        careerStage: "prime",
        ratings: fighterRatings,
      },
    });
    count++;

    fighters.push({
      teamId: team.id,
      playerId: player.id,
      name: `${BOXING_FIGHTERS.firstNames[i]!} ${BOXING_FIGHTERS.lastNames[i]!}`,
      ratings: fighterRatings,
    });
  }

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

  let roundFighters = [...fighters];
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
