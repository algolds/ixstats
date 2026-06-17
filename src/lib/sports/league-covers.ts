/**
 * Verified Wikimedia Commons cover images per sport, resolved at runtime via the
 * /api/mediawiki/commons/Special:Filepath proxy. One image is picked
 * deterministically per league/team id, so a given entity always shows the same
 * cover. All filenames below were verified to resolve on Commons.
 */
export const SPORT_COVER_POOL: Record<string, string[]> = {
  soccer: [
    "Camp Nou - Interior (2005).jpg",
    "Pitch side view - Wembley Stadium - geograph.org.uk - 4624558.jpg",
    "Milano - stadio Giuseppe Meazza - 202209050049.jpeg",
    "Maracanã stadium.jpg",
    "Allianz arena daylight Richard Bartz.jpg",
  ],
  football: [
    "Hard Rock Stadium Prior to first NFL game.jpg",
    "RAF Mildenhall Honor Guard participates in London NFL game (8055008).jpg",
    "Pathfinders participate in 2023 London NFL Game (8069299).jpg",
  ],
  hockey: [
    "NHL faceoff.jpg",
    "Canucks - Sharks pre-game (6847260642).jpg",
    "NHL Global Series 2019 Globen.jpg",
  ],
  basketball: [
    "Cheering on the Wheelchair Basketball Team 130515-A-BQ341-002.jpg",
    "Eric Musselman on sideline during Nevada at Air Force basketball game, March 7, 2019.jpg",
    "HBCUAllstarBasketball4223-49.jpg",
    "HBCU All-Star Basketball 4-2-23 (60).jpg",
  ],
  baseball: [
    "Hiroshima Municipal Baseball Stadium 2009.JPG",
    "Amerige Park (baseball stadium), Fullerton, California.jpg",
    "Daejeon Hanbat Baseball Stadium Summer 2023.jpg",
    "Takahagi City Baseball Stadium 01.jpg",
  ],
  f1: [
    "2010 Malaysian GP opening lap.jpg",
    "2015 Malaysian GP opening lap.jpg",
    "Formula one.jpg",
  ],
  boxing: [
    "Men boxing in ring with crowd watching, probably at picnic, Bloedel-Donovan Lumber Mills, 1922 (INDOCC 1129).jpg",
    "A crowd of soldiers watching a boxing match at the New Zealand Divisional Sports, Authie (21315001289).jpg",
  ],
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Deterministic Commons cover URL for a sport, seeded by an entity id (league or
 * team). Returns undefined if the sport has no pool. The filename is URL-encoded
 * so the proxy's decodeURIComponent recovers the exact Commons title.
 */
export function sportCoverUrl(
  sportPreset: string | undefined,
  seed: string
): string | undefined {
  const pool = SPORT_COVER_POOL[sportPreset ?? ""];
  if (!pool || pool.length === 0) return undefined;
  const file = pool[hashString(seed) % pool.length]!;
  return `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent(file)}`;
}
