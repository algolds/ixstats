import type { RosterPlayer } from "./types";

export function getPlayerOverall(p: any): number {
  const ratings = p?.ratings;
  if (!ratings) return 50;
  if (typeof ratings.overall === "number") return ratings.overall;
  const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
  if (values.length === 0) return 50;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function extractHockeyLines(roster: RosterPlayer[] | undefined, defaultRating: number) {
  const playersByPos: Record<string, RosterPlayer[]> = { G: [], D: [], C: [], LW: [], RW: [] };
  if (roster) {
    for (const p of roster) {
      const pos = p.position?.toUpperCase();
      if (playersByPos[pos]) {
        playersByPos[pos]!.push(p);
      }
    }
  }

  // Sort by overall desc
  for (const pos of Object.keys(playersByPos)) {
    playersByPos[pos]!.sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
  }

  const getPlayerOrFallback = (pos: string, index: number) => {
    const list = playersByPos[pos];
    if (list && list[index]) return list[index];
    if (list && list[0]) return list[0];
    if (roster && roster[0]) return roster[0];
    return {
      id: `fallback_${pos}_${index}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: {
        overall: defaultRating,
        offense: defaultRating,
        defense: defaultRating,
        skating: defaultRating,
        positioning: defaultRating,
        reflexes: defaultRating,
      },
    };
  };

  const l1_c = getPlayerOrFallback("C", 0);
  const l1_lw = getPlayerOrFallback("LW", 0);
  const l1_rw = getPlayerOrFallback("RW", 0);
  const l1_d1 = getPlayerOrFallback("D", 0);
  const l1_d2 = getPlayerOrFallback("D", 1);

  const l2_c = getPlayerOrFallback("C", 1);
  const l2_lw = getPlayerOrFallback("LW", 1);
  const l2_rw = getPlayerOrFallback("RW", 1);
  const l2_d1 = getPlayerOrFallback("D", 2);
  const l2_d2 = getPlayerOrFallback("D", 3);

  const goalie = getPlayerOrFallback("G", 0);

  const computeAvgAttr = (players: any[], attrs: string[]) => {
    let sum = 0;
    let count = 0;
    for (const p of players) {
      const r = p.ratings || {};
      for (const a of attrs) {
        if (typeof r[a] === "number") {
          sum += r[a];
          count++;
        }
      }
    }
    return count > 0 ? sum / count : defaultRating;
  };

  const l1_off = computeAvgAttr([l1_c, l1_lw, l1_rw], ["shooting", "passing", "skating"]);
  const l1_def = computeAvgAttr([l1_d1, l1_d2], ["checking", "positioning", "physical"]);

  const l2_off = computeAvgAttr([l2_c, l2_lw, l2_rw], ["shooting", "passing", "skating"]);
  const l2_def = computeAvgAttr([l2_d1, l2_d2], ["checking", "positioning", "physical"]);

  const goalie_def = computeAvgAttr([goalie], ["reflexes", "positioning"]);

  return {
    line1: { offense: l1_off, defense: l1_def },
    line2: { offense: l2_off, defense: l2_def },
    goalie: { defense: goalie_def },
  };
}

export function extractBasketballRoster(roster: RosterPlayer[] | undefined, defaultRating: number) {
  const playersByPos: Record<string, RosterPlayer[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  if (roster) {
    for (const p of roster) {
      const pos = p.position?.toUpperCase();
      if (playersByPos[pos]) {
        playersByPos[pos]!.push(p);
      }
    }
  }

  const getPlayerOrFallback = (pos: string, idx: number) => {
    const list = playersByPos[pos] || [];
    if (list[idx]) return list[idx];
    if (list[0]) return list[0];
    if (roster && roster[0]) return roster[0];
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    pg: getPlayerOrFallback("PG", 0),
    sg: getPlayerOrFallback("SG", 0),
    sf: getPlayerOrFallback("SF", 0),
    pf: getPlayerOrFallback("PF", 0),
    c: getPlayerOrFallback("C", 0),
  };
}

export function extractFootballRoster(roster: RosterPlayer[] | undefined, defaultRating: number) {
  const getPlayerOrFallback = (pos: string) => {
    const found = roster?.find((p) => p.position?.toUpperCase() === pos);
    if (found) return found;
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    qb: getPlayerOrFallback("QB"),
    rb: getPlayerOrFallback("RB"),
    wr: getPlayerOrFallback("WR"),
    te: getPlayerOrFallback("TE"),
    k: getPlayerOrFallback("K"),
    p: getPlayerOrFallback("P"),
  };
}

export function extractBaseballRoster(roster: RosterPlayer[] | undefined, defaultRating: number) {
  const getPlayerOrFallback = (pos: string) => {
    const found = roster?.find((p) => p.position?.toUpperCase() === pos);
    if (found) return found;
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    sp: getPlayerOrFallback("SP"),
    rp: getPlayerOrFallback("RP"),
    cp: getPlayerOrFallback("CP"),
    c: getPlayerOrFallback("C"),
  };
}

export function getRosterPlayerByRoleWeight(
  roster: RosterPlayer[] | undefined,
  defaultName: string,
  rng: () => number
) {
  if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
  const weights = roster.map((p) => {
    const pos = p.position.toUpperCase();
    if (["ST", "W", "AM", "QB", "RB", "WR", "C", "LW", "RW", "SG", "SF", "FIGHTER"].includes(pos))
      return 60;
    if (["CM", "TE", "OL", "PG", "PF"].includes(pos)) return 30;
    return 10;
  });

  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * sum;
  for (let i = 0; i < roster.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) {
      return { id: roster[i]!.id, name: `${roster[i]!.firstName} ${roster[i]!.lastName}` };
    }
  }
  return { id: roster[0]!.id, name: `${roster[0]!.firstName} ${roster[0]!.lastName}` };
}

export function getCardPlayerWeight(roster: RosterPlayer[] | undefined, rng: () => number) {
  if (!roster || roster.length === 0) return null;
  const weights = roster.map((p) => {
    const pos = p.position.toUpperCase();
    if (["GK", "CB", "FB", "DL", "LB", "CB", "S", "D", "G", "PF", "C"].includes(pos)) return 50;
    return 20;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * sum;
  for (let i = 0; i < roster.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) {
      return { id: roster[i]!.id, name: `${roster[i]!.firstName} ${roster[i]!.lastName}` };
    }
  }
  return { id: roster[0]!.id, name: `${roster[0]!.firstName} ${roster[0]!.lastName}` };
}
