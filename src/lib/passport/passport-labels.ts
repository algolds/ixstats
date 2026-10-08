/**
 * Passport wording shared by the front face, the page metadata and the OG image. Client-safe.
 */

/** The product name on the passport, its page title and its link card. */
export const PASSPORT_TITLE = "IxStates Passport";

/** What the generic passport card says when there is no holder to show. */
export const PASSPORT_GENERIC_DESCRIPTION = "Nations, realms and standing across IxStates.";

/** How a realm role reads on the passport; a plain member is not labelled. */
export const REALM_ROLE_LABEL: Record<"founder" | "officer" | "member", string | null> = {
  founder: "Founder",
  officer: "Officer",
  member: null,
};

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

/** "Since Oct 2025"; null when the join date is unknown. */
export function sinceLabel(joinedAt: string | null): string | null {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Since ${month}`;
}
