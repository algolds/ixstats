/**
 * Resolves a player's photo URL dynamically.
 * If the player already has a custom imageUrl, it uses that.
 * Otherwise, it hashes the player's name and ID to deterministically assign one of the 14 sportyblocks photos.
 */
export function getPlayerPhotoUrl(player: {
  id?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string | null;
}) {
  if (player.imageUrl) return player.imageUrl;

  const idStr = player.id || "";
  const firstName = player.firstName || "";
  const lastName = player.lastName || "";
  const nameStr = `${firstName}${lastName}`;
  const key = idStr + nameStr;

  if (!key) return "/images/sportyblocks/player-1.png";

  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Simple heuristic for name-based gender estimation
  const isFemale = isProbablyFemale(firstName);

  // Distribute based on gender estimation to different subsets of the 14 files
  // Odd photos (1, 3, 5, 7, 9, 11, 13) represent male/neutral avatars
  // Even photos (2, 4, 6, 8, 10, 12, 14) represent female/neutral avatars
  const indexSubset = isFemale ? [2, 4, 6, 8, 10, 12, 14] : [1, 3, 5, 7, 9, 11, 13];

  const index = indexSubset[Math.abs(hash % indexSubset.length)];
  return `/images/sportyblocks/player-${index}.png`;
}

function isProbablyFemale(firstName: string): boolean {
  const name = firstName.toLowerCase().trim();

  // Guard for known male or neutral names in the FIRST_NAMES array
  const maleOrNeutralGuards = [
    "yuki",
    "kai",
    "carlos",
    "omar",
    "andre",
    "sergei",
    "wei",
    "takumi",
    "ren",
    "ali",
    "sami",
    "idris",
    "mateo",
    "luca",
    "felipe",
    "dmitri",
    "gustav",
    "oscar",
    "kofi",
    "enzo",
    "pedro",
    "emil",
    "jin",
    "tomás",
    "kenji",
    "zain",
    "henrik",
    "matteo",
    "daisuke",
    "erik",
    "ravi",
    "anton",
    "leon",
  ];

  if (maleOrNeutralGuards.includes(name)) {
    return false;
  }

  // Common female name suffixes (a, ia, ie, y, e)
  if (
    name.endsWith("a") ||
    name.endsWith("ia") ||
    name.endsWith("ie") ||
    name.endsWith("y") ||
    name.endsWith("e")
  ) {
    return true;
  }

  return false;
}
