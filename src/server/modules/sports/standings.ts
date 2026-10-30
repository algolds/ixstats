/**
 * A season's standings table: what the league page shows (`sports.getStandings`) and what "Publish to wiki" writes.
 */
import type { PrismaClient } from "@prisma/client";

export type StandingsDb = Pick<PrismaClient, "sportStanding">;

/** The season's standings with each team, best first (points, then points for, then fewest against), numbered from 1. */
export async function getSeasonStandings(db: StandingsDb, seasonId: string) {
  const standings = await db.sportStanding.findMany({
    where: { seasonId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          logo: true,
          wikiSlug: true,
        },
      },
    },
    orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
  });

  return standings.map((s, i) => ({ ...s, position: i + 1 }));
}
