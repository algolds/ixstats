/**
 * Sports Leagues Helpers
 */

/** Recompute a season's standings from scratch off completed matches (idempotent). */
export async function recalculateStandings(db: any, seasonId: string) {
  const teams = await db.sportTeamSeason.findMany({
    where: { seasonId },
    select: { teamId: true },
  });

  const matches = await db.sportMatch.findMany({
    where: { seasonId, status: "completed" },
  });

  const statsMap: Record<
    string,
    {
      wins: number;
      losses: number;
      draws: number;
      points: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  > = {};
  for (const t of teams) {
    statsMap[t.teamId] = {
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
  }

  for (const m of matches) {
    const homeScore = m.homeScore ?? 0;
    const awayScore = m.awayScore ?? 0;

    if (!statsMap[m.homeTeamId]) {
      statsMap[m.homeTeamId] = {
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    }
    if (!statsMap[m.awayTeamId]) {
      statsMap[m.awayTeamId] = {
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    }

    statsMap[m.homeTeamId].pointsFor += homeScore;
    statsMap[m.homeTeamId].pointsAgainst += awayScore;
    statsMap[m.awayTeamId].pointsFor += awayScore;
    statsMap[m.awayTeamId].pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      statsMap[m.homeTeamId].wins += 1;
      statsMap[m.homeTeamId].points += 3;
      statsMap[m.awayTeamId].losses += 1;
    } else if (awayScore > homeScore) {
      statsMap[m.awayTeamId].wins += 1;
      statsMap[m.awayTeamId].points += 3;
      statsMap[m.homeTeamId].losses += 1;
    } else {
      statsMap[m.homeTeamId].draws += 1;
      statsMap[m.homeTeamId].points += 1;
      statsMap[m.awayTeamId].draws += 1;
      statsMap[m.awayTeamId].points += 1;
    }
  }

  const standingsArray = Object.entries(statsMap).map(([teamId, stats]) => ({
    teamId,
    ...stats,
    diff: stats.pointsFor - stats.pointsAgainst,
  }));

  standingsArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });

  for (let idx = 0; idx < standingsArray.length; idx++) {
    const item = standingsArray[idx];
    await db.sportStanding.upsert({
      where: { seasonId_teamId: { seasonId, teamId: item.teamId } },
      create: {
        seasonId,
        teamId: item.teamId,
        wins: item.wins,
        losses: item.losses,
        draws: item.draws,
        points: item.points,
        pointsFor: item.pointsFor,
        pointsAgainst: item.pointsAgainst,
        position: idx + 1,
      },
      update: {
        wins: item.wins,
        losses: item.losses,
        draws: item.draws,
        points: item.points,
        pointsFor: item.pointsFor,
        pointsAgainst: item.pointsAgainst,
        position: idx + 1,
      },
    });
  }
}
