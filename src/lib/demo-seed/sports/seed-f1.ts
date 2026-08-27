/**
 * Demo seed for Formula 1 circuit league (IRF World Championship).
 */

import { type PrismaClient } from "@prisma/client";
import { createRNG, resolveRace } from "../../sports";
import sportsData from "../../../../data/seed/sports-leagues.json";
import { downloadImageForSeed, hashString } from "./sports-helpers";

type Prisma = PrismaClient;

const {
  f1ConstructorNames: F1_CONSTRUCTOR_NAMES,
  f1ConstructorColors: F1_CONSTRUCTOR_COLORS,
  circuitNames: CIRCUIT_NAMES,
  f1Drivers: F1_DRIVERS,
} = sportsData;

export async function seedF1League(prisma: Prisma, userId: string, ixNow: number): Promise<number> {
  let count = 0;
  const leagueSeed = hashString("IRF World Championship");

  const coverImage = await downloadImageForSeed(
    "https://upload.wikimedia.org/wikipedia/commons/9/92/Monaco_Grand_Prix.jpg"
  );
  const league = await prisma.sportLeague.create({
    data: {
      name: "IRF World Championship",
      sportPreset: "f1",
      archetype: "circuit",
      teamCount: F1_CONSTRUCTOR_NAMES.length,
      isCanonical: true,
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  const teams: Array<{
    id: string;
    name: string;
    drivers: Array<{ id: string; ratings: Record<string, number> }>;
  }> = [];

  for (let i = 0; i < F1_CONSTRUCTOR_NAMES.length; i++) {
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

      const driver = await prisma.sportPlayer.create({
        data: {
          teamId: team.id,
          firstName: F1_DRIVERS.firstNames[i * 2 + d] || "Driver",
          lastName: F1_DRIVERS.lastNames[i * 2 + d] || "One",
          position: "driver",
          age: Math.floor(20 + drng() * 15),
          careerStage: "prime",
          ratings: driverRatings,
        },
      });
      count++;
      drivers.push({ id: driver.id, ratings: driverRatings });
    }

    teams.push({ id: team.id, name: constructorName, drivers });
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

  const raceCount = Math.min(CIRCUIT_NAMES.length, 10);
  const driverPoints = new Map<string, number>();
  const constructorPoints = new Map<string, number>();

  for (const t of teams) {
    constructorPoints.set(t.id, 0);
    for (const d of t.drivers) {
      driverPoints.set(d.id, 0);
    }
  }

  for (let raceNum = 0; raceNum < raceCount; raceNum++) {
    const raceSeed = leagueSeed + 300000 + raceNum * 7919;
    const circuitName = CIRCUIT_NAMES[raceNum]!;
    const raceIxTime = seasonStart + raceNum * 8640;

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
        grid: JSON.stringify(
          allDrivers.map((d, idx) => ({
            driverId: d.driverId,
            teamId: d.teamId,
            gridPosition: idx + 1,
          }))
        ),
        results: JSON.stringify(result.positions),
        weather: isWet ? "wet" : "dry",
      },
    });
    count++;

    for (const pos of result.positions) {
      driverPoints.set(pos.driverId, (driverPoints.get(pos.driverId) ?? 0) + pos.points);
      constructorPoints.set(pos.teamId, (constructorPoints.get(pos.teamId) ?? 0) + pos.points);
    }
  }

  const constructorStandings = Array.from(constructorPoints.entries()).sort((a, b) => b[1] - a[1]);
  const championTeamId = constructorStandings[0]?.[0];

  if (championTeamId) {
    await prisma.sportSeason.update({
      where: { id: season.id },
      data: { championTeamId },
    });
  }

  return count;
}
