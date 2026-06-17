/** Local cover image per sport preset. Files live in /public/images/sports/league-covers/.
 *  Missing files fall back to a gradient+emoji placeholder via <LeagueCover>. */
export const SPORT_COVER: Record<string, string> = {
  soccer: "/images/sports/league-covers/soccer.jpg",
  football: "/images/sports/league-covers/football.jpg",
  hockey: "/images/sports/league-covers/hockey.jpg",
  basketball: "/images/sports/league-covers/basketball.jpg",
  baseball: "/images/sports/league-covers/baseball.jpg",
  f1: "/images/sports/league-covers/f1.jpg",
  boxing: "/images/sports/league-covers/boxing.jpg",
};

export function sportCover(sportPreset: string | undefined): string | undefined {
  if (!sportPreset) return undefined;
  return SPORT_COVER[sportPreset];
}
