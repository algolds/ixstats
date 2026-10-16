// src/lib/sports/trophy-titles.ts
/** The titles of the one-off Trophy cards a sports championship mints (src/lib/sports/transition.ts). */
export function seasonChampionsTitle(teamName: string, seasonNumber: number): string {
  return `${teamName} Season ${seasonNumber} Champions`;
}

export function worldCupChampionsTitle(nationName: string, seasonNumber: number): string {
  return `${nationName} World Cup Season ${seasonNumber} Champions`;
}

/** Both titles: how the cards refresh backfill (§5.3) tells a sports trophy from the other Special cards. */
export const SPORTS_TROPHY_TITLE = /^.+ (?:World Cup )?Season \d+ Champions$/;
