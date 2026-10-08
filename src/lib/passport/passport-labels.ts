/**
 * Passport stat wording shared by the front face, the page metadata and the OG image. Client-safe.
 */

/** "1 realm · 1 nation", "2 realms · 3 nations"; null when no nation is held. */
export function realmsAndNations(realmCount: number, nationCount: number): string | null {
  if (nationCount < 1) return null;
  const realms = `${realmCount} ${realmCount === 1 ? "realm" : "realms"}`;
  const nations = `${nationCount} ${nationCount === 1 ? "nation" : "nations"}`;
  return `${realms} · ${nations}`;
}

/** "#14 Lorewards · 47 pts"; without a rank, "Lorewards · 47 pts". */
export function lorewardsLabel(score: number, rank: number | null): string {
  const standing = rank === null ? "" : `#${rank.toLocaleString("en-US")} `;
  return `${standing}Lorewards · ${score.toLocaleString("en-US")} pts`;
}
