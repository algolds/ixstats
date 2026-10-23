import type { CardRealmBadge } from "~/lib/cards/face/types";
import type { RouterOutputs } from "~/trpc/react";

export type DirectoryRealm = RouterOutputs["realms"]["directory"][number];

/** The atlas shows its sort and tag filters only at or above this many realms. */
export const ATLAS_FILTER_MIN = 6;

/** The realm page, or one of its tabs (`"nations"`). */
export function realmHref(slug: string, tab?: string): string {
  const base = `/r/${encodeURIComponent(slug)}`;
  return tab ? `${base}/${tab}` : base;
}

/** Nations a newcomer can take in a realm: unclaimed countries plus nation pages no country has taken yet. */
export function openToJoinCount(realm: DirectoryRealm): number {
  return realm.openNationCount + realm.openNationPageCount;
}

/** "1 nation", "3 nations". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** Whether a realm matches a search on its name, description or tags (case-insensitive). */
export function realmMatches(realm: DirectoryRealm, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    realm.name.toLowerCase().includes(q) ||
    !!realm.description?.toLowerCase().includes(q) ||
    realm.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/** The atlas order: most nations open to join first, then by name. Returns a new array. */
export function atlasOrder(realms: DirectoryRealm[]): DirectoryRealm[] {
  return [...realms].sort(
    (a, b) => openToJoinCount(b) - openToJoinCount(a) || a.name.localeCompare(b.name)
  );
}

/** The directory's headline figures: realm count, nations held across them, and nations open to join. */
export function directoryTotals(realms: DirectoryRealm[]): {
  realms: number;
  nations: number;
  open: number;
} {
  return realms.reduce(
    (totals, realm) => ({
      realms: totals.realms + 1,
      nations: totals.nations + realm.nationCount,
      open: totals.open + openToJoinCount(realm),
    }),
    { realms: 0, nations: 0, open: 0 }
  );
}

/** A realm as a card's home-realm badge: its thumbnail becomes the crest. Directory realms are never system realms. */
export function realmBadge(
  realm: Pick<DirectoryRealm, "id" | "slug" | "name" | "thumbnail">
): CardRealmBadge {
  return {
    id: realm.id,
    slug: realm.slug,
    name: realm.name,
    crestUrl: realm.thumbnail,
    isSystem: false,
  };
}
