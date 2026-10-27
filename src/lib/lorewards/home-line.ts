import type { MyTrophies } from "./my-trophies";

const plural = (count: number, one: string) =>
  `${count.toLocaleString()} ${one}${count === 1 ? "" : "s"}`;

/**
 * The Vault dashboard's Lorewards line: the player's record once they have one (a wiki name, a win or a trophy card),
 * else how to take part.
 */
export function lorewardsHomeLine(
  trophies: Pick<MyTrophies, "wins" | "cards" | "wikiUsername"> & { todayRank: number | null }
): string {
  const wins = trophies.wins.daily + trophies.wins.weekly + trophies.wins.monthly;
  if (trophies.wikiUsername === null && wins === 0 && trophies.cards.length === 0) {
    return "Edit the wiki or claim an old IxWiki name";
  }
  const parts = [plural(wins, "win")];
  if (trophies.cards.length > 0) parts.push(plural(trophies.cards.length, "trophy card"));
  if (trophies.todayRank !== null) parts.push(`Today #${trophies.todayRank}`);
  return parts.join(" · ");
}
