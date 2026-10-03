import type { RosterPlayer } from "./types";

export function getPlayerOverall(p: any): number {
  const ratings = p?.ratings;
  if (!ratings) return 50;
  if (typeof ratings.overall === "number") return ratings.overall;
  const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
  if (values.length === 0) return 50;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

const positionOf = (p: RosterPlayer) => p.position?.toUpperCase() ?? "";

const fallbackPlayer = (
  id: string,
  position: string,
  ratings: Record<string, number>
): RosterPlayer => ({ id, firstName: "Fallback", lastName: position, position, ratings });

const offenseDefense = (rating: number) => ({
  overall: rating,
  offense: rating,
  defense: rating,
});

function groupByPosition(roster: RosterPlayer[] | undefined, positions: string[]) {
  const groups: Record<string, RosterPlayer[]> = Object.fromEntries(positions.map((p) => [p, []]));
  for (const player of roster ?? []) groups[positionOf(player)]?.push(player);
  return groups;
}

/** First player at each requested position (keyed by lowercase position), falling back to any roster player, then a placeholder. */
function pickByPosition<K extends string>(
  roster: RosterPlayer[] | undefined,
  positions: readonly K[],
  defaultRating: number
) {
  const groups = groupByPosition(roster, [...positions]);
  return Object.fromEntries(
    positions.map((pos) => [
      pos.toLowerCase(),
      groups[pos]?.[0] ??
        roster?.[0] ??
        fallbackPlayer(`fallback_${pos}`, pos, offenseDefense(defaultRating)),
    ])
  ) as Record<Lowercase<K>, RosterPlayer>;
}

/** First roster player at each requested position, else a placeholder (no roster-wide fallback). */
function findByPosition<K extends string>(
  roster: RosterPlayer[] | undefined,
  positions: readonly K[],
  defaultRating: number
) {
  return Object.fromEntries(
    positions.map((pos) => [
      pos.toLowerCase(),
      roster?.find((p) => positionOf(p) === pos) ??
        fallbackPlayer(`fallback_${pos}`, pos, offenseDefense(defaultRating)),
    ])
  ) as Record<Lowercase<K>, RosterPlayer>;
}

export function extractHockeyLines(roster: RosterPlayer[] | undefined, defaultRating: number) {
  const byPosition = groupByPosition(roster, ["G", "D", "C", "LW", "RW"]);
  for (const list of Object.values(byPosition)) {
    list.sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
  }

  const pick = (pos: string, index: number): RosterPlayer => {
    const list = byPosition[pos]!;
    return (
      list[index] ??
      list[0] ??
      roster?.[0] ??
      fallbackPlayer(`fallback_${pos}_${index}`, pos, {
        ...offenseDefense(defaultRating),
        skating: defaultRating,
        positioning: defaultRating,
        reflexes: defaultRating,
      })
    );
  };

  const avgAttr = (players: RosterPlayer[], attrs: string[]) => {
    const values = players.flatMap((p) =>
      attrs.map((a) => p.ratings?.[a]).filter((v): v is number => typeof v === "number")
    );
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : defaultRating;
  };

  const forwardAttrs = ["shooting", "passing", "skating"];
  const defenseAttrs = ["checking", "positioning", "physical"];
  const line = (n: 0 | 1) => ({
    offense: avgAttr([pick("C", n), pick("LW", n), pick("RW", n)], forwardAttrs),
    defense: avgAttr([pick("D", n * 2), pick("D", n * 2 + 1)], defenseAttrs),
  });

  return {
    line1: line(0),
    line2: line(1),
    goalie: { defense: avgAttr([pick("G", 0)], ["reflexes", "positioning"]) },
  };
}

export const extractBasketballRoster = (
  roster: RosterPlayer[] | undefined,
  defaultRating: number
) => pickByPosition(roster, ["PG", "SG", "SF", "PF", "C"] as const, defaultRating);

export const extractFootballRoster = (roster: RosterPlayer[] | undefined, defaultRating: number) =>
  findByPosition(roster, ["QB", "RB", "WR", "TE", "K", "P"] as const, defaultRating);

export const extractBaseballRoster = (roster: RosterPlayer[] | undefined, defaultRating: number) =>
  findByPosition(roster, ["SP", "RP", "CP", "C"] as const, defaultRating);

const HIGH_ROLE_WEIGHT_POSITIONS = [
  "ST",
  "W",
  "AM",
  "QB",
  "RB",
  "WR",
  "C",
  "LW",
  "RW",
  "SG",
  "SF",
  "FIGHTER",
];
const MID_ROLE_WEIGHT_POSITIONS = ["CM", "TE", "OL", "PG", "PF"];
const CARD_PRONE_POSITIONS = ["GK", "CB", "FB", "DL", "LB", "S", "D", "G", "PF", "C"];

/** Picks one roster player with probability proportional to `weightOf`. */
function pickWeighted(
  roster: RosterPlayer[],
  weightOf: (pos: string) => number,
  rng: () => number
) {
  const weights = roster.map((p) => weightOf(p.position.toUpperCase()));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  const index = weights.findIndex((w) => (roll -= w) <= 0);
  const player = roster[index === -1 ? 0 : index]!;
  return { id: player.id, name: `${player.firstName} ${player.lastName}` };
}

export function getRosterPlayerByRoleWeight(
  roster: RosterPlayer[] | undefined,
  defaultName: string,
  rng: () => number
) {
  if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
  return pickWeighted(
    roster,
    (pos) =>
      HIGH_ROLE_WEIGHT_POSITIONS.includes(pos)
        ? 60
        : MID_ROLE_WEIGHT_POSITIONS.includes(pos)
          ? 30
          : 10,
    rng
  );
}

export function getCardPlayerWeight(roster: RosterPlayer[] | undefined, rng: () => number) {
  if (!roster || roster.length === 0) return null;
  return pickWeighted(roster, (pos) => (CARD_PRONE_POSITIONS.includes(pos) ? 50 : 20), rng);
}
