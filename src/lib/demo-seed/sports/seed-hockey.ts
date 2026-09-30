/**
 * Demo seed for Occidental Hockey League (OHL).
 */

import { type PrismaClient } from "@prisma/client";
import sportsData from "../../../../data/seed/sports-leagues.json";
import { downloadImageForSeed, hashString } from "./sports-helpers";

type Prisma = PrismaClient;

const { ohlTeams: OHL_TEAMS, historicOhlRecords: HISTORIC_OHL_RECORDS } = sportsData;

export async function seedOHLHockeyLeague(
  prisma: Prisma,
  userId: string,
  ixNow: number
): Promise<number> {
  let count = 0;
  // oxlint-disable-next-line typescript/no-unused-vars
  const leagueSeed = hashString("Occidental Hockey League");

  const tierradorCountry = await prisma.country.findFirst({
    where: { name: { contains: "Tierrador", mode: "insensitive" } },
    select: { id: true },
  });
  const countryId = tierradorCountry?.id ?? null;

  const coverImage = await downloadImageForSeed(
    "https://upload.wikimedia.org/wikipedia/commons/5/50/Ice_hockey_match.jpg"
  );
  const league = await prisma.sportLeague.create({
    data: {
      name: "Occidental Hockey League",
      sportPreset: "hockey",
      archetype: "round_robin",
      teamCount: OHL_TEAMS.length,
      isCanonical: true,
      nationAffiliation: "Tierrador",
      createdByUserId: userId,
      status: "active",
      coverImage,
    },
  });
  count++;

  for (let i = 0; i < OHL_TEAMS.length; i++) {
    const meta = OHL_TEAMS[i]!;
    const shortName = meta.name.split(" ").slice(-1)[0]!;

    await prisma.sportTeam.create({
      data: {
        leagueId: league.id,
        name: meta.name,
        shortName,
        city: meta.city,
        color: meta.color,
        foundedIxTime: ixNow - 1440 * 365 * (40 + (i % 20)),
        nationId: countryId,
      },
    });
    count++;
  }

  // Create a season for records
  const season = await prisma.sportSeason.create({
    data: {
      leagueId: league.id,
      seasonNumber: 1,
      status: "completed",
      startIxTime: ixNow - 518400,
      endIxTime: ixNow - 7200,
    },
  });
  count++;

  for (const record of HISTORIC_OHL_RECORDS) {
    await prisma.sportSeasonRecord.create({
      data: {
        leagueId: league.id,
        seasonId: season.id,
        recordType: "watson_cup_historic",
        holderId: league.id,
        value: `${record.year} Watson Cup Winner: ${record.champion} defeat ${record.runnerUp} (${record.score})`,
      },
    });
    count++;
  }

  return count;
}
