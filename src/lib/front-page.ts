/** The signed-out front page's featured realm: one per UTC day, the same for every visitor. */

export const MIN_FEATURED_NATIONS = 3;
const DAY_MS = 86_400_000;

export interface FeaturableRealm {
  slug: string;
  nationCount: number;
  hasPoliticalMap: boolean;
}

/** Only directory realms reach here; one also needs a political map and a few nations to lead the page. */
export function isFeaturable(realm: FeaturableRealm): boolean {
  return realm.hasPoliticalMap && realm.nationCount >= MIN_FEATURED_NATIONS;
}

/** Today's realm: the eligible realms in slug order, indexed by the UTC day number. Null when none qualifies. */
export function pickFeaturedRealm<T extends FeaturableRealm>(
  realms: readonly T[],
  now: number
): T | null {
  // Code-point order, not localeCompare, so every server picks the same realm.
  const eligible = realms
    .filter(isFeaturable)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return eligible[Math.floor(now / DAY_MS) % eligible.length] ?? null;
}
